from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\frontend\src\App.tsx")
text = path.read_text()

if "const [refreshKey, setRefreshKey]" not in text:
    text = text.replace(
        '''  const [uiMode, setUiModeState] = useState<UiMode>(() => readUiMode());
''',
        '''  const [uiMode, setUiModeState] = useState<UiMode>(() => readUiMode());
  const [refreshKey, setRefreshKey] = useState(0);
''',
    )

refresh_effect = '''
  useEffect(() => {
    function refreshActivePage() {
      setRefreshKey((current) => current + 1);
    }

    window.addEventListener("goldsmith-sync-complete", refreshActivePage);
    window.addEventListener("goldsmith-data-refresh", refreshActivePage);
    window.addEventListener("goldsmith-realm-changed", refreshActivePage);
    window.addEventListener("goldsmith-strategy-changed", refreshActivePage);

    return () => {
      window.removeEventListener("goldsmith-sync-complete", refreshActivePage);
      window.removeEventListener("goldsmith-data-refresh", refreshActivePage);
      window.removeEventListener("goldsmith-realm-changed", refreshActivePage);
      window.removeEventListener("goldsmith-strategy-changed", refreshActivePage);
    };
  }, []);

'''

if "goldsmith-data-refresh" not in text[text.find("export default function App"):text.find("const visibleNavItems")]:
    text = text.replace(
        '''  useEffect(() => {
    document.documentElement.dataset.goldsmithMode = uiMode;
  }, [uiMode]);

''',
        '''  useEffect(() => {
    document.documentElement.dataset.goldsmithMode = uiMode;
  }, [uiMode]);

''' + refresh_effect,
    )

if "<Routes key={refreshKey}>" not in text:
    text = text.replace("<Routes>", "<Routes key={refreshKey}>")

path.write_text(text)

print("App.tsx patched to remount active page on global refresh events.")
