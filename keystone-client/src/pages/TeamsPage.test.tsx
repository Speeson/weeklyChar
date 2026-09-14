import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider, type Language } from "../core/i18n";
import type { TeamsDataSource } from "../core/teams";
import {
  clearTeamsSessionCache, loadTeamDetail, loadTeams, setSelectedTeamId,
} from "../core/teamsSessionCache";
import type { ClientPlannerPreference, ClientPlannerPreferenceUpdate, ClientPlannerPreferences, ClientTeamDetail, KeystonePlannerResponse, KeystonePlannerVacancyRecommendation, KeystoneSelectorObjective, KeystoneSelectorResponse } from "../core/types";
import { renderWithTheme } from "../test/renderWithTheme";
import { TeamsPage } from "./TeamsPage";

const tiers = { bestInSlot: 1, mustHave: 1, niceToHave: 1, catalyst: 1, transmog: 1, other: 1 };
const objective = (itemId: number, tier: number, overrides: Partial<KeystoneSelectorObjective> = {}): KeystoneSelectorObjective => ({
  itemId, itemName: `Objeto ${itemId}`, iconUrl: null, tier, specIds: [62], sourceType: "dungeon", sourceId: 399,
  slotId: 16, slotName: "Mano principal", itemClassName: "Arma", itemSubClassName: "Báculo",
  statNames: ["Intelecto", "Celeridad"], primaryStatNames: ["Intelecto"],
  secondaryStatNames: ["Celeridad"], otherStatNames: [], qualityType: "EPIC",
  itemLevel: 402, variantKey: `test:${itemId}`,
  voidcoreState: "pending", ...overrides,
});

const detail: ClientTeamDetail = {
  id: 7, name: "Mythiqueros 2.0", members: [
    { userId: 2, username: "Speeson", plannerConfigured: true, characters: [
      { characterId: 10, name: "Bakuhatsu", realm: "Zul'jin", region: "eu", wowClass: "Mage", avatarUrl: null, ilvl: 300, rioScore: 2500, currentKeystone: { level: 12, challengeMapId: 399, dungeon: "Ruby Life Pools" } },
      { characterId: 11, name: "Makabe", realm: "Zul'jin", region: "eu", wowClass: "Warrior", avatarUrl: null, ilvl: 299, rioScore: 2400, currentKeystone: { level: 10, challengeMapId: 250, dungeon: "Temple of Sethraliss" } },
    ] },
    { userId: 3, username: "Ana con un nombre largo", plannerConfigured: true, characters: [
      { characterId: 12, name: "Spee", realm: "Dun Modr", region: "eu", wowClass: "Paladin", avatarUrl: null, ilvl: 295, rioScore: 2300, currentKeystone: { level: 8, challengeMapId: 399, dungeon: "Ruby Life Pools" } },
    ] },
  ],
};

const selector: KeystoneSelectorResponse = {
  teamId: 7, challengeMapId: 399,
  availability: { stoneCount: 2, stones: [
    { characterId: 10, characterName: "Bakuhatsu", ownerUserId: 2, ownerUsername: "Speeson", level: 12 },
    { characterId: 12, characterName: "Spee", ownerUserId: 3, ownerUsername: "Ana", level: 8 },
  ] },
  summary: { charactersWithObjectives: 2, totalObjectives: 7, tiers: { ...tiers, bestInSlot: 2 } },
  characters: [
    { userId: 2, username: "Speeson", characterId: 10, characterName: "Bakuhatsu", realm: "Zul'jin", region: "eu", wowClass: "Mage", avatarUrl: null, ilvl: 300, rioScore: 2500, totalObjectives: 6, tierCounts: tiers,
      specs: [{ specId: 62, objectiveCount: 4, tierCounts: tiers }, { specId: 64, objectiveCount: 2, tierCounts: { ...tiers, bestInSlot: 0 } }],
      objectives: [objective(1, 3, { specIds: [62, 64], itemName: null }), objective(2, 2), objective(3, 1), objective(4, 5), objective(5, 4), objective(6, 99), objective(7, 3, { voidcoreState: "completed_with_voidcore" })] },
    { userId: 3, username: "Ana", characterId: 12, characterName: "Spee", realm: "Dun Modr", region: "eu", wowClass: "Paladin", avatarUrl: null, ilvl: 295, rioScore: 2300, totalObjectives: 1, tierCounts: { ...tiers, mustHave: 0, niceToHave: 0, catalyst: 0, transmog: 0, other: 0 },
      specs: [{ specId: 70, objectiveCount: 1, tierCounts: tiers }], objectives: [objective(8, 3, { specIds: [70] })] },
  ],
};

function plannerResponse(): KeystonePlannerResponse {
  const candidates = [
    { wowClass: "Druid", contributions: [{ capabilityId: "BATTLE_REZ", availability: "guaranteed" as const }], reasonCodes: ["PROVIDES_BATTLE_REZ" as const] },
    { wowClass: "Evoker", contributions: [{ capabilityId: "BLOODLUST", availability: "guaranteed" as const }], reasonCodes: ["PROVIDES_BLOODLUST" as const] },
    { wowClass: "Mage", contributions: [{ capabilityId: "BLOODLUST", availability: "guaranteed" as const }], reasonCodes: ["PROVIDES_BLOODLUST" as const] },
    { wowClass: "Shaman", contributions: [{ capabilityId: "BLOODLUST", availability: "guaranteed" as const }], reasonCodes: ["PROVIDES_BLOODLUST" as const] },
    { wowClass: "Hunter", contributions: [{ capabilityId: "BLOODLUST", availability: "conditional" as const }], reasonCodes: ["PROVIDES_BLOODLUST" as const] },
  ];
  const assignments = [
    { userId: 3, username: "Ana", characterId: 12, characterName: "Spee", wowClass: "Paladin", specId: 66, role: "tank" as const, lootSpecId: 66, playPreference: "preferred" as const, objectives: [{ itemId: 8, itemName: "Escudo", iconUrl: null, tier: 3, variantKey: "planner:8", voidcoreState: "pending" as const }], capabilities: [] },
    { userId: 2, username: "Speeson", characterId: 10, characterName: "Bakuhatsu", wowClass: "Mage", specId: 62, role: "dps" as const, lootSpecId: 62, playPreference: "preferred" as const, objectives: [{ itemId: 1, itemName: "Báculo", iconUrl: null, tier: 2, variantKey: "planner:1", voidcoreState: "pending" as const }], capabilities: [] },
  ];
  const recommendation = (rank: number) => ({
    rank, fingerprint: `planner-${rank}`,
    stone: { characterId: 10, characterName: "Bakuhatsu", ownerUserId: 2, ownerUsername: "Speeson", challengeMapId: 399, dungeon: "Ruby Life Pools", level: 12 },
    assignments, vacancies: [
      { role: "healer" as const, preferredCapabilities: ["BATTLE_REZ"], candidateClasses: candidates },
      { role: "dps" as const, preferredCapabilities: ["BLOODLUST"], candidateClasses: candidates },
      { role: "dps" as const, preferredCapabilities: [], candidateClasses: candidates },
    ],
    lootSummary: { weightedScore: 100 - rank, playersWithObjectives: 2, totalObjectives: 2, tierCounts: { bestInSlot: 1, mustHave: 1, niceToHave: 0, catalyst: 0, transmog: 0 } },
    levelSummary: { targetLevel: 12, stoneLevel: 12, levelDistance: 0 }, preferenceSummary: { preferred: 2, available: 0, emergency: 0 },
    compositionSummary: { criticalRolesCovered: 1, bloodlust: "guaranteed" as const, battleRez: "none" as const, uniqueCapabilities: [], damageProfile: "magical" as const, magicalDpsCount: 1, physicalDpsCount: 0, unknownDpsCount: 0, chaosBrandBeneficiaries: 1, mysticTouchBeneficiaries: 0, uniqueClassBuffCount: 1, armorSynergy: { pairs: 0, dominantType: null, counts: { cloth: 1, leather: 0, mail: 0, plate: 1 } } },
    reasonCodes: ["PARTY_INCOMPLETE", "HAS_LOOT_OBJECTIVES", "TARGET_LEVEL_EXACT"],
  });
  return { teamId: 7, challengeMapId: 399, targetLevel: 12, availability: { eligibleStoneCount: 1 }, status: "ok", diagnostics: { codes: [], unconfiguredUserIds: [], lockIssues: [] }, recommendations: [1, 2, 3, 4, 5].map(recommendation) };
}

function modernPlannerResponse(mode: "quick" | "advanced"): KeystonePlannerResponse {
  const response = plannerResponse();
  const seeds = [
    ["Warrior", 72, "Fury", 0.045, "BATTLE_SHOUT", "Battle Shout", 6673, "Pummel", 6552],
    ["Mage", 63, "Fire", 0.031, "ARCANE_INTELLECT", "Arcane Intellect", 1459, "Counterspell", 2139],
    ["Druid", 102, "Balance", 0.028, "MARK_OF_THE_WILD", "Mark of the Wild", 1126, "Soothe", 2908],
    ["Monk", 269, "Windwalker", 0.026, "MYSTIC_TOUCH", "Mystic Touch", 113746, "Spear Hand Strike", 116705],
    ["Shaman", 262, "Elemental", 0.024, "SKYFURY", "Skyfury", 462854, "Purge", 370],
  ] as const;
  const alternatives: KeystonePlannerVacancyRecommendation[] = seeds.map(([wowClass, specId, specName, gain, capabilityId, buffName, buffSpellId, utilityName, utilitySpellId]) => ({
    id: `${mode}:${wowClass}:${mode === "advanced" ? specId : "dps"}`, wowClass,
    ...(mode === "advanced" ? { specId, specName } : {}), offensiveGainPct: gain,
    buffsDebuffs: [{ capabilityId, name: buffName, spellId: buffSpellId, availability: "guaranteed" }],
    utilities: [{ capabilityId: "INTERRUPT", name: utilityName, spellId: utilitySpellId, availability: "guaranteed" }],
  }));
  const profiles = ["physical", "magical", "magical", "physical", "magical"] as const;
  alternatives.forEach((alternative, index) => Object.assign(alternative, { damageProfile: profiles[index] }));
  for (const recommendation of response.recommendations) {
    if (mode === "advanced") {
      recommendation.compositionSummary.groupDefensives = [
        { capabilityId: "MAJOR_GROUP_DR", name: "Darkness", spellId: 196718, availability: "conditional", tier: "S", relevance: 3, score: 500 },
        { capabilityId: "EXTERNAL", name: "Zephyr", spellId: 374227, availability: "conditional", tier: "A", relevance: 3, score: 500 },
      ];
      recommendation.compositionSummary.dungeonUtilities = [
        { capabilityId: "INTERRUPT", name: "Pummel", spellId: 6552, availability: "guaranteed", tier: "S", relevance: 3, score: 1000 },
        { capabilityId: "PURGE_MAGIC", name: "Purge", spellId: 370, availability: "guaranteed", tier: "A", relevance: 3, score: 1000 },
        { capabilityId: "SOOTHE", name: "Soothe", spellId: 2908, availability: "guaranteed", tier: "A", relevance: 2, score: 667 },
        { capabilityId: "AOE_STOP", name: "Chaos Nova", spellId: 179057, availability: "conditional", tier: "A", relevance: 2, score: 333 },
        { capabilityId: "DISPEL_CURSE", name: "Remove Curse", spellId: 475, availability: "guaranteed", tier: "B", relevance: 1, score: 333 },
        { capabilityId: "ST_STOP", name: "Imprison", spellId: 217832, availability: "conditional", tier: "B", relevance: 1, score: 167 },
      ];
    }
    for (const vacancy of recommendation.vacancies) {
      vacancy.recommendationMode = mode;
      vacancy.recommendedClass = alternatives[0].wowClass;
      vacancy.offensiveGainPct = alternatives[0].offensiveGainPct;
      vacancy.recommendations = alternatives;
      if (mode === "advanced") {
        vacancy.recommendedSpecId = alternatives[0].specId;
        vacancy.recommendedSpecName = alternatives[0].specName;
      }
    }
  }
  return response;
}

function source(overrides: Partial<TeamsDataSource> = {}): TeamsDataSource {
  return {
    listTeams: vi.fn(async () => [{ id: 7, name: detail.name, memberCount: detail.members.length }]),
    getTeam: vi.fn(async () => detail),
    getKeystoneSelector: vi.fn(async () => selector),
    getKeystonePlanner: vi.fn(async () => { throw { code: "API_UNAVAILABLE", message: "Planner unavailable" }; }),
    getPlannerPreferences: vi.fn(async () => ({ preferences: [{ characterId: 10, specId: 62, role: "dps" as const, playPreference: "preferred" as const, lootSpecId: 62, updatedAt: "2026-09-11T00:00:00Z" }], lootPreferences: [{ characterId: 10, primaryLootSpecId: 62, secondaryLootSpecIds: [], updatedAt: "2026-09-11T00:00:00Z" }], onboardingCompleted: true })),
    updatePlannerPreferences: vi.fn(async (update: ClientPlannerPreferenceUpdate) => ({ preferences: update.preferences.map(preference => ({ ...preference, role: "dps" as const, lootSpecId: update.lootPreferences.find(loot => loot.characterId === preference.characterId)?.primaryLootSpecId ?? preference.specId, updatedAt: "2026-09-11T00:00:00Z" })), lootPreferences: update.lootPreferences.map(preference => ({ ...preference, updatedAt: "2026-09-11T00:00:00Z" })), onboardingCompleted: update.onboardingCompleted })),
    ...overrides,
  };
}

function renderPage(dataSource = source(), language: Language = "es", onSessionExpired = vi.fn()) {
  return { dataSource, onSessionExpired, ...renderWithTheme(
    <I18nProvider language={language}><TeamsPage currentUsername="Speeson" dataSource={dataSource} onOpenWeb={vi.fn()} onSessionExpired={onSessionExpired} /></I18nProvider>,
  ) };
}

async function selectRuby(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /Ruby Life Pools/u }));
  return screen.findAllByTestId("selector-character");
}

async function showPlannerResults(user: ReturnType<typeof userEvent.setup>, response: KeystonePlannerResponse) {
  renderPage(source({ getKeystonePlanner: vi.fn(async () => response) }));
  await selectRuby(user);
  await user.click(screen.getByRole("button", { name: "Planificar piedra" }));
  await user.click(screen.getByRole("button", { name: /\+12.*Bakuhatsu.*Speeson/u }));
  await user.click(screen.getByRole("button", { name: /Filtrar por Ana/u }));
  await user.click(screen.getByRole("button", { name: "Calcular Top 5" }));
  await waitFor(() => expect(document.querySelectorAll(".planner-recommendation")).toHaveLength(5));
}

describe("TeamsPage compact ranking", () => {
  beforeEach(() => {
    clearTeamsSessionCache();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ icon: "inv_misc_questionmark" }) })));
  });

  it("covers the full cold Teams area until both list and initial detail are ready", async () => {
    let resolveTeams!: (value: Array<{ id: number; name: string; memberCount: number }>) => void;
    let resolveDetail!: (value: ClientTeamDetail) => void;
    const dataSource = source({
      listTeams: vi.fn(() => new Promise<Array<{ id: number; name: string; memberCount: number }>>(resolve => { resolveTeams = resolve; })),
      getTeam: vi.fn(() => new Promise<ClientTeamDetail>(resolve => { resolveDetail = resolve; })),
    });

    renderPage(dataSource);

    const loader = screen.getByLabelText("Cargando equipos...");
    expect(loader).toHaveClass("teams-loading-veil");
    expect(loader.querySelector("img")).toHaveAttribute("src", expect.stringContaining("app-icon"));
    expect(document.querySelector(".teams-page-skeleton")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: detail.name })).not.toBeInTheDocument();

    await act(async () => resolveTeams([{ id: 7, name: detail.name, memberCount: 2 }]));
    expect(screen.getByLabelText("Cargando equipos...")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: detail.name })).not.toBeInTheDocument();

    await act(async () => resolveDetail(detail));
    expect(await screen.findByRole("button", { name: detail.name })).toBeInTheDocument();
    expect(screen.queryByLabelText("Cargando equipos...")).not.toBeInTheDocument();
  });

  it("restores the complete Teams UI synchronously after unmount and revalidates once", async () => {
    const dataSource = source();
    const first = renderPage(dataSource);
    expect(await screen.findByRole("button", { name: detail.name })).toBeInTheDocument();
    first.unmount();

    renderPage(dataSource);

    expect(screen.getByRole("button", { name: detail.name })).toBeInTheDocument();
    expect(screen.queryByLabelText("Cargando equipos...")).not.toBeInTheDocument();
    expect(document.querySelector(".teams-page-skeleton")).not.toBeInTheDocument();
    await waitFor(() => expect(dataSource.listTeams).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(dataSource.getTeam).toHaveBeenCalledTimes(2));
  });

  it("keeps cached Teams visible while list and detail revalidation are pending", async () => {
    let resolveListRefresh!: (value: Array<{ id: number; name: string; memberCount: number }>) => void;
    let resolveDetailRefresh!: (value: ClientTeamDetail) => void;
    const refreshedDetail: ClientTeamDetail = {
      ...detail,
      members: [...detail.members, { userId: 9, username: "New Member", plannerConfigured: false, characters: [] }],
    };
    const dataSource = source({
      listTeams: vi.fn()
        .mockResolvedValueOnce([{ id: 7, name: detail.name, memberCount: 2 }])
        .mockImplementationOnce(() => new Promise(resolve => { resolveListRefresh = resolve; })),
      getTeam: vi.fn()
        .mockResolvedValueOnce(detail)
        .mockImplementationOnce(() => new Promise(resolve => { resolveDetailRefresh = resolve; })),
    });
    const first = renderPage(dataSource);
    expect(await screen.findByRole("button", { name: /Filtrar por Speeson/u })).toBeInTheDocument();
    first.unmount();

    renderPage(dataSource);

    expect(screen.getByRole("button", { name: detail.name })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Filtrar por Speeson/u })).toBeInTheDocument();
    expect(screen.queryByLabelText("Cargando equipos...")).not.toBeInTheDocument();
    await waitFor(() => expect(dataSource.listTeams).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(dataSource.getTeam).toHaveBeenCalledTimes(2));

    await act(async () => resolveListRefresh([{ id: 7, name: detail.name, memberCount: 3 }]));
    expect(screen.getByRole("button", { name: /Filtrar por Speeson/u })).toBeInTheDocument();
    await act(async () => resolveDetailRefresh(refreshedDetail));
    expect(await screen.findByRole("button", { name: /Filtrar por New Member/u })).toBeInTheDocument();
  });

  it("restores a cached Selector synchronously after navigation and keeps it during revalidation", async () => {
    const user = userEvent.setup();
    let resolveSelectorRefresh!: (value: KeystoneSelectorResponse) => void;
    const getKeystoneSelector = vi.fn()
      .mockResolvedValueOnce(selector)
      .mockImplementationOnce(() => new Promise(resolve => { resolveSelectorRefresh = resolve; }));
    const dataSource = source({ getKeystoneSelector });
    const first = renderPage(dataSource);
    await selectRuby(user);
    first.unmount();

    renderPage(dataSource);
    await user.click(screen.getByRole("button", { name: /Ruby Life Pools/u }));

    expect(screen.getByText("2 personajes · 7 objetivos")).toBeInTheDocument();
    expect(screen.queryByLabelText("Cargando objetivos")).not.toBeInTheDocument();
    expect(getKeystoneSelector).toHaveBeenCalledTimes(2);
    await act(async () => resolveSelectorRefresh({
      ...selector,
      summary: { ...selector.summary, totalObjectives: 8 },
    }));
    expect(await screen.findByText("2 personajes · 8 objetivos")).toBeInTheDocument();
  });

  it("renders the compact Team trigger, member strip, eight locally-derived stone counts and minimal initial state", async () => {
    const dataSource = source();
    renderPage(dataSource);
    expect(await screen.findByRole("button", { name: "Mythiqueros 2.0" })).toHaveAttribute("aria-haspopup", "listbox");
    expect(screen.getByLabelText("Filtros de miembros")).toHaveClass("teams-member-strip");
    expect(await screen.findByRole("button", { name: "Filtrar por Speeson, 2 personajes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filtrar por Ana con un nombre largo, 1 personaje" })).toBeInTheDocument();
    expect(screen.getByText("2 personajes")).toBeInTheDocument();
    expect(screen.getByText("1 personaje")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Seleccionar/u })).toHaveLength(8);
    const ruby = screen.getByRole("button", { name: /Ruby Life Pools.*2 piedras/u });
    expect(ruby).toHaveTextContent("Ruby Life Pools");
    expect(ruby.querySelector(".teams-dungeon__art")).toHaveAttribute("src", expect.stringContaining("ruby-life-pools"));
    expect(screen.getByRole("button", { name: /Voidscar Arena.*0 piedras/u })).toBeEnabled();
    expect(screen.getByText("Selecciona una mazmorra para ver los objetivos del equipo.")).toBeInTheDocument();
    expect(document.querySelector(".teams-selector-panel__prompt > img")).toHaveAttribute("src", expect.stringContaining("app-icon"));
    expect(screen.getByText("Las piedras iluminadas están disponibles actualmente.")).toBeInTheDocument();
    expect(screen.getByText("También puedes consultar mazmorras sin piedra.")).toBeInTheDocument();
    expect(dataSource.getKeystoneSelector).not.toHaveBeenCalled();
  });

  it("keeps rendered Teams data stable across unrelated parent rerenders", async () => {
    const dataSource = source();
    const onSessionExpired = vi.fn();
    const view = renderPage(dataSource, "es", onSessionExpired);
    expect(await screen.findByRole("button", { name: detail.name })).toBeInTheDocument();
    expect(dataSource.listTeams).toHaveBeenCalledOnce();
    expect(dataSource.getTeam).toHaveBeenCalledOnce();

    view.rerender(<I18nProvider language="es"><TeamsPage currentUsername="Speeson" dataSource={dataSource} onOpenWeb={vi.fn()} onSessionExpired={onSessionExpired} /></I18nProvider>);

    expect(screen.getByRole("button", { name: detail.name })).toBeInTheDocument();
    expect(screen.queryByLabelText("Cargando equipos")).not.toBeInTheDocument();
    expect(dataSource.listTeams).toHaveBeenCalledOnce();
    expect(dataSource.getTeam).toHaveBeenCalledOnce();
  });

  it("opens with one cached Team and revalidation discovers a newly-created Team", async () => {
    const user = userEvent.setup();
    const lists = [
      [{ id: 7, name: detail.name, memberCount: 2 }],
      [{ id: 7, name: detail.name, memberCount: 2 }, { id: 8, name: "New Team", memberCount: 1 }],
    ];
    const dataSource = source({ listTeams: vi.fn(async () => lists.shift() ?? lists[0] ?? []) });
    renderPage(dataSource);
    const trigger = await screen.findByRole("button", { name: detail.name });

    await user.click(trigger);

    expect(screen.getByRole("listbox", { name: "Tus equipos" })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "New Team" })).toBeInTheDocument();
    expect(dataSource.getTeam).toHaveBeenCalledOnce();
  });

  it("deduplicates concurrent Team refreshes and preserves the active Team", async () => {
    const user = userEvent.setup();
    let resolveRefresh!: (value: Array<{ id: number; name: string; memberCount: number }>) => void;
    const refresh = new Promise<Array<{ id: number; name: string; memberCount: number }>>(resolve => { resolveRefresh = resolve; });
    const listTeams = vi.fn()
      .mockResolvedValueOnce([{ id: 7, name: detail.name, memberCount: 2 }])
      .mockReturnValue(refresh);
    renderPage(source({ listTeams }));
    const trigger = await screen.findByRole("button", { name: detail.name });

    await user.click(trigger);
    act(() => window.dispatchEvent(new Event("focus")));
    expect(listTeams).toHaveBeenCalledTimes(2);
    await act(async () => resolveRefresh([
      { id: 7, name: detail.name, memberCount: 2 }, { id: 8, name: "New Team", memberCount: 1 },
    ]));

    expect(screen.getByRole("button", { name: detail.name })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "New Team" })).toBeInTheDocument();
  });

  it("refreshes on visibility restoration, preserves data on failure, and falls back when the active Team disappears", async () => {
    const user = userEvent.setup();
    const second: ClientTeamDetail = { id: 8, name: "Second Team", members: [] };
    const listTeams = vi.fn()
      .mockResolvedValueOnce([{ id: 7, name: detail.name, memberCount: 2 }, { id: 8, name: second.name, memberCount: 0 }])
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce([{ id: 8, name: second.name, memberCount: 0 }]);
    const dataSource = source({
      listTeams,
      getTeam: vi.fn(async id => id === 7 ? detail : second),
    });
    renderPage(dataSource);
    const trigger = await screen.findByRole("button", { name: detail.name });

    await user.click(trigger);
    await waitFor(() => expect(listTeams).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: detail.name })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(await screen.findByRole("button", { name: second.name })).toBeInTheDocument();
    await waitFor(() => expect(dataSource.getTeam).toHaveBeenCalledWith(8));
  });

  it("opens the Team popover, marks the active Team, closes with Escape and outside click", async () => {
    const user = userEvent.setup();
    const dataSource = source({ listTeams: vi.fn(async () => [
      { id: 7, name: detail.name, memberCount: 2 }, { id: 8, name: "Second Team", memberCount: 0 },
    ]) });
    renderPage(dataSource);
    const trigger = await screen.findByRole("button", { name: detail.name });
    await user.click(trigger);
    expect(screen.getByRole("listbox", { name: "Tus equipos" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: detail.name })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    await user.click(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("switches Team through the popover and clears the selected dungeon and member filters", async () => {
    const user = userEvent.setup();
    const second = { ...detail, id: 8, name: "Second Team", members: [] };
    const dataSource = source({
      listTeams: vi.fn(async () => [{ id: 7, name: detail.name, memberCount: 2 }, { id: 8, name: second.name, memberCount: 0 }]),
      getTeam: vi.fn(async id => id === 7 ? detail : second),
    });
    renderPage(dataSource);
    const member = await screen.findByRole("button", { name: /Filtrar por Speeson/u });
    await user.click(member);
    await selectRuby(user);
    await user.click(screen.getByRole("button", { name: detail.name }));
    await user.click(screen.getByRole("option", { name: second.name }));
    expect(await screen.findByRole("button", { name: second.name })).toBeInTheDocument();
    expect(screen.getByText("Selecciona una mazmorra para ver los objetivos del equipo.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpiar filtros" })).not.toBeInTheDocument();
  });

  it("soft-filters one or multiple members without hiding or reordering rows, persists across dungeons, and clears explicitly", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectRuby(user);
    const before = screen.getAllByTestId("selector-character");
    expect(within(before[0]).getByText("Bakuhatsu")).toBeInTheDocument();
    expect(within(before[1]).getByText("Spee")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Filtrar por Speeson/u }));
    expect(screen.getByText("1 seleccionado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Limpiar filtros" })).toHaveTextContent("Limpiar");
    let rows = screen.getAllByTestId("selector-character");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute("data-emphasis", "full");
    expect(rows[1]).toHaveAttribute("data-emphasis", "muted");
    await user.click(screen.getByRole("button", { name: /Filtrar por Ana/u }));
    expect(screen.getByText("2 seleccionados")).toBeInTheDocument();
    rows = screen.getAllByTestId("selector-character");
    expect(rows.every(row => row.getAttribute("data-emphasis") === "full")).toBe(true);
    await user.click(screen.getByRole("button", { name: /Temple of Sethraliss/u }));
    await screen.findByText(/7 objetivos/u);
    expect(screen.getByRole("button", { name: /Filtrar por Speeson/u })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Filtrar por Ana/u })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(screen.queryByRole("button", { name: "Limpiar filtros" })).not.toBeInTheDocument();
  });

  it("selects a zero-stone dungeon and renders its compact header and benign empty state", async () => {
    const user = userEvent.setup();
    const empty = { ...selector, challengeMapId: 585, availability: { stoneCount: 0, stones: [] }, summary: { ...selector.summary, charactersWithObjectives: 0, totalObjectives: 0 }, characters: [] };
    renderPage(source({ getKeystoneSelector: vi.fn(async () => empty) }));
    const zero = await screen.findByRole("button", { name: /Voidscar Arena.*0 piedras/u });
    await user.click(zero);
    expect(zero).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByText("0 piedras disponibles")).toBeInTheDocument();
    expect(screen.getByText(/Ningún personaje del equipo/u)).toBeInTheDocument();
    expect(screen.getByText(/tampoco tiene una piedra/u)).toBeInTheDocument();
  });

  it("ignores an older Selector response after a newer dungeon wins", async () => {
    const user = userEvent.setup();
    const resolvers = new Map<number, (value: KeystoneSelectorResponse) => void>();
    const dataSource = source({ getKeystoneSelector: vi.fn((_team, dungeon): Promise<KeystoneSelectorResponse> => new Promise(done => resolvers.set(dungeon, done))) });
    renderPage(dataSource);
    await screen.findByRole("button", { name: detail.name });
    await user.click(screen.getByRole("button", { name: /Ruby Life Pools/u }));
    await user.click(screen.getByRole("button", { name: /Temple of Sethraliss/u }));
    await act(async () => resolvers.get(250)?.({ ...selector, challengeMapId: 250, summary: { ...selector.summary, totalObjectives: 22 } }));
    expect(await screen.findByText(/22 objetivos/u)).toBeInTheDocument();
    await act(async () => resolvers.get(399)?.(selector));
    expect(screen.queryByText(/7 objetivos/u)).not.toBeInTheDocument();
  });

  it("renders a cached dungeon immediately, revalidates it, and deduplicates its in-flight request", async () => {
    const user = userEvent.setup();
    let resolveRefresh!: (value: KeystoneSelectorResponse) => void;
    const refresh = new Promise<KeystoneSelectorResponse>(resolve => { resolveRefresh = resolve; });
    const getKeystoneSelector = vi.fn()
      .mockResolvedValueOnce(selector)
      .mockResolvedValueOnce({ ...selector, challengeMapId: 250 })
      .mockReturnValueOnce(refresh);
    renderPage(source({ getKeystoneSelector }));
    await selectRuby(user);
    await user.click(screen.getByRole("button", { name: /Temple of Sethraliss/u }));
    await user.click(screen.getByRole("button", { name: /Ruby Life Pools/u }));
    await user.click(screen.getByRole("button", { name: /Ruby Life Pools/u }));

    expect(screen.getByText("2 personajes · 7 objetivos")).toBeInTheDocument();
    expect(screen.queryByLabelText("Cargando objetivos")).not.toBeInTheDocument();
    expect(getKeystoneSelector).toHaveBeenCalledTimes(3);
    await act(async () => resolveRefresh({ ...selector, summary: { ...selector.summary, totalObjectives: 8 } }));
    expect(await screen.findByText("2 personajes · 8 objetivos")).toBeInTheDocument();
  });

  it("keeps cached Selector data after a background refresh error and isolates cache by Team", async () => {
    const user = userEvent.setup();
    const second: ClientTeamDetail = { id: 8, name: "Second Team", members: detail.members };
    const getKeystoneSelector = vi.fn()
      .mockResolvedValueOnce(selector)
      .mockResolvedValueOnce({ ...selector, challengeMapId: 250 })
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValueOnce({ ...selector, teamId: 8, summary: { ...selector.summary, totalObjectives: 19 } });
    const dataSource = source({
      listTeams: vi.fn(async () => [{ id: 7, name: detail.name, memberCount: 2 }, { id: 8, name: second.name, memberCount: 2 }]),
      getTeam: vi.fn(async id => id === 7 ? detail : second),
      getKeystoneSelector,
    });
    renderPage(dataSource);
    await selectRuby(user);
    await user.click(screen.getByRole("button", { name: /Temple of Sethraliss/u }));
    await user.click(screen.getByRole("button", { name: /Ruby Life Pools/u }));
    expect(await screen.findByText("2 personajes · 7 objetivos")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: detail.name }));
    await user.click(screen.getByRole("option", { name: second.name }));
    await screen.findByRole("button", { name: second.name });
    await user.click(screen.getByRole("button", { name: /Ruby Life Pools/u }));
    expect(await screen.findByText("2 personajes · 19 objetivos")).toBeInTheDocument();
    expect(getKeystoneSelector).toHaveBeenLastCalledWith(8, 399, "es_ES");
  });

  it("ignores an older Team detail response after switching Teams", async () => {
    const user = userEvent.setup();
    const second: ClientTeamDetail = { id: 8, name: "Second Team", members: [{ userId: 9, username: "Newest", plannerConfigured: false, characters: [] }] };
    const initialSource = source();
    await loadTeams(initialSource);
    await loadTeamDetail(initialSource, 7);
    setSelectedTeamId(7);
    const resolvers = new Map<number, (value: ClientTeamDetail) => void>();
    const dataSource = source({
      listTeams: vi.fn(async () => [{ id: 7, name: detail.name, memberCount: 2 }, { id: 8, name: second.name, memberCount: 1 }]),
      getTeam: vi.fn((id: number): Promise<ClientTeamDetail> => new Promise(done => resolvers.set(id, done))),
    });
    renderPage(dataSource);
    await user.click(await screen.findByRole("button", { name: detail.name }));
    await user.click(screen.getByRole("option", { name: second.name }));
    await act(async () => resolvers.get(8)?.(second));
    expect(await screen.findByRole("button", { name: /Filtrar por Newest/u })).toBeInTheDocument();
    await act(async () => resolvers.get(7)?.(detail));
    expect(screen.queryByRole("button", { name: /Filtrar por Speeson/u })).not.toBeInTheDocument();
  });

  it("renders compact dungeon/owner summary, Worker order, Planner, expansion, multispec, item groups and completed Voidcore", async () => {
    const user = userEvent.setup();
    renderPage();
    const rows = await selectRuby(user);
    expect(screen.getAllByText("Ruby Life Pools")).toHaveLength(2);
    expect(document.querySelector(".teams-dungeon-context")).toHaveTextContent("Ruby Life Pools");
    expect(screen.getByText("2 piedras · Bakuhatsu + Spee")).toBeInTheDocument();
    expect(screen.getByText("2 personajes · 7 objetivos")).toHaveClass("teams-summary-total");
    expect(within(rows[0]).getByText("#1")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Bakuhatsu")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Spee")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Planificar piedra/u })).toBeEnabled();
    const expand = within(rows[0]).getByRole("button", { name: /Ver objetos.*Bakuhatsu/u });
    await user.click(expand);
    expect(rows[0]).toHaveAttribute("data-expanded", "true");
    expect(within(rows[0]).getByText("Bakuhatsu")).toBeInTheDocument();
    expect(within(rows[0]).getByRole("button", { name: "Todos · 6" })).toBeInTheDocument();
    await user.click(within(rows[0]).getByRole("button", { name: "Arcane · 4" }));
    expect(within(rows[0]).getByText("BEST IN SLOT · 1")).toBeInTheDocument();
    expect(within(rows[0]).getByText("OTHER · 1")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Completados con Voidcore · 1")).toBeInTheDocument();
    expect(within(rows[0]).getByText("BEST IN SLOT · 1").closest(".teams-objective-group")).toHaveAttribute("data-category", "bestInSlot");
    expand.focus();
    await user.keyboard("{Enter}");
    expect(rows[0]).toHaveAttribute("data-expanded", "false");
    await user.keyboard(" ");
    expect(rows[0]).toHaveAttribute("data-expanded", "true");
  });

  it("plans the Top 5 for the selected exact stone and marks its owner with the leader crown", async () => {
    const user = userEvent.setup();
    const planned = plannerResponse();
    const overflowAssignment = planned.recommendations[0].assignments.find(assignment => assignment.characterName === "Bakuhatsu")!;
    const baseObjective = overflowAssignment.objectives[0];
    overflowAssignment.objectives = [3, 2, 1, 5, 4, 88].map((tier, index) => ({ ...baseObjective, itemId: 100 + index, itemName: `Objeto ${100 + index}`, tier, variantKey: `overflow:${index}` }));
    const getKeystonePlanner = vi.fn(async () => planned);
    renderPage(source({ getKeystonePlanner }));
    await selectRuby(user);
    await user.click(screen.getByRole("button", { name: "Planificar piedra" }));
    expect(screen.getByRole("button", { name: "Configurar mis personajes" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /\+12.*Bakuhatsu.*Speeson/u }));
    const ownerFilter = screen.getByRole("button", { name: /Filtrar por Speeson/u });
    expect(ownerFilter).toHaveAttribute("aria-pressed", "true");
    await user.click(ownerFilter);
    expect(ownerFilter).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: /Filtrar por Ana/u }));
    await user.click(screen.getByRole("button", { name: "Calcular Top 5" }));

    await waitFor(() => expect(getKeystonePlanner).toHaveBeenCalledWith(7, expect.objectContaining({
      participantUserIds: expect.arrayContaining([2, 3]), targetLevel: 12, challengeMapId: 399, stoneCharacterId: 10, locks: [],
    })));
    expect(document.querySelectorAll(".planner-recommendation")).toHaveLength(5);
    expect(screen.getAllByLabelText("Dueño de la piedra").length).toBeGreaterThan(0);
    const firstParty = document.querySelector(".planner-recommendation__party")!;
    expect(firstParty.querySelectorAll(":scope > .planner-assignment-preview, :scope > .planner-external-preview")).toHaveLength(5);
    expect(firstParty.querySelectorAll(":scope > .planner-external-preview")).toHaveLength(3);
    const external = firstParty.querySelector<HTMLElement>(".planner-external-preview")!;
    expect(external).toHaveAttribute("data-role", "healer");
    expect(within(external).getByText("Externo")).toBeInTheDocument();
    expect(external.querySelectorAll(".planner-external-preview__class")).toHaveLength(4);
    expect(external.querySelectorAll(".planner-external-preview__class img")).toHaveLength(4);
    await user.click(within(external).getByRole("button", { name: /Ver clases recomendadas: 5/u }));
    const externalDialog = screen.getByRole("dialog", { name: /Clases recomendadas.*Healer/u });
    expect(within(externalDialog).getByText("Druid")).toBeInTheDocument();
    expect(within(externalDialog).getByText("Hunter")).toBeInTheDocument();
    expect(within(externalDialog).queryByText("Restoration")).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /Clases recomendadas.*Healer/u })).not.toBeInTheDocument();
    const cards = [...document.querySelectorAll<HTMLElement>(".planner-recommendation")];
    const compactLootMarker = cards[0].querySelector<HTMLElement>(".planner-spec-marker--loot");
    expect(compactLootMarker?.querySelector(":scope > .planner-loot-pouch img")).toHaveAttribute("src", expect.stringContaining("inv_misc_bag_10.jpg"));
    expect(compactLootMarker?.querySelector(":scope > .planner-spec-icon .planner-loot-pouch")).not.toBeInTheDocument();
    const compactScore = cards[0].querySelector<HTMLElement>(".planner-score");
    expect(compactScore?.firstElementChild?.tagName).toBe("SMALL");
    expect(compactScore?.lastElementChild?.tagName).toBe("B");
    expect(cards[0]).toHaveAttribute("data-expanded", "false");
    await user.click(within(cards[1]).getByRole("button", { name: "Expandir #2" }));
    expect(cards[0]).toHaveAttribute("data-expanded", "false");
    expect(cards[1]).toHaveAttribute("data-expanded", "true");
    expect(cards[1].querySelector(".planner-utilities > section:last-child > strong")).toHaveTextContent("Buffs / Defensivos / Utilidades");
    expect(cards[1].querySelector(".planner-recommendation__metrics")).toHaveTextContent("2 Objetivos");
    expect(cards[1].querySelector(".planner-recommendation__metrics")).toHaveTextContent("2 Preferidos");
    expect(within(cards[1]).getAllByRole("img", { name: "Especialización jugada: Protection" }).length).toBeGreaterThan(0);
    expect(within(cards[1]).getAllByRole("img", { name: "Especialización de botín: Protection" }).length).toBeGreaterThan(0);
    expect(within(cards[1]).getAllByText("Ana").length).toBeGreaterThan(0);
    expect(within(cards[1]).queryByText("Paladin · Protection")).not.toBeInTheDocument();
    expect(within(cards[1]).queryByTitle("Paladin")).not.toBeInTheDocument();
    expect(within(cards[1]).getAllByRole("img", { name: "Especialización jugada: Protection" })[0].querySelector(".planner-spec-icon__specialization")).toHaveAttribute("src", expect.stringContaining("236264"));
    expect(within(cards[1]).getByRole("link", { name: "Escudo" })).toHaveAttribute("data-wowhead", expect.stringContaining("spec=66"));
    expect(within(cards[1]).queryByLabelText("Dueño de la piedra +12")).not.toBeInTheDocument();
    const expandedOwnerCard = cards[1].querySelector(".planner-player-card .planner-owner-crown")?.closest(".planner-player-card");
    expect(expandedOwnerCard?.querySelector(":scope > .planner-role-watermark")).toBeInTheDocument();
    expect(expandedOwnerCard?.querySelector(".planner-player-role")).not.toBeInTheDocument();
    expect(expandedOwnerCard?.querySelectorAll(".planner-player-card__specs > .planner-spec-marker")).toHaveLength(2);
    expect(expandedOwnerCard?.querySelector(".planner-spec-marker--loot > .planner-loot-pouch img")).toHaveAttribute("src", expect.stringContaining("inv_misc_bag_10.jpg"));
    expect(expandedOwnerCard?.querySelector(".planner-spec-marker--loot > .planner-spec-icon .planner-loot-pouch")).not.toBeInTheDocument();
    const objectiveRow = expandedOwnerCard?.querySelector(".planner-objective-icons");
    expect(objectiveRow?.querySelector(".planner-objective-cluster")).not.toBeInTheDocument();
    expect([...objectiveRow!.children].filter(child => child.matches(".planner-objective-icon"))).toHaveLength(5);
    await user.click(within(cards[1]).getByRole("button", { name: /Ver todos los objetivos · Bakuhatsu · 6/u }));
    const breakdown = screen.getByRole("dialog", { name: /Desglose de objetivos · Bakuhatsu/u });
    expect(within(breakdown).getByText("BiS · 1")).toBeInTheDocument();
    expect(within(breakdown).getByText("Must · 1")).toBeInTheDocument();
    expect(within(breakdown).getByText("Catalyst · 1")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /Desglose de objetivos/u })).not.toBeInTheDocument();
  });

  it("keeps results visible and recalculates automatically when a group priority changes", async () => {
    const user = userEvent.setup();
    const planned = plannerResponse();
    let resolveRecalculation: ((value: KeystonePlannerResponse) => void) | undefined;
    const getKeystonePlanner = vi.fn()
      .mockResolvedValueOnce(planned)
      .mockImplementationOnce(() => new Promise<KeystonePlannerResponse>(resolve => { resolveRecalculation = resolve; }));
    renderPage(source({ getKeystonePlanner }));
    await selectRuby(user);
    await user.click(screen.getByRole("button", { name: "Planificar piedra" }));
    await user.click(screen.getByRole("button", { name: /\+12.*Bakuhatsu.*Speeson/u }));
    await user.click(screen.getByRole("button", { name: /Filtrar por Ana/u }));
    await user.click(screen.getByRole("button", { name: "Calcular Top 5" }));

    await waitFor(() => expect(document.querySelectorAll(".planner-recommendation")).toHaveLength(5));
    expect(screen.getByRole("button", { name: "Recalcular Top 5" })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Ansia de sangre" }));

    const results = screen.getByRole("region", { name: "Top 5 de configuraciones" });
    expect(results).toHaveAttribute("data-recalculating", "true");
    expect(results.querySelectorAll(".planner-recommendation")).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Recalculando…" })).toBeDisabled();
    await waitFor(() => expect(getKeystonePlanner).toHaveBeenCalledTimes(2));
    expect(getKeystonePlanner).toHaveBeenLastCalledWith(7, expect.objectContaining({
      options: expect.objectContaining({ bloodlust: false }),
    }));

    act(() => resolveRecalculation?.(planned));
    await waitFor(() => expect(results).toHaveAttribute("data-recalculating", "false"));
    expect(screen.getByRole("button", { name: "Recalcular Top 5" })).toBeInTheDocument();
  });

  it("defaults to Quick, places the 50/50 mode selector before level, and preserves Advanced switches in memory", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectRuby(user);
    await user.click(screen.getByRole("button", { name: "Planificar piedra" }));

    const configure = screen.getByRole("button", { name: "Configurar mis personajes" });
    const fill = screen.getByRole("checkbox", { name: "Rellenar la composición" });
    const mode = screen.getByRole("group", { name: "Modo de recomendación" });
    const level = screen.getByRole("slider", { name: /Nivel mínimo/u });
    expect(configure.compareDocumentPosition(fill) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(fill.compareDocumentPosition(mode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(fill).toBeChecked();
    expect(mode.compareDocumentPosition(level) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(mode).getByRole("button", { name: "Rápido · Clases" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("checkbox").map(control => control.getAttribute("aria-label"))).toEqual([
      "Rellenar la composición",
      "Ansia de sangre", "Resurrección en combate", "Sinergia ofensiva",
    ]);
    expect(screen.queryByText("Buffos de clase")).not.toBeInTheDocument();
    expect(screen.queryByText("Sinergia de daño")).not.toBeInTheDocument();

    await user.click(within(mode).getByRole("button", { name: "Avanzado · Specs" }));
    expect(screen.getAllByRole("checkbox").map(control => control.getAttribute("aria-label"))).toEqual([
      "Rellenar la composición",
      "Ansia de sangre", "Resurrección en combate", "Sinergia ofensiva", "Defensiva de grupo", "Utilidad de mazmorra",
    ]);
    await user.click(screen.getByRole("checkbox", { name: "Defensiva de grupo" }));
    await user.click(within(mode).getByRole("button", { name: "Rápido · Clases" }));
    expect(screen.queryByRole("checkbox", { name: "Defensiva de grupo" })).not.toBeInTheDocument();
    await user.click(within(mode).getByRole("button", { name: "Avanzado · Specs" }));
    expect(screen.getByRole("checkbox", { name: "Defensiva de grupo" })).not.toBeChecked();
  });

  it("recalculates without external fill and centers incomplete detail role rows", async () => {
    const user = userEvent.setup();
    const withoutFill = modernPlannerResponse("quick");
    for (const recommendation of withoutFill.recommendations) {
      const dps = recommendation.assignments.find(assignment => assignment.role === "dps")!;
      recommendation.assignments = [
        recommendation.assignments.find(assignment => assignment.role === "tank")!,
        dps,
        { ...dps, userId: 4, characterId: 14, characterName: "SegundoDps", username: "Otro" },
      ];
      recommendation.vacancies = [];
    }
    const getKeystonePlanner = vi.fn().mockResolvedValueOnce(modernPlannerResponse("quick")).mockResolvedValueOnce(withoutFill);
    renderPage(source({ getKeystonePlanner }));
    await selectRuby(user);
    await user.click(screen.getByRole("button", { name: "Planificar piedra" }));
    await user.click(screen.getByRole("button", { name: /\+12.*Bakuhatsu.*Speeson/u }));
    await user.click(screen.getByRole("button", { name: /Filtrar por Ana/u }));
    await user.click(screen.getByRole("button", { name: "Calcular Top 5" }));
    await waitFor(() => expect(document.querySelectorAll(".planner-recommendation")).toHaveLength(5));

    await user.click(screen.getByRole("checkbox", { name: "Rellenar la composición" }));
    await waitFor(() => expect(getKeystonePlanner).toHaveBeenLastCalledWith(7, expect.objectContaining({
      options: expect.objectContaining({ fillComposition: false }),
    })));
    await waitFor(() => expect(document.querySelectorAll(".planner-external-preview")).toHaveLength(0));
    await user.click(screen.getByRole("button", { name: "Expandir #1" }));
    const party = document.querySelector<HTMLElement>(".planner-party-trapezoid")!;
    expect(party).toHaveAttribute("data-top-count", "1");
    expect(party).toHaveAttribute("data-dps-count", "2");
  });

  it("uses a bottom overlay cue instead of a visible sidebar scrollbar", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectRuby(user);
    await user.click(screen.getByRole("button", { name: "Planificar piedra" }));
    const scrollArea = document.querySelector<HTMLElement>(".planner-config-scroll")!;
    Object.defineProperties(scrollArea, {
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, value: 620 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });
    fireEvent.scroll(scrollArea);
    const cue = await screen.findByRole("button", { name: "Ir al final del panel" });
    await user.click(cue);
    expect(scrollArea.scrollTop).toBe(620);
    expect(screen.queryByRole("button", { name: "Ir al final del panel" })).not.toBeInTheDocument();
  });

  it("renders Quick alternatives as selectable detail data and a portaled enriched modal", async () => {
    const user = userEvent.setup();
    await showPlannerResults(user, modernPlannerResponse("quick"));

    const firstResult = document.querySelector<HTMLElement>(".planner-recommendation")!;
    const preview = firstResult.querySelector<HTMLElement>(".planner-external-preview")!;
    expect(preview).toHaveAttribute("data-mode", "quick");
    expect(preview.querySelectorAll('[data-icon-kind="class"]')).toHaveLength(4);
    expect(preview.querySelector(".planner-external-gain")).not.toBeInTheDocument();
    expect(preview).not.toHaveTextContent("Warrior");

    await user.click(within(preview).getByRole("button", { name: /Ver clases recomendadas: 5/u }));
    const previewDialog = screen.getByRole("dialog", { name: /Clases recomendadas/u });
    const modalLayer = previewDialog.closest<HTMLElement>(".planner-external-popover")!;
    expect(modalLayer.parentElement).toBe(document.body);
    expect(modalLayer).toHaveAttribute("data-portal-layer", "modal");
    expect(preview.contains(modalLayer)).toBe(false);
    const quickRows = previewDialog.querySelectorAll(".planner-external-popover__choice");
    expect(quickRows).toHaveLength(5);
    expect(within(previewDialog).queryByRole("button", { name: /Seleccionar recomendación/u })).not.toBeInTheDocument();
    expect(quickRows[0].querySelectorAll(".planner-external-popover__icons img")).toHaveLength(1);
    expect(quickRows[0].lastElementChild).toHaveClass("planner-external-gain");
    await user.keyboard("{Escape}");

    await user.click(within(firstResult).getByRole("button", { name: "Expandir #1" }));
    const externalCard = firstResult.querySelector<HTMLElement>(".planner-external-card")!;
    expect(externalCard.querySelectorAll('.planner-external-card__selectors [data-icon-kind="class"]')).toHaveLength(4);
    expect(within(externalCard).getByRole("button", { name: /Seleccionar recomendación: Warrior/u })).toHaveAttribute("aria-pressed", "true");
    expect(within(externalCard).getByRole("status", { name: /\+4\.50%/u })).toBeInTheDocument();
    const contributions = within(externalCard).getByRole("group", { name: "Buffs / Defensivos / Utilidades" });
    expect(externalCard.querySelectorAll(".planner-external-card__contributions > section")).toHaveLength(1);
    expect(externalCard.querySelector("header .planner-external-gain")).not.toBeInTheDocument();
    expect(contributions.querySelector(".planner-external-card__contribution-heading > .planner-external-gain")).toBeInTheDocument();
    expect(contributions.querySelectorAll(".planner-capability-grid__icon")).toHaveLength(2);
    expect(within(externalCard).queryByText("Grito de batalla")).not.toBeInTheDocument();
    expect(within(externalCard).queryByText("Pummel")).not.toBeInTheDocument();
    expect(within(externalCard).getByRole("link", { name: /Grito de batalla/u })).toHaveAttribute("data-wowhead", "domain=es");
    await waitFor(() => expect(within(externalCard).getByRole("link", { name: /Grito de batalla/u }).querySelector(".planner-capability-chip__icon img")).toBeInTheDocument());

    await user.click(within(externalCard).getByRole("button", { name: /Seleccionar recomendación: Mage/u }));
    expect(within(externalCard).getByRole("status", { name: /\+3\.10%/u })).toBeInTheDocument();
    expect(within(externalCard).getByRole("link", { name: /Intelecto Arcano/u })).toBeInTheDocument();
    expect(within(externalCard).getByRole("link", { name: /Counterspell/u })).toBeInTheDocument();
    expect(within(externalCard).queryByText("Pummel")).not.toBeInTheDocument();
    expect(within(externalCard).getByRole("button", { name: /Ver clases recomendadas: 5/u })).toBeInTheDocument();
  });

  it("uses spec-only selectors in Advanced detail while the modal keeps class and spec identity", async () => {
    const user = userEvent.setup();
    await showPlannerResults(user, modernPlannerResponse("advanced"));
    const firstResult = document.querySelector<HTMLElement>(".planner-recommendation")!;
    const preview = firstResult.querySelector<HTMLElement>(".planner-external-preview")!;
    expect(preview.querySelectorAll('[data-icon-kind="spec"]')).toHaveLength(4);
    expect(preview.querySelector('img[src*="classicon_"]')).not.toBeInTheDocument();

    await user.click(within(firstResult).getByRole("button", { name: "Expandir #1" }));
    const externalCard = firstResult.querySelector<HTMLElement>(".planner-external-card")!;
    expect(externalCard.querySelectorAll('.planner-external-card__selectors [data-icon-kind="spec"]')).toHaveLength(4);
    expect(externalCard.querySelector('.planner-external-card__selectors img[src*="classicon_"]')).not.toBeInTheDocument();
    await user.click(within(externalCard).getByRole("button", { name: /Ver clases recomendadas: 5/u }));
    const dialog = screen.getByRole("dialog", { name: /Specs recomendadas/u });
    expect(dialog.querySelector(".planner-external-popover__choice")?.querySelectorAll(".planner-external-popover__icons img")).toHaveLength(2);
    expect(within(dialog).getByText("Fury Warrior")).toBeInTheDocument();
  });

  it("combines party capabilities and reveals overflow from a body portal", async () => {
    const user = userEvent.setup();
    await showPlannerResults(user, modernPlannerResponse("advanced"));
    const firstResult = document.querySelector<HTMLElement>(".planner-recommendation")!;
    await user.click(within(firstResult).getByRole("button", { name: "Expandir #1" }));

    const utilityGroup = firstResult.querySelector<HTMLElement>(".planner-utilities > section:last-child")!;
    expect(utilityGroup.querySelectorAll(".planner-capability-grid__icon")).toHaveLength(5);
    expect(within(utilityGroup).queryByText("Remove Curse")).not.toBeInTheDocument();

    const more = within(utilityGroup).getByRole("button", { name: /Mostrar \d+ utilidades más/u });
    await user.hover(more);
    const popup = screen.getByRole("tooltip");
    expect(popup.parentElement).toBe(document.body);
    expect(within(popup).getByText("Remove Curse")).toBeInTheDocument();
    expect(within(popup).getByText("Imprison")).toBeInTheDocument();
    await user.unhover(more);
    fireEvent.mouseEnter(popup);
    await new Promise(resolve => window.setTimeout(resolve, 250));
    expect(screen.getByRole("tooltip")).toBe(popup);
    expect(getComputedStyle(popup).pointerEvents).toBe("auto");
    fireEvent.mouseLeave(popup);
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());

    fireEvent.focus(more);
    await waitFor(() => expect(within(screen.getByRole("tooltip")).getByText("Remove Curse")).toBeInTheDocument());
    fireEvent.keyDown(more, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });

  it("lights party essentials with a distinct source when the selected external provides them", async () => {
    const user = userEvent.setup();
    const response = modernPlannerResponse("advanced");
    for (const recommendation of response.recommendations) {
      recommendation.compositionSummary.bloodlust = "conditional";
      recommendation.compositionSummary.battleRez = "none";
      recommendation.vacancies = [recommendation.vacancies[0]];
      const selected = recommendation.vacancies[0].recommendations?.[0];
      if (selected) selected.utilities = [
        { capabilityId: "BLOODLUST", name: "Bloodlust", spellId: 2825, availability: "guaranteed" },
        { capabilityId: "BATTLE_REZ", name: "Battle Resurrection", spellId: 20484, availability: "guaranteed" },
      ];
    }

    await showPlannerResults(user, response);
    const firstResult = document.querySelector<HTMLElement>(".planner-recommendation")!;
    await user.click(within(firstResult).getByRole("button", { name: "Expandir #1" }));

    const essentials = within(firstResult).getByRole("group", { name: "Esenciales del grupo" });
    const externalEssentials = essentials.querySelectorAll('.planner-utility[data-state="guaranteed"][data-source="external"]');
    expect(externalEssentials).toHaveLength(2);
  });

  it("uses compact icon grids and updates the dominant damage profile from external selections", async () => {
    const user = userEvent.setup();
    const response = modernPlannerResponse("advanced");
    for (const recommendation of response.recommendations) {
      recommendation.compositionSummary.magicalDpsCount = 0;
      recommendation.compositionSummary.physicalDpsCount = 0;
      recommendation.compositionSummary.unknownDpsCount = 0;
      recommendation.compositionSummary.uniqueCapabilities = [
        ["BUFF_1", "Buff 1", 1459], ["BUFF_2", "Buff 2", 6673], ["BUFF_3", "Buff 3", 1126],
        ["BUFF_4", "Buff 4", 21562], ["BUFF_5", "Buff 5", 462854], ["BUFF_6", "Buff 6", 1490],
        ["BUFF_7", "Buff 7", 113746],
      ].map(([capabilityId, name, iconSpellId]) => ({
        capabilityId: capabilityId as string, name: name as string, iconSpellId: iconSpellId as number,
        type: "class_buff" as const, stacking: "unique" as const, availability: "guaranteed" as const,
      }));
      for (const vacancy of recommendation.vacancies) {
        const warrior = vacancy.recommendations?.[0];
        if (!warrior) continue;
        warrior.buffsDebuffs = [
          ["BATTLE_SHOUT", "Battle Shout", 6673], ["MARK_OF_THE_WILD", "Mark of the Wild", 1126],
          ["ARCANE_INTELLECT", "Arcane Intellect", 1459], ["FORTITUDE", "Fortitude", 21562],
          ["SKYFURY", "Skyfury", 462854],
        ].map(([capabilityId, name, spellId]) => ({
          capabilityId: capabilityId as string, name: name as string, spellId: spellId as number,
          availability: "guaranteed" as const,
        }));
        warrior.utilities = [
          ["INTERRUPT", "Pummel", 6552], ["STUN", "Storm Bolt", 107570], ["FEAR", "Intimidating Shout", 5246],
          ["DISPEL", "Berserker Rage", 18499], ["EXTERNAL", "Rallying Cry", 97462], ["MOVE", "Heroic Leap", 6544],
        ].map(([capabilityId, name, spellId]) => ({
          capabilityId: capabilityId as string, name: name as string, spellId: spellId as number,
          availability: "guaranteed" as const,
        }));
      }
    }

    await showPlannerResults(user, response);
    const firstResult = document.querySelector<HTMLElement>(".planner-recommendation")!;
    await user.click(within(firstResult).getByRole("button", { name: "Expandir #1" }));

    const firstDpsCard = firstResult.querySelector<HTMLElement>('.planner-external-card[data-role="dps"]')!;
    const capabilityGroup = within(firstDpsCard).getByRole("group", { name: "Buffs / Defensivos / Utilidades" });
    expect(firstDpsCard.querySelectorAll(".planner-external-card__contributions > section")).toHaveLength(1);
    expect(capabilityGroup.querySelectorAll(".planner-capability-grid__icon")).toHaveLength(5);
    expect(within(capabilityGroup).queryByText("Grito de batalla")).not.toBeInTheDocument();
    const utilityMore = within(capabilityGroup).getByRole("button", { name: /Mostrar 6 utilidades más/u });
    await user.hover(utilityMore);
    expect(within(screen.getByRole("tooltip")).getByText("Rallying Cry")).toBeInTheDocument();
    expect(within(screen.getByRole("tooltip")).getByText("Heroic Leap")).toBeInTheDocument();
    await user.unhover(utilityMore);

    const composition = within(firstResult).getByRole("group", { name: "Composición" });
    expect(composition.querySelector('.planner-summary-damage[data-profile="physical"]')).toBeInTheDocument();
    expect(within(composition).getByText("3")).toBeInTheDocument();
    expect(within(composition).getByTitle("Número de jugadores externos")).toBeInTheDocument();
    const dpsCards = firstResult.querySelectorAll<HTMLElement>('.planner-external-card[data-role="dps"]');
    for (const card of dpsCards) {
      await user.click(within(card).getByRole("button", { name: /Seleccionar recomendación: Fire Mage/u }));
    }
    expect(composition.querySelector('.planner-summary-damage[data-profile="magical"]')).toBeInTheDocument();

    const footer = firstResult.querySelector<HTMLElement>(".planner-utilities")!;
    expect(footer.querySelectorAll(":scope > section")).toHaveLength(3);
    const utilities = within(footer).getByRole("group", { name: "Esenciales del grupo" });
    expect(utilities.querySelectorAll('.planner-utility[data-compact="true"]')).toHaveLength(2);
    expect(utilities.querySelector('.planner-utility[data-state="guaranteed"]')).toBeInTheDocument();
    expect(utilities.querySelector('.planner-utility[data-state="none"]')).toBeInTheDocument();

    const synergies = footer.querySelector<HTMLElement>(":scope > section:last-child")!;
    expect(synergies.querySelectorAll(".planner-capability-grid__icon")).toHaveLength(5);
    const synergyMore = within(synergies).getByRole("button", { name: /Mostrar \d+ utilidades más/u });
    await user.hover(synergyMore);
    const synergyPopup = screen.getByRole("tooltip");
    expect(within(synergyPopup).getByRole("link", { name: /Intelecto Arcano/u })).toBeInTheDocument();
    expect(within(synergyPopup).getByText("Buff 6")).toBeInTheDocument();
    expect(within(synergyPopup).getByText("Buff 7")).toBeInTheDocument();
  });

  it("keeps tank, healer, and DPS cards in fixed role slots when the tank is external", async () => {
    const user = userEvent.setup();
    const response = modernPlannerResponse("advanced");
    for (const recommendation of response.recommendations) {
      recommendation.assignments[0] = { ...recommendation.assignments[0], role: "healer" };
      recommendation.vacancies[0] = { ...recommendation.vacancies[0], role: "tank" };
    }
    await showPlannerResults(user, response);
    const firstResult = document.querySelector<HTMLElement>(".planner-recommendation")!;
    const compactRoles = [...firstResult.querySelectorAll<HTMLElement>(".planner-recommendation__party > [data-role]")]
      .map(card => card.dataset.role);
    expect(compactRoles).toEqual(["tank", "healer", "dps", "dps", "dps"]);

    await user.click(within(firstResult).getByRole("button", { name: "Expandir #1" }));
    const detailRoles = [...firstResult.querySelectorAll<HTMLElement>(".planner-party-trapezoid > [data-role]")]
      .map(card => card.dataset.role);
    expect(detailRoles).toEqual(["tank", "healer", "dps", "dps", "dps"]);
    expect(firstResult.querySelector(".planner-party-trapezoid > :first-child")).toHaveClass("planner-external-card");
  });

  it("uses the dedicated mixed-damage artwork for a mixed selected party", async () => {
    const user = userEvent.setup();
    const response = modernPlannerResponse("advanced");
    for (const recommendation of response.recommendations) {
      for (const vacancy of recommendation.vacancies) {
        if (vacancy.role === "dps" && vacancy.recommendations?.[0]) {
          vacancy.recommendations[0].damageProfile = "mixed";
        }
      }
    }
    await showPlannerResults(user, response);
    const firstResult = document.querySelector<HTMLElement>(".planner-recommendation")!;
    await user.click(within(firstResult).getByRole("button", { name: "Expandir #1" }));
    const mixedDamage = within(firstResult).getByRole("img", { name: "Daño: mixto" });
    expect(mixedDamage.querySelector("img")).toHaveAttribute("src", expect.stringMatching(/mix[-]?damage\.png/u));
  });

  it("ignores an older live recalculation when priorities change again", async () => {
    const user = userEvent.setup();
    const initial = plannerResponse();
    const stale = structuredClone(initial);
    const latest = structuredClone(initial);
    stale.recommendations[0].lootSummary.weightedScore = 777;
    latest.recommendations[0].lootSummary.weightedScore = 42;
    let resolveStale: ((value: KeystonePlannerResponse) => void) | undefined;
    let resolveLatest: ((value: KeystonePlannerResponse) => void) | undefined;
    const getKeystonePlanner = vi.fn()
      .mockResolvedValueOnce(initial)
      .mockImplementationOnce(() => new Promise<KeystonePlannerResponse>(resolve => { resolveStale = resolve; }))
      .mockImplementationOnce(() => new Promise<KeystonePlannerResponse>(resolve => { resolveLatest = resolve; }));
    renderPage(source({ getKeystonePlanner }));
    await selectRuby(user);
    await user.click(screen.getByRole("button", { name: "Planificar piedra" }));
    await user.click(screen.getByRole("button", { name: /\+12.*Bakuhatsu.*Speeson/u }));
    await user.click(screen.getByRole("button", { name: /Filtrar por Ana/u }));
    await user.click(screen.getByRole("button", { name: "Calcular Top 5" }));
    await waitFor(() => expect(document.querySelectorAll(".planner-recommendation")).toHaveLength(5));

    await user.click(screen.getByRole("checkbox", { name: "Ansia de sangre" }));
    await waitFor(() => expect(getKeystonePlanner).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole("checkbox", { name: "Resurrección en combate" }));
    await waitFor(() => expect(getKeystonePlanner).toHaveBeenCalledTimes(3));

    await act(async () => { resolveStale?.(stale); await Promise.resolve(); });
    expect(document.querySelector(".planner-score b")).toHaveTextContent("99");
    act(() => resolveLatest?.(latest));
    await waitFor(() => expect(document.querySelector(".planner-score b")).toHaveTextContent("42"));
  });

  it("localizes the Planner configuration in English", async () => {
    const user = userEvent.setup();
    renderPage(source(), "en");
    await user.click(await screen.findByRole("button", { name: /Ruby Life Pools/u }));
    await user.click(screen.getByRole("button", { name: "Plan keystone" }));
    expect(screen.getByRole("button", { name: "Configure my characters" })).toBeInTheDocument();
    expect(screen.getByText("The slider only filters available keystones.")).toBeInTheDocument();
  });

  it("blocks Planner configuration until the current user enables a specialization", async () => {
    const user = userEvent.setup();
    const unconfigured = { ...detail, members: detail.members.map(member => member.userId === 2 ? {
      ...member, plannerConfigured: false,
      characters: member.characters.map((character, index) => index === 0 ? { ...character, avatarUrl: "https://img.test/bakuhatsu.jpg" } : character),
    } : member) };
    const updatePlannerPreferences = vi.fn(async (update: ClientPlannerPreferenceUpdate) => ({ preferences: update.preferences.map(preference => ({
      ...preference, role: preference.specId === 66 || preference.specId === 73 ? "tank" as const : "dps" as const,
      lootSpecId: update.lootPreferences.find(loot => loot.characterId === preference.characterId)?.primaryLootSpecId ?? preference.specId,
      updatedAt: "2026-09-11T00:00:00Z",
    })), lootPreferences: update.lootPreferences.map(preference => ({ ...preference, updatedAt: "2026-09-11T00:00:00Z" })), onboardingCompleted: update.onboardingCompleted }));
    renderPage(source({ getTeam: vi.fn(async () => unconfigured), getPlannerPreferences: vi.fn(async () => ({ preferences: [], lootPreferences: [], onboardingCompleted: false })), updatePlannerPreferences }));
    await selectRuby(user);
    await user.click(screen.getByRole("button", { name: "Planificar piedra" }));

    const dialog = await screen.findByRole("dialog", { name: "Configura tus personajes" });
    expect(within(dialog).getByRole("button", { name: "Configurar botín de Bakuhatsu" }).querySelector("img"))
      .toHaveAttribute("src", expect.stringContaining("inv_misc_bag_10.jpg"));
    expect(within(dialog).getByRole("img", { name: "KeystoneSync" })).toBeInTheDocument();
    expect(dialog.querySelector('img[src="https://img.test/bakuhatsu.jpg"]')).toBeInTheDocument();
    expect(dialog.querySelector('[data-zone="active"] .planner-preference-character')).not.toBeInTheDocument();
    expect(dialog.querySelectorAll('[data-zone="inactive"] .planner-preference-character')).toHaveLength(2);
    expect(within(dialog).getByRole("button", { name: "Guardar y planificar" })).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: "Configurar botín de Bakuhatsu" }));
    const initialNoInterest = within(dialog).getAllByRole("button", { name: /· none$/u });
    expect(initialNoInterest).toHaveLength(3);
    initialNoInterest.forEach(option => expect(option).toHaveAttribute("aria-pressed", "true"));
    await user.click(within(dialog).getByRole("button", { name: "Arcane · primary" }));
    await user.click(within(dialog).getByRole("button", { name: "Listo" }));
    const inactiveCard = within(dialog).getByText("Bakuhatsu").closest(".planner-preference-character") as HTMLElement;
    const activeZone = dialog.querySelector('[data-zone="active"]') as HTMLElement;
    const transfer = { getData: () => "10", setData: vi.fn(), effectAllowed: "move", dropEffect: "move" };
    fireEvent.dragStart(inactiveCard, { dataTransfer: transfer });
    fireEvent.dragOver(activeZone, { dataTransfer: transfer });
    fireEvent.drop(activeZone, { dataTransfer: transfer });
    expect(within(dialog).getByRole("button", { name: /Arcane · Selecciona tu preferencia/u })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Guardar y planificar" })).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: /Arcane · Selecciona tu preferencia/u }));
    expect(within(dialog).getAllByRole("option")).toHaveLength(4);
    await user.click(within(dialog).getByRole("option", { name: /Preferida/u }));
    await user.click(within(dialog).getByRole("button", { name: "Guardar y planificar" }));
    await waitFor(() => expect(updatePlannerPreferences).toHaveBeenCalled());
    expect(screen.queryByRole("dialog", { name: "Configura tus personajes" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Configurar mis personajes" }));
    expect(screen.getByRole("dialog", { name: "Configura tus personajes" })).toBeVisible();
    expect(document.querySelector(".planner-config-guide")).not.toBeInTheDocument();
  });

  it("requires clearing the current primary loot spec before selecting another", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectRuby(user);
    await user.click(screen.getByRole("button", { name: "Planificar piedra" }));
    await user.click(await screen.findByRole("button", { name: "Configurar mis personajes" }));
    const dialog = screen.getByRole("dialog", { name: "Configura tus personajes" });
    await user.click(within(dialog).getByRole("button", { name: "Configurar botín de Bakuhatsu" }));

    const arcanePrimary = within(dialog).getByRole("button", { name: "Arcane · primary" });
    const firePrimary = within(dialog).getByRole("button", { name: "Fire · primary" });
    const fireSecondary = within(dialog).getByRole("button", { name: "Fire · secondary" });
    expect(arcanePrimary).toHaveAttribute("aria-pressed", "true");
    await user.click(fireSecondary);
    expect(fireSecondary).toHaveAttribute("aria-pressed", "true");

    await user.click(firePrimary);
    expect(screen.getByRole("alertdialog", { name: "Sólo puede haber una especialización primaria" })).toBeVisible();
    expect(arcanePrimary).toHaveAttribute("aria-pressed", "true");
    expect(fireSecondary).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Entendido" }));

    await user.click(arcanePrimary);
    expect(arcanePrimary).toHaveAttribute("aria-pressed", "false");
    expect(within(dialog).getByRole("button", { name: "Listo" })).toBeDisabled();
    await user.click(firePrimary);
    expect(firePrimary).toHaveAttribute("aria-pressed", "true");
    expect(fireSecondary).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles multiple secondary and no-interest loot specs independently", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectRuby(user);
    await user.click(screen.getByRole("button", { name: "Planificar piedra" }));
    await user.click(await screen.findByRole("button", { name: "Configurar mis personajes" }));
    const dialog = screen.getByRole("dialog", { name: "Configura tus personajes" });
    await user.click(within(dialog).getByRole("button", { name: "Configurar botín de Bakuhatsu" }));

    const fireSecondary = within(dialog).getByRole("button", { name: "Fire · secondary" });
    const frostSecondary = within(dialog).getByRole("button", { name: "Frost · secondary" });
    const frostNone = within(dialog).getByRole("button", { name: "Frost · none" });
    await user.click(fireSecondary);
    await user.click(frostSecondary);
    expect(fireSecondary).toHaveAttribute("aria-pressed", "true");
    expect(frostSecondary).toHaveAttribute("aria-pressed", "true");
    await user.click(frostSecondary);
    expect(frostSecondary).toHaveAttribute("aria-pressed", "false");
    expect(frostNone).toHaveAttribute("aria-pressed", "true");
  });

  it("checks saved preferences without flashing the mandatory configuration dialog", async () => {
    const user = userEvent.setup();
    let resolvePreferences!: (value: ClientPlannerPreferences) => void;
    const getPlannerPreferences = vi.fn(() => new Promise<ClientPlannerPreferences>(resolve => { resolvePreferences = resolve; }));
    renderPage(source({ getPlannerPreferences }));
    await selectRuby(user);

    await user.click(screen.getByRole("button", { name: "Planificar piedra" }));

    expect(screen.queryByRole("dialog", { name: "Configura tus personajes" })).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Cargando configuración del Planner…" })).toBeInTheDocument();
    await act(async () => resolvePreferences({ preferences: [{ characterId: 10, specId: 62, role: "dps", playPreference: "preferred", lootSpecId: 62, updatedAt: "2026-09-11T00:00:00Z" }], lootPreferences: [{ characterId: 10, primaryLootSpecId: 62, secondaryLootSpecIds: [], updatedAt: "2026-09-11T00:00:00Z" }], onboardingCompleted: true }));
    await waitFor(() => expect(screen.queryByRole("status", { name: "Cargando configuración del Planner…" })).not.toBeInTheDocument());
    expect(screen.queryByRole("dialog", { name: "Configura tus personajes" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Configurar mis personajes" })).toBeInTheDocument();
  });

  it("keeps configuration mandatory when persisted Planner preferences were deleted", async () => {
    const user = userEvent.setup();
    renderPage(source({ getPlannerPreferences: vi.fn(async () => ({ preferences: [], lootPreferences: [], onboardingCompleted: false })) }));
    await selectRuby(user);

    await user.click(screen.getByRole("button", { name: "Planificar piedra" }));

    const dialog = await screen.findByRole("dialog", { name: "Configura tus personajes" });
    expect(dialog).toBeVisible();
    expect(screen.getByRole("button", { name: "Planificar piedra" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(dialog).getByRole("button", { name: "Salir del Planner" }));
    expect(screen.getByRole("button", { name: "Objetivos" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps configuration mandatory when a playable spec has no primary loot preference", async () => {
    const user = userEvent.setup();
    renderPage(source({ getPlannerPreferences: vi.fn(async () => ({
      preferences: [{ characterId: 10, specId: 62, role: "dps" as const, playPreference: "preferred" as const, lootSpecId: 62, updatedAt: "2026-09-11T00:00:00Z" }],
      lootPreferences: [],
      onboardingCompleted: true,
    })) }));
    await selectRuby(user);

    await user.click(screen.getByRole("button", { name: "Planificar piedra" }));

    expect(await screen.findByRole("dialog", { name: "Configura tus personajes" })).toBeVisible();
  });

  it("revalidates preferences on every Planner entry and blocks after a remote deletion", async () => {
    const user = userEvent.setup();
    const configuredPreference: ClientPlannerPreference = { characterId: 10, specId: 62, role: "dps", playPreference: "preferred", lootSpecId: 62, updatedAt: "2026-09-11T00:00:00Z" };
    const getPlannerPreferences = vi.fn()
      .mockResolvedValueOnce({ preferences: [configuredPreference], lootPreferences: [{ characterId: 10, primaryLootSpecId: 62, secondaryLootSpecIds: [], updatedAt: "2026-09-11T00:00:00Z" }], onboardingCompleted: true })
      .mockResolvedValueOnce({ preferences: [], lootPreferences: [], onboardingCompleted: true });
    renderPage(source({ getPlannerPreferences }));
    await selectRuby(user);

    await user.click(screen.getByRole("button", { name: "Planificar piedra" }));
    expect(await screen.findByRole("button", { name: "Configurar mis personajes" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Configura tus personajes" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Objetivos" }));
    await user.click(screen.getByRole("button", { name: "Planificar piedra" }));

    expect(await screen.findByRole("dialog", { name: "Configura tus personajes" })).toBeVisible();
    expect(getPlannerPreferences).toHaveBeenCalledTimes(2);
  });

  it("does not restore specializations when an inactive character returns to the active zone", async () => {
    const user = userEvent.setup();
    renderPage();
    await selectRuby(user);
    await user.click(screen.getByRole("button", { name: "Planificar piedra" }));
    await user.click(await screen.findByRole("button", { name: "Configurar mis personajes" }));
    const dialog = screen.getByRole("dialog", { name: "Configura tus personajes" });

    expect(dialog.querySelector('[data-zone="active"]')).toHaveTextContent("Bakuhatsu");
    const inactiveZone = dialog.querySelector('[data-zone="inactive"]') as HTMLElement;
    const activeZone = dialog.querySelector('[data-zone="active"]') as HTMLElement;
    const transfer = { getData: () => "10", setData: vi.fn(), effectAllowed: "move", dropEffect: "move" };
    const activeCard = within(dialog).getByText("Bakuhatsu").closest(".planner-preference-character") as HTMLElement;
    fireEvent.dragStart(activeCard, { dataTransfer: transfer });
    fireEvent.dragOver(inactiveZone, { dataTransfer: transfer });
    fireEvent.drop(inactiveZone, { dataTransfer: transfer });
    expect(dialog.querySelector('[data-zone="inactive"]')).toHaveTextContent("Bakuhatsu");
    const inactiveCard = within(dialog).getByText("Bakuhatsu").closest(".planner-preference-character") as HTMLElement;
    fireEvent.dragStart(inactiveCard, { dataTransfer: transfer });
    fireEvent.dragOver(activeZone, { dataTransfer: transfer });
    fireEvent.drop(activeZone, { dataTransfer: transfer });

    expect(dialog.querySelector('[data-zone="active"]')).toHaveTextContent("Bakuhatsu");
    expect(within(dialog).getByRole("button", { name: /Arcane · Desactivada/u })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Guardar y planificar" })).toBeDisabled();
  });

  it("disables unconfigured teammates and exposes no manual role locks", async () => {
    const user = userEvent.setup();
    const partiallyConfigured = { ...detail, members: detail.members.map(member => member.userId === 3 ? { ...member, plannerConfigured: false } : member) };
    renderPage(source({ getTeam: vi.fn(async () => partiallyConfigured) }));
    await selectRuby(user);
    await user.click(screen.getByRole("button", { name: "Planificar piedra" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    expect(screen.getByRole("button", { name: /Filtrar por Ana/u })).toBeDisabled();
    expect(screen.queryByLabelText(/Rol fijo/u)).not.toBeInTheDocument();
    expect(document.querySelector(".planner-participant-list")).not.toBeInTheDocument();
  });

  it("uses Wowhead item tooltips from the compact objective grid", async () => {
    const user = userEvent.setup();
    renderPage();
    const rows = await selectRuby(user);
    await user.click(within(rows[0]).getByRole("button", { name: /Ver objetos.*Bakuhatsu/u }));
    const target = within(rows[0]).getByRole("link", { name: "Objeto #1" });
    expect(target).toHaveAttribute("href", "https://www.wowhead.com/item=1");
    expect(target).toHaveAttribute("data-wowhead", expect.stringContaining("domain=es"));
    expect(target).toHaveAttribute("data-wowhead", expect.stringContaining("ilvl=402"));
    expect(target).toHaveAttribute("data-wowhead", expect.stringContaining("spec=62"));
  });

  it("shows no-Team state and routes compact errors and session expiry", async () => {
    const onOpenWeb = vi.fn();
    renderWithTheme(<I18nProvider language="es"><TeamsPage currentUsername="Speeson" dataSource={source({ listTeams: vi.fn(async () => []) })} onOpenWeb={onOpenWeb} onSessionExpired={vi.fn()} /></I18nProvider>);
    expect(await screen.findByText("Todavía no perteneces a ningún equipo.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Acceder a la Web" }));
    expect(onOpenWeb).toHaveBeenCalledOnce();

    const expired = source({ listTeams: vi.fn(async () => { throw { code: "SESSION_EXPIRED", message: "Caducada" }; }) });
    const onSessionExpired = vi.fn();
    renderPage(expired, "es", onSessionExpired);
    await waitFor(() => expect(onSessionExpired).toHaveBeenCalledOnce());
  });

  it("recovers from revoked Team detail access and advances to the next Team", async () => {
    const next = { ...detail, id: 8, name: "Second Team", members: [] };
    const dataSource = source({
      listTeams: vi.fn(async () => [{ id: 7, name: detail.name, memberCount: 2 }, { id: 8, name: next.name, memberCount: 0 }]),
      getTeam: vi.fn(async id => { if (id === 7) throw { code: "TEAM_ACCESS_DENIED", message: "Sin acceso" }; return next; }),
    });
    renderPage(dataSource);
    expect(await screen.findByRole("button", { name: "Second Team" })).toBeInTheDocument();
    expect(dataSource.getTeam).toHaveBeenNthCalledWith(1, 7);
    await waitFor(() => expect(dataSource.getTeam).toHaveBeenNthCalledWith(2, 8));
  });

  it("renders the redesigned controls in English", async () => {
    const dataSource = source();
    renderPage(dataSource, "en");
    expect(await screen.findByText("Select a dungeon to see the Team's objectives.")).toBeInTheDocument();
    expect(screen.getByText("Lit keystones are currently available.")).toBeInTheDocument();
    expect(screen.getByText("You can also inspect dungeons without a keystone.")).toBeInTheDocument();
    expect(screen.getByLabelText("Member filters")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Filter by Speeson, 2 characters" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filter by Ana con un nombre largo, 1 character" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Ruby Life Pools/u }));
    expect(dataSource.getKeystoneSelector).toHaveBeenCalledWith(7, 399, "en_US");
    const firstRow = (await screen.findAllByTestId("selector-character"))[0];
    await userEvent.click(within(firstRow).getByRole("button", { name: /Show items/u }));
    const target = within(firstRow).getByRole("link", { name: "Item #1" });
    expect(target).toHaveAttribute("href", "https://www.wowhead.com/item=1");
    expect(target).toHaveAttribute("data-wowhead", expect.stringContaining("domain=www"));
    expect(target).toHaveAttribute("data-wowhead", expect.stringContaining("ilvl=402"));
    expect(target).toHaveAttribute("data-wowhead", expect.stringContaining("spec=62"));
  });
});
