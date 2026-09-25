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
 *   bowling kept separate, combined 50/50. The XI slot's declared role is
 *   the scoring role when present.
 *
 * NORMALIZATION: percentile-rank across the FULL eligible scoring
 *   population (batting metrics: every batting-evaluated player;
 *   bowling metrics: every bowling-evaluated player — never split by era,
 *   nation, pool, or XI), mapped to a 0–100 scale. Bowling average is
 *   directionally inverted. Percentiles neutralize raw numerical scale so
 *   no metric dominates by magnitude.
 *
 * WEIGHTS (V1): batting metrics 1/3 each; bowling metrics 1/4 each;
 *   all-rounder = 0.5 × batting + 0.5 × bowling.
 *
 * XI SCORE: arithmetic mean of the 11 player scores (0–100 scale).
 *   difference = userScore − opponentScore.
 *
 * MISSING DATA: never zero-filled, never estimated, never fabricated.
 *   Uncomputable metrics stay null, are flagged by auditMetrics, and
 *   compareXIs refuses to produce a misleading team score while any gap
 *   remains (throws IncompletePlayerData).
 *
 * The engine is pure: it never selects players and never knows how the
 * opponent XI was chosen. compareXIs takes both XIs plus the prebuilt
 * scoring populations as explicit inputs.
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

/** … bowling metrics 1/4 each … */
export const BOWLING_WEIGHTS: Record<MetricKey, number> = {
  battingAverage: 0,
  runsPerMatch: 0,
  centuryRate: 0,
  bowlingAverage: 1 / 4,
  wicketsPerMatch: 1 / 4,
  fiveWRate: 1 / 4,
  tenWRate: 1 / 4,
};

/** … all-rounder = 50% batting + 50% bowling. */
export const ALL_ROUNDER_BATTING_SHARE = 0.5;
export const ALL_ROUNDER_BOWLING_SHARE = 0.5;

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
 * Per metric, the sorted-ascending raw values of the FULL eligible scoring
 * population: every unique player (deduped by id — players spanning eras
 * appear in several files) whose primary role is evaluated on that metric.
 * Never split by era, nation, pool, or XI, so eras stay comparable.
 */
export type ScoringPopulations = Record<MetricKey, number[]>;

export function buildPopulations(
  players: NormalizedPlayer[],
): ScoringPopulations {
  const seen = new Set<string>();
  const pops: ScoringPopulations = {
    battingAverage: [],
    runsPerMatch: [],
    centuryRate: [],
    bowlingAverage: [],
    wicketsPerMatch: [],
    fiveWRate: [],
    tenWRate: [],
  };
  for (const player of players) {
    if (seen.has(player.id)) continue; // one player, one vote
    seen.add(player.id);
    const role = evaluationRole(player);
    const raw = rawMetrics(player);
    const push = (k: MetricKey) => {
      const v = raw[k];
      if (v !== null) pops[k].push(v);
    };
    if (BATTING_ROLES.includes(role)) for (const k of BATTING_METRICS) push(k);
    if (BOWLING_ROLES.includes(role)) for (const k of BOWLING_METRICS) push(k);
  }
  for (const k of Object.keys(pops) as MetricKey[]) pops[k].sort((a, b) => a - b);
  return pops;
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
  /** Applicable normalized (0–100) metrics; uncomputable ones are null. */
  normalized: Partial<Record<MetricKey, number | null>>;
  /** Weighted batting score (1/3 each); null when the role has no batting. */
  battingScore: number | null;
  /** Weighted bowling score (1/4 each); null when the role has no bowling. */
  bowlingScore: number | null;
  /**
   * Final 0–100 player score (1 decimal): batting/bowling weighted score,
   * or 50/50 of the two for all-rounders. Null while any applicable
   * metric is uncomputable — a misleading score is never produced.
   */
  score: number | null;
}

const round1 = (x: number): number => Math.round(x * 10) / 10;

function weightedMean(
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
  return sum;
}

/**
 * Deterministic per-player scoring. Same player + same data + same
 * populations always yields the same score. Specialist bowlers receive no
 * batting score; an all-rounder's batting and bowling scores stay
 * separately available and combine 50/50.
 */
export function scorePlayer(
  player: NormalizedPlayer,
  declaredRole: string | null | undefined,
  populations: ScoringPopulations,
): PlayerScore {
  const role = evaluationRole(player, declaredRole);
  const raw = rawMetrics(player);
  const normalizedAll = normalizeMetrics(raw, populations);
  const keys = ROLE_METRICS[role];
  const normalized: Partial<Record<MetricKey, number | null>> = {};
  for (const k of keys) normalized[k] = normalizedAll[k];

  const hasBatting = BATTING_ROLES.includes(role);
  const hasBowling = BOWLING_ROLES.includes(role);
  const battingScore = hasBatting
    ? weightedMean(normalized, BATTING_METRICS, BATTING_WEIGHTS)
    : null;
  const bowlingScore = hasBowling
    ? weightedMean(normalized, BOWLING_METRICS, BOWLING_WEIGHTS)
    : null;

  let score: number | null = null;
  if (role === 'all-rounder') {
    if (battingScore !== null && bowlingScore !== null) {
      score =
        ALL_ROUNDER_BATTING_SHARE * battingScore +
        ALL_ROUNDER_BOWLING_SHARE * bowlingScore;
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
    normalized,
    battingScore: battingScore === null ? null : round1(battingScore),
    bowlingScore: bowlingScore === null ? null : round1(bowlingScore),
    score: score === null ? null : round1(score),
  };
}

// ---------------------------------------------------------------------------
// Missing-data audit
// ---------------------------------------------------------------------------

export interface MetricGap {
  playerId: string;
  name: string;
  role: EvaluationRole;
  metric: MetricKey;
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
  populations: ScoringPopulations,
  label: string,
): PlayerScore[] {
  if (xi.length !== 11) {
    throw new Error(
      `compareXIs expects exactly 11 players per XI; got ${xi.length} (${label}).`,
    );
  }
  return xi.map((e) => scorePlayer(e.player, e.declaredRole, populations));
}

/**
 * Compares two explicit XIs. Player selection and scoring stay separate:
 * this function never selects players and never knows how the opponent XI
 * was chosen. The XI score is the arithmetic mean of the 11 player scores.
 *
 * Throws IncompletePlayerData if any applicable metric is uncomputable —
 * a misleading score is never returned.
 */
export function compareXIs(
  userXI: XIEntry[],
  opponentXI: XIEntry[],
  populations: ScoringPopulations,
): TeamComparison {
  const gaps = auditMetrics([...userXI, ...opponentXI]);
  if (gaps.length > 0) throw new IncompletePlayerData(gaps);

  const userPlayers = scoreXI(userXI, populations, 'userXI');
  const opponentPlayers = scoreXI(opponentXI, populations, 'opponentXI');
  const mean = (ps: PlayerScore[]): number =>
    ps.reduce((s, p) => s + (p.score ?? 0), 0) / ps.length;

  const userScore = round1(mean(userPlayers));
  const opponentScore = round1(mean(opponentPlayers));
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
