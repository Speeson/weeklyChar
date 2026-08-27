import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const reviewDirectory = path.resolve(process.cwd(), ".tmp", "season2-client-release-review");
const avatarFixture = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' fill='%23132746'/%3E%3Ccircle cx='48' cy='36' r='20' fill='%23d6a86e'/%3E%3Cpath d='M13 96c4-27 18-39 35-39s31 12 35 39' fill='%234a7b3f'/%3E%3Cpath d='M28 34c1-18 11-25 21-25 15 0 22 13 20 29-8-4-13-12-17-19-5 9-12 14-24 15' fill='%23251c18'/%3E%3C/svg%3E";

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

async function addFeedback(page: Page, text: string, kind: "message" | "error") {
  await page.locator(".addon-feedback").evaluate((container, value) => {
    const paragraph = document.createElement("p");
    paragraph.className = `addon-feedback__${value.kind}`;
    paragraph.setAttribute("role", value.kind === "error" ? "alert" : "status");
    paragraph.textContent = value.text;
    container.replaceChildren(paragraph);
  }, { text, kind });
}

async function expectFeedbackFits(page: Page) {
  const metrics = await page.locator(".addon-feedback").evaluate((feedback) => {
    const content = feedback.firstElementChild as HTMLElement | null;
    const main = feedback.closest(".addon-screen__main") as HTMLElement;
    const feedbackBox = feedback.getBoundingClientRect();
    const mainBox = main.getBoundingClientRect();
    return {
      withinMain: content ? content.getBoundingClientRect().bottom <= mainBox.bottom : false,
      contentFits: content ? content.scrollWidth <= content.clientWidth : false,
    };
  });
  expect(metrics).toEqual({ withinMain: true, contentFits: true });
}

test("keeps the single addon action close to the path card and feedback directly after it", async ({ page }) => {
  for (const state of [
    { preview: "addon-current", button: "Reinstalar KeystoneSync", screenshot: "addon-current-success.png" },
    { preview: "addon-not-installed", button: "Instalar KeystoneSync", screenshot: "addon-not-installed-error.png" },
  ] as const) {
    await preparePoison(page, state.preview);
    const button = page.getByRole("button", { name: state.button });
    await expect(button).toHaveClass(/addon-primary-action--single/);

    const geometry = await page.evaluate(() => {
      const pathCard = document.querySelector<HTMLElement>(".addon-path-card")!.getBoundingClientRect();
      const action = document.querySelector<HTMLElement>(".addon-primary-action--single")!.getBoundingClientRect();
      return { gap: action.top - pathCard.bottom, width: action.width, height: action.height };
    });
    expect(geometry.gap).toBeGreaterThanOrEqual(10);
    expect(geometry.gap).toBeLessThanOrEqual(15);
    expect(geometry.width).toBe(650);
    expect(geometry.height).toBe(112);

    await addFeedback(
      page,
      state.preview === "addon-current"
        ? "KeystoneSync se reinstaló correctamente desde el paquete validado y ya está listo para el próximo inicio de World of Warcraft."
        : "No se pudo encontrar una versión válida del addon ni una copia local verificada. Comprueba la conexión y vuelve a intentarlo.",
      state.preview === "addon-current" ? "message" : "error",
    );
    await expectFeedbackFits(page);
    await capture(page, state.screenshot);

    if (state.preview === "addon-not-installed") {
      await addFeedback(
        page,
        "KeystoneSync se instaló correctamente desde la publicación oficial validada y estará disponible al iniciar World of Warcraft.",
        "message",
      );
      await expectFeedbackFits(page);
      await capture(page, "addon-not-installed-success.png");
    }
  }
});

test("keeps split Update and Reinstall actions clear of feedback and the bottom frame", async ({ page }) => {
  await preparePoison(page, "addon-installed");
  const actions = page.locator(".addon-primary-actions .addon-primary-action");
  await expect(actions).toHaveCount(2);
  await expect(actions.nth(0)).not.toHaveClass(/addon-primary-action--single/);
  await expect(actions.nth(1)).not.toHaveClass(/addon-primary-action--single/);

  const geometry = await page.evaluate(() => {
    const pathCard = document.querySelector<HTMLElement>(".addon-path-card")!.getBoundingClientRect();
    const wrapper = document.querySelector<HTMLElement>(".addon-primary-actions")!.getBoundingClientRect();
    const actions = Array.from(document.querySelectorAll<HTMLElement>(".addon-primary-action"), (element) => {
      const box = element.getBoundingClientRect();
      return { width: box.width, height: box.height };
    });
    return { gap: wrapper.top - pathCard.bottom, actions };
  });
  expect(geometry.gap).toBe(12);
  expect(geometry.actions).toEqual([
    { width: 430, height: 106 },
    { width: 430, height: 106 },
  ]);

  await addFeedback(page, "Comprobando la publicación más reciente de KeystoneSync y validando el paquete disponible…", "message");
  await expectFeedbackFits(page);
  await capture(page, "addon-update-checking.png");

  await addFeedback(
    page,
    "La comprobación terminó correctamente: KeystoneSync está actualizado y el paquete local continúa validado.",
    "message",
  );
  await expectFeedbackFits(page);
  await capture(page, "addon-update-success.png");

  await addFeedback(
    page,
    "No se pudo actualizar KeystoneSync porque la publicación descargada no superó la validación de integridad. Comprueba la conexión, vuelve a buscar actualizaciones y reintenta la instalación.",
    "error",
  );
  await expectFeedbackFits(page);
  await capture(page, "addon-update-long-error.png");
});

test("keeps addon feedback and actions readable at the minimum supported viewport", async ({ page }) => {
  await page.setViewportSize({ width: 940, height: 529 });
  for (const state of [
    {
      preview: "addon-installed",
      buttons: ["Actualizar KeystoneSync", "Reinstalar KeystoneSync"],
      feedback: "No se pudo actualizar KeystoneSync porque el paquete no superó la validación. Comprueba la conexión y vuelve a intentarlo.",
      kind: "error",
      screenshot: "addon-update-minimum-viewport.png",
    },
    {
      preview: "addon-current",
      buttons: ["Reinstalar KeystoneSync"],
      feedback: "KeystoneSync se reinstaló correctamente desde el paquete validado y está listo para usarse.",
      kind: "message",
      screenshot: "addon-current-minimum-viewport.png",
    },
    {
      preview: "addon-not-installed",
      buttons: ["Instalar KeystoneSync"],
      feedback: "KeystoneSync se instaló correctamente desde la publicación oficial validada y está listo para usarse.",
      kind: "message",
      screenshot: "addon-not-installed-minimum-viewport.png",
    },
  ] as const) {
    await preparePoison(page, state.preview);
    await addFeedback(page, state.feedback, state.kind);
    for (const button of state.buttons) {
      await expect(page.getByRole("button", { name: button })).toBeVisible();
    }
    await expectFeedbackFits(page);
    await capture(page, state.screenshot);
  }
});

test("centers the Poison avatar without changing the empty or dropdown states", async ({ page }) => {
  await preparePoison(page, "sync-success", "sync");
  await capture(page, "profile-without-avatar.png");

  await page.locator(".ks-user-menu__avatar").evaluate((container, source) => {
    const image = document.createElement("img");
    image.alt = "";
    image.className = "ks-user-menu__avatar-image";
    image.src = source;
    container.prepend(image);
  }, avatarFixture);
  const avatar = page.locator(".ks-user-menu__avatar-image");
  await expect(avatar).toBeVisible();
  await expect(avatar).toHaveCSS("transform", "matrix(1, 0, 0, 1, 1, -4)");
  await capture(page, "profile-with-avatar.png");

  const trigger = page.getByRole("button", { name: "Menu de usuario de Spee" });
  await trigger.click();
  await expect(page.getByRole("menu")).toBeVisible();
  await capture(page, "profile-dropdown.png");

  await page.setViewportSize({ width: 940, height: 529 });
  await expect(trigger).toBeVisible();
  await capture(page, "profile-dropdown-minimum-viewport.png");
});
