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
  await expect(page.locator(".currency-card")).toHaveCount(11);
  await expect(page.locator(".currencies-grid__slot")).toHaveCount(16);
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
  await expect(page.locator(".currency-card__icon img")).toHaveCount(11);
  await expect.poll(() => page.locator(".currency-card__icon img").evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  expect(await page.locator(".currency-card__title").evaluateAll(titles => titles.every(title => title.scrollHeight <= title.clientHeight + 1 && title.scrollWidth <= title.clientWidth + 1))).toBe(true);
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
  await expect(dungeonVaultSlot.getByRole("tooltip")).toContainText("ilvl 318");
  await expect(dungeonVaultSlot.getByRole("tooltip").locator("em")).not.toContainText("ilvl");
  const raidVaultSlot = page.locator(".vault-panel > div").nth(0).locator(".vault-slot").first();
  await raidVaultSlot.hover();
  await expect(raidVaultSlot.getByRole("tooltip")).toContainText("ilvl 316");
  const worldVaultSlot = page.locator(".vault-panel > div").nth(2).locator(".vault-slot").first();
  await worldVaultSlot.hover();
  await expect(worldVaultSlot.getByRole("tooltip")).toContainText("ilvl 315");
  await page.screenshot({ path: "test-results/characters/characters-1672x941.png" });
});

test("organizes the currency grid with icon slots and an available list", async ({ page }) => {
  await page.getByRole("button", { name: "Organizar monedas" }).click();
  const dialog = page.getByRole("dialog", { name: "Organizar monedas" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-currency-slot]")).toHaveCount(16);
  await expect(dialog.locator(".currency-editor__available button")).toHaveCount(11);
  await expect(dialog.locator(".currency-editor__available img")).toHaveCount(11);
  await expect.poll(() => dialog.locator(".currency-editor__available img").evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await expect(dialog.locator("[data-currency-slot='0'] img")).toBeVisible();
  const editorSlot = await dialog.locator("[data-currency-slot='0']").boundingBox();
  const editorIcon = await dialog.locator("[data-currency-slot='0'] img").boundingBox();
  const removeButton = await dialog.getByRole("button", { name: /Quitar Blasón de bruma de héroe/ }).boundingBox();
  expect(Math.abs(editorSlot!.width - editorSlot!.height)).toBeLessThan(2);
  expect(editorSlot!.width).toBeLessThan(130);
  expect(editorIcon!.width).toBeGreaterThan(editorSlot!.width * 0.8);
  expect(Math.abs(removeButton!.width - removeButton!.height)).toBeLessThan(2);
  const availableIcons = await dialog.locator(".currency-editor__available button img").evaluateAll(images => images.slice(0, 3).map(image => image.getBoundingClientRect().left));
  expect(Math.max(...availableIcons) - Math.min(...availableIcons)).toBeLessThan(2);
  const undercoinChoice = dialog.getByRole("button", { name: "Añadir Inframoneda" });
  await undercoinChoice.hover();
  await expect(undercoinChoice).toHaveClass(/is-hovered/);
  await expect(dialog.locator("[data-currency-slot='5']")).toHaveClass(/is-click-target/);
  await page.screenshot({ path: "test-results/characters/currency-editor-1672x941.png" });
  await undercoinChoice.click();
  await expect(dialog.locator("[data-currency-slot='5']")).toHaveAttribute("data-currency", "undercoin");
  await dialog.locator("[data-currency-slot='5']").dragTo(dialog.locator("[data-currency-slot='0']"));
  await expect(dialog.locator("[data-currency-slot='0']")).toHaveAttribute("data-currency", "undercoin");
  await expect(dialog.locator("[data-currency-slot='5']")).toHaveAttribute("data-currency", "heroMistcrest");
  await dialog.getByRole("button", { name: "Cerrar" }).click();
  await expect(page.locator(".currencies-grid [data-layout-slot='0'] .currency-card")).toHaveAttribute("data-currency", "undercoin");
});

test("keeps currency titles within two lines at a narrower desktop width", async ({ page }) => {
  for (const width of [1280, 940]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.locator(".currency-card__title").evaluateAll(titles => titles.every(title => title.scrollHeight <= title.clientHeight + 1 && title.scrollWidth <= title.clientWidth + 1))).toBe(true);
  }
  await page.screenshot({ path: "test-results/characters/characters-940x800.png" });
});

test("fits every available currency title in Spanish and English", async ({ page }) => {
  await page.getByRole("button", { name: "Organizar monedas" }).click();
  const placed = await page.locator(".currency-editor__slot[data-currency]").evaluateAll(slots => slots.map(slot => slot.getAttribute("data-currency")!));
  const available = await page.locator(".currency-editor__available button[data-currency]").evaluateAll(buttons => buttons.map(button => button.getAttribute("data-currency")!));
  const keys = [...placed, ...available];
  expect(keys).toHaveLength(22);
  for (const language of ["es", "en"]) {
    for (let start = 0; start < keys.length; start += 16) {
      const layout = [...keys.slice(start, start + 16), ...Array(16).fill(null)].slice(0, 16);
      await page.evaluate(slots => localStorage.setItem("keystone-client.currency-layout.v1:spee", JSON.stringify(slots)), layout);
      await page.goto(`/?preview=characters&lang=${language}`);
      const clipped = await page.locator(".currency-card__title").evaluateAll(titles => titles.filter(title => title.scrollHeight > title.clientHeight + 1 || title.scrollWidth > title.clientWidth + 1).map(title => title.textContent));
      expect(clipped).toEqual([]);
    }
  }
});

test("shows caps and Trovehunter status on card hover and keyboard focus", async ({ page }) => {
  const untainted = page.locator('[data-currency="untaintedManaCrystals"]').first();
  await untainted.locator(".currency-card__title").hover();
  await expect(untainted.getByRole("tooltip")).toBeVisible();
  await expect(untainted.getByRole("tooltip")).toContainText("Semanal 250 / 250");
  await expect(untainted.locator(".currency-card-link > .currency-card__icon")).toBeVisible();
  await untainted.locator(".currency-card-link").hover();
  await expect(untainted.getByRole("tooltip")).toBeHidden();
  const spark = page.locator('[data-currency="sparksOfTides"]').first();
  await spark.locator(".currency-card__title").hover();
  await expect(spark.getByRole("tooltip")).toContainText("Temporada 4 / 4");
  await expect(spark.getByRole("tooltip")).toContainText("Bolsas");
  await expect(spark.getByRole("tooltip")).toContainText("Banco personal");
  const bounty = page.locator('[data-currency="trovehuntersBounty"]').first();
  await bounty.focus();
  await expect(bounty.getByRole("tooltip")).toBeVisible();
  await expect(bounty.getByRole("tooltip")).toContainText("En bolsas sin usar");
  await expect(bounty.locator(".currency-card__status-line svg")).toHaveCount(2);
  await expect(bounty.locator(".currency-card__bounty")).not.toContainText("En bolsas sin usar");
  await expect(bounty.locator(".currency-card__bounty")).toHaveCSS("flex-direction", "column");
});

test("centers card content and uses larger readable details with a square gear button", async ({ page }) => {
  const card = page.locator('[data-currency="heroMistcrest"]').first();
  const icon = await card.locator(".currency-card__icon").boundingBox();
  const settings = page.getByRole("button", { name: "Organizar monedas" });
  const settingsBox = await settings.boundingBox();
  expect(icon!.width).toBeGreaterThan(38);
  expect(Math.abs(settingsBox!.width - settingsBox!.height)).toBeLessThan(2);
  await expect(settings.locator("svg")).toHaveClass(/lucide-settings/);
  await expect(card.locator(".currency-card__title")).toHaveCSS("text-align", "center");
  await expect(card.locator(".currency-card__main")).toHaveCSS("justify-content", "center");
  await card.locator(".currency-card__title").hover();
  await expect(card.getByRole("tooltip")).toHaveCSS("text-align", "center");
  expect(Number.parseFloat(await card.getByRole("tooltip").evaluate(element => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(13);
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
  await expect(page.locator(".currency-card")).toHaveCount(11);
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
  await page.locator('[data-currency="heroMistcrest"] .currency-card-link').first().hover();
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

test("fits two gems and an enchant below one unchanged gear icon", async ({ page }) => {
  const gearItem = page.locator(".gear-item").nth(3);
  const piece = await gearItem.locator(".gear-item__piece").boundingBox();
  const otherPiece = await page.locator(".gear-item__piece").first().boundingBox();
  const gemBoxes = await gearItem.locator(".gear-item__gem").evaluateAll(elements => elements.map(element => {
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  }));
  const enchant = await gearItem.locator(".gear-item__enchant").boundingBox();
  const regularEnchant = await page.locator(".gear-item__enchant").first().boundingBox();

  expect(gemBoxes).toHaveLength(2);
  expect(piece!.width).toBeCloseTo(otherPiece!.width, 0);
  expect(gemBoxes[0].width).toBeLessThan(28);
  expect(gemBoxes[1].width).toBeLessThan(28);
  expect(gemBoxes[1].x).toBeGreaterThan(gemBoxes[0].x + gemBoxes[0].width);
  expect(gemBoxes[1].y).toBeCloseTo(gemBoxes[0].y, 0);
  expect(gemBoxes[0].x).toBeGreaterThanOrEqual(piece!.x);
  expect(gemBoxes[1].x + gemBoxes[1].width).toBeLessThanOrEqual(piece!.x + piece!.width);
  expect(enchant!.width).toBe(regularEnchant!.width);
  expect(enchant!.height).toBe(regularEnchant!.height);
  expect(enchant!.y).toBeGreaterThanOrEqual(gemBoxes[0].y + gemBoxes[0].height);
  expect(enchant!.x).toBeGreaterThanOrEqual(piece!.x);
  expect(enchant!.x + enchant!.width).toBeLessThanOrEqual(piece!.x + piece!.width);

  await page.setViewportSize({ width: 1280, height: 720 });
  const narrowPiece = await gearItem.locator(".gear-item__piece").boundingBox();
  const narrowOtherPiece = await page.locator(".gear-item__piece").first().boundingBox();
  const narrowGems = await gearItem.locator(".gear-item__gem").all();
  const narrowFirstGem = await narrowGems[0].boundingBox();
  const narrowSecondGem = await narrowGems[1].boundingBox();
  expect(narrowPiece!.width).toBeCloseTo(narrowOtherPiece!.width, 0);
  expect(narrowFirstGem!.x).toBeGreaterThanOrEqual(narrowPiece!.x);
  expect(narrowSecondGem!.x + narrowSecondGem!.width).toBeLessThanOrEqual(narrowPiece!.x + narrowPiece!.width);
});

test("keeps the PNG composition in Keystone, Poison, and Void", async ({ page }) => {
  const selectorBorders = new Set<string>();
  for (const theme of ["keystone", "poison", "void"]) {
    await page.evaluate(value => localStorage.setItem("keystone-client.theme", value), theme);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.locator(".gear-item")).toHaveCount(16);
    await expect(page.locator(".dungeon-grid article")).toHaveCount(8);
    await expect(page.locator(".currency-card")).toHaveCount(11);
    await page.getByRole("button", { name: "Cuenta y reino", exact: true }).click();
    const popover = page.getByRole("menu", { name: "Cuenta y reino" });
    await expect(popover).toBeVisible();
    selectorBorders.add(await popover.evaluate(element => getComputedStyle(element).borderColor));
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(941);
  }
  expect(selectorBorders.size).toBe(3);
});
