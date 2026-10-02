/**
 * check-live-headers.mjs — opens a DEPLOYED copy of the site (a preview build or the live site)
 * in Chromium and checks that the security headers are sent and that the Content-Security-Policy
 * blocks nothing the site needs: every page type is loaded, one full draft is played to the
 * result page in each format, and Pick any XI is opened. Any blocked resource, console error or
 * page error fails the run. Read-only: it posts nothing except the site's own anonymous counters.
 *
 * Usage: node scripts/check-live-headers.mjs https://<branch>-beatmy11.shivvrudra.workers.dev
 */
import { chromium } from '@playwright/test';

const base = (process.argv[2] || 'https://beatmy11.com').replace(/\/$/, '');
const WANT = ['strict-transport-security', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy', 'content-security-policy'];
const PAGES = ['/', '/play', '/pick', '/odi/', '/odi/play', '/odi/pick', '/t20i/', '/t20i/play', '/t20i/pick', '/ipl/', '/ipl/play', '/ipl/pick',
  '/best-xi/', '/best/', '/privacy', '/r/3-2', '/ipl/r/2-3', '/share-demo', '/no-such-page'];

const problems = [];
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 393, height: 760 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
const page = await context.newPage();
// The preview's own origin is not on the API allow-list, so its counters answer 403: expected.
const expected = (t) => /api\/(events|scores)/.test(t) || /status of 403/.test(t) || (/status of 404/.test(t) && page.url().includes('no-such-page'));
page.on('console', (m) => { if (m.type() === 'error' && !expected(m.text())) problems.push(`${page.url()}: console error: ${m.text()}`); });
page.on('pageerror', (e) => problems.push(`${page.url()}: page error: ${e.message}`));
await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP blocked ${e.violatedDirective} ${e.blockedURI}`)));

const res = await page.goto(base + '/');
const headers = res.headers();
for (const h of WANT) if (!headers[h]) problems.push(`missing header: ${h}`);
console.log(WANT.map((h) => `${h}: ${headers[h] ?? '(missing)'}`).join('\n'));
const asset = await page.request.get(base + '/favicon.svg');
if (!asset.headers()['x-content-type-options']) problems.push('static files do not carry the headers');
const health = await page.request.get(base + '/api/health');
console.log(`/api/health: ${health.status()} ${await health.text()}`);
if (health.status() !== 200) problems.push('/api/health did not answer 200');

for (const p of PAGES) {
  await page.goto(base + p);
  await page.waitForTimeout(400);
}
console.log(`loaded ${PAGES.length} pages`);

// One naive draft per format, through to the result page and its share card.
async function place() {
  const rows = page.locator('.bm11-prow[data-bm11-select]:not(.is-picked):not(.is-off):not(.is-blocked)');
  const n = await rows.count();
  for (let i = 0; i < n; i++) {
    await rows.nth(i).click();
    const glow = page.locator('.bm11-fslot.is-glow');
    try { await glow.first().waitFor({ state: 'visible', timeout: 1500 }); } catch { continue; }
    await glow.first().click();
    const chooser = page.locator('#bm11-role-chooser');
    try { await chooser.waitFor({ state: 'visible', timeout: 1200 }); await chooser.locator('[data-bm11-chooser-role]').first().click(); } catch { /* placed directly */ }
    return true;
  }
  return false;
}
for (const f of ['', '/odi', '/t20i', '/ipl']) {
  let done = false;
  for (let attempt = 0; attempt < 4 && !done; attempt++) {
    await page.goto(`${base}${f}/play`);
    await page.evaluate(() => { localStorage.removeItem('beatmy11.draft.v1'); localStorage.removeItem('beatmy11.userXI.v1'); });
    await page.reload();
    let stuck = false;
    for (let round = 0; round < 6 && !stuck; round++) {
      await page.locator('#bm11-spin').click();
      await page.locator('.bm11-prow[data-bm11-select]').first().waitFor();
      for (let i = 0; i < (round === 0 ? 1 : 2); i++) if (!(await place())) { stuck = true; break; }
    }
    done = !stuck;
  }
  if (!done) { problems.push(`${f || '/test'}: could not complete a draft`); continue; }
  await page.locator('#bm11-cta').click();
  await page.waitForURL('**/matchup**');
  await page.locator('.rs.is-revealed').waitFor({ timeout: 15000 });
  await page.waitForFunction(() => document.getElementById('rs-card-img')?.naturalWidth === 1080, null, { timeout: 15000 })
    .catch(() => problems.push(`${f || '/test'}: the share card was not drawn (blob: or data: image blocked?)`));
  console.log(`${f || '/test'}: draft, result and share card work`);
}
await browser.close();
console.log(`\nproblems: ${problems.length}`);
for (const p of problems) console.log(`  ${p}`);
process.exit(problems.length ? 1 : 0);
