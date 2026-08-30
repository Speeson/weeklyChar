import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const reviewDirectory = path.resolve(process.cwd(), ".tmp", "teams-stone-selector-review");

async function openTeams(page: Page, preview: string, language: "es" | "en" = "es") {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("keystone-client.theme", "poison"));
  await page.goto(`/?preview=${preview}&lang=${language}`);
  await expect(page.getByRole("button", { name: language === "en" ? "Teams" : "Equipos" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "poison");
}

async function capture(page: Page, name: string) {
  await mkdir(reviewDirectory, { recursive: true });
  await page.screenshot({ fullPage: true, path: path.join(reviewDirectory, name) });
}

test("reviews the default, multiple-Team, empty and scaled shell states", async ({ page }) => {
  await openTeams(page, "teams-default");
  await expect(page.getByRole("button", { name: "Mythiqueros 2.0" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Seleccionar/u })).toHaveCount(8);
  await expect(page.getByRole("button", { name: /Ruby Life Pools.*2 piedras/u })).toBeEnabled();
  await expect(page.getByRole("button", { name: /Kings' Rest.*0 piedras/u })).toBeEnabled();
  await expect(page.getByText(/GuardianaDeLosSecretos/u)).toBeVisible();
  await expect(page.getByText("Selecciona una mazmorra para ver los objetivos del equipo.")).toBeVisible();
  await capture(page, "01-default-early.png");

  await openTeams(page, "teams-multiple");
  const switcher = page.getByRole("button", { name: "Mythiqueros 2.0" });
  await expect(switcher).toBeVisible();
  await switcher.focus();
  await capture(page, "02-team-switcher-focus.png");
  await switcher.click();
  await page.getByRole("option", { name: "Exploradores de la Medianoche" }).click();
  await expect(page.getByRole("button", { name: "Exploradores de la Medianoche" })).toBeVisible();
  await capture(page, "03-second-team.png");

  await openTeams(page, "teams-empty");
  await expect(page.getByText(/no perteneces a ning/u)).toBeVisible();
  await capture(page, "04-no-teams.png");

  await page.setViewportSize({ width: 940, height: 529 });
  await openTeams(page, "teams-default");
  await expect(page.getByRole("button", { name: "Configuracion" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Minimizar", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar", exact: true })).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await capture(page, "05-minimum-viewport.png");

  await page.getByRole("button", { name: /Ruby Life Pools/u }).click();
  const scaledCard = page.getByTestId("selector-character").first();
  await scaledCard.getByRole("button", { name: "Ver objetos" }).click();
  await scaledCard.getByRole("button", { name: "Objeto #231001" }).focus();
  const tooltipBox = await page.getByRole("tooltip").boundingBox();
  expect(tooltipBox).not.toBeNull();
  expect(tooltipBox!.x).toBeGreaterThanOrEqual(0);
  expect(tooltipBox!.y).toBeGreaterThanOrEqual(0);
  expect(tooltipBox!.x + tooltipBox!.width).toBeLessThanOrEqual(940);
  expect(tooltipBox!.y + tooltipBox!.height).toBeLessThanOrEqual(529);
  await capture(page, "06-minimum-viewport-tooltip.png");
});

test("reviews populated, multi-spec, item grouping and tooltip states", async ({ page }) => {
  await openTeams(page, "teams-selector-full");
  const ruby = page.getByRole("button", { name: /Ruby Life Pools.*2 piedras/u });
  await ruby.click();
  await expect(ruby).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/8 personajes.*28 objetivos/u)).toBeVisible();
  await expect(page.getByTestId("selector-character")).toHaveCount(8);
  await capture(page, "06-populated-summary.png");

  const firstCard = page.getByTestId("selector-character").first();
  await firstCard.getByRole("button", { name: "Ver objetos" }).click();
  await expect(firstCard.getByRole("button", { name: /Todos.*10/u })).toBeVisible();
  await expect(firstCard.getByText(/BEST IN SLOT/u)).toBeVisible();
  await expect(firstCard.getByText(/Completados con Voidcore/u)).toBeVisible();
  await capture(page, "07-expanded-multispec-groups.png");

  await firstCard.locator(".teams-completed summary").click();
  await expect(firstCard.locator(".teams-completed")).toHaveAttribute("open", "");
  await capture(page, "08-completed-voidcore-open.png");

  await firstCard.getByRole("button", { name: /Arcane.*7/u }).click();
  await expect(firstCard.getByRole("button", { name: /Arcane.*7/u })).toHaveAttribute("aria-pressed", "true");
  const fallbackItem = firstCard.getByRole("button", { name: "Objeto #231001" });
  await fallbackItem.focus();
  await expect(page.getByRole("tooltip")).toContainText("Objeto #231001");
  await capture(page, "09-tooltip-fallback.png");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toBeHidden();

  await firstCard.getByRole("button", { name: "Ocultar objetos" }).click();
  const singleSpecCard = page.getByTestId("selector-character").nth(1);
  await singleSpecCard.getByRole("button", { name: "Ver objetos" }).click();
  await expect(singleSpecCard.getByText(/BEST IN SLOT/u)).toBeVisible();
  await expect(singleSpecCard.getByRole("group", { name: /especializaci/u })).toHaveCount(0);
  await capture(page, "10-single-spec-expanded.png");

  await singleSpecCard.getByRole("button", { name: "Ocultar objetos" }).click();
  const missingMetadataCard = page.getByTestId("selector-character").nth(2);
  await missingMetadataCard.getByRole("button", { name: "Ver objetos" }).click();
  await missingMetadataCard.getByRole("button", { name: "Objeto #233002" }).focus();
  const missingMetadataTooltip = page.getByRole("tooltip");
  await expect(missingMetadataTooltip).toContainText("Objeto #233002");
  await expect(missingMetadataTooltip).not.toContainText("Mano principal");
  await capture(page, "11-tooltip-missing-metadata.png");
});

test("reviews zero-stone, loading, empty objectives, API error and English", async ({ page }) => {
  await openTeams(page, "teams-selector-empty");
  const zero = page.getByRole("button", { name: /Kings' Rest.*0 piedras/u });
  await zero.click();
  await expect(zero).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/personaje.*objetivos.*mazmorra/u)).toBeVisible();
  await capture(page, "11-zero-stone-empty.png");

  await openTeams(page, "teams-selector-loading");
  await page.getByRole("button", { name: /Ruby Life Pools/u }).click();
  await expect(page.getByLabel("Cargando objetivos")).toBeVisible();
  await capture(page, "12-selector-loading.png");

  await openTeams(page, "teams-selector-error");
  await page.getByRole("button", { name: /Ruby Life Pools/u }).click();
  await expect(page.getByRole("alert")).toContainText(/API no/u);
  await capture(page, "13-selector-error.png");

  await openTeams(page, "teams-selector-multispec", "en");
  await page.getByRole("button", { name: /Ruby Life Pools/u }).click();
  await expect(page.getByText("Objectives", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Teams" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "Sync" })).toBeVisible();
  await capture(page, "14-english.png");
});
