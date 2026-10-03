import { expect, test, type Page } from "@playwright/test";

// Pick any XI, "Beat the clock" (opt-in): 90 seconds to pick eleven. Off unless turned on.
async function pick(page: Page, slot: number) {
  await page.locator("[data-pk-slot]").nth(slot).click();
  const rows = page.locator(".pk-row:not(.is-off)");
  await rows.first().waitFor();
  await rows.first().click();
  await expect(page.locator("#pk-sheet")).toBeHidden();
}

test("pick any XI: the clock is opt-in, locks the XI at zero, and stops when eleven are in", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ viewport: { width: 393, height: 760 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.clock.install();
  await page.goto("/t20i/pick");

  // Off by default: no timer, and a pick made now is kept.
  await expect(page.locator("#pk-clock-btn")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#pk-clock-time")).toBeHidden();
  await pick(page, 0);
  await expect(page.locator(".pk-slot.is-filled")).toHaveCount(1);

  // Turning it on starts from an empty XI with 1:30 on the clock.
  await page.locator("#pk-clock-btn").click();
  await expect(page.locator("#pk-clock-time")).toHaveText("1:30");
  await expect(page.locator(".pk-slot.is-filled")).toHaveCount(0);
  await pick(page, 0);
  await pick(page, 1);
  await page.clock.fastForward(82_000);
  await expect(page.locator("#pk-clock-time")).toHaveText(/^0:0\d$/);
  await expect(page.locator("#pk-clock-time")).toHaveClass(/is-low/);

  // Time runs out with the picker open: it closes, the XI is locked, the challenge stays off.
  await page.locator("[data-pk-slot]").nth(2).click();
  await expect(page.locator("#pk-sheet")).toBeVisible();
  await page.clock.fastForward(10_000);
  await expect(page.locator("#pk-clock-time")).toHaveText("Time’s up");
  await expect(page.locator("#pk-sheet")).toBeHidden();
  await expect(page.locator("#pk-msg")).toContainText("Time’s up with 2 of 11 in");
  await page.locator("[data-pk-slot]").nth(2).click();
  await expect(page.locator("#pk-sheet")).toBeHidden();
  await expect(page.locator("#pk-msg")).toContainText("locked");
  await expect(page.locator("#pk-go-friend")).toBeDisabled();
  if (process.env.BM11_SHOTS) await page.screenshot({ path: "docs/previews/pick-clock-393x760.png" });

  // "Clear my XI" starts a fresh 90 seconds; eleven in before zero stops the clock.
  await page.locator("#pk-clear").click();
  await expect(page.locator("#pk-clock-time")).toHaveText("1:30");
  for (let i = 0; i < 11; i++) await pick(page, i);
  await expect(page.locator("#pk-msg")).toContainText(/Eleven in with \d+ seconds? left/);
  await expect(page.locator("#pk-go-friend")).toBeEnabled();
  // A challenge sent now says it was picked against the clock, and the friend sees that.
  // (The card picture is drawn first, so the share call arrives a moment after the tap.)
  await page.evaluate(() => {
    (window as any).__sharedUrl = "";
    (navigator as any).share = (d: { url?: string }) => { (window as any).__sharedUrl = d.url ?? ""; return Promise.resolve(); };
    document.getElementById("pk-go-friend")!.click();
  });
  await expect.poll(() => page.evaluate(() => (window as any).__sharedUrl)).not.toBe("");
  const sharedUrl: string = await page.evaluate(() => (window as any).__sharedUrl);
  expect(sharedUrl).toMatch(/[?&]vs=.+&t=1$/);
  const friend = await context.newPage();
  await friend.goto(sharedUrl.replace(/^https?:\/\/[^/]+/, ""));
  await expect(friend.locator("#pk-vs-clock")).toBeVisible();
  await friend.goto(sharedUrl.replace(/^https?:\/\/[^/]+/, "").replace("&t=1", ""));
  await expect(friend.locator("#pk-vs-clock")).toBeHidden();
  await friend.close();
  const stopped = await page.locator("#pk-clock-time").textContent();
  await page.clock.fastForward(120_000);
  await expect(page.locator("#pk-clock-time")).toHaveText(stopped!);

  // Turning it off unlocks the XI and keeps the picks. It is not remembered on the next visit.
  await page.locator("#pk-clock-btn").click();
  await expect(page.locator("#pk-clock-time")).toBeHidden();
  await expect(page.locator(".pk-slot.is-filled")).toHaveCount(11);
  await page.locator("[data-pk-slot]").nth(0).click();
  await expect(page.locator("#pk-sheet")).toBeVisible();
  await page.reload();
  await expect(page.locator("#pk-clock-btn")).toHaveAttribute("aria-pressed", "false");
  await context.close();
});
