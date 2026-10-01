import type { Page } from "@playwright/test";

/**
 * Picks the first pool player that has at least one legal slot and places
 * them, handling the role chooser when several declarations are legal.
 */
export async function placeNextPlayer(page: Page): Promise<void> {
  // Skip cards already in the XI (tapping one removes it), greyed out, or
  // flagged "Can't fit".
  const rows = page.locator(
    ".bm11-prow[data-bm11-select]:not(.is-picked):not(.is-off):not(.is-blocked)"
  );
  const n = await rows.count();
  for (let i = 0; i < n; i++) {
    await rows.nth(i).click();
    const glow = page.locator(".bm11-fslot.is-glow");
    try {
      await glow.first().waitFor({ state: "visible", timeout: 1500 });
    } catch {
      continue; // this player has no legal slot — try the next row
    }
    await glow.first().click();
    // A multi-role player on a multi-role slot opens the role chooser.
    const chooser = page.locator("#bm11-role-chooser");
    try {
      await chooser.waitFor({ state: "visible", timeout: 2000 });
      await chooser.locator("[data-bm11-chooser-role]").first().click();
    } catch {
      // single legal declaration — placed directly
    }
    return;
  }
  throw new Error("no pool player had a legal slot");
}

/**
 * Plays all six spins and places eleven players.
 *
 * The picks are naive (first card with a legal slot, no thinking ahead), so on an unlucky random
 * draw the draft can dead-end, as it can for a careless player. When that happens the draft is
 * thrown away and started again, a few times, so tests don't fail on the luck of the spin.
 */
export async function draftFullXI(page: Page): Promise<void> {
  const spin = page.locator("#bm11-spin");
  for (let attempt = 1; ; attempt++) {
    try {
      for (let round = 0; round < 6; round++) {
        await spin.click();
        await page.locator(".bm11-prow[data-bm11-select]").first().waitFor();
        for (let i = 0; i < (round === 0 ? 1 : 2); i++) await placeNextPlayer(page);
      }
      return;
    } catch (err) {
      if (attempt >= 4 || !String(err).includes("no pool player had a legal slot")) throw err;
      // Start a fresh draft in the same mode: only the saved draft is cleared.
      await page.evaluate(() => {
        localStorage.removeItem("beatmy11.draft.v1");
        localStorage.removeItem("beatmy11.userXI.v1");
      });
      await page.reload();
    }
  }
}
