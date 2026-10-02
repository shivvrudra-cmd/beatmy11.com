import { expect, test, type Page } from "@playwright/test";
import { draftFullXI } from "./helpers";

// Sounds on the result page (2026-10-02). A test cannot hear, so a stand-in audio context counts
// the notes: they play during the reveal when audio is running, never when muted, and never
// while the browser still has audio suspended (queued notes would burst out on the first tap).
const fakeAudio = (state: "running" | "suspended") => `
  window.__notes = 0;
  class FakeParam { setValueAtTime() {} exponentialRampToValueAtTime() {} }
  class FakeNode { constructor() { this.gain = new FakeParam(); this.frequency = new FakeParam(); } connect(n) { return n; } start() { window.__notes++; } stop() {} }
  window.AudioContext = class { constructor() { this.state = "${state}"; this.currentTime = 0; this.destination = {}; }
    createGain() { return new FakeNode(); } createOscillator() { return new FakeNode(); } resume() { return Promise.resolve(); } };
`;
const notes = (page: Page) => page.evaluate(() => (window as unknown as { __notes: number }).__notes);

test("result page sounds: heard when audio runs, silent when muted or suspended", async ({ browser }) => {
  test.setTimeout(200_000);
  const context = await browser.newContext({ viewport: { width: 393, height: 760 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/play");
  await draftFullXI(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // Audio running: each match card, the verdict, the bars and the grade make a sound.
  const running = await context.newPage();
  await running.addInitScript(fakeAudio("running"));
  await running.emulateMedia({ reducedMotion: "no-preference" });
  await running.goto("/matchup");
  await expect(running.locator("#rs-sound")).toHaveAttribute("aria-pressed", "true");
  await expect(running.locator(".rs")).toHaveClass(/is-revealed/, { timeout: 15_000 });
  const afterReveal = await notes(running);
  expect(afterReveal, "five match sounds and a verdict").toBeGreaterThanOrEqual(7);
  await running.evaluate(() => window.scrollTo(0, window.innerHeight));
  await expect(running.locator("#rs-grade-panel")).toHaveClass(/is-graded/, { timeout: 8000 });
  expect(await notes(running), "bars and grade").toBeGreaterThan(afterReveal + 2);
  // The mute button is on screen 1 and does not push it over one screen.
  expect(await running.evaluate(() => document.querySelector(".rs-p1")!.scrollHeight <= window.innerHeight + 1)).toBe(true);

  // Muting silences everything and is remembered (the draft uses the same setting).
  await running.evaluate(() => window.scrollTo(0, 0));
  await running.locator("#rs-sound").tap();
  await expect(running.locator("#rs-sound")).toHaveAttribute("aria-pressed", "false");
  expect(await running.evaluate(() => localStorage.getItem("beatmy11.sound"))).toBe("off");
  await running.reload();
  await expect(running.locator(".rs")).toHaveClass(/is-revealed/, { timeout: 15_000 });
  expect(await notes(running), "muted: no sound").toBe(0);
  await running.evaluate(() => localStorage.setItem("beatmy11.sound", "on"));
  await running.close();

  // Audio still suspended by the browser (no tap yet): nothing is queued.
  const suspended = await context.newPage();
  await suspended.addInitScript(fakeAudio("suspended"));
  await suspended.emulateMedia({ reducedMotion: "no-preference" });
  await suspended.goto("/matchup");
  await expect(suspended.locator(".rs")).toHaveClass(/is-revealed/, { timeout: 15_000 });
  expect(await notes(suspended), "suspended: nothing queued").toBe(0);
  await context.close();
});
