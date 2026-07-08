import { useEffect, useMemo, useState } from "react";
import axios from "axios";

type TrackedItem = {
  id: number;
  item_id: number;
  name: string;
  current_price: number;
  profit_margin: number;
};

type DashboardResponse = {
  status: string;
  items: TrackedItem[];
};

const REALMS = [
  { id: 11, name: "US - Illidan" },
  { id: 4, name: "US - Area 52" },
  { id: 12, name: "US - Sargeras" },
  { id: 53, name: "US - Tichondrius" },
];

export default function Dashboard() {
  const [realm, setRealm] = useState(11);
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

  return (
    <div className="space-y-8">

      {/* Top Controls */}

      <div className="flex flex-wrap items-center justify-between gap-4">

        <select
          value={realm}
          onChange={(e) => setRealm(Number(e.target.value))}
          className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2"
        >
          {REALMS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        <button
          onClick={syncRealm}
          disabled={syncing}
          className="rounded-lg bg-amber-500 px-5 py-2 font-semibold text-black hover:bg-amber-400 disabled:opacity-60"
        >
          {syncing ? "Syncing..." : "Sync Auctions"}
        </button>

      </div>

      {error && (
        <div className="rounded-lg border border-red-700 bg-red-950 p-4 text-red-300">
          {error}
        </div>
      )}

      {/* Stats */}

      <div className="grid gap-6 md:grid-cols-3">

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">
            Tracked Items
          </p>

          <h2 className="mt-2 text-4xl font-bold text-white">
            {loading ? "..." : totalItems}
          </h2>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">
            Best Opportunity
          </p>

          <h2 className="mt-2 text-xl font-bold text-emerald-400">
            {bestItem?.name ?? "-"}
          </h2>

          <p className="mt-1 text-slate-400">
            {bestItem
              ? `${bestItem.profit_margin.toFixed(1)}% margin`
              : ""}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-sm text-slate-400">
            Average Market Price
          </p>

          <h2 className="mt-2 text-4xl font-bold text-amber-400">
            {loading ? "..." : `${averagePrice.toFixed(0)}g`}
          </h2>
        </div>

      </div>

      {/* Market Table */}

      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">

        <div className="border-b border-slate-800 px-6 py-4">

          <h2 className="text-xl font-semibold">
            Market Opportunities
          </h2>

        </div>

        <table className="w-full">

          <thead className="bg-slate-950 text-slate-400">

            <tr>

              <th className="px-6 py-3 text-left">
                Item
              </th>

              <th className="px-6 py-3 text-left">
                Item ID
              </th>

              <th className="px-6 py-3 text-right">
                Price
              </th>

              <th className="px-6 py-3 text-right">
                Margin
              </th>

            </tr>

          </thead>

          <tbody>

            {loading ? (
              <tr>

                <td
                  colSpan={4}
                  className="py-12 text-center text-slate-500"
                >
                  Loading...
                </td>

              </tr>
            ) : items.length === 0 ? (
              <tr>

                <td
                  colSpan={4}
                  className="py-12 text-center text-slate-500"
                >
                  No auction data yet.

                  <br />

                  Click <strong>Sync Auctions</strong> to begin.
                </td>

              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-slate-800 hover:bg-slate-800/40"
                >
                  <td className="px-6 py-4 font-medium">
                    {item.name}
                  </td>

                  <td className="px-6 py-4 text-slate-400">
                    {item.item_id}
                  </td>

                  <td className="px-6 py-4 text-right text-emerald-400">
                    {item.current_price.toLocaleString()}g
                  </td>

                  <td className="px-6 py-4 text-right">

                    <span className="rounded bg-emerald-900/30 px-2 py-1 text-emerald-400">
                      {item.profit_margin.toFixed(1)}%
                    </span>

                  </td>

                </tr>
              ))
            )}

          </tbody>

        </table>

      </div>

    </div>
  );
}