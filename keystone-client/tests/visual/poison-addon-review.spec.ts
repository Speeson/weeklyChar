import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const reviewDirectory = path.resolve(process.cwd(), ".tmp", "poison-addon-review-v2");

async function openPoisonAddon(page: Page, preview: string) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("keystone-client.theme", "poison"));
  await page.goto(`/?preview=${preview}`);
  await page.getByRole("button", { name: "Addon" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "poison");
  await page.waitForFunction(() =>
    Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
  );
}

async function capture(page: Page, name: string) {
  await mkdir(reviewDirectory, { recursive: true });
  await page.screenshot({ fullPage: true, path: path.join(reviewDirectory, name) });
}

async function captureElement(page: Page, selector: string, name: string) {
  await mkdir(reviewDirectory, { recursive: true });
  await page.locator(selector).screenshot({ path: path.join(reviewDirectory, name) });
}

for (const [preview, filename] of [
  ["addon-current", "addon-installed.png"],
  ["addon-not-installed", "addon-not-installed.png"],
  ["addon-installed", "addon-update-available.png"],
] as const) {
  test(`captures Poison Addon review for ${preview}`, async ({ page }) => {
    await openPoisonAddon(page, preview);
    await capture(page, filename);
  });
}

test("captures Poison Addon Install and secondary hover hierarchy", async ({ page }) => {
  await openPoisonAddon(page, "addon-not-installed");

  await page.getByRole("button", { name: "Instalar KeystoneSync" }).hover();
  await capture(page, "addon-install-hover.png");
  await page.getByRole("button", { name: "Seleccionar carpeta de AddOns" }).hover();
  await capture(page, "addon-folder-hover.png");
  await page.getByRole("button", { name: "Buscar actualizaciones" }).hover();
  await capture(page, "addon-check-hover.png");
});

test("captures Poison Addon Update hover hierarchy", async ({ page }) => {
  await openPoisonAddon(page, "addon-installed");

  await page.getByRole("button", { name: "Actualizar KeystoneSync" }).hover();
  await capture(page, "addon-update-hover.png");
});

test("captures focused Poison Addon sections", async ({ page }) => {
  await openPoisonAddon(page, "addon-current");

  await captureElement(page, ".addon-path-card", "addon-path-card.png");
  await captureElement(page, ".addon-folder-actions", "addon-folder-buttons.png");
  await captureElement(page, ".addon-status-card", "addon-status-panel.png");
  await captureElement(page, ".addon-primary-actions", "addon-primary-long.png");
  await captureElement(page, ".addon-screen__divider", "addon-divider.png");
  await captureElement(page, ".addon-heading", "addon-title-block.png");

  await openPoisonAddon(page, "addon-installed");
  await captureElement(page, ".addon-primary-actions", "addon-primary-split.png");
});
