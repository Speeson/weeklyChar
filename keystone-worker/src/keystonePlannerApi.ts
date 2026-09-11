import { enrichKeystoneLootObjectives } from './blizzardItemMetadata'
import { buildKeystoneLootPlannerObjectives } from './keystoneObjectives'
import { solveKeystonePlanner } from './keystonePlanner'
import type {
  KeystonePlannerInput,
  KeystonePlannerRecommendation,
  KeystonePlannerResult,
  PlannerCandidate,
  PlannerLock,
  PlannerObjective,
  PlannerOptions,
  PlannerStone,
} from './keystonePlanner'
import { isSupportedSeason2Dungeon } from './season2'
import type { Env } from './types'
import { currentEuWeeklyResetUnix } from './weeklyReset'
import { WOW_CAPABILITIES, normalizeWowClass, wowSpecialization } from './wowComposition'
import type { CapabilityId, WowRole } from './wowComposition'

export const PLANNER_LIMITS = {
  participants: 5,
  locks: 15,
  candidates: 150,
  stones: 100,
  objectives: 5000,
} as const

export type KeystonePlannerPublicRequest = {
  participantUserIds: number[]
  targetLevel: number
  challengeMapId: number | null
  stoneCharacterId: number | null
  options: PlannerOptions
  locks: PlannerLock[]
}

export type PlannerParticipantRow = {
  userId: number
  username: string
  shareKeystoneLootWithTeams: boolean
}

type PlannerCharacterPreferenceRow = {
  user_id: number
  username: string
  share_keystone_loot_with_teams: number
  character_id: number
  character_name: string
  region: string
  wow_class: string | null
  keystone_loot_json: string | null
  spec_id: number | null
  play_preference: 'preferred' | 'available' | 'emergency' | 'disabled' | null
  loot_spec_id: number | null
}

type PlannerStoneRow = {
  character_id: number
  character_name: string
  owner_user_id: number
  owner_username: string
  keystone_level: number
  keystone_challenge_map_id: number
  keystone_dungeon: string
}

type CandidateSeed = Omit<PlannerCandidate, 'objectives'> & {
  objectives: PlannerObjective[]
  region: string
}

export class PlannerDataLimitError extends Error {
  constructor(readonly limit: keyof typeof PLANNER_LIMITS) {
    super('Los datos seleccionados superan los límites del Planner.')
  }
}

export function assertPlannerDataLimit(
  limit: keyof typeof PLANNER_LIMITS,
  count: number,
): void {
  if (count > PLANNER_LIMITS[limit]) throw new PlannerDataLimitError(limit)
}

const REQUEST_KEYS = new Set([
  'participantUserIds', 'targetLevel', 'challengeMapId', 'stoneCharacterId', 'options', 'locks',
])
const OPTION_KEYS = new Set(['optimizeComposition', 'bloodlust', 'battleRez', 'classBuffs', 'damageSynergy'])
const ROLE_SET = new Set<WowRole>(['tank', 'healer', 'dps'])
const CAPABILITY_BY_ID = new Map(WOW_CAPABILITIES.map(capability => [capability.id, capability]))

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function positiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function exactKeys(value: Record<string, unknown>, expected: ReadonlySet<string>): boolean {
  const keys = Object.keys(value)
  return keys.length === expected.size && keys.every(key => expected.has(key))
}

function parseOptions(value: unknown): PlannerOptions {
  if (!isRecord(value) || !exactKeys(value, OPTION_KEYS)
    || typeof value.optimizeComposition !== 'boolean'
    || typeof value.bloodlust !== 'boolean'
    || typeof value.battleRez !== 'boolean'
    || typeof value.classBuffs !== 'boolean'
    || typeof value.damageSynergy !== 'boolean') {
    throw new Error('options debe contener únicamente los cinco booleanos del Planner')
  }
  return {
    optimizeComposition: value.optimizeComposition,
    bloodlust: value.bloodlust,
    battleRez: value.battleRez,
    classBuffs: value.classBuffs,
    damageSynergy: value.damageSynergy,
  }
}

function parseLock(value: unknown, participants: ReadonlySet<number>): PlannerLock {
  if (!isRecord(value) || typeof value.type !== 'string' || !positiveSafeInteger(value.userId)
    || !participants.has(value.userId)) {
    throw new Error('Cada lock debe pertenecer a un participante seleccionado')
  }
  if (value.type === 'assignment') {
    const keys = new Set(['type', 'userId', 'characterId', 'specId'])
    if (!exactKeys(value, keys) || !positiveSafeInteger(value.characterId)
      || !positiveSafeInteger(value.specId)) throw new Error('Assignment lock no válido')
    return { type: value.type, userId: value.userId, characterId: value.characterId, specId: value.specId }
  }
  if (value.type === 'character') {
    const keys = new Set(['type', 'userId', 'characterId'])
    if (!exactKeys(value, keys) || !positiveSafeInteger(value.characterId)) {
      throw new Error('Character lock no válido')
    }
    return { type: value.type, userId: value.userId, characterId: value.characterId }
  }
  if (value.type === 'role') {
    const keys = new Set(['type', 'userId', 'role'])
    if (!exactKeys(value, keys) || typeof value.role !== 'string' || !ROLE_SET.has(value.role as WowRole)) {
      throw new Error('Role lock no válido')
    }
    return { type: value.type, userId: value.userId, role: value.role as WowRole }
  }
  throw new Error('Tipo de lock no válido')
}

export function parseKeystonePlannerRequest(value: unknown): KeystonePlannerPublicRequest {
  if (!isRecord(value) || Object.keys(value).some(key => !REQUEST_KEYS.has(key))) {
    throw new Error('Payload del Planner no válido')
  }
  if (!Array.isArray(value.participantUserIds)
    || value.participantUserIds.length < 2
    || value.participantUserIds.length > PLANNER_LIMITS.participants
    || !value.participantUserIds.every(positiveSafeInteger)) {
    throw new Error('participantUserIds debe contener entre 2 y 5 IDs positivos')
  }
  const participantUserIds = value.participantUserIds as number[]
  if (new Set(participantUserIds).size !== participantUserIds.length) {
    throw new Error('participantUserIds no admite duplicados')
  }
  if (!Number.isSafeInteger(value.targetLevel) || Number(value.targetLevel) < 1 || Number(value.targetLevel) > 20) {
    throw new Error('targetLevel debe estar entre 1 y 20')
  }
  const challengeMapId = value.challengeMapId === undefined || value.challengeMapId === null
    ? null
    : value.challengeMapId
  if (challengeMapId !== null
    && (!positiveSafeInteger(challengeMapId) || !isSupportedSeason2Dungeon(challengeMapId))) {
    throw new Error('challengeMapId no pertenece al pool actual')
  }
  const stoneCharacterId = value.stoneCharacterId === undefined || value.stoneCharacterId === null
    ? null
    : value.stoneCharacterId
  if (stoneCharacterId !== null && !positiveSafeInteger(stoneCharacterId)) {
    throw new Error('stoneCharacterId debe ser un entero positivo')
  }
  if (stoneCharacterId !== null && challengeMapId === null) {
    throw new Error('stoneCharacterId requiere challengeMapId')
  }
  const options = parseOptions(value.options)
  const rawLocks = value.locks === undefined ? [] : value.locks
  if (!Array.isArray(rawLocks) || rawLocks.length > PLANNER_LIMITS.locks) {
    throw new Error(`locks debe ser un array de hasta ${PLANNER_LIMITS.locks} entradas`)
  }
  const participants = new Set(participantUserIds)
  return {
    participantUserIds: [...participantUserIds],
    targetLevel: Number(value.targetLevel),
    challengeMapId,
    stoneCharacterId,
    options,
    locks: rawLocks.map(lock => parseLock(lock, participants)),
  }
}

function placeholders(values: readonly unknown[]): string {
  return values.map(() => '?').join(', ')
}

export async function plannerParticipantsForTeam(
  env: Env,
  teamId: number,
  participantUserIds: readonly number[],
): Promise<PlannerParticipantRow[]> {
  const { results } = await env.DB.prepare(`
    SELECT u.id, u.username, u.share_keystone_loot_with_teams
    FROM team_members tm
    JOIN users u ON u.id = tm.user_id
    WHERE tm.team_id = ? AND u.id IN (${placeholders(participantUserIds)})
    ORDER BY u.id
  `).bind(teamId, ...participantUserIds).all<{
    id: number
    username: string
    share_keystone_loot_with_teams: number
  }>()
  return results.map(row => ({
    userId: row.id,
    username: row.username,
    shareKeystoneLootWithTeams: row.share_keystone_loot_with_teams !== 0,
  }))
}

async function plannerStones(
  env: Env,
  teamId: number,
  request: KeystonePlannerPublicRequest,
): Promise<PlannerStone[]> {
  const dungeonFilter = request.challengeMapId === null ? '' : 'AND rk.keystone_challenge_map_id = ?'
  const characterFilter = request.stoneCharacterId === null ? '' : 'AND c.id = ? AND rk.keystone_level = ?'
  const bindings: unknown[] = [
    currentEuWeeklyResetUnix(), teamId, ...request.participantUserIds,
  ]
  if (request.challengeMapId !== null) bindings.push(request.challengeMapId)
  if (request.stoneCharacterId !== null) bindings.push(request.stoneCharacterId, request.targetLevel)
  const { results } = await env.DB.prepare(`
    WITH ranked_keystones AS (
      SELECT k.*, ROW_NUMBER() OVER (
        PARTITION BY k.character_id
        ORDER BY COALESCE(k.updated_at, 0) DESC, k.id DESC
      ) AS keystone_rank
      FROM keystones k
      WHERE k.has_keystone = 1
        AND k.keystone_level IS NOT NULL
        AND k.updated_at >= ?
    )
    SELECT
      c.id AS character_id,
      c.name AS character_name,
      u.id AS owner_user_id,
      u.username AS owner_username,
      rk.keystone_level,
      rk.keystone_challenge_map_id,
      rk.keystone_dungeon
    FROM team_members tm
    JOIN users u ON u.id = tm.user_id
    JOIN characters c ON c.user_id = u.id
    JOIN ranked_keystones rk ON rk.character_id = c.id AND rk.keystone_rank = 1
    WHERE tm.team_id = ?
      AND u.id IN (${placeholders(request.participantUserIds)})
      ${dungeonFilter}
      ${characterFilter}
    ORDER BY rk.keystone_challenge_map_id, u.id, c.id
  `).bind(...bindings).all<PlannerStoneRow>()

  const stones = results.filter(row => positiveSafeInteger(row.keystone_level)
    && positiveSafeInteger(row.keystone_challenge_map_id)
    && isSupportedSeason2Dungeon(row.keystone_challenge_map_id)
    && typeof row.keystone_dungeon === 'string'
    && row.keystone_dungeon.trim().length > 0)
    .map(row => ({
      characterId: row.character_id,
      characterName: row.character_name,
      ownerUserId: row.owner_user_id,
      ownerUsername: row.owner_username,
      challengeMapId: row.keystone_challenge_map_id,
      dungeon: row.keystone_dungeon,
      level: row.keystone_level,
    }))
  assertPlannerDataLimit('stones', stones.length)
  return stones
}

async function plannerCharacterPreferences(
  env: Env,
  teamId: number,
  request: KeystonePlannerPublicRequest,
): Promise<PlannerCharacterPreferenceRow[]> {
  const { results } = await env.DB.prepare(`
    SELECT
      u.id AS user_id,
      u.username,
      u.share_keystone_loot_with_teams,
      c.id AS character_id,
      c.name AS character_name,
      c.region,
      c.wow_class,
      CASE WHEN u.share_keystone_loot_with_teams <> 0
        THEN c.keystone_loot_json ELSE NULL END AS keystone_loot_json,
      cpp.spec_id,
      cpp.play_preference,
      cpp.loot_spec_id
    FROM team_members tm
    JOIN users u ON u.id = tm.user_id
    JOIN characters c ON c.user_id = u.id
    LEFT JOIN character_play_preferences cpp ON cpp.character_id = c.id
    WHERE tm.team_id = ? AND u.id IN (${placeholders(request.participantUserIds)})
    ORDER BY u.id, c.id, cpp.spec_id
  `).bind(teamId, ...request.participantUserIds).all<PlannerCharacterPreferenceRow>()
  return results
}

function candidateSeeds(rows: readonly PlannerCharacterPreferenceRow[]): CandidateSeed[] {
  const seeds: CandidateSeed[] = []
  for (const row of rows) {
    if (row.spec_id === null || row.loot_spec_id === null || row.play_preference === null
      || row.play_preference === 'disabled') continue
    const wowClass = normalizeWowClass(row.wow_class)
    const played = wowSpecialization(row.spec_id)
    const loot = wowSpecialization(row.loot_spec_id)
    if (!wowClass || !played || !loot || played.wowClass !== wowClass || loot.wowClass !== wowClass) continue
    seeds.push({
      userId: row.user_id,
      username: row.username,
      characterId: row.character_id,
      characterName: row.character_name,
      specId: row.spec_id,
      lootSpecId: row.loot_spec_id,
      playPreference: row.play_preference,
      objectives: [],
      region: row.region,
    })
  }
  assertPlannerDataLimit('candidates', seeds.length)
  return seeds
}

function plannerObjective(objective: ReturnType<typeof buildKeystoneLootPlannerObjectives>[number]): PlannerObjective {
  return {
    itemId: objective.itemId,
    tier: objective.tier,
    specId: objective.specId,
    sourceType: objective.sourceType,
    sourceId: objective.sourceId,
    variantKey: objective.variantKey,
    voidcoreState: objective.voidcoreState,
  }
}

function attachObjectives(
  rows: readonly PlannerCharacterPreferenceRow[],
  seeds: CandidateSeed[],
  challengeMapIds: readonly number[],
): void {
  if (challengeMapIds.length === 0) return
  const rowsByCharacter = new Map<number, PlannerCharacterPreferenceRow>()
  for (const row of rows) rowsByCharacter.set(row.character_id, row)
  const seedsByCharacter = new Map<number, CandidateSeed[]>()
  for (const seed of seeds) {
    const entries = seedsByCharacter.get(seed.characterId) ?? []
    entries.push(seed)
    seedsByCharacter.set(seed.characterId, entries)
  }
  let objectiveCount = 0
  for (const [characterId, characterSeeds] of seedsByCharacter) {
    const row = rowsByCharacter.get(characterId)
    if (!row || row.share_keystone_loot_with_teams === 0 || row.keystone_loot_json === null) continue
    const lootSpecIds = [...new Set(characterSeeds.map(seed => seed.lootSpecId))]
    const objectives = buildKeystoneLootPlannerObjectives(
      row.keystone_loot_json,
      challengeMapIds,
      lootSpecIds,
    ).map(plannerObjective)
    const bySpec = new Map<number, PlannerObjective[]>()
    for (const objective of objectives) {
      const entries = bySpec.get(objective.specId) ?? []
      entries.push(objective)
      bySpec.set(objective.specId, entries)
    }
    for (const seed of characterSeeds) {
      seed.objectives = (bySpec.get(seed.lootSpecId) ?? []).map(objective => ({ ...objective }))
      objectiveCount += seed.objectives.length
      assertPlannerDataLimit('objectives', objectiveCount)
    }
  }
}

function emptyNoStoneResult(): KeystonePlannerResult {
  return {
    status: 'no_valid_composition',
    diagnostics: {
      codes: ['NO_VALID_COMPOSITION'],
      unconfiguredUserIds: [],
      lockIssues: [],
    },
    recommendations: [],
  }
}

function capabilityMetadata(capabilityId: CapabilityId) {
  const definition = CAPABILITY_BY_ID.get(capabilityId)
  if (!definition) throw new Error(`Capability desconocida: ${capabilityId}`)
  return {
    capabilityId: definition.id,
    name: definition.name,
    type: definition.type,
    iconSpellId: definition.iconSpellId,
    stacking: definition.stacking,
  }
}

type MetadataObjective = {
  itemId: number
  itemName: string | null
  iconUrl: string | null
  slotName: string | null
  itemClassName: string | null
  itemSubClassName: string | null
  statNames: string[]
  primaryStatNames: string[]
  secondaryStatNames: string[]
  otherStatNames: string[]
  qualityType: string | null
}

const METADATA_BATCH_SIZE = 100

async function publicRecommendations(
  env: Env,
  recommendations: readonly KeystonePlannerRecommendation[],
  regionByCharacter: ReadonlyMap<number, string>,
): Promise<Array<Record<string, unknown>>> {
  const projected = recommendations.map(recommendation => ({
    ...recommendation,
    assignments: recommendation.assignments.map(assignment => ({
      ...assignment,
      objectives: assignment.objectives.map(objective => ({
        itemId: objective.itemId,
        itemName: null as string | null,
        iconUrl: null as string | null,
        tier: objective.tier,
        variantKey: objective.variantKey,
        voidcoreState: objective.voidcoreState,
      })),
      capabilities: assignment.capabilities.map(capability => ({
        ...capabilityMetadata(capability.capabilityId),
        mode: capability.mode,
        condition: capability.condition,
      })),
    })),
    compositionSummary: {
      ...recommendation.compositionSummary,
      uniqueCapabilities: recommendation.compositionSummary.uniqueCapabilities.map(capability => ({
        ...capabilityMetadata(capability.capabilityId),
        availability: capability.availability,
      })),
    },
  }))

  const grouped = new Map<string, Map<number, {
    objective: MetadataObjective
    targets: Array<{ itemName: string | null, iconUrl: string | null }>
  }>>()
  for (const recommendation of projected) {
    for (const assignment of recommendation.assignments) {
      const region = regionByCharacter.get(assignment.characterId) ?? 'eu'
      const entries = grouped.get(region) ?? new Map()
      for (const target of assignment.objectives) {
        let entry = entries.get(target.itemId)
        if (!entry) {
          entry = {
            targets: [],
            objective: {
              itemId: target.itemId,
              itemName: null,
              iconUrl: null,
              slotName: null,
              itemClassName: null,
              itemSubClassName: null,
              statNames: [],
              primaryStatNames: [],
              secondaryStatNames: [],
              otherStatNames: [],
              qualityType: null,
            },
          }
          entries.set(target.itemId, entry)
        }
        entry.targets.push(target)
      }
      grouped.set(region, entries)
    }
  }
  for (const [region, entries] of grouped) {
    const uniqueEntries = [...entries.values()]
    for (let offset = 0; offset < uniqueEntries.length; offset += METADATA_BATCH_SIZE) {
      const batch = uniqueEntries.slice(offset, offset + METADATA_BATCH_SIZE)
      const enriched = await enrichKeystoneLootObjectives(env, region, batch.map(entry => entry.objective))
      for (let index = 0; index < batch.length; index += 1) {
        for (const target of batch[index].targets) {
          target.itemName = enriched[index].itemName
          target.iconUrl = enriched[index].iconUrl
        }
      }
    }
  }
  return projected
}

export async function runKeystonePlanner(
  env: Env,
  teamId: number,
  request: KeystonePlannerPublicRequest,
): Promise<Record<string, unknown>> {
  const stones = await plannerStones(env, teamId, request)
  if (stones.length === 0) {
    return {
      teamId,
      challengeMapId: request.challengeMapId,
      targetLevel: request.targetLevel,
      availability: { eligibleStoneCount: 0 },
      ...emptyNoStoneResult(),
    }
  }

  const rows = await plannerCharacterPreferences(env, teamId, request)
  const seeds = candidateSeeds(rows)
  const challengeMapIds = [...new Set(stones.map(stone => stone.challengeMapId))]
  attachObjectives(rows, seeds, challengeMapIds)
  const solverInput: KeystonePlannerInput = {
    participantUserIds: request.participantUserIds,
    targetLevel: request.targetLevel,
    options: request.options,
    candidates: seeds.map(({ region: _region, ...candidate }) => candidate),
    stones,
    locks: request.locks,
  }
  const result = solveKeystonePlanner(solverInput)
  const regionByCharacter = new Map(rows.map(row => [row.character_id, row.region]))
  return {
    teamId,
    challengeMapId: request.challengeMapId,
    targetLevel: request.targetLevel,
    availability: { eligibleStoneCount: stones.length },
    ...result,
    recommendations: await publicRecommendations(env, result.recommendations, regionByCharacter),
  }
}
