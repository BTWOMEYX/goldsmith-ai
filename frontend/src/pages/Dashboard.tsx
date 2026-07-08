export default function Dashboard() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="p-8">
        <h1 className="text-4xl font-bold text-yellow-400">
          GoldSmith AI
        </h1>

        <p className="mt-2 text-slate-400">
          World of Warcraft Market Intelligence Platform
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold">Total Profit Today</h2>
            <p className="mt-3 text-3xl font-bold text-green-400">
              245,300g
            </p>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold">Best Profession</h2>
            <p className="mt-3 text-3xl font-bold text-blue-400">
              Alchemy
            </p>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold">Tracked Realms</h2>
            <p className="mt-3 text-3xl font-bold text-purple-400">
              1
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}