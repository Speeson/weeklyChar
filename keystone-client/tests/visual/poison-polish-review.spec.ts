import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const reviewDirectory = path.resolve(process.cwd(), ".tmp", "poison-polish-review");

async function preparePoison(page: Page, preview: string) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("keystone-client.theme", "poison"));
  await page.goto(`/?preview=${preview}`);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "poison");
  await page.waitForFunction(() =>
    Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
  );
}

async function capture(page: Page, name: string) {
  await mkdir(reviewDirectory, { recursive: true });
  await page.screenshot({ fullPage: true, path: path.join(reviewDirectory, name) });
}

for (const [preview, filename] of [
  ["sync-success", "sync-success.png"],
  ["sync-syncing", "sync-syncing.png"],
  ["sync-error", "sync-error.png"],
  ["sync-idle", "sync-idle-warning.png"],
  ["sync-watching", "sync-watching-or-info.png"],
] as const) {
  test(`captures polished Poison ${preview}`, async ({ page }) => {
    await preparePoison(page, preview);
    await capture(page, filename);
  });
}

test("captures character data scrolled beneath the fixed Poison frame", async ({ page }) => {
  await preparePoison(page, "sync-success");
  const viewport = page.locator(".sync-table__body");
  await expect(viewport).toBeVisible();
  await viewport.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await capture(page, "table-scrolled.png");
});

test("captures the polished Poison user menu", async ({ page }) => {
  await preparePoison(page, "sync-success");
  await page.getByRole("button", { name: "Menu de usuario de Spee" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await capture(page, "user-menu.png");
});

test("captures the polished Poison settings dialog", async ({ page }) => {
  await preparePoison(page, "sync-success");
  await page.getByRole("button", { name: "Configuracion" }).click();
  await expect(page.getByRole("dialog", { name: "Ajustes" })).toBeVisible();
  await capture(page, "settings.png");
});

test("captures the primary Poison hover hierarchy", async ({ page }) => {
  await preparePoison(page, "sync-success");
  await page.locator(".sync-primary-action").hover();
  await capture(page, "sync-success-hover-cta.png");
});

test("captures the restrained Poison footer hover hierarchy", async ({ page }) => {
  await preparePoison(page, "sync-success");
  await page.locator(".ks-footer-action--web").hover();
  await capture(page, "sync-success-hover-footer.png");
});
