from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\frontend\src\components\GlobalSyncBar.tsx")
text = path.read_text()

if 'import RealmSelect from "./RealmSelect";' not in text:
    text = text.replace(
        'import {\n',
        'import RealmSelect from "./RealmSelect";\n\nimport {\n',
    )

if "GOLDSMITH_REALM_CHANGED_EVENT" not in text:
    text = text.replace(
        'const REALM_KEY = "goldsmith.defaultRealm";',
        'const REALM_KEY = "goldsmith.defaultRealm";\nconst GOLDSMITH_REALM_CHANGED_EVENT = "goldsmith-realm-changed";',
    )

if "function handleRealmChanged" not in text:
    text = text.replace(
        """    function handleModeChange() {
      setUiMode(readUiMode());
    }

    window.addEventListener("goldsmith-ui-mode-changed", handleModeChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("goldsmith-ui-mode-changed", handleModeChange);
    };
""",
        """    function handleModeChange() {
      setUiMode(readUiMode());
    }

    function handleRealmChanged(event: Event) {
      const customEvent = event as CustomEvent<{ realmId?: number }>;
      const eventRealmId = Number(customEvent.detail?.realmId);

      if (Number.isFinite(eventRealmId) && eventRealmId > 0) {
        setRealmId(eventRealmId);
        setJob(null);
        reconnectActiveJob();
      }
    }

    window.addEventListener("goldsmith-ui-mode-changed", handleModeChange);
    window.addEventListener(GOLDSMITH_REALM_CHANGED_EVENT, handleRealmChanged);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("goldsmith-ui-mode-changed", handleModeChange);
      window.removeEventListener(GOLDSMITH_REALM_CHANGED_EVENT, handleRealmChanged);
    };
""",
    )

if "<RealmSelect value={realmId}" not in text:
    text = text.replace(
        """        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => startSync("quick")}
""",
        """        <div className="flex flex-wrap items-center gap-2">
          <RealmSelect
            value={realmId}
            onChange={(nextRealmId) => {
              setRealmId(nextRealmId);
              setJob(null);
            }}
          />

          <button
            type="button"
            onClick={() => startSync("quick")}
""",
        1,
    )

text = text.replace(
    "<span>Realm {realmId}</span>",
    "<span>Global realm {realmId}</span>",
)

path.write_text(text)

print("GlobalSyncBar.tsx patched with global realm selector.")
