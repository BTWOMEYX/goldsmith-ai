import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ArrowUpDown,
  CheckCircle2,
  RefreshCw,
  Search,
  ShieldAlert,
  Star,
  Trash2,
  TrendingDown,
  Zap,
} from "lucide-react";

type WatchlistItem = {
  id: number;
  item_id: number;
  name: string;
  current_price: number;
  volume: number;
  listing_count: number;
  opportunity_score: number;
  risk_level: string;
  reason: string | null;
  icon_url: string | null;
  quality: string | null;
  profit_margin: number;
  realm_id: number;
  realm_name: string;
  saved_at: string | null;
};

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

type WatchlistResponse = {
  status: string;
  item_count: number;
  items: WatchlistItem[];
};

type WatchlistSignalsResponse = {
  status: string;
  signal_count: number;
  top_signal: SignalItem | null;
  summary: {
    strong_buy_count: number;
    buy_watch_count: number;
    price_drop_count: number;
    score_improving_count: number;
    hold_count: number;
    avoid_count: number;
  };
  items: SignalItem[];
};


const API_BASE_URL = "http://127.0.0.1:8000/api";

const RISK_FILTERS = ["All", "Low", "Medium", "High"];

const SIGNAL_FILTERS = [
  "All",
  "Strong Buy",
  "Buy Watch",
  "Price Drop",
  "Score Improving",
  "Hold",
  "Avoid",
  "No Signal",
];

const SORT_OPTIONS = [
  { value: "signal-asc", label: "Best signal" },
  { value: "confidence-desc", label: "Highest confidence" },
  { value: "saved-desc", label: "Recently added" },
  { value: "score-desc", label: "Best score" },
  { value: "movement-desc", label: "Biggest movement" },
  { value: "price-desc", label: "Highest price" },
  { value: "volume-desc", label: "Highest volume" },
  { value: "risk-asc", label: "Lowest risk" },
  { value: "realm-asc", label: "Realm name" },
  { value: "name-asc", label: "Item name" },
];

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

function getRiskRank(riskLevel: string) {
  switch (riskLevel.toLowerCase()) {
    case "low":
      return 1;
    case "medium":
      return 2;
    case "high":
      return 3;
    default:
      return 4;
  }
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
      return "border-slate-700 bg-slate-950 text-slate-300";
    default:
      return "border-slate-700 bg-slate-950 text-slate-400";
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
      return <AlertTriangle size={14} />;
    default:
      return <Star size={14} />;
  }
}

function getSignalRank(signal: SignalItem | undefined) {
  if (!signal) {
    return 99;
  }

  return signal.signal_priority;
}

function formatGold(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${Math.round(value).toLocaleString()}g`;
}

function formatScore(value: number) {
  return `${value.toFixed(1)}/100`;
}

function formatPercent(value: number) {
  if (value > 0) {
    return `+${value.toFixed(2)}%`;
  }

  return `${value.toFixed(2)}%`;
}

function formatSavedDate(value: string | null) {
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

function getSignalStorageKey(realmId: number, itemId: number) {
  return `${realmId}-${itemId}`;
}

export default function Watchlist() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [signals, setSignals] = useState<SignalItem[]>([]);
  const [topSignal, setTopSignal] = useState<SignalItem | null>(null);
  const [signalSummary, setSignalSummary] = useState({
    strong_buy_count: 0,
    buy_watch_count: 0,
    price_drop_count: 0,
    score_improving_count: 0,
    hold_count: 0,
    avoid_count: 0,
  });

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState("All");
  const [signalFilter, setSignalFilter] = useState("All");
  const [sortMode, setSortMode] = useState("signal-asc");

  async function loadWatchlist() {
    try {
      setLoading(true);

      const [watchlistResponse, signalsResponse] = await Promise.all([
        axios.get<WatchlistResponse>(`${API_BASE_URL}/watchlist`),
        axios.get<WatchlistSignalsResponse>(
          `${API_BASE_URL}/signals/watchlist`
        ),
      ]);

      setItems(watchlistResponse.data.items ?? []);
      setSignals(signalsResponse.data.items ?? []);
      setTopSignal(signalsResponse.data.top_signal ?? null);

      if (signalsResponse.data.summary) {
        setSignalSummary(signalsResponse.data.summary);
      }

      setError("");
    } catch {
      setError("Unable to load backend watchlist signals.");
    } finally {
      setLoading(false);
    }
  }

  async function removeItem(itemId: number, realmId: number) {
    try {
      setUpdating(true);
      setError("");

      await axios.delete(`${API_BASE_URL}/watchlist/${realmId}/${itemId}`);

      await loadWatchlist();
    } catch {
      setError("Unable to remove item from watchlist.");
    } finally {
      setUpdating(false);
    }
  }

  async function clearWatchlist() {
    try {
      setUpdating(true);
      setError("");

      await axios.delete(`${API_BASE_URL}/watchlist`);

      await loadWatchlist();
    } catch {
      setError("Unable to clear watchlist.");
    } finally {
      setUpdating(false);
    }
  }

  useEffect(() => {
    loadWatchlist();
  }, []);

  const signalByItemKey = useMemo(() => {
    const signalMap = new Map<string, SignalItem>();

    signals.forEach((signal) => {
      signalMap.set(
        getSignalStorageKey(signal.realm_id, signal.item_id),
        signal
      );
    });

    return signalMap;
  }, [signals]);

  const watchedRealmCount = useMemo(() => {
    return new Set(items.map((item) => item.realm_id)).size;
  }, [items]);

  const watchedRealmNames = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.realm_name))).sort(
      (a, b) => a.localeCompare(b)
    );
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalisedSearch = searchTerm.trim().toLowerCase();

    const filtered = items.filter((item) => {
      const itemRisk = item.risk_level ?? "unknown";
      const itemQuality = item.quality ?? "unknown";
      const signal = signalByItemKey.get(
        getSignalStorageKey(item.realm_id, item.item_id)
      );

      const signalLabel = signal?.signal_label ?? "No Signal";

      const matchesSearch =
        normalisedSearch.length === 0 ||
        item.name.toLowerCase().includes(normalisedSearch) ||
        item.item_id.toString().includes(normalisedSearch) ||
        item.realm_name.toLowerCase().includes(normalisedSearch) ||
        item.realm_id.toString().includes(normalisedSearch) ||
        itemRisk.toLowerCase().includes(normalisedSearch) ||
        itemQuality.toLowerCase().includes(normalisedSearch) ||
        signalLabel.toLowerCase().includes(normalisedSearch);

      const matchesRisk =
        riskFilter === "All" ||
        itemRisk.toLowerCase() === riskFilter.toLowerCase();

      const matchesSignal =
        signalFilter === "All" ||
        signalLabel.toLowerCase() === signalFilter.toLowerCase();

      return matchesSearch && matchesRisk && matchesSignal;
    });

    return [...filtered].sort((a, b) => {
      const signalA = signalByItemKey.get(
        getSignalStorageKey(a.realm_id, a.item_id)
      );

      const signalB = signalByItemKey.get(
        getSignalStorageKey(b.realm_id, b.item_id)
      );

      switch (sortMode) {
        case "confidence-desc":
          return (
            (signalB?.signal_confidence ?? 0) -
            (signalA?.signal_confidence ?? 0)
          );
        case "score-desc":
          return b.opportunity_score - a.opportunity_score;
        case "movement-desc":
          return (
            Math.abs(signalB?.price_change_percent ?? 0) -
            Math.abs(signalA?.price_change_percent ?? 0)
          );
        case "price-desc":
          return b.current_price - a.current_price;
        case "volume-desc":
          return b.volume - a.volume;
        case "risk-asc":
          return getRiskRank(a.risk_level) - getRiskRank(b.risk_level);
        case "realm-asc":
          return (
            a.realm_name.localeCompare(b.realm_name) ||
            a.name.localeCompare(b.name)
          );
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "saved-desc":
          return (
            new Date(b.saved_at ?? "").getTime() -
            new Date(a.saved_at ?? "").getTime()
          );
        case "signal-asc":
        default:
          return (
            getSignalRank(signalA) - getSignalRank(signalB) ||
            (signalB?.signal_confidence ?? 0) -
              (signalA?.signal_confidence ?? 0)
          );
      }
    });
  }, [
    items,
    searchTerm,
    riskFilter,
    signalFilter,
    sortMode,
    signalByItemKey,
  ]);

  const averageSignalConfidence = useMemo(() => {
    if (!signals.length) {
      return 0;
    }

    return (
      signals.reduce((sum, signal) => sum + signal.signal_confidence, 0) /
      signals.length
    );
  }, [signals]);

  const actionableSignalCount = useMemo(() => {
    return (
      signalSummary.strong_buy_count +
      signalSummary.buy_watch_count +
      signalSummary.price_drop_count +
      signalSummary.score_improving_count
    );
  }, [signalSummary]);

  const totalValue = useMemo(() => {
    return items.reduce((sum, item) => sum + item.current_price, 0);
  }, [items]);

  const bestItem = useMemo(() => {
    if (!items.length) {
      return null;
    }

    return [...items].sort(
      (a, b) => b.opportunity_score - a.opportunity_score
    )[0];
  }, [items]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Watchlist</h2>

          <p className="mt-1 text-sm text-slate-400">
            Track saved opportunities with live buy signals, realm context and
            movement data.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={loadWatchlist}
            disabled={loading || updating}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <Link
            to="/markets"
            className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-black transition hover:bg-amber-400"
          >
            Add from Scanner
          </Link>

          {items.length > 0 && (
            <button
              onClick={clearWatchlist}
              disabled={updating}
              className="rounded-lg border border-red-800 bg-red-950/40 px-5 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-900/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear Watchlist
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/60 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Watched Items</p>

          <h3 className="mt-2 text-4xl font-bold text-white">
            {loading ? "..." : items.length}
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            {filteredItems.length} currently visible
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Servers Watched</p>

          <h3 className="mt-2 text-4xl font-bold text-amber-400">
            {loading ? "..." : watchedRealmCount}
          </h3>

          <p
            className="mt-1 truncate text-xs text-slate-500"
            title={watchedRealmNames.join(", ")}
          >
            {watchedRealmNames.length > 0
              ? watchedRealmNames.join(", ")
              : "No servers yet"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Top Watchlist Signal</p>

          <h3 className="mt-2 truncate text-lg font-bold text-emerald-400">
            {topSignal?.name ?? bestItem?.name ?? "-"}
          </h3>

          <p className="mt-1 text-sm text-slate-400">
            {topSignal
              ? `${topSignal.realm_name} · ${topSignal.signal_label} · ${topSignal.signal_confidence.toFixed(
                  1
                )}%`
              : bestItem
                ? `${bestItem.realm_name} · ${formatScore(
                    bestItem.opportunity_score
                  )}`
                : ""}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Actionable Signals</p>

          <h3 className="mt-2 text-4xl font-bold text-blue-400">
            {loading ? "..." : actionableSignalCount}
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Avg. confidence {averageSignalConfidence.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Watchlist Signal Centre
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Highest-priority signal from your saved market opportunities.
              </p>
            </div>

            <span className="rounded-full border border-amber-800 bg-amber-950/50 px-3 py-1 text-xs font-semibold text-amber-400">
              {signals.length} signals
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
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <div
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getSignalClass(
                          topSignal.signal
                        )}`}
                      >
                        {getSignalIcon(topSignal.signal)}
                        {topSignal.signal_label}
                      </div>

                      <span className="rounded-full border border-amber-800 bg-amber-950/40 px-3 py-1 text-xs font-semibold text-amber-300">
                        {topSignal.realm_name}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white">
                      {topSignal.name}
                    </h3>

                    <p className="mt-1 text-xs text-slate-500">
                      Connected Realm #{topSignal.realm_id}
                    </p>

                    <p className="mt-2 text-sm text-slate-400">
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
              No watchlist signals yet. Add items from the Market Scanner and
              run a sync snapshot.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold text-white">
            Watchlist Signal Mix
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

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Star size={16} className="text-amber-400" />
          Watchlist Controls
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />

            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search item, realm, ID, signal or risk..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-10 pr-4 text-sm text-white outline-none transition focus:border-amber-500"
            />
          </div>

          <select
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 outline-none transition focus:border-amber-500"
          >
            {RISK_FILTERS.map((risk) => (
              <option key={risk} value={risk}>
                Risk: {risk}
              </option>
            ))}
          </select>

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
              Watched Opportunities
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Saved items enriched with current buy signals and server context.
            </p>
          </div>

          <span className="flex items-center gap-2 rounded-full border border-amber-800 bg-amber-950/50 px-3 py-1 text-xs font-semibold text-amber-400">
            <ArrowUpDown size={13} />
            {filteredItems.length} items
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Item</th>
                <th className="px-6 py-3 text-left font-medium">Realm</th>
                <th className="px-6 py-3 text-left font-medium">Signal</th>
                <th className="px-6 py-3 text-right font-medium">
                  Confidence
                </th>
                <th className="px-6 py-3 text-right font-medium">Price</th>
                <th className="px-6 py-3 text-right font-medium">
                  Movement
                </th>
                <th className="px-6 py-3 text-right font-medium">Score</th>
                <th className="px-6 py-3 text-left font-medium">Risk</th>
                <th className="px-6 py-3 text-right font-medium">Saved</th>
                <th className="px-6 py-3 text-right font-medium">Remove</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    Loading backend watchlist signals...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    No watched items yet. Add opportunities from the Market
                    Scanner.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const signal = signalByItemKey.get(
                    getSignalStorageKey(item.realm_id, item.item_id)
                  );

                  return (
                    <tr
                      key={`${item.realm_id}-${item.item_id}`}
                      className="border-t border-slate-800 transition hover:bg-slate-800/40"
                      title={signal?.signal_reason ?? item.reason ?? ""}
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
                              Item #{item.item_id} · {item.listing_count}{" "}
                              listings
                            </p>

                            <p className="mt-1 max-w-xl truncate text-xs text-slate-400">
                              {signal?.signal_action ?? item.reason}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex w-fit rounded-full border border-amber-800 bg-amber-950/40 px-3 py-1 text-xs font-semibold text-amber-300">
                            {item.realm_name}
                          </span>

                          <span className="text-xs text-slate-500">
                            Realm #{item.realm_id}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {signal ? (
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getSignalClass(
                              signal.signal
                            )}`}
                          >
                            {getSignalIcon(signal.signal)}
                            {signal.signal_label}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-400">
                            <Star size={14} />
                            No Signal
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span className="font-bold text-emerald-400">
                          {signal
                            ? `${signal.signal_confidence.toFixed(1)}%`
                            : "-"}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right font-semibold text-emerald-400">
                        {formatGold(signal?.current_price ?? item.current_price)}
                      </td>

                      <td className="px-6 py-4 text-right">
                        {signal ? (
                          <span
                            className={`inline-flex items-center justify-end gap-1 font-bold ${
                              signal.price_change_percent > 0
                                ? "text-emerald-400"
                                : signal.price_change_percent < 0
                                  ? "text-red-400"
                                  : "text-slate-400"
                            }`}
                          >
                            {signal.price_change_percent > 0 && (
                              <ArrowUpRight size={14} />
                            )}

                            {signal.price_change_percent < 0 && (
                              <ArrowDownRight size={14} />
                            )}

                            {formatPercent(signal.price_change_percent)}
                          </span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span
                          className={`font-bold ${getScoreClass(
                            signal?.opportunity_score ??
                              item.opportunity_score
                          )}`}
                        >
                          {formatScore(
                            signal?.opportunity_score ??
                              item.opportunity_score
                          )}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getRiskClass(
                            signal?.risk_level ?? item.risk_level
                          )}`}
                        >
                          {signal?.risk_level ?? item.risk_level}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right text-xs text-slate-500">
                        {formatSavedDate(item.saved_at)}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => removeItem(item.item_id, item.realm_id)}
                          disabled={updating}
                          className="inline-flex items-center gap-2 rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-900/40 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 size={14} />
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-sm text-slate-400">
          Total watched market value:{" "}
          <span className="font-semibold text-emerald-400">
            {formatGold(totalValue)}
          </span>
        </p>
      </div>
    </div>
  );
}