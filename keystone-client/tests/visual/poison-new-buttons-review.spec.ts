import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const reviewDirectory = path.resolve(process.cwd(), ".tmp", "poison-new-buttons-review");

async function preparePoison(page: Page, preview = "sync-success") {
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

test("captures the new Poison sync action states", async ({ page }) => {
  await preparePoison(page);
  const syncAction = page.locator(".sync-primary-action");

  await capture(page, "sync-normal.png");
  await syncAction.hover();
  await capture(page, "sync-hover.png");
  await page.mouse.move(0, 0);
  await syncAction.evaluate((button: HTMLButtonElement) => { button.disabled = true; });
  await capture(page, "sync-disabled.png");
});

test("captures the new Poison footer action states", async ({ page }) => {
  await preparePoison(page);

  await capture(page, "footer-normal.png");
  await page.locator(".ks-footer-action--web").hover();
  await capture(page, "footer-web-hover.png");
  await page.locator(".ks-footer-action--tray").hover();
  await capture(page, "footer-tray-hover.png");
});
