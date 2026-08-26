import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const reviewDirectory = path.resolve(process.cwd(), ".tmp", "poison-asset-review");

async function preparePoison(page: Page, preview: string) {
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

for (const state of [
  ["sync-success", "sync-success.png"],
  ["sync-syncing", "sync-syncing.png"],
  ["sync-error", "sync-error.png"],
  ["sync-watching", "sync-watching-or-info.png"],
  ["sync-idle", "sync-idle-warning.png"],
] as const) {
  test(`captures Poison artwork review for ${state[0]}`, async ({ page }) => {
    await preparePoison(page, state[0]);
    await capture(page, state[1]);
  });
}

test("captures Poison Settings artwork review", async ({ page }) => {
  await preparePoison(page, "sync-success");
  await page.getByRole("button", { name: "Configuracion" }).click();
  await expect(page.getByRole("dialog", { name: "Ajustes" })).toBeVisible();
  await capture(page, "settings.png");
});

test("captures Poison user-menu artwork review", async ({ page }) => {
  await preparePoison(page, "sync-success");
  await page.getByRole("button", { name: "Menu de usuario de Spee" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await capture(page, "user-menu.png");
});

test("captures the intentionally unfinished Addon interior inside the Poison shell", async ({ page }) => {
  await preparePoison(page, "addon-current");
  await page.getByRole("button", { name: "Addon", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Addon", exact: true })).toBeVisible();
  await capture(page, "addon-shell.png");
});
