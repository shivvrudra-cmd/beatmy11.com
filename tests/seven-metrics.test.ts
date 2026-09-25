/**
 * Tests for the finalized seven-metric rating engine (seven-metrics.ts).
 *
 * Checklist: seven metrics, derived rates, averages used directly,
 * lower-is-better only for bowling average, percentile normalization,
 * all six roles, declared-role behavior, 50/50 all-rounder weighting,
 * no batting score for specialists, missing/zero-Test handling,
 * determinism, identical-XI ties, metrics-only discipline, XI mean
 * aggregation, explicit fixed-opponent input. Draft suites untouched.
 */
import { readFileSync } from 'node:fs';
import {
  METRICS,
  BATTING_METRICS,
  BOWLING_METRICS,
  BATTING_WEIGHTS,
  BOWLING_WEIGHTS,
  ALL_ROUNDER_BATTING_SHARE,
  ALL_ROUNDER_BOWLING_SHARE,
  ROLE_METRICS,
  evaluationRole,
  rawMetrics,
  buildPopulations,
  percentileRank,
  normalizeMetrics,
  scorePlayer,
  auditMetrics,
  compareXIs,
  IncompletePlayerData,
  type NormalizedPlayer,
  type ScoringPopulations,
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
const POPS: ScoringPopulations = buildPopulations([...byId.values()]);
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
// real populations: out-of-range values hit the scale ends; everything in range
for (const def of METRICS) {
  const pop = POPS[def.key];
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
const gilly = scorePlayer(P('adam-gilchrist'), 'wicketkeeper', POPS);
ok(gilly.role === 'wicketkeeper', 'keeper keeps keeper role');
ok(
  JSON.stringify(keys(gilly.normalized)) === JSON.stringify([...BATTING_METRICS].sort()),
  'keeper evaluated on batting only, no wicketkeeping metric',
);
const warne = scorePlayer(P('shane-warne'), 'spinner', POPS);
ok(warne.battingScore === null, 'specialist spinner: no batting score');
ok(
  !('battingAverage' in warne.normalized) && !('runsPerMatch' in warne.normalized),
  'specialist spinner: no batting metrics at all',
);
ok(warne.bowlingScore !== null && warne.score === warne.bowlingScore, 'spinner score = bowling score');

// ---- 12/14. all-rounder: both sides, 50/50 ----
const kallis = scorePlayer(P('jacques-kallis'), 'all-rounder', POPS);
ok(kallis.battingScore !== null && kallis.bowlingScore !== null, 'all-rounder: separate batting + bowling scores');
const expAR =
  Math.round(
    (ALL_ROUNDER_BATTING_SHARE *
      (kallis.normalized.battingAverage! * BATTING_WEIGHTS.battingAverage +
        kallis.normalized.runsPerMatch! * BATTING_WEIGHTS.runsPerMatch +
        kallis.normalized.centuryRate! * BATTING_WEIGHTS.centuryRate) +
      ALL_ROUNDER_BOWLING_SHARE *
        (kallis.normalized.bowlingAverage! * BOWLING_WEIGHTS.bowlingAverage +
          kallis.normalized.wicketsPerMatch! * BOWLING_WEIGHTS.wicketsPerMatch +
          kallis.normalized.fiveWRate! * BOWLING_WEIGHTS.fiveWRate +
          kallis.normalized.tenWRate! * BOWLING_WEIGHTS.tenWRate)) *
      10,
  ) / 10;
ok(kallis.score === expAR, 'all-rounder score = 50/50 blend of the two sides', { got: kallis.score, exp: expAR });
ok(ALL_ROUNDER_BATTING_SHARE === 0.5 && ALL_ROUNDER_BOWLING_SHARE === 0.5, 'V1 all-rounder weighting is 50/50');

// ---- 13. declared role drives evaluation ----
const sobersDeclared = scorePlayer(P('garfield-sobers'), 'middle-order', POPS);
ok(sobersDeclared.role === 'middle-order', 'declared role overrides primary');
ok(
  JSON.stringify(keys(sobersDeclared.normalized)) === JSON.stringify([...BATTING_METRICS].sort()),
  'declared middle-order: batting metrics only, not silently an all-rounder',
);
const sobersAR = scorePlayer(P('garfield-sobers'), 'all-rounder', POPS);
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
// zero-Test XI entries cannot be silently scored
const zeroXI = Array.from({ length: 11 }, (_, i) => ({
  player: mk('middle-order', { testAverage: 40, testRuns: 100, testMatches: 0, testCenturies: 0 }, { id: `z${i}`, uid: `t:z${i}` }),
}));
let threw: unknown = null;
try {
  compareXIs(zeroXI, zeroXI, POPS);
} catch (e) { threw = e; }
ok(threw instanceof IncompletePlayerData, 'zero-Test players: compareXIs refuses a misleading score');
ok(
  threw instanceof IncompletePlayerData && threw.gaps.length === 44,
  'the error carries every gap (11 players x 2 missing rates x 2 XIs)',
);

// ---- 18. determinism ----
const detA = JSON.stringify(scorePlayer(P('viv-richards'), 'middle-order', POPS));
const detB = JSON.stringify(scorePlayer(P('viv-richards'), 'middle-order', POPS));
ok(detA === detB, 'same player + data + populations -> identical score');
const houseEntries = getHouseXI().map((player) => ({ player }));
const cmpA = compareXIs(houseEntries, houseEntries, POPS);
const cmpB = compareXIs(houseEntries, houseEntries, POPS);
ok(JSON.stringify(cmpA) === JSON.stringify(cmpB), 'compareXIs deterministic');

// ---- 19. identical XIs -> identical scores and a tie ----
ok(cmpA.userScore === cmpA.opponentScore, 'identical XIs: identical scores');
ok(cmpA.difference === 0 && cmpA.result === 'tie', 'identical XIs: tie');

// ---- 20. seven metrics are the ONLY metrics ----
const saw = new Set<string>();
for (const p of byId.values()) {
  for (const k of keys(scorePlayer(p, null, POPS).normalized)) saw.add(k);
}
ok(
  saw.size === 7 && [...saw].every((k) => (METRICS as { key: string }[]).some((m) => m.key === k)),
  'no metric outside the seven is ever produced',
);
const nm = normalizeMetrics(rawMetrics(P('imran-khan')), POPS);
ok(keys(nm).length === 7, 'normalizeMetrics covers exactly seven metrics');

// ---- 21. XI score is the arithmetic mean of the 11 player scores ----
const xi11 = Array.from({ length: 11 }, (_, i) => ({
  player: mk(
    'middle-order',
    { testAverage: 30 + i, testRuns: 3000 + 100 * i, testMatches: 100, testCenturies: 5 + i },
    { id: `m${i}`, uid: `t:m${i}`, name: `M${i}` },
  ),
}));
const manual = xi11.map((e) => scorePlayer(e.player, null, POPS).score!);
const expected = Math.round((manual.reduce((a, b) => a + b, 0) / manual.length) * 10) / 10;
const gotXI = compareXIs(xi11, xi11, POPS);
ok(gotXI.userScore === expected, 'XI score = arithmetic mean of the 11 player scores', { gotXI: gotXI.userScore, expected });
ok(gotXI.userPlayers.length === 11 && gotXI.opponentPlayers.length === 11, 'per-player detail retained for later');

// ---- 22. fixed opponent XI passed explicitly ----
const house = getHouseXI();
ok(house.length === 11, 'fixed house XI has 11 players');
const mixed = compareXIs(xi11, houseEntries, POPS);
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

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
