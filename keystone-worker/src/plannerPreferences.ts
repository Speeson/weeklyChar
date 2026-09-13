import { normalizeWowClass, wowSpecialization } from './wowComposition'
import type { WowRole } from './wowComposition'

export const PLAY_PREFERENCES = ['preferred', 'available', 'emergency', 'disabled'] as const
export type PlayPreference = typeof PLAY_PREFERENCES[number]

export type PlannerPreferenceInput = {
  characterId: number
  specId: number
  playPreference: PlayPreference
  lootSpecId: number
}

export type PlannerLootPreferenceInput = {
  characterId: number
  primaryLootSpecId: number
  secondaryLootSpecIds: number[]
}

export type PlannerPreferenceDocumentInput = {
  preferences: PlannerPreferenceInput[]
  lootPreferences: PlannerLootPreferenceInput[]
  onboardingCompleted?: boolean
  legacy: boolean
}

export type PlannerCharacterClass = {
  id: number
  wow_class: string | null
}

export type PlannerPreferenceDTO = PlannerPreferenceInput & {
  role: WowRole
  updatedAt: string
}

export type PlannerLootPreferenceDTO = PlannerLootPreferenceInput & {
  updatedAt: string
}

const PLAY_PREFERENCE_SET = new Set<string>(PLAY_PREFERENCES)
const ENTRY_KEYS = new Set(['characterId', 'specId', 'playPreference', 'lootSpecId'])
const LOOT_ENTRY_KEYS = new Set(['characterId', 'primaryLootSpecId', 'secondaryLootSpecIds'])
const DOCUMENT_KEYS = new Set(['preferences', 'lootPreferences', 'onboardingCompleted'])
const MAX_PREFERENCES = 500
const MAX_LOOT_PREFERENCES = 100

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function positiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function deriveLegacyLootPreferences(preferences: readonly PlannerPreferenceInput[]): PlannerLootPreferenceInput[] {
  const rank: Readonly<Record<PlayPreference, number>> = {
    preferred: 0, available: 1, emergency: 2, disabled: 3,
  }
  const byCharacter = new Map<number, PlannerPreferenceInput[]>()
  for (const preference of preferences) {
    const rows = byCharacter.get(preference.characterId) ?? []
    rows.push(preference)
    byCharacter.set(preference.characterId, rows)
  }
  return [...byCharacter.entries()].sort(([left], [right]) => left - right).map(([characterId, rows]) => {
    const ordered = [...rows].sort((left, right) => rank[left.playPreference] - rank[right.playPreference]
      || left.specId - right.specId)
    const primaryLootSpecId = ordered[0].lootSpecId
    const secondaryLootSpecIds = [...new Set(ordered.map(row => row.lootSpecId))]
      .filter(specId => specId !== primaryLootSpecId)
      .sort((left, right) => left - right)
    return { characterId, primaryLootSpecId, secondaryLootSpecIds }
  })
}

export function parsePlannerPreferencePayload(value: unknown): PlannerPreferenceDocumentInput {
  if (!isRecord(value) || Object.keys(value).some(key => !DOCUMENT_KEYS.has(key))
    || !Array.isArray(value.preferences)) {
    throw new Error('El payload debe contener preferences y solo campos reconocidos')
  }
  if (value.preferences.length > MAX_PREFERENCES) {
    throw new Error(`preferences no puede contener mas de ${MAX_PREFERENCES} entradas`)
  }

  const preferences: PlannerPreferenceInput[] = []
  const identities = new Set<string>()
  for (const entry of value.preferences) {
    if (!isRecord(entry) || Object.keys(entry).some(key => !ENTRY_KEYS.has(key))
      || !positiveSafeInteger(entry.characterId) || !positiveSafeInteger(entry.specId)
      || (entry.lootSpecId !== undefined && !positiveSafeInteger(entry.lootSpecId))
      || typeof entry.playPreference !== 'string'
      || !PLAY_PREFERENCE_SET.has(entry.playPreference)) {
      throw new Error('Cada preferencia debe tener characterId, specId y playPreference validos')
    }
    const identity = `${entry.characterId}:${entry.specId}`
    if (identities.has(identity)) throw new Error('No se permiten preferencias duplicadas')
    identities.add(identity)
    preferences.push({
      characterId: entry.characterId,
      specId: entry.specId,
      playPreference: entry.playPreference as PlayPreference,
      lootSpecId: entry.lootSpecId ?? entry.specId,
    })
  }

  const legacy = value.lootPreferences === undefined
  let lootPreferences: PlannerLootPreferenceInput[]
  if (legacy) {
    lootPreferences = deriveLegacyLootPreferences(preferences)
  } else {
    if (!Array.isArray(value.lootPreferences) || value.lootPreferences.length > MAX_LOOT_PREFERENCES) {
      throw new Error(`lootPreferences no puede contener mas de ${MAX_LOOT_PREFERENCES} entradas`)
    }
    const characterIds = new Set<number>()
    lootPreferences = value.lootPreferences.map(entry => {
      if (!isRecord(entry) || Object.keys(entry).some(key => !LOOT_ENTRY_KEYS.has(key))
        || !positiveSafeInteger(entry.characterId) || !positiveSafeInteger(entry.primaryLootSpecId)
        || !Array.isArray(entry.secondaryLootSpecIds)
        || !entry.secondaryLootSpecIds.every(positiveSafeInteger)
        || new Set(entry.secondaryLootSpecIds).size !== entry.secondaryLootSpecIds.length) {
        throw new Error('Cada preferencia de botin debe tener personaje, principal y secundarias validos')
      }
      if (characterIds.has(entry.characterId)) throw new Error('No se permiten preferencias de botin duplicadas')
      if (entry.secondaryLootSpecIds.includes(entry.primaryLootSpecId)) {
        throw new Error('Una spec no puede ser principal y secundaria a la vez')
      }
      characterIds.add(entry.characterId)
      return {
        characterId: entry.characterId,
        primaryLootSpecId: entry.primaryLootSpecId,
        secondaryLootSpecIds: [...entry.secondaryLootSpecIds].sort((left, right) => left - right),
      }
    }).sort((left, right) => left.characterId - right.characterId)
  }

  if (value.onboardingCompleted !== undefined && typeof value.onboardingCompleted !== 'boolean') {
    throw new Error('onboardingCompleted debe ser booleano')
  }
  return { preferences, lootPreferences, onboardingCompleted: value.onboardingCompleted, legacy }
}

export function validatePlannerPreferenceDomain(
  document: PlannerPreferenceDocumentInput,
  characters: readonly PlannerCharacterClass[],
): void {
  const ownedCharacters = new Map(characters.map(character => [character.id, character]))
  for (const preference of document.preferences) {
    const character = ownedCharacters.get(preference.characterId)
    if (!character) throw new Error(`El personaje ${preference.characterId} no pertenece al usuario`)
    const wowClass = normalizeWowClass(character.wow_class)
    if (!wowClass) throw new Error(`El personaje ${preference.characterId} no tiene una clase valida`)
    const specialization = wowSpecialization(preference.specId)
    if (!specialization || specialization.wowClass !== wowClass) {
      throw new Error(`La spec ${preference.specId} no pertenece a ${wowClass}`)
    }
    const legacyLootSpecialization = wowSpecialization(preference.lootSpecId)
    if (!legacyLootSpecialization || legacyLootSpecialization.wowClass !== wowClass) {
      throw new Error(`La loot spec ${preference.lootSpecId} no pertenece a ${wowClass}`)
    }
  }

  const lootByCharacter = new Map<number, PlannerLootPreferenceInput>()
  for (const preference of document.lootPreferences) {
    const character = ownedCharacters.get(preference.characterId)
    if (!character) throw new Error(`El personaje ${preference.characterId} no pertenece al usuario`)
    const wowClass = normalizeWowClass(character.wow_class)
    if (!wowClass) throw new Error(`El personaje ${preference.characterId} no tiene una clase valida`)
    for (const specId of [preference.primaryLootSpecId, ...preference.secondaryLootSpecIds]) {
      const specialization = wowSpecialization(specId)
      if (!specialization || specialization.wowClass !== wowClass) {
        throw new Error(`La loot spec ${specId} no pertenece a ${wowClass}`)
      }
    }
    lootByCharacter.set(preference.characterId, preference)
  }

  const activeCharacterIds = new Set(document.preferences
    .filter(preference => preference.playPreference !== 'disabled')
    .map(preference => preference.characterId))
  for (const characterId of activeCharacterIds) {
    if (!lootByCharacter.has(characterId)) {
      throw new Error(`El personaje ${characterId} necesita una especializacion de botin principal`)
    }
  }
}
