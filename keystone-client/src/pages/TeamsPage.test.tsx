import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider, type Language } from "../core/i18n";
import type { TeamsDataSource } from "../core/teams";
import {
  clearTeamsSessionCache, loadTeamDetail, loadTeams, setSelectedTeamId,
} from "../core/teamsSessionCache";
import type { ClientPlannerPreference, ClientPlannerPreferenceInput, ClientTeamDetail, KeystonePlannerResponse, KeystoneSelectorObjective, KeystoneSelectorResponse } from "../core/types";
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
  const assignments = [
    { userId: 3, username: "Ana", characterId: 12, characterName: "Spee", wowClass: "Paladin", specId: 66, role: "tank" as const, lootSpecId: 66, playPreference: "preferred" as const, objectives: [{ itemId: 8, itemName: "Escudo", iconUrl: null, tier: 3, variantKey: "planner:8", voidcoreState: "pending" as const }], capabilities: [] },
    { userId: 2, username: "Speeson", characterId: 10, characterName: "Bakuhatsu", wowClass: "Mage", specId: 62, role: "dps" as const, lootSpecId: 62, playPreference: "preferred" as const, objectives: [{ itemId: 1, itemName: "Báculo", iconUrl: null, tier: 2, variantKey: "planner:1", voidcoreState: "pending" as const }], capabilities: [] },
  ];
  const recommendation = (rank: number) => ({
    rank, fingerprint: `planner-${rank}`,
    stone: { characterId: 10, characterName: "Bakuhatsu", ownerUserId: 2, ownerUsername: "Speeson", challengeMapId: 399, dungeon: "Ruby Life Pools", level: 12 },
    assignments, vacancies: [{ role: "healer" as const, preferredCapabilities: [] }],
    lootSummary: { weightedScore: 100 - rank, playersWithObjectives: 2, totalObjectives: 2, tierCounts: { bestInSlot: 1, mustHave: 1, niceToHave: 0, catalyst: 0, transmog: 0 } },
    levelSummary: { targetLevel: 12, stoneLevel: 12, levelDistance: 0 }, preferenceSummary: { preferred: 2, available: 0, emergency: 0 },
    compositionSummary: { bloodlust: "guaranteed" as const, battleRez: "none" as const, uniqueCapabilities: [], damageProfile: "magical" as const, magicalDpsCount: 1, physicalDpsCount: 0, unknownDpsCount: 0, chaosBrandBeneficiaries: 1, mysticTouchBeneficiaries: 0, uniqueClassBuffCount: 1 },
    reasonCodes: ["PARTY_INCOMPLETE", "HAS_LOOT_OBJECTIVES", "TARGET_LEVEL_EXACT"],
  });
  return { teamId: 7, challengeMapId: 399, targetLevel: 12, availability: { eligibleStoneCount: 1 }, status: "ok", diagnostics: { codes: [], unconfiguredUserIds: [], lockIssues: [] }, recommendations: [1, 2, 3, 4, 5].map(recommendation) };
}

function source(overrides: Partial<TeamsDataSource> = {}): TeamsDataSource {
  return {
    listTeams: vi.fn(async () => [{ id: 7, name: detail.name, memberCount: detail.members.length }]),
    getTeam: vi.fn(async () => detail),
    getKeystoneSelector: vi.fn(async () => selector),
    getKeystonePlanner: vi.fn(async () => { throw { code: "API_UNAVAILABLE", message: "Planner unavailable" }; }),
    getPlannerPreferences: vi.fn(async () => ({ preferences: [{ characterId: 10, specId: 62, role: "dps" as const, playPreference: "preferred" as const, lootSpecId: 62, updatedAt: "2026-09-11T00:00:00Z" }] })),
    updatePlannerPreferences: vi.fn(async (preferences: ClientPlannerPreferenceInput[]) => ({ preferences: preferences.map(preference => ({ ...preference, role: "dps" as const, updatedAt: "2026-09-11T00:00:00Z" })) })),
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

describe("TeamsPage compact ranking", () => {
  beforeEach(() => clearTeamsSessionCache());

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
    const cards = [...document.querySelectorAll<HTMLElement>(".planner-recommendation")];
    expect(cards[0]).toHaveAttribute("data-expanded", "false");
    await user.click(within(cards[1]).getByRole("button"));
    expect(cards[0]).toHaveAttribute("data-expanded", "false");
    expect(cards[1]).toHaveAttribute("data-expanded", "true");
    expect(within(cards[1]).getByText("Buffos y sinergias")).toBeInTheDocument();
    expect(cards[1].querySelector(".planner-recommendation__metrics")).toHaveTextContent("2 Objetivos");
    expect(cards[1].querySelector(".planner-recommendation__metrics")).toHaveTextContent("2 Preferidos");
    expect(within(cards[1]).queryByText("Paladin · Protection")).not.toBeInTheDocument();
    expect(within(cards[1]).queryByTitle("Paladin")).not.toBeInTheDocument();
    expect(within(cards[1]).getByTitle("Protection").querySelector("img")).toHaveAttribute("src", expect.stringContaining("236264"));
    expect(within(cards[1]).getByRole("link", { name: "Escudo" })).toHaveAttribute("data-wowhead", expect.stringContaining("spec=66"));
    expect(within(cards[1]).queryByLabelText("Dueño de la piedra +12")).not.toBeInTheDocument();
    await user.click(within(cards[1]).getByRole("button", { name: /Ver todos los objetivos · Bakuhatsu · 6/u }));
    const breakdown = screen.getByRole("dialog", { name: /Desglose de objetivos · Bakuhatsu/u });
    expect(within(breakdown).getByText("BiS · 1")).toBeInTheDocument();
    expect(within(breakdown).getByText("Must · 1")).toBeInTheDocument();
    expect(within(breakdown).getByText("Catalyst · 1")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /Desglose de objetivos/u })).not.toBeInTheDocument();
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
    const updatePlannerPreferences = vi.fn(async (preferences: ClientPlannerPreferenceInput[]) => ({ preferences: preferences.map(preference => ({
      ...preference, role: preference.specId === 66 || preference.specId === 73 ? "tank" as const : "dps" as const, updatedAt: "2026-09-11T00:00:00Z",
    })) }));
    renderPage(source({ getTeam: vi.fn(async () => unconfigured), getPlannerPreferences: vi.fn(async () => ({ preferences: [] })), updatePlannerPreferences }));
    await selectRuby(user);
    await user.click(screen.getByRole("button", { name: "Planificar piedra" }));

    const dialog = await screen.findByRole("dialog", { name: "Configura tus personajes" });
    expect(within(dialog).getByRole("img", { name: "KeystoneSync" })).toBeInTheDocument();
    expect(dialog.querySelector('img[src="https://img.test/bakuhatsu.jpg"]')).toBeInTheDocument();
    expect(dialog.querySelector('[data-zone="active"] .planner-preference-character')).not.toBeInTheDocument();
    expect(dialog.querySelectorAll('[data-zone="inactive"] .planner-preference-character')).toHaveLength(2);
    expect(within(dialog).getByRole("button", { name: "Guardar y planificar" })).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: "Activar Bakuhatsu" }));
    expect(within(dialog).getByRole("button", { name: /Arcane · Desactivado/u })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Guardar y planificar" })).toBeDisabled();
    await user.click(within(dialog).getByRole("button", { name: /Arcane · Desactivado/u }));
    expect(within(dialog).getAllByRole("option", { name: "Preferido" }).length).toBeGreaterThan(0);
    expect(within(dialog).getAllByRole("option", { name: "Disponible" }).length).toBeGreaterThan(0);
    expect(within(dialog).getAllByRole("option", { name: "Emergencia" }).length).toBeGreaterThan(0);
    expect(within(dialog).getAllByRole("option", { name: "Desactivado" }).length).toBeGreaterThan(0);
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Bakuhatsu Arcane" }), "preferred");
    await user.click(within(dialog).getByRole("button", { name: "Guardar y planificar" }));
    await waitFor(() => expect(updatePlannerPreferences).toHaveBeenCalled());
    expect(screen.queryByRole("dialog", { name: "Configura tus personajes" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Configurar mis personajes" })).toBeInTheDocument();
  });

  it("checks saved preferences without flashing the mandatory configuration dialog", async () => {
    const user = userEvent.setup();
    let resolvePreferences!: (value: { preferences: ClientPlannerPreference[] }) => void;
    const getPlannerPreferences = vi.fn(() => new Promise<{ preferences: ClientPlannerPreference[] }>(resolve => { resolvePreferences = resolve; }));
    renderPage(source({ getPlannerPreferences }));
    await selectRuby(user);

    await user.click(screen.getByRole("button", { name: "Planificar piedra" }));

    expect(screen.queryByRole("dialog", { name: "Configura tus personajes" })).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Cargando configuración del Planner…" })).toBeInTheDocument();
    await act(async () => resolvePreferences({ preferences: [{ characterId: 10, specId: 62, role: "dps", playPreference: "preferred", lootSpecId: 62, updatedAt: "2026-09-11T00:00:00Z" }] }));
    await waitFor(() => expect(screen.queryByRole("status", { name: "Cargando configuración del Planner…" })).not.toBeInTheDocument());
    expect(screen.queryByRole("dialog", { name: "Configura tus personajes" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Configurar mis personajes" })).toBeInTheDocument();
  });

  it("keeps configuration mandatory when persisted Planner preferences were deleted", async () => {
    const user = userEvent.setup();
    renderPage(source({ getPlannerPreferences: vi.fn(async () => ({ preferences: [] })) }));
    await selectRuby(user);

    await user.click(screen.getByRole("button", { name: "Planificar piedra" }));

    const dialog = await screen.findByRole("dialog", { name: "Configura tus personajes" });
    expect(dialog).toBeVisible();
    expect(screen.getByRole("button", { name: "Planificar piedra" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(dialog).getByRole("button", { name: "Salir del Planner" }));
    expect(screen.getByRole("button", { name: "Objetivos" })).toHaveAttribute("aria-pressed", "true");
  });

  it("revalidates preferences on every Planner entry and blocks after a remote deletion", async () => {
    const user = userEvent.setup();
    const configuredPreference: ClientPlannerPreference = { characterId: 10, specId: 62, role: "dps", playPreference: "preferred", lootSpecId: 62, updatedAt: "2026-09-11T00:00:00Z" };
    const getPlannerPreferences = vi.fn()
      .mockResolvedValueOnce({ preferences: [configuredPreference] })
      .mockResolvedValueOnce({ preferences: [] });
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
    await user.click(within(dialog).getByRole("button", { name: "Desactivar Bakuhatsu" }));
    expect(dialog.querySelector('[data-zone="inactive"]')).toHaveTextContent("Bakuhatsu");
    await user.click(within(dialog).getByRole("button", { name: "Activar Bakuhatsu" }));

    expect(dialog.querySelector('[data-zone="active"]')).toHaveTextContent("Bakuhatsu");
    expect(within(dialog).getByRole("button", { name: /Arcane · Desactivado/u })).toBeEnabled();
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
