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

test("Poison does not draw a legacy inset rectangle inside the client edge", async ({ page }) => {
  await page.goto("/?preview=sync-success");

  const insetFrame = await page.locator(".ks-app-frame").evaluate((element) => {
    const styles = getComputedStyle(element, "::before");
    return { content: styles.content };
  });

  expect(insetFrame.content).toBe("none");
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

test("Poison tabs use only a soft edgeless glow for selected and hover states", async ({ page }) => {
  await page.goto("/?preview=sync-success");

  const selected = page.locator('[data-ui="shell-tab"][data-state="selected"]');
  const idle = page.getByRole("button", { name: "Addon" });

  const readTreatment = (element: HTMLElement) => {
    const styles = getComputedStyle(element);
    const glow = getComputedStyle(element, "::before");
    return {
      backgroundImage: styles.backgroundImage,
      borderColor: styles.borderColor,
      boxShadow: styles.boxShadow,
      glowBackground: glow.backgroundImage,
      glowBoxShadow: glow.boxShadow,
      glowFilter: glow.filter,
      outlineStyle: styles.outlineStyle,
    };
  };

  const selectedTreatment = await selected.evaluate(readTreatment);
  await idle.hover();
  const hoverTreatment = await idle.evaluate(readTreatment);
  await page.mouse.move(1600, 800);
  await idle.focus();
  const focusTreatment = await idle.evaluate(readTreatment);

  for (const treatment of [selectedTreatment, hoverTreatment, focusTreatment]) {
    expect(treatment.backgroundImage).toBe("none");
    expect(treatment.borderColor).toBe("rgba(0, 0, 0, 0)");
    expect(treatment.boxShadow).toBe("none");
    expect(treatment.glowBackground).toContain("radial-gradient");
    expect(treatment.glowBoxShadow).toBe("none");
    expect(treatment.glowFilter).toContain("blur(");
    expect(treatment.outlineStyle).toBe("none");
  }
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

test("Poison reserves inner table safe areas above the header and below scrolled rows", async ({ page }) => {
  await page.goto("/?preview=sync-success");
  await expect(page.locator(".sync-table__row").last()).toBeVisible();

  const geometry = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>(".sync-table-panel")!;
    const table = panel.querySelector<HTMLElement>(".sync-table")!;
    const header = panel.querySelector<HTMLElement>(".sync-table__header")!;
    const body = panel.querySelector<HTMLElement>(".sync-table__body")!;
    body.scrollTop = body.scrollHeight;
    const lastRow = body.querySelector<HTMLElement>(".sync-table__row:last-child")!;
    const panelBox = panel.getBoundingClientRect();
    const tableBox = table.getBoundingClientRect();
    const headerBox = header.getBoundingClientRect();
    const lastRowBox = lastRow.getBoundingClientRect();
    return {
      bottomInset: panelBox.bottom - tableBox.bottom,
      headerTopInset: headerBox.top - panelBox.top,
      lastRowBottomClearance: tableBox.bottom - lastRowBox.bottom,
    };
  });

  expect(geometry.bottomInset).toBeGreaterThanOrEqual(38);
  expect(geometry.headerTopInset).toBeGreaterThanOrEqual(32);
  expect(geometry.lastRowBottomClearance).toBeGreaterThanOrEqual(12);
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

test("Poison centers the profile name horizontally and optically raises it in its panel", async ({ page }) => {
  await page.goto("/?preview=sync-success");

  const deltas = await page.locator(".ks-user-menu__name").evaluate((element) => {
    const box = element.getBoundingClientRect();
    const trigger = element.closest(".ks-user-menu__trigger")!.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(element);
    const text = range.getBoundingClientRect();
    return {
      horizontal: text.left + text.width / 2 - (box.left + box.width / 2),
      vertical: text.top + text.height / 2 - (trigger.top + trigger.height / 2),
    };
  });

  expect(Math.abs(deltas.horizontal)).toBeLessThanOrEqual(1);
  expect(deltas.vertical).toBeGreaterThanOrEqual(-3.5);
  expect(deltas.vertical).toBeLessThanOrEqual(-1.5);
});

test("Poison keeps Settings, Minimize, and Close compact and optically identical", async ({ page }) => {
  await page.goto("/?preview=sync-success");
  await expect(page.locator(".ks-settings-control")).toBeVisible();

  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
    return {
      close: rect(".ks-window-button--close img"),
      closeHitbox: rect(".ks-window-button--close"),
      minimize: rect(".ks-window-button--minimize img"),
      minimizeHitbox: rect(".ks-window-button--minimize"),
      profileHitbox: rect(".ks-user-menu__trigger"),
      settings: rect(".ks-settings-control img"),
      settingsHitbox: rect(".ks-settings-control"),
    };
  });

  const controlWidths = [geometry.settings.width, geometry.minimize.width, geometry.close.width];
  const controlHeights = [geometry.settings.height, geometry.minimize.height, geometry.close.height];
  expect(Math.max(...controlWidths) - Math.min(...controlWidths)).toBeLessThanOrEqual(0.01);
  expect(Math.max(...controlHeights) - Math.min(...controlHeights)).toBeLessThanOrEqual(0.01);
  expect(Math.max(...controlWidths)).toBeLessThanOrEqual(80);
  expect(Math.max(...controlHeights)).toBeLessThanOrEqual(80);
  expect([geometry.profileHitbox.width, geometry.profileHitbox.height]).toEqual([246, 56]);
  expect([geometry.settingsHitbox.width, geometry.settingsHitbox.height]).toEqual([58, 56]);
  expect([geometry.minimizeHitbox.width, geometry.minimizeHitbox.height]).toEqual([61, 56]);
  expect([geometry.closeHitbox.width, geometry.closeHitbox.height]).toEqual([61, 56]);
});

test("Poison clips a real avatar fixture beneath the profile rim", async ({ page }) => {
  await page.goto("/?preview=sync-success");
  const avatarSource = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' fill='%23132746'/%3E%3Ccircle cx='48' cy='36' r='20' fill='%23d6a86e'/%3E%3Cpath d='M13 96c4-27 18-39 35-39s31 12 35 39' fill='%234a7b3f'/%3E%3Cpath d='M28 34c1-18 11-25 21-25 15 0 22 13 20 29-8-4-13-12-17-19-5 9-12 14-24 15' fill='%23251c18'/%3E%3C/svg%3E";
  await page.locator(".ks-user-menu__avatar").evaluate((container, source) => {
    const image = document.createElement("img");
    image.alt = "";
    image.className = "ks-user-menu__avatar-image";
    image.src = source;
    container.prepend(image);
  }, avatarSource);

  const avatar = page.locator(".ks-user-menu__avatar-image");
  await expect(avatar).toBeVisible();
  await expect.poll(() => avatar.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  const composition = await page.locator(".ks-user-menu__trigger").evaluate((element) => {
    const container = element.querySelector<HTMLElement>(".ks-user-menu__avatar")!;
    const image = element.querySelector<HTMLElement>(".ks-user-menu__avatar-image")!;
    const frame = element.querySelector<HTMLElement>(".ks-user-menu__shell")!;
    const containerBox = container.getBoundingClientRect();
    const imageBox = image.getBoundingClientRect();
    return {
      clippedInsideHole:
        imageBox.left >= containerBox.left && imageBox.right <= containerBox.right &&
        imageBox.top >= containerBox.top && imageBox.bottom <= containerBox.bottom,
      frameAboveAvatar: Number(getComputedStyle(frame).zIndex) > Number(getComputedStyle(container).zIndex),
      objectFit: getComputedStyle(image).objectFit,
      radius: getComputedStyle(image).borderRadius,
    };
  });

  expect(composition.objectFit).toBe("cover");
  expect(composition.radius).toBe("50%");
  expect(composition.frameAboveAvatar).toBe(true);
  expect(composition.clippedInsideHole).toBe(true);
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

test("Poison keeps status titles and table headers subordinate to their artwork", async ({ page }) => {
  for (const preview of ["sync-success", "sync-syncing", "sync-error", "sync-idle", "sync-watching"]) {
    await page.goto(`/?preview=${preview}`);
    const title = page.locator(".sync-current-panel strong");
    await expect(title).toBeVisible();
    expect(Number.parseFloat(await title.evaluate((element) => getComputedStyle(element).fontSize)), preview).toBeLessThanOrEqual(16);
  }

  const tableHeadingSize = await page.locator(".sync-table__header").evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );
  expect(tableHeadingSize).toBeLessThanOrEqual(18);
});

test("Poison gives the wider Addon artwork its own optical safe area", async ({ page }) => {
  await page.goto("/?preview=sync-success");
  const addonCard = page.locator('.sync-summary-card:has([data-asset-role="sync-summary-addon-frame"])');
  const sharedCard = page.locator(".sync-summary-card").nth(1);
  const insets = await Promise.all([addonCard, sharedCard].map((card) => card.evaluate((element) => {
    const style = getComputedStyle(element);
    return { bottom: Number.parseFloat(style.paddingBottom), top: Number.parseFloat(style.paddingTop) };
  })));

  expect(insets[0].top).toBeGreaterThan(insets[1].top);
  expect(insets[0].top + insets[0].bottom).toBe(insets[1].top + insets[1].bottom);
});

test("Poison preserves a distinct primary and footer brightness hierarchy", async ({ page }) => {
  await page.goto("/?preview=sync-success");
  const primary = page.locator(".sync-primary-action");
  const footer = page.locator(".ks-footer-action--web");
  const brightness = async (control: typeof primary) => Number.parseFloat(
    await control.evaluate((element) => getComputedStyle(element).getPropertyValue("--poison-artwork-brightness")),
  );

  const primaryNormal = await brightness(primary);
  const footerNormal = await brightness(footer);
  await primary.hover();
  const primaryHover = await brightness(primary);
  await footer.hover();
  const footerHover = await brightness(footer.locator("img"));

  expect(primaryNormal).toBeGreaterThan(footerNormal);
  expect(primaryNormal).toBeLessThanOrEqual(0.89);
  expect(footerNormal).toBeLessThanOrEqual(0.82);
  expect(primaryHover).toBeGreaterThan(primaryNormal);
  expect(primaryHover).toBeGreaterThan(footerHover);
  expect(footerHover).toBeGreaterThan(footerNormal);
});

test("Poison slightly reduces the version number weight without flattening hierarchy", async ({ page }) => {
  await page.goto("/?preview=sync-success");
  const sizes = await page.locator(".sync-version-panel").evaluate((element) => ({
    title: Number.parseFloat(getComputedStyle(element.querySelector("p")!).fontSize),
    version: Number.parseFloat(getComputedStyle(element.querySelector("strong")!).fontSize),
  }));

  expect(sizes.version).toBeLessThanOrEqual(26);
  expect(sizes.version).toBeGreaterThan(sizes.title);
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

test("Poison global actions use undistorted artwork with integrated icons and per-asset label safe areas", async ({ page }) => {
  await page.goto("/?preview=sync-success");
  await expect(page.locator(".sync-primary-action")).toBeVisible();
  await expect(page.locator(".ks-footer-action--web")).toBeVisible();
  await expect(page.locator(".ks-footer-action--tray")).toBeVisible();
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll<HTMLImageElement>(
      ".sync-primary-action__frame, .ks-footer-action__asset",
    )).every((image) => image.complete && image.naturalWidth > 0),
  );

  const controls = await page.evaluate(() => {
    const definitions = [
      ["sync", ".sync-primary-action", ".sync-primary-action__frame", "--poison-sync-button-content-left", "--poison-sync-button-content-right"],
      ["web", ".ks-footer-action--web", ".ks-footer-action__asset", "--poison-web-button-content-left", "--poison-web-button-content-right"],
      ["tray", ".ks-footer-action--tray", ".ks-footer-action__asset", "--poison-tray-button-content-left", "--poison-tray-button-content-right"],
    ] as const;

    return Object.fromEntries(definitions.map(([name, controlSelector, artworkSelector, leftProperty, rightProperty]) => {
      const control = document.querySelector<HTMLElement>(controlSelector)!;
      const artwork = control.querySelector<HTMLImageElement>(artworkSelector)!;
      const controlStyle = getComputedStyle(control);
      const controlBox = control.getBoundingClientRect();
      const artworkBox = artwork.getBoundingClientRect();
      return [name, {
        artworkHeight: artworkBox.height,
        artworkWidth: artworkBox.width,
        backgroundColor: controlStyle.backgroundColor,
        backgroundImage: controlStyle.backgroundImage,
        boxShadow: controlStyle.boxShadow,
        controlHeight: controlBox.height,
        controlWidth: controlBox.width,
        hasRuntimeSvg: control.querySelector("svg") !== null,
        leftSafeArea: controlStyle.getPropertyValue(leftProperty).trim(),
        naturalHeight: artwork.naturalHeight,
        naturalWidth: artwork.naturalWidth,
        pointerEvents: getComputedStyle(artwork).pointerEvents,
        rightSafeArea: controlStyle.getPropertyValue(rightProperty).trim(),
      }];
    }));
  });

  expect(controls.sync).toMatchObject({
    leftSafeArea: "34%",
    naturalWidth: 1983,
    naturalHeight: 793,
    rightSafeArea: "8%",
  });
  expect(controls.web).toMatchObject({
    leftSafeArea: "78px",
    naturalWidth: 1983,
    naturalHeight: 793,
    rightSafeArea: "28px",
  });
  expect(controls.tray).toMatchObject({
    leftSafeArea: "74px",
    naturalWidth: 1983,
    naturalHeight: 793,
    rightSafeArea: "25px",
  });

  for (const [name, control] of Object.entries(controls)) {
    expect(control.hasRuntimeSvg, `${name} duplicate icon`).toBe(false);
    expect(control.pointerEvents, `${name} decorative pointer events`).toBe("none");
    expect(control.backgroundColor, `${name} background color`).toBe("rgba(0, 0, 0, 0)");
    expect(control.backgroundImage, `${name} background image`).toBe("none");
    expect(control.boxShadow, `${name} box shadow`).toBe("none");
    expect(control.leftSafeArea, `${name} left safe area`).not.toBe("");
    expect(control.rightSafeArea, `${name} right safe area`).not.toBe("");
    expect(control.artworkWidth, `${name} artwork width`).toBeGreaterThanOrEqual(control.controlWidth);
    expect(control.artworkWidth, `${name} artwork width`).toBeLessThanOrEqual(control.controlWidth * 1.05);
    expect(control.artworkWidth / control.artworkHeight, `${name} aspect ratio`).toBeCloseTo(
      control.naturalWidth / control.naturalHeight,
      2,
    );
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
