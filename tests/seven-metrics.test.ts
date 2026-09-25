/**
 * Tests for the specified layer of the rating engine (seven-metrics.ts).
 *
 * Covers spec §16 with real player data: role coverage, directionality,
 * keeper inclusion, all-rounder both-sides evaluation, no artificial
 * batting scores for specialist bowlers, determinism, missing-data
 * flagging, and the gated comparison interface.
 */
import { readFileSync } from 'node:fs';
import {
  METRICS,
  ROLE_METRICS,
  BATTING_METRICS,
  BOWLING_METRICS,
  evaluationRole,
  rawMetrics,
  scorePlayer,
  auditMetrics,
  compareXIs,
  MissingScoringSpec,
  type NormalizedPlayer,
} from '../src/lib/seven-metrics';
import { normalizePlayer } from '../src/lib/player-logic';

let pass = 0, fail = 0;
const ok = (cond: boolean, name: string, extra?: unknown) => {
  if (cond) { pass++; }
  else { fail++; console.log(`FAIL: ${name}`, extra ?? ''); }
};

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
const keys = (o: object) => Object.keys(o).sort();

// ---- the seven metrics exist with correct directionality ----
ok(METRICS.length === 7, 'seven metrics defined');
const bowlAvg = METRICS.find((m) => m.key === 'bowlingAverage')!;
ok(bowlAvg.higherIsBetter === false, 'lower bowling average is better');
ok(
  METRICS.filter((m) => m.key !== 'bowlingAverage').every((m) => m.higherIsBetter),
  'all other metrics are higher-is-better',
);

// ---- role -> applicable metrics (spec §5) ----
ok(keys(ROLE_METRICS).length === 6, 'six evaluation roles');
for (const r of ['opener', 'middle-order', 'wicketkeeper'] as const) {
  ok(
    JSON.stringify([...ROLE_METRICS[r]].sort()) === JSON.stringify([...BATTING_METRICS].sort()),
    `${r} evaluated on the three batting metrics`,
  );
}
for (const r of ['spinner', 'fast-bowler'] as const) {
  ok(
    JSON.stringify([...ROLE_METRICS[r]].sort()) === JSON.stringify([...BOWLING_METRICS].sort()),
    `${r} evaluated on the four bowling metrics`,
  );
}
ok(ROLE_METRICS['all-rounder'].length === 7, 'all-rounder gets all seven metrics');

// ---- specialist opener ----
const hobbs = scorePlayer(P('jack-hobbs'), 'opener');
ok(hobbs.role === 'opener', 'declared role wins for evaluation role');
ok(JSON.stringify(keys(hobbs.metrics)) === JSON.stringify([...BATTING_METRICS].sort()), 'opener: batting metrics only');
ok(hobbs.batting === undefined && hobbs.bowling === undefined, 'opener: no batting/bowling split');

// ---- wicketkeeper is evaluated, not excluded ----
const gilchrist = scorePlayer(P('adam-gilchrist'));
ok(gilchrist.role === 'wicketkeeper', 'keeper keeps keeper evaluation role');
ok(JSON.stringify(keys(gilchrist.metrics)) === JSON.stringify([...BATTING_METRICS].sort()), 'keeper: batting metrics, not excluded');

// ---- specialist spinner / fast bowler: no artificial batting score ----
const warne = scorePlayer(P('shane-warne'));
ok(JSON.stringify(keys(warne.metrics)) === JSON.stringify([...BOWLING_METRICS].sort()), 'spinner: bowling metrics only');
ok(!('battingAverage' in warne.metrics), 'spinner gets no artificial batting score');
const mcgrath = scorePlayer(P('glenn-mcgrath'));
ok(JSON.stringify(keys(mcgrath.metrics)) === JSON.stringify([...BOWLING_METRICS].sort()), 'fast bowler: bowling metrics only');

// ---- genuine all-rounder: both sides ----
const sobers = scorePlayer(P('garfield-sobers'));
ok(sobers.role === 'all-rounder', 'sobers evaluates as all-rounder');
ok(!!sobers.batting && !!sobers.bowling, 'all-rounder receives both batting and bowling evaluation');
ok(
  JSON.stringify(keys(sobers.batting!)) === JSON.stringify([...BATTING_METRICS].sort()) &&
  JSON.stringify(keys(sobers.bowling!)) === JSON.stringify([...BOWLING_METRICS].sort()),
  'all-rounder batting/bowling splits carry the right metrics',
);

// ---- averages used directly, never recalculated ----
const raw = rawMetrics(P('jack-hobbs'));
ok(raw.battingAverage === P('jack-hobbs').stats.testAverage, 'batting average used directly from data');
const warneRaw = rawMetrics(P('shane-warne'));
ok(
  warneRaw.bowlingAverage === P('shane-warne').stats.testBowlingAverage,
  'bowling average used directly from data',
);
// Hand-check a derived rate: runs per match = testRuns / testMatches.
const h = P('jack-hobbs');
ok(
  Math.abs((raw.runsPerMatch ?? -1) - h.stats.testRuns / h.stats.testMatches) < 1e-9,
  'runs per match = testRuns / testMatches',
);
ok(
  Math.abs((warneRaw.wicketsPerMatch ?? -1) - P('shane-warne').stats.testWickets / P('shane-warne').stats.testMatches) < 1e-9,
  'wickets per match = testWickets / testMatches',
);

// ---- directionality: better underlying numbers -> better raw metric ----
const mkBatter = (avg: number, runs: number, centuries: number): NormalizedPlayer => ({
  uid: 't:x', id: 'x', name: 'X', nation: 'N', era: '1990s', displayEra: '1990s',
  primaryRole: 'opener', secondaryRoles: [],
  stats: { testAverage: avg, testRuns: runs, testMatches: 100, testCenturies: centuries },
});
const a = rawMetrics(mkBatter(50, 8000, 25));
const b = rawMetrics(mkBatter(40, 6000, 15));
ok(a.battingAverage! > b.battingAverage!, 'higher average -> higher batting metric');
ok(a.runsPerMatch! > b.runsPerMatch!, 'higher runs -> higher runs-per-match');
ok(a.centuryRate! > b.centuryRate!, 'higher century rate improves evaluation');
const mkBowler = (avg: number, wickets: number, fiveWs: number, tenWs: number): NormalizedPlayer => ({
  uid: 't:y', id: 'y', name: 'Y', nation: 'N', era: '1990s', displayEra: '1990s',
  primaryRole: 'fast-bowler', secondaryRoles: [],
  stats: { testBowlingAverage: avg, testWickets: wickets, testMatches: 100, fiveWs, tenWs },
});
const c = rawMetrics(mkBowler(22, 400, 20, 5));
const d = rawMetrics(mkBowler(30, 300, 10, 2));
ok(c.wicketsPerMatch! > d.wicketsPerMatch!, 'higher wickets-per-match improves evaluation');
ok(c.fiveWRate! > d.fiveWRate!, 'higher five-wicket rate improves evaluation');
ok(c.tenWRate! > d.tenWRate!, 'higher ten-wicket rate improves evaluation');
ok(c.bowlingAverage! < d.bowlingAverage!, 'lower bowling average is the better raw value');

// ---- determinism ----
ok(
  JSON.stringify(scorePlayer(P('viv-richards'))) === JSON.stringify(scorePlayer(P('viv-richards'))),
  'same player + same data -> same score',
);
ok(
  JSON.stringify(rawMetrics(P('imran-khan'))) === JSON.stringify(rawMetrics(P('imran-khan'))),
  'raw metrics deterministic',
);

// ---- missing data is flagged, never zero-filled ----
const zeroMatch = P('tanunurwa-makoni');
const zmRaw = rawMetrics(zeroMatch);
ok(
  zmRaw.runsPerMatch === null && zmRaw.centuryRate === null,
  'zero-match player: per-match rates are null, not zero',
);
const gaps = auditMetrics([
  { player: P('saqlain-mushtaq'), declaredRole: 'spinner' },
  { player: P('mohammed-siraj'), declaredRole: 'fast-bowler' },
  { player: zeroMatch, declaredRole: 'opener' },
]);
const gapKeys = gaps.map((g) => `${g.playerId}:${g.metric}`).sort();
ok(gapKeys.includes('saqlain-mushtaq:bowlingAverage'), 'missing bowling average flagged for Saqlain');
ok(gapKeys.includes('mohammed-siraj:bowlingAverage'), 'missing bowling average flagged for Siraj');
ok(gapKeys.includes('tanunurwa-makoni:runsPerMatch'), 'zero-match rates flagged');
ok(
  gaps.every((g) => /confirm how this should be handled/.test(g.reason)),
  'gaps ask for confirmation rather than inventing a rule',
);
// A complete XI has no gaps: the fixed house XI's applicable metrics.
import { getHouseXI } from '../src/lib/opponent-xi';
const houseGaps = auditMetrics(getHouseXI().map((p) => ({ player: p })));
ok(
  houseGaps.length === 0,
  'house XI: every applicable metric computable from verified data',
  houseGaps.slice(0, 3),
);

// ---- declared role drives evaluation (draft integration) ----
const declared = scorePlayer(P('garfield-sobers'), 'middle-order');
ok(declared.role === 'middle-order', 'declared role overrides primary for scoring');
ok(JSON.stringify(keys(declared.metrics)) === JSON.stringify([...BATTING_METRICS].sort()), 'declared middle-order: batting metrics only');

// ---- comparison interface: gated until the missing decisions arrive ----
let threw: unknown = null;
try {
  compareXIs(
    [{ player: P('jack-hobbs'), declaredRole: 'opener' }],
    [{ player: P('jack-hobbs'), declaredRole: 'opener' }],
  );
} catch (e) { threw = e; }
ok(threw instanceof MissingScoringSpec, 'compareXIs refuses to invent scores');
ok(
  threw instanceof MissingScoringSpec &&
    threw.missing.includes('metric weights') &&
    threw.missing.includes('metric normalization methodology'),
  'the error names exactly what is missing',
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) throw new Error('tests failed');
