import { expect, test, type Page } from "@playwright/test";
import { placeNextPlayer } from "./helpers";

async function spinAndPick(page: Page) {
  await page.locator("#bm11-spin").click();
  await page.locator(".bm11-prow[data-bm11-select]").first().waitFor();
  await placeNextPlayer(page);
}

test("modes: the normal draft and the daily keep separate drafts", async ({ page }) => {
  // Normal game: one pick.
  await page.goto("/play");
  await expect(page.locator("#fl-daily")).toBeHidden();
  await spinAndPick(page);
  await expect(page.locator("#bm11-count")).toHaveText("1/11");

  // Home: the main button continues the NORMAL draft.
  await page.goto("/");
  await expect(page.locator("#hm-cta")).toHaveText("Continue your draft (1/11)");

  // Start the daily: it begins empty, with its own banner.
  await page.goto("/play?daily=1");
  await expect(page.locator("#fl-daily")).toContainText("Daily Challenge");
  await expect(page.locator("#bm11-count")).toHaveText("0/11");
  await spinAndPick(page);
  await expect(page.locator("#bm11-count")).toHaveText("1/11");

  // Home again: the main button still belongs to the normal game; the daily card continues the daily.
  await page.goto("/");
  await expect(page.locator("#hm-cta")).toHaveText("Continue your draft (1/11)");
  await expect(page.locator("#hm-daily-cta")).toHaveText("Continue today’s challenge");
  await expect(page.locator("#hm-daily-cta")).toHaveAttribute("href", "/play?daily=1");

  // The main button opens the normal game: no daily banner.
  await page.locator("#hm-cta").click();
  await page.waitForURL("**/play**");
  await expect(page.locator("#fl-daily")).toBeHidden();
  await expect(page.locator("#bm11-count")).toHaveText("1/11");

  // "Start a new draft" on the home page wipes only the normal draft.
  await page.goto("/");
  await page.locator("#hm-fresh").click();
  await page.waitForURL("**/play**");
  await expect(page.locator("#bm11-count")).toHaveText("0/11");
  await page.goto("/play?daily=1");
  await expect(page.locator("#bm11-count")).toHaveText("1/11"); // the daily draft survived
});
