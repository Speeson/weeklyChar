import {
  OFFENSIVE_PROVIDER_BY_CLASS,
  dungeonRelevance,
  offensiveProfileForSpec,
  utilityEntriesForSpec,
} from './plannerRankingData'
import type { OffensiveBuffId, PlannerDataProvenance, UtilityLayer, UtilityTier } from './plannerRankingData'
import { WOW_SPECIALIZATIONS, capabilitiesForSpec, wowSpecialization } from './wowComposition'
import type { CapabilityAvailability } from './keystonePlanner'
import type { WowClassName, WowRole } from './wowComposition'

export type OffensiveInteraction = {
  recipientSpecId: number
  buffId: OffensiveBuffId
  gainPct: number
  provider: 'existing' | 'candidate'
  source: PlannerDataProvenance['source']
  confidence: PlannerDataProvenance['confidence']
}

export type OffensiveScore = {
  gainPct: number
  recipients: Array<{ specId: number, gainPct: number }>
  interactions: OffensiveInteraction[]
  reasons: string[]
  provenance: Array<{ specId: number } & PlannerDataProvenance>
}

export type TierVector = Record<UtilityTier, number>
export type ScoredUtilityCapability = {
  abilityKey: string
  capabilityId: string
  name: string
  spellId: number
  availability: 'guaranteed' | 'conditional'
  tier: UtilityTier
  relevance: number
  score: number
}
export type UtilityScore = {
  tiers: TierVector
  reasons: string[]
  capabilities: ScoredUtilityCapability[]
}
export type ModernRecommendationMode = 'quick' | 'advanced'
export type VacancyScoringOptions = {
  mode: ModernRecommendationMode
  bloodlust: boolean
  battleRez: boolean
  offensiveSynergy: boolean
  groupDefense: boolean
  dungeonUtility: boolean
}
export type VacancySelection = {
  role: WowRole
  wowClass: WowClassName
  specId?: number
  specName?: string
}
export type RankedVacancyCompletion = {
  selections: VacancySelection[]
  bloodlust: number
  battleRez: number
  offensive: OffensiveScore
  offensiveBand: number
  defense: UtilityScore
  defenseBand: number
  dungeonUtility: UtilityScore
  dungeonUtilityBand: number
  stableKey: string
}

const EMPTY_OFFENSIVE_SCORE: Readonly<OffensiveScore> = {
  gainPct: 0, recipients: [], interactions: [], reasons: [], provenance: [],
}
const EMPTY_TIERS: Readonly<TierVector> = { S: 0, A: 0, B: 0, C: 0 }
const AVAILABILITY_RANK: Readonly<Record<CapabilityAvailability, number>> = {
  none: 0, conditional: 1, guaranteed: 2,
}
const DIMINISHING_FACTORS = [1, 0.5, 0.25, 0.125] as const
const TIER_ORDER: readonly UtilityTier[] = ['S', 'A', 'B', 'C']

function emptyOffensiveScore(): OffensiveScore {
  return { gainPct: 0, recipients: [], interactions: [], reasons: [], provenance: [] }
}

function emptyUtilityScore(): UtilityScore {
  return { tiers: { ...EMPTY_TIERS }, reasons: [], capabilities: [] }
}

function providerBuff(wowClass: WowClassName): OffensiveBuffId | null {
  return OFFENSIVE_PROVIDER_BY_CLASS.get(wowClass) ?? null
}

function provenanceFor(specIds: readonly number[]): Array<{ specId: number } & PlannerDataProvenance> {
  return [...new Set(specIds)].sort((left, right) => left - right).flatMap(specId => {
    const profile = offensiveProfileForSpec(specId)
    return profile ? [{ specId, ...profile.provenance }] : []
  })
}

function combinedGain(gains: readonly number[]): number {
  return gains.reduce((product, gain) => product * (1 + gain), 1) - 1
}

function reasonsFor(interactions: readonly OffensiveInteraction[], recipients: number): string[] {
  const grouped = new Map<OffensiveBuffId, number[]>()
  for (const interaction of interactions) {
    const gains = grouped.get(interaction.buffId) ?? []
    gains.push(interaction.gainPct)
    grouped.set(interaction.buffId, gains)
  }
  return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([buff, gains]) => {
    const average = recipients === 0 ? 0 : gains.reduce((sum, gain) => sum + gain, 0) / recipients
    return `${buff}: +${(average * 100).toFixed(2)}% estimated normalized uplift`
  })
}

export function scoreQuickOffensive(
  existingSpecIds: readonly number[],
  candidateClasses: readonly WowClassName[],
): OffensiveScore {
  const existing = existingSpecIds.flatMap(specId => {
    const spec = wowSpecialization(specId)
    return spec ? [{ specId, spec }] : []
  })
  const recipients = existing.filter(member => member.spec.role === 'dps')
  if (recipients.length === 0) return emptyOffensiveScore()
  const existingBuffs = new Set(existing.flatMap(member => {
    const buff = providerBuff(member.spec.wowClass)
    return buff ? [buff] : []
  }))
  const candidateBuffs = [...new Set(candidateClasses.flatMap(wowClass => {
    const buff = providerBuff(wowClass)
    return buff && !existingBuffs.has(buff) ? [buff] : []
  }))].sort()
  const interactions: OffensiveInteraction[] = []
  const recipientScores = recipients.map(recipient => {
    const profile = offensiveProfileForSpec(recipient.specId)
    const gains = candidateBuffs.map(buffId => {
      const gainPct = profile?.gains[buffId] ?? 0
      interactions.push({
        recipientSpecId: recipient.specId,
        buffId,
        gainPct,
        provider: 'candidate',
        source: profile?.provenance.source ?? 'archetype_estimate',
        confidence: profile?.provenance.confidence ?? 'low',
      })
      return gainPct
    })
    return { specId: recipient.specId, gainPct: combinedGain(gains) }
  })
  return {
    gainPct: recipientScores.reduce((sum, recipient) => sum + recipient.gainPct, 0) / recipients.length,
    recipients: recipientScores,
    interactions,
    reasons: reasonsFor(interactions, recipients.length),
    provenance: provenanceFor(recipients.map(recipient => recipient.specId)),
  }
}

export function scoreQuickCompletionOffensive(
  existingSpecIds: readonly number[],
  selections: readonly VacancySelection[],
): OffensiveScore {
  const existing = existingSpecIds.flatMap(specId => {
    const spec = wowSpecialization(specId)
    return spec ? [{ specId, spec }] : []
  })
  const candidates = selections.flatMap((selection, index) => {
    if (selection.role !== 'dps') return []
    const specs = WOW_SPECIALIZATIONS.filter(spec => spec.role === 'dps' && spec.wowClass === selection.wowClass)
    return specs.length > 0 ? [{ index, specs }] : []
  })
  const existingRecipients = existing.filter(member => member.spec.role === 'dps')
  const recipientCount = existingRecipients.length + candidates.length
  if (recipientCount === 0) return emptyOffensiveScore()

  const existingBuffs = new Set(existing.flatMap(member => {
    const buff = providerBuff(member.spec.wowClass)
    return buff ? [buff] : []
  }))
  const candidateBuffProviders = new Map<OffensiveBuffId, number[]>()
  selections.forEach((selection, index) => {
    const buff = providerBuff(selection.wowClass)
    if (buff) candidateBuffProviders.set(buff, [...(candidateBuffProviders.get(buff) ?? []), index])
  })

  const interactions: OffensiveInteraction[] = []
  const recipients: Array<{ specId: number, gainPct: number }> = []
  for (const recipient of existingRecipients) {
    const profile = offensiveProfileForSpec(recipient.specId)
    const gains: number[] = []
    for (const [buffId, providers] of candidateBuffProviders) {
      if (existingBuffs.has(buffId) || providers.length === 0) continue
      const gainPct = profile?.gains[buffId] ?? 0
      gains.push(gainPct)
      interactions.push({
        recipientSpecId: recipient.specId,
        buffId,
        gainPct,
        provider: 'candidate',
        source: profile?.provenance.source ?? 'archetype_estimate',
        confidence: profile?.provenance.confidence ?? 'low',
      })
    }
    recipients.push({ specId: recipient.specId, gainPct: combinedGain(gains) })
  }

  for (const recipient of candidates) {
    const representative = recipient.specs[0]
    const profiles = recipient.specs.flatMap(spec => {
      const profile = offensiveProfileForSpec(spec.id)
      return profile ? [profile] : []
    })
    const gains: number[] = []
    for (const buffId of OFFENSIVE_PROVIDER_BY_CLASS.values()) {
      const candidateProviders = candidateBuffProviders.get(buffId) ?? []
      const provider = existingBuffs.has(buffId)
        ? 'existing' : candidateProviders.some(index => index !== recipient.index) ? 'candidate' : null
      if (!provider) continue
      const gainPct = profiles.length === 0 ? 0
        : profiles.reduce((sum, profile) => sum + profile.gains[buffId], 0) / profiles.length
      gains.push(gainPct)
      interactions.push({
        recipientSpecId: representative.id,
        buffId,
        gainPct,
        provider,
        source: profiles.every(profile => profile.provenance.source === 'simc') ? 'simc' : 'archetype_estimate',
        confidence: profiles.some(profile => profile.provenance.confidence === 'low') ? 'low'
          : profiles.some(profile => profile.provenance.confidence === 'medium') ? 'medium' : 'high',
      })
    }
    recipients.push({ specId: representative.id, gainPct: combinedGain(gains) })
  }

  const provenanceSpecIds = [
    ...existingRecipients.map(recipient => recipient.specId),
    ...candidates.flatMap(recipient => recipient.specs.map(spec => spec.id)),
  ]
  return {
    gainPct: recipients.reduce((sum, recipient) => sum + recipient.gainPct, 0) / recipientCount,
    recipients,
    interactions,
    reasons: reasonsFor(interactions, recipientCount),
    provenance: provenanceFor(provenanceSpecIds),
  }
}

export function scoreAdvancedOffensive(
  existingSpecIds: readonly number[],
  candidateSpecIds: readonly number[],
): OffensiveScore {
  const existing = existingSpecIds.flatMap((specId, index) => {
    const spec = wowSpecialization(specId)
    return spec ? [{ specId, spec, external: false, index }] : []
  })
  const candidates = candidateSpecIds.flatMap((specId, index) => {
    const spec = wowSpecialization(specId)
    return spec ? [{ specId, spec, external: true, index }] : []
  })
  const recipients = [...existing, ...candidates].filter(member => member.spec.role === 'dps')
  if (recipients.length === 0) return emptyOffensiveScore()
  const existingBuffProviders = new Map<OffensiveBuffId, number[]>()
  for (const member of existing) {
    const buff = providerBuff(member.spec.wowClass)
    if (buff) existingBuffProviders.set(buff, [...(existingBuffProviders.get(buff) ?? []), member.index])
  }
  const candidateBuffProviders = new Map<OffensiveBuffId, number[]>()
  for (const member of candidates) {
    const buff = providerBuff(member.spec.wowClass)
    if (buff) candidateBuffProviders.set(buff, [...(candidateBuffProviders.get(buff) ?? []), member.index])
  }
  const interactions: OffensiveInteraction[] = []
  const recipientScores = recipients.map(recipient => {
    const profile = offensiveProfileForSpec(recipient.specId)
    const gains: number[] = []
    for (const buffId of OFFENSIVE_PROVIDER_BY_CLASS.values()) {
      const existingProviders = existingBuffProviders.get(buffId) ?? []
      const candidateProviders = candidateBuffProviders.get(buffId) ?? []
      const provider = recipient.external
        ? existingProviders.length > 0 ? 'existing'
          : candidateProviders.some(index => index !== recipient.index) ? 'candidate' : null
        : existingProviders.length === 0 && candidateProviders.length > 0 ? 'candidate' : null
      if (!provider) continue
      const gainPct = profile?.gains[buffId] ?? 0
      gains.push(gainPct)
      interactions.push({
        recipientSpecId: recipient.specId,
        buffId,
        gainPct,
        provider,
        source: profile?.provenance.source ?? 'archetype_estimate',
        confidence: profile?.provenance.confidence ?? 'low',
      })
    }
    return { specId: recipient.specId, gainPct: combinedGain(gains) }
  })
  return {
    gainPct: recipientScores.reduce((sum, recipient) => sum + recipient.gainPct, 0) / recipients.length,
    recipients: recipientScores,
    interactions,
    reasons: reasonsFor(interactions, recipients.length),
    provenance: provenanceFor(recipients.map(recipient => recipient.specId)),
  }
}

export function assignOffensiveBands(gains: readonly number[]): number[] {
  const indexed = gains.map((gain, index) => ({ gain, index }))
    .sort((left, right) => (right.gain - left.gain) || (left.index - right.index))
  const bands = new Array<number>(gains.length)
  let band = 0
  let cursor = 0
  while (cursor < indexed.length) {
    const leader = indexed[cursor].gain
    const floor = leader - Math.max(0.005, leader * 0.25)
    while (cursor < indexed.length && indexed[cursor].gain >= floor) {
      bands[indexed[cursor].index] = band
      cursor += 1
    }
    band += 1
  }
  return bands
}

function tierVectorWithinBand(candidate: TierVector, leader: TierVector): boolean {
  for (const tier of TIER_ORDER) {
    if (candidate[tier] === leader[tier]) continue
    const window = Math.max(250, leader[tier] * 0.25)
    return candidate[tier] >= leader[tier] - window
  }
  return true
}

export function assignTierVectorBands(vectors: readonly TierVector[]): number[] {
  const indexed = vectors.map((vector, index) => ({ vector, index }))
    .sort((left, right) => compareTierVectors(left.vector, right.vector) || left.index - right.index)
  const bands = new Array<number>(vectors.length)
  let band = 0
  let cursor = 0
  while (cursor < indexed.length) {
    const leader = indexed[cursor].vector
    do {
      bands[indexed[cursor].index] = band
      cursor += 1
    } while (cursor < indexed.length && tierVectorWithinBand(indexed[cursor].vector, leader))
    band += 1
  }
  return bands
}

type UtilitySource = ReturnType<typeof utilityEntriesForSpec>[number] & { memberIndex: number }

function utilitySources(specIds: readonly number[]): UtilitySource[] {
  return specIds.flatMap((specId, memberIndex) => utilityEntriesForSpec(specId)
    .map(entry => ({ ...entry, memberIndex })))
}

function scoreUtility(
  existingSpecIds: readonly number[],
  candidateSpecIds: readonly number[],
  layer: UtilityLayer | 'dungeon',
  challengeMapId: number,
): UtilityScore {
  const existing = utilitySources(existingSpecIds)
  const candidates = utilitySources(candidateSpecIds)
  const result = emptyUtilityScore()
  const capabilityIds = [...new Set(candidates.map(entry => entry.capabilityId))].sort()
  for (const capabilityId of capabilityIds) {
    const existingSources = existing.filter(entry => entry.capabilityId === capabilityId)
    const candidateSources = candidates.filter(entry => entry.capabilityId === capabilityId)
      .sort((left, right) => (right.availabilityFactor - left.availabilityFactor)
        || left.abilityKey.localeCompare(right.abilityKey) || (left.memberIndex - right.memberIndex))
    const representative = candidateSources[0]
    if (!representative || (layer !== 'dungeon' && representative.layer !== layer)) continue
    const relevance = layer === 'dungeon' ? dungeonRelevance(challengeMapId, capabilityId) : 3
    if (relevance === 0) continue
    const add = (source: UtilitySource, marginal: number) => {
      const value = Math.round(1000 * source.availabilityFactor * marginal * relevance / 3)
      if (value <= 0) return
      result.tiers[source.tier] += value
      result.reasons.push(layer === 'dungeon'
        ? `${source.abilityName}: ${capabilityId} relevance ${relevance}/3`
        : source.abilityName)
      if (source.spellId === null) return
      result.capabilities.push({
        abilityKey: source.abilityKey,
        capabilityId,
        name: source.abilityName,
        spellId: source.spellId,
        availability: source.availabilityFactor >= 1 ? 'guaranteed' : 'conditional',
        tier: source.tier,
        relevance,
        score: value,
      })
    }
    if (representative.stacking === 'best_only' || representative.stacking === 'coverage_once') {
      const existingBest = existingSources.reduce(
        (best, source) => Math.max(best, source.availabilityFactor), 0,
      )
      if (representative.availabilityFactor > existingBest) {
        add(representative, (representative.availabilityFactor - existingBest)
          / representative.availabilityFactor)
      }
      continue
    }
    let coverageIndex = existingSources.length
    for (const source of candidateSources) {
      add(source, DIMINISHING_FACTORS[Math.min(coverageIndex, DIMINISHING_FACTORS.length - 1)])
      coverageIndex += 1
    }
  }
  result.reasons = [...new Set(result.reasons)].sort()
  result.capabilities.sort((left, right) => TIER_ORDER.indexOf(left.tier) - TIER_ORDER.indexOf(right.tier)
    || right.relevance - left.relevance
    || right.score - left.score
    || left.name.localeCompare(right.name)
    || left.abilityKey.localeCompare(right.abilityKey))
  return result
}

export function scoreGroupDefense(
  existingSpecIds: readonly number[], candidateSpecIds: readonly number[],
): UtilityScore {
  return scoreUtility(existingSpecIds, candidateSpecIds, 'defensive', 0)
}

export function scoreDungeonUtility(
  existingSpecIds: readonly number[], candidateSpecIds: readonly number[], challengeMapId: number,
): UtilityScore {
  return scoreUtility(existingSpecIds, candidateSpecIds, 'dungeon', challengeMapId)
}

function compareDescending(left: number, right: number): number {
  return right - left
}

export function compareTierVectors(left: TierVector, right: TierVector): number {
  for (const tier of TIER_ORDER) {
    const comparison = compareDescending(left[tier], right[tier])
    if (comparison !== 0) return comparison
  }
  return 0
}

function capabilityAvailabilityForQuick(selection: VacancySelection, capabilityId: 'BLOODLUST' | 'BATTLE_REZ'):
CapabilityAvailability {
  const specs = WOW_SPECIALIZATIONS.filter(spec => spec.role === selection.role && spec.wowClass === selection.wowClass)
  const providers = specs.map(spec => capabilitiesForSpec(spec.id).find(capability => capability.capabilityId === capabilityId))
  if (providers.length > 0 && providers.every(provider => provider?.mode === 'guaranteed')) return 'guaranteed'
  return providers.some(Boolean) ? 'conditional' : 'none'
}

function finalCapabilityRank(
  existingSpecIds: readonly number[], selections: readonly VacancySelection[],
  capabilityId: 'BLOODLUST' | 'BATTLE_REZ', mode: ModernRecommendationMode,
): number {
  let best = 0
  for (const specId of existingSpecIds) {
    const capability = capabilitiesForSpec(specId).find(candidate => candidate.capabilityId === capabilityId)
    if (capability) best = Math.max(best, AVAILABILITY_RANK[capability.mode])
  }
  for (const selection of selections) {
    const availability = mode === 'advanced' && selection.specId
      ? capabilitiesForSpec(selection.specId).find(candidate => candidate.capabilityId === capabilityId)?.mode ?? 'none'
      : capabilityAvailabilityForQuick(selection, capabilityId)
    best = Math.max(best, AVAILABILITY_RANK[availability])
  }
  return best
}

function choicesForRole(role: WowRole, mode: ModernRecommendationMode): VacancySelection[] {
  const specs = WOW_SPECIALIZATIONS.filter(spec => spec.role === role)
  if (mode === 'advanced') return specs.map(spec => ({
    role, wowClass: spec.wowClass, specId: spec.id, specName: spec.name,
  })).sort((left, right) => left.wowClass.localeCompare(right.wowClass)
    || ((left.specId ?? 0) - (right.specId ?? 0)))
  return [...new Set(specs.map(spec => spec.wowClass))].sort().map(wowClass => ({ role, wowClass }))
}

function enumerateSelections(roles: readonly WowRole[], mode: ModernRecommendationMode): VacancySelection[][] {
  const results: VacancySelection[][] = []
  const selected: VacancySelection[] = []
  const visit = (index: number) => {
    if (index === roles.length) {
      results.push([...selected])
      return
    }
    const role = roles[index]
    const choices = choicesForRole(role, mode)
    const previousSameRole = index > 0 && roles[index - 1] === role ? selected[index - 1] : null
    const previousKey = previousSameRole
      ? `${previousSameRole.wowClass}:${previousSameRole.specId ?? 0}` : null
    for (const choice of choices) {
      const key = `${choice.wowClass}:${choice.specId ?? 0}`
      if (previousKey !== null && key.localeCompare(previousKey) < 0) continue
      selected.push(choice)
      visit(index + 1)
      selected.pop()
    }
  }
  visit(0)
  return results
}

function stableSelectionKey(selection: VacancySelection): string {
  return `${selection.role}:${selection.wowClass}${selection.specId ? `:${selection.specId}` : ''}`
}

function rankSelectionSets(
  existingSpecIds: readonly number[],
  selectionSets: readonly VacancySelection[][],
  challengeMapId: number,
  options: VacancyScoringOptions,
): RankedVacancyCompletion[] {
  const completions = selectionSets.map(selections => {
    const specIds = selections.flatMap(selection => selection.specId ? [selection.specId] : [])
    const offensive = options.offensiveSynergy
      ? options.mode === 'quick'
        ? scoreQuickCompletionOffensive(existingSpecIds, selections)
        : scoreAdvancedOffensive(existingSpecIds, specIds)
      : emptyOffensiveScore()
    return {
      selections,
      bloodlust: options.bloodlust
        ? finalCapabilityRank(existingSpecIds, selections, 'BLOODLUST', options.mode) : 0,
      battleRez: options.battleRez
        ? finalCapabilityRank(existingSpecIds, selections, 'BATTLE_REZ', options.mode) : 0,
      offensive,
      offensiveBand: 0,
      defense: options.mode === 'advanced' && options.groupDefense
        ? scoreGroupDefense(existingSpecIds, specIds) : emptyUtilityScore(),
      defenseBand: 0,
      dungeonUtility: options.mode === 'advanced' && options.dungeonUtility
        ? scoreDungeonUtility(existingSpecIds, specIds, challengeMapId) : emptyUtilityScore(),
      dungeonUtilityBand: 0,
      stableKey: selections.map(stableSelectionKey).join('|'),
    }
  })
  const groups = new Map<string, RankedVacancyCompletion[]>()
  for (const completion of completions) {
    const key = `${completion.bloodlust}:${completion.battleRez}`
    groups.set(key, [...(groups.get(key) ?? []), completion])
  }
  for (const group of groups.values()) {
    const bands = assignOffensiveBands(group.map(completion => completion.offensive.gainPct))
    group.forEach((completion, index) => { completion.offensiveBand = bands[index] })
  }
  if (options.mode === 'advanced' && options.groupDefense) {
    const defenseGroups = new Map<string, RankedVacancyCompletion[]>()
    for (const completion of completions) {
      const key = `${completion.bloodlust}:${completion.battleRez}:${completion.offensiveBand}`
      defenseGroups.set(key, [...(defenseGroups.get(key) ?? []), completion])
    }
    for (const group of defenseGroups.values()) {
      const bands = assignTierVectorBands(group.map(completion => completion.defense.tiers))
      group.forEach((completion, index) => { completion.defenseBand = bands[index] })
    }
  }
  if (options.mode === 'advanced' && options.dungeonUtility) {
    const utilityGroups = new Map<string, RankedVacancyCompletion[]>()
    for (const completion of completions) {
      const key = `${completion.bloodlust}:${completion.battleRez}:${completion.offensiveBand}:${completion.defenseBand}`
      utilityGroups.set(key, [...(utilityGroups.get(key) ?? []), completion])
    }
    for (const group of utilityGroups.values()) {
      const bands = assignTierVectorBands(group.map(completion => completion.dungeonUtility.tiers))
      group.forEach((completion, index) => { completion.dungeonUtilityBand = bands[index] })
    }
  }
  return completions.sort((left, right) => compareDescending(left.bloodlust, right.bloodlust)
    || compareDescending(left.battleRez, right.battleRez)
    || (left.offensiveBand - right.offensiveBand)
    || (options.mode === 'advanced' && options.groupDefense ? left.defenseBand - right.defenseBand : 0)
    || (options.mode === 'advanced' && options.dungeonUtility
      ? left.dungeonUtilityBand - right.dungeonUtilityBand : 0)
    || compareDescending(left.offensive.gainPct, right.offensive.gainPct)
    || left.stableKey.localeCompare(right.stableKey))
}

export function rankVacancyCompletions(
  existingSpecIds: readonly number[],
  roles: readonly WowRole[],
  challengeMapId: number,
  options: VacancyScoringOptions,
): RankedVacancyCompletion[] {
  return rankSelectionSets(existingSpecIds, enumerateSelections(roles, options.mode), challengeMapId, options)
}

export function rankVacancyAlternatives(
  existingSpecIds: readonly number[],
  otherSelections: readonly VacancySelection[],
  role: WowRole,
  challengeMapId: number,
  options: VacancyScoringOptions,
): RankedVacancyCompletion[] {
  const selectionSets = choicesForRole(role, options.mode).map(selection => [...otherSelections, selection])
  return rankSelectionSets(existingSpecIds, selectionSets, challengeMapId, options)
}
