from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\DealAlerts.tsx")
text = path.read_text()

if "Brain," not in text:
    text = text.replace(
        "  Ban,\n  BellRing,",
        "  Ban,\n  Brain,\n  BellRing,",
    )

if "memory_price_state: string;" not in text:
    text = text.replace(
        "  capital_note: string;\n};",
        """  capital_note: string;
  memory_price_state: string;
  memory_score: number;
  memory_confidence: string;
  memory_sample_count: number;
  memory_note: string;
  memory_volatility_score: number;
  memory_discount_percent: number;
  memory_price_position_percent: number;
  memory_average_7_day_price: number | null;
  memory_average_30_day_price: number | null;
};""",
    )

if "const MEMORY_FILTERS" not in text:
    text = text.replace(
        'const CAPITAL_FILTERS = ["All Capital", "Low", "Medium", "High", "Avoid"];',
        '''const CAPITAL_FILTERS = ["All Capital", "Low", "Medium", "High", "Avoid"];

const MEMORY_FILTERS = [
  "All Memory",
  "Deep Undervalued",
  "Undervalued",
  "Below Normal",
  "Fair Value",
  "Above Normal",
  "Overpriced",
  "Volatile",
  "Learning",
];''',
    )

if "function getMemoryClass" not in text:
    text = text.replace(
        """function getSpeedClass(saleSpeed: string) {
  switch (saleSpeed) {
    case "Fast":
      return "text-emerald-400";
    case "Medium":
      return "text-amber-400";
    case "Slow":
      return "text-red-400";
    default:
      return "text-slate-400";
  }
}
""",
        """function getSpeedClass(saleSpeed: string) {
  switch (saleSpeed) {
    case "Fast":
      return "text-emerald-400";
    case "Medium":
      return "text-amber-400";
    case "Slow":
      return "text-red-400";
    default:
      return "text-slate-400";
  }
}

function getMemoryClass(priceState: string) {
  switch (priceState) {
    case "Deep Undervalued":
      return "border-emerald-700 bg-emerald-950/50 text-emerald-300";
    case "Undervalued":
      return "border-emerald-800 bg-emerald-950/40 text-emerald-300";
    case "Below Normal":
      return "border-blue-800 bg-blue-950/40 text-blue-300";
    case "Fair Value":
      return "border-slate-700 bg-slate-950 text-slate-300";
    case "Above Normal":
      return "border-amber-800 bg-amber-950/40 text-amber-300";
    case "Overpriced":
      return "border-red-800 bg-red-950/40 text-red-300";
    case "Volatile":
      return "border-purple-800 bg-purple-950/40 text-purple-300";
    case "Learning":
      return "border-slate-700 bg-slate-950 text-slate-400";
    default:
      return "border-slate-700 bg-slate-950 text-slate-300";
  }
}

function getMemoryDealCount(alerts: DealAlert[]) {
  return alerts.filter((alert) =>
    ["Deep Undervalued", "Undervalued", "Below Normal"].includes(
      alert.memory_price_state,
    ),
  ).length;
}
""",
    )

if 'const [memoryFilter, setMemoryFilter]' not in text:
    text = text.replace(
        '  const [capitalFilter, setCapitalFilter] = useState("All Capital");',
        '  const [capitalFilter, setCapitalFilter] = useState("All Capital");\n  const [memoryFilter, setMemoryFilter] = useState("All Memory");',
    )

if "const matchesMemory =" not in text:
    text = text.replace(
        """      const matchesCapital =
        capitalFilter === "All Capital" ||
        alert.capital_risk_label === capitalFilter;

      return matchesSearch && matchesSignal && matchesCategory && matchesCapital;
""",
        """      const matchesCapital =
        capitalFilter === "All Capital" ||
        alert.capital_risk_label === capitalFilter;

      const matchesMemory =
        memoryFilter === "All Memory" ||
        alert.memory_price_state === memoryFilter;

      return (
        matchesSearch &&
        matchesSignal &&
        matchesCategory &&
        matchesCapital &&
        matchesMemory
      );
""",
    )

text = text.replace(
    "[alerts, capitalFilter, categoryFilter, searchTerm, signalFilter]);",
    "[alerts, capitalFilter, categoryFilter, memoryFilter, searchTerm, signalFilter]);",
)

text = text.replace(
    "sale speed, exposure limits and smart ignore filtering.",
    "sale speed, exposure limits, market memory and smart ignore filtering.",
)

text = text.replace(
    '      <div className="grid gap-4 md:grid-cols-6">',
    '      <div className="grid gap-4 md:grid-cols-7">',
    1,
)

if "Memory Deals" not in text:
    text = text.replace(
        """        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Suppressed</p>
          <p className="mt-2 text-2xl font-bold text-slate-300">
            {ignoredCount}
          </p>
        </div>
""",
        """        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Memory Deals</p>
          <p className="mt-2 text-2xl font-bold text-blue-400">
            {getMemoryDealCount(alerts)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Suppressed</p>
          <p className="mt-2 text-2xl font-bold text-slate-300">
            {ignoredCount}
          </p>
        </div>
""",
    )

if "topAlert.memory_price_state" not in text:
    text = text.replace(
        """                <div
                  className={`mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getSignalClass(
                    topAlert.signal,
                  )}`}
                >
                  {getSignalIcon(topAlert.signal)}
                  {topAlert.signal_label}
                </div>
""",
        """                <div className="mb-2 flex flex-wrap gap-2">
                  <div
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getSignalClass(
                      topAlert.signal,
                    )}`}
                  >
                    {getSignalIcon(topAlert.signal)}
                    {topAlert.signal_label}
                  </div>

                  <div
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getMemoryClass(
                      topAlert.memory_price_state,
                    )}`}
                  >
                    <Brain size={14} />
                    {topAlert.memory_price_state}
                  </div>
                </div>
""",
    )

    text = text.replace(
        """                <p className="mt-1 text-sm text-slate-400">
                  {topAlert.capital_note}
                </p>
""",
        """                <p className="mt-1 text-sm text-slate-400">
                  {topAlert.capital_note}
                </p>

                <p className="mt-2 text-sm text-blue-300">
                  {topAlert.memory_note}
                </p>
""",
    )

text = text.replace(
    '        <div className="grid gap-3 lg:grid-cols-4">',
    '        <div className="grid gap-3 lg:grid-cols-5">',
    1,
)

if "MEMORY_FILTERS.map" not in text:
    text = text.replace(
        """          <select
            value={capitalFilter}
            onChange={(event) => setCapitalFilter(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-500"
          >
            {CAPITAL_FILTERS.map((capital) => (
              <option key={capital} value={capital}>
                {capital}
              </option>
            ))}
          </select>
""",
        """          <select
            value={capitalFilter}
            onChange={(event) => setCapitalFilter(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-500"
          >
            {CAPITAL_FILTERS.map((capital) => (
              <option key={capital} value={capital}>
                {capital}
              </option>
            ))}
          </select>

          <select
            value={memoryFilter}
            onChange={(event) => setMemoryFilter(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-500"
          >
            {MEMORY_FILTERS.map((memory) => (
              <option key={memory} value={memory}>
                {memory}
              </option>
            ))}
          </select>
""",
    )

text = text.replace(
    '          <table className="min-w-[1580px] w-full text-left text-sm">',
    '          <table className="min-w-[1760px] w-full text-left text-sm">',
)

if '<th className="px-4 py-3">Memory</th>' not in text:
    text = text.replace(
        """                <th className="px-4 py-3">Capital</th>
                <th className="px-4 py-3">Buy Plan</th>
""",
        """                <th className="px-4 py-3">Capital</th>
                <th className="px-4 py-3">Memory</th>
                <th className="px-4 py-3">Buy Plan</th>
""",
    )

text = text.replace("colSpan={12}", "colSpan={13}")

if "alert.memory_price_state" not in text[text.find("<tbody>"):]:
    text = text.replace(
        """                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${getCapitalClass(
                          alert.capital_risk_label,
                        )}`}
                      >
                        <ShieldAlert size={13} />
                        {alert.capital_risk_label}
                      </span>

                      <p className="mt-1 text-xs text-slate-500">
                        {alert.capital_action}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <ShoppingCart size={15} className="text-amber-400" />
""",
        """                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${getCapitalClass(
                          alert.capital_risk_label,
                        )}`}
                      >
                        <ShieldAlert size={13} />
                        {alert.capital_risk_label}
                      </span>

                      <p className="mt-1 text-xs text-slate-500">
                        {alert.capital_action}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${getMemoryClass(
                          alert.memory_price_state,
                        )}`}
                      >
                        <Brain size={13} />
                        {alert.memory_price_state}
                      </span>

                      <p className="mt-1 text-xs text-slate-500">
                        Score {alert.memory_score.toFixed(1)} - {alert.memory_confidence}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        30d avg {formatGold(alert.memory_average_30_day_price)}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <ShoppingCart size={15} className="text-amber-400" />
""",
    )

path.write_text(text)
print("DealAlerts.tsx patched with Market Memory.")
