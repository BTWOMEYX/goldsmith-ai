from pathlib import Path

buy_queue = Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\BuyQueue.tsx")
text = buy_queue.read_text()

text = text.replace("Expected Profit", "Net Profit")
text = text.replace("Expected Margin Percent", "Net Margin Percent")
text = text.replace("% margin", "% net margin")
text = text.replace('"Expected Profit"', '"Net Profit"')
text = text.replace('"Expected Margin Percent"', '"Net Margin Percent"')

buy_queue.write_text(text)

profit = Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\ProfitTracker.tsx")
text = profit.read_text()

text = text.replace(
    "Expected {formatGold(trade.expected_profit)}",
    "Expected net {formatGold(trade.expected_profit)}",
)

text = text.replace("expected profit", "expected net profit")

profit.write_text(text)

settings = Path(r"F:\Projects\goldsmith-ai\frontend\src\components\StrategyProfilePanel.tsx")
text = settings.read_text()

text = text.replace("Min Margin", "Min Net Margin")
text = text.replace("Margin {profile.min_margin_percent}%", "Net {profile.min_margin_percent}%")

settings.write_text(text)

print("Frontend labels patched for net margins.")
