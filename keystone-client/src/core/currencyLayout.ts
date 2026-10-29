import { CHARACTER_CURRENCIES, type CharacterCurrencyKey } from "./characterSnapshots";

export const CURRENCY_SLOT_COUNT = 16;
const STORAGE_PREFIX = "keystone-client.currency-layout.v1:";
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

function validIndex(slot: number): boolean {
  return Number.isInteger(slot) && slot >= 0 && slot < CURRENCY_SLOT_COUNT;
}

export function defaultCurrencyLayout(): CurrencyLayout {
  return [...defaults];
}

export function loadCurrencyLayout(username: string, storage: LayoutStorage | null = browserStorage()): CurrencyLayout {
  if (!username.trim() || !storage) return defaultCurrencyLayout();
  try {
    const raw: unknown = JSON.parse(storage.getItem(storageKey(username)) ?? "null");
    if (!Array.isArray(raw) || raw.length !== CURRENCY_SLOT_COUNT) return defaultCurrencyLayout();
    const seen = new Set<string>();
    return raw.map(value => {
      if (typeof value !== "string" || !KNOWN_KEYS.has(value) || seen.has(value)) return null;
      seen.add(value);
      return value as CharacterCurrencyKey;
    });
  } catch { return defaultCurrencyLayout(); }
}

export function saveCurrencyLayout(username: string, layout: CurrencyLayout, storage: LayoutStorage | null = browserStorage()): void {
  if (!username.trim() || !storage || layout.length !== CURRENCY_SLOT_COUNT) return;
  try { storage.setItem(storageKey(username), JSON.stringify(layout)); }
  catch { /* Storage may be disabled or full; the in-memory layout still works. */ }
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
