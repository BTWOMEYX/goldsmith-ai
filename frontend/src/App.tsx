import { NavLink, Route, Routes } from "react-router-dom";
import {
  BadgeDollarSign,
  BarChart3,
  BellRing,
  Compass,
  Eye,
  LineChart,
  Settings,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";

import GlobalSyncBar from "./components/GlobalSyncBar";
import Analytics from "./pages/Analytics";
import BuyQueue from "./pages/BuyQueue";
import Dashboard from "./pages/Dashboard";
import DealAlerts from "./pages/DealAlerts";
import MarketScanner from "./pages/MarketScanner";
import ProfitTracker from "./pages/ProfitTracker";
import SettingsPage from "./pages/Settings";
import Watchlist from "./pages/Watchlist";

const navItems = [
  {
    label: "Action Center",
    path: "/",
    icon: Compass,
    end: true,
  },
  {
    label: "Deal Alerts",
    path: "/alerts",
    icon: BellRing,
  },
  {
    label: "Buy Queue",
    path: "/buy-queue",
    icon: ShoppingCart,
  },
  {
    label: "Profit Tracker",
    path: "/profit",
    icon: BadgeDollarSign,
  },
  {
    label: "Market Scanner",
    path: "/markets",
    icon: TrendingUp,
  },
  {
    label: "Watchlist",
    path: "/watchlist",
    icon: Eye,
  },
  {
    label: "Analytics",
    path: "/analytics",
    icon: BarChart3,
  },
  {
    label: "Settings",
    path: "/settings",
    icon: Settings,
  },
];

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 border-r border-slate-800 bg-slate-950/95 p-5 lg:block">
          <div className="mb-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-800 bg-amber-950/40 text-amber-300">
                <LineChart size={22} />
              </div>

              <div>
                <h1 className="text-xl font-bold text-white">GoldSmith AI</h1>
                <p className="text-xs text-slate-500">
                  Market decision engine
                </p>
              </div>
            </div>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition",
                      isActive
                        ? "bg-amber-500 text-black"
                        : "text-slate-400 hover:bg-slate-900 hover:text-white",
                    ].join(" ")
                  }
                >
                  <Icon size={18} />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Current Mission
            </p>

            <p className="mt-2 text-sm text-slate-300">
              Let GoldSmith scan, rank, queue, and track opportunities. You
              manually execute buys in-game.
            </p>
          </div>
        </aside>

        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-[1700px] p-4 md:p-8">
            <div className="mb-6 lg:hidden">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-800 bg-amber-950/40 text-amber-300">
                  <LineChart size={20} />
                </div>

                <div>
                  <h1 className="text-lg font-bold text-white">GoldSmith AI</h1>
                  <p className="text-xs text-slate-500">
                    Market decision engine
                  </p>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2">
                {navItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.end}
                      className={({ isActive }) =>
                        [
                          "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition",
                          isActive
                            ? "bg-amber-500 text-black"
                            : "bg-slate-900 text-slate-400 hover:text-white",
                        ].join(" ")
                      }
                    >
                      <Icon size={15} />
                      {item.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>

            <GlobalSyncBar />

            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/alerts" element={<DealAlerts />} />
              <Route path="/buy-queue" element={<BuyQueue />} />
              <Route path="/profit" element={<ProfitTracker />} />
              <Route path="/markets" element={<MarketScanner />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}
