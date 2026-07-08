import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { Search, Bell, ChevronDown, RefreshCw, Package } from 'lucide-react';
import axios from 'axios';

interface TrackedItem {
  id: number;
  item_id: number;
  name: string;
  current_price: number;
  profit_margin: number;
}

interface BackendResponse {
  status: string;
  items: TrackedItem[];
}

// Simple test directory of common retail realms and their linked data targets
const WOW_REALMS = [
  { id: 11, name: "US-Illidan" },
  { id: 4, name: "US-Area 52" },
  { id: 12, name: "US-Sargeras" },
  { id: 53, name: "US-Tichondrius" }
];

export default function Dashboard() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedRealm, setSelectedRealm] = useState(11);
  const [items, setItems] = useState<TrackedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async (realmId: number) => {
    setLoading(true);
    try {
      const response = await axios.get<BackendResponse>(`http://localhost:8000/api/dashboard?connected_realm_id=${realmId}`);
      if (response.data && response.data.items) {
        setItems(response.data.items);
      }
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Could not connect to FastAPI server.');
    } finally {
      setLoading(false);
    }
  };

  const executeDataSync = async () => {
    setSyncing(true);
    try {
      await axios.post(`http://localhost:8000/api/sync-auctions?connected_realm_id=${selectedRealm}`);
      await fetchDashboardData(selectedRealm);
    } catch (err) {
      console.error(err);
      setError('Sync failed to complete.');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(selectedRealm);
  }, [selectedRealm]);

  const totalTrackedCount = items.length;
  const lowestPriceItem = items.reduce((prev, curr) => (prev && prev.current_price > 0 && prev.current_price < curr.current_price ? prev : curr), items[0]);

  return (
    <div className="flex bg-slate-950 min-h-screen text-slate-100 antialiased">
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex items-center justify-between px-6 z-10">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search items, recipes, or markets..." 
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={executeDataSync}
              className={`p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors ${syncing ? 'animate-spin text-amber-500' : ''}`}
              title="Force Auction Sync"
              disabled={syncing}
            >
              <RefreshCw size={18} />
            </button>

            <button className="relative p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500" />
            </button>

            {/* DYNAMIC REALM SELECTOR DROPDOWN */}
            <div className="relative inline-block text-left">
              <select
                value={selectedRealm}
                onChange={(e) => setSelectedRealm(Number(e.target.value))}
                className="appearance-none bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-8 py-1.5 text-sm font-medium hover:bg-slate-700 focus:outline-none cursor-pointer text-slate-200"
              >
                {WOW_REALMS.map((realm) => (
                  <option key={realm.id} value={realm.id}>
                    {realm.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white capitalize">
                  {currentTab === 'dashboard' ? 'Market Overview' : currentTab.replace('-', ' ')}
                </h1>
                <p className="text-sm text-slate-400">
                  Live metrics for {WOW_REALMS.find(r => r.id === selectedRealm)?.name}.
                </p>
              </div>
              {error && (
                <div className="text-xs bg-red-950/50 border border-red-800 text-red-400 px-3 py-1.5 rounded-lg">
                  {error}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Engine Tracking Status</span>
                <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                  {loading ? 'Querying...' : 'Live'}
                </h3>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Lowest Active Value</span>
                <h3 className="text-2xl font-bold text-amber-400 mt-1">
                  {loading ? '...' : lowestPriceItem && lowestPriceItem.current_price > 0 ? `${lowestPriceItem.current_price.toLocaleString()}g` : '0g'}
                </h3>
                <span className="text-xs text-slate-400">{lowestPriceItem && lowestPriceItem.current_price > 0 ? lowestPriceItem.name : 'No sales pricing'}</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Monitored Matrix Bounds</span>
                <h3 className="text-2xl font-bold text-blue-400 mt-1">
                  {loading ? '...' : `${totalTrackedCount} Items`}
                </h3>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Package size={20} className="text-amber-500" />
                <h2 className="text-lg font-semibold text-white">Tracked Commodity Markets</h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-medium">
                      <th className="pb-3 pl-2">Item Name</th>
                      <th className="pb-3">Item ID</th>
                      <th className="pb-3 text-right">Current Market Price</th>
                      <th className="pb-3 text-right pr-2">Profit Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-slate-500 text-center">Loading realm tables...</td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-slate-500 text-center">
                          No price mappings for this realm yet. Click the Sync loop button above to fetch data!
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/30 transition-colors group">
                          <td className="py-3.5 pl-2 font-medium text-slate-200 group-hover:text-amber-400 transition-colors">
                            {item.name}
                          </td>
                          <td className="py-3.5 text-slate-500 font-mono text-xs">{item.item_id}</td>
                          <td className="py-3.5 text-right font-semibold text-emerald-400">
                            {item.current_price > 0 ? `${item.current_price.toLocaleString()}g` : '0g'}
                          </td>
                          <td className="py-3.5 text-right text-slate-400 pr-2">
                            <span className="bg-slate-950 px-2 py-1 rounded text-xs border border-slate-800">
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

          </div>
        </main>
      </div>
    </div>
  );
}