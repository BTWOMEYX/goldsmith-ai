import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpDown,
  ArrowUpRight,
  CheckCircle2,
  History,
  RefreshCw,
  Search,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";

import RealmSelect from "../components/RealmSelect";
import { getGlobalRealmId } from "../utils/globalRealm";

type SignalItem = {
  item_id: number;
  realm_id: number;
  realm_name: string;
  name: string;
  current_price: number;
  previous_price: number | null;
  price_change: number;
  price_change_percent: number;
  volume: number;
  previous_volume: number | null;
  volume_change: number;
  volume_change_percent: number;
  listing_count: number;
  opportunity_score: number;
  previous_score: number | null;
  score_change: number;
  risk_level: string;
  reason: string | null;
  icon_url: string | null;
  quality: string | null;
  snapshot_count: number;
  last_seen: string | null;
  signal: string;
  signal_label: string;
  signal_priority: number;
  signal_action: string;
  signal_tone: string;
  signal_confidence: number;
  signal_reason: string;
  is_watched: boolean;
};

type SignalSummary = {
  strong_buy_count: number;
  buy_watch_count: number;
  price_drop_count: number;
  score_improving_count: number;
  hold_count: number;
  avoid_count: number;
};

type SignalsResponse = {
  status: string;
  connected_realm_id: number;
  realm: string;
  signal_count: number;
  top_signal: SignalItem | null;
  summary: SignalSummary;
  items: SignalItem[];
};

const API_BASE_URL = "http://127.0.0.1:8000/api";

const SIGNAL_FILTERS = [
  "All",
  "Strong Buy",
  "Buy Watch",
  "Price Drop",
  "Score Improving",
  "Hold",
  "Avoid",
];

const SORT_OPTIONS = [
  { value: "signal-asc", label: "Best signal" },
  { value: "confidence-desc", label: "Highest confidence" },
  { value: "movement-desc", label: "Biggest movement" },
  { value: "gain-desc", label: "Biggest gain" },
  { value: "drop-asc", label: "Biggest drop" },
  { value: "score-desc", label: "Best score" },
  { value: "price-desc", label: "Highest price" },
  { value: "name-asc", label: "Item name" },
];

const EMPTY_SIGNAL_SUMMARY: SignalSummary = {
  strong_buy_count: 0,
  buy_watch_count: 0,
  price_drop_count: 0,
  score_improving_count: 0,
  hold_count: 0,
  avoid_count: 0,
};

function getRiskClass(riskLevel: string) {
  switch (riskLevel.toLowerCase()) {
    case "low":
      return "text-emerald-400 border-emerald-800 bg-emerald-950/40";
    case "medium":
      return "text-amber-400 border-amber-800 bg-amber-950/40";
    case "high":
      return "text-red-400 border-red-800 bg-red-950/40";
    default:
      return "text-slate-400 border-slate-700 bg-slate-900";
  }
}

function getMovementClass(value: number) {
  if (value > 0) {
    return "text-emerald-400";
  }

  if (value < 0) {
    return "text-red-400";
  }

  return "text-slate-400";
}

function getScoreClass(score: number) {
  if (score >= 80) {
    return "text-emerald-400";
  }

  if (score >= 60) {
    return "text-blue-400";
  }

  if (score >= 40) {
    return "text-amber-400";
  }

  return "text-red-400";
}

function getSignalClass(signal: string) {
  switch (signal) {
    case "STRONG_BUY":
      return "border-emerald-700 bg-emerald-950/50 text-emerald-300";
    case "BUY_WATCH":
      return "border-blue-700 bg-blue-950/50 text-blue-300";
    case "PRICE_DROP":
      return "border-purple-700 bg-purple-950/50 text-purple-300";
    case "SCORE_IMPROVING":
      return "border-cyan-700 bg-cyan-950/50 text-cyan-300";
    case "AVOID":
      return "border-red-700 bg-red-950/50 text-red-300";
    case "HOLD":
    default:
      return "border-slate-700 bg-slate-950 text-slate-300";
  }
}

function getSignalIcon(signal: string) {
  switch (signal) {
    case "STRONG_BUY":
      return <Zap size={14} />;
    case "BUY_WATCH":
      return <CheckCircle2 size={14} />;
    case "PRICE_DROP":
      return <TrendingDown size={14} />;
    case "SCORE_IMPROVING":
      return <Activity size={14} />;
    case "AVOID":
      return <ShieldAlert size={14} />;
    case "HOLD":
    default:
      return <AlertTriangle size={14} />;
  }
}

function getSignalRank(signal: SignalItem) {
  return signal.signal_priority;
}

function formatGold(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${Math.round(value).toLocaleString()}g`;
}

function formatPercent(value: number) {
  if (value > 0) {
    return `+${value.toFixed(2)}%`;
  }

  return `${value.toFixed(2)}%`;
}

function formatScore(value: number) {
  return `${value.toFixed(1)}/100`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  try {
    return new Intl.DateTimeFormat("en-AU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Unknown";
  }
}

export default function Analytics() {
  const [realm, setRealm] = useState(() => getGlobalRealmId());
  const [realmName, setRealmName] = useState("Illidan");
  const [items, setItems] = useState<SignalItem[]>([]);
  const [topSignal, setTopSignal] = useState<SignalItem | null>(null);
  const [signalSummary, setSignalSummary] =
    useState<SignalSummary>(EMPTY_SIGNAL_SUMMARY);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [signalFilter, setSignalFilter] = useState("All");
  const [sortMode, setSortMode] = useState("signal-asc");

  async function loadAnalytics(realmId: number) {
    try {
      setLoading(true);

      const response = await axios.get<SignalsResponse>(
        `${API_BASE_URL}/signals?connected_realm_id=${realmId}`
      );

      setRealmName(response.data.realm);
      setItems(response.data.items ?? []);
      setTopSignal(response.data.top_signal ?? null);
      setSignalSummary(response.data.summary ?? EMPTY_SIGNAL_SUMMARY);
      setError("");
    } catch {
      setError("Unable to load signal analytics.");
    } finally {
      setLoading(false);
    }
  }

  async function syncRealm() {
    try {
      setSyncing(true);
      setError("");

      await axios.post(
        `${API_BASE_URL}/sync-auctions?connected_realm_id=${realm}`
      );

      await loadAnalytics(realm);
    } catch {
      setError("Auction sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    loadAnalytics(realm);
  }, [realm]);

  const filteredItems = useMemo(() => {
    const normalisedSearch = searchTerm.trim().toLowerCase();

    const filtered = items.filter((item) => {
      const quality = item.quality ?? "unknown";
      const risk = item.risk_level ?? "unknown";

      const matchesSearch =
        normalisedSearch.length === 0 ||
        item.name.toLowerCase().includes(normalisedSearch) ||
        item.item_id.toString().includes(normalisedSearch) ||
        quality.toLowerCase().includes(normalisedSearch) ||
        risk.toLowerCase().includes(normalisedSearch) ||
        item.signal_label.toLowerCase().includes(normalisedSearch);

      const matchesSignal =
        signalFilter === "All" ||
        item.signal_label.toLowerCase() === signalFilter.toLowerCase();

      return matchesSearch && matchesSignal;
    });

    return [...filtered].sort((a, b) => {
      switch (sortMode) {
        case "confidence-desc":
          return b.signal_confidence - a.signal_confidence;
        case "movement-desc":
          return (
            Math.abs(b.price_change_percent) -
            Math.abs(a.price_change_percent)
          );
        case "gain-desc":
          return b.price_change_percent - a.price_change_percent;
        case "drop-asc":
          return a.price_change_percent - b.price_change_percent;
        case "score-desc":
          return b.opportunity_score - a.opportunity_score;
        case "price-desc":
          return b.current_price - a.current_price;
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "signal-asc":
        default:
          return (
            getSignalRank(a) - getSignalRank(b) ||
            b.signal_confidence - a.signal_confidence
          );
      }
    });
  }, [items, searchTerm, signalFilter, sortMode]);

  const snapshotCount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.snapshot_count, 0);
  }, [items]);

  const moverCount = useMemo(() => {
    return items.filter((item) => item.snapshot_count > 1).length;
  }, [items]);

  const actionableSignalCount = useMemo(() => {
    return (
      signalSummary.strong_buy_count +
      signalSummary.buy_watch_count +
      signalSummary.price_drop_count +
      signalSummary.score_improving_count
    );
  }, [signalSummary]);

  const averageConfidence = useMemo(() => {
    if (!items.length) {
      return 0;
    }

    return (
      items.reduce((sum, item) => sum + item.signal_confidence, 0) /
      items.length
    );
  }, [items]);

  const averageMovement = useMemo(() => {
    const movers = items.filter((item) => item.snapshot_count > 1);

    if (!movers.length) {
      return 0;
    }

    return (
      movers.reduce(
        (sum, item) => sum + Math.abs(item.price_change_percent),
        0
      ) / movers.length
    );
  }, [items]);

  const biggestGain = useMemo(() => {
    const movers = items.filter((item) => item.snapshot_count > 1);

    if (!movers.length) {
      return null;
    }

    return [...movers].sort(
      (a, b) => b.price_change_percent - a.price_change_percent
    )[0];
  }, [items]);

  const biggestDrop = useMemo(() => {
    const movers = items.filter((item) => item.snapshot_count > 1);

    if (!movers.length) {
      return null;
    }

    return [...movers].sort(
      (a, b) => a.price_change_percent - b.price_change_percent
    )[0];
  }, [items]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">
            Signal Analytics
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Analyse price movement, opportunity score and buy signals for{" "}
            {realmName}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <RealmSelect value={realm} onChange={setRealm} />

          <button
            onClick={() => loadAnalytics(realm)}
            disabled={loading || syncing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />

            Refresh
          </button>

          <button
            onClick={syncRealm}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Activity
              size={16}
              className={syncing ? "animate-pulse" : ""}
            />

            {syncing ? "Syncing..." : "Sync Snapshot"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/60 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Snapshots Analysed</p>

          <h3 className="mt-2 text-4xl font-bold text-white">
            {loading ? "..." : snapshotCount}
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Across {items.length} signal items
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Actionable Signals</p>

          <h3 className="mt-2 text-4xl font-bold text-blue-400">
            {loading ? "..." : actionableSignalCount}
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            {moverCount} items with history
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Top Signal</p>

          <h3 className="mt-2 truncate text-lg font-bold text-emerald-400">
            {topSignal?.name ?? "-"}
          </h3>

          <p className="mt-1 text-sm text-slate-400">
            {topSignal
              ? `${topSignal.signal_label} · ${topSignal.signal_confidence.toFixed(
                  1
                )}%`
              : "Run a snapshot to begin"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Avg. Confidence</p>

          <h3 className="mt-2 text-4xl font-bold text-amber-400">
            {loading ? "..." : `${averageConfidence.toFixed(1)}%`}
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Avg. movement {averageMovement.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Signal Intelligence
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Highest-priority action generated from score, price movement,
                risk and market depth.
              </p>
            </div>

            <span className="rounded-full border border-blue-800 bg-blue-950/50 px-3 py-1 text-xs font-semibold text-blue-400">
              {items.length} signals
            </span>
          </div>

          {topSignal ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  {topSignal.icon_url ? (
                    <img
                      src={topSignal.icon_url}
                      alt={topSignal.name}
                      className="h-14 w-14 rounded-lg border border-slate-700 bg-slate-950"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-lg border border-slate-700 bg-slate-950" />
                  )}

                  <div>
                    <div
                      className={`mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getSignalClass(
                        topSignal.signal
                      )}`}
                    >
                      {getSignalIcon(topSignal.signal)}
                      {topSignal.signal_label}
                    </div>

                    <h3 className="text-lg font-bold text-white">
                      {topSignal.name}
                    </h3>

                    <p className="mt-1 text-sm text-slate-400">
                      {topSignal.signal_action}
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      {topSignal.signal_reason}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xs text-slate-500">Confidence</p>

                  <p className="text-3xl font-bold text-emerald-400">
                    {topSignal.signal_confidence.toFixed(1)}%
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {formatGold(topSignal.current_price)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-8 text-center text-slate-500">
              No signals yet. Run a sync snapshot to begin.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold text-white">
            Signal Breakdown
          </h2>

          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-slate-950 px-4 py-3">
              <span className="text-sm text-emerald-400">Strong Buy</span>
              <span className="font-bold text-white">
                {signalSummary.strong_buy_count}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-950 px-4 py-3">
              <span className="text-sm text-blue-400">Buy Watch</span>
              <span className="font-bold text-white">
                {signalSummary.buy_watch_count}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-950 px-4 py-3">
              <span className="text-sm text-purple-400">Price Drop</span>
              <span className="font-bold text-white">
                {signalSummary.price_drop_count}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-950 px-4 py-3">
              <span className="text-sm text-cyan-400">Score Improving</span>
              <span className="font-bold text-white">
                {signalSummary.score_improving_count}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-950 px-4 py-3">
              <span className="text-sm text-slate-400">Hold</span>
              <span className="font-bold text-white">
                {signalSummary.hold_count}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-950 px-4 py-3">
              <span className="text-sm text-red-400">Avoid</span>
              <span className="font-bold text-white">
                {signalSummary.avoid_count}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="text-emerald-400" size={18} />

            <h3 className="font-semibold text-white">
              Largest Price Gain
            </h3>
          </div>

          {biggestGain ? (
            <div className="flex items-center gap-4">
              {biggestGain.icon_url ? (
                <img
                  src={biggestGain.icon_url}
                  alt={biggestGain.name}
                  className="h-12 w-12 rounded-lg border border-slate-700"
                />
              ) : (
                <div className="h-12 w-12 rounded-lg border border-slate-700" />
              )}

              <div>
                <p className="font-semibold text-white">
                  {biggestGain.name}
                </p>

                <p className="text-sm text-slate-400">
                  {formatGold(biggestGain.previous_price)} →{" "}
                  {formatGold(biggestGain.current_price)}
                </p>

                <p className="mt-1 text-sm font-bold text-emerald-400">
                  {formatPercent(biggestGain.price_change_percent)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Run at least two syncs to calculate gains.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-4 flex items-center gap-2">
            <TrendingDown className="text-red-400" size={18} />

            <h3 className="font-semibold text-white">
              Largest Price Drop
            </h3>
          </div>

          {biggestDrop ? (
            <div className="flex items-center gap-4">
              {biggestDrop.icon_url ? (
                <img
                  src={biggestDrop.icon_url}
                  alt={biggestDrop.name}
                  className="h-12 w-12 rounded-lg border border-slate-700"
                />
              ) : (
                <div className="h-12 w-12 rounded-lg border border-slate-700" />
              )}

              <div>
                <p className="font-semibold text-white">
                  {biggestDrop.name}
                </p>

                <p className="text-sm text-slate-400">
                  {formatGold(biggestDrop.previous_price)} →{" "}
                  {formatGold(biggestDrop.current_price)}
                </p>

                <p className="mt-1 text-sm font-bold text-red-400">
                  {formatPercent(biggestDrop.price_change_percent)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Run at least two syncs to calculate drops.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <History size={16} />
          Signal Analytics Controls
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />

            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search item, ID, signal, quality or risk..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-10 pr-4 text-sm text-white outline-none transition focus:border-amber-500"
            />
          </div>

          <select
            value={signalFilter}
            onChange={(event) => setSignalFilter(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 outline-none transition focus:border-amber-500"
          >
            {SIGNAL_FILTERS.map((signal) => (
              <option key={signal} value={signal}>
                Signal: {signal}
              </option>
            ))}
          </select>

          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 outline-none transition focus:border-amber-500"
          >
            {SORT_OPTIONS.map((sortOption) => (
              <option key={sortOption.value} value={sortOption.value}>
                Sort: {sortOption.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Signal Movement Summary
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Latest snapshot compared with previous stored snapshots and
              converted into signal actions.
            </p>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-blue-800 bg-blue-950/50 px-3 py-1 text-xs font-semibold text-blue-400">
            <ArrowUpDown size={13} />
            {filteredItems.length} items
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Item</th>
                <th className="px-6 py-3 text-left font-medium">Signal</th>
                <th className="px-6 py-3 text-right font-medium">Confidence</th>
                <th className="px-6 py-3 text-right font-medium">Previous</th>
                <th className="px-6 py-3 text-right font-medium">Current</th>
                <th className="px-6 py-3 text-right font-medium">Movement</th>
                <th className="px-6 py-3 text-right font-medium">Score</th>
                <th className="px-6 py-3 text-left font-medium">Risk</th>
                <th className="px-6 py-3 text-right font-medium">Snapshots</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    Loading signal analytics...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    No signal analytics yet. Run a sync snapshot to begin.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={`${item.realm_id}-${item.item_id}`}
                    className="border-t border-slate-800 transition hover:bg-slate-800/40"
                    title={item.signal_reason}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {item.icon_url ? (
                          <img
                            src={item.icon_url}
                            alt={item.name}
                            className="h-10 w-10 rounded-lg border border-slate-700 bg-slate-950"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg border border-slate-700 bg-slate-950" />
                        )}

                        <div>
                          <p className="font-semibold text-white">
                            {item.name}
                          </p>

                          <p className="text-xs text-slate-500">
                            Item #{item.item_id} · Last seen{" "}
                            {formatDate(item.last_seen)}
                          </p>

                          <p className="mt-1 max-w-xl truncate text-xs text-slate-400">
                            {item.signal_action}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getSignalClass(
                          item.signal
                        )}`}
                      >
                        {getSignalIcon(item.signal)}
                        {item.signal_label}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right font-bold text-emerald-400">
                      {item.signal_confidence.toFixed(1)}%
                    </td>

                    <td className="px-6 py-4 text-right text-slate-400">
                      {formatGold(item.previous_price)}
                    </td>

                    <td className="px-6 py-4 text-right font-semibold text-emerald-400">
                      {formatGold(item.current_price)}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <span
                        className={`inline-flex items-center justify-end gap-1 font-bold ${getMovementClass(
                          item.price_change_percent
                        )}`}
                      >
                        {item.price_change_percent > 0 && (
                          <ArrowUpRight size={14} />
                        )}

                        {item.price_change_percent < 0 && (
                          <ArrowDownRight size={14} />
                        )}

                        {formatPercent(item.price_change_percent)}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <span
                        className={`font-bold ${getScoreClass(
                          item.opportunity_score
                        )}`}
                      >
                        {formatScore(item.opportunity_score)}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${getRiskClass(
                          item.risk_level
                        )}`}
                      >
                        {item.risk_level}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right text-slate-400">
                      {item.snapshot_count}
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