from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\frontend\src\components\GlobalSyncBar.tsx")
text = path.read_text()

if "<RealmSelect" in text and "master" not in text[text.find("<RealmSelect"):text.find("<RealmSelect") + 250]:
    text = text.replace(
        "<RealmSelect\n            value={realmId}",
        "<RealmSelect\n            master\n            value={realmId}",
        1,
    )

path.write_text(text)

print("GlobalSyncBar RealmSelect marked as master.")
