import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const reviewDirectory = path.resolve(process.cwd(), ".tmp", "poison-final-polish-review");
const avatarFixture = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' fill='%23132746'/%3E%3Ccircle cx='48' cy='36' r='20' fill='%23d6a86e'/%3E%3Cpath d='M13 96c4-27 18-39 35-39s31 12 35 39' fill='%234a7b3f'/%3E%3Cpath d='M28 34c1-18 11-25 21-25 15 0 22 13 20 29-8-4-13-12-17-19-5 9-12 14-24 15' fill='%23251c18'/%3E%3C/svg%3E";

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

async function mountAvatarFixture(page: Page) {
  await page.locator(".ks-user-menu__avatar").evaluate((container, source) => {
    const image = document.createElement("img");
    image.alt = "";
    image.className = "ks-user-menu__avatar-image";
    image.src = source;
    container.prepend(image);
  }, avatarFixture);
  const avatar = page.locator(".ks-user-menu__avatar-image");
  await expect(avatar).toBeVisible();
  await expect.poll(() => avatar.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
}

for (const [preview, filename] of [
  ["sync-success", "sync-success.png"],
  ["sync-syncing", "sync-syncing.png"],
  ["sync-error", "sync-error.png"],
  ["sync-idle", "sync-idle-warning.png"],
  ["sync-watching", "sync-watching-or-info.png"],
] as const) {
  test(`captures final Poison polish for ${preview}`, async ({ page }) => {
    await preparePoison(page, preview);
    await capture(page, filename);
  });
}

test("captures rows inside the fixed frame at maximum scroll", async ({ page }) => {
  await preparePoison(page, "sync-success");
  const viewport = page.locator(".sync-table__body");
  await viewport.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await capture(page, "table-scrolled.png");
});

test("captures the real avatar fixture beneath the profile artwork", async ({ page }) => {
  await preparePoison(page, "sync-success");
  await mountAvatarFixture(page);
  const dropdown = page.getByRole("button", { name: "Menu de usuario de Spee" });
  await dropdown.click();
  await expect(page.getByRole("menu")).toBeVisible();
  await dropdown.click();
  await expect(page.getByRole("menu")).toBeHidden();
  await capture(page, "profile-with-avatar.png");
});

test("captures the final primary CTA hover hierarchy", async ({ page }) => {
  await preparePoison(page, "sync-success");
  await page.locator(".sync-primary-action").hover();
  await capture(page, "sync-success-hover-cta.png");
});

test("captures the final footer hover hierarchy", async ({ page }) => {
  await preparePoison(page, "sync-success");
  await page.locator(".ks-footer-action--web").hover();
  await capture(page, "sync-success-hover-footer.png");
});
