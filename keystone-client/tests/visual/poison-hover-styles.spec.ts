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

async function hoverFilter(page: Page, locator: Locator) {
  await page.mouse.move(10, 10);
  await page.waitForTimeout(50);
  const normal = await locator.evaluate((el) => getComputedStyle(el).filter);
  await locator.hover();
  await page.waitForTimeout(60);
  const hover = await locator.evaluate((el) => getComputedStyle(el).filter);
  return { normal, hover };
}

function brightnessOf(filter: string) {
  const m = filter.match(/brightness\(([\d.]+)\)/);
  return m ? parseFloat(m[1]) : null;
}

function hasGlow(filter: string) {
  return /drop-shadow\(0 0 (1[4-9]|2[0-4])px/.test(filter) || filter.length > 30;
}

test.describe("Poison hover effect hierarchy", () => {
  test("addon primary actions glow stronger than folder/check controls", async ({ page }) => {
    await preparePoison(page, "addon-installed");
    const primary = await hoverFilter(page, page.getByRole("button", { name: "Actualizar KeystoneSync" }));
    const check = await hoverFilter(page, page.getByRole("button", { name: "Buscar actualizaciones" }));
    const folder = await hoverFilter(page, page.getByRole("button", { name: "Seleccionar carpeta de AddOns" }));

    const pb = brightnessOf(primary.hover);
    const cb = brightnessOf(check.hover);
    const fb = brightnessOf(folder.hover);
    expect(pb).not.toBeNull();
    expect(cb).not.toBeNull();
    expect(fb).not.toBeNull();
    expect(pb!).toBeGreaterThan(cb!);
    expect(pb!).toBeGreaterThan(fb!);
    expect(primary.hover).toContain("drop-shadow");
    expect(primary.normal).not.toBe(primary.hover);
  });

  test("sync primary action is the strongest and cards stay subtle", async ({ page }) => {
    await preparePoison(page, "sync-success", "sync");

    const primary = await hoverFilter(page, page.locator(".sync-primary-action .theme-frame-artwork"));
    const pb = brightnessOf(primary.hover);
    expect(pb).not.toBeNull();
    expect(hasGlow(primary.hover)).toBe(true);

    await page.mouse.move(10, 10);
    await page.waitForTimeout(60);
    await page.locator(".sync-summary-card").nth(0).hover();
    await page.waitForTimeout(60);
    const cb = await page.locator(".sync-summary-card .theme-frame-artwork").nth(0).evaluate((el) => {
      const m = getComputedStyle(el).filter.match(/brightness\(([\d.]+)\)/);
      return m ? parseFloat(m[1]) : null;
    });
    const cardGlow = await page.locator(".sync-summary-card .theme-frame-artwork").nth(0).evaluate((el) => getComputedStyle(el).filter);

    await page.mouse.move(10, 10);
    await page.waitForTimeout(60);
    await page.locator(".sync-version-panel").hover();
    await page.waitForTimeout(60);
    const vb = await page.locator(".sync-version-panel .theme-frame-artwork").evaluate((el) => {
      const m = getComputedStyle(el).filter.match(/brightness\(([\d.]+)\)/);
      return m ? parseFloat(m[1]) : null;
    });

    await page.mouse.move(10, 10);
    await page.waitForTimeout(60);
    await page.locator(".sync-current-panel").hover();
    await page.waitForTimeout(60);
    const sb = await page.locator(".sync-current-panel .theme-frame-artwork").evaluate((el) => {
      const m = getComputedStyle(el).filter.match(/brightness\(([\d.]+)\)/);
      return m ? parseFloat(m[1]) : null;
    });

    expect(cb).not.toBeNull();
    expect(vb).not.toBeNull();
    expect(sb).not.toBeNull();
    expect(pb!).toBeGreaterThan(cb!);
    expect(pb!).toBeGreaterThan(vb!);
    expect(pb!).toBeGreaterThan(sb!);
    expect(cardGlow).toContain("drop-shadow");
  });

  test("shell controls, profile and footer use the control-level glow", async ({ page }) => {
    await preparePoison(page, "sync-success", "sync");
    const shell = await hoverFilter(page, page.locator(".ks-settings-control img"));
    const profile = await hoverFilter(page, page.locator(".ks-user-menu__shell"));
    const footer = await hoverFilter(page, page.locator(".ks-footer-action__asset").nth(0));

    for (const [label, r] of [["shell", shell], ["profile", profile], ["footer", footer]] as const) {
      expect(r.hover, label).toContain("drop-shadow");
      expect(brightnessOf(r.hover)!, label).toBeGreaterThan(brightnessOf(r.normal)!);
    }
  });

  test("disabled addon primary action does not glow", async ({ page }) => {
    await preparePoison(page, "addon-installed");
    const button = page.getByRole("button", { name: "Actualizar KeystoneSync" });
    await button.evaluate((el) => el.setAttribute("disabled", ""));
    await page.mouse.move(10, 10);
    await page.waitForTimeout(50);
    await button.hover();
    await page.waitForTimeout(60);
    const filter = await button.evaluate((el) => getComputedStyle(el).filter);
    expect(filter).toContain("brightness(0.72)");
    expect(filter).not.toContain("drop-shadow(0 0 24px");
  });

  test("focus-visible rules mirror the interactive glow", async ({ page }) => {
    await preparePoison(page, "addon-installed");
    const css = await page.evaluate(() => Array.from(document.styleSheets).flatMap((sheet) => {
      try { return Array.from(sheet.cssRules).map((r) => r.cssText); } catch { return []; }
    }).join("\n"));

    expect(css).toContain(".addon-primary-action.addon-action--artwork:focus-visible");
    expect(css).toContain(".addon-primary-action.addon-action--artwork:hover:not(:disabled)");
    expect(css).toContain(".sync-primary-action:focus-visible:not(:disabled)");
    expect(css).toContain("drop-shadow(0 0 24px rgb(184 255 79 / 54%))");
    expect(css).toContain("drop-shadow(0 0 14px rgb(166 255 63 / 28%))");
  });
});
