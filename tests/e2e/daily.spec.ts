import { expect, test } from "@playwright/test";
import { draftFullXI } from "./helpers";

test("daily: same spins, no respins, streak recorded once, replay locked", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#hm-daily-num")).toHaveText(/Daily Challenge #\d+/);

  await page.goto("/play?daily=1");
  await expect(page.locator("#fl-daily")).toBeVisible();

  // Round 1 is always the same draw for the day.
  await page.locator("#bm11-spin").click();
  await page.locator(".bm11-prow[data-bm11-select]").first().waitFor();
  const firstDraw = `${await page.locator("#fl-nation").textContent()} ${await page.locator("#fl-era").textContent()}`;
  await expect(page.locator("#fl-respins")).toBeHidden();

  // Starting over from scratch (new browser state) lands on the same draw.
  await page.evaluate(() => localStorage.clear());
  await page.goto("/play?daily=1");
  await page.locator("#bm11-spin").click();
  await page.locator(".bm11-prow[data-bm11-select]").first().waitFor();
  const again = `${await page.locator("#fl-nation").textContent()} ${await page.locator("#fl-era").textContent()}`;
  expect(again).toBe(firstDraw);

  // Finish the draft: the result records the daily and shows the streak.
  await page.evaluate(() => localStorage.clear());
  await page.goto("/play?daily=1");
  await draftFullXI(page);
  await page.locator("#bm11-cta").click();
  await page.waitForURL("**/matchup");
  await expect(page.locator("#rs-daily")).toContainText(/Daily Challenge #\d+/);
  await expect(page.locator("#rs-daily")).toContainText("streak");

  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("bm11.daily.v1") || "null"));
  expect(state.streak).toBe(1);
  expect(Object.keys(state.results)).toHaveLength(1);

  // Reloading the result doesn't double count.
  await page.reload();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("bm11.daily.v1") || "null"));
  expect(after.streak).toBe(1);

  // The home card now says it's done, and the daily link is locked.
  await page.goto("/");
  await expect(page.locator("#hm-daily-title")).toContainText("Done today");
  await page.goto("/play?daily=1");
  await page.waitForURL((u) => u.pathname === "/");
});
