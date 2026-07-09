import { useEffect, useState } from "react";
import axios from "axios";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from "lucide-react";

import {
  getGlobalRealmId,
  listenForGlobalRealmChange,
} from "../utils/globalRealm";

const API_BASE_URL = "http://127.0.0.1:8000/api";

type SellPlanSummary = {
  open_trade_count: number;
  list_now_count: number;
  hold_count: number;
  cut_loss_count: number;
  total_open_cost: number;
  current_net_profit: number;
  current_roi_percent: number;
  recommended_net_profit: number;
};

type SellPlanItem = {
  trade_id: number;
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

  current_market_price: number;
  target_sale_price_each: number;
  break_even_price_each: number;
  recommended_list_price: number;

  current_net_sale_value: number;
  current_net_profit: number;
  current_roi_percent: number;

  target_net_profit: number;
  target_roi_percent: number;

  recommended_net_profit: number;
  recommended_roi_percent: number;

  ah_cut_percent: number;
  sell_action: string;
  sell_priority: number;
  sell_risk_level: string;
  sell_note: string;
  target_hit: boolean;
  above_break_even: boolean;

  decision_grade: string | null;
  final_decision: string | null;
  decision_score: number;
  signal: string | null;
  memory_price_state: string | null;
  notes: string | null;
  created_at: string | null;
};

type SellPlanResponse = {
  status: string;
  connected_realm_id: number;
  realm: string;
  summary: SellPlanSummary;
  items: SellPlanItem[];
  error?: string;
};

const EMPTY_SUMMARY: SellPlanSummary = {
  open_trade_count: 0,
  list_now_count: 0,
  hold_count: 0,
  cut_loss_count: 0,
  total_open_cost: 0,
  current_net_profit: 0,
  current_roi_percent: 0,
  recommended_net_profit: 0,
};

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

function getActionClass(action: string) {
  switch (action) {
    case "Take Profit":
      return "border-emerald-700 bg-emerald-950/50 text-emerald-300";
    case "List Now":
      return "border-emerald-800 bg-emerald-950/40 text-emerald-300";
    case "Reprice Lower":
      return "border-blue-800 bg-blue-950/40 text-blue-300";
    case "Break Even":
      return "border-amber-800 bg-amber-950/40 text-amber-300";
    case "Hold":
      return "border-slate-700 bg-slate-950 text-slate-300";
    case "Cut Loss":
      return "border-red-800 bg-red-950/40 text-red-300";
    case "No Market Data":
      return "border-purple-800 bg-purple-950/40 text-purple-300";
    default:
      return "border-slate-700 bg-slate-950 text-slate-300";
  }
}

export default function SellPlan() {
  const [realm, setRealm] = useState(() => getGlobalRealmId());
  const [items, setItems] = useState<SellPlanItem[]>([]);
  const [summary, setSummary] = useState<SellPlanSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [workingTradeId, setWorkingTradeId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadSellPlan() {
    try {
      setLoading(true);
      setError("");

      const response = await axios.get<SellPlanResponse>(
        `${API_BASE_URL}/sell-plan/open?connected_realm_id=${realm}`,
      );

      if (response.data.status !== "Success") {
        setError(response.data.error ?? "Unable to load Sell Plan.");
        setItems([]);
        setSummary(EMPTY_SUMMARY);
        return;
      }

      setItems(response.data.items);
      setSummary(response.data.summary);
    } catch {
      setError("Unable to load Sell Plan. Check backend is running.");
      setItems([]);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }

  async function markSold(item: SellPlanItem) {
    const quantityText = window.prompt(
      `Quantity sold for ${item.item_name}`,
      String(item.quantity_bought),
    );

    if (!quantityText) {
      return;
    }

    const salePriceText = window.prompt(
      `Sale price each for ${item.item_name}`,
      String(Math.round(item.recommended_list_price)),
    );

    if (!salePriceText) {
      return;
    }

    const quantitySold = Number(quantityText);
    const actualSalePriceEach = Number(salePriceText);

    if (
      !Number.isFinite(quantitySold) ||
      !Number.isFinite(actualSalePriceEach) ||
      quantitySold <= 0 ||
      actualSalePriceEach < 0
    ) {
      setError("Invalid sale quantity or price.");
      return;
    }

    try {
      setWorkingTradeId(item.trade_id);
      setMessage("");
      setError("");

      await axios.patch(`${API_BASE_URL}/trades/${item.trade_id}/mark-sold`, {
        quantity_sold: quantitySold,
        actual_sale_price_each: actualSalePriceEach,
        sale_fee_percent: item.ah_cut_percent,
        notes: "Marked sold from Sell Plan.",
      });

      setMessage(`${item.item_name} marked as sold.`);
      await loadSellPlan();
    } catch {
      setError("Unable to mark trade as sold.");
    } finally {
      setWorkingTradeId(null);
    }
  }

  useEffect(() => {
    loadSellPlan();
  }, [realm]);

  useEffect(() => {
    return listenForGlobalRealmChange((realmId) => {
      setRealm(realmId);
    });
  }, []);

  useEffect(() => {
    function handleRefresh() {
      loadSellPlan();
    }

    window.addEventListener("goldsmith-sync-complete", handleRefresh);
    window.addEventListener("goldsmith-data-refresh", handleRefresh);
    window.addEventListener("goldsmith-strategy-changed", handleRefresh);

    return () => {
      window.removeEventListener("goldsmith-sync-complete", handleRefresh);
      window.removeEventListener("goldsmith-data-refresh", handleRefresh);
      window.removeEventListener("goldsmith-strategy-changed", handleRefresh);
    };
  }, [realm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingBag size={24} className="text-emerald-400" />
            <h2 className="text-2xl font-bold text-white">Sell Plan</h2>
          </div>

          <p className="mt-1 text-sm text-slate-400">
            Review open trades, list profitable items, hold weak markets, and mark sales complete.
          </p>
        </div>

        <button
          type="button"
          onClick={loadSellPlan}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
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

      <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-7">
        <SummaryCard label="Open Trades" value={summary.open_trade_count} tone="text-white" />
        <SummaryCard label="List Now" value={summary.list_now_count} tone="text-emerald-400" />
        <SummaryCard label="Hold" value={summary.hold_count} tone="text-amber-400" />
        <SummaryCard label="Cut Loss" value={summary.cut_loss_count} tone="text-red-400" />
        <SummaryCard label="Open Cost" value={formatGold(summary.total_open_cost)} tone="text-white" />
        <SummaryCard
          label="Current Net"
          value={formatGold(summary.current_net_profit)}
          tone={summary.current_net_profit >= 0 ? "text-emerald-400" : "text-red-400"}
        />
        <SummaryCard
          label="Current ROI"
          value={formatPercent(summary.current_roi_percent)}
          tone={summary.current_roi_percent >= 0 ? "text-emerald-400" : "text-red-400"}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 p-4">
          <h3 className="font-bold text-white">Open Trade Sell Order</h3>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading Sell Plan...
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No open trades yet. Buy Queue items need to be marked Bought + Track first.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {items.map((item) => (
              <div
                key={item.trade_id}
                className="grid gap-4 p-4 xl:grid-cols-[minmax(260px,1fr)_140px_140px_140px_160px_170px]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {item.icon_url ? (
                    <img
                      src={item.icon_url}
                      alt={item.item_name}
                      className="h-10 w-10 rounded-lg border border-slate-700 bg-slate-950"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-lg border border-slate-700 bg-slate-950" />
                  )}

                  <div className="min-w-0">
                    <p className="truncate font-bold text-white">
                      {item.item_name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.category ?? "Unknown"} - bought {item.quantity_bought} at{" "}
                      {formatGold(item.buy_price_each)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.decision_grade ?? "-"} {item.final_decision ?? "Decision"} -{" "}
                      {item.memory_price_state ?? "Memory"}
                    </p>
                  </div>
                </div>

                <Metric label="Current" value={formatGold(item.current_market_price)} />
                <Metric label="Break-even" value={formatGold(item.break_even_price_each)} />
                <Metric label="Recommend" value={formatGold(item.recommended_list_price)} />

                <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-right">
                  <p className="text-[11px] text-slate-500">Expected Net</p>
                  <p
                    className={[
                      "mt-1 font-bold",
                      item.recommended_net_profit >= 0
                        ? "text-emerald-400"
                        : "text-red-400",
                    ].join(" ")}
                  >
                    {formatGold(item.recommended_net_profit)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatPercent(item.recommended_roi_percent)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${getActionClass(
                      item.sell_action,
                    )}`}
                  >
                    {item.sell_action === "Cut Loss" ? (
                      <AlertTriangle size={13} />
                    ) : item.sell_action === "Hold" ? (
                      <TrendingUp size={13} />
                    ) : (
                      <CheckCircle2 size={13} />
                    )}
                    {item.sell_action}
                  </span>

                  <button
                    type="button"
                    onClick={() => markSold(item)}
                    disabled={workingTradeId === item.trade_id}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-900/40 disabled:opacity-60"
                  >
                    <Wallet size={14} />
                    Sold
                  </button>
                </div>

                <div className="xl:col-span-6 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-400">
                  {item.sell_note}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-2 text-xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-right">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-white">{value}</p>
    </div>
  );
}
