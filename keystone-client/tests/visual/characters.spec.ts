import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("keystone-client.theme")) localStorage.setItem("keystone-client.theme", "poison");
  });
  await page.goto("/?preview=characters");
});

test("matches the approved Characters composition at 1672 x 941", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Personajes" })).toHaveAttribute("aria-current", "page");
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
  await expect(page.locator(".characters-select__trigger > b")).toHaveCount(2);
  await page.getByRole("button", { name: "CUENTA" }).click();
  await expect(page.getByRole("listbox", { name: "CUENTA" })).toBeVisible();
  await expect(page.getByRole("listbox", { name: "CUENTA" })).toHaveCSS("background-image", /gradient/);
  await page.getByRole("button", { name: "CUENTA" }).click();
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

test("keeps the complete dashboard and modal usable at the minimum window", async ({ page }) => {
  await page.setViewportSize({ width: 940, height: 529 });
  await page.reload();
  await expect(page.locator(".currency-card")).toHaveCount(10);
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

test("keeps the PNG composition in Keystone, Poison, and Void", async ({ page }) => {
  const selectorBorders = new Set<string>();
  for (const theme of ["keystone", "poison", "void"]) {
    await page.evaluate(value => localStorage.setItem("keystone-client.theme", value), theme);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.locator(".gear-item")).toHaveCount(16);
    await expect(page.locator(".dungeon-grid article")).toHaveCount(8);
    await expect(page.locator(".currency-card")).toHaveCount(10);
    await page.getByRole("button", { name: "CUENTA" }).click();
    const popover = page.getByRole("listbox", { name: "CUENTA" });
    await expect(popover).toBeVisible();
    selectorBorders.add(await popover.evaluate(element => getComputedStyle(element).borderColor));
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(941);
  }
  expect(selectorBorders.size).toBe(3);
});
