import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { Search, Bell, ChevronDown, RefreshCw, Package } from 'lucide-react';
import axios from 'axios';

// 1. Updated Interface to match your real PostgreSQL database model perfectly
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

export default function Dashboard() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [items, setItems] = useState<TrackedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data from FastAPI backend
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await axios.get<BackendResponse>('http://localhost:8000/api/dashboard');
      if (response.data && response.data.items) {
        setItems(response.data.items);
      }
      setError(null);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Could not connect to FastAPI server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // 2. Dynamic metrics derived straight from your live database data
  const totalTrackedCount = items.length;
  const lowestPriceItem = items.reduce((prev, curr) => (prev.current_price < curr.current_price ? prev : curr), items[0]);

  return (
    <div className="flex bg-slate-950 min-h-screen text-slate-100 antialiased">
      {/* Sidebar Navigation */}
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Navbar */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex items-center justify-between px-6 z-10">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search items, recipes, or markets..." 
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={fetchDashboardData}
              className={`p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors ${loading ? 'animate-spin' : ''}`}
              title="Refresh Data"
            >
              <RefreshCw size={18} />
            </button>

            <button className="relative p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500" />
            </button>

            <button className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-slate-700 transition-all">
              {/* Connected realm 11 maps directly to your backend service parameters */}
              <span>Connected Realm 11</span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>
          </div>
        </header>

        {/* Dynamic View Panel Container */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Page Header */}
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white capitalize">
                  {currentTab === 'dashboard' ? 'Market Overview' : currentTab.replace('-', ' ')}
                </h1>
                <p className="text-sm text-slate-400">
                  Live monitoring data and optimization indices.
                </p>
              </div>
              {error && (
                <div className="text-xs bg-red-950/50 border border-red-800 text-red-400 px-3 py-1.5 rounded-lg">
                  {error}
                </div>
              )}
            </div>

            {/* MAIN METRIC CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl relative overflow-hidden">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Database Status</span>
                <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                  {loading ? 'Checking...' : 'Connected'}
                </h3>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cheapest Tracked Market</span>
                <h3 className="text-2xl font-bold text-amber-400 mt-1">
                  {loading ? '...' : lowestPriceItem ? `${lowestPriceItem.current_price.toLocaleString()}g` : 'N/A'}
                </h3>
                <span className="text-xs text-slate-400">{lowestPriceItem?.name || ''}</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Watchlists</span>
                <h3 className="text-2xl font-bold text-blue-400 mt-1">
                  {loading ? '...' : `${totalTrackedCount} Items`}
                </h3>
              </div>
            </div>

            {/* LIVE MARKETPLACE SNAPSHOT TABLE */}
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
                        <td colSpan={4} className="py-4 text-slate-500 text-center">
                          Loading active auction metrics...
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-slate-500 text-center">
                          No items tracked yet. Execute /api/sync-auctions to fetch data!
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/30 transition-colors group">
                          <td className="py-3.5 pl-2 font-medium text-slate-200 group-hover:text-amber-400 transition-colors">
                            {item.name}
                          </td>
                          <td className="py-3.5 text-slate-500 font-mono text-xs">
                            {item.item_id}
                          </td>
                          <td className="py-3.5 text-right font-semibold text-emerald-400">
                            {item.current_price.toLocaleString()}g
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