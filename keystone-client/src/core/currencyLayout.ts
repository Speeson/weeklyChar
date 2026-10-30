import { CHARACTER_CURRENCIES, type CharacterCurrencyKey } from "./characterSnapshots";

export const CURRENCY_SLOT_COUNT = 16;
const STORAGE_PREFIX = "keystone-client.currency-layout.v1:";
const CHARACTER_STORAGE_PREFIX = "keystone-client.currency-layout.v2:";
const KNOWN_KEYS = new Set<string>(CHARACTER_CURRENCIES.map(currency => currency.key));

export type CurrencyLayout = Array<CharacterCurrencyKey | null>;
type LayoutStorage = Pick<Storage, "getItem" | "setItem">;

const defaults: CurrencyLayout = [
  "heroMistcrest", "cofferKeyShards", "tidalSparkDust", "venomblightManaflux",
  "untaintedManaCrystals", null, null, null,
  "mythMistcrest", "restoredCofferKey", "sparksOfTides", "nebulousVoidcore",
  "trovehuntersBounty", "scaleboundHeraldFlute", null, null,
];

function browserStorage(): LayoutStorage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; }
  catch { return null; }
}

function storageKey(username: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(username.trim().toLowerCase())}`;
}

function characterStorageKey(username: string, characterId: string): string {
  return `${CHARACTER_STORAGE_PREFIX}${encodeURIComponent(username.trim().toLowerCase())}:${encodeURIComponent(characterId)}`;
}

function parsedLayout(value: string | null): CurrencyLayout | null {
  try {
    const raw: unknown = JSON.parse(value ?? "null");
    if (!Array.isArray(raw) || raw.length !== CURRENCY_SLOT_COUNT) return null;
    const seen = new Set<string>();
    return raw.map(entry => {
      if (typeof entry !== "string" || !KNOWN_KEYS.has(entry) || seen.has(entry)) return null;
      seen.add(entry);
      return entry as CharacterCurrencyKey;
    });
  } catch { return null; }
}

function validIndex(slot: number): boolean {
  return Number.isInteger(slot) && slot >= 0 && slot < CURRENCY_SLOT_COUNT;
}

export function defaultCurrencyLayout(): CurrencyLayout {
  return [...defaults];
}

export function loadCurrencyLayout(username: string, storage: LayoutStorage | null = browserStorage()): CurrencyLayout {
  if (!username.trim() || !storage) return defaultCurrencyLayout();
  try { return parsedLayout(storage.getItem(storageKey(username))) ?? defaultCurrencyLayout(); }
  catch { return defaultCurrencyLayout(); }
}

export function saveCurrencyLayout(username: string, layout: CurrencyLayout, storage: LayoutStorage | null = browserStorage()): void {
  if (!username.trim() || !storage || layout.length !== CURRENCY_SLOT_COUNT) return;
  try { storage.setItem(storageKey(username), JSON.stringify(layout)); }
  catch { /* Storage may be disabled or full; the in-memory layout still works. */ }
}

export function loadCharacterCurrencyLayout(username: string, characterId: string, storage: LayoutStorage | null = browserStorage()): CurrencyLayout {
  if (!username.trim() || !characterId.trim() || !storage) return loadCurrencyLayout(username, storage);
  try { return parsedLayout(storage.getItem(characterStorageKey(username, characterId))) ?? loadCurrencyLayout(username, storage); }
  catch { return loadCurrencyLayout(username, storage); }
}

export function saveCharacterCurrencyLayout(username: string, characterId: string, layout: CurrencyLayout, storage: LayoutStorage | null = browserStorage()): void {
  if (!username.trim() || !characterId.trim() || !storage || layout.length !== CURRENCY_SLOT_COUNT) return;
  try { storage.setItem(characterStorageKey(username, characterId), JSON.stringify(layout)); }
  catch { /* Keep the in-memory layout when local storage is unavailable. */ }
}

export function applyCurrencyLayoutToAllCharacters(username: string, characterIds: string[], layout: CurrencyLayout, storage: LayoutStorage | null = browserStorage()): void {
  saveCurrencyLayout(username, layout, storage);
  for (const characterId of new Set(characterIds)) saveCharacterCurrencyLayout(username, characterId, layout, storage);
}

export function addCurrency(layout: CurrencyLayout, key: CharacterCurrencyKey, slot?: number): CurrencyLayout {
  if (!KNOWN_KEYS.has(key) || layout.includes(key)) return layout;
  const target = slot === undefined ? layout.indexOf(null) : slot;
  if (!validIndex(target)) return layout;
  const next = [...layout];
  next[target] = key;
  return next;
}

export function moveCurrency(layout: CurrencyLayout, from: number, to: number): CurrencyLayout {
  if (!validIndex(from) || !validIndex(to) || !layout[from] || from === to) return layout;
  const next = [...layout];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function removeCurrency(layout: CurrencyLayout, slot: number): CurrencyLayout {
  if (!validIndex(slot) || !layout[slot]) return layout;
  const next = [...layout];
  next[slot] = null;
  return next;
}
