import { coreRequest } from "./client";
import type {
  ClientPlannerLootPreference, ClientPlannerPreference, ClientPlannerPreferenceUpdate, ClientPlannerPreferences,
  CoreError, KeystonePlannerPreferenceState, KeystonePlannerRole,
} from "./types";

const ROLES = new Set<KeystonePlannerRole>(["tank", "healer", "dps"]);
const STATES = new Set<KeystonePlannerPreferenceState>(["preferred", "available", "emergency", "disabled"]);
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function invalid(message: string): CoreError { return { code: "INVALID_REQUEST", message }; }

function parsePreference(value: unknown): ClientPlannerPreference | null {
  if (!object(value) || !positive(value.characterId) || !positive(value.specId) || !positive(value.lootSpecId)
    || typeof value.role !== "string" || !ROLES.has(value.role as KeystonePlannerRole)
    || typeof value.playPreference !== "string" || !STATES.has(value.playPreference as KeystonePlannerPreferenceState)
    || typeof value.updatedAt !== "string" || value.updatedAt.length === 0 || value.updatedAt.length > 64) return null;
  return {
    characterId: value.characterId, specId: value.specId, role: value.role as KeystonePlannerRole,
    playPreference: value.playPreference as KeystonePlannerPreferenceState, lootSpecId: value.lootSpecId,
    updatedAt: value.updatedAt,
  };
}

function parseLootPreference(value: unknown): ClientPlannerLootPreference | null {
  if (!object(value) || !positive(value.characterId) || !positive(value.primaryLootSpecId)
    || !Array.isArray(value.secondaryLootSpecIds) || value.secondaryLootSpecIds.length > 64
    || !value.secondaryLootSpecIds.every(positive)
    || new Set(value.secondaryLootSpecIds).size !== value.secondaryLootSpecIds.length
    || value.secondaryLootSpecIds.includes(value.primaryLootSpecId)
    || typeof value.updatedAt !== "string" || value.updatedAt.length === 0 || value.updatedAt.length > 64) return null;
  return {
    characterId: value.characterId, primaryLootSpecId: value.primaryLootSpecId,
    secondaryLootSpecIds: [...value.secondaryLootSpecIds], updatedAt: value.updatedAt,
  };
}

export function parsePlannerPreferences(value: unknown): ClientPlannerPreferences | null {
  if (!object(value) || !Array.isArray(value.preferences) || value.preferences.length > 500) return null;
  const preferences = value.preferences.map(parsePreference);
  if (preferences.some(preference => preference === null)) return null;
  const parsedPreferences = preferences as ClientPlannerPreference[];
  if (value.lootPreferences === undefined) return {
    preferences: parsedPreferences,
    lootPreferences: [],
    onboardingCompleted: false,
  };
  if (!Array.isArray(value.lootPreferences) || value.lootPreferences.length > 100
    || typeof value.onboardingCompleted !== "boolean") return null;
  const lootPreferences = value.lootPreferences.map(parseLootPreference);
  if (lootPreferences.some(preference => preference === null)) return null;
  const parsedLoot = lootPreferences as ClientPlannerLootPreference[];
  if (new Set(parsedLoot.map(preference => preference.characterId)).size !== parsedLoot.length) return null;
  return { preferences: parsedPreferences, lootPreferences: parsedLoot, onboardingCompleted: value.onboardingCompleted };
}

function validUpdate(value: ClientPlannerPreferenceUpdate): boolean {
  if (!Array.isArray(value.preferences) || value.preferences.length > 500
    || !value.preferences.every(preference => positive(preference.characterId) && positive(preference.specId) && STATES.has(preference.playPreference))
    || new Set(value.preferences.map(preference => `${preference.characterId}:${preference.specId}`)).size !== value.preferences.length
    || !Array.isArray(value.lootPreferences) || value.lootPreferences.length > 100
    || new Set(value.lootPreferences.map(preference => preference.characterId)).size !== value.lootPreferences.length
    || typeof value.onboardingCompleted !== "boolean") return false;
  const preferenceCharacterIds = new Set(value.preferences.map(preference => preference.characterId));
  const lootCharacterIds = new Set(value.lootPreferences.map(preference => preference.characterId));
  const activeCharacterIds = new Set(value.preferences
    .filter(preference => preference.playPreference !== "disabled")
    .map(preference => preference.characterId));
  return [...activeCharacterIds].every(characterId => lootCharacterIds.has(characterId))
    && [...lootCharacterIds].every(characterId => preferenceCharacterIds.has(characterId))
    && value.lootPreferences.every(preference => positive(preference.characterId) && positive(preference.primaryLootSpecId)
    && Array.isArray(preference.secondaryLootSpecIds) && preference.secondaryLootSpecIds.length <= 64
    && preference.secondaryLootSpecIds.every(positive)
    && new Set(preference.secondaryLootSpecIds).size === preference.secondaryLootSpecIds.length
    && !preference.secondaryLootSpecIds.includes(preference.primaryLootSpecId));
}

export async function getPlannerPreferences(): Promise<ClientPlannerPreferences> {
  const parsed = parsePlannerPreferences(await coreRequest<unknown>("planner.preferences.get"));
  if (!parsed) throw invalid("La respuesta de preferencias del Planner no es válida.");
  return parsed;
}

export async function updatePlannerPreferences(update: ClientPlannerPreferenceUpdate): Promise<ClientPlannerPreferences> {
  if (!validUpdate(update)) throw invalid("Las preferencias del Planner no son válidas.");
  const parsed = parsePlannerPreferences(await coreRequest<unknown>("planner.preferences.update", update));
  if (!parsed) throw invalid("La respuesta de preferencias del Planner no es válida.");
  return parsed;
}
