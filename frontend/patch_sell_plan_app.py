from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\frontend\src\App.tsx")
text = path.read_text()

if 'import SellPlan from "./pages/SellPlan";' not in text:
    text = text.replace(
        'import ProfitTracker from "./pages/ProfitTracker";',
        'import ProfitTracker from "./pages/ProfitTracker";\nimport SellPlan from "./pages/SellPlan";',
    )

if 'label: "Sell Plan"' not in text:
    text = text.replace(
        '''  {
    label: "Buy Queue",
    path: "/buy-queue",
    icon: ShoppingCart,
    simple: true,
  },
''',
        '''  {
    label: "Buy Queue",
    path: "/buy-queue",
    icon: ShoppingCart,
    simple: true,
  },
  {
    label: "Sell Plan",
    path: "/sell-plan",
    icon: BadgeDollarSign,
    simple: true,
  },
''',
    )

if '<Route path="/sell-plan" element={<SellPlan />} />' not in text:
    text = text.replace(
        '<Route path="/buy-queue" element={<BuyQueue />} />',
        '<Route path="/buy-queue" element={<BuyQueue />} />\n              <Route path="/sell-plan" element={<SellPlan />} />',
    )

path.write_text(text, encoding="utf-8")

print("Sell Plan page added to App.tsx")
