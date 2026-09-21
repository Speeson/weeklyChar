import { coreRequest } from "./client";
import type {
  CoreError, KeystonePlannerAdvancedUtilityCapability, KeystonePlannerAssignment, KeystonePlannerCapability, KeystonePlannerLock,
  KeystonePlannerExternalClassCandidate, KeystonePlannerObjective, KeystonePlannerRecommendation, KeystonePlannerRequest,
  KeystonePlannerResponse, KeystonePlannerRole,
  KeystonePlannerVacancy, KeystonePlannerVacancyRecommendation,
} from "./types";

export const DEFAULT_KEYSTONE_PLANNER_OPTIONS = {
  optimizeComposition: true,
  fillComposition: true,
  recommendationMode: "quick",
  bloodlust: true,
  battleRez: true,
  offensiveSynergy: true,
  groupDefense: true,
  dungeonUtility: true,
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
const WOW_CLASSES = new Set([
  "Death Knight", "Demon Hunter", "Druid", "Evoker", "Hunter", "Mage", "Monk", "Paladin", "Priest",
  "Rogue", "Shaman", "Warlock", "Warrior",
]);
const EXTERNAL_REASONS = new Set([
  "PROVIDES_BLOODLUST", "PROVIDES_BATTLE_REZ", "BUFFS_INTELLECT", "BUFFS_ATTACK_POWER",
  "AMPLIFIES_MAGICAL_DAMAGE", "AMPLIFIES_PHYSICAL_DAMAGE", "ADDS_CLASS_BUFF",
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
    || !(value.upgradeTrack === undefined || value.upgradeTrack === null || string(value.upgradeTrack, 64))
    || typeof value.voidcoreState !== "string" || !VOIDCORE.has(value.voidcoreState)) return null;
  if (value.iconUrl !== null) {
    try { if (new URL(value.iconUrl).protocol !== "https:") return null; } catch { return null; }
  }
  return {
    itemId: value.itemId, itemName: value.itemName as string | null, iconUrl: value.iconUrl as string | null,
    tier: value.tier, variantKey: value.variantKey, voidcoreState: value.voidcoreState as KeystonePlannerObjective["voidcoreState"],
    ...(typeof value.upgradeTrack === "string" ? { upgradeTrack: value.upgradeTrack } : {}),
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

function parseExternalClassCandidate(value: unknown): KeystonePlannerExternalClassCandidate | null {
  if (!record(value) || typeof value.wowClass !== "string" || !WOW_CLASSES.has(value.wowClass)
    || !Array.isArray(value.contributions) || value.contributions.length > 16
    || !Array.isArray(value.reasonCodes) || value.reasonCodes.length > 16
    || !value.reasonCodes.every(reason => typeof reason === "string" && EXTERNAL_REASONS.has(reason))) return null;
  const contributions = value.contributions.map(contribution => record(contribution)
    && string(contribution.capabilityId, 64)
    && (contribution.availability === "guaranteed" || contribution.availability === "conditional")
    ? { capabilityId: contribution.capabilityId, availability: contribution.availability }
    : null);
  if (contributions.some(contribution => contribution === null)
    || new Set(contributions.map(contribution => contribution?.capabilityId)).size !== contributions.length
    || new Set(value.reasonCodes).size !== value.reasonCodes.length) return null;
  return {
    wowClass: value.wowClass,
    contributions: contributions as KeystonePlannerExternalClassCandidate["contributions"],
    reasonCodes: value.reasonCodes as KeystonePlannerExternalClassCandidate["reasonCodes"],
  };
}

function parseTierContribution(value: unknown): KeystonePlannerVacancy["defensiveContribution"] | null {
  const tiers = ["S", "A", "B", "C"] as const;
  if (!record(value) || !record(value.tiers)) return null;
  const tierValues = value.tiers;
  if (Object.keys(tierValues).length !== tiers.length
    || !tiers.every(tier => integer(tierValues[tier])) || !Array.isArray(value.reasons)
    || value.reasons.length > 8 || !value.reasons.every(reason => string(reason, 256))) return null;
  return {
    tiers: Object.fromEntries(tiers.map(tier => [tier, tierValues[tier]])) as Record<typeof tiers[number], number>,
    reasons: value.reasons as string[],
  };
}

function parseVacancyCapability(value: unknown) {
  if (!record(value) || !string(value.capabilityId, 64) || !string(value.name, 128)
    || !integer(value.spellId, 1)
    || (value.availability !== "guaranteed" && value.availability !== "conditional")) return null;
  return {
    capabilityId: value.capabilityId,
    name: value.name,
    spellId: value.spellId,
    availability: value.availability,
  } as const;
}

function parseAdvancedUtilities(value: unknown): KeystonePlannerAdvancedUtilityCapability[] | null {
  if (!Array.isArray(value) || value.length > 64) return null;
  const parsed = value.map(item => {
    const capability = parseVacancyCapability(item);
    if (!capability || !record(item) || !["S", "A", "B", "C"].includes(String(item.tier))
      || !integer(item.relevance) || item.relevance > 3 || !integer(item.score)) return null;
    return { ...capability, tier: item.tier as "S" | "A" | "B" | "C", relevance: item.relevance, score: item.score };
  });
  return parsed.some(item => item === null) ? null : parsed as KeystonePlannerAdvancedUtilityCapability[];
}

function parseVacancyRecommendations(value: unknown, mode: "quick" | "advanced") {
  if (!Array.isArray(value) || value.length === 0 || value.length > 40) return null;
  const parsed = value.map(item => {
    if (!record(item) || !string(item.id, 160) || typeof item.wowClass !== "string"
      || !WOW_CLASSES.has(item.wowClass) || typeof item.offensiveGainPct !== "number"
      || !Number.isFinite(item.offensiveGainPct) || item.offensiveGainPct < 0
      || !Array.isArray(item.buffsDebuffs) || item.buffsDebuffs.length > 16
      || !Array.isArray(item.utilities) || item.utilities.length > 16) return null;
    if (mode === "advanced"
      ? !integer(item.specId, 1) || !string(item.specName, 128)
      : item.specId !== undefined || item.specName !== undefined) return null;
    if (item.damageProfile !== undefined
      && !["physical", "magical", "mixed", "unknown"].includes(String(item.damageProfile))) return null;
    const buffsDebuffs = item.buffsDebuffs.map(parseVacancyCapability);
    const utilities = item.utilities.map(parseVacancyCapability);
    const groupDefensives = item.groupDefensives === undefined ? undefined : parseAdvancedUtilities(item.groupDefensives);
    const dungeonUtilities = item.dungeonUtilities === undefined ? undefined : parseAdvancedUtilities(item.dungeonUtilities);
    if (buffsDebuffs.some(capability => capability === null) || utilities.some(capability => capability === null)
      || groupDefensives === null || dungeonUtilities === null) return null;
    return {
      id: item.id, wowClass: item.wowClass,
      ...(mode === "advanced" ? { specId: item.specId as number, specName: item.specName as string } : {}),
      ...(item.damageProfile !== undefined ? { damageProfile: item.damageProfile as KeystonePlannerVacancyRecommendation["damageProfile"] } : {}),
      offensiveGainPct: item.offensiveGainPct,
      buffsDebuffs,
      utilities,
      ...(groupDefensives ? { groupDefensives } : {}),
      ...(dungeonUtilities ? { dungeonUtilities } : {}),
    } as KeystonePlannerVacancyRecommendation;
  });
  if (parsed.some(item => item === null)) return null;
  const recommendations = parsed as KeystonePlannerVacancyRecommendation[];
  return new Set(recommendations.map(item => item.id)).size === recommendations.length ? recommendations : null;
}

function parseModernVacancy(value: Record<string, unknown>): Partial<KeystonePlannerVacancy> | null {
  if (value.recommendationMode !== "quick" && value.recommendationMode !== "advanced") return null;
  if (typeof value.recommendedClass !== "string" || !WOW_CLASSES.has(value.recommendedClass)
    || typeof value.offensiveGainPct !== "number" || !Number.isFinite(value.offensiveGainPct)
    || value.offensiveGainPct < 0 || !integer(value.offensiveBand)
    || !integer(value.defensiveBand) || !integer(value.dungeonUtilityBand)
    || !Array.isArray(value.offensiveReasons) || value.offensiveReasons.length > 8
    || !value.offensiveReasons.every(reason => string(reason, 256))
    || !Array.isArray(value.offensiveProvenance) || value.offensiveProvenance.length > 5) return null;
  if (value.recommendationMode === "advanced"
    ? !integer(value.recommendedSpecId, 1) || !string(value.recommendedSpecName, 128)
    : value.recommendedSpecId !== undefined || value.recommendedSpecName !== undefined) return null;
  const provenance = value.offensiveProvenance.map(item => {
    if (!record(item) || !integer(item.specId, 1)
      || !["simc", "archetype_estimate"].includes(String(item.source))
      || !["high", "medium", "low"].includes(String(item.confidence))
      || (item.method !== undefined && !string(item.method, 128))
      || (item.donorSpecIds !== undefined && (!Array.isArray(item.donorSpecIds)
        || item.donorSpecIds.length > 32 || !item.donorSpecIds.every(id => integer(id, 1))))) return null;
    return {
      specId: item.specId,
      source: item.source as "simc" | "archetype_estimate",
      confidence: item.confidence as "high" | "medium" | "low",
      ...(item.method === undefined ? {} : { method: item.method as string }),
      ...(item.donorSpecIds === undefined ? {} : { donorSpecIds: item.donorSpecIds as number[] }),
    };
  });
  const defensiveContribution = parseTierContribution(value.defensiveContribution);
  const dungeonUtilityContribution = parseTierContribution(value.dungeonUtilityContribution);
  const recommendations = value.recommendations === undefined
    ? undefined : parseVacancyRecommendations(value.recommendations, value.recommendationMode);
  if (provenance.some(item => item === null) || !defensiveContribution || !dungeonUtilityContribution
    || recommendations === null) return null;
  return {
    recommendationMode: value.recommendationMode,
    recommendedClass: value.recommendedClass,
    ...(value.recommendationMode === "advanced" ? {
      recommendedSpecId: value.recommendedSpecId as number,
      recommendedSpecName: value.recommendedSpecName as string,
    } : {}),
    offensiveGainPct: value.offensiveGainPct,
    offensiveBand: value.offensiveBand,
    offensiveReasons: value.offensiveReasons as string[],
    offensiveProvenance: provenance as NonNullable<KeystonePlannerVacancy["offensiveProvenance"]>,
    defensiveContribution,
    defensiveBand: value.defensiveBand,
    dungeonUtilityContribution,
    dungeonUtilityBand: value.dungeonUtilityBand,
    ...(recommendations ? { recommendations } : {}),
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
  const vacancies = value.vacancies.map(item => {
    if (!record(item) || typeof item.role !== "string" || !ROLES.has(item.role)
      || !Array.isArray(item.preferredCapabilities)
      || !item.preferredCapabilities.every(cap => string(cap, 64))) return null;
    let candidateClasses: KeystonePlannerExternalClassCandidate[] | undefined;
    if (item.candidateClasses !== undefined) {
      if (!Array.isArray(item.candidateClasses) || item.candidateClasses.length > 13) return null;
      const parsedCandidates = item.candidateClasses.map(parseExternalClassCandidate);
      if (parsedCandidates.some(candidate => candidate === null)
        || new Set(parsedCandidates.map(candidate => candidate?.wowClass)).size !== parsedCandidates.length) return null;
      candidateClasses = parsedCandidates as KeystonePlannerExternalClassCandidate[];
    }
    const modern = item.recommendationMode === undefined ? {} : parseModernVacancy(item);
    if (modern === null) return null;
    return {
      role: item.role as KeystonePlannerRole,
      preferredCapabilities: item.preferredCapabilities as string[],
      ...(candidateClasses ? { candidateClasses } : {}),
      ...modern,
    };
  });
  const capabilities = value.compositionSummary.uniqueCapabilities.map(item => parseCapability(item, true));
  const groupDefensives = value.compositionSummary.groupDefensives === undefined
    ? undefined : parseAdvancedUtilities(value.compositionSummary.groupDefensives);
  const dungeonUtilities = value.compositionSummary.dungeonUtilities === undefined
    ? undefined : parseAdvancedUtilities(value.compositionSummary.dungeonUtilities);
  const rawArmor = value.compositionSummary.armorSynergy;
  const armorTypes = ["cloth", "leather", "mail", "plate"] as const;
  const armor = rawArmor === undefined
    ? { pairs: 0, dominantType: null, counts: { cloth: 0, leather: 0, mail: 0, plate: 0 } }
    : rawArmor;
  const armorCounts = record(armor) && record(armor.counts) ? armor.counts : null;
  const counts = [
    value.lootSummary.weightedScore, value.lootSummary.playersWithObjectives, value.lootSummary.totalObjectives,
    value.lootSummary.tierCounts.bestInSlot, value.lootSummary.tierCounts.mustHave,
    value.lootSummary.tierCounts.niceToHave, value.lootSummary.tierCounts.catalyst,
    value.lootSummary.tierCounts.transmog, value.levelSummary.targetLevel, value.levelSummary.stoneLevel,
    value.levelSummary.levelDistance, value.preferenceSummary.preferred, value.preferenceSummary.available,
    value.preferenceSummary.emergency, value.compositionSummary.magicalDpsCount,
    value.compositionSummary.physicalDpsCount, value.compositionSummary.unknownDpsCount,
    value.compositionSummary.chaosBrandBeneficiaries, value.compositionSummary.mysticTouchBeneficiaries,
    value.compositionSummary.uniqueClassBuffCount, value.compositionSummary.criticalRolesCovered ?? 0,
  ];
  if (assignments.some(item => item === null) || vacancies.some(item => item === null)
    || capabilities.some(item => item === null) || !value.reasonCodes.every(reason => typeof reason === "string" && REASONS.has(reason))
    || groupDefensives === null || dungeonUtilities === null
    || counts.some(count => !integer(count))
    || typeof value.compositionSummary.bloodlust !== "string" || !AVAILABILITY.has(value.compositionSummary.bloodlust)
    || typeof value.compositionSummary.battleRez !== "string" || !AVAILABILITY.has(value.compositionSummary.battleRez)
    || !["physical", "magical", "mixed", "unknown"].includes(String(value.compositionSummary.damageProfile))
    || !record(armor) || !integer(armor.pairs)
    || ![...armorTypes, null].includes(armor.dominantType as typeof armorTypes[number] | null)
    || armorCounts === null || !armorTypes.every(type => integer(armorCounts[type]))) return null;
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
      criticalRolesCovered: (value.compositionSummary.criticalRolesCovered ?? 0) as number,
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
      armorSynergy: {
        pairs: armor.pairs as number,
        dominantType: armor.dominantType as KeystonePlannerRecommendation["compositionSummary"]["armorSynergy"]["dominantType"],
        counts: {
          cloth: armorCounts.cloth as number, leather: armorCounts.leather as number,
          mail: armorCounts.mail as number, plate: armorCounts.plate as number,
        },
      },
      ...(groupDefensives ? { groupDefensives } : {}),
      ...(dungeonUtilities ? { dungeonUtilities } : {}),
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
  const optionKeys = new Set(Object.keys(request.options));
  const requiredOptionKeys = [
    "optimizeComposition", "fillComposition", "recommendationMode", "bloodlust", "battleRez", "offensiveSynergy",
    "groupDefense", "dungeonUtility",
  ];
  return participants.length >= 2 && participants.length <= 5 && participants.every(id => integer(id, 1))
    && new Set(participants).size === participants.length && integer(request.targetLevel, 1) && request.targetLevel <= 20
    && integer(request.challengeMapId, 1) && integer(request.stoneCharacterId, 1)
    && optionKeys.size === requiredOptionKeys.length && requiredOptionKeys.every(key => optionKeys.has(key))
    && ["quick", "advanced"].includes(request.options.recommendationMode)
    && Object.entries(request.options).every(([key, value]) => key === "recommendationMode"
      ? typeof value === "string" : typeof value === "boolean")
    && request.locks.length <= 15;
}

export async function getKeystonePlanner(
  teamId: number, request: KeystonePlannerRequest, locale: "es_ES" | "en_US" = "es_ES",
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
    locale,
  });
  const parsed = parseKeystonePlannerResponse(raw, teamId, request);
  if (!parsed) throw error("INVALID_PLANNER_RESPONSE", "La respuesta del Planner no es válida.");
  return parsed;
}
