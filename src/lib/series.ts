/**
 * series.ts — the five-Test series between the user's XI and the World XI
 * (owner-approved 2026-09-29).
 *
 * The result is NOT a per-Test coin flip on the score gap. Instead:
 *
 *   1. The user's XI team score is ranked against a calibration sample of
 *      drafted XIs (src/data/series-calibration.json, written by
 *      scripts/calibrate-series.ts) → a percentile p in (0, 1).
 *   2. A small seeded wobble is applied in normal space:
 *        z' = (Φ⁻¹(p) + σ·ε) / √(1 + σ²),   ε ~ N(0,1) seeded by the XI
 *      z' is still standard normal, so the wobbled percentile Φ(z') stays
 *      uniform across drafts — the owner's target shares hold exactly —
 *      while an XI near a band edge can land either side (upsets). The seed
 *      comes from the XI itself, so the same XI always gets the same series.
 *   3. The wobbled percentile picks an outcome band (bottom to top):
 *        0–5 10% · 1–4 10% · 2–3 35% · 2–2 (one draw) 10% · 3–2 20% ·
 *        4–1 10% · 5–0 5%
 *   4. Each Test gets a venue (owner-picked, fixed order), a result
 *      consistent with the scoreline, and one headline whose hero comes from
 *      the side that won that Test, with figures scaled from the hero's real
 *      career numbers. Headlines are flavour consistent with the result, not
 *      a ball-by-ball simulation.
 *
 * Pure and deterministic: no DOM, no storage, no data-file imports — the
 * calibration and scored players are passed in, so the same module can run
 * in the browser, in tests, or in a future app shell.
 */

export const VENUES = ["Lord's", 'MCG', 'Eden Gardens', 'Newlands', 'Kensington Oval'] as const;

export interface OutcomeBand {
  user: number;
  house: number;
  draws: number;
  /** Share of all drafts that should land on this outcome. */
  share: number;
}

/** Owner targets, ordered from the weakest XIs to the strongest. */
export const OUTCOME_BANDS: OutcomeBand[] = [
  { user: 0, house: 5, draws: 0, share: 0.1 },
  { user: 1, house: 4, draws: 0, share: 0.1 },
  { user: 2, house: 3, draws: 0, share: 0.35 },
  { user: 2, house: 2, draws: 1, share: 0.1 },
  { user: 3, house: 2, draws: 0, share: 0.2 },
  { user: 4, house: 1, draws: 0, share: 0.1 },
  { user: 5, house: 0, draws: 0, share: 0.05 },
];

/** Luck: standard deviation of the seeded wobble in normal space. */
export const WOBBLE_SIGMA = 0.35;

export interface SeriesCalibration {
  /** Team scores of reference drafted XIs, sorted ascending. */
  scores: number[];
  /** How the sample was produced (e.g. which simulated drafter). */
  source: string;
  generated: string;
}

/** A player as the series needs them: identity, role, stats and rating. */
export interface SeriesPlayer {
  id: string;
  name: string;
  role: string;
  /** 0–100 player rating from the seven-metric engine. */
  rating: number;
  stats: {
    testAverage?: number | null;
    testBowlingAverage?: number | null;
    bowlingAverage?: number | null;
  };
}

export type TestResult = 'user' | 'house' | 'draw';

export interface TestMatch {
  number: number;
  venue: string;
  result: TestResult;
  /** "Your XI win by 7 wickets" / "World XI win by an innings and 42 runs" / "Match drawn". */
  summary: string;
  /** Hero line, e.g. "Lara 213" or "Murali 7/88". Empty for a washout. */
  hero: string;
  /** Which side the hero played for. */
  heroSide: 'user' | 'house' | null;
}

export interface SeriesResult {
  user: number;
  house: number;
  draws: number;
  /** Percentile of the XI among drafted XIs (before the wobble), 0–1. */
  percentile: number;
  /** "Top X%" figure for display: share of drafts at or above this XI. */
  topPercent: number;
  tests: TestMatch[];
}

// ---------------------------------------------------------------- randomness

/** FNV-1a hash of a string → 32-bit seed. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Seed for an XI: order-independent over "id:role" entries. */
export function xiSeed(entries: { id: string; role: string }[]): number {
  return hashSeed(
    entries
      .map((e) => `${e.id}:${e.role}`)
      .sort()
      .join('|'),
  );
}

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-12);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26 via erf). */
export function normCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/** Inverse standard normal CDF (Acklam's rational approximation). */
export function normInv(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const q = Math.min(Math.max(p, 1e-12), 1 - 1e-12);
  if (q < 0.02425) {
    const r = Math.sqrt(-2 * Math.log(q));
    return (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1);
  }
  if (q > 1 - 0.02425) {
    const r = Math.sqrt(-2 * Math.log(1 - q));
    return -(((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1);
  }
  const r = q - 0.5;
  const s = r * r;
  return ((((((a[0] * s + a[1]) * s + a[2]) * s + a[3]) * s + a[4]) * s + a[5]) * r) / (((((b[0] * s + b[1]) * s + b[2]) * s + b[3]) * s + b[4]) * s + 1);
}

// ---------------------------------------------------------------- ranking

/**
 * Mid-rank percentile of `score` within the sorted calibration sample, in
 * (0, 1): ties share their averaged rank; never exactly 0 or 1.
 */
export function rankPercentile(score: number, sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0.5;
  let below = 0;
  let equal = 0;
  for (const v of sorted) {
    if (v < score) below++;
    else if (v === score) equal++;
  }
  return (below + equal / 2 + 0.5) / (n + 1);
}

/** Seeded wobble that keeps a uniform percentile uniform. */
export function wobble(p: number, rng: () => number, sigma: number = WOBBLE_SIGMA): number {
  const z = (normInv(p) + sigma * gaussian(rng)) / Math.sqrt(1 + sigma * sigma);
  return normCdf(z);
}

/** Outcome band for a (wobbled) percentile. */
export function bandFor(p: number): OutcomeBand {
  let acc = 0;
  for (const band of OUTCOME_BANDS) {
    acc += band.share;
    if (p < acc) return band;
  }
  return OUTCOME_BANDS[OUTCOME_BANDS.length - 1];
}

// ---------------------------------------------------------------- the series

function shuffle<T>(xs: T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Order of Test results for a scoreline. A 3–2 / 2–3 series is level 2–2
 * going into the fifth Test and decided there; everything else is shuffled.
 */
export function testOrder(band: OutcomeBand, rng: () => number): TestResult[] {
  const results: TestResult[] = [
    ...Array<TestResult>(band.user).fill('user'),
    ...Array<TestResult>(band.house).fill('house'),
    ...Array<TestResult>(band.draws).fill('draw'),
  ];
  const decider = band.draws === 0 && Math.abs(band.user - band.house) === 1;
  if (decider) {
    const winner: TestResult = band.user > band.house ? 'user' : 'house';
    const first = [...results];
    first.splice(first.indexOf(winner), 1);
    return [...shuffle(first, rng), winner];
  }
  return shuffle(results, rng);
}

const BAT_ROLES = new Set(['opener', 'middle-order', 'wicketkeeper', 'all-rounder']);
const BOWL_ROLES = new Set(['spinner', 'fast-bowler', 'all-rounder']);
const surname = (name: string) => name.trim().split(/\s+/).slice(-1)[0];
const intIn = (rng: () => number, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

/** Rating-weighted pick (weight = rating²), avoiding repeat heroes when possible. */
function pickHero(pool: SeriesPlayer[], used: Set<string>, rng: () => number): SeriesPlayer | null {
  const fresh = pool.filter((p) => !used.has(p.id));
  const from = fresh.length ? fresh : pool;
  if (!from.length) return null;
  const weights = from.map((p) => Math.max(1, p.rating) ** 2);
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < from.length; i++) {
    r -= weights[i];
    if (r <= 0) return from[i];
  }
  return from[from.length - 1];
}

function battingLine(p: SeriesPlayer, rng: () => number): string {
  const avg = Number(p.stats.testAverage) || 30;
  const runs = Math.max(52, Math.min(334, Math.round(avg * (1.6 + 1.6 * rng()))));
  return `${surname(p.name)} ${runs}`;
}

function bowlingLine(p: SeriesPlayer, rng: () => number): string {
  const avg = Number(p.stats.testBowlingAverage ?? p.stats.bowlingAverage) || 30;
  const wkts = intIn(rng, 5, 8);
  // A match-winning spell costs well under the career average per wicket
  // (e.g. Murali, avg 22.7: 7/55–7/95).
  const runs = Math.round(wkts * avg * (0.35 + 0.25 * rng()));
  return `${surname(p.name)} ${wkts}/${runs}`;
}

function heroLine(side: SeriesPlayer[], used: Set<string>, rng: () => number, battingOnly = false): string {
  const bowl = !battingOnly && rng() < 0.5;
  const pool = side.filter((p) =>
    bowl
      ? BOWL_ROLES.has(p.role) && Number(p.stats.testBowlingAverage ?? p.stats.bowlingAverage) > 0
      : BAT_ROLES.has(p.role) && Number(p.stats.testAverage) > 0,
  );
  const hero = pickHero(pool, used, rng);
  if (!hero) return '';
  used.add(hero.id);
  return bowl ? bowlingLine(hero, rng) : battingLine(hero, rng);
}

function winSummary(team: string, rng: () => number): string {
  const r = rng();
  if (r < 0.2) return `${team} win by an innings and ${intIn(rng, 12, 160)} runs`;
  if (r < 0.6) return `${team} win by ${intIn(rng, 3, 10)} wickets`;
  return `${team} win by ${intIn(rng, 18, 260)} runs`;
}

/**
 * Play the series. `userScore` is the user's XI team score from the
 * seven-metric engine; `seed` comes from xiSeed(user XI).
 */
export function playSeries(input: {
  userScore: number;
  userXI: SeriesPlayer[];
  houseXI: SeriesPlayer[];
  calibration: SeriesCalibration;
  seed: number;
}): SeriesResult {
  const rng = mulberry32(input.seed);
  const percentile = rankPercentile(input.userScore, input.calibration.scores);
  const band = bandFor(wobble(percentile, rng));
  const order = testOrder(band, rng);
  const used = new Set<string>();
  const tests: TestMatch[] = order.map((result, i) => {
    if (result === 'draw') {
      const washout = rng() < 0.5;
      const heroSide: 'user' | 'house' = rng() < 0.5 ? 'user' : 'house';
      return {
        number: i + 1,
        venue: VENUES[i],
        result,
        summary: washout ? 'Rain wipes out day five — match drawn' : 'Match drawn',
        hero: washout ? '' : heroLine(heroSide === 'user' ? input.userXI : input.houseXI, used, rng, true),
        heroSide: washout ? null : heroSide,
      };
    }
    const side = result === 'user' ? input.userXI : input.houseXI;
    return {
      number: i + 1,
      venue: VENUES[i],
      result,
      summary: winSummary(result === 'user' ? 'Your XI' : 'World XI', rng),
      hero: heroLine(side, used, rng),
      heroSide: result,
    };
  });
  return {
    user: band.user,
    house: band.house,
    draws: band.draws,
    percentile,
    topPercent: Math.max(1, Math.min(100, Math.round((1 - percentile) * 100))),
    tests,
  };
}
