/**
 * share-card.ts — draws the shareable result card (1080 × 1350 PNG) in the
 * browser: the floodlit scene, the series scoreline and the user's XI.
 * "Share result" sends this picture with the link, so the XI travels with
 * the result even though link previews are one per scoreline.
 *
 * Browser-only (canvas, fonts, Image). Fonts are the page's own Bebas Neue
 * and Inter, loaded before drawing.
 */
import { floodlightSvg, FLOODLIGHT_VIEWBOX } from './floodlight';

export interface CardPlayer {
  name: string;
  /** Short role tag, e.g. "OPN". */
  role: string;
  /** Short nation code, e.g. "AUS". */
  nation: string;
}

export interface CardData {
  user: number;
  house: number;
  draws: number;
  /** "I beat the World XI" etc. (share-results.ts). */
  headline: string;
  xi: CardPlayer[];
  /** e.g. "Top 12% of all drafts"; omitted when empty. */
  rank?: string;
}

const W = 1080;
const H = 1350;
const LIME = '#c6ff3d';
const LOSS = '#ff6b5e';
const TEXT = '#eaf0ff';
const MUTED = '#9aa6c4';
const DIM = '#6b7694';
const DISPLAY = '"Bebas Neue", "Arial Narrow", sans-serif';
const BODY = 'Inter, system-ui, sans-serif';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** The two pylons on a transparent layer, fading out toward the bottom. */
async function floodlightLayer(): Promise<HTMLCanvasElement> {
  const [, , vw, vh] = FLOODLIGHT_VIEWBOX.split(' ').map(Number);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${FLOODLIGHT_VIEWBOX}" width="${vw}" height="${vh}">${floodlightSvg('card')}</svg>`;
  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  const layer = document.createElement('canvas');
  layer.width = W;
  layer.height = H;
  const c = layer.getContext('2d')!;
  const scale = 1.05;
  c.drawImage(img, -20, 0, vw * scale, vh * scale);
  c.save();
  c.translate(W, 0);
  c.scale(-1, 1);
  c.drawImage(img, -20, 0, vw * scale, vh * scale);
  c.restore();
  // Fade the masts and beams out before the XI panel.
  c.globalCompositeOperation = 'destination-in';
  const fade = c.createLinearGradient(0, 0, 0, vh * scale);
  fade.addColorStop(0.5, '#000');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = fade;
  c.fillRect(0, 0, W, H);
  return layer;
}

function spaced(c: CanvasRenderingContext2D, px: number) {
  // letterSpacing is widely supported now; older browsers just ignore it.
  (c as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${px}px`;
}

/** Largest font size (≤ max) at which `text` fits `width`. */
function fitFont(c: CanvasRenderingContext2D, text: string, family: string, max: number, width: number): number {
  let size = max;
  c.font = `400 ${size}px ${family}`;
  while (size > 24 && c.measureText(text).width > width) {
    size -= 2;
    c.font = `400 ${size}px ${family}`;
  }
  return size;
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

export async function drawShareCard(d: CardData): Promise<HTMLCanvasElement> {
  await Promise.all([
    document.fonts.load(`400 100px ${DISPLAY}`),
    document.fonts.load(`600 24px ${BODY}`),
    document.fonts.load(`700 24px ${BODY}`),
  ]).catch(() => undefined);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d')!;

  // Ground: night sky, green glow off the outfield.
  c.fillStyle = '#04060c';
  c.fillRect(0, 0, W, H);
  const grass = c.createRadialGradient(W / 2, H + 120, 0, W / 2, H + 120, 760);
  grass.addColorStop(0, 'rgba(40, 160, 90, 0.42)');
  grass.addColorStop(1, 'rgba(40, 160, 90, 0)');
  c.fillStyle = grass;
  c.fillRect(0, 0, W, H);
  try {
    c.drawImage(await floodlightLayer(), 0, 0);
  } catch {
    /* no floodlights if the SVG can't be drawn — the card still works */
  }

  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';

  // Brand line.
  c.fillStyle = TEXT;
  c.font = `400 40px ${DISPLAY}`;
  spaced(c, 5);
  c.fillText('BEAT MY 11 · THE FIVE-TEST SERIES', W / 2, 84);

  // Headline.
  const won = d.user > d.house;
  const lost = d.user < d.house;
  const headline = d.headline.toUpperCase();
  spaced(c, 2);
  const hs = fitFont(c, headline, DISPLAY, 104, 820);
  c.font = `400 ${hs}px ${DISPLAY}`;
  if (won) {
    c.shadowColor = 'rgba(198, 255, 61, 0.55)';
    c.shadowBlur = 40;
  }
  c.fillStyle = won ? LIME : TEXT;
  c.fillText(headline, W / 2, 250);
  c.shadowBlur = 0;

  // Scoreline.
  const numY = 480;
  c.font = `400 230px ${DISPLAY}`;
  spaced(c, 0);
  const side = (n: number, x: number, color: string, glow: boolean) => {
    if (glow) {
      c.shadowColor = 'rgba(198, 255, 61, 0.5)';
      c.shadowBlur = 44;
    }
    c.fillStyle = color;
    c.fillText(String(n), x, numY);
    c.shadowBlur = 0;
  };
  side(d.user, W / 2 - 150, won ? LIME : TEXT, won);
  side(d.house, W / 2 + 150, lost ? LOSS : TEXT, false);
  c.fillStyle = DIM;
  c.fillRect(W / 2 - 24, numY - 104, 48, 12);
  c.font = `600 22px ${BODY}`;
  spaced(c, 5);
  c.fillStyle = MUTED;
  c.fillText('ME', W / 2 - 150, numY + 42);
  c.fillText('WORLD XI', W / 2 + 150, numY + 42);

  // One pip per Test: wins, draws, losses.
  const pips = [...Array(d.user).fill('w'), ...Array(d.draws).fill('d'), ...Array(d.house).fill('l')];
  const pw = 52, gap = 14;
  let px = W / 2 - (pips.length * pw + (pips.length - 1) * gap) / 2;
  for (const k of pips) {
    roundRect(c, px, numY + 72, pw, 12, 6);
    if (k === 'w') {
      c.shadowColor = 'rgba(198, 255, 61, 0.6)';
      c.shadowBlur = 14;
    }
    c.fillStyle = k === 'w' ? LIME : k === 'l' ? LOSS : '#2a3350';
    c.fill();
    c.shadowBlur = 0;
    if (k === 'd') {
      c.strokeStyle = MUTED;
      c.lineWidth = 2;
      c.stroke();
    }
    px += pw + gap;
  }

  // The XI.
  const panelX = 90, panelY = 628, panelW = W - 180, rowH = 46;
  const panelH = 80 + d.xi.length * rowH;
  roundRect(c, panelX, panelY, panelW, panelH, 22);
  const card = c.createLinearGradient(panelX, panelY, panelX + panelW * 0.4, panelY + panelH);
  card.addColorStop(0, 'rgba(22, 34, 58, 0.94)');
  card.addColorStop(0.7, 'rgba(11, 16, 32, 0.94)');
  c.fillStyle = card;
  c.fill();
  c.strokeStyle = 'rgba(198, 255, 61, 0.3)';
  c.lineWidth = 2;
  c.stroke();

  c.textAlign = 'left';
  c.font = `600 20px ${BODY}`;
  spaced(c, 5);
  c.fillStyle = MUTED;
  c.fillText('MY XI', panelX + 32, panelY + 46);
  if (d.rank) {
    c.textAlign = 'right';
    c.fillStyle = LIME;
    c.fillText(d.rank.toUpperCase(), panelX + panelW - 32, panelY + 46);
  }

  d.xi.forEach((p, i) => {
    const y = panelY + 98 + i * rowH;
    if (i > 0) {
      c.fillStyle = 'rgba(255, 255, 255, 0.07)';
      c.fillRect(panelX + 28, y - 34, panelW - 56, 1);
    }
    c.textAlign = 'left';
    spaced(c, 0);
    c.fillStyle = DIM;
    c.font = `400 30px ${DISPLAY}`;
    c.fillText(String(i + 1), panelX + 32, y);
    c.fillStyle = TEXT;
    spaced(c, 1.5);
    c.font = `400 36px ${DISPLAY}`;
    const name = p.name.toUpperCase();
    c.fillText(name, panelX + 80, y);
    const nameW = c.measureText(name).width;
    c.fillStyle = MUTED;
    c.font = `600 17px ${BODY}`;
    spaced(c, 2);
    c.fillText(p.nation, panelX + 80 + nameW + 14, y - 2);
    c.textAlign = 'right';
    c.fillStyle = LIME;
    c.font = `700 18px ${BODY}`;
    spaced(c, 3);
    c.fillText(p.role, panelX + panelW - 32, y - 2);
  });

  // Footer.
  c.textAlign = 'center';
  c.font = `600 24px ${BODY}`;
  spaced(c, 5);
  c.fillStyle = MUTED;
  c.fillText('CAN YOUR ALL-TIME XI DO BETTER?', W / 2, H - 78);
  c.font = `700 30px ${BODY}`;
  spaced(c, 6);
  c.fillStyle = LIME;
  c.fillText('BEATMY11.COM', W / 2, H - 34);

  return canvas;
}

export function cardBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
