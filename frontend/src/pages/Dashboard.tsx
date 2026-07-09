import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Compass,
  Eye,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingDown,
  Zap,
} from "lucide-react";

import RealmSelect from "../components/RealmSelect";

type TopAction = {
  type: string;
  title: string;
  priority: string;
  summary: string;
  action: string;
  target_page: string;
  button_label: string;
};

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
  signal: string;
  signal_label: string;
  signal_action: string;
  signal_confidence: number;
  signal_reason: string;
  is_watched: boolean;
  suggested_buy_below: number;
  target_resale_price: number;
  estimated_profit_before_costs: number;
  estimated_margin_percent: number;
};

type WatchlistPriorityItem = {
  id: number;
  item_id: number;
  realm_id: number;
  realm_name: string;
  name: string;
  current_price: number;
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
  saved_at: string | null;
};

type CategoryFocus = {
  category: string;
  alert_count: number;
  actionable_count: number;
  average_confidence: number;
  best_signal: string;
};

type ActionCenterResponse = {
  status: string;
  connected_realm_id: number;
  realm: string;
  top_action: TopAction;
  top_alert: DealAlert | null;
  actions: DealAlert[];
  watchlist_priority: WatchlistPriorityItem[];
  category_focus: CategoryFocus[];
  summary: {
    tracked_count: number;
    alert_count: number;
    actionable_count: number;
    auto_watch_ready_count: number;
    watchlist_count: number;
    capture: {
      latest_capture_at: string | null;
      item_count: number;
      total_volume: number;
      total_market_value: number;
    };
    deals: {
      auto_watch_count: number;
      fast_mover_count: number;
      price_drop_count: number;
      high_margin_count: number;
      watch_candidate_count: number;
      hold_count: number;
      avoid_count: number;
    };
  };
  error?: string;
};

const API_BASE_URL = "http://127.0.0.1:8000/api";

function formatGold(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${Math.round(value).toLocaleString()}g`;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "No capture yet";
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

function getPriorityClass(priority: string) {
  switch (priority.toLowerCase()) {
    case "high":
      return "border-emerald-800 bg-emerald-950/30 text-emerald-300";
    case "medium":
      return "border-amber-800 bg-amber-950/30 text-amber-300";
    default:
      return "border-slate-800 bg-slate-950 text-slate-300";
  }
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
      return <Zap size={15} />;
    case "FAST_MOVER":
      return <CheckCircle2 size={15} />;
    case "PRICE_DROP":
      return <TrendingDown size={15} />;
    case "HIGH_MARGIN":
      return <Star size={15} />;
    case "AVOID":
      return <AlertTriangle size={15} />;
    default:
      return <BellRing size={15} />;
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

export default function Dashboard() {
  const [realm, setRealm] = useState(11);
  const [data, setData] = useState<ActionCenterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadActionCenter(realmId: number) {
    try {
      setLoading(true);

      const response = await axios.get<ActionCenterResponse>(
        `${API_BASE_URL}/action-center?connected_realm_id=${realmId}`,
      );

      setData(response.data);
      setError(response.data.status === "Error" ? response.data.error ?? "" : "");
    } catch {
      setData(null);
      setError("Unable to load Action Center.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActionCenter(realm);
  }, [realm]);

  useEffect(() => {
    function handleGlobalSyncComplete() {
      loadActionCenter(realm);
    }

    window.addEventListener("goldsmith-sync-complete", handleGlobalSyncComplete);

    return () => {
      window.removeEventListener(
        "goldsmith-sync-complete",
        handleGlobalSyncComplete,
      );
    };
  }, [realm]);

  const topAction = data?.top_action;
  const topAlert = data?.top_alert;
  const summary = data?.summary;

  const bestActions = useMemo(() => {
    return data?.actions.slice(0, 3) ?? [];
  }, [data]);

  const watchlistPriority = useMemo(() => {
    return data?.watchlist_priority.slice(0, 3) ?? [];
  }, [data]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={22} className="text-amber-400" />
            <h2 className="text-2xl font-bold text-white">Action Center</h2>
          </div>

          <p className="mt-1 text-sm text-slate-400">
            One clear command page. Use this first, then open detail pages only
            when needed.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <RealmSelect value={realm} onChange={setRealm} />

          <button
            type="button"
            onClick={() => loadActionCenter(realm)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/50 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-amber-800 bg-amber-950/20 p-6 lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-amber-300">
                Do This Next
              </p>

              <h3 className="mt-2 text-3xl font-bold text-white">
                {loading ? "Loading..." : topAction?.title ?? "No action"}
              </h3>
            </div>

            {topAction && (
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${getPriorityClass(
                  topAction.priority,
                )}`}
              >
                {topAction.priority} Priority
              </span>
            )}
          </div>

          <p className="text-lg text-slate-300">
            {topAction?.summary ?? "GoldSmith is checking what needs attention."}
          </p>

          <p className="mt-3 text-sm text-slate-400">
            {topAction?.action ?? ""}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {topAction && topAction.target_page !== "/" ? (
              <Link
                to={topAction.target_page}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-3 text-sm font-bold text-black transition hover:bg-amber-400"
              >
                <Compass size={17} />
                {topAction.button_label}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-5 py-3 text-sm font-semibold text-slate-300">
                <Compass size={17} />
                Use Global Sync Above
              </span>
            )}

            <Link
              to="/alerts"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              <BellRing size={17} />
              Deal Queue
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Market Health
          </p>

          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Actionable</span>
              <span className="text-2xl font-bold text-emerald-400">
                {loading ? "..." : summary?.actionable_count ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Auto-Watch Ready</span>
              <span className="text-2xl font-bold text-amber-400">
                {loading ? "..." : summary?.auto_watch_ready_count ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Watched</span>
              <span className="text-2xl font-bold text-blue-400">
                {loading ? "..." : summary?.watchlist_count ?? 0}
              </span>
            </div>

            <div className="border-t border-slate-800 pt-4">
              <p className="text-xs text-slate-500">Latest capture</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {formatDateTime(summary?.capture.latest_capture_at ?? null)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {topAlert && (
        <div className="rounded-2xl border border-emerald-800 bg-emerald-950/20 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              {topAlert.icon_url ? (
                <img
                  src={topAlert.icon_url}
                  alt={topAlert.name}
                  className="h-14 w-14 rounded-xl border border-slate-700 bg-slate-950"
                />
              ) : (
                <div className="h-14 w-14 rounded-xl border border-slate-700 bg-slate-950" />
              )}

              <div>
                <div
                  className={`mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getSignalClass(
                    topAlert.signal,
                  )}`}
                >
                  {getSignalIcon(topAlert.signal)}
                  {topAlert.signal_label}
                </div>

                <h3 className="text-xl font-bold text-white">
                  {topAlert.name}
                </h3>

                <p className="mt-1 text-sm text-slate-400">
                  {topAlert.signal_action}
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs text-slate-500">Confidence</p>
              <p className="text-3xl font-bold text-emerald-400">
                {topAlert.signal_confidence.toFixed(1)}%
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Buy below {formatGold(topAlert.suggested_buy_below)}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white">Best Actions</h3>
              <p className="mt-1 text-sm text-slate-400">
                Only the top few items. Open Deal Alerts for the full queue.
              </p>
            </div>

            <Link
              to="/alerts"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              <Eye size={14} />
              Details
            </Link>
          </div>

          <div className="space-y-3">
            {bestActions.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 text-sm text-slate-500">
                No actions yet. Run Global Sync above.
              </div>
            ) : (
              bestActions.map((action) => (
                <div
                  key={`${action.realm_id}-${action.item_id}`}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{action.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {action.goldsmith_category} ·{" "}
                        <span className={getRiskClass(action.risk_level)}>
                          {action.risk_level} risk
                        </span>
                      </p>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${getSignalClass(
                        action.signal,
                      )}`}
                    >
                      {getSignalIcon(action.signal)}
                      {action.signal_label}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-slate-500">Current</p>
                      <p className="mt-1 font-bold text-emerald-400">
                        {formatGold(action.current_price)}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-500">Buy Below</p>
                      <p className="mt-1 font-bold text-blue-400">
                        {formatGold(action.suggested_buy_below)}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-500">Target</p>
                      <p className="mt-1 font-bold text-amber-400">
                        {formatGold(action.target_resale_price)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white">Category Focus</h3>
              <p className="mt-1 text-sm text-slate-400">
                The markets GoldSmith thinks deserve attention now.
              </p>
            </div>

            <ShieldCheck size={20} className="text-emerald-400" />
          </div>

          <div className="space-y-3">
            {data?.category_focus.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 text-sm text-slate-500">
                No category focus yet.
              </div>
            ) : (
              data?.category_focus.map((category) => (
                <div
                  key={category.category}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-4"
                >
                  <div>
                    <p className="font-semibold text-white">
                      {category.category}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {category.best_signal} · {category.alert_count} alert
                      {category.alert_count === 1 ? "" : "s"}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-400">
                      {category.actionable_count} actionable
                    </p>
                    <p className="text-xs text-slate-500">
                      {category.average_confidence}% avg confidence
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">
              Watchlist Priority
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Saved targets that need review. The Watchlist page is for detail.
            </p>
          </div>

          <Link
            to="/watchlist"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            <Star size={14} />
            Open Watchlist
          </Link>
        </div>

        {watchlistPriority.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 text-sm text-slate-500">
            Nothing watched yet. Auto Watch will add high-confidence deals after
            scans.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {watchlistPriority.map((item) => (
              <div
                key={`${item.realm_id}-${item.item_id}`}
                className="rounded-xl border border-slate-800 bg-slate-950 p-4"
              >
                <p className="truncate font-semibold text-white">
                  {item.name}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {item.goldsmith_category}
                </p>

                <div className="mt-4 flex items-center justify-between">
                  <span className="font-bold text-emerald-400">
                    {formatGold(item.current_price)}
                  </span>

                  <span className={`text-xs ${getRiskClass(item.risk_level)}`}>
                    {item.risk_level}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}