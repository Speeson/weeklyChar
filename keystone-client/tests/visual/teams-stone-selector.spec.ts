import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const reviewDirectory = path.resolve(process.cwd(), ".tmp", "teams-stone-selector-review");

async function openTeams(page: Page, preview: string, language: "es" | "en" = "es", theme: "poison" | "keystone" = "poison") {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(selectedTheme => localStorage.setItem("keystone-client.theme", selectedTheme), theme);
  await page.goto(`/?preview=${preview}&lang=${language}`);
  await expect(page.getByRole("button", { name: language === "en" ? "Teams" : "Equipos" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
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
  const scaledItem = scaledCard.getByRole("link", { name: "Objeto #231001" });
  await scaledItem.focus();
  await expect(scaledItem).toHaveAttribute("data-wowhead", /domain=es/u);
  await capture(page, "06-minimum-viewport-tooltip.png");
});

test("reviews populated, multi-spec, item grouping and tooltip states", async ({ page }) => {
  await openTeams(page, "teams-selector-full");
  const ruby = page.getByRole("button", { name: /Ruby Life Pools.*2 piedras/u });
  await ruby.click();
  await expect(ruby).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/8 personajes.*28 objetivos/u)).toBeVisible();
  await expect(page.getByTestId("selector-character")).toHaveCount(8);
  const firstSummary = page.getByTestId("selector-character").first().locator(".teams-character-row__summary");
  const summaryTypography = await firstSummary.evaluate(element => {
    const styleSize = (selector: string) => Number.parseFloat(getComputedStyle(element.querySelector(selector)!).fontSize);
    const counter = document.querySelector<HTMLElement>('.teams-dungeon[aria-pressed="true"] b')!;
    const counterBox = counter.getBoundingClientRect();
    return {
      character: styleSize(".teams-character-row__identity strong"),
      details: styleSize(".teams-character-row__details"),
      objectives: styleSize(".teams-objective-count"),
      tiers: styleSize(".teams-tier-line"),
      expandText: element.querySelector(".teams-expand")?.textContent?.trim(),
      counterFont: Number.parseFloat(getComputedStyle(counter).fontSize),
      counterHeight: counterBox.height,
      counterWidth: counterBox.width,
      counterShadow: getComputedStyle(counter).boxShadow,
    };
  });
  expect(summaryTypography).toMatchObject({
    character: 17,
    details: 13,
    objectives: 15,
    tiers: 12,
    expandText: "",
    counterFont: 16,
    counterHeight: 30,
    counterWidth: 30,
  });
  expect(summaryTypography.counterShadow).not.toBe("none");
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
  const fallbackItem = firstCard.getByRole("link", { name: "Objeto #231001" });
  await fallbackItem.focus();
  await expect(fallbackItem).toHaveAttribute("href", "https://www.wowhead.com/item=231001");
  await expect(fallbackItem).toHaveAttribute("data-wowhead", /domain=es/u);
  await capture(page, "09-tooltip-fallback.png");

  await firstCard.getByRole("button", { name: "Ocultar objetos" }).click();
  const singleSpecCard = page.getByTestId("selector-character").nth(1);
  await singleSpecCard.getByRole("button", { name: "Ver objetos" }).click();
  await expect(singleSpecCard.getByText(/BEST IN SLOT/u)).toBeVisible();
  await expect(singleSpecCard.getByRole("group", { name: /especializaci/u })).toHaveCount(0);
  await capture(page, "10-single-spec-expanded.png");

  await singleSpecCard.getByRole("button", { name: "Ocultar objetos" }).click();
  const missingMetadataCard = page.getByTestId("selector-character").nth(2);
  await missingMetadataCard.getByRole("button", { name: "Ver objetos" }).click();
  const missingMetadataTarget = missingMetadataCard.getByRole("link", { name: "Objeto #233002" });
  await missingMetadataTarget.focus();
  await expect(missingMetadataTarget).toHaveAttribute("data-wowhead", /domain=es/u);
  await expect(missingMetadataTarget).not.toHaveAttribute("data-wowhead", /bonus=/u);
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

test("reviews exact-stone Planner previews, owner crown, accordion and minimum viewport", async ({ page }) => {
  await openTeams(page, "teams-planner");
  await page.getByRole("button", { name: /Ruby Life Pools/u }).click();
  await page.getByRole("button", { name: "Planificar piedra" }).click();
  const configureButton = page.getByRole("button", { name: "Configurar mis personajes" });
  const configPanel = page.locator(".planner-config-heading");
  expect(await configureButton.evaluate(element => element.getBoundingClientRect().width)).toBeCloseTo(
    await configPanel.evaluate(element => element.getBoundingClientRect().width - 26),
    0,
  );
  const calculateButton = page.getByRole("button", { name: "Calcular Top 5" });
  const ctaStyles = async (button: typeof configureButton) => button.evaluate(element => {
    const style = getComputedStyle(element);
    return { backgroundImage: style.backgroundImage, borderColor: style.borderColor, color: style.color };
  });
  expect(await ctaStyles(configureButton)).toEqual(await ctaStyles(calculateButton));
  const prioritySwitches = page.locator('.planner-priorities input[type="checkbox"]');
  for (const dimensions of await prioritySwitches.evaluateAll(elements => elements.map(element => {
    const bounds = element.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height };
  }))) {
    expect(dimensions.width).toBe(30);
    expect(dimensions.height).toBe(17);
  }
  await page.getByRole("button", { name: /\+12.*Bakuhatsu.*Speeson/u }).click();
  for (const member of ["Guardiana", "Voidwalker", "Nightshift", "Ironforge"]) {
    await page.getByRole("button", { name: new RegExp(`Filtrar por ${member}`, "u") }).click();
  }
  await page.getByRole("button", { name: "Calcular Top 5" }).click();
  const recommendations = page.locator(".planner-recommendation");
  await expect(recommendations).toHaveCount(5);
  const compactHeights = await recommendations.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height));
  expect(Math.max(...compactHeights) - Math.min(...compactHeights)).toBeLessThan(1);
  const resultBounds = await page.locator(".keystone-planner__results").evaluate(element => {
    const bounds = element.getBoundingClientRect(); return { top: bounds.top, bottom: bounds.bottom };
  });
  const recommendationBounds = await recommendations.evaluateAll(elements => elements.map(element => {
    const bounds = element.getBoundingClientRect(); return { top: bounds.top, bottom: bounds.bottom };
  }));
  expect(recommendationBounds[0].top - resultBounds.top).toBeCloseTo(9, 0);
  expect(resultBounds.bottom - recommendationBounds[4].bottom).toBeCloseTo(9, 0);
  const firstPreviewHeight = await recommendations.first().locator(".planner-assignment-preview").first().evaluate(element => element.getBoundingClientRect().height);
  expect(firstPreviewHeight).toBeGreaterThan(compactHeights[0] * 0.69);
  await expect(page.getByLabel("Dueño de la piedra").first()).toBeVisible();
  await capture(page, "15-planner-compact.png");

  await recommendations.first().getByRole("button").click();
  await expect(recommendations.first()).toHaveAttribute("data-expanded", "true");
  await expect(recommendations.nth(1)).toHaveAttribute("data-expanded", "false");
  await expect(recommendations.nth(1)).toHaveCSS("display", "none");
  await expect(recommendations.first().locator(".planner-player-card").getByLabel("Dueño de la piedra")).toBeVisible();
  await expect(page.getByLabel("Dueño de la piedra +12")).toHaveCount(0);
  await expect(page.getByText("Buffos y sinergias")).toBeVisible();
  await expect(recommendations.first().locator('.planner-player-card img[src*="classicon_"]')).toHaveCount(0);
  await expect(recommendations.first().locator('.planner-player-role').first()).toBeVisible();
  await expect(recommendations.first().locator('.planner-objective-icon[data-wowhead]').first()).toBeVisible();
  await expect(recommendations.first().getByText("Sin objetivos de botín")).toHaveCSS("font-size", "13px");
  await expect(recommendations.first().locator(".planner-recommendation__detail")).toHaveCSS("overflow-y", "auto");
  await recommendations.first().getByRole("button", { name: /Ver todos los objetivos · Bakuhatsu · 7/u }).click();
  const lootBreakdown = page.getByRole("dialog", { name: /Desglose de objetivos · Bakuhatsu/u });
  await expect(lootBreakdown).toBeVisible();
  await expect(lootBreakdown.getByText(/BiS · 2/u)).toBeVisible();
  await capture(page, "16a-planner-loot-breakdown.png");
  await page.keyboard.press("Escape");
  await expect(lootBreakdown).toBeHidden();
  const expandedBounds = await recommendations.first().evaluate(element => {
    const bounds = element.getBoundingClientRect(); return { top: bounds.top, bottom: bounds.bottom };
  });
  expect(expandedBounds.top - resultBounds.top).toBeCloseTo(9, 0);
  expect(resultBounds.bottom - expandedBounds.bottom).toBeCloseTo(9, 0);
  await capture(page, "16-planner-expanded.png");

  await page.setViewportSize({ width: 940, height: 529 });
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  expect(await page.evaluate(() => document.body.scrollWidth)).toBe(940);
  expect(await page.evaluate(() => document.body.scrollHeight)).toBe(529);
  await capture(page, "17-planner-minimum-viewport.png");
});

test("reviews the blocking Planner character configuration", async ({ page }) => {
  await openTeams(page, "teams-planner-unconfigured");
  await page.getByRole("button", { name: /Ruby Life Pools/u }).click();
  await page.getByRole("button", { name: "Planificar piedra" }).click();
  const dialog = page.getByRole("dialog", { name: "Configura tus personajes" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("img", { name: "KeystoneSync" })).toBeVisible();
  const activeZone = dialog.locator('[data-zone="active"]');
  const inactiveZone = dialog.locator('[data-zone="inactive"]');
  const inactiveCard = inactiveZone.locator(".planner-preference-character").filter({ hasText: "Bakuhatsu" });
  await expect(inactiveCard).toHaveClass(/is-inactive/u);
  await expect(inactiveCard.getByRole("button", { name: /Guardian · Desactivado/u })).toBeDisabled();
  await inactiveCard.evaluate(element => element.dispatchEvent(new DragEvent("dragstart", {
    bubbles: true, dataTransfer: new DataTransfer(),
  })));
  await expect(inactiveCard).toHaveCSS("opacity", "0.5");
  await expect(inactiveCard).toHaveCSS("filter", /blur\(1px\)/u);
  await inactiveCard.evaluate(element => element.dispatchEvent(new DragEvent("dragend", { bubbles: true })));
  await expect(inactiveCard).toHaveCSS("opacity", "1");
  await inactiveCard.dragTo(activeZone);
  const characterCard = activeZone.locator(".planner-preference-character").filter({ hasText: "Bakuhatsu" });
  await expect(characterCard).toBeVisible();
  await expect(characterCard).not.toHaveClass(/is-inactive/u);
  await characterCard.dragTo(inactiveZone);
  await expect(inactiveCard).toHaveClass(/is-inactive/u);
  await inactiveCard.dragTo(activeZone);
  await expect(characterCard).not.toHaveClass(/is-inactive/u);
  await expect(characterCard).toContainText("Configura al menos una spec");
  await expect(dialog.getByRole("button", { name: "Guardar y planificar" })).toBeDisabled();
  const roleCards = characterCard.locator(".planner-preference-spec");
  await expect(roleCards).toHaveCount(4);
  await expect(roleCards.nth(0).getByRole("button")).toHaveAccessibleName(/Guardian/u);
  await expect(roleCards.nth(1).getByRole("button")).toHaveAccessibleName(/Restoration/u);
  await expect(roleCards.nth(2).getByRole("button")).toHaveAccessibleName(/Balance/u);
  await expect(roleCards.nth(3).getByRole("button")).toHaveAccessibleName(/Feral/u);
  const cardTops = await roleCards.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top));
  expect(Math.max(...cardTops) - Math.min(...cardTops)).toBeLessThan(1);
  const characterHeight = await characterCard.evaluate(element => element.getBoundingClientRect().height);
  await roleCards.first().getByRole("button").click();
  await expect(roleCards.first().getByRole("combobox", { name: "Bakuhatsu Guardian", exact: true })).toBeVisible();
  expect(await characterCard.evaluate(element => element.getBoundingClientRect().height)).toBeCloseTo(characterHeight, 0);
  await capture(page, "18-planner-preferences.png");
});

test("reviews lifecycle stability, themed empty prompt, cached navigation and rarity tooltips in both themes", async ({ page }) => {
  for (const theme of ["poison", "keystone"] as const) {
    await openTeams(page, "teams-default", "es", theme);
    const promptIcon = page.locator(".teams-selector-panel__prompt > img");
    await expect(promptIcon).toBeVisible();
    await expect(promptIcon).toHaveAttribute("src", new RegExp(theme === "poison" ? "app-badge" : "app-icon"));
    await capture(page, `15-${theme}-empty-prompt.png`);

    await page.getByRole("button", { name: "Configuracion" }).click();
    await expect(page.getByRole("dialog", { name: "Ajustes" })).toBeVisible();
    await capture(page, `16-${theme}-settings-open.png`);
    await page.getByRole("button", { name: "Cerrar configuracion" }).click();
    await expect(page.getByRole("button", { name: "Mythiqueros 2.0" })).toBeVisible();
    await capture(page, `17-${theme}-settings-closed-stable.png`);

    await openTeams(page, "teams-multiple", "es", theme);
    await page.getByRole("button", { name: "Mythiqueros 2.0" }).click();
    await expect(page.getByRole("option", { name: "Exploradores de la Medianoche" })).toBeVisible();
    await capture(page, `18-${theme}-team-picker.png`);

    await openTeams(page, "teams-selector-full", "es", theme);
    await page.getByRole("button", { name: /Ruby Life Pools/u }).click();
    await expect(page.getByText(/8 personajes.*28 objetivos/u)).toBeVisible();
    await page.getByRole("button", { name: /Temple of Sethraliss/u }).click();
    await page.getByRole("button", { name: /Ruby Life Pools/u }).click();
    await expect(page.getByText(/8 personajes.*28 objetivos/u)).toBeVisible();
    await capture(page, `19-${theme}-cached-dungeon.png`);

    const firstCard = page.getByTestId("selector-character").first();
    await firstCard.getByRole("button", { name: /Ver objetos/u }).click();
    await capture(page, `20-${theme}-expanded-character.png`);

    const epicTarget = firstCard.getByRole("link", { name: "Echo de Medianoche 231002" }).first();
    await epicTarget.focus();
    await expect(epicTarget).toHaveAttribute("data-wowhead", /domain=es.*ilvl=402/u);
    await capture(page, `21-${theme}-tooltip-epic.png`);
    const rareTarget = firstCard.getByRole("link", { name: "Echo de Medianoche 231002" }).nth(1);
    await rareTarget.focus();
    await expect(rareTarget).toHaveAttribute("data-wowhead", /domain=es.*ilvl=389/u);
    await capture(page, `22-${theme}-tooltip-rare.png`);

    await openTeams(page, "teams-selector-full", "en", theme);
    await page.getByRole("button", { name: /Ruby Life Pools/u }).click();
    const englishCard = page.getByTestId("selector-character").first();
    await englishCard.getByRole("button", { name: /Show items/u }).click();
    const englishTarget = englishCard.getByRole("link", { name: "Midnight Echo 231002" }).first();
    await englishTarget.focus();
    await expect(englishTarget).toHaveAttribute("data-wowhead", /domain=www.*ilvl=402/u);
    await capture(page, `23-${theme}-tooltip-epic-en.png`);
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Close settings" }).click();
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    await capture(page, `24-${theme}-settings-english-reopened.png`);
  }
});

test("reviews the full-area cold loader and warm section navigation in both themes", async ({ page }) => {
  for (const theme of ["poison", "keystone"] as const) {
    await openTeams(page, "teams-cold-loading", "es", theme);
    const loader = page.getByLabel("Cargando equipos...");
    await expect(loader).toBeVisible();
    await expect(loader).toHaveClass(/teams-loading-veil/u);
    await expect(loader.locator("img")).toHaveAttribute(
      "src",
      new RegExp(theme === "poison" ? "app-badge" : "21-app-icon-hd"),
    );
    await expect(loader.locator("img")).toHaveCSS("animation-name", "none");
    await expect(page.locator(".teams-page-skeleton")).toHaveCount(0);
    await capture(page, `25-${theme}-cold-teams-loading.png`);

    await openTeams(page, "teams-default", "es", theme);
    await expect(page.getByRole("button", { name: "Mythiqueros 2.0" })).toBeVisible();
    await page.getByRole("button", { name: "Sincronizar" }).click();
    await page.evaluate(() => {
      (window as typeof window & { __teamsLoaderObserved?: boolean }).__teamsLoaderObserved = false;
      new MutationObserver(() => {
        if (document.querySelector(".teams-loading-veil, .teams-page-skeleton")) {
          (window as typeof window & { __teamsLoaderObserved?: boolean }).__teamsLoaderObserved = true;
        }
      }).observe(document.body, { childList: true, subtree: true });
    });
    await page.getByRole("button", { name: "Equipos" }).click();
    await expect(page.getByRole("button", { name: "Mythiqueros 2.0" })).toBeVisible();
    expect(await page.evaluate(() => (window as typeof window & { __teamsLoaderObserved?: boolean }).__teamsLoaderObserved)).toBe(false);
    await capture(page, `26-${theme}-warm-teams-return.png`);
  }
});
