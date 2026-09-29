/**
 * Tests for the finalized seven-metric rating engine (seven-metrics.ts).
 *
 * Checklist: seven metrics, derived rates, averages used directly,
 * lower-is-better only for bowling average, percentile normalization,
 * all six roles, declared-role behavior, V2 all-rounder gap-fill + longevity,
 * no batting score for specialists, missing/zero-Test handling,
 * determinism, identical-XI ties, metrics-only discipline, 40/50/10 team
 * blend aggregation, team-level fielding (dismissals), explicit
 * fixed-opponent input. Draft suites untouched.
 */
import { readFileSync } from 'node:fs';
import {
  METRICS,
  BATTING_METRICS,
  BOWLING_METRICS,
  BATTING_WEIGHTS,
  BOWLING_WEIGHTS,
  ALL_ROUNDER_GAP_FILL,
  LONGEVITY_WEIGHT,
  LONGEVITY_FULL_CREDIT_TESTS,
  allRounderScore,
  longevityScore,
  ROLE_METRICS,
  evaluationRole,
  rawMetrics,
  adjustedMetrics,
  buildPopulations,
  buildScoringContext,
  SHRINKAGE_PRIOR_MATCHES,
  percentileRank,
  normalizeMetrics,
  scorePlayer,
  auditMetrics,
  compareXIs,
  IncompletePlayerData,
  rawFielding,
  fieldingScore,
  teamBlend,
  TEAM_BATTING_SHARE,
  TEAM_BOWLING_SHARE,
  TEAM_FIELDING_SHARE,
  type NormalizedPlayer,
  type ScoringContext,
  type MetricKey,
} from '../src/lib/seven-metrics';
import { normalizePlayer } from '../src/lib/player-logic';
import { getHouseXI } from '../src/lib/opponent-xi';

let pass = 0, fail = 0;
const ok = (cond: boolean, name: string, extra?: unknown) => {
  if (cond) { pass++; }
  else { fail++; console.log(`FAIL: ${name}`, extra ?? ''); }
};

// ---- real data loading (same path the app uses) ----
const DATA_DIR = process.cwd() + '/src/data';
const byId = new Map<string, NormalizedPlayer>();
for (const era of ['legends', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s']) {
  const raw = JSON.parse(readFileSync(`${DATA_DIR}/${era}.json`, 'utf8'));
  for (const p of raw) {
    const n = normalizePlayer(p, era);
    if (!byId.has(n.id)) byId.set(n.id, n);
  }
}
const P = (id: string): NormalizedPlayer => {
  const p = byId.get(id);
  if (!p) throw new Error(`test player missing: ${id}`);
  return p;
};
// Real-data scoring context: the spec context (W=30 shrinkage). Synthetic
// formula-isolation tests below use buildScoringContext(players, 0).
const CTX: ScoringContext = buildScoringContext([...byId.values()]);
const keys = (o: object) => Object.keys(o).sort();

let uidc = 0;
const mk = (
  role: string,
  stats: Record<string, number>,
  extra: Partial<NormalizedPlayer> = {},
): NormalizedPlayer => ({
  uid: `t:mk${uidc++}`,
  id: `mk${uidc}`,
  name: `Mk ${uidc}`,
  nation: 'N',
  era: '2020s',
  displayEra: '2020s',
  primaryRole: role,
  secondaryRoles: [],
  stats,
  ...extra,
});

// ---- 1. all seven metrics exist ----
ok(METRICS.length === 7, 'seven metrics defined');
ok(
  keys(Object.fromEntries(METRICS.map((m) => [m.key, 1]))).join(',') ===
    'battingAverage,bowlingAverage,centuryRate,fiveWRate,runsPerMatch,tenWRate,wicketsPerMatch',
  'exactly the specified seven metric keys',
);

// ---- 2. derived rates use testMatches ----
const r = rawMetrics(
  mk('middle-order', { testAverage: 50, testRuns: 8000, testMatches: 100, testCenturies: 25 }),
);
ok(r.runsPerMatch === 80, 'runs per match = testRuns / testMatches');
ok(r.centuryRate === 0.25, 'century rate = testCenturies / testMatches');
const rb = rawMetrics(
  mk('fast-bowler', { testBowlingAverage: 25, testWickets: 400, testMatches: 100, fiveWs: 20, tenWs: 5 }),
);
ok(rb.wicketsPerMatch === 4, 'wickets per match = testWickets / testMatches');
ok(rb.fiveWRate === 0.2, 'five-wicket rate = fiveWs / testMatches');
ok(rb.tenWRate === 0.05, 'ten-wicket rate = tenWs / testMatches');

// ---- 3/4. averages used directly, never recalculated ----
ok(r.battingAverage === 50, 'batting average is the existing testAverage, verbatim');
ok(rb.bowlingAverage === 25, 'bowling average is the existing testBowlingAverage, verbatim');

// ---- 5. bowling average is the ONLY lower-is-better metric ----
ok(
  METRICS.find((m) => m.key === 'bowlingAverage')!.higherIsBetter === false,
  'lower bowling average is better',
);
ok(
  METRICS.filter((m) => m.key !== 'bowlingAverage').every((m) => m.higherIsBetter),
  'all other six metrics are higher-is-better',
);

// ---- 6. percentile-rank normalization ----
const pop5 = [10, 20, 30, 40, 50];
ok(percentileRank(10, pop5, true) === 0, 'worst value -> 0');
ok(percentileRank(50, pop5, true) === 100, 'best value -> 100');
ok(percentileRank(30, pop5, true) === 50, 'median -> 50');
ok(percentileRank(10, [10, 10, 10, 50, 50], true) === 25, 'ties share averaged rank (low)');
ok(percentileRank(50, [10, 10, 10, 50, 50], true) === 87.5, 'ties share averaged rank (high)');
ok(percentileRank(20, [20, 30, 40], false) === 100, 'bowling average inverted: lowest -> 100');
ok(percentileRank(40, [20, 30, 40], false) === 0, 'bowling average inverted: highest -> 0');
ok(
  percentileRank(25, [20, 30, 40], false) === 100 - percentileRank(25, [20, 30, 40], true)!,
  'inversion is exactly 100 - x',
);
ok(percentileRank(42, [42], true) === 50, 'single-value population -> 50');
ok(percentileRank(7, [7, 7, 7, 7], true) === 50, 'all identical values -> 50');
ok(percentileRank(7, [7, 7, 7, 7], false) === 50, 'all identical values -> 50 (lower-is-better)');
ok(percentileRank(5, [], true) === null, 'empty population -> null');
const tieMin = percentileRank(5, [5, 5, 5, 10], true);
ok(Math.abs(tieMin! - (1 / 3) * 100) < 1e-9, 'tied minimum shares averaged rank -> 33.3, not 0', tieMin);
ok(percentileRank(10, [5, 5, 5, 10], true) === 100, 'untied maximum -> 100 even with ties below');
const tieMax = percentileRank(10, [5, 10, 10, 10], true);
ok(Math.abs(tieMax! - (2 / 3) * 100) < 1e-9, 'tied maximum shares averaged rank -> 66.7, not 100', tieMax);
ok(percentileRank(-5, [1, 2, 3], true) === 0, 'below-population value clamps to 0');
ok(percentileRank(99, [1, 2, 3], true) === 100, 'above-population value clamps to 100');
ok(percentileRank(-5, [1, 2, 3], false) === 100, 'clamp respects inversion (lower-is-better)');
ok(percentileRank(99, [1, 2, 3], false) === 0, 'clamp respects inversion (lower-is-better)');
// real populations: out-of-range values hit the scale ends; everything in range
for (const def of METRICS) {
  const pop = CTX.populations[def.key];
  ok(pop.length > 100, `population for ${def.key} is the full eligible set (${pop.length})`);
  const lo = pop[0];
  const hi = pop[pop.length - 1];
  const worseThanAll = def.higherIsBetter ? lo - 1 : hi + 1;
  const betterThanAll = def.higherIsBetter ? hi + 1 : lo - 1;
  ok(percentileRank(worseThanAll, pop, def.higherIsBetter) === 0, `${def.key}: worse than every value -> 0`);
  ok(percentileRank(betterThanAll, pop, def.higherIsBetter) === 100, `${def.key}: better than every value -> 100`);
}

// ---- 7-11. role -> applicable metrics ----
for (const r of ['opener', 'middle-order', 'wicketkeeper'] as const) {
  ok(
    JSON.stringify([...ROLE_METRICS[r]].sort()) === JSON.stringify([...BATTING_METRICS].sort()),
    `${r}: batting metrics only`,
  );
}
for (const r of ['spinner', 'fast-bowler'] as const) {
  ok(
    JSON.stringify([...ROLE_METRICS[r]].sort()) === JSON.stringify([...BOWLING_METRICS].sort()),
    `${r}: bowling metrics only`,
  );
}
ok(ROLE_METRICS['all-rounder'].length === 7, 'all-rounder: all seven metrics');
const gilly = scorePlayer(P('adam-gilchrist'), 'wicketkeeper', CTX);
ok(gilly.role === 'wicketkeeper', 'keeper keeps keeper role');
ok(
  JSON.stringify(keys(gilly.normalized)) === JSON.stringify([...BATTING_METRICS].sort()),
  'keeper evaluated on batting only, no wicketkeeping metric',
);
const warne = scorePlayer(P('shane-warne'), 'spinner', CTX);
ok(warne.battingScore === null, 'specialist spinner: no batting score');
ok(
  !('battingAverage' in warne.normalized) && !('runsPerMatch' in warne.normalized),
  'specialist spinner: no batting metrics at all',
);
ok(warne.bowlingScore !== null && warne.score === warne.bowlingScore, 'spinner score = bowling score');

// ---- 12/14. all-rounder: both sides, stronger half + gap fill (V2) ----
const kallis = scorePlayer(P('jacques-kallis'), 'all-rounder', CTX);
ok(kallis.battingScore !== null && kallis.bowlingScore !== null, 'all-rounder: separate batting + bowling scores');
ok(ALL_ROUNDER_GAP_FILL === 0.5, 'V2: weaker half fills 50% of the remaining gap');
ok(Math.abs(allRounderScore(80, 40) - 84) < 1e-9,'allRounderScore = 100·(1 − (1−S)(1 − 0.5·W))');
ok(allRounderScore(40, 80) === allRounderScore(80, 40), 'symmetric: batting and bowling spikes alike');
ok(
  [[90, 0], [90, 50], [60, 60], [100, 10], [0, 0]].every(([a, b]) => allRounderScore(a, b) >= Math.max(a, b) && allRounderScore(a, b) <= 100),
  'a second skill never drags an all-rounder below the stronger half, never above 100',
);
const expAR = Math.round(allRounderScore(kallis.battingScore!, kallis.bowlingScore!) * 10) / 10;
ok(Math.abs(kallis.score! - expAR) <= 0.1, 'all-rounder score uses allRounderScore on the halves', { got: kallis.score, exp: expAR });
const hadleeAR = scorePlayer(P('richard-hadlee'), 'all-rounder', CTX);
ok(hadleeAR.bowlingScore! > hadleeAR.battingScore!, 'hadlee: bowling half is the stronger side');

// ---- 13. declared role drives evaluation ----
const sobersDeclared = scorePlayer(P('garfield-sobers'), 'middle-order', CTX);
ok(sobersDeclared.role === 'middle-order', 'declared role overrides primary');
ok(
  JSON.stringify(keys(sobersDeclared.normalized)) === JSON.stringify([...BATTING_METRICS].sort()),
  'declared middle-order: batting metrics only, not silently an all-rounder',
);
const sobersAR = scorePlayer(P('garfield-sobers'), 'all-rounder', CTX);
ok(sobersAR.role === 'all-rounder' && sobersAR.bowlingScore !== null, 'declared all-rounder: full dual evaluation');

// ---- 5 (weights): V1 weight values ----
ok(
  BATTING_WEIGHTS.battingAverage === 1 / 3 &&
    BATTING_WEIGHTS.runsPerMatch === 1 / 3 &&
    BATTING_WEIGHTS.centuryRate === 1 / 3,
  'batting weights are 1/3 each',
);
ok(
  (['bowlingAverage', 'wicketsPerMatch', 'fiveWRate', 'tenWRate'] as MetricKey[]).every(
    (k) => BOWLING_WEIGHTS[k] === 1 / 4,
  ),
  'bowling weights are 1/4 each',
);

// ---- 16/17. missing + zero-Test data: flagged, never zero-filled ----
const gapPlayer = mk('fast-bowler', { testBowlingAverage: 0, testWickets: 50, testMatches: 0, fiveWs: 0, tenWs: 0 });
const gapRaw = rawMetrics(gapPlayer);
ok(gapRaw.bowlingAverage === null && gapRaw.wicketsPerMatch === null, 'missing figures -> null, never zero');
const gapList = auditMetrics([{ player: gapPlayer, declaredRole: 'fast-bowler' }]);
ok(gapList.length > 0, 'missing figures flagged by auditMetrics');
ok(
  gapList.every((g) => /confirm how this should be handled/.test(g.reason)),
  'gaps ask for confirmation rather than inventing a rule',
);
const allGaps = auditMetrics([...byId.values()].map((player) => ({ player })));
ok(allGaps.length === 0, 'current data: every applicable metric computable', allGaps.slice(0, 3));
// explicit nulls are missing too — Number(null) is 0, which must not zero-fill
const nullAvg = mk(
  'middle-order',
  { testMatches: 50, testRuns: 2000, testCenturies: 5 },
  { id: 'nullavg', uid: 't:nullavg' },
);
(nullAvg.stats as Record<string, unknown>).testAverage = null;
ok(rawMetrics(nullAvg).battingAverage === null, 'explicit null average stays null, never 0');
ok(
  auditMetrics([{ player: nullAvg }]).some((g) => g.metric === 'battingAverage'),
  'explicit null average is flagged as a gap',
);
// zero-Test XI entries cannot be silently scored
const zeroXI = Array.from({ length: 11 }, (_, i) => ({
  player: mk('middle-order', { testAverage: 40, testRuns: 100, testMatches: 0, testCenturies: 0 }, { id: `z${i}`, uid: `t:z${i}` }),
}));
let threw: unknown = null;
try {
  compareXIs(zeroXI, zeroXI, CTX);
} catch (e) { threw = e; }
ok(threw instanceof IncompletePlayerData, 'zero-Test players: compareXIs refuses a misleading score');
ok(
  threw instanceof IncompletePlayerData && threw.gaps.length === 44,
  'the error carries every gap (11 players x 2 missing rates x 2 XIs)',
);

// ---- 18. determinism ----
const detA = JSON.stringify(scorePlayer(P('viv-richards'), 'middle-order', CTX));
const detB = JSON.stringify(scorePlayer(P('viv-richards'), 'middle-order', CTX));
ok(detA === detB, 'same player + data + populations -> identical score');
const houseEntries = getHouseXI().map((player) => ({ player }));
const cmpA = compareXIs(houseEntries, houseEntries, CTX);
const cmpB = compareXIs(houseEntries, houseEntries, CTX);
ok(JSON.stringify(cmpA) === JSON.stringify(cmpB), 'compareXIs deterministic');

// ---- 19. identical XIs -> identical scores and a tie ----
ok(cmpA.userScore === cmpA.opponentScore, 'identical XIs: identical scores');
ok(cmpA.difference === 0 && cmpA.result === 'tie', 'identical XIs: tie');

// ---- 20. seven metrics are the ONLY metrics ----
const saw = new Set<string>();
for (const p of byId.values()) {
  for (const k of keys(scorePlayer(p, null, CTX).normalized)) saw.add(k);
}
ok(
  saw.size === 7 && [...saw].every((k) => (METRICS as { key: string }[]).some((m) => m.key === k)),
  'no metric outside the seven is ever produced',
);
const nm = normalizeMetrics(adjustedMetrics(P('imran-khan'), CTX), CTX.populations);
ok(keys(nm).length === 7, 'normalizeMetrics covers exactly seven metrics');

// ---- 21. XI score is the 40/50/10 team blend, not the mean of 11 ----
// Synthetic XI with a legal shape (batting + bowling units) and dismissals
// on every player, so the blend is fully computable.
const blendBat = (i: number) => ({
  player: mk(
    'middle-order',
    { testAverage: 45, testRuns: 6000, testMatches: 120, testCenturies: 15, dismissals: 60 + i },
    { id: `bb${i}`, uid: `t:bb${i}`, name: `BB${i}` },
  ),
});
const blendBowl = (i: number) => ({
  player: mk(
    'fast-bowler',
    { testBowlingAverage: 24, testWickets: 350, testMatches: 100, fiveWs: 15, tenWs: 3, dismissals: 30 + i },
    { id: `bw${i}`, uid: `t:bw${i}`, name: `BW${i}` },
  ),
});
const blendXI = [
  ...Array.from({ length: 8 }, (_, i) => blendBat(i)),
  ...Array.from({ length: 3 }, (_, i) => blendBowl(i)),
];
// Local unrounded-half helper built from the engine's own exported pieces.
const halfOf = (p: NormalizedPlayer, _role: 'middle-order' | 'fast-bowler', keys: MetricKey[], weights: Record<MetricKey, number>) => {
  const norm = normalizeMetrics(adjustedMetrics(p, CTX), CTX.populations);
  let s = 0;
  for (const k of keys) s += (norm[k] as number) * weights[k];
  return (1 - LONGEVITY_WEIGHT) * s + LONGEVITY_WEIGHT * longevityScore(p);
};
{
  const bats = blendXI.slice(0, 8).map((e) => halfOf(e.player, 'middle-order', BATTING_METRICS, BATTING_WEIGHTS));
  const bowls = blendXI.slice(8).map((e) => halfOf(e.player, 'fast-bowler', BOWLING_METRICS, BOWLING_WEIGHTS));
  const fields = blendXI.map((e) => fieldingScore(e.player, CTX) as number);
  const expected =
    Math.round(
      (TEAM_BATTING_SHARE * (bats.reduce((a, b) => a + b, 0) / bats.length) +
        TEAM_BOWLING_SHARE * (bowls.reduce((a, b) => a + b, 0) / bowls.length) +
        TEAM_FIELDING_SHARE * (fields.reduce((a, b) => a + b, 0) / fields.length)) *
        10,
    ) / 10;
  const tb = teamBlend(blendXI, CTX);
  ok(tb.battingCount === 8 && tb.bowlingCount === 3, 'units count role members (8 bat / 3 bowl)', tb);
  ok(tb.score === expected, 'team score = 40% batting + 50% bowling + 10% fielding', { score: tb.score, expected });
  const gotXI = compareXIs(blendXI, blendXI, CTX);
  ok(gotXI.userScore === tb.score, 'compareXIs scores XIs with the team blend', gotXI.userScore);
  const meanOf11 =
    Math.round(
      (blendXI.map((e) => scorePlayer(e.player, null, CTX).score!).reduce((a, b) => a + b, 0) / 11) * 10,
    ) / 10;
  ok(gotXI.userScore !== meanOf11, 'blend differs from the old mean-of-11', { blend: gotXI.userScore, meanOf11 });
  ok(gotXI.userPlayers.length === 11 && gotXI.opponentPlayers.length === 11, 'per-player detail retained for later');
}
ok(
  TEAM_BATTING_SHARE === 0.4 && TEAM_BOWLING_SHARE === 0.5 && TEAM_FIELDING_SHARE === 0.1,
  'team weights are 40/50/10',
);
// An XI with no bowling-role entries cannot be blended (shape error, not data).
{
  const noBowl = Array.from({ length: 11 }, (_, i) => ({
    player: mk(
      'middle-order',
      { testAverage: 40, testRuns: 4000, testMatches: 100, testCenturies: 10, dismissals: 50 },
      { id: `nb${i}`, uid: `t:nb${i}`, name: `NB${i}` },
    ),
  }));
  let threwNB: unknown = null;
  try { teamBlend(noBowl, CTX); } catch (e) { threwNB = e; }
  ok(threwNB instanceof Error && !(threwNB instanceof IncompletePlayerData), 'bowling-less XI: plain shape error, not a data gap');
}
// An all-rounder feeds both units.
{
  const arXI = [
    ...Array.from({ length: 7 }, (_, i) => blendBat(i)),
    { player: mk('all-rounder', { testAverage: 40, testRuns: 5000, testMatches: 120, testCenturies: 10, testBowlingAverage: 30, testWickets: 250, fiveWs: 8, tenWs: 1, dismissals: 80 }, { id: 'arx', uid: 't:arx', name: 'ARX' }) },
    ...Array.from({ length: 3 }, (_, i) => blendBowl(i)),
  ];
  const tb = teamBlend(arXI, CTX);
  ok(tb.battingCount === 8 && tb.bowlingCount === 4, 'all-rounder feeds both units', tb);
}

// ---- 21b. fielding: dismissals per match, full-population percentile ----
{
  const f = (stats: Record<string, number>, extra: Partial<NormalizedPlayer> = {}) =>
    mk('middle-order', stats, { id: `f${uidc}`, uid: `t:f${uidc}`, ...extra });
  ok(rawFielding(f({ testMatches: 100, dismissals: 120 })) === 1.2, 'raw fielding = dismissals / matches');
  ok(rawFielding(f({ testMatches: 100, dismissals: 0 })) === 0, 'explicit 0 dismissals stays 0 (not null)');
  ok(rawFielding(f({ testMatches: 100 })) === null, 'missing dismissals -> null (never zero-filled)');
  ok(rawFielding(f({ testMatches: 0, dismissals: 50 })) === null, 'zero matches -> null');
  ok(fieldingScore(f({ testMatches: 100 })) === null, 'fielding score null when raw is null');
  // Real-data sanity: keepers top the full population, tailenders anchor it.
  const fg = fieldingScore(P('adam-gilchrist'), CTX)!;
  const fm = fieldingScore(P('glenn-mcgrath'), CTX)!;
  ok(fg > 99 && fm < 10, 'Gilchrist ~100, McGrath ~4: full-population fielding spread', { fg, fm });
  ok(
    fieldingScore(P('adam-gilchrist'), CTX) === fieldingScore(P('adam-gilchrist'), CTX),
    'fielding score deterministic',
  );
  ok(CTX.fieldingPopulation.length === 536, 'fielding population = all 536 unique players', CTX.fieldingPopulation.length);
  // Missing fielding data is an honest error at the XI level.
  const missingF = blendXI.map((e, i) =>
    i === 0
      ? { player: mk('middle-order', { testAverage: 45, testRuns: 6000, testMatches: 120, testCenturies: 15 }, { id: 'mf0', uid: 't:mf0', name: 'MF0' }) }
      : e,
  );
  let threwF: unknown = null;
  try { compareXIs(missingF, missingF, CTX); } catch (e) { threwF = e; }
  ok(
    threwF instanceof IncompletePlayerData &&
      (threwF as IncompletePlayerData).gaps.some((g) => g.metric === 'fielding'),
    'XI with missing dismissals: IncompletePlayerData with a fielding gap',
  );
}

// ---- 22. fixed opponent XI passed explicitly ----
const house = getHouseXI();
ok(house.length === 11, 'fixed house XI has 11 players');
const mixed = compareXIs(blendXI, houseEntries, CTX);
ok(
  Number.isFinite(mixed.userScore) && Number.isFinite(mixed.opponentScore) && mixed.userScore >= 0 && mixed.userScore <= 100,
  'explicit opponent XI scores on the 0–100 scale',
);
ok(['user', 'opponent', 'tie'].includes(mixed.result), 'verdict is one of user/opponent/tie');

// ---- populations: full eligible sets, deduped ----
const dupPops = buildPopulations([
  mk('opener', { testAverage: 40, testRuns: 4000, testMatches: 100, testCenturies: 10 }, { id: 'dup', uid: 't:d1' }),
  mk('opener', { testAverage: 40, testRuns: 4000, testMatches: 100, testCenturies: 10 }, { id: 'dup', uid: 't:d2' }),
]);
ok(dupPops.battingAverage.length === 1, 'duplicate ids counted once in populations');
const eligPops = buildPopulations([
  mk('spinner', { testBowlingAverage: 25, testWickets: 100, testMatches: 50, fiveWs: 5, tenWs: 1 }, { id: 'e1', uid: 't:e1' }),
]);
ok(
  eligPops.battingAverage.length === 0 && eligPops.bowlingAverage.length === 1,
  'populations include only role-eligible players',
);

// ---- 23. shrinkage: a hot streak must not outrank a career by construction ----
ok(SHRINKAGE_PRIOR_MATCHES === 30, 'spec shrinkage prior weight is 30 matches (V2)');
// prior means are the raw eligible-population means
{
  const elig = [...byId.values()].filter((p) =>
    ['opener', 'middle-order', 'wicketkeeper', 'all-rounder'].includes(evaluationRole(p)),
  );
  const mean = elig.reduce((s, p) => s + rawMetrics(p).battingAverage!, 0) / elig.length;
  ok(
    Math.abs(CTX.priorMeans.battingAverage - mean) < 1e-9,
    'prior mean = raw eligible-population mean',
  );
}
// synthetic: Kaia-like 3-Test hot streak vs Tendulkar-like 200-Test career
{
  const mkBat = (matches: number, avg: number, rpm: number, centuries: number, id: string) =>
    mk(
      'middle-order',
      { testAverage: avg, testRuns: Math.round(rpm * matches), testMatches: matches, testCenturies: centuries },
      { id, uid: `t:${id}`, name: id },
    );
  // population mean sits well below both, mirroring the real data (mean 37.4)
  const hot = mkBat(3, 62.4, 104, 1, 'hot');       // Kaia-like
  const career = mkBat(200, 53.8, 79.6, 30, 'career'); // Tendulkar-like
  // 40 filler players with a realistic spread of long-career numbers (deterministic)
  const fillers = Array.from({ length: 40 }, (_, i) =>
    mkBat(
      80 + (i % 5) * 10,
      28 + (i % 22),
      45 + (i % 20),
      10 + (i % 6),
      `f${i}`,
    ),
  );
  const rawCtx = buildScoringContext([hot, career, ...fillers], 0); // no shrinkage
  // Without shrinkage the hot streak's raw metrics outrank the career's; in
  // V2 the longevity share alone already reverses the final score.
  const hotRawN = scorePlayer(hot, null, rawCtx).normalized.battingAverage!;
  const careerRawN = scorePlayer(career, null, rawCtx).normalized.battingAverage!;
  ok(hotRawN > careerRawN, 'without shrinkage the raw hot-streak average outranks the career', { hotRawN, careerRawN });
  ok(
    scorePlayer(career, null, rawCtx).score! > scorePlayer(hot, null, rawCtx).score!,
    'V2: longevity alone puts the 200-Test career ahead even without shrinkage',
  );
  const ctx20 = buildScoringContext([hot, career, ...fillers], 20);
  const hotAdj = adjustedMetrics(hot, ctx20);
  const careerAdj = adjustedMetrics(career, ctx20);
  const hotRawM = rawMetrics(hot);
  const careerRawM = rawMetrics(career);
  ok(hotAdj.battingAverage! < hotRawM.battingAverage!, 'hot streak pulled strongly toward the mean', hotAdj.battingAverage);
  ok(
    Math.abs(careerAdj.battingAverage! - careerRawM.battingAverage!) < 1.5,
    '200-Test career barely moves under shrinkage',
    careerAdj.battingAverage,
  );
  ok(
    careerAdj.battingAverage! > hotAdj.battingAverage! &&
      careerAdj.runsPerMatch! > hotAdj.runsPerMatch!,
    'after shrinkage the career estimates exceed the hot-streak estimates',
    { hotAdj: hotAdj.battingAverage, careerAdj: careerAdj.battingAverage },
  );
  const hotScore20 = scorePlayer(hot, null, ctx20).score!;
  const careerScore20 = scorePlayer(career, null, ctx20).score!;
  ok(
    careerScore20 > hotScore20,
    'with W=20 shrinkage the 200-Test career outranks the 3-Test hot streak',
    { hotScore20, careerScore20 },
  );
  // adjusted == raw when priorMatches = 0
  const adj0 = adjustedMetrics(hot, rawCtx);
  const rawHot = rawMetrics(hot);
  ok(
    (Object.keys(rawHot) as MetricKey[]).every(
      (k) => (rawHot[k] === null && adj0[k] === null) || Math.abs((rawHot[k] ?? 0) - (adj0[k] ?? 0)) < 1e-9,
    ),
    'priorMatches = 0 leaves values untouched',
  );
  // shrinkage formula itself
  const adj20 = adjustedMetrics(hot, ctx20);
  const expected = (3 * 62.4 + 20 * ctx20.priorMeans.battingAverage) / 23;
  ok(Math.abs(adj20.battingAverage! - expected) < 1e-9, 'adjusted = (m*raw + 20*mean) / (m + 20)', adj20.battingAverage);
  // missing stays missing under shrinkage
  const miss = mk('middle-order', { testAverage: 50, testRuns: 5000, testMatches: 0, testCenturies: 10 }, { id: 'miss', uid: 't:miss' });
  ok(adjustedMetrics(miss, ctx20).runsPerMatch === null, 'shrinkage never fabricates missing values');
}
// real data: the debutant hot streaks no longer top the lists; Bradman still does
{
  const kaia = scorePlayer(P('innocent-kaia'), 'opener', CTX).score!;
  const padikkal = scorePlayer(P('devdutt-padikkal'), 'middle-order', CTX).score!;
  const sachin = scorePlayer(P('sachin-tendulkar'), 'middle-order', CTX).score!;
  const bradman = scorePlayer(P('don-bradman'), 'opener', CTX).score!;
  ok(sachin > kaia && sachin > padikkal, 'Tendulkar (200 Tests) outranks the debutant hot streaks', { kaia, padikkal, sachin });
  const bestOpener = Math.max(...[...byId.values()].filter((p) => p.primaryRole === 'opener').map((p) => scorePlayer(p, null, CTX).score!));
  ok(bradman === bestOpener, 'Bradman still the top opener after shrinkage', { bradman });
  // empirical guard on the real data: no tiny-sample player cracks any role's top 10
  for (const role of ['opener', 'middle-order', 'wicketkeeper', 'all-rounder', 'spinner', 'fast-bowler'] as const) {
    const inRole = [...byId.values()]
      .map((p) => ({ p, s: scorePlayer(p, null, CTX) }))
      .filter((x) => x.s.role === role)
      .sort((a, b) => b.s.score! - a.s.score!);
    const top10min = Math.min(...inRole.slice(0, 10).map((x) => Number(x.p.stats.testMatches)));
    ok(top10min >= 10, `${role}: every top-10 scorer played >= 10 Tests (min=${top10min})`);
  }
}

// ---- V2 (owner-approved 2026-09-29): full populations, longevity, AR gap fill ----
{
  // all-rounders are ranked against the full populations — no AR-only context
  ok(!('arPopulations' in CTX) && !('arPriorMeans' in CTX), 'no all-rounder-only populations in the context');
  const botham = P('ian-botham');
  const bm = Number(botham.stats.testMatches);
  const expAdj = (bm * Number(botham.stats.testAverage) + 30 * CTX.priorMeans.battingAverage) / (bm + 30);
  ok(Math.abs(adjustedMetrics(botham, CTX).battingAverage! - expAdj) < 1e-9, 'all-rounder shrinkage uses full-population priors');

  // longevity: Tests played, full credit at 50
  ok(LONGEVITY_WEIGHT === 0.25 && LONGEVITY_FULL_CREDIT_TESTS === 50, 'longevity is 25% of each half, full credit at 50 Tests');
  const lt = (m: number) => longevityScore(mk('middle-order', { testMatches: m }, { id: `lt${m}`, uid: `t:lt${m}` }));
  ok(lt(25) === 50 && lt(50) === 100 && lt(200) === 100 && lt(0) === 0, 'longevity: 25 Tests = 50, 50+ Tests = 100');
  {
    // identical rates, different career lengths: the longer career ranks higher
    const shortC = mk('fast-bowler', { testBowlingAverage: 22, testMatches: 25, testWickets: 125, fiveWs: 6, tenWs: 1 }, { id: 'shortc', uid: 't:shortc' });
    const longC = mk('fast-bowler', { testBowlingAverage: 22, testMatches: 100, testWickets: 500, fiveWs: 24, tenWs: 4 }, { id: 'longc', uid: 't:longc' });
    const ctx = buildScoringContext([shortC, longC, ...byId.values()]);
    ok(scorePlayer(longC, null, ctx).score! > scorePlayer(shortC, null, ctx).score!, 'same rates: the 100-Test career outranks the 25-Test one');
  }

  // owner's reference points for the all-time greats
  const s = (id: string, role: string) => scorePlayer(P(id), role, CTX).score!;
  ok(s('garfield-sobers', 'all-rounder') > 98, 'Sobers above 98 as an all-rounder', s('garfield-sobers', 'all-rounder'));
  ok(s('richard-hadlee', 'all-rounder') > 98, 'Hadlee above 98 as an all-rounder', s('richard-hadlee', 'all-rounder'));
  ok(s('jacques-kallis', 'all-rounder') > 98, 'Kallis above 98 as an all-rounder', s('jacques-kallis', 'all-rounder'));
  ok(s('imran-khan', 'all-rounder') > 94 && s('imran-khan', 'all-rounder') < 97, 'Imran ~96', s('imran-khan', 'all-rounder'));
  ok(s('ian-botham', 'all-rounder') > 88 && s('ian-botham', 'all-rounder') < 91, 'Botham ~89.5', s('ian-botham', 'all-rounder'));
  ok(s('don-bradman', 'opener') === 100, 'Bradman still 100 with longevity (52 Tests >= 50)');
  ok(s('sachin-tendulkar', 'middle-order') > s('harry-brook', 'middle-order'), 'Tendulkar (200 Tests) outranks Harry Brook (41 Tests)');
  ok(s('glenn-mcgrath', 'fast-bowler') > s('mohammad-asif', 'fast-bowler'), 'McGrath (124 Tests) outranks Mohammad Asif (23 Tests)');
  const bowlers = [...byId.values()]
    .filter((p) => ['fast-bowler', 'spinner'].includes(p.primaryRole))
    .map((p) => ({ p, s: scorePlayer(p, null, CTX).score ?? -1 }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 20);
  const shortTop = bowlers.filter((x) => Number(x.p.stats.testMatches) < 50).length;
  ok(shortTop <= 4, 'at most 4 of the top-20 bowlers played fewer than 50 Tests', shortTop);

  // anti-gaming at the XI level: a specialist declared as an all-rounder
  // adds a weak batting half to the batting unit — the team never gains
  const E = (player: NormalizedPlayer, declaredRole: string) => ({ player, declaredRole });
  const ranked = [...byId.values()].map((p) => ({ p, s: scorePlayer(p, null, CTX).score ?? -1 }));
  const top = (role: string, n: number) =>
    ranked.filter((x) => x.p.primaryRole === role).sort((a, b) => b.s - a.s).slice(0, n).map((x) => x.p);
  const base = [
    ...top('opener', 2).map((p) => E(p, 'opener')),
    ...top('middle-order', 4).map((p) => E(p, 'middle-order')),
    E(top('wicketkeeper', 1)[0], 'wicketkeeper'),
  ];
  const pace = top('fast-bowler', 3).map((p) => E(p, 'fast-bowler'));
  const murali = P('muttiah-muralitharan');
  const asSpinner = teamBlend([...base, E(murali, 'spinner'), ...pace], CTX).score;
  const asAR = teamBlend([...base, E(murali, 'all-rounder'), ...pace], CTX).score;
  ok(asAR <= asSpinner, 'declaring a specialist spinner as all-rounder never raises the team score', { asSpinner, asAR });
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
