import { expect, test } from "@playwright/test";
import { draftFullXI } from "./helpers";

test("ipl (hidden preview): spin teams and seasons, draft a full XI", async ({ page }) => {
  await page.goto("/ipl/play");
  await expect(page.locator("meta[name=robots]")).toHaveAttribute("content", "noindex");
  await expect(page.locator("#fl-reel-nation .fl-reel-cap")).toHaveText("Team");
  await expect(page.locator("#fl-reel-era .fl-reel-cap")).toHaveText("Seasons");

  await page.locator("#bm11-spin").click();
  await page.locator(".bm11-prow[data-bm11-select]").first().waitFor();
  // The reel shows a franchise code and a season block; cards show IPL stats.
  await expect(page.locator("#fl-nation")).toHaveText(/^[A-Z]{2,4}$/);
  await expect(page.locator("#fl-era")).toHaveText(/20\d\d/);
  await expect(page.locator(".fl-card").first()).toContainText(/Matches|Strike rate|Economy/);

  // The IPL draft is separate from the Test draft.
  await page.goto("/play");
  await expect(page.locator("#bm11-count")).toHaveText("0/11");
  await expect(page.locator("#fl-reel-nation .fl-reel-cap")).toHaveText("Nation");

  await page.goto("/ipl/play");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await draftFullXI(page);
  await expect(page.locator("#bm11-count")).toHaveText("11/11");
  await expect(page.locator("#bm11-cta")).toHaveAttribute("href", "/ipl/matchup");

  // The series: five matches against the All-Star XI, scored by the white-ball engine.
  await page.locator("#bm11-cta").click();
  await page.waitForURL("**/ipl/matchup**");
  await expect(page.locator("#rs-error")).toBeHidden();
  await expect(page.locator(".rs-lab").nth(1)).toHaveText("All-Star XI");
  await expect(page.locator("#rs-tests li")).toHaveCount(5);
  await expect(page.locator("#rs-tests li").first()).toContainText("1st match");
  const u = Number(await page.locator("#rs-user").textContent());
  const h = Number(await page.locator("#rs-house").textContent());
  expect(u + h).toBeGreaterThanOrEqual(4);
  expect(u + h).toBeLessThanOrEqual(5);
  await expect(page.locator("#rs-user-xi li")).toHaveCount(11);
  await expect(page.locator("#rs-house-xi li")).toHaveCount(11);
  await expect(page.locator("#rs-house-xi")).toContainText("Malinga");
  // Ratings are real numbers, never blank or NaN.
  for (const t of await page.locator(".rs-rating").allTextContents()) expect(Number(t)).toBeGreaterThan(0);
  await expect(page.locator("#rs-rank")).toContainText("% of all drafts");

  // "Draft again" returns to the IPL draft, and the Test result page still works on its own.
  await expect(page.locator(".rs-again-top")).toHaveAttribute("href", "/ipl/play");
  await page.goto("/matchup");
  await page.waitForURL((url) => url.pathname.startsWith("/play")); // no Test XI drafted: sent to the Test draft
});
