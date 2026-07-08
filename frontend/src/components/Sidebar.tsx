import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  LineChart, 
  Pickaxe, 
  TrendingUp, 
  Bell, 
  User, 
  ChevronLeft, 
  ChevronRight,
  Coins
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export default function Sidebar({ currentTab, setCurrentTab }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'market', name: 'Market Trends', icon: TrendingUp },
    { id: 'professions', name: 'Profession Optimizer', icon: Pickaxe },
    { id: 'watchlists', name: 'Watchlists', icon: LineChart },
    { id: 'alerts', name: 'Price Alerts', icon: Bell },
  ];

  return (
    <div 
      className={`min-h-screen bg-slate-900 text-slate-100 border-r border-slate-800 flex flex-col justify-between transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Top Header / Logo Section */}
      <div>
        <div className="p-4 flex items-center justify-between border-b border-slate-800">
          {!isCollapsed && (
            <div className="flex items-center gap-2 font-bold text-xl tracking-wider text-amber-500">
              <Coins className="h-6 w-6" />
              <span>Goldsmith<span className="text-white text-sm font-normal">.ai</span></span>
            </div>
          )}
          {isCollapsed && (
            <div className="mx-auto text-amber-500">
              <Coins className="h-6 w-6" />
            </div>
          )}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-all group relative ${
                  isActive 
                    ? 'bg-amber-600 text-white' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-amber-500'}`} />
                {!isCollapsed && <span>{item.name}</span>}
                
                {/* Tooltip when collapsed */}
                {isCollapsed && (
                  <div className="absolute left-full rounded-md px-2 py-1 ml-6 bg-slate-950 text-xs font-semibold text-white invisible opacity-0 -translate-x-3 transition-all group-hover:visible group-hover:opacity-100 group-hover:translate-x-0 whitespace-nowrap z-50">
                    {item.name}
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Profile Section */}
      <div className="p-4 border-t border-slate-800 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 hover:bg-slate-700 cursor-pointer">
          <User size={20} />
        </div>
        {!isCollapsed && (
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-medium truncate">GoblinTrader</span>
            <span className="text-xs text-slate-500 truncate">premium@goldsmith.ai</span>
          </div>
        )}
      </div>
    </div>
  );
}