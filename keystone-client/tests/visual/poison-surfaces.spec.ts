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

test("Poison keeps framed surfaces transparent outside their artwork", async ({ page }) => {
  await page.goto("/?preview=sync-success");

  const surfaces = await page.locator(
    ".sync-summary-card, .sync-table-panel, .sync-version-panel, .sync-current-panel, .sync-emblem-panel",
  ).evaluateAll((elements) => elements.map((element) => {
    const styles = getComputedStyle(element);
    return {
      backgroundColor: styles.backgroundColor,
      backgroundImage: styles.backgroundImage,
      borderStyle: styles.borderStyle,
      boxShadow: styles.boxShadow,
    };
  }));

  for (const surface of surfaces) {
    expect(surface.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(surface.backgroundImage).toBe("none");
    expect(surface.borderStyle).toBe("none");
    expect(surface.boxShadow).toBe("none");
  }
});

test("Poison layers active tab artwork above its glow and below its label", async ({ page }) => {
  await page.goto("/?preview=sync-success");

  const selected = page.locator('[data-ui="shell-tab"][data-state="selected"]');
  await expect(selected.locator(".ks-tab__label")).toBeVisible();
  const layers = await selected.evaluate((element) => {
    const decoration = element.querySelector<HTMLElement>(".ks-tab__decoration--active")!;
    const label = element.querySelector<HTMLElement>(".ks-tab__label")!;
    return {
      decorationFilter: getComputedStyle(decoration).filter,
      decorationOpacity: getComputedStyle(decoration).opacity,
      decorationZ: Number(getComputedStyle(decoration).zIndex),
      glowZ: Number(getComputedStyle(element, "::before").zIndex),
      labelZ: Number(getComputedStyle(label).zIndex),
    };
  });

  expect(layers.glowZ).toBe(0);
  expect(layers.decorationZ).toBe(1);
  expect(layers.labelZ).toBe(2);
  expect(layers.decorationOpacity).toBe("1");
  expect(layers.decorationFilter).not.toContain("sepia");
});

test("Poison keeps the stationary table frame above a real scrolling viewport", async ({ page }) => {
  await page.goto("/?preview=sync-success");
  await expect(page.locator(".sync-table-panel")).toBeVisible();
  await expect(page.locator(".sync-table__body")).toBeVisible();

  const result = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>(".sync-table-panel")!;
    const table = panel.querySelector<HTMLElement>(".sync-table")!;
    const body = panel.querySelector<HTMLElement>(".sync-table__body")!;
    const frame = panel.querySelector<HTMLElement>(".sync-table-panel__frame")!;
    const before = body.scrollTop;
    body.scrollTop = body.scrollHeight;
    return {
      bodyOverflowY: getComputedStyle(body).overflowY,
      frameInsideBody: body.contains(frame),
      framePointerEvents: getComputedStyle(frame).pointerEvents,
      frameZ: Number(getComputedStyle(frame).zIndex),
      outerOverflow: getComputedStyle(panel).overflow,
      scrolled: body.scrollTop > before,
      tableZ: Number(getComputedStyle(table).zIndex),
    };
  });

  expect(result.frameInsideBody).toBe(false);
  expect(result.framePointerEvents).toBe("none");
  expect(result.outerOverflow).toBe("hidden");
  expect(result.bodyOverflowY).toBe("auto");
  expect(result.scrolled).toBe(true);
  expect(result.frameZ).toBeGreaterThan(result.tableZ);
});

test("Poison keeps profile artwork above the real avatar and below its text", async ({ page }) => {
  await page.goto("/?preview=sync-success");

  const layers = await page.locator(".ks-user-menu__trigger").evaluate((element) => {
    const avatar = element.querySelector<HTMLElement>(".ks-user-menu__avatar")!;
    const frame = element.querySelector<HTMLElement>(".ks-user-menu__shell")!;
    const name = element.querySelector<HTMLElement>(".ks-user-menu__name")!;
    return {
      avatarZ: Number(getComputedStyle(avatar).zIndex),
      frameZ: Number(getComputedStyle(frame).zIndex),
      nameZ: Number(getComputedStyle(name).zIndex),
    };
  });

  expect(layers.frameZ).toBeGreaterThan(layers.avatarZ);
  expect(layers.nameZ).toBeGreaterThan(layers.frameZ);
});

test("Poison uses display typography for chrome and system typography for table data", async ({ page }) => {
  await page.goto("/?preview=sync-success");
  await expect(page.locator(".sync-primary-action")).toBeVisible();
  await expect(page.locator(".sync-summary-card p").first()).toBeVisible();
  await expect(page.locator(".ks-tab").first()).toBeVisible();
  await expect(page.locator(".sync-table__row").first()).toBeVisible();

  const typography = await page.evaluate(() => ({
    button: getComputedStyle(document.querySelector<HTMLElement>(".sync-primary-action")!).fontFamily,
    cardTitle: getComputedStyle(document.querySelector<HTMLElement>(".sync-summary-card p")!).fontFamily,
    navigation: getComputedStyle(document.querySelector<HTMLElement>(".ks-tab")!).fontFamily,
    tableData: getComputedStyle(document.querySelector<HTMLElement>(".sync-table__row")!).fontFamily,
  }));

  expect(typography.navigation).toContain("Georgia");
  expect(typography.button).toContain("Georgia");
  expect(typography.cardTitle).toContain("Georgia");
  expect(typography.tableData).toContain("Segoe UI");
});

test("Poison keeps footer action labels centered on one line", async ({ page }) => {
  await page.goto("/?preview=sync-success");

  for (const selector of [".ks-footer-action--web", ".ks-footer-action--tray"]) {
    const label = page.locator(`${selector} > span`);
    const layout = await label.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        textAlign: style.textAlign,
        whiteSpace: style.whiteSpace,
        fits: element.scrollWidth <= element.clientWidth,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      };
    });

    expect(layout.textAlign, selector).toBe("center");
    expect(layout.whiteSpace, selector).toBe("nowrap");
    expect(layout.fits, `${selector}: ${layout.scrollWidth}px text in ${layout.clientWidth}px safe area`).toBe(true);
  }
});

test("Poison hover illumination changes artwork without moving its hitbox", async ({ page }) => {
  await page.goto("/?preview=sync-success");

  for (const selector of [".sync-primary-action", ".ks-footer-action--web", ".ks-settings-control"]) {
    const control = page.locator(selector);
    const artwork = control.locator("img");
    const beforeBox = await control.boundingBox();
    const beforeFilter = await artwork.evaluate((element) => getComputedStyle(element).filter);
    await control.hover();
    const afterBox = await control.boundingBox();

    expect(afterBox, `${selector} hitbox`).toEqual(beforeBox);
    await expect.poll(
      () => artwork.evaluate((element) => getComputedStyle(element).filter),
      { message: `${selector} artwork filter` },
    ).not.toBe(beforeFilter);
  }
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
