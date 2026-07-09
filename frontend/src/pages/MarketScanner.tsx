import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock,
  Database,
  Eye,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
  Trash2,
} from "lucide-react";

import RealmSelect from "../components/RealmSelect";
import { getGlobalRealmId } from "../utils/globalRealm";

type MarketItem = {
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
  item_class: string | null;
  item_subclass: string | null;
  goldsmith_category: string;
  profit_margin: number;
};

type DashboardResponse = {
  status: string;
  connected_realm_id: number;
  realm: string;
  item_count: number;
  items: MarketItem[];
};

type WatchlistItem = {
  id: number;
  item_id: number;
  realm_id: number;
  realm_name: string;
  name: string;
  current_price: number;
  volume: number;
  listing_count: number;
  opportunity_score: number;
  risk_level: string;
  reason: string | null;
  icon_url: string | null;
  quality: string | null;
  item_class: string | null;
  item_subclass: string | null;
  goldsmith_category: string;
  profit_margin: number;
  saved_at: string | null;
};

type WatchlistResponse = {
  status: string;
  item_count: number;
  items: WatchlistItem[];
};

type CaptureItem = {
  id: number;
  item_id: number;
  realm_id: number;
  realm_name: string;
  scan_mode: string;
  min_price: number;
  average_price: number;
  total_market_value: number;
  volume: number;
  listing_count: number;
  created_at: string | null;
};

type CaptureSummaryResponse = {
  status: string;
  connected_realm_id: number;
  realm: string;
  latest_capture_at: string | null;
  item_count: number;
  total_volume: number;
  total_market_value: number;
  items: CaptureItem[];
};

const API_BASE_URL = "http://127.0.0.1:8000/api";

const EMPTY_CAPTURE_SUMMARY: CaptureSummaryResponse = {
  status: "Success",
  connected_realm_id: 11,
  realm: "Illidan",
  latest_capture_at: null,
  item_count: 0,
  total_volume: 0,
  total_market_value: 0,
  items: [],
};

const CATEGORY_FILTERS = [
  "All",
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

const RISK_FILTERS = ["All", "Low", "Medium", "High", "Unknown"];

const SORT_OPTIONS = [
  { value: "score-desc", label: "Best score" },
  { value: "price-desc", label: "Highest price" },
  { value: "price-asc", label: "Lowest price" },
  { value: "volume-desc", label: "Highest volume" },
  { value: "listings-desc", label: "Most listings" },
  { value: "risk-asc", label: "Lowest risk" },
  { value: "category-asc", label: "Category" },
  { value: "name-asc", label: "Item name" },
];

function getCategoryClass(category: string) {
  switch (category) {
    case "Crafting Materials":
      return "text-emerald-300 border-emerald-800 bg-emerald-950/40";
    case "Consumables":
      return "text-blue-300 border-blue-800 bg-blue-950/40";
    case "Enchants":
      return "text-purple-300 border-purple-800 bg-purple-950/40";
    case "Gems":
      return "text-cyan-300 border-cyan-800 bg-cyan-950/40";
    case "Glyphs":
      return "text-pink-300 border-pink-800 bg-pink-950/40";
    case "Recipes / Plans":
      return "text-orange-300 border-orange-800 bg-orange-950/40";
    case "Battle Pets":
      return "text-lime-300 border-lime-800 bg-lime-950/40";
    case "Gear / Transmog":
      return "text-amber-300 border-amber-800 bg-amber-950/40";
    case "Rare / Collector Items":
      return "text-fuchsia-300 border-fuchsia-800 bg-fuchsia-950/40";
    default:
      return "text-slate-400 border-slate-700 bg-slate-900";
  }
}

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

function formatGold(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${Math.round(value).toLocaleString()}g`;
}

function formatScore(value: number) {
  return `${value.toFixed(1)}/100`;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "No capture yet";
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

function getWatchlistKey(realmId: number, itemId: number) {
  return `${realmId}-${itemId}`;
}

export default function MarketScanner() {
  const [realm, setRealm] = useState(() => getGlobalRealmId());
  const [realmName, setRealmName] = useState("Illidan");
  const [items, setItems] = useState<MarketItem[]>([]);
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [captureSummary, setCaptureSummary] =
    useState<CaptureSummaryResponse>(EMPTY_CAPTURE_SUMMARY);

  const [loading, setLoading] = useState(true);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [updatingWatchlist, setUpdatingWatchlist] = useState(false);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [qualityFilter, setQualityFilter] = useState("All");
  const [riskFilter, setRiskFilter] = useState("All");
  const [sortMode, setSortMode] = useState("score-desc");

  async function loadCaptureSummary(realmId: number) {
    try {
      setCaptureLoading(true);

      const response = await axios.get<CaptureSummaryResponse>(
        `${API_BASE_URL}/capture/summary?connected_realm_id=${realmId}`,
      );

      setCaptureSummary(response.data ?? EMPTY_CAPTURE_SUMMARY);
    } catch {
      setCaptureSummary({
        ...EMPTY_CAPTURE_SUMMARY,
        connected_realm_id: realmId,
        realm: realmName,
      });
    } finally {
      setCaptureLoading(false);
    }
  }

  async function loadWatchlistOnly() {
    const response = await axios.get<WatchlistResponse>(
      `${API_BASE_URL}/watchlist`,
    );

    setWatchlistItems(response.data.items ?? []);
  }

  async function loadMarketData(realmId: number) {
    try {
      setLoading(true);

      const [dashboardResponse, watchlistResponse, captureResponse] =
        await Promise.all([
          axios.get<DashboardResponse>(
            `${API_BASE_URL}/dashboard?connected_realm_id=${realmId}`,
          ),
          axios.get<WatchlistResponse>(`${API_BASE_URL}/watchlist`),
          axios.get<CaptureSummaryResponse>(
            `${API_BASE_URL}/capture/summary?connected_realm_id=${realmId}`,
          ),
        ]);

      setRealmName(dashboardResponse.data.realm);
      setItems(dashboardResponse.data.items ?? []);
      setWatchlistItems(watchlistResponse.data.items ?? []);
      setCaptureSummary(captureResponse.data ?? EMPTY_CAPTURE_SUMMARY);
      setError("");
    } catch {
      setError("Unable to load market scanner data.");
    } finally {
      setLoading(false);
    }
  }

  async function addToWatchlist(item: MarketItem) {
    try {
      setUpdatingWatchlist(true);
      setError("");

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
        item_class: item.item_class,
        item_subclass: item.item_subclass,
        goldsmith_category: item.goldsmith_category,
        profit_margin: item.profit_margin,
      });

      await loadWatchlistOnly();
    } catch {
      setError("Unable to add item to watchlist.");
    } finally {
      setUpdatingWatchlist(false);
    }
  }

  async function removeFromWatchlist(item: MarketItem) {
    try {
      setUpdatingWatchlist(true);
      setError("");

      await axios.delete(`${API_BASE_URL}/watchlist/${realm}/${item.item_id}`);

      await loadWatchlistOnly();
    } catch {
      setError("Unable to remove item from watchlist.");
    } finally {
      setUpdatingWatchlist(false);
    }
  }

  useEffect(() => {
    loadMarketData(realm);
  }, [realm]);

  useEffect(() => {
    function handleGlobalSyncComplete() {
      loadMarketData(realm);
    }

    window.addEventListener("goldsmith-sync-complete", handleGlobalSyncComplete);

    return () => {
      window.removeEventListener(
        "goldsmith-sync-complete",
        handleGlobalSyncComplete,
      );
    };
  }, [realm]);

  const watchedKeys = useMemo(() => {
    return new Set(
      watchlistItems.map((watchlistItem) =>
        getWatchlistKey(watchlistItem.realm_id, watchlistItem.item_id),
      ),
    );
  }, [watchlistItems]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();

    items.forEach((item) => {
      const category = item.goldsmith_category || "Unknown / Other";
      counts.set(category, (counts.get(category) ?? 0) + 1);
    });

    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalisedSearch = searchTerm.trim().toLowerCase();

    const filtered = items.filter((item) => {
      const itemQuality = item.quality ?? "unknown";
      const itemRisk = item.risk_level ?? "unknown";
      const itemCategory = item.goldsmith_category ?? "Unknown / Other";
      const itemClass = item.item_class ?? "";
      const itemSubclass = item.item_subclass ?? "";

      const matchesSearch =
        normalisedSearch.length === 0 ||
        item.name.toLowerCase().includes(normalisedSearch) ||
        item.item_id.toString().includes(normalisedSearch) ||
        itemQuality.toLowerCase().includes(normalisedSearch) ||
        itemRisk.toLowerCase().includes(normalisedSearch) ||
        itemCategory.toLowerCase().includes(normalisedSearch) ||
        itemClass.toLowerCase().includes(normalisedSearch) ||
        itemSubclass.toLowerCase().includes(normalisedSearch);

      const matchesCategory =
        categoryFilter === "All" || itemCategory === categoryFilter;

      const matchesQuality =
        qualityFilter === "All" ||
        itemQuality.toLowerCase() === qualityFilter.toLowerCase();

      const matchesRisk =
        riskFilter === "All" ||
        itemRisk.toLowerCase() === riskFilter.toLowerCase();

      return matchesSearch && matchesCategory && matchesQuality && matchesRisk;
    });

    return [...filtered].sort((a, b) => {
      switch (sortMode) {
        case "price-desc":
          return b.current_price - a.current_price;
        case "price-asc":
          return a.current_price - b.current_price;
        case "volume-desc":
          return b.volume - a.volume;
        case "listings-desc":
          return b.listing_count - a.listing_count;
        case "risk-asc":
          return getRiskRank(a.risk_level) - getRiskRank(b.risk_level);
        case "category-asc":
          return (
            a.goldsmith_category.localeCompare(b.goldsmith_category) ||
            b.opportunity_score - a.opportunity_score
          );
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "score-desc":
        default:
          return b.opportunity_score - a.opportunity_score;
      }
    });
  }, [
    items,
    searchTerm,
    categoryFilter,
    qualityFilter,
    riskFilter,
    sortMode,
  ]);

  const bestItem = useMemo(() => {
    if (!items.length) {
      return null;
    }

    return [...items].sort(
      (a, b) => b.opportunity_score - a.opportunity_score,
    )[0];
  }, [items]);

  const lowRiskCount = useMemo(() => {
    return items.filter((item) => item.risk_level.toLowerCase() === "low")
      .length;
  }, [items]);

  const watchedVisibleCount = useMemo(() => {
    return filteredItems.filter((item) =>
      watchedKeys.has(getWatchlistKey(realm, item.item_id)),
    ).length;
  }, [filteredItems, watchedKeys, realm]);

  const totalVisibleValue = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + item.current_price, 0);
  }, [filteredItems]);

  const topCapturedItems = useMemo(() => {
    return captureSummary.items.slice(0, 8);
  }, [captureSummary]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Market Scanner</h2>

          <p className="mt-1 text-sm text-slate-400">
            Filter opportunities by category, risk and quality. Global Sync
            handles all Quick Scan and Full Scan runs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <RealmSelect value={realm} onChange={setRealm} />

          <button
            type="button"
            onClick={() => loadMarketData(realm)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh Data
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
          <p className="text-sm text-slate-400">Realm</p>

          <h3 className="mt-2 truncate text-2xl font-bold text-white">
            {realmName}
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Connected Realm #{realm}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Scanner Results</p>

          <h3 className="mt-2 text-4xl font-bold text-blue-400">
            {loading ? "..." : filteredItems.length}
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            From {items.length} tracked items
          </p>
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
          <p className="text-sm text-slate-400">Low Risk Items</p>

          <h3 className="mt-2 text-4xl font-bold text-emerald-400">
            {loading ? "..." : lowRiskCount}
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            {watchedVisibleCount} visible watched
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <SlidersHorizontal size={16} />
          Category Engine
        </div>

        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
          {CATEGORY_FILTERS.filter((category) => category !== "All").map(
            (category) => (
              <button
                key={category}
                type="button"
                onClick={() =>
                  setCategoryFilter(
                    categoryFilter === category ? "All" : category,
                  )
                }
                className={`rounded-lg border px-3 py-3 text-left transition ${
                  categoryFilter === category
                    ? getCategoryClass(category)
                    : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <p className="text-xs font-semibold">{category}</p>

                <p className="mt-1 text-lg font-bold">
                  {categoryCounts.get(category) ?? 0}
                </p>
              </button>
            ),
          )}
        </div>
      </div>

      <div className="rounded-xl border border-blue-900/70 bg-blue-950/20 p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Database size={18} className="text-blue-400" />

              <h2 className="text-xl font-semibold text-white">
                Market Capture / Data Depth
              </h2>
            </div>

            <p className="mt-2 text-sm text-slate-400">
              Background market capture stores broad auction-house aggregates.
              Scanner results remain filtered to cleaner opportunities.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadCaptureSummary(realm)}
            disabled={captureLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-800 bg-blue-950/50 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-900/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={15}
              className={captureLoading ? "animate-spin" : ""}
            />
            Refresh Capture
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
              <Database size={14} />
              Captured Items
            </div>

            <p className="text-3xl font-bold text-blue-400">
              {captureLoading
                ? "..."
                : captureSummary.item_count.toLocaleString()}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Latest usable aggregated rows
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
              <BarChart3 size={14} />
              Total Volume
            </div>

            <p className="text-3xl font-bold text-emerald-400">
              {captureLoading
                ? "..."
                : captureSummary.total_volume.toLocaleString()}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Total quantity captured
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
              <Activity size={14} />
              Market Value
            </div>

            <p className="text-3xl font-bold text-amber-400">
              {captureLoading
                ? "..."
                : formatGold(captureSummary.total_market_value)}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Captured aggregate value
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
              <Clock size={14} />
              Latest Capture
            </div>

            <p className="text-lg font-bold text-white">
              {formatDateTime(captureSummary.latest_capture_at)}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {captureSummary.realm || realmName}
            </p>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <h3 className="text-sm font-semibold text-white">
              Top Captured Market Rows
            </h3>

            <span className="rounded-full border border-blue-800 bg-blue-950/50 px-3 py-1 text-xs text-blue-300">
              Top {topCapturedItems.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-950 text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Item ID</th>
                  <th className="px-4 py-3 text-left font-medium">Mode</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Min Price
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    Avg Price
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Volume</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Listings
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    Market Value
                  </th>
                </tr>
              </thead>

              <tbody>
                {topCapturedItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No capture data yet. Run Global Sync above.
                    </td>
                  </tr>
                ) : (
                  topCapturedItems.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-slate-800 transition hover:bg-slate-900"
                    >
                      <td className="px-4 py-3 font-semibold text-white">
                        #{item.item_id}
                      </td>

                      <td className="px-4 py-3">
                        <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold capitalize text-slate-300">
                          {item.scan_mode}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right font-semibold text-emerald-400">
                        {formatGold(item.min_price)}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-300">
                        {formatGold(item.average_price)}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-300">
                        {item.volume.toLocaleString()}
                      </td>

                      <td className="px-4 py-3 text-right text-slate-300">
                        {item.listing_count.toLocaleString()}
                      </td>

                      <td className="px-4 py-3 text-right font-semibold text-amber-400">
                        {formatGold(item.total_market_value)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <SlidersHorizontal size={16} />
          Scanner Controls
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />

            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search item, ID, category or risk..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-10 pr-4 text-sm text-white outline-none transition focus:border-amber-500"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 outline-none transition focus:border-amber-500"
          >
            {CATEGORY_FILTERS.map((category) => (
              <option key={category} value={category}>
                Category: {category}
              </option>
            ))}
          </select>

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

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>{filteredItems.length} visible items</span>
          <span>·</span>
          <span>{watchedVisibleCount} visible watched</span>
          <span>·</span>
          <span>{formatGold(totalVisibleValue)} visible market value</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Scanner Results
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Filtered auction opportunities from {realmName}.
            </p>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-blue-800 bg-blue-950/50 px-3 py-1 text-xs font-semibold text-blue-400">
            <Eye size={13} />
            {filteredItems.length} visible
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Item</th>
                <th className="px-6 py-3 text-left font-medium">Category</th>
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
                    colSpan={9}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    Loading scanner results...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    No matching opportunities. Run Global Sync or adjust
                    filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isWatched = watchedKeys.has(
                    getWatchlistKey(realm, item.item_id),
                  );

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
                              Item #{item.item_id} · {realmName}
                            </p>

                            <p className="mt-1 max-w-xl truncate text-xs text-slate-400">
                              {item.item_class ?? "Unknown class"}
                              {item.item_subclass
                                ? ` · ${item.item_subclass}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getCategoryClass(
                            item.goldsmith_category,
                          )}`}
                        >
                          {item.goldsmith_category}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getQualityClass(
                            item.quality,
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

                      <td className="px-6 py-4 text-right text-slate-300">
                        {item.listing_count.toLocaleString()}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span
                          className={`font-bold ${getScoreClass(
                            item.opportunity_score,
                          )}`}
                        >
                          {formatScore(item.opportunity_score)}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getRiskClass(
                            item.risk_level,
                          )}`}
                        >
                          {item.risk_level}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        {isWatched ? (
                          <button
                            type="button"
                            onClick={() => removeFromWatchlist(item)}
                            disabled={updatingWatchlist}
                            className="inline-flex items-center gap-2 rounded-lg border border-red-900 bg-red-950/30 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-900/40 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 size={14} />
                            Remove
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => addToWatchlist(item)}
                            disabled={updatingWatchlist}
                            className="inline-flex items-center gap-2 rounded-lg border border-amber-800 bg-amber-950/40 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Star size={14} />
                            Watch
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {items.length > 0 && (
        <div className="rounded-xl border border-emerald-800 bg-emerald-950/20 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 text-emerald-400" size={18} />

            <div>
              <h3 className="font-semibold text-emerald-300">
                Category Engine active
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                GoldSmith now scores and filters opportunities by market type,
                so fast-moving items and slow-margin items are handled
                differently.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}