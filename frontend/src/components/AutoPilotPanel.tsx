import { useEffect, useState } from "react";
import axios from "axios";
import {
  Activity,
  Bot,
  Clock,
  Play,
  RefreshCw,
  Save,
  Square,
  Zap,
} from "lucide-react";

type SyncJob = {
  job_id: string;
  status: string;
  scan_mode: string;
  connected_realm_id: number;
  phase: string;
  progress_percent: number;
  message: string;
};

type AutoPilotState = {
  enabled: boolean;
  connected_realm_id: number;
  quick_interval_minutes: number;
  full_interval_minutes: number;
  check_every_seconds: number;
  last_quick_started_at: string | null;
  last_full_started_at: string | null;
  last_job_id: string | null;
  last_scan_mode: string | null;
  last_message: string;
  run_count: number;
  error_count: number;
  last_error: string | null;
  started_at: string | null;
  updated_at: string | null;
  next_quick_due_at: string;
  next_full_due_at: string;
};

type AutoPilotStatusResponse = {
  status: string;
  autopilot: AutoPilotState;
  active_job: SyncJob | null;
  error?: string;
};

const API_BASE_URL = "http://127.0.0.1:8000/api";

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  if (value === "Due now") {
    return "Due now";
  }

  try {
    return new Intl.DateTimeFormat("en-AU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "-";
  }
}

type AutoPilotPanelProps = {
  realm: number;
};

export default function AutoPilotPanel({ realm }: AutoPilotPanelProps) {
  const [autopilot, setAutopilot] = useState<AutoPilotState | null>(null);
  const [activeJob, setActiveJob] = useState<SyncJob | null>(null);

  const [quickInterval, setQuickInterval] = useState(60);
  const [fullInterval, setFullInterval] = useState(240);
  const [checkEvery, setCheckEvery] = useState(30);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadStatus() {
    try {
      setLoading(true);
      setError("");

      const response = await axios.get<AutoPilotStatusResponse>(
        `${API_BASE_URL}/autopilot/status`,
      );

      if (response.data.status !== "Success") {
        setError(response.data.error ?? "Unable to load AutoPilot.");
        return;
      }

      setAutopilot(response.data.autopilot);
      setActiveJob(response.data.active_job);

      setQuickInterval(response.data.autopilot.quick_interval_minutes);
      setFullInterval(response.data.autopilot.full_interval_minutes);
      setCheckEvery(response.data.autopilot.check_every_seconds);
    } catch {
      setError("Unable to load AutoPilot. Check backend is running.");
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      await axios.post(`${API_BASE_URL}/autopilot/settings`, {
        connected_realm_id: realm,
        quick_interval_minutes: quickInterval,
        full_interval_minutes: fullInterval,
        check_every_seconds: checkEvery,
      });

      setSuccessMessage("AutoPilot settings saved.");
      await loadStatus();
    } catch {
      setError("Unable to save AutoPilot settings.");
    } finally {
      setSaving(false);
    }
  }

  async function startAutoPilot() {
    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      await saveSettings();

      await axios.post(`${API_BASE_URL}/autopilot/start?run_now=true`);

      setSuccessMessage("AutoPilot started and requested a quick scan.");
      await loadStatus();
    } catch {
      setError("Unable to start AutoPilot.");
    } finally {
      setSaving(false);
    }
  }

  async function stopAutoPilot() {
    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      await axios.post(`${API_BASE_URL}/autopilot/stop`);

      setSuccessMessage("AutoPilot stopped.");
      await loadStatus();
    } catch {
      setError("Unable to stop AutoPilot.");
    } finally {
      setSaving(false);
    }
  }

  async function runNow(scanMode: "quick" | "full") {
    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      await saveSettings();

      await axios.post(`${API_BASE_URL}/autopilot/run-now?scan_mode=${scanMode}`);

      setSuccessMessage(`${scanMode === "quick" ? "Quick" : "Full"} scan requested.`);
      await loadStatus();
    } catch {
      setError("Unable to request scan.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(loadStatus, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-emerald-800 bg-emerald-950/10 p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Bot size={22} className="text-emerald-400" />
            <h3 className="text-xl font-bold text-white">AutoPilot Scheduler</h3>
          </div>

          <p className="mt-1 text-sm text-slate-400">
            Automatically runs backend sync jobs while GoldSmith is open on your machine.
          </p>
        </div>

        <span
          className={
            autopilot?.enabled
              ? "rounded-full border border-emerald-800 bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-300"
              : "rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-400"
          }
        >
          {autopilot?.enabled ? "Running" : "Stopped"}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-800 bg-red-950/50 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 rounded-xl border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-300">
          {successMessage}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Quick Scan Interval
          </span>

          <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
            <Clock size={16} className="text-slate-500" />

            <input
              type="number"
              min={15}
              max={1440}
              value={quickInterval}
              onChange={(event) => setQuickInterval(Number(event.target.value))}
              className="w-full bg-transparent text-sm text-white outline-none"
            />

            <span className="text-xs text-slate-500">min</span>
          </div>
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Full Scan Interval
          </span>

          <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
            <Clock size={16} className="text-slate-500" />

            <input
              type="number"
              min={30}
              max={2880}
              value={fullInterval}
              onChange={(event) => setFullInterval(Number(event.target.value))}
              className="w-full bg-transparent text-sm text-white outline-none"
            />

            <span className="text-xs text-slate-500">min</span>
          </div>
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Scheduler Check
          </span>

          <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
            <RefreshCw size={16} className="text-slate-500" />

            <input
              type="number"
              min={15}
              max={300}
              value={checkEvery}
              onChange={(event) => setCheckEvery(Number(event.target.value))}
              className="w-full bg-transparent text-sm text-white outline-none"
            />

            <span className="text-xs text-slate-500">sec</span>
          </div>
        </label>
      </div>

      <div className="mt-5 grid gap-4 text-sm md:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <p className="text-xs text-slate-500">Next Quick</p>
          <p className="mt-1 font-semibold text-white">
            {formatDateTime(autopilot?.next_quick_due_at ?? null)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <p className="text-xs text-slate-500">Next Full</p>
          <p className="mt-1 font-semibold text-white">
            {formatDateTime(autopilot?.next_full_due_at ?? null)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <p className="text-xs text-slate-500">Runs Started</p>
          <p className="mt-1 font-semibold text-emerald-400">
            {autopilot?.run_count ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <p className="text-xs text-slate-500">Active Job</p>
          <p className="mt-1 font-semibold text-amber-400">
            {activeJob
              ? `${activeJob.scan_mode} ${Math.round(activeJob.progress_percent)}%`
              : "None"}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950 p-4">
        <p className="text-sm text-slate-300">
          {activeJob
            ? activeJob.message
            : autopilot?.last_message ?? "AutoPilot status loading..."}
        </p>

        {autopilot?.last_error && (
          <p className="mt-2 text-sm text-red-300">{autopilot.last_error}</p>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={saveSettings}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-60"
        >
          <Save size={16} />
          Save
        </button>

        {autopilot?.enabled ? (
          <button
            type="button"
            onClick={stopAutoPilot}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg border border-red-800 bg-red-950/40 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-900/40 disabled:opacity-60"
          >
            <Square size={16} />
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={startAutoPilot}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:opacity-60"
          >
            <Play size={16} />
            Start AutoPilot
          </button>
        )}

        <button
          type="button"
          onClick={() => runNow("quick")}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:opacity-60"
        >
          <Zap size={16} />
          Run Quick Now
        </button>

        <button
          type="button"
          onClick={() => runNow("full")}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-amber-400 disabled:opacity-60"
        >
          <Activity size={16} />
          Run Full Now
        </button>
      </div>
    </div>
  );
}
