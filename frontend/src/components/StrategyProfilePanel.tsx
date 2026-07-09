import { useEffect, useState } from "react";
import axios from "axios";
import { Brain, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";

const API_BASE_URL = "http://127.0.0.1:8000/api";
const STRATEGY_CHANGED_EVENT = "goldsmith-strategy-changed";

type StrategyProfile = {
  id: string;
  label: string;
  description: string;
  min_decision_score: number;
  allowed_risks: string[];
  allowed_sale_speeds: string[];
  allowed_categories: string[];
  quantity_multiplier: number;
  max_quantity: number;
  max_exposure: number;
  min_margin_percent: number;
  min_memory_score: number;
  allow_learning_memory: boolean;
  allow_volatile_memory: boolean;
  feedback_multiplier: number;
  score_bias: number;
};

type StrategyResponse = {
  status: string;
  active_profile: StrategyProfile;
  profiles: StrategyProfile[];
  error?: string;
};

function formatGold(value: number) {
  return `${Math.round(value).toLocaleString()}g`;
}

export default function StrategyProfilePanel() {
  const [activeProfile, setActiveProfile] = useState<StrategyProfile | null>(null);
  const [profiles, setProfiles] = useState<StrategyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadStrategy() {
    try {
      setLoading(true);
      setError("");

      const response = await axios.get<StrategyResponse>(
        `${API_BASE_URL}/strategy/status`,
      );

      if (response.data.status !== "Success") {
        setError(response.data.error ?? "Unable to load strategy profiles.");
        return;
      }

      setActiveProfile(response.data.active_profile);
      setProfiles(response.data.profiles);
    } catch {
      setError("Unable to load strategy profiles. Check backend is running.");
    } finally {
      setLoading(false);
    }
  }

  async function changeStrategy(profileId: string) {
    try {
      setSavingProfileId(profileId);
      setError("");
      setMessage("");

      const response = await axios.post<StrategyResponse>(
        `${API_BASE_URL}/strategy/settings`,
        {
          profile_id: profileId,
        },
      );

      if (response.data.status !== "Success") {
        setError(response.data.error ?? "Unable to update strategy profile.");
        return;
      }

      setActiveProfile(response.data.active_profile);
      setProfiles(response.data.profiles);
      setMessage(`Strategy changed to ${response.data.active_profile.label}.`);

      window.dispatchEvent(
        new CustomEvent(STRATEGY_CHANGED_EVENT, {
          detail: {
            profileId: response.data.active_profile.id,
          },
        }),
      );
    } catch {
      setError("Unable to update strategy profile.");
    } finally {
      setSavingProfileId(null);
    }
  }

  useEffect(() => {
    loadStrategy();
  }, []);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Brain size={20} className="text-blue-400" />
            <h3 className="text-lg font-bold text-white">Strategy Profile</h3>
          </div>

          <p className="mt-1 text-sm text-slate-400">
            Choose how GoldSmith should judge opportunities and control risk.
          </p>
        </div>

        <button
          type="button"
          onClick={loadStrategy}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-60"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
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

      {activeProfile && (
        <div className="mb-5 rounded-xl border border-blue-800 bg-blue-950/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-300">
                Active Strategy
              </p>

              <h4 className="mt-1 text-xl font-bold text-white">
                {activeProfile.label}
              </h4>

              <p className="mt-1 text-sm text-slate-300">
                {activeProfile.description}
              </p>
            </div>

            <ShieldCheck size={32} className="text-blue-300" />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <MiniStat label="Min Score" value={activeProfile.min_decision_score} />
            <MiniStat label="Max Qty" value={activeProfile.max_quantity} />
            <MiniStat label="Max Exposure" value={formatGold(activeProfile.max_exposure)} />
            <MiniStat label="Min Net Margin" value={`${activeProfile.min_margin_percent}%`} />
          </div>
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-3">
        {profiles.map((profile) => {
          const isActive = activeProfile?.id === profile.id;

          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => changeStrategy(profile.id)}
              disabled={savingProfileId !== null || isActive}
              className={[
                "rounded-xl border p-4 text-left transition disabled:cursor-default",
                isActive
                  ? "border-amber-700 bg-amber-950/30"
                  : "border-slate-800 bg-slate-950 hover:border-slate-600 hover:bg-slate-900",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-white">{profile.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    {profile.description}
                  </p>
                </div>

                {isActive && (
                  <CheckCircle2 size={18} className="shrink-0 text-amber-300" />
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <span className="rounded-lg bg-slate-900 px-2 py-1 text-slate-400">
                  Score {profile.min_decision_score}+
                </span>
                <span className="rounded-lg bg-slate-900 px-2 py-1 text-slate-400">
                  Qty {profile.max_quantity}
                </span>
                <span className="rounded-lg bg-slate-900 px-2 py-1 text-slate-400">
                  {formatGold(profile.max_exposure)}
                </span>
                <span className="rounded-lg bg-slate-900 px-2 py-1 text-slate-400">
                  Net {profile.min_margin_percent}%
                </span>
              </div>
            </button>
          );
        })}
      </div>
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
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-white">{value}</p>
    </div>
  );
}
