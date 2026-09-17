import type { KeystoneLootVoidcoreState } from './keystoneObjectives'
import type { PlayPreference } from './plannerPreferences'
import { keystoneLootTierWeight } from './keystoneRecommendations'
import {
  WOW_CAPABILITIES,
  WOW_SPECIALIZATIONS,
  armorTypeForClass,
  capabilitiesForSpec,
  combatStyleForSpec,
  wowSpecialization,
} from './wowComposition'
import type {
  CapabilityId,
  ResolvedCapability,
  WowArmorType,
  WowClassName,
  WowDamageProfile,
  WowPrimaryStat,
  WowRole,
} from './wowComposition'
import {
  assignOffensiveBands,
  assignTierVectorBands,
  rankVacancyAlternatives,
  rankVacancyCompletions,
  scoreAdvancedOffensive,
  scoreDungeonUtility,
  scoreGroupDefense,
} from './plannerVacancyScoring'
import { OFFENSIVE_PROVIDER_BY_CLASS, dungeonRelevance, utilityEntriesForSpec } from './plannerRankingData'
import type {
  ModernRecommendationMode,
  RankedVacancyCompletion,
  ScoredUtilityCapability,
  TierVector,
  VacancyScoringOptions,
  VacancySelection,
} from './plannerVacancyScoring'

export type PlannerOptions = {
  optimizeComposition: boolean
  bloodlust: boolean
  battleRez: boolean
  classBuffs?: boolean
  damageSynergy?: boolean
  recommendationMode?: ModernRecommendationMode
  fillComposition?: boolean
  offensiveSynergy?: boolean
  groupDefense?: boolean
  dungeonUtility?: boolean
}

export type PlannerObjective = {
  itemId: number
  tier: number
  specId: number
  sourceType: string
  sourceId: number | string
  variantKey: string
  upgradeTrack?: string
  voidcoreState: KeystoneLootVoidcoreState
}

export type PlannerCandidate = {
  userId: number
  username: string
  characterId: number
  characterName: string
  specId: number
  lootSpecId: number
  primaryLootSpecId?: number
  secondaryLootSpecIds?: readonly number[]
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
  candidateClasses?: PlannerExternalClassCandidate[]
  recommendationMode?: ModernRecommendationMode
  recommendedClass?: WowClassName
  recommendedSpecId?: number
  recommendedSpecName?: string
  offensiveGainPct?: number
  offensiveBand?: number
  offensiveReasons?: string[]
  offensiveProvenance?: Array<{
    specId: number
    source: 'simc' | 'archetype_estimate'
    confidence: 'high' | 'medium' | 'low'
    method?: string
    donorSpecIds?: number[]
  }>
  defensiveContribution?: { tiers: TierVector, reasons: string[] }
  defensiveBand?: number
  dungeonUtilityContribution?: { tiers: TierVector, reasons: string[] }
  dungeonUtilityBand?: number
  recommendations?: PlannerVacancyRecommendation[]
}

export type PlannerVacancyCapability = {
  capabilityId: string
  name: string
  spellId: number
  availability: Exclude<CapabilityAvailability, 'none'>
}

export type PlannerAdvancedUtilityCapability = PlannerVacancyCapability & {
  tier: 'S' | 'A' | 'B' | 'C'
  relevance: number
  score: number
}

export type PlannerVacancyRecommendation = {
  id: string
  wowClass: WowClassName
  specId?: number
  specName?: string
  damageProfile: Exclude<WowDamageProfile, null> | 'mixed' | 'unknown'
  offensiveGainPct: number
  buffsDebuffs: PlannerVacancyCapability[]
  utilities: PlannerVacancyCapability[]
  groupDefensives?: PlannerAdvancedUtilityCapability[]
  dungeonUtilities?: PlannerAdvancedUtilityCapability[]
}

function vacancySelectionDamageProfile(
  selection: VacancySelection,
): PlannerVacancyRecommendation['damageProfile'] {
  if (selection.role !== 'dps') return 'unknown'
  if (selection.specId) return wowSpecialization(selection.specId)?.damageProfile ?? 'unknown'

  const profiles = WOW_SPECIALIZATIONS
    .filter(spec => spec.role === 'dps' && spec.wowClass === selection.wowClass)
    .map(spec => spec.damageProfile)
  const knownProfiles = new Set(profiles.filter(
    (profile): profile is Exclude<WowDamageProfile, null> => profile !== null,
  ))
  if (knownProfiles.size > 1) return 'mixed'
  if (knownProfiles.size === 1 && profiles.every(profile => profile !== null)) {
    return [...knownProfiles][0]
  }
  return 'unknown'
}

export type PlannerExternalClassReasonCode =
  | 'PROVIDES_BLOODLUST'
  | 'PROVIDES_BATTLE_REZ'
  | 'BUFFS_INTELLECT'
  | 'BUFFS_ATTACK_POWER'
  | 'AMPLIFIES_MAGICAL_DAMAGE'
  | 'AMPLIFIES_PHYSICAL_DAMAGE'
  | 'ADDS_CLASS_BUFF'

export type PlannerExternalClassCandidate = {
  wowClass: WowClassName
  contributions: Array<{
    capabilityId: CapabilityId
    availability: Exclude<CapabilityAvailability, 'none'>
  }>
  reasonCodes: PlannerExternalClassReasonCode[]
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
  criticalRolesCovered: number
  armorSynergy: {
    pairs: number
    dominantType: WowArmorType | null
    counts: Record<WowArmorType, number>
  }
  groupDefensives?: PlannerAdvancedUtilityCapability[]
  dungeonUtilities?: PlannerAdvancedUtilityCapability[]
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
type ExternalCompletionScore = {
  bloodlust: number
  battleRez: number
  effectiveOffensiveBeneficiaries: number
  newClassCapabilities: number
}

type UnrankedRecommendation = Omit<KeystonePlannerRecommendation, 'rank'> & {
  externalCompletionScore: ExternalCompletionScore
  modernCompletion: RankedVacancyCompletion | null
}

type ModernCompletionCache = Map<string, readonly RankedVacancyCompletion[]>
type CandidateLootEvaluation = {
  assignment: PlannerAssignment
  weightedScore: number
  hasObjectives: boolean
  totalObjectives: number
  tierCounts: PlannerTierCounts
}
type CandidateLootCache = Map<string, CandidateLootEvaluation>

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

function scoringObjectives(
  candidate: NormalizedCandidate,
  challengeMapId: number,
  lootSpecId: number,
): PlannerObjective[] {
  const selected = new Map<string, PlannerObjective>()
  for (const objective of candidate.objectives) {
    if (objective.specId !== lootSpecId
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
  const armorCounts: Record<WowArmorType, number> = { cloth: 0, leather: 0, mail: 0, plate: 0 }
  for (const candidate of candidates) {
    armorCounts[armorTypeForClass(candidate.specialization.wowClass)] += 1
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
  const armorOrder: readonly WowArmorType[] = ['cloth', 'leather', 'mail', 'plate']
  const armorPairs = armorOrder.reduce((total, armorType) => {
    const count = armorCounts[armorType]
    return total + (count * (count - 1)) / 2
  }, 0)
  const dominantType = armorPairs === 0 ? null : [...armorOrder].sort((left, right) =>
    armorCounts[right] - armorCounts[left] || armorOrder.indexOf(left) - armorOrder.indexOf(right))[0]

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
    criticalRolesCovered: Number(candidates.some(candidate => candidate.specialization.role === 'tank'))
      + Number(candidates.some(candidate => candidate.specialization.role === 'healer')),
    armorSynergy: { pairs: armorPairs, dominantType, counts: armorCounts },
  }
}

function lootSelection(
  candidate: NormalizedCandidate,
  challengeMapId: number,
): { lootSpecId: number, objectives: PlannerObjective[] } {
  const primaryLootSpecId = candidate.primaryLootSpecId ?? candidate.lootSpecId
  const primaryObjectives = scoringObjectives(candidate, challengeMapId, primaryLootSpecId)
  if (primaryObjectives.length > 0) return { lootSpecId: primaryLootSpecId, objectives: primaryObjectives }

  const secondaries = [...new Set(candidate.secondaryLootSpecIds ?? [])]
    .filter(specId => specId !== primaryLootSpecId)
    .map(lootSpecId => ({
      lootSpecId,
      objectives: scoringObjectives(candidate, challengeMapId, lootSpecId),
    }))
    .filter(selection => selection.objectives.length > 0)
    .sort((left, right) => {
      const leftScore = left.objectives.reduce((total, objective) => total + keystoneLootTierWeight(objective.tier), 0)
      const rightScore = right.objectives.reduce((total, objective) => total + keystoneLootTierWeight(objective.tier), 0)
      return rightScore - leftScore || right.objectives.length - left.objectives.length
        || left.lootSpecId - right.lootSpecId
    })
  return secondaries[0] ?? { lootSpecId: primaryLootSpecId, objectives: [] }
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

type ExternalSpec = {
  wowClass: WowClassName
  role: WowRole
  damageProfile: WowDamageProfile
  primaryStat: WowPrimaryStat
  capabilities: readonly ResolvedCapability[]
}

type ExternalCompletion = {
  specs: readonly ExternalSpec[]
  score: ExternalCompletionScore
}

const EMPTY_EXTERNAL_SCORE: Readonly<ExternalCompletionScore> = {
  bloodlust: 0,
  battleRez: 0,
  effectiveOffensiveBeneficiaries: 0,
  newClassCapabilities: 0,
}

function compareExternalScores(left: ExternalCompletionScore, right: ExternalCompletionScore): number {
  return compareDescending(left.bloodlust, right.bloodlust)
    || compareDescending(left.battleRez, right.battleRez)
    || compareDescending(left.effectiveOffensiveBeneficiaries, right.effectiveOffensiveBeneficiaries)
    || compareDescending(left.newClassCapabilities, right.newClassCapabilities)
}

function aggregateExternalCapabilities(
  existing: readonly NormalizedCandidate[],
  external: readonly ExternalSpec[],
): Map<CapabilityId, Exclude<CapabilityAvailability, 'none'>> {
  const availability = aggregateCapabilityAvailability(existing)
  for (const member of external) {
    for (const capability of member.capabilities) {
      const current = availability.get(capability.capabilityId)
      if (current !== 'guaranteed') availability.set(capability.capabilityId, capability.mode)
    }
  }
  return availability
}

function externalCompletionScore(
  existing: readonly NormalizedCandidate[],
  external: readonly ExternalSpec[],
  options: PlannerOptions,
): ExternalCompletionScore {
  if (!options.optimizeComposition) return { ...EMPTY_EXTERNAL_SCORE }
  const availability = aggregateExternalCapabilities(existing, external)
  const dps = [
    ...existing.filter(candidate => candidate.specialization.role === 'dps').map(candidate => candidate.specialization),
    ...external.filter(candidate => candidate.role === 'dps'),
  ]
  let effectiveOffensiveBeneficiaries = 0
  if (options.classBuffs) {
    if (availability.has('ARCANE_INTELLECT')) {
      effectiveOffensiveBeneficiaries += dps.filter(member => member.primaryStat === 'intellect').length
    }
    if (availability.has('BATTLE_SHOUT')) {
      effectiveOffensiveBeneficiaries += dps.filter(member => member.primaryStat === 'attack_power').length
    }
  }
  if (options.damageSynergy) {
    if (availability.has('CHAOS_BRAND')) {
      effectiveOffensiveBeneficiaries += dps.filter(member => member.damageProfile === 'magical').length
    }
    if (availability.has('MYSTIC_TOUCH')) {
      effectiveOffensiveBeneficiaries += dps.filter(member => member.damageProfile === 'physical').length
    }
  }
  const enabledCapabilityTypes = new Set<string>()
  if (options.classBuffs) enabledCapabilityTypes.add('class_buff')
  if (options.damageSynergy) enabledCapabilityTypes.add('damage_debuff')
  return {
    bloodlust: options.bloodlust
      ? AVAILABILITY_RANK[capabilityStatus(availability, 'BLOODLUST')]
      : 0,
    battleRez: options.battleRez
      ? AVAILABILITY_RANK[capabilityStatus(availability, 'BATTLE_REZ')]
      : 0,
    effectiveOffensiveBeneficiaries,
    newClassCapabilities: WOW_CAPABILITIES.filter(definition =>
      enabledCapabilityTypes.has(definition.type) && availability.has(definition.id)).length,
  }
}

function externalSpecsForRole(role: WowRole): ExternalSpec[] {
  return WOW_SPECIALIZATIONS.filter(spec => spec.role === role).map(spec => ({
    wowClass: spec.wowClass,
    role: spec.role,
    damageProfile: spec.damageProfile,
    primaryStat: spec.primaryStat,
    capabilities: capabilitiesForSpec(spec.id),
  }))
}

function enumerateExternalCompletions(
  roles: readonly WowRole[],
  existing: readonly NormalizedCandidate[],
  options: PlannerOptions,
): ExternalCompletion[] {
  const completions: ExternalCompletion[] = []
  const selected: ExternalSpec[] = []
  const visit = (index: number) => {
    if (index === roles.length) {
      completions.push({ specs: [...selected], score: externalCompletionScore(existing, selected, options) })
      return
    }
    for (const candidate of externalSpecsForRole(roles[index])) {
      selected.push(candidate)
      visit(index + 1)
      selected.pop()
    }
  }
  visit(0)
  return completions
}

function externalClassContributions(role: WowRole, wowClass: WowClassName): PlannerExternalClassCandidate['contributions'] {
  const eligibleSpecs = externalSpecsForRole(role).filter(spec => spec.wowClass === wowClass)
  return WOW_CAPABILITIES.flatMap(definition => {
    const providers = eligibleSpecs.map(spec => spec.capabilities.find(capability =>
      capability.capabilityId === definition.id))
    const present = providers.filter((provider): provider is ResolvedCapability => provider !== undefined)
    if (present.length === 0) return []
    const availability = present.length === eligibleSpecs.length
      && present.every(provider => provider.mode === 'guaranteed') ? 'guaranteed' : 'conditional'
    return [{ capabilityId: definition.id, availability }]
  })
}

function externalReasonCodes(
  contributions: PlannerExternalClassCandidate['contributions'],
): PlannerExternalClassReasonCode[] {
  const capabilities = new Set(contributions.map(contribution => contribution.capabilityId))
  const reasons: PlannerExternalClassReasonCode[] = []
  if (capabilities.has('BLOODLUST')) reasons.push('PROVIDES_BLOODLUST')
  if (capabilities.has('BATTLE_REZ')) reasons.push('PROVIDES_BATTLE_REZ')
  if (capabilities.has('ARCANE_INTELLECT')) reasons.push('BUFFS_INTELLECT')
  if (capabilities.has('BATTLE_SHOUT')) reasons.push('BUFFS_ATTACK_POWER')
  if (capabilities.has('CHAOS_BRAND')) reasons.push('AMPLIFIES_MAGICAL_DAMAGE')
  if (capabilities.has('MYSTIC_TOUCH')) reasons.push('AMPLIFIES_PHYSICAL_DAMAGE')
  if (contributions.some(contribution => WOW_CAPABILITIES.some(definition =>
    definition.id === contribution.capabilityId && definition.type === 'class_buff'
      && !['ARCANE_INTELLECT', 'BATTLE_SHOUT'].includes(definition.id)))) {
    reasons.push('ADDS_CLASS_BUFF')
  }
  return reasons
}

function rankedExternalClasses(
  role: WowRole,
  vacancyIndex: number,
  completions: readonly ExternalCompletion[],
): PlannerExternalClassCandidate[] {
  const bestByClass = new Map<WowClassName, ExternalCompletionScore>()
  for (const completion of completions) {
    const wowClass = completion.specs[vacancyIndex]?.wowClass
    if (!wowClass) continue
    const current = bestByClass.get(wowClass)
    if (!current || compareExternalScores(completion.score, current) < 0) {
      bestByClass.set(wowClass, completion.score)
    }
  }
  return [...bestByClass.entries()]
    .sort(([leftClass, leftScore], [rightClass, rightScore]) =>
      compareExternalScores(leftScore, rightScore) || leftClass.localeCompare(rightClass))
    .map(([wowClass]) => {
      const contributions = externalClassContributions(role, wowClass)
      return { wowClass, contributions, reasonCodes: externalReasonCodes(contributions) }
    })
}

function vacanciesFor(
  roleCounts: Readonly<RoleCounts>,
  summary: PlannerCompositionSummary,
  options: PlannerOptions,
  existing: readonly NormalizedCandidate[],
): { vacancies: PlannerVacancy[], bestScore: ExternalCompletionScore } {
  const roles = vacancyRoles(roleCounts)
  const completions = enumerateExternalCompletions(roles, existing, options)
  const vacancies = roles.map((role, index) => ({
    role,
    preferredCapabilities: [] as CapabilityId[],
    candidateClasses: rankedExternalClasses(role, index, completions),
  }))
  if (!options.optimizeComposition) return { vacancies, bestScore: { ...EMPTY_EXTERNAL_SCORE } }
  const requested: CapabilityId[] = []
  if (options.bloodlust && summary.bloodlust === 'none') requested.push('BLOODLUST')
  if (options.battleRez && summary.battleRez === 'none') requested.push('BATTLE_REZ')
  for (const capabilityId of requested) {
    const vacancy = vacancies.find(candidate => roleCanProvide(candidate.role, capabilityId))
    if (vacancy) vacancy.preferredCapabilities.push(capabilityId)
  }
  const bestScore = completions.sort((left, right) => compareExternalScores(left.score, right.score))[0]?.score
    ?? { ...EMPTY_EXTERNAL_SCORE }
  return { vacancies, bestScore }
}

function isModernOptions(options: PlannerOptions): options is PlannerOptions & {
  recommendationMode: ModernRecommendationMode
} {
  return options.recommendationMode === 'quick' || options.recommendationMode === 'advanced'
}

function shouldFillComposition(options: PlannerOptions): boolean {
  return !isModernOptions(options) || options.fillComposition !== false
}

const UTILITY_TIER_RANK = { S: 4, A: 3, B: 2, C: 1 } as const

function vacancyScoringOptions(options: PlannerOptions & {
  recommendationMode: ModernRecommendationMode
}): VacancyScoringOptions {
  return {
    mode: options.recommendationMode,
    bloodlust: options.optimizeComposition && options.bloodlust,
    battleRez: options.optimizeComposition && options.battleRez,
    offensiveSynergy: options.optimizeComposition && Boolean(options.offensiveSynergy),
    groupDefense: options.optimizeComposition && Boolean(options.groupDefense),
    dungeonUtility: options.optimizeComposition && Boolean(options.dungeonUtility),
  }
}

function sameVacancySelection(left: VacancySelection, right: VacancySelection): boolean {
  return left.role === right.role && left.wowClass === right.wowClass && left.specId === right.specId
}

function utilityAvailability(availability: string): Exclude<CapabilityAvailability, 'none'> {
  return availability === 'baseline' || availability === 'spec_only' ? 'guaranteed' : 'conditional'
}

function publicScoredUtilities(
  capabilities: readonly ScoredUtilityCapability[],
): PlannerAdvancedUtilityCapability[] {
  const seen = new Set<string>()
  return capabilities.flatMap(capability => {
    if (seen.has(capability.abilityKey)) return []
    seen.add(capability.abilityKey)
    const { abilityKey: _abilityKey, ...result } = capability
    return [result]
  })
}

function completionStratumKey(
  completion: RankedVacancyCompletion,
  options: PlannerOptions & { recommendationMode: ModernRecommendationMode },
): string {
  return JSON.stringify([
    options.optimizeComposition && options.bloodlust ? completion.bloodlust : 0,
    options.optimizeComposition && options.battleRez ? completion.battleRez : 0,
    options.optimizeComposition && options.offensiveSynergy ? completion.offensiveBand : 0,
    options.optimizeComposition && options.recommendationMode === 'advanced' && options.groupDefense
      ? completion.defenseBand : 0,
    options.optimizeComposition && options.recommendationMode === 'advanced' && options.dungeonUtility
      ? completion.dungeonUtilityBand : 0,
  ])
}

function utilityCapabilitiesForSelection(
  selection: VacancySelection,
  challengeMapId: number,
): PlannerVacancyCapability[] {
  const specIds = selection.specId ? [selection.specId] : WOW_SPECIALIZATIONS
    .filter(spec => spec.role === selection.role && spec.wowClass === selection.wowClass)
    .map(spec => spec.id)
  if (specIds.length === 0) return []
  const essentials = (['BLOODLUST', 'BATTLE_REZ'] as const).flatMap(capabilityId => {
    const resolved = specIds.map(specId => capabilitiesForSpec(specId)
      .find(capability => capability.capabilityId === capabilityId))
    if (!resolved.every((capability): capability is ResolvedCapability => Boolean(capability))) return []
    const definition = WOW_CAPABILITIES.find(capability => capability.id === capabilityId)
    return definition ? [{
      capabilityId,
      name: definition.name,
      spellId: definition.iconSpellId,
      availability: resolved.every(capability => capability.mode === 'guaranteed')
        ? 'guaranteed' as const : 'conditional' as const,
    }] : []
  })
  const entries = specIds.flatMap(specId => utilityEntriesForSpec(specId)
    .filter((entry): entry is typeof entry & { spellId: number } =>
      typeof entry.spellId === 'number' && Number.isInteger(entry.spellId) && entry.spellId > 0)
    .map(entry => ({ ...entry, specId })))
  const byAbility = new Map<string, typeof entries>()
  for (const entry of entries) byAbility.set(entry.abilityKey, [...(byAbility.get(entry.abilityKey) ?? []), entry])
  const utilities = [...byAbility.values()].flatMap(group => {
    if (!selection.specId && new Set(group.map(entry => entry.specId)).size !== specIds.length) return []
    const representative = [...group].sort((left, right) =>
      dungeonRelevance(challengeMapId, right.capabilityId) - dungeonRelevance(challengeMapId, left.capabilityId)
      || UTILITY_TIER_RANK[right.tier] - UTILITY_TIER_RANK[left.tier]
      || right.availabilityFactor - left.availabilityFactor
      || left.capabilityId.localeCompare(right.capabilityId))[0]
    return representative ? [{
      capabilityId: representative.capabilityId,
      name: representative.abilityName,
      spellId: representative.spellId,
      availability: group.every(entry => utilityAvailability(entry.availability) === 'guaranteed')
        ? 'guaranteed' as const : 'conditional' as const,
      relevance: dungeonRelevance(challengeMapId, representative.capabilityId),
      tier: representative.tier,
    }] : []
  }).sort((left, right) => right.relevance - left.relevance
    || UTILITY_TIER_RANK[right.tier] - UTILITY_TIER_RANK[left.tier]
    || (right.availability === 'guaranteed' ? 1 : 0) - (left.availability === 'guaranteed' ? 1 : 0)
    || left.name.localeCompare(right.name))
    .slice(0, 8)
    .map(({ relevance: _relevance, tier: _tier, ...capability }) => capability)
  return [...essentials, ...utilities]
}

function buffsForSelection(
  selection: VacancySelection,
  existingSpecIds: readonly number[],
  otherSelections: readonly VacancySelection[],
): PlannerVacancyCapability[] {
  const buffId = OFFENSIVE_PROVIDER_BY_CLASS.get(selection.wowClass)
  if (!buffId) return []
  const coveredClasses = new Set([
    ...existingSpecIds.flatMap(specId => {
      const spec = wowSpecialization(specId)
      return spec ? [spec.wowClass] : []
    }),
    ...otherSelections.map(candidate => candidate.wowClass),
  ])
  if (coveredClasses.has(selection.wowClass)) return []
  const capability = WOW_CAPABILITIES.find(candidate => candidate.id === buffId)
  return capability ? [{
    capabilityId: capability.id,
    name: capability.name,
    spellId: capability.iconSpellId,
    availability: 'guaranteed',
  }] : []
}

function vacancyRecommendations(
  role: WowRole,
  selected: VacancySelection,
  otherSelections: readonly VacancySelection[],
  existingSpecIds: readonly number[],
  challengeMapId: number,
  options: PlannerOptions & { recommendationMode: ModernRecommendationMode },
): { recommendations: PlannerVacancyRecommendation[], representative: RankedVacancyCompletion | null } {
  const scoringOptions = vacancyScoringOptions(options)
  const ranked = rankVacancyAlternatives(
    existingSpecIds, otherSelections, role, challengeMapId, scoringOptions,
  )
  const selectedCompletion = ranked.find(candidate => {
    const alternative = candidate.selections.at(-1)
    return Boolean(alternative && sameVacancySelection(alternative, selected))
  })
  const selectedStratum = completionStratumKey(selectedCompletion ?? ranked[0], options)
  const ordered = ranked.filter(candidate => completionStratumKey(candidate, options) === selectedStratum)
  return {
    representative: ordered[0] ?? null,
    recommendations: ordered.flatMap(candidate => {
    const alternative = candidate.selections.at(-1)
    if (!alternative) return []
    const otherSpecIds = otherSelections.flatMap(item => item.specId ? [item.specId] : [])
    const defensive = alternative.specId && scoringOptions.groupDefense
      ? scoreGroupDefense([...existingSpecIds, ...otherSpecIds], [alternative.specId]) : null
    const dungeon = alternative.specId && scoringOptions.dungeonUtility
      ? scoreDungeonUtility([...existingSpecIds, ...otherSpecIds], [alternative.specId], challengeMapId) : null
    return [{
      id: `${options.recommendationMode}:${alternative.wowClass}:${alternative.specId ?? alternative.role}`,
      wowClass: alternative.wowClass,
      ...(alternative.specId ? { specId: alternative.specId, specName: alternative.specName } : {}),
      damageProfile: vacancySelectionDamageProfile(alternative),
      offensiveGainPct: candidate.offensive.gainPct,
      buffsDebuffs: buffsForSelection(alternative, existingSpecIds, otherSelections),
      utilities: utilityCapabilitiesForSelection(alternative, challengeMapId),
      ...(defensive ? { groupDefensives: publicScoredUtilities(defensive.capabilities) } : {}),
      ...(dungeon ? { dungeonUtilities: publicScoredUtilities(dungeon.capabilities) } : {}),
    }]
    }),
  }
}

function modernVacancies(
  roles: readonly WowRole[],
  completion: RankedVacancyCompletion,
  existingSpecIds: readonly number[],
  challengeMapId: number,
  options: PlannerOptions,
): PlannerVacancy[] {
  if (!isModernOptions(options)) return []
  return roles.map((role, index) => {
    const selection = completion.selections[index]
    if (!selection) return { role, preferredCapabilities: [] }
    const compositionScoringEnabled = options.optimizeComposition
    const otherSelections = completion.selections.filter((_candidate, candidateIndex) => candidateIndex !== index)
    const rankedRecommendations = vacancyRecommendations(
      role, selection, otherSelections, existingSpecIds, challengeMapId, options,
    )
    const displayedSelection = rankedRecommendations.representative?.selections.at(-1) ?? selection
    const otherCandidateSpecIds = completion.selections.flatMap((candidate, candidateIndex) =>
      candidateIndex !== index && candidate.specId ? [candidate.specId] : [])
    const offensive = !(compositionScoringEnabled && options.offensiveSynergy)
      ? { gainPct: 0, recipients: [], interactions: [], reasons: [], provenance: [] }
      : displayedSelection.specId
        ? scoreAdvancedOffensive([...existingSpecIds, ...otherCandidateSpecIds], [displayedSelection.specId])
        : rankedRecommendations.representative?.offensive ?? completion.offensive
    const defense = displayedSelection.specId && compositionScoringEnabled && options.groupDefense
      ? scoreGroupDefense([...existingSpecIds, ...otherCandidateSpecIds], [displayedSelection.specId])
      : { tiers: { S: 0, A: 0, B: 0, C: 0 }, reasons: [], capabilities: [] }
    const dungeonUtility = displayedSelection.specId && compositionScoringEnabled && options.dungeonUtility
      ? scoreDungeonUtility([...existingSpecIds, ...otherCandidateSpecIds], [displayedSelection.specId], challengeMapId)
      : { tiers: { S: 0, A: 0, B: 0, C: 0 }, reasons: [], capabilities: [] }
    const contributions = externalClassContributions(role, displayedSelection.wowClass)
    return {
      role,
      preferredCapabilities: [],
      candidateClasses: [{
        wowClass: displayedSelection.wowClass,
        contributions,
        reasonCodes: externalReasonCodes(contributions),
      }],
      recommendationMode: displayedSelection.specId ? 'advanced' : 'quick',
      recommendedClass: displayedSelection.wowClass,
      ...(displayedSelection.specId ? {
        recommendedSpecId: displayedSelection.specId,
        recommendedSpecName: displayedSelection.specName,
      } : {}),
      offensiveGainPct: offensive.gainPct,
      offensiveBand: rankedRecommendations.representative?.offensiveBand ?? completion.offensiveBand,
      offensiveReasons: offensive.reasons.slice(0, 8),
      offensiveProvenance: offensive.provenance.slice(0, 5).map(item => {
        const { donorSpecIds, ...provenance } = item
        return { ...provenance, ...(donorSpecIds ? { donorSpecIds: [...donorSpecIds] } : {}) }
      }),
      defensiveContribution: {
        tiers: { ...defense.tiers },
        reasons: defense.reasons.slice(0, 8),
      },
      defensiveBand: rankedRecommendations.representative?.defenseBand ?? completion.defenseBand,
      dungeonUtilityContribution: {
        tiers: { ...dungeonUtility.tiers },
        reasons: dungeonUtility.reasons.slice(0, 8),
      },
      dungeonUtilityBand: rankedRecommendations.representative?.dungeonUtilityBand
        ?? completion.dungeonUtilityBand,
      recommendations: rankedRecommendations.recommendations,
    }
  })
}

function assignmentFor(
  candidate: NormalizedCandidate,
  lootSpecId: number,
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
    lootSpecId,
    playPreference: candidate.playPreference,
    objectives: objectives.map(objective => ({ ...objective })),
    capabilities: candidate.capabilities.map(capability => ({ ...capability })),
  }
}

function recommendationFingerprint(
  stone: PlannerStone,
  assignments: readonly PlannerAssignment[],
  vacancyKey = '',
): string {
  return JSON.stringify({
    stone: [stone.ownerUserId, stone.characterId, stone.challengeMapId, stone.level],
    assignments: assignments.map(assignment => [
      assignment.userId, assignment.characterId, assignment.specId, assignment.lootSpecId,
    ]),
    ...(vacancyKey ? { vacancyKey } : {}),
  })
}

function recommendationDiversityIdentity(
  recommendation: UnrankedRecommendation,
  options: PlannerOptions,
): string {
  const modernOptions = isModernOptions(options) ? options : null
  return JSON.stringify({
    stone: [
      recommendation.stone.ownerUserId,
      recommendation.stone.characterId,
      recommendation.stone.challengeMapId,
      recommendation.stone.level,
    ],
    assignments: recommendation.assignments.map(assignment => {
      const specialization = wowSpecialization(assignment.specId)
      return [
        assignment.userId,
        assignment.characterId,
        assignment.role,
        combatStyleForSpec(assignment.specId),
        specialization?.damageProfile ?? null,
        assignment.capabilities.map(capability =>
          `${capability.capabilityId}\u0000${capability.mode}\u0000${capability.condition ?? ''}`,
        ).sort(),
      ]
    }),
    vacancyKey: recommendation.modernCompletion && modernOptions
      ? completionStratumKey(recommendation.modernCompletion, modernOptions)
      : recommendation.modernCompletion?.stableKey ?? '',
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
  return (left.modernCompletion?.stableKey ?? '').localeCompare(right.modernCompletion?.stableKey ?? '')
}

function compareDescending(left: number, right: number): number {
  return right - left
}

function compareRecommendations(
  left: UnrankedRecommendation,
  right: UnrankedRecommendation,
  options: PlannerOptions,
): number {
  const primary = compareDescending(
    left.compositionSummary.criticalRolesCovered,
    right.compositionSummary.criticalRolesCovered,
  ) || (left.levelSummary.levelDistance - right.levelSummary.levelDistance)
    || (left.preferenceSummary.emergency - right.preferenceSummary.emergency)
    || compareDescending(left.preferenceSummary.preferred, right.preferenceSummary.preferred)
    || compareDescending(left.preferenceSummary.available, right.preferenceSummary.available)
  if (primary !== 0) return primary

  const modern = isModernOptions(options)
  if (options.optimizeComposition && modern) {
    const leftCompletion = left.modernCompletion
    const rightCompletion = right.modernCompletion
    if (leftCompletion && rightCompletion) {
      if (options.bloodlust) {
        const comparison = compareDescending(leftCompletion.bloodlust, rightCompletion.bloodlust)
        if (comparison !== 0) return comparison
      }
      if (options.battleRez) {
        const comparison = compareDescending(leftCompletion.battleRez, rightCompletion.battleRez)
        if (comparison !== 0) return comparison
      }
      if (options.offensiveSynergy) {
        const comparison = leftCompletion.offensiveBand - rightCompletion.offensiveBand
        if (comparison !== 0) return comparison
      }
      if (options.recommendationMode === 'advanced' && options.groupDefense) {
        const comparison = leftCompletion.defenseBand - rightCompletion.defenseBand
        if (comparison !== 0) return comparison
      }
      if (options.recommendationMode === 'advanced' && options.dungeonUtility) {
        const comparison = leftCompletion.dungeonUtilityBand - rightCompletion.dungeonUtilityBand
        if (comparison !== 0) return comparison
      }
    }
  } else if (options.optimizeComposition) {
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
    const external = compareExternalScores(left.externalCompletionScore, right.externalCompletionScore)
    if (external !== 0) return external
  }

  if (!modern) {
    const armorSynergy = compareDescending(
      left.compositionSummary.armorSynergy.pairs,
      right.compositionSummary.armorSynergy.pairs,
    )
    if (armorSynergy !== 0) return armorSynergy
  }

  const loot = compareDescending(left.lootSummary.weightedScore, right.lootSummary.weightedScore)
    || compareDescending(left.lootSummary.playersWithObjectives, right.lootSummary.playersWithObjectives)
  if (loot !== 0) return loot

  const tiers = compareDescending(left.lootSummary.tierCounts.bestInSlot, right.lootSummary.tierCounts.bestInSlot)
    || compareDescending(left.lootSummary.tierCounts.mustHave, right.lootSummary.tierCounts.mustHave)
    || compareDescending(left.lootSummary.tierCounts.niceToHave, right.lootSummary.tierCounts.niceToHave)
    || compareDescending(left.lootSummary.tierCounts.catalyst, right.lootSummary.tierCounts.catalyst)
    || compareDescending(left.lootSummary.tierCounts.transmog, right.lootSummary.tierCounts.transmog)
  if (tiers !== 0) return tiers

  if (modern) {
    const armorSynergy = compareDescending(
      left.compositionSummary.armorSynergy.pairs,
      right.compositionSummary.armorSynergy.pairs,
    )
    if (armorSynergy !== 0) return armorSynergy
  }

  if (modern && options.optimizeComposition && options.offensiveSynergy
    && left.modernCompletion && right.modernCompletion) {
    const exactOffensive = compareDescending(
      left.modernCompletion.offensive.gainPct,
      right.modernCompletion.offensive.gainPct,
    )
    if (exactOffensive !== 0) return exactOffensive
  }
  return compareStable(left, right)
}

function modernHigherPriorityKey(recommendation: UnrankedRecommendation, options: PlannerOptions): string {
  const completion = recommendation.modernCompletion
  return JSON.stringify([
    recommendation.compositionSummary.criticalRolesCovered,
    recommendation.levelSummary.levelDistance,
    recommendation.preferenceSummary.emergency,
    recommendation.preferenceSummary.preferred,
    recommendation.preferenceSummary.available,
    options.bloodlust ? completion?.bloodlust ?? 0 : 0,
    options.battleRez ? completion?.battleRez ?? 0 : 0,
  ])
}

function assignModernEquivalenceBands(
  recommendations: readonly UnrankedRecommendation[],
  options: PlannerOptions,
): void {
  if (!isModernOptions(options)) return
  const offensiveGroups = new Map<string, UnrankedRecommendation[]>()
  for (const recommendation of recommendations) {
    if (!recommendation.modernCompletion) continue
    const key = modernHigherPriorityKey(recommendation, options)
    offensiveGroups.set(key, [...(offensiveGroups.get(key) ?? []), recommendation])
  }
  for (const group of offensiveGroups.values()) {
    const bands = options.optimizeComposition && options.offensiveSynergy
      ? assignOffensiveBands(group.map(item => item.modernCompletion!.offensive.gainPct))
      : group.map(() => 0)
    group.forEach((item, index) => { item.modernCompletion!.offensiveBand = bands[index] })
  }

  const defenseGroups = new Map<string, UnrankedRecommendation[]>()
  for (const recommendation of recommendations) {
    if (!recommendation.modernCompletion) continue
    const key = `${modernHigherPriorityKey(recommendation, options)}:${recommendation.modernCompletion.offensiveBand}`
    defenseGroups.set(key, [...(defenseGroups.get(key) ?? []), recommendation])
  }
  for (const group of defenseGroups.values()) {
    const bands = options.optimizeComposition && options.recommendationMode === 'advanced' && options.groupDefense
      ? assignTierVectorBands(group.map(item => item.modernCompletion!.defense.tiers))
      : group.map(() => 0)
    group.forEach((item, index) => { item.modernCompletion!.defenseBand = bands[index] })
  }

  const utilityGroups = new Map<string, UnrankedRecommendation[]>()
  for (const recommendation of recommendations) {
    if (!recommendation.modernCompletion) continue
    const completion = recommendation.modernCompletion
    const key = `${modernHigherPriorityKey(recommendation, options)}:${completion.offensiveBand}:${completion.defenseBand}`
    utilityGroups.set(key, [...(utilityGroups.get(key) ?? []), recommendation])
  }
  for (const group of utilityGroups.values()) {
    const bands = options.optimizeComposition && options.recommendationMode === 'advanced' && options.dungeonUtility
      ? assignTierVectorBands(group.map(item => item.modernCompletion!.dungeonUtility.tiers))
      : group.map(() => 0)
    group.forEach((item, index) => { item.modernCompletion!.dungeonUtilityBand = bands[index] })
  }

  for (const recommendation of recommendations) {
    const completion = recommendation.modernCompletion
    if (!completion) continue
    for (const vacancy of recommendation.vacancies) {
      vacancy.offensiveBand = completion.offensiveBand
      vacancy.defensiveBand = completion.defenseBand
      vacancy.dungeonUtilityBand = completion.dungeonUtilityBand
    }
  }
}

function evaluateCandidateLoot(
  candidate: NormalizedCandidate,
  challengeMapId: number,
  cache: CandidateLootCache,
): CandidateLootEvaluation {
  const cacheKey = `${challengeMapId}:${candidateIdentity(candidate)}`
  const cached = cache.get(cacheKey)
  if (cached) return cached
  const { lootSpecId, objectives } = lootSelection(candidate, challengeMapId)
  const tierCounts = emptyTierCounts()
  let weightedScore = 0
  for (const objective of objectives) {
    weightedScore += keystoneLootTierWeight(objective.tier)
    incrementTier(tierCounts, objective.tier)
  }
  const evaluation = {
    assignment: assignmentFor(candidate, lootSpecId, objectives),
    weightedScore,
    hasObjectives: objectives.length > 0,
    totalObjectives: objectives.length,
    tierCounts,
  }
  cache.set(cacheKey, evaluation)
  return evaluation
}

function buildRecommendations(
  stone: PlannerStone,
  selected: readonly NormalizedCandidate[],
  roleCounts: Readonly<RoleCounts>,
  input: KeystonePlannerInput,
  modernCompletionCache: ModernCompletionCache,
  candidateLootCache: CandidateLootCache,
): UnrankedRecommendation[] {
  const ordered = [...selected].sort(compareCandidates)
  const tierCounts = emptyTierCounts()
  let weightedScore = 0
  let playersWithObjectives = 0
  let totalObjectives = 0
  const assignments = ordered.map(candidate => {
    const evaluation = evaluateCandidateLoot(candidate, stone.challengeMapId, candidateLootCache)
    if (evaluation.hasObjectives) playersWithObjectives += 1
    totalObjectives += evaluation.totalObjectives
    weightedScore += evaluation.weightedScore
    tierCounts.bestInSlot += evaluation.tierCounts.bestInSlot
    tierCounts.mustHave += evaluation.tierCounts.mustHave
    tierCounts.niceToHave += evaluation.tierCounts.niceToHave
    tierCounts.catalyst += evaluation.tierCounts.catalyst
    tierCounts.transmog += evaluation.tierCounts.transmog
    return evaluation.assignment
  })
  const composition = compositionSummary(ordered)
  const roles = vacancyRoles(roleCounts)
  const modernOptions = isModernOptions(input.options) ? input.options : null
  const fillComposition = shouldFillComposition(input.options)
  const displayedRoles = modernOptions && !fillComposition ? [] : roles
  const legacyVacancies = modernOptions ? null : vacanciesFor(roleCounts, composition, input.options, ordered)
  const scoringOptions = modernOptions ? vacancyScoringOptions(modernOptions) : null
  const completionCacheKey = modernOptions ? JSON.stringify([
    stone.challengeMapId,
    displayedRoles,
    ordered.map(candidate => candidate.specId).sort((left, right) => left - right),
  ]) : ''
  let cachedCompletions = completionCacheKey ? modernCompletionCache.get(completionCacheKey) : undefined
  if (modernOptions && !cachedCompletions) {
    const existingSpecIds = ordered.map(candidate => candidate.specId)
    if (!fillComposition) {
      const offensive = scoringOptions!.offensiveSynergy
        ? scoreAdvancedOffensive([], existingSpecIds)
        : scoreAdvancedOffensive([], [])
      cachedCompletions = [{
        selections: [],
        bloodlust: scoringOptions!.bloodlust ? AVAILABILITY_RANK[composition.bloodlust] : 0,
        battleRez: scoringOptions!.battleRez ? AVAILABILITY_RANK[composition.battleRez] : 0,
        offensive,
        offensiveBand: 0,
        defense: scoringOptions!.mode === 'advanced' && scoringOptions!.groupDefense
          ? scoreGroupDefense([], existingSpecIds)
          : scoreGroupDefense([], []),
        defenseBand: 0,
        dungeonUtility: scoringOptions!.mode === 'advanced' && scoringOptions!.dungeonUtility
          ? scoreDungeonUtility([], existingSpecIds, stone.challengeMapId)
          : scoreDungeonUtility([], [], stone.challengeMapId),
        dungeonUtilityBand: 0,
        stableKey: 'selected-party-only',
      }]
    } else {
      const seenStrata = new Set<string>()
      cachedCompletions = rankVacancyCompletions(
        existingSpecIds, roles, stone.challengeMapId, scoringOptions!,
      ).filter(completion => {
        const key = completionStratumKey(completion, modernOptions)
        if (seenStrata.has(key)) return false
        seenStrata.add(key)
        return true
      }).slice(0, 5)
    }
    modernCompletionCache.set(completionCacheKey, cachedCompletions)
  }
  const modernCompletions = (cachedCompletions ?? []).map(completion => ({ ...completion }))
  const preferenceSummary = {
    preferred: ordered.filter(candidate => candidate.playPreference === 'preferred').length,
    available: ordered.filter(candidate => candidate.playPreference === 'available').length,
    emergency: ordered.filter(candidate => candidate.playPreference === 'emergency').length,
  }
  const levelDistance = Math.abs(stone.level - input.targetLevel)
  const completions: Array<RankedVacancyCompletion | null> = modernOptions
    ? modernCompletions
    : [null]
  return completions.map(completion => {
    const vacancies = completion
      ? displayedRoles.map(role => ({ role, preferredCapabilities: [] as CapabilityId[] }))
      : legacyVacancies!.vacancies
    const reasonCodes: PlannerReasonCode[] = [
      roles.length === 0 ? 'PARTY_COMPLETE' : 'PARTY_INCOMPLETE',
      totalObjectives > 0 ? 'HAS_LOOT_OBJECTIVES' : 'NO_LOOT_OBJECTIVES',
      levelDistance === 0 ? 'TARGET_LEVEL_EXACT' : 'TARGET_LEVEL_NEARBY',
    ]
    if (input.options.bloodlust) {
      const availability = completion
        ? completion.bloodlust === 2 ? 'guaranteed' : completion.bloodlust === 1 ? 'conditional' : 'none'
        : composition.bloodlust
      reasonCodes.push(availability === 'guaranteed'
        ? 'BLOODLUST_GUARANTEED'
        : availability === 'conditional'
          ? 'BLOODLUST_CONDITIONAL'
          : 'BLOODLUST_MISSING')
    }
    if (input.options.battleRez) {
      const present = completion ? completion.battleRez > 0 : composition.battleRez !== 'none'
      reasonCodes.push(present ? 'BATTLE_REZ_PRESENT' : 'BATTLE_REZ_MISSING')
    }
    return {
      fingerprint: recommendationFingerprint(
        stone,
        assignments,
        completion && modernOptions ? completionStratumKey(completion, modernOptions) : completion?.stableKey,
      ),
      stone: { ...stone },
      assignments,
      vacancies,
      lootSummary: { weightedScore, playersWithObjectives, totalObjectives, tierCounts },
      levelSummary: { targetLevel: input.targetLevel, stoneLevel: stone.level, levelDistance },
      preferenceSummary,
      compositionSummary: composition,
      externalCompletionScore: legacyVacancies?.bestScore ?? { ...EMPTY_EXTERNAL_SCORE },
      modernCompletion: completion,
      reasonCodes,
    }
  })
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
  modernCompletionCache: ModernCompletionCache,
  candidateLootCache: CandidateLootCache,
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
      results.push(...buildRecommendations(
        stone, selected, roleCounts, input, modernCompletionCache, candidateLootCache,
      ))
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
    const lootSpecIds = [
      candidate.primaryLootSpecId ?? candidate.lootSpecId,
      ...(candidate.secondaryLootSpecIds ?? []),
    ]
    if (!specialization || lootSpecIds.some(specId => {
      const loot = wowSpecialization(specId)
      return !loot || loot.wowClass !== specialization.wowClass
    })) continue
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
  const modernCompletionCache: ModernCompletionCache = new Map()
  const candidateLootCache: CandidateLootCache = new Map()
  const all = orderedStones.flatMap(stone => searchStone(
    stone,
    orderedParticipants,
    candidatesByUser,
    input,
    modernCompletionCache,
    candidateLootCache,
  ))
  assignModernEquivalenceBands(all, input.options)
  all.sort((left, right) => compareRecommendations(left, right, input.options))
  const seen = new Set<string>()
  const seenDiversityProfiles = new Set<string>()
  const top = all.filter(recommendation => {
    if (seen.has(recommendation.fingerprint)) return false
    seen.add(recommendation.fingerprint)
    const diversityIdentity = recommendationDiversityIdentity(recommendation, input.options)
    if (seenDiversityProfiles.has(diversityIdentity)) return false
    seenDiversityProfiles.add(diversityIdentity)
    return true
  }).slice(0, 5).map((recommendation, index) => {
    const {
      externalCompletionScore: _externalCompletionScore,
      modernCompletion: _modernCompletion,
      ...publicRecommendation
    } = recommendation
    const vacancies = _modernCompletion && isModernOptions(input.options)
      ? modernVacancies(
        publicRecommendation.vacancies.map(vacancy => vacancy.role),
        _modernCompletion,
        publicRecommendation.assignments.map(assignment => assignment.specId),
        publicRecommendation.stone.challengeMapId,
        input.options,
      )
      : publicRecommendation.vacancies
    const modernOptions = isModernOptions(input.options) ? input.options : null
    const finalSpecIds = [
      ...publicRecommendation.assignments.map(assignment => assignment.specId),
      ...(_modernCompletion?.selections.flatMap(selection => selection.specId ? [selection.specId] : []) ?? []),
    ]
    const groupDefensives = modernOptions?.recommendationMode === 'advanced'
      && modernOptions.optimizeComposition && modernOptions.groupDefense
      ? publicScoredUtilities(scoreGroupDefense([], finalSpecIds).capabilities) : undefined
    const dungeonUtilities = modernOptions?.recommendationMode === 'advanced'
      && modernOptions.optimizeComposition && modernOptions.dungeonUtility
      ? publicScoredUtilities(scoreDungeonUtility([], finalSpecIds, publicRecommendation.stone.challengeMapId).capabilities)
      : undefined
    return {
      ...publicRecommendation,
      vacancies,
      compositionSummary: {
        ...publicRecommendation.compositionSummary,
        ...(groupDefensives ? { groupDefensives } : {}),
        ...(dungeonUtilities ? { dungeonUtilities } : {}),
      },
      rank: index + 1,
    }
  })

  if (top.length === 0) {
    diagnostics.codes.push('NO_VALID_COMPOSITION')
    return diagnosticResult('no_valid_composition', diagnostics)
  }
  return { status: 'ok', diagnostics, recommendations: top }
}
