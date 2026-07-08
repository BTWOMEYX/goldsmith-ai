import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

import Sidebar from "./Sidebar";
import Header from "./Header";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const pageTitles: Record<string, { title: string; subtitle: string }> = {
    "/": {
      title: "Dashboard",
      subtitle: "Live World of Warcraft market intelligence",
    },
    "/markets": {
      title: "Market Scanner",
      subtitle: "Browse every tracked commodity and auction",
    },
    "/crafting": {
      title: "Crafting Optimizer",
      subtitle: "Find the most profitable recipes",
    },
    "/analytics": {
      title: "Analytics",
      subtitle: "Historical trends and AI insights",
    },
    "/watchlist": {
      title: "Watchlist",
      subtitle: "Items you're actively monitoring",
    },
    "/settings": {
      title: "Settings",
      subtitle: "Configure GoldSmith AI",
    },
  };

  const page =
    pageTitles[location.pathname] ??
    {
      title: "GoldSmith AI",
      subtitle: "Market Intelligence Platform",
    };

  return (
    <div className="flex min-h-screen bg-slate-950 text-white">

      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">

        <Header
          title={page.title}
          subtitle={page.subtitle}
        />

        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>

      </div>

    </div>
  );
}