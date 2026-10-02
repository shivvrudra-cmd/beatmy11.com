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

    // The bars have not filled while the player was still on screen 1...
    expect(await page.locator("#rs-grade-panel").getAttribute("class")).not.toContain("is-graded");
    expect(await page.locator("#rs-strength .rs-bar-val").first().textContent()).toBe("0");
    // ...they fill once the player goes down to screen 2.
    await page.evaluate(() => window.scrollTo(0, window.innerHeight));
    await expect(page.locator("#rs-grade-panel")).toHaveClass(/is-graded/, { timeout: 8000 });
    // The share card arrives without moving anything on screen 3.
    await expect.poll(() => page.locator("#rs-card-img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1080);
    const after = await layout(page);
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
  await page.evaluate(() => window.scrollTo(0, window.innerHeight));
  await expect(page.locator(".rs")).toHaveClass(/is-revealed/);
  await expect(page.locator("#rs-tests li")).toHaveCount(5);
  await expect(page.locator("#rs-grade-title")).toBeVisible();
  await context.close();
});
