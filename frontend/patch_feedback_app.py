from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\frontend\src\App.tsx")
text = path.read_text()

if "Brain," not in text:
    text = text.replace(
        "  BarChart3,\n",
        "  BarChart3,\n  Brain,\n",
    )

if 'import PerformanceFeedback from "./pages/PerformanceFeedback";' not in text:
    text = text.replace(
        'import ProfitTracker from "./pages/ProfitTracker";',
        'import ProfitTracker from "./pages/ProfitTracker";\nimport PerformanceFeedback from "./pages/PerformanceFeedback";',
    )

if 'label: "Feedback Engine"' not in text:
    text = text.replace(
        '''  {
    label: "Profit Tracker",
    path: "/profit",
    icon: BadgeDollarSign,
  },
''',
        '''  {
    label: "Profit Tracker",
    path: "/profit",
    icon: BadgeDollarSign,
  },
  {
    label: "Feedback Engine",
    path: "/feedback",
    icon: Brain,
  },
''',
    )

if '<Route path="/feedback" element={<PerformanceFeedback />} />' not in text:
    text = text.replace(
        '<Route path="/profit" element={<ProfitTracker />} />',
        '<Route path="/profit" element={<ProfitTracker />} />\n              <Route path="/feedback" element={<PerformanceFeedback />} />',
    )

path.write_text(text)

print("Performance Feedback route added to App.tsx")
