import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  TrendingUp,
  Pickaxe,
  BarChart3,
  Star,
  Settings,
  Coins,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    {
      title: "Dashboard",
      icon: LayoutDashboard,
      path: "/",
    },
    {
      title: "Market Scanner",
      icon: TrendingUp,
      path: "/markets",
    },
    {
      title: "Crafting",
      icon: Pickaxe,
      path: "/crafting",
    },
    {
      title: "Analytics",
      icon: BarChart3,
      path: "/analytics",
    },
    {
      title: "Watchlist",
      icon: Star,
      path: "/watchlist",
    },
    {
      title: "Settings",
      icon: Settings,
      path: "/settings",
    },
  ];

  return (
    <aside
      className={`${
        collapsed ? "w-20" : "w-64"
      } transition-all duration-300 border-r border-slate-800 bg-slate-900 flex flex-col`}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Coins className="text-amber-400" size={28} />
            <div>
              <h1 className="font-bold text-lg text-white">
                GoldSmith
              </h1>
              <p className="text-xs text-slate-400">
                AI
              </p>
            </div>
          </div>
        )}

        {collapsed && (
          <Coins
            className="mx-auto text-amber-400"
            size={28}
          />
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded p-1 hover:bg-slate-800"
        >
          {collapsed ? (
            <ChevronRight size={18} />
          ) : (
            <ChevronLeft size={18} />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-2">

        {menuItems.map((item) => {

          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-3 transition-all ${
                  isActive
                    ? "bg-amber-500 text-black font-semibold"
                    : "text-slate-300 hover:bg-slate-800"
                }`
              }
            >
              <Icon size={20} />

              {!collapsed && (
                <span>{item.title}</span>
              )}
            </NavLink>
          );

        })}

      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-slate-800 p-4">

          <div className="rounded-lg bg-slate-800 p-3">

            <p className="text-sm font-semibold">
              GoldSmith AI
            </p>

            <p className="text-xs text-slate-400 mt-1">
              Alpha Build v0.1
            </p>

          </div>

        </div>
      )}
    </aside>
  );
}