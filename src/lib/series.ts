/**
 * series.ts — the five-Test series between the user's XI and the World XI
 * (owner-approved 2026-09-29; head-to-head anchoring 2026-09-30).
 *
 * The result is a real comparison with the World XI, not a per-Test coin
 * flip and not a rank among other drafters:
 *
 *   1. gap = user XI team score − World XI team score (seven-metric engine).
 *   2. A small seeded wobble in score points is added: gap' = gap + σ·ε,
 *      ε ~ N(0,1) seeded by the XI, so a near-level XI can land either side
 *      (upsets) while the same XI always gets the same series.
 *   3. gap' picks the scoreline from GAP_CUTS (bottom to top):
 *        0–5 · 1–4 · 2–3 · 2–2 (one draw) · 3–2 · 4–1 · 5–0
 *      The ladder hangs off par (PAR_GAP, currently -7, i.e. 7 points below
 *      the World XI's 89.4): drawn 2–2 within 1 of par, 3–2 up to 4 above it,
 *      4–1 from 4 above par and 5–0 from 7 above (gaps of -3 and 0 today).
 *      You win the series by finishing ahead of par.
 *   4. Each Test gets a venue (owner-picked, fixed order), a result
 *      consistent with the scoreline, and one headline whose hero comes from
 *      the side that won that Test, with figures scaled from the hero's real
 *      career numbers. Headlines are flavour consistent with the result, not
 *      a ball-by-ball simulation.
 *
 * The calibration sample of drafted XIs (src/data/series-calibration.json,
 * written by scripts/calibrate-series.ts) is used only for the "top X% of
 * drafts" figure and to report what share of drafts gets each scoreline.
 *
 * Pure and deterministic: no DOM, no storage, no data-file imports — the
 * calibration and scored players are passed in, so the same module can run
 * in the browser, in tests, or in a future app shell.
 */

export const VENUES = ["Lord's", 'MCG', 'Eden Gardens', 'Newlands', 'Kensington Oval'] as const;

/**
 * What changes between formats in the story of a series (the scoreline logic is shared).
 * Default: the Test series against the World XI. Limited-overs formats (IPL, later ODI/T20I)
 * get their own venues, opponent name and scorecard style: no innings wins, a tie or washout
 * in place of the drawn Test, and T20-sized hero figures from the hero's career numbers.
 */
export interface SeriesFlavour {
  venues: readonly string[];
  opponent: string;
  kind: 'test' | 't20' | 'odi';
}
export const TEST_FLAVOUR: SeriesFlavour = { venues: VENUES, opponent: 'World XI', kind: 'test' };

export interface OutcomeBand {
  user: number;
  house: number;
  draws: number;
  /** Share of all drafts that should land on this outcome. */
  share: number;
}

/** Scorelines, ordered from the weakest XIs to the strongest. `share` is the
 *  original owner target for how often each occurs across drafts — a design
 *  reference now; scripts/calibrate-series.ts reports the actual shares. */
export const OUTCOME_BANDS: OutcomeBand[] = [
  { user: 0, house: 5, draws: 0, share: 0.1 },
  { user: 1, house: 4, draws: 0, share: 0.1 },
  { user: 2, house: 3, draws: 0, share: 0.35 },
  { user: 2, house: 2, draws: 1, share: 0.1 },
  { user: 3, house: 2, draws: 0, share: 0.2 },
  { user: 4, house: 1, draws: 0, share: 0.1 },
  { user: 5, house: 0, draws: 0, share: 0.05 },
];

/** Luck: standard deviation of the seeded wobble, in team-score points. */
export const WOBBLE_SIGMA = 2.5;

/**
 * The World XI is a legendary side (team score 89.4 under the live engine), so
 * even a very good drafted XI scores below it. PAR_GAP is how far behind the
 * World XI's team score an XI can be and still count as level with it - the
 * middle of the series (drawn 2-2), where a narrow 3-2 win begins just above.
 *
 * The whole scoreline ladder hangs off par: every cut below is par plus a fixed
 * offset, so changing PAR_GAP moves all seven scorelines together. Raise it to
 * make wins rarer, lower it to make them more common.
 *
 * History: -11.5 -> -9.5 -> -4 (2026-09-30) -> -7 (2026-10-01, owner-approved,
 * docs/difficulty-analysis.md). Against the simulated drafters in
 * scripts/calibrate-series.ts (human-like) and scripts/beat-house-analysis.ts
 * (score-greedy), -7 gives series wins of about 6.7% and 26.6%; the owner's
 * intended share is 35%. How real players fare is not yet known.
 */
export const PAR_GAP = -7;

/** Cut points below the win line, relative to par: a gap inside +-1 of par is
 *  the drawn 2-2, and 2-3 / 1-4 / 0-5 sit below it. */
const LOSS_AND_DRAW_CUTS = [-14, -8, -1, 1] as const;

/**
 * Cut points for the two big wins, also relative to par: a 4-1 starts 4 points
 * above par and a 5-0 starts 7 above it. At par -7 that is a gap of -3 (an XI
 * 3 points short of the World XI) and 0 (level with it).
 */
const ROUT_CUTS = [4, 7] as const;

/**
 * Score-gap cut points (user − World XI, team-score points) between the seven
 * scorelines in OUTCOME_BANDS.
 */
export const GAP_CUTS = [...LOSS_AND_DRAW_CUTS, ...ROUT_CUTS].map((c) => c + PAR_GAP);

/** The same ladder hung off a different par (other formats set their own difficulty). */
export const gapCutsFor = (parGap: number): number[] => [...LOSS_AND_DRAW_CUTS, ...ROUT_CUTS].map((c) => c + parGap);

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
    /** Limited-overs formats. */
    battingAverage?: number | null;
    strikeRate?: number | null;
    economy?: number | null;
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
  /** Was the hero line a batting or a bowling performance? Null for a washout. */
  heroKind: 'bat' | 'bowl' | null;
  /** A second performance, of the other kind, from the OTHER side ("" when none). */
  also: string;
  alsoSide: 'user' | 'house' | null;
}

export interface SeriesStar {
  /** Headline name, e.g. "M Muralitharan". */
  name: string;
  side: 'user' | 'house';
}

export interface SeriesResult {
  user: number;
  house: number;
  draws: number;
  /** Percentile of the XI among drafted XIs , 0–1 (display only). */
  percentile: number;
  /** "Top X%" figure for display: share of drafts at or above this XI. */
  topPercent: number;
  tests: TestMatch[];
  /** Player of the series: a performer from the side that won the series, or from the user's XI
   *  when it is level (owner, 2026-10-02). Null when no match had a performer. */
  playerOfSeries: SeriesStar | null;
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

/** Seeded luck, in team-score points. */
export function wobble(gap: number, rng: () => number, sigma: number = WOBBLE_SIGMA): number {
  return gap + sigma * gaussian(rng);
}

/** Scoreline for a (wobbled) score gap: user − World XI. `parGap` defaults to the Test game's. */
export function bandFor(gap: number, parGap: number = PAR_GAP): OutcomeBand {
  const cuts = parGap === PAR_GAP ? GAP_CUTS : gapCutsFor(parGap);
  let i = 0;
  while (i < cuts.length && gap >= cuts[i]) i++;
  return OUTCOME_BANDS[i];
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
/** Last name for headlines, keeping particles: "AB de Villiers" -> "de Villiers", "Faf du Plessis" -> "du Plessis". */
const PARTICLES = new Set(['de', 'du', 'van', 'der', 'den', 'le', 'la', 'ten']);
const surnameStart = (words: string[]) => {
  let i = words.length - 1;
  while (i > 1 && PARTICLES.has(words[i - 1].toLowerCase())) i--;
  return i;
};
/**
 * Headline name: initials + last name (owner, 2026-10-02: a bare surname is ambiguous).
 * "Muttiah Muralitharan" -> "M Muralitharan", "AB de Villiers" -> "AB de Villiers",
 * "V V S Laxman" -> "VVS Laxman", "Inzamam-ul-Haq" stays as it is.
 */
export const headlineName = (name: string) => {
  const words = name.trim().split(/\s+/);
  if (words.length < 2) return name.trim();
  const i = surnameStart(words);
  const initials = words.slice(0, i).map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w[0].toUpperCase())).join('');
  return `${initials} ${words.slice(i).join(' ')}`;
};
const surname = headlineName;
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

/** T20 batting hero: a match-winning knock scaled from career average and strike rate, e.g. "Gayle 87 (44)". */
function t20BattingLine(p: SeriesPlayer, rng: () => number): string {
  const avg = Number(p.stats.battingAverage) || 25;
  const sr = Number(p.stats.strikeRate) || 130;
  const runs = Math.max(48, Math.min(124, Math.round(avg * (1.5 + 1.5 * rng()))));
  return `${surname(p.name)} ${runs} (${Math.max(runs > 60 ? 28 : 22, Math.round((runs / sr) * 100))})`;
}

/** T20 bowling hero: four overs well under the career economy, e.g. "Bumrah 4/17". */
function t20BowlingLine(p: SeriesPlayer, rng: () => number): string {
  const econ = Number(p.stats.economy) || 8;
  return `${surname(p.name)} ${intIn(rng, 3, 5)}/${Math.round(4 * econ * (0.5 + 0.3 * rng()))}`;
}

/** ODI batting hero: "Kohli 118 (104)". */
function odiBattingLine(p: SeriesPlayer, rng: () => number): string {
  const avg = Number(p.stats.battingAverage) || 30;
  const sr = Number(p.stats.strikeRate) || 85;
  const runs = Math.max(62, Math.min(183, Math.round(avg * (1.6 + 1.6 * rng()))));
  return `${surname(p.name)} ${runs} (${Math.max(40, Math.round((runs / sr) * 100))})`;
}

/** ODI bowling hero: ten overs under the career economy, e.g. "Starc 5/38". */
function odiBowlingLine(p: SeriesPlayer, rng: () => number): string {
  const econ = Number(p.stats.economy) || 5;
  return `${surname(p.name)} ${intIn(rng, 3, 6)}/${Math.round(10 * econ * (0.55 + 0.3 * rng()))}`;
}

function t20HeroLine(side: SeriesPlayer[], used: Set<string>, rng: () => number, odi: boolean, bowl: boolean): string {
  const pool = side.filter((p) =>
    bowl ? BOWL_ROLES.has(p.role) && Number(p.stats.economy) > 0 : BAT_ROLES.has(p.role) && Number(p.stats.battingAverage) > 0,
  );
  const hero = pickHero(pool, used, rng);
  if (!hero) return '';
  used.add(hero.id);
  if (odi) return bowl ? odiBowlingLine(hero, rng) : odiBattingLine(hero, rng);
  return bowl ? t20BowlingLine(hero, rng) : t20BattingLine(hero, rng);
}

function t20WinSummary(team: string, rng: () => number, odi = false): string {
  return rng() < 0.5 ? `${team} win by ${intIn(rng, odi ? 6 : 4, odi ? 148 : 62)} runs` : `${team} win by ${intIn(rng, 3, 9)} wickets`;
}

function heroLine(side: SeriesPlayer[], used: Set<string>, rng: () => number, bowl: boolean): string {
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
 * Play the series. `userScore` and `houseScore` are the two XIs' team scores
 * from the seven-metric engine; `seed` comes from xiSeed(user XI).
 */
export function playSeries(input: {
  userScore: number;
  houseScore: number;
  userXI: SeriesPlayer[];
  houseXI: SeriesPlayer[];
  calibration: SeriesCalibration;
  seed: number;
  /** Defaults to the Test series against the World XI. */
  flavour?: SeriesFlavour;
  /** Difficulty: how far below the opponent still counts as level. Defaults to the Test PAR_GAP. */
  parGap?: number;
}): SeriesResult {
  const flavour = input.flavour ?? TEST_FLAVOUR;
  // Limited-overs story (T20 or ODI); the hero figures are sized for the format.
  const t20 = flavour.kind !== 'test';
  const odi = flavour.kind === 'odi';
  const rng = mulberry32(input.seed);
  const percentile = rankPercentile(input.userScore, input.calibration.scores);
  const band = bandFor(wobble(input.userScore - input.houseScore, rng), input.parGap ?? PAR_GAP);
  const order = testOrder(band, rng);
  const used = new Set<string>();
  // Headline balance (owner, 2026-10-02): of the five matches, two or three are headed by a
  // batter and the rest by a bowler, never four or five of one kind.
  const bowlHeads = shuffle([true, true, false, false, rng() < 0.5], rng);
  const xiOf = (s: 'user' | 'house') => (s === 'user' ? input.userXI : input.houseXI);
  const line = (s: 'user' | 'house', bowl: boolean) =>
    t20 ? t20HeroLine(xiOf(s), used, rng, odi, bowl) : heroLine(xiOf(s), used, rng, bowl);
  const tests: TestMatch[] = order.map((result, i) => {
    const bowl = bowlHeads[i];
    const base = { number: i + 1, venue: flavour.venues[i], result };
    const none = { hero: '', heroSide: null, heroKind: null, also: '', alsoSide: null } as const;
    let heroSide: 'user' | 'house';
    let summary: string;
    if (result === 'draw') {
      const washout = rng() < 0.5;
      heroSide = rng() < 0.5 ? 'user' : 'house';
      // No draws in limited overs: the level match is a tie or a washout.
      summary = t20 ? (washout ? 'Rain — no result' : 'Match tied') : washout ? 'Rain wipes out day five — match drawn' : 'Match drawn';
      if (washout) return { ...base, summary, ...none };
    } else {
      heroSide = result;
      const team = result === 'user' ? 'Your XI' : flavour.opponent;
      summary = t20 ? t20WinSummary(team, rng, odi) : winSummary(team, rng);
    }
    const otherSide = heroSide === 'user' ? 'house' : 'user';
    const hero = line(heroSide, bowl);
    // The other side's best effort, with the other skill, so each card has a batter and a bowler.
    const also = line(otherSide, !bowl);
    return {
      ...base, summary,
      hero, heroSide: hero ? heroSide : null, heroKind: hero ? (bowl ? 'bowl' : 'bat') : null,
      also, alsoSide: also ? otherSide : null,
    };
  });
  const starSide: 'user' | 'house' = band.house > band.user ? 'house' : 'user';
  const nameOf = (line: string) => line.replace(/\s+\d.*$/, '');
  // A match-winning headline from that side if there is one, else any performance from it.
  const starLine =
    tests.find((t) => t.hero && t.heroSide === starSide && t.result === starSide)?.hero ??
    tests.find((t) => t.hero && t.heroSide === starSide)?.hero ??
    tests.find((t) => t.also && t.alsoSide === starSide)?.also;
  const playerOfSeries: SeriesStar | null = starLine ? { name: nameOf(starLine), side: starSide } : null;
  return {
    user: band.user,
    house: band.house,
    draws: band.draws,
    percentile,
    topPercent: Math.max(1, Math.min(100, Math.round((1 - percentile) * 100))),
    tests,
    playerOfSeries,
  };
}
