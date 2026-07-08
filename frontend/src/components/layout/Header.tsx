import { Bell, RefreshCw, Search } from "lucide-react";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onSync?: () => void;
  syncing?: boolean;
}

export default function Header({
  title = "Dashboard",
  subtitle = "Live Market Intelligence",
  onSync,
  syncing = false,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-800 bg-slate-900/95 px-8 backdrop-blur">

      {/* Left */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          {title}
        </h1>

        <p className="text-sm text-slate-400">
          {subtitle}
        </p>
      </div>

      {/* Right */}
      <div className="flex items-center gap-4">

        {/* Search */}
        <div className="relative hidden lg:block">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />

          <input
            placeholder="Search items..."
            className="w-72 rounded-lg border border-slate-700 bg-slate-950 py-2 pl-10 pr-4 text-sm text-white outline-none transition focus:border-amber-500"
          />
        </div>

        {/* Notifications */}
        <button className="rounded-lg border border-slate-700 bg-slate-900 p-2 transition hover:border-slate-600 hover:bg-slate-800">
          <Bell size={18} />
        </button>

        {/* Sync Button */}
        <button
          onClick={onSync}
          disabled={syncing}
          className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 font-semibold text-black transition hover:bg-amber-400 disabled:opacity-60"
        >
          <RefreshCw
            size={16}
            className={syncing ? "animate-spin" : ""}
          />

          {syncing ? "Syncing..." : "Sync Auctions"}
        </button>

      </div>

    </header>
  );
}