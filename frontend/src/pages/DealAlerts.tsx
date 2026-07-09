import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  AlertTriangle,
  Ban,
  Brain,
  BellRing,
  CheckCircle2,
  Coins,
  Gauge,
  RefreshCw,
  Search,
  ShieldAlert,
  ShoppingCart,
  Star,
  Trash2,
  TrendingDown,
  Zap,
} from "lucide-react";

import RealmSelect from "../components/RealmSelect";

type DealAlert = {
  item_id: number;
  realm_id: number;
  name: string;
  current_price: number;
  previous_price: number | null;
  price_change: number;
  price_change_percent: number;
  volume: number;
  listing_count: number;
  opportunity_score: number;
  risk_level: string;
  reason: string | null;
  icon_url: string | null;
  quality: string | null;
  item_class: string | null;
  item_subclass: string | null;
  goldsmith_category: string;
  profit_margin: number;
  signal: string;
  signal_label: string;
  signal_priority: number;
  signal_tone: string;
  signal_action: string;
  signal_confidence: number;
  signal_reason: string;
  is_watched: boolean;
  suggested_buy_below: number;
  target_resale_price: number;
  estimated_profit_before_costs: number;
  estimated_margin_percent: number;
  liquidity_score: number;
  sale_speed: string;
  suggested_buy_quantity: number;
  max_gold_exposure: number;
  capital_risk_label: string;
  capital_action: string;
  buy_strategy: string;
  capital_note: string;
  memory_price_state: string;
  memory_score: number;
  memory_confidence: string;
  memory_sample_count: number;
  memory_note: string;
  memory_volatility_score: number;
  memory_discount_percent: number;
  memory_price_position_percent: number;
  memory_average_7_day_price: number | null;
  memory_average_30_day_price: number | null;
};

type DealSummary = {
  auto_watch_count: number;
  fast_mover_count: number;
  price_drop_count: number;
  high_margin_count: number;
  watch_candidate_count: number;
  hold_count: number;
  avoid_count: number;
  low_capital_risk_count: number;
  medium_capital_risk_count: number;
  high_capital_risk_count: number;
  avoid_capital_count: number;
};

type DealAlertsResponse = {
  status: string;
  connected_realm_id: number;
  alert_count: number;
  ignored_count?: number;
  top_alert: DealAlert | null;
  summary: DealSummary;
  items: DealAlert[];
  error?: string;
};

type AutoWatchResponse = {
  status: string;
  connected_realm_id: number;
  realm?: string;
  auto_watch_added: number;
  ignored_count?: number;
  items: DealAlert[];
  error?: string;
};

const API_BASE_URL = "http://127.0.0.1:8000/api";

const EMPTY_SUMMARY: DealSummary = {
  auto_watch_count: 0,
  fast_mover_count: 0,
  price_drop_count: 0,
  high_margin_count: 0,
  watch_candidate_count: 0,
  hold_count: 0,
  avoid_count: 0,
  low_capital_risk_count: 0,
  medium_capital_risk_count: 0,
  high_capital_risk_count: 0,
  avoid_capital_count: 0,
};

const SIGNAL_FILTERS = [
  "All Signals",
  "AUTO_WATCH",
  "FAST_MOVER",
  "PRICE_DROP",
  "HIGH_MARGIN",
  "WATCH_CANDIDATE",
  "HOLD",
  "AVOID",
];

const CATEGORY_FILTERS = [
  "All Categories",
  "Crafting Materials",
  "Consumables",
  "Enchants",
  "Gems",
  "Glyphs",
  "Recipes / Plans",
  "Battle Pets",
  "Gear / Transmog",
  "Rare / Collector Items",
  "Unknown / Other",
];

const CAPITAL_FILTERS = ["All Capital", "Low", "Medium", "High", "Avoid"];

const MEMORY_FILTERS = [
  "All Memory",
  "Deep Undervalued",
  "Undervalued",
  "Below Normal",
  "Fair Value",
  "Above Normal",
  "Overpriced",
  "Volatile",
  "Learning",
];

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

function getSignalClass(signal: string) {
  switch (signal) {
    case "AUTO_WATCH":
      return "border-emerald-800 bg-emerald-950/40 text-emerald-300";
    case "FAST_MOVER":
      return "border-blue-800 bg-blue-950/40 text-blue-300";
    case "PRICE_DROP":
      return "border-purple-800 bg-purple-950/40 text-purple-300";
    case "HIGH_MARGIN":
      return "border-amber-800 bg-amber-950/40 text-amber-300";
    case "AVOID":
      return "border-red-800 bg-red-950/40 text-red-300";
    default:
      return "border-slate-700 bg-slate-950 text-slate-300";
  }
}

function getSignalIcon(signal: string) {
  switch (signal) {
    case "AUTO_WATCH":
      return <Zap size={14} />;
    case "FAST_MOVER":
      return <CheckCircle2 size={14} />;
    case "PRICE_DROP":
      return <TrendingDown size={14} />;
    case "HIGH_MARGIN":
      return <Star size={14} />;
    case "AVOID":
      return <AlertTriangle size={14} />;
    default:
      return <BellRing size={14} />;
  }
}

function getRiskClass(riskLevel: string) {
  switch (riskLevel.toLowerCase()) {
    case "low":
      return "text-emerald-400";
    case "medium":
      return "text-amber-400";
    case "high":
      return "text-red-400";
    default:
      return "text-slate-400";
  }
}

function getCapitalClass(capitalRisk: string) {
  switch (capitalRisk) {
    case "Low":
      return "border-emerald-800 bg-emerald-950/40 text-emerald-300";
    case "Medium":
      return "border-amber-800 bg-amber-950/40 text-amber-300";
    case "High":
      return "border-red-800 bg-red-950/40 text-red-300";
    case "Avoid":
      return "border-slate-700 bg-slate-950 text-slate-400";
    default:
      return "border-slate-700 bg-slate-950 text-slate-300";
  }
}

function getSpeedClass(saleSpeed: string) {
  switch (saleSpeed) {
    case "Fast":
      return "text-emerald-400";
    case "Medium":
      return "text-amber-400";
    case "Slow":
      return "text-red-400";
    default:
      return "text-slate-400";
  }
}

function getMemoryClass(priceState: string) {
  switch (priceState) {
    case "Deep Undervalued":
      return "border-emerald-700 bg-emerald-950/50 text-emerald-300";
    case "Undervalued":
      return "border-emerald-800 bg-emerald-950/40 text-emerald-300";
    case "Below Normal":
      return "border-blue-800 bg-blue-950/40 text-blue-300";
    case "Fair Value":
      return "border-slate-700 bg-slate-950 text-slate-300";
    case "Above Normal":
      return "border-amber-800 bg-amber-950/40 text-amber-300";
    case "Overpriced":
      return "border-red-800 bg-red-950/40 text-red-300";
    case "Volatile":
      return "border-purple-800 bg-purple-950/40 text-purple-300";
    case "Learning":
      return "border-slate-700 bg-slate-950 text-slate-400";
    default:
      return "border-slate-700 bg-slate-950 text-slate-300";
  }
}

function getMemoryDealCount(alerts: DealAlert[]) {
  return alerts.filter((alert) =>
    ["Deep Undervalued", "Undervalued", "Below Normal"].includes(
      alert.memory_price_state,
    ),
  ).length;
}

export default function DealAlerts() {
  const [realm, setRealm] = useState(11);
  const [alerts, setAlerts] = useState<DealAlert[]>([]);
  const [topAlert, setTopAlert] = useState<DealAlert | null>(null);
  const [summary, setSummary] = useState<DealSummary>(EMPTY_SUMMARY);
  const [ignoredCount, setIgnoredCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [autoWatching, setAutoWatching] = useState(false);
  const [updatingWatchlist, setUpdatingWatchlist] = useState<number | null>(
    null,
  );
  const [ignoringItem, setIgnoringItem] = useState<number | null>(null);
  const [ignoringCategory, setIgnoringCategory] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [signalFilter, setSignalFilter] = useState("All Signals");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [capitalFilter, setCapitalFilter] = useState("All Capital");
  const [memoryFilter, setMemoryFilter] = useState("All Memory");

  async function loadAlerts(realmId: number) {
    try {
      setLoading(true);
      setError("");

      const response = await axios.get<DealAlertsResponse>(
        `${API_BASE_URL}/deals/alerts?connected_realm_id=${realmId}&limit=150`,
      );

      if (response.data.status !== "Success") {
        setError(response.data.error ?? "Unable to load deal alerts.");
        setAlerts([]);
        setTopAlert(null);
        setSummary(EMPTY_SUMMARY);
        setIgnoredCount(0);
        return;
      }

      setAlerts(response.data.items);
      setTopAlert(response.data.top_alert);
      setSummary(response.data.summary);
      setIgnoredCount(response.data.ignored_count ?? 0);
    } catch {
      setError("Unable to load deal alerts. Check backend is running.");
      setAlerts([]);
      setTopAlert(null);
      setSummary(EMPTY_SUMMARY);
      setIgnoredCount(0);
    } finally {
      setLoading(false);
    }
  }

  async function runAutoWatch() {
    try {
      setAutoWatching(true);
      setError("");
      setSuccessMessage("");

      const response = await axios.post<AutoWatchResponse>(
        `${API_BASE_URL}/deals/auto-watch?connected_realm_id=${realm}&limit=10`,
      );

      if (response.data.status !== "Success") {
        setError(response.data.error ?? "Auto Watch failed.");
        return;
      }

      setSuccessMessage(
        `${response.data.auto_watch_added} deal${
          response.data.auto_watch_added === 1 ? "" : "s"
        } added to Watchlist.`,
      );

      await loadAlerts(realm);
    } catch {
      setError("Auto Watch failed. Check backend logs.");
    } finally {
      setAutoWatching(false);
    }
  }

  async function addToWatchlist(alert: DealAlert) {
    try {
      setUpdatingWatchlist(alert.item_id);
      setError("");
      setSuccessMessage("");

      await axios.post(`${API_BASE_URL}/watchlist`, {
        item_id: alert.item_id,
        realm_id: alert.realm_id,
        realm_name: `Connected Realm ${alert.realm_id}`,
        name: alert.name,
        current_price: alert.current_price,
        volume: alert.volume,
        listing_count: alert.listing_count,
        opportunity_score: alert.opportunity_score,
        risk_level: alert.risk_level,
        reason: alert.signal_reason,
        icon_url: alert.icon_url,
        quality: alert.quality,
        item_class: alert.item_class,
        item_subclass: alert.item_subclass,
        goldsmith_category: alert.goldsmith_category,
        profit_margin: alert.profit_margin,
      });

      setAlerts((currentAlerts) =>
        currentAlerts.map((item) =>
          item.item_id === alert.item_id
            ? { ...item, is_watched: true }
            : item,
        ),
      );

      setSuccessMessage(`${alert.name} added to Watchlist.`);
    } catch {
      setError("Unable to add item to Watchlist.");
    } finally {
      setUpdatingWatchlist(null);
    }
  }

  async function removeFromWatchlist(alert: DealAlert) {
    try {
      setUpdatingWatchlist(alert.item_id);
      setError("");
      setSuccessMessage("");

      await axios.delete(
        `${API_BASE_URL}/watchlist/${alert.realm_id}/${alert.item_id}`,
      );

      setAlerts((currentAlerts) =>
        currentAlerts.map((item) =>
          item.item_id === alert.item_id
            ? { ...item, is_watched: false }
            : item,
        ),
      );

      setSuccessMessage(`${alert.name} removed from Watchlist.`);
    } catch {
      setError("Unable to remove item from Watchlist.");
    } finally {
      setUpdatingWatchlist(null);
    }
  }

  async function ignoreItem(alert: DealAlert) {
    try {
      setIgnoringItem(alert.item_id);
      setError("");
      setSuccessMessage("");

      await axios.post(`${API_BASE_URL}/ignore-rules/item`, {
        item_id: alert.item_id,
        realm_id: alert.realm_id,
        item_name: alert.name,
        reason: `Ignored from Deal Alerts. Signal: ${alert.signal_label}.`,
      });

      setSuccessMessage(`${alert.name} ignored. It will no longer appear in recommendations.`);
      await loadAlerts(realm);
    } catch {
      setError("Unable to ignore item.");
    } finally {
      setIgnoringItem(null);
    }
  }

  async function ignoreCategory(alert: DealAlert) {
    try {
      setIgnoringCategory(alert.goldsmith_category);
      setError("");
      setSuccessMessage("");

      await axios.post(`${API_BASE_URL}/ignore-rules/category`, {
        category: alert.goldsmith_category,
        realm_id: alert.realm_id,
        reason: `Ignored from Deal Alerts using ${alert.name}.`,
      });

      setSuccessMessage(
        `${alert.goldsmith_category} ignored for this realm. Matching recommendations will be suppressed.`,
      );

      await loadAlerts(realm);
    } catch {
      setError("Unable to ignore category.");
    } finally {
      setIgnoringCategory(null);
    }
  }

  useEffect(() => {
    loadAlerts(realm);
  }, [realm]);

  useEffect(() => {
    function handleGlobalSyncComplete() {
      loadAlerts(realm);
    }

    window.addEventListener("goldsmith-sync-complete", handleGlobalSyncComplete);

    return () => {
      window.removeEventListener(
        "goldsmith-sync-complete",
        handleGlobalSyncComplete,
      );
    };
  }, [realm]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const matchesSearch =
        alert.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        alert.goldsmith_category
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      const matchesSignal =
        signalFilter === "All Signals" || alert.signal === signalFilter;

      const matchesCategory =
        categoryFilter === "All Categories" ||
        alert.goldsmith_category === categoryFilter;

      const matchesCapital =
        capitalFilter === "All Capital" ||
        alert.capital_risk_label === capitalFilter;

      const matchesMemory =
        memoryFilter === "All Memory" ||
        alert.memory_price_state === memoryFilter;

      return (
        matchesSearch &&
        matchesSignal &&
        matchesCategory &&
        matchesCapital &&
        matchesMemory
      );
    });
  }, [alerts, capitalFilter, categoryFilter, memoryFilter, searchTerm, signalFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BellRing size={22} className="text-emerald-400" />
            <h2 className="text-2xl font-bold text-white">Deal Alerts</h2>
          </div>

          <p className="mt-1 text-sm text-slate-400">
            Buy queue with capital guardrails, sale speed, exposure limits, market memory and smart ignore filtering.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <RealmSelect value={realm} onChange={setRealm} />

          <button
            type="button"
            onClick={() => loadAlerts(realm)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            onClick={runAutoWatch}
            disabled={autoWatching}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Zap size={16} className={autoWatching ? "animate-pulse" : ""} />
            Auto Watch
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/50 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-300">
          {successMessage}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-7">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Auto Watch</p>
          <p className="mt-2 text-2xl font-bold text-emerald-400">
            {summary.auto_watch_count}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Fast Movers</p>
          <p className="mt-2 text-2xl font-bold text-blue-400">
            {summary.fast_mover_count}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Price Drops</p>
          <p className="mt-2 text-2xl font-bold text-purple-400">
            {summary.price_drop_count}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Low Capital Risk</p>
          <p className="mt-2 text-2xl font-bold text-emerald-400">
            {summary.low_capital_risk_count}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Avoided</p>
          <p className="mt-2 text-2xl font-bold text-red-400">
            {summary.avoid_capital_count}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Memory Deals</p>
          <p className="mt-2 text-2xl font-bold text-blue-400">
            {getMemoryDealCount(alerts)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Suppressed</p>
          <p className="mt-2 text-2xl font-bold text-slate-300">
            {ignoredCount}
          </p>
        </div>
      </div>

      {topAlert && (
        <div className="rounded-2xl border border-emerald-800 bg-emerald-950/20 p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex items-start gap-4">
              {topAlert.icon_url ? (
                <img
                  src={topAlert.icon_url}
                  alt={topAlert.name}
                  className="h-16 w-16 rounded-xl border border-slate-700 bg-slate-950"
                />
              ) : (
                <div className="h-16 w-16 rounded-xl border border-slate-700 bg-slate-950" />
              )}

              <div>
                <div className="mb-2 flex flex-wrap gap-2">
                  <div
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getSignalClass(
                      topAlert.signal,
                    )}`}
                  >
                    {getSignalIcon(topAlert.signal)}
                    {topAlert.signal_label}
                  </div>

                  <div
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getMemoryClass(
                      topAlert.memory_price_state,
                    )}`}
                  >
                    <Brain size={14} />
                    {topAlert.memory_price_state}
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-white">
                  {topAlert.name}
                </h3>

                <p className="mt-1 text-sm text-slate-400">
                  {topAlert.capital_note}
                </p>

                <p className="mt-2 text-sm text-blue-300">
                  {topAlert.memory_note}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => ignoreItem(topAlert)}
                    disabled={ignoringItem === topAlert.item_id}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-900/40 disabled:opacity-60"
                  >
                    <Ban size={14} />
                    Ignore Item
                  </button>

                  <button
                    type="button"
                    onClick={() => ignoreCategory(topAlert)}
                    disabled={ignoringCategory === topAlert.goldsmith_category}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    <Ban size={14} />
                    Ignore Category
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-3 text-right sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">Buy Qty</p>
                <p className="text-2xl font-bold text-white">
                  {topAlert.suggested_buy_quantity}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">Max Spend</p>
                <p className="text-2xl font-bold text-amber-400">
                  {formatGold(topAlert.max_gold_exposure)}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">Confidence</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {topAlert.signal_confidence.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="grid gap-3 lg:grid-cols-5">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />

            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search item or category..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-white outline-none transition focus:border-amber-500"
            />
          </div>

          <select
            value={signalFilter}
            onChange={(event) => setSignalFilter(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-500"
          >
            {SIGNAL_FILTERS.map((signal) => (
              <option key={signal} value={signal}>
                {signal.replace("_", " ")}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-500"
          >
            {CATEGORY_FILTERS.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <select
            value={capitalFilter}
            onChange={(event) => setCapitalFilter(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-500"
          >
            {CAPITAL_FILTERS.map((capital) => (
              <option key={capital} value={capital}>
                {capital}
              </option>
            ))}
          </select>

          <select
            value={memoryFilter}
            onChange={(event) => setMemoryFilter(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-500"
          >
            {MEMORY_FILTERS.map((memory) => (
              <option key={memory} value={memory}>
                {memory}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-[1760px] w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Signal</th>
                <th className="px-4 py-3">Capital</th>
                <th className="px-4 py-3">Memory</th>
                <th className="px-4 py-3">Buy Plan</th>
                <th className="px-4 py-3">Current</th>
                <th className="px-4 py-3">Buy Below</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Speed</th>
                <th className="px-4 py-3">Move</th>
                <th className="px-4 py-3">Liquidity</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={13}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    Loading deal alerts...
                  </td>
                </tr>
              ) : filteredAlerts.length === 0 ? (
                <tr>
                  <td
                    colSpan={13}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No alerts match your filters. Run Global Sync or loosen filters.
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((alert) => (
                  <tr
                    key={`${alert.realm_id}-${alert.item_id}`}
                    className="border-b border-slate-800/70 transition hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {alert.icon_url ? (
                          <img
                            src={alert.icon_url}
                            alt={alert.name}
                            className="h-10 w-10 rounded-lg border border-slate-700 bg-slate-950"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg border border-slate-700 bg-slate-950" />
                        )}

                        <div>
                          <p className="font-semibold text-white">
                            {alert.name}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {alert.goldsmith_category}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${getSignalClass(
                          alert.signal,
                        )}`}
                      >
                        {getSignalIcon(alert.signal)}
                        {alert.signal_label}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${getCapitalClass(
                          alert.capital_risk_label,
                        )}`}
                      >
                        <ShieldAlert size={13} />
                        {alert.capital_risk_label}
                      </span>

                      <p className="mt-1 text-xs text-slate-500">
                        {alert.capital_action}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${getMemoryClass(
                          alert.memory_price_state,
                        )}`}
                      >
                        <Brain size={13} />
                        {alert.memory_price_state}
                      </span>

                      <p className="mt-1 text-xs text-slate-500">
                        Score {alert.memory_score.toFixed(1)} - {alert.memory_confidence}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        30d avg {formatGold(alert.memory_average_30_day_price)}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <ShoppingCart size={15} className="text-amber-400" />

                        <span className="font-bold text-white">
                          Qty {alert.suggested_buy_quantity}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        Max {formatGold(alert.max_gold_exposure)}
                      </p>
                    </td>

                    <td className="px-4 py-4 font-semibold text-emerald-400">
                      {formatGold(alert.current_price)}
                    </td>

                    <td className="px-4 py-4 font-semibold text-blue-400">
                      {formatGold(alert.suggested_buy_below)}
                    </td>

                    <td className="px-4 py-4 font-semibold text-amber-400">
                      {formatGold(alert.target_resale_price)}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Gauge size={15} className="text-slate-500" />

                        <span
                          className={`font-semibold ${getSpeedClass(
                            alert.sale_speed,
                          )}`}
                        >
                          {alert.sale_speed}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        {alert.buy_strategy}
                      </p>
                    </td>

                    <td
                      className={`px-4 py-4 font-semibold ${
                        alert.price_change_percent < 0
                          ? "text-emerald-400"
                          : alert.price_change_percent > 0
                            ? "text-red-400"
                            : "text-slate-400"
                      }`}
                    >
                      {formatPercent(alert.price_change_percent)}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Coins size={15} className="text-slate-500" />

                        <span className="font-semibold text-white">
                          {alert.liquidity_score.toFixed(1)}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-500">
                        {alert.volume} qty / {alert.listing_count} listings
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`font-semibold ${getRiskClass(
                          alert.risk_level,
                        )}`}
                      >
                        {alert.risk_level}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {alert.is_watched ? (
                          <button
                            type="button"
                            onClick={() => removeFromWatchlist(alert)}
                            disabled={updatingWatchlist === alert.item_id}
                            className="inline-flex items-center gap-2 rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-900/40 disabled:opacity-60"
                          >
                            <Trash2 size={14} />
                            Remove
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => addToWatchlist(alert)}
                            disabled={updatingWatchlist === alert.item_id}
                            className="inline-flex items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-900/40 disabled:opacity-60"
                          >
                            <Star size={14} />
                            Watch
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => ignoreItem(alert)}
                          disabled={ignoringItem === alert.item_id}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-60"
                        >
                          <Ban size={14} />
                          Ignore
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