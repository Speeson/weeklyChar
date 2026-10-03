import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

const html = new URL("./tab-navigation-concepts.html", import.meta.url);
const output = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url));
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 810 }, deviceScaleFactor: 1 });
  await page.goto(html.href);
  await page.locator(".preview img").first().waitFor();
  await page.screenshot({ path: output("tab-navigation-concepts.png"), fullPage: true });
  for (const [index, name] of ["text", "plates", "stone"].entries()) {
    await page.locator(`.concept--${name}`).screenshot({ path: output(`tab-navigation-${index + 1}-${name}.png`) });
  }
  await page.locator(".concept--plates .tab").nth(2).click();
  if (await page.locator(".concept--plates .tab[aria-current='page'] span").textContent() !== "Teams") {
    throw new Error("The interactive preview did not select Teams");
  }
  if (await page.locator(".concept--plates .indicator").count() !== 1) {
    throw new Error("The active tab indicator was not preserved");
  }
} finally {
  await browser.close();
}
