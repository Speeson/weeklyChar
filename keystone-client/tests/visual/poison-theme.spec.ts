import { expect, test, type Page } from "@playwright/test";
import { bundledRelease } from "../../src/generated/release";
import { expectStableReleaseScreenshot, releaseSectionHeading } from "./release-visual-fixture";

const THEME_STORAGE_KEY = "keystone-client.theme";

const synchronizationStates = [
  { preview: "sync-idle", snapshot: "poison-sync-idle.png", label: "Esperando sincronizacion" },
  { preview: "sync-watching", snapshot: "poison-sync-watching.png", label: "Listo para sincronizar" },
  { preview: "sync-syncing", snapshot: "poison-sync-syncing.png", label: "Sincronizando" },
  { preview: "sync-error", snapshot: "poison-sync-error.png", label: "Error de sincronizacion" },
] as const;

async function installStoredTheme(page: Page, value: string) {
  await page.addInitScript(
    ({ key, theme }) => localStorage.setItem(key, theme),
    { key: THEME_STORAGE_KEY, theme: value },
  );
}

async function expectImagesReady(page: Page) {
  await page.waitForFunction(() =>
    Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
  );
}

async function expectPoisonTheme(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-theme", "poison");
}

test.describe("Poison visual states", () => {
  test.beforeEach(async ({ page }) => {
    await installStoredTheme(page, "poison");
  });

  test("renders the complete Poison login flow", async ({ page }) => {
    await page.goto("/?preview=login");
    await expectPoisonTheme(page);
    await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrarse" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Recuperar contraseña" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Acceder a la web" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cerrar aplicación" })).toBeVisible();
    await expectStableReleaseScreenshot(page, "poison-login.png");
  });

  test("renders Poison registration inside the client", async ({ page }) => {
    await page.goto("/?preview=login");
    await page.getByRole("button", { name: "Registrarse" }).click();
    await expectPoisonTheme(page);
    await expect(page.getByRole("heading", { name: "Crear cuenta" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Acceder a la web" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cerrar aplicación" })).toBeVisible();
    await expectStableReleaseScreenshot(page, "poison-registration.png");
  });

  test("renders the Poison first-run WoW install step", async ({ page }) => {
    await page.goto("/?preview=wow-onboarding");
    await expectPoisonTheme(page);
    await expect(page.getByRole("heading", { name: "Ubicación de World of Warcraft" })).toBeVisible();
    await expect(page.getByPlaceholder("World of Warcraft no detectado")).toBeVisible();
    await expectStableReleaseScreenshot(page, "poison-wow-onboarding.png");
  });

  test("renders the Poison first-run account selector", async ({ page }) => {
    await page.goto("/?preview=account-selector");
    await expectPoisonTheme(page);
    await expect(page.getByRole("heading", { name: "Cuentas de World of Warcraft" })).toBeVisible();
    await expect(page.getByText("WOW_ACCOUNT_1")).toBeVisible();
    await expect(page.getByText("WOW_ACCOUNT_2")).toBeVisible();
    await expectStableReleaseScreenshot(page, "poison-account-selector.png");
  });

  test("renders the Poison north-star synchronization composition", async ({ page }) => {
    await page.goto("/?preview=sync-success");
    await expectPoisonTheme(page);
    await expect(page.getByText("Makabe")).toBeVisible();
    await expect(page.getByLabel("Estado de sincronizacion").getByText("Sincronizacion completada")).toBeVisible();
    await expectImagesReady(page);
    await expectStableReleaseScreenshot(page, "poison-sync-success.png");
  });

  test("shows Poison navigation hover beside the selected tab", async ({ page }) => {
    await page.goto("/?preview=sync-success");
    const syncTab = page.getByRole("button", { name: "Sincronizacion", exact: true });
    const addonTab = page.getByRole("button", { name: "Addon", exact: true });

    await expectPoisonTheme(page);
    await expect(syncTab).toHaveAttribute("aria-current", "page");
    await addonTab.hover();
    await expect(addonTab).not.toHaveAttribute("aria-current", "page");
    await expectImagesReady(page);
    await expectStableReleaseScreenshot(page, "poison-navigation-hover-selected.png");
  });

  test("renders Poison Settings with the visible selector", async ({ page }) => {
    await page.goto("/?preview=sync-success");
    await page.getByRole("button", { name: "Configuracion" }).click();

    await expectPoisonTheme(page);
    await expect(page.getByRole("dialog", { name: "Ajustes" })).toBeVisible();
    const themeSelector = page.getByRole("combobox", { name: "Tema visual" });
    await expect(themeSelector).toHaveValue("poison");
    await expect(themeSelector.locator("option")).toHaveText(["Keystone", "Poison", "Void"]);
    await expectStableReleaseScreenshot(page, "poison-settings-theme-selector.png");
  });

  test("renders the signed update confirmation over Poison", async ({ page }) => {
    await page.goto("/?preview=sync-success&updater=available");

    await expectPoisonTheme(page);
    const modal = page.getByRole("dialog", { name: "Actualizacion 0.4.0" });
    await expect(modal).toBeVisible();
    await expect(modal.getByRole("heading", { level: 1, name: "KeystoneClient 0.4.0" })).toBeVisible();
    await expect(modal.getByRole("listitem")).toHaveCount(2);
    await expect(modal.getByRole("button", { name: "Instalar y reiniciar" })).toBeVisible();
    await expectStableReleaseScreenshot(page, "poison-update-available.png");
  });

  test("renders the post-update changelog over Poison", async ({ page }) => {
    await page.goto("/?preview=sync-success&changelog=post-update");

    await expectPoisonTheme(page);
    const modal = page.getByRole("dialog", { name: "Novedades de la actualizacion" });
    await expect(modal).toBeVisible();
    await expect(modal.getByRole("heading", { level: 1, name: `KeystoneClient ${bundledRelease.version}` })).toBeVisible();
    await expect(modal.getByRole("heading", { level: 2, name: releaseSectionHeading(bundledRelease.notes), exact: true })).toBeVisible();
    await expectStableReleaseScreenshot(page, "poison-post-update-changelog.png");
  });

  test("renders the user menu over the Poison view", async ({ page }) => {
    await page.goto("/?preview=sync-success");
    await page.getByRole("button", { name: "Menu de usuario de Spee" }).click();

    await expectPoisonTheme(page);
    await expect(page.getByRole("menu")).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Cerrar sesion" })).toBeVisible();
    await expectStableReleaseScreenshot(page, "poison-user-menu.png");
  });

  test("renders the avatar picker over the Poison view", async ({ page }) => {
    await page.goto("/?preview=sync-success");
    await page.getByRole("button", { name: "Menu de usuario de Spee" }).click();
    await page.getByRole("menuitem", { name: "Cambiar avatar" }).click();

    await expectPoisonTheme(page);
    await expect(page.getByRole("dialog", { name: "Cambiar avatar" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Makabe/ })).toBeDisabled();
    await expectStableReleaseScreenshot(page, "poison-avatar-picker.png");
  });

  test("renders the controlled close choices over Poison", async ({ page }) => {
    await page.goto("/?preview=sync-success");
    await page.getByRole("button", { name: "Cerrar" }).click();

    await expectPoisonTheme(page);
    await expect(page.getByRole("dialog", { name: "¿Qué quieres hacer con KeystoneClient?" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cerrar KeystoneClient" })).toBeVisible();
    await expectStableReleaseScreenshot(page, "poison-close-choices.png");
  });

  test("renders the current Addon summary under Poison", async ({ page }) => {
    await page.goto("/?preview=addon-current");
    await expectPoisonTheme(page);
    await expect(page.getByLabel("Addon: Actualizado")).toBeVisible();
    await expectImagesReady(page);
    await expectStableReleaseScreenshot(page, "poison-addon-current.png");
  });

  for (const addonState of [
    {
      preview: "addon-installed",
      snapshot: "poison-addon-installed.png",
      action: "Actualizar KeystoneSync",
      status: "Actualización disponible",
    },
    {
      preview: "addon-not-installed",
      snapshot: "poison-addon-not-installed.png",
      action: "Instalar KeystoneSync",
      status: "Instalación disponible",
    },
  ] as const) {
    test(`renders the Poison ${addonState.preview} Addon view`, async ({ page }) => {
      await page.goto(`/?preview=${addonState.preview}`);
      await page.getByRole("button", { name: "Addon" }).click();

      await expectPoisonTheme(page);
      await expect(page.getByRole("heading", { name: "Addon", exact: true })).toBeVisible();
      await expect(page.getByText(addonState.status)).toBeVisible();
      await expect(page.getByRole("button", { name: addonState.action })).toBeVisible();
      await expectImagesReady(page);
      await expectStableReleaseScreenshot(page, addonState.snapshot);
    });
  }

  for (const state of synchronizationStates) {
    test(`renders the Poison ${state.preview} synchronization state`, async ({ page }) => {
      await page.goto(`/?preview=${state.preview}`);
      await expectPoisonTheme(page);
      await expect(page.getByLabel("Addon: No instalado")).toBeVisible();
      await expect(page.getByLabel(`Estado actual: ${state.label}`)).toBeVisible();
      await expectImagesReady(page);
      await expectStableReleaseScreenshot(page, state.snapshot);
    });
  }
});

test.describe("theme behavior in the browser", () => {
  test("persists a Settings selection across reload", async ({ page }) => {
    await page.goto("/?preview=sync-success");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "keystone");
    await page.getByRole("button", { name: "Configuracion" }).click();

    const themeSelector = page.getByRole("combobox", { name: "Tema visual" });
    await themeSelector.selectOption("poison");
    await expectPoisonTheme(page);
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY)).toBe("poison");

    await page.reload();
    await expectPoisonTheme(page);
    await page.getByRole("button", { name: "Configuracion" }).click();
    await expect(page.getByRole("combobox", { name: "Tema visual" })).toHaveValue("poison");
  });

  test("falls back safely to Keystone for an invalid stored theme", async ({ page }) => {
    await installStoredTheme(page, "not-a-theme");
    await page.goto("/?preview=sync-success");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "keystone");
    await expect(page.getByText("Makabe")).toBeVisible();
    await page.getByRole("button", { name: "Configuracion" }).click();
    await expect(page.getByRole("combobox", { name: "Tema visual" })).toHaveValue("keystone");
  });

  test("keeps Poison navigation and focus usable with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installStoredTheme(page, "poison");
    await page.goto("/?preview=sync-syncing");

    await expectPoisonTheme(page);
    await expect(page.locator('.sync-current-panel[data-sync-state="syncing"] .sync-current-panel__body > img')).toHaveCSS("animation-name", "none");
    const addonTab = page.getByRole("button", { name: "Addon", exact: true });
    await addonTab.click();
    await expect(addonTab).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "Addon", exact: true })).toBeVisible();

    const settings = page.getByRole("button", { name: "Configuracion" });
    await settings.focus();
    await expect(settings).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Ajustes" })).toBeVisible();
  });
});
