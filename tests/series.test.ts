/**
 * Tests for the five-Test series engine (src/lib/series.ts).
 */
import {
  VENUES,
  OUTCOME_BANDS,
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

// ---- bands by percentile ----
ok(bandFor(0.05).house === 5 && bandFor(0.999).user === 5, 'bottom → 0–5, top → 5–0');
ok(bandFor(0.5).user === 2 && bandFor(0.5).house === 3, 'median XI loses 2–3');

// ---- normal helpers ----
ok([0.01, 0.2, 0.5, 0.8, 0.99].every((p) => Math.abs(normCdf(normInv(p)) - p) < 1e-4), 'normCdf ∘ normInv ≈ identity');

// ---- ranking ----
const sample = Array.from({ length: 200 }, (_, i) => 60 + i * 0.1);
ok(rankPercentile(40, sample) < 0.01 && rankPercentile(99, sample) > 0.99, 'rank percentile extremes');
ok(Math.abs(rankPercentile(sample[100], sample) - 0.5) < 0.01, 'median ranks ~0.5');

// ---- wobble keeps the overall distribution on target ----
{
  const tally = new Map<string, number>();
  const N = 20000;
  const rng = mulberry32(99);
  for (let i = 0; i < N; i++) {
    const b = bandFor(wobble((i + 0.5) / N, rng));
    tally.set(`${b.user}-${b.house}`, (tally.get(`${b.user}-${b.house}`) ?? 0) + 1);
  }
  ok(
    OUTCOME_BANDS.every((b) => Math.abs((tally.get(`${b.user}-${b.house}`) ?? 0) / N - b.share) < 0.012),
    'with the wobble, outcome shares match the owner targets',
    Object.fromEntries(tally),
  );
  // …and the wobble still rewards skill: a top XI rarely loses the series
  const r2 = mulberry32(7);
  let topWins = 0;
  for (let i = 0; i < 2000; i++) { const b = bandFor(wobble(0.97, r2)); if (b.user > b.house) topWins++; }
  ok(topWins / 2000 > 0.85, 'a top-3% XI wins the series most of the time', topWins / 2000);
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
  const a = playSeries({ userScore: 70, userXI, houseXI, calibration, seed: 1234 });
  const b = playSeries({ userScore: 70, userXI, houseXI, calibration, seed: 1234 });
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
    const s = playSeries({ userScore: 60 + (seed % 20), userXI, houseXI, calibration, seed });
    for (const t of s.tests) {
      if (t.result === 'draw') continue;
      const side = t.result === 'user' ? userXI : houseXI;
      if (t.heroSide !== t.result || !side.some((p) => t.hero.startsWith(p.name.split(' ').slice(-1)[0]))) bad++;
      if (!t.summary.startsWith(t.result === 'user' ? 'Your XI win' : 'My 11 win')) bad++;
    }
  }
  ok(bad === 0, 'every hero and summary matches the side that won the Test', bad);
  const hi = playSeries({ userScore: 1000, userXI, houseXI, calibration, seed: 5 });
  const lo = playSeries({ userScore: 0, userXI, houseXI, calibration, seed: 5 });
  ok(hi.topPercent <= 1 && lo.topPercent >= 99, 'top-% figure tracks the rank');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
