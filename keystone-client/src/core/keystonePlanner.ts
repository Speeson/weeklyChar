import { coreRequest } from "./client";
import type {
  CoreError, KeystonePlannerAssignment, KeystonePlannerCapability, KeystonePlannerLock,
  KeystonePlannerObjective, KeystonePlannerRecommendation, KeystonePlannerRequest,
  KeystonePlannerResponse, KeystonePlannerRole,
} from "./types";

export const DEFAULT_KEYSTONE_PLANNER_OPTIONS = {
  optimizeComposition: true,
  bloodlust: true,
  battleRez: true,
  classBuffs: true,
  damageSynergy: true,
} as const;

const ROLES = new Set(["tank", "healer", "dps"]);
const PREFERENCES = new Set(["preferred", "available", "emergency"]);
const AVAILABILITY = new Set(["guaranteed", "conditional", "none"]);
const CAPABILITY_TYPES = new Set(["major_utility", "class_buff", "damage_debuff"]);
const VOIDCORE = new Set(["pending", "completed_with_voidcore", "voidcore_not_checked"]);
const STATUSES = new Set(["ok", "invalid_input", "unconfigured_participants", "no_valid_composition"]);
const REASONS = new Set([
  "PARTY_COMPLETE", "PARTY_INCOMPLETE", "HAS_LOOT_OBJECTIVES", "NO_LOOT_OBJECTIVES",
  "TARGET_LEVEL_EXACT", "TARGET_LEVEL_NEARBY", "BLOODLUST_GUARANTEED",
  "BLOODLUST_CONDITIONAL", "BLOODLUST_MISSING", "BATTLE_REZ_PRESENT", "BATTLE_REZ_MISSING",
]);
const DIAGNOSTICS = new Set([
  "INVALID_PARTICIPANT_COUNT", "DUPLICATE_PARTICIPANT", "INVALID_TARGET_LEVEL",
  "DUPLICATE_CANDIDATE", "INVALID_LOCK", "UNCONFIGURED_PARTICIPANT", "NO_VALID_COMPOSITION",
]);

function error(code: string, message: string): CoreError {
  return { code, message };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function integer(value: unknown, minimum = 0): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;
}

function string(value: unknown, maximum = 1024): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum;
}

function nullableString(value: unknown, maximum = 2048): value is string | null {
  return value === null || string(value, maximum);
}

function parseCapability(value: unknown, summary: boolean): KeystonePlannerCapability | null {
  if (!record(value) || !string(value.capabilityId, 64) || !string(value.name, 128)
    || typeof value.type !== "string" || !CAPABILITY_TYPES.has(value.type)
    || !integer(value.iconSpellId, 1) || value.stacking !== "unique") return null;
  if (summary) {
    if (typeof value.availability !== "string" || !["guaranteed", "conditional"].includes(value.availability)) return null;
  } else if (typeof value.mode !== "string" || !["guaranteed", "conditional"].includes(value.mode)
    || !nullableString(value.condition, 512)) return null;
  return {
    capabilityId: value.capabilityId,
    name: value.name,
    type: value.type as KeystonePlannerCapability["type"],
    iconSpellId: value.iconSpellId,
    stacking: "unique",
    ...(summary
      ? { availability: value.availability as "guaranteed" | "conditional" }
      : { mode: value.mode as "guaranteed" | "conditional", condition: value.condition as string | null }),
  };
}

function parseObjective(value: unknown): KeystonePlannerObjective | null {
  if (!record(value) || !integer(value.itemId, 1) || !nullableString(value.itemName, 512)
    || !nullableString(value.iconUrl) || !integer(value.tier, 1) || !string(value.variantKey, 1024)
    || typeof value.voidcoreState !== "string" || !VOIDCORE.has(value.voidcoreState)) return null;
  if (value.iconUrl !== null) {
    try { if (new URL(value.iconUrl).protocol !== "https:") return null; } catch { return null; }
  }
  return {
    itemId: value.itemId, itemName: value.itemName as string | null, iconUrl: value.iconUrl as string | null,
    tier: value.tier, variantKey: value.variantKey, voidcoreState: value.voidcoreState as KeystonePlannerObjective["voidcoreState"],
  };
}

function parseAssignment(value: unknown): KeystonePlannerAssignment | null {
  if (!record(value) || !integer(value.userId, 1) || !string(value.username, 128)
    || !integer(value.characterId, 1) || !string(value.characterName, 128) || !string(value.wowClass, 64)
    || !integer(value.specId, 1) || !integer(value.lootSpecId, 1)
    || typeof value.role !== "string" || !ROLES.has(value.role)
    || typeof value.playPreference !== "string" || !PREFERENCES.has(value.playPreference)
    || !Array.isArray(value.objectives) || value.objectives.length > 2000
    || !Array.isArray(value.capabilities) || value.capabilities.length > 64) return null;
  const objectives = value.objectives.map(parseObjective);
  const capabilities = value.capabilities.map(item => parseCapability(item, false));
  if (objectives.some(item => item === null) || capabilities.some(item => item === null)) return null;
  return {
    userId: value.userId, username: value.username, characterId: value.characterId,
    characterName: value.characterName, wowClass: value.wowClass, specId: value.specId,
    role: value.role as KeystonePlannerRole, lootSpecId: value.lootSpecId,
    playPreference: value.playPreference as KeystonePlannerAssignment["playPreference"],
    objectives: objectives as KeystonePlannerObjective[], capabilities: capabilities as KeystonePlannerCapability[],
  };
}

function parseRecommendation(
  value: unknown, request: KeystonePlannerRequest,
): KeystonePlannerRecommendation | null {
  if (!record(value) || !integer(value.rank, 1) || value.rank > 5 || !string(value.fingerprint, 4096)
    || !record(value.stone) || value.stone.characterId !== request.stoneCharacterId
    || value.stone.challengeMapId !== request.challengeMapId || !string(value.stone.characterName, 128)
    || !integer(value.stone.ownerUserId, 1) || !string(value.stone.ownerUsername, 128)
    || !string(value.stone.dungeon, 256) || !integer(value.stone.level, 1)
    || !Array.isArray(value.assignments) || value.assignments.length > 5
    || !Array.isArray(value.vacancies) || value.vacancies.length > 5 || !Array.isArray(value.reasonCodes)
    || !record(value.lootSummary) || !record(value.lootSummary.tierCounts)
    || !record(value.levelSummary) || !record(value.preferenceSummary) || !record(value.compositionSummary)
    || !Array.isArray(value.compositionSummary.uniqueCapabilities)) return null;
  const assignments = value.assignments.map(parseAssignment);
  const vacancies = value.vacancies.map(item => record(item) && typeof item.role === "string" && ROLES.has(item.role)
    && Array.isArray(item.preferredCapabilities) && item.preferredCapabilities.every(cap => string(cap, 64))
    ? { role: item.role as KeystonePlannerRole, preferredCapabilities: item.preferredCapabilities as string[] }
    : null);
  const capabilities = value.compositionSummary.uniqueCapabilities.map(item => parseCapability(item, true));
  const counts = [
    value.lootSummary.weightedScore, value.lootSummary.playersWithObjectives, value.lootSummary.totalObjectives,
    value.lootSummary.tierCounts.bestInSlot, value.lootSummary.tierCounts.mustHave,
    value.lootSummary.tierCounts.niceToHave, value.lootSummary.tierCounts.catalyst,
    value.lootSummary.tierCounts.transmog, value.levelSummary.targetLevel, value.levelSummary.stoneLevel,
    value.levelSummary.levelDistance, value.preferenceSummary.preferred, value.preferenceSummary.available,
    value.preferenceSummary.emergency, value.compositionSummary.magicalDpsCount,
    value.compositionSummary.physicalDpsCount, value.compositionSummary.unknownDpsCount,
    value.compositionSummary.chaosBrandBeneficiaries, value.compositionSummary.mysticTouchBeneficiaries,
    value.compositionSummary.uniqueClassBuffCount,
  ];
  if (assignments.some(item => item === null) || vacancies.some(item => item === null)
    || capabilities.some(item => item === null) || !value.reasonCodes.every(reason => typeof reason === "string" && REASONS.has(reason))
    || counts.some(count => !integer(count))
    || typeof value.compositionSummary.bloodlust !== "string" || !AVAILABILITY.has(value.compositionSummary.bloodlust)
    || typeof value.compositionSummary.battleRez !== "string" || !AVAILABILITY.has(value.compositionSummary.battleRez)
    || !["physical", "magical", "mixed", "unknown"].includes(String(value.compositionSummary.damageProfile))) return null;
  return {
    rank: value.rank, fingerprint: value.fingerprint,
    stone: {
      characterId: value.stone.characterId as number, characterName: value.stone.characterName as string,
      ownerUserId: value.stone.ownerUserId as number, ownerUsername: value.stone.ownerUsername as string,
      challengeMapId: value.stone.challengeMapId as number, dungeon: value.stone.dungeon as string,
      level: value.stone.level as number,
    },
    assignments: assignments as KeystonePlannerAssignment[], vacancies: vacancies as KeystonePlannerRecommendation["vacancies"],
    lootSummary: {
      weightedScore: value.lootSummary.weightedScore as number,
      playersWithObjectives: value.lootSummary.playersWithObjectives as number,
      totalObjectives: value.lootSummary.totalObjectives as number,
      tierCounts: {
        bestInSlot: value.lootSummary.tierCounts.bestInSlot as number,
        mustHave: value.lootSummary.tierCounts.mustHave as number,
        niceToHave: value.lootSummary.tierCounts.niceToHave as number,
        catalyst: value.lootSummary.tierCounts.catalyst as number,
        transmog: value.lootSummary.tierCounts.transmog as number,
      },
    },
    levelSummary: {
      targetLevel: value.levelSummary.targetLevel as number, stoneLevel: value.levelSummary.stoneLevel as number,
      levelDistance: value.levelSummary.levelDistance as number,
    },
    preferenceSummary: {
      preferred: value.preferenceSummary.preferred as number, available: value.preferenceSummary.available as number,
      emergency: value.preferenceSummary.emergency as number,
    },
    compositionSummary: {
      bloodlust: value.compositionSummary.bloodlust as KeystonePlannerRecommendation["compositionSummary"]["bloodlust"],
      battleRez: value.compositionSummary.battleRez as KeystonePlannerRecommendation["compositionSummary"]["battleRez"],
      uniqueCapabilities: capabilities as KeystonePlannerCapability[],
      damageProfile: value.compositionSummary.damageProfile as KeystonePlannerRecommendation["compositionSummary"]["damageProfile"],
      magicalDpsCount: value.compositionSummary.magicalDpsCount as number,
      physicalDpsCount: value.compositionSummary.physicalDpsCount as number,
      unknownDpsCount: value.compositionSummary.unknownDpsCount as number,
      chaosBrandBeneficiaries: value.compositionSummary.chaosBrandBeneficiaries as number,
      mysticTouchBeneficiaries: value.compositionSummary.mysticTouchBeneficiaries as number,
      uniqueClassBuffCount: value.compositionSummary.uniqueClassBuffCount as number,
    },
    reasonCodes: value.reasonCodes as string[],
  };
}

export function parseKeystonePlannerResponse(
  value: unknown, teamId: number, request: KeystonePlannerRequest,
): KeystonePlannerResponse | null {
  if (!record(value) || value.teamId !== teamId || value.challengeMapId !== request.challengeMapId
    || value.targetLevel !== request.targetLevel || !record(value.availability)
    || !integer(value.availability.eligibleStoneCount) || value.availability.eligibleStoneCount > 1
    || typeof value.status !== "string" || !STATUSES.has(value.status) || !record(value.diagnostics)
    || !Array.isArray(value.diagnostics.codes) || !value.diagnostics.codes.every(code => typeof code === "string" && DIAGNOSTICS.has(code))
    || !Array.isArray(value.diagnostics.unconfiguredUserIds) || !value.diagnostics.unconfiguredUserIds.every(id => integer(id, 1))
    || !Array.isArray(value.diagnostics.lockIssues) || !value.diagnostics.lockIssues.every(issue => string(issue, 512))
    || !Array.isArray(value.recommendations) || value.recommendations.length > 5) return null;
  const recommendations = value.recommendations.map(item => parseRecommendation(item, request));
  if (recommendations.some(item => item === null)) return null;
  return {
    teamId: value.teamId, challengeMapId: value.challengeMapId, targetLevel: value.targetLevel,
    availability: { eligibleStoneCount: value.availability.eligibleStoneCount as number },
    status: value.status as KeystonePlannerResponse["status"],
    diagnostics: {
      codes: value.diagnostics.codes as string[],
      unconfiguredUserIds: value.diagnostics.unconfiguredUserIds as number[],
      lockIssues: value.diagnostics.lockIssues as string[],
    },
    recommendations: recommendations as KeystonePlannerRecommendation[],
  };
}

function validRequest(request: KeystonePlannerRequest): boolean {
  const participants = request.participantUserIds;
  return participants.length >= 2 && participants.length <= 5 && participants.every(id => integer(id, 1))
    && new Set(participants).size === participants.length && integer(request.targetLevel, 1) && request.targetLevel <= 20
    && integer(request.challengeMapId, 1) && integer(request.stoneCharacterId, 1)
    && Object.values(request.options).every(value => typeof value === "boolean") && request.locks.length <= 15;
}

export async function getKeystonePlanner(
  teamId: number, request: KeystonePlannerRequest,
): Promise<KeystonePlannerResponse> {
  if (!integer(teamId, 1) || !validRequest(request)) {
    throw error("INVALID_REQUEST", "La solicitud del Planner no es válida.");
  }
  const raw = await coreRequest<unknown>("teams.keystone_planner", {
    teamId,
    participantUserIds: [...request.participantUserIds],
    targetLevel: request.targetLevel,
    challengeMapId: request.challengeMapId,
    stoneCharacterId: request.stoneCharacterId,
    options: { ...request.options },
    locks: request.locks.map((lock: KeystonePlannerLock) => ({ ...lock })),
  });
  const parsed = parseKeystonePlannerResponse(raw, teamId, request);
  if (!parsed) throw error("INVALID_PLANNER_RESPONSE", "La respuesta del Planner no es válida.");
  return parsed;
}
