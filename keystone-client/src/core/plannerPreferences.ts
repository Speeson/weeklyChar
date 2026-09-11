import { coreRequest } from "./client";
import type {
  ClientPlannerPreference, ClientPlannerPreferenceInput, ClientPlannerPreferences,
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
  return { characterId: value.characterId, specId: value.specId, role: value.role as KeystonePlannerRole,
    playPreference: value.playPreference as KeystonePlannerPreferenceState, lootSpecId: value.lootSpecId,
    updatedAt: value.updatedAt };
}

export function parsePlannerPreferences(value: unknown): ClientPlannerPreferences | null {
  if (!object(value) || !Array.isArray(value.preferences) || value.preferences.length > 500) return null;
  const preferences = value.preferences.map(parsePreference);
  if (preferences.some(preference => preference === null)) return null;
  return { preferences: preferences as ClientPlannerPreference[] };
}

function validInput(value: ClientPlannerPreferenceInput): boolean {
  return positive(value.characterId) && positive(value.specId) && positive(value.lootSpecId)
    && STATES.has(value.playPreference);
}

export async function getPlannerPreferences(): Promise<ClientPlannerPreferences> {
  const parsed = parsePlannerPreferences(await coreRequest<unknown>("planner.preferences.get"));
  if (!parsed) throw invalid("La respuesta de preferencias del Planner no es válida.");
  return parsed;
}

export async function updatePlannerPreferences(preferences: ClientPlannerPreferenceInput[]): Promise<ClientPlannerPreferences> {
  if (!Array.isArray(preferences) || preferences.length > 500 || !preferences.every(validInput)
    || new Set(preferences.map(preference => `${preference.characterId}:${preference.specId}`)).size !== preferences.length) {
    throw invalid("Las preferencias del Planner no son válidas.");
  }
  const parsed = parsePlannerPreferences(await coreRequest<unknown>("planner.preferences.update", { preferences }));
  if (!parsed) throw invalid("La respuesta de preferencias del Planner no es válida.");
  return parsed;
}
