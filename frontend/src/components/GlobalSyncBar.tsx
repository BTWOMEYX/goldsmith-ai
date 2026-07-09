import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Activity,
  CheckCircle2,
  Database,
  RefreshCw,
  Server,
  Zap,
} from "lucide-react";

type ScanMode = "quick" | "full";

type StoredRealmSelection = {
  option_id?: string;
  connected_realm_id?: number;
  realm_name?: string;
};

type SyncStats = {
  auctions_downloaded?: number;
  items_scanned?: number;
  market_snapshots_saved?: number;
  opportunities_unlocked?: number;
  snapshots_saved?: number;
  candidates_found?: number;
  metadata_enriched?: number;
  passed_profitability_buffers?: number;
  ignored_count?: number;
  auto_watch_added?: number;
};

type SyncResponse = {
  status: string;
  scan_mode?: string;
  connected_realm_id?: number;
  realm?: string;
  auctions_downloaded?: number;
  items_scanned?: number;
  market_snapshots_saved?: number;
  opportunities_unlocked?: number;
  snapshots_saved?: number;
  passed_profitability_buffers?: number;
  candidates_found?: number;
  metadata_enriched?: number;
  error?: string;
  message?: string;
};

type AutoWatchResponse = {
  status: string;
  connected_realm_id?: number;
  realm?: string;
  auto_watch_added: number;
  ignored_count?: number;
  error?: string;
};

type SyncJob = {
  job_id: string;
  status: "queued" | "running" | "complete" | "failed";
  scan_mode: ScanMode;
  connected_realm_id: number;
  realm_name: string;
  phase: string;
  progress_percent: number;
  message: string;
  stats: SyncStats;
  error: string | null;
  sync_response: SyncResponse | null;
  auto_watch_response: AutoWatchResponse | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
};

type SyncJobResponse = {
  status: string;
  message?: string;
  error?: string;
  job: SyncJob | null;
};

type LastSyncPayload = {
  completed_at: string;
  scan_mode: ScanMode;
  connected_realm_id: number;
  realm_name: string;
  response: SyncResponse;
  auto_watch: AutoWatchResponse | null;
};

const API_BASE_URL = "http://127.0.0.1:8000/api";

const DEFAULT_REALM_STORAGE_KEY = "goldsmith.defaultRealm";
const LAST_SYNC_STORAGE_KEY = "goldsmith.lastSync";

function readStoredRealmSelection(): Required<StoredRealmSelection> {
  try {
    const storedValue = localStorage.getItem(DEFAULT_REALM_STORAGE_KEY);

    if (!storedValue) {
      return {
        option_id: "11-Illidan",
        connected_realm_id: 11,
        realm_name: "Illidan",
      };
    }

    const parsedValue = JSON.parse(storedValue) as StoredRealmSelection;

    return {
      option_id: parsedValue.option_id ?? "11-Illidan",
      connected_realm_id: parsedValue.connected_realm_id ?? 11,
      realm_name: parsedValue.realm_name ?? "Illidan",
    };
  } catch {
    return {
      option_id: "11-Illidan",
      connected_realm_id: 11,
      realm_name: "Illidan",
    };
  }
}

function readLastSyncPayload() {
  try {
    const storedValue = localStorage.getItem(LAST_SYNC_STORAGE_KEY);

    if (!storedValue) {
      return null;
    }

    return JSON.parse(storedValue) as LastSyncPayload;
  } catch {
    return null;
  }
}

function formatNumber(value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) {
    return "-";
  }

  return value.toLocaleString();
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "No scan yet";
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

function getAxiosErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data as
      | { error?: string; message?: string; detail?: string }
      | undefined;

    if (responseData?.error) {
      return responseData.error;
    }

    if (responseData?.message) {
      return responseData.message;
    }

    if (responseData?.detail) {
      return responseData.detail;
    }

    if (error.message) {
      return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error.";
}

function getPhaseLabel(phase: string) {
  switch (phase) {
    case "queued":
      return "Queued";
    case "starting":
      return "Starting scan";
    case "downloading_auctions":
      return "Downloading auctions";
    case "running_market_engine":
      return "Capturing and scoring market";
    case "applying_filters":
      return "Applying filters and guardrails";
    case "running_auto_watch":
      return "Running Auto Watch";
    case "complete":
      return "Sync complete";
    case "failed":
      return "Sync failed";
    default:
      return "Ready";
  }
}

function buildFallbackSyncResponse(job: SyncJob): SyncResponse {
  return {
    status: job.status === "complete" ? "Success" : "Error",
    scan_mode: job.scan_mode,
    connected_realm_id: job.connected_realm_id,
    realm: job.realm_name,
    auctions_downloaded: job.stats.auctions_downloaded ?? 0,
    items_scanned: job.stats.items_scanned ?? 0,
    market_snapshots_saved: job.stats.market_snapshots_saved ?? 0,
    opportunities_unlocked: job.stats.opportunities_unlocked ?? 0,
    snapshots_saved: job.stats.snapshots_saved ?? 0,
    passed_profitability_buffers: job.stats.passed_profitability_buffers ?? 0,
    candidates_found: job.stats.candidates_found ?? 0,
    metadata_enriched: job.stats.metadata_enriched ?? 0,
    error: job.error ?? undefined,
  };
}

function saveJobResult(job: SyncJob) {
  const syncPayload: LastSyncPayload = {
    completed_at: job.completed_at ?? new Date().toISOString(),
    scan_mode: job.scan_mode,
    connected_realm_id: job.connected_realm_id,
    realm_name: job.realm_name,
    response: job.sync_response ?? buildFallbackSyncResponse(job),
    auto_watch: job.auto_watch_response,
  };

  localStorage.setItem(LAST_SYNC_STORAGE_KEY, JSON.stringify(syncPayload));

  window.dispatchEvent(
    new CustomEvent("goldsmith-sync-complete", {
      detail: syncPayload,
    }),
  );

  return syncPayload;
}

function getProfitPilotMessage(lastSync: LastSyncPayload | null) {
  if (!lastSync) {
    return "Run Quick Scan or Full Scan to capture the market.";
  }

  const response = lastSync.response;

  if (response.status !== "Success") {
    return response.error ?? response.message ?? "Last scan failed.";
  }

  const autoWatched = lastSync.auto_watch?.auto_watch_added ?? 0;
  const opportunities = response.opportunities_unlocked ?? 0;
  const marketCaptures = response.market_snapshots_saved ?? 0;
  const passedBuffers = response.passed_profitability_buffers ?? 0;

  if (autoWatched > 0) {
    return `${autoWatched} high-confidence deal${
      autoWatched === 1 ? "" : "s"
    } auto-watched.`;
  }

  if (opportunities > 0) {
    return `${opportunities} opportunities found. Review Action Center.`;
  }

  if (marketCaptures > 0 && passedBuffers === 0) {
    return "Market captured, but filters rejected junk.";
  }

  return "No clean opportunities yet. Try Full Scan or another realm.";
}

export default function GlobalSyncBar() {
  const handledJobIds = useRef<Set<string>>(new Set());

  const [realmSelection, setRealmSelection] = useState(
    readStoredRealmSelection(),
  );
  const [lastSync, setLastSync] = useState<LastSyncPayload | null>(
    readLastSyncPayload(),
  );
  const [activeJob, setActiveJob] = useState<SyncJob | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    function refreshStoredState() {
      setRealmSelection(readStoredRealmSelection());
      setLastSync(readLastSyncPayload());
    }

    function handleStorageChange(event: StorageEvent) {
      if (
        event.key === DEFAULT_REALM_STORAGE_KEY ||
        event.key === LAST_SYNC_STORAGE_KEY
      ) {
        refreshStoredState();
      }
    }

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("goldsmith-sync-complete", refreshStoredState);

    const interval = window.setInterval(refreshStoredState, 1000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("goldsmith-sync-complete", refreshStoredState);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    async function loadActiveJob() {
      try {
        const currentRealm = readStoredRealmSelection();

        const response = await axios.get<SyncJobResponse>(
          `${API_BASE_URL}/sync-jobs/active?connected_realm_id=${currentRealm.connected_realm_id}`,
        );

        if (response.data.job) {
          setActiveJob(response.data.job);
        }
      } catch {
        // Silent because backend may not be running yet.
      }
    }

    loadActiveJob();
  }, []);

  useEffect(() => {
    if (!activeJob || !["queued", "running"].includes(activeJob.status)) {
      return;
    }

    const interval = window.setInterval(async () => {
      try {
        const response = await axios.get<SyncJobResponse>(
          `${API_BASE_URL}/sync-jobs/${activeJob.job_id}`,
        );

        const job = response.data.job;

        if (!job) {
          setActiveJob(null);
          return;
        }

        setActiveJob(job);

        if (
          job.status === "complete" &&
          !handledJobIds.current.has(job.job_id)
        ) {
          handledJobIds.current.add(job.job_id);

          const savedPayload = saveJobResult(job);
          setLastSync(savedPayload);

          setMessage(
            `${job.scan_mode === "quick" ? "Quick" : "Full"} Scan complete. ${
              job.stats.auto_watch_added && job.stats.auto_watch_added > 0
                ? `${job.stats.auto_watch_added} deal${
                    job.stats.auto_watch_added === 1 ? "" : "s"
                  } auto-watched.`
                : "No new auto-watch deals."
            } Refreshing data...`,
          );

          window.setTimeout(() => {
            window.location.reload();
          }, 1200);
        }

        if (job.status === "failed" && !handledJobIds.current.has(job.job_id)) {
          handledJobIds.current.add(job.job_id);
          setMessage(job.error ?? "Sync failed.");
        }
      } catch (error) {
        setMessage(getAxiosErrorMessage(error));
      }
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [activeJob]);


  useEffect(() => {
    const interval = window.setInterval(async () => {
      if (activeJob && ["queued", "running"].includes(activeJob.status)) {
        return;
      }

      try {
        const currentRealm = readStoredRealmSelection();

        const response = await axios.get<SyncJobResponse>(
          `${API_BASE_URL}/sync-jobs/active?connected_realm_id=${currentRealm.connected_realm_id}`,
        );

        if (response.data.job) {
          setActiveJob(response.data.job);
          setMessage("Reconnected to active backend sync job.");
        }
      } catch {
        // Silent reconnect check.
      }
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [activeJob]);

  const isSyncing =
    activeJob !== null && ["queued", "running"].includes(activeJob.status);

  const statusLabel = useMemo(() => {
    if (activeJob && ["queued", "running"].includes(activeJob.status)) {
      return activeJob.message || `${getPhaseLabel(activeJob.phase)}...`;
    }

    if (activeJob?.status === "failed") {
      return activeJob.error ?? "Sync failed.";
    }

    if (message) {
      return message;
    }

    return getProfitPilotMessage(lastSync);
  }, [activeJob, lastSync, message]);

  const progressPercent = activeJob?.progress_percent ?? 0;
  const phase = activeJob?.phase ?? "idle";

  const displayStats = activeJob?.stats ?? {
    auctions_downloaded: lastSync?.response.auctions_downloaded,
    items_scanned: lastSync?.response.items_scanned,
    market_snapshots_saved: lastSync?.response.market_snapshots_saved,
    opportunities_unlocked: lastSync?.response.opportunities_unlocked,
    ignored_count: lastSync?.auto_watch?.ignored_count,
    auto_watch_added: lastSync?.auto_watch?.auto_watch_added,
  };

  async function startSyncJob(scanMode: ScanMode) {
    try {
      const currentRealm = readStoredRealmSelection();

      setRealmSelection(currentRealm);
      setMessage(`${scanMode === "quick" ? "Quick" : "Full"} Sync job starting...`);

      const response = await axios.post<SyncJobResponse>(
        `${API_BASE_URL}/sync-jobs/start?connected_realm_id=${currentRealm.connected_realm_id}&scan_mode=${scanMode}`,
      );

      if (!response.data.job) {
        setMessage(response.data.error ?? "Unable to start sync job.");
        return;
      }

      setActiveJob(response.data.job);

      if (response.data.status === "Existing") {
        setMessage("Existing sync job found. Reconnecting to progress.");
      }
    } catch (error) {
      setMessage(getAxiosErrorMessage(error));
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/95 p-4 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-800 bg-amber-950/40 text-amber-300">
            <Database size={18} />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-white">Global Sync</h3>

              <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-300">
                Backend Job Engine
              </span>

              <span className="rounded-full border border-emerald-800 bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-300">
                Auto Watch Active
              </span>

              {isSyncing && (
                <span className="rounded-full border border-blue-800 bg-blue-950/40 px-3 py-1 text-xs font-semibold text-blue-300">
                  {Math.round(progressPercent)}%
                </span>
              )}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Server size={13} />
                {realmSelection.realm_name} - Connected Realm #
                {realmSelection.connected_realm_id}
              </span>

              <span>-</span>

              <span>
                Last scan: {formatDateTime(lastSync?.completed_at ?? null)}
              </span>

              <span>-</span>

              <span>{statusLabel}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => startSyncJob("quick")}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Zap
              size={16}
              className={activeJob?.scan_mode === "quick" ? "animate-pulse" : ""}
            />

            {activeJob?.scan_mode === "quick" && isSyncing
              ? "Quick Running..."
              : "Quick Scan"}
          </button>

          <button
            type="button"
            onClick={() => startSyncJob("full")}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Activity
              size={16}
              className={activeJob?.scan_mode === "full" ? "animate-pulse" : ""}
            />

            {activeJob?.scan_mode === "full" && isSyncing
              ? "Full Running..."
              : "Full Scan"}
          </button>
        </div>
      </div>

      {(isSyncing || activeJob?.status === "complete" || activeJob?.status === "failed") && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span
              className={
                activeJob?.status === "failed"
                  ? "font-semibold text-red-300"
                  : activeJob?.status === "complete"
                    ? "font-semibold text-emerald-300"
                    : "font-semibold text-blue-300"
              }
            >
              {getPhaseLabel(phase)}
            </span>

            <span className="text-slate-500">
              {Math.round(progressPercent)}%
            </span>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-slate-950">
            <div
              className={
                activeJob?.status === "failed"
                  ? "h-full rounded-full bg-red-500 transition-all duration-500"
                  : activeJob?.status === "complete"
                    ? "h-full rounded-full bg-emerald-500 transition-all duration-500"
                    : "h-full rounded-full bg-blue-500 transition-all duration-500"
              }
              style={{
                width: `${Math.max(3, Math.min(progressPercent, 100))}%`,
              }}
            />
          </div>

          {isSyncing && (
            <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
              <RefreshCw size={15} className="animate-spin text-amber-400" />
              Backend sync job is running. Pages will refresh automatically when complete.
            </div>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-3 text-xs md:grid-cols-6">
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
          <p className="text-slate-500">Auctions</p>

          <p className="mt-1 font-bold text-white">
            {formatNumber(displayStats.auctions_downloaded)}
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
          <p className="text-slate-500">Items Scanned</p>

          <p className="mt-1 font-bold text-blue-400">
            {formatNumber(displayStats.items_scanned)}
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
          <p className="text-slate-500">Market Captures</p>

          <p className="mt-1 font-bold text-purple-400">
            {formatNumber(displayStats.market_snapshots_saved)}
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
          <p className="text-slate-500">Opportunities</p>

          <p className="mt-1 font-bold text-emerald-400">
            {formatNumber(displayStats.opportunities_unlocked)}
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
          <p className="text-slate-500">Suppressed / Watched</p>

          <p className="mt-1 font-bold text-amber-400">
            {formatNumber(displayStats.ignored_count)} /{" "}
            {formatNumber(displayStats.auto_watch_added)}
          </p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
          <p className="text-slate-500">Status</p>

          <p
            className={
              activeJob?.status === "failed"
                ? "mt-1 inline-flex items-center gap-1 font-bold text-red-400"
                : "mt-1 inline-flex items-center gap-1 font-bold text-emerald-400"
            }
          >
            <CheckCircle2 size={13} />
            {activeJob?.status === "failed" ? "Failed" : isSyncing ? "Running" : "Ready"}
          </p>
        </div>
      </div>
    </div>
  );
}