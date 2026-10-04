import { expect, test } from "@playwright/test";

test("Settings keeps its frame, tabs, and actions steady while sections change or scroll", async ({ page }) => {
  await page.goto("/?preview=sync-success");
  await page.getByRole("button", { name: "Configuración" }).click();

  const dialog = page.getByRole("dialog", { name: "Ajustes" });
  const panel = dialog.locator(".ks-modal__panel");
  const tabs = dialog.getByRole("tablist");
  const footer = dialog.locator(".settings-actions-footer");
  const initialPanel = await panel.boundingBox();
  const initialTabs = await tabs.boundingBox();
  const initialFooter = await footer.boundingBox();
  const contentTop = (await dialog.locator(".ks-modal__content").boundingBox())!.y;
  const firstGroupTop = (await dialog.locator(".settings-general-group").first().boundingBox())!.y;
  expect(firstGroupTop - contentTop).toBeLessThan(55);
  expect(await dialog.getByRole("tab", { name: "Account selection" }).evaluate((element) => getComputedStyle(element).borderLeftWidth)).toBe("0px");

  const autostart = dialog.getByRole("switch", { name: "Arrancar con Windows" });
  const thumb = autostart.locator("+ .settings-toggle-track > span");
  const offPosition = await thumb.evaluate((element) => getComputedStyle(element).transform);
  await autostart.click();
  await expect(autostart).toBeChecked();
  await expect.poll(() => thumb.evaluate((element) => getComputedStyle(element).transform)).not.toBe(offPosition);
  await autostart.click();

  await dialog.getByRole("radio", { name: "Minimizar a la bandeja" }).check();
  await expect(dialog.getByRole("radio", { name: "Minimizar a la bandeja" })).toBeChecked();
  await expect(dialog.getByRole("radio", { name: "Preguntar siempre" })).not.toBeChecked();

  for (const name of ["Account selection", "Appearance", "Application", "General"]) {
    await dialog.getByRole("tab", { name }).click();
    expect(await panel.boundingBox()).toEqual(initialPanel);
    expect(await tabs.boundingBox()).toEqual(initialTabs);
    expect(await footer.boundingBox()).toEqual(initialFooter);
  }

  await dialog.getByRole("tab", { name: "Application" }).click();
  await expect(dialog.getByRole("heading", { name: "Versión del cliente" })).toBeVisible();
  const languageSelector = dialog.getByRole("group", { name: "Idioma" });
  const applicationWidth = (await dialog.getByRole("tabpanel", { name: "Application" }).boundingBox())!.width;
  expect((await languageSelector.boundingBox())!.width).toBeCloseTo(applicationWidth);
  expect(await languageSelector.getByRole("button", { name: "Español" }).evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);

  await dialog.getByRole("tab", { name: "Appearance" }).click();
  await expect(dialog.locator(".settings-theme-card")).toHaveCount(5);
  await expect(dialog.getByRole("button", { name: "Keystone", exact: true })).toHaveAttribute("aria-pressed", "true");

  await dialog.getByRole("tab", { name: "Account selection" }).click();
  const content = dialog.locator(".ks-modal__content");
  await content.evaluate((element) => {
    const spacer = document.createElement("div");
    spacer.style.height = "1000px";
    element.querySelector(".settings-account-panel")?.appendChild(spacer);
    element.scrollTop = element.scrollHeight;
  });
  await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await tabs.boundingBox()).toEqual(initialTabs);
  expect(await footer.boundingBox()).toEqual(initialFooter);
  await expect(dialog.getByRole("button", { name: "Guardar ajustes" })).toBeVisible();
});
