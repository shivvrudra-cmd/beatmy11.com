/**
 * White-ball rating engine (src/lib/white-ball-metrics.ts): structure and
 * honesty rules, on small hand-made populations and on the real data.
 */
import { readFileSync } from 'node:fs';
import {
  WB_FORMATS, buildWbContext, scoreWbPlayer, wbTeamBlend, compareWbXIs, canScoreAs, wbRole,
  IncompleteWhiteBallData, type WbPlayer,
} from '../src/lib/white-ball-metrics';

let pass = 0, fail = 0;
const ok = (cond: boolean, name: string, extra?: unknown) => {
  if (cond) pass++;
  else { fail++; console.log(`FAIL: ${name}`, extra ?? ''); }
};
const throws = (fn: () => unknown, type: unknown) => { try { fn(); return false; } catch (e) { return e instanceof (type as new () => Error); } };

const fmt = WB_FORMATS.ipl;
const bat = (id: string, avg: number, sr: number, matches = 100, extra: Partial<WbPlayer> = {}): WbPlayer => ({
  id, name: id, primaryRole: 'middle-order',
  stats: { matches, runs: avg * matches * 0.8, battingAverage: avg, strikeRate: sr, fifties: matches / 10, hundreds: 0, dismissals: matches / 4 },
  ...extra,
});
const bowl = (id: string, avg: number, econ: number, matches = 100): WbPlayer => ({
  id, name: id, primaryRole: 'fast-bowler',
  stats: { matches, wickets: matches * 1.2, bowlingAverage: avg, economy: econ, ballsPerWicket: (avg / econ) * 6, dismissals: matches / 5 },
});

// ---- structure
for (const f of Object.values(WB_FORMATS)) {
  ok(f.batting.length === 4 && f.bowling.length === 4, `${f.id}: 4 batting + 4 bowling metrics (owner-approved)`);
  const sum = (xs: { weight: number }[]) => xs.reduce((a, b) => a + b.weight, 0);
  ok(Math.abs(sum(f.batting) - 1) < 1e-9 && Math.abs(sum(f.bowling) - 1) < 1e-9, `${f.id}: weights sum to 1`);
  const s = f.teamShares;
  ok(Math.abs(s.batting + s.bowling + s.fielding - 1) < 1e-9, `${f.id}: team shares sum to 1`);
}
ok(WB_FORMATS.odi.batting.some((m) => m.key === 'centuryRate') && WB_FORMATS.ipl.batting.some((m) => m.key === 'fiftyRate'), 'ODI uses century rate, T20 uses fifty rate');
ok(WB_FORMATS.ipl.bowling.filter((m) => !m.higherIsBetter).map((m) => m.key).sort().join() === 'ballsPerWicket,bowlingAverage,economy', 'lower-is-better: average, economy, balls per wicket');

// ---- ranking on a hand-made population
const pop = [bat('b1', 20, 110), bat('b2', 30, 125), bat('b3', 40, 140), bat('b4', 50, 155), bowl('w1', 35, 9), bowl('w2', 28, 8), bowl('w3', 22, 7), bowl('w4', 18, 6.2)];
const ctx = buildWbContext(pop, fmt, 0);
const sc = (p: WbPlayer, role?: string) => scoreWbPlayer(p, role ?? null, ctx, fmt);
ok(sc(pop[3]).score > sc(pop[2]).score && sc(pop[2]).score > sc(pop[1]).score && sc(pop[1]).score > sc(pop[0]).score, 'better batting numbers rank higher');
ok(sc(pop[7]).score > sc(pop[6]).score && sc(pop[6]).score > sc(pop[4]).score, 'lower bowling average and economy rank higher');
ok(sc(pop[3]).bowlingScore === null && sc(pop[7]).battingScore === null, 'batters get no bowling score; specialist bowlers no batting score');
ok(sc(pop[3]).score === scoreWbPlayer(pop[3], null, ctx, fmt).score, 'deterministic');

// ---- shrinkage: a 3-match wonder does not outrank a long career
const ctxS = buildWbContext([...pop, bat('long', 45, 150, 150)], fmt);
const wonder = bat('wonder', 90, 220, 3);
const long = bat('long', 45, 150, 150);
ok(scoreWbPlayer(long, null, ctxS, fmt).score > scoreWbPlayer(wonder, null, ctxS, fmt).score, 'short hot streak is pulled to the mean and gets little longevity');

// ---- all-rounder: the second skill only adds
const ar: WbPlayer = { id: 'ar', name: 'ar', primaryRole: 'all-rounder', secondaryRoles: ['fast-bowler', 'middle-order'],
  stats: { ...bat('x', 40, 140).stats, ...bowl('y', 22, 7).stats, matches: 100, dismissals: 30 } };
const arScore = sc(ar);
ok(arScore.battingScore !== null && arScore.bowlingScore !== null && arScore.score >= Math.max(arScore.battingScore, arScore.bowlingScore), 'all-rounder score >= the stronger half', arScore);
ok(sc(ar, 'middle-order').bowlingScore === null, 'declared as a batter: scored on batting only');

// ---- honesty: missing numbers are refused, never filled
const noAvg: WbPlayer = { id: 'na', name: 'na', primaryRole: 'opener', stats: { matches: 5, runs: 40, strikeRate: 120, fifties: 0, hundreds: 0, dismissals: 1 } };
ok(!canScoreAs(noAvg, 'opener', fmt), 'a batter never dismissed has no average: not scorable');
ok(throws(() => sc(noAvg), IncompleteWhiteBallData), 'scoring him throws instead of inventing an average');
ok(throws(() => sc(pop[3], 'spinner'), IncompleteWhiteBallData), 'a pure batter cannot be scored as a bowler');

// ---- team blend
const xi = [
  ...[0, 1, 2, 3].map((i) => ({ player: pop[i] })), { player: bat('k', 35, 130) }, { player: bat('m', 33, 128) },
  { player: ar }, { player: { ...ar, id: 'ar2' } }, { player: pop[5] }, { player: pop[6] }, { player: pop[7] },
];
const ctxT = buildWbContext([...pop, ar, bat('k', 35, 130), bat('m', 33, 128)], fmt, 0);
const team = wbTeamBlend(xi, ctxT, fmt);
ok(Math.abs(team.score - Math.round((0.4 * team.teamBatting + 0.5 * team.teamBowling + 0.1 * team.teamFielding) * 10) / 10) < 1e-9, 'team score = 40% batting + 50% bowling + 10% fielding');
ok(throws(() => wbTeamBlend(xi.slice(0, 10), ctxT, fmt), Error), 'an XI must have 11');
const cmp = compareWbXIs(xi, xi, ctxT, fmt);
ok(cmp.difference === 0 && cmp.userPlayers.length === 11, 'same XI both sides: level');

// ---- real data: every pool player scores in every role the game lets them be declared as
for (const id of ['odi', 't20i', 'ipl'] as const) {
  const f = WB_FORMATS[id];
  const all: WbPlayer[] = JSON.parse(readFileSync(`${process.cwd()}/src/data/formats/${id}.json`, 'utf8'));
  const scorable = all.filter((p) => canScoreAs(p, wbRole(p), f));
  ok(scorable.length / all.length > 0.9, `${id}: over 90% of players are scorable in their primary role`, `${scorable.length}/${all.length}`);
  const c = buildWbContext(scorable, f);
  let bad = 0;
  for (const p of scorable) {
    const s = scoreWbPlayer(p, null, c, f).score;
    if (!(s >= 0 && s <= 100)) bad++;
  }
  ok(bad === 0, `${id}: every rating is between 0 and 100`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
