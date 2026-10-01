import { expect, test, type Page } from "@playwright/test";
import { placeNextPlayer } from "./helpers";

/** Plays a full draft, returning the six draws (nation + era) in order. */
async function draftAndRecordDraws(page: Page): Promise<string[]> {
  const draws: string[] = [];
  for (let round = 0; round < 6; round++) {
    await page.locator("#bm11-spin").click();
    await page.locator(".bm11-prow[data-bm11-select]").first().waitFor();
    draws.push(`${await page.locator("#fl-nation").textContent()} ${await page.locator("#fl-era").textContent()}`);
    for (let i = 0; i < (round === 0 ? 1 : 2); i++) await placeNextPlayer(page);
  }
  return draws;
}

test("challenge: a friend drafts from the same spins, can retry, and sees the try count", async ({ browser }) => {
  test.setTimeout(180_000); // three full drafts across two browsers; ~85s on its own, slower in parallel
  // Friend 1 drafts normally and shares.
  const ctx1 = await browser.newContext();
  const p1 = await ctx1.newPage();
  await p1.addInitScript(() => {
    const w = window as unknown as { __shared?: string };
    Object.defineProperty(navigator, "canShare", { value: () => false, configurable: true });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (d: { text?: string; url?: string }) => {
        w.__shared = `${d.text ?? ""} ${d.url ?? ""}`;
      },
    });
  });
  await p1.goto("/play");
  const draws1 = await draftAndRecordDraws(p1);
  await p1.locator("#bm11-cta").click();
  await p1.waitForURL("**/matchup");
  await expect(p1.locator("#rs-share")).toBeVisible();
  await p1.locator("#rs-share").click();
  const shared = await p1.evaluate(() => (window as unknown as { __shared: string }).__shared);
  const link = shared.match(/https?:\/\/\S+/)?.[0] ?? "";
  expect(link).toMatch(/\/r\/\d-\d\?xi=.*&c=/);

  // Friend 2 opens the link in a fresh browser: the page offers the same spins.
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(link);
  await expect(p2.locator("#sr-cta")).toHaveText("Take the challenge: same spins");
  await p2.locator("#sr-cta").click();
  await p2.waitForURL("**/play**");
  await expect(p2.locator("#fl-daily")).toContainText("Challenge: beat");
  await expect(p2.locator("#fl-respins")).toBeHidden();

  const draws2 = await draftAndRecordDraws(p2);
  expect(draws2).toEqual(draws1);
  await p2.locator("#bm11-cta").click();
  await p2.waitForURL("**/matchup");
  await expect(p2.locator("#rs-challenge")).toContainText("attempt 1");

  // Retry: same spins again, and the try count goes up.
  await p2.locator(".rs-again-bottom").click();
  await p2.waitForURL("**/play**");
  const draws3 = await draftAndRecordDraws(p2);
  expect(draws3).toEqual(draws1);
  await p2.locator("#bm11-cta").click();
  await p2.waitForURL("**/matchup");
  await expect(p2.locator("#rs-challenge")).toContainText("attempt 2");

  // Leaving the challenge goes back to the normal game.
  await p2.locator("#rs-leave").click();
  expect(await p2.evaluate(() => localStorage.getItem("bm11.challenge.v1"))).toBeNull();

  // A tampered link is ignored: normal game, no challenge banner.
  const p3 = await (await browser.newContext()).newPage();
  await p3.goto("/play?c=legends-ENG.nonsense&vs=3-2");
  await expect(p3.locator("#fl-daily")).toBeHidden();
});
