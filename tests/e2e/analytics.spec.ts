import { expect, test } from "@playwright/test";

// Google Analytics 4 (owner, 2026-10-03): the tag loads from Google on every page, and not at all when
// the browser sends "Do Not Track". The request to Google is intercepted: nothing real is sent.
const GA = "https://www.googletagmanager.com/**";

test("analytics: the Google tag loads on a page, with the owner's measurement id", async ({ page }) => {
  const asked: string[] = [];
  await page.route(GA, async (route) => { asked.push(route.request().url()); await route.fulfill({ contentType: "application/javascript", body: "" }); });
  await page.goto("/");
  await expect.poll(() => asked.length).toBe(1);
  expect(asked[0]).toContain("/gtag/js?id=G-N196X2FYC1");
  const config = await page.evaluate(() => (window as unknown as { dataLayer: unknown[][] }).dataLayer.map((a) => Array.from(a as ArrayLike<unknown>)));
  expect(JSON.stringify(config)).toContain("G-N196X2FYC1");
});

test("analytics: Do Not Track means the Google tag is never loaded", async ({ page }) => {
  const asked: string[] = [];
  await page.route(GA, async (route) => { asked.push(route.request().url()); await route.fulfill({ contentType: "application/javascript", body: "" }); });
  await page.addInitScript(() => Object.defineProperty(navigator, "doNotTrack", { value: "1", configurable: true }));
  await page.goto("/");
  await page.waitForTimeout(1500);
  expect(asked).toHaveLength(0);
  expect(await page.evaluate(() => typeof (window as unknown as { gtag?: unknown }).gtag)).toBe("undefined");
});

test("analytics: the privacy page says Google Analytics sets cookies", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.locator("main")).toContainText("Google Analytics");
  await expect(page.locator("main")).toContainText("Do Not Track");
  await expect(page.locator("main")).toContainText("sets cookies");
});
