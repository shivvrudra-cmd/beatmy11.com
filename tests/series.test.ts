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
  playSeries, headlineName,
  normCdf,
  normInv,
  type SeriesPlayer,
} from '../src/lib/series';
import { gradeFor, gradeTitle, shapeTitle, tipsFor, pickTip } from '../src/lib/result-insights';

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

// The whole ladder hangs off par: exact cuts at par -7, and the big wins sit 4 / 7 above par.
ok(PAR_GAP === -7, 'par is 7 points below the World XI');
ok(JSON.stringify(GAP_CUTS) === JSON.stringify([-21, -15, -8, -6, -3, 0]), 'exact gap cuts at par -7', GAP_CUTS);
ok(GAP_CUTS[4] === PAR_GAP + 4 && GAP_CUTS[5] === PAR_GAP + 7, 'rout cuts are relative to par (+4 / +7)');
{
  const line = (g: number) => { const b = bandFor(g); return b.user + '-' + b.house; };
  const cases: [number, string][] = [
    [-25, '0-5'], [-21, '1-4'], [-16, '1-4'], [-15, '2-3'], [-9, '2-3'], [-8, '2-2'], [-7, '2-2'], [-6.01, '2-2'],
    [-6, '3-2'], [-3.01, '3-2'], [-3, '4-1'], [-0.01, '4-1'], [0, '5-0'], [10, '5-0'],
  ];
  for (const [g, want] of cases) ok(line(g) === want, `gap ${g} → ${want}`, line(g));
}
ok(OUTCOME_BANDS.filter((b) => b.user >= 4).every((b) => bandFor(PAR_GAP).user < b.user), 'an XI exactly at par never gets a 4–1 or 5–0 without luck');

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
      if (t.heroSide !== t.result || !side.some((p) => t.hero.startsWith(headlineName(p.name)))) bad++;
      if (!t.summary.startsWith(t.result === 'user' ? 'Your XI win' : 'World XI win')) bad++;
    }
  }
  ok(bad === 0, 'every hero and summary matches the side that won the Test', bad);
}
{
  // headlines: initials + surname; two or three batting heroes, never lopsided; a second
  // performer from the other side with the other skill; a player of the series
  ok(headlineName('Muttiah Muralitharan') === 'M Muralitharan', 'initial + surname');
  ok(headlineName('AB de Villiers') === 'AB de Villiers' && headlineName('V V S Laxman') === 'VVS Laxman', 'existing initials are kept together');
  ok(headlineName('Inzamam-ul-Haq') === 'Inzamam-ul-Haq' && headlineName('Faf du Plessis') === 'F du Plessis', 'single names and particles');
  let lopsided = 0, badAlso = 0, noStar = 0, wrongStar = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const s = playSeries({ userScore: 60 + (seed % 25), houseScore: 80, userXI, houseXI, calibration, seed });
    const played = s.tests.filter((t) => t.heroKind !== null);
    const bat = played.filter((t) => t.heroKind === 'bat').length;
    const bowl = played.length - bat;
    if (bat > 3 || bowl > 3) lopsided++;
    for (const t of played) {
      const other = t.heroSide === 'user' ? houseXI : userXI;
      if (!t.also || t.alsoSide === t.heroSide || !other.some((p) => t.also.startsWith(headlineName(p.name)))) badAlso++;
      if (/\d\/\d/.test(t.hero) === /\d\/\d/.test(t.also)) badAlso++; // one batting line, one bowling line
    }
    if (played.length && !s.playerOfSeries) noStar++;
    const winner = s.user > s.house ? 'user' : s.house > s.user ? 'house' : null;
    if (s.playerOfSeries && winner && s.tests.some((t) => t.result === winner && t.hero) && s.playerOfSeries.side !== winner) wrongStar++;
  }
  ok(lopsided === 0, 'never more than three batting or three bowling headlines', lopsided);
  ok(badAlso === 0, 'each played match has a second performer from the other side with the other skill', badAlso);
  ok(noStar === 0 && wrongStar === 0, 'player of the series comes from the side that won it', { noStar, wrongStar });
  const hi = playSeries({ userScore: 1000, houseScore: 80, userXI, houseXI, calibration, seed: 5 });
  const lo = playSeries({ userScore: 0, houseScore: 80, userXI, houseXI, calibration, seed: 5 });
  ok(hi.topPercent <= 1 && lo.topPercent >= 99, 'top-% figure tracks the rank');
}

{
  // result-insights: grade from the rank among drafts, titles, tips
  ok(gradeFor(0.96) === 'A+' && gradeFor(0.95) === 'A+' && gradeFor(0.8) === 'A' && gradeFor(0.5) === 'B' && gradeFor(0.49) === 'C' && gradeFor(0) === 'C', 'grades: top 5% / 20% / 50% / rest, never below C');
  ok(gradeTitle('A+', 3) === 'Dynasty' && gradeTitle('C', 0) === 'Work in progress' && gradeTitle('A', 5) === 'Unbeatable', 'grade titles; a 5-0 is Unbeatable');
  ok(shapeTitle(90, 70) === 'Batting heavy' && shapeTitle(70, 80) === 'Bowling attack' && shapeTitle(80, 75) === 'Well balanced', 'shape titles');
  for (const f of ['test', 'odi', 't20i', 'ipl'] as const) {
    const n = tipsFor(f).length;
    ok(n >= 15 && n <= 20, `${f}: 15 to 20 tips`, n);
    const tip = pickTip(f, { batting: 2, bowling: 20, fielding: 5 }, () => 0.1);
    ok(tipsFor(f).some((t) => t.text === tip && t.aspect === 'bowling'), `${f}: the tip leans to the weakest part`, tip);
  }
  ok(!tipsFor('test').some((t) => /T20|ODI/.test(t.text)) && tipsFor('ipl').some((t) => /strike rate matters most/.test(t.text)), 'tips are format-specific');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
