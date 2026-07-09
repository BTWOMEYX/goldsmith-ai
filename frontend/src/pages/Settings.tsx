import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Ban,
  CheckCircle2,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings as SettingsIcon,
  Trash2,
} from "lucide-react";

import AutoPilotPanel from "../components/AutoPilotPanel";
import StrategyProfilePanel from "../components/StrategyProfilePanel";
import RealmSelect from "../components/RealmSelect";

type IgnoreRule = {
  id: number;
  rule_type: string;
  item_id: number | null;
  realm_id: number | null;
  item_name: string | null;
  category: string | null;
  keyword: string | null;
  risk_level: string | null;
  reason: string | null;
  is_active: boolean;
  created_at: string | null;
};

type IgnoreRulesResponse = {
  status: string;
  rule_count: number;
  items: IgnoreRule[];
  error?: string;
};

const API_BASE_URL = "http://127.0.0.1:8000/api";

const CATEGORY_OPTIONS = [
  "Crafting Materials",
  "Consumables",
  "Enchants",
  "Gems",
  "Glyphs",
  "Recipes / Plans",
  "Battle Pets",
  "Gear / Transmog",
  "Rare / Collector Items",
  "Unknown / Other",
];

function formatDate(value: string | null) {
  if (!value) {
    return "-";
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

function getRuleLabel(rule: IgnoreRule) {
  if (rule.rule_type === "item") {
    return rule.item_name ?? `Item #${rule.item_id}`;
  }

  if (rule.rule_type === "category") {
    return rule.category ?? "Category";
  }

  if (rule.rule_type === "keyword") {
    return rule.keyword ?? "Keyword";
  }

  if (rule.rule_type === "risk_profile") {
    return `${rule.risk_level ?? "Risk"} ${rule.category ?? ""}`;
  }

  return "Rule";
}

function getRuleScope(rule: IgnoreRule) {
  if (rule.realm_id === null || rule.realm_id === undefined) {
    return "Global";
  }

  return `Realm ${rule.realm_id}`;
}

function getRuleClass(rule: IgnoreRule) {
  if (!rule.is_active) {
    return "border-slate-800 bg-slate-950 text-slate-500";
  }

  switch (rule.rule_type) {
    case "item":
      return "border-red-800 bg-red-950/30 text-red-300";
    case "category":
      return "border-amber-800 bg-amber-950/30 text-amber-300";
    case "keyword":
      return "border-purple-800 bg-purple-950/30 text-purple-300";
    default:
      return "border-slate-700 bg-slate-950 text-slate-300";
  }
}

export default function SettingsPage() {
  const [realm, setRealm] = useState(11);
  const [rules, setRules] = useState<IgnoreRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showInactive, setShowInactive] = useState(false);
  const [categoryToIgnore, setCategoryToIgnore] = useState(CATEGORY_OPTIONS[0]);
  const [keywordToIgnore, setKeywordToIgnore] = useState("");
  const [globalRule, setGlobalRule] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadRules() {
    try {
      setLoading(true);
      setError("");

      const response = await axios.get<IgnoreRulesResponse>(
        `${API_BASE_URL}/ignore-rules?connected_realm_id=${realm}&active_only=${!showInactive}`,
      );

      if (response.data.status !== "Success") {
        setError(response.data.error ?? "Unable to load ignore rules.");
        setRules([]);
        return;
      }

      setRules(response.data.items);
    } catch {
      setError("Unable to load ignore rules. Check backend is running.");
      setRules([]);
    } finally {
      setLoading(false);
    }
  }

  async function addCategoryRule() {
    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      await axios.post(`${API_BASE_URL}/ignore-rules/category`, {
        category: categoryToIgnore,
        realm_id: globalRule ? null : realm,
        reason: "Ignored from Settings.",
      });

      setSuccessMessage(`${categoryToIgnore} ignore rule created.`);
      await loadRules();
    } catch {
      setError("Unable to create category ignore rule.");
    } finally {
      setSaving(false);
    }
  }

  async function addKeywordRule() {
    const keyword = keywordToIgnore.trim();

    if (!keyword) {
      setError("Enter a keyword first.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      await axios.post(`${API_BASE_URL}/ignore-rules/keyword`, {
        keyword,
        realm_id: globalRule ? null : realm,
        reason: "Ignored from Settings.",
      });

      setKeywordToIgnore("");
      setSuccessMessage(`Keyword "${keyword}" ignore rule created.`);
      await loadRules();
    } catch {
      setError("Unable to create keyword ignore rule.");
    } finally {
      setSaving(false);
    }
  }

  async function deactivateRule(rule: IgnoreRule) {
    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      await axios.delete(`${API_BASE_URL}/ignore-rules/${rule.id}`);

      setSuccessMessage(`Ignore rule deactivated: ${getRuleLabel(rule)}.`);
      await loadRules();
    } catch {
      setError("Unable to deactivate ignore rule.");
    } finally {
      setSaving(false);
    }
  }

  async function reactivateRule(rule: IgnoreRule) {
    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      await axios.post(`${API_BASE_URL}/ignore-rules/${rule.id}/reactivate`);

      setSuccessMessage(`Ignore rule reactivated: ${getRuleLabel(rule)}.`);
      await loadRules();
    } catch {
      setError("Unable to reactivate ignore rule.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadRules();
  }, [realm, showInactive]);

  const activeCount = useMemo(() => {
    return rules.filter((rule) => rule.is_active).length;
  }, [rules]);

  const inactiveCount = useMemo(() => {
    return rules.filter((rule) => !rule.is_active).length;
  }, [rules]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <SettingsIcon size={22} className="text-amber-400" />
            <h2 className="text-2xl font-bold text-white">Settings</h2>
          </div>

          <p className="mt-1 text-sm text-slate-400">
            Configure realm behaviour and teach GoldSmith what to suppress.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <RealmSelect value={realm} onChange={setRealm} />

          <button
            type="button"
            onClick={loadRules}
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

      {successMessage && (
        <div className="rounded-xl border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-300">
          {successMessage}
        </div>
      )}

      <AutoPilotPanel realm={realm} />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs text-slate-500">Active Ignore Rules</p>
          <p className="mt-2 text-3xl font-bold text-red-400">
            {activeCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs text-slate-500">Inactive Rules</p>
          <p className="mt-2 text-3xl font-bold text-slate-300">
            {inactiveCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs text-slate-500">Scope</p>
          <p className="mt-2 text-xl font-bold text-white">
            {globalRule ? "Global" : `Realm ${realm}`}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="mb-5">
          <h3 className="text-lg font-bold text-white">Create Ignore Rule</h3>
          <p className="mt-1 text-sm text-slate-400">
            Suppressed items are hidden from Action Center, Deal Alerts and Auto Watch.
            Raw market capture still remains available for history.
          </p>
        </div>

        <label className="mb-5 flex items-center gap-3 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={globalRule}
            onChange={(event) => setGlobalRule(event.target.checked)}
            className="h-4 w-4 rounded border-slate-700 bg-slate-950"
          />
          Apply new rules globally instead of only this realm.
        </label>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Ban size={17} className="text-amber-400" />
              <h4 className="font-semibold text-white">Ignore Category</h4>
            </div>

            <div className="flex flex-wrap gap-3">
              <select
                value={categoryToIgnore}
                onChange={(event) => setCategoryToIgnore(event.target.value)}
                className="min-w-64 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-500"
              >
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={addCategoryRule}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-amber-400 disabled:opacity-60"
              >
                <Plus size={16} />
                Add
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Ban size={17} className="text-purple-400" />
              <h4 className="font-semibold text-white">Ignore Keyword</h4>
            </div>

            <div className="flex flex-wrap gap-3">
              <input
                value={keywordToIgnore}
                onChange={(event) => setKeywordToIgnore(event.target.value)}
                placeholder="Example: cosmetic, novice, cracked..."
                className="min-w-64 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-500"
              />

              <button
                type="button"
                onClick={addKeywordRule}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-purple-400 disabled:opacity-60"
              >
                <Plus size={16} />
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Ignore Rules</h3>
            <p className="mt-1 text-sm text-slate-400">
              Manage what GoldSmith suppresses from recommendations.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-slate-950"
            />
            Show inactive
          </label>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Rule</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Loading ignore rules...
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No ignore rules yet.
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr
                    key={rule.id}
                    className="border-b border-slate-800/70 transition hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getRuleClass(
                          rule,
                        )}`}
                      >
                        {getRuleLabel(rule)}
                      </span>
                    </td>

                    <td className="px-4 py-4 font-semibold text-slate-300">
                      {rule.rule_type}
                    </td>

                    <td className="px-4 py-4 text-slate-400">
                      {getRuleScope(rule)}
                    </td>

                    <td className="px-4 py-4 text-slate-400">
                      {rule.reason ?? "-"}
                    </td>

                    <td className="px-4 py-4 text-slate-500">
                      {formatDate(rule.created_at)}
                    </td>

                    <td className="px-4 py-4">
                      {rule.is_active ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 size={14} />
                          Active
                        </span>
                      ) : (
                        <span className="text-slate-500">Inactive</span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      {rule.is_active ? (
                        <button
                          type="button"
                          onClick={() => deactivateRule(rule)}
                          disabled={saving}
                          className="inline-flex items-center gap-2 rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-900/40 disabled:opacity-60"
                        >
                          <Trash2 size={14} />
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => reactivateRule(rule)}
                          disabled={saving}
                          className="inline-flex items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-900/40 disabled:opacity-60"
                        >
                          <RotateCcw size={14} />
                          Reactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}