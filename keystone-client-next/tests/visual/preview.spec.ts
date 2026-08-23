import { expect, test } from "@playwright/test";

const synchronizationStates = [
  { preview: "sync-idle", snapshot: "sync-idle.png", label: "Esperando sincronizacion" },
  { preview: "sync-watching", snapshot: "sync-watching.png", label: "Listo para sincronizar" },
  { preview: "sync-syncing", snapshot: "sync-syncing.png", label: "Sincronizando" },
  { preview: "sync-error", snapshot: "sync-error.png", label: "Error de sincronizacion" },
] as const;

test.describe("preview states", () => {
  test("renders synchronization success preview", async ({ page }) => {
    await page.goto("/?preview=sync-success");
    await expect(page.getByText("Makabe")).toBeVisible();
    await expect(page.getByLabel("Estado de sincronizacion").getByText("Sincronizacion completada")).toBeVisible();
    await expect(page.getByText("Version de la aplicacion")).toBeVisible();
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0));
    expect(await page.evaluate(() => ({
      frame: document.querySelector(".ks-app-frame")?.getBoundingClientRect().toJSON(),
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
    }))).toMatchObject({
      frame: { height: 941, width: 1672, x: 0, y: 0 },
      innerHeight: 941,
      innerWidth: 1672,
      scrollHeight: 941,
      scrollWidth: 1672,
    });
    await expect(page).toHaveScreenshot("sync-success.png", { fullPage: true });
  });

  test("keeps the full composition at a reduced scale", async ({ page }) => {
    await page.goto("/?preview=sync-success");
    await expect(page.getByText("Makabe")).toBeVisible();
    await page.setViewportSize({ width: 1100, height: 619 });
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0));

    const frame = await page.locator(".ks-app-frame").boundingBox();
    expect(frame).not.toBeNull();
    expect(frame!.width / frame!.height).toBeCloseTo(1672 / 941, 3);
    expect(frame!.width).toBeLessThanOrEqual(1100);
    expect(frame!.height).toBeLessThanOrEqual(619);
    expect(frame!.x).toBeGreaterThanOrEqual(-0.5);
    expect(frame!.y).toBeGreaterThanOrEqual(-0.5);

    await expect(page).toHaveScreenshot("sync-success-small.png", {
      fullPage: true,
      maxDiffPixels: 30,
    });
  });

  test("renders the legacy settings options in the current style", async ({ page }) => {
    await page.goto("/?preview=sync-success");
    await page.getByRole("button", { name: "Configuracion" }).click();

    await expect(page.getByRole("dialog", { name: "Ajustes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "General" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Seleccion de cuentas" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Aplicacion" })).toBeVisible();
    await expect(page).toHaveScreenshot("settings.png", { fullPage: true });
  });

  test("renders the user menu above the current view", async ({ page }) => {
    await page.goto("/?preview=sync-success");
    await page.getByRole("button", { name: "Menu de usuario de Spee" }).click();

    const menu = page.getByRole("menu");
    const logoutButton = page.getByRole("menuitem", { name: "Cerrar sesion" });
    await expect(menu).toBeVisible();
    await expect(logoutButton.locator("svg")).toBeVisible();

    const menuBox = await menu.boundingBox();
    expect(menuBox).not.toBeNull();
    const menuIsTopLayer = await page.evaluate(({ x, y }) => {
      return document.elementFromPoint(x, y)?.closest(".ks-user-dropdown") !== null;
    }, {
      x: menuBox!.x + menuBox!.width / 2,
      y: menuBox!.y + menuBox!.height / 2,
    });
    expect(menuIsTopLayer).toBe(true);

    await expect(page).toHaveScreenshot("user-menu.png", { fullPage: true });
  });

  test("renders current addon status in the summary", async ({ page }) => {
    await page.goto("/?preview=addon-current");
    await expect(page.getByLabel("Addon: Actualizado")).toBeVisible();
    await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0));
    await expect(page).toHaveScreenshot("addon-current.png", { fullPage: true });
  });

  for (const addonState of [
    {
      preview: "addon-installed",
      snapshot: "addon-installed.png",
      action: "Actualizar KeystoneSync",
      status: "Actualización disponible",
    },
    {
      preview: "addon-not-installed",
      snapshot: "addon-not-installed.png",
      action: "Instalar KeystoneSync",
      status: "Instalación disponible",
    },
  ] as const) {
    test(`renders the approved ${addonState.preview} content without changing the shell`, async ({ page }) => {
      await page.goto(`/?preview=${addonState.preview}`);
      await page.getByRole("button", { name: "Addon" }).click();

      await expect(page.getByRole("heading", { name: "Addon", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Ruta de AddOns" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Estado del addon" })).toBeVisible();
      await expect(page.getByText(addonState.status)).toBeVisible();
      await expect(page.getByRole("button", { name: addonState.action })).toBeVisible();
      await expect(page.getByRole("button", { name: "Acceder a la Web" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Minimizar a la bandeja" })).toBeVisible();
      await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0));
      await expect(page).toHaveScreenshot(addonState.snapshot, { fullPage: true });
    });
  }

  for (const state of synchronizationStates) {
    test(`renders the ${state.preview} state in the current panel`, async ({ page }) => {
      await page.goto(`/?preview=${state.preview}`);
      await expect(page.getByLabel("Addon: No instalado")).toBeVisible();
      await expect(page.getByLabel(`Estado actual: ${state.label}`)).toBeVisible();
      await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0));
      await expect(page).toHaveScreenshot(state.snapshot, { fullPage: true });
    });
  }
});
