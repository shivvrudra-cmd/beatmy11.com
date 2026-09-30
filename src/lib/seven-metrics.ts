/**
 * seven-metrics.ts — the BeatMy11 seven-metric rating engine (V1, finalized
 * 2026-09-25).
 *
 * The complete V1 specification, as decided by the owner:
 *
 * METRICS (exactly seven — no strike rates, economy, volume multipliers,
 * Bradman curves, era multipliers, or invented figures):
 *   Batting:  Batting Average (existing testAverage, used directly),
 *             Runs per Player-Match (testRuns / testMatches),
 *             Century Rate (testCenturies / testMatches)
 *   Bowling:  Bowling Average (existing testBowlingAverage, used directly;
 *             the ONLY lower-is-better metric),
 *             Wickets per Bowler-Match (testWickets / testMatches),
 *             Five-Wicket-Haul Rate (fiveWs / testMatches),
 *             Ten-Wicket-Match Rate (tenWs / testMatches)
 *
 * ROLES: openers / middle-order / wicketkeepers score the 3 batting metrics;
 *   spinners / fast bowlers score the 4 bowling metrics only (no batting
 *   score for specialists); all-rounders score all 7 with batting and
 *   bowling kept separate. The XI slot's declared role is the scoring role
 *   when present.
 *
 * NORMALIZATION: percentile-rank across the FULL eligible scoring
 *   population (batting metrics: every batting-evaluated player;
 *   bowling metrics: every bowling-evaluated player — never split by era,
 *   nation, pool, or XI), mapped to a 0–100 scale. Bowling average is
 *   directionally inverted. Percentiles neutralize raw numerical scale so
 *   no metric dominates by magnitude.
 *
 * V2 (owner-approved 2026-09-29) — replaces the V1 all-rounder-only
 *   populations, the 60/40 all-rounder blend and the 20-match prior:
 *   - All-rounders are ranked against the same full batting and bowling
 *     populations as specialists.
 *   - LONGEVITY: each half (batting, bowling) is 75% the metric mean and
 *     25% Tests played, with full credit at 50 Tests — rewards a real
 *     career without punishing eras that played fewer Tests (Bradman: 52).
 *   - ALL-ROUNDER: the stronger half leads and the weaker half fills half
 *     the remaining gap to 100: score = 100·(1 − (1−S)(1 − 0.5·W)) on
 *     0–1 halves. A second skill can only add, never drag the score down.
 *
 * SHRINKAGE: before percentile ranking, every metric value is shrunk
 *   toward its eligible-population mean by sample size, so a short hot
 *   streak cannot outrank a long career by construction:
 *     adjusted = (matches × raw + 30 × populationMean) / (matches + 30)
 *   using testMatches as the sample size for all seven metrics (including
 *   the direct averages). A 200-Test career barely moves; a 3-Test debut
 *   is pulled most of the way to the mean. Populations are built from
 *   adjusted values, so every player is ranked on the same basis.
 *   Missing values stay missing — shrinkage never fabricates data.
 *
 * WEIGHTS: batting metrics 1/3 each; bowling 40/35/20/5 — average, wickets per
 *   match, five-wicket rate, ten-wicket rate (within the
 *   75% metric share of each half).
 *
 * XI SCORE: team blend — 40% batting unit + 50% bowling unit + 10%
 *   fielding unit (0–100 scale). The batting unit is the mean batting half
 *   over batting-role entries, the bowling unit the mean bowling half over
 *   bowling-role entries (an all-rounder feeds both), fielding the mean
 *   dismissals-per-match percentile over all 11 entries.
 *   difference = userScore − opponentScore.
 *
 * MISSING DATA: never zero-filled, never estimated, never fabricated.
 *   Uncomputable metrics stay null, are flagged by auditMetrics, and
 *   compareXIs refuses to produce a misleading team score while any gap
 *   remains (throws IncompletePlayerData).
 *
 * The engine is pure: it never selects players and never knows how the
 * opponent XI was chosen. compareXIs takes both XIs plus the prebuilt
 * scoring context as explicit inputs.
 */

import { normalizeRole, type NormalizedPlayer } from './player-logic';

// ---------------------------------------------------------------------------
// The seven metrics
// ---------------------------------------------------------------------------

export type MetricKey =
  | 'battingAverage'
  | 'runsPerMatch'
  | 'centuryRate'
  | 'bowlingAverage'
  | 'wicketsPerMatch'
  | 'fiveWRate'
  | 'tenWRate';

export interface MetricDef {
  key: MetricKey;
  label: string;
  /** False only for bowling average — lower is better. */
  higherIsBetter: boolean;
}

export const METRICS: MetricDef[] = [
  { key: 'battingAverage', label: 'Batting Average', higherIsBetter: true },
  { key: 'runsPerMatch', label: 'Runs per Player-Match', higherIsBetter: true },
  { key: 'centuryRate', label: 'Century Rate', higherIsBetter: true },
  { key: 'bowlingAverage', label: 'Bowling Average', higherIsBetter: false },
  { key: 'wicketsPerMatch', label: 'Wickets per Bowler-Match', higherIsBetter: true },
  { key: 'fiveWRate', label: 'Five-Wicket-Haul Rate', higherIsBetter: true },
  { key: 'tenWRate', label: 'Ten-Wicket-Match Rate', higherIsBetter: true },
];

export const BATTING_METRICS: MetricKey[] = [
  'battingAverage',
  'runsPerMatch',
  'centuryRate',
];

export const BOWLING_METRICS: MetricKey[] = [
  'bowlingAverage',
  'wicketsPerMatch',
  'fiveWRate',
  'tenWRate',
];

/** V1 weights: batting metrics 1/3 each … */
export const BATTING_WEIGHTS: Record<MetricKey, number> = {
  battingAverage: 1 / 3,
  runsPerMatch: 1 / 3,
  centuryRate: 1 / 3,
  bowlingAverage: 0,
  wicketsPerMatch: 0,
  fiveWRate: 0,
  tenWRate: 0,
};

/** … bowling: average 40%, wickets per match 35%, five-wicket rate 20%, ten-wicket
 *  rate 5% (owner-approved 2026-09-30). Most bowlers have no ten-wicket match, so
 *  that metric mostly punishes (Pollock ranked 1st percentile on it, 68.6 overall
 *  despite a 23.1 average); it stays as a small tiebreak for the big winners. */
export const BOWLING_WEIGHTS: Record<MetricKey, number> = {
  battingAverage: 0,
  runsPerMatch: 0,
  centuryRate: 0,
  bowlingAverage: 0.4,
  wicketsPerMatch: 0.35,
  fiveWRate: 0.2,
  tenWRate: 0.05,
};

/** … all-rounder: the stronger half leads and the weaker half fills this
 *  share of the remaining gap to 100 (owner-approved 2026-09-29). A second
 *  skill only ever adds, so Hadlee and Sobers are not dragged down by their
 *  weaker discipline. Symmetric: batting spikes and bowling spikes alike. */
export const ALL_ROUNDER_GAP_FILL = 0.5;

/** Longevity (owner-approved 2026-09-29): share of each half that comes
 *  from Tests played, and the Test count that earns full credit. */
export const LONGEVITY_WEIGHT = 0.25;
export const LONGEVITY_FULL_CREDIT_TESTS = 50;

/** Long-career bonus (owner-approved 2026-09-30): past LONGEVITY_FULL_CREDIT_TESTS,
 *  a half fills up to LONGEVITY_BONUS_FILL of its remaining gap to 100,
 *  reaching that at LONGEVITY_BONUS_FULL_TESTS Tests. Rates per Test alone
 *  under-rate a 200-Test career (Tendulkar sat below Smith and Williamson);
 *  players at or under 50 Tests (Bradman, 52) are barely touched. */
export const LONGEVITY_BONUS_FILL = 0.8;
export const LONGEVITY_BONUS_FULL_TESTS = 200;

/**
 * Owner-approved 2026-09-27: the TEAM score blends the three units —
 * 40% batting unit + 50% bowling unit + 10% fielding unit. Player scores
 * are unchanged (batters on batting, bowlers on bowling, all-rounders
 * via allRounderScore); the blend applies at the XI
 * level only. An all-rounder feeds his batting half to the batting unit
 * and his bowling half to the bowling unit.
 */
export const TEAM_BATTING_SHARE = 0.4;
export const TEAM_BOWLING_SHARE = 0.5;
export const TEAM_FIELDING_SHARE = 0.1;

// ---------------------------------------------------------------------------
// Roles and applicable metrics
// ---------------------------------------------------------------------------

export type EvaluationRole =
  | 'opener'
  | 'middle-order'
  | 'wicketkeeper'
  | 'all-rounder'
  | 'spinner'
  | 'fast-bowler';

const VALID_ROLES: EvaluationRole[] = [
  'opener',
  'middle-order',
  'wicketkeeper',
  'all-rounder',
  'spinner',
  'fast-bowler',
];

/**
 * Applicable metrics per role. Wicketkeepers are evaluated on batting (no
 * separate wicketkeeping metric in V1). Specialist bowlers get bowling
 * metrics only. All-rounders get all seven.
 */
export const ROLE_METRICS: Record<EvaluationRole, MetricKey[]> = {
  opener: [...BATTING_METRICS],
  'middle-order': [...BATTING_METRICS],
  wicketkeeper: [...BATTING_METRICS],
  spinner: [...BOWLING_METRICS],
  'fast-bowler': [...BOWLING_METRICS],
  'all-rounder': [...BATTING_METRICS, ...BOWLING_METRICS],
};

/** Roles whose evaluation includes batting metrics. */
const BATTING_ROLES: EvaluationRole[] = [
  'opener',
  'middle-order',
  'wicketkeeper',
  'all-rounder',
];

/** Roles whose evaluation includes bowling metrics. */
const BOWLING_ROLES: EvaluationRole[] = [
  'spinner',
  'fast-bowler',
  'all-rounder',
];

/**
 * The role a player is evaluated under: the draft slot's declared role when
 * present (what the user slotted them as), otherwise the player's primary
 * role. A multi-role player declared as a non-all-rounder is scored under
 * the declaration — never silently scored as an all-rounder.
 */
export function evaluationRole(
  player: NormalizedPlayer,
  declaredRole?: string | null,
): EvaluationRole {
  const raw = declaredRole ?? player.primaryRole;
  const role = normalizeRole(raw);
  if ((VALID_ROLES as string[]).includes(role)) return role as EvaluationRole;
  return 'middle-order';
}

// ---------------------------------------------------------------------------
// Raw metric values — existing verified fields only
// ---------------------------------------------------------------------------

export type RawMetrics = Record<MetricKey, number | null>;

function perMatch(total: number, matches: number): number | null {
  if (!Number.isFinite(total) || !Number.isFinite(matches) || matches <= 0) {
    return null;
  }
  return total / matches;
}

/**
 * The seven raw metric values. A metric is `null` when it cannot be computed
 * from verified data — never zero-filled, never estimated.
 *
 * Batting average and bowling average are the existing verified values, used
 * directly and never recalculated. Per-match rates use testMatches as the
 * denominator (owner-confirmed).
 */
export function rawMetrics(player: NormalizedPlayer): RawMetrics {
  const s = player.stats ?? {};
  const num = (v: unknown): number | null => {
    // Explicitly missing stays missing — Number(null) is 0, which would be
    // a silent zero-fill. Only genuine numerics convert.
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const matches = num(s.testMatches) ?? 0;

  const battingAverage = num(s.testAverage);
  const bowlingRaw = num(s.bowlingAverage ?? s.testBowlingAverage);
  const bowlingAverage =
    bowlingRaw !== null && bowlingRaw > 0 ? bowlingRaw : null;

  return {
    battingAverage,
    runsPerMatch: perMatch(num(s.testRuns) ?? NaN, matches),
    centuryRate: perMatch(num(s.testCenturies) ?? NaN, matches),
    bowlingAverage,
    wicketsPerMatch: perMatch(num(s.testWickets) ?? NaN, matches),
    fiveWRate: perMatch(num(s.fiveWs) ?? NaN, matches),
    tenWRate: perMatch(num(s.tenWs) ?? NaN, matches),
  };
}

// ---------------------------------------------------------------------------
// Scoring populations + percentile-rank normalization (0–100)
// ---------------------------------------------------------------------------

/**
 * Per metric, the sorted-ascending shrinkage-adjusted values of the FULL
 * eligible scoring population: every unique player (deduped by id —
 * players spanning eras appear in several files) whose primary role is
 * evaluated on that metric. Never split by era, nation, pool, or XI, so
 * eras stay comparable.
 */
export type ScoringPopulations = Record<MetricKey, number[]>;

/**
 * Shrinkage prior weight, in matches (owner-approved 30 on 2026-09-29, was
 * 20): every metric value is blended with this many matches of
 * population-mean performance before percentile ranking.
 */
export const SHRINKAGE_PRIOR_MATCHES = 30;

export interface ScoringContext {
  /** Per metric, sorted-ascending adjusted values of the full population. */
  populations: ScoringPopulations;
  /** Per metric, mean of RAW values over the eligible population. */
  priorMeans: Record<MetricKey, number>;
  /**
   * Fielding population: sorted-ascending shrinkage-adjusted
   * dismissals-per-match over the FULL unique-player population (every
   * player fields; there is no role split for fielding in V1).
   */
  fieldingPopulation: number[];
  /** Mean of raw dismissals-per-match over the fielding population. */
  fieldingPriorMean: number;
  /** Prior weight in matches used for shrinkage. */
  priorMatches: number;
}

const emptyPops = (): ScoringPopulations => ({
  battingAverage: [],
  runsPerMatch: [],
  centuryRate: [],
  bowlingAverage: [],
  wicketsPerMatch: [],
  fiveWRate: [],
  tenWRate: [],
});

const matchesOf = (player: NormalizedPlayer): number => {
  const m = Number(player.stats?.testMatches);
  return Number.isFinite(m) && m > 0 ? m : 0;
};

/**
 * Builds the scoring context: prior means from raw eligible values, then
 * per-player shrinkage-adjusted values ranked into sorted populations.
 * `priorMatches = 0` disables shrinkage (adjusted == raw); used by tests
 * to exercise the percentile machinery in isolation. The spec value is
 * SHRINKAGE_PRIOR_MATCHES.
 */
export function buildScoringContext(
  players: NormalizedPlayer[],
  priorMatches: number = SHRINKAGE_PRIOR_MATCHES,
): ScoringContext {
  const seen = new Set<string>();
  const unique: NormalizedPlayer[] = [];
  for (const p of players) {
    if (seen.has(p.id)) continue; // one player, one vote
    seen.add(p.id);
    unique.push(p);
  }

  // Prior means: mean of raw values over each metric's eligible population.
  const rawSums = emptyPops();
  const rawCounts: Record<MetricKey, number> = {
    battingAverage: 0,
    runsPerMatch: 0,
    centuryRate: 0,
    bowlingAverage: 0,
    wicketsPerMatch: 0,
    fiveWRate: 0,
    tenWRate: 0,
  };
  const raws = new Map<string, RawMetrics>();
  for (const p of unique) {
    const role = evaluationRole(p);
    const raw = rawMetrics(p);
    raws.set(p.id, raw);
    const keys: MetricKey[] = [
      ...(BATTING_ROLES.includes(role) ? BATTING_METRICS : []),
      ...(BOWLING_ROLES.includes(role) ? BOWLING_METRICS : []),
    ];
    for (const k of keys) {
      const v = raw[k];
      if (v !== null) {
        rawSums[k].push(v);
        rawCounts[k]++;
      }
    }
  }
  const priorMeans = {} as Record<MetricKey, number>;
  for (const k of Object.keys(rawSums) as MetricKey[]) {
    priorMeans[k] =
      rawCounts[k] > 0
        ? rawSums[k].reduce((a, b) => a + b, 0) / rawCounts[k]
        : 0;
  }

  // Shrinkage-adjusted populations.
  const pops = emptyPops();
  for (const p of unique) {
    const role = evaluationRole(p);
    const raw = raws.get(p.id)!;
    const m = matchesOf(p);
    const keys: MetricKey[] = [
      ...(BATTING_ROLES.includes(role) ? BATTING_METRICS : []),
      ...(BOWLING_ROLES.includes(role) ? BOWLING_METRICS : []),
    ];
    for (const k of keys) {
      const v = raw[k];
      if (v === null) continue; // missing stays missing — never fabricated
      pops[k].push((m * v + priorMatches * priorMeans[k]) / (m + priorMatches));
    }
  }
  for (const k of Object.keys(pops) as MetricKey[]) pops[k].sort((a, b) => a - b);

  // Fielding population: dismissals per match over the full unique-player
  // population (every player fields). Same shrinkage treatment as the
  // seven metrics; missing dismissals stay missing — never fabricated.
  const fRaw = new Map<string, number>();
  for (const p of unique) {
    const v = rawFielding(p);
    if (v !== null) fRaw.set(p.id, v);
  }
  const fieldingPriorMean =
    fRaw.size > 0 ? [...fRaw.values()].reduce((a, b) => a + b, 0) / fRaw.size : 0;
  const fieldingPopulation: number[] = [];
  for (const p of unique) {
    const v = fRaw.get(p.id);
    if (v === undefined) continue;
    const m = matchesOf(p);
    fieldingPopulation.push((m * v + priorMatches * fieldingPriorMean) / (m + priorMatches));
  }
  fieldingPopulation.sort((a, b) => a - b);

  return {
    populations: pops,
    priorMeans,
    fieldingPopulation,
    fieldingPriorMean,
    priorMatches,
  };
}

/**
 * Shrinkage-adjusted metric values for one player under a scoring
 * context, shrunk toward the full-population means. Nulls stay null.
 */
export function adjustedMetrics(
  player: NormalizedPlayer,
  ctx: ScoringContext,
): RawMetrics {
  const raw = rawMetrics(player);
  const m = matchesOf(player);
  const priors = ctx.priorMeans;
  const out = {} as RawMetrics;
  for (const k of Object.keys(raw) as MetricKey[]) {
    const v = raw[k];
    out[k] =
      v === null
        ? null
        : (m * v + ctx.priorMatches * priors[k]) / (m + ctx.priorMatches);
  }
  return out;
}

export function buildPopulations(
  players: NormalizedPlayer[],
  priorMatches: number = SHRINKAGE_PRIOR_MATCHES,
): ScoringPopulations {
  return buildScoringContext(players, priorMatches).populations;
}

/**
 * Percentile rank of `value` within `sorted` (ascending), on a 0–100 scale.
 * Ties share their averaged rank, so the result is independent of sort
 * order. For lower-is-better metrics the rank is measured from the top,
 * which is exactly 100 − the higher-is-better rank. Worst → 0, best → 100.
 */
export function percentileRank(
  value: number,
  sorted: number[],
  higherIsBetter: boolean,
): number | null {
  const n = sorted.length;
  if (n === 0) return null;
  if (n === 1) return 50;
  let below = 0;
  let equal = 0;
  for (const v of sorted) {
    if (higherIsBetter ? v < value : v > value) below++;
    else if (v === value) equal++;
  }
  const rank = below + (equal - 1) / 2; // 0-based, ties averaged
  // Clamp: values outside the population saturate at the scale ends rather
  // than going negative / above 100 (equal = 0 for unseen values).
  return Math.min(100, Math.max(0, (rank / (n - 1)) * 100));
}

/** Raw metrics mapped onto the common 0–100 scale; nulls stay null. */
export function normalizeMetrics(
  raw: RawMetrics,
  populations: ScoringPopulations,
): Record<MetricKey, number | null> {
  const out = {} as Record<MetricKey, number | null>;
  for (const def of METRICS) {
    const v = raw[def.key];
    out[def.key] =
      v === null
        ? null
        : percentileRank(v, populations[def.key], def.higherIsBetter);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Per-player scoring
// ---------------------------------------------------------------------------

export interface PlayerScore {
  playerId: string;
  name: string;
  role: EvaluationRole;
  /** All seven raw metric values; uncomputable metrics are null. */
  raw: RawMetrics;
  /** Shrinkage-adjusted metric values (what is actually ranked); nulls stay null. */
  adjusted: RawMetrics;
  /** Applicable normalized (0–100) metrics; uncomputable ones are null. */
  normalized: Partial<Record<MetricKey, number | null>>;
  /** Batting half: 75% weighted metrics (1/3 each) + 25% longevity; null
   *  when the role has no batting. */
  battingScore: number | null;
  /** Bowling half: 75% weighted metrics (1/4 each) + 25% longevity; null
   *  when the role has no bowling. */
  bowlingScore: number | null;
  /**
   * Final 0–100 player score (1 decimal): the batting/bowling half, or for
   * all-rounders the stronger half with the weaker filling part of the gap
   * to 100. Null while any applicable metric is uncomputable — a
   * misleading score is never produced.
   */
  score: number | null;
}

const round1 = (x: number): number => Math.round(x * 10) / 10;

/** Longevity on the 0–100 scale: Tests played, full credit at
 *  LONGEVITY_FULL_CREDIT_TESTS. */
export function longevityScore(player: NormalizedPlayer): number {
  return Math.min(1, matchesOf(player) / LONGEVITY_FULL_CREDIT_TESTS) * 100;
}

/** A half plus the long-career bonus: fills part of its gap to 100 by Tests played. */
export function withLongCareerBonus(half: number, player: NormalizedPlayer): number {
  const span = LONGEVITY_BONUS_FULL_TESTS - LONGEVITY_FULL_CREDIT_TESTS;
  const bonus =
    LONGEVITY_BONUS_FILL *
    Math.min(1, Math.max(0, (matchesOf(player) - LONGEVITY_FULL_CREDIT_TESTS) / span));
  return half + bonus * (100 - half);
}

/**
 * One discipline half on the 0–100 scale: (1 − LONGEVITY_WEIGHT) × the
 * weighted metric mean + LONGEVITY_WEIGHT × longevity, then the long-career
 * bonus fills part of the gap to 100. Null when any of
 * the half's metrics is uncomputable.
 */
function skillHalf(
  player: NormalizedPlayer,
  normalized: Partial<Record<MetricKey, number | null>>,
  keys: MetricKey[],
  weights: Record<MetricKey, number>,
): number | null {
  let sum = 0;
  for (const k of keys) {
    const v = normalized[k];
    if (v === null || v === undefined) return null;
    sum += v * weights[k];
  }
  return withLongCareerBonus(
    (1 - LONGEVITY_WEIGHT) * sum + LONGEVITY_WEIGHT * longevityScore(player),
    player,
  );
}

/** All-rounder combination: the stronger half leads; the weaker half fills
 *  ALL_ROUNDER_GAP_FILL of the remaining gap to 100. */
export function allRounderScore(battingHalf: number, bowlingHalf: number): number {
  const s = Math.max(battingHalf, bowlingHalf) / 100;
  const w = Math.min(battingHalf, bowlingHalf) / 100;
  return 100 * (1 - (1 - s) * (1 - ALL_ROUNDER_GAP_FILL * w));
}

/**
 * Deterministic per-player scoring. Same player + same data + same
 * scoring context always yields the same score. Specialist bowlers
 * receive no batting score; an all-rounder's batting and bowling halves
 * stay separately available and combine via allRounderScore. Percentiles
 * are computed on shrinkage-adjusted values, so small samples are pulled
 * toward the population mean before ranking. Every role — all-rounders
 * included — is ranked against the full populations.
 */
export function scorePlayer(
  player: NormalizedPlayer,
  declaredRole: string | null | undefined,
  ctx: ScoringContext,
): PlayerScore {
  const role = evaluationRole(player, declaredRole);
  const raw = rawMetrics(player);
  const adjusted = adjustedMetrics(player, ctx);
  const normalizedAll = normalizeMetrics(adjusted, ctx.populations);
  const keys = ROLE_METRICS[role];
  const normalized: Partial<Record<MetricKey, number | null>> = {};
  for (const k of keys) normalized[k] = normalizedAll[k];

  const hasBatting = BATTING_ROLES.includes(role);
  const hasBowling = BOWLING_ROLES.includes(role);
  const battingScore = hasBatting
    ? skillHalf(player, normalized, BATTING_METRICS, BATTING_WEIGHTS)
    : null;
  const bowlingScore = hasBowling
    ? skillHalf(player, normalized, BOWLING_METRICS, BOWLING_WEIGHTS)
    : null;

  let score: number | null = null;
  if (role === 'all-rounder') {
    if (battingScore !== null && bowlingScore !== null) {
      score = allRounderScore(battingScore, bowlingScore);
    }
  } else if (battingScore !== null) {
    score = battingScore;
  } else if (bowlingScore !== null) {
    score = bowlingScore;
  }

  return {
    playerId: player.id,
    name: player.name,
    role,
    raw,
    adjusted,
    normalized,
    battingScore: battingScore === null ? null : round1(battingScore),
    bowlingScore: bowlingScore === null ? null : round1(bowlingScore),
    score: score === null ? null : round1(score),
  };
}

// ---------------------------------------------------------------------------
// Fielding + team blend (owner-approved 2026-09-27)
//
// Fielding is deliberately NOT an eighth player metric: player scores are
// unchanged (batters on batting, bowlers on bowling, all-rounders via
// allRounderScore). Dismissals enter only at the XI level,
// where the team score = 40% batting unit + 50% bowling unit + 10%
// fielding unit. Every player fields, so there is no role split —
// keepers and outfielders are ranked in one population.
// ---------------------------------------------------------------------------

/**
 * Raw dismissals per match. Null when uncomputable (missing dismissals or
 * zero matches) — never zero-filled. An explicit 0 dismissals stays 0.
 */
export function rawFielding(player: NormalizedPlayer): number | null {
  const d = player.stats?.dismissals;
  if (d === null || d === undefined) return null;
  const n = Number(d);
  if (!Number.isFinite(n)) return null;
  const m = matchesOf(player);
  if (m === 0) return null;
  return n / m;
}

/**
 * Fielding score on the 0–100 scale: dismissals per match with the same
 * prior-match shrinkage toward the full-population prior mean, percentile-ranked
 * against the fielding population (higher is better). Null when
 * uncomputable — a misleading score is never produced.
 */
export function fieldingScore(
  player: NormalizedPlayer,
  ctx: ScoringContext,
): number | null {
  const raw = rawFielding(player);
  if (raw === null) return null;
  const m = matchesOf(player);
  const adjusted =
    (m * raw + ctx.priorMatches * ctx.fieldingPriorMean) / (m + ctx.priorMatches);
  return percentileRank(adjusted, ctx.fieldingPopulation, true);
}

export interface TeamBlend {
  /** Mean batting half over entries whose role includes batting. */
  teamBatting: number;
  /** Mean bowling half over entries whose role includes bowling. */
  teamBowling: number;
  /** Mean fielding score over all 11 entries. */
  teamFielding: number;
  /** Entries counted in the batting unit. */
  battingCount: number;
  /** Entries counted in the bowling unit. */
  bowlingCount: number;
  /**
   * Final 0–100 team score (1 decimal): 40% batting + 50% bowling + 10%
   * fielding. Halves are unrounded inputs; only the team score rounds.
   */
  score: number;
}

/**
 * The XI-level team score. An all-rounder feeds his batting half to the
 * batting unit and his bowling half to the bowling unit; every entry
 * feeds the fielding unit.
 *
 * Throws IncompletePlayerData when any required half or fielding value is
 * uncomputable — a misleading team score is never returned. Throws a
 * plain Error when a unit has no entries (every legal XI has 7+ batting,
 * 4+ bowling, 11 fielding entries, so this is a shape/programmer error,
 * not a data gap).
 */
export function teamBlend(xi: XIEntry[], ctx: ScoringContext): TeamBlend {
  if (xi.length !== 11) {
    throw new Error(`teamBlend expects exactly 11 entries; got ${xi.length}.`);
  }
  const gaps: MetricGap[] = [];
  let batSum = 0;
  let batN = 0;
  let bowlSum = 0;
  let bowlN = 0;
  let fieldSum = 0;
  for (const e of xi) {
    const role = evaluationRole(e.player, e.declaredRole);
    const adjusted = adjustedMetrics(e.player, ctx);
    const normalized = normalizeMetrics(adjusted, ctx.populations);
    if (BATTING_ROLES.includes(role)) {
      const b = skillHalf(e.player, normalized, BATTING_METRICS, BATTING_WEIGHTS);
      if (b === null) {
        gaps.push({
          playerId: e.player.id,
          name: e.player.name,
          role,
          metric: 'battingAverage',
          reason: 'Batting half uncomputable from verified data.',
        });
      } else {
        batSum += b;
        batN++;
      }
    }
    if (BOWLING_ROLES.includes(role)) {
      const b = skillHalf(e.player, normalized, BOWLING_METRICS, BOWLING_WEIGHTS);
      if (b === null) {
        gaps.push({
          playerId: e.player.id,
          name: e.player.name,
          role,
          metric: 'bowlingAverage',
          reason: 'Bowling half uncomputable from verified data.',
        });
      } else {
        bowlSum += b;
        bowlN++;
      }
    }
    const f = fieldingScore(e.player, ctx);
    if (f === null) {
      gaps.push({
        playerId: e.player.id,
        name: e.player.name,
        role,
        metric: 'fielding',
        reason:
          'Required statistic (dismissals) is missing from the verified data; ' +
          'confirm how this should be handled instead of assuming a value.',
      });
    } else {
      fieldSum += f;
    }
  }
  if (gaps.length > 0) throw new IncompletePlayerData(gaps);
  if (batN === 0) {
    throw new Error('teamBlend: XI has no batting-role entries; every legal XI has 7+.');
  }
  if (bowlN === 0) {
    throw new Error('teamBlend: XI has no bowling-role entries; every legal XI has 4+.');
  }
  const teamBatting = batSum / batN;
  const teamBowling = bowlSum / bowlN;
  const teamFielding = fieldSum / xi.length;
  const score = round1(
    TEAM_BATTING_SHARE * teamBatting +
      TEAM_BOWLING_SHARE * teamBowling +
      TEAM_FIELDING_SHARE * teamFielding,
  );
  return { teamBatting, teamBowling, teamFielding, battingCount: batN, bowlingCount: bowlN, score };
}

// ---------------------------------------------------------------------------
// Missing-data audit
// ---------------------------------------------------------------------------

export interface MetricGap {
  playerId: string;
  name: string;
  role: EvaluationRole;
  /**
   * The missing metric. 'fielding' is the team-level dismissals requirement
   * (fielding is not a player metric — it enters only at the XI level).
   */
  metric: MetricKey | 'fielding';
  reason: string;
}

/**
 * Flags every required-but-uncomputable metric. Returns an empty list when
 * the input is fully specified. Never fills, estimates, or fabricates.
 */
export function auditMetrics(
  players: { player: NormalizedPlayer; declaredRole?: string | null }[],
): MetricGap[] {
  const gaps: MetricGap[] = [];
  for (const { player, declaredRole } of players) {
    const role = evaluationRole(player, declaredRole);
    const raw = rawMetrics(player);
    for (const metric of ROLE_METRICS[role]) {
      if (raw[metric] === null || raw[metric] === undefined) {
        gaps.push({
          playerId: player.id,
          name: player.name,
          role,
          metric,
          reason:
            'Required statistic is missing from the verified data; ' +
            'confirm how this should be handled instead of assuming a value.',
        });
      }
    }
  }
  return gaps;
}

// ---------------------------------------------------------------------------
// XI comparison
// ---------------------------------------------------------------------------

export interface XIEntry {
  player: NormalizedPlayer;
  declaredRole?: string | null;
}

export type Verdict = 'user' | 'opponent' | 'tie';

export interface TeamComparison {
  userScore: number;
  opponentScore: number;
  difference: number;
  result: Verdict;
  /** Per-player detail, kept for later features; V1 displays only the scores. */
  userPlayers: PlayerScore[];
  opponentPlayers: PlayerScore[];
}

/** Thrown when a team score cannot be produced without misleading. */
export class IncompletePlayerData extends Error {
  readonly gaps: MetricGap[];
  constructor(gaps: MetricGap[]) {
    super(
      'Cannot score XI: ' +
        gaps.length +
        ' required metric(s) are missing from verified data (' +
        gaps
          .slice(0, 5)
          .map((g) => `${g.name}:${g.metric}`)
          .join(', ') +
        (gaps.length > 5 ? ', …' : '') +
        '). Fix the data or confirm handling — no value has been assumed.',
    );
    this.name = 'IncompletePlayerData';
    this.gaps = gaps;
  }
}

function scoreXI(
  xi: XIEntry[],
  ctx: ScoringContext,
  label: string,
): PlayerScore[] {
  if (xi.length !== 11) {
    throw new Error(
      `compareXIs expects exactly 11 players per XI; got ${xi.length} (${label}).`,
    );
  }
  return xi.map((e) => scorePlayer(e.player, e.declaredRole, ctx));
}

/**
 * Compares two explicit XIs. Player selection and scoring stay separate:
 * this function never selects players and never knows how the opponent XI
 * was chosen. Each XI's score is the team blend — 40% batting unit + 50%
 * bowling unit + 10% fielding unit (owner-approved 2026-09-27) — computed
 * from the players' role halves; per-player all-rounder scores are
 * retained in the result for display only.
 *
 * Throws IncompletePlayerData if any applicable metric or any required
 * fielding value is uncomputable — a misleading score is never returned.
 */
export function compareXIs(
  userXI: XIEntry[],
  opponentXI: XIEntry[],
  ctx: ScoringContext,
): TeamComparison {
  const gaps = auditMetrics([...userXI, ...opponentXI]);
  if (gaps.length > 0) throw new IncompletePlayerData(gaps);

  const userPlayers = scoreXI(userXI, ctx, 'userXI');
  const opponentPlayers = scoreXI(opponentXI, ctx, 'opponentXI');
  // teamBlend throws IncompletePlayerData on missing fielding data.
  const userScore = teamBlend(userXI, ctx).score;
  const opponentScore = teamBlend(opponentXI, ctx).score;
  const difference = round1(userScore - opponentScore);
  const result: Verdict =
    difference > 0 ? 'user' : difference < 0 ? 'opponent' : 'tie';

  return {
    userScore,
    opponentScore,
    difference,
    result,
    userPlayers,
    opponentPlayers,
  };
}
