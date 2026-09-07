import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { charactersPreview } from "../core/charactersPreview";
import { I18nProvider } from "../core/i18n";
import { renderWithTheme } from "../test/renderWithTheme";
import { CharactersPage } from "./CharactersPage";

const state = { characters: charactersPreview(), refreshing: false, source: "remote" as const, lastRefreshAt: null, lastError: null };

function renderPage(characterState = state) {
  return renderWithTheme(<I18nProvider language="es"><CharactersPage state={characterState}/></I18nProvider>);
}

describe("CharactersPage", () => {
  it("renders the PNG structure with one-row gear, eight dungeons and ten currencies", () => {
    const { container } = renderPage();
    expect(container.querySelectorAll(".gear-item")).toHaveLength(16);
    expect(container.querySelectorAll(".dungeon-grid article")).toHaveLength(8);
    expect(container.querySelectorAll(".currency-card")).toHaveLength(10);
    expect(screen.getByRole("heading", { name: /EQUIPO/ })).toBeVisible();
    expect(screen.getByRole("heading", { name: "TALENTOS" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "GRAN CÁMARA" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "CACERÍAS" })).toBeVisible();
    const untainted = container.querySelector('[data-currency="untaintedManaCrystals"]')!;
    expect(within(untainted as HTMLElement).getByText("Semanal 250 / 250")).toHaveClass("is-maxed");
    expect(within(untainted as HTMLElement).getByText("Máximo 143 / 1000")).not.toHaveClass("is-maxed");
    expect(container.querySelector('[data-currency="cofferKeyShards"]')).toHaveClass("is-maxed");
    expect(screen.queryByText("MAX")).not.toBeInTheDocument();
    expect(screen.getByText("Altar de los Colmillos")).toBeVisible();
    expect(screen.getByText("Frontal de la Muerte")).toBeVisible();
    expect(screen.getByText("Arena Lacravacua")).toBeVisible();
    expect(container.querySelector(".money-card__icon img")).toHaveAttribute("src", expect.stringContaining("133785"));
  });

  it("uses localized currency names in Spanish", () => {
    renderPage();
    expect(screen.getByText("Blasón de bruma de héroe")).toBeVisible();
    expect(screen.getByText("Blasón de bruma de mito")).toBeVisible();
    expect(screen.getByText("Chispa de las mareas")).toBeVisible();
    expect(screen.queryByText("Hero Mistcrest")).not.toBeInTheDocument();
  });

  it("uses active-spec Wowhead item tooltips without the native title popup", () => {
    const { container } = renderPage();
    const item = container.querySelector<HTMLAnchorElement>(".gear-item__piece")!;
    expect(item).not.toHaveAttribute("title");
    expect(item.dataset.wowhead).toContain("spec=102");
  });

  it("shows real gem and enchant icons below equipped items", () => {
    const characters = charactersPreview();
    characters[0].equipment!.items[0].gems[0].iconFileID = 133785;
    characters[0].equipment!.items[0].enchant!.iconFileID = 133785;
    const { container } = renderPage({ ...state, characters });
    const extras = container.querySelector(".gear-item__extras")!;
    expect(extras.querySelector(".gear-item__gem img")).toHaveAttribute("src", expect.stringContaining("133785"));
    expect(extras.querySelector(".gear-item__enchant img")).toHaveAttribute("src", expect.stringContaining("133785"));
  });

  it("uses an unclipped portal fallback and never treats enchantId as a spellId", () => {
    const characters = charactersPreview();
    characters[0].equipment!.items[0].enchant = { enchantId: 7961, spellId: null, name: "Hex de parasitismo potenciado", iconFileID: null };
    const { container } = renderPage({ ...state, characters });
    const enchant = container.querySelector(".gear-item__enchant")!;
    expect(enchant).not.toHaveAttribute("title");
    expect(enchant.closest("a[href*='/spell=7961']")).toBeNull();
    expect(enchant.querySelector("img")).toHaveAttribute("src", expect.stringContaining("463531"));
    fireEvent.mouseEnter(enchant);
    const tooltip = screen.getByRole("tooltip", { name: "Hex de parasitismo potenciado" });
    expect(tooltip.parentElement).toBe(document.body);
    expect(tooltip).toHaveClass("floating-local-tooltip");
  });

  it("replaces the native Account and Realm arrows with the character-card chevron", () => {
    const { container } = renderPage();
    const selectors = container.querySelectorAll(".characters-select");
    expect(selectors).toHaveLength(2);
    selectors.forEach(selector => expect(selector.querySelector(".characters-select__trigger b[aria-hidden=true]")).toHaveTextContent("›"));
  });

  it("adds identity, Wowhead tooltips and a full-width action to the talent preview", () => {
    const { container } = renderPage();
    expect(container.querySelectorAll(".talent-preview a[data-wowhead]").length).toBeGreaterThan(0);
    expect(container.querySelector(".talents-panel__identity")).toHaveTextContent("Equilibrio");
    expect(container.querySelector(".talents-panel__identity")).toHaveTextContent("Elegido de Elune");
    expect(container.querySelectorAll(".talents-panel__identity img")).toHaveLength(2);
    expect(container.querySelectorAll<HTMLImageElement>(".talents-panel__identity img")[0].src).toContain("136096");
    expect(container.querySelectorAll<HTMLImageElement>(".talents-panel__identity img")[1].src).toContain("dungeon-teleports");
    expect(screen.getByRole("button", { name: "Mostrar configuración completa" })).toBeVisible();
  });

  it("stacks larger gem and enchant indicators below each equipped item", () => {
    const { container } = renderPage();
    const extras = container.querySelector(".gear-item__extras")!;
    expect(extras.querySelector(".gear-item__gems")).toBeInTheDocument();
    expect(extras.querySelector(".gear-item__enchant img")).toBeInTheDocument();
  });

  it("localizes English talent identities captured by an English WoW client", async () => {
    const user = userEvent.setup();
    const characters = charactersPreview();
    characters[0].talents!.specName = "Balance";
    characters[0].talents!.class = "Druid";
    const hero = characters[0].talents!.trees.find(tree => tree.type === "hero")!;
    hero.name = "Elune's Chosen";
    hero.subTreeId = 24;
    const { container } = renderPage({ ...state, characters });
    expect(container.querySelector(".talents-panel__identity")).toHaveTextContent("Equilibrio");
    expect(container.querySelector(".talents-panel__identity")).toHaveTextContent("Elegido de Elune");
    await user.click(screen.getByRole("button", { name: /Mostrar configuración completa/i }));
    expect(screen.getByRole("dialog").querySelector(".ks-talent-modal__identity")).toHaveTextContent("Bakuhatsu - Druida Equilibrio - Elegido de Elune");
  });

  it("uses the Web currency semantic colors on card titles", () => {
    const { container } = renderPage();
    expect(container.querySelector('[data-currency="heroMistcrest"] .currency-card__content > small')).toHaveStyle("color: #c084fc");
    expect(container.querySelector('[data-currency="cofferKeyShards"] .currency-card__content > small')).toHaveStyle("color: #38bdf8");
  });

  it("places compact currencies beside a vertical progress and gold sidebar", () => {
    const { container } = renderPage();
    expect(container.querySelector(".characters-main-column .currencies-panel")).toBeInTheDocument();
    expect(container.querySelector(".characters-sidebar .vault-panel")).toBeInTheDocument();
    expect(container.querySelector(".characters-sidebar .prey-panel")).toBeInTheDocument();
    expect(container.querySelector(".characters-sidebar .money-card")).toBeInTheDocument();
    expect(container.querySelector(".currency-stack")).not.toBeInTheDocument();
  });

  it("orders currencies vertically in the five requested columns", () => {
    const { container } = renderPage();
    expect(Array.from(container.querySelectorAll(".currency-card"), card => card.getAttribute("data-currency"))).toEqual([
      "heroMistcrest", "cofferKeyShards", "tidalSparkDust", "venomblightManaflux", "untaintedManaCrystals",
      "mythMistcrest", "restoredCofferKey", "sparksOfTides", "nebulousVoidcore", "trovehuntersBounty",
    ]);
    const grid = container.querySelector('[data-currency="trovehuntersBounty"]')?.parentElement?.parentElement;
    expect(grid).toHaveClass("currencies-grid");
    expect(grid).not.toContainElement(container.querySelector(".money-card"));
  });

  it("recalculates realms and characters when the account changes", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "CUENTA" }));
    await user.click(screen.getByRole("option", { name: "WOW Account 2" }));
    expect(screen.getByRole("button", { name: "REINO" })).toHaveTextContent("Sanguino");
    expect(screen.getByRole("button", { name: /Morwyn/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Bakuhatsu/ })).not.toBeInTheDocument();
  });

  it("uses themed custom popovers and translates rail labels in English", async () => {
    const user = userEvent.setup();
    const { container } = renderWithTheme(<I18nProvider language="en"><CharactersPage state={state}/></I18nProvider>);
    expect(screen.getByText("ACCOUNT")).toBeVisible();
    expect(screen.getByText("REALM")).toBeVisible();
    expect(screen.getByText("CHARACTERS")).toBeVisible();
    expect(container.querySelector("select")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ACCOUNT" }));
    expect(screen.getByRole("listbox", { name: "ACCOUNT" })).toHaveClass("characters-select__popover");
  });

  it("opens the read-only full talent trees and copies the captured import string", async () => {
    const user = userEvent.setup(); renderPage();
    await user.click(screen.getByRole("button", { name: "Mostrar configuración completa" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Elegido de Elune")).toBeVisible();
    expect(dialog.querySelector(".ks-talent-modal__identity")).toHaveTextContent("Bakuhatsu - Druida Equilibrio - Elegido de Elune");
    expect(dialog.querySelector(".ks-talent-modal__panel")).toHaveStyle("--class-color: #FF7C0A");
    expect(dialog.querySelectorAll("[data-tree-type]")).toHaveLength(4);
    expect(dialog.querySelector(".ks-talent-modal__content > .ks-talent-modal__omnium")).toBeInTheDocument();
    expect(dialog.querySelectorAll(".ks-talent-tree__edges line").length).toBeGreaterThan(0);
    expect(within(dialog).getByRole("button", { name: "Copiar build" })).toBeEnabled();
  });

  it("uses Blizzard's explicitly active Hero subtree when multiple choices are captured", async () => {
    const user = userEvent.setup();
    const characters = charactersPreview();
    const activeHero = characters[0].talents!.trees.find(tree => tree.type === "hero")!;
    characters[0].talents!.trees.splice(1, 0, { ...activeHero, active: false, name: "KEEPER OF THE GROVE" });
    renderPage({ ...state, characters });
    await user.click(screen.getByRole("button", { name: "Mostrar configuración completa" }));
    expect(within(screen.getByRole("dialog")).getByText("Elegido de Elune")).toBeVisible();
    expect(within(screen.getByRole("dialog")).queryByText("KEEPER OF THE GROVE")).not.toBeInTheDocument();
  });

  it("lights an active Hero entry even when an older snapshot has a zero node rank", async () => {
    const user = userEvent.setup();
    const characters = charactersPreview();
    const hero = characters[0].talents!.trees.find(tree => tree.type === "hero")!;
    hero.nodes[0].ranksPurchased = 0;
    hero.nodes[0].entries[0].selected = true;
    hero.nodes[0].entries[0].rank = 1;
    renderPage({ ...state, characters });
    await user.click(screen.getByRole("button", { name: /Mostrar configuración completa/i }));
    expect(screen.getByRole("dialog").querySelector("[data-tree-type=hero] .ks-talent-node")).toHaveClass("is-selected");
  });

  it("shows Blizzard-derived dungeon, raid and world details in Great Vault tooltips", () => {
    const { container } = renderPage();
    const tooltips = container.querySelectorAll(".vault-slot__tooltip");
    expect(tooltips).toHaveLength(9);
    expect(Array.from(tooltips).some(tooltip => tooltip.textContent?.includes("+12 Altar de los Colmillos"))).toBe(true);
    expect(Array.from(tooltips).some(tooltip => tooltip.textContent?.includes("Reina Ansurek"))).toBe(true);
    expect(Array.from(tooltips).some(tooltip => tooltip.textContent?.includes("Nivel 8 × 2"))).toBe(true);
    expect(Array.from(container.querySelectorAll(".vault-slot__tooltip > em.is-completed"))
      .some(line => line.textContent?.includes("Reina Ansurek"))).toBe(true);
  });

  it("centers a single-column Omnium tree instead of pinning it to the left inset", async () => {
    const user = userEvent.setup();
    const characters = charactersPreview();
    characters[0].omniumFolio!.trees[0].nodes.forEach(node => { node.posX = 42; });
    renderPage({ ...state, characters });
    await user.click(screen.getByRole("button", { name: "Mostrar configuración completa" }));
    const omnium = screen.getByRole("dialog").querySelector("[data-tree-type=omnium]");
    expect(omnium?.querySelector(".ks-talent-node")).toHaveStyle("left: 50%");
  });

  it("uses renderable entry and generic enchant icons instead of atlas sprite sheets", () => {
    const characters = charactersPreview();
    const hero = characters[0].talents!.trees.find(tree => tree.type === "hero")!;
    hero.iconFileID = 5740021;
    hero.nodes[0].entries[0].iconFileID = 135919;
    hero.nodes[0].entries[0].iconPath = null;
    hero.nodes[0].entries[0].selected = true;
    characters[0].equipment!.items[0].enchant!.spellId = null;
    characters[0].equipment!.items[0].enchant!.iconFileID = 7487371;
    const { container } = renderPage({ ...state, characters });
    expect(container.querySelector(".talents-panel__identity > span:last-child img")).toHaveAttribute("src", expect.stringContaining("135919.jpg"));
    expect(container.querySelector(".gear-item__enchant img")).toHaveAttribute("src", expect.stringContaining("463531.jpg"));
  });
});
