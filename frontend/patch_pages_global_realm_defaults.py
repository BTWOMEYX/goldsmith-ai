from pathlib import Path

pages = [
    Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\Dashboard.tsx"),
    Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\DealAlerts.tsx"),
    Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\BuyQueue.tsx"),
    Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\ProfitTracker.tsx"),
    Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\PerformanceFeedback.tsx"),
    Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\MarketScanner.tsx"),
    Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\Watchlist.tsx"),
    Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\Analytics.tsx"),
    Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\Settings.tsx"),
]

for path in pages:
    if not path.exists():
        continue

    text = path.read_text()
    original = text

    if "getGlobalRealmId" not in text:
        if 'import RealmSelect from "../components/RealmSelect";' in text:
            text = text.replace(
                'import RealmSelect from "../components/RealmSelect";',
                'import RealmSelect from "../components/RealmSelect";\nimport { getGlobalRealmId } from "../utils/globalRealm";',
            )
        else:
            # Insert after the last local component import if possible.
            marker = 'const API_BASE_URL'
            if marker in text:
                text = text.replace(
                    marker,
                    'import { getGlobalRealmId } from "../utils/globalRealm";\n\n' + marker,
                    1,
                )

    text = text.replace("useState(11)", "useState(() => getGlobalRealmId())")
    text = text.replace("useState<number>(11)", "useState<number>(() => getGlobalRealmId())")
    text = text.replace("useState(defaultRealm ?? 11)", "useState(() => getGlobalRealmId(defaultRealm ?? 11))")
    text = text.replace("useState(() => readRealmId())", "useState(() => getGlobalRealmId())")

    if text != original:
        path.write_text(text)
        print(f"Patched {path.name}")
    else:
        print(f"No change needed for {path.name}")
