import { expect, test, type Page } from "@playwright/test";
import { draftFullXI } from "./helpers";

// The result page on a phone (owner, 2026-10-02): it must never scroll by itself. The three
// screens are one viewport each from the first paint, the player swipes down on their own, and
// only then do the strength bars fill. "BEAT MY 11" sits at the top left of all three screens.
const SIZES = [
  { width: 393, height: 760 },
  { width: 360, height: 640 },
  { width: 320, height: 568 },
];

const layout = (page: Page) =>
  page.evaluate(() => {
    const vh = window.innerHeight;
    const panels = [...document.querySelectorAll<HTMLElement>(".rs-panel")].map((p) => {
      const r = p.getBoundingClientRect();
      // The lowest thing inside the panel must end inside it (nothing spills into the next screen).
      const inner = [...p.querySelectorAll<HTMLElement>("*")]
        .filter((el) => el.offsetParent !== null && getComputedStyle(el).position !== "absolute")
        .reduce((max, el) => Math.max(max, el.getBoundingClientRect().bottom), 0);
      const brand = p.querySelector<HTMLElement>(".rs-brand")?.getBoundingClientRect();
      return {
        top: Math.round(r.top + window.scrollY),
        height: Math.round(r.height),
        spill: Math.round(inner - r.bottom),
        brandLeft: brand ? Math.round(brand.left) : -1,
        brandTop: brand ? Math.round(brand.top - r.top) : -1,
        brandHref: p.querySelector(".rs-brand")?.getAttribute("href") ?? "",
      };
    });
    return { vh, scrollY: Math.round(window.scrollY), scrollH: document.scrollingElement!.scrollHeight, panels };
  });

test("result page on a phone: never scrolls by itself, three steady screens, brand on each", async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({ viewport: SIZES[0], isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/play");
  await draftFullXI(page);
  await expect(page.locator("#bm11-count")).toHaveText("11/11");

  for (const size of SIZES) {
    const label = `${size.width}x${size.height}`;
    await page.setViewportSize(size);
    // The real, animated reveal (no reduced motion): five cards, one at a time.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/matchup");

    // From the first paint the page is exactly three screens tall, and stays so.
    const start = await layout(page);
    expect(start.scrollH, `${label}: three screens from the start`).toBe(3 * start.vh);

    // Watch the scroll position for the whole reveal and two seconds after it.
    await page.evaluate(() => {
      const w = window as unknown as { __maxY: number };
      w.__maxY = 0;
      window.setInterval(() => { w.__maxY = Math.max(w.__maxY, window.scrollY); }, 50);
    });
    await expect(page.locator("#rs-tests li")).toHaveCount(5, { timeout: 15_000 });
    await expect(page.locator(".rs")).toHaveClass(/is-revealed/, { timeout: 5000 });
    await page.waitForTimeout(2000);
    expect(await page.evaluate(() => (window as unknown as { __maxY: number }).__maxY), `${label}: the page never moved`).toBe(0);

    const end = await layout(page);
    expect(end.scrollY).toBe(0);
    expect(end.scrollH, `${label}: still three screens after the reveal`).toBe(3 * end.vh);
    end.panels.forEach((p, i) => {
      expect(p.top, `${label}: screen ${i + 1} starts on a screen boundary`).toBe(i * end.vh);
      expect(p.height, `${label}: screen ${i + 1} is one screen tall`).toBe(end.vh);
      expect(p.spill, `${label}: screen ${i + 1} holds everything in it`).toBeLessThanOrEqual(1);
      expect(p.brandLeft, `${label}: brand at the left of screen ${i + 1}`).toBeLessThanOrEqual(16);
      expect(p.brandTop, `${label}: brand at the top of screen ${i + 1}`).toBeLessThanOrEqual(16);
      expect(p.brandHref).toBe("/");
    });

    // Player of the series carries a series stat, and no match card is cut off by it.
    await expect(page.locator("#rs-pots em i")).toHaveText(/^\d+ (runs|wickets)(, \d+ wickets)?$/);
    const clipped = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".rs-p1 .rs-test, .rs-pots")].filter((c) => c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1).length);
    expect(clipped, `${label}: no match card or the player-of-the-series card is cut off`).toBe(0);
    // The bars have not filled while the player was still on screen 1...
    expect(await page.locator("#rs-grade-panel").getAttribute("class")).not.toContain("is-graded");
    expect(await page.locator("#rs-strength .rs-bar-val").first().textContent()).toBe("0");
    // ...they fill once the player goes down to screen 2.
    await page.evaluate(() => window.scrollTo(0, window.innerHeight));
    await expect(page.locator("#rs-grade-panel")).toHaveClass(/is-graded/, { timeout: 8000 });
    // The share card arrives without moving anything on screen 3.
    await expect.poll(() => page.locator("#rs-card-img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1080);
    // The longest tip allowed (TIP_MAX_CHARS in result-insights.ts) still fits screen 2.
    await page.evaluate(() => { document.getElementById("rs-tip")!.innerHTML = "<b>Tip</b> " + "Your bowling scored 64 and. ".repeat(7).slice(0, 170); });
    const after = await layout(page);
    expect(after.panels[1].spill, `${label}: the longest tip fits screen 2`).toBeLessThanOrEqual(1);
    expect(after.scrollH).toBe(3 * after.vh);
    expect(after.panels[2].spill, `${label}: card and buttons fit screen 3`).toBeLessThanOrEqual(1);
    const card = await page.locator("#rs-card-img").boundingBox();
    expect(card!.height, `${label}: the card is a useful size`).toBeGreaterThan(size.height * 0.5);

    if (process.env.BM11_SHOTS) {
      for (let i = 0; i < 3; i++) {
        await page.evaluate((y) => window.scrollTo(0, y), i * size.height);
        await page.waitForTimeout(400);
        await page.screenshot({ path: `docs/previews/result-${process.env.BM11_SHOTS}-${label}-screen${i + 1}.png` });
      }
    }
  }
  await context.close();
});

test("result page: swiping down before the reveal ends shows the result instead of a blank screen", async ({ browser }) => {
  test.setTimeout(150_000);
  const context = await browser.newContext({ viewport: SIZES[1], isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/play");
  await draftFullXI(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/matchup");
  await expect(page.locator("#rs-tests li")).toHaveCount(1, { timeout: 5000 });
  // A finger lands first (the page ignores scrolls nobody touched), then the page moves.
  await page.evaluate(() => { window.dispatchEvent(new Event("touchstart")); window.scrollTo(0, window.innerHeight); });
  await expect(page.locator(".rs")).toHaveClass(/is-revealed/);
  await expect(page.locator("#rs-tests li")).toHaveCount(5);
  await expect(page.locator("#rs-grade-title")).toBeVisible();
  await context.close();
});

// Owner, 2026-10-03: after a long draft the result page opened on the last screen. It must always
// open on the first screen, even when the browser tries to restore an old scroll position.
test("result page opens on the first screen even after a scrolled reload", async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({ viewport: SIZES[0], isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/play");
  await draftFullXI(page);
  await expect(page.locator("#bm11-count")).toHaveText("11/11");
  await page.goto("/matchup");
  await expect(page.locator("#rs-tests li")).toHaveCount(5, { timeout: 15_000 });
  await page.evaluate(() => window.scrollTo(0, 2 * window.innerHeight));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
  await page.reload();
  await expect(page.locator("#rs-tests li")).toHaveCount(5, { timeout: 15_000 });
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await context.close();
});

// Owner, 2026-10-03 (iPhone): tapping "Draft again" on screen 2 and playing again opened the result
// on screen 2. A scroll position put back by the browser after load must not skip the reveal.
test("result page: a scroll position restored after load is put back at the top", async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({ viewport: SIZES[0], isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto("/play");
  await draftFullXI(page);
  await page.addInitScript(() => {
    // Mimic Safari: scroll down a moment after the page has loaded, with no touch.
    window.addEventListener("load", () => setTimeout(() => window.scrollTo(0, 2 * window.innerHeight), 120));
  });
  await page.goto("/matchup");
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator("#rs-tests li").first()).toBeVisible();
  await context.close();
});
