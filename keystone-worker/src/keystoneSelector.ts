import { buildKeystoneLootObjectivePage } from './keystoneObjectives'
import type { KeystoneLootObjectiveDTO, KeystoneLootVoidcoreState } from './keystoneObjectives'
import { keystoneLootTierWeight } from './keystoneRecommendations'

export type KeystoneLootSelectorTierCounts = {
  bestInSlot: number
  mustHave: number
  niceToHave: number
  catalyst: number
  transmog: number
  other: number
}

export type KeystoneLootSelectorObjectiveDTO = {
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
  primaryStatNames: string[]
  secondaryStatNames: string[]
  otherStatNames: string[]
  qualityType: string | null
  itemLevel: number | null
  variantKey: string
  voidcoreState: KeystoneLootVoidcoreState
}

export type KeystoneLootSelectorCharacterSource = {
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
  keystoneLoot: unknown
}

export type KeystoneLootSelectorStoneDTO = {
  characterId: number
  characterName: string
  ownerUserId: number
  ownerUsername: string
  level: number
}

export type KeystoneLootSelectorAvailability = {
  stoneCount: number
  stones: KeystoneLootSelectorStoneDTO[]
}

export type KeystoneLootSelectorCharacterDTO = Omit<KeystoneLootSelectorCharacterSource, 'keystoneLoot'> & {
  totalObjectives: number
  tierCounts: KeystoneLootSelectorTierCounts
  specs: Array<{
    specId: number
    objectiveCount: number
    tierCounts: KeystoneLootSelectorTierCounts
  }>
  objectives: KeystoneLootSelectorObjectiveDTO[]
}

export type KeystoneLootDungeonSummaryDTO = {
  teamId: number
  challengeMapId: number
  availability: KeystoneLootSelectorAvailability
  summary: {
    charactersWithObjectives: number
    totalObjectives: number
    tiers: KeystoneLootSelectorTierCounts
  }
  characters: KeystoneLootSelectorCharacterDTO[]
}

function emptyTierCounts(): KeystoneLootSelectorTierCounts {
  return {
    bestInSlot: 0,
    mustHave: 0,
    niceToHave: 0,
    catalyst: 0,
    transmog: 0,
    other: 0,
  }
}

function incrementTier(counts: KeystoneLootSelectorTierCounts, tier: number): void {
  if (tier === 3) counts.bestInSlot += 1
  else if (tier === 2) counts.mustHave += 1
  else if (tier === 1) counts.niceToHave += 1
  else if (tier === 5) counts.catalyst += 1
  else if (tier === 4) counts.transmog += 1
  else counts.other += 1
}

function addTierCounts(
  destination: KeystoneLootSelectorTierCounts,
  source: KeystoneLootSelectorTierCounts,
): void {
  destination.bestInSlot += source.bestInSlot
  destination.mustHave += source.mustHave
  destination.niceToHave += source.niceToHave
  destination.catalyst += source.catalyst
  destination.transmog += source.transmog
  destination.other += source.other
}

function sourceKey(sourceId: number | string): string {
  return `${typeof sourceId}:${String(sourceId)}`
}

function canonicalIdentity(objective: KeystoneLootObjectiveDTO): string {
  return `${objective.sourceType}\u0000${sourceKey(objective.sourceId)}\u0000${objective.itemId}\u0000${objective.variantKey}`
}

function strongerObjective(
  candidate: KeystoneLootObjectiveDTO,
  selected: KeystoneLootObjectiveDTO,
): boolean {
  const candidateWeight = keystoneLootTierWeight(candidate.tier)
  const selectedWeight = keystoneLootTierWeight(selected.tier)
  if (candidateWeight !== selectedWeight) return candidateWeight > selectedWeight
  if (candidate.tier !== selected.tier) return candidate.tier > selected.tier
  return (candidate.slotId ?? Number.NEGATIVE_INFINITY) > (selected.slotId ?? Number.NEGATIVE_INFINITY)
}

function selectorObjective(
  selected: KeystoneLootObjectiveDTO,
  specIds: Set<number>,
): KeystoneLootSelectorObjectiveDTO {
  return {
    itemId: selected.itemId,
    itemName: selected.itemName,
    iconUrl: selected.iconUrl,
    tier: selected.tier,
    specIds: [...specIds].sort((left, right) => left - right),
    sourceType: selected.sourceType,
    sourceId: selected.sourceId,
    slotId: selected.slotId,
    slotName: selected.slotName,
    itemClassName: selected.itemClassName,
    itemSubClassName: selected.itemSubClassName,
    statNames: selected.statNames,
    primaryStatNames: selected.primaryStatNames,
    secondaryStatNames: selected.secondaryStatNames,
    otherStatNames: selected.otherStatNames,
    qualityType: selected.qualityType,
    itemLevel: selected.itemLevel,
    variantKey: selected.variantKey,
    voidcoreState: selected.voidcoreState,
  }
}

function buildCharacter(
  source: KeystoneLootSelectorCharacterSource,
  challengeMapId: number,
): KeystoneLootSelectorCharacterDTO | null {
  const page = buildKeystoneLootObjectivePage(source.keystoneLoot, {
    challengeMapId,
    limit: 2000,
  })
  if (page.status !== 'available') return null

  const selected = new Map<string, { objective: KeystoneLootObjectiveDTO, specIds: Set<number> }>()
  const specs = new Map<number, { objectiveCount: number, tierCounts: KeystoneLootSelectorTierCounts }>()
  for (const objective of page.objectives) {
    const identity = canonicalIdentity(objective)
    const existing = selected.get(identity)
    if (!existing) {
      selected.set(identity, { objective, specIds: new Set([objective.specId]) })
    } else {
      existing.specIds.add(objective.specId)
      if (strongerObjective(objective, existing.objective)) existing.objective = objective
    }

    if (objective.voidcoreState === 'completed_with_voidcore') continue
    const spec = specs.get(objective.specId) ?? { objectiveCount: 0, tierCounts: emptyTierCounts() }
    spec.objectiveCount += 1
    incrementTier(spec.tierCounts, objective.tier)
    specs.set(objective.specId, spec)
  }

  const objectives = [...selected.values()]
    .map(entry => selectorObjective(entry.objective, entry.specIds))
    .sort((left, right) => left.itemId - right.itemId
      || left.sourceType.localeCompare(right.sourceType)
      || sourceKey(left.sourceId).localeCompare(sourceKey(right.sourceId))
      || left.variantKey.localeCompare(right.variantKey))
  const actionable = objectives.filter(objective => objective.voidcoreState !== 'completed_with_voidcore')
  if (actionable.length === 0) return null

  const tierCounts = emptyTierCounts()
  for (const objective of actionable) incrementTier(tierCounts, objective.tier)

  return {
    userId: source.userId,
    username: source.username,
    characterId: source.characterId,
    characterName: source.characterName,
    realm: source.realm,
    region: source.region,
    wowClass: source.wowClass,
    avatarUrl: source.avatarUrl,
    ilvl: source.ilvl,
    rioScore: source.rioScore,
    totalObjectives: actionable.length,
    tierCounts,
    specs: [...specs.entries()]
      .sort(([left], [right]) => left - right)
      .map(([specId, spec]) => ({ specId, ...spec })),
    objectives,
  }
}

function compareCharacters(
  left: KeystoneLootSelectorCharacterDTO,
  right: KeystoneLootSelectorCharacterDTO,
): number {
  return (right.totalObjectives - left.totalObjectives)
    || (right.tierCounts.bestInSlot - left.tierCounts.bestInSlot)
    || (right.tierCounts.mustHave - left.tierCounts.mustHave)
    || left.characterName.localeCompare(right.characterName)
    || left.realm.localeCompare(right.realm)
    || (left.characterId - right.characterId)
}

export function buildKeystoneLootDungeonSummary(
  teamId: number,
  challengeMapId: number,
  availability: KeystoneLootSelectorAvailability,
  sources: KeystoneLootSelectorCharacterSource[],
): KeystoneLootDungeonSummaryDTO {
  const characters = sources
    .map(source => buildCharacter(source, challengeMapId))
    .filter((character): character is KeystoneLootSelectorCharacterDTO => character !== null)
    .sort(compareCharacters)
  const tiers = emptyTierCounts()
  let totalObjectives = 0
  for (const character of characters) {
    totalObjectives += character.totalObjectives
    addTierCounts(tiers, character.tierCounts)
  }

  return {
    teamId,
    challengeMapId,
    availability,
    summary: {
      charactersWithObjectives: characters.length,
      totalObjectives,
      tiers,
    },
    characters,
  }
}
