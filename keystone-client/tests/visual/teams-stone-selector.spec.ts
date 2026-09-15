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
  const modeSelector = page.getByRole("group", { name: "Modo de recomendación" });
  const fillComposition = page.getByRole("checkbox", { name: "Rellenar la composición" });
  await expect(fillComposition).toBeChecked();
  const configAside = page.locator(".keystone-planner__config");
  const quickConfigWidth = await configAside.evaluate(element => element.getBoundingClientRect().width);
  await expect(page.locator(".planner-config-scroll")).toHaveCSS("scrollbar-width", "none");
  const fillBottom = await page.locator(".planner-fill-toggle").evaluate(element => element.getBoundingClientRect().bottom);
  const modeTop = await modeSelector.evaluate(element => element.getBoundingClientRect().top);
  expect(fillBottom).toBeLessThanOrEqual(modeTop);
  await expect(modeSelector.getByRole("button", { name: "Rápido · Clases" })).toHaveAttribute("aria-pressed", "true");
  const modeBounds = await modeSelector.evaluate(element => {
    const bounds = element.getBoundingClientRect(); return { width: bounds.width, height: bounds.height };
  });
  const configureBounds = await configureButton.evaluate(element => {
    const bounds = element.getBoundingClientRect(); return { width: bounds.width, height: bounds.height };
  });
  expect(modeBounds.width).toBeCloseTo(configureBounds.width, 0);
  expect(modeBounds.height).toBeCloseTo(configureBounds.height, 0);
  const prioritySwitches = page.locator('.planner-priorities input[type="checkbox"]');
  for (const dimensions of await prioritySwitches.evaluateAll(elements => elements.map(element => {
    const bounds = element.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height };
  }))) {
    expect(dimensions.width).toBe(30);
    expect(dimensions.height).toBe(17);
  }
  const priorityLabels = page.locator(".planner-priorities label");
  await expect(priorityLabels).toHaveCount(3);
  for (const fontSize of await priorityLabels.evaluateAll(elements => elements.map(element => getComputedStyle(element).fontSize))) {
    expect(fontSize).toBe("12px");
  }
  await expect(page.getByText("Buffos de clase")).toHaveCount(0);
  await expect(page.getByText("Sinergia de daño")).toHaveCount(0);
  await capture(page, "15a-planner-quick.png");
  await modeSelector.getByRole("button", { name: "Avanzado · Specs" }).click();
  expect(await configAside.evaluate(element => element.getBoundingClientRect().width)).toBeCloseTo(quickConfigWidth, 0);
  await expect(priorityLabels).toHaveCount(5);
  await expect(page.getByRole("checkbox", { name: "Defensiva de grupo" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Utilidad de mazmorra" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Sinergia ofensiva" }).locator("xpath=preceding-sibling::img"))
    .toHaveAttribute("src", /offensive-synergy\.jpg$/u);
  await expect(page.getByRole("checkbox", { name: "Defensiva de grupo" }).locator("xpath=preceding-sibling::span/preceding-sibling::img"))
    .toHaveAttribute("src", /group-defense\.jpg$/u);
  await expect(page.getByRole("checkbox", { name: "Utilidad de mazmorra" }).locator("xpath=preceding-sibling::span/preceding-sibling::img"))
    .toHaveAttribute("src", /dungeon-utility\.jpg$/u);
  await capture(page, "15b-planner-advanced.png");
  await modeSelector.getByRole("button", { name: "Rápido · Clases" }).click();
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
  await expect(recommendations.first().getByRole("img", { name: /Especialización jugada:/u }).first()).toBeVisible();
  await expect(recommendations.first().getByRole("img", { name: /Especialización de botín:/u }).first()).toBeVisible();
  const compactLootMarker = recommendations.first().locator(".planner-spec-marker--loot").first();
  const compactLootSpec = compactLootMarker.locator(":scope > .planner-spec-icon");
  const compactPouch = compactLootMarker.locator(":scope > .planner-loot-pouch");
  await expect(compactLootMarker).toHaveCSS("overflow", "visible");
  await expect(compactLootSpec).toHaveCSS("overflow", "hidden");
  await expect(compactPouch).toBeVisible();
  await expect(compactPouch.locator("img")).toHaveAttribute("src", /inv_misc_bag_10\.jpg$/u);
  await expect(compactPouch).toHaveCSS("border-radius", "50%");
  await expect(recommendations.first().locator(".planner-role-watermark").first()).toBeVisible();
  const ownerPlacement = await page.getByLabel("Dueño de la piedra").first().evaluate(element => {
    const crown = element.getBoundingClientRect();
    const card = element.parentElement!.getBoundingClientRect();
    return { crownTop: crown.top, crownLeft: crown.left, crownWidth: crown.width, cardTop: card.top, cardLeft: card.left };
  });
  expect(ownerPlacement.crownTop).toBeLessThan(ownerPlacement.cardTop);
  expect(ownerPlacement.crownLeft).toBeLessThan(ownerPlacement.cardLeft);
  expect(ownerPlacement.crownWidth).toBeLessThanOrEqual(17);
  const compactPouchPlacement = await compactLootMarker.evaluate(element => {
    const pouch = element.querySelector(":scope > .planner-loot-pouch")!.getBoundingClientRect();
    const spec = element.querySelector(":scope > .planner-spec-icon")!.getBoundingClientRect();
    return {
      pouchTop: pouch.top, pouchLeft: pouch.left, pouchBottom: pouch.bottom, pouchRight: pouch.right,
      pouchCenterX: (pouch.left + pouch.right) / 2, pouchCenterY: (pouch.top + pouch.bottom) / 2,
      specTop: spec.top, specLeft: spec.left,
    };
  });
  expect(compactPouchPlacement.pouchTop).toBeLessThan(compactPouchPlacement.specTop);
  expect(compactPouchPlacement.pouchLeft).toBeLessThan(compactPouchPlacement.specLeft);
  expect(compactPouchPlacement.pouchBottom).toBeGreaterThan(compactPouchPlacement.specTop);
  expect(compactPouchPlacement.pouchRight).toBeGreaterThan(compactPouchPlacement.specLeft);
  expect(compactPouchPlacement.pouchCenterX).toBeCloseTo(compactPouchPlacement.specLeft, 0);
  expect(compactPouchPlacement.pouchCenterY).toBeCloseTo(compactPouchPlacement.specTop, 0);
  const compactAvatarSize = await recommendations.first().locator(".planner-assignment-preview .teams-portrait").first().evaluate(element => {
    const bounds = element.getBoundingClientRect(); return { width: bounds.width, height: bounds.height };
  });
  expect(compactAvatarSize.width).toBe(37);
  expect(compactAvatarSize.height).toBe(37);
  const compactRoleOpacity = Number.parseFloat(await recommendations.first().locator(".planner-role-watermark").first().evaluate(element => getComputedStyle(element).opacity));
  expect(compactRoleOpacity).toBeGreaterThanOrEqual(0.45);
  expect(compactRoleOpacity).toBeLessThanOrEqual(0.5);
  const compactScoreOrder = await recommendations.first().locator(".planner-score").evaluate(element => {
    const label = element.querySelector("small")!.getBoundingClientRect();
    const value = element.querySelector("b")!.getBoundingClientRect();
    return { labelRight: label.right, valueLeft: value.left, centerDelta: Math.abs((label.top + label.bottom) / 2 - (value.top + value.bottom) / 2) };
  });
  expect(compactScoreOrder.labelRight).toBeLessThanOrEqual(compactScoreOrder.valueLeft);
  expect(compactScoreOrder.centerDelta).toBeLessThan(4);
  await expect(recommendations.first().locator(".planner-score small span")).toHaveText(["Valor de", "botín"]);
  const compactLayout = await recommendations.first().evaluate(element => {
    const metrics = element.querySelector(".planner-recommendation__metrics")!.getBoundingClientRect();
    const party = element.querySelector(".planner-recommendation__party")!.getBoundingClientRect();
    const score = element.querySelector(".planner-score")!.getBoundingClientRect();
    const previews = [...element.querySelectorAll(".planner-assignment-preview, .planner-external-preview")].map(item => item.getBoundingClientRect());
    const metricLabel = getComputedStyle(element.querySelector(".planner-recommendation__metrics")!);
    const metricValue = getComputedStyle(element.querySelector(".planner-recommendation__metrics b")!);
    const characterName = getComputedStyle(element.querySelector(".planner-assignment-preview__identity strong")!);
    const username = getComputedStyle(element.querySelector(".planner-assignment-preview__identity small")!);
    return {
      leftGap: party.left - metrics.right,
      rightGap: score.left - party.right,
      partyLeft: party.left,
      partyRight: party.right,
      firstCardLeft: previews[0].left,
      lastCardRight: previews.at(-1)!.right,
      previewCount: previews.length,
      narrowestCardWidth: Math.min(...previews.map(preview => preview.width)),
      metricLabelSize: metricLabel.fontSize,
      metricValueSize: metricValue.fontSize,
      characterNameSize: characterName.fontSize,
      characterNameWeight: characterName.fontWeight,
      characterNameBorder: characterName.borderTopStyle,
      usernameSize: username.fontSize,
    };
  });
  expect(compactLayout.leftGap).toBeCloseTo(12, 0);
  expect(compactLayout.rightGap).toBeCloseTo(12, 0);
  expect(compactLayout.firstCardLeft).toBeCloseTo(compactLayout.partyLeft, 0);
  expect(compactLayout.lastCardRight).toBeCloseTo(compactLayout.partyRight, 0);
  expect(compactLayout.previewCount).toBe(5);
  expect(compactLayout.narrowestCardWidth).toBeGreaterThanOrEqual(135);
  expect(compactLayout.metricLabelSize).toBe("11px");
  expect(compactLayout.metricValueSize).toBe("14px");
  expect(compactLayout.characterNameSize).toBe("15px");
  expect(Number(compactLayout.characterNameWeight)).toBeGreaterThanOrEqual(900);
  expect(compactLayout.characterNameBorder).toBe("solid");
  expect(compactLayout.usernameSize).toBe("11px");
  const externalGeometry = await recommendations.first().locator(".planner-external-preview").evaluate(element => {
    const card = element.getBoundingClientRect();
    const avatar = element.querySelector(".planner-external-preview__avatar")!.getBoundingClientRect();
    const icons = [...element.querySelectorAll(".planner-external-preview__class")].map(icon => icon.getBoundingClientRect());
    return {
      centerDeltaX: Math.abs((avatar.left + avatar.right) / 2 - (card.left + card.right) / 2),
      centerDeltaY: Math.abs((avatar.top + avatar.bottom) / 2 - (card.top + card.bottom) / 2),
      iconSizes: icons.map(icon => [icon.width, icon.height]),
    };
  });
  expect(externalGeometry.centerDeltaX).toBeLessThan(2);
  expect(externalGeometry.centerDeltaY).toBeLessThan(2);
  expect(externalGeometry.iconSizes).toEqual([[31, 31], [31, 31], [31, 31], [31, 31]]);
  await expect.poll(() => recommendations.first().locator(".planner-external-preview img").evaluateAll(images =>
    images.length === 4 && images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await capture(page, "15-planner-compact.png");

  await prioritySwitches.first().click();
  await expect(page.getByRole("button", { name: "Recalcular Top 5" })).toBeVisible();
  await expect(recommendations).toHaveCount(5);

  await recommendations.first().getByRole("button", { name: "Expandir #1" }).click();
  await expect(recommendations.first()).toHaveAttribute("data-expanded", "true");
  await expect(recommendations.nth(1)).toHaveAttribute("data-expanded", "false");
  await expect(recommendations.nth(1)).toHaveCSS("display", "none");
  const expandedHeaderGeometry = await recommendations.first().locator(".planner-recommendation__summary").evaluate(element => {
    const header = element.getBoundingClientRect();
    const metrics = element.querySelector(".planner-recommendation__metrics")!.getBoundingClientRect();
    const toggle = element.querySelector(".planner-recommendation__expand")!.getBoundingClientRect();
    return {
      metricsBottomGap: header.bottom - metrics.bottom,
      toggleHeight: toggle.height,
      toggleTopGap: toggle.top - header.top,
      toggleBottomGap: header.bottom - toggle.bottom,
    };
  });
  expect(expandedHeaderGeometry.metricsBottomGap).toBeGreaterThanOrEqual(6);
  expect(expandedHeaderGeometry.toggleHeight).toBeLessThanOrEqual(24);
  expect(Math.abs(expandedHeaderGeometry.toggleTopGap - expandedHeaderGeometry.toggleBottomGap)).toBeLessThan(1);
  const expandedOwnerCard = recommendations.first().locator(".planner-player-card").filter({ has: page.getByLabel("Dueño de la piedra") });
  const expandedCrown = expandedOwnerCard.getByLabel("Dueño de la piedra");
  await expect(expandedCrown).toBeVisible();
  await expect(page.getByLabel("Dueño de la piedra +12")).toHaveCount(0);
  await expect(page.getByText("Buffs / Defensivos / Utilidades").last()).toBeVisible();
  await expect(recommendations.first().locator('.planner-player-card img[src*="classicon_"]')).toHaveCount(0);
  await expect(recommendations.first().locator('.planner-player-role')).toHaveCount(0);
  await expect(expandedOwnerCard.locator(":scope > .planner-role-watermark")).toBeVisible();
  const expandedPlayedSpec = expandedOwnerCard.getByRole("img", { name: /Especialización jugada:/u });
  const expandedLootSpec = expandedOwnerCard.getByRole("img", { name: /Especialización de botín:/u });
  await expect(expandedLootSpec).toBeVisible();
  const expandedIconSizes = await Promise.all([expandedPlayedSpec, expandedLootSpec].map(locator => locator.evaluate(element => {
    const bounds = element.getBoundingClientRect(); return { width: bounds.width, height: bounds.height };
  })));
  expect(expandedIconSizes[1]).toEqual(expandedIconSizes[0]);
  const expandedIdentityLayout = await expandedOwnerCard.evaluate(element => {
    const card = element.getBoundingClientRect();
    const played = element.querySelector('[aria-label^="Especialización jugada"]')!.getBoundingClientRect();
    const loot = element.querySelector('[aria-label^="Especialización de botín"]')!.getBoundingClientRect();
    const identity = element.querySelector('.planner-player-card__identity')!.getBoundingClientRect();
    const name = element.querySelector('.planner-player-card__identity strong')!.getBoundingClientRect();
    const username = element.querySelector('.planner-player-card__identity small')!.getBoundingClientRect();
    const objectives = element.querySelector('.planner-objective-icons')!.getBoundingClientRect();
    return {
      cardTop: card.top, cardCenterX: (card.left + card.right) / 2,
      playedTop: played.top, playedLeft: played.left, playedRight: played.right, playedBottom: played.bottom,
      lootTop: loot.top, lootLeft: loot.left, lootRight: loot.right, lootBottom: loot.bottom,
      iconGroupCenterX: (played.left + loot.right) / 2,
      identityTop: identity.top, identityCenterX: (identity.left + identity.right) / 2,
      nameCenterY: (name.top + name.bottom) / 2, usernameCenterY: (username.top + username.bottom) / 2,
      separatorTop: objectives.top,
    };
  });
  expect(expandedIdentityLayout.lootTop).toBeCloseTo(expandedIdentityLayout.playedTop, 0);
  expect(expandedIdentityLayout.lootLeft).toBeGreaterThan(expandedIdentityLayout.playedRight);
  expect(expandedIdentityLayout.iconGroupCenterX).toBeCloseTo(expandedIdentityLayout.cardCenterX, 0);
  expect(expandedIdentityLayout.playedTop - expandedIdentityLayout.cardTop).toBeLessThanOrEqual(14);
  expect(expandedIdentityLayout.identityTop).toBeGreaterThan(Math.max(expandedIdentityLayout.playedBottom, expandedIdentityLayout.lootBottom));
  expect(expandedIdentityLayout.identityCenterX).toBeCloseTo(expandedIdentityLayout.cardCenterX, 0);
  expect(Math.abs(expandedIdentityLayout.nameCenterY - expandedIdentityLayout.usernameCenterY)).toBeLessThan(2);
  expect(expandedIdentityLayout.separatorTop - expandedIdentityLayout.cardTop).toBeLessThan(92);
  const expandedCrownPlacement = await expandedCrown.evaluate(element => {
    const crown = element.getBoundingClientRect();
    const card = element.closest(".planner-player-card")!.getBoundingClientRect();
    return { crownTop: crown.top, crownRight: crown.right, cardTop: card.top, cardRight: card.right };
  });
  expect(expandedCrownPlacement.crownTop).toBeGreaterThanOrEqual(expandedCrownPlacement.cardTop);
  expect(expandedCrownPlacement.crownRight).toBeLessThanOrEqual(expandedCrownPlacement.cardRight);
  const expandedLootMarker = expandedLootSpec.locator("xpath=parent::*");
  await expect(expandedLootMarker).toHaveClass(/planner-spec-marker--loot/u);
  await expect(expandedLootMarker).toHaveCSS("overflow", "visible");
  await expect(expandedLootSpec).toHaveCSS("overflow", "hidden");
  const expandedPouchPlacement = await expandedLootMarker.evaluate(element => {
    const pouch = element.querySelector(":scope > .planner-loot-pouch")!.getBoundingClientRect();
    const spec = element.querySelector(":scope > .planner-spec-icon")!.getBoundingClientRect();
    return {
      pouchTop: pouch.top, pouchLeft: pouch.left,
      pouchCenterX: (pouch.left + pouch.right) / 2, pouchCenterY: (pouch.top + pouch.bottom) / 2,
      specTop: spec.top, specLeft: spec.left,
    };
  });
  expect(expandedPouchPlacement.pouchTop).toBeLessThan(expandedPouchPlacement.specTop);
  expect(expandedPouchPlacement.pouchLeft).toBeLessThan(expandedPouchPlacement.specLeft);
  expect(expandedPouchPlacement.pouchCenterX).toBeCloseTo(expandedPouchPlacement.specLeft, 0);
  expect(expandedPouchPlacement.pouchCenterY).toBeCloseTo(expandedPouchPlacement.specTop, 0);
  const expandedObjectiveRow = expandedOwnerCard.locator(".planner-objective-icons");
  await expect(expandedObjectiveRow).toHaveCSS("border-top-style", "solid");
  await expect(expandedObjectiveRow.locator(":scope > .planner-objective-icon").first()).toBeVisible();
  await expect(expandedObjectiveRow.locator(".planner-objective-cluster")).toHaveCount(0);
  const expandedItemSize = await expandedObjectiveRow.locator(":scope > .planner-objective-icon").first().evaluate(element => {
    const icon = element.getBoundingClientRect();
    const content = element.firstElementChild!.getBoundingClientRect();
    return { width: icon.width, height: icon.height, contentWidth: content.width, contentHeight: content.height };
  });
  expect(expandedItemSize).toEqual({ width: 42, height: 42, contentWidth: 38, contentHeight: 38 });
  const expandedObjectiveAlignment = await expandedObjectiveRow.evaluate(element => {
    const row = element.getBoundingClientRect();
    const items = Array.from(element.children)
      .filter(child => getComputedStyle(child).display !== "none")
      .map(child => child.getBoundingClientRect());
    const gaps = items.slice(1).map((item, index) => item.left - items[index].right);
    return {
      rowCenterX: (row.left + row.right) / 2,
      groupCenterX: (items[0].left + items.at(-1)!.right) / 2,
      smallestGap: Math.min(...gaps),
      largestGap: Math.max(...gaps),
    };
  });
  expect(expandedObjectiveAlignment.groupCenterX).toBeCloseTo(expandedObjectiveAlignment.rowCenterX, 0);
  expect(expandedObjectiveAlignment.largestGap - expandedObjectiveAlignment.smallestGap).toBeLessThan(2);
  await expect(recommendations.first().getByText("Sin objetivos de botín")).toHaveCSS("font-size", "13px");
  await expect(recommendations.first().locator(".planner-recommendation__detail")).toHaveCSS("overflow-y", "auto");
  const compactExternalMoreStyle = await recommendations.nth(1).locator(".planner-external-preview__more").evaluate(element => {
    const style = getComputedStyle(element);
    return { background: style.backgroundImage, backgroundColor: style.backgroundColor, border: style.borderStyle, boxShadow: style.boxShadow };
  });
  expect(compactExternalMoreStyle.border).toBe("none");
  expect(compactExternalMoreStyle.background).toBe("none");
  expect(compactExternalMoreStyle.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(compactExternalMoreStyle.boxShadow).toBe("none");
  const externalCard = recommendations.first().locator(".planner-external-card");
  await expect(externalCard).toBeVisible();
  await expect(externalCard.locator('.planner-external-card__selectors [data-icon-kind="class"]')).toHaveCount(4);
  const externalSelectorSizes = await externalCard.locator('.planner-external-card__selectors [data-icon-kind="class"]').evaluateAll(elements => elements.map(element => {
    const bounds = element.getBoundingClientRect(); return [bounds.width, bounds.height];
  }));
  expect(externalSelectorSizes).toEqual([[43, 43], [43, 43], [43, 43], [43, 43]]);
  const externalMoreStyle = await externalCard.locator(".planner-external-card__more").evaluate(element => {
    const style = getComputedStyle(element);
    return { background: style.backgroundImage, backgroundColor: style.backgroundColor, border: style.borderStyle, boxShadow: style.boxShadow };
  });
  expect(externalMoreStyle.border).toBe("none");
  expect(externalMoreStyle.background).toBe("none");
  expect(externalMoreStyle.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(externalMoreStyle.boxShadow).toBe("none");
  await externalCard.locator(".planner-external-card__more").focus();
  await expect(externalCard.locator(".planner-external-card__more")).toHaveCSS("outline-style", "none");
  await externalCard.locator(".planner-external-card__more").evaluate(element => (element as HTMLElement).blur());
  await expect(externalCard.locator(".planner-external-card__contributions > section")).toHaveCount(1);
  await expect(externalCard.getByText("Buffs / Defensivos / Utilidades")).toBeVisible();
  const externalCardGeometry = await externalCard.evaluate(element => {
    const card = element.getBoundingClientRect();
    const separator = element.querySelector(".planner-external-card__contributions")!.getBoundingClientRect();
    const gain = element.querySelector(".planner-external-gain")!.getBoundingClientRect();
    const heading = element.querySelector(".planner-external-card__contribution-heading > strong")!.getBoundingClientRect();
    const capability = element.querySelector(".planner-capability-grid__icon")!.getBoundingClientRect();
    const capabilityImages = [...element.querySelectorAll<HTMLImageElement>(".planner-capability-grid__icon img")];
    const memberSeparator = document.querySelector('.planner-player-card[data-role="dps"] .planner-objective-icons')!.getBoundingClientRect();
    return {
      capabilitySize: [capability.width, capability.height],
      capabilityNaturalWidths: capabilityImages.map(image => image.naturalWidth),
      gainLeft: gain.left - card.left,
      gainSeparatorGap: gain.top - separator.top,
      gainTitleGap: heading.left - gain.right,
      separatorDelta: Math.abs(separator.top - memberSeparator.top),
    };
  });
  expect(externalCardGeometry.capabilitySize).toEqual([42, 42]);
  expect(externalCardGeometry.capabilityNaturalWidths.every(width => width >= 42)).toBe(true);
  expect(externalCardGeometry.gainLeft).toBeCloseTo(7, 0);
  expect(externalCardGeometry.gainSeparatorGap).toBeGreaterThanOrEqual(3);
  expect(externalCardGeometry.gainSeparatorGap).toBeLessThanOrEqual(6);
  expect(externalCardGeometry.gainTitleGap).toBeGreaterThanOrEqual(4);
  expect(externalCardGeometry.separatorDelta).toBeLessThan(1);
  await expect(externalCard.getByRole("button", { name: /Seleccionar recomendación: Evoker/u })).toHaveAttribute("aria-pressed", "true");
  await externalCard.getByRole("button", { name: /Seleccionar recomendación: Mage/u }).click();
  await expect(externalCard.getByText("Intelecto Arcano")).toHaveCount(0);
  await expect(externalCard.getByText("Counterspell")).toHaveCount(0);
  await expect(externalCard.getByRole("link", { name: /Intelecto Arcano/u })).toHaveAttribute("data-wowhead", /domain=es/u);
  await externalCard.getByRole("button", { name: /Ver clases recomendadas: 5/u }).click();
  const externalDialog = page.getByRole("dialog", { name: /Clases recomendadas/u });
  await expect(externalDialog).toBeVisible();
  expect(await externalDialog.evaluate(element => element.closest(".planner-external-popover")?.parentElement === document.body)).toBe(true);
  await expect(externalDialog.locator(".planner-external-popover__choice")).toHaveCount(5);
  await expect(externalDialog.locator(".planner-external-popover__choice").first().locator(".planner-external-gain")).toBeVisible();
  await expect.poll(() => externalDialog.locator(".planner-capability-chip__icon").evaluateAll(wrappers => wrappers.length > 0 && wrappers.every(wrapper => {
    const image = wrapper.querySelector("img") as HTMLImageElement | null;
    return Boolean(image?.complete && image.naturalWidth > 0);
  })), { timeout: 15_000 }).toBe(true);
  await expect.poll(() => externalDialog.locator(".planner-external-popover__icons img").evaluateAll(images =>
    images.length === 5 && images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  const dialogAndPreviewLayers = await page.evaluate(() => ({
    dialog: Number.parseInt(getComputedStyle(document.querySelector(".planner-external-popover")!).zIndex, 10),
    preview: Number.parseInt(getComputedStyle(document.querySelector(".planner-external-preview")!).zIndex || "0", 10) || 0,
  }));
  expect(dialogAndPreviewLayers.dialog).toBeGreaterThan(dialogAndPreviewLayers.preview);
  await capture(page, "16b-planner-external-modal-quick.png");
  await page.keyboard.press("Escape");
  await expect(externalCard.locator(".planner-external-card__more")).toHaveCSS("outline-style", "none");
  const footerGeometry = await recommendations.first().locator(".planner-utilities").evaluate(element => {
    const footer = element.getBoundingClientRect();
    const sections = [...element.querySelectorAll(":scope > section")].map(section => section.getBoundingClientRect());
    const titles = [...element.querySelectorAll(":scope > section > strong")].map(title => title.getBoundingClientRect());
    const summaryIcons = [...element.querySelectorAll('.planner-summary-icons .planner-utility[data-compact="true"], .planner-summary-external-count__eye')]
      .map(icon => icon.getBoundingClientRect());
    const damageWrapper = element.querySelector(".planner-summary-damage")!.getBoundingClientRect();
    const damageImage = element.querySelector(".planner-summary-damage img")!.getBoundingClientRect();
    const essentials = [...element.querySelectorAll(":scope > section:nth-child(2) .planner-summary-icons > .planner-utility-link")]
      .map(icon => icon.getBoundingClientRect());
    const essentialsCenter = (Math.min(...essentials.map(icon => icon.left))
      + Math.max(...essentials.map(icon => icon.right))) / 2;
    const capabilityImages = [...element.querySelectorAll<HTMLImageElement>(":scope > section:nth-child(3) .planner-capability-grid__icon img")];
    return {
      firstWidth: sections[0].width,
      secondWidth: sections[1].width,
      thirdWidth: sections[2].width,
      titleTopGap: Math.max(...titles.map(title => title.top - footer.top)),
      summaryIconSizes: summaryIcons.map(icon => [icon.width, icon.height]),
      damageImageSize: [damageImage.width, damageImage.height],
      damageCenterDelta: Math.abs((damageWrapper.left + damageWrapper.width / 2)
        - (damageImage.left + damageImage.width / 2)),
      essentialsCenterDelta: Math.abs(essentialsCenter - (sections[1].left + sections[1].width / 2)),
      capabilityNaturalWidths: capabilityImages.map(image => image.naturalWidth),
    };
  });
  expect(footerGeometry.firstWidth).toBeCloseTo(footerGeometry.secondWidth, 0);
  expect(footerGeometry.thirdWidth).toBeGreaterThan(footerGeometry.firstWidth * 2);
  expect(footerGeometry.titleTopGap).toBeLessThanOrEqual(8);
  expect(footerGeometry.summaryIconSizes.every(size => size[0] === 42 && size[1] === 42)).toBe(true);
  expect(footerGeometry.damageImageSize).toEqual([42, 42]);
  expect(footerGeometry.damageCenterDelta).toBeLessThan(0.5);
  expect(footerGeometry.essentialsCenterDelta).toBeLessThanOrEqual(0.5);
  expect(footerGeometry.capabilityNaturalWidths.every(width => width >= 42)).toBe(true);
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

test("centers incomplete Planner previews and same-row detail pairs", async ({ page }) => {
  const openIncompletePair = async (stoneName: RegExp, teammateName: string) => {
    await openTeams(page, "teams-planner");
    await page.getByRole("button", { name: /Ruby Life Pools/u }).click();
    await page.getByRole("button", { name: "Planificar piedra" }).click();
    await page.getByRole("button", { name: stoneName }).click();
    await page.getByRole("button", { name: new RegExp(`Filtrar por ${teammateName}`, "u") }).click();
    await page.getByRole("checkbox", { name: /Rellenar la composici/u }).click();
    await page.getByRole("button", { name: "Calcular Top 5" }).click();
    await expect(page.locator(".planner-recommendation")).toHaveCount(5);
  };
  const expectCenteredGeometry = async () => {
    const recommendation = page.locator(".planner-recommendation").first();
    const compact = recommendation.locator(".planner-recommendation__party");
    await expect(compact).toHaveAttribute("data-centered", "true");
    const compactGeometry = await compact.evaluate(element => {
      const party = element.getBoundingClientRect();
      const cards = [...element.children].map(card => card.getBoundingClientRect());
      return {
        cardCount: cards.length,
        centerDelta: Math.abs((cards[0].left + cards.at(-1)!.right) / 2 - (party.left + party.right) / 2),
      };
    });
    expect(compactGeometry.cardCount).toBe(2);
    expect(compactGeometry.centerDelta).toBeLessThan(1);

    await recommendation.getByRole("button", { name: "Expandir #1" }).click();
    const detail = recommendation.locator(".planner-party-trapezoid");
    await expect(detail).toHaveAttribute("data-single-row-pair", "true");
    const detailGeometry = await detail.evaluate(element => {
      const party = element.getBoundingClientRect();
      const cards = [...element.children].map(card => card.getBoundingClientRect());
      return {
        horizontalDelta: Math.abs((cards[0].left + cards.at(-1)!.right) / 2 - (party.left + party.right) / 2),
        verticalDelta: Math.abs((cards[0].top + cards[0].bottom) / 2 - (party.top + party.bottom) / 2),
      };
    });
    expect(detailGeometry.horizontalDelta).toBeLessThan(1);
    expect(detailGeometry.verticalDelta).toBeLessThan(1);
  };

  await openIncompletePair(/\+9.*Auralisdelaluzeterna.*Guardiana/u, "Nightshift");
  await expectCenteredGeometry();
  await capture(page, "16c-planner-centered-tank-healer.png");

  await openIncompletePair(/\+12.*Bakuhatsu.*Speeson/u, "Ironforge");
  await expectCenteredGeometry();
  await capture(page, "16d-planner-centered-dps.png");
});

test("reviews Advanced exact-spec vacancy recommendations", async ({ page }) => {
  await openTeams(page, "teams-planner");
  await page.getByRole("button", { name: /Ruby Life Pools/u }).click();
  await page.getByRole("button", { name: "Planificar piedra" }).click();
  await page.getByRole("group", { name: "Modo de recomendación" })
    .getByRole("button", { name: "Avanzado · Specs" }).click();
  await page.getByRole("button", { name: /\+12.*Bakuhatsu.*Speeson/u }).click();
  for (const member of ["Guardiana", "Voidwalker", "Nightshift", "Ironforge"]) {
    await page.getByRole("button", { name: new RegExp(`Filtrar por ${member}`, "u") }).click();
  }
  await page.getByRole("button", { name: "Calcular Top 5" }).click();
  const recommendations = page.locator(".planner-recommendation");
  await expect(recommendations).toHaveCount(5);
  const preview = recommendations.first().locator(".planner-external-preview");
  await expect(preview.locator('[data-icon-kind="spec"]')).toHaveCount(4);
  await expect(preview.locator('img[src*="classicon_"]')).toHaveCount(0);
  await recommendations.first().getByRole("button", { name: "Expandir #1" }).click();
  const externalCard = recommendations.first().locator(".planner-external-card");
  await expect(externalCard.getByText("Fury Warrior")).toBeVisible();
  await expect(recommendations.first().getByRole("img", { name: "Daño: mixto" }).locator("img")).toHaveAttribute("src", /mix-damage/u);
  await expect(externalCard.locator('.planner-external-card__selectors [data-icon-kind="spec"]')).toHaveCount(4);
  await expect(externalCard.locator('.planner-external-card__selectors img[src*="classicon_"]')).toHaveCount(0);
  await expect(externalCard.locator(".planner-capability-grid__icon")).toHaveCount(5);
  const capabilityMore = externalCard.locator(".planner-capability-grid__more");
  await capabilityMore.hover();
  const capabilityPopup = page.getByRole("tooltip");
  await expect(capabilityPopup).toBeVisible();
  expect(await capabilityPopup.evaluate(element => element.parentElement === document.body)).toBe(true);
  const overflowLayers = await capabilityPopup.evaluate(element => ({
    popup: Number.parseInt(getComputedStyle(element).zIndex, 10),
    card: Number.parseInt(getComputedStyle(document.querySelector(".planner-external-card")!).zIndex || "0", 10) || 0,
  }));
  expect(overflowLayers.popup).toBeGreaterThan(overflowLayers.card);
  await capabilityMore.evaluate(element => (element as HTMLElement).blur());
  await externalCard.getByRole("button", { name: /Ver clases recomendadas: 5/u }).click();
  const dialog = page.getByRole("dialog", { name: /Specs recomendadas/u });
  await expect(dialog.locator(".planner-external-popover__choice").first().locator(".planner-external-popover__icons img")).toHaveCount(2);
  await expect.poll(() => dialog.locator(".planner-external-popover__icons img").evaluateAll(images =>
    images.length === 10 && images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await expect.poll(() => dialog.locator(".planner-capability-chip__icon").evaluateAll(wrappers => wrappers.length > 0 && wrappers.every(wrapper => {
    const image = wrapper.querySelector("img") as HTMLImageElement | null;
    return Boolean(image?.complete && image.naturalWidth > 0);
  })), { timeout: 15_000 }).toBe(true);
  await capture(page, "17a-planner-advanced-modal.png");
  await page.keyboard.press("Escape");
  await capture(page, "17a-planner-advanced-results.png");
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
  await expect(inactiveCard.getByRole("button", { name: /Guardian · Selecciona tu preferencia/u })).toBeDisabled();
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
  await expect(characterCard).toContainText("Configura juego y botín");
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
  const lootGuide = page.locator(".planner-config-guide").filter({ hasText: "1. Configura el botín" });
  await expect(lootGuide).toBeVisible();
  const guideBounds = await lootGuide.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return { top: bounds.top, left: bounds.left, right: bounds.right, bottom: bounds.bottom };
  });
  expect(guideBounds.top).toBeGreaterThanOrEqual(0);
  expect(guideBounds.left).toBeGreaterThanOrEqual(0);
  expect(guideBounds.right).toBeLessThanOrEqual(1672);
  expect(guideBounds.bottom).toBeLessThanOrEqual(941);
  await capture(page, "17a-planner-config-guide.png");
  const lootButton = characterCard.getByRole("button", { name: "Configurar botín de Bakuhatsu" });
  const lootButtonBounds = await lootButton.evaluate(element => {
    const bounds = element.getBoundingClientRect(); return { width: bounds.width, height: bounds.height };
  });
  expect(lootButtonBounds.width).toBeCloseTo(lootButtonBounds.height, 0);
  await lootButton.click();
  const lootDialog = dialog.locator(".planner-loot-config-popover");
  await expect(lootDialog).toBeVisible();
  const initialNoInterest = lootDialog.getByRole("button", { name: /· none$/u });
  await expect(initialNoInterest).toHaveCount(4);
  for (const option of await initialNoInterest.all()) await expect(option).toHaveAttribute("aria-pressed", "true");
  const availabilityGuide = page.locator(".planner-config-guide").filter({ hasText: "2. Indica qué quieres jugar" });
  await expect(availabilityGuide).toBeHidden();
  const guardianPrimary = lootDialog.getByRole("button", { name: "Guardian · primary" });
  const balancePrimary = lootDialog.getByRole("button", { name: "Balance · primary" });
  await guardianPrimary.click();
  const matrixToggleBounds = await guardianPrimary.evaluate(element => {
    const bounds = element.getBoundingClientRect(); return { width: bounds.width, height: bounds.height };
  });
  expect(matrixToggleBounds.width).toBeCloseTo(matrixToggleBounds.height, 0);
  await balancePrimary.click();
  const primaryError = page.getByRole("alertdialog", { name: "Sólo puede haber una especialización primaria" });
  await expect(primaryError).toBeVisible();
  await capture(page, "18a-planner-primary-error.png");
  await primaryError.getByRole("button", { name: "Entendido" }).click();
  await guardianPrimary.click();
  await balancePrimary.click();
  await lootDialog.getByRole("button", { name: "Guardian · secondary" }).click();
  await expect(lootDialog.getByRole("button", { name: "Guardian · secondary" })).toHaveAttribute("aria-pressed", "true");
  await capture(page, "18-planner-loot.png");
  await lootDialog.getByRole("button", { name: "Listo" }).click();
  await expect(availabilityGuide).toBeVisible();
  const availabilityGuideBounds = await availabilityGuide.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return { top: bounds.top, left: bounds.left, right: bounds.right, bottom: bounds.bottom };
  });
  expect(availabilityGuideBounds.top).toBeGreaterThanOrEqual(0);
  expect(availabilityGuideBounds.left).toBeGreaterThanOrEqual(0);
  expect(availabilityGuideBounds.right).toBeLessThanOrEqual(1672);
  expect(availabilityGuideBounds.bottom).toBeLessThanOrEqual(941);
  await capture(page, "18b-planner-availability-guide.png");
  await roleCards.first().getByRole("button").click();
  await expect(dialog.locator(".planner-availability-popover")).toBeVisible();
  await expect(dialog.getByRole("option")).toHaveCount(4);
  expect(await characterCard.evaluate(element => element.getBoundingClientRect().height)).toBeCloseTo(characterHeight, 0);
  await capture(page, "19-planner-preferences.png");
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
