from pathlib import Path

# Fix Settings.tsx
settings_path = Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\Settings.tsx")
settings = settings_path.read_text()

if 'import StrategyProfilePanel from "../components/StrategyProfilePanel";' in settings:
    if "<StrategyProfilePanel" not in settings:
        if "<AutoPilotPanel />" in settings:
            settings = settings.replace(
                "<AutoPilotPanel />",
                "<AutoPilotPanel />\n\n      <StrategyProfilePanel />",
                1,
            )
        else:
            settings = settings.replace(
                'import StrategyProfilePanel from "../components/StrategyProfilePanel";\n',
                "",
            )

settings_path.write_text(settings)

# Fix Watchlist.tsx
watchlist_path = Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\Watchlist.tsx")
watchlist = watchlist_path.read_text()

if (
    'import { getGlobalRealmId } from "../utils/globalRealm";' in watchlist
    and "getGlobalRealmId()" not in watchlist
    and "getGlobalRealmId(" not in watchlist.replace('import { getGlobalRealmId } from "../utils/globalRealm";', "")
):
    watchlist = watchlist.replace(
        'import { getGlobalRealmId } from "../utils/globalRealm";\n',
        "",
    )

watchlist_path.write_text(watchlist)

print("Unused TypeScript imports fixed.")
