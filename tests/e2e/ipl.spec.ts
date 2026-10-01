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
});
