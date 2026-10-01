import { expect, test, type Page } from "@playwright/test";

// "Pick any XI" (hidden preview): no spins, any player, play the fixed opponent or a friend's XI.
const FORMATS = [
  { path: "/pick", opponent: "World XI" },
  { path: "/odi/pick", opponent: "World XI" },
  { path: "/t20i/pick", opponent: "World XI" },
  { path: "/ipl/pick", opponent: "All-Star XI" },
];

/** Fills every slot with the n-th available player in that slot's list. */
async function fillXI(page: Page, nth = 0) {
  for (let i = 0; i < 11; i++) {
    await page.locator("[data-pk-slot]").nth(i).click();
    const rows = page.locator(".pk-row:not(.is-off)");
    await rows.first().waitFor();
    await rows.nth(Math.min(nth, (await rows.count()) - 1)).click();
    await expect(page.locator("#pk-sheet")).toBeHidden();
  }
}

for (const f of FORMATS) {
  test(`pick any XI ${f.path}: build, challenge, a friend plays it`, async ({ page, context }) => {
    test.setTimeout(120_000);
    await page.goto(f.path);
    await expect(page.locator("#pk-go-friend")).toBeDisabled();
    await expect(page.locator("#pk-go-world")).toHaveCount(0); // the fixed opponent is not played in this mode
    await expect(page.locator('.pk-m[data-m="all"] em')).toHaveText("–"); // no strength until all eleven are in

    // Search narrows the list.
    await page.locator("[data-pk-slot]").first().click();
    const before = await page.locator(".pk-row").count();
    await page.locator("#pk-q").fill("zzzz");
    await expect(page.locator(".pk-empty")).toBeVisible();
    await page.locator("#pk-q").fill("");
    await expect(page.locator(".pk-row")).toHaveCount(before);
    await page.locator("[data-pk-close]").first().click({ position: { x: 5, y: 5 } });

    await fillXI(page);
    await expect(page.locator('.pk-m[data-m="all"] em')).not.toHaveText("–");
    await page.locator("#pk-name").fill("Asha");

    await expect(page.locator("#pk-go-friend")).toHaveText("Challenge a friend");
    await expect(page.locator(".pk-slot-stats").first()).toBeVisible();

    // The challenge link: a friend opens it, sees the XI, picks their own and plays it.
    const vs = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith("beatmy11.pick."))!)!);
      return Object.values(s.slots as Record<string, { key: string; role: string }>);
    });
    expect(vs).toHaveLength(11);
    const code: Record<string, string> = { opener: "o", "middle-order": "b", wicketkeeper: "w", "all-rounder": "a", spinner: "s", "fast-bowler": "f" };
    const link = `${f.path}?vs=${vs.map((e) => `${e.key}.${code[e.role]}`).join(",")}&n=Asha`;

    const friend = await context.newPage();
    await friend.goto(link);
    await friend.evaluate(() => localStorage.clear());
    await friend.reload();
    await expect(friend.locator("#pk-vs-title")).toHaveText("Can you beat Asha's XI?");
    await expect(friend.locator("#pk-vs-list li")).toHaveCount(11);
    await fillXI(friend, 1);
    await friend.locator("#pk-name").fill("Ravi");
    await expect(friend.locator("#pk-go-friend")).toHaveText("Play Asha's XI");
    await friend.locator("#pk-go-friend").click();
    await expect(friend.locator("#pk-result")).toHaveClass(/is-done/, { timeout: 10_000 });
    await expect(friend.locator("#pk-r-them-lab")).toHaveText("Asha's XI");
    await expect(friend.locator(".pk-test")).toHaveCount(5);
    await expect(friend.locator(".pk-duel")).toHaveCount(11);
    const fuN = Number(await friend.locator("#pk-r-me").textContent());
    const fhN = Number(await friend.locator("#pk-r-them").textContent());
    expect(fuN + fhN).toBeGreaterThanOrEqual(4);
    expect(fuN + fhN).toBeLessThanOrEqual(5);
    await expect(friend.locator("#pk-h2h")).toContainText("Asha");
    const fu = await friend.locator("#pk-r-me").textContent();
    const fh = await friend.locator("#pk-r-them").textContent();

    // The result link shows the same series to anyone who opens it.
    const mine = await friend.evaluate(() => {
      const s = JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith("beatmy11.pick."))!)!);
      return Object.values(s.slots as Record<string, { key: string; role: string }>);
    });
    const viewer = await context.newPage();
    await viewer.goto(`${link}&me=${mine.map((e) => `${e.key}.${code[e.role]}`).join(",")}&m=Ravi`);
    await expect(viewer.locator("#pk-result")).toHaveClass(/is-done/, { timeout: 10_000 });
    await expect(viewer.locator("#pk-r-me-lab")).toHaveText("Ravi's XI");
    await expect(viewer.locator("#pk-r-me")).toHaveText(fu!);
    await expect(viewer.locator("#pk-r-them")).toHaveText(fh!);
    // A broken link falls back to a normal empty page.
    await viewer.goto(`${f.path}?vs=not-a-real-xi`);
    await expect(viewer.locator("#pk-vs")).toBeHidden();
  });
}
