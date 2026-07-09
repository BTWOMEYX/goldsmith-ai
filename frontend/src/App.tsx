import { NavLink, Route, Routes } from "react-router-dom";
import {
  BarChart3,
  BellRing,
  Compass,
  Search,
  Settings,
  Sparkles,
  Star,
} from "lucide-react";

import GlobalSyncBar from "./components/GlobalSyncBar";
import Analytics from "./pages/Analytics";
import Dashboard from "./pages/Dashboard";
import DealAlerts from "./pages/DealAlerts";
import MarketScanner from "./pages/MarketScanner";
import SettingsPage from "./pages/Settings";
import Watchlist from "./pages/Watchlist";

const NAV_ITEMS = [
  {
    to: "/",
    label: "Action Center",
    icon: Compass,
    end: true,
  },
  {
    to: "/alerts",
    label: "Deal Alerts",
    icon: BellRing,
    end: false,
  },
  {
    to: "/markets",
    label: "Market Scanner",
    icon: Search,
    end: false,
  },
  {
    to: "/watchlist",
    label: "Watchlist",
    icon: Star,
    end: false,
  },
  {
    to: "/analytics",
    label: "Analytics",
    icon: BarChart3,
    end: false,
  },
  {
    to: "/settings",
    label: "Settings",
    icon: Settings,
    end: false,
  },
];

function getNavClass(isActive: boolean) {
  if (isActive) {
    return "flex items-center gap-3 rounded-lg border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm font-semibold text-amber-300";
  }

  return "flex items-center gap-3 rounded-lg border border-transparent px-4 py-3 text-sm font-semibold text-slate-400 transition hover:border-slate-800 hover:bg-slate-900 hover:text-slate-100";
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 border-r border-slate-800 bg-slate-950 p-5 lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-black">
              <Sparkles size={22} />
            </div>

            <div>
              <h1 className="text-lg font-bold text-white">GoldSmith AI</h1>
              <p className="text-xs text-slate-500">Market Engine Pro</p>
            </div>
          </div>

          <nav className="space-y-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => getNavClass(isActive)}
                >
                  <Icon size={18} />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Page Purpose
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Action Center tells you what to do. Detail pages are for review,
              research, tracking and trends.
            </p>
          </div>
        </aside>

        <main className="flex-1 overflow-x-hidden">
          <div className="border-b border-slate-800 bg-slate-950/95 px-5 py-4 lg:hidden">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-black">
                <Sparkles size={20} />
              </div>

              <div>
                <h1 className="font-bold text-white">GoldSmith AI</h1>
                <p className="text-xs text-slate-500">Market Engine Pro</p>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      isActive
                        ? "inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-black"
                        : "inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300"
                    }
                  >
                    <Icon size={15} />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </div>

          <div className="mx-auto max-w-7xl px-5 py-6">
            <GlobalSyncBar />

            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/alerts" element={<DealAlerts />} />
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