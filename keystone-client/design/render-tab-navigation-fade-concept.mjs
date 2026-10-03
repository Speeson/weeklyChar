import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

const html = new URL("./tab-navigation-fade-concept.html", import.meta.url);
const output = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url));
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 840 }, deviceScaleFactor: 1 });
  await page.goto(html.href);
  await page.locator(".theme--void .brand img").waitFor();
  if (!await page.locator("img").evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))) {
    throw new Error("A theme image did not load");
  }
  await page.screenshot({ path: output("tab-navigation-fade-concept.png"), fullPage: true });
  for (const theme of ["keystone", "poison", "void"]) {
    await page.locator(`.theme--${theme}`).screenshot({ path: output(`tab-navigation-fade-${theme}.png`) });
  }
  await page.locator(".theme--void .tab").nth(2).click();
  if (await page.locator(".theme--void .tab[aria-current='page'] span").textContent() !== "Teams") {
    throw new Error("The interactive preview did not select Teams");
  }
  if (await page.locator(".indicator").count() !== 0) {
    throw new Error("The old tab indicator is still present");
  }
} finally {
  await browser.close();
}
