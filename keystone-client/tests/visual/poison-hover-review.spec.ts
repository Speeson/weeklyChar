import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

const reviewDirectory = path.resolve(process.cwd(), ".tmp", "poison-hover-review");

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

async function capture(page: Page, name: string) {
  await mkdir(reviewDirectory, { recursive: true });
  await page.screenshot({ fullPage: true, path: path.join(reviewDirectory, name) });
}

async function capturePair(page: Page, locator: Locator, name: string) {
  await locator.hover();
  await page.waitForTimeout(220);
  await capture(page, `${name}-hover.png`);
  await page.mouse.move(10, 10);
  await page.waitForTimeout(220);
  await capture(page, `${name}-normal.png`);
}

test.describe("Poison hover review captures", () => {
  test("captures Addon folder, open and check actions", async ({ page }) => {
    await preparePoison(page, "addon-installed");
    await capturePair(page, page.getByRole("button", { name: "Seleccionar carpeta de AddOns" }), "addon-select-folder");
    await capturePair(page, page.getByRole("button", { name: "Abrir carpeta del addon" }), "addon-open-folder");
    await capturePair(page, page.getByRole("button", { name: "Buscar actualizaciones" }), "addon-check-updates");
  });

  test("captures split Update and Reinstall primary actions", async ({ page }) => {
    await preparePoison(page, "addon-installed");
    await capturePair(page, page.getByRole("button", { name: "Actualizar KeystoneSync" }), "addon-split-update");
    await capturePair(page, page.getByRole("button", { name: "Reinstalar KeystoneSync" }), "addon-split-reinstall");
  });

  test("captures standalone Install and Reinstall primary actions", async ({ page }) => {
    await preparePoison(page, "addon-not-installed");
    await capturePair(page, page.getByRole("button", { name: "Instalar KeystoneSync" }), "addon-install");
    await preparePoison(page, "addon-current");
    await capturePair(page, page.getByRole("button", { name: "Reinstalar KeystoneSync" }), "addon-reinstall");
  });

  test("captures shell window controls, settings and profile", async ({ page }) => {
    await preparePoison(page, "sync-success", "sync");
    await capturePair(page, page.locator(".ks-window-button--minimize"), "shell-minimize");
    await capturePair(page, page.locator(".ks-window-button--close"), "shell-close");
    await capturePair(page, page.getByRole("button", { name: "Configuracion" }), "shell-settings");
    await capturePair(page, page.getByRole("button", { name: "Menu de usuario de Spee" }), "shell-profile");
  });

  test("captures footer web and tray actions", async ({ page }) => {
    await preparePoison(page, "sync-success", "sync");
    await capturePair(page, page.locator(".ks-footer-action--web"), "footer-web");
    await capturePair(page, page.locator(".ks-footer-action--tray"), "footer-tray");
  });

  test("captures Sync cards, version panel, status panel and primary action", async ({ page }) => {
    await preparePoison(page, "sync-success", "sync");
    const cards = page.locator(".sync-summary-card");
    await expect(cards).toHaveCount(4);
    await capturePair(page, cards.nth(0), "sync-card-first");
    await capturePair(page, cards.nth(1), "sync-card-second");
    await capturePair(page, page.locator(".sync-version-panel"), "sync-version");
    await capturePair(page, page.locator(".sync-current-panel"), "sync-status");
    await capturePair(page, page.locator(".sync-primary-action"), "sync-now");
  });

  test("captures Addon and Sync hover at the minimum supported viewport", async ({ page }) => {
    await page.setViewportSize({ width: 940, height: 529 });
    await preparePoison(page, "addon-installed");
    await capturePair(page, page.getByRole("button", { name: "Actualizar KeystoneSync" }), "min-addon-update");
    await preparePoison(page, "sync-success", "sync");
    await capturePair(page, page.locator(".sync-primary-action"), "min-sync-now");
    await capturePair(page, page.locator(".sync-summary-card").nth(0), "min-sync-card");
  });
});
