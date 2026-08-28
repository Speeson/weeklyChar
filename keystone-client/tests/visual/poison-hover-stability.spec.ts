import { expect, test, type Locator, type Page } from "@playwright/test";

async function preparePoison(page: Page, preview: string, view: "addon" | "sync" = "addon") {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("keystone-client.theme", "poison"));
  await page.goto(`/?preview=${preview}`);
  if (view === "addon") {
    await page.getByRole("button", { name: "Addon" }).click();
  }
  await expect(page.locator("html")).toHaveAttribute("data-theme", "poison");
  await page.waitForFunction(() =>
    Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
  );
}

async function box(locator: Locator) {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
}

test.describe("Poison hover geometry stability", () => {
  test("hover does not move or resize the addon primary actions", async ({ page }) => {
    await preparePoison(page, "addon-installed");
    const wrapper = page.locator(".addon-primary-actions");
    const before = await box(wrapper);
    await page.getByRole("button", { name: "Actualizar KeystoneSync" }).hover();
    await page.waitForTimeout(80);
    const after = await box(wrapper);
    expect(after).toEqual(before);

    const pathCard = page.locator(".addon-path-card");
    const gap = await page.evaluate(() => {
      const card = document.querySelector<HTMLElement>(".addon-path-card")!.getBoundingClientRect();
      const actions = document.querySelector<HTMLElement>(".addon-primary-actions")!.getBoundingClientRect();
      return actions.top - card.bottom;
    });
    expect(gap).toBe(12);
  });

  test("hover does not move or resize sync primary action, cards, or the version panel", async ({ page }) => {
    await preparePoison(page, "sync-success", "sync");
    const checks: Array<[string, Locator]> = [
      ["sync-primary", page.locator(".sync-primary-action")],
      ["card", page.locator(".sync-summary-card").nth(0)],
      ["version", page.locator(".sync-version-panel")],
    ];
    for (const [label, loc] of checks) {
      const before = await box(loc);
      await loc.hover();
      await page.waitForTimeout(80);
      const after = await box(loc);
      expect(after, label).toEqual(before);
      await page.mouse.move(10, 10);
      await page.waitForTimeout(50);
    }
  });

  test("hover does not move the avatar or profile frame", async ({ page }) => {
    await preparePoison(page, "sync-success", "sync");
    const avatar = page.locator(".ks-user-menu__avatar-image");
    const shell = page.locator(".ks-user-menu__shell");
    const hasAvatar = (await avatar.count()) > 0;
    const avatarBefore = hasAvatar ? await box(avatar) : null;
    const shellBefore = await box(shell);
    await page.getByRole("button", { name: "Menu de usuario de Spee" }).hover();
    await page.waitForTimeout(80);
    if (hasAvatar) {
      expect(await box(avatar)).toEqual(avatarBefore);
    }
    expect(await box(shell)).toEqual(shellBefore);
  });

  test("footer actions keep their layout and behavior on hover", async ({ page }) => {
    await preparePoison(page, "sync-success", "sync");
    const web = page.locator(".ks-footer-action--web");
    const before = await box(web);
    await web.hover();
    await page.waitForTimeout(80);
    const after = await box(web);
    expect(after).toEqual(before);
  });
});
