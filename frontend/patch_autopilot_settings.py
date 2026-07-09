from pathlib import Path

settings_path = Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\Settings.tsx")
text = settings_path.read_text()

if 'import AutoPilotPanel from "../components/AutoPilotPanel";' not in text:
    text = text.replace(
        'import RealmSelect from "../components/RealmSelect";',
        'import AutoPilotPanel from "../components/AutoPilotPanel";\nimport RealmSelect from "../components/RealmSelect";',
    )

if "<AutoPilotPanel realm={realm} />" not in text:
    text = text.replace(
        '      <div className="grid gap-4 md:grid-cols-3">',
        '      <AutoPilotPanel realm={realm} />\n\n      <div className="grid gap-4 md:grid-cols-3">',
        1,
    )

settings_path.write_text(text)

print("AutoPilot panel added to Settings.tsx")
