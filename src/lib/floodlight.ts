/**
 * floodlight.ts — the Floodlit night floodlight pylon as SVG markup, shared
 * by the link-preview images (scripts/gen-og-images.ts) and the page frame
 * (src/components/FloodlitShell.astro) so both show the same scene.
 *
 * The drawing is the LEFT pylon in a 720 × 630 box: a tapered lattice mast,
 * a tilted 5 × 8 bank of lamps in the top-left, and the light it throws — a
 * wide cone out of the lamp face, down and in toward the pitch, with softer
 * rays inside it and dust hanging in the beam. Mirror it (scaleX(-1)) for
 * the right-hand pylon.
 */

export const FLOODLIGHT_VIEWBOX = '0 0 720 630';

/** Centre of the lamp bank, where the light starts. */
const SRC = { x: 120, y: 84 };
/** How far the beam reaches before it has faded out. */
const REACH = 720;
/** Beam edges, in degrees below horizontal (0 = straight across). */
const BEAM_FROM = 28;
const BEAM_TO = 72;

const rad = (deg: number) => (deg * Math.PI) / 180;
const at = (deg: number, dist: number) => ({ x: SRC.x + Math.cos(rad(deg)) * dist, y: SRC.y + Math.sin(rad(deg)) * dist });
const pt = (p: { x: number; y: number }) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;

/** A wedge of light from the lamp face, `half` degrees either side of `deg`. */
function wedge(deg: number, half: number, near = 70): string {
  // Start from a short segment across the lamp face, not a single point, so
  // the light leaves the whole bank.
  const a = at(deg - half, REACH);
  const b = at(deg + half, REACH);
  const n1 = at(deg - 90, near * 0.9);
  const n2 = at(deg + 90, near * 0.9);
  return `${pt(n1)} ${pt(a)} ${pt(b)} ${pt(n2)}`;
}

/** Small seeded PRNG so the dust lands in the same place every render. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/**
 * Inner SVG markup for one pylon. `id` prefixes gradient/filter ids so two
 * pylons (or several pages' worth) can share a document.
 */
export function floodlightSvg(id: string): string {
  // Mast: two rails tapering from a wide base to the head, cross-braced.
  const baseL = 70, baseR = 150, topL = 104, topR = 126, topY = 150, botY = 640;
  const railAt = (x0: number, x1: number, y: number) => x0 + ((x1 - x0) * (y - botY)) / (topY - botY);
  let braces = '';
  const steps = 9;
  for (let i = 0; i < steps; i++) {
    const y0 = botY - ((botY - topY) * i) / steps;
    const y1 = botY - ((botY - topY) * (i + 1)) / steps;
    const l0 = railAt(baseL, topL, y0), r0 = railAt(baseR, topR, y0);
    const l1 = railAt(baseL, topL, y1), r1 = railAt(baseR, topR, y1);
    braces +=
      `<line x1="${l0}" y1="${y0}" x2="${r1}" y2="${y1}"/>` +
      `<line x1="${r0}" y1="${y0}" x2="${l1}" y2="${y1}"/>` +
      `<line x1="${l1}" y1="${y1}" x2="${r1}" y2="${y1}"/>`;
  }

  let lamps = '';
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 8; col++) lamps += `<circle cx="${14 + col * 23}" cy="${14 + row * 22}" r="8.5"/>`;

  // Rays: narrower, brighter wedges spread through the cone.
  const rays = [32, 38, 44, 49, 55, 61, 67]
    .map((deg, i) => `<polygon points="${wedge(deg, 1.2 + (i % 3) * 0.9, 40)}" opacity="${[0.55, 0.35, 0.7, 0.45, 0.6, 0.35, 0.5][i]}"/>`)
    .join('');

  // Dust: specks inside the cone, brighter near the lamps.
  const rand = rng(11);
  let dust = '';
  for (let i = 0; i < 70; i++) {
    const deg = BEAM_FROM + 4 + rand() * (BEAM_TO - BEAM_FROM - 8);
    const dist = 90 + Math.pow(rand(), 0.8) * 480;
    const p = at(deg, dist);
    const o = (0.75 - dist / 800) * (0.35 + rand() * 0.65);
    dust += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(0.6 + rand() * 1.4).toFixed(2)}" opacity="${o.toFixed(2)}"/>`;
  }

  return `
  <defs>
    <radialGradient id="${id}-fall" gradientUnits="userSpaceOnUse" cx="${SRC.x}" cy="${SRC.y}" r="${REACH}">
      <stop offset="0" stop-color="#e6f2ff" stop-opacity="0.42"/>
      <stop offset="0.35" stop-color="#dcecff" stop-opacity="0.16"/>
      <stop offset="0.75" stop-color="#dcecff" stop-opacity="0.04"/>
      <stop offset="1" stop-color="#dcecff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-ray" gradientUnits="userSpaceOnUse" cx="${SRC.x}" cy="${SRC.y}" r="${REACH}">
      <stop offset="0" stop-color="#f0f7ff" stop-opacity="0.6"/>
      <stop offset="0.45" stop-color="#e6f2ff" stop-opacity="0.2"/>
      <stop offset="1" stop-color="#e6f2ff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-halo">
      <stop offset="0" stop-color="#eef8ff" stop-opacity="0.6"/>
      <stop offset="1" stop-color="#eef8ff" stop-opacity="0"/>
    </radialGradient>
    <filter id="${id}-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="10"/></filter>
    <filter id="${id}-rays" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.5"/></filter>
    <filter id="${id}-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <g fill="url(#${id}-fall)">
    <polygon points="${wedge((BEAM_FROM + BEAM_TO) / 2, (BEAM_TO - BEAM_FROM) / 2, 90)}" filter="url(#${id}-soft)"/>
    <g fill="url(#${id}-ray)" filter="url(#${id}-rays)">${rays}</g>
  </g>
  <g fill="#f2f8ff">${dust}</g>
  <ellipse cx="${SRC.x}" cy="${SRC.y}" rx="175" ry="135" fill="url(#${id}-halo)"/>
  <g stroke="#3a4560" stroke-width="3" fill="none">
    <line x1="${baseL}" y1="${botY}" x2="${topL}" y2="${topY}"/><line x1="${baseR}" y1="${botY}" x2="${topR}" y2="${topY}"/>
  </g>
  <g stroke="#2b3450" stroke-width="1.6" fill="none">${braces}</g>
  <g transform="translate(22 22) rotate(9 97 60)">
    <rect x="0" y="0" width="194" height="120" rx="6" fill="#141b2c" stroke="#4a5674" stroke-width="3"/>
    <line x1="97" y1="120" x2="97" y2="138" stroke="#3a4560" stroke-width="6"/>
    <g fill="#f6fbff" filter="url(#${id}-glow)">${lamps}</g>
  </g>`;
}
