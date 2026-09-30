import { expect, test } from "@playwright/test";
import { draftFullXI } from "./helpers";

test("share: the result card carries the XI, and the link shows it to a friend", async ({
  page,
}) => {
  // Stand in for a phone's share sheet and record what would be shared.
  await page.addInitScript(() => {
    const w = window as unknown as { __shared?: { files: number; type: string; text: string } };
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (d: { files?: File[]; text?: string }) => {
        w.__shared = { files: d.files?.length ?? 0, type: d.files?.[0]?.type ?? "", text: d.text ?? "" };
      },
    });
  });

  await page.goto("/play");
  await draftFullXI(page);
  await expect(page.locator("#bm11-count")).toHaveText("11/11");
  await page.locator("#bm11-cta").click();
  await page.waitForURL("**/matchup");
  // Reduced motion (playwright.config.ts) shows the result at once.

  const card = page.locator("#rs-card-img");
  await expect(card).toBeVisible();
  await expect.poll(() => card.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1080);

  await page.locator("#rs-share").click();
  const shared = await page.evaluate(() => (window as unknown as { __shared: { files: number; type: string; text: string } }).__shared);
  expect(shared.files).toBe(1);
  expect(shared.type).toBe("image/png");
  const link = shared.text.match(/https?:\/\/\S+/)?.[0] ?? "";
  expect(link).toMatch(/\/r\/\d-\d\?xi=/);

  // The friend opens the link and sees all eleven.
  await page.goto(link);
  await expect(page.locator("#sr-sheet li")).toHaveCount(11);
});
