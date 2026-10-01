const HIDDEN_CHARACTER_KEY = 'ks_hidden_chars'

export function loadHiddenCharacterIds(): Set<number> {
  try {
    const raw = localStorage.getItem(HIDDEN_CHARACTER_KEY)
    const values: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(values) ? values.filter((value): value is number => Number.isInteger(value)) : [])
  } catch {
    return new Set()
  }
}

export function saveHiddenCharacterIds(ids: Set<number>) {
  localStorage.setItem(HIDDEN_CHARACTER_KEY, JSON.stringify([...ids]))
}
