import { coreRequest } from "./client";
import type {
  ClientTeamCharacter, ClientTeamDetail, ClientTeamMember, ClientTeamSummary, CoreError,
  KeystoneSelectorCharacter, KeystoneSelectorObjective, KeystoneSelectorResponse,
  KeystoneSelectorSpec, KeystoneSelectorStone, KeystoneSelectorTierCounts,
} from "./types";

const VOIDCORE_STATES = ["pending", "completed_with_voidcore", "voidcore_not_checked"] as const;

function error(code: string, message: string): CoreError {
  return { code, message };
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positive(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function nonNegative(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function text(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function nullableText(value: unknown, max: number): value is string | null {
  return value === null || text(value, max);
}

function nullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function nullableHttps(value: unknown): value is string | null {
  if (value === null) return true;
  if (!text(value, 2048)) return false;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function parseKeystone(value: unknown): ClientTeamCharacter["currentKeystone"] | undefined {
  if (value === null) return null;
  if (!object(value) || !positive(value.level) || !positive(value.challengeMapId)
    || !nullableText(value.dungeon, 256)) return undefined;
  return { level: value.level, challengeMapId: value.challengeMapId, dungeon: value.dungeon };
}

function parseTeamCharacter(value: unknown): ClientTeamCharacter | null {
  if (!object(value) || !positive(value.id) || !text(value.name, 128) || !text(value.realm, 128)
    || !text(value.region, 16) || !nullableText(value.wowClass, 64) || !nullableHttps(value.avatarUrl)
    || !nullableNumber(value.ilvl) || !nullableNumber(value.rioScore)) return null;
  const currentKeystone = parseKeystone(value.currentKeystone);
  if (currentKeystone === undefined) return null;
  return { characterId: value.id, name: value.name, realm: value.realm, region: value.region,
    wowClass: value.wowClass, avatarUrl: value.avatarUrl, ilvl: value.ilvl, rioScore: value.rioScore,
    currentKeystone };
}

function parseTeamMember(value: unknown): ClientTeamMember | null {
  if (!object(value) || !positive(value.userId) || !text(value.username, 128)
    || !Array.isArray(value.characters) || value.characters.length > 2000) return null;
  const characters = value.characters.map(parseTeamCharacter);
  if (characters.some(item => item === null)) return null;
  return { userId: value.userId, username: value.username, characters: characters as ClientTeamCharacter[] };
}

export function parseTeamList(value: unknown): ClientTeamSummary[] | null {
  if (!Array.isArray(value) || value.length > 1000) return null;
  const teams = value.map(item => object(item) && positive(item.id) && text(item.name, 128)
    && nonNegative(item.memberCount) ? { id: item.id, name: item.name, memberCount: item.memberCount } : null);
  return teams.some(item => item === null) ? null : teams as ClientTeamSummary[];
}

export function parseTeamDetail(value: unknown, expectedTeamId: number): ClientTeamDetail | null {
  if (!positive(expectedTeamId) || !object(value) || !positive(value.id) || value.id !== expectedTeamId || !text(value.name, 128)
    || !Array.isArray(value.members) || value.members.length > 1000) return null;
  const members = value.members.map(parseTeamMember);
  return members.some(item => item === null) ? null
    : { id: value.id as number, name: value.name, members: members as ClientTeamMember[] };
}

function parseTiers(value: unknown): KeystoneSelectorTierCounts | null {
  if (!object(value)) return null;
  const keys: Array<keyof KeystoneSelectorTierCounts> = ["bestInSlot", "mustHave", "niceToHave", "catalyst", "transmog", "other"];
  return keys.every(key => nonNegative(value[key]))
    ? Object.fromEntries(keys.map(key => [key, value[key]])) as KeystoneSelectorTierCounts : null;
}

function parseObjective(value: unknown): KeystoneSelectorObjective | null {
  if (!object(value) || !positive(value.itemId) || !nullableText(value.itemName, 512)
    || !nullableHttps(value.iconUrl) || !positive(value.tier) || !Array.isArray(value.specIds)
    || value.specIds.length === 0 || value.specIds.length > 64 || !value.specIds.every(positive)
    || new Set(value.specIds).size !== value.specIds.length || !text(value.sourceType, 64)
    || !(positive(value.sourceId) || text(value.sourceId, 128))
    || !(value.slotId === null || Number.isSafeInteger(value.slotId)) || !nullableText(value.slotName, 128)
    || !nullableText(value.itemClassName, 128) || !nullableText(value.itemSubClassName, 128)
    || !Array.isArray(value.statNames) || value.statNames.length > 32 || !value.statNames.every(name => text(name, 128))
    || new Set(value.statNames).size !== value.statNames.length || typeof value.voidcoreState !== "string"
    || !VOIDCORE_STATES.includes(value.voidcoreState as typeof VOIDCORE_STATES[number])) return null;
  return { itemId: value.itemId, itemName: value.itemName, iconUrl: value.iconUrl, tier: value.tier,
    specIds: [...value.specIds] as number[], sourceType: value.sourceType, sourceId: value.sourceId,
    slotId: value.slotId as number | null, slotName: value.slotName, itemClassName: value.itemClassName,
    itemSubClassName: value.itemSubClassName, statNames: [...value.statNames] as string[],
    voidcoreState: value.voidcoreState as KeystoneSelectorObjective["voidcoreState"] };
}

function parseStone(value: unknown): KeystoneSelectorStone | null {
  return object(value) && positive(value.characterId) && text(value.characterName, 128)
    && positive(value.ownerUserId) && text(value.ownerUsername, 128) && positive(value.level)
    ? { characterId: value.characterId, characterName: value.characterName, ownerUserId: value.ownerUserId,
      ownerUsername: value.ownerUsername, level: value.level } : null;
}

function parseSpec(value: unknown): KeystoneSelectorSpec | null {
  if (!object(value) || !positive(value.specId) || !nonNegative(value.objectiveCount)) return null;
  const tierCounts = parseTiers(value.tierCounts);
  return tierCounts ? { specId: value.specId, objectiveCount: value.objectiveCount, tierCounts } : null;
}

function parseSelectorCharacter(value: unknown): KeystoneSelectorCharacter | null {
  if (!object(value) || !positive(value.userId) || !text(value.username, 128) || !positive(value.characterId)
    || !text(value.characterName, 128) || !text(value.realm, 128) || !text(value.region, 16)
    || !nullableText(value.wowClass, 64) || !nullableHttps(value.avatarUrl) || !nullableNumber(value.ilvl)
    || !nullableNumber(value.rioScore) || !nonNegative(value.totalObjectives) || !Array.isArray(value.specs)
    || value.specs.length > 64 || !Array.isArray(value.objectives) || value.objectives.length > 2000) return null;
  const tierCounts = parseTiers(value.tierCounts);
  const specs = value.specs.map(parseSpec); const objectives = value.objectives.map(parseObjective);
  if (!tierCounts || specs.some(item => item === null) || objectives.some(item => item === null)) return null;
  return { userId: value.userId, username: value.username, characterId: value.characterId,
    characterName: value.characterName, realm: value.realm, region: value.region, wowClass: value.wowClass,
    avatarUrl: value.avatarUrl, ilvl: value.ilvl, rioScore: value.rioScore, totalObjectives: value.totalObjectives,
    tierCounts, specs: specs as KeystoneSelectorSpec[], objectives: objectives as KeystoneSelectorObjective[] };
}

export function parseKeystoneSelector(value: unknown, teamId: number, challengeMapId: number): KeystoneSelectorResponse | null {
  if (!positive(teamId) || !positive(challengeMapId) || !object(value) || value.teamId !== teamId || value.challengeMapId !== challengeMapId
    || !object(value.availability) || !nonNegative(value.availability.stoneCount)
    || !Array.isArray(value.availability.stones) || value.availability.stones.length > 2000
    || !object(value.summary) || !nonNegative(value.summary.charactersWithObjectives)
    || !nonNegative(value.summary.totalObjectives) || !Array.isArray(value.characters)
    || value.characters.length > 2000) return null;
  const stones = value.availability.stones.map(parseStone); const tiers = parseTiers(value.summary.tiers);
  const characters = value.characters.map(parseSelectorCharacter);
  if (!tiers || stones.some(item => item === null) || characters.some(item => item === null)
    || value.availability.stoneCount !== stones.length
    || value.summary.charactersWithObjectives !== characters.length) return null;
  return { teamId, challengeMapId, availability: { stoneCount: value.availability.stoneCount,
    stones: stones as KeystoneSelectorStone[] }, summary: { charactersWithObjectives: value.summary.charactersWithObjectives,
    totalObjectives: value.summary.totalObjectives, tiers }, characters: characters as KeystoneSelectorCharacter[] };
}

function requireId(value: number): void {
  if (!positive(value)) throw error("INVALID_REQUEST", "El identificador debe ser un entero positivo seguro.");
}

export async function listTeams(): Promise<ClientTeamSummary[]> {
  const parsed = parseTeamList(await coreRequest<unknown>("teams.list"));
  if (!parsed) throw error("INVALID_TEAM_RESPONSE", "La respuesta de equipos no es válida.");
  return parsed;
}

export async function getTeam(teamId: number): Promise<ClientTeamDetail> {
  requireId(teamId);
  const parsed = parseTeamDetail(await coreRequest<unknown>("teams.get", { teamId }), teamId);
  if (!parsed) throw error("INVALID_TEAM_RESPONSE", "La respuesta del equipo no es válida.");
  return parsed;
}

export async function getKeystoneSelector(teamId: number, challengeMapId: number): Promise<KeystoneSelectorResponse> {
  requireId(teamId); requireId(challengeMapId);
  const parsed = parseKeystoneSelector(await coreRequest<unknown>("teams.keystone_selector", { teamId, challengeMapId }), teamId, challengeMapId);
  if (!parsed) throw error("INVALID_SELECTOR_RESPONSE", "La respuesta del selector no es válida.");
  return parsed;
}
