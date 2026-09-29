import { expect, test } from "@playwright/test";
import { placeNextPlayer } from "./helpers";

test("XI completion: six spins and eleven picks unlock Compare XIs", async ({
  page,
}) => {
  await page.goto("/play");
  const spin = page.locator("#bm11-spin");
  const count = page.locator("#bm11-count");

  for (let round = 0; round < 6; round++) {
    await expect(spin).toBeEnabled();
    await spin.click();
    await expect(
      page.locator('.bm11-prow[data-bm11-select]').first()
    ).toBeVisible();

    const picks = round === 0 ? 1 : 2;
    for (let i = 0; i < picks; i++) {
      await placeNextPlayer(page);
    }
    await expect(count).toHaveText(`${round === 0 ? 1 : round * 2 + 1}/11`);
  }

  await expect(count).toHaveText("11/11");
  await expect(page.locator("#bm11-cta")).toHaveAttribute(
    "aria-disabled",
    "false"
  );
});
