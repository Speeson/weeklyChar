import type { TeamsDataSource } from "./teams";
import type {
  ClientPlannerPreferences, ClientTeamDetail, ClientTeamSummary, KeystoneSelectorObjective, KeystoneSelectorResponse,
  KeystoneSelectorTierCounts, KeystonePlannerAssignment, KeystonePlannerRecommendation,
  KeystonePlannerRequest, KeystonePlannerResponse, KeystonePlannerRole,
} from "./types";
import { WOW_SPECIALIZATIONS } from "./wowSpecs";

const tiers = (overrides: Partial<KeystoneSelectorTierCounts> = {}): KeystoneSelectorTierCounts => ({
  bestInSlot: 0, mustHave: 0, niceToHave: 0, catalyst: 0, transmog: 0, other: 0, ...overrides,
});

const objective = (itemId: number, tier: number, overrides: Partial<KeystoneSelectorObjective> = {}): KeystoneSelectorObjective => ({
  itemId, itemName: `Echo de Medianoche ${itemId}`, iconUrl: null, tier, specIds: [62], sourceType: "dungeon",
  sourceId: 399, slotId: 16, slotName: "Mano principal", itemClassName: "Arma", itemSubClassName: "Báculo",
  statNames: ["Intelecto", "Aguante", "Celeridad", "Maestría"],
  primaryStatNames: ["Intelecto", "Aguante"], secondaryStatNames: ["Celeridad", "Maestría"],
  otherStatNames: [], qualityType: "EPIC", itemLevel: 402, variantKey: `preview:${itemId}`,
  voidcoreState: "pending", ...overrides,
});

const primaryTeam: ClientTeamSummary = { id: 7, name: "Mythiqueros 2.0", memberCount: 8 };
const secondTeam: ClientTeamSummary = { id: 8, name: "Exploradores de la Medianoche", memberCount: 2 };
const thirdTeam: ClientTeamSummary = { id: 9, name: "Pushers Nocturnos", memberCount: 4 };
const fourthTeam: ClientTeamSummary = { id: 10, name: "Alter Team Semanal con nombre muy largo", memberCount: 8 };

const primaryDetail: ClientTeamDetail = {
  id: 7, name: primaryTeam.name, members: [
    { userId: 1, username: "Speeson", plannerConfigured: true, characters: [
      { characterId: 10, name: "Bakuhatsu", realm: "Zul'jin", region: "eu", wowClass: "Mage", avatarUrl: null, ilvl: 318, rioScore: 3280, currentKeystone: { level: 12, challengeMapId: 399, dungeon: "Ruby Life Pools" } },
      { characterId: 11, name: "Makabe", realm: "Zul'jin", region: "eu", wowClass: "Warrior", avatarUrl: null, ilvl: 315, rioScore: 3100, currentKeystone: { level: 10, challengeMapId: 250, dungeon: "Temple of Sethraliss" } },
    ] },
    { userId: 2, username: "GuardianaDeLosSecretosDelVacío", plannerConfigured: true, characters: [
      { characterId: 12, name: "Auralisdelaluzeterna", realm: "Dun Modr", region: "eu", wowClass: "Paladin", avatarUrl: null, ilvl: 312, rioScore: 2990, currentKeystone: { level: 9, challengeMapId: 399, dungeon: "Ruby Life Pools" } },
    ] },
    { userId: 3, username: "Ana", plannerConfigured: true, characters: [
      { characterId: 13, name: "Leafsong", realm: "Sanguino", region: "eu", wowClass: "Druid", avatarUrl: null, ilvl: 309, rioScore: 2800, currentKeystone: { level: 8, challengeMapId: 585, dungeon: "Voidscar Arena" } },
    ] },
    { userId: 4, username: "Voidwalker", plannerConfigured: true, characters: [
      { characterId: 14, name: "Umbrael", realm: "Minahonda", region: "eu", wowClass: "Warlock", avatarUrl: null, ilvl: 305, rioScore: 2600, currentKeystone: null },
    ] },
    { userId: 5, username: "Frostbyte", plannerConfigured: true, characters: [
      { characterId: 15, name: "Glaciera", realm: "Exodar", region: "eu", wowClass: "Shaman", avatarUrl: null, ilvl: 303, rioScore: 2500, currentKeystone: { level: 7, challengeMapId: 588, dungeon: "Altar of Fangs" } },
    ] },
    { userId: 6, username: "Nightshift", plannerConfigured: true, characters: [
      { characterId: 16, name: "Nocturna", realm: "C'Thun", region: "eu", wowClass: "Priest", avatarUrl: null, ilvl: 301, rioScore: 2420, currentKeystone: null },
    ] },
    { userId: 7, username: "Ironforge", plannerConfigured: true, characters: [
      { characterId: 17, name: "Cogspinner", realm: "Dun Modr", region: "eu", wowClass: "Rogue", avatarUrl: null, ilvl: 300, rioScore: 2390, currentKeystone: null },
    ] },
    { userId: 8, username: "Moonkeeper", plannerConfigured: true, characters: [
      { characterId: 18, name: "Lunarglade", realm: "Sanguino", region: "eu", wowClass: "Hunter", avatarUrl: null, ilvl: 298, rioScore: 2310, currentKeystone: null },
    ] },
  ],
};

const secondDetail: ClientTeamDetail = { id: 8, name: secondTeam.name, members: primaryDetail.members.slice(0, 2) };
const characterObjectives = [
  objective(231001, 3, { specIds: [62, 64], itemName: null }),
  objective(231002, 3, { specIds: [62], variantKey: "preview:231002:epic", itemLevel: 402, qualityType: "EPIC" }),
  objective(231002, 2, { specIds: [62, 64], variantKey: "preview:231002:rare", itemLevel: 389, qualityType: "RARE" }),
  objective(231004, 2, { specIds: [64], iconUrl: "https://render.worldofwarcraft.com/eu/icons/56/inv_staff_2h_etherealraid_d_01.jpg", qualityType: "RARE" }),
  objective(231005, 1, { specIds: [62] }), objective(231006, 5, { specIds: [64] }),
  objective(231007, 4, { specIds: [62, 64] }), objective(231008, 99, { specIds: [62] }),
  objective(231009, 3, { specIds: [62, 64], voidcoreState: "completed_with_voidcore" }),
  objective(231010, 2, { specIds: [64], voidcoreState: "voidcore_not_checked", slotName: null, itemClassName: null, itemSubClassName: null, statNames: [], primaryStatNames: [], secondaryStatNames: [], otherStatNames: [], qualityType: null }),
];

const fullSelector: KeystoneSelectorResponse = {
  teamId: 7, challengeMapId: 399,
  availability: { stoneCount: 2, stones: [
    { characterId: 10, characterName: "Bakuhatsu", ownerUserId: 1, ownerUsername: "Speeson", level: 12 },
    { characterId: 12, characterName: "Auralisdelaluzeterna", ownerUserId: 2, ownerUsername: "GuardianaDeLosSecretosDelVacío", level: 9 },
  ] },
  summary: { charactersWithObjectives: 8, totalObjectives: 28, tiers: tiers({ bestInSlot: 9, mustHave: 7, niceToHave: 4, catalyst: 3, transmog: 1, other: 4 }) },
  characters: [
    { userId: 1, username: "Speeson", characterId: 10, characterName: "Bakuhatsu", realm: "Zul'jin", region: "eu", wowClass: "Mage", avatarUrl: null, ilvl: 318, rioScore: 3280, totalObjectives: 10, tierCounts: tiers({ bestInSlot: 3, mustHave: 3, niceToHave: 1, catalyst: 1, transmog: 1, other: 1 }), specs: [
      { specId: 62, objectiveCount: 7, tierCounts: tiers({ bestInSlot: 3, mustHave: 2, niceToHave: 1, transmog: 1 }) },
      { specId: 64, objectiveCount: 6, tierCounts: tiers({ bestInSlot: 2, mustHave: 3, catalyst: 1 }) },
    ], objectives: characterObjectives },
    { userId: 2, username: "GuardianaDeLosSecretosDelVacío", characterId: 12, characterName: "Auralisdelaluzeterna", realm: "Dun Modr", region: "eu", wowClass: "Paladin", avatarUrl: null, ilvl: 312, rioScore: 2990, totalObjectives: 5, tierCounts: tiers({ bestInSlot: 1, mustHave: 1, niceToHave: 1, catalyst: 1, other: 1 }), specs: [{ specId: 70, objectiveCount: 5, tierCounts: tiers({ bestInSlot: 1, mustHave: 1, niceToHave: 1, catalyst: 1, other: 1 }) }], objectives: [objective(232001, 3, { specIds: [70] }), objective(232002, 2, { specIds: [70] }), objective(232003, 1, { specIds: [70] }), objective(232004, 5, { specIds: [70] }), objective(232005, 88, { specIds: [70] })] },
    { userId: 3, username: "Ana", characterId: 13, characterName: "Leafsong", realm: "Sanguino", region: "eu", wowClass: "Druid", avatarUrl: null, ilvl: 309, rioScore: 2800, totalObjectives: 2, tierCounts: tiers({ bestInSlot: 1, other: 1 }), specs: [{ specId: 102, objectiveCount: 2, tierCounts: tiers({ bestInSlot: 1, other: 1 }) }], objectives: [objective(233001, 3, { specIds: [102] }), objective(233002, 77, { specIds: [102], itemName: null, slotName: null, itemClassName: null, itemSubClassName: null, statNames: [], primaryStatNames: [], secondaryStatNames: [], otherStatNames: [], qualityType: null })] },
    { userId: 4, username: "Voidwalker", characterId: 14, characterName: "Umbrael", realm: "Minahonda", region: "eu", wowClass: "Warlock", avatarUrl: null, ilvl: 305, rioScore: 2600, totalObjectives: 4, tierCounts: tiers({ bestInSlot: 1, mustHave: 2, catalyst: 1 }), specs: [{ specId: 267, objectiveCount: 4, tierCounts: tiers({ bestInSlot: 1, mustHave: 2, catalyst: 1 }) }], objectives: [objective(234001, 3, { specIds: [267] }), objective(234002, 2, { specIds: [267] }), objective(234003, 2, { specIds: [267] }), objective(234004, 5, { specIds: [267] })] },
    { userId: 5, username: "Frostbyte", characterId: 15, characterName: "Glaciera", realm: "Exodar", region: "eu", wowClass: "Shaman", avatarUrl: null, ilvl: 303, rioScore: 2500, totalObjectives: 3, tierCounts: tiers({ bestInSlot: 1, mustHave: 1, niceToHave: 1 }), specs: [{ specId: 262, objectiveCount: 3, tierCounts: tiers({ bestInSlot: 1, mustHave: 1, niceToHave: 1 }) }], objectives: [objective(235001, 3, { specIds: [262] }), objective(235002, 2, { specIds: [262] }), objective(235003, 1, { specIds: [262] })] },
    { userId: 6, username: "Nightshift", characterId: 16, characterName: "Nocturna", realm: "C'Thun", region: "eu", wowClass: "Priest", avatarUrl: null, ilvl: 301, rioScore: 2420, totalObjectives: 2, tierCounts: tiers({ bestInSlot: 1, other: 1 }), specs: [{ specId: 258, objectiveCount: 2, tierCounts: tiers({ bestInSlot: 1, other: 1 }) }], objectives: [objective(236001, 3, { specIds: [258] }), objective(236002, 88, { specIds: [258] })] },
    { userId: 7, username: "Ironforge", characterId: 17, characterName: "Cogspinner", realm: "Dun Modr", region: "eu", wowClass: "Rogue", avatarUrl: null, ilvl: 300, rioScore: 2390, totalObjectives: 1, tierCounts: tiers({ mustHave: 1 }), specs: [{ specId: 260, objectiveCount: 1, tierCounts: tiers({ mustHave: 1 }) }], objectives: [objective(237001, 2, { specIds: [260] })] },
    { userId: 8, username: "Moonkeeper", characterId: 18, characterName: "Lunarglade", realm: "Sanguino", region: "eu", wowClass: "Hunter", avatarUrl: null, ilvl: 298, rioScore: 2310, totalObjectives: 1, tierCounts: tiers({ catalyst: 1 }), specs: [{ specId: 253, objectiveCount: 1, tierCounts: tiers({ catalyst: 1 }) }], objectives: [objective(238001, 5, { specIds: [253] })] },
  ],
};

function plannerAssignment(userId: number, username: string, characterId: number, characterName: string, wowClass: string, specId: number, role: KeystonePlannerRole, itemId: number): KeystonePlannerAssignment {
  const objectiveTiers = characterId === 10 ? [3, 2, 1, 5, 4, 88, 3] : [itemId % 3 === 0 ? 3 : 2];
  return {
    userId, username, characterId, characterName, wowClass, specId, role, lootSpecId: specId,
    playPreference: "preferred",
    objectives: objectiveTiers.map((tier, index) => ({ itemId: itemId + index, itemName: `Eco de Medianoche ${itemId + index}`, iconUrl: null, tier, variantKey: `planner:${itemId + index}`, voidcoreState: "pending" })),
    capabilities: [],
  };
}

const previewPlannerParty: KeystonePlannerAssignment[] = [
  plannerAssignment(2, "GuardianaDeLosSecretosDelVacío", 12, "Auralisdelaluzeterna", "Paladin", 66, "tank", 241002),
  plannerAssignment(6, "Nightshift", 16, "Nocturna", "Priest", 257, "healer", 241006),
  plannerAssignment(1, "Speeson", 10, "Bakuhatsu", "Mage", 62, "dps", 241001),
  plannerAssignment(4, "Voidwalker", 14, "Umbrael", "Warlock", 267, "dps", 241004),
  { ...plannerAssignment(7, "Ironforge", 17, "Cogspinner", "Rogue", 260, "dps", 241007), objectives: [] },
];

let previewPreferences: ClientPlannerPreferences = { preferences: [
  { characterId: 10, specId: 62, role: "dps", playPreference: "preferred", lootSpecId: 62, updatedAt: "2026-09-11T00:00:00Z" },
  { characterId: 10, specId: 63, role: "dps", playPreference: "available", lootSpecId: 63, updatedAt: "2026-09-11T00:00:00Z" },
] };

function previewPlannerRecommendation(rank: number, request: KeystonePlannerRequest): KeystonePlannerRecommendation {
  const stone = fullSelector.availability.stones.find(item => item.characterId === request.stoneCharacterId) ?? fullSelector.availability.stones[0];
  return {
    rank, fingerprint: `preview-${rank}-${stone.characterId}`,
    stone: { ...stone, challengeMapId: request.challengeMapId, dungeon: "Ruby Life Pools" },
    assignments: previewPlannerParty, vacancies: [],
    lootSummary: { weightedScore: 128 - rank * 7, playersWithObjectives: 5, totalObjectives: previewPlannerParty.reduce((total, assignment) => total + assignment.objectives.length, 0), tierCounts: { bestInSlot: 2, mustHave: 3, niceToHave: 1, catalyst: 1, transmog: 1 } },
    levelSummary: { targetLevel: request.targetLevel, stoneLevel: stone.level, levelDistance: Math.abs(request.targetLevel - stone.level) },
    preferenceSummary: { preferred: 5, available: 0, emergency: 0 },
    compositionSummary: {
      bloodlust: "guaranteed", battleRez: "guaranteed", damageProfile: "mixed",
      magicalDpsCount: 2, physicalDpsCount: 1, unknownDpsCount: 0, chaosBrandBeneficiaries: 2,
      mysticTouchBeneficiaries: 1, uniqueClassBuffCount: 2,
      uniqueCapabilities: [
        { capabilityId: "bloodlust", name: "Ansia de sangre", type: "major_utility", iconSpellId: 2825, stacking: "unique", availability: "guaranteed" },
        { capabilityId: "battle_rez", name: "Resurrección en combate", type: "major_utility", iconSpellId: 20484, stacking: "unique", availability: "guaranteed" },
        { capabilityId: "arcane_intellect", name: "Intelecto Arcano", type: "class_buff", iconSpellId: 1459, stacking: "unique", availability: "guaranteed" },
        { capabilityId: "power_word_fortitude", name: "Palabra de poder: entereza", type: "class_buff", iconSpellId: 21562, stacking: "unique", availability: "guaranteed" },
      ],
    },
    reasonCodes: ["PARTY_COMPLETE", "HAS_LOOT_OBJECTIVES", "TARGET_LEVEL_EXACT", "BLOODLUST_GUARANTEED", "BATTLE_REZ_PRESENT"],
  };
}

function previewPlanner(request: KeystonePlannerRequest): KeystonePlannerResponse {
  return {
    teamId: 7, challengeMapId: request.challengeMapId, targetLevel: request.targetLevel,
    availability: { eligibleStoneCount: 1 }, status: "ok",
    diagnostics: { codes: [], unconfiguredUserIds: [], lockIssues: [] },
    recommendations: [1, 2, 3, 4, 5].map(rank => previewPlannerRecommendation(rank, request)),
  };
}

function selectorForDungeon(challengeMapId: number, language: "es" | "en"): KeystoneSelectorResponse {
  const localized = language === "en"
    ? {
        ...fullSelector,
        characters: fullSelector.characters.map(character => ({
          ...character,
          objectives: character.objectives.map(item => ({
            ...item,
            itemName: item.itemName?.replace("Echo de Medianoche", "Midnight Echo") ?? null,
            slotName: item.slotName ? "Main Hand" : null,
            itemClassName: item.itemClassName ? "Weapon" : null,
            itemSubClassName: item.itemSubClassName ? "Staff" : null,
            statNames: item.statNames.length > 0 ? ["Intellect", "Stamina", "Haste", "Mastery"] : [],
            primaryStatNames: item.primaryStatNames.length > 0 ? ["Intellect", "Stamina"] : [],
            secondaryStatNames: item.secondaryStatNames.length > 0 ? ["Haste", "Mastery"] : [],
          })),
        })),
      }
    : fullSelector;
  if (challengeMapId === 399) return localized;
  return { ...fullSelector, challengeMapId, availability: { stoneCount: 0, stones: [] }, summary: { charactersWithObjectives: 0, totalObjectives: 0, tiers: tiers() }, characters: [] };
}

export function getTeamsPreviewDataSource(): TeamsDataSource | null {
  if (!import.meta.env.DEV) return null;
  const params = new URLSearchParams(window.location.search);
  const scenario = params.get("preview");
  const language = params.get("lang") === "en" ? "en" : "es";
  if (!scenario?.startsWith("teams-")) return null;
  const list = scenario === "teams-empty" ? [] : scenario === "teams-multiple" ? [primaryTeam, secondTeam, thirdTeam, fourthTeam] : [primaryTeam];
  return {
    listTeams: async () => scenario === "teams-cold-loading"
      ? new Promise<ClientTeamSummary[]>(() => undefined)
      : list,
    getTeam: async teamId => teamId === 8 ? secondDetail : scenario === "teams-planner-unconfigured"
      ? { ...primaryDetail, members: primaryDetail.members.map(member => member.userId === 1 ? { ...member, username: "Spee", plannerConfigured: false, characters: member.characters.map((character, index) => index === 0 ? { ...character, wowClass: "Druid" } : character) } : member) }
      : primaryDetail,
    getKeystoneSelector: async (_teamId, challengeMapId) => {
      if (scenario === "teams-selector-loading") return new Promise<KeystoneSelectorResponse>(() => undefined);
      if (scenario === "teams-selector-error") throw { code: "API_UNAVAILABLE", message: "La API no está disponible." };
      if (scenario === "teams-selector-empty") return selectorForDungeon(challengeMapId, language);
      return selectorForDungeon(challengeMapId, language);
    },
    getKeystonePlanner: async (_teamId, request) => previewPlanner(request),
    getPlannerPreferences: async () => scenario === "teams-planner-unconfigured" ? { preferences: [] } : previewPreferences,
    updatePlannerPreferences: async preferences => {
      previewPreferences = { preferences: preferences.map(preference => ({
        ...preference,
        role: WOW_SPECIALIZATIONS.find(spec => spec.id === preference.specId)?.role ?? "dps",
        updatedAt: "2026-09-11T00:00:00Z",
      })) };
      return previewPreferences;
    },
  };
}

export const TEAMS_PREVIEW_SCENARIOS = [
  "teams-default", "teams-cold-loading", "teams-multiple", "teams-empty", "teams-selector-full", "teams-selector-multispec",
  "teams-selector-empty", "teams-selector-loading", "teams-selector-error",
  "teams-planner", "teams-planner-unconfigured",
] as const;
