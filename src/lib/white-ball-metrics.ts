/**
 * white-ball-metrics.ts — the rating engine for ODI, T20I and IPL.
 *
 * Same design as the Test engine (./seven-metrics.ts), with the metric set the
 * owner approved on 2026-10-01 (docs/plans/white-ball-formats.md):
 *
 *   ODI   batting: average, runs per match, strike rate, century rate
 *         bowling: average, wickets per match, economy, 4+-wicket-innings rate
 *   T20   batting: average, runs per match, strike rate, fifty rate
 *   (T20I, IPL) bowling: average, wickets per match, economy, balls per wicket
 *
 * As in the Test engine: every metric is shrunk toward the population mean by
 * matches played, percentile-ranked 0–100 against every player of that format
 * (never mixed across formats), combined into a batting half and a bowling
 * half with longevity, all-rounders take the stronger half with the weaker
 * filling part of the gap, and the team score blends batting, bowling and
 * fielding units. Missing values are never filled in: a role whose metrics
 * cannot be computed is refused (IncompleteWhiteBallData).
 *
 * PROVISIONAL: the owner approved WHICH metrics count, not the numbers below
 * (weights, shrinkage, longevity thresholds). They are neutral defaults kept in
 * one config per format until the owner confirms them. The long-career bonus is
 * scaled like the Test game's (full only at 200 Tests, the longest career ever):
 * it completes at the longest careers in each format's data (ODI ~330 matches,
 * T20I ~160, IPL ~280), so it stays rare instead of lifting every regular.
 *
 * Pure: no DOM, no storage, no data imports.
 */
import { percentileRank, allRounderScore } from './seven-metrics';

export type WbRole = 'opener' | 'middle-order' | 'wicketkeeper' | 'all-rounder' | 'spinner' | 'fast-bowler';
const BATTING_ROLES: WbRole[] = ['opener', 'middle-order', 'wicketkeeper', 'all-rounder'];
const BOWLING_ROLES: WbRole[] = ['spinner', 'fast-bowler', 'all-rounder'];
const ALL_ROLES: WbRole[] = ['opener', 'middle-order', 'wicketkeeper', 'all-rounder', 'spinner', 'fast-bowler'];

export interface WbPlayer {
  id: string;
  name: string;
  primaryRole: string;
  secondaryRoles?: string[];
  stats: Record<string, number | null | undefined>;
}

export interface WbMetric {
  key: string;
  label: string;
  higherIsBetter: boolean;
  /** PROVISIONAL weight within its half (the half's weights sum to 1). */
  weight: number;
  /** Raw value from career stats; null when it cannot be computed. */
  value: (s: WbPlayer['stats']) => number | null;
}

export interface WbFormat {
  id: 'odi' | 't20i' | 'ipl';
  label: string;
  batting: WbMetric[];
  bowling: WbMetric[];
  /** PROVISIONAL: shrinkage prior, in matches. */
  priorMatches: number;
  /** PROVISIONAL: share of each half that is longevity, and the matches for full credit. */
  longevityWeight: number;
  longevityFullMatches: number;
  /** PROVISIONAL: long-career bonus fills this share of the gap to 100 by `longevityBonusMatches`. */
  longevityBonusFill: number;
  longevityBonusMatches: number;
  /** Team blend (same as Test): batting / bowling / fielding. */
  teamShares: { batting: number; bowling: number; fielding: number };
}

const n = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};
const per = (total: unknown, matches: unknown): number | null => {
  const t = n(total), m = n(matches);
  return t === null || m === null || m <= 0 ? null : t / m;
};
const positive = (v: unknown): number | null => {
  const x = n(v);
  return x !== null && x > 0 ? x : null;
};

const BAT_AVG: Omit<WbMetric, 'weight'> = { key: 'battingAverage', label: 'Batting average', higherIsBetter: true, value: (s) => positive(s.battingAverage) };
const RUNS_PM: Omit<WbMetric, 'weight'> = { key: 'runsPerMatch', label: 'Runs per match', higherIsBetter: true, value: (s) => per(s.runs, s.matches) };
const STRIKE: Omit<WbMetric, 'weight'> = { key: 'strikeRate', label: 'Strike rate', higherIsBetter: true, value: (s) => positive(s.strikeRate) };
const BOWL_AVG: Omit<WbMetric, 'weight'> = { key: 'bowlingAverage', label: 'Bowling average', higherIsBetter: false, value: (s) => positive(s.bowlingAverage) };
const WKTS_PM: Omit<WbMetric, 'weight'> = { key: 'wicketsPerMatch', label: 'Wickets per match', higherIsBetter: true, value: (s) => per(s.wickets, s.matches) };
const ECON: Omit<WbMetric, 'weight'> = { key: 'economy', label: 'Economy rate', higherIsBetter: false, value: (s) => positive(s.economy) };

const equal = (defs: Omit<WbMetric, 'weight'>[]): WbMetric[] => defs.map((d) => ({ ...d, weight: 1 / defs.length }));
const TEAM_SHARES = { batting: 0.4, bowling: 0.5, fielding: 0.1 };

/**
 * T20 weights (owner, 2026-10-01): strike rate and economy count for more than the other
 * metrics. The headline metric takes 40% of its half and the other three share the rest
 * equally (20% each); the owner confirmed this split on 2026-10-01.
 */
const T20_HEADLINE = 0.4;
const T20_OTHER = (1 - T20_HEADLINE) / 3;
const FIFTY_RATE: Omit<WbMetric, 'weight'> = { key: 'fiftyRate', label: 'Fifty rate', higherIsBetter: true, value: (s) => n(s.fiftyRate) ?? per((n(s.fifties) ?? NaN) + (n(s.hundreds) ?? NaN), s.matches) };
const BALLS_PW: Omit<WbMetric, 'weight'> = { key: 'ballsPerWicket', label: 'Balls per wicket', higherIsBetter: false, value: (s) => positive(s.ballsPerWicket) };
const T20_BATTING: WbMetric[] = [
  { ...BAT_AVG, weight: T20_OTHER }, { ...RUNS_PM, weight: T20_OTHER }, { ...STRIKE, weight: T20_HEADLINE }, { ...FIFTY_RATE, weight: T20_OTHER },
];
const T20_BOWLING: WbMetric[] = [
  { ...BOWL_AVG, weight: T20_OTHER }, { ...WKTS_PM, weight: T20_OTHER }, { ...ECON, weight: T20_HEADLINE }, { ...BALLS_PW, weight: T20_OTHER },
];

/**
 * IPL era normalisation (PROPOSED, owner to decide: docs/reports/ipl-era-normalisation.md).
 * An IPL stint may carry era-adjusted copies of its numbers under `era:<metric key>`, written
 * by the store (formats/white-ball-store.ts). When one is present the engine ranks on it; the
 * card still shows the real number. Without them the engine behaves exactly as before.
 */
export const ERA_FIELD = (key: string) => `era:${key}`;
const eraAware = (defs: WbMetric[]): WbMetric[] => defs.map((d) => ({ ...d, value: (s) => n(s[ERA_FIELD(d.key)]) ?? d.value(s) }));
/** The IPL metrics reading the real numbers only (the store uses these to build the adjusted ones). */
export const IPL_RAW_METRICS: WbMetric[] = [...T20_BATTING, ...T20_BOWLING];

export const WB_FORMATS: Record<WbFormat['id'], WbFormat> = {
  odi: {
    id: 'odi', label: 'ODI',
    batting: equal([BAT_AVG, RUNS_PM, STRIKE,
      { key: 'centuryRate', label: 'Century rate', higherIsBetter: true, value: (s) => per(s.hundreds, s.matches) }]),
    bowling: equal([BOWL_AVG, WKTS_PM, ECON,
      { key: 'fourWicketRate', label: '4+ wicket innings rate', higherIsBetter: true, value: (s) => n(s.fourWicketRate) ?? per(s.fourWicketInnings, s.matches) }]),
    priorMatches: 30, longevityWeight: 0.25, longevityFullMatches: 100, longevityBonusFill: 0.8, longevityBonusMatches: 330,
    teamShares: TEAM_SHARES,
  },
  t20i: {
    id: 't20i', label: 'T20I', batting: T20_BATTING, bowling: T20_BOWLING,
    priorMatches: 30, longevityWeight: 0.25, longevityFullMatches: 50, longevityBonusFill: 0.8, longevityBonusMatches: 160,
    teamShares: TEAM_SHARES,
  },
  ipl: {
    id: 'ipl', label: 'IPL', batting: eraAware(T20_BATTING), bowling: eraAware(T20_BOWLING),
    // IPL cards are stints (one franchise, one block of seasons; owner, 2026-10-02), so the
    // long-career credit is sized to a block: full at 40 matches, the bonus complete at 75.
    priorMatches: 30, longevityWeight: 0.25, longevityFullMatches: 40, longevityBonusFill: 0.8, longevityBonusMatches: 75,
    teamShares: TEAM_SHARES,
  },
};

export function wbRole(player: WbPlayer, declaredRole?: string | null): WbRole {
  const r = String(declaredRole ?? player.primaryRole ?? '').trim().toLowerCase().replace(/\s+/g, '-');
  return (ALL_ROLES as string[]).includes(r) ? (r as WbRole) : 'middle-order';
}
const matchesOf = (p: WbPlayer) => { const m = n(p.stats?.matches); return m !== null && m > 0 ? m : 0; };
const metricsFor = (role: WbRole, fmt: WbFormat): WbMetric[] => [
  ...(BATTING_ROLES.includes(role) ? fmt.batting : []),
  ...(BOWLING_ROLES.includes(role) ? fmt.bowling : []),
];

/** Can this player be scored in this role? (Every metric of the role's halves is computable.) */
export function canScoreAs(player: WbPlayer, role: WbRole, fmt: WbFormat): boolean {
  return matchesOf(player) > 0 && metricsFor(role, fmt).every((m) => m.value(player.stats) !== null) && rawFielding(player) !== null;
}

export interface WbContext {
  format: WbFormat['id'];
  /** Per metric key: sorted-ascending shrinkage-adjusted values of the eligible population. */
  populations: Record<string, number[]>;
  /** Per metric key: mean of raw values over the eligible population. */
  priorMeans: Record<string, number>;
  fieldingPopulation: number[];
  fieldingPriorMean: number;
  priorMatches: number;
}

/** Dismissals per match. Uses the stored rate when present: it is measured on the ball-by-ball
 *  matches, so it is not understated when `matches` is an official total that includes more. */
function rawFielding(p: WbPlayer): number | null {
  return n(p.stats?.dismissalsPerMatch) ?? per(p.stats?.dismissals, p.stats?.matches);
}
const shrink = (raw: number, matches: number, mean: number, prior: number) => (matches * raw + prior * mean) / (matches + prior);

/** Build the ranking populations for one format from its players (deduped by id, primary role). */
export function buildWbContext(players: WbPlayer[], fmt: WbFormat, priorMatches: number = fmt.priorMatches): WbContext {
  const seen = new Set<string>();
  const unique = players.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  const raws: Record<string, { v: number; m: number }[]> = {};
  for (const m of [...fmt.batting, ...fmt.bowling]) raws[m.key] = [];
  const fRaw: { v: number; m: number }[] = [];
  for (const p of unique) {
    const m = matchesOf(p);
    for (const def of metricsFor(wbRole(p), fmt)) {
      const v = def.value(p.stats);
      if (v !== null) raws[def.key].push({ v, m });
    }
    const f = rawFielding(p);
    if (f !== null) fRaw.push({ v: f, m });
  }
  const mean = (xs: { v: number }[]) => (xs.length ? xs.reduce((a, b) => a + b.v, 0) / xs.length : 0);
  const priorMeans: Record<string, number> = {};
  const populations: Record<string, number[]> = {};
  for (const [k, xs] of Object.entries(raws)) {
    priorMeans[k] = mean(xs);
    populations[k] = xs.map((x) => shrink(x.v, x.m, priorMeans[k], priorMatches)).sort((a, b) => a - b);
  }
  const fieldingPriorMean = mean(fRaw);
  return {
    format: fmt.id, populations, priorMeans, priorMatches, fieldingPriorMean,
    fieldingPopulation: fRaw.map((x) => shrink(x.v, x.m, fieldingPriorMean, priorMatches)).sort((a, b) => a - b),
  };
}

export interface WbPlayerScore {
  playerId: string;
  name: string;
  role: WbRole;
  /** Percentile (0–100) per applicable metric. */
  normalized: Record<string, number>;
  battingScore: number | null;
  bowlingScore: number | null;
  /** Final 0–100 rating, 1 decimal. */
  score: number;
}

export interface WbGap { playerId: string; name: string; role: WbRole; metric: string }
export class IncompleteWhiteBallData extends Error {
  readonly gaps: WbGap[];
  constructor(gaps: WbGap[]) {
    super(`Cannot score XI: ${gaps.length} required metric(s) missing (${gaps.slice(0, 5).map((g) => `${g.name}:${g.metric}`).join(', ')}). No value has been assumed.`);
    this.name = 'IncompleteWhiteBallData';
    this.gaps = gaps;
  }
}

const round1 = (x: number) => Math.round(x * 10) / 10;

function half(player: WbPlayer, defs: WbMetric[], ctx: WbContext, fmt: WbFormat, gaps: WbGap[], role: WbRole, normalized: Record<string, number>): number | null {
  const m = matchesOf(player);
  let sum = 0;
  let ok = true;
  for (const def of defs) {
    const raw = def.value(player.stats);
    if (raw === null) { gaps.push({ playerId: player.id, name: player.name, role, metric: def.key }); ok = false; continue; }
    const pct = percentileRank(shrink(raw, m, ctx.priorMeans[def.key], ctx.priorMatches), ctx.populations[def.key], def.higherIsBetter);
    if (pct === null) { gaps.push({ playerId: player.id, name: player.name, role, metric: def.key }); ok = false; continue; }
    normalized[def.key] = pct;
    sum += pct * def.weight;
  }
  if (!ok) return null;
  const longevity = Math.min(1, m / fmt.longevityFullMatches) * 100;
  const base = (1 - fmt.longevityWeight) * sum + fmt.longevityWeight * longevity;
  const span = fmt.longevityBonusMatches - fmt.longevityFullMatches;
  const bonus = fmt.longevityBonusFill * Math.min(1, Math.max(0, (m - fmt.longevityFullMatches) / span));
  return base + bonus * (100 - base);
}

interface Halves { role: WbRole; batting: number | null; bowling: number | null; normalized: Record<string, number> }
function halves(player: WbPlayer, declaredRole: string | null | undefined, ctx: WbContext, fmt: WbFormat, gaps: WbGap[]): Halves {
  const role = wbRole(player, declaredRole);
  const normalized: Record<string, number> = {};
  return {
    role, normalized,
    batting: BATTING_ROLES.includes(role) ? half(player, fmt.batting, ctx, fmt, gaps, role, normalized) : null,
    bowling: BOWLING_ROLES.includes(role) ? half(player, fmt.bowling, ctx, fmt, gaps, role, normalized) : null,
  };
}

/** One player's rating in a role. Throws IncompleteWhiteBallData if the role cannot be scored. */
export function scoreWbPlayer(player: WbPlayer, declaredRole: string | null | undefined, ctx: WbContext, fmt: WbFormat): WbPlayerScore {
  const gaps: WbGap[] = [];
  const h = halves(player, declaredRole, ctx, fmt, gaps);
  if (gaps.length) throw new IncompleteWhiteBallData(gaps);
  const score = h.role === 'all-rounder' ? allRounderScore(h.batting!, h.bowling!) : (h.batting ?? h.bowling)!;
  return {
    playerId: player.id, name: player.name, role: h.role, normalized: h.normalized,
    battingScore: h.batting === null ? null : round1(h.batting),
    bowlingScore: h.bowling === null ? null : round1(h.bowling),
    score: round1(score),
  };
}

export interface WbEntry { player: WbPlayer; declaredRole?: string | null }
export interface WbTeam { teamBatting: number; teamBowling: number; teamFielding: number; score: number }

/** XI team score: batting unit, bowling unit (all-rounders feed both) and fielding over all 11. */
export function wbTeamBlend(xi: WbEntry[], ctx: WbContext, fmt: WbFormat): WbTeam {
  if (xi.length !== 11) throw new Error(`wbTeamBlend expects exactly 11 entries; got ${xi.length}.`);
  const gaps: WbGap[] = [];
  let bat = 0, batN = 0, bowl = 0, bowlN = 0, field = 0;
  for (const e of xi) {
    const h = halves(e.player, e.declaredRole, ctx, fmt, gaps);
    if (h.batting !== null) { bat += h.batting; batN++; }
    if (h.bowling !== null) { bowl += h.bowling; bowlN++; }
    const f = rawFielding(e.player);
    const pct = f === null ? null : percentileRank(shrink(f, matchesOf(e.player), ctx.fieldingPriorMean, ctx.priorMatches), ctx.fieldingPopulation, true);
    if (pct === null) gaps.push({ playerId: e.player.id, name: e.player.name, role: h.role, metric: 'fielding' });
    else field += pct;
  }
  if (gaps.length) throw new IncompleteWhiteBallData(gaps);
  if (!batN || !bowlN) throw new Error('wbTeamBlend: an XI needs batting-role and bowling-role entries.');
  const teamBatting = bat / batN, teamBowling = bowl / bowlN, teamFielding = field / xi.length;
  const s = fmt.teamShares;
  return { teamBatting, teamBowling, teamFielding, score: round1(s.batting * teamBatting + s.bowling * teamBowling + s.fielding * teamFielding) };
}

export interface WbComparison {
  userScore: number;
  opponentScore: number;
  difference: number;
  userPlayers: WbPlayerScore[];
  opponentPlayers: WbPlayerScore[];
}

/** Compare two explicit XIs (same shape of result as the Test engine's compareXIs). */
export function compareWbXIs(userXI: WbEntry[], opponentXI: WbEntry[], ctx: WbContext, fmt: WbFormat): WbComparison {
  const userPlayers = userXI.map((e) => scoreWbPlayer(e.player, e.declaredRole, ctx, fmt));
  const opponentPlayers = opponentXI.map((e) => scoreWbPlayer(e.player, e.declaredRole, ctx, fmt));
  const userScore = wbTeamBlend(userXI, ctx, fmt).score;
  const opponentScore = wbTeamBlend(opponentXI, ctx, fmt).score;
  return { userScore, opponentScore, difference: round1(userScore - opponentScore), userPlayers, opponentPlayers };
}
