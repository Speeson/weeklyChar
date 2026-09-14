import { PLANNER_RANKING_DATA } from './plannerRankingDataGenerated'
import { wowSpecialization } from './wowComposition'
import type { WowClassName } from './wowComposition'

export type OffensiveBuffId = typeof PLANNER_RANKING_DATA.offensiveBuffs[number]
export type PlannerDataProvenance = {
  source: 'simc' | 'archetype_estimate'
  confidence: 'high' | 'medium' | 'low'
  method?: string
  donorSpecIds?: readonly number[]
}
export type OffensiveProfile = {
  name: string
  gains: Record<OffensiveBuffId, number>
  provenance: PlannerDataProvenance
}
export type UtilityLayer = 'defensive' | 'secondary'
export type UtilityTier = 'S' | 'A' | 'B' | 'C'
export type UtilityStacking = 'best_only' | 'coverage_once' | 'diminishing'
export type UtilityEntry = {
  abilityKey: string
  abilityName: string
  spellId: number | null
  capabilityId: string
  layer: UtilityLayer
  tier: UtilityTier
  stacking: UtilityStacking
  availability: string
  availabilityFactor: number
}

export const PLANNER_RANKING_DATA_VERSION = PLANNER_RANKING_DATA.version
export const OFFENSIVE_PROVIDER_BY_CLASS = new Map<WowClassName, OffensiveBuffId>(
  PLANNER_RANKING_DATA.providerByClass as readonly (readonly [WowClassName, OffensiveBuffId])[],
)
const OFFENSIVE_PROFILE_BY_SPEC = new Map<number, OffensiveProfile | null>()
const UTILITY_ENTRIES_BY_SPEC = new Map<number, UtilityEntry[]>()

function specKey(name: string): string {
  return name.toUpperCase().replaceAll(' ', '_')
}

export function offensiveProfileForSpec(specId: number): OffensiveProfile | null {
  if (OFFENSIVE_PROFILE_BY_SPEC.has(specId)) return OFFENSIVE_PROFILE_BY_SPEC.get(specId) ?? null
  const profile = PLANNER_RANKING_DATA.offensiveProfiles[
    String(specId) as keyof typeof PLANNER_RANKING_DATA.offensiveProfiles
  ]
  const resolved = profile ? {
    name: profile.name,
    gains: { ...profile.gains },
    provenance: { ...profile.provenance } as PlannerDataProvenance,
  } : null
  OFFENSIVE_PROFILE_BY_SPEC.set(specId, resolved)
  return resolved
}

export function utilityEntriesForSpec(specId: number): UtilityEntry[] {
  const cached = UTILITY_ENTRIES_BY_SPEC.get(specId)
  if (cached) return cached
  const spec = wowSpecialization(specId)
  if (!spec) return []
  const expectedSpec = specKey(spec.name)
  const resolved = PLANNER_RANKING_DATA.utilityAbilities.flatMap(ability => {
    if (ability.wowClass !== spec.wowClass || !(ability.specs as readonly string[]).includes(expectedSpec)) return []
    return ability.capabilities.map(capabilityId => {
      const definition = PLANNER_RANKING_DATA.utilityCapabilities[
        capabilityId as keyof typeof PLANNER_RANKING_DATA.utilityCapabilities
      ]
      return {
        abilityKey: ability.key,
        abilityName: ability.name,
        spellId: ability.spellId,
        capabilityId,
        layer: definition.layer,
        tier: definition.tier,
        stacking: definition.stacking,
        availability: ability.availability,
        availabilityFactor: ability.availabilityFactor / 1000,
      }
    })
  }) as UtilityEntry[]
  UTILITY_ENTRIES_BY_SPEC.set(specId, resolved)
  return resolved
}

export function dungeonRelevance(challengeMapId: number, capabilityId: string): number {
  const dungeon = PLANNER_RANKING_DATA.dungeonRelevanceByMapId[
    String(challengeMapId) as keyof typeof PLANNER_RANKING_DATA.dungeonRelevanceByMapId
  ]
  if (!dungeon) return 0
  const value = dungeon[capabilityId as keyof typeof dungeon]
  return typeof value === 'number' ? value : 0
}
