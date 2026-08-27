import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, type Page } from "@playwright/test";

const reportDirectory = path.resolve(process.cwd(), ".tmp", "poison-addon-geometry");

type ThemeName = "keystone" | "poison";

async function openAddon(page: Page, theme: ThemeName, preview: string) {
  await page.addInitScript((selectedTheme) => {
    localStorage.setItem("keystone-client.theme", selectedTheme);
  }, theme);
  await page.goto(`/?preview=${preview}`);
  await page.getByRole("button", { name: "Addon" }).click();
  await page.waitForFunction(() =>
    Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
  );
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom };
    };
    const rects = (selector: string) =>
      Array.from(document.querySelectorAll<HTMLElement>(selector), (element) => {
        const box = element.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom };
      });
    const buttonRect = (label: string) => {
      const button = Array.from(document.querySelectorAll<HTMLElement>("button"))
        .find((element) => element.textContent?.trim() === label);
      if (!button) return null;
      const box = button.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom };
    };
    const buttonMetrics = (label: string) => {
      const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
        .find((element) => element.textContent?.trim() === label);
      if (!button) return null;
      const labelElement = button.querySelector<HTMLElement>(".addon-action__label") ?? button;
      const artwork = button.querySelector<HTMLElement>(".addon-action__artwork");
      const buttonBox = button.getBoundingClientRect();
      const labelBox = labelElement.getBoundingClientRect();
      const artworkBox = artwork?.getBoundingClientRect() ?? null;
      const styles = getComputedStyle(button);
      const paddingLeft = Number.parseFloat(styles.paddingLeft);
      const paddingRight = Number.parseFloat(styles.paddingRight);
      const contentLeft = buttonBox.left + paddingLeft;
      const contentRight = buttonBox.right - paddingRight;
      return {
        wrapper: { x: buttonBox.x, y: buttonBox.y, width: buttonBox.width, height: buttonBox.height },
        artwork: artworkBox ? { x: artworkBox.x, y: artworkBox.y, width: artworkBox.width, height: artworkBox.height } : null,
        label: { x: labelBox.x, y: labelBox.y, width: labelBox.width, height: labelBox.height },
        fontSize: Number.parseFloat(styles.fontSize),
        fontWeight: styles.fontWeight,
        paddingLeft,
        paddingRight,
        availableTextWidth: contentRight - contentLeft,
        horizontalCenterDelta: labelBox.left + labelBox.width / 2 - (contentLeft + contentRight) / 2,
        verticalCenterDelta: labelBox.top + labelBox.height / 2 - (buttonBox.top + buttonBox.height / 2),
        fits: labelBox.width <= contentRight - contentLeft && labelBox.height <= buttonBox.height,
      };
    };
    const primaryCount = document.querySelectorAll(".addon-primary-actions .addon-primary-action").length;

    return {
      main: rect(".addon-screen__main"),
      heading: rect(".addon-heading"),
      headingIcon: rect(".addon-heading__icon"),
      headingText: rect(".addon-heading > div"),
      pathCard: rect(".addon-path-card"),
      pathField: rect(".addon-path-field"),
      selectFolder: rect('.addon-folder-actions button:nth-child(1)'),
      openFolder: rect('.addon-folder-actions button:nth-child(2)'),
      primaryWrapper: rect(".addon-primary-actions"),
      install: buttonRect("Instalar KeystoneSync"),
      update: buttonRect("Actualizar KeystoneSync"),
      reinstallShort: primaryCount === 2 ? buttonRect("Reinstalar KeystoneSync") : null,
      reinstallLong: primaryCount === 1 ? buttonRect("Reinstalar KeystoneSync") : null,
      statusPanel: rect(".addon-status-card"),
      statusRows: rects(".addon-status-row"),
      checkUpdates: rect(".addon-check-action"),
      divider: rect(".addon-screen__divider"),
      buttonTypography: {
        install: buttonMetrics("Instalar KeystoneSync"),
        update: buttonMetrics("Actualizar KeystoneSync"),
        reinstall: buttonMetrics("Reinstalar KeystoneSync"),
        selectFolder: buttonMetrics("Seleccionar carpeta de AddOns"),
        openFolder: buttonMetrics("Abrir carpeta del addon"),
        checkUpdates: buttonMetrics("Buscar actualizaciones"),
      },
    };
  });
}

test("writes Keystone and Poison Addon semantic geometry", async ({ browser }) => {
  const report: Record<string, unknown> = { viewport: { width: 1672, height: 941 } };
  for (const theme of ["keystone", "poison"] as const) {
    for (const preview of ["addon-current", "addon-not-installed", "addon-installed"] as const) {
      const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });
      await openAddon(page, theme, preview);
      report[`${theme}:${preview}`] = await measure(page);
      await page.close();
    }
  }

  await mkdir(reportDirectory, { recursive: true });
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  const beforePath = path.join(reportDirectory, "keystone-vs-poison-before.json");
  try {
    await access(beforePath);
  } catch {
    await writeFile(beforePath, serialized, "utf8");
  }
  await writeFile(path.join(reportDirectory, "keystone-vs-poison.json"), serialized, "utf8");
});
