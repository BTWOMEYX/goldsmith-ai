import { useEffect, useState } from "react";
import axios from "axios";
import {
  Brain,
  Gauge,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import RealmSelect from "../components/RealmSelect";
import { getGlobalRealmId } from "../utils/globalRealm";

type FeedbackSummary = {
  total_trade_count: number;
  open_trade_count: number;
  sold_trade_count: number;
  total_sold_cost: number;
  realized_profit: number;
  roi_percent: number;
  win_rate_percent: number;
  avg_hold_hours: number | null;
  feedback_readiness: string;
  readiness_note: string;
};

type FeedbackInsight = {
  tone: string;
  title: string;
  message: string;
  score_adjustment: number;
};

type FeedbackRow = {
  group_type: string;
  name: string;
  trade_count: number;
  sold_count: number;
  win_count: number;
  loss_count: number;
  total_cost: number;
  realized_profit: number;
  roi_percent: number;
  win_rate_percent: number;
  avg_profit_per_trade: number;
  avg_hold_hours: number | null;
  feedback_label: string;
  score_adjustment: number;
  recommendation: string;
};

type FeedbackResponse = {
  status: string;
  connected_realm_id: number | null;
  summary: FeedbackSummary;
  insights: FeedbackInsight[];
  strongest_groups: FeedbackRow[];
  weakest_groups: FeedbackRow[];
  by_category: FeedbackRow[];
  by_signal: FeedbackRow[];
  by_decision: FeedbackRow[];
  by_memory_state: FeedbackRow[];
  by_grade: FeedbackRow[];
  error?: string;
};

const API_BASE_URL = "http://127.0.0.1:8000/api";

const EMPTY_SUMMARY: FeedbackSummary = {
  total_trade_count: 0,
  open_trade_count: 0,
  sold_trade_count: 0,
  total_sold_cost: 0,
  realized_profit: 0,
  roi_percent: 0,
  win_rate_percent: 0,
  avg_hold_hours: null,
  feedback_readiness: "Learning",
  readiness_note: "No performance data yet.",
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

function formatHours(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  if (value < 24) {
    return `${value.toFixed(1)}h`;
  }

  return `${(value / 24).toFixed(1)}d`;
}

function getFeedbackClass(label: string) {
  switch (label) {
    case "Boost":
      return "border-emerald-700 bg-emerald-950/50 text-emerald-300";
    case "Positive":
      return "border-emerald-800 bg-emerald-950/40 text-emerald-300";
    case "Neutral":
      return "border-slate-700 bg-slate-950 text-slate-300";
    case "Caution":
      return "border-amber-800 bg-amber-950/40 text-amber-300";
    case "Penalty":
      return "border-red-800 bg-red-950/40 text-red-300";
    case "Learning":
      return "border-blue-800 bg-blue-950/40 text-blue-300";
    default:
      return "border-slate-700 bg-slate-950 text-slate-300";
  }
}

function getInsightClass(tone: string) {
  switch (tone) {
    case "positive":
      return "border-emerald-800 bg-emerald-950/30";
    case "negative":
      return "border-red-800 bg-red-950/30";
    default:
      return "border-slate-800 bg-slate-900";
  }
}

export default function PerformanceFeedback() {
  const [realm, setRealm] = useState(() => getGlobalRealmId());
  const [summary, setSummary] = useState<FeedbackSummary>(EMPTY_SUMMARY);
  const [insights, setInsights] = useState<FeedbackInsight[]>([]);
  const [strongestGroups, setStrongestGroups] = useState<FeedbackRow[]>([]);
  const [weakestGroups, setWeakestGroups] = useState<FeedbackRow[]>([]);
  const [categoryRows, setCategoryRows] = useState<FeedbackRow[]>([]);
  const [signalRows, setSignalRows] = useState<FeedbackRow[]>([]);
  const [decisionRows, setDecisionRows] = useState<FeedbackRow[]>([]);
  const [memoryRows, setMemoryRows] = useState<FeedbackRow[]>([]);
  const [gradeRows, setGradeRows] = useState<FeedbackRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadFeedback() {
    try {
      setLoading(true);
      setError("");

      const response = await axios.get<FeedbackResponse>(
        `${API_BASE_URL}/performance-feedback/summary?connected_realm_id=${realm}`,
      );

      if (response.data.status !== "Success") {
        setError(response.data.error ?? "Unable to load performance feedback.");
        setSummary(EMPTY_SUMMARY);
        setInsights([]);
        setStrongestGroups([]);
        setWeakestGroups([]);
        setCategoryRows([]);
        setSignalRows([]);
        setDecisionRows([]);
        setMemoryRows([]);
        setGradeRows([]);
        return;
      }

      setSummary(response.data.summary);
      setInsights(response.data.insights);
      setStrongestGroups(response.data.strongest_groups);
      setWeakestGroups(response.data.weakest_groups);
      setCategoryRows(response.data.by_category);
      setSignalRows(response.data.by_signal);
      setDecisionRows(response.data.by_decision);
      setMemoryRows(response.data.by_memory_state);
      setGradeRows(response.data.by_grade);
    } catch {
      setError("Unable to load performance feedback. Check backend is running.");
      setSummary(EMPTY_SUMMARY);
      setInsights([]);
      setStrongestGroups([]);
      setWeakestGroups([]);
      setCategoryRows([]);
      setSignalRows([]);
      setDecisionRows([]);
      setMemoryRows([]);
      setGradeRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFeedback();
  }, [realm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Brain size={24} className="text-blue-400" />
            <h2 className="text-2xl font-bold text-white">
              Performance Feedback
            </h2>
          </div>

          <p className="mt-1 text-sm text-slate-400">
            See which GoldSmith decisions, signals, categories and memory states
            are actually making gold.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <RealmSelect value={realm} onChange={setRealm} />

          <button
            type="button"
            onClick={loadFeedback}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-60"
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

      <div className="grid gap-4 md:grid-cols-6">
        <SummaryCard label="Sold Trades" value={summary.sold_trade_count} />
        <SummaryCard label="Open Trades" value={summary.open_trade_count} />
        <SummaryCard
          label="Realised Profit"
          value={formatGold(summary.realized_profit)}
          positive={summary.realized_profit >= 0}
        />
        <SummaryCard
          label="ROI"
          value={formatPercent(summary.roi_percent)}
          positive={summary.roi_percent >= 0}
        />
        <SummaryCard
          label="Win Rate"
          value={formatPercent(summary.win_rate_percent)}
        />
        <SummaryCard
          label="Avg Hold"
          value={formatHours(summary.avg_hold_hours)}
        />
      </div>

      <div className="rounded-2xl border border-blue-800 bg-blue-950/20 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-300">
              Feedback Readiness
            </p>

            <h3 className="mt-1 text-xl font-bold text-white">
              {summary.feedback_readiness}
            </h3>

            <p className="mt-1 text-sm text-slate-300">
              {summary.readiness_note}
            </p>
          </div>

          <Gauge size={34} className="text-blue-300" />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {insights.map((insight) => (
          <div
            key={`${insight.title}-${insight.score_adjustment}`}
            className={`rounded-xl border p-5 ${getInsightClass(insight.tone)}`}
          >
            <div className="flex items-start gap-3">
              {insight.tone === "positive" ? (
                <TrendingUp size={20} className="mt-1 text-emerald-400" />
              ) : insight.tone === "negative" ? (
                <TrendingDown size={20} className="mt-1 text-red-400" />
              ) : (
                <ShieldAlert size={20} className="mt-1 text-slate-400" />
              )}

              <div>
                <h3 className="font-bold text-white">{insight.title}</h3>
                <p className="mt-1 text-sm text-slate-300">
                  {insight.message}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  Score adjustment: {insight.score_adjustment > 0 ? "+" : ""}
                  {insight.score_adjustment}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <FeedbackTable title="Strongest Patterns" rows={strongestGroups} />
        <FeedbackTable title="Weakest Patterns" rows={weakestGroups} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <FeedbackTable title="By Category" rows={categoryRows} />
        <FeedbackTable title="By Signal" rows={signalRows} />
        <FeedbackTable title="By Decision" rows={decisionRows} />
        <FeedbackTable title="By Memory State" rows={memoryRows} />
        <FeedbackTable title="By Grade" rows={gradeRows} />
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  positive,
}: {
  label: string;
  value: string | number;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs text-slate-500">{label}</p>

      <p
        className={[
          "mt-2 text-2xl font-bold",
          positive === undefined
            ? "text-white"
            : positive
              ? "text-emerald-400"
              : "text-red-400",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

function FeedbackTable({
  title,
  rows,
}: {
  title: string;
  rows: FeedbackRow[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 p-4">
        <h3 className="font-bold text-white">{title}</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-950 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Pattern</th>
              <th className="px-4 py-3">Feedback</th>
              <th className="px-4 py-3">Sold</th>
              <th className="px-4 py-3">Profit</th>
              <th className="px-4 py-3">ROI</th>
              <th className="px-4 py-3">Win</th>
              <th className="px-3 py-3">Hold</th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No sold trade data yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={`${row.group_type}-${row.name}`}
                  className="border-b border-slate-800/70 transition hover:bg-slate-800/40"
                >
                  <td className="px-4 py-4">
                    <p className="font-semibold text-white">{row.name}</p>

                    <p className="mt-1 text-xs text-slate-500">
                      {row.group_type}
                    </p>
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${getFeedbackClass(
                        row.feedback_label,
                      )}`}
                    >
                      {row.feedback_label}{" "}
                      {row.score_adjustment > 0
                        ? `+${row.score_adjustment}`
                        : row.score_adjustment}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-slate-300">
                    {row.sold_count}
                  </td>

                  <td
                    className={[
                      "px-4 py-4 font-semibold",
                      row.realized_profit >= 0
                        ? "text-emerald-400"
                        : "text-red-400",
                    ].join(" ")}
                  >
                    {formatGold(row.realized_profit)}
                  </td>

                  <td
                    className={[
                      "px-4 py-4 font-semibold",
                      row.roi_percent >= 0
                        ? "text-emerald-400"
                        : "text-red-400",
                    ].join(" ")}
                  >
                    {formatPercent(row.roi_percent)}
                  </td>

                  <td className="px-4 py-4 text-blue-400">
                    {formatPercent(row.win_rate_percent)}
                  </td>

                  <td className="px-3 py-4 text-slate-400">
                    {formatHours(row.avg_hold_hours)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
