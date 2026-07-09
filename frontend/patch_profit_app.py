from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\frontend\src\App.tsx")
text = path.read_text()

if "BadgeDollarSign," not in text:
    text = text.replace(
        "  BarChart3,\n",
        "  BadgeDollarSign,\n  BarChart3,\n",
    )

if 'import ProfitTracker from "./pages/ProfitTracker";' not in text:
    text = text.replace(
        'import MarketScanner from "./pages/MarketScanner";',
        'import MarketScanner from "./pages/MarketScanner";\nimport ProfitTracker from "./pages/ProfitTracker";',
    )

if 'label: "Profit Tracker"' not in text:
    text = text.replace(
        '''  {
    label: "Buy Queue",
    path: "/buy-queue",
    icon: ShoppingCart,
  },
''',
        '''  {
    label: "Buy Queue",
    path: "/buy-queue",
    icon: ShoppingCart,
  },
  {
    label: "Profit Tracker",
    path: "/profit",
    icon: BadgeDollarSign,
  },
''',
    )

if '<Route path="/profit" element={<ProfitTracker />} />' not in text:
    text = text.replace(
        '<Route path="/buy-queue" element={<BuyQueue />} />',
        '<Route path="/buy-queue" element={<BuyQueue />} />\n              <Route path="/profit" element={<ProfitTracker />} />',
    )

path.write_text(text)

print("Profit Tracker route added to App.tsx")
