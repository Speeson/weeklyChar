import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("keystone-client.theme", "poison"));
});

test("Poison artwork slots are inert by default and consume future registry URLs without changing layout", async ({ page }) => {
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
    const brandElement = document.querySelector<HTMLElement>(".ks-brand")!;
    const cardElement = document.querySelector<HTMLElement>(".sync-summary-card")!;
    const emblemElement = document.querySelector<HTMLElement>(".sync-emblem-panel__artwork")!;
    const emblemFallback = document.querySelector<HTMLElement>(".sync-emblem-panel__icon")!;
    const before = {
      card: cardElement.getBoundingClientRect().toJSON(),
      shell: shellElement.getBoundingClientRect().toJSON(),
    };
    const emptySlots = [
      "--theme-artwork-background",
      "--theme-artwork-overlay",
      "--theme-emblem-artwork",
      "--theme-app-badge-artwork",
      "--theme-panel-ornament",
      "--theme-serpentine-decoration",
    ].map((property) => root.style.getPropertyValue(property));
    const image = 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E")';
    for (const property of [
      "--theme-artwork-background",
      "--theme-artwork-overlay",
      "--theme-emblem-artwork",
      "--theme-app-badge-artwork",
      "--theme-panel-ornament",
      "--theme-serpentine-decoration",
    ]) {
      root.style.setProperty(property, image);
    }
    root.style.setProperty("--theme-emblem-fallback-visibility", "hidden");
    const after = {
      card: cardElement.getBoundingClientRect().toJSON(),
      shell: shellElement.getBoundingClientRect().toJSON(),
    };

    return {
      after,
      before,
      emptySlots,
      emblemFallbackVisibility: getComputedStyle(emblemFallback).visibility,
      backgrounds: {
        appBadge: getComputedStyle(brandElement, "::after").backgroundImage,
        artwork: getComputedStyle(shellElement).backgroundImage,
        emblem: getComputedStyle(emblemElement, "::after").backgroundImage,
        ornament: getComputedStyle(cardElement, "::before").backgroundImage,
        overlay: getComputedStyle(shellElement, "::before").backgroundImage,
        serpentine: getComputedStyle(emblemElement, "::before").backgroundImage,
      },
      pointerEvents: {
        appBadge: getComputedStyle(brandElement, "::after").pointerEvents,
        emblem: getComputedStyle(emblemElement, "::after").pointerEvents,
        ornament: getComputedStyle(cardElement, "::before").pointerEvents,
        serpentine: getComputedStyle(emblemElement, "::before").pointerEvents,
      },
    };
  });

  expect(result.emptySlots).toEqual(["none", "none", "none", "none", "none", "none"]);
  expect(result.emblemFallbackVisibility).toBe("hidden");
  for (const background of Object.values(result.backgrounds)) {
    expect(background).toContain("data:image/svg+xml");
  }
  expect(result.pointerEvents).toEqual({
    appBadge: "none",
    emblem: "none",
    ornament: "none",
    serpentine: "none",
  });
  expect(result.after).toEqual(result.before);
  await expect(brand).toBeVisible();
  await expect(emblem).toBeVisible();
});

test("Poison semantic icons receive the shared color and glow treatment", async ({ page }) => {
  await page.goto("/?preview=sync-success");

  const icon = page.locator('.theme-icon[data-icon-role="refresh"]').first();
  await expect(icon).toBeVisible();

  const treatment = await icon.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      color: styles.color,
      filter: styles.filter,
    };
  });

  expect(treatment.color).toBe("rgb(197, 238, 98)");
  expect(treatment.filter).not.toBe("none");
});

test("Poison primary action icons inherit the high-contrast action foreground", async ({ page }) => {
  await page.goto("/?preview=addon-not-installed");
  await page.getByRole("button", { name: "Addon" }).click();

  const action = page.locator(".addon-primary-action").first();
  const icon = action.locator(".theme-icon");
  await expect(action).toBeVisible();
  await expect(icon).toBeVisible();

  expect(await icon.evaluate((element) => getComputedStyle(element).color)).toBe("rgb(7, 16, 5)");
  expect(await action.evaluate((element) => getComputedStyle(element).color)).toBe("rgb(7, 16, 5)");
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
