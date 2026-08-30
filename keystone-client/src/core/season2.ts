export type SeasonDungeon = { id: number; name: string; abbr: string };

// TODO: Web, Worker, and Client intentionally keep small seasonal display allowlists;
// consolidate them only when a shared build boundary is introduced deliberately.
export const MIDNIGHT_SEASON_2_DUNGEONS: readonly SeasonDungeon[] = [
  { id: 588, name: "Altar of Fangs", abbr: "AOF" },
  { id: 587, name: "Murder Row", abbr: "MR" },
  { id: 586, name: "Den of Nalorakk", abbr: "DON" },
  { id: 584, name: "The Blinding Vale", abbr: "BV" },
  { id: 585, name: "Voidscar Arena", abbr: "VSA" },
  { id: 249, name: "Kings' Rest", abbr: "KR" },
  { id: 250, name: "Temple of Sethraliss", abbr: "TOS" },
  { id: 399, name: "Ruby Life Pools", abbr: "RLP" },
];

export const SEASON_2_DUNGEON_BY_ID = new Map(MIDNIGHT_SEASON_2_DUNGEONS.map(dungeon => [dungeon.id, dungeon]));

export function compactTeamKeystone(level: number, challengeMapId: number, dungeon: string | null): string {
  return `+${level} ${SEASON_2_DUNGEON_BY_ID.get(challengeMapId)?.abbr ?? dungeon ?? `ID ${challengeMapId}`}`;
}
