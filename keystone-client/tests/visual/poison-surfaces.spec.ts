import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("keystone-client.theme", "poison"));
});

test("Poison gives tabs, ritual surfaces and sync action distinct registered artwork", async ({ page }) => {
  await page.goto("/?preview=sync-success");

  const selectedTab = page.locator('[data-ui="shell-tab"][data-state="selected"]');
  const summaryCard = page.locator(".sync-summary-card").first();
  const syncAction = page.getByRole("button", { name: "Sincronizar ahora" });

  await expect(selectedTab).toBeVisible();
  await expect(summaryCard).toBeVisible();
  await expect(syncAction).toBeEnabled();

  const treatment = await page.evaluate(() => {
    const selected = document.querySelector<HTMLElement>('[data-ui="shell-tab"][data-state="selected"]')!;
    const surface = document.querySelector<HTMLElement>(".sync-summary-card")!;
    const action = document.querySelector<HTMLElement>(".sync-primary-action")!;
    const activeDecoration = selected.querySelector<HTMLImageElement>(".ks-tab__decoration--active")!;
    const surfaceFrame = surface.querySelector<HTMLImageElement>(".sync-summary-card__frame")!;
    const actionFrame = action.querySelector<HTMLImageElement>(".sync-primary-action__frame")!;

    return {
      actionFrame: actionFrame.src,
      actionPointerEvents: getComputedStyle(actionFrame).pointerEvents,
      activeDecoration: activeDecoration.src,
      activePointerEvents: getComputedStyle(activeDecoration).pointerEvents,
      surfaceFrame: surfaceFrame.src,
      surfacePointerEvents: getComputedStyle(surfaceFrame).pointerEvents,
    };
  });

  expect(treatment.activeDecoration).toMatch(/tab-active-decoration(?:-[^/]+)?\.png$/);
  expect(treatment.surfaceFrame).toMatch(/summary-card-addon-frame(?:-[^/]+)?\.png$/);
  expect(treatment.actionFrame).toMatch(/sync-button-frame(?:-[^/]+)?\.png$/);
  expect(treatment.activePointerEvents).toBe("none");
  expect(treatment.surfacePointerEvents).toBe("none");
  expect(treatment.actionPointerEvents).toBe("none");
});

test("Poison keeps keyboard focus visible on the primary sync action", async ({ page }) => {
  await page.goto("/?preview=sync-success");

  const syncAction = page.getByRole("button", { name: "Sincronizar ahora" });
  await syncAction.focus();
  await expect(syncAction).toBeFocused();

  const focus = await syncAction.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      outlineColor: styles.outlineColor,
      outlineStyle: styles.outlineStyle,
      outlineWidth: styles.outlineWidth,
    };
  });

  expect(focus.outlineStyle).toBe("solid");
  expect(focus.outlineWidth).toBe("2px");
  expect(focus.outlineColor).toBe("rgba(210, 255, 119, 0.94)");
});

test("Poison keeps the decorative modal stroke anchored to the dialog panel", async ({ page }) => {
  await page.goto("/?preview=sync-success");
  await page.getByRole("button", { name: "Configuracion" }).click();

  const panel = page.locator(".ks-modal__panel");
  await expect(panel).toBeVisible();
  const decoration = await panel.evaluate((element) => ({
    panelPosition: getComputedStyle(element).position,
    pointerEvents: getComputedStyle(element, "::before").pointerEvents,
  }));

  expect(decoration.panelPosition).toBe("relative");
  expect(decoration.pointerEvents).toBe("none");
});

test("Poison does not force thin scrollbar geometry on modal content", async ({ page }) => {
  await page.goto("/?preview=sync-success");
  await page.getByRole("button", { name: "Configuracion" }).click();

  const content = page.locator(".ks-modal__content");
  await expect(content).toBeVisible();
  await expect(content).toHaveCSS("scrollbar-width", "auto");
});

test("Poison keeps the danger exit border red on hover and keyboard focus", async ({ page }) => {
  await page.goto("/?preview=sync-success");
  await page.getByRole("button", { name: "Cerrar" }).click();

  const exit = page.locator(".ks-choice-modal__exit");
  await expect(exit).toBeVisible();
  await exit.hover();
  await expect(exit).toHaveCSS("border-color", "rgba(255, 91, 108, 0.56)");

  await page.mouse.move(0, 0);
  await expect(page.locator(".ks-choice-modal__actions button").first()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(exit).toBeFocused();
  await expect(exit).toHaveCSS("border-color", "rgba(255, 91, 108, 0.56)");
});

test("Poison reduced motion disables ambient and syncing animation while preserving selected state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?preview=sync-syncing");

  const selectedTab = page.locator('[data-ui="shell-tab"][data-state="selected"]');
  const syncingIcon = page.locator('.sync-current-panel[data-sync-state="syncing"] .sync-current-panel__body > img');
  await expect(selectedTab).toBeVisible();
  await expect(syncingIcon).toBeVisible();

  const motion = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>(".shell")!;
    const selected = document.querySelector<HTMLElement>('[data-ui="shell-tab"][data-state="selected"]')!;
    const syncing = document.querySelector<HTMLElement>('.sync-current-panel[data-sync-state="syncing"] .sync-current-panel__body > img')!;
    return {
      selectedGlowContent: getComputedStyle(selected, "::after").content,
      shellAnimation: getComputedStyle(shell, "::after").animationName,
      syncingAnimation: getComputedStyle(syncing).animationName,
    };
  });

  expect(motion.shellAnimation).toBe("none");
  expect(motion.syncingAnimation).toBe("none");
  expect(motion.selectedGlowContent).toBe('""');
});
