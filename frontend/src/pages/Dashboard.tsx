import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ArrowRight,
  BellRing,
  Brain,
  CheckCircle2,
  Compass,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";

import RealmSelect from "../components/RealmSelect";
import { listenForGlobalRealmChange, setGlobalRealmId } from "../utils/globalRealm";

const API_BASE_URL = "http://127.0.0.1:8000/api";
const REALM_KEY = "goldsmith.defaultRealm";

type DealAlert = {
  item_id: number;
  realm_id: number;
  name: string;
  current_price: number;
  volume: number;
  listing_count: number;
  opportunity_score: number;
  risk_level: string;
  icon_url: string | null;
  quality: string | null;
  goldsmith_category: string;
  signal: string;
  signal_label: string;
  signal_reason: string;
  signal_confidence: number;
  suggested_buy_quantity: number;
  suggested_buy_below: number;
  target_resale_price: number;
  estimated_profit_before_costs: number;
  estimated_margin_percent: number;
  estimated_net_margin_percent?: number;
  max_gold_exposure: number;
  capital_risk_label: string;
  capital_action: string;
  buy_strategy: string;
  capital_note: string;
  sale_speed: string;
  memory_price_state: string;
  memory_score: number;
  memory_confidence: string;
  memory_note: string;
  final_decision: string;
  decision_grade: string;
  decision_score: number;
  buy_pressure: string;
  position_size_label: string;
  decision_note: string;
  feedback_adjustment?: number;
  feedback_label?: string;
  feedback_note?: string;
};

type CategoryFocus = {
  category?: string;
  name?: string;
  signal?: string;
  actionable_count?: number;
  alert_count?: number;
  count?: number;
  avg_confidence?: number;
  average_confidence?: number;
  confidence?: number;
  description?: string;
};

type WatchlistPriority = {
  item_id?: number;
  name?: string;
  item_name?: string;
  current_price?: number;
  price?: number;
  risk_level?: string;
  signal?: string;
  confidence?: number;
  icon_url?: string | null;
  category?: string;
  goldsmith_category?: string;
};

type ActionCenterSummary = {
  tracked_count?: number;
  alert_count?: number;
  actionable_count?: number;
  auto_watch_ready_count?: number;
  watchlist_count?: number;
  suppressed_count?: number;
  memory_undervalued_count?: number;
  memory_volatile_count?: number;
  deals?: Record<string, number>;
  capture?: {
    latest_capture_at?: string | null;
    latest_snapshot_at?: string | null;
    captured_item_count?: number;
  };
};

type ActionCenterResponse = {
  status: string;
  connected_realm_id: number;
  realm?: string;
  top_action?: {
    title?: string;
    label?: string;
    description?: string;
    priority?: string;
  } | null;
  top_alert: DealAlert | null;
  actions: DealAlert[];
  watchlist_priority: WatchlistPriority[];
  category_focus: CategoryFocus[];
  summary: ActionCenterSummary;
  error?: string;
};

type QueueResponse = {
  status: string;
  action?: string;
  error?: string;
};

function readRealmId() {
  const stored = Number(localStorage.getItem(REALM_KEY));

  if (Number.isFinite(stored) && stored > 0) {
    return stored;
  }

  return 11;
}

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

  return `${value.toFixed(1)}%`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "No capture yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDecisionClass(finalDecision: string) {
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

function getGradeClass(grade: string) {
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
      return "border-blue-800 bg-blue-950/40 text-blue-300";
    default:
      return "border-slate-700 bg-slate-950 text-slate-300";
  }
}

function getPriorityClass(alert: DealAlert | null) {
  if (!alert) {
    return "border-slate-800 bg-slate-900";
  }

  if (alert.final_decision === "Strong Buy") {
    return "border-emerald-700 bg-emerald-950/20 goldsmith-action-glow";
  }

  if (alert.final_decision === "Buy") {
    return "border-emerald-800 bg-emerald-950/20";
  }

  if (alert.final_decision === "Small Buy") {
    return "border-amber-800 bg-amber-950/10";
  }

  return "border-slate-800 bg-slate-900";
}

export default function Dashboard() {
  const [realm, setRealmState] = useState(() => readRealmId());
  const [topAlert, setTopAlert] = useState<DealAlert | null>(null);
  const [actions, setActions] = useState<DealAlert[]>([]);
  const [summary, setSummary] = useState<ActionCenterSummary>({});
  const [categoryFocus, setCategoryFocus] = useState<CategoryFocus[]>([]);
  const [watchlistPriority, setWatchlistPriority] = useState<WatchlistPriority[]>([]);
  const [loading, setLoading] = useState(true);
  const [queueingItem, setQueueingItem] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function setRealm(nextRealm: number) {
    setGlobalRealmId(nextRealm);
    setRealmState(nextRealm);
  }

  async function loadActionCenter() {
    try {
      setLoading(true);
      setError("");

      const response = await axios.get<ActionCenterResponse>(
        `${API_BASE_URL}/action-center?connected_realm_id=${realm}`,
      );

      if (response.data.status !== "Success") {
        setError(response.data.error ?? "Unable to load Action Center.");
        setTopAlert(null);
        setActions([]);
        setSummary({});
        setCategoryFocus([]);
        setWatchlistPriority([]);
        return;
      }

      setTopAlert(response.data.top_alert);
      setActions(response.data.actions ?? []);
      setSummary(response.data.summary ?? {});
      setCategoryFocus(response.data.category_focus ?? []);
      setWatchlistPriority(response.data.watchlist_priority ?? []);
    } catch {
      setError("Unable to load Action Center. Check backend is running.");
      setTopAlert(null);
      setActions([]);
      setSummary({});
      setCategoryFocus([]);
      setWatchlistPriority([]);
    } finally {
      setLoading(false);
    }
  }

  async function queueBuy(alert: DealAlert) {
    try {
      setQueueingItem(alert.item_id);
      setError("");
      setMessage("");

      if (alert.suggested_buy_quantity <= 0) {
        setError("GoldSmith does not recommend buying this item yet.");
        return;
      }

      const response = await axios.post<QueueResponse>(
        `${API_BASE_URL}/buy-queue/from-alert`,
        {
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
          expected_margin_percent: alert.estimated_net_margin_percent ?? alert.estimated_margin_percent,
          reason: alert.decision_note || alert.signal_reason,
        },
      );

      if (response.data.status !== "Success") {
        setError(response.data.error ?? "Unable to queue this buy.");
        return;
      }

      setMessage(
        `${alert.name} ${response.data.action === "updated" ? "updated in" : "added to"} Buy Queue.`,
      );
    } catch {
      setError("Unable to add item to Buy Queue.");
    } finally {
      setQueueingItem(null);
    }
  }

  useEffect(() => {
    loadActionCenter();
  }, [realm]);

  useEffect(() => {
    return listenForGlobalRealmChange((realmId) => {
      setRealmState(realmId);
    });
  }, []);

  useEffect(() => {
    function handleSyncComplete() {
      loadActionCenter();
    }

    window.addEventListener("goldsmith-sync-complete", handleSyncComplete);

    return () => {
      window.removeEventListener("goldsmith-sync-complete", handleSyncComplete);
    };
  }, [realm]);

  const latestCapture = useMemo(() => {
    return (
      summary.capture?.latest_capture_at ??
      summary.capture?.latest_snapshot_at ??
      null
    );
  }, [summary.capture]);

  const buyNowCount =
    (summary.deals?.strong_buy_count ?? 0) +
    (summary.deals?.buy_count ?? 0) +
    (summary.deals?.small_buy_count ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Compass size={23} className="text-amber-400" />
            <h2 className="text-2xl font-bold text-white">Action Center</h2>
          </div>

          <p className="mt-1 text-sm text-slate-400">
            Simple mode execution page. Queue buys directly here, then execute manually from Buy Queue.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <RealmSelect value={realm} onChange={setRealm} />

          <button
            type="button"
            onClick={loadActionCenter}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <a
            href="/alerts"
            className="inline-flex items-center gap-2 rounded-lg border border-blue-800 bg-blue-950/40 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-900/40"
          >
            <ExternalLink size={16} />
            Full Alerts
          </a>

          <a
            href="/buy-queue"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-amber-400"
          >
            <ShoppingCart size={16} />
            Buy Queue
          </a>
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
        <SummaryCard
          label="Buy Now"
          value={loading ? "..." : buyNowCount}
          tone="text-emerald-400"
        />

        <SummaryCard
          label="Actionable"
          value={loading ? "..." : summary.actionable_count ?? 0}
          tone="text-blue-400"
        />

        <SummaryCard
          label="Queued / Watched"
          value={loading ? "..." : summary.watchlist_count ?? 0}
          tone="text-amber-400"
        />

        <SummaryCard
          label="Suppressed"
          value={loading ? "..." : summary.suppressed_count ?? 0}
          tone="text-red-400"
        />
      </div>

      <section
        className={`rounded-2xl border p-5 ${getPriorityClass(topAlert)}`}
      >
        {loading ? (
          <div className="py-8 text-center text-slate-500">
            Loading best action...
          </div>
        ) : !topAlert ? (
          <div className="py-8 text-center text-slate-500">
            No action yet. Run a scan to find opportunities.
          </div>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-300">
                Do this next
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                {topAlert.icon_url ? (
                  <img
                    src={topAlert.icon_url}
                    alt={topAlert.name}
                    className="h-12 w-12 rounded-xl border border-slate-700 bg-slate-950"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-xl border border-slate-700 bg-slate-950" />
                )}

                <div>
                  <h3 className="text-2xl font-bold text-white">
                    {topAlert.name}
                  </h3>

                  <p className="mt-1 text-sm text-slate-400">
                    {topAlert.signal_label} - {topAlert.goldsmith_category}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge className={getDecisionClass(topAlert.final_decision)}>
                  <span className={getGradeClass(topAlert.decision_grade)}>
                    {topAlert.decision_grade}
                  </span>
                  {topAlert.final_decision}
                </Badge>

                <Badge className={getMemoryClass(topAlert.memory_price_state)}>
                  <Brain size={13} />
                  {topAlert.memory_price_state}
                </Badge>

                <Badge className="border-slate-700 bg-slate-950 text-slate-300">
                  <Target size={13} />
                  {topAlert.sale_speed}
                </Badge>
              </div>

              <p className="mt-4 max-w-3xl text-sm text-slate-300">
                {topAlert.decision_note || topAlert.signal_reason}
              </p>

              <p className="mt-2 max-w-3xl text-sm text-emerald-300">
                {topAlert.capital_note}
              </p>

              {topAlert.feedback_note && (
                <p className="mt-2 max-w-3xl text-sm text-blue-300">
                  {topAlert.feedback_note}
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => queueBuy(topAlert)}
                  disabled={queueingItem === topAlert.item_id}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-amber-400 disabled:opacity-60"
                >
                  <ShoppingCart size={16} />
                  Queue Buy
                </button>

                <a
                  href="/buy-queue"
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-800 bg-amber-950/40 px-4 py-2 text-sm font-semibold text-amber-300 transition hover:bg-amber-900/40"
                >
                  Open Buy Queue
                  <ArrowRight size={15} />
                </a>

                <a
                  href="/alerts"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
                >
                  Review Details
                  <ExternalLink size={15} />
                </a>
              </div>
            </div>

            <div className="grid min-w-[260px] grid-cols-2 gap-3 text-right">
              <Metric label="Buy Qty" value={topAlert.suggested_buy_quantity} />
              <Metric label="Max Each" value={formatGold(topAlert.suggested_buy_below)} />
              <Metric label="Max Spend" value={formatGold(topAlert.max_gold_exposure)} />
              <Metric label="Target" value={formatGold(topAlert.target_resale_price)} />
              <Metric label="Confidence" value={formatPercent(topAlert.signal_confidence)} />
              <Metric label="Decision" value={topAlert.decision_score.toFixed(1)} />
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-white">Best Actions</h3>
              <p className="mt-1 text-xs text-slate-500">
                Top queue-ready opportunities from GoldSmith.
              </p>
            </div>

            <a
              href="/alerts"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
            >
              Details
              <ExternalLink size={13} />
            </a>
          </div>

          {actions.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-center text-sm text-slate-500">
              No actions yet. Run a scan first.
            </div>
          ) : (
            <div className="space-y-3">
              {actions.slice(0, 5).map((action) => (
                <div
                  key={`${action.realm_id}-${action.item_id}`}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 gap-3">
                      {action.icon_url ? (
                        <img
                          src={action.icon_url}
                          alt={action.name}
                          className="h-10 w-10 rounded-lg border border-slate-700 bg-slate-950"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-lg border border-slate-700 bg-slate-950" />
                      )}

                      <div className="min-w-0">
                        <p className="font-semibold text-white">
                          {action.name}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {action.goldsmith_category} - {action.signal_label}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge className={getDecisionClass(action.final_decision)}>
                            <span className={getGradeClass(action.decision_grade)}>
                              {action.decision_grade}
                            </span>
                            {action.final_decision}
                          </Badge>

                          <Badge className={getMemoryClass(action.memory_price_state)}>
                            {action.memory_price_state}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-right text-xs">
                        <p className="text-slate-500">Buy below</p>
                        <p className="font-bold text-blue-400">
                          {formatGold(action.suggested_buy_below)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => queueBuy(action)}
                        disabled={queueingItem === action.item_id}
                        className="inline-flex items-center gap-2 rounded-lg border border-amber-800 bg-amber-950/40 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-900/40 disabled:opacity-60"
                      >
                        <ShoppingCart size={14} />
                        Queue
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
                    <MiniStat label="Qty" value={action.suggested_buy_quantity} />
                    <MiniStat label="Max Spend" value={formatGold(action.max_gold_exposure)} />
                    <MiniStat label="Target" value={formatGold(action.target_resale_price)} />
                    <MiniStat label="Score" value={action.decision_score.toFixed(1)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp size={17} className="text-emerald-400" />
            <h3 className="font-bold text-white">Market Health</h3>
          </div>

          <div className="space-y-3">
            <HealthRow label="Actionable" value={summary.actionable_count ?? 0} tone="text-emerald-400" />
            <HealthRow label="Auto Watch Ready" value={summary.auto_watch_ready_count ?? 0} tone="text-amber-400" />
            <HealthRow label="Watched" value={summary.watchlist_count ?? 0} tone="text-blue-400" />
            <HealthRow label="Memory Undervalued" value={summary.memory_undervalued_count ?? 0} tone="text-blue-400" />
            <HealthRow label="Suppressed" value={summary.suppressed_count ?? 0} tone="text-red-400" />

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <p className="text-xs text-slate-500">Latest capture</p>
              <p className="mt-1 font-semibold text-white">
                {formatDateTime(latestCapture)}
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles size={17} className="text-amber-400" />
            <h3 className="font-bold text-white">Category Focus</h3>
          </div>

          {categoryFocus.length === 0 ? (
            <p className="text-sm text-slate-500">No category focus yet.</p>
          ) : (
            <div className="space-y-3">
              {categoryFocus.slice(0, 5).map((focus, index) => {
                const name = focus.category ?? focus.name ?? "Unknown";
                const count =
                  focus.actionable_count ??
                  focus.alert_count ??
                  focus.count ??
                  0;
                const confidence =
                  focus.avg_confidence ??
                  focus.average_confidence ??
                  focus.confidence ??
                  0;

                return (
                  <div
                    key={`${name}-${index}`}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {focus.signal ?? focus.description ?? "Category opportunity"}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-bold text-emerald-400">
                          {count} actionable
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatPercent(confidence)} avg confidence
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center gap-2">
            <BellRing size={17} className="text-blue-400" />
            <h3 className="font-bold text-white">Watchlist Priority</h3>
          </div>

          {watchlistPriority.length === 0 ? (
            <p className="text-sm text-slate-500">
              No watched items yet. Queue buys or add items from Pro tools.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {watchlistPriority.slice(0, 4).map((item, index) => (
                <div
                  key={`${item.item_id ?? index}-${item.name ?? item.item_name}`}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                >
                  <p className="font-semibold text-white">
                    {item.name ?? item.item_name ?? "Unknown Item"}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {item.goldsmith_category ?? item.category ?? "Unknown"}
                  </p>

                  <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                    <span className="font-bold text-emerald-400">
                      {formatGold(item.current_price ?? item.price ?? 0)}
                    </span>

                    <span className="font-semibold text-amber-400">
                      {item.risk_level ?? "Risk"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
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
      <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
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
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-2">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  );
}

function HealthRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-xl font-bold ${tone}`}>{value}</span>
    </div>
  );
}

function Badge({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}
