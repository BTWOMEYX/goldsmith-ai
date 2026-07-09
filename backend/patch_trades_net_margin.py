from pathlib import Path
import re

path = Path(r"F:\Projects\goldsmith-ai\backend\app\api\trades.py")
text = path.read_text()

if "AH_CUT_PERCENT" not in text:
    text = text.replace(
        'ALLOWED_TRADE_STATUSES = {\n',
        'AH_CUT_PERCENT = 5.0\nAH_CUT_RATE = AH_CUT_PERCENT / 100\n\n\nALLOWED_TRADE_STATUSES = {\n',
        1,
    )

new_function = r'''
def calculate_expected_values(
    quantity: int,
    buy_price_each: float,
    target_sale_price_each: float,
) -> dict:
    total_buy_cost = round(quantity * buy_price_each, 2)

    expected_gross_sale_value = round(quantity * target_sale_price_each, 2)
    expected_sale_fee_value = round(expected_gross_sale_value * AH_CUT_RATE, 2)
    expected_net_sale_value = round(
        expected_gross_sale_value - expected_sale_fee_value,
        2,
    )

    expected_profit = round(expected_net_sale_value - total_buy_cost, 2)

    expected_roi_percent = (
        round((expected_profit / total_buy_cost) * 100, 2)
        if total_buy_cost > 0
        else 0
    )

    return {
        "total_buy_cost": total_buy_cost,
        "expected_total_sale_value": expected_net_sale_value,
        "expected_profit": expected_profit,
        "expected_roi_percent": expected_roi_percent,
    }
'''

pattern = r"def calculate_expected_values\(\n    quantity: int,\n    buy_price_each: float,\n    target_sale_price_each: float,\n\) -> dict:.*?\n\n\ndef calculate_realized_values"
replacement = new_function + "\n\n\ndef calculate_realized_values"

text, count = re.subn(pattern, replacement, text, flags=re.S)

if count != 1:
    raise RuntimeError("Could not replace calculate_expected_values cleanly.")

if '"expected_ah_cut_percent": AH_CUT_PERCENT,' not in text:
    text = text.replace(
        '''        "expected_roi_percent": trade.expected_roi_percent,
        "quantity_sold": trade.quantity_sold,''',
        '''        "expected_roi_percent": trade.expected_roi_percent,
        "expected_ah_cut_percent": AH_CUT_PERCENT,
        "expected_gross_sale_value": round(trade.quantity_bought * trade.target_sale_price_each, 2),
        "expected_sale_fee_value": round((trade.quantity_bought * trade.target_sale_price_each) * AH_CUT_RATE, 2),
        "expected_net_sale_value": trade.expected_total_sale_value,
        "quantity_sold": trade.quantity_sold,''',
    )

path.write_text(text)

print("trades.py patched with net expected ROI.")
