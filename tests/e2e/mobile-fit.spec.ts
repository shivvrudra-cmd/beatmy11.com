import { expect, test, type Page } from "@playwright/test";
import { placeNextPlayer } from "./helpers";

// Phone screens (CSS pixels of the visible page area). Heights are the space a
// browser actually leaves for the page, toolbars excluded, so they are smaller
// than the phone's full screen.
const PHONES = [
  { name: "iPhone SE (Safari)", width: 375, height: 553 },
  { name: "small Android", width: 360, height: 640 },
  { name: "iPhone 15/16", width: 393, height: 659 },
  { name: "iPhone Pro Max", width: 440, height: 760 },
  { name: "narrow 320", width: 320, height: 568 },
];

/** Everything that must be fully on screen, and the page must not scroll vertically. */
async function expectOneScreen(page: Page, label: string) {
  const m = await page.evaluate(() => {
    const se = document.scrollingElement!;
    const box = (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el || el.offsetParent === null) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
    };
    return {
      vh: window.innerHeight,
      vw: window.innerWidth,
      scrollH: se.scrollHeight,
      scrollW: se.scrollWidth,
      reels: box(".fl-reels"),
      spin: box("#bm11-spin"),
      dock: box(".fl-dock"),
      cards: box("#fl-cards"),
      card: box(".fl-card"),
      // The Spin button's label must fit inside it.
      spinOverflows: (() => {
        const b = document.getElementById("bm11-spin")!;
        return !b.hidden && b.scrollWidth > b.clientWidth + 1;
      })(),
      // Cards whose text spills past their own bottom edge (clipped stats).
      overflowingCards: [...document.querySelectorAll(".fl-card")].filter(
        (c) => (c as HTMLElement).scrollHeight > (c as HTMLElement).clientHeight + 1
      ).length,
    };
  });
  expect(m.scrollH, `${label}: page must not scroll vertically`).toBeLessThanOrEqual(m.vh + 1);
  expect(m.scrollW, `${label}: page must not scroll sideways`).toBeLessThanOrEqual(m.vw + 1);
  expect(m.dock, `${label}: dock visible`).not.toBeNull();
  expect(m.dock!.bottom, `${label}: dock fully on screen`).toBeLessThanOrEqual(m.vh + 1);
  expect(m.spinOverflows, `${label}: Spin button text fits`).toBe(false);
  expect(m.reels!.top, `${label}: reels on screen`).toBeGreaterThanOrEqual(0);
  expect(m.reels!.height, `${label}: reels are big`).toBeGreaterThanOrEqual(70);
  if (m.card) {
    expect(m.card.bottom, `${label}: cards end above the dock`).toBeLessThanOrEqual(m.dock!.top + 1);
    expect(m.card.height, `${label}: cards are a useful size`).toBeGreaterThanOrEqual(130);
    expect(m.overflowingCards, `${label}: no card text cut off`).toBe(0);
  }
  return m;
}

for (const phone of PHONES) {
  test(`mobile one-screen: ${phone.name} ${phone.width}x${phone.height}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: phone.width, height: phone.height },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto("/play");
    await expectOneScreen(page, "before the first spin");

    const spin = page.locator("#bm11-spin");
    for (let round = 0; round < 6; round++) {
      await spin.click();
      await page.locator(".bm11-prow[data-bm11-select]").first().waitFor();
      if (round === 1) await expectOneScreen(page, "after a draft spin (respins showing)");
      for (let i = 0; i < (round === 0 ? 1 : 2); i++) {
        await placeNextPlayer(page);
        // Nothing may scroll the page for the player.
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
      }
      if (round === 2) {
        // Round done: the button still says "Spin" and lights up (enabled) as the cue.
        await expect(spin).toHaveText("Spin");
        await expect(spin).toBeEnabled();
        await expectOneScreen(page, "round done, ready to spin");
      }
    }
    await expect(page.locator("#bm11-count")).toHaveText("11/11");
    await expect(page.locator("#bm11-cta")).toBeVisible();
    const done = await expectOneScreen(page, "XI complete");
    const cta = await page.locator("#bm11-cta").boundingBox();
    expect(cta!.y + cta!.height).toBeLessThanOrEqual(done.vh);

    // The card row still swipes sideways.
    const canSwipe = await page.evaluate(() => {
      const el = document.getElementById("fl-cards")!;
      return el.scrollWidth > el.clientWidth;
    });
    expect(canSwipe).toBe(true);
    await context.close();
  });
}

test("mobile one-screen: daily challenge banner still fits", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 553 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto("/play?daily=1");
  await expect(page.locator("#fl-daily")).toBeVisible();
  await page.locator("#bm11-spin").click();
  await page.locator(".bm11-prow[data-bm11-select]").first().waitFor();
  await expectOneScreen(page, "daily, SE");
  await context.close();
});
