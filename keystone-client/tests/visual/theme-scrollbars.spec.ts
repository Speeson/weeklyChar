import { expect, test, type Page } from "@playwright/test";

const THEME_STORAGE_KEY = "keystone-client.theme";
const themes = ["keystone", "poison", "void"] as const;
const expectedColors = {
  keystone: {
    scrollbar: "rgba(75, 139, 222, 0.72) rgba(3, 16, 38, 0.52)",
    track: "rgba(3, 16, 38, 0.52)",
  },
  poison: {
    scrollbar: "rgba(119, 145, 52, 0.78) rgba(5, 17, 8, 0.72)",
    track: "rgba(5, 17, 8, 0.72)",
  },
  void: {
    scrollbar: "rgba(142, 87, 233, 0.72) rgba(24, 13, 43, 0.52)",
    track: "rgba(24, 13, 43, 0.52)",
  },
} as const;

async function selectTheme(page: Page, theme: (typeof themes)[number]) {
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: THEME_STORAGE_KEY, value: theme },
  );
  await page.goto("/?preview=sync-success");
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function scrollbarColors(page: Page, selector: string) {
  return page.locator(selector).evaluate((element) => {
    const root = getComputedStyle(document.documentElement);
    const scrollbar = getComputedStyle(element);
    const track = getComputedStyle(element, "::-webkit-scrollbar-track");
    const thumb = getComputedStyle(element, "::-webkit-scrollbar-thumb");
    return {
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      hasThemeTokens: Boolean(
        root.getPropertyValue("--theme-scrollbar").trim()
        && root.getPropertyValue("--theme-scrollbar-track").trim(),
      ),
      scrollbarColor: scrollbar.scrollbarColor,
      thumbBackground: thumb.backgroundColor,
      thumbImage: thumb.backgroundImage,
      trackBackground: track.backgroundColor,
    };
  });
}

for (const theme of themes) {
  test(`${theme} themes Settings and the overflowing character table scrollbars`, async ({ page }) => {
    await selectTheme(page, theme);

    const rows = page.locator(".sync-table__body .sync-table__row");
    await expect(rows).toHaveCount(8);
    const table = await scrollbarColors(page, ".sync-table__body");
    expect(table.scrollHeight).toBeGreaterThan(table.clientHeight);
    expect(table.hasThemeTokens).toBe(true);
    expect(table.scrollbarColor).toBe(expectedColors[theme].scrollbar);
    expect(table.trackBackground).toBe(expectedColors[theme].track);
    expect(table.thumbBackground !== "rgba(0, 0, 0, 0)" || table.thumbImage !== "none").toBe(true);

    await page.getByRole("button", { name: "Configuracion" }).click();
    const settings = await scrollbarColors(page, ".ks-modal__content");
    expect(settings.scrollHeight).toBeGreaterThan(settings.clientHeight);
    expect(settings.hasThemeTokens).toBe(true);
    expect(settings.scrollbarColor).toBe(expectedColors[theme].scrollbar);
    expect(settings.trackBackground).toBe(expectedColors[theme].track);
    expect(settings.thumbBackground !== "rgba(0, 0, 0, 0)" || settings.thumbImage !== "none").toBe(true);
  });
}
