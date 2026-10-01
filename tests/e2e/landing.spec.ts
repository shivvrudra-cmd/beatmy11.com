import { expect, test } from "@playwright/test";

// /odi/, /t20i/, /ipl/: readable pages about each game, with the fixed opponent and links to play.
for (const f of [
  { id: "odi", label: "ODI", opponent: "World XI", has: "Viv Richards" },
  { id: "t20i", label: "T20I", opponent: "World XI", has: "Rashid Khan" },
  { id: "ipl", label: "IPL", opponent: "All-Star XI", has: "Lasith Malinga" },
]) {
  test(`${f.id} landing page`, async ({ page }) => {
    await page.goto(`/${f.id}/`);
    await expect(page.locator("meta[name=robots]")).toHaveCount(0);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toContainText(`Can your ${f.label} XI beat the ${f.opponent}?`);
    await expect(page.locator(".fl-land-xi li")).toHaveCount(11);
    await expect(page.locator(".fl-land-xi")).toContainText(f.has);
    await expect(page.locator(".fs-cta").first()).toHaveAttribute("href", `/${f.id}/play`);
    const words = (await page.locator("article.fl-land").innerText()).split(/\s+/).length;
    expect(words).toBeGreaterThan(300);
    await page.locator(".fs-cta").first().click();
    await page.waitForURL(`**/${f.id}/play`);
    await expect(page.locator("#bm11-spin")).toBeVisible();
  });
}

test("the home page and the pick page link to the landing pages", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Test, ODI, T20I and IPL/);
  for (const id of ["odi", "t20i", "ipl"]) await expect(page.locator(`.hm-dailies a[href="/${id}/"]`)).toBeVisible();
  await page.goto("/ipl/pick");
  await expect(page.locator(".pk-about")).toContainText("How Pick any XI works");
  await expect(page.locator('.pk-about a[href="/ipl/"]')).toBeVisible();
});
