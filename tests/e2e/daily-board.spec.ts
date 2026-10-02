import { expect, test, type Page } from "@playwright/test";
import { draftFullXI } from "./helpers";

// Daily leaderboard pages (PROPOSAL, docs/plans/daily-leaderboard.md). The dev server has no
// Worker, so /api/daily is stood in for here; the Worker itself is tested in tests/worker.test.ts.

/** A stand-in board API that records what the page sends. */
async function fakeBoard(page: Page, entries: { name: string; score: number; user: number; house: number }[]) {
  const posts: Record<string, unknown>[] = [];
  await page.route("**/api/daily**", async (route) => {
    const req = route.request();
    if (req.method() === "POST") {
      posts.push(JSON.parse(req.postData() || "{}"));
      const b = posts[posts.length - 1] as { name: string; score: number; user: number; house: number };
      entries.push({ name: b.name, score: b.score, user: b.user, house: b.house });
      await route.fulfill({ status: 204 });
      return;
    }
    const url = new URL(req.url());
    const sorted = [...entries].sort((a, b) => b.score - a.score);
    const score = url.searchParams.get("score");
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        day: "x", format: "test", total: sorted.length, beat: sorted.filter((e) => e.user > e.house).length,
        entries: sorted.slice(0, 50).map((e, i) => ({ rank: i + 1, ...e })),
        ...(score ? { rank: sorted.filter((e) => e.score > Number(score)).length + 1 } : {}),
      }),
    });
  });
  return posts;
}

test("daily result: with no board available nothing about it is shown or sent", async ({ page }) => {
  test.setTimeout(150_000);
  let calls = 0;
  await page.route("**/api/daily**", async (route) => { calls++; await route.fulfill({ status: 500, body: "{}" }); });
  await page.goto("/play?daily=1");
  await draftFullXI(page);
  await page.locator("#bm11-cta").click();
  await page.waitForURL("**/matchup**");
  await expect(page.locator("#rs-daily")).toContainText("Daily Challenge #");
  await page.waitForTimeout(800);
  await expect(page.locator("#rs-board")).toBeHidden();
  expect(calls).toBe(1); // one read to see whether a board exists; nothing posted
});

test("daily result: adding a score is the player's choice, sends only the result, then shows the standing", async ({ page }) => {
  test.setTimeout(150_000);
  const others = [
    { name: "Asha", score: 99, user: 5, house: 0 }, { name: "", score: 12, user: 0, house: 5 }, { name: "<img src=x onerror=alert(1)>", score: 11, user: 1, house: 4 },
    { name: "Ravi", score: 10, user: 2, house: 3 }, { name: "Mo", score: 9, user: 3, house: 2 },
  ];
  const posts = await fakeBoard(page, others);
  await page.goto("/play?daily=1");
  await draftFullXI(page);
  await page.locator("#bm11-cta").click();
  await page.waitForURL("**/matchup**");
  await expect(page.locator("#rs-board-add")).toBeVisible();
  expect(posts.length, "nothing is sent before the button is pressed").toBe(0);

  await page.locator("#rs-board-name").fill("Shiva");
  await page.locator("#rs-board-add").click();
  await expect(page.locator("#rs-board")).toContainText("You are 2nd of 6 today.");
  expect(posts.length).toBe(1);
  const sent = posts[0] as Record<string, unknown>;
  expect(Object.keys(sent).sort()).toEqual(["draws", "format", "house", "name", "player", "score", "user", "xi"]);
  expect(sent.format).toBe("test");
  expect(sent.name).toBe("Shiva");
  expect(String(sent.player)).toMatch(/^[0-9a-f]{32}$/);
  expect(String(sent.xi)).toMatch(/^[0-9a-f]{8}$/);
  expect(Number(sent.score)).toBeGreaterThan(0);
  expect(Number(sent.score)).toBeLessThanOrEqual(100);

  // Coming back to the result: no second entry is offered.
  await page.reload();
  await expect(page.locator("#rs-board")).toContainText("of 6 today");
  await expect(page.locator("#rs-board-add")).toHaveCount(0);

  // The board page lists the entries; a name is shown as text, never run as markup.
  await page.locator('#rs-board a').click();
  await page.waitForURL("**/daily-board**");
  await expect(page.locator("#db-list li")).toHaveCount(6);
  await expect(page.locator("#db-list li").first()).toContainText("Asha");
  await expect(page.locator("#db-list li").nth(1)).toContainText("Shiva");
  await expect(page.locator("#db-list")).toContainText("Anonymous");
  await expect(page.locator("#db-list")).toContainText("<img src=x onerror=alert(1)>");
  expect(await page.locator("#db-list img").count()).toBe(0);
  await expect(page.locator("#db-line")).toContainText("6 on today’s board. 33% beat the World XI.");
  await page.locator('.db-tab[data-db-format="ipl"]').click();
  await expect(page.locator("#db-play")).toHaveAttribute("href", "/ipl/play?daily=1");
});

test("daily result: Do Not Track means no button and nothing sent", async ({ browser }) => {
  test.setTimeout(150_000);
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.addInitScript(() => Object.defineProperty(navigator, "doNotTrack", { value: "1" }));
  const posts = await fakeBoard(page, [{ name: "Asha", score: 99, user: 5, house: 0 }]);
  await page.goto("/play?daily=1");
  await draftFullXI(page);
  await page.locator("#bm11-cta").click();
  await page.waitForURL("**/matchup**");
  await expect(page.locator("#rs-board")).toContainText("See the board");
  await expect(page.locator("#rs-board-add")).toHaveCount(0);
  expect(posts.length).toBe(0);
  await context.close();
});
