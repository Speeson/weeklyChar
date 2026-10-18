const SEEN_VERSION_KEY = "keystoneclient.changelog.seenVersion";
const SEEN_NEW_THEMES_KEY = "keystoneclient.changelog.frostHeavenSeen";

export interface VersionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type PostUpdateChangelog = {
  version: string;
  notes: string;
  showNewThemes: boolean;
};

export type ChangelogCheck = (
  version: string,
  browserSeenVersion: string | null,
) => Promise<{ show: boolean; firstRun: boolean }>;

export function findPostUpdateChangelog(
  storage: VersionStorage,
  version: string,
  notes: string,
): PostUpdateChangelog | null {
  const seen = storage.getItem(SEEN_VERSION_KEY);
  if (seen === null) {
    storage.setItem(SEEN_NEW_THEMES_KEY, "true");
    storage.setItem(SEEN_VERSION_KEY, version);
    return null;
  }
  if (seen === version) {
    return null;
  }
  const showNewThemes = isNewThemesAnnouncementDue(storage);
  storage.setItem(SEEN_VERSION_KEY, version);
  return { version, notes, showNewThemes };
}

export async function findPersistedPostUpdateChangelog(
  storage: VersionStorage | null,
  version: string,
  notes: string,
  check: ChangelogCheck,
): Promise<PostUpdateChangelog | null> {
  let browserSeenVersion: string | null = null;
  try {
    browserSeenVersion = storage?.getItem(SEEN_VERSION_KEY) ?? null;
  } catch {
    // The sidecar can still remember the version when WebView storage is blocked.
  }

  let result: Awaited<ReturnType<ChangelogCheck>>;
  try {
    result = await check(version, browserSeenVersion);
  } catch {
    try {
      return storage ? findPostUpdateChangelog(storage, version, notes) : null;
    } catch {
      return null;
    }
  }

  if (browserSeenVersion === null) {
    try { storage?.setItem(SEEN_NEW_THEMES_KEY, "true"); } catch { /* WebView storage may be blocked. */ }
  }
  try { storage?.setItem(SEEN_VERSION_KEY, version); } catch { /* The sidecar already persisted the version. */ }
  if (!result.show) return null;

  let showNewThemes = false;
  try { showNewThemes = storage ? isNewThemesAnnouncementDue(storage) : false; } catch { /* WebView storage may be blocked. */ }
  return { version, notes, showNewThemes };
}

export function isNewThemesAnnouncementDue(storage: VersionStorage): boolean {
  return storage.getItem(SEEN_NEW_THEMES_KEY) !== "true";
}

export function markNewThemesSeen(storage: VersionStorage): void {
  storage.setItem(SEEN_NEW_THEMES_KEY, "true");
}
