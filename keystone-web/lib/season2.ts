export type SeasonDungeonMetadata = {
  id: number
  name: string
  abbr: string
  spellId: number
}

export type KeystoneLabelInput = {
  level: number | null
  dungeon: string | null
  challengeMapId: number | null
}

export const MIDNIGHT_SEASON_2_DUNGEONS: SeasonDungeonMetadata[] = [
  { id: 588, name: 'Altar of Fangs', abbr: 'AOF', spellId: 1286812 },
  { id: 587, name: 'Murder Row', abbr: 'MR', spellId: 1286809 },
  { id: 586, name: 'Den of Nalorakk', abbr: 'DON', spellId: 1286807 },
  { id: 584, name: 'The Blinding Vale', abbr: 'BV', spellId: 1286801 },
  { id: 585, name: 'Voidscar Arena', abbr: 'VSA', spellId: 1286804 },
  { id: 249, name: "Kings' Rest", abbr: 'KR', spellId: 1286831 },
  { id: 250, name: 'Temple of Sethraliss', abbr: 'TOS', spellId: 1286828 },
  { id: 399, name: 'Ruby Life Pools', abbr: 'RLP', spellId: 393256 },
]

export const DUNGEON_ABBR_BY_ID = new Map(
  MIDNIGHT_SEASON_2_DUNGEONS.map(dungeon => [dungeon.id, dungeon.abbr]),
)

export const DUNGEON_ABBR_BY_NAME = new Map(
  MIDNIGHT_SEASON_2_DUNGEONS.map(dungeon => [dungeon.name.toLowerCase(), dungeon.abbr]),
)

export const DUNGEON_FULL_NAME_BY_ABBR = new Map(
  MIDNIGHT_SEASON_2_DUNGEONS.map(dungeon => [dungeon.abbr, dungeon.name]),
)

const DUNGEON_FULL_NAME_BY_ID = new Map(
  MIDNIGHT_SEASON_2_DUNGEONS.map(dungeon => [dungeon.id, dungeon.name]),
)

export function compactKeystoneLabel(key: KeystoneLabelInput | null | undefined) {
  if (!key?.level) return '—'
  const idAbbr = key.challengeMapId ? DUNGEON_ABBR_BY_ID.get(key.challengeMapId) : null
  const nameAbbr = key.dungeon ? DUNGEON_ABBR_BY_NAME.get(key.dungeon.toLowerCase()) : null
  return `+${key.level} ${idAbbr ?? nameAbbr ?? key.dungeon ?? `ID ${key.challengeMapId}`}`
}

export function fullKeystoneLabel(key: KeystoneLabelInput | null | undefined) {
  if (!key?.level) return '—'
  const idName = key.challengeMapId ? DUNGEON_FULL_NAME_BY_ID.get(key.challengeMapId) : null
  return `+${key.level} ${key.dungeon ?? idName ?? `ID ${key.challengeMapId}`}`
}
