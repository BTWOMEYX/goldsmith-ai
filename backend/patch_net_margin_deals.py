from pathlib import Path
import re

path = Path(r"F:\Projects\goldsmith-ai\backend\app\api\deals.py")
text = path.read_text()

if "AH_CUT_PERCENT" not in text:
    text = text.replace(
        "FAST_MOVE_CATEGORIES = {",
        "AH_CUT_PERCENT = 5.0\nAH_CUT_RATE = AH_CUT_PERCENT / 100\n\n\nFAST_MOVE_CATEGORIES = {",
        1,
    )

new_get_price_targets = r'''
def get_price_targets(item: TrackedItem, market_memory: dict | None = None) -> dict:
    category = item.goldsmith_category or "Unknown / Other"
    current_price = item.current_price

    memory_price_state = (
        market_memory.get("price_state")
        if market_memory
        else "Learning"
    )

    if category in FAST_MOVE_CATEGORIES:
        buy_below = current_price * 0.96
        resale_target = current_price * 1.14
    elif category in SLOW_MARGIN_CATEGORIES:
        buy_below = current_price * 0.88
        resale_target = current_price * 1.35
    else:
        buy_below = current_price * 0.93
        resale_target = current_price * 1.18

    average_30 = (
        market_memory.get("average_30_day_price")
        if market_memory
        else None
    )

    if average_30 and average_30 > 0:
        if memory_price_state in ["Deep Undervalued", "Undervalued"]:
            resale_target = max(resale_target, average_30 * 0.96)
        elif memory_price_state == "Below Normal":
            resale_target = max(resale_target, average_30 * 0.92)
        elif memory_price_state in ["Above Normal", "Overpriced"]:
            buy_below = min(buy_below, average_30 * 0.82)
            resale_target = min(resale_target, average_30 * 1.05)

    gross_profit = resale_target - buy_below
    gross_margin_percent = (
        (gross_profit / buy_below) * 100 if buy_below > 0 else 0
    )

    estimated_ah_cut = resale_target * AH_CUT_RATE
    net_resale_after_ah_cut = resale_target - estimated_ah_cut
    net_profit_after_ah_cut = net_resale_after_ah_cut - buy_below
    net_margin_percent = (
        (net_profit_after_ah_cut / buy_below) * 100 if buy_below > 0 else 0
    )

    break_even_resale_price = (
        buy_below / (1 - AH_CUT_RATE)
        if buy_below > 0 and AH_CUT_RATE < 1
        else buy_below
    )

    return {
        "suggested_buy_below": round(buy_below, 2),
        "target_resale_price": round(resale_target, 2),

        "ah_cut_percent": AH_CUT_PERCENT,
        "estimated_ah_cut": round(estimated_ah_cut, 2),
        "break_even_resale_price": round(break_even_resale_price, 2),

        "gross_estimated_profit": round(gross_profit, 2),
        "gross_estimated_margin_percent": round(gross_margin_percent, 2),

        "estimated_profit_before_costs": round(gross_profit, 2),
        "estimated_margin_percent": round(net_margin_percent, 2),

        "net_resale_after_ah_cut": round(net_resale_after_ah_cut, 2),
        "estimated_net_profit_after_ah_cut": round(net_profit_after_ah_cut, 2),
        "estimated_net_margin_percent": round(net_margin_percent, 2),
    }
'''

pattern = r"def get_price_targets\(item: TrackedItem, market_memory: dict \| None = None\) -> dict:.*?\n\n\ndef calculate_liquidity_score"
replacement = new_get_price_targets + "\n\n\ndef calculate_liquidity_score"

text, count = re.subn(pattern, replacement, text, flags=re.S)

if count != 1:
    raise RuntimeError("Could not replace get_price_targets cleanly.")

path.write_text(text)

print("deals.py patched with gross/net margin model.")
