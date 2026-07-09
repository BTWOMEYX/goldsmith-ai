from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\frontend\src\components\GlobalSyncBar.tsx")
text = path.read_text()

old = '''          loadLastSyncLabel();
          window.dispatchEvent(new CustomEvent("goldsmith-sync-complete"));
'''

new = '''          loadLastSyncLabel();

          const refreshDetail = {
            realmId,
            connectedRealmId: realmId,
            jobId: freshJob.job_id,
            scanMode: freshJob.scan_mode,
            completedAt: new Date().toISOString(),
            reason: "sync-complete",
          };

          window.dispatchEvent(
            new CustomEvent("goldsmith-sync-complete", {
              detail: refreshDetail,
            }),
          );

          window.dispatchEvent(
            new CustomEvent("goldsmith-data-refresh", {
              detail: refreshDetail,
            }),
          );
'''

if old in text:
    text = text.replace(old, new, 1)
else:
    print("WARNING: sync-complete block not found. Trying fallback patch.")

    text = text.replace(
        'window.dispatchEvent(new CustomEvent("goldsmith-sync-complete"));',
        '''window.dispatchEvent(
            new CustomEvent("goldsmith-sync-complete", {
              detail: {
                realmId,
                connectedRealmId: realmId,
                jobId: freshJob.job_id,
                scanMode: freshJob.scan_mode,
                completedAt: new Date().toISOString(),
                reason: "sync-complete",
              },
            }),
          );

          window.dispatchEvent(
            new CustomEvent("goldsmith-data-refresh", {
              detail: {
                realmId,
                connectedRealmId: realmId,
                jobId: freshJob.job_id,
                scanMode: freshJob.scan_mode,
                completedAt: new Date().toISOString(),
                reason: "sync-complete",
              },
            }),
          );''',
    )

path.write_text(text)

print("GlobalSyncBar.tsx patched to broadcast app-wide refresh after sync completion.")
