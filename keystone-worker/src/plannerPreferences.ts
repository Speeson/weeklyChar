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

export type PlannerCharacterClass = {
  id: number
  wow_class: string | null
}

export type PlannerPreferenceDTO = PlannerPreferenceInput & {
  role: WowRole
  updatedAt: string
}

const PLAY_PREFERENCE_SET = new Set<string>(PLAY_PREFERENCES)
const ENTRY_KEYS = new Set(['characterId', 'specId', 'playPreference', 'lootSpecId'])
const MAX_PREFERENCES = 500

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function positiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

export function parsePlannerPreferencePayload(value: unknown): PlannerPreferenceInput[] {
  if (!isRecord(value) || Object.keys(value).length !== 1 || !Array.isArray(value.preferences)) {
    throw new Error('El payload debe contener únicamente un array preferences')
  }
  if (value.preferences.length > MAX_PREFERENCES) {
    throw new Error(`preferences no puede contener más de ${MAX_PREFERENCES} entradas`)
  }

  const parsed: PlannerPreferenceInput[] = []
  const identities = new Set<string>()
  for (const entry of value.preferences) {
    if (!isRecord(entry) || Object.keys(entry).some(key => !ENTRY_KEYS.has(key))
      || !positiveSafeInteger(entry.characterId) || !positiveSafeInteger(entry.specId)
      || (entry.lootSpecId !== undefined && !positiveSafeInteger(entry.lootSpecId))
      || typeof entry.playPreference !== 'string'
      || !PLAY_PREFERENCE_SET.has(entry.playPreference)) {
      throw new Error('Cada preferencia debe tener characterId, specId, playPreference y un lootSpecId opcional válidos')
    }
    const identity = `${entry.characterId}:${entry.specId}`
    if (identities.has(identity)) throw new Error('No se permiten preferencias duplicadas')
    identities.add(identity)
    parsed.push({
      characterId: entry.characterId,
      specId: entry.specId,
      playPreference: entry.playPreference as PlayPreference,
      lootSpecId: entry.lootSpecId ?? entry.specId,
    })
  }
  return parsed
}

export function validatePlannerPreferenceDomain(
  preferences: readonly PlannerPreferenceInput[],
  characters: readonly PlannerCharacterClass[],
): void {
  const ownedCharacters = new Map(characters.map(character => [character.id, character]))
  for (const preference of preferences) {
    const character = ownedCharacters.get(preference.characterId)
    if (!character) throw new Error(`El personaje ${preference.characterId} no pertenece al usuario`)
    const wowClass = normalizeWowClass(character.wow_class)
    if (!wowClass) throw new Error(`El personaje ${preference.characterId} no tiene una clase válida`)
    const specialization = wowSpecialization(preference.specId)
    if (!specialization || specialization.wowClass !== wowClass) {
      throw new Error(`La spec ${preference.specId} no pertenece a ${wowClass}`)
    }
    const lootSpecialization = wowSpecialization(preference.lootSpecId)
    if (!lootSpecialization || lootSpecialization.wowClass !== wowClass) {
      throw new Error(`La loot spec ${preference.lootSpecId} no pertenece a ${wowClass}`)
    }
  }
}
