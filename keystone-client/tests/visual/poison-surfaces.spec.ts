import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("keystone-client.theme", "poison"));
});

test("Poison gives the selected tab, ritual surfaces and sync action distinct visible treatment", async ({ page }) => {
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
    const selectedGlow = getComputedStyle(selected, "::after");
    const surfaceHaze = getComputedStyle(surface, "::before");
    const actionEdge = getComputedStyle(action, "::after");

    return {
      actionEdgeBackground: actionEdge.backgroundImage,
      actionEdgeContent: actionEdge.content,
      actionEdgePointerEvents: actionEdge.pointerEvents,
      selectedGlowBackground: selectedGlow.backgroundImage,
      selectedGlowContent: selectedGlow.content,
      selectedGlowPointerEvents: selectedGlow.pointerEvents,
      surfaceHazeBackground: surfaceHaze.backgroundImage,
      surfaceHazeContent: surfaceHaze.content,
      surfaceHazePointerEvents: surfaceHaze.pointerEvents,
    };
  });

  expect(treatment.selectedGlowContent).toBe('""');
  expect(treatment.selectedGlowBackground).toContain("linear-gradient");
  expect(treatment.selectedGlowPointerEvents).toBe("none");
  expect(treatment.surfaceHazeContent).toBe('""');
  expect(treatment.surfaceHazeBackground).toContain("radial-gradient");
  expect(treatment.surfaceHazePointerEvents).toBe("none");
  expect(treatment.actionEdgeContent).toBe('""');
  expect(treatment.actionEdgeBackground).toContain("linear-gradient");
  expect(treatment.actionEdgePointerEvents).toBe("none");
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

test("Poison reduced motion disables ambient and syncing animation while preserving selected state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?preview=sync-syncing");

  const selectedTab = page.locator('[data-ui="shell-tab"][data-state="selected"]');
  const syncingIcon = page.locator('.sync-current-panel[data-sync-state="syncing"] img');
  await expect(selectedTab).toBeVisible();
  await expect(syncingIcon).toBeVisible();

  const motion = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>(".shell")!;
    const selected = document.querySelector<HTMLElement>('[data-ui="shell-tab"][data-state="selected"]')!;
    const syncing = document.querySelector<HTMLElement>('.sync-current-panel[data-sync-state="syncing"] img')!;
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
