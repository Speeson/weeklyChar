import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("keystone-client.theme", "poison"));
});

test("Poison production artwork resolves through registry slots without changing layout geometry", async ({ page }) => {
  await page.goto("/?preview=sync-success");

  const shell = page.locator(".shell");
  const brand = page.locator(".ks-brand");
  const card = page.locator(".sync-summary-card").first();
  const emblem = page.locator(".sync-emblem-panel__artwork");
  await expect(shell).toBeVisible();
  await expect(card).toBeVisible();

  const result = await page.evaluate(() => {
    const root = document.documentElement;
    const shellElement = document.querySelector<HTMLElement>(".shell")!;
    const cardElement = document.querySelector<HTMLElement>(".sync-summary-card")!;
    const cardFrame = document.querySelector<HTMLImageElement>('[data-asset-role="sync-summary-addon-frame"]')!;
    const actionFrame = document.querySelector<HTMLImageElement>('[data-asset-role="sync-action-frame"]')!;
    const emblemFrame = document.querySelector<HTMLImageElement>(".sync-emblem-panel__frame")!;
    const emblemIcon = document.querySelector<HTMLImageElement>(".sync-emblem-panel__icon")!;
    const profileFrame = document.querySelector<HTMLImageElement>(".ks-user-menu__shell")!;
    const activeTab = document.querySelector<HTMLImageElement>(".ks-tab__decoration--active")!;
    const inactiveTab = document.querySelector<HTMLImageElement>(".ks-tab__decoration--inactive")!;
    const before = {
      card: cardElement.getBoundingClientRect().toJSON(),
      shell: shellElement.getBoundingClientRect().toJSON(),
    };
    const after = {
      card: cardElement.getBoundingClientRect().toJSON(),
      shell: shellElement.getBoundingClientRect().toJSON(),
    };

    return {
      after,
      before,
      ambientOpacity: getComputedStyle(shellElement, "::before").opacity,
      documentSlots: {
        artwork: root.style.getPropertyValue("--theme-artwork-background"),
        chrome: root.style.getPropertyValue("--theme-chrome-scalable-frame"),
        overlay: root.style.getPropertyValue("--theme-artwork-overlay"),
      },
      assets: {
        action: actionFrame.src,
        activeTab: activeTab.src,
        card: cardFrame.src,
        emblem: emblemIcon.src,
        emblemFrame: emblemFrame.src,
        inactiveTab: inactiveTab.src,
        profile: profileFrame.src,
      },
      framePointerEvents: getComputedStyle(cardFrame).pointerEvents,
      overlayBackground: getComputedStyle(shellElement, "::before").backgroundImage,
    };
  });

  expect(result.documentSlots.artwork).toContain("background-main");
  expect(result.documentSlots.overlay).toContain("ambient-overlay");
  expect(result.documentSlots.chrome).toContain("summary-card-frame");
  expect(result.overlayBackground).toContain("ambient-overlay");
  expect(result.ambientOpacity).toBe("0.14");
  expect(result.assets).toMatchObject({
    action: expect.stringMatching(/sync-button-frame(?:-[^/]+)?\.png$/),
    activeTab: expect.stringMatching(/tab-active-decoration(?:-[^/]+)?\.png$/),
    card: expect.stringMatching(/summary-card-addon-frame(?:-[^/]+)?\.png$/),
    emblem: expect.stringMatching(/emblem(?:-[^/]+)?\.png$/),
    emblemFrame: expect.stringMatching(/emblem-panel-frame(?:-[^/]+)?\.png$/),
    inactiveTab: expect.stringMatching(/tab-inactive-decoration(?:-[^/]+)?\.png$/),
    profile: expect.stringMatching(/profile-frame(?:-[^/]+)?\.png$/),
  });
  expect(result.framePointerEvents).toBe("none");
  expect(result.after).toEqual(result.before);
  await expect(brand).toBeVisible();
  await expect(emblem).toBeVisible();
});

test("Poison semantic raster status icons receive centralized normalization", async ({ page }) => {
  await page.goto("/?preview=sync-success");

  const icon = page.locator(".sync-current-panel__body > img");
  await expect(icon).toBeVisible();

  const treatment = await icon.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      filter: styles.filter,
      source: (element as HTMLImageElement).src,
    };
  });

  expect(treatment.source).toMatch(/poison-status-icon-success(?:-[^/]+)?\.png$/);
  expect(treatment.filter).not.toBe("none");
});

for (const [preview, expectedIcon] of [
  ["sync-success", /poison-status-icon-success(?:-[^/]+)?\.png$/],
  ["sync-syncing", /poison-sync-icon(?:-[^/]+)?\.png$/],
  ["sync-error", /poison-error-icon(?:-[^/]+)?\.png$/],
  ["sync-idle", /poison-warning-icon(?:-[^/]+)?\.png$/],
  ["sync-watching", /poison-info-icon(?:-[^/]+)?\.png$/],
] as const) {
  test(`Poison preserves the ${preview} semantic status icon`, async ({ page }) => {
    await page.goto(`/?preview=${preview}`);
    const icon = page.locator(".sync-current-panel__body > img");
    await expect(icon).toBeVisible();
    await expect(icon).toHaveAttribute("src", expectedIcon);
  });
}

test("Poison Addon primary actions use their integrated artwork icon", async ({ page }) => {
  await page.goto("/?preview=addon-not-installed");
  await page.getByRole("button", { name: "Addon" }).click();

  const action = page.locator(".addon-primary-action").first();
  const frame = action.locator('[data-asset-role="addon-action-install-frame"]');
  await expect(action).toBeVisible();
  await expect(frame).toBeVisible();

  await expect(action.locator(".theme-icon")).toHaveCount(0);
  expect(await frame.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe("none");
});

test("Poison Settings save icons inherit the high-contrast gold-action foreground", async ({ page }) => {
  await page.goto("/?preview=sync-success");
  await page.getByRole("button", { name: "Configuracion" }).click();

  const action = page.locator(".settings-gold-action").filter({ has: page.locator(".theme-icon") }).first();
  const icon = action.locator(".theme-icon");
  await expect(action).toBeVisible();
  await expect(icon).toBeVisible();

  expect(await icon.evaluate((element) => getComputedStyle(element).color)).toBe("rgb(7, 16, 5)");
  expect(await action.evaluate((element) => getComputedStyle(element).color)).toBe("rgb(7, 16, 5)");
});

test("Poison selected-avatar checks preserve their dedicated contrast foreground", async ({ page }) => {
  await page.goto("/?preview=sync-success");

  const color = await page.evaluate(() => {
    const choice = document.createElement("button");
    choice.className = "ks-avatar-choice";
    choice.setAttribute("aria-pressed", "true");
    const portrait = document.createElement("span");
    portrait.className = "ks-avatar-choice__portrait";
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.classList.add("theme-icon", "ks-avatar-choice__check");
    icon.setAttribute("data-icon-role", "confirm");
    portrait.append(icon);
    choice.append(portrait);
    document.body.append(choice);
    return getComputedStyle(icon).color;
  });

  expect(color).toBe("rgb(8, 18, 5)");
});
