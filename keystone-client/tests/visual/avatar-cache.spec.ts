import { expect, test } from "@playwright/test";

const avatarUrl = "https://img.test/avatar-cache-persistence.png";
const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test("persists validated avatar bytes and serves them after connectivity is lost", async ({ page }) => {
  let requests = 0;
  await page.route(avatarUrl, async route => {
    requests += 1;
    await route.fulfill({
      body: onePixelPng,
      contentType: "image/png",
      headers: { "access-control-allow-origin": "*" },
      status: 200,
    });
  });
  await page.goto("/?preview=sync-success");

  const onlineSource = await page.evaluate(async url => {
    const cache = await import("/src/core/avatarCache.ts");
    return cache.getCachedAvatarSource(url);
  }, avatarUrl);
  await page.context().setOffline(true);
  const offlineSource = await page.evaluate(async url => {
    const cache = await import("/src/core/avatarCache.ts");
    return cache.getCachedAvatarSource(url);
  }, avatarUrl);

  expect(onlineSource).toMatch(/^data:image\/png;base64,/u);
  expect(offlineSource).toBe(onlineSource);
  expect(requests).toBe(1);
});
