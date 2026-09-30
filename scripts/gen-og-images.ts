/**
 * gen-og-images.ts — renders the Floodlit link-preview images (1200×630)
 * into public/:
 *
 *   public/og-image.png   the default preview for every page
 *   public/og/<u>-<h>.png one per series scoreline (5-0 … 0-5, 2-2),
 *                         used by the /r/<u>-<h> share pages
 *
 * Each image is an HTML template screenshotted by Playwright's Chromium, so
 * it uses the same Bebas Neue / Inter type and colours as the site. Run it
 * again after changing the look or the scorelines; the PNGs are committed.
 *
 * Usage: npx tsx scripts/gen-og-images.ts
 * Needs Playwright's Chromium (npx playwright install chromium) and network
 * access for Google Fonts.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { SHARE_RESULTS, type ShareResult } from '../src/lib/share-results';
import { floodlightSvg, FLOODLIGHT_VIEWBOX } from '../src/lib/floodlight';

const LIME = '#c6ff3d';
const LOSS = '#ff6b5e';

const FRAME_CSS = `
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1200px; height: 630px; }
  body {
    position: relative; overflow: hidden; background: #04060c; color: #eaf0ff;
    font-family: Inter, system-ui, sans-serif;
  }
  .lights {
    position: absolute; inset: 0;
    background:
      radial-gradient(620px 420px at 4% -14%, rgba(180, 220, 255, 0.30), transparent 62%),
      radial-gradient(620px 420px at 96% -14%, rgba(180, 220, 255, 0.30), transparent 62%),
      radial-gradient(1100px 300px at 50% 118%, rgba(40, 160, 90, 0.42), transparent 70%);
  }
  /* floodlight pylons (src/lib/floodlight.ts), one in each top corner,
     their light falling in toward the pitch */
  .pylon { position: absolute; top: 0; width: 720px; height: 630px; }
  .pylon.l { left: -18px; }
  .pylon.r { right: -18px; transform: scaleX(-1); }
  /* a faint pitch strip rising from the bottom edge */
  .pitch {
    position: absolute; left: 50%; bottom: -40px; width: 180px; height: 200px; transform: translateX(-50%) perspective(300px) rotateX(55deg);
    background: linear-gradient(180deg, rgba(210, 190, 120, 0.0), rgba(210, 190, 120, 0.16)); border-radius: 6px;
  }
  .brand {
    position: absolute; top: 40px; left: 0; right: 0; text-align: center;
    font: 400 34px/1 'Bebas Neue', sans-serif; letter-spacing: 0.14em;
  }
  .foot {
    position: absolute; bottom: 34px; left: 0; right: 0; text-align: center;
    font: 600 22px/1 Inter, sans-serif; letter-spacing: 0.26em; text-transform: uppercase; color: #9aa6c4;
  }
  .foot b { color: ${LIME}; font-weight: 700; }
  .display { font-family: 'Bebas Neue', sans-serif; font-weight: 400; }
`;


function page(body: string, extraCss = ''): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@500;600;700&display=block" rel="stylesheet">
<style>${FRAME_CSS}${extraCss}</style></head>
<body><div class="lights"></div><div class="pitch"></div>
<svg class="pylon l" viewBox="${FLOODLIGHT_VIEWBOX}">${floodlightSvg('fl')}</svg><svg class="pylon r" viewBox="${FLOODLIGHT_VIEWBOX}">${floodlightSvg('fr')}</svg>
${body}</body></html>`;
}

function defaultImage(): string {
  return page(
    `<div class="brand">Beat My 11</div>
     <div class="hero">
       <p class="eyebrow">The all-time Test draft</p>
       <h1 class="display">Can your all-time XI<span>beat the World XI?</span></h1>
       <p class="lede">Spin an era and a nation · Draft eleven · Play five Tests</p>
     </div>
     <div class="foot"><b>beatmy11.com</b></div>`,
    `
    .hero { position: absolute; inset: 104px 190px 96px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
    .eyebrow { font: 600 22px/1 Inter, sans-serif; letter-spacing: 0.32em; text-transform: uppercase; color: #9aa6c4; }
    h1 { margin-top: 18px; font-size: 104px; line-height: 0.9; letter-spacing: 0.02em; }
    h1 span { display: block; color: ${LIME}; text-shadow: 0 0 48px rgba(198, 255, 61, 0.55); }
    .lede { margin-top: 26px; font: 500 26px/1.3 Inter, sans-serif; color: #c9d2ea; }
    `,
  );
}

function resultImage(r: ShareResult): string {
  const pips = [
    ...Array(r.user).fill('w'),
    ...Array(r.draws).fill('d'),
    ...Array(r.house).fill('l'),
  ]
    .map((k) => `<i class="pip ${k}"></i>`)
    .join('');
  const won = r.user > r.house;
  const lost = r.user < r.house;
  return page(
    `<div class="brand">Beat My 11 · The five-Test series</div>
     <div class="hero">
       <h1 class="display head">${r.imageHeadline}</h1>
       <div class="score display">
         <div class="side ${won ? 'win' : ''}"><span class="num">${r.user}</span><span class="lab">Me</span></div>
         <span class="dash">–</span>
         <div class="side ${lost ? 'loss' : ''}"><span class="num">${r.house}</span><span class="lab">World XI</span></div>
       </div>
       <div class="pips">${pips}</div>
     </div>
     <div class="foot">Can your all-time XI do better? <b>beatmy11.com</b></div>`,
    `
    .hero { position: absolute; inset: 96px 190px 88px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
    .head { max-width: 820px; white-space: nowrap; font-size: ${r.imageHeadline.length > 20 ? 76 : 88}px; line-height: 0.9; letter-spacing: 0.03em;
      color: ${won ? LIME : '#eaf0ff'}; ${won ? 'text-shadow: 0 0 44px rgba(198, 255, 61, 0.55);' : ''} }
    .score { display: flex; align-items: center; gap: 34px; margin-top: 6px; }
    .side { display: flex; flex-direction: column; align-items: center; min-width: 170px; }
    .num { font-size: 210px; line-height: 0.86; }
    .lab { font: 600 20px/1 Inter, sans-serif; letter-spacing: 0.24em; text-transform: uppercase; color: #9aa6c4; }
    .side.win .num { color: ${LIME}; text-shadow: 0 0 50px rgba(198, 255, 61, 0.5); }
    .side.loss .num { color: ${LOSS}; }
    .dash { font-size: 120px; color: #6b7694; margin-top: -40px; }
    .pips { display: flex; gap: 12px; margin-top: 22px; }
    .pip { width: 46px; height: 12px; border-radius: 6px; }
    .pip.w { background: ${LIME}; box-shadow: 0 0 14px rgba(198, 255, 61, 0.6); }
    .pip.l { background: ${LOSS}; }
    .pip.d { background: #2a3350; border: 2px solid #9aa6c4; }
    `,
  );
}

async function main() {
  mkdirSync('public/og', { recursive: true });
  const browser = await chromium.launch();
  const tab = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  const shoot = async (html: string, path: string) => {
    await tab.setContent(html, { waitUntil: 'networkidle' });
    await tab.evaluate(() => document.fonts.ready);
    await tab.screenshot({ path, type: 'png' });
    console.log('wrote', path);
  };
  await shoot(defaultImage(), 'public/og-image.png');
  for (const r of SHARE_RESULTS) await shoot(resultImage(r), `public/og/${r.slug}.png`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
