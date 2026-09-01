import { expect, test, type Page } from "@playwright/test";

const THEME_STORAGE_KEY = "keystone-client.theme";

async function installVoid(page: Page) {
  await page.addInitScript(
    ({ key, theme }) => localStorage.setItem(key, theme),
    { key: THEME_STORAGE_KEY, theme: "void" },
  );
}

async function expectVoid(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-theme", "void");
}

async function expectImagesReady(page: Page) {
  await page.waitForFunction(() =>
    Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, (image) => image.decode()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

async function expectVoidScreenshot(page: Page, name: string) {
  expect(await page.screenshot({ animations: "allow", fullPage: true })).toMatchSnapshot(name);
}

async function getVisibleImageSize(page: Page, selector: string) {
  return page.locator(selector).evaluate((image: HTMLImageElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D context is unavailable");
    }

    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        if (pixels[(y * canvas.width + x) * 4 + 3] > 20) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    const rendered = image.getBoundingClientRect();
    return {
      width: ((maxX - minX + 1) / image.naturalWidth) * rendered.width,
      height: ((maxY - minY + 1) / image.naturalHeight) * rendered.height,
    };
  });
}

test.describe("Void visual states", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installVoid(page);
  });

  test("renders login", async ({ page }) => {
    await page.goto("/?preview=login");
    await expectVoid(page);
    await expect(page.getByRole("heading", { name: /Iniciar sesi/u })).toBeVisible();
    await expectImagesReady(page);
    await expectVoidScreenshot(page, "void-login.png");
  });

  test("renders registration", async ({ page }) => {
    await page.goto("/?preview=login");
    await page.getByRole("button", { name: /Registrarse/u }).click();
    await expectVoid(page);
    await expect(page.getByRole("heading", { name: /Crear cuenta/u })).toBeVisible();
    await expectVoidScreenshot(page, "void-registration.png");
  });

  test("renders onboarding", async ({ page }) => {
    await page.goto("/?preview=wow-onboarding");
    await expectVoid(page);
    await expect(page.getByRole("heading", { name: /World of Warcraft/u })).toBeVisible();
    await expectVoidScreenshot(page, "void-wow-onboarding.png");
  });

  test("renders the full synchronization composition", async ({ page }) => {
    await page.goto("/?preview=sync-success");
    await expectVoid(page);
    await expect(page.getByText("Makabe")).toBeVisible();
    await expectImagesReady(page);
    await expect(page.locator('.ks-tab__decoration--active[src$="active-tab-indicator.png"]')).toHaveCount(1);
    await expect(page.locator(".ks-tab__decoration--inactive")).toHaveCount(0);
    await expectVoidScreenshot(page, "void-sync-success.png");
  });

  test("matches the minimize artwork to close and centers footer labels in their icon-free area", async ({ page }) => {
    await page.goto("/?preview=sync-success");
    await expectVoid(page);
    await expectImagesReady(page);

    const minimizeButton = page.locator(".ks-window-button--minimize");
    const closeButton = page.locator(".ks-window-button--close");
    const minimizeBox = await minimizeButton.boundingBox();
    const closeBox = await closeButton.boundingBox();
    expect(minimizeBox?.width).toBe(closeBox?.width);
    expect(minimizeBox?.height).toBe(closeBox?.height);

    const minimizeArtwork = await getVisibleImageSize(page, ".ks-window-button--minimize img");
    const closeArtwork = await getVisibleImageSize(page, ".ks-window-button--close img");
    expect(minimizeArtwork.width).toBeCloseTo(closeArtwork.width, 1);
    expect(minimizeArtwork.height).toBeCloseTo(closeArtwork.height, 1);

    for (const [variant, expectedShiftX] of [["web", -8], ["tray", -4]] as const) {
      const geometry = await page.locator(`.ks-footer-action--${variant}`).evaluate((button) => {
        const buttonRect = button.getBoundingClientRect();
        const label = button.querySelector("span");
        if (!label) {
          throw new Error(`Missing ${button.className} label`);
        }
        const labelRect = label.getBoundingClientRect();
        const labelStyle = getComputedStyle(label);
        return {
          leftInset: labelRect.left - buttonRect.left,
          rightInset: buttonRect.right - labelRect.right,
          labelCenterX: labelRect.left + labelRect.width / 2,
          iconFreeCenterX: buttonRect.left + (76 + buttonRect.width - 12) / 2,
          labelCenterY: labelRect.top + labelRect.height / 2,
          buttonCenterY: buttonRect.top + buttonRect.height / 2,
          alignItems: labelStyle.alignItems,
          justifyItems: labelStyle.justifyItems,
        };
      });

      expect(geometry.leftInset).toBeCloseTo(76 + expectedShiftX, 1);
      expect(geometry.rightInset).toBeCloseTo(12 - expectedShiftX, 1);
      expect(geometry.labelCenterX - geometry.iconFreeCenterX).toBeCloseTo(expectedShiftX, 1);
      expect(geometry.labelCenterY - geometry.buttonCenterY).toBeCloseTo(-2, 1);
      expect(geometry.alignItems).toBe("center");
      expect(geometry.justifyItems).toBe("center");
    }
  });

  test("renders Addon with the shared Keystone structure", async ({ page }) => {
    await page.goto("/?preview=addon-current");
    await page.getByRole("button", { name: "Addon", exact: true }).click();
    await expectVoid(page);
    await expect(page.getByRole("heading", { name: "Addon", exact: true })).toBeVisible();
    await expectImagesReady(page);
    await page.waitForTimeout(300);
    await expectVoidScreenshot(page, "void-addon-current.png");
  });

  test("renders Teams with the shared Keystone structure", async ({ page }) => {
    await page.goto("/?preview=teams-default");
    await expectVoid(page);
    await expect(page.getByRole("button", { name: /Mythiqueros 2\.0/u })).toBeVisible();
    await expectImagesReady(page);
    await expectVoidScreenshot(page, "void-teams-default.png");
  });

  test("renders Settings and selects Void", async ({ page }) => {
    await page.goto("/?preview=sync-success");
    await page.getByRole("button", { name: /Configuraci/u }).click();
    await expectVoid(page);
    const selector = page.getByRole("combobox", { name: /Tema visual/u });
    await expect(selector).toHaveValue("void");
    await expect(selector.locator("option")).toHaveText(["Keystone", "Poison", "Void"]);
    await expectVoidScreenshot(page, "void-settings.png");
  });

  test("renders the user dropdown with the Void asset", async ({ page }) => {
    await page.goto("/?preview=sync-success");
    const trigger = page.getByRole("button", { name: /Menu de usuario/u });
    await expect(trigger.locator('img[src$="dropdown-icon.png"]')).toBeVisible();
    await trigger.click();
    await expect(page.getByRole("menu")).toBeVisible();
    await expectVoidScreenshot(page, "void-user-menu.png");
  });

  test("renders a modal", async ({ page }) => {
    await page.goto("/?preview=sync-success");
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectVoidScreenshot(page, "void-close-choices.png");
  });

  for (const overlay of ["overlay1", "overlay2", "overlay3"] as const) {
    test(`captures the ${overlay} comparison`, async ({ page }) => {
      await page.goto("/?preview=sync-success");
      await expectVoid(page);
      if (overlay !== "overlay1") {
        await page.locator("html").evaluate((root, candidate) => {
          const property = `--theme-artwork-overlay-alternative-${candidate === "overlay2" ? "2" : "3"}`;
          root.style.setProperty("--theme-artwork-overlay", getComputedStyle(root).getPropertyValue(property));
        }, overlay);
      }
      await expectImagesReady(page);
      await expectVoidScreenshot(page, `void-${overlay}-comparison.png`);
    });
  }
});

test("persists Void across reload", async ({ page }) => {
  await page.goto("/?preview=sync-success");
  await page.getByRole("button", { name: /Configuraci/u }).click();
  await page.getByRole("combobox", { name: /Tema visual/u }).selectOption("void");
  await expectVoid(page);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY)).toBe("void");

  await page.reload();
  await expectVoid(page);
});

test("publishes overlay1 as the non-interactive production layer and keeps review candidates available", async ({ page }) => {
  await installVoid(page);
  await page.goto("/?preview=sync-success");

  const artwork = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const overlay = getComputedStyle(document.querySelector(".shell")!, "::before");
    return {
      production: root.getPropertyValue("--theme-artwork-overlay"),
      alternative2: root.getPropertyValue("--theme-artwork-overlay-alternative-2"),
      alternative3: root.getPropertyValue("--theme-artwork-overlay-alternative-3"),
      pointerEvents: overlay.pointerEvents,
      backgroundPosition: overlay.backgroundPosition,
      backgroundRepeat: overlay.backgroundRepeat,
      backgroundSize: overlay.backgroundSize,
    };
  });

  expect(artwork.production).toContain("overlay1");
  expect(artwork.alternative2).toContain("overlay2");
  expect(artwork.alternative3).toContain("overlay3");
  expect(artwork.pointerEvents).toBe("none");
  expect(artwork.backgroundPosition).toContain("50%");
  expect(artwork.backgroundRepeat).toContain("no-repeat");
  expect(artwork.backgroundSize).toContain("cover");
});

test("keeps Void usable with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installVoid(page);
  await page.goto("/?preview=sync-syncing");
  await expectVoid(page);
  await expect(page.locator('.sync-current-panel[data-sync-state="syncing"] .sync-current-panel__body > img')).toHaveCSS("animation-name", "none");
  await page.getByRole("button", { name: "Addon", exact: true }).click();
  await expect(page.getByRole("button", { name: "Addon", exact: true })).toHaveAttribute("aria-current", "page");
});
