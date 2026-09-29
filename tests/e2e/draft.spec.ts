import { expect, test } from "@playwright/test";
import { placeNextPlayer } from "./helpers";

test("player selection: spin → pick a player → place in a glowing slot", async ({
  page,
}) => {
  await page.goto("/play");
  await expect(page.locator("#bm11-count")).toHaveText("0/11");

  await page.locator("#bm11-spin").click();
  await expect(
    page.locator('.bm11-prow[data-bm11-select]').first()
  ).toBeVisible();

  await placeNextPlayer(page);

  await expect(page.locator("#bm11-count")).toHaveText("1/11");
});
