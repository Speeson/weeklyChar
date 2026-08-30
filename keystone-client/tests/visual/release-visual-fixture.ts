import { expect, type Page } from "@playwright/test";
import { bundledRelease } from "../../src/generated/release";

type ScreenshotOptions = {
  fullPage?: boolean;
  maxDiffPixels?: number;
};

// Release text is validated against generated runtime data before screenshots are taken. The
// screenshot fixture stays fixed so a release commit cannot invalidate unrelated visual baselines.
const VISUAL_CLIENT_VERSION = "0.6.5";
const VISUAL_CHANGELOG_VERSION = "0.6.5";

async function normalizeReleaseText(page: Page) {
  await page.evaluate(({ runtimeVersion, visualClientVersion, visualChangelogVersion }) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      node.textContent = node.textContent?.replaceAll(runtimeVersion, visualClientVersion) ?? null;
      node = walker.nextNode();
    }

    const changelog = document.querySelector<HTMLElement>(
      '[role="dialog"][aria-labelledby="changelog-modal-title"] .release-notes-markdown',
    );
    if (!changelog) return;
    const dialog = changelog.closest<HTMLElement>('[role="dialog"]');
    const eyebrow = dialog?.querySelector<HTMLElement>(".shell__eyebrow");
    if (eyebrow) eyebrow.textContent = `KeystoneClient ${visualChangelogVersion}`;
    changelog.innerHTML = [
      `<h1>KeystoneClient ${visualChangelogVersion}</h1>`,
      "<h2>Novedades</h2>",
      "<ul><li>Añade Equipos y el Selector de piedra nativo al cliente.<ul>",
      "<li>El cliente puede cargar equipos, personajes y el resumen agregado del Selector sin exponer credenciales a React.</li>",
      "<li>Las respuestas del servidor se validan y reducen a campos seguros en Python y TypeScript.</li>",
      "<li>La nueva página Equipos incluye el resumen compacto de miembros, las ocho mazmorras, filtros por especialización, grupos de objetos, estados Voidcore y tooltips seguros en español e inglés.</li>",
      "</ul></li></ul>",
    ].join("");
  }, {
    runtimeVersion: bundledRelease.version,
    visualClientVersion: VISUAL_CLIENT_VERSION,
    visualChangelogVersion: VISUAL_CHANGELOG_VERSION,
  });
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

export async function expectStableReleaseScreenshot(
  page: Page,
  name: string,
  options: ScreenshotOptions = { fullPage: true },
) {
  await normalizeReleaseText(page);
  await expect(page).toHaveScreenshot(name, options);
}

export function releaseSectionHeading(notes: string): string {
  const heading = /^##\s+(.+)$/m.exec(notes)?.[1]?.trim();
  if (!heading) throw new Error("Generated release notes must contain a level-two section heading.");
  return heading;
}
