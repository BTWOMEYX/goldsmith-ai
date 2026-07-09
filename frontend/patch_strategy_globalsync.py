from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\frontend\src\components\GlobalSyncBar.tsx")
text = path.read_text()

if "type StrategyProfile" not in text:
    text = text.replace(
        """type SyncJob = {
  job_id?: string;
""",
        """type StrategyProfile = {
  id: string;
  label: string;
  description: string;
};

type StrategyResponse = {
  status: string;
  active_profile: StrategyProfile;
  profiles: StrategyProfile[];
  error?: string;
};

type SyncJob = {
  job_id?: string;
""",
    )

if "const STRATEGY_CHANGED_EVENT" not in text:
    text = text.replace(
        'const LAST_SYNC_KEY = "goldsmith.lastSync";',
        'const LAST_SYNC_KEY = "goldsmith.lastSync";\nconst STRATEGY_CHANGED_EVENT = "goldsmith-strategy-changed";',
    )

if "const [strategyProfile" not in text:
    text = text.replace(
        """  const [autoPilotEnabled, setAutoPilotEnabled] = useState(false);
""",
        """  const [autoPilotEnabled, setAutoPilotEnabled] = useState(false);
  const [strategyProfile, setStrategyProfile] = useState<StrategyProfile | null>(null);
  const [strategyProfiles, setStrategyProfiles] = useState<StrategyProfile[]>([]);
""",
    )

strategy_functions = '''
  async function loadStrategy() {
    try {
      const response = await axios.get<StrategyResponse>(
        `${API_BASE_URL}/strategy/status`,
      );

      if (response.data.status === "Success") {
        setStrategyProfile(response.data.active_profile);
        setStrategyProfiles(response.data.profiles);
      }
    } catch {
      setStrategyProfile(null);
      setStrategyProfiles([]);
    }
  }

  async function changeStrategy(profileId: string) {
    try {
      const response = await axios.post<StrategyResponse>(
        `${API_BASE_URL}/strategy/settings`,
        {
          profile_id: profileId,
        },
      );

      if (response.data.status === "Success") {
        setStrategyProfile(response.data.active_profile);
        setStrategyProfiles(response.data.profiles);

        window.dispatchEvent(
          new CustomEvent(STRATEGY_CHANGED_EVENT, {
            detail: {
              profileId: response.data.active_profile.id,
            },
          }),
        );

        window.dispatchEvent(new CustomEvent("goldsmith-sync-complete"));
      }
    } catch {
      // Keep the sync bar quiet if strategy API is unavailable.
    }
  }

'''

if "async function loadStrategy()" not in text:
    text = text.replace("  async function loadAutoPilot()", strategy_functions + "  async function loadAutoPilot()", 1)

text = text.replace(
    """    loadAutoPilot();
    reconnectActiveJob();
""",
    """    loadAutoPilot();
    loadStrategy();
    reconnectActiveJob();
""",
    1,
)

text = text.replace(
    """      loadAutoPilot();

      if (!running) {
""",
    """      loadAutoPilot();
      loadStrategy();

      if (!running) {
""",
    1,
)

if "function handleStrategyChanged" not in text:
    text = text.replace(
        """    function handleRealmChanged(event: Event) {
      const customEvent = event as CustomEvent<{ realmId?: number }>;
      const eventRealmId = Number(customEvent.detail?.realmId);

      if (Number.isFinite(eventRealmId) && eventRealmId > 0) {
        setRealmId(eventRealmId);
        setJob(null);
        reconnectActiveJob();
      }
    }
""",
        """    function handleRealmChanged(event: Event) {
      const customEvent = event as CustomEvent<{ realmId?: number }>;
      const eventRealmId = Number(customEvent.detail?.realmId);

      if (Number.isFinite(eventRealmId) && eventRealmId > 0) {
        setRealmId(eventRealmId);
        setJob(null);
        reconnectActiveJob();
      }
    }

    function handleStrategyChanged() {
      loadStrategy();
    }
""",
    )

text = text.replace(
    """    window.addEventListener("goldsmith-ui-mode-changed", handleModeChange);
    window.addEventListener(GOLDSMITH_REALM_CHANGED_EVENT, handleRealmChanged);
""",
    """    window.addEventListener("goldsmith-ui-mode-changed", handleModeChange);
    window.addEventListener(GOLDSMITH_REALM_CHANGED_EVENT, handleRealmChanged);
    window.addEventListener(STRATEGY_CHANGED_EVENT, handleStrategyChanged);
""",
)

text = text.replace(
    """      window.removeEventListener("goldsmith-ui-mode-changed", handleModeChange);
      window.removeEventListener(GOLDSMITH_REALM_CHANGED_EVENT, handleRealmChanged);
""",
    """      window.removeEventListener("goldsmith-ui-mode-changed", handleModeChange);
      window.removeEventListener(GOLDSMITH_REALM_CHANGED_EVENT, handleRealmChanged);
      window.removeEventListener(STRATEGY_CHANGED_EVENT, handleStrategyChanged);
""",
)

if "strategyProfiles.map" not in text:
    text = text.replace(
        """          <button
            type="button"
            onClick={() => startSync("quick")}
""",
        """          {strategyProfiles.length > 0 && (
            <select
              value={strategyProfile?.id ?? "balanced"}
              onChange={(event) => changeStrategy(event.target.value)}
              title="Active GoldSmith strategy profile"
              className="min-w-[190px] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-white outline-none transition focus:border-blue-500"
            >
              {strategyProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => startSync("quick")}
""",
        1,
    )

if "Strategy:" not in text:
    text = text.replace(
        """            <span
              className={[
                "rounded-full border px-2 py-1 text-[11px] font-bold",
                autoPilotEnabled
                  ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
                  : "border-slate-700 bg-slate-950 text-slate-400",
              ].join(" ")}
            >
              {autoPilotEnabled ? "Auto Watch Active" : "Auto Watch Off"}
            </span>
""",
        """            <span
              className={[
                "rounded-full border px-2 py-1 text-[11px] font-bold",
                autoPilotEnabled
                  ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
                  : "border-slate-700 bg-slate-950 text-slate-400",
              ].join(" ")}
            >
              {autoPilotEnabled ? "Auto Watch Active" : "Auto Watch Off"}
            </span>

            {strategyProfile && (
              <span className="rounded-full border border-blue-800 bg-blue-950/40 px-2 py-1 text-[11px] font-bold text-blue-300">
                Strategy: {strategyProfile.label}
              </span>
            )}
""",
        1,
    )

path.write_text(text)

print("GlobalSyncBar.tsx patched with Strategy selector.")
