const SEEN_VERSION_KEY = "keystoneclient.changelog.seenVersion";

export interface VersionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type PostUpdateChangelog = {
  version: string;
  notes: string;
};

export function findPostUpdateChangelog(
  storage: VersionStorage,
  version: string,
  notes: string,
): PostUpdateChangelog | null {
  const seen = storage.getItem(SEEN_VERSION_KEY);
  if (seen === null) {
    storage.setItem(SEEN_VERSION_KEY, version);
    return null;
  }
  if (seen === version) {
    return null;
  }
  return { version, notes };
}

export function markChangelogSeen(storage: VersionStorage, version: string): void {
  storage.setItem(SEEN_VERSION_KEY, version);
}
