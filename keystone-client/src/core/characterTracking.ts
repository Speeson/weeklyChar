export const INACTIVE_CHARACTER_IDS_STORAGE_KEY = "keystone-client.characters.inactive.v1";

const MAX_STORED_CHARACTER_IDS = 5_000;
const MAX_CHARACTER_ID_LENGTH = 256;

type CharacterTrackingStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): CharacterTrackingStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadInactiveCharacterIds(storage: CharacterTrackingStorage | null = browserStorage()): Set<string> {
  if (!storage) return new Set();
  try {
    const parsed: unknown = JSON.parse(storage.getItem(INACTIVE_CHARACTER_IDS_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed) || parsed.length > MAX_STORED_CHARACTER_IDS) return new Set();
    return new Set(parsed.filter((value): value is string => (
      typeof value === "string" && value.length > 0 && value.length <= MAX_CHARACTER_ID_LENGTH
    )));
  } catch {
    return new Set();
  }
}

export function saveInactiveCharacterIds(ids: Iterable<string>, storage: CharacterTrackingStorage | null = browserStorage()): void {
  if (!storage) return;
  const normalized = [...new Set(ids)]
    .filter(id => id.length > 0 && id.length <= MAX_CHARACTER_ID_LENGTH)
    .sort()
    .slice(0, MAX_STORED_CHARACTER_IDS);
  try {
    storage.setItem(INACTIVE_CHARACTER_IDS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // A disabled or full localStorage must never prevent character navigation.
  }
}
