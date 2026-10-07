export function currentVaultWeekKey(nowMs = Date.now()): string {
  const reset = new Date(nowMs)
  reset.setUTCHours(4, 0, 0, 0)
  reset.setUTCDate(reset.getUTCDate() - (reset.getUTCDay() - 3 + 7) % 7)
  if (reset.getTime() > nowMs) reset.setUTCDate(reset.getUTCDate() - 7)
  return reset.toISOString().slice(0, 10)
}

export function currentVault<T extends object>(vault: T | null | undefined, nowMs = Date.now()): T | null {
  return vault != null && (vault as { weekKey?: unknown }).weekKey === currentVaultWeekKey(nowMs) ? vault : null
}
