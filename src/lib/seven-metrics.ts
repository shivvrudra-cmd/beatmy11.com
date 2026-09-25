/**
 * seven-metrics.ts — the specified layer of the BeatMy11 rating engine.
 *
 * Implements ONLY what the BeatMy11 scoring specification definitively
 * defines:
 *   - the seven metric definitions, computed from existing verified fields
 *     (batting/bowling averages are used directly, never recalculated);
 *   - role -> applicable-metrics mapping (§5 of the spec);
 *   - deterministic per-player metric scoring with no invented values;
 *   - a missing-data audit (flags, never zero-fills);
 *   - the structured comparison interface.
 *
 * DELIBERATELY NOT IMPLEMENTED (not specified anywhere in the repo —
 * beatmy11.md documents only the older era-index model):
 *   - metric normalization methodology,
 *   - metric weights,
 *   - XI aggregation (sum? average?),
 *   - all-rounder batting/bowling weighting.
 * `compareXIs` throws MissingScoringSpec until those decisions are provided
 * as data via ScoringSpec. Nothing here invents them.
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

// ---------------------------------------------------------------------------
// Roles and applicable metrics (spec §5)
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
 * Applicable metrics per role. Wicketkeepers are evaluated (batting metrics).
 * Specialist bowlers get bowling metrics only — no artificial batting score.
 * All-rounders get all seven, kept as separate batting/bowling sets until the
 * all-rounder weighting decision is provided.
 */
export const ROLE_METRICS: Record<EvaluationRole, MetricKey[]> = {
  opener: [...BATTING_METRICS],
  'middle-order': [...BATTING_METRICS],
  wicketkeeper: [...BATTING_METRICS],
  spinner: [...BOWLING_METRICS],
  'fast-bowler': [...BOWLING_METRICS],
  'all-rounder': [...BATTING_METRICS, ...BOWLING_METRICS],
};

/**
 * The role a player is evaluated under: the draft slot's declared role when
 * present (what the user slotted them as), otherwise the player's
 * primary role. Pure function of its inputs.
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

/**
 * The seven raw metric values for a player. A metric is `null` when it cannot
 * be computed from verified data (e.g. per-match rates for a player with zero
 * matches) — never zero-filled, never estimated.
 *
 * Batting average and bowling average are the existing verified values, used
 * directly. Per-match rates use matches as the denominator: it is the only
 * denominator present in the data (no innings data exists).
 */
export type RawMetrics = Record<MetricKey, number | null>;

function perMatch(total: number, matches: number): number | null {
  if (!Number.isFinite(total) || !Number.isFinite(matches) || matches <= 0) {
    return null;
  }
  return total / matches;
}

export function rawMetrics(player: NormalizedPlayer): RawMetrics {
  const s = player.stats ?? {};
  const num = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const matches = num(s.testMatches) ?? 0;

  // Existing verified values, used directly — never recalculated.
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
// Per-player scoring (metric layer only — no weights invented)
// ---------------------------------------------------------------------------

export interface PlayerMetricScore {
  playerId: string;
  name: string;
  role: EvaluationRole;
  /** Applicable raw metrics for the role; uncomputable metrics are null. */
  metrics: Partial<Record<MetricKey, number | null>>;
  /** Batting/bowling split — present for all-rounders (both always). */
  batting?: Partial<Record<MetricKey, number | null>>;
  bowling?: Partial<Record<MetricKey, number | null>>;
}

/**
 * Deterministic per-player metric scoring. Same player + same data always
 * yields the same score object. Contains no combined rating — that requires
 * the (currently unspecified) normalization and weights.
 */
export function scorePlayer(
  player: NormalizedPlayer,
  declaredRole?: string | null,
): PlayerMetricScore {
  const role = evaluationRole(player, declaredRole);
  const raw = rawMetrics(player);
  const keys = ROLE_METRICS[role];
  const metrics: Partial<Record<MetricKey, number | null>> = {};
  for (const k of keys) metrics[k] = raw[k];

  const out: PlayerMetricScore = {
    playerId: player.id,
    name: player.name,
    role,
    metrics,
  };
  if (role === 'all-rounder') {
    out.batting = {};
    out.bowling = {};
    for (const k of BATTING_METRICS) out.batting[k] = raw[k];
    for (const k of BOWLING_METRICS) out.bowling[k] = raw[k];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Missing-data audit (spec §12)
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
 * the XI is fully specified. Never fills, estimates, or fabricates.
 */
export function auditMetrics(
  players: { player: NormalizedPlayer; declaredRole?: string | null }[],
): MetricGap[] {
  const gaps: MetricGap[] = [];
  for (const { player, declaredRole } of players) {
    const scored = scorePlayer(player, declaredRole);
    for (const [metric, value] of Object.entries(scored.metrics)) {
      if (value === null || value === undefined) {
        gaps.push({
          playerId: player.id,
          name: player.name,
          role: scored.role,
          metric: metric as MetricKey,
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
// Structured comparison interface (spec §10, §14)
// ---------------------------------------------------------------------------

export interface TeamComparison {
  userScore: number;
  opponentScore: number;
  difference: number;
  /** 'user' | 'opponent' | 'tie' */
  result: string;
}

/**
 * The decisions required before team scores can be computed. This is pure
 * data — when the agreed values are provided, scoring becomes a deterministic
 * function of (players, spec) with nothing invented.
 */
export interface ScoringSpec {
  /** Normalization per metric, e.g. min/max or z-score parameters. */
  normalization: unknown;
  /** Weight per metric. */
  weights: Record<MetricKey, number>;
  /** How player ratings combine into a team score. */
  aggregation: unknown;
  /** How an all-rounder's batting and bowling combine. */
  allRounderWeighting: unknown;
}

export class MissingScoringSpec extends Error {
  readonly missing: string[];
  constructor(missing: string[]) {
    super(
      'Cannot compute XI scores: the repository does not define ' +
        missing.join(', ') +
        '. Provide them via ScoringSpec — no formula has been invented.',
    );
    this.name = 'MissingScoringSpec';
    this.missing = missing;
  }
}

/**
 * Accepts two explicit XI objects and nothing else: player selection and
 * player scoring stay separate systems, and the engine never selects
 * players or knows how the opponent XI was chosen.
 *
 * Throws MissingScoringSpec until normalization, weights, XI aggregation
 * and the all-rounder weighting are provided.
 */
export function compareXIs(
  _userXI: { player: NormalizedPlayer; declaredRole?: string | null }[],
  _opponentXI: { player: NormalizedPlayer; declaredRole?: string | null }[],
  _spec?: ScoringSpec,
): TeamComparison {
  throw new MissingScoringSpec([
    'metric normalization methodology',
    'metric weights',
    'XI aggregation',
    'all-rounder batting/bowling weighting',
  ]);
}
