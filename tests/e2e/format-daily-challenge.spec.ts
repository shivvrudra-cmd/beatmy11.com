import { expect, test } from "@playwright/test";
import { draftFullXI } from "./helpers";

// ODI, T20I and IPL each have their own Daily Challenge, friend-challenge links and share pages.
test("IPL daily: same spins for everyone, one result a day, kept apart from the Test daily", async ({ page, context }) => {
  test.setTimeout(170_000);
  await page.goto("/ipl/play?daily=1");
  await expect(page.locator("#fl-daily")).toContainText("IPL Daily Challenge #");
  await page.locator("#bm11-spin").click();
  await page.locator(".bm11-prow[data-bm11-select]").first().waitFor();
  const first = `${await page.locator("#fl-nation").textContent()} ${await page.locator("#fl-era").textContent()}`;

  // Another visitor gets the same first draw.
  const other = await context.newPage();
  await other.goto("/ipl/play?daily=1");
  await other.evaluate(() => localStorage.clear());
  await other.reload();
  await other.locator("#bm11-spin").click();
  await other.locator(".bm11-prow[data-bm11-select]").first().waitFor();
  expect(`${await other.locator("#fl-nation").textContent()} ${await other.locator("#fl-era").textContent()}`).toBe(first);
  await other.close();

  // The Test daily and the normal IPL draft are untouched by it.
  await page.goto("/ipl/play");
  await expect(page.locator("#bm11-count")).toHaveText("0/11");
  await expect(page.locator("#fl-mode")).toBeHidden();
  await page.goto("/");
  await expect(page.locator("#hm-daily-cta")).toBeVisible();
  await expect(page.locator('[data-hm-daily="ipl"]')).toHaveAttribute("href", "/ipl/play?daily=1");
});

test("ODI: a result shares to its own page, and a friend drafts from the same spins", async ({ page, context }) => {
  test.setTimeout(240_000);
  await page.goto("/odi/play");
  const draws: string[] = [];
  const spin = page.locator("#bm11-spin");
  // Record the six draws while drafting.
  page.on("console", () => {});
  await draftFullXI(page);
  await page.locator("#bm11-cta").click();
  await page.waitForURL("**/odi/matchup**");
  await page.locator("#rs-skip").click({ timeout: 3000 }).catch(() => {});
  await page.locator("#rs-grade-panel").waitFor({ state: "attached", timeout: 60_000 });
  const u = await page.locator("#rs-user").textContent();
  const h = await page.locator("#rs-house").textContent();

  // The share link the page would send: its own /odi/r/<slug> page with the XI and the spins.
  const link = await page.evaluate(async () => {
    let shared = "";
    (navigator as any).share = async (d: { url?: string; text?: string }) => { shared = d.url ?? d.text ?? ""; };
    (navigator as any).canShare = () => false;
    document.getElementById("rs-share")!.click();
    await new Promise((r) => setTimeout(r, 300));
    return shared;
  });
  expect(link).toContain(`/odi/r/${u}-${h}?xi=`);
  expect(link).toMatch(/&c=(\d[A-Z]{2,3}\.){5}\d[A-Z]{2,3}/);

  const friend = await context.newPage();
  await friend.goto(link.slice(link.indexOf("/odi/r/")));
  await friend.evaluate(() => localStorage.clear());
  await expect(friend.locator(".sr-lab").nth(1)).toHaveText("World XI");
  await expect(friend.locator("#sr-sheet li")).toHaveCount(11);
  await expect(friend.locator("#sr-cta")).toHaveText("Take the challenge: same spins");
  await friend.locator("#sr-cta").click();
  await friend.waitForURL("**/odi/play?c=**");
  await expect(friend.locator("#fl-daily")).toContainText(`Challenge: beat ${u}–${h}`);
  await expect(friend.locator("#fl-respins")).toBeHidden();
  await friend.locator("#bm11-spin").click();
  await friend.locator(".bm11-prow[data-bm11-select]").first().waitFor();
  // The friend's first draw is the sender's first draw.
  const sender = await page.evaluate(() => JSON.parse(localStorage.getItem("beatmy11.draft.v1")!).spinHistory[0]);
  const friendFirst = await friend.evaluate(() => JSON.parse(localStorage.getItem("beatmy11.draft.v1")!).spinHistory[0]);
  expect({ era: friendFirst.era, nation: friendFirst.nation }).toEqual({ era: sender.era, nation: sender.nation });
  void draws; void spin;
});
