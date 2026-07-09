from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\Dashboard.tsx")
text = path.read_text()

if "Brain," not in text:
    text = text.replace(
        "  BellRing,\n  CheckCircle2,",
        "  BellRing,\n  Brain,\n  CheckCircle2,",
    )

if "memory_price_state: string;" not in text:
    text = text.replace(
        "  estimated_margin_percent: number;\n};",
        """  estimated_margin_percent: number;
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

if "memory_undervalued_count" not in text:
    text = text.replace(
        "    watchlist_count: number;\n    capture:",
        "    watchlist_count: number;\n    suppressed_count?: number;\n    memory_undervalued_count?: number;\n    memory_volatile_count?: number;\n    capture:",
    )

if "function getMemoryClass" not in text:
    text = text.replace(
        """function getRiskClass(riskLevel: string) {
  switch (riskLevel.toLowerCase()) {
    case "low":
      return "text-emerald-400";
    case "medium":
      return "text-amber-400";
    case "high":
      return "text-red-400";
    default:
      return "text-slate-400";
  }
}
""",
        """function getRiskClass(riskLevel: string) {
  switch (riskLevel.toLowerCase()) {
    case "low":
      return "text-emerald-400";
    case "medium":
      return "text-amber-400";
    case "high":
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
""",
    )

if "Memory Undervalued" not in text:
    text = text.replace(
        """            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Watched</span>

              <span className="text-2xl font-bold text-blue-400">
                {loading ? "..." : summary?.watchlist_count ?? 0}
              </span>
            </div>

            <div className="border-t border-slate-800 pt-4">
""",
        """            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Watched</span>

              <span className="text-2xl font-bold text-blue-400">
                {loading ? "..." : summary?.watchlist_count ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Memory Undervalued</span>

              <span className="text-2xl font-bold text-blue-400">
                {loading ? "..." : summary?.memory_undervalued_count ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Volatile</span>

              <span className="text-2xl font-bold text-purple-400">
                {loading ? "..." : summary?.memory_volatile_count ?? 0}
              </span>
            </div>

            <div className="border-t border-slate-800 pt-4">
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
                  {topAlert.signal_action}
                </p>
""",
        """                <p className="mt-1 text-sm text-slate-400">
                  {topAlert.signal_action}
                </p>

                <p className="mt-2 text-sm text-blue-300">
                  {topAlert.memory_note}
                </p>
""",
    )

if "action.memory_price_state" not in text:
    text = text.replace(
        """                      <p className="mt-1 text-xs text-slate-500">
                        {action.goldsmith_category} -{" "}
                        <span className={getRiskClass(action.risk_level)}>
                          {action.risk_level} risk
                        </span>
                      </p>
""",
        """                      <p className="mt-1 text-xs text-slate-500">
                        {action.goldsmith_category} -{" "}
                        <span className={getRiskClass(action.risk_level)}>
                          {action.risk_level} risk
                        </span>
                      </p>

                      <div
                        className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${getMemoryClass(
                          action.memory_price_state,
                        )}`}
                      >
                        <Brain size={13} />
                        {action.memory_price_state}
                      </div>
""",
    )

path.write_text(text)
print("Dashboard.tsx patched with Market Memory.")
