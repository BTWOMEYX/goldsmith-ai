from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\DealAlerts.tsx")
text = path.read_text()

# Add MEMORY_BUY to signal filters
if '"MEMORY_BUY"' not in text:
    text = text.replace(
        '  "AUTO_WATCH",',
        '  "AUTO_WATCH",\n  "MEMORY_BUY",',
        1,
    )

# Add decision fields to DealAlert type
if "final_decision: string;" not in text:
    text = text.replace(
        "  memory_average_30_day_price: number | null;\n};",
        """  memory_average_30_day_price: number | null;
  final_decision: string;
  decision_grade: string;
  decision_score: number;
  buy_pressure: string;
  position_size_label: string;
  decision_note: string;
  base_signal_confidence: number;
  memory_adjusted_confidence: number;
};""",
    )

# Add decision summary fields
if "strong_buy_count: number;" not in text:
    text = text.replace(
        "  avoid_capital_count: number;\n};",
        """  avoid_capital_count: number;
  strong_buy_count: number;
  buy_count: number;
  small_buy_count: number;
  watch_decision_count: number;
  avoid_decision_count: number;
  memory_buy_count: number;
};""",
    )

# Add EMPTY_SUMMARY defaults
if "strong_buy_count: 0," not in text:
    text = text.replace(
        "  avoid_capital_count: 0,\n};",
        """  avoid_capital_count: 0,
  strong_buy_count: 0,
  buy_count: 0,
  small_buy_count: 0,
  watch_decision_count: 0,
  avoid_decision_count: 0,
  memory_buy_count: 0,
};""",
    )

# Add decision filters
if "const DECISION_FILTERS" not in text:
    text = text.replace(
        """const MEMORY_FILTERS = [
  "All Memory",
  "Deep Undervalued",
  "Undervalued",
  "Below Normal",
  "Fair Value",
  "Above Normal",
  "Overpriced",
  "Volatile",
  "Learning",
];""",
        """const MEMORY_FILTERS = [
  "All Memory",
  "Deep Undervalued",
  "Undervalued",
  "Below Normal",
  "Fair Value",
  "Above Normal",
  "Overpriced",
  "Volatile",
  "Learning",
];

const DECISION_FILTERS = [
  "All Decisions",
  "Strong Buy",
  "Buy",
  "Small Buy",
  "Watch",
  "Avoid",
];""",
    )

# Add MEMORY_BUY signal class
if 'case "MEMORY_BUY":' not in text:
    text = text.replace(
        """    case "AUTO_WATCH":
      return "border-emerald-800 bg-emerald-950/40 text-emerald-300";""",
        """    case "AUTO_WATCH":
      return "border-emerald-800 bg-emerald-950/40 text-emerald-300";
    case "MEMORY_BUY":
      return "border-cyan-800 bg-cyan-950/40 text-cyan-300";""",
        1,
    )

# Add MEMORY_BUY signal icon
if 'case "MEMORY_BUY":' not in text[text.find("function getSignalIcon"):]:
    text = text.replace(
        """    case "AUTO_WATCH":
      return <Zap size={14} />;""",
        """    case "AUTO_WATCH":
      return <Zap size={14} />;
    case "MEMORY_BUY":
      return <Brain size={14} />;""",
        1,
    )

# Add decision class helper
if "function getDecisionClass" not in text:
    insert_after = """function getMemoryDealCount(alerts: DealAlert[]) {
  return alerts.filter((alert) =>
    ["Deep Undervalued", "Undervalued", "Below Normal"].includes(
      alert.memory_price_state,
    ),
  ).length;
}
"""
    text = text.replace(
        insert_after,
        insert_after
        + """

function getDecisionClass(finalDecision: string) {
  switch (finalDecision) {
    case "Strong Buy":
      return "border-emerald-700 bg-emerald-950/50 text-emerald-300";
    case "Buy":
      return "border-emerald-800 bg-emerald-950/40 text-emerald-300";
    case "Small Buy":
      return "border-blue-800 bg-blue-950/40 text-blue-300";
    case "Watch":
      return "border-amber-800 bg-amber-950/40 text-amber-300";
    case "Avoid":
      return "border-red-800 bg-red-950/40 text-red-300";
    default:
      return "border-slate-700 bg-slate-950 text-slate-300";
  }
}

function getGradeClass(grade: string) {
  switch (grade) {
    case "S":
      return "text-emerald-300";
    case "A":
      return "text-emerald-400";
    case "B":
      return "text-blue-400";
    case "C":
      return "text-amber-400";
    case "D":
      return "text-red-400";
    default:
      return "text-slate-400";
  }
}
""",
    )

# Add decision filter state
if 'const [decisionFilter, setDecisionFilter]' not in text:
    text = text.replace(
        '  const [memoryFilter, setMemoryFilter] = useState("All Memory");',
        '  const [memoryFilter, setMemoryFilter] = useState("All Memory");\n  const [decisionFilter, setDecisionFilter] = useState("All Decisions");',
    )

# Add decision matching
if "const matchesDecision =" not in text:
    text = text.replace(
        """      const matchesMemory =
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
        """      const matchesMemory =
        memoryFilter === "All Memory" ||
        alert.memory_price_state === memoryFilter;

      const matchesDecision =
        decisionFilter === "All Decisions" ||
        alert.final_decision === decisionFilter;

      return (
        matchesSearch &&
        matchesSignal &&
        matchesCategory &&
        matchesCapital &&
        matchesMemory &&
        matchesDecision
      );
""",
    )

text = text.replace(
    "[alerts, capitalFilter, categoryFilter, memoryFilter, searchTerm, signalFilter]);",
    "[alerts, capitalFilter, categoryFilter, decisionFilter, memoryFilter, searchTerm, signalFilter]);",
)

# Summary grid/cards
text = text.replace(
    '      <div className="grid gap-4 md:grid-cols-7">',
    '      <div className="grid gap-4 md:grid-cols-8">',
    1,
)

if "Strong Buy" not in text[text.find('<div className="grid gap-4 md:grid-cols-8">'):text.find("{topAlert &&")]:
    text = text.replace(
        """        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Auto Watch</p>
          <p className="mt-2 text-2xl font-bold text-emerald-400">
            {summary.auto_watch_count}
          </p>
        </div>
""",
        """        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Strong Buy</p>
          <p className="mt-2 text-2xl font-bold text-emerald-300">
            {summary.strong_buy_count}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-500">Buy</p>
          <p className="mt-2 text-2xl font-bold text-emerald-400">
            {summary.buy_count}
          </p>
        </div>
""",
    )

# Top alert decision badge
if "topAlert.final_decision" not in text:
    text = text.replace(
        """                  <div
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getMemoryClass(
                      topAlert.memory_price_state,
                    )}`}
                  >
                    <Brain size={14} />
                    {topAlert.memory_price_state}
                  </div>
                </div>
""",
        """                  <div
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getMemoryClass(
                      topAlert.memory_price_state,
                    )}`}
                  >
                    <Brain size={14} />
                    {topAlert.memory_price_state}
                  </div>

                  <div
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getDecisionClass(
                      topAlert.final_decision,
                    )}`}
                  >
                    Grade <span className={getGradeClass(topAlert.decision_grade)}>{topAlert.decision_grade}</span>
                    {topAlert.final_decision}
                  </div>
                </div>
""",
        1,
    )

    text = text.replace(
        """                <p className="mt-2 text-sm text-blue-300">
                  {topAlert.memory_note}
                </p>
""",
        """                <p className="mt-2 text-sm text-blue-300">
                  {topAlert.memory_note}
                </p>

                <p className="mt-2 text-sm text-emerald-300">
                  {topAlert.decision_note}
                </p>
""",
        1,
    )

# Top alert metric grid
text = text.replace(
    '            <div className="grid gap-3 text-right sm:grid-cols-3">',
    '            <div className="grid gap-3 text-right sm:grid-cols-4">',
    1,
)

if "Decision Score" not in text:
    text = text.replace(
        """              <div>
                <p className="text-xs text-slate-500">Confidence</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {topAlert.signal_confidence.toFixed(1)}%
                </p>
              </div>
""",
        """              <div>
                <p className="text-xs text-slate-500">Confidence</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {topAlert.signal_confidence.toFixed(1)}%
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">Decision Score</p>
                <p className="text-2xl font-bold text-blue-400">
                  {topAlert.decision_score.toFixed(1)}
                </p>
              </div>
""",
        1,
    )

# Filter grid add decision select
text = text.replace(
    '        <div className="grid gap-3 lg:grid-cols-5">',
    '        <div className="grid gap-3 lg:grid-cols-6">',
    1,
)

if "DECISION_FILTERS.map" not in text:
    text = text.replace(
        """          <select
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
        """          <select
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

          <select
            value={decisionFilter}
            onChange={(event) => setDecisionFilter(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-500"
          >
            {DECISION_FILTERS.map((decision) => (
              <option key={decision} value={decision}>
                {decision}
              </option>
            ))}
          </select>
""",
    )

# Table width and decision column
text = text.replace(
    '          <table className="min-w-[1760px] w-full text-left text-sm">',
    '          <table className="min-w-[1920px] w-full text-left text-sm">',
)

if '<th className="px-4 py-3">Decision</th>' not in text:
    text = text.replace(
        """                <th className="px-4 py-3">Signal</th>
                <th className="px-4 py-3">Capital</th>
""",
        """                <th className="px-4 py-3">Signal</th>
                <th className="px-4 py-3">Decision</th>
                <th className="px-4 py-3">Capital</th>
""",
    )

text = text.replace("colSpan={13}", "colSpan={14}")

if "alert.final_decision" not in text[text.find("<tbody>"):]:
    text = text.replace(
        """                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${getSignalClass(
                          alert.signal,
                        )}`}
                      >
                        {getSignalIcon(alert.signal)}
                        {alert.signal_label}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${getCapitalClass(
                          alert.capital_risk_label,
                        )}`}
                      >
""",
        """                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${getSignalClass(
                          alert.signal,
                        )}`}
                      >
                        {getSignalIcon(alert.signal)}
                        {alert.signal_label}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${getDecisionClass(
                          alert.final_decision,
                        )}`}
                      >
                        <span className={getGradeClass(alert.decision_grade)}>
                          {alert.decision_grade}
                        </span>
                        {alert.final_decision}
                      </span>

                      <p className="mt-1 text-xs text-slate-500">
                        Score {alert.decision_score.toFixed(1)} - {alert.buy_pressure}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {alert.position_size_label}
                      </p>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${getCapitalClass(
                          alert.capital_risk_label,
                        )}`}
                      >
""",
    )

path.write_text(text)
print("DealAlerts.tsx patched with Decision Fusion UI.")
