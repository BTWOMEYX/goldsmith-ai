import { useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import {
  BadgeDollarSign,
  BarChart3,
  BellRing,
  Brain,
  Compass,
  Eye,
  LineChart,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  TrendingUp,
} from "lucide-react";

import GlobalSyncBar from "./components/GlobalSyncBar";
import Analytics from "./pages/Analytics";
import BuyQueue from "./pages/BuyQueue";
import Dashboard from "./pages/Dashboard";
import DealAlerts from "./pages/DealAlerts";
import MarketScanner from "./pages/MarketScanner";
import PerformanceFeedback from "./pages/PerformanceFeedback";
import ProfitTracker from "./pages/ProfitTracker";
import SellPlan from "./pages/SellPlan";
import SettingsPage from "./pages/Settings";
import Watchlist from "./pages/Watchlist";

type UiMode = "simple" | "pro";

const UI_MODE_KEY = "goldsmith.uiMode";

const navItems = [
  {
    label: "Action Center",
    path: "/",
    icon: Compass,
    end: true,
    simple: true,
  },
  {
    label: "Buy Queue",
    path: "/buy-queue",
    icon: ShoppingCart,
    simple: true,
  },
  {
    label: "Sell Plan",
    path: "/sell-plan",
    icon: BadgeDollarSign,
    simple: true,
  },
  {
    label: "Profit Tracker",
    path: "/profit",
    icon: BadgeDollarSign,
    simple: true,
  },
  {
    label: "Deal Alerts",
    path: "/alerts",
    icon: BellRing,
    simple: false,
  },
  {
    label: "Feedback Engine",
    path: "/feedback",
    icon: Brain,
    simple: false,
  },
  {
    label: "Market Scanner",
    path: "/markets",
    icon: TrendingUp,
    simple: false,
  },
  {
    label: "Watchlist",
    path: "/watchlist",
    icon: Eye,
    simple: false,
  },
  {
    label: "Analytics",
    path: "/analytics",
    icon: BarChart3,
    simple: false,
  },
  {
    label: "Settings",
    path: "/settings",
    icon: Settings,
    simple: true,
  },
];

function readUiMode(): UiMode {
  const stored = localStorage.getItem(UI_MODE_KEY);

  if (stored === "simple" || stored === "pro") {
    return stored;
  }

  return "simple";
}

export default function App() {
  const [uiMode, setUiModeState] = useState<UiMode>(() => readUiMode());
  const [refreshKey, setRefreshKey] = useState(0);

  function setUiMode(nextMode: UiMode) {
    localStorage.setItem(UI_MODE_KEY, nextMode);
    document.documentElement.dataset.goldsmithMode = nextMode;
    setUiModeState(nextMode);
    window.dispatchEvent(new CustomEvent("goldsmith-ui-mode-changed"));
  }

  useEffect(() => {
    document.documentElement.dataset.goldsmithMode = uiMode;
  }, [uiMode]);


  useEffect(() => {
    function refreshActivePage() {
      setRefreshKey((current) => current + 1);
    }

    window.addEventListener("goldsmith-sync-complete", refreshActivePage);
    window.addEventListener("goldsmith-data-refresh", refreshActivePage);
    window.addEventListener("goldsmith-realm-changed", refreshActivePage);
    window.addEventListener("goldsmith-strategy-changed", refreshActivePage);

    return () => {
      window.removeEventListener("goldsmith-sync-complete", refreshActivePage);
      window.removeEventListener("goldsmith-data-refresh", refreshActivePage);
      window.removeEventListener("goldsmith-realm-changed", refreshActivePage);
      window.removeEventListener("goldsmith-strategy-changed", refreshActivePage);
    };
  }, []);

  const visibleNavItems = useMemo(() => {
    if (uiMode === "pro") {
      return navItems;
    }

    return navItems.filter((item) => item.simple);
  }, [uiMode]);

  const missionText =
    uiMode === "simple"
      ? "Open Action Center, queue the best buys, manually execute in-game, then track profit."
      : "Inspect every signal, memory state, feedback adjustment and market capture behind the engine.";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 border-r border-slate-800 bg-slate-950/95 p-5 lg:block">
          <div className="mb-6">
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

          <div className="mb-5 rounded-xl border border-slate-800 bg-slate-900 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <SlidersHorizontal size={14} />
              App Mode
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setUiMode("simple")}
                className={[
                  "rounded-lg px-3 py-2 text-xs font-bold transition",
                  uiMode === "simple"
                    ? "bg-amber-500 text-black"
                    : "bg-slate-950 text-slate-400 hover:text-white",
                ].join(" ")}
              >
                Simple
              </button>

              <button
                type="button"
                onClick={() => setUiMode("pro")}
                className={[
                  "rounded-lg px-3 py-2 text-xs font-bold transition",
                  uiMode === "pro"
                    ? "bg-blue-500 text-white"
                    : "bg-slate-950 text-slate-400 hover:text-white",
                ].join(" ")}
              >
                Pro
              </button>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              {uiMode === "simple"
                ? "Simple mode keeps only the money-making workflow."
                : "Pro mode unlocks the full research cockpit."}
            </p>
          </div>

          <nav className="space-y-2">
            {visibleNavItems.map((item) => {
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

            <p className="mt-2 text-sm text-slate-300">{missionText}</p>
          </div>
        </aside>

        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-[1700px] p-4 md:p-8">
            <div className="mb-6 lg:hidden">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-800 bg-amber-950/40 text-amber-300">
                    <LineChart size={20} />
                  </div>

                  <div>
                    <h1 className="text-lg font-bold text-white">
                      GoldSmith AI
                    </h1>
                    <p className="text-xs text-slate-500">
                      Market decision engine
                    </p>
                  </div>
                </div>

                <div className="flex rounded-lg border border-slate-800 bg-slate-900 p-1">
                  <button
                    type="button"
                    onClick={() => setUiMode("simple")}
                    className={[
                      "rounded-md px-3 py-1.5 text-xs font-bold",
                      uiMode === "simple"
                        ? "bg-amber-500 text-black"
                        : "text-slate-400",
                    ].join(" ")}
                  >
                    Simple
                  </button>

                  <button
                    type="button"
                    onClick={() => setUiMode("pro")}
                    className={[
                      "rounded-md px-3 py-1.5 text-xs font-bold",
                      uiMode === "pro"
                        ? "bg-blue-500 text-white"
                        : "text-slate-400",
                    ].join(" ")}
                  >
                    Pro
                  </button>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2">
                {visibleNavItems.map((item) => {
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

            <Routes key={refreshKey}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/alerts" element={<DealAlerts />} />
              <Route path="/buy-queue" element={<BuyQueue />} />
              <Route path="/sell-plan" element={<SellPlan />} />
              <Route path="/profit" element={<ProfitTracker />} />
              <Route path="/feedback" element={<PerformanceFeedback />} />
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
