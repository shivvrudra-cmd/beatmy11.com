import { expect, test } from "@playwright/test";
import { draftFullXI } from "./helpers";

// The three white-ball formats are HIDDEN previews: same draft and result screens as the Test
// game, their own data, engine, opponent and saved draft.
const FORMATS = [
  { id: "ipl", teamCap: "Team", eraCap: "Seasons", reel: /^[A-Z]{2,4}$/, opponent: "All-Star XI", noun: "1st match", inHouse: "Malinga" },
  { id: "odi", teamCap: "Nation", eraCap: "Era", reel: /^[A-Za-z ]{3,}$/, opponent: "World XI", noun: "1st ODI", inHouse: "" },
  { id: "t20i", teamCap: "Nation", eraCap: "Era", reel: /^[A-Za-z ]{3,}$/, opponent: "World XI", noun: "1st T20I", inHouse: "" },
];

for (const f of FORMATS) {
  test(`${f.id} (hidden preview): draft a full XI and play the series`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(`/${f.id}/play`);
    await expect(page.locator("meta[name=robots]")).toHaveAttribute("content", "noindex");
    await expect(page.locator("#fl-reel-nation .fl-reel-cap")).toHaveText(f.teamCap);
    await expect(page.locator("#fl-reel-era .fl-reel-cap")).toHaveText(f.eraCap);

    await page.locator("#bm11-spin").click();
    await page.locator(".bm11-prow[data-bm11-select]").first().waitFor();
    await expect(page.locator("#fl-nation")).toHaveText(f.reel);
    await expect(page.locator("#fl-era")).toHaveText(/20\d\d/);
    await expect(page.locator(".fl-card").first()).toContainText(/Mat|SR|Econ/);

    // This format's draft is separate from the Test draft.
    await page.goto("/play");
    await expect(page.locator("#bm11-count")).toHaveText("0/11");
    await expect(page.locator("#fl-reel-nation .fl-reel-cap")).toHaveText("Nation");

    await page.goto(`/${f.id}/play`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await draftFullXI(page);
    await expect(page.locator("#bm11-count")).toHaveText("11/11");
    await expect(page.locator("#bm11-cta")).toHaveAttribute("href", `/${f.id}/matchup`);

    // The series: five matches against the fixed opponent, scored by the white-ball engine.
    await page.locator("#bm11-cta").click();
    await page.waitForURL(`**/${f.id}/matchup**`);
    await expect(page.locator("#rs-error")).toBeHidden();
    await expect(page.locator(".rs-lab").nth(1)).toHaveText(f.opponent);
    await expect(page.locator("#rs-tests li")).toHaveCount(5);
    await expect(page.locator("#rs-tests li").first()).toContainText(f.noun);
    const u = Number(await page.locator("#rs-user").textContent());
    const h = Number(await page.locator("#rs-house").textContent());
    expect(u + h).toBeGreaterThanOrEqual(4);
    expect(u + h).toBeLessThanOrEqual(5);
    // Screen 2: no player ratings; three strength bars, the overall score, a grade and a tip.
    await expect(page.locator(".rs-rating")).toHaveCount(0);
    await page.locator("#rs-grade-panel").scrollIntoViewIfNeeded();
    await expect(page.locator(".rs-bar-val")).toHaveCount(4);
    await expect(page.locator("#rs-grade-panel")).toHaveClass(/is-graded/, { timeout: 8000 });
    for (const t of await page.locator(".rs-bar-val").allTextContents()) expect(Number(t)).toBeGreaterThan(0);
    await expect(page.locator(".rs-grade-letter")).toHaveText(/^(A\+|A|B|C)$/);
    await expect(page.locator("#rs-tip")).toContainText("Tip");
    // Screen 3: the share card carries both XIs (named in its alt text).
    await expect(page.locator("#rs-card-img")).toHaveAttribute("alt", /My XI: .+\. .+ XI: .+/);
    if (f.inHouse) await expect(page.locator("#rs-card-img")).toHaveAttribute("alt", new RegExp(f.inHouse));
    await expect(page.locator("#rs-rank")).toContainText("% of all drafts");

    // "Draft again" returns to this format's draft, and the Test result page still works on its own.
    await expect(page.locator(".rs-p1 .rs-again-bottom")).toHaveAttribute("href", `/${f.id}/play`);
    await page.goto("/matchup");
    await page.waitForURL((url) => url.pathname.startsWith("/play")); // no Test XI drafted
  });
}
