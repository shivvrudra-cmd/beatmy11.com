/**
 * Tests for the five-Test series engine (src/lib/series.ts).
 */
import {
  VENUES,
  OUTCOME_BANDS,
  GAP_CUTS,
  PAR_GAP,
  bandFor,
  rankPercentile,
  wobble,
  mulberry32,
  xiSeed,
  testOrder,
  playSeries,
  normCdf,
  normInv,
  type SeriesPlayer,
} from '../src/lib/series';

let pass = 0, fail = 0;
const ok = (cond: boolean, name: string, extra?: unknown) => {
  if (cond) pass++;
  else { fail++; console.log(`FAIL: ${name}`, extra ?? ''); }
};

// ---- owner targets ----
ok(Math.abs(OUTCOME_BANDS.reduce((s, b) => s + b.share, 0) - 1) < 1e-12, 'band shares sum to 100%');
const share = (u: number, h: number) => OUTCOME_BANDS.find((b) => b.user === u && b.house === h)!.share;
ok(share(5, 0) === 0.05 && share(4, 1) === 0.1 && share(3, 2) === 0.2, 'win targets 5% / 10% / 20%');
ok(share(2, 2) === 0.1 && share(2, 3) === 0.35 && share(1, 4) === 0.1 && share(0, 5) === 0.1, 'draw/loss targets 10% / 35% / 10% / 10%');
ok(OUTCOME_BANDS.every((b) => b.user + b.house + b.draws === 5), 'every band is a five-Test series');
ok(JSON.stringify(VENUES) === JSON.stringify(["Lord's", 'MCG', 'Eden Gardens', 'Newlands', 'Kensington Oval']), 'owner venues in order');

// ---- bands by score gap (user − World XI) ----
ok(GAP_CUTS.length === OUTCOME_BANDS.length - 1 && GAP_CUTS.every((c, i) => i === 0 || c > GAP_CUTS[i - 1]), 'one ascending gap cut between each pair of scorelines');
ok(bandFor(-30).house === 5 && bandFor(30).user === 5, 'far behind → 0–5, far ahead → 5–0');
ok(bandFor(PAR_GAP - 4).user === 2 && bandFor(PAR_GAP - 4).house === 3, 'a few points below par loses 2–3');
ok(bandFor(PAR_GAP).draws === 1, 'at par → drawn 2–2');
ok(bandFor(PAR_GAP + 2).user === 3 && bandFor(PAR_GAP + 2).house === 2, 'a little above par wins 3–2');
ok(bandFor(PAR_GAP - 0.99).draws === 1 && bandFor(PAR_GAP + 0.99).draws === 1, 'draw band spans ±1 either side of par');
ok(OUTCOME_BANDS.every((b, i) => bandFor(i === 0 ? GAP_CUTS[0] - 1 : GAP_CUTS[i - 1]) === b), 'every scoreline is reachable');
ok(OUTCOME_BANDS.filter((b) => b.user > b.house).every((b) => bandFor(GAP_CUTS[OUTCOME_BANDS.indexOf(b) - 1]).user > b.house), 'series wins need the user above par');

// ---- normal helpers ----
ok([0.01, 0.2, 0.5, 0.8, 0.99].every((p) => Math.abs(normCdf(normInv(p)) - p) < 1e-4), 'normCdf ∘ normInv ≈ identity');

// ---- ranking ----
const sample = Array.from({ length: 200 }, (_, i) => 60 + i * 0.1);
ok(rankPercentile(40, sample) < 0.01 && rankPercentile(99, sample) > 0.99, 'rank percentile extremes');
ok(Math.abs(rankPercentile(sample[100], sample) - 0.5) < 0.01, 'median ranks ~0.5');

// ---- wobble: luck in score points, but skill still decides ----
{
  const rng = mulberry32(99);
  let level = 0, behind = 0, ahead = 0;
  const N = 4000;
  for (let i = 0; i < N; i++) {
    if (bandFor(wobble(PAR_GAP, rng)).user > bandFor(wobble(PAR_GAP, rng)).house) level++;
    if (bandFor(wobble(PAR_GAP - 10, rng)).user > bandFor(wobble(PAR_GAP - 10, rng)).house) behind++;
    if (bandFor(wobble(PAR_GAP + 10, rng)).user > bandFor(wobble(PAR_GAP + 10, rng)).house) ahead++;
  }
  ok(ahead / N > 0.95, 'an XI 10 points above par nearly always wins the series', ahead / N);
  ok(behind / N < 0.02, 'an XI 10 points below par almost never wins the series', behind / N);
  ok(level / N > 0.2 && level / N < 0.45, 'an XI at par can go either way (upsets exist)', level / N);
}

// ---- seeding ----
const xi = [{ id: 'a', role: 'opener' }, { id: 'b', role: 'spinner' }];
ok(xiSeed(xi) === xiSeed([...xi].reverse()), 'XI seed ignores order');
ok(xiSeed(xi) !== xiSeed([{ id: 'a', role: 'opener' }, { id: 'b', role: 'all-rounder' }]), 'XI seed depends on declared roles');

// ---- Test order ----
for (let s = 1; s <= 50; s++) {
  const o32 = testOrder(OUTCOME_BANDS[4], mulberry32(s));
  const o23 = testOrder(OUTCOME_BANDS[2], mulberry32(s));
  if (o32[4] !== 'user' || o32.slice(0, 4).filter((r) => r === 'user').length !== 2) { ok(false, '3–2 decided in the 5th Test', o32); break; }
  if (o23[4] !== 'house' || o23.slice(0, 4).filter((r) => r === 'house').length !== 2) { ok(false, '2–3 decided in the 5th Test', o23); break; }
  if (s === 50) ok(true, '3–2 and 2–3 are level 2–2 before a 5th-Test decider');
}

// ---- full series ----
const mkP = (id: string, role: string, rating: number, avg?: number, bowl?: number): SeriesPlayer => ({
  id, name: `Player ${id.toUpperCase()}`, role, rating, stats: { testAverage: avg ?? null, testBowlingAverage: bowl ?? null },
});
const userXI = [mkP('u1', 'opener', 80, 45), mkP('u2', 'middle-order', 70, 50), mkP('u3', 'fast-bowler', 85, 12, 23), mkP('u4', 'spinner', 60, 10, 29)];
const houseXI = [mkP('h1', 'opener', 99, 99.9), mkP('h2', 'middle-order', 98, 52), mkP('h3', 'spinner', 99, 11, 22.7), mkP('h4', 'fast-bowler', 91, 22, 23.6)];
const calibration = { scores: sample, source: 'test', generated: 'test' };
{
  const a = playSeries({ userScore: 70, houseScore: 80, userXI, houseXI, calibration, seed: 1234 });
  const b = playSeries({ userScore: 70, houseScore: 80, userXI, houseXI, calibration, seed: 1234 });
  ok(JSON.stringify(a) === JSON.stringify(b), 'same XI + seed → identical series');
  ok(a.tests.length === 5 && a.tests.every((t, i) => t.venue === VENUES[i] && t.number === i + 1), 'five Tests at the owner venues in order');
  ok(
    a.tests.filter((t) => t.result === 'user').length === a.user &&
      a.tests.filter((t) => t.result === 'house').length === a.house &&
      a.tests.filter((t) => t.result === 'draw').length === a.draws,
    'Test results add up to the scoreline',
  );
}
{
  // heroes always come from the side that won that Test
  let bad = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const s = playSeries({ userScore: 60 + (seed % 20), houseScore: 80, userXI, houseXI, calibration, seed });
    for (const t of s.tests) {
      if (t.result === 'draw') continue;
      const side = t.result === 'user' ? userXI : houseXI;
      if (t.heroSide !== t.result || !side.some((p) => t.hero.startsWith(p.name.split(' ').slice(-1)[0]))) bad++;
      if (!t.summary.startsWith(t.result === 'user' ? 'Your XI win' : 'World XI win')) bad++;
    }
  }
  ok(bad === 0, 'every hero and summary matches the side that won the Test', bad);
  const hi = playSeries({ userScore: 1000, houseScore: 80, userXI, houseXI, calibration, seed: 5 });
  const lo = playSeries({ userScore: 0, houseScore: 80, userXI, houseXI, calibration, seed: 5 });
  ok(hi.topPercent <= 1 && lo.topPercent >= 99, 'top-% figure tracks the rank');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
