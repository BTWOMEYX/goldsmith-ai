from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\frontend\src\pages\Dashboard.tsx")
text = path.read_text()

if 'import { listenForGlobalRealmChange, setGlobalRealmId } from "../utils/globalRealm";' not in text:
    text = text.replace(
        'import RealmSelect from "../components/RealmSelect";',
        'import RealmSelect from "../components/RealmSelect";\nimport { listenForGlobalRealmChange, setGlobalRealmId } from "../utils/globalRealm";',
    )

text = text.replace(
    'localStorage.setItem(REALM_KEY, String(nextRealm));',
    'setGlobalRealmId(nextRealm);',
)

if "listenForGlobalRealmChange" in text and "return listenForGlobalRealmChange" not in text:
    text = text.replace(
        """  useEffect(() => {
    loadActionCenter();
  }, [realm]);
""",
        """  useEffect(() => {
    loadActionCenter();
  }, [realm]);

  useEffect(() => {
    return listenForGlobalRealmChange((realmId) => {
      setRealmState(realmId);
    });
  }, []);
""",
    )

path.write_text(text)

print("Dashboard.tsx patched to follow Global Sync realm.")
