import { expect, test, type Page } from "@playwright/test";

async function openAddon(page: Page, preview: string, theme: "keystone" | "poison" = "poison") {
  await page.addInitScript((selectedTheme) => localStorage.setItem("keystone-client.theme", selectedTheme), theme);
  await page.goto(`/?preview=${preview}`);
  await page.getByRole("button", { name: "Addon" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await page.waitForFunction(() =>
    Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
  );
}

test("Poison Addon chrome uses registered assets as non-interactive decoration", async ({ page }) => {
  await openAddon(page, "addon-current");

  const frames = {
    "addon-main-frame": /addon-main-panel-frame(?:-[^/]+)?\.png/,
    "addon-path-card-frame": /addon-path-card-frame(?:-[^/]+)?\.png/,
    "addon-path-field-frame": /addon-path-field-frame(?:-[^/]+)?\.png/,
    "addon-status-frame": /addon-status-panel-frame(?:-[^/]+)?\.png/,
  } as const;

  for (const [role, source] of Object.entries(frames)) {
    const frame = page.locator(`[data-asset-role="${role}"]`);
    await expect(frame).toBeVisible();
    const styles = await frame.evaluate((element) => {
      const computed = getComputedStyle(element);
      return { borderImageSource: computed.borderImageSource, pointerEvents: computed.pointerEvents };
    });
    expect(styles.borderImageSource).toMatch(source);
    expect(styles.pointerEvents).toBe("none");
  }

  const divider = page.locator('[data-asset-role="addon-divider"]');
  const dividerImage = divider.locator("img");
  await expect(divider).toBeVisible();
  await expect(dividerImage).toHaveAttribute("src", /addon-vertical-divider(?:-[^/]+)?\.png$/);
  expect(await dividerImage.evaluate((image: HTMLImageElement) => [image.naturalWidth, image.naturalHeight])).toEqual([724, 2172]);

  for (const selector of [".addon-screen", ".addon-path-card", ".addon-path-field", ".addon-status-card"]) {
    const treatment = await page.locator(selector).evaluate((element) => {
      const styles = getComputedStyle(element);
      return { backgroundImage: styles.backgroundImage, boxShadow: styles.boxShadow };
    });
    expect(treatment.backgroundImage).toBe("none");
    expect(treatment.boxShadow).toBe("none");
  }
});

test("Poison title, folder row, divider, and status use corrected semantic geometry", async ({ page }) => {
  await openAddon(page, "addon-installed");

  const geometry = await page.evaluate(() => {
    const rect = (element: Element) => {
      const value = element.getBoundingClientRect();
      return { x: value.x, y: value.y, left: value.left, top: value.top, width: value.width, height: value.height, right: value.right, bottom: value.bottom };
    };
    const main = rect(document.querySelector(".addon-screen__main")!);
    const icon = rect(document.querySelector(".addon-heading__icon")!);
    const text = rect(document.querySelector(".addon-heading > div")!);
    const card = rect(document.querySelector(".addon-path-card")!);
    const field = rect(document.querySelector(".addon-path-field")!);
    const select = rect(document.querySelector('.addon-folder-actions button:nth-child(1)')!);
    const open = rect(document.querySelector('.addon-folder-actions button:nth-child(2)')!);
    const selectArt = rect(document.querySelector('.addon-folder-actions button:nth-child(1) .addon-action__artwork')!);
    const openArt = rect(document.querySelector('.addon-folder-actions button:nth-child(2) .addon-action__artwork')!);
    const divider = rect(document.querySelector(".addon-screen__divider")!);
    const status = rect(document.querySelector(".addon-status-card")!);
    const rows = Array.from(document.querySelectorAll(".addon-status-row"), rect);
    const statusIcon = getComputedStyle(document.querySelector(".addon-status-heading > svg")!).color;
    return { card, divider, field, icon, main, open, openArt, rows, select, selectArt, status, statusIcon, text };
  });

  expect(geometry.icon.left).toBeGreaterThanOrEqual(geometry.main.left + 40);
  expect(geometry.icon.top).toBeGreaterThanOrEqual(geometry.main.top + 22);
  expect(geometry.text.left).toBeGreaterThan(geometry.icon.right + 10);
  expect(Math.abs((geometry.icon.top + geometry.icon.height / 2) - (geometry.text.top + geometry.text.height / 2))).toBeLessThanOrEqual(2);

  expect(geometry.field.height).toBeGreaterThanOrEqual(46);
  expect(geometry.field.height).toBeLessThanOrEqual(54);
  expect(Math.abs(geometry.select.width - geometry.open.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.select.height - geometry.open.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.select.y - geometry.open.y)).toBeLessThanOrEqual(1);
  for (const artwork of [geometry.selectArt, geometry.openArt]) {
    expect(artwork.left).toBeGreaterThanOrEqual(geometry.card.left + 16);
    expect(artwork.right).toBeLessThanOrEqual(geometry.card.right - 16);
    expect(artwork.bottom).toBeLessThanOrEqual(geometry.card.bottom - 16);
  }

  expect(geometry.divider.width).toBeLessThanOrEqual(30);
  expect(Math.abs(geometry.divider.x + geometry.divider.width / 2 - (geometry.main.right + geometry.status.left) / 2)).toBeLessThanOrEqual(2);
  for (const row of geometry.rows) {
    expect(row.left).toBeGreaterThanOrEqual(geometry.status.left + 40);
    expect(row.right).toBeLessThanOrEqual(geometry.status.right - 40);
  }
  expect(geometry.statusIcon).toBe("rgb(186, 255, 82)");
});

test("Poison long Install and Reinstall actions share one centered structural position", async ({ browser }) => {
  const centers: number[] = [];
  for (const [preview, role] of [
    ["addon-not-installed", "addon-action-install-frame"],
    ["addon-current", "addon-action-reinstall-long-frame"],
  ] as const) {
    const page = await browser.newPage();
    await openAddon(page, preview);
    const geometry = await page.evaluate((actionRole) => {
      const rect = (element: Element) => {
        const value = element.getBoundingClientRect();
        return { x: value.x, y: value.y, left: value.left, top: value.top, width: value.width, height: value.height, right: value.right, bottom: value.bottom };
      };
      const main = rect(document.querySelector(".addon-heading")!);
      const action = rect(document.querySelector(`[data-addon-action-role="${actionRole}"]`)!);
      const label = rect(document.querySelector(`[data-addon-action-role="${actionRole}"] .addon-action__label`)!);
      return {
        action,
        horizontalLabelDelta: label.left + label.width / 2 - (action.left + action.width / 2),
        structuralCenter: main.left + main.width / 2,
        verticalLabelDelta: label.top + label.height / 2 - (action.top + action.height / 2),
      };
    }, role);
    expect(geometry.action.width).toBeGreaterThanOrEqual(600);
    expect(geometry.action.width).toBeLessThanOrEqual(680);
    expect(geometry.action.height).toBeGreaterThanOrEqual(105);
    expect(geometry.action.height).toBeLessThanOrEqual(120);
    expect(Math.abs(geometry.action.x + geometry.action.width / 2 - geometry.structuralCenter)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.horizontalLabelDelta)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.verticalLabelDelta)).toBeLessThanOrEqual(1);
    centers.push(geometry.action.x + geometry.action.width / 2);
    await page.close();
  }
  expect(Math.abs(centers[0] - centers[1])).toBeLessThanOrEqual(1);
});

test("Poison Update and Reinstall-short form a balanced two-column primary row", async ({ page }) => {
  await openAddon(page, "addon-installed");
  const geometry = await page.evaluate(() => {
    const rect = (element: Element) => {
      const value = element.getBoundingClientRect();
      return { x: value.x, y: value.y, left: value.left, top: value.top, width: value.width, height: value.height, right: value.right, bottom: value.bottom };
    };
    const main = rect(document.querySelector(".addon-screen__main")!);
    const row = rect(document.querySelector(".addon-primary-actions")!);
    const update = rect(document.querySelector('[data-addon-action-role="addon-action-update-frame"]')!);
    const reinstall = rect(document.querySelector('[data-addon-action-role="addon-action-reinstall-short-frame"]')!);
    const updateArtwork = rect(document.querySelector('[data-addon-action-role="addon-action-update-frame"] .addon-action__artwork')!);
    const reinstallArtwork = rect(document.querySelector('[data-addon-action-role="addon-action-reinstall-short-frame"] .addon-action__artwork')!);
    const updateLabel = rect(document.querySelector('[data-addon-action-role="addon-action-update-frame"] .addon-action__label')!);
    const reinstallLabel = rect(document.querySelector('[data-addon-action-role="addon-action-reinstall-short-frame"] .addon-action__label')!);
    const center = (box: ReturnType<typeof rect>) => box.left + box.width / 2;
    return {
      artworkDeltas: [center(updateArtwork) - center(update), center(reinstallArtwork) - center(reinstall)],
      gap: reinstall.left - update.right,
      labelDeltas: [center(updateLabel) - center(update), center(reinstallLabel) - center(reinstall)],
      mainCenter: center(main),
      reinstall,
      rowCenter: center(row),
      update,
    };
  });

  expect(Math.abs(geometry.update.width - geometry.reinstall.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.update.height - geometry.reinstall.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.update.y - geometry.reinstall.y)).toBeLessThanOrEqual(1);
  expect(geometry.update.width).toBeGreaterThanOrEqual(410);
  expect(geometry.update.width).toBeLessThanOrEqual(430);
  expect(geometry.gap).toBeGreaterThanOrEqual(24);
  expect(geometry.gap).toBeLessThanOrEqual(32);
  expect(Math.abs(geometry.rowCenter - geometry.mainCenter)).toBeLessThanOrEqual(1);
  for (const delta of [...geometry.artworkDeltas, ...geometry.labelDeltas]) {
    expect(Math.abs(delta)).toBeLessThanOrEqual(1);
  }
});

test("Poison centers the path card in the main frame and nearly fills the status action width", async ({ page }) => {
  await openAddon(page, "addon-installed");
  const geometry = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>(".addon-screen__main")!.getBoundingClientRect();
    const path = document.querySelector<HTMLElement>(".addon-path-card")!.getBoundingClientRect();
    const check = document.querySelector<HTMLElement>(".addon-check-action")!.getBoundingClientRect();
    const artwork = document.querySelector<HTMLElement>(".addon-check-action .addon-action__artwork")!.getBoundingClientRect();
    const center = (box: DOMRect) => box.left + box.width / 2;
    return {
      checkArtworkRatio: artwork.width / check.width,
      pathCenterDelta: center(path) - center(main),
    };
  });

  expect(Math.abs(geometry.pathCenterDelta)).toBeLessThanOrEqual(1);
  expect(geometry.checkArtworkRatio).toBeGreaterThanOrEqual(0.985);
  expect(geometry.checkArtworkRatio).toBeLessThan(1);
});

test("Poison Addon labels fill and center within each artwork text area", async ({ page }) => {
  await openAddon(page, "addon-installed");
  const metrics = await page.evaluate(() => {
    const measure = (label: string) => {
      const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
        .find((element) => element.textContent?.trim() === label)!;
      const text = button.querySelector<HTMLElement>(".addon-action__label")!;
      const buttonBox = button.getBoundingClientRect();
      const textBox = text.getBoundingClientRect();
      const styles = getComputedStyle(button);
      const contentLeft = buttonBox.left + Number.parseFloat(styles.paddingLeft);
      const contentRight = buttonBox.right - Number.parseFloat(styles.paddingRight);
      return {
        fontSize: Number.parseFloat(styles.fontSize),
        horizontalCenterDelta: textBox.left + textBox.width / 2 - (contentLeft + contentRight) / 2,
        verticalCenterDelta: textBox.top + textBox.height / 2 - (buttonBox.top + buttonBox.height / 2),
        fits: textBox.width <= contentRight - contentLeft && textBox.height <= buttonBox.height,
      };
    };
    return {
      update: measure("Actualizar KeystoneSync"),
      reinstall: measure("Reinstalar KeystoneSync"),
      select: measure("Seleccionar carpeta de AddOns"),
      open: measure("Abrir carpeta del addon"),
      check: measure("Buscar actualizaciones"),
    };
  });

  for (const metric of Object.values(metrics)) {
    expect(metric.fits).toBe(true);
    expect(Math.abs(metric.horizontalCenterDelta)).toBeLessThanOrEqual(1);
    expect(Math.abs(metric.verticalCenterDelta)).toBeLessThanOrEqual(1);
  }
  expect(metrics.update.fontSize).toBeGreaterThanOrEqual(18);
  expect(metrics.reinstall.fontSize).toBe(metrics.update.fontSize);
  expect(metrics.select.fontSize).toBeGreaterThanOrEqual(16);
  expect(metrics.open.fontSize).toBe(metrics.select.fontSize);
  expect(metrics.check.fontSize).toBeGreaterThanOrEqual(15);
});

test("Poison Addon title and status content respect centered frame safe areas", async ({ page }) => {
  await openAddon(page, "addon-current");
  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
    const main = rect(".addon-screen__main");
    const icon = rect(".addon-heading__icon");
    const headingText = rect(".addon-heading > div");
    const description = rect(".addon-description");
    const status = rect(".addon-status-card");
    const statusHeading = rect(".addon-status-heading");
    const statusAction = rect(".addon-check-action");
    const pathFrameFilter = getComputedStyle(document.querySelector(".addon-path-field__frame")!).filter;
    return {
      descriptionLeft: description.left,
      headingTextLeft: headingText.left,
      iconSize: icon.width,
      mainLeftInset: icon.left - main.left,
      mainTopInset: icon.top - main.top,
      pathFrameFilter,
      statusBottomInset: status.bottom - statusAction.bottom,
      statusHeadingLeftInset: statusHeading.left - status.left,
      statusHeadingRightInset: status.right - statusHeading.right,
      statusTopInset: statusHeading.top - status.top,
    };
  });

  expect(geometry.iconSize).toBeGreaterThanOrEqual(92);
  expect(geometry.mainLeftInset).toBeGreaterThanOrEqual(56);
  expect(geometry.mainTopInset).toBeGreaterThanOrEqual(34);
  expect(Math.abs(geometry.descriptionLeft - geometry.headingTextLeft)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.statusHeadingLeftInset - geometry.statusHeadingRightInset)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.statusTopInset - geometry.statusBottomInset)).toBeLessThanOrEqual(18);
  expect(geometry.pathFrameFilter).toContain("brightness(1.45)");
});

test("Poison centers requested labels on the whole button and gives panels readable translucency", async ({ page }) => {
  await openAddon(page, "addon-current");
  const result = await page.evaluate(() => {
    const centerDelta = (label: string) => {
      const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
        .find((element) => element.textContent?.trim() === label)!;
      const text = button.querySelector<HTMLElement>(".addon-action__label")!;
      const buttonBox = button.getBoundingClientRect();
      const textBox = text.getBoundingClientRect();
      return textBox.left + textBox.width / 2 - (buttonBox.left + buttonBox.width / 2);
    };
    const alpha = (selector: string) => Number.parseFloat(
      getComputedStyle(document.querySelector<HTMLElement>(selector)!).backgroundColor.match(/[\d.]+(?=\))/)?.[0] ?? "1",
    );
    const check = document.querySelector<HTMLElement>(".addon-check-action")!.getBoundingClientRect();
    const checkArtwork = document.querySelector<HTMLElement>(".addon-check-action .addon-action__artwork")!.getBoundingClientRect();
    return {
      checkArtworkRatio: checkArtwork.width / check.width,
      labelDeltas: {
        select: centerDelta("Seleccionar carpeta de AddOns"),
        open: centerDelta("Abrir carpeta del addon"),
        reinstallLong: centerDelta("Reinstalar KeystoneSync"),
      },
      panelAlphas: {
        main: alpha(".addon-screen__main"),
        path: alpha(".addon-path-card"),
        status: alpha(".addon-status-card"),
      },
    };
  });

  for (const delta of Object.values(result.labelDeltas)) {
    expect(Math.abs(delta)).toBeLessThanOrEqual(1);
  }
  expect(result.checkArtworkRatio).toBeGreaterThanOrEqual(0.95);
  for (const alpha of Object.values(result.panelAlphas)) {
    expect(alpha).toBeGreaterThan(0.2);
    expect(alpha).toBeLessThan(0.65);
  }
});

for (const state of [
  { preview: "addon-not-installed", actions: [["Instalar KeystoneSync", "addon-action-install-frame"]] },
  { preview: "addon-current", actions: [["Reinstalar KeystoneSync", "addon-action-reinstall-long-frame"]] },
  {
    preview: "addon-installed",
    actions: [
      ["Actualizar KeystoneSync", "addon-action-update-frame"],
      ["Reinstalar KeystoneSync", "addon-action-reinstall-short-frame"],
    ],
  },
] as const) {
  test(`Poison maps integrated artwork for ${state.preview}`, async ({ page }) => {
    await openAddon(page, state.preview);
    for (const [label, role] of [
      ...state.actions,
      ["Seleccionar carpeta de AddOns", "addon-action-select-folder-frame"],
      ["Abrir carpeta del addon", "addon-action-open-folder-frame"],
      ["Buscar actualizaciones", "addon-action-check-frame"],
    ] as const) {
      const button = page.getByRole("button", { name: label });
      await expect(button.locator(`[data-asset-role="${role}"]`)).toBeVisible();
      await expect(button.locator(".theme-icon")).toHaveCount(0);
    }
  });
}

test("Keystone Addon controls retain runtime icons and do not render Poison chrome", async ({ page }) => {
  await openAddon(page, "addon-installed", "keystone");
  await expect(page.locator('[data-asset-role^="addon-"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Actualizar KeystoneSync" }).locator(".theme-icon")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reinstalar KeystoneSync" }).locator(".theme-icon")).toBeVisible();
});
