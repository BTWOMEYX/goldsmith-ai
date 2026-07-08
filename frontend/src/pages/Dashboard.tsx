import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  Zap,
} from "lucide-react";

type TrackedItem = {
  id: number;
  item_id: number;
  name: string;
  current_price: number;
  volume: number;
  listing_count: number;
  opportunity_score: number;
  risk_level: string;
  reason: string | null;
  icon_url: string | null;
  quality: string | null;
  profit_margin: number;
};

type DashboardResponse = {
  status: string;
  connected_realm_id: number;
  realm: string;
  item_count: number;
  items: TrackedItem[];
};

type SignalItem = {
  item_id: number;
  realm_id: number;
  realm_name: string;
  name: string;
  current_price: number;
  previous_price: number | null;
  price_change: number;
  price_change_percent: number;
  volume: number;
  previous_volume: number | null;
  volume_change: number;
  volume_change_percent: number;
  listing_count: number;
  opportunity_score: number;
  previous_score: number | null;
  score_change: number;
  risk_level: string;
  reason: string | null;
  icon_url: string | null;
  quality: string | null;
  snapshot_count: number;
  last_seen: string | null;
  signal: string;
  signal_label: string;
  signal_priority: number;
  signal_action: string;
  signal_tone: string;
  signal_confidence: number;
  signal_reason: string;
  is_watched: boolean;
};

type SignalsResponse = {
  status: string;
  connected_realm_id: number;
  realm: string;
  signal_count: number;
  top_signal: SignalItem | null;
  summary: {
    strong_buy_count: number;
    buy_watch_count: number;
    price_drop_count: number;
    score_improving_count: number;
    hold_count: number;
    avoid_count: number;
  };
  items: SignalItem[];
};

const API_BASE_URL = "http://127.0.0.1:8000/api";

const REALMS = [
  { id: 11, name: "US - Illidan" },
  { id: 4, name: "US - Area 52" },
  { id: 12, name: "US - Sargeras" },
  { id: 53, name: "US - Tichondrius" },
];

function getQualityClass(quality: string | null) {
  switch (quality?.toLowerCase()) {
    case "poor":
      return "text-slate-500 border-slate-700 bg-slate-900";
    case "common":
      return "text-slate-200 border-slate-600 bg-slate-800";
    case "uncommon":
      return "text-green-400 border-green-800 bg-green-950/40";
    case "rare":
      return "text-blue-400 border-blue-800 bg-blue-950/40";
    case "epic":
      return "text-purple-400 border-purple-800 bg-purple-950/40";
    case "legendary":
      return "text-orange-400 border-orange-800 bg-orange-950/40";
    default:
      return "text-slate-400 border-slate-700 bg-slate-900";
  }
}

function getRiskClass(riskLevel: string) {
  switch (riskLevel.toLowerCase()) {
    case "low":
      return "text-emerald-400 border-emerald-800 bg-emerald-950/40";
    case "medium":
      return "text-amber-400 border-amber-800 bg-amber-950/40";
    case "high":
      return "text-red-400 border-red-800 bg-red-950/40";
    default:
      return "text-slate-400 border-slate-700 bg-slate-900";
  }
}

function getScoreClass(score: number) {
  if (score >= 80) {
    return "text-emerald-400";
  }

  if (score >= 60) {
    return "text-blue-400";
  }

  if (score >= 40) {
    return "text-amber-400";
  }

  return "text-red-400";
}

function getSignalClass(signal: string) {
  switch (signal) {
    case "STRONG_BUY":
      return "border-emerald-700 bg-emerald-950/50 text-emerald-300";
    case "BUY_WATCH":
      return "border-blue-700 bg-blue-950/50 text-blue-300";
    case "PRICE_DROP":
      return "border-purple-700 bg-purple-950/50 text-purple-300";
    case "SCORE_IMPROVING":
      return "border-cyan-700 bg-cyan-950/50 text-cyan-300";
    case "AVOID":
      return "border-red-700 bg-red-950/50 text-red-300";
    case "HOLD":
    default:
      return "border-slate-700 bg-slate-950 text-slate-300";
  }
}

function getSignalIcon(signal: string) {
  switch (signal) {
    case "STRONG_BUY":
      return <Zap size={16} />;
    case "BUY_WATCH":
      return <CheckCircle2 size={16} />;
    case "PRICE_DROP":
      return <TrendingDown size={16} />;
    case "SCORE_IMPROVING":
      return <Activity size={16} />;
    case "AVOID":
      return <ShieldAlert size={16} />;
    case "HOLD":
    default:
      return <AlertTriangle size={16} />;
  }
}

function formatGold(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${Math.round(value).toLocaleString()}g`;
}

function formatScore(value: number) {
  return `${value.toFixed(1)}/100`;
}

export default function Dashboard() {
  const [realm, setRealm] = useState(11);
  const [realmName, setRealmName] = useState("Illidan");
  const [items, setItems] = useState<TrackedItem[]>([]);
  const [signals, setSignals] = useState<SignalItem[]>([]);
  const [topSignal, setTopSignal] = useState<SignalItem | null>(null);
  const [signalSummary, setSignalSummary] = useState({
    strong_buy_count: 0,
    buy_watch_count: 0,
    price_drop_count: 0,
    score_improving_count: 0,
    hold_count: 0,
    avoid_count: 0,
  });

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  async function loadDashboard(realmId: number) {
    try {
      setLoading(true);

      const [dashboardResponse, signalsResponse] = await Promise.all([
        axios.get<DashboardResponse>(
          `${API_BASE_URL}/dashboard?connected_realm_id=${realmId}`
        ),
        axios.get<SignalsResponse>(
          `${API_BASE_URL}/signals?connected_realm_id=${realmId}`
        ),
      ]);

      setRealmName(dashboardResponse.data.realm);
      setItems(dashboardResponse.data.items ?? []);

      setSignals(signalsResponse.data.items ?? []);
      setTopSignal(signalsResponse.data.top_signal ?? null);

      if (signalsResponse.data.summary) {
        setSignalSummary(signalsResponse.data.summary);
      }

      setError("");
    } catch {
      setError("Unable to connect to backend.");
    } finally {
      setLoading(false);
    }
  }

  async function syncRealm() {
    try {
      setSyncing(true);
      setError("");

      await axios.post(
        `${API_BASE_URL}/sync-auctions?connected_realm_id=${realm}`
      );

      await loadDashboard(realm);
    } catch {
      setError("Auction sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    loadDashboard(realm);
  }, [realm]);

  const signalByItemId = useMemo(() => {
    const signalMap = new Map<number, SignalItem>();

    signals.forEach((signal) => {
      signalMap.set(signal.item_id, signal);
    });

    return signalMap;
  }, [signals]);

  const totalItems = items.length;

  const bestItem = useMemo(() => {
    if (!items.length) {
      return null;
    }

    return [...items].sort(
      (a, b) => b.opportunity_score - a.opportunity_score
    )[0];
  }, [items]);

  const averagePrice = useMemo(() => {
    if (!items.length) {
      return 0;
    }

    return (
      items.reduce((sum, item) => sum + item.current_price, 0) /
      items.length
    );
  }, [items]);

  const averageScore = useMemo(() => {
    if (!items.length) {
      return 0;
    }

    return (
      items.reduce((sum, item) => sum + item.opportunity_score, 0) /
      items.length
    );
  }, [items]);

  const actionableSignalCount = useMemo(() => {
    return (
      signalSummary.strong_buy_count +
      signalSummary.buy_watch_count +
      signalSummary.price_drop_count +
      signalSummary.score_improving_count
    );
  }, [signalSummary]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">
            {realmName} Market Overview
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Live auction intelligence with opportunity scoring and buy signals.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={realm}
            onChange={(event) => setRealm(Number(event.target.value))}
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 outline-none transition hover:border-slate-600 focus:border-amber-500"
          >
            {REALMS.map((realmOption) => (
              <option key={realmOption.id} value={realmOption.id}>
                {realmOption.name}
              </option>
            ))}
          </select>

          <button
            onClick={syncRealm}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={syncing ? "animate-spin" : ""}
            />

            {syncing ? "Syncing..." : "Sync Auctions"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/60 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Tracked Opportunities</p>

          <h3 className="mt-2 text-4xl font-bold text-white">
            {loading ? "..." : totalItems}
          </h3>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Best Opportunity</p>

          <h3 className="mt-2 truncate text-lg font-bold text-emerald-400">
            {bestItem?.name ?? "-"}
          </h3>

          <p className="mt-1 text-sm text-slate-400">
            {bestItem ? formatScore(bestItem.opportunity_score) : ""}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Average Price</p>

          <h3 className="mt-2 text-4xl font-bold text-amber-400">
            {loading ? "..." : formatGold(averagePrice)}
          </h3>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Actionable Signals</p>

          <h3 className="mt-2 text-4xl font-bold text-blue-400">
            {loading ? "..." : actionableSignalCount}
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Avg. score {formatScore(averageScore)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">
                GoldSmith Signal Engine
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Prioritised buy, watch and avoid signals from price history,
                score movement and market depth.
              </p>
            </div>

            <span className="rounded-full border border-blue-800 bg-blue-950/50 px-3 py-1 text-xs font-semibold text-blue-400">
              {signals.length} signals
            </span>
          </div>

          {topSignal ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  {topSignal.icon_url ? (
                    <img
                      src={topSignal.icon_url}
                      alt={topSignal.name}
                      className="h-14 w-14 rounded-lg border border-slate-700 bg-slate-950"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-lg border border-slate-700 bg-slate-950" />
                  )}

                  <div>
                    <div
                      className={`mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getSignalClass(
                        topSignal.signal
                      )}`}
                    >
                      {getSignalIcon(topSignal.signal)}
                      {topSignal.signal_label}
                    </div>

                    <h3 className="text-lg font-bold text-white">
                      {topSignal.name}
                    </h3>

                    <p className="mt-1 text-sm text-slate-400">
                      {topSignal.signal_action}
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      {topSignal.signal_reason}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xs text-slate-500">Confidence</p>

                  <p className="text-3xl font-bold text-emerald-400">
                    {topSignal.signal_confidence.toFixed(1)}%
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {formatGold(topSignal.current_price)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-8 text-center text-slate-500">
              No signals yet. Run at least one sync snapshot.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold text-white">
            Signal Breakdown
          </h2>

          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-slate-950 px-4 py-3">
              <span className="text-sm text-emerald-400">Strong Buy</span>
              <span className="font-bold text-white">
                {signalSummary.strong_buy_count}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-950 px-4 py-3">
              <span className="text-sm text-blue-400">Buy Watch</span>
              <span className="font-bold text-white">
                {signalSummary.buy_watch_count}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-950 px-4 py-3">
              <span className="text-sm text-purple-400">Price Drop</span>
              <span className="font-bold text-white">
                {signalSummary.price_drop_count}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-950 px-4 py-3">
              <span className="text-sm text-cyan-400">Score Improving</span>
              <span className="font-bold text-white">
                {signalSummary.score_improving_count}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-950 px-4 py-3">
              <span className="text-sm text-slate-400">Hold</span>
              <span className="font-bold text-white">
                {signalSummary.hold_count}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-950 px-4 py-3">
              <span className="text-sm text-red-400">Avoid</span>
              <span className="font-bold text-white">
                {signalSummary.avoid_count}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Market Opportunities
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Ranked opportunities with live buy signals.
            </p>
          </div>

          <span className="rounded-full border border-emerald-800 bg-emerald-950/50 px-3 py-1 text-xs font-semibold text-emerald-400">
            Live Data
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Item</th>
                <th className="px-6 py-3 text-left font-medium">Signal</th>
                <th className="px-6 py-3 text-left font-medium">Quality</th>
                <th className="px-6 py-3 text-right font-medium">Price</th>
                <th className="px-6 py-3 text-right font-medium">Volume</th>
                <th className="px-6 py-3 text-right font-medium">Score</th>
                <th className="px-6 py-3 text-left font-medium">Risk</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    Loading market data...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    No auction data yet. Click Sync Auctions to begin.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const signal = signalByItemId.get(item.item_id);

                  return (
                    <tr
                      key={item.id}
                      className="border-t border-slate-800 transition hover:bg-slate-800/40"
                      title={signal?.signal_reason ?? item.reason ?? ""}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {item.icon_url ? (
                            <img
                              src={item.icon_url}
                              alt={item.name}
                              className="h-10 w-10 rounded-lg border border-slate-700 bg-slate-950"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-lg border border-slate-700 bg-slate-950" />
                          )}

                          <div>
                            <p className="font-semibold text-white">
                              {item.name}
                            </p>

                            <p className="text-xs text-slate-500">
                              Item #{item.item_id} · {item.listing_count} listings
                            </p>

                            <p className="mt-1 max-w-xl truncate text-xs text-slate-400">
                              {signal?.signal_action ?? item.reason}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {signal ? (
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getSignalClass(
                              signal.signal
                            )}`}
                          >
                            {getSignalIcon(signal.signal)}
                            {signal.signal_label}
                          </span>
                        ) : (
                          <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-400">
                            No Signal
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getQualityClass(
                            item.quality
                          )}`}
                        >
                          {item.quality ?? "unknown"}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right font-semibold text-emerald-400">
                        {formatGold(item.current_price)}
                      </td>

                      <td className="px-6 py-4 text-right font-semibold text-slate-200">
                        {item.volume.toLocaleString()}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span
                          className={`font-bold ${getScoreClass(
                            item.opportunity_score
                          )}`}
                        >
                          {formatScore(item.opportunity_score)}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getRiskClass(
                            item.risk_level
                          )}`}
                        >
                          {item.risk_level}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}