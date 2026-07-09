import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Brain,
  CheckCircle2,
  Copy,
  FileDown,
  RefreshCw,
  ShoppingCart,
  SkipForward,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";

import RealmSelect from "../components/RealmSelect";

type BuyQueueItem = {
  id: number;
  item_id: number;
  realm_id: number;
  realm_name: string;
  item_name: string;
  category: string | null;
  icon_url: string | null;
  quality: string | null;
  decision_grade: string | null;
  final_decision: string | null;
  decision_score: number;
  buy_pressure: string | null;
  position_size_label: string | null;
  signal: string | null;
  memory_price_state: string | null;
  suggested_quantity: number;
  max_price_each: number;
  max_total_spend: number;
  target_sale_price_each: number;
  expected_profit_each: number;
  expected_total_profit: number;
  expected_margin_percent: number;
  status: string;
  bought_quantity: number;
  bought_price_each: number;
  total_buy_cost: number;
  reason: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  bought_at: string | null;
};

type BuyQueueSummary = {
  total_count: number;
  queued_count: number;
  bought_count: number;
  skipped_count: number;
  queued_max_spend: number;
  bought_total_cost: number;
  expected_total_profit: number;
};

type BuyQueueResponse = {
  status: string;
  summary: BuyQueueSummary;
  items: BuyQueueItem[];
  error?: string;
};

type DealAlert = {
  item_id: number;
  realm_id: number;
  name: string;
  icon_url: string | null;
  quality: string | null;
  goldsmith_category: string;
  signal: string;
  signal_label: string;
  signal_reason: string;
  memory_price_state: string;
  suggested_buy_quantity: number;
  suggested_buy_below: number;
  target_resale_price: number;
  estimated_margin_percent: number;
  final_decision: string;
  decision_grade: string;
  decision_score: number;
  buy_pressure: string;
  position_size_label: string;
  decision_note: string;
};

type DealAlertsResponse = {
  status: string;
  items: DealAlert[];
  error?: string;
};

const API_BASE_URL = "http://127.0.0.1:8000/api";

const EMPTY_SUMMARY: BuyQueueSummary = {
  total_count: 0,
  queued_count: 0,
  bought_count: 0,
  skipped_count: 0,
  queued_max_spend: 0,
  bought_total_cost: 0,
  expected_total_profit: 0,
};

const STATUS_FILTERS = ["queued", "bought", "skipped", "all"];

function formatGold(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  return `${Math.round(value).toLocaleString()}g`;
}


function escapeCsv(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value).replaceAll('"', '""');

  return `"${text}"`;
}

function getDecisionClass(finalDecision: string | null) {
  switch (finalDecision) {
    case "Strong Buy":
      return "border-emerald-700 bg-emerald-950/50 text-emerald-300";
    case "Buy":
      return "border-emerald-800 bg-emerald-950/40 text-emerald-300";
    case "Small Buy":
      return "border-blue-800 bg-blue-950/40 text-blue-300";
    case "Watch":
      return "border-amber-800 bg-amber-950/40 text-amber-300";
    case "Avoid":
      return "border-red-800 bg-red-950/40 text-red-300";
    default:
      return "border-slate-700 bg-slate-950 text-slate-300";
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case "queued":
      return "border-amber-800 bg-amber-950/40 text-amber-300";
    case "bought":
      return "border-emerald-800 bg-emerald-950/40 text-emerald-300";
    case "skipped":
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

export default function BuyQueue() {
  const [realm, setRealm] = useState(11);
  const [items, setItems] = useState<BuyQueueItem[]>([]);
  const [summary, setSummary] = useState<BuyQueueSummary>(EMPTY_SUMMARY);
  const [statusFilter, setStatusFilter] = useState("queued");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadQueue() {
    try {
      setLoading(true);
      setError("");

      const response = await axios.get<BuyQueueResponse>(
        `${API_BASE_URL}/buy-queue?connected_realm_id=${realm}&status=${statusFilter}`,
      );

      if (response.data.status !== "Success") {
        setError(response.data.error ?? "Unable to load buy queue.");
        setItems([]);
        setSummary(EMPTY_SUMMARY);
        return;
      }

      setItems(response.data.items);
      setSummary(response.data.summary);
    } catch {
      setError("Unable to load buy queue. Check backend is running.");
      setItems([]);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }

  async function importTopDecisions() {
    try {
      setWorking(true);
      setError("");
      setMessage("");

      const response = await axios.get<DealAlertsResponse>(
        `${API_BASE_URL}/deals/alerts?connected_realm_id=${realm}&limit=50`,
      );

      if (response.data.status !== "Success") {
        setError(response.data.error ?? "Unable to load deal alerts.");
        return;
      }

      const candidates = response.data.items
        .filter((alert) =>
          ["Strong Buy", "Buy", "Small Buy"].includes(alert.final_decision),
        )
        .filter((alert) => alert.suggested_buy_quantity > 0)
        .filter((alert) => alert.suggested_buy_below > 0)
        .slice(0, 15);

      if (candidates.length === 0) {
        setMessage("No clean buy decisions available for the queue yet.");
        return;
      }

      const results = await Promise.allSettled(
        candidates.map((alert) =>
          axios.post(`${API_BASE_URL}/buy-queue/from-alert`, {
            item_id: alert.item_id,
            realm_id: alert.realm_id,
            item_name: alert.name,
            category: alert.goldsmith_category,
            icon_url: alert.icon_url,
            quality: alert.quality,
            decision_grade: alert.decision_grade,
            final_decision: alert.final_decision,
            decision_score: alert.decision_score,
            buy_pressure: alert.buy_pressure,
            position_size_label: alert.position_size_label,
            signal: alert.signal,
            memory_price_state: alert.memory_price_state,
            suggested_quantity: alert.suggested_buy_quantity,
            max_price_each: alert.suggested_buy_below,
            target_sale_price_each: alert.target_resale_price,
            expected_margin_percent: alert.estimated_margin_percent,
            reason: alert.decision_note || alert.signal_reason,
          }),
        ),
      );

      const successful = results.filter((result) => result.status === "fulfilled").length;

      setMessage(`${successful} buy queue item${successful === 1 ? "" : "s"} imported.`);
      await loadQueue();
    } catch {
      setError("Unable to import top decisions.");
    } finally {
      setWorking(false);
    }
  }


  function buildShoppingListText() {
    return visibleItems
      .filter((item) => item.status === "queued")
      .map((item) => item.item_name)
      .join("\n");
  }

  function buildCsvText() {
    const rows = [
      [
        "Item",
        "Quantity",
        "Max Price Each",
        "Max Total Spend",
        "Target Sale Price Each",
        "Expected Profit",
        "Expected Margin Percent",
        "Decision",
        "Grade",
        "Signal",
        "Memory State",
        "Reason",
      ],
      ...visibleItems
        .filter((item) => item.status === "queued")
        .map((item) => [
          item.item_name,
          item.suggested_quantity,
          item.max_price_each,
          item.max_total_spend,
          item.target_sale_price_each,
          item.expected_total_profit,
          item.expected_margin_percent,
          item.final_decision ?? "",
          item.decision_grade ?? "",
          item.signal ?? "",
          item.memory_price_state ?? "",
          item.reason ?? "",
        ]),
    ];

    return rows
      .map((row) => row.map((value) => escapeCsv(value)).join(","))
      .join("\n");
  }

  async function copyShoppingList() {
    try {
      const shoppingList = buildShoppingListText();

      if (!shoppingList.trim()) {
        setMessage("No queued items to copy.");
        return;
      }

      await navigator.clipboard.writeText(shoppingList);
      setMessage("Shopping list copied.");
    } catch {
      setError("Unable to copy shopping list.");
    }
  }

  async function copyCsv() {
    try {
      const csv = buildCsvText();

      if (!csv.trim()) {
        setMessage("No queued items to copy.");
        return;
      }

      await navigator.clipboard.writeText(csv);
      setMessage("CSV copied.");
    } catch {
      setError("Unable to copy CSV.");
    }
  }

  function downloadCsv() {
    const csv = buildCsvText();

    if (!csv.trim()) {
      setMessage("No queued items to export.");
      return;
    }

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `goldsmith-buy-queue-realm-${realm}.csv`;
    link.click();

    URL.revokeObjectURL(url);
    setMessage("Buy Queue CSV downloaded.");
  }

  async function convertToTrade(item: BuyQueueItem) {
    try {
      setWorking(true);
      setError("");
      setMessage("");

      await axios.post(`${API_BASE_URL}/trades/from-buy-queue/${item.id}`);

      setMessage(`${item.item_name} is now tracked in Profit Tracker.`);
      await loadQueue();
    } catch {
      setError("Unable to convert item into a tracked trade.");
    } finally {
      setWorking(false);
    }
  }

  async function markBoughtAndTrack(item: BuyQueueItem) {
    const quantityText = window.prompt(
      `Quantity bought for ${item.item_name}`,
      String(item.suggested_quantity),
    );

    if (!quantityText) {
      return;
    }

    const priceText = window.prompt(
      `Price paid each for ${item.item_name}`,
      String(Math.round(item.max_price_each)),
    );

    if (!priceText) {
      return;
    }

    const boughtQuantity = Number(quantityText);
    const boughtPriceEach = Number(priceText);

    if (
      !Number.isFinite(boughtQuantity) ||
      !Number.isFinite(boughtPriceEach) ||
      boughtQuantity <= 0 ||
      boughtPriceEach < 0
    ) {
      setError("Invalid quantity or price.");
      return;
    }

    try {
      setWorking(true);
      setError("");
      setMessage("");

      await axios.patch(`${API_BASE_URL}/buy-queue/${item.id}/mark-bought`, {
        bought_quantity: boughtQuantity,
        bought_price_each: boughtPriceEach,
        notes: "Marked bought and tracked from Buy Queue.",
      });

      await axios.post(`${API_BASE_URL}/trades/from-buy-queue/${item.id}`);

      setMessage(`${item.item_name} bought and sent to Profit Tracker.`);
      await loadQueue();
    } catch {
      setError("Unable to mark bought and track trade.");
    } finally {
      setWorking(false);
    }
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied.`);
    } catch {
      setError("Unable to copy to clipboard.");
    }
  }

  async function markBought(item: BuyQueueItem) {
    const quantityText = window.prompt(
      `Quantity bought for ${item.item_name}`,
      String(item.suggested_quantity),
    );

    if (!quantityText) {
      return;
    }

    const priceText = window.prompt(
      `Price paid each for ${item.item_name}`,
      String(Math.round(item.max_price_each)),
    );

    if (!priceText) {
      return;
    }

    const boughtQuantity = Number(quantityText);
    const boughtPriceEach = Number(priceText);

    if (
      !Number.isFinite(boughtQuantity) ||
      !Number.isFinite(boughtPriceEach) ||
      boughtQuantity <= 0 ||
      boughtPriceEach < 0
    ) {
      setError("Invalid quantity or price.");
      return;
    }

    try {
      setWorking(true);
      setError("");
      setMessage("");

      await axios.patch(`${API_BASE_URL}/buy-queue/${item.id}/mark-bought`, {
        bought_quantity: boughtQuantity,
        bought_price_each: boughtPriceEach,
        notes: "Marked bought from Buy Queue.",
      });

      setMessage(`${item.item_name} marked as bought.`);
      await loadQueue();
    } catch {
      setError("Unable to mark item as bought.");
    } finally {
      setWorking(false);
    }
  }

  async function skipItem(item: BuyQueueItem) {
    try {
      setWorking(true);
      setError("");
      setMessage("");

      await axios.patch(`${API_BASE_URL}/buy-queue/${item.id}/status`, {
        status: "skipped",
        notes: "Skipped from Buy Queue.",
      });

      setMessage(`${item.item_name} skipped.`);
      await loadQueue();
    } catch {
      setError("Unable to skip item.");
    } finally {
      setWorking(false);
    }
  }

  async function deleteItem(item: BuyQueueItem) {
    try {
      setWorking(true);
      setError("");
      setMessage("");

      await axios.delete(`${API_BASE_URL}/buy-queue/${item.id}`);

      setMessage(`${item.item_name} removed from Buy Queue.`);
      await loadQueue();
    } catch {
      setError("Unable to remove item.");
    } finally {
      setWorking(false);
    }
  }

  useEffect(() => {
    loadQueue();
  }, [realm, statusFilter]);

  useEffect(() => {
    function handleGlobalSyncComplete() {
      loadQueue();
    }

    window.addEventListener("goldsmith-sync-complete", handleGlobalSyncComplete);

    return () => {
      window.removeEventListener(
        "goldsmith-sync-complete",
        handleGlobalSyncComplete,
      );
    };
  }, [realm, statusFilter]);

  const visibleItems = useMemo(() => items, [items]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingCart size={22} className="text-amber-400" />
            <h2 className="text-2xl font-bold text-white">Buy Queue</h2>
          </div>

          <p className="mt-1 text-sm text-slate-400">
            Manual execution console. GoldSmith tells you what to buy, how many,
            and the max price. You confirm purchases in-game yourself.
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
            onClick={loadQueue}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            onClick={importTopDecisions}
            disabled={working}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-amber-400 disabled:opacity-60"
          >
            <Upload size={16} />
            Import Top Buys
          </button>

          <button
            type="button"
            onClick={copyShoppingList}
            disabled={working}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-60"
          >
            <Copy size={16} />
            Copy Shopping List
          </button>

          <button
            type="button"
            onClick={copyCsv}
            disabled={working}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-60"
          >
            <Copy size={16} />
            Copy CSV
          </button>

          <button
            type="button"
            onClick={downloadCsv}
            disabled={working}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-800 bg-blue-950/40 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-900/40 disabled:opacity-60"
          >
            <FileDown size={16} />
            Export CSV
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

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Queued</p>
          <p className="mt-2 text-2xl font-bold text-amber-400">
            {summary.queued_count}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Max Spend</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {formatGold(summary.queued_max_spend)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Expected Profit</p>
          <p className="mt-2 text-2xl font-bold text-emerald-400">
            {formatGold(summary.expected_total_profit)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Bought Cost</p>
          <p className="mt-2 text-2xl font-bold text-blue-400">
            {formatGold(summary.bought_total_cost)}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-[1500px] w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Decision</th>
                <th className="px-4 py-3">Buy Limit</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Expected</th>
                <th className="px-4 py-3">Memory</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Execution</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    Loading buy queue...
                  </td>
                </tr>
              ) : visibleItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    No buy queue items. Click Import Top Buys after a scan.
                  </td>
                </tr>
              ) : (
                visibleItems.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-slate-800/70 transition hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {item.icon_url ? (
                          <img
                            src={item.icon_url}
                            alt={item.item_name}
                            className="h-10 w-10 rounded-lg border border-slate-700 bg-slate-950"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg border border-slate-700 bg-slate-950" />
                        )}

                        <div>
                          <p className="font-semibold text-white">
                            {item.item_name}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {item.category ?? "Unknown"} - {item.realm_name}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${getDecisionClass(
                          item.final_decision,
                        )}`}
                      >
                        <span className={getGradeClass(item.decision_grade)}>
                          {item.decision_grade ?? "-"}
                        </span>
                        {item.final_decision ?? "Decision"}
                      </span>

                      <p className="mt-1 text-xs text-slate-500">
                        Score {item.decision_score.toFixed(1)} -{" "}
                        {item.buy_pressure ?? "-"}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-bold text-white">
                        Buy up to {item.suggested_quantity}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Max each {formatGold(item.max_price_each)}
                      </p>

                      <p className="mt-1 text-xs text-amber-400">
                        Max spend {formatGold(item.max_total_spend)}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-semibold text-emerald-400">
                        {formatGold(item.target_sale_price_each)}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Target resale each
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <p className="font-semibold text-emerald-400">
                        {formatGold(item.expected_total_profit)}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {item.expected_margin_percent.toFixed(1)}% margin
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <div className="inline-flex items-center gap-2 rounded-full border border-blue-800 bg-blue-950/40 px-2 py-1 text-xs font-semibold text-blue-300">
                        <Brain size={13} />
                        {item.memory_price_state ?? "Memory"}
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        {item.signal ?? "-"}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${getStatusClass(
                          item.status,
                        )}`}
                      >
                        <CheckCircle2 size={13} />
                        {item.status}
                      </span>

                      {item.status === "bought" && (
                        <p className="mt-1 text-xs text-slate-500">
                          {item.bought_quantity} at{" "}
                          {formatGold(item.bought_price_each)}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => copyText(item.item_name, "Item name")}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
                        >
                          <Copy size={14} />
                          Name
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            copyText(String(Math.round(item.max_price_each)), "Max price")
                          }
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
                        >
                          <Wallet size={14} />
                          Price
                        </button>

                        {item.status === "bought" && (
                          <button
                            type="button"
                            onClick={() => convertToTrade(item)}
                            disabled={working}
                            className="inline-flex items-center gap-2 rounded-lg border border-blue-800 bg-blue-950/40 px-3 py-2 text-xs font-semibold text-blue-300 transition hover:bg-blue-900/40 disabled:opacity-60"
                          >
                            <Wallet size={14} />
                            Track Trade
                          </button>
                        )}

                        {item.status === "queued" && (
                          <>
                            <button
                              type="button"
                              onClick={() => markBought(item)}
                              disabled={working}
                              className="inline-flex items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-900/40 disabled:opacity-60"
                            >
                              <CheckCircle2 size={14} />
                              Bought
                            </button>

                            <button
                              type="button"
                              onClick={() => markBoughtAndTrack(item)}
                              disabled={working}
                              className="inline-flex items-center gap-2 rounded-lg border border-blue-800 bg-blue-950/40 px-3 py-2 text-xs font-semibold text-blue-300 transition hover:bg-blue-900/40 disabled:opacity-60"
                            >
                              <Wallet size={14} />
                              Bought + Track
                            </button>

                            <button
                              type="button"
                              onClick={() => skipItem(item)}
                              disabled={working}
                              className="inline-flex items-center gap-2 rounded-lg border border-amber-800 bg-amber-950/40 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-900/40 disabled:opacity-60"
                            >
                              <SkipForward size={14} />
                              Skip
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => deleteItem(item)}
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
