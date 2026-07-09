from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\Dashboard.tsx")
text = path.read_text()

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

# Add decision summary fields if present type has summary object
if "strong_buy_count?: number;" not in text:
    text = text.replace(
        "    memory_volatile_count?: number;\n    capture:",
        """    memory_volatile_count?: number;
    strong_buy_count?: number;
    buy_count?: number;
    small_buy_count?: number;
    watch_decision_count?: number;
    avoid_decision_count?: number;
    capture:""",
    )

# Add decision class helpers
if "function getDecisionClass" not in text:
    marker = """function getMemoryClass(priceState: string) {
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
"""
    text = text.replace(
        marker,
        marker
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

# Add market health decision counts
if "Strong Buy Decisions" not in text:
    text = text.replace(
        """            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Memory Undervalued</span>

              <span className="text-2xl font-bold text-blue-400">
                {loading ? "..." : summary?.memory_undervalued_count ?? 0}
              </span>
            </div>
""",
        """            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Strong Buy Decisions</span>

              <span className="text-2xl font-bold text-emerald-300">
                {loading ? "..." : summary?.deals?.strong_buy_count ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Buy Decisions</span>

              <span className="text-2xl font-bold text-emerald-400">
                {loading ? "..." : summary?.deals?.buy_count ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Memory Undervalued</span>

              <span className="text-2xl font-bold text-blue-400">
                {loading ? "..." : summary?.memory_undervalued_count ?? 0}
              </span>
            </div>
""",
        1,
    )

# Add top alert decision badge
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

# Add decision score card near top alert metrics
if "Decision Score" not in text:
    text = text.replace(
        """                <p className="text-xs text-slate-500">Confidence</p>
                <p className="text-2xl font-bold text-emerald-400">
                  {topAlert.signal_confidence.toFixed(1)}%
                </p>
              </div>
""",
        """                <p className="text-xs text-slate-500">Confidence</p>
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

# Add decision badge in best actions
if "action.final_decision" not in text:
    text = text.replace(
        """                      <div
                        className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${getMemoryClass(
                          action.memory_price_state,
                        )}`}
                      >
                        <Brain size={13} />
                        {action.memory_price_state}
                      </div>
""",
        """                      <div className="mt-2 flex flex-wrap gap-2">
                        <div
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${getMemoryClass(
                            action.memory_price_state,
                          )}`}
                        >
                          <Brain size={13} />
                          {action.memory_price_state}
                        </div>

                        <div
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${getDecisionClass(
                            action.final_decision,
                          )}`}
                        >
                          <span className={getGradeClass(action.decision_grade)}>
                            {action.decision_grade}
                          </span>
                          {action.final_decision}
                        </div>
                      </div>
""",
        1,
    )

path.write_text(text)
print("Dashboard.tsx patched with Decision Fusion UI.")
