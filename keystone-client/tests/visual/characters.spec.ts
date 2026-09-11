import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("keystone-client.theme")) localStorage.setItem("keystone-client.theme", "poison");
  });
  await page.goto("/?preview=characters");
  await page.evaluate(() => localStorage.removeItem("keystone-client.characters.inactive.v1"));
  await page.reload();
});

test("matches the approved Characters composition at 1672 x 941", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Personajes", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".gear-item")).toHaveCount(16);
  await expect(page.locator(".dungeon-grid article")).toHaveCount(8);
  await expect(page.locator(".currency-card")).toHaveCount(10);
  for (const card of await page.locator(".currency-card").all()) await expect(card).toBeVisible();
  const gear = await page.locator(".gear-row").boundingBox();
  const items = await page.locator(".gear-item").all();
  const boxes = await Promise.all(items.map(item => item.boundingBox()));
  expect(new Set(boxes.map(box => Math.round(box!.y))).size).toBe(1);
  expect(gear!.width).toBeGreaterThan(700);
  await expect(page.locator(".ks-header")).toHaveCSS("height", "90px");
  await expect(page.locator(".ks-footer")).toHaveCSS("height", "102px");
  await expect(page.locator(".characters-rail")).toHaveCSS("border-right-width", "0px");
  await expect(page.locator(".characters-select__trigger > svg")).toHaveCount(1);
  await page.getByRole("button", { name: "Cuenta y reino", exact: true }).click();
  await expect(page.getByRole("menu", { name: "Cuenta y reino" })).toBeVisible();
  await expect(page.getByRole("menu", { name: "Cuenta y reino" })).toHaveCSS("background-image", /gradient/);
  await page.getByRole("button", { name: "Cuenta y reino", exact: true }).click();
  const selectedCharacter = page.locator(".characters-card.is-selected");
  await expect(selectedCharacter).toHaveCount(1);
  await expect(selectedCharacter).not.toHaveCSS("box-shadow", "none");
  await expect(selectedCharacter).toHaveCSS("transform", "none");
  await expect(selectedCharacter.locator(".characters-card__select")).toHaveCSS("outline-style", "none");
  const accountHeader = page.locator(".characters-rail-section__toggle").first();
  const accountSelector = page.locator(".characters-select__trigger");
  await expect(accountHeader.locator("small")).toHaveCount(0);
  await expect(accountHeader).not.toHaveCSS("border-radius", "0px");
  expect(parseFloat(await accountHeader.locator("strong").evaluate(element => getComputedStyle(element).fontSize)))
    .toBeGreaterThan(parseFloat(await accountSelector.locator("strong").evaluate(element => getComputedStyle(element).fontSize)));
  const rail = await page.locator(".characters-rail").boundingBox();
  const nestedContent = await page.locator(".characters-rail-section__body").boundingBox();
  expect(nestedContent!.x).toBeGreaterThan(rail!.x);
  await expect(page.locator(".characters-rail-section__body")).toHaveCSS("border-left-width", "0px");
  await expect(page.locator(".currency-card__icon img")).toHaveCount(10);
  await expect.poll(() => page.locator(".currency-card__icon img").evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  expect(await page.locator(".dungeon-grid article").first().evaluate(card => card.getBoundingClientRect().height)).toBeLessThan(100);
  expect(await page.locator(".dungeon-grid article > div > span").evaluateAll(names => names.every(name => name.scrollWidth <= name.clientWidth))).toBe(true);
  expect(await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })))
    .toEqual({ width: 1672, height: 941 });
  await expect(page.locator(".characters-sidebar .money-card")).toBeVisible();
  const gem = await page.locator(".gear-item__gems").first().boundingBox();
  const enchant = await page.locator(".gear-item__enchant").first().boundingBox();
  expect(gem!.y + gem!.height).toBeLessThanOrEqual(enchant!.y);
  const talentButton = await page.getByRole("button", { name: "Mostrar configuración completa" }).boundingBox();
  expect(talentButton!.width).toBeGreaterThan(400);
  expect(talentButton!.height).toBeLessThanOrEqual(24);
  const vault = await page.locator(".vault-panel").boundingBox();
  const prey = await page.locator(".prey-panel").boundingBox();
  const money = await page.locator(".money-card").boundingBox();
  expect(Math.abs(vault!.height - prey!.height)).toBeLessThan(2);
  expect(money!.height).toBeLessThan(vault!.height);
  const moneyIcon = await page.locator(".money-card__icon").boundingBox();
  const moneyValues = await page.locator(".money-card > div").boundingBox();
  const goldSize = await page.locator(".money-card strong").evaluate(element => getComputedStyle(element).fontSize);
  const silverSize = await page.locator(".money-card__silver").evaluate(element => getComputedStyle(element).fontSize);
  const copperSize = await page.locator(".money-card__copper").evaluate(element => getComputedStyle(element).fontSize);
  expect(goldSize).toBe(silverSize);
  expect(goldSize).toBe(copperSize);
  const moneyGroupCenter = (moneyIcon!.x + moneyValues!.x + moneyValues!.width) / 2;
  expect(Math.abs(moneyGroupCenter - (money!.x + money!.width / 2))).toBeLessThan(2);
  const fallbackEnchant = page.locator(".gear-item__enchant:not(a)").first();
  await fallbackEnchant.hover();
  const fallbackTooltip = page.getByRole("tooltip", { name: "Hex de parasitismo potenciado" });
  await expect(fallbackTooltip).toBeVisible();
  await expect(fallbackTooltip).toHaveCSS("position", "fixed");
  await expect(fallbackTooltip).toHaveCSS("z-index", "2147483647");
  expect(await fallbackTooltip.evaluate(tooltip => tooltip.parentElement === document.body)).toBe(true);
  const fallbackBounds = await fallbackTooltip.boundingBox();
  expect(fallbackBounds!.x).toBeGreaterThanOrEqual(0);
  expect(fallbackBounds!.y).toBeGreaterThanOrEqual(0);
  const dungeonVaultSlot = page.locator(".vault-panel > div").nth(1).locator(".vault-slot").first();
  await dungeonVaultSlot.hover();
  await expect(dungeonVaultSlot.getByRole("tooltip")).toBeVisible();
  await expect(dungeonVaultSlot.getByRole("tooltip")).toContainText("+12 Altar de los Colmillos");
  await page.screenshot({ path: "test-results/characters/characters-1672x941.png" });
});

test("drags characters between active and inactive zones with feedback and persistence", async ({ page }) => {
  const activeZone = page.locator('[data-zone="active"]');
  const inactiveZone = page.locator('[data-zone="inactive"]');
  const activeCard = activeZone.locator(".characters-card").filter({ hasText: "Makabe" });

  await activeCard.evaluate(element => element.dispatchEvent(new DragEvent("dragstart", {
    bubbles: true, dataTransfer: new DataTransfer(),
  })));
  await expect(activeCard).toHaveCSS("opacity", "0.5");
  await expect(activeCard).toHaveCSS("filter", /blur\(1px\)/u);
  await activeCard.evaluate(element => element.dispatchEvent(new DragEvent("dragend", { bubbles: true })));
  await expect(activeCard).toHaveCSS("opacity", "1");

  await activeCard.dragTo(inactiveZone);
  await expect(activeZone.locator(".characters-card").filter({ hasText: "Makabe" })).toHaveCount(0);
  const inactiveToggle = inactiveZone.locator(".characters-inactive-tray");
  await expect(inactiveToggle).toHaveAttribute("aria-expanded", "false");
  await expect(inactiveToggle).toContainText("1");
  await inactiveToggle.click();
  const inactiveCard = inactiveZone.locator(".characters-card").filter({ hasText: "Makabe" });
  await expect(inactiveCard).toHaveClass(/is-inactive/u);
  await expect(inactiveCard).toHaveCSS("opacity", "1");
  const tray = await inactiveToggle.boundingBox();
  const panel = await inactiveZone.locator(".characters-inactive-tray__panel").boundingBox();
  expect(panel!.y + panel!.height).toBeLessThanOrEqual(tray!.y);
  await page.reload();
  await expect(inactiveToggle).toHaveAttribute("aria-expanded", "false");
  await inactiveToggle.click();
  await expect(inactiveZone.locator(".characters-card").filter({ hasText: "Makabe" })).toHaveClass(/is-inactive/u);

  await inactiveZone.locator(".characters-card").filter({ hasText: "Makabe" }).dragTo(activeZone.locator(":scope > header"));
  await expect(activeZone.locator(".characters-card").filter({ hasText: "Makabe" })).not.toHaveClass(/is-inactive/u);
});

test("only shrinks Active when expanded Inactive would exceed the available rail", async ({ page }) => {
  const activeZone = page.locator('[data-zone="active"]');
  const inactiveZone = page.locator('[data-zone="inactive"]');
  await page.evaluate(() => localStorage.setItem("keystone-client.characters.inactive.v1", JSON.stringify([
    "characters-2",
  ])));
  await page.reload();
  const activeClosed = await activeZone.boundingBox();
  await inactiveZone.locator(".characters-inactive-tray").click();
  const activeOpen = await activeZone.boundingBox();
  const inactiveOpen = await inactiveZone.boundingBox();
  expect(activeOpen!.height).toBeCloseTo(activeClosed!.height, 0);
  expect(activeOpen!.y + activeOpen!.height).toBeLessThanOrEqual(inactiveOpen!.y);
  await expect(inactiveZone.locator(".characters-inactive-tray__panel")).toHaveCSS("position", "static");

  await inactiveZone.locator(".characters-inactive-tray").click();
  await page.evaluate(() => localStorage.setItem("keystone-client.characters.inactive.v1", JSON.stringify([
    "makabe", "bakuhatsu", "dkimio", "nakada",
  ])));
  await page.goto("/?preview=sync-idle");
  await page.getByRole("button", { name: "Personajes", exact: true }).click();
  const constrainedClosed = await activeZone.boundingBox();
  await inactiveZone.locator(".characters-inactive-tray").click();
  const constrainedOpen = await activeZone.boundingBox();
  expect(constrainedOpen!.height).toBeLessThan(constrainedClosed!.height);
  await expect(activeZone.locator(":scope > div")).toHaveCSS("overflow-y", "auto");
  expect(await activeZone.locator(":scope > div").evaluate(element => element.scrollHeight)).toBeGreaterThan(
    await activeZone.locator(":scope > div").evaluate(element => element.clientHeight),
  );
});

test("keeps the complete dashboard and modal usable at the minimum window", async ({ page }) => {
  await page.setViewportSize({ width: 940, height: 529 });
  await page.evaluate(() => localStorage.setItem("keystone-client.characters.inactive.v1", JSON.stringify([
    "characters-1", "characters-2", "characters-3", "characters-4", "characters-5", "characters-6",
  ])));
  await page.reload();
  await expect(page.locator(".currency-card")).toHaveCount(10);
  const inactiveTray = page.locator(".characters-inactive-tray");
  await inactiveTray.click();
  const inactivePanel = await page.locator(".characters-inactive-tray__panel").boundingBox();
  expect(inactivePanel).not.toBeNull();
  expect(inactivePanel!.x).toBeGreaterThanOrEqual(0);
  expect(inactivePanel!.y).toBeGreaterThanOrEqual(0);
  expect(inactivePanel!.x + inactivePanel!.width).toBeLessThanOrEqual(940);
  expect(inactivePanel!.y + inactivePanel!.height).toBeLessThanOrEqual(529);
  await inactiveTray.click();
  await page.getByRole("button", { name: "Mostrar configuración completa" }).click();
  const bounds = await page.getByRole("dialog").boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(940);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(529);
});

test("shows class, hero, spec and Omnium trees together", async ({ page }) => {
  await page.getByRole("button", { name: "Mostrar configuración completa" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("[data-tree-type=class]")).toBeVisible();
  await expect(page.locator("[data-tree-type=hero]")).toBeVisible();
  await expect(page.locator("[data-tree-type=spec]")).toBeVisible();
  await expect(page.locator("[data-tree-type=omnium]")).toBeVisible();
  const modal = await page.locator(".ks-talent-modal").boundingBox();
  const view = await page.locator(".ks-view").boundingBox();
  expect(modal!.y).toBe(view!.y);
  expect(modal!.y + modal!.height).toBe(view!.y + view!.height);
  expect(await page.locator(".ks-talent-tree__edges line").count()).toBeGreaterThan(0);
  expect(await page.locator(".ks-talent-tree__edges").first().evaluate(element => getComputedStyle(element).zIndex)).toBe("0");
  const classTree = await page.locator("[data-tree-type=class]").boundingBox();
  const heroTree = await page.locator("[data-tree-type=hero]").boundingBox();
  const omniumTree = await page.locator("[data-tree-type=omnium]").boundingBox();
  expect(heroTree!.width).toBeLessThan(classTree!.width);
  expect(omniumTree!.width).toBeLessThan(heroTree!.width);
  await expect(page.locator(".ks-talent-node.is-choice").first()).toHaveCSS("border-radius", "7px");
  await expect(page.locator("[data-tree-type=hero] .ks-talent-node").first()).toHaveClass(/is-selected/);
  const folioNode = await page.locator("[data-tree-type=omnium] .ks-talent-node").first().boundingBox();
  expect(folioNode!.width).toBeGreaterThanOrEqual(36);
  await page.screenshot({ path: "test-results/characters/talents-1672x941.png" });
});

test("exposes typed Wowhead targets without allowing the script to rewrite the UI", async ({ page }) => {
  const item = page.locator(".gear-item__piece").first();
  await expect(item).toHaveAttribute("href", "https://www.wowhead.com/item=240000");
  await expect(item).toHaveAttribute("data-wowhead", "domain=es&ench=456&gems=250001&bonus=2001:2002&ilvl=308&lvl=90&pcs=240000:240001:240002:240003&spec=102");
  await expect(item).not.toHaveAttribute("title");
  await expect(page.locator(".gear-item__gems a").first()).toHaveAttribute("href", "https://www.wowhead.com/item=250001");
  await expect(page.locator('.gear-item a[href="https://www.wowhead.com/spell=1254400"]').first()).toBeVisible();
  await expect(page.locator('.currency-card-link[href="https://www.wowhead.com/currency=3445"]')).toBeVisible();
  await expect(page.locator('.currency-card-link[href="https://www.wowhead.com/item=274476"]')).toBeVisible();

  await expect.poll(() => page.locator("#keystonesync-wowhead-tooltips").count()).toBe(1);
  expect(await page.evaluate(() => window.whTooltips)).toEqual({ colorLinks: false, iconizeLinks: false, renameLinks: false });
  await expect.poll(() => page.evaluate(() => Boolean(window.$WowheadPower)), { timeout: 15_000 }).toBe(true);
  await item.hover();
  await expect(page.locator(".wowhead-tooltip").first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Mostrar configuración completa" }).click();
  for (const treeType of ["class", "hero", "spec", "omnium"]) {
    const target = page.locator(`[data-tree-type=${treeType}] a[href*="/spell="]`).first();
    await expect(target).toHaveAttribute("data-wowhead", "domain=es&lvl=90");
    await expect(target.locator(".ks-talent-node")).toBeVisible();
  }
  await expect(page.locator("#keystonesync-wowhead-tooltips")).toHaveCount(1);
});

test("keeps the Hunter necklace dimensions stable across repeated character changes", async ({ page }) => {
  const sizes: Array<{ pieceWidth: number; pieceHeight: number; iconWidth: number; iconHeight: number }> = [];
  for (let index = 0; index < 5; index += 1) {
    await page.getByRole("button", { name: /Makabe/ }).click();
    const necklace = page.locator(".gear-item__piece").nth(1);
    await expect(necklace).toHaveAttribute("href", "https://www.wowhead.com/item=268265");
    await expect.poll(() => necklace.locator("img").evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const necklaceGems = page.locator(".gear-item__gems").nth(1).locator(".gear-item__gem");
    await expect(necklaceGems).toHaveCount(2);
    const piece = await necklace.boundingBox();
    const icon = await necklace.locator("img").boundingBox();
    const gemBoxes = await necklaceGems.evaluateAll(elements => elements.map(element => {
      const bounds = element.getBoundingClientRect();
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    }));
    expect(gemBoxes[1].x).toBeCloseTo(gemBoxes[0].x, 0);
    expect(gemBoxes[1].y).toBeCloseTo(gemBoxes[0].y + gemBoxes[0].height + 4, 0);
    expect(gemBoxes.map(gem => [gem.width, gem.height])).toEqual([[28, 28], [28, 28]]);
    expect(piece!.width).toBeCloseTo((await page.locator(".gear-item__piece").first().boundingBox())!.width, 0);
    sizes.push({ pieceWidth: piece!.width, pieceHeight: piece!.height, iconWidth: icon!.width, iconHeight: icon!.height });
    await page.getByRole("button", { name: /Bakuhatsu/ }).click();
  }
  expect(sizes.slice(1)).toEqual(Array(sizes.length - 1).fill(sizes[0]));
});

test("keeps the PNG composition in Keystone, Poison, and Void", async ({ page }) => {
  const selectorBorders = new Set<string>();
  for (const theme of ["keystone", "poison", "void"]) {
    await page.evaluate(value => localStorage.setItem("keystone-client.theme", value), theme);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.locator(".gear-item")).toHaveCount(16);
    await expect(page.locator(".dungeon-grid article")).toHaveCount(8);
    await expect(page.locator(".currency-card")).toHaveCount(10);
    await page.getByRole("button", { name: "Cuenta y reino", exact: true }).click();
    const popover = page.getByRole("menu", { name: "Cuenta y reino" });
    await expect(popover).toBeVisible();
    selectorBorders.add(await popover.evaluate(element => getComputedStyle(element).borderColor));
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(941);
  }
  expect(selectorBorders.size).toBe(3);
});
