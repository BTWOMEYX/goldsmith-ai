import { useEffect, useState } from "react";
import axios from "axios";
import {
  BadgeDollarSign,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  ShoppingCart,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";

import RealmSelect from "../components/RealmSelect";
import { getGlobalRealmId } from "../utils/globalRealm";

type TradeEntry = {
  id: number;
  buy_queue_item_id: number | null;
  item_id: number;
  realm_id: number;
  realm_name: string;
  item_name: string;
  category: string | null;
  icon_url: string | null;
  quality: string | null;
  quantity_bought: number;
  buy_price_each: number;
  total_buy_cost: number;
  target_sale_price_each: number;
  expected_total_sale_value: number;
  expected_profit: number;
  expected_roi_percent: number;
  quantity_sold: number;
  actual_sale_price_each: number;
  gross_sale_value: number;
  sale_fee_percent: number;
  sale_fee_value: number;
  net_sale_value: number;
  realized_profit: number;
  roi_percent: number;
  status: string;
  decision_grade: string | null;
  final_decision: string | null;
  decision_score: number;
  signal: string | null;
  memory_price_state: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  sold_at: string | null;
};

type PerformanceRow = {
  name: string;
  trade_count: number;
  sold_count: number;
  realized_profit: number;
  total_cost: number;
  roi_percent: number;
  win_rate_percent: number;
};

type TradeSummary = {
  total_count: number;
  open_count: number;
  sold_count: number;
  failed_count: number;
  cancelled_count: number;
  total_invested: number;
  open_exposure: number;
  realized_profit: number;
  expected_open_profit: number;
  roi_percent: number;
  win_rate_percent: number;
  category_performance: PerformanceRow[];
  signal_performance: PerformanceRow[];
  decision_performance: PerformanceRow[];
};

type TradesResponse = {
  status: string;
  summary: TradeSummary;
  items: TradeEntry[];
  error?: string;
};

type BuyQueueItem = {
  id: number;
  item_name: string;
  status: string;
};

type BuyQueueResponse = {
  status: string;
  items: BuyQueueItem[];
  error?: string;
};

const API_BASE_URL = "http://127.0.0.1:8000/api";

const EMPTY_SUMMARY: TradeSummary = {
  total_count: 0,
  open_count: 0,
  sold_count: 0,
  failed_count: 0,
  cancelled_count: 0,
  total_invested: 0,
  open_exposure: 0,
  realized_profit: 0,
  expected_open_profit: 0,
  roi_percent: 0,
  win_rate_percent: 0,
  category_performance: [],
  signal_performance: [],
  decision_performance: [],
};

const STATUS_FILTERS = ["open", "sold", "failed", "cancelled", "all"];

function formatGold(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  return `${Math.round(value).toLocaleString()}g`;
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  const prefix = value > 0 ? "+" : "";

  return `${prefix}${value.toFixed(1)}%`;
}

function getStatusClass(status: string) {
  switch (status) {
    case "open":
      return "border-amber-800 bg-amber-950/40 text-amber-300";
    case "sold":
      return "border-emerald-800 bg-emerald-950/40 text-emerald-300";
    case "failed":
      return "border-red-800 bg-red-950/40 text-red-300";
    case "cancelled":
      return "border-slate-700 bg-slate-950 text-slate-400";
    default:
      return "border-slate-700 bg-slate-950 text-slate-300";
  }
}

function getGradeClass(grade: string | null) {
  switch (grade) {
    case "S":
      return "text-emerald-300";
    case "A":
      return "text-emerald-400";
    case "B":
      return "text-blue-400";
    case "C":
      return "text-amber-400";
    case "D":
      return "text-red-400";
    default:
      return "text-slate-400";
  }
}

export default function ProfitTracker() {
  const [realm, setRealm] = useState(() => getGlobalRealmId());
  const [statusFilter, setStatusFilter] = useState("open");
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const [summary, setSummary] = useState<TradeSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadTrades() {
    try {
      setLoading(true);
      setError("");

      const response = await axios.get<TradesResponse>(
        `${API_BASE_URL}/trades?connected_realm_id=${realm}&status=${statusFilter}`,
      );

      if (response.data.status !== "Success") {
        setError(response.data.error ?? "Unable to load trades.");
        setTrades([]);
        setSummary(EMPTY_SUMMARY);
        return;
      }

      setTrades(response.data.items);
      setSummary(response.data.summary);
    } catch {
      setError("Unable to load trades. Check backend is running.");
      setTrades([]);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }

  async function importBoughtQueueItems() {
    try {
      setWorking(true);
      setError("");
      setMessage("");

      const response = await axios.get<BuyQueueResponse>(
        `${API_BASE_URL}/buy-queue?connected_realm_id=${realm}&status=bought`,
      );

      if (response.data.status !== "Success") {
        setError(response.data.error ?? "Unable to load bought queue items.");
        return;
      }

      if (response.data.items.length === 0) {
        setMessage("No bought Buy Queue items to import yet.");
        return;
      }

      const results = await Promise.allSettled(
        response.data.items.map((item) =>
          axios.post(`${API_BASE_URL}/trades/from-buy-queue/${item.id}`),
        ),
      );

      const successful = results.filter((result) => result.status === "fulfilled").length;

      setMessage(`${successful} bought queue item${successful === 1 ? "" : "s"} converted or already tracked.`);
      await loadTrades();
    } catch {
      setError("Unable to import bought queue items.");
    } finally {
      setWorking(false);
    }
  }

  async function markSold(trade: TradeEntry) {
    const quantityText = window.prompt(
      `Quantity sold for ${trade.item_name}`,
      String(trade.quantity_bought),
    );

    if (!quantityText) {
      return;
    }

    const salePriceText = window.prompt(
      `Sale price each for ${trade.item_name}`,
      String(Math.round(trade.target_sale_price_each)),
    );

    if (!salePriceText) {
      return;
    }

    const feeText = window.prompt("Sale fee percent", String(trade.sale_fee_percent || 5));

    if (!feeText) {
      return;
    }

    const quantitySold = Number(quantityText);
    const actualSalePriceEach = Number(salePriceText);
    const saleFeePercent = Number(feeText);

    if (
      !Number.isFinite(quantitySold) ||
      !Number.isFinite(actualSalePriceEach) ||
      !Number.isFinite(saleFeePercent) ||
      quantitySold <= 0 ||
      actualSalePriceEach < 0 ||
      saleFeePercent < 0
    ) {
      setError("Invalid sale details.");
      return;
    }

    try {
      setWorking(true);
      setError("");
      setMessage("");

      await axios.patch(`${API_BASE_URL}/trades/${trade.id}/mark-sold`, {
        quantity_sold: quantitySold,
        actual_sale_price_each: actualSalePriceEach,
        sale_fee_percent: saleFeePercent,
        notes: "Marked sold from Profit Tracker.",
      });

      setMessage(`${trade.item_name} marked as sold.`);
      await loadTrades();
    } catch {
      setError("Unable to mark trade as sold.");
    } finally {
      setWorking(false);
    }
  }

  async function updateStatus(trade: TradeEntry, status: "open" | "cancelled" | "failed") {
    try {
      setWorking(true);
      setError("");
      setMessage("");

      await axios.patch(`${API_BASE_URL}/trades/${trade.id}/status`, {
        status,
        notes: `Marked ${status} from Profit Tracker.`,
      });

      setMessage(`${trade.item_name} marked ${status}.`);
      await loadTrades();
    } catch {
      setError("Unable to update trade status.");
    } finally {
      setWorking(false);
    }
  }

  async function deleteTrade(trade: TradeEntry) {
    try {
      setWorking(true);
      setError("");
      setMessage("");

      await axios.delete(`${API_BASE_URL}/trades/${trade.id}`);

      setMessage(`${trade.item_name} removed from Profit Tracker.`);
      await loadTrades();
    } catch {
      setError("Unable to remove trade.");
    } finally {
      setWorking(false);
    }
  }

  useEffect(() => {
    loadTrades();
  }, [realm, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BadgeDollarSign size={24} className="text-emerald-400" />
            <h2 className="text-2xl font-bold text-white">Profit Tracker</h2>
          </div>

          <p className="mt-1 text-sm text-slate-400">
            Track bought items, sold prices, realised profit, ROI and which GoldSmith decisions actually work.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <RealmSelect value={realm} onChange={setRealm} />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-500"
          >
            {STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {status.toUpperCase()}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={loadTrades}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            onClick={importBoughtQueueItems}
            disabled={working}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:opacity-60"
          >
            <ShoppingCart size={16} />
            Import Bought
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/50 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-300">
          {message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Open Trades</p>
          <p className="mt-2 text-2xl font-bold text-amber-400">
            {summary.open_count}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Sold Trades</p>
          <p className="mt-2 text-2xl font-bold text-emerald-400">
            {summary.sold_count}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Open Exposure</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {formatGold(summary.open_exposure)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Realised Profit</p>
          <p
            className={`mt-2 text-2xl font-bold ${
              summary.realized_profit >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {formatGold(summary.realized_profit)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">ROI</p>
          <p
            className={`mt-2 text-2xl font-bold ${
              summary.roi_percent >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {formatPercent(summary.roi_percent)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Win Rate</p>
          <p className="mt-2 text-2xl font-bold text-blue-400">
            {formatPercent(summary.win_rate_percent)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <PerformanceCard title="Category Performance" rows={summary.category_performance} />
        <PerformanceCard title="Signal Performance" rows={summary.signal_performance} />
        <PerformanceCard title="Decision Performance" rows={summary.decision_performance} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-[1550px] w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Decision</th>
                <th className="px-4 py-3">Bought</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Sold</th>
                <th className="px-4 py-3">Profit</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    Loading trades...
                  </td>
                </tr>
              ) : trades.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    No trades yet. Mark Buy Queue items as bought, then click Import Bought.
                  </td>
                </tr>
              ) : (
                trades.map((trade) => (
                  <tr
                    key={trade.id}
                    className="border-b border-slate-800/70 transition hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {trade.icon_url ? (
                          <img
                            src={trade.icon_url}
                            alt={trade.item_name}
                            className="h-10 w-10 rounded-lg border border-slate-700 bg-slate-950"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg border border-slate-700 bg-slate-950" />
                        )}

                        <div>
                          <p className="font-semibold text-white">
                            {trade.item_name}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {trade.category ?? "Unknown"} - {trade.realm_name}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-semibold text-white">
                        <span className={getGradeClass(trade.decision_grade)}>
                          {trade.decision_grade ?? "-"}
                        </span>{" "}
                        {trade.final_decision ?? "Decision"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {trade.signal ?? "-"} - {trade.memory_price_state ?? "-"}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-semibold text-white">
                        {trade.quantity_bought} at {formatGold(trade.buy_price_each)}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Cost {formatGold(trade.total_buy_cost)}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-semibold text-amber-400">
                        {formatGold(trade.target_sale_price_each)}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Expected net {formatGold(trade.expected_profit)}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      {trade.status === "sold" ? (
                        <>
                          <p className="font-semibold text-emerald-400">
                            {trade.quantity_sold} at {formatGold(trade.actual_sale_price_each)}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Net {formatGold(trade.net_sale_value)}
                          </p>
                        </>
                      ) : (
                        <p className="text-slate-500">Not sold yet</p>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <p
                        className={`font-semibold ${
                          trade.realized_profit >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {formatGold(trade.realized_profit)}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        ROI {formatPercent(trade.roi_percent)}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${getStatusClass(
                          trade.status,
                        )}`}
                      >
                        <CheckCircle2 size={13} />
                        {trade.status}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {trade.status === "open" && (
                          <>
                            <button
                              type="button"
                              onClick={() => markSold(trade)}
                              disabled={working}
                              className="inline-flex items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-900/40 disabled:opacity-60"
                            >
                              <Wallet size={14} />
                              Sold
                            </button>

                            <button
                              type="button"
                              onClick={() => updateStatus(trade, "failed")}
                              disabled={working}
                              className="inline-flex items-center gap-2 rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-900/40 disabled:opacity-60"
                            >
                              <RotateCcw size={14} />
                              Failed
                            </button>

                            <button
                              type="button"
                              onClick={() => updateStatus(trade, "cancelled")}
                              disabled={working}
                              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-60"
                            >
                              Cancel
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => deleteTrade(trade)}
                          disabled={working}
                          className="inline-flex items-center gap-2 rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-900/40 disabled:opacity-60"
                        >
                          <Trash2 size={14} />
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PerformanceCard({
  title,
  rows,
}: {
  title: string;
  rows: PerformanceRow[];
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp size={17} className="text-emerald-400" />
        <h3 className="font-semibold text-white">{title}</h3>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No sold trade data yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.slice(0, 5).map((row) => (
            <div
              key={row.name}
              className="rounded-lg border border-slate-800 bg-slate-950 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-semibold text-white">
                  {row.name}
                </p>

                <p
                  className={`text-sm font-bold ${
                    row.realized_profit >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {formatGold(row.realized_profit)}
                </p>
              </div>

              <p className="mt-1 text-xs text-slate-500">
                Sold {row.sold_count} / ROI {formatPercent(row.roi_percent)} / Win{" "}
                {formatPercent(row.win_rate_percent)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
