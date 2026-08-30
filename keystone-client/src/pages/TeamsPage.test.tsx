import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider, type Language } from "../core/i18n";
import type { TeamsDataSource } from "../core/teams";
import type { ClientTeamDetail, KeystoneSelectorObjective, KeystoneSelectorResponse } from "../core/types";
import { renderWithTheme } from "../test/renderWithTheme";
import { TeamsPage } from "./TeamsPage";

const tiers = { bestInSlot: 1, mustHave: 1, niceToHave: 1, catalyst: 1, transmog: 1, other: 1 };
const objective = (itemId: number, tier: number, overrides: Partial<KeystoneSelectorObjective> = {}): KeystoneSelectorObjective => ({
  itemId, itemName: `Objeto ${itemId}`, iconUrl: null, tier, specIds: [62], sourceType: "dungeon", sourceId: 399,
  slotId: 16, slotName: "Mano principal", itemClassName: "Arma", itemSubClassName: "Báculo",
  statNames: ["Intelecto", "Celeridad"], primaryStatNames: ["Intelecto"],
  secondaryStatNames: ["Celeridad"], otherStatNames: [], qualityType: "EPIC",
  voidcoreState: "pending", ...overrides,
});

const detail: ClientTeamDetail = {
  id: 7, name: "Mythiqueros 2.0", members: [
    { userId: 2, username: "Speeson", characters: [
      { characterId: 10, name: "Bakuhatsu", realm: "Zul'jin", region: "eu", wowClass: "Mage", avatarUrl: null, ilvl: 300, rioScore: 2500, currentKeystone: { level: 12, challengeMapId: 399, dungeon: "Ruby Life Pools" } },
      { characterId: 11, name: "Makabe", realm: "Zul'jin", region: "eu", wowClass: "Warrior", avatarUrl: null, ilvl: 299, rioScore: 2400, currentKeystone: { level: 10, challengeMapId: 250, dungeon: "Temple of Sethraliss" } },
    ] },
    { userId: 3, username: "Ana con un nombre largo", characters: [
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

function source(overrides: Partial<TeamsDataSource> = {}): TeamsDataSource {
  return {
    listTeams: vi.fn(async () => [{ id: 7, name: detail.name, memberCount: detail.members.length }]),
    getTeam: vi.fn(async () => detail),
    getKeystoneSelector: vi.fn(async () => selector),
    ...overrides,
  };
}

function renderPage(dataSource = source(), language: Language = "es", onSessionExpired = vi.fn()) {
  return { dataSource, onSessionExpired, ...renderWithTheme(
    <I18nProvider language={language}><TeamsPage dataSource={dataSource} onOpenWeb={vi.fn()} onSessionExpired={onSessionExpired} /></I18nProvider>,
  ) };
}

async function selectRuby(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /Ruby Life Pools/u }));
  return screen.findAllByTestId("selector-character");
}

describe("TeamsPage compact ranking", () => {
  it("renders the compact Team trigger, member strip, eight locally-derived stone counts and minimal initial state", async () => {
    renderPage();
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
    expect(screen.getByText("Las piedras iluminadas están disponibles actualmente.")).toBeInTheDocument();
    expect(screen.getByText("También puedes consultar mazmorras sin piedra.")).toBeInTheDocument();
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

  it("ignores an older Team detail response after switching Teams", async () => {
    const user = userEvent.setup();
    const second: ClientTeamDetail = { id: 8, name: "Second Team", members: [{ userId: 9, username: "Newest", characters: [] }] };
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
    expect(screen.getByRole("button", { name: /Planificar piedra/u })).toBeDisabled();
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

  it("opens the existing safe tooltip from the compact grid and dismisses it with Escape", async () => {
    const user = userEvent.setup();
    renderPage();
    const rows = await selectRuby(user);
    await user.click(within(rows[0]).getByRole("button", { name: /Ver objetos.*Bakuhatsu/u }));
    await user.click(within(rows[0]).getByRole("button", { name: "Objeto #1" }));
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Mano principal · Arma · Báculo");
    expect(tooltip).toHaveTextContent("Intelecto");
    expect(tooltip).toHaveAttribute("data-quality", "EPIC");
    expect(within(tooltip).getByText("Intelecto")).toHaveClass("teams-tooltip__primary-stat");
    expect(within(tooltip).getByText("Celeridad")).toHaveClass("teams-tooltip__secondary-stat");
    expect(tooltip).not.toHaveTextContent(/\+\d/u);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows no-Team state and routes compact errors and session expiry", async () => {
    const onOpenWeb = vi.fn();
    renderWithTheme(<I18nProvider language="es"><TeamsPage dataSource={source({ listTeams: vi.fn(async () => []) })} onOpenWeb={onOpenWeb} onSessionExpired={vi.fn()} /></I18nProvider>);
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
    renderPage(source(), "en");
    expect(await screen.findByText("Select a dungeon to see the Team's objectives.")).toBeInTheDocument();
    expect(screen.getByText("Lit keystones are currently available.")).toBeInTheDocument();
    expect(screen.getByText("You can also inspect dungeons without a keystone.")).toBeInTheDocument();
    expect(screen.getByLabelText("Member filters")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Filter by Speeson, 2 characters" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filter by Ana con un nombre largo, 1 character" })).toBeInTheDocument();
  });
});
