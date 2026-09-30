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
