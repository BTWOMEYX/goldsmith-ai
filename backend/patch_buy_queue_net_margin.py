from pathlib import Path
import re

path = Path(r"F:\Projects\goldsmith-ai\backend\app\api\buy_queue.py")
text = path.read_text()

if "AH_CUT_PERCENT" not in text:
    text = text.replace(
        'ALLOWED_STATUSES = {\n',
        'AH_CUT_PERCENT = 5.0\nAH_CUT_RATE = AH_CUT_PERCENT / 100\n\n\nALLOWED_STATUSES = {\n',
        1,
    )

new_function = r'''
def calculate_queue_numbers(payload: BuyQueueFromAlertPayload) -> dict:
    quantity = max(int(payload.suggested_quantity or 0), 0)
    max_price_each = round(float(payload.max_price_each or 0), 2)
    target_sale_price_each = round(float(payload.target_sale_price_each or 0), 2)

    max_total_spend = round(quantity * max_price_each, 2)

    gross_profit_each = round(target_sale_price_each - max_price_each, 2)
    gross_total_profit = round(gross_profit_each * quantity, 2)
    gross_margin_percent = (
        round((gross_profit_each / max_price_each) * 100, 2)
        if max_price_each > 0
        else 0
    )

    net_sale_price_each = round(target_sale_price_each * (1 - AH_CUT_RATE), 2)
    expected_profit_each = round(net_sale_price_each - max_price_each, 2)
    expected_total_profit = round(expected_profit_each * quantity, 2)
    expected_margin_percent = (
        round((expected_profit_each / max_price_each) * 100, 2)
        if max_price_each > 0
        else 0
    )

    return {
        "suggested_quantity": quantity,
        "max_price_each": max_price_each,
        "target_sale_price_each": target_sale_price_each,
        "max_total_spend": max_total_spend,

        "gross_profit_each": gross_profit_each,
        "gross_total_profit": gross_total_profit,
        "gross_margin_percent": gross_margin_percent,

        "net_sale_price_each": net_sale_price_each,
        "expected_profit_each": expected_profit_each,
        "expected_total_profit": expected_total_profit,
        "expected_margin_percent": expected_margin_percent,
    }
'''

pattern = r"def calculate_queue_numbers\(payload: BuyQueueFromAlertPayload\) -> dict:.*?\n\n\n@router.get"
replacement = new_function + "\n\n\n@router.get"

text, count = re.subn(pattern, replacement, text, flags=re.S)

if count != 1:
    raise RuntimeError("Could not replace calculate_queue_numbers cleanly.")

text = text.replace(
    "existing_item.expected_margin_percent = payload.expected_margin_percent",
    'existing_item.expected_margin_percent = numbers["expected_margin_percent"]',
)

text = text.replace(
    "expected_margin_percent=payload.expected_margin_percent,",
    'expected_margin_percent=numbers["expected_margin_percent"],',
)

if '"ah_cut_percent": AH_CUT_PERCENT,' not in text:
    text = text.replace(
        '''        "expected_margin_percent": item.expected_margin_percent,
        "status": item.status,''',
        '''        "expected_margin_percent": item.expected_margin_percent,
        "ah_cut_percent": AH_CUT_PERCENT,
        "profit_model": "net_after_ah_cut",
        "status": item.status,''',
    )

path.write_text(text)

print("buy_queue.py patched with net expected profit.")
