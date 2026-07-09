import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Coins,
  EyeOff,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  Zap,
} from "lucide-react";

const API_BASE_URL = "http://127.0.0.1:8000/api";

type StrategyProfile = {
  id: string;
  label: string;
  description: string;
};

type PlanBuy = {
  item_id: number;
  realm_id: number;
  name: string;
  icon_url: string | null;
  quality: string | null;
  goldsmith_category: string;
  signal: string;
  signal_label: string;
  signal_reason: string;
  final_decision: string;
  decision_grade: string;
  decision_score: number;
  buy_pressure: string;
  position_size_label: string;
  suggested_buy_quantity: number;
  suggested_buy_below: number;
  target_resale_price: number;
  estimated_margin_percent: number;
  estimated_net_margin_percent?: number;
  max_gold_exposure: number;
  memory_price_state: string;
  capital_risk_label: string;
  decision_note: string;
  strategy_note?: string;
  plan_rank: number;
  plan_quantity: number;
  plan_max_price_each: number;
  plan_target_resale_price: number;
  plan_max_spend: number;
  plan_expected_net_profit: number;
  plan_expected_net_roi: number;
};

type GoldPlanResponse = {
  status: string;
  connected_realm_id: number;
  realm: string;
  strategy: StrategyProfile;
  plan_quality: string;
  recommended_spend: number;
  expected_net_profit: number;
  expected_net_roi: number;
  buy_count: number;
  available_buy_count: number;
  watch_count: number;
  avoid_count: number;
  ignored_count: number;
  already_queued_or_tracked_count: number;
  plan_action_hidden_count: number;
  skipped_today_count: number;
  snoozed_count: number;
  plan_ignored_count: number;
  max_per_category: number;
  capital_warning: string;
  plan_note: string;
  top_buys: PlanBuy[];
  error?: string;
};

type TodayGoldPlanProps = {
  realm: number;
};

type PlanAction = "skip-today" | "snooze" | "ignore";

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

function getQualityClass(quality: string) {
  switch (quality) {
    case "Excellent":
      return "border-emerald-700 bg-emerald-950/50 text-emerald-300";
    case "Good":
      return "border-emerald-800 bg-emerald-950/40 text-emerald-300";
    case "Cautious":
      return "border-amber-800 bg-amber-950/40 text-amber-300";
    case "Thin":
      return "border-orange-800 bg-orange-950/40 text-orange-300";
    case "No Plan":
      return "border-slate-700 bg-slate-950 text-slate-300";
    case "Error":
      return "border-red-800 bg-red-950/40 text-red-300";
    default:
      return "border-blue-800 bg-blue-950/40 text-blue-300";
  }
}

export default function TodayGoldPlan({ realm }: TodayGoldPlanProps) {
  const [plan, setPlan] = useState<GoldPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [queueingItem, setQueueingItem] = useState<number | null>(null);
  const [actingItem, setActingItem] = useState<number | null>(null);
  const [queueingAll, setQueueingAll] = useState(false);
  const [startingScan, setStartingScan] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const visibleBuys = useMemo(() => {
    return plan?.top_buys ?? [];
  }, [plan]);

  async function loadPlan() {
    try {
      setLoading(true);
      setError("");

      const response = await axios.get<GoldPlanResponse>(
        `${API_BASE_URL}/gold-plan/today?connected_realm_id=${realm}&limit=5&max_per_category=2`,
      );

      if (response.data.status !== "Success") {
        setError(response.data.error ?? "Unable to build today's gold plan.");
        setPlan(null);
        return;
      }

      setPlan(response.data);
    } catch {
      setError("Unable to load today's gold plan. Check backend is running.");
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }

  async function queueBuy(item: PlanBuy) {
    try {
      setQueueingItem(item.item_id);
      setMessage("");
      setError("");

      await axios.post(`${API_BASE_URL}/buy-queue/from-alert`, {
        item_id: item.item_id,
        realm_id: item.realm_id,
        item_name: item.name,
        category: item.goldsmith_category,
        icon_url: item.icon_url,
        quality: item.quality,
        decision_grade: item.decision_grade,
        final_decision: item.final_decision,
        decision_score: item.decision_score,
        buy_pressure: item.buy_pressure,
        position_size_label: item.position_size_label,
        signal: item.signal,
        memory_price_state: item.memory_price_state,
        suggested_quantity: item.plan_quantity,
        max_price_each: item.plan_max_price_each,
        target_sale_price_each: item.plan_target_resale_price,
        expected_margin_percent:
          item.estimated_net_margin_percent ?? item.estimated_margin_percent,
        reason: item.strategy_note || item.decision_note || item.signal_reason,
      });

      setMessage(`${item.name} added to Buy Queue.`);
      await loadPlan();
    } catch {
      setError("Unable to queue this buy.");
    } finally {
      setQueueingItem(null);
    }
  }

  async function queueAll() {
    if (!plan || plan.top_buys.length === 0) {
      setMessage("No fresh buy plan items to queue.");
      return;
    }

    try {
      setQueueingAll(true);
      setMessage("");
      setError("");

      const results = await Promise.allSettled(
        plan.top_buys.map((item) =>
          axios.post(`${API_BASE_URL}/buy-queue/from-alert`, {
            item_id: item.item_id,
            realm_id: item.realm_id,
            item_name: item.name,
            category: item.goldsmith_category,
            icon_url: item.icon_url,
            quality: item.quality,
            decision_grade: item.decision_grade,
            final_decision: item.final_decision,
            decision_score: item.decision_score,
            buy_pressure: item.buy_pressure,
            position_size_label: item.position_size_label,
            signal: item.signal,
            memory_price_state: item.memory_price_state,
            suggested_quantity: item.plan_quantity,
            max_price_each: item.plan_max_price_each,
            target_sale_price_each: item.plan_target_resale_price,
            expected_margin_percent:
              item.estimated_net_margin_percent ?? item.estimated_margin_percent,
            reason: item.strategy_note || item.decision_note || item.signal_reason,
          }),
        ),
      );

      const successful = results.filter((result) => result.status === "fulfilled").length;

      setMessage(`${successful} fresh plan item${successful === 1 ? "" : "s"} queued.`);
      await loadPlan();
    } catch {
      setError("Unable to queue the gold plan.");
    } finally {
      setQueueingAll(false);
    }
  }

  async function applyPlanAction(item: PlanBuy, action: PlanAction) {
    const endpoint =
      action === "skip-today"
        ? "skip-today"
        : action === "snooze"
          ? "snooze"
          : "ignore";

    const label =
      action === "skip-today"
        ? "skipped for today"
        : action === "snooze"
          ? "snoozed for 24 hours"
          : "hidden from future plans";

    try {
      setActingItem(item.item_id);
      setMessage("");
      setError("");

      await axios.post(`${API_BASE_URL}/plan-actions/${endpoint}`, {
        item_id: item.item_id,
        realm_id: item.realm_id,
        item_name: item.name,
        snooze_hours: 24,
        reason: "Actioned from Today's Gold Plan.",
      });

      setMessage(`${item.name} ${label}.`);
      await loadPlan();
    } catch {
      setError("Unable to update plan item.");
    } finally {
      setActingItem(null);
    }
  }

  async function runQuickScan() {
    try {
      setStartingScan(true);
      setMessage("");
      setError("");

      await axios.post(
        `${API_BASE_URL}/sync-jobs/start?connected_realm_id=${realm}&scan_mode=quick`,
      );

      setMessage("Quick Scan started. Gold Plan will update when sync finishes.");
    } catch {
      setError("Unable to start Quick Scan.");
    } finally {
      setStartingScan(false);
    }
  }

  useEffect(() => {
    loadPlan();
  }, [realm]);

  useEffect(() => {
    function handleRefresh() {
      loadPlan();
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
    <section className="rounded-2xl border border-amber-800/70 bg-slate-900 p-5 goldsmith-action-glow">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Coins size={22} className="text-amber-300" />
            <h3 className="text-xl font-bold text-white">Today's Gold Plan</h3>

            {plan && (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-bold ${getQualityClass(
                  plan.plan_quality,
                )}`}
              >
                <Sparkles size={13} />
                {plan.plan_quality}
              </span>
            )}
          </div>

          <p className="mt-1 text-sm text-slate-400">
            Fresh queue-ready buys. Use Skip, Snooze or Hide to move past items.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadPlan}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            onClick={runQuickScan}
            disabled={startingScan}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-900/40 disabled:opacity-60"
          >
            <Zap size={14} />
            Quick Scan
          </button>

          <button
            type="button"
            onClick={queueAll}
            disabled={queueingAll || !plan || plan.top_buys.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-black transition hover:bg-amber-400 disabled:opacity-60"
          >
            <ShoppingCart size={14} />
            Queue Plan
          </button>

          <a
            href="/buy-queue"
            className="inline-flex items-center gap-2 rounded-lg border border-amber-800 bg-amber-950/40 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-900/40"
          >
            Buy Queue
            <ArrowRight size={13} />
          </a>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 rounded-xl border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-300">
          {message}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-8 text-center text-sm text-slate-500">
          Building today's plan...
        </div>
      ) : !plan ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-8 text-center text-sm text-slate-500">
          No plan available yet.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-5">
            <PlanStat label="Strategy" value={plan.strategy.label} tone="text-blue-300" />
            <PlanStat label="Spend" value={formatGold(plan.recommended_spend)} tone="text-white" />
            <PlanStat
              label="Net Profit"
              value={formatGold(plan.expected_net_profit)}
              tone={plan.expected_net_profit >= 0 ? "text-emerald-400" : "text-red-400"}
            />
            <PlanStat
              label="Net ROI"
              value={formatPercent(plan.expected_net_roi)}
              tone={plan.expected_net_roi >= 0 ? "text-emerald-400" : "text-red-400"}
            />
            <PlanStat
              label="Fresh Buys"
              value={`${plan.buy_count} / ${plan.available_buy_count}`}
              tone="text-amber-300"
            />
          </div>

          {(plan.already_queued_or_tracked_count > 0 || plan.plan_action_hidden_count > 0) && (
            <div className="grid gap-3 md:grid-cols-4">
              <HiddenStat label="Queued / Tracked" value={plan.already_queued_or_tracked_count} />
              <HiddenStat label="Skipped Today" value={plan.skipped_today_count} />
              <HiddenStat label="Snoozed" value={plan.snoozed_count} />
              <HiddenStat label="Hidden" value={plan.plan_ignored_count} />
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex items-start gap-3">
              {plan.buy_count > 0 ? (
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-400" />
              )}

              <div>
                <p className="font-semibold text-white">{plan.plan_note}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {plan.capital_warning}
                </p>
              </div>
            </div>
          </div>

          {visibleBuys.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
              <div className="border-b border-slate-800 px-4 py-3">
                <p className="font-bold text-white">Buy Order</p>
              </div>

              <div className="divide-y divide-slate-800">
                {visibleBuys.map((item) => (
                  <div
                    key={`${item.realm_id}-${item.item_id}`}
                    className="grid gap-3 p-4 xl:grid-cols-[minmax(260px,1fr)_110px_120px_120px_310px]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-800 bg-amber-950/40 text-sm font-bold text-amber-300">
                        {item.plan_rank}
                      </div>

                      {item.icon_url ? (
                        <img
                          src={item.icon_url}
                          alt={item.name}
                          className="h-9 w-9 rounded-lg border border-slate-700 bg-slate-950"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-lg border border-slate-700 bg-slate-950" />
                      )}

                      <div className="min-w-0">
                        <p className="truncate font-bold text-white">{item.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.goldsmith_category} - {item.decision_grade} {item.final_decision}
                        </p>
                      </div>
                    </div>

                    <CompactMetric label="Qty" value={item.plan_quantity} />
                    <CompactMetric label="Max Each" value={formatGold(item.plan_max_price_each)} />
                    <CompactMetric label="Net Profit" value={formatGold(item.plan_expected_net_profit)} />

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => queueBuy(item)}
                        disabled={queueingItem === item.item_id || actingItem === item.item_id}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-800 bg-amber-950/40 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-900/40 disabled:opacity-60"
                      >
                        <ShoppingCart size={14} />
                        Queue
                      </button>

                      <button
                        type="button"
                        onClick={() => applyPlanAction(item, "skip-today")}
                        disabled={actingItem === item.item_id}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-60"
                      >
                        Skip
                      </button>

                      <button
                        type="button"
                        onClick={() => applyPlanAction(item, "snooze")}
                        disabled={actingItem === item.item_id}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-800 bg-blue-950/40 px-3 py-2 text-xs font-semibold text-blue-300 transition hover:bg-blue-900/40 disabled:opacity-60"
                      >
                        <Clock3 size={13} />
                        24h
                      </button>

                      <button
                        type="button"
                        onClick={() => applyPlanAction(item, "ignore")}
                        disabled={actingItem === item.item_id}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-900/40 disabled:opacity-60"
                      >
                        <EyeOff size={13} />
                        Hide
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-center text-sm text-slate-500">
              No fresh buys for the active strategy. Queue is clear, items are hidden, or the current market is thin.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PlanStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-2 text-xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function HiddenStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-blue-800 bg-blue-950/20 p-3">
      <p className="text-xs text-blue-300">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function CompactMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-right">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-white">{value}</p>
    </div>
  );
}
