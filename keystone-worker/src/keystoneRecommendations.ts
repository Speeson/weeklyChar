import type { SupportedKeystoneLootSnapshot } from './keystoneLoot'

export const TIER_WEIGHTS: Record<number, number> = {
  1: 25,
  2: 60,
  3: 100,
  4: 5,
  5: 15,
}

export type RecommendationSummary = {
  bis: number
  must: number
  nice: number
  catalyst: number
  transmog: number
  totalPending: number
  voidcoreExcluded: number
}

export type RecommendationCharacter = {
  id: number
  name: string
  realm: string
  region: string
  wowClass: string | null
  avatarUrl: string | null
  ilvl: number | null
  rioScore: number | null
  keystoneLoot: SupportedKeystoneLootSnapshot
}

export type KeystoneLootRecommendation = {
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

type ItemScore = {
  tier: number
  weight: number
}

type SpecAccumulator = {
  items: Map<number, ItemScore>
  voidcoreExcluded: Set<number>
}

function emptySummary(voidcoreExcluded: number): RecommendationSummary {
  return {
    bis: 0,
    must: 0,
    nice: 0,
    catalyst: 0,
    transmog: 0,
    totalPending: 0,
    voidcoreExcluded,
  }
}

function incrementTier(summary: RecommendationSummary, tier: number): void {
  if (tier === 3) summary.bis += 1
  else if (tier === 2) summary.must += 1
  else if (tier === 1) summary.nice += 1
  else if (tier === 5) summary.catalyst += 1
  else if (tier === 4) summary.transmog += 1
}

function compareDescending(left: number, right: number): number {
  if (left === right) return 0
  return left > right ? -1 : 1
}

function compareAscendingString(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function sortableNumber(value: number | null): number {
  return typeof value === 'number' ? value : Number.NEGATIVE_INFINITY
}

export function compareRecommendationCandidates(
  left: KeystoneLootRecommendation,
  right: KeystoneLootRecommendation,
): number {
  const numericComparisons = [
    compareDescending(left.score, right.score),
    compareDescending(left.summary.bis, right.summary.bis),
    compareDescending(left.summary.must, right.summary.must),
    compareDescending(left.summary.nice, right.summary.nice),
    compareDescending(left.summary.catalyst, right.summary.catalyst),
    compareDescending(left.summary.transmog, right.summary.transmog),
    compareDescending(sortableNumber(left.ilvl), sortableNumber(right.ilvl)),
    compareDescending(sortableNumber(left.rioScore), sortableNumber(right.rioScore)),
  ]
  for (const comparison of numericComparisons) {
    if (comparison !== 0) return comparison
  }

  const characterComparison = compareAscendingString(left.character, right.character)
  if (characterComparison !== 0) return characterComparison
  const realmComparison = compareAscendingString(left.realm, right.realm)
  if (realmComparison !== 0) return realmComparison
  return left.specId - right.specId
}

function candidatesForCharacter(
  character: RecommendationCharacter,
  challengeMapId: number,
): KeystoneLootRecommendation[] {
  const snapshot = character.keystoneLoot
  const usedItems = snapshot.voidcore.checked
    ? new Set(snapshot.voidcore.usedItems)
    : new Set<number>()
  const specs = new Map<number, SpecAccumulator>()

  for (const favorite of snapshot.favorites) {
    if (typeof favorite.sourceId !== 'number' || favorite.sourceId !== challengeMapId) continue
    if (favorite.sourceType !== 'dungeon') continue

    let accumulator = specs.get(favorite.specId)
    if (!accumulator) {
      accumulator = { items: new Map(), voidcoreExcluded: new Set() }
      specs.set(favorite.specId, accumulator)
    }

    if (usedItems.has(favorite.itemId)) {
      accumulator.voidcoreExcluded.add(favorite.itemId)
      accumulator.items.delete(favorite.itemId)
      continue
    }

    const weight = TIER_WEIGHTS[favorite.tier] ?? 0
    const existing = accumulator.items.get(favorite.itemId)
    if (!existing || weight > existing.weight) {
      accumulator.items.set(favorite.itemId, { tier: favorite.tier, weight })
    }
  }

  const candidates: KeystoneLootRecommendation[] = []
  for (const [specId, accumulator] of specs) {
    const summary = emptySummary(accumulator.voidcoreExcluded.size)
    let score = 0
    for (const item of accumulator.items.values()) {
      if (item.weight <= 0) continue
      score += item.weight
      summary.totalPending += 1
      incrementTier(summary, item.tier)
    }
    if (score <= 0) continue

    candidates.push({
      characterId: character.id,
      character: character.name,
      realm: character.realm,
      region: character.region,
      wowClass: character.wowClass,
      avatarUrl: character.avatarUrl,
      ilvl: character.ilvl,
      rioScore: character.rioScore,
      specId,
      score,
      summary,
    })
  }
  return candidates
}

export function recommendKeystoneLootTarget(
  characters: RecommendationCharacter[],
  challengeMapId: number,
): KeystoneLootRecommendation | null {
  const candidates = characters.flatMap(character => candidatesForCharacter(character, challengeMapId))
  candidates.sort(compareRecommendationCandidates)
  return candidates[0] ?? null
}
