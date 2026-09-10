import { specOptionsForClass } from './wowSpecs'

export type PlannerPlayPreference = 'preferred' | 'available' | 'emergency' | 'disabled'
export type PlannerRole = 'tank' | 'healer' | 'dps'
export type PlannerCapabilityAvailability = 'guaranteed' | 'conditional' | 'none'
export type PlannerReasonCode =
  | 'PARTY_COMPLETE' | 'PARTY_INCOMPLETE' | 'HAS_LOOT_OBJECTIVES' | 'NO_LOOT_OBJECTIVES'
  | 'TARGET_LEVEL_EXACT' | 'TARGET_LEVEL_NEARBY' | 'BLOODLUST_GUARANTEED'
  | 'BLOODLUST_CONDITIONAL' | 'BLOODLUST_MISSING' | 'BATTLE_REZ_PRESENT' | 'BATTLE_REZ_MISSING'
export type PlannerDiagnosticCode =
  | 'INVALID_PARTICIPANT_COUNT' | 'DUPLICATE_PARTICIPANT' | 'INVALID_TARGET_LEVEL'
  | 'DUPLICATE_CANDIDATE' | 'INVALID_LOCK' | 'UNCONFIGURED_PARTICIPANT' | 'NO_VALID_COMPOSITION'

export type PlannerOptions = {
  optimizeComposition: boolean
  bloodlust: boolean
  battleRez: boolean
  classBuffs: boolean
  damageSynergy: boolean
}

export type PlannerLock =
  | { type: 'assignment', userId: number, characterId: number, specId: number }
  | { type: 'character', userId: number, characterId: number }
  | { type: 'role', userId: number, role: PlannerRole }

export type KeystonePlannerRequest = {
  participantUserIds: number[]
  targetLevel: number
  challengeMapId: number | null
  options: PlannerOptions
  locks: PlannerLock[]
}

export type PlannerPreference = {
  characterId: number
  specId: number
  role: PlannerRole
  playPreference: PlannerPlayPreference
  lootSpecId: number
  updatedAt: string
}

export type PlannerPreferenceInput = Omit<PlannerPreference, 'role' | 'updatedAt'>

export type PlannerCharacter = {
  id: number
  name: string
  realm: string
  wowClass: string | null
}

export type PlannerObjective = {
  itemId: number
  itemName: string | null
  iconUrl: string | null
  tier: number
  variantKey: string
  voidcoreState: 'pending' | 'completed_with_voidcore' | 'voidcore_not_checked'
}

export type PlannerCapability = {
  capabilityId: string
  name: string
  type: 'major_utility' | 'class_buff' | 'damage_debuff'
  iconSpellId: number
  stacking: 'unique'
  mode?: Exclude<PlannerCapabilityAvailability, 'none'>
  condition?: string | null
  availability?: Exclude<PlannerCapabilityAvailability, 'none'>
}

export type PlannerAssignment = {
  userId: number
  username: string
  characterId: number
  characterName: string
  wowClass: string
  specId: number
  role: PlannerRole
  lootSpecId: number
  playPreference: Exclude<PlannerPlayPreference, 'disabled'>
  objectives: PlannerObjective[]
  capabilities: PlannerCapability[]
}

export type PlannerRecommendation = {
  rank: number
  fingerprint: string
  stone: {
    characterId: number
    characterName: string
    ownerUserId: number
    ownerUsername: string
    challengeMapId: number
    dungeon: string
    level: number
  }
  assignments: PlannerAssignment[]
  vacancies: Array<{ role: PlannerRole, preferredCapabilities: string[] }>
  lootSummary: {
    weightedScore: number
    playersWithObjectives: number
    totalObjectives: number
    tierCounts: { bestInSlot: number, mustHave: number, niceToHave: number, catalyst: number, transmog: number }
  }
  levelSummary: { targetLevel: number, stoneLevel: number, levelDistance: number }
  preferenceSummary: { preferred: number, available: number, emergency: number }
  compositionSummary: {
    bloodlust: PlannerCapabilityAvailability
    battleRez: PlannerCapabilityAvailability
    uniqueCapabilities: PlannerCapability[]
    damageProfile: 'physical' | 'magical' | 'mixed' | 'unknown'
    magicalDpsCount: number
    physicalDpsCount: number
    unknownDpsCount: number
    chaosBrandBeneficiaries: number
    mysticTouchBeneficiaries: number
    uniqueClassBuffCount: number
  }
  reasonCodes: PlannerReasonCode[]
}

export type KeystonePlannerResponse = {
  teamId: number
  challengeMapId: number | null
  targetLevel: number
  availability: { eligibleStoneCount: number }
  status: 'ok' | 'invalid_input' | 'unconfigured_participants' | 'no_valid_composition'
  diagnostics: {
    codes: PlannerDiagnosticCode[]
    unconfiguredUserIds: number[]
    lockIssues: string[]
  }
  recommendations: PlannerRecommendation[]
}

export type PlannerRequestIdentity = {
  teamId: number
  challengeMapId: number | null
  generation: number
}

export const DEFAULT_PLANNER_OPTIONS: Readonly<PlannerOptions> = {
  optimizeComposition: true,
  bloodlust: true,
  battleRez: true,
  classBuffs: true,
  damageSynergy: true,
}

export const PLAY_PREFERENCE_LABELS: Readonly<Record<PlannerPlayPreference, string>> = {
  preferred: '⭐ Preferida',
  available: '✅ Disponible',
  emergency: '⚠ Solo si hace falta',
  disabled: '❌ No juego',
}

export const ROLE_LABELS: Readonly<Record<PlannerRole, string>> = {
  tank: 'Tanque', healer: 'Sanador', dps: 'DPS',
}

export const PLANNER_REASON_LABELS: Readonly<Record<PlannerReasonCode, string>> = {
  PARTY_COMPLETE: 'Grupo completo',
  PARTY_INCOMPLETE: 'Grupo incompleto',
  HAS_LOOT_OBJECTIVES: 'Con objetivos de botín',
  NO_LOOT_OBJECTIVES: 'Sin objetivos puntuables',
  TARGET_LEVEL_EXACT: 'Nivel objetivo exacto',
  TARGET_LEVEL_NEARBY: 'Nivel cercano al objetivo',
  BLOODLUST_GUARANTEED: 'Heroísmo garantizado',
  BLOODLUST_CONDITIONAL: 'Heroísmo condicional',
  BLOODLUST_MISSING: 'Sin Heroísmo',
  BATTLE_REZ_PRESENT: 'Resurrección en combate',
  BATTLE_REZ_MISSING: 'Sin resurrección en combate',
}

export const PLANNER_DIAGNOSTIC_LABELS: Readonly<Record<PlannerDiagnosticCode, string>> = {
  INVALID_PARTICIPANT_COUNT: 'Selecciona entre 2 y 5 participantes.',
  DUPLICATE_PARTICIPANT: 'Hay participantes duplicados.',
  INVALID_TARGET_LEVEL: 'El nivel objetivo debe estar entre 1 y 20.',
  DUPLICATE_CANDIDATE: 'La configuración contiene una combinación de personaje y especialización duplicada.',
  INVALID_LOCK: 'Uno o más locks ya no son válidos.',
  UNCONFIGURED_PARTICIPANT: 'Hay participantes sin preferencias de juego configuradas.',
  NO_VALID_COMPOSITION: 'No hay una composición válida con estas restricciones.',
}

const REASONS = new Set<string>(Object.keys(PLANNER_REASON_LABELS))
const DIAGNOSTICS = new Set<string>(Object.keys(PLANNER_DIAGNOSTIC_LABELS))
const ROLES = new Set<string>(['tank', 'healer', 'dps'])
const PREFERENCES = new Set<string>(['preferred', 'available', 'emergency', 'disabled'])
const AVAILABILITY = new Set<string>(['guaranteed', 'conditional', 'none'])
const CAPABILITY_TYPES = new Set<string>(['major_utility', 'class_buff', 'damage_debuff'])
const VOIDCORE = new Set<string>(['pending', 'completed_with_voidcore', 'voidcore_not_checked'])

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function integer(value: unknown, minimum = 0): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum
}

function nonEmptyString(value: unknown, maximum = 1024): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum
}

function nullableString(value: unknown, maximum = 2048): value is string | null {
  return value === null || nonEmptyString(value, maximum)
}

function parseCapability(value: unknown, summary: boolean): PlannerCapability | null {
  if (!record(value) || !nonEmptyString(value.capabilityId, 64) || !nonEmptyString(value.name, 128)
    || typeof value.type !== 'string' || !CAPABILITY_TYPES.has(value.type)
    || !integer(value.iconSpellId, 1) || value.stacking !== 'unique') return null
  if (summary) {
    if (typeof value.availability !== 'string' || !['guaranteed', 'conditional'].includes(value.availability)) return null
  } else if (typeof value.mode !== 'string' || !['guaranteed', 'conditional'].includes(value.mode)
    || !(value.condition === null || nonEmptyString(value.condition, 512))) return null
  return {
    capabilityId: value.capabilityId,
    name: value.name,
    type: value.type as PlannerCapability['type'],
    iconSpellId: value.iconSpellId,
    stacking: 'unique',
    ...(summary
      ? { availability: value.availability as 'guaranteed' | 'conditional' }
      : { mode: value.mode as 'guaranteed' | 'conditional', condition: value.condition as string | null }),
  }
}

function parseObjective(value: unknown): PlannerObjective | null {
  if (!record(value) || !integer(value.itemId, 1) || !nullableString(value.itemName, 512)
    || !nullableString(value.iconUrl) || !integer(value.tier, 1) || !nonEmptyString(value.variantKey, 512)
    || typeof value.voidcoreState !== 'string' || !VOIDCORE.has(value.voidcoreState)) return null
  if (value.iconUrl !== null) {
    try { if (new URL(value.iconUrl).protocol !== 'https:') return null } catch { return null }
  }
  return value as PlannerObjective
}

function parseAssignment(value: unknown): PlannerAssignment | null {
  if (!record(value) || !integer(value.userId, 1) || !nonEmptyString(value.username, 128)
    || !integer(value.characterId, 1) || !nonEmptyString(value.characterName, 128)
    || !nonEmptyString(value.wowClass, 64) || !integer(value.specId, 1) || !integer(value.lootSpecId, 1)
    || typeof value.role !== 'string' || !ROLES.has(value.role)
    || typeof value.playPreference !== 'string' || !PREFERENCES.has(value.playPreference)
    || value.playPreference === 'disabled' || !Array.isArray(value.objectives) || !Array.isArray(value.capabilities)) return null
  const objectives = value.objectives.map(parseObjective)
  const capabilities = value.capabilities.map(item => parseCapability(item, false))
  if (objectives.some(item => item === null) || capabilities.some(item => item === null)) return null
  return { ...value, objectives, capabilities } as PlannerAssignment
}

function parseRecommendation(value: unknown): PlannerRecommendation | null {
  if (!record(value) || !integer(value.rank, 1) || value.rank > 3 || !nonEmptyString(value.fingerprint)
    || !record(value.stone) || !integer(value.stone.characterId, 1) || !nonEmptyString(value.stone.characterName, 128)
    || !integer(value.stone.ownerUserId, 1) || !nonEmptyString(value.stone.ownerUsername, 128)
    || !integer(value.stone.challengeMapId, 1) || !nonEmptyString(value.stone.dungeon, 256) || !integer(value.stone.level, 1)
    || !Array.isArray(value.assignments) || !Array.isArray(value.vacancies) || !Array.isArray(value.reasonCodes)
    || !record(value.lootSummary) || !record(value.lootSummary.tierCounts)
    || !record(value.levelSummary) || !record(value.preferenceSummary) || !record(value.compositionSummary)
    || !Array.isArray(value.compositionSummary.uniqueCapabilities)) return null
  const assignments = value.assignments.map(parseAssignment)
  if (assignments.some(item => item === null)) return null
  const vacancies = value.vacancies.map(item => record(item) && typeof item.role === 'string' && ROLES.has(item.role)
    && Array.isArray(item.preferredCapabilities) && item.preferredCapabilities.every(cap => nonEmptyString(cap, 64))
    ? { role: item.role as PlannerRole, preferredCapabilities: item.preferredCapabilities as string[] } : null)
  const reasons = value.reasonCodes
  const capabilities = value.compositionSummary.uniqueCapabilities.map(item => parseCapability(item, true))
  const counts = [value.lootSummary.weightedScore, value.lootSummary.playersWithObjectives, value.lootSummary.totalObjectives,
    value.lootSummary.tierCounts.bestInSlot, value.lootSummary.tierCounts.mustHave, value.lootSummary.tierCounts.niceToHave,
    value.lootSummary.tierCounts.catalyst, value.lootSummary.tierCounts.transmog, value.levelSummary.targetLevel,
    value.levelSummary.stoneLevel, value.levelSummary.levelDistance, value.preferenceSummary.preferred,
    value.preferenceSummary.available, value.preferenceSummary.emergency, value.compositionSummary.magicalDpsCount,
    value.compositionSummary.physicalDpsCount, value.compositionSummary.unknownDpsCount,
    value.compositionSummary.chaosBrandBeneficiaries, value.compositionSummary.mysticTouchBeneficiaries,
    value.compositionSummary.uniqueClassBuffCount]
  if (vacancies.some(item => item === null) || capabilities.some(item => item === null)
    || !reasons.every(reason => typeof reason === 'string' && REASONS.has(reason))
    || counts.some(count => !integer(count))
    || typeof value.compositionSummary.bloodlust !== 'string' || !AVAILABILITY.has(value.compositionSummary.bloodlust)
    || typeof value.compositionSummary.battleRez !== 'string' || !AVAILABILITY.has(value.compositionSummary.battleRez)
    || !['physical', 'magical', 'mixed', 'unknown'].includes(String(value.compositionSummary.damageProfile))) return null
  return { ...value, assignments, vacancies, reasonCodes: reasons, compositionSummary: {
    ...value.compositionSummary, uniqueCapabilities: capabilities,
  } } as PlannerRecommendation
}

export function parseKeystonePlannerResponse(
  value: unknown,
  expectedTeamId: number,
  expectedChallengeMapId: number | null,
): KeystonePlannerResponse | null {
  if (!record(value) || value.teamId !== expectedTeamId || value.challengeMapId !== expectedChallengeMapId
    || !integer(value.targetLevel, 1) || value.targetLevel > 20 || !record(value.availability)
    || !integer(value.availability.eligibleStoneCount) || typeof value.status !== 'string'
    || !['ok', 'invalid_input', 'unconfigured_participants', 'no_valid_composition'].includes(value.status)
    || !record(value.diagnostics) || !Array.isArray(value.diagnostics.codes)
    || !Array.isArray(value.diagnostics.unconfiguredUserIds) || !Array.isArray(value.diagnostics.lockIssues)
    || !value.diagnostics.codes.every(code => typeof code === 'string' && DIAGNOSTICS.has(code))
    || !value.diagnostics.unconfiguredUserIds.every(id => integer(id, 1))
    || !value.diagnostics.lockIssues.every(issue => nonEmptyString(issue, 512))
    || !Array.isArray(value.recommendations)) return null
  const recommendations = value.recommendations.map(parseRecommendation)
  if (recommendations.some(item => item === null) || recommendations.length > 3) return null
  return { ...value, recommendations } as KeystonePlannerResponse
}

export function parsePlannerPreferencesResponse(value: unknown): PlannerPreference[] | null {
  if (!record(value) || !Array.isArray(value.preferences)) return null
  const parsed = value.preferences.map(entry => {
    if (!record(entry) || !integer(entry.characterId, 1) || !integer(entry.specId, 1)
      || !integer(entry.lootSpecId, 1) || typeof entry.role !== 'string' || !ROLES.has(entry.role)
      || typeof entry.playPreference !== 'string' || !PREFERENCES.has(entry.playPreference)
      || !nonEmptyString(entry.updatedAt, 128)) return null
    return entry as PlannerPreference
  })
  return parsed.some(entry => entry === null) ? null : parsed as PlannerPreference[]
}

export function parsePlannerCharacters(value: unknown): PlannerCharacter[] | null {
  if (!Array.isArray(value)) return null
  const parsed = value.map(item => record(item) && integer(item.id, 1) && nonEmptyString(item.name, 128)
    && nonEmptyString(item.realm, 128) && (item.wowClass === null || nonEmptyString(item.wowClass, 64))
    ? { id: item.id, name: item.name, realm: item.realm, wowClass: item.wowClass as string | null } : null)
  return parsed.some(item => item === null) ? null : parsed as PlannerCharacter[]
}

export function buildKeystonePlannerRequest(input: KeystonePlannerRequest): KeystonePlannerRequest {
  return {
    participantUserIds: [...input.participantUserIds],
    targetLevel: input.targetLevel,
    challengeMapId: input.challengeMapId,
    options: { ...input.options },
    locks: input.locks.map(lock => ({ ...lock })),
  }
}

export function buildPlannerPreferencesPayload(preferences: readonly PlannerPreferenceInput[]) {
  return { preferences: preferences.map(preference => ({ ...preference })) }
}

export function plannerPreferenceRows(
  characters: readonly PlannerCharacter[],
  saved: readonly PlannerPreference[],
): PlannerPreferenceInput[] {
  const existing = new Map(saved.map(item => [`${item.characterId}:${item.specId}`, item]))
  return characters.flatMap(character => {
    const specs = specOptionsForClass(character.wowClass)
    const catalogIds = new Set(specs.map(spec => spec.id))
    const knownRows = specs.map(spec => {
      const current = existing.get(`${character.id}:${spec.id}`)
      return {
        characterId: character.id,
        specId: spec.id,
        playPreference: current?.playPreference ?? 'disabled',
        lootSpecId: current?.lootSpecId ?? spec.id,
      }
    })
    const preservedRows = saved.filter(item => item.characterId === character.id && !catalogIds.has(item.specId))
      .map(({ characterId, specId, playPreference, lootSpecId }) => ({ characterId, specId, playPreference, lootSpecId }))
    return [...knownRows, ...preservedRows]
  })
}

export function defaultParticipantIds(currentUserId: number, members: readonly { userId: number }[]): number[] {
  return members.some(member => member.userId === currentUserId) ? [currentUserId] : []
}

export function togglePlannerParticipant(selected: readonly number[], userId: number): number[] {
  if (selected.includes(userId)) return selected.filter(id => id !== userId)
  return selected.length >= 5 ? [...selected] : [...selected, userId]
}

export function locksForParticipants(locks: readonly PlannerLock[], participants: readonly number[]): PlannerLock[] {
  const selected = new Set(participants)
  return locks.filter(lock => selected.has(lock.userId))
}

export function createPlannerRequestIdentity(
  teamId: number, challengeMapId: number | null, generation: number,
): PlannerRequestIdentity {
  return { teamId, challengeMapId, generation }
}

export function isPlannerRequestCurrent(
  request: PlannerRequestIdentity, current: PlannerRequestIdentity | null,
): boolean {
  return current !== null && request.teamId === current.teamId
    && request.challengeMapId === current.challengeMapId && request.generation === current.generation
}

export function plannerLockLabel(
  lock: PlannerLock,
  members: readonly { userId: number, username: string, characters: Array<{ id: number, name: string }> }[],
): string {
  const member = members.find(item => item.userId === lock.userId)
  const owner = member?.username ?? `Usuario ${lock.userId}`
  if (lock.type === 'role') return `${owner}: rol ${ROLE_LABELS[lock.role]}`
  const character = member?.characters.find(item => item.id === lock.characterId)?.name ?? `Personaje ${lock.characterId}`
  return lock.type === 'character' ? `${owner}: ${character}` : `${owner}: ${character}, especialización ${lock.specId}`
}

export function plannerLockIssueLabel(issue: string, members: readonly { userId: number, username: string }[]): string {
  const [kind, rawUserId] = issue.split(':')
  const userId = Number(rawUserId)
  const username = members.find(member => member.userId === userId)?.username ?? `Usuario ${rawUserId}`
  if (kind === 'LOCK_USER_NOT_SELECTED') return `El lock de ${username} pertenece a un participante no seleccionado.`
  if (kind === 'LOCKS_HAVE_NO_CANDIDATE') return `Los locks de ${username} no coinciden con ninguna configuración disponible.`
  return 'Uno de los locks enviados ya no es válido.'
}

export function capabilityAvailabilityLabel(value: PlannerCapabilityAvailability): string {
  if (value === 'guaranteed') return 'Garantizado'
  if (value === 'conditional') return 'Condicional'
  return 'No disponible'
}

export function damageProfileLabel(value: PlannerRecommendation['compositionSummary']['damageProfile']): string {
  if (value === 'magical') return 'Daño predominantemente mágico'
  if (value === 'physical') return 'Daño predominantemente físico'
  if (value === 'mixed') return 'Daño mixto'
  return 'Perfil de daño sin determinar'
}
