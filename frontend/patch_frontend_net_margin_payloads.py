from pathlib import Path

files = [
    Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\Dashboard.tsx"),
    Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\DealAlerts.tsx"),
    Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\BuyQueue.tsx"),
]

for path in files:
    text = path.read_text()

    if "estimated_net_margin_percent" not in text:
        text = text.replace(
            "  estimated_margin_percent: number;",
            "  estimated_margin_percent: number;\n  estimated_net_margin_percent?: number;",
        )

    text = text.replace(
        "expected_margin_percent: alert.estimated_margin_percent,",
        "expected_margin_percent: alert.estimated_net_margin_percent ?? alert.estimated_margin_percent,",
    )

    path.write_text(text)

print("Frontend queue payloads patched to prefer net margin.")
