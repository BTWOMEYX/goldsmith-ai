from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\backend\app\services\strategy_profiles.py")
text = path.read_text()

text = text.replace(
    'margin_percent = float(adjusted.get("estimated_margin_percent") or 0)',
    '''margin_percent = float(
        adjusted.get("estimated_net_margin_percent")
        or adjusted.get("estimated_margin_percent")
        or 0
    )''',
)

text = text.replace(
    'f"Margin {round(margin_percent, 1)}% is below the {active_strategy[\'label\']} requirement."',
    'f"Net margin {round(margin_percent, 1)}% is below the {active_strategy[\'label\']} requirement."',
)

path.write_text(text)

print("strategy_profiles.py patched to use net margin.")
