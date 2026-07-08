import { useEffect, useMemo, useState } from "react";
import axios from "axios";

type TrackedItem = {
  id: number;
  item_id: number;
  name: string;
  current_price: number;
  profit_margin: number;
  icon_url: string | null;
  quality: string | null;
};

type DashboardResponse = {
  status: string;
  connected_realm_id: number;
  realm: string;
  item_count: number;
  items: TrackedItem[];
};

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

function formatGold(value: number) {
  return `${Math.round(value).toLocaleString()}g`;
}

export default function Dashboard() {
  const [realm, setRealm] = useState(11);
  const [realmName, setRealmName] = useState("Illidan");
  const [items, setItems] = useState<TrackedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  async function loadDashboard(realmId: number) {
    try {
      setLoading(true);

      const response = await axios.get<DashboardResponse>(
        `http://127.0.0.1:8000/api/dashboard?connected_realm_id=${realmId}`
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

  async function syncRealm() {
    try {
      setSyncing(true);
      setError("");

      await axios.post(
        `http://127.0.0.1:8000/api/sync-auctions?connected_realm_id=${realm}`
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

  const totalItems = items.length;

  const bestItem = useMemo(() => {
    if (!items.length) return null;

    return [...items].sort(
      (a, b) => b.profit_margin - a.profit_margin
    )[0];
  }, [items]);

  const averagePrice = useMemo(() => {
    if (!items.length) return 0;

    return (
      items.reduce((sum, item) => sum + item.current_price, 0) /
      items.length
    );
  }, [items]);

  const totalEstimatedProfit = useMemo(() => {
    return items.reduce((sum, item) => sum + item.profit_margin, 0);
  }, [items]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">
            {realmName} Market Overview
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Live auction intelligence generated from the Blizzard API.
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
            className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
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
          <p className="text-sm text-slate-400">Tracked Items</p>

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
            {bestItem ? `+${formatGold(bestItem.profit_margin)} est.` : ""}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Average Price</p>

          <h3 className="mt-2 text-4xl font-bold text-amber-400">
            {loading ? "..." : formatGold(averagePrice)}
          </h3>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">Estimated Profit Pool</p>

          <h3 className="mt-2 text-4xl font-bold text-blue-400">
            {loading ? "..." : formatGold(totalEstimatedProfit)}
          </h3>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Market Opportunities
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Top auction opportunities ranked by estimated profit.
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
                <th className="px-6 py-3 text-left font-medium">Quality</th>
                <th className="px-6 py-3 text-left font-medium">Item ID</th>
                <th className="px-6 py-3 text-right font-medium">Market Price</th>
                <th className="px-6 py-3 text-right font-medium">Est. Profit</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    Loading market data...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    No auction data yet. Click Sync Auctions to begin.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
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
                            Blizzard Item #{item.item_id}
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

                    <td className="px-6 py-4 font-mono text-xs text-slate-500">
                      {item.item_id}
                    </td>

                    <td className="px-6 py-4 text-right font-semibold text-emerald-400">
                      {formatGold(item.current_price)}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <span className="rounded-lg border border-blue-800 bg-blue-950/40 px-3 py-1 font-semibold text-blue-400">
                        +{formatGold(item.profit_margin)}
                      </span>
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