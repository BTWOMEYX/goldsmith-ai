from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\frontend\src\components\GlobalSyncBar.tsx")
text = path.read_text()

insert_block = '''
  useEffect(() => {
    const interval = window.setInterval(async () => {
      if (activeJob && ["queued", "running"].includes(activeJob.status)) {
        return;
      }

      try {
        const currentRealm = readStoredRealmSelection();

        const response = await axios.get<SyncJobResponse>(
          `${API_BASE_URL}/sync-jobs/active?connected_realm_id=${currentRealm.connected_realm_id}`,
        );

        if (response.data.job) {
          setActiveJob(response.data.job);
          setMessage("Reconnected to active backend sync job.");
        }
      } catch {
        // Silent reconnect check.
      }
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [activeJob]);

'''

if "Reconnected to active backend sync job." not in text:
    text = text.replace(
        "  const isSyncing =",
        insert_block + "  const isSyncing =",
        1,
    )

path.write_text(text)

print("GlobalSyncBar active job reconnect added.")
