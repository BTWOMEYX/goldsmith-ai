import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ArrowUpDown,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
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

type WatchlistItem = TrackedItem & {
  realm_id: number;
  realm_name: string;
  saved_at: string | null;
};

type DashboardResponse = {
  status: string;
  connected_realm_id: number;
  realm: string;
  item_count: number;
  items: TrackedItem[];
};

type WatchlistResponse = {
  status: string;
  item_count: number;
  items: WatchlistItem[];
};

const API_BASE_URL = "http://127.0.0.1:8000/api";

const REALMS = [
  { id: 11, name: "US - Illidan" },
  { id: 4, name: "US - Area 52" },
  { id: 12, name: "US - Sargeras" },
  { id: 53, name: "US - Tichondrius" },
];

const QUALITY_FILTERS = [
  "All",
  "Poor",
  "Common",
  "Uncommon",
  "Rare",
  "Epic",
  "Legendary",
  "Unknown",
];

const RISK_FILTERS = ["All", "Low", "Medium", "High"];

const SORT_OPTIONS = [
  { value: "score-desc", label: "Best score" },
  { value: "price-desc", label: "Highest price" },
  { value: "volume-desc", label: "Highest volume" },
  { value: "listings-desc", label: "Most listings" },
  { value: "risk-asc", label: "Lowest risk" },
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

function getRiskRank(riskLevel: string) {
  switch (riskLevel.toLowerCase()) {
    case "low":
      return 1;
    case "medium":
      return 2;
    case "high":
      return 3;
    default:
      return 4;
  }
}

function formatGold(value: number) {
  return `${Math.round(value).toLocaleString()}g`;
}

function formatScore(value: number) {
  return `${value.toFixed(1)}/100`;
}

export default function MarketScanner() {
  const [realm, setRealm] = useState(11);
  const [realmName, setRealmName] = useState("Illidan");
  const [items, setItems] = useState<TrackedItem[]>([]);
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [qualityFilter, setQualityFilter] = useState("All");
  const [riskFilter, setRiskFilter] = useState("All");
  const [sortMode, setSortMode] = useState("score-desc");

  async function loadScannerData(realmId: number) {
    try {
      setLoading(true);

      const response = await axios.get<DashboardResponse>(
        `${API_BASE_URL}/dashboard?connected_realm_id=${realmId}`
      );

      setRealmName(response.data.realm);
      setItems(response.data.items ?? []);
      setError("");
    } catch {
      setError("Unable to connect to backend.");
    } finally {
      setLoading(false);
    }
  }

  async function loadWatchlist() {
    try {
      setWatchlistLoading(true);

      const response = await axios.get<WatchlistResponse>(
        `${API_BASE_URL}/watchlist`
      );

      setWatchlistItems(response.data.items ?? []);
    } catch {
      setError("Unable to load backend watchlist.");
    } finally {
      setWatchlistLoading(false);
    }
  }

  async function syncRealm() {
    try {
      setSyncing(true);
      setError("");

      await axios.post(
        `${API_BASE_URL}/sync-auctions?connected_realm_id=${realm}`
      );

      await loadScannerData(realm);
      await loadWatchlist();
    } catch {
      setError("Auction sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  function isItemWatched(item: TrackedItem) {
    return watchlistItems.some(
      (watchlistItem) =>
        watchlistItem.item_id === item.item_id &&
        watchlistItem.realm_id === realm
    );
  }

  async function toggleWatchlist(item: TrackedItem) {
    try {
      setWatchlistLoading(true);
      setError("");

      const alreadyWatched = isItemWatched(item);

      if (alreadyWatched) {
        await axios.delete(
          `${API_BASE_URL}/watchlist/${realm}/${item.item_id}`
        );
      } else {
        await axios.post(`${API_BASE_URL}/watchlist`, {
          item_id: item.item_id,
          realm_id: realm,
          realm_name: realmName,
          name: item.name,
          current_price: item.current_price,
          volume: item.volume,
          listing_count: item.listing_count,
          opportunity_score: item.opportunity_score,
          risk_level: item.risk_level,
          reason: item.reason,
          icon_url: item.icon_url,
          quality: item.quality,
          profit_margin: item.profit_margin,
        });
      }

      await loadWatchlist();
    } catch {
      setError("Unable to update watchlist.");
    } finally {
      setWatchlistLoading(false);
    }
  }

  useEffect(() => {
    loadWatchlist();
  }, []);

  useEffect(() => {
    loadScannerData(realm);
  }, [realm]);

  const filteredItems = useMemo(() => {
    const normalisedSearch = searchTerm.trim().toLowerCase();

    const filtered = items.filter((item) => {
      const itemQuality = item.quality ?? "unknown";
      const itemRisk = item.risk_level ?? "unknown";

      const matchesSearch =
        normalisedSearch.length === 0 ||
        item.name.toLowerCase().includes(normalisedSearch) ||
        item.item_id.toString().includes(normalisedSearch) ||
        itemQuality.toLowerCase().includes(normalisedSearch) ||
        itemRisk.toLowerCase().includes(normalisedSearch);

      const matchesQuality =
        qualityFilter === "All" ||
        itemQuality.toLowerCase() === qualityFilter.toLowerCase();

      const matchesRisk =
        riskFilter === "All" ||
        itemRisk.toLowerCase() === riskFilter.toLowerCase();

      return matchesSearch && matchesQuality && matchesRisk;
    });

    return [...filtered].sort((a, b) => {
      switch (sortMode) {
        case "price-desc":
          return b.current_price - a.current_price;
        case "volume-desc":
          return b.volume - a.volume;
        case "listings-desc":
          return b.listing_count - a.listing_count;
        case "risk-asc":
          return getRiskRank(a.risk_level) - getRiskRank(b.risk_level);
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "score-desc":
        default:
          return b.opportunity_score - a.opportunity_score;
      }
    });
  }, [items, searchTerm, qualityFilter, riskFilter, sortMode]);

  const averageScore = useMemo(() => {
    if (!filteredItems.length) {
      return 0;
    }

    return (
      filteredItems.reduce((sum, item) => sum + item.opportunity_score, 0) /
      filteredItems.length
    );
  }, [filteredItems]);

  const totalVolume = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + item.volume, 0);
  }, [filteredItems]);

  const bestItem = useMemo(() => {
    if (!filteredItems.length) {
      return null;
    }

    return [...filteredItems].sort(
      (a, b) => b.opportunity_score - a.opportunity_score
    )[0];
  }, [filteredItems]);

  const lowOrMediumRiskCount = useMemo(() => {
    return filteredItems.filter((item) => {
      const risk = item.risk_level.toLowerCase();
      return risk === "low" || risk === "medium";
    }).length;
  }, [filteredItems]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">
            Market Scanner
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Search, filter and sort live opportunities from {realmName}.
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
            onClick={syncRealm}
            disabled={syncing}
            className="flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
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
          <p className="text-sm text-slate-400">Visible Results</p>

          <h3 className="mt-2 text-4xl font-bold text-white">
            {loading ? "..." : filteredItems.length}
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            From {items.length} tracked opportunities
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Best Match</p>

          <h3 className="mt-2 truncate text-lg font-bold text-emerald-400">
            {bestItem?.name ?? "-"}
          </h3>

          <p className="mt-1 text-sm text-slate-400">
            {bestItem ? formatScore(bestItem.opportunity_score) : ""}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Total Visible Volume</p>

          <h3 className="mt-2 text-4xl font-bold text-amber-400">
            {loading ? "..." : totalVolume.toLocaleString()}
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Combined quantity across results
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Average Score</p>

          <h3
            className={`mt-2 text-4xl font-bold ${getScoreClass(
              averageScore
            )}`}
          >
            {loading ? "..." : formatScore(averageScore)}
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            {lowOrMediumRiskCount} lower-risk results
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <SlidersHorizontal size={16} />
          Scanner Controls
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
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
            value={qualityFilter}
            onChange={(event) => setQualityFilter(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 outline-none transition focus:border-amber-500"
          >
            {QUALITY_FILTERS.map((quality) => (
              <option key={quality} value={quality}>
                Quality: {quality}
              </option>
            ))}
          </select>

          <select
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 outline-none transition focus:border-amber-500"
          >
            {RISK_FILTERS.map((risk) => (
              <option key={risk} value={risk}>
                Risk: {risk}
              </option>
            ))}
          </select>

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
              Scanner Results
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Filtered live opportunities ready for manual review.
            </p>
          </div>

          <span className="flex items-center gap-2 rounded-full border border-blue-800 bg-blue-950/50 px-3 py-1 text-xs font-semibold text-blue-400">
            <ArrowUpDown size={13} />
            {filteredItems.length} results
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Item</th>
                <th className="px-6 py-3 text-left font-medium">Quality</th>
                <th className="px-6 py-3 text-right font-medium">Price</th>
                <th className="px-6 py-3 text-right font-medium">Volume</th>
                <th className="px-6 py-3 text-right font-medium">Listings</th>
                <th className="px-6 py-3 text-right font-medium">Score</th>
                <th className="px-6 py-3 text-left font-medium">Risk</th>
                <th className="px-6 py-3 text-right font-medium">Watch</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    Loading scanner data...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    No matching opportunities found.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const watched = isItemWatched(item);

                  return (
                    <tr
                      key={item.id}
                      className="border-t border-slate-800 transition hover:bg-slate-800/40"
                      title={item.reason ?? ""}
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
                              Item #{item.item_id}
                            </p>

                            <p className="mt-1 max-w-2xl truncate text-xs text-slate-400">
                              {item.reason}
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

                      <td className="px-6 py-4 text-right font-semibold text-emerald-400">
                        {formatGold(item.current_price)}
                      </td>

                      <td className="px-6 py-4 text-right font-semibold text-slate-200">
                        {item.volume.toLocaleString()}
                      </td>

                      <td className="px-6 py-4 text-right text-slate-400">
                        {item.listing_count.toLocaleString()}
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

                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => toggleWatchlist(item)}
                          disabled={watchlistLoading}
                          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            watched
                              ? "border-amber-700 bg-amber-950/40 text-amber-400 hover:bg-amber-900/40"
                              : "border-slate-700 bg-slate-950 text-slate-300 hover:border-amber-700 hover:text-amber-400"
                          }`}
                        >
                          <Star
                            size={14}
                            className={watched ? "fill-current" : ""}
                          />

                          {watched ? "Watching" : "Watch"}
                        </button>
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