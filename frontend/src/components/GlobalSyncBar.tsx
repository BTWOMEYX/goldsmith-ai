import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import RealmSelect from "./RealmSelect";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Database,
  RefreshCw,
  Zap,
} from "lucide-react";

const API_BASE_URL = "http://127.0.0.1:8000/api";

type UiMode = "simple" | "pro";
type ScanMode = "quick" | "full";

type StrategyProfile = {
  id: string;
  label: string;
  description: string;
};

type StrategyResponse = {
  status: string;
  active_profile: StrategyProfile;
  profiles: StrategyProfile[];
  error?: string;
};

type SyncJob = {
  job_id?: string;
  scan_mode?: string;
  status?: string;
  phase?: string;
  phase_label?: string;
  progress?: number;
  progress_percent?: number;
  message?: string;
  error?: string | null;
  stats?: Record<string, unknown>;
  result?: Record<string, unknown>;
};

const UI_MODE_KEY = "goldsmith.uiMode";
const REALM_KEY = "goldsmith.defaultRealm";
const GOLDSMITH_REALM_CHANGED_EVENT = "goldsmith-realm-changed";
const LAST_SYNC_KEY = "goldsmith.lastSync";
const STRATEGY_CHANGED_EVENT = "goldsmith-strategy-changed";
const EXPANDED_KEY = "goldsmith.globalSyncExpanded";

function readUiMode(): UiMode {
  const stored = localStorage.getItem(UI_MODE_KEY);

  if (stored === "simple" || stored === "pro") {
    return stored;
  }

  return "simple";
}

function readRealmId() {
  const stored = Number(localStorage.getItem(REALM_KEY));

  if (Number.isFinite(stored) && stored > 0) {
    return stored;
  }

  return 11;
}

function readExpanded() {
  const stored = localStorage.getItem(EXPANDED_KEY);

  if (stored === "true") {
    return true;
  }

  if (stored === "false") {
    return false;
  }

  return readUiMode() === "pro";
}

function getJobFromResponse(data: any): SyncJob | null {
  return data?.job ?? data?.active_job ?? data?.sync_job ?? null;
}

function getJobStatus(job: SyncJob | null) {
  return String(job?.status ?? "").toLowerCase();
}

function getProgress(job: SyncJob | null) {
  const raw = Number(job?.progress_percent ?? job?.progress ?? 0);

  if (!Number.isFinite(raw)) {
    return 0;
  }

  return Math.max(0, Math.min(raw, 100));
}

function getJobStats(job: SyncJob | null) {
  return {
    ...(job?.result ?? {}),
    ...(job?.stats ?? {}),
  } as Record<string, unknown>;
}

function getStat(job: SyncJob | null, key: string) {
  const stats = getJobStats(job);
  const value = Number(stats[key] ?? 0);

  if (!Number.isFinite(value)) {
    return 0;
  }

  return value;
}

function formatNumber(value: number) {
  return value.toLocaleString();
}

function isJobRunning(job: SyncJob | null) {
  if (!job) {
    return false;
  }

  const status = getJobStatus(job);

  return !["complete", "completed", "failed", "error", "cancelled"].includes(
    status,
  );
}

function getPhaseText(job: SyncJob | null) {
  if (!job) {
    return "Ready";
  }

  return (
    job.message ||
    job.phase_label ||
    job.phase ||
    (isJobRunning(job) ? "Sync running" : "Ready")
  );
}

export default function GlobalSyncBar() {
  const [uiMode, setUiMode] = useState<UiMode>(() => readUiMode());
  const [realmId, setRealmId] = useState(() => readRealmId());
  const [expanded, setExpandedState] = useState(() => readExpanded());
  const [job, setJob] = useState<SyncJob | null>(null);
  const [autoPilotEnabled, setAutoPilotEnabled] = useState(false);
  const [strategyProfile, setStrategyProfile] = useState<StrategyProfile | null>(null);
  const [strategyProfiles, setStrategyProfiles] = useState<StrategyProfile[]>([]);
  const [lastSyncLabel, setLastSyncLabel] = useState("Never");
  const [error, setError] = useState("");
  const [startingMode, setStartingMode] = useState<ScanMode | null>(null);

  const running = isJobRunning(job);
  const progress = getProgress(job);
  const jobStatus = getJobStatus(job);
  const phaseText = getPhaseText(job);

  const stats = useMemo(() => {
    const captures =
      getStat(job, "market_snapshots_saved") || getStat(job, "snapshots_saved");

    const opportunities =
      getStat(job, "opportunities_unlocked") ||
      getStat(job, "candidates_found") ||
      getStat(job, "alert_count");

    return [
      {
        label: "Auctions",
        value: formatNumber(getStat(job, "auctions_downloaded")),
        tone: "text-white",
      },
      {
        label: "Items",
        value: formatNumber(getStat(job, "items_scanned")),
        tone: "text-blue-400",
      },
      {
        label: "Captures",
        value: formatNumber(captures),
        tone: "text-fuchsia-400",
      },
      {
        label: "Opportunities",
        value: formatNumber(opportunities),
        tone: "text-emerald-400",
      },
      {
        label: "Suppressed / Watched",
        value: `${formatNumber(getStat(job, "ignored_count"))} / ${formatNumber(
          getStat(job, "auto_watch_added"),
        )}`,
        tone: "text-amber-400",
      },
      {
        label: "Status",
        value: running ? "Running" : error ? "Error" : "Ready",
        tone: error ? "text-red-400" : running ? "text-emerald-400" : "text-emerald-400",
      },
    ];
  }, [job, running, error]);

  function setExpanded(next: boolean) {
    localStorage.setItem(EXPANDED_KEY, String(next));
    setExpandedState(next);
  }

  function loadLastSyncLabel() {
    const raw = localStorage.getItem(LAST_SYNC_KEY);

    if (!raw) {
      setLastSyncLabel("Never");
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const value = parsed.completed_at ?? parsed.time ?? parsed.timestamp;

      if (!value) {
        setLastSyncLabel("Recently");
        return;
      }

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        setLastSyncLabel("Recently");
        return;
      }

      setLastSyncLabel(
        date.toLocaleString([], {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    } catch {
      setLastSyncLabel("Recently");
    }
  }


  async function loadStrategy() {
    try {
      const response = await axios.get<StrategyResponse>(
        `${API_BASE_URL}/strategy/status`,
      );

      if (response.data.status === "Success") {
        setStrategyProfile(response.data.active_profile);
        setStrategyProfiles(response.data.profiles);
      }
    } catch {
      setStrategyProfile(null);
      setStrategyProfiles([]);
    }
  }

  async function changeStrategy(profileId: string) {
    try {
      const response = await axios.post<StrategyResponse>(
        `${API_BASE_URL}/strategy/settings`,
        {
          profile_id: profileId,
        },
      );

      if (response.data.status === "Success") {
        setStrategyProfile(response.data.active_profile);
        setStrategyProfiles(response.data.profiles);

        window.dispatchEvent(
          new CustomEvent(STRATEGY_CHANGED_EVENT, {
            detail: {
              profileId: response.data.active_profile.id,
            },
          }),
        );

        window.dispatchEvent(new CustomEvent("goldsmith-sync-complete"));
      }
    } catch {
      // Keep the sync bar quiet if strategy API is unavailable.
    }
  }

  async function loadAutoPilot() {
    try {
      const response = await axios.get(`${API_BASE_URL}/autopilot/status`);
      const state = response.data?.state ?? response.data;

      setAutoPilotEnabled(Boolean(state?.enabled));
    } catch {
      setAutoPilotEnabled(false);
    }
  }

  async function reconnectActiveJob() {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/sync-jobs/active?connected_realm_id=${realmId}`,
      );

      const activeJob = getJobFromResponse(response.data);

      if (activeJob && isJobRunning(activeJob)) {
        setJob(activeJob);
      }
    } catch {
      // Keep the bar quiet if the backend is not available yet.
    }
  }

  async function pollJob(jobId: string) {
    try {
      const response = await axios.get(`${API_BASE_URL}/sync-jobs/${jobId}`);
      const freshJob = getJobFromResponse(response.data);

      if (!freshJob) {
        return;
      }

      setJob(freshJob);

      if (!isJobRunning(freshJob)) {
        const status = getJobStatus(freshJob);

        if (status === "failed" || status === "error") {
          setError(String(freshJob.error ?? "Sync failed."));
        } else {
          localStorage.setItem(
            LAST_SYNC_KEY,
            JSON.stringify({
              completed_at: new Date().toISOString(),
              scan_mode: freshJob.scan_mode,
              result: freshJob.result ?? freshJob.stats ?? {},
            }),
          );

          loadLastSyncLabel();
          window.dispatchEvent(new CustomEvent("goldsmith-sync-complete"));
        }
      }
    } catch {
      setError("Unable to read backend sync job.");
    }
  }

  async function startSync(scanMode: ScanMode) {
    try {
      setStartingMode(scanMode);
      setError("");
      setExpanded(true);

      const response = await axios.post(
        `${API_BASE_URL}/sync-jobs/start?connected_realm_id=${realmId}&scan_mode=${scanMode}`,
      );

      const startedJob = getJobFromResponse(response.data);

      if (!startedJob) {
        setError("Backend did not return a sync job.");
        return;
      }

      setJob(startedJob);
    } catch {
      setError("Unable to start backend sync job.");
    } finally {
      setStartingMode(null);
    }
  }

  useEffect(() => {
    loadLastSyncLabel();
    loadAutoPilot();
    loadStrategy();
    reconnectActiveJob();

    const interval = window.setInterval(() => {
      const latestMode = readUiMode();
      const latestRealm = readRealmId();

      setUiMode(latestMode);
      setRealmId(latestRealm);
      loadLastSyncLabel();
      loadAutoPilot();
      loadStrategy();

      if (!running) {
        reconnectActiveJob();
      }
    }, 5000);

    function handleModeChange() {
      setUiMode(readUiMode());
    }

    function handleRealmChanged(event: Event) {
      const customEvent = event as CustomEvent<{ realmId?: number }>;
      const eventRealmId = Number(customEvent.detail?.realmId);

      if (Number.isFinite(eventRealmId) && eventRealmId > 0) {
        setRealmId(eventRealmId);
        setJob(null);
        reconnectActiveJob();
      }
    }

    function handleStrategyChanged() {
      loadStrategy();
    }

    window.addEventListener("goldsmith-ui-mode-changed", handleModeChange);
    window.addEventListener(GOLDSMITH_REALM_CHANGED_EVENT, handleRealmChanged);
    window.addEventListener(STRATEGY_CHANGED_EVENT, handleStrategyChanged);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("goldsmith-ui-mode-changed", handleModeChange);
      window.removeEventListener(GOLDSMITH_REALM_CHANGED_EVENT, handleRealmChanged);
      window.removeEventListener(STRATEGY_CHANGED_EVENT, handleStrategyChanged);
    };
  }, [realmId, running]);

  useEffect(() => {
    if (!job?.job_id || !running) {
      return;
    }

    const interval = window.setInterval(() => {
      pollJob(String(job.job_id));
    }, 1200);

    return () => window.clearInterval(interval);
  }, [job?.job_id, running]);

  const compact = !expanded || uiMode === "simple";

  return (
    <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-lg shadow-black/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-800 bg-amber-950/40 text-amber-300">
              <Database size={17} />
            </div>

            <p className="font-bold text-white">Global Sync</p>

            <span className="rounded-full border border-blue-800 bg-blue-950/40 px-2 py-1 text-[11px] font-bold text-blue-300">
              Backend Job Engine
            </span>

            <span
              className={[
                "rounded-full border px-2 py-1 text-[11px] font-bold",
                autoPilotEnabled
                  ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
                  : "border-slate-700 bg-slate-950 text-slate-400",
              ].join(" ")}
            >
              {autoPilotEnabled ? "Auto Watch Active" : "Auto Watch Off"}
            </span>

            {strategyProfile && (
              <span className="rounded-full border border-blue-800 bg-blue-950/40 px-2 py-1 text-[11px] font-bold text-blue-300">
                Strategy: {strategyProfile.label}
              </span>
            )}

            {running && (
              <span className="rounded-full border border-emerald-800 bg-emerald-950/40 px-2 py-1 text-[11px] font-bold text-emerald-300">
                {Math.round(progress)}%
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Global realm {realmId}</span>
            <span>-</span>
            <span>Last scan: {lastSyncLabel}</span>
            <span>-</span>
            <span className={running ? "text-emerald-300" : "text-slate-400"}>
              {phaseText}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <RealmSelect
            master
            value={realmId}
            onChange={(nextRealmId) => {
              setRealmId(nextRealmId);
              setJob(null);
            }}
          />

          {strategyProfiles.length > 0 && (
            <select
              value={strategyProfile?.id ?? "balanced"}
              onChange={(event) => changeStrategy(event.target.value)}
              title="Active GoldSmith strategy profile"
              className="min-w-[190px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-white outline-none transition focus:border-blue-500"
            >
              {strategyProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => startSync("quick")}
            disabled={running || startingMode !== null}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Zap size={14} />
            Quick Scan
          </button>

          <button
            type="button"
            onClick={() => startSync("full")}
            disabled={running || startingMode !== null}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Activity size={14} />
            Full Scan
          </button>

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? "Compact" : "Details"}
          </button>
        </div>
      </div>

      {running && (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>{phaseText}</span>
            <span>{Math.round(progress)}%</span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-slate-950">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-800 bg-red-950/40 p-3 text-xs text-red-300">
          <AlertTriangle size={15} />
          {error}
        </div>
      )}

      {!compact && (
        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-slate-800 bg-slate-950 p-3"
            >
              <p className="text-[11px] text-slate-500">{stat.label}</p>
              <p className={`mt-1 text-lg font-bold ${stat.tone}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {compact && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 size={13} className="text-emerald-400" />
            {running ? "Sync running" : "Ready"}
          </span>

          <span className="inline-flex items-center gap-1">
            <Clock3 size={13} />
            Last scan {lastSyncLabel}
          </span>

          <span>
            Opportunities {formatNumber(getStat(job, "opportunities_unlocked") || getStat(job, "candidates_found"))}
          </span>
        </div>
      )}
    </div>
  );
}
