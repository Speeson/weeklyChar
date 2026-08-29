import { MIDNIGHT_SEASON_2_DUNGEONS, type SeasonDungeonMetadata } from './season2'
import type { KeystoneLootVoidcoreState } from './keystoneLootObjectives'

export type KeystoneSelectorTierCounts = {
  bestInSlot: number
  mustHave: number
  niceToHave: number
  catalyst: number
  transmog: number
  other: number
}

export type KeystoneSelectorObjective = {
  itemId: number
  itemName: string | null
  iconUrl: string | null
  tier: number
  specIds: number[]
  sourceType: string
  sourceId: number | string
  slotId: number | null
  slotName: string | null
  itemClassName: string | null
  itemSubClassName: string | null
  statNames: string[]
  voidcoreState: KeystoneLootVoidcoreState
}

export type KeystoneSelectorStone = {
  characterId: number
  characterName: string
  ownerUserId: number
  ownerUsername: string
  level: number
}

export type KeystoneSelectorSpec = {
  specId: number
  objectiveCount: number
  tierCounts: KeystoneSelectorTierCounts
}

export type KeystoneSelectorCharacter = {
  userId: number
  username: string
  characterId: number
  characterName: string
  realm: string
  region: string
  wowClass: string | null
  avatarUrl: string | null
  ilvl: number | null
  rioScore: number | null
  totalObjectives: number
  tierCounts: KeystoneSelectorTierCounts
  specs: KeystoneSelectorSpec[]
  objectives: KeystoneSelectorObjective[]
}

export type KeystoneSelectorResponse = {
  teamId: number
  challengeMapId: number
  availability: {
    stoneCount: number
    stones: KeystoneSelectorStone[]
  }
  summary: {
    charactersWithObjectives: number
    totalObjectives: number
    tiers: KeystoneSelectorTierCounts
  }
  characters: KeystoneSelectorCharacter[]
}

export type KeystoneSelectorRequestIdentity = {
  teamId: number
  challengeMapId: number
  generation: number
}

export type SelectorDungeonOption = SeasonDungeonMetadata & { stoneCount: number }

type TeamMemberWithKeystones = {
  characters: Array<{
    currentKeystone: {
      level: number | null
      challengeMapId: number | null
    } | null
  }>
}

export type SelectorObjectiveGroup = {
  key: 'bestInSlot' | 'mustHave' | 'niceToHave' | 'catalyst' | 'transmog' | 'other'
  label: string
  objectives: KeystoneSelectorObjective[]
}

const VOIDCORE_STATES: readonly KeystoneLootVoidcoreState[] = [
  'pending', 'completed_with_voidcore', 'voidcore_not_checked',
]

const GROUPS: ReadonlyArray<{
  key: SelectorObjectiveGroup['key']
  label: string
  tier: number | null
}> = [
  { key: 'bestInSlot', label: 'Best in Slot', tier: 3 },
  { key: 'mustHave', label: 'Must have', tier: 2 },
  { key: 'niceToHave', label: 'Nice to have', tier: 1 },
  { key: 'catalyst', label: 'Catalyst', tier: 5 },
  { key: 'transmog', label: 'Transmog', tier: 4 },
  { key: 'other', label: 'Other', tier: null },
]

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0
}

function safeString(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum
}

function nullableSafeString(value: unknown, maximum: number): value is string | null {
  return value === null || safeString(value, maximum)
}

function nullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
}

function nullableHttpsUrl(value: unknown): value is string | null {
  if (value === null) return true
  if (!safeString(value, 2048)) return false
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

function parseTierCounts(value: unknown): KeystoneSelectorTierCounts | null {
  if (!isObject(value)) return null
  const keys: Array<keyof KeystoneSelectorTierCounts> = [
    'bestInSlot', 'mustHave', 'niceToHave', 'catalyst', 'transmog', 'other',
  ]
  if (!keys.every(key => nonNegativeInteger(value[key]))) return null
  return Object.fromEntries(keys.map(key => [key, Number(value[key])])) as KeystoneSelectorTierCounts
}

function parseStatNames(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 32) return null
  if (!value.every(name => safeString(name, 128))) return null
  if (new Set(value).size !== value.length) return null
  return [...value] as string[]
}

function parseObjective(value: unknown): KeystoneSelectorObjective | null {
  if (!isObject(value) || !positiveInteger(value.itemId) || !nullableSafeString(value.itemName, 512)
    || !nullableHttpsUrl(value.iconUrl) || !positiveInteger(value.tier)
    || !Array.isArray(value.specIds) || value.specIds.length === 0 || value.specIds.length > 64
    || !value.specIds.every(positiveInteger) || new Set(value.specIds).size !== value.specIds.length
    || !safeString(value.sourceType, 64)
    || !(positiveInteger(value.sourceId) || safeString(value.sourceId, 128))
    || !(value.slotId === null || Number.isSafeInteger(value.slotId))
    || !nullableSafeString(value.slotName, 128)
    || !nullableSafeString(value.itemClassName, 128)
    || !nullableSafeString(value.itemSubClassName, 128)
    || typeof value.voidcoreState !== 'string'
    || !VOIDCORE_STATES.includes(value.voidcoreState as KeystoneLootVoidcoreState)) return null
  const statNames = parseStatNames(value.statNames)
  if (!statNames) return null
  return {
    itemId: value.itemId,
    itemName: value.itemName,
    iconUrl: value.iconUrl,
    tier: value.tier,
    specIds: [...value.specIds] as number[],
    sourceType: value.sourceType,
    sourceId: value.sourceId,
    slotId: value.slotId as number | null,
    slotName: value.slotName,
    itemClassName: value.itemClassName,
    itemSubClassName: value.itemSubClassName,
    statNames,
    voidcoreState: value.voidcoreState as KeystoneLootVoidcoreState,
  }
}

function parseStone(value: unknown): KeystoneSelectorStone | null {
  if (!isObject(value) || !positiveInteger(value.characterId) || !safeString(value.characterName, 128)
    || !positiveInteger(value.ownerUserId) || !safeString(value.ownerUsername, 128)
    || !positiveInteger(value.level)) return null
  return {
    characterId: value.characterId,
    characterName: value.characterName,
    ownerUserId: value.ownerUserId,
    ownerUsername: value.ownerUsername,
    level: value.level,
  }
}

function parseSpec(value: unknown): KeystoneSelectorSpec | null {
  if (!isObject(value) || !positiveInteger(value.specId) || !nonNegativeInteger(value.objectiveCount)) return null
  const tierCounts = parseTierCounts(value.tierCounts)
  if (!tierCounts) return null
  return { specId: value.specId, objectiveCount: value.objectiveCount, tierCounts }
}

function parseCharacter(value: unknown): KeystoneSelectorCharacter | null {
  if (!isObject(value) || !positiveInteger(value.userId) || !safeString(value.username, 128)
    || !positiveInteger(value.characterId) || !safeString(value.characterName, 128)
    || !safeString(value.realm, 128) || !safeString(value.region, 16)
    || !nullableSafeString(value.wowClass, 64) || !nullableHttpsUrl(value.avatarUrl)
    || !nullableFiniteNumber(value.ilvl) || !nullableFiniteNumber(value.rioScore)
    || !nonNegativeInteger(value.totalObjectives) || !Array.isArray(value.specs)
    || value.specs.length > 64 || !Array.isArray(value.objectives) || value.objectives.length > 2000) return null
  const tierCounts = parseTierCounts(value.tierCounts)
  const specs = value.specs.map(parseSpec)
  const objectives = value.objectives.map(parseObjective)
  if (!tierCounts || specs.some(spec => spec === null) || objectives.some(objective => objective === null)) return null
  return {
    userId: value.userId,
    username: value.username,
    characterId: value.characterId,
    characterName: value.characterName,
    realm: value.realm,
    region: value.region,
    wowClass: value.wowClass,
    avatarUrl: value.avatarUrl,
    ilvl: value.ilvl,
    rioScore: value.rioScore,
    totalObjectives: value.totalObjectives,
    tierCounts,
    specs: specs as KeystoneSelectorSpec[],
    objectives: objectives as KeystoneSelectorObjective[],
  }
}

export function parseKeystoneSelectorResponse(
  value: unknown,
  expectedTeamId: number,
  expectedChallengeMapId: number,
): KeystoneSelectorResponse | null {
  if (!isObject(value) || value.teamId !== expectedTeamId
    || value.challengeMapId !== expectedChallengeMapId || !isObject(value.availability)
    || !nonNegativeInteger(value.availability.stoneCount) || !Array.isArray(value.availability.stones)
    || value.availability.stones.length > 2000 || !isObject(value.summary)
    || !nonNegativeInteger(value.summary.charactersWithObjectives)
    || !nonNegativeInteger(value.summary.totalObjectives) || !Array.isArray(value.characters)
    || value.characters.length > 2000) return null
  const stones = value.availability.stones.map(parseStone)
  const tiers = parseTierCounts(value.summary.tiers)
  const characters = value.characters.map(parseCharacter)
  if (!tiers || stones.some(stone => stone === null) || characters.some(character => character === null)
    || value.availability.stoneCount !== stones.length
    || value.summary.charactersWithObjectives !== characters.length) return null
  return {
    teamId: value.teamId,
    challengeMapId: value.challengeMapId,
    availability: {
      stoneCount: value.availability.stoneCount,
      stones: stones as KeystoneSelectorStone[],
    },
    summary: {
      charactersWithObjectives: value.summary.charactersWithObjectives,
      totalObjectives: value.summary.totalObjectives,
      tiers,
    },
    characters: characters as KeystoneSelectorCharacter[],
  }
}

export function buildKeystoneSelectorPath(teamId: number, challengeMapId: number): string {
  return `/api/teams/${teamId}/keystone-loot/dungeons/${challengeMapId}/summary`
}

export function createKeystoneSelectorRequestIdentity(
  teamId: number,
  challengeMapId: number,
  generation: number,
): KeystoneSelectorRequestIdentity {
  return { teamId, challengeMapId, generation }
}

export function isKeystoneSelectorRequestCurrent(
  expected: KeystoneSelectorRequestIdentity,
  current: KeystoneSelectorRequestIdentity | null,
): boolean {
  return current !== null
    && expected.teamId === current.teamId
    && expected.challengeMapId === current.challengeMapId
    && expected.generation === current.generation
}

export function selectorDungeonOptions(members: readonly TeamMemberWithKeystones[]): SelectorDungeonOption[] {
  const counts = new Map<number, number>()
  for (const member of members) {
    for (const character of member.characters) {
      const keystone = character.currentKeystone
      if (!keystone || typeof keystone.level !== 'number' || keystone.level <= 0
        || !positiveInteger(keystone.challengeMapId)) continue
      counts.set(keystone.challengeMapId, (counts.get(keystone.challengeMapId) ?? 0) + 1)
    }
  }
  return MIDNIGHT_SEASON_2_DUNGEONS.map(dungeon => ({
    ...dungeon,
    stoneCount: counts.get(dungeon.id) ?? 0,
  }))
}

export function selectorObjectivesForSpec(
  objectives: readonly KeystoneSelectorObjective[],
  specId: number | null,
): KeystoneSelectorObjective[] {
  return objectives.filter(objective => specId === null || objective.specIds.includes(specId))
}

export function groupSelectorObjectives(objectives: readonly KeystoneSelectorObjective[]): {
  groups: SelectorObjectiveGroup[]
  completed: KeystoneSelectorObjective[]
} {
  const actionable = objectives.filter(objective => objective.voidcoreState !== 'completed_with_voidcore')
  const groups = GROUPS.map(group => ({
    key: group.key,
    label: group.label,
    objectives: actionable.filter(objective => group.tier === null
      ? ![1, 2, 3, 4, 5].includes(objective.tier)
      : objective.tier === group.tier),
  })).filter(group => group.objectives.length > 0)
  return {
    groups,
    completed: objectives.filter(objective => objective.voidcoreState === 'completed_with_voidcore'),
  }
}
