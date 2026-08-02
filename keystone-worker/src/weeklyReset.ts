export const EU_WEEKLY_RESET_UTC_DAY = 3
export const EU_WEEKLY_RESET_UTC_HOUR = 4

export function currentEuWeeklyResetUnix(nowMs = Date.now()): number {
  const now = new Date(nowMs)
  const reset = new Date(nowMs)
  reset.setUTCHours(EU_WEEKLY_RESET_UTC_HOUR, 0, 0, 0)

  const daysSinceWednesday = (reset.getUTCDay() - EU_WEEKLY_RESET_UTC_DAY + 7) % 7
  reset.setUTCDate(reset.getUTCDate() - daysSinceWednesday)

  if (reset.getTime() > now.getTime()) {
    reset.setUTCDate(reset.getUTCDate() - 7)
  }

  return Math.floor(reset.getTime() / 1000)
}
