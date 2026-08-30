const SEASON_2_CHALLENGE_MAP_IDS = new Set([
  249,
  250,
  399,
  584,
  585,
  586,
  587,
  588,
])

// TODO: Web and Worker intentionally duplicate this pool in S1; defer cross-surface consolidation.
export function isSupportedSeason2Dungeon(challengeMapId: number): boolean {
  return SEASON_2_CHALLENGE_MAP_IDS.has(challengeMapId)
}
