import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  History,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

type HistorySummaryItem = {
  item_id: number;
  realm_id: number;
  realm_name: string;
  name: string;
  current_price: number;
  previous_price: number | null;
  price_change: number;
  price_change_percent: number;
  opportunity_score: number;
  previous_score: number | null;
  score_change: number;
  volume: number;
  listing_count: number;
  risk_level: string;
  reason: string | null;
  icon_url: string | null;
  quality: string | null;
  snapshot_count: number;
  last_seen: string | null;
};

type HistorySummaryResponse = {
  status: string;
  connected_realm_id: number;
  realm: string;
  snapshot_count: number;
  tracked_item_count: number;
  mover_count: number;
  biggest_gain: HistorySummaryItem | null;
  biggest_drop: HistorySummaryItem | null;
  items: HistorySummaryItem[];
};

const API_BASE_URL = "http://127.0.0.1:8000/api";

const REALMS = [
  { id: 11, name: "US - Illidan" },
  { id: 4, name: "US - Area 52" },
  { id: 12, name: "US - Sargeras" },
  { id: 53, name: "US - Tichondrius" },
];

const SORT_OPTIONS = [
  { value: "movement-desc", label: "Biggest movement" },
  { value: "gain-desc", label: "Biggest gain" },
  { value: "drop-asc", label: "Biggest drop" },
  { value: "score-desc", label: "Best score" },
  { value: "price-desc", label: "Highest price" },
  { value: "name-asc", label: "Item name" },
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

function getMovementClass(value: number) {
  if (value > 0) {
    return "text-emerald-400";
  }

  if (value < 0) {
    return "text-red-400";
  }

  return "text-slate-400";
}

function formatGold(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${Math.round(value).toLocaleString()}g`;
}

function formatPercent(value: number) {
  if (value > 0) {
    return `+${value.toFixed(2)}%`;
  }

  return `${value.toFixed(2)}%`;
}

function formatScore(value: number) {
  return `${value.toFixed(1)}/100`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Unknown";
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

export default function Analytics() {
  const [realm, setRealm] = useState(11);
  const [realmName, setRealmName] = useState("Illidan");
  const [items, setItems] = useState<HistorySummaryItem[]>([]);
  const [snapshotCount, setSnapshotCount] = useState(0);
  const [trackedItemCount, setTrackedItemCount] = useState(0);
  const [moverCount, setMoverCount] = useState(0);
  const [biggestGain, setBiggestGain] = useState<HistorySummaryItem | null>(
    null
  );
  const [biggestDrop, setBiggestDrop] = useState<HistorySummaryItem | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [sortMode, setSortMode] = useState("movement-desc");

  async function loadAnalytics(realmId: number) {
    try {
      setLoading(true);

      const response = await axios.get<HistorySummaryResponse>(
        `${API_BASE_URL}/history/summary?connected_realm_id=${realmId}`
      );

      setRealmName(response.data.realm);
      setItems(response.data.items ?? []);
      setSnapshotCount(response.data.snapshot_count ?? 0);
      setTrackedItemCount(response.data.tracked_item_count ?? 0);
      setMoverCount(response.data.mover_count ?? 0);
      setBiggestGain(response.data.biggest_gain ?? null);
      setBiggestDrop(response.data.biggest_drop ?? null);
      setError("");
    } catch {
      setError("Unable to load price history.");
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

      await loadAnalytics(realm);
    } catch {
      setError("Auction sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    loadAnalytics(realm);
  }, [realm]);

  const filteredItems = useMemo(() => {
    const normalisedSearch = searchTerm.trim().toLowerCase();

    const filtered = items.filter((item) => {
      const quality = item.quality ?? "unknown";
      const risk = item.risk_level ?? "unknown";

      return (
        normalisedSearch.length === 0 ||
        item.name.toLowerCase().includes(normalisedSearch) ||
        item.item_id.toString().includes(normalisedSearch) ||
        quality.toLowerCase().includes(normalisedSearch) ||
        risk.toLowerCase().includes(normalisedSearch)
      );
    });

    return [...filtered].sort((a, b) => {
      switch (sortMode) {
        case "gain-desc":
          return b.price_change_percent - a.price_change_percent;
        case "drop-asc":
          return a.price_change_percent - b.price_change_percent;
        case "score-desc":
          return b.opportunity_score - a.opportunity_score;
        case "price-desc":
          return b.current_price - a.current_price;
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "movement-desc":
        default:
          return (
            Math.abs(b.price_change_percent) -
            Math.abs(a.price_change_percent)
          );
      }
    });
  }, [items, searchTerm, sortMode]);

  const averageMovement = useMemo(() => {
    const movers = items.filter((item) => item.snapshot_count > 1);

    if (!movers.length) {
      return 0;
    }

    return (
      movers.reduce(
        (sum, item) => sum + Math.abs(item.price_change_percent),
        0
      ) / movers.length
    );
  }, [items]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">
            Price History Analytics
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Track movement between auction sync snapshots for {realmName}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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
            onClick={loadAnalytics.bind(null, realm)}
            disabled={loading || syncing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <button
            onClick={syncRealm}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Activity
              size={16}
              className={syncing ? "animate-pulse" : ""}
            />
            {syncing ? "Syncing..." : "Sync Snapshot"}
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
          <p className="text-sm text-slate-400">Snapshots Stored</p>

          <h3 className="mt-2 text-4xl font-bold text-white">
            {loading ? "..." : snapshotCount}
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Across {trackedItemCount} tracked items
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Tracked Movers</p>

          <h3 className="mt-2 text-4xl font-bold text-blue-400">
            {loading ? "..." : moverCount}
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Items with previous snapshots
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Biggest Gain</p>

          <h3 className="mt-2 truncate text-lg font-bold text-emerald-400">
            {biggestGain?.name ?? "-"}
          </h3>

          <p className="mt-1 text-sm text-slate-400">
            {biggestGain
              ? formatPercent(biggestGain.price_change_percent)
              : "Run two syncs to compare"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Average Movement</p>

          <h3 className="mt-2 text-4xl font-bold text-amber-400">
            {loading ? "..." : `${averageMovement.toFixed(2)}%`}
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Absolute average movement
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="text-emerald-400" size={18} />
            <h3 className="font-semibold text-white">Largest Price Gain</h3>
          </div>

          {biggestGain ? (
            <div className="flex items-center gap-4">
              {biggestGain.icon_url ? (
                <img
                  src={biggestGain.icon_url}
                  alt={biggestGain.name}
                  className="h-12 w-12 rounded-lg border border-slate-700"
                />
              ) : (
                <div className="h-12 w-12 rounded-lg border border-slate-700" />
              )}

              <div>
                <p className="font-semibold text-white">
                  {biggestGain.name}
                </p>

                <p className="text-sm text-slate-400">
                  {formatGold(biggestGain.previous_price)} →{" "}
                  {formatGold(biggestGain.current_price)}
                </p>

                <p className="mt-1 text-sm font-bold text-emerald-400">
                  {formatPercent(biggestGain.price_change_percent)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Run at least two syncs to calculate gains.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-4 flex items-center gap-2">
            <TrendingDown className="text-red-400" size={18} />
            <h3 className="font-semibold text-white">Largest Price Drop</h3>
          </div>

          {biggestDrop ? (
            <div className="flex items-center gap-4">
              {biggestDrop.icon_url ? (
                <img
                  src={biggestDrop.icon_url}
                  alt={biggestDrop.name}
                  className="h-12 w-12 rounded-lg border border-slate-700"
                />
              ) : (
                <div className="h-12 w-12 rounded-lg border border-slate-700" />
              )}

              <div>
                <p className="font-semibold text-white">
                  {biggestDrop.name}
                </p>

                <p className="text-sm text-slate-400">
                  {formatGold(biggestDrop.previous_price)} →{" "}
                  {formatGold(biggestDrop.current_price)}
                </p>

                <p className="mt-1 text-sm font-bold text-red-400">
                  {formatPercent(biggestDrop.price_change_percent)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Run at least two syncs to calculate drops.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <History size={16} />
          History Controls
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />

            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search item, ID, quality or risk..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-10 pr-4 text-sm text-white outline-none transition focus:border-amber-500"
            />
          </div>

          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 outline-none transition focus:border-amber-500"
          >
            {SORT_OPTIONS.map((sortOption) => (
              <option key={sortOption.value} value={sortOption.value}>
                Sort: {sortOption.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Price Movement Summary
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Latest snapshot compared with the previous stored snapshot.
            </p>
          </div>

          <span className="rounded-full border border-blue-800 bg-blue-950/50 px-3 py-1 text-xs font-semibold text-blue-400">
            {filteredItems.length} items
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Item</th>
                <th className="px-6 py-3 text-left font-medium">Quality</th>
                <th className="px-6 py-3 text-right font-medium">Previous</th>
                <th className="px-6 py-3 text-right font-medium">Current</th>
                <th className="px-6 py-3 text-right font-medium">Movement</th>
                <th className="px-6 py-3 text-right font-medium">Score</th>
                <th className="px-6 py-3 text-right font-medium">Snapshots</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    Loading price history...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    No price history yet. Run a sync snapshot to begin.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={`${item.realm_id}-${item.item_id}`}
                    className="border-t border-slate-800 transition hover:bg-slate-800/40"
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
                            Item #{item.item_id} · Last seen{" "}
                            {formatDate(item.last_seen)}
                          </p>
                        </div>
                      </div>
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

                    <td className="px-6 py-4 text-right text-slate-400">
                      {formatGold(item.previous_price)}
                    </td>

                    <td className="px-6 py-4 text-right font-semibold text-emerald-400">
                      {formatGold(item.current_price)}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <span
                        className={`inline-flex items-center justify-end gap-1 font-bold ${getMovementClass(
                          item.price_change_percent
                        )}`}
                      >
                        {item.price_change_percent > 0 && (
                          <ArrowUpRight size={14} />
                        )}

                        {item.price_change_percent < 0 && (
                          <ArrowDownRight size={14} />
                        )}

                        {formatPercent(item.price_change_percent)}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right font-semibold text-blue-400">
                      {formatScore(item.opportunity_score)}
                    </td>

                    <td className="px-6 py-4 text-right text-slate-400">
                      {item.snapshot_count}
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