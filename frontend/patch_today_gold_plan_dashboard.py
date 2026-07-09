from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\Dashboard.tsx")
text = path.read_text()

if 'import TodayGoldPlan from "../components/TodayGoldPlan";' not in text:
    text = text.replace(
        'import RealmSelect from "../components/RealmSelect";',
        'import RealmSelect from "../components/RealmSelect";\nimport TodayGoldPlan from "../components/TodayGoldPlan";',
    )

if "<TodayGoldPlan realm={realm} />" not in text:
    marker = """      {message && (
        <div className="rounded-xl border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-300">
          {message}
        </div>
      )}

"""
    replacement = marker + "      <TodayGoldPlan realm={realm} />\n\n"

    text = text.replace(marker, replacement, 1)

path.write_text(text)

print("Dashboard.tsx patched with TodayGoldPlan.")
