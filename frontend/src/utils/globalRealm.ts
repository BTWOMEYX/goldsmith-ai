export const GOLDSMITH_REALM_KEY = "goldsmith.defaultRealm";
export const GOLDSMITH_REALM_CHANGED_EVENT = "goldsmith-realm-changed";

export function getGlobalRealmId(defaultRealmId = 11) {
  const stored = Number(localStorage.getItem(GOLDSMITH_REALM_KEY));

  if (Number.isFinite(stored) && stored > 0) {
    return stored;
  }

  return defaultRealmId;
}

export function setGlobalRealmId(realmId: number) {
  localStorage.setItem(GOLDSMITH_REALM_KEY, String(realmId));

  window.dispatchEvent(
    new CustomEvent(GOLDSMITH_REALM_CHANGED_EVENT, {
      detail: {
        realmId,
      },
    }),
  );
}

export function listenForGlobalRealmChange(
  handler: (realmId: number) => void,
) {
  function handleChange(event: Event) {
    const customEvent = event as CustomEvent<{ realmId?: number }>;
    const eventRealmId = Number(customEvent.detail?.realmId);
    const realmId = Number.isFinite(eventRealmId)
      ? eventRealmId
      : getGlobalRealmId();

    handler(realmId);
  }

  window.addEventListener(GOLDSMITH_REALM_CHANGED_EVENT, handleChange);

  return () => {
    window.removeEventListener(GOLDSMITH_REALM_CHANGED_EVENT, handleChange);
  };
}
