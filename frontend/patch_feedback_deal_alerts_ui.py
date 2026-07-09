from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\DealAlerts.tsx")
text = path.read_text()

if "feedback_adjustment: number;" not in text:
    text = text.replace(
        "  memory_adjusted_confidence: number;\n};",
        """  memory_adjusted_confidence: number;
  pre_feedback_confidence: number;
  feedback_adjustment: number;
  feedback_label: string;
  feedback_note: string;
  performance_feedback: {
    score_adjustment: number;
    feedback_label: string;
    feedback_note: string;
    sources: {
      group: string;
      name: string;
      sold_count: number;
      roi_percent: number;
      win_rate_percent: number;
      feedback_label: string;
      raw_adjustment: number;
      weighted_adjustment: number;
    }[];
  };
};""",
    )

helper_block = '''
function getFeedbackClass(label: string) {
  switch (label) {
    case "Boost":
      return "border-emerald-700 bg-emerald-950/50 text-emerald-300";
    case "Positive":
      return "border-emerald-800 bg-emerald-950/40 text-emerald-300";
    case "Neutral":
      return "border-slate-700 bg-slate-950 text-slate-300";
    case "Caution":
      return "border-amber-800 bg-amber-950/40 text-amber-300";
    case "Penalty":
      return "border-red-800 bg-red-950/40 text-red-300";
    case "Learning":
      return "border-blue-800 bg-blue-950/40 text-blue-300";
    default:
      return "border-slate-700 bg-slate-950 text-slate-300";
  }
}

function formatAdjustment(value: number) {
  if (value > 0) {
    return `+${value}`;
  }

  return String(value);
}

'''

if "function getFeedbackClass" not in text:
    text = text.replace("export default function DealAlerts()", helper_block + "export default function DealAlerts()", 1)

if "topAlert.feedback_note" not in text:
    text = text.replace(
        """                <p className="mt-2 text-sm text-emerald-300">
                  {topAlert.decision_note}
                </p>
""",
        """                <p className="mt-2 text-sm text-emerald-300">
                  {topAlert.decision_note}
                </p>

                <p className="mt-2 text-sm text-blue-300">
                  {topAlert.feedback_note}
                </p>
""",
        1,
    )

if "topAlert.feedback_label" not in text:
    text = text.replace(
        """                  <div
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getDecisionClass(
                      topAlert.final_decision,
                    )}`}
                  >
                    Grade <span className={getGradeClass(topAlert.decision_grade)}>{topAlert.decision_grade}</span>
                    {topAlert.final_decision}
                  </div>
""",
        """                  <div
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getDecisionClass(
                      topAlert.final_decision,
                    )}`}
                  >
                    Grade <span className={getGradeClass(topAlert.decision_grade)}>{topAlert.decision_grade}</span>
                    {topAlert.final_decision}
                  </div>

                  <div
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getFeedbackClass(
                      topAlert.feedback_label,
                    )}`}
                  >
                    Feedback {formatAdjustment(topAlert.feedback_adjustment)}
                    {topAlert.feedback_label}
                  </div>
""",
        1,
    )

if "alert.feedback_label" not in text[text.find("<tbody>"):]:
    text = text.replace(
        """                      <p className="mt-1 text-xs text-slate-500">
                        Score {alert.decision_score.toFixed(1)} - {alert.buy_pressure}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {alert.position_size_label}
                      </p>
""",
        """                      <p className="mt-1 text-xs text-slate-500">
                        Score {alert.decision_score.toFixed(1)} - {alert.buy_pressure}
                      </p>

                      <p
                        className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${getFeedbackClass(
                          alert.feedback_label,
                        )}`}
                      >
                        Feedback {formatAdjustment(alert.feedback_adjustment)} - {alert.feedback_label}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {alert.position_size_label}
                      </p>
""",
        1,
    )

path.write_text(text)

print("DealAlerts.tsx patched with Performance Feedback labels.")
