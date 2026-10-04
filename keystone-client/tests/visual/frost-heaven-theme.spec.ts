import { expect, test, type Page } from "@playwright/test";
import { expectStableReleaseScreenshot } from "./release-visual-fixture";

const themes = [
  { id: "frost", glow: "125 191 236" },
  { id: "heaven", glow: "220 186 119" },
] as const;

async function expectImagesReady(page: Page) {
  await page.waitForFunction(() =>
    Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, (image) => image.decode()));
  });
}

for (const { id, glow } of themes) {
  test.describe(`${id} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript((theme) => localStorage.setItem("keystone-client.theme", theme), id);
    });

    test("renders the complete Sync layout with themed artwork and the fade tab", async ({ page }) => {
      await page.goto("/?preview=sync-success");
      await expect(page.locator("html")).toHaveAttribute("data-theme", id);
      await expectImagesReady(page);
      await expect(page.locator(".ks-tab__decoration")).toHaveCount(0);
      const artwork = await page.locator("html").evaluate((root) => ({
        background: root.style.getPropertyValue("--theme-artwork-background"),
        overlay: root.style.getPropertyValue("--theme-artwork-overlay"),
        glow: getComputedStyle(root).getPropertyValue("--theme-tab-glow-rgb").trim(),
      }));
      expect(artwork.background).toContain(`/themes/assets/${id}/backgrounds/background-main`);
      expect(artwork.overlay).toContain(`/themes/assets/${id}/backgrounds/overlay`);
      expect(artwork.glow).toBe(glow);
      await expectStableReleaseScreenshot(page, `${id}-sync-success.png`);
    });

    test("renders Addon, Teams, Settings, and the theme selector", async ({ page }) => {
      await page.goto("/?preview=addon-current");
      await page.getByRole("button", { name: "Addon", exact: true }).click();
      await expectImagesReady(page);
      await expectStableReleaseScreenshot(page, `${id}-addon-current.png`);

      await page.goto("/?preview=teams-default");
      await expectImagesReady(page);
      await expectStableReleaseScreenshot(page, `${id}-teams-default.png`);

      await page.getByRole("button", { name: /Configuraci/u }).click();
      await page.getByRole("tab", { name: /Appearance/u }).click();
      await expect(page.getByRole("button", { name: id === "frost" ? "Frost" : "Heaven", exact: true })).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(".settings-theme-card")).toHaveCount(5);
      await expectStableReleaseScreenshot(page, `${id}-settings.png`);
    });

    test("renders authentication and preserves the selected theme across reload", async ({ page }) => {
      await page.goto("/?preview=login");
      await expectImagesReady(page);
      await expectStableReleaseScreenshot(page, `${id}-login.png`);
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-theme", id);
    });
  });
}
