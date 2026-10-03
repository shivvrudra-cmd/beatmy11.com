import { expect, test, type Page } from "@playwright/test";
import { placeNextPlayer } from "./helpers";

// ODI, T20I and IPL drafts: the role tabs are a native sideways pager (owner, 2026-10-02). The
// list follows the finger, the lit tab follows the list, and a first-time cue says it swipes.

/** The role on screen in the pager, the lit tab, and whether the pager rests exactly on a page. */
const pagerState = (page: Page) =>
  page.evaluate(() => {
    const pager = document.getElementById("fl-pager")!;
    const pages = [...pager.children] as HTMLElement[];
    const index = Math.round(pager.scrollLeft / pager.clientWidth);
    return {
      pages: pages.map((p) => p.getAttribute("data-bm11-page")),
      shown: pages[index]?.getAttribute("data-bm11-page"),
      lit: document.querySelector(".fl-tab.is-on")?.getAttribute("data-bm11-tab"),
      settled: Math.abs(pager.scrollLeft - index * pager.clientWidth) < 2,
      pageScrollY: window.scrollY,
      docFits: document.scrollingElement!.scrollHeight <= window.innerHeight + 1,
    };
  });

/**
 * Waits until the pager has really stopped: its position unchanged for 250 ms. "Within 2 px of a
 * page" is not enough: a swipe's glide can still be running, and on a phone a tap that lands on a
 * gliding list only stops the glide, it does not press the tab (the cause of the old intermittent
 * failure, found 2026-10-03; it is how touch screens work, not a bug in the page).
 */
const waitIdle = async (page: Page) => {
  let same = 0;
  let last = -1;
  for (let i = 0; i < 80 && same < 5; i++) {
    const now = await page.evaluate(() => document.getElementById("fl-pager")!.scrollLeft);
    same = now === last ? same + 1 : 0;
    last = now;
    await page.waitForTimeout(50);
  }
};

test("role tabs: swipe between roles, the tab follows, the cue goes away for good", async ({ browser }) => {
  test.setTimeout(150_000);
  const context = await browser.newContext({ viewport: { width: 393, height: 760 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto("/odi/play");
  await page.locator("#bm11-spin").click();
  await page.locator(".bm11-prow[data-bm11-select]").first().waitFor();

  const start = await pagerState(page);
  expect(start.pages.length).toBeGreaterThan(2);
  expect(start.shown).toBe(start.lit);
  expect(start.docFits, "the draft is still one screen").toBe(true);
  await expect(page.locator("#fl-swipe-hint")).toBeVisible();

  // A real touch swipe to the left on the list (the browser does the scrolling and snapping).
  const box = (await page.locator("#fl-pager").boundingBox())!;
  const cdp = await context.newCDPSession(page);
  // A finger drag across the list: start, ten moves, lift.
  const swipe = async (dx: number) => {
    const y = Math.round(box.y + box.height / 2);
    const x0 = Math.round(box.x + box.width / 2 - dx / 2);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] });
    for (let i = 1; i <= 10; i++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (dx * i) / 10, y }] });
      await page.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  await swipe(-260);
  await expect.poll(async () => (await pagerState(page)).shown).toBe(start.pages[1]);
  await expect.poll(async () => (await pagerState(page)).settled).toBe(true);
  let s = await pagerState(page);
  expect(s.lit, "the lit tab follows the list").toBe(start.pages[1]);
  expect(s.pageScrollY).toBe(0);
  await expect(page.locator("#fl-swipe-hint")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("beatmy11.swipeHint.v1"))).toBe("1");

  // Swipe back to the right.
  await swipe(260);
  await expect.poll(async () => (await pagerState(page)).lit).toBe(start.pages[0]);
  await expect.poll(async () => (await pagerState(page)).settled).toBe(true);

  // Tapping a tab slides the list to that role. Wait until the swipe's glide has fully stopped:
  // a tap on a gliding list only stops it (see waitIdle). The retry stays as a logged safety net.
  const last = start.pages[start.pages.length - 1]!;
  await waitIdle(page);
  let taps = 0;
  await expect(async () => {
    taps++;
    await page.locator(`[data-bm11-tab="${last}"]`).tap();
    await expect.poll(async () => (await pagerState(page)).shown, { timeout: 2500 }).toBe(last);
  }).toPass({ timeout: 12_000 });
  if (taps > 1) console.log(`RETRY: role-tab tap needed ${taps} taps`);
  await expect.poll(async () => (await pagerState(page)).settled).toBe(true);
  expect((await pagerState(page)).lit).toBe(last);

  // A tab the player opened stays open when a player is selected (the list is redrawn).
  const row = page.locator(`[data-bm11-page="${last}"] .bm11-prow`).first();
  await row.tap();
  s = await pagerState(page);
  expect(s.shown).toBe(last);
  expect(s.lit).toBe(last);
  await row.tap(); // deselect

  // A long list scrolls up and down inside its own page, and keeps its place across a redraw.
  const tall = await page.evaluate(() => {
    const pg = [...document.querySelectorAll<HTMLElement>(".fl-page")].find((p) => p.scrollHeight > p.clientHeight + 40);
    return pg ? pg.getAttribute("data-bm11-page") : null;
  });
  if (tall) {
    await page.locator(`[data-bm11-tab="${tall}"]`).tap();
    await expect.poll(async () => (await pagerState(page)).settled && (await pagerState(page)).shown === tall).toBe(true);
    await waitIdle(page);
    await page.evaluate((r) => { document.querySelector<HTMLElement>(`[data-bm11-page="${r}"]`)!.scrollTop = 30; }, tall);
    const pick = page.locator(`[data-bm11-page="${tall}"] .bm11-prow:not(.is-blocked)`).nth(2);
    await pick.tap();
    expect(await page.evaluate((r) => document.querySelector<HTMLElement>(`[data-bm11-page="${r}"]`)!.scrollTop, tall)).toBe(30);
    await pick.tap();
  }

  // The cue does not come back on the next visit.
  await page.goto("/t20i/play");
  await page.locator("#bm11-spin").click();
  await page.locator(".bm11-prow[data-bm11-select]").first().waitFor();
  await expect(page.locator("#fl-pager")).toBeVisible();
  await expect(page.locator("#fl-swipe-hint")).toHaveCount(0);
  await context.close();
});

test("role tabs: through a whole draft the lit tab always matches the list on screen", async ({ browser }) => {
  test.setTimeout(200_000);
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  for (let attempt = 1; ; attempt++) {
    await page.goto("/ipl/play");
    await page.evaluate(() => { localStorage.removeItem("beatmy11.draft.v1"); localStorage.removeItem("beatmy11.userXI.v1"); });
    await page.reload();
    try {
      for (let round = 0; round < 6; round++) {
        await page.locator("#bm11-spin").click();
        await page.locator(".bm11-prow[data-bm11-select]").first().waitFor();
        for (let i = 0; i < (round === 0 ? 1 : 2); i++) {
          await placeNextPlayer(page);
          await expect.poll(async () => (await pagerState(page)).settled).toBe(true);
          const s = await pagerState(page);
          expect(s.lit, `round ${round + 1}: lit tab = list on screen`).toBe(s.shown);
          expect(s.pageScrollY).toBe(0);
          expect(s.docFits, "one screen, no page scroll").toBe(true);
        }
      }
      break;
    } catch (err) {
      if (attempt >= 4 || !String(err).includes("no pool player had a legal slot")) throw err;
    }
  }
  await expect(page.locator("#bm11-count")).toHaveText("11/11");
  await context.close();
});
