from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\Settings.tsx")
text = path.read_text()

if 'import StrategyProfilePanel from "../components/StrategyProfilePanel";' not in text:
    text = text.replace(
        'import AutoPilotPanel from "../components/AutoPilotPanel";',
        'import AutoPilotPanel from "../components/AutoPilotPanel";\nimport StrategyProfilePanel from "../components/StrategyProfilePanel";',
    )

if "<StrategyProfilePanel />" not in text:
    text = text.replace(
        "<AutoPilotPanel />",
        "<AutoPilotPanel />\n\n      <StrategyProfilePanel />",
        1,
    )

path.write_text(text)

print("Settings.tsx patched with Strategy Profile panel.")
