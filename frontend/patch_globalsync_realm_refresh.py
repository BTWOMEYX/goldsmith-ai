from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\frontend\src\components\GlobalSyncBar.tsx")
text = path.read_text()

old = '''      if (Number.isFinite(eventRealmId) && eventRealmId > 0) {
        setRealmId(eventRealmId);
        setJob(null);
        reconnectActiveJob();
      }
'''

new = '''      if (Number.isFinite(eventRealmId) && eventRealmId > 0) {
        setRealmId(eventRealmId);
        setJob(null);
        setError("");

        window.dispatchEvent(
          new CustomEvent("goldsmith-data-refresh", {
            detail: {
              realmId: eventRealmId,
              connectedRealmId: eventRealmId,
              reason: "realm-changed",
              completedAt: new Date().toISOString(),
            },
          }),
        );

        reconnectActiveJob();
      }
'''

if old in text:
    text = text.replace(old, new, 1)
else:
    print("Realm change block not found. No patch made.")

path.write_text(text)

print("GlobalSyncBar.tsx patched to refresh pages on realm change.")
