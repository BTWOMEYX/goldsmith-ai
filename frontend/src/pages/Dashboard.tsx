import { useEffect, useState } from "react";
import axios from "axios";
import {
  Compass,
  ExternalLink,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";

import TodayGoldPlan from "../components/TodayGoldPlan";
import { getGlobalRealmId, listenForGlobalRealmChange } from "../utils/globalRealm";

const API_BASE_URL = "http://127.0.0.1:8000/api";

type ActionCenterSummary = {
  actionable_count?: number;
  auto_watch_ready_count?: number;
  watchlist_count?: number;
  suppressed_count?: number;
  memory_undervalued_count?: number;
};

type ActionCenterResponse = {
  status: string;
  summary: ActionCenterSummary;
  error?: string;
};

export default function Dashboard() {
  const [realm, setRealm] = useState(() => getGlobalRealmId());
  const [summary, setSummary] = useState<ActionCenterSummary>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadActionCenter() {
    try {
      setLoading(true);
      setError("");

      const response = await axios.get<ActionCenterResponse>(
        `${API_BASE_URL}/action-center?connected_realm_id=${realm}`,
      );

      if (response.data.status !== "Success") {
        setError(response.data.error ?? "Unable to load Action Center.");
        setSummary({});
        return;
      }

      setSummary(response.data.summary ?? {});
    } catch {
      setError("Unable to load Action Center. Check backend is running.");
      setSummary({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActionCenter();
  }, [realm]);

  useEffect(() => {
    return listenForGlobalRealmChange((realmId) => {
      setRealm(realmId);
    });
  }, []);

  useEffect(() => {
    function handleSyncComplete() {
      loadActionCenter();
    }

    window.addEventListener("goldsmith-sync-complete", handleSyncComplete);
    window.addEventListener("goldsmith-strategy-changed", handleSyncComplete);

    return () => {
      window.removeEventListener("goldsmith-sync-complete", handleSyncComplete);
      window.removeEventListener("goldsmith-strategy-changed", handleSyncComplete);
    };
  }, [realm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Compass size={23} className="text-amber-400" />
            <h2 className="text-2xl font-bold text-white">Action Center</h2>
          </div>

          <p className="mt-1 text-sm text-slate-400">
            Simple command page. Build the plan, queue buys, execute manually, then track profit.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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

      <TodayGoldPlan realm={realm} />

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp size={17} className="text-emerald-400" />
          <h3 className="font-bold text-white">Market Snapshot</h3>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <MiniStat
            label="Actionable"
            value={loading ? "..." : summary.actionable_count ?? 0}
            tone="text-emerald-400"
          />
          <MiniStat
            label="Auto Watch Ready"
            value={loading ? "..." : summary.auto_watch_ready_count ?? 0}
            tone="text-amber-400"
          />
          <MiniStat
            label="Watched"
            value={loading ? "..." : summary.watchlist_count ?? 0}
            tone="text-blue-400"
          />
          <MiniStat
            label="Memory Undervalued"
            value={loading ? "..." : summary.memory_undervalued_count ?? 0}
            tone="text-blue-400"
          />
          <MiniStat
            label="Suppressed"
            value={loading ? "..." : summary.suppressed_count ?? 0}
            tone="text-red-400"
          />
        </div>
      </section>
    </div>
  );
}

function MiniStat({
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
