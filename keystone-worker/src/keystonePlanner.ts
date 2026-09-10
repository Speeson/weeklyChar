import type { KeystoneLootVoidcoreState } from './keystoneObjectives'
import type { PlayPreference } from './plannerPreferences'
import { keystoneLootTierWeight } from './keystoneRecommendations'
import {
  WOW_CAPABILITIES,
  WOW_SPECIALIZATIONS,
  capabilitiesForSpec,
  wowSpecialization,
} from './wowComposition'
import type {
  CapabilityId,
  ResolvedCapability,
  WowClassName,
  WowDamageProfile,
  WowRole,
} from './wowComposition'

export type PlannerOptions = {
  optimizeComposition: boolean
  bloodlust: boolean
  battleRez: boolean
  classBuffs: boolean
  damageSynergy: boolean
}

export type PlannerObjective = {
  itemId: number
  tier: number
  specId: number
  sourceType: string
  sourceId: number | string
  variantKey: string
  voidcoreState: KeystoneLootVoidcoreState
}

export type PlannerCandidate = {
  userId: number
  username: string
  characterId: number
  characterName: string
  specId: number
  lootSpecId: number
  playPreference: PlayPreference
  objectives: readonly PlannerObjective[]
}

export type PlannerStone = {
  characterId: number
  characterName: string
  ownerUserId: number
  ownerUsername: string
  challengeMapId: number
  dungeon: string
  level: number
}

export type PlannerAssignmentLock = {
  type: 'assignment'
  userId: number
  characterId: number
  specId: number
}

export type PlannerCharacterLock = {
  type: 'character'
  userId: number
  characterId: number
}

export type PlannerRoleLock = {
  type: 'role'
  userId: number
  role: WowRole
}

export type PlannerLock = PlannerAssignmentLock | PlannerCharacterLock | PlannerRoleLock

export type KeystonePlannerInput = {
  participantUserIds: readonly number[]
  targetLevel: number
  options: PlannerOptions
  candidates: readonly PlannerCandidate[]
  stones: readonly PlannerStone[]
  locks?: readonly PlannerLock[]
}

export type CapabilityAvailability = 'guaranteed' | 'conditional' | 'none'

export type PlannerAssignment = {
  userId: number
  username: string
  characterId: number
  characterName: string
  wowClass: WowClassName
  specId: number
  role: WowRole
  lootSpecId: number
  playPreference: Exclude<PlayPreference, 'disabled'>
  objectives: PlannerObjective[]
  capabilities: ResolvedCapability[]
}

export type PlannerTierCounts = {
  bestInSlot: number
  mustHave: number
  niceToHave: number
  catalyst: number
  transmog: number
}

export type PlannerVacancy = {
  role: WowRole
  preferredCapabilities: CapabilityId[]
}

export type PlannerCompositionSummary = {
  bloodlust: CapabilityAvailability
  battleRez: CapabilityAvailability
  uniqueCapabilities: Array<{
    capabilityId: CapabilityId
    availability: Exclude<CapabilityAvailability, 'none'>
  }>
  damageProfile: Exclude<WowDamageProfile, null> | 'mixed' | 'unknown'
  magicalDpsCount: number
  physicalDpsCount: number
  unknownDpsCount: number
  chaosBrandBeneficiaries: number
  mysticTouchBeneficiaries: number
  uniqueClassBuffCount: number
}

export type PlannerReasonCode =
  | 'PARTY_COMPLETE'
  | 'PARTY_INCOMPLETE'
  | 'HAS_LOOT_OBJECTIVES'
  | 'NO_LOOT_OBJECTIVES'
  | 'TARGET_LEVEL_EXACT'
  | 'TARGET_LEVEL_NEARBY'
  | 'BLOODLUST_GUARANTEED'
  | 'BLOODLUST_CONDITIONAL'
  | 'BLOODLUST_MISSING'
  | 'BATTLE_REZ_PRESENT'
  | 'BATTLE_REZ_MISSING'

export type KeystonePlannerRecommendation = {
  rank: number
  fingerprint: string
  stone: PlannerStone
  assignments: PlannerAssignment[]
  vacancies: PlannerVacancy[]
  lootSummary: {
    weightedScore: number
    playersWithObjectives: number
    totalObjectives: number
    tierCounts: PlannerTierCounts
  }
  levelSummary: {
    targetLevel: number
    stoneLevel: number
    levelDistance: number
  }
  preferenceSummary: {
    preferred: number
    available: number
    emergency: number
  }
  compositionSummary: PlannerCompositionSummary
  reasonCodes: PlannerReasonCode[]
}

export type PlannerDiagnosticCode =
  | 'INVALID_PARTICIPANT_COUNT'
  | 'DUPLICATE_PARTICIPANT'
  | 'INVALID_TARGET_LEVEL'
  | 'DUPLICATE_CANDIDATE'
  | 'INVALID_LOCK'
  | 'UNCONFIGURED_PARTICIPANT'
  | 'NO_VALID_COMPOSITION'

export type KeystonePlannerResult = {
  status: 'ok' | 'invalid_input' | 'unconfigured_participants' | 'no_valid_composition'
  diagnostics: {
    codes: PlannerDiagnosticCode[]
    unconfiguredUserIds: number[]
    lockIssues: string[]
  }
  recommendations: KeystonePlannerRecommendation[]
}

type NormalizedCandidate = PlannerCandidate & {
  specialization: NonNullable<ReturnType<typeof wowSpecialization>>
  playPreference: Exclude<PlayPreference, 'disabled'>
  capabilities: readonly ResolvedCapability[]
}

type RoleCounts = Record<WowRole, number>
type UnrankedRecommendation = Omit<KeystonePlannerRecommendation, 'rank'>

const ROLE_CAPACITY: Readonly<RoleCounts> = { tank: 1, healer: 1, dps: 3 }
const ROLE_ORDER: readonly WowRole[] = ['tank', 'healer', 'dps']
const AVAILABILITY_RANK: Record<CapabilityAvailability, number> = {
  guaranteed: 2,
  conditional: 1,
  none: 0,
}

function emptyDiagnostics(): KeystonePlannerResult['diagnostics'] {
  return { codes: [], unconfiguredUserIds: [], lockIssues: [] }
}

function diagnosticResult(
  status: KeystonePlannerResult['status'],
  diagnostics: KeystonePlannerResult['diagnostics'],
): KeystonePlannerResult {
  return { status, diagnostics, recommendations: [] }
}

function candidateIdentity(candidate: Pick<PlannerCandidate, 'userId' | 'characterId' | 'specId'>): string {
  return `${candidate.userId}:${candidate.characterId}:${candidate.specId}`
}

function compareCandidates(left: NormalizedCandidate, right: NormalizedCandidate): number {
  return (left.userId - right.userId)
    || (left.characterId - right.characterId)
    || (left.specId - right.specId)
    || (left.lootSpecId - right.lootSpecId)
    || left.username.localeCompare(right.username)
    || left.characterName.localeCompare(right.characterName)
}

function lockMatches(candidate: NormalizedCandidate, lock: PlannerLock): boolean {
  if (candidate.userId !== lock.userId) return true
  if (lock.type === 'assignment') {
    return candidate.characterId === lock.characterId && candidate.specId === lock.specId
  }
  if (lock.type === 'character') return candidate.characterId === lock.characterId
  return candidate.specialization.role === lock.role
}

function sourceIdentity(sourceId: number | string): string {
  return `${typeof sourceId}:${String(sourceId)}`
}

function objectiveIdentity(objective: PlannerObjective): string {
  return `${objective.sourceType}\u0000${sourceIdentity(objective.sourceId)}\u0000${objective.itemId}\u0000${objective.variantKey}`
}

function strongerObjective(candidate: PlannerObjective, selected: PlannerObjective): boolean {
  const weightDifference = keystoneLootTierWeight(candidate.tier) - keystoneLootTierWeight(selected.tier)
  return weightDifference > 0 || (weightDifference === 0 && candidate.tier > selected.tier)
}

function scoringObjectives(candidate: NormalizedCandidate, challengeMapId: number): PlannerObjective[] {
  const selected = new Map<string, PlannerObjective>()
  for (const objective of candidate.objectives) {
    if (objective.specId !== candidate.lootSpecId
      || objective.sourceType !== 'dungeon'
      || typeof objective.sourceId !== 'number'
      || objective.sourceId !== challengeMapId
      || objective.voidcoreState === 'completed_with_voidcore'
      || keystoneLootTierWeight(objective.tier) <= 0) continue
    const identity = objectiveIdentity(objective)
    const existing = selected.get(identity)
    if (!existing || strongerObjective(objective, existing)) selected.set(identity, objective)
  }
  return [...selected.values()].sort((left, right) => (left.itemId - right.itemId)
    || left.variantKey.localeCompare(right.variantKey)
    || (left.tier - right.tier))
}

function emptyTierCounts(): PlannerTierCounts {
  return { bestInSlot: 0, mustHave: 0, niceToHave: 0, catalyst: 0, transmog: 0 }
}

function incrementTier(counts: PlannerTierCounts, tier: number): void {
  if (tier === 3) counts.bestInSlot += 1
  else if (tier === 2) counts.mustHave += 1
  else if (tier === 1) counts.niceToHave += 1
  else if (tier === 5) counts.catalyst += 1
  else if (tier === 4) counts.transmog += 1
}

function aggregateCapabilityAvailability(
  candidates: readonly NormalizedCandidate[],
): Map<CapabilityId, Exclude<CapabilityAvailability, 'none'>> {
  const availability = new Map<CapabilityId, Exclude<CapabilityAvailability, 'none'>>()
  for (const candidate of candidates) {
    for (const capability of candidate.capabilities) {
      const current = availability.get(capability.capabilityId)
      if (current !== 'guaranteed') availability.set(capability.capabilityId, capability.mode)
    }
  }
  return availability
}

function capabilityStatus(
  availability: ReadonlyMap<CapabilityId, Exclude<CapabilityAvailability, 'none'>>,
  capabilityId: CapabilityId,
): CapabilityAvailability {
  return availability.get(capabilityId) ?? 'none'
}

function compositionSummary(candidates: readonly NormalizedCandidate[]): PlannerCompositionSummary {
  const capabilityAvailability = aggregateCapabilityAvailability(candidates)
  let magicalDpsCount = 0
  let physicalDpsCount = 0
  let unknownDpsCount = 0
  for (const candidate of candidates) {
    if (candidate.specialization.role !== 'dps') continue
    if (candidate.specialization.damageProfile === 'magical') magicalDpsCount += 1
    else if (candidate.specialization.damageProfile === 'physical') physicalDpsCount += 1
    else unknownDpsCount += 1
  }
  let damageProfile: PlannerCompositionSummary['damageProfile'] = 'unknown'
  if (magicalDpsCount > 0 && physicalDpsCount > 0) damageProfile = 'mixed'
  else if (magicalDpsCount > 0) damageProfile = 'magical'
  else if (physicalDpsCount > 0) damageProfile = 'physical'

  const uniqueCapabilities = WOW_CAPABILITIES
    .flatMap(definition => {
      const availability = capabilityAvailability.get(definition.id)
      return availability ? [{ capabilityId: definition.id, availability }] : []
    })
  const uniqueClassBuffCount = WOW_CAPABILITIES.filter(definition => definition.type === 'class_buff'
    && capabilityAvailability.has(definition.id)).length

  return {
    bloodlust: capabilityStatus(capabilityAvailability, 'BLOODLUST'),
    battleRez: capabilityStatus(capabilityAvailability, 'BATTLE_REZ'),
    uniqueCapabilities,
    damageProfile,
    magicalDpsCount,
    physicalDpsCount,
    unknownDpsCount,
    chaosBrandBeneficiaries: capabilityAvailability.has('CHAOS_BRAND') ? magicalDpsCount : 0,
    mysticTouchBeneficiaries: capabilityAvailability.has('MYSTIC_TOUCH') ? physicalDpsCount : 0,
    uniqueClassBuffCount,
  }
}

function vacancyRoles(roleCounts: Readonly<RoleCounts>): WowRole[] {
  return ROLE_ORDER.flatMap(role => Array.from(
    { length: ROLE_CAPACITY[role] - roleCounts[role] },
    () => role,
  ))
}

function roleCanProvide(role: WowRole, capabilityId: CapabilityId): boolean {
  return WOW_SPECIALIZATIONS.some(spec => spec.role === role
    && capabilitiesForSpec(spec.id).some(capability => capability.capabilityId === capabilityId))
}

function vacanciesFor(
  roleCounts: Readonly<RoleCounts>,
  summary: PlannerCompositionSummary,
  options: PlannerOptions,
): PlannerVacancy[] {
  const vacancies = vacancyRoles(roleCounts).map(role => ({ role, preferredCapabilities: [] as CapabilityId[] }))
  if (!options.optimizeComposition) return vacancies
  const requested: CapabilityId[] = []
  if (options.bloodlust && summary.bloodlust === 'none') requested.push('BLOODLUST')
  if (options.battleRez && summary.battleRez === 'none') requested.push('BATTLE_REZ')
  for (const capabilityId of requested) {
    const vacancy = vacancies.find(candidate => roleCanProvide(candidate.role, capabilityId))
    if (vacancy) vacancy.preferredCapabilities.push(capabilityId)
  }
  return vacancies
}

function assignmentFor(
  candidate: NormalizedCandidate,
  objectives: PlannerObjective[],
): PlannerAssignment {
  return {
    userId: candidate.userId,
    username: candidate.username,
    characterId: candidate.characterId,
    characterName: candidate.characterName,
    wowClass: candidate.specialization.wowClass,
    specId: candidate.specId,
    role: candidate.specialization.role,
    lootSpecId: candidate.lootSpecId,
    playPreference: candidate.playPreference,
    objectives: objectives.map(objective => ({ ...objective })),
    capabilities: candidate.capabilities.map(capability => ({ ...capability })),
  }
}

function recommendationFingerprint(stone: PlannerStone, assignments: readonly PlannerAssignment[]): string {
  return JSON.stringify({
    stone: [stone.ownerUserId, stone.characterId, stone.challengeMapId, stone.level],
    assignments: assignments.map(assignment => [
      assignment.userId, assignment.characterId, assignment.specId, assignment.lootSpecId,
    ]),
  })
}

function compareStable(left: UnrankedRecommendation, right: UnrankedRecommendation): number {
  const stoneComparison = (left.stone.challengeMapId - right.stone.challengeMapId)
    || (left.stone.ownerUserId - right.stone.ownerUserId)
    || (left.stone.characterId - right.stone.characterId)
    || (left.stone.level - right.stone.level)
  if (stoneComparison !== 0) return stoneComparison
  for (let index = 0; index < left.assignments.length; index += 1) {
    const leftAssignment = left.assignments[index]
    const rightAssignment = right.assignments[index]
    const assignmentComparison = (leftAssignment.userId - rightAssignment.userId)
      || (leftAssignment.characterId - rightAssignment.characterId)
      || (leftAssignment.specId - rightAssignment.specId)
      || (leftAssignment.lootSpecId - rightAssignment.lootSpecId)
    if (assignmentComparison !== 0) return assignmentComparison
  }
  return 0
}

function compareDescending(left: number, right: number): number {
  return right - left
}

function compareRecommendations(
  left: UnrankedRecommendation,
  right: UnrankedRecommendation,
  options: PlannerOptions,
): number {
  const primary = compareDescending(left.lootSummary.weightedScore, right.lootSummary.weightedScore)
    || compareDescending(left.lootSummary.playersWithObjectives, right.lootSummary.playersWithObjectives)
    || (left.levelSummary.levelDistance - right.levelSummary.levelDistance)
    || (left.preferenceSummary.emergency - right.preferenceSummary.emergency)
    || compareDescending(left.preferenceSummary.preferred, right.preferenceSummary.preferred)
    || compareDescending(left.preferenceSummary.available, right.preferenceSummary.available)
  if (primary !== 0) return primary

  if (options.optimizeComposition) {
    if (options.bloodlust) {
      const comparison = compareDescending(
        AVAILABILITY_RANK[left.compositionSummary.bloodlust],
        AVAILABILITY_RANK[right.compositionSummary.bloodlust],
      )
      if (comparison !== 0) return comparison
    }
    if (options.battleRez) {
      const comparison = compareDescending(
        AVAILABILITY_RANK[left.compositionSummary.battleRez],
        AVAILABILITY_RANK[right.compositionSummary.battleRez],
      )
      if (comparison !== 0) return comparison
    }
    if (options.damageSynergy) {
      const leftTotal = left.compositionSummary.chaosBrandBeneficiaries
        + left.compositionSummary.mysticTouchBeneficiaries
      const rightTotal = right.compositionSummary.chaosBrandBeneficiaries
        + right.compositionSummary.mysticTouchBeneficiaries
      const comparison = compareDescending(leftTotal, rightTotal)
        || compareDescending(
          left.compositionSummary.chaosBrandBeneficiaries,
          right.compositionSummary.chaosBrandBeneficiaries,
        )
        || compareDescending(
          left.compositionSummary.mysticTouchBeneficiaries,
          right.compositionSummary.mysticTouchBeneficiaries,
        )
      if (comparison !== 0) return comparison
    }
    if (options.classBuffs) {
      const comparison = compareDescending(
        left.compositionSummary.uniqueClassBuffCount,
        right.compositionSummary.uniqueClassBuffCount,
      )
      if (comparison !== 0) return comparison
    }
  }

  const tiers = compareDescending(left.lootSummary.tierCounts.bestInSlot, right.lootSummary.tierCounts.bestInSlot)
    || compareDescending(left.lootSummary.tierCounts.mustHave, right.lootSummary.tierCounts.mustHave)
    || compareDescending(left.lootSummary.tierCounts.niceToHave, right.lootSummary.tierCounts.niceToHave)
    || compareDescending(left.lootSummary.tierCounts.catalyst, right.lootSummary.tierCounts.catalyst)
    || compareDescending(left.lootSummary.tierCounts.transmog, right.lootSummary.tierCounts.transmog)
  return tiers || compareStable(left, right)
}

function buildRecommendation(
  stone: PlannerStone,
  selected: readonly NormalizedCandidate[],
  roleCounts: Readonly<RoleCounts>,
  input: KeystonePlannerInput,
): UnrankedRecommendation {
  const ordered = [...selected].sort(compareCandidates)
  const tierCounts = emptyTierCounts()
  let weightedScore = 0
  let playersWithObjectives = 0
  let totalObjectives = 0
  const assignments = ordered.map(candidate => {
    const objectives = scoringObjectives(candidate, stone.challengeMapId)
    if (objectives.length > 0) playersWithObjectives += 1
    totalObjectives += objectives.length
    for (const objective of objectives) {
      weightedScore += keystoneLootTierWeight(objective.tier)
      incrementTier(tierCounts, objective.tier)
    }
    return assignmentFor(candidate, objectives)
  })
  const composition = compositionSummary(ordered)
  const vacancies = vacanciesFor(roleCounts, composition, input.options)
  const preferenceSummary = {
    preferred: ordered.filter(candidate => candidate.playPreference === 'preferred').length,
    available: ordered.filter(candidate => candidate.playPreference === 'available').length,
    emergency: ordered.filter(candidate => candidate.playPreference === 'emergency').length,
  }
  const levelDistance = Math.abs(stone.level - input.targetLevel)
  const reasonCodes: PlannerReasonCode[] = [
    vacancies.length === 0 ? 'PARTY_COMPLETE' : 'PARTY_INCOMPLETE',
    totalObjectives > 0 ? 'HAS_LOOT_OBJECTIVES' : 'NO_LOOT_OBJECTIVES',
    levelDistance === 0 ? 'TARGET_LEVEL_EXACT' : 'TARGET_LEVEL_NEARBY',
  ]
  if (input.options.bloodlust) {
    reasonCodes.push(composition.bloodlust === 'guaranteed'
      ? 'BLOODLUST_GUARANTEED'
      : composition.bloodlust === 'conditional'
        ? 'BLOODLUST_CONDITIONAL'
        : 'BLOODLUST_MISSING')
  }
  if (input.options.battleRez) {
    reasonCodes.push(composition.battleRez === 'none' ? 'BATTLE_REZ_MISSING' : 'BATTLE_REZ_PRESENT')
  }
  return {
    fingerprint: recommendationFingerprint(stone, assignments),
    stone: { ...stone },
    assignments,
    vacancies,
    lootSummary: { weightedScore, playersWithObjectives, totalObjectives, tierCounts },
    levelSummary: { targetLevel: input.targetLevel, stoneLevel: stone.level, levelDistance },
    preferenceSummary,
    compositionSummary: composition,
    reasonCodes,
  }
}

function canFitRemaining(
  orderedUsers: readonly number[],
  nextIndex: number,
  candidatesByUser: ReadonlyMap<number, readonly NormalizedCandidate[]>,
  roleCounts: Readonly<RoleCounts>,
): boolean {
  const remainingCapacity = ROLE_ORDER.reduce(
    (total, role) => total + ROLE_CAPACITY[role] - roleCounts[role],
    0,
  )
  if (orderedUsers.length - nextIndex > remainingCapacity) return false
  for (let index = nextIndex; index < orderedUsers.length; index += 1) {
    const candidates = candidatesByUser.get(orderedUsers[index]) ?? []
    if (!candidates.some(candidate => roleCounts[candidate.specialization.role]
      < ROLE_CAPACITY[candidate.specialization.role])) return false
  }
  return true
}

function searchStone(
  stone: PlannerStone,
  participantUserIds: readonly number[],
  candidatesByUser: ReadonlyMap<number, readonly NormalizedCandidate[]>,
  input: KeystonePlannerInput,
): UnrankedRecommendation[] {
  if (!participantUserIds.includes(stone.ownerUserId)) return []
  const holderCandidates = (candidatesByUser.get(stone.ownerUserId) ?? [])
    .filter(candidate => candidate.characterId === stone.characterId)
  if (holderCandidates.length === 0) return []

  const orderedUsers = [...participantUserIds].sort((left, right) => {
    if (left === stone.ownerUserId) return -1
    if (right === stone.ownerUserId) return 1
    const sizeDifference = (candidatesByUser.get(left)?.length ?? 0)
      - (candidatesByUser.get(right)?.length ?? 0)
    return sizeDifference || (left - right)
  })
  const stoneCandidates = new Map(candidatesByUser)
  stoneCandidates.set(stone.ownerUserId, holderCandidates)
  const results: UnrankedRecommendation[] = []
  const selected: NormalizedCandidate[] = []
  const roleCounts: RoleCounts = { tank: 0, healer: 0, dps: 0 }

  function visit(index: number): void {
    if (index === orderedUsers.length) {
      results.push(buildRecommendation(stone, selected, roleCounts, input))
      return
    }
    const userId = orderedUsers[index]
    for (const candidate of stoneCandidates.get(userId) ?? []) {
      const role = candidate.specialization.role
      if (roleCounts[role] >= ROLE_CAPACITY[role]) continue
      selected.push(candidate)
      roleCounts[role] += 1
      if (canFitRemaining(orderedUsers, index + 1, stoneCandidates, roleCounts)) visit(index + 1)
      roleCounts[role] -= 1
      selected.pop()
    }
  }

  visit(0)
  return results
}

function normalizeCandidates(input: KeystonePlannerInput): {
  candidates: NormalizedCandidate[]
  duplicate: boolean
} {
  const participants = new Set(input.participantUserIds)
  const identities = new Set<string>()
  const normalized: NormalizedCandidate[] = []
  let duplicate = false
  for (const candidate of input.candidates) {
    if (!participants.has(candidate.userId) || candidate.playPreference === 'disabled') continue
    const specialization = wowSpecialization(candidate.specId)
    if (!specialization || !wowSpecialization(candidate.lootSpecId)) continue
    const identity = candidateIdentity(candidate)
    if (identities.has(identity)) {
      duplicate = true
      continue
    }
    identities.add(identity)
    normalized.push({
      ...candidate,
      specialization,
      playPreference: candidate.playPreference,
      capabilities: capabilitiesForSpec(candidate.specId),
    })
  }
  return { candidates: normalized.sort(compareCandidates), duplicate }
}

function validateAndApplyLocks(
  participantUserIds: readonly number[],
  candidates: readonly NormalizedCandidate[],
  locks: readonly PlannerLock[],
): { candidates: NormalizedCandidate[], issues: string[] } {
  const participants = new Set(participantUserIds)
  const issues: string[] = []
  const locksByUser = new Map<number, PlannerLock[]>()
  for (const lock of locks) {
    if (!participants.has(lock.userId)) {
      issues.push(`LOCK_USER_NOT_SELECTED:${lock.userId}`)
      continue
    }
    const entries = locksByUser.get(lock.userId) ?? []
    entries.push(lock)
    locksByUser.set(lock.userId, entries)
  }

  const filtered = candidates.filter(candidate => (locksByUser.get(candidate.userId) ?? [])
    .every(lock => lockMatches(candidate, lock)))
  for (const [userId] of locksByUser) {
    if (!filtered.some(candidate => candidate.userId === userId)) {
      issues.push(`LOCKS_HAVE_NO_CANDIDATE:${userId}`)
    }
  }
  return { candidates: filtered, issues: [...new Set(issues)].sort() }
}

export function solveKeystonePlanner(input: KeystonePlannerInput): KeystonePlannerResult {
  const diagnostics = emptyDiagnostics()
  if (input.participantUserIds.length < 2 || input.participantUserIds.length > 5) {
    diagnostics.codes.push('INVALID_PARTICIPANT_COUNT')
  }
  if (new Set(input.participantUserIds).size !== input.participantUserIds.length) {
    diagnostics.codes.push('DUPLICATE_PARTICIPANT')
  }
  if (!Number.isSafeInteger(input.targetLevel) || input.targetLevel < 1 || input.targetLevel > 20) {
    diagnostics.codes.push('INVALID_TARGET_LEVEL')
  }
  if (diagnostics.codes.length > 0) return diagnosticResult('invalid_input', diagnostics)

  const normalized = normalizeCandidates(input)
  if (normalized.duplicate) diagnostics.codes.push('DUPLICATE_CANDIDATE')
  if (diagnostics.codes.length > 0) return diagnosticResult('invalid_input', diagnostics)

  diagnostics.unconfiguredUserIds = [...input.participantUserIds]
    .filter(userId => !normalized.candidates.some(candidate => candidate.userId === userId))
    .sort((left, right) => left - right)
  if (diagnostics.unconfiguredUserIds.length > 0) {
    diagnostics.codes.push('UNCONFIGURED_PARTICIPANT')
    return diagnosticResult('unconfigured_participants', diagnostics)
  }

  const locked = validateAndApplyLocks(
    input.participantUserIds,
    normalized.candidates,
    input.locks ?? [],
  )
  if (locked.issues.length > 0) {
    diagnostics.codes.push('INVALID_LOCK')
    diagnostics.lockIssues = locked.issues
    return diagnosticResult('invalid_input', diagnostics)
  }

  const candidatesByUser = new Map<number, NormalizedCandidate[]>()
  for (const candidate of locked.candidates) {
    const entries = candidatesByUser.get(candidate.userId) ?? []
    entries.push(candidate)
    candidatesByUser.set(candidate.userId, entries)
  }
  const orderedParticipants = [...input.participantUserIds].sort((left, right) => left - right)
  const orderedStones = [...input.stones].sort((left, right) => (left.challengeMapId - right.challengeMapId)
    || (left.ownerUserId - right.ownerUserId)
    || (left.characterId - right.characterId)
    || (left.level - right.level)
    || left.dungeon.localeCompare(right.dungeon))
  const all = orderedStones.flatMap(stone => searchStone(
    stone,
    orderedParticipants,
    candidatesByUser,
    input,
  ))
  all.sort((left, right) => compareRecommendations(left, right, input.options))
  const seen = new Set<string>()
  const top = all.filter(recommendation => {
    if (seen.has(recommendation.fingerprint)) return false
    seen.add(recommendation.fingerprint)
    return true
  }).slice(0, 3).map((recommendation, index) => ({ ...recommendation, rank: index + 1 }))

  if (top.length === 0) {
    diagnostics.codes.push('NO_VALID_COMPOSITION')
    return diagnosticResult('no_valid_composition', diagnostics)
  }
  return { status: 'ok', diagnostics, recommendations: top }
}
