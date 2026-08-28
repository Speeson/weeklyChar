export type RecommendationStatus =
  | 'recommended'
  | 'sharing_disabled'
  | 'no_keystoneloot'
  | 'no_targets'

export type RecommendationSummary = {
  bis: number
  must: number
  nice: number
  catalyst: number
  transmog: number
  totalPending: number
  voidcoreExcluded: number
}

export type RecommendedCharacter = {
  characterId: number
  character: string
  realm: string
  region: string
  wowClass: string | null
  avatarUrl: string | null
  ilvl: number | null
  rioScore: number | null
  specId: number
  score: number
  summary: RecommendationSummary
}

export type MemberRecommendation = {
  userId: number
  username: string
  status: RecommendationStatus
  recommended: RecommendedCharacter | null
}

export type TeamRecommendationsResponse = {
  teamId: number
  challengeMapId: number
  members: MemberRecommendation[]
}

export type PlannerKeystone = {
  level: number | null
  dungeon: string | null
  challengeMapId: number | null
  updatedAt: number | null
}

export type PlannerCharacter = {
  id: number
  name: string
  realm: string
  region: string
  wowClass?: string | null
  avatarUrl?: string | null
  currentKeystone: PlannerKeystone | null
}

export type PlannerMember = {
  userId: number
  username: string
  characters: PlannerCharacter[]
}

export type AvailableStone = {
  memberUserId: number
  memberUsername: string
  characterId: number
  character: string
  realm: string
  region: string
  wowClass: string | null
  avatarUrl: string | null
  level: number
  dungeon: string | null
  challengeMapId: number
}

const RECOMMENDATION_STATUSES: readonly RecommendationStatus[] = [
  'recommended',
  'sharing_disabled',
  'no_keystoneloot',
  'no_targets',
]

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
}

function isSummary(value: unknown): value is RecommendationSummary {
  if (!isObject(value)) return false
  return ['bis', 'must', 'nice', 'catalyst', 'transmog', 'totalPending', 'voidcoreExcluded']
    .every(key => Number.isSafeInteger(value[key]) && (value[key] as number) >= 0)
}

function isRecommendedCharacter(value: unknown): value is RecommendedCharacter {
  if (!isObject(value)) return false
  return Number.isSafeInteger(value.characterId) && (value.characterId as number) > 0
    && typeof value.character === 'string'
    && typeof value.realm === 'string'
    && typeof value.region === 'string'
    && isNullableString(value.wowClass)
    && isNullableString(value.avatarUrl)
    && isNullableFiniteNumber(value.ilvl)
    && isNullableFiniteNumber(value.rioScore)
    && Number.isSafeInteger(value.specId) && (value.specId as number) > 0
    && typeof value.score === 'number' && Number.isFinite(value.score) && value.score > 0
    && isSummary(value.summary)
}

export function parseTeamRecommendationsResponse(
  value: unknown,
  expectedTeamId: number,
  expectedChallengeMapId: number,
): TeamRecommendationsResponse | null {
  if (!isObject(value) || value.teamId !== expectedTeamId
    || value.challengeMapId !== expectedChallengeMapId || !Array.isArray(value.members)) return null

  for (const member of value.members) {
    if (!isObject(member) || !Number.isSafeInteger(member.userId) || (member.userId as number) <= 0
      || typeof member.username !== 'string' || typeof member.status !== 'string'
      || !RECOMMENDATION_STATUSES.includes(member.status as RecommendationStatus)) return null
    if (member.status === 'recommended') {
      if (!isRecommendedCharacter(member.recommended)) return null
    } else if (member.recommended !== null) {
      return null
    }
  }

  return value as TeamRecommendationsResponse
}

export function deriveAvailableStones(members: readonly PlannerMember[]): AvailableStone[] {
  return members.flatMap(member => member.characters.flatMap(character => {
    const keystone = character.currentKeystone
    if (!keystone || typeof keystone.level !== 'number' || keystone.level <= 0
      || !Number.isSafeInteger(keystone.challengeMapId) || (keystone.challengeMapId ?? 0) <= 0) {
      return []
    }

    return [{
      memberUserId: member.userId,
      memberUsername: member.username,
      characterId: character.id,
      character: character.name,
      realm: character.realm,
      region: character.region,
      wowClass: character.wowClass ?? null,
      avatarUrl: character.avatarUrl ?? null,
      level: keystone.level,
      dungeon: keystone.dungeon,
      challengeMapId: keystone.challengeMapId as number,
    }]
  })).sort((left, right) => (
    right.level - left.level
    || (left.dungeon ?? '').localeCompare(right.dungeon ?? '', 'es')
    || left.character.localeCompare(right.character, 'es')
    || left.realm.localeCompare(right.realm, 'es')
  ))
}

export function formatRecommendationSummary(summary: RecommendationSummary): string {
  const categories: Array<[number, string]> = [
    [summary.bis, 'BiS'],
    [summary.must, 'Must'],
    [summary.nice, 'Nice'],
    [summary.catalyst, 'Catalyst'],
    [summary.transmog, 'Transmog'],
  ]
  return categories
    .filter(([count]) => count > 0)
    .map(([count, label]) => `${count} ${label}`)
    .join(' · ')
}

export function recommendedSpecIdForCharacter(
  response: TeamRecommendationsResponse | null,
  characterId: number,
): number | null {
  if (!response) return null
  for (const member of response.members) {
    if (member.status === 'recommended' && member.recommended?.characterId === characterId) {
      return member.recommended.specId
    }
  }
  return null
}
