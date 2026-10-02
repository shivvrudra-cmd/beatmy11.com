/**
 * "Pick any XI" rules (src/lib/pick-xi.ts): the symmetric friend-duel ladder, one seed per pair of
 * XIs, name cleaning, badges and the head-to-head record.
 */
import { DUEL_CUTS, duelBand, duelSeed, cleanName, xiLabel, badgesFor, recordH2H, h2hLine, type BadgePlayer } from '../src/lib/pick-xi';
import { playSeries } from '../src/lib/series';

let pass = 0, fail = 0;
const ok = (cond: boolean, name: string, extra?: unknown) => {
  if (cond) pass++;
  else { fail++; console.log(`FAIL: ${name}`, extra ?? ''); }
};

// ---- the duel ladder is symmetric: swapping the sides mirrors the scoreline
for (const g of [0, 0.5, 2, 3.9, 4, 7.9, 8, 20]) {
  const a = duelBand(g), b = duelBand(-g - 1e-9);
  ok(a.user === b.house && a.house === b.user, `gap ${g}: mirrored scoreline`, { a, b });
}
ok(duelBand(0).draws === 1 && duelBand(1).user === 3 && duelBand(4).user === 4 && duelBand(8).user === 5 && duelBand(-8.1).house === 5, 'duel cut points', DUEL_CUTS);
ok(duelSeed(['a:o'], ['b:o']) === duelSeed(['a:o'], ['b:o']) && duelSeed(['a:o'], ['b:o']) !== duelSeed(['b:o'], ['a:o']), 'one seed per ordered pair');

// ---- playSeries follows the duel ladder when given it
{
  const xi = Array.from({ length: 11 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, nation: 'X', era: 'e', role: i < 6 ? 'opener' : 'fast-bowler', rating: 80, stats: { testAverage: 40, testBowlingAverage: 25, battingAverage: 40, strikeRate: 130, economy: 7 } }));
  const cal = { scores: [60, 70, 80], source: 't', generated: 't' };
  let level = 0, losses = 0, routs = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const s = playSeries({ userScore: 80, houseScore: 80, userXI: xi, houseXI: xi, calibration: cal, seed, gapCuts: DUEL_CUTS });
    if (s.user > s.house) level++;
    if (s.user < s.house) losses++;
    if (s.user === 5 || s.house === 5) routs++;
  }
  ok(level > 90 && losses > 90 && Math.abs(level - losses) < 50, 'two equal XIs: each wins about as often as the other', { wins: level, losses });
  ok(routs < 20, 'equal XIs rarely produce a whitewash', routs);
  const big = playSeries({ userScore: 95, houseScore: 70, userXI: xi, houseXI: xi, calibration: cal, seed: 7, gapCuts: DUEL_CUTS });
  ok(big.user === 5, 'a much stronger XI sweeps the series', big.user);
}

// ---- names are plain text
ok(cleanName('  <b>Shiva</b> 🏏  ') === 'bShivab' && cleanName('a'.repeat(40)).length === 20 && cleanName(null) === '', 'names: tags and symbols stripped, 20 characters at most', cleanName('  <b>Shiva</b> 🏏  '));
ok(xiLabel('Asha', 'Your friend') === "Asha's XI" && xiLabel('', "Your friend's XI") === "Your friend's XI", 'XI labels');

// ---- badges
{
  const mk = (team: string, eras: string[], overseas = false): BadgePlayer => ({ team, eras, overseas });
  const opts = { format: 'test' as const, allEras: ['legends', '1970s', '1980s'], modern: ['1980s'] };
  const one = Array.from({ length: 11 }, () => mk('India', ['1980s']));
  const ids = (b: { id: string }[]) => b.map((x) => x.id).sort().join(',');
  ok(ids(badgesFor(one, opts)) === 'new-generation,no-legends,one-era,one-team', 'one nation, one era, modern, no legends', ids(badgesFor(one, opts)));
  const tour = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'A', 'B', 'C', 'D'].map((t, i) => mk(t, [opts.allEras[i % 3]]));
  ok(ids(badgesFor(tour, opts)) === 'time-traveller,world-tour', 'world tour and time traveller', ids(badgesFor(tour, opts)));
  ok(badgesFor(one.slice(0, 10), opts).length === 0, 'no badges for an incomplete XI');
  // The 2026-10-02 badges: career length (never from unknown counts) and the flex pair.
  const withM = (n: (number | null)[], roles: string[] = []) => one.map((p, i) => ({ ...p, matches: n[i % n.length], role: roles[i] }));
  const has = (xi: BadgePlayer[], id: string, format: 'test' | 'odi' | 'ipl' = 'test') => badgesFor(xi, { ...opts, format }).some((b) => b.id === id);
  ok(has(withM([12, 30]), 'cult-heroes') && !has(withM([12, 31]), 'cult-heroes') && !has(withM([12, null]), 'cult-heroes'), 'cult heroes: nobody above 30 Tests; unknown counts never qualify');
  ok(has(withM([100, 168]), 'iron-men') && !has(withM([99, 168]), 'iron-men') && !has(one, 'iron-men'), 'iron men: everyone on 100 or more Tests');
  ok(has(withM([60]), 'cult-heroes', 'odi') && !has(withM([60]), 'cult-heroes', 'test'), 'thresholds are per format');
  const roles = ['opener', 'opener', 'middle-order', 'middle-order', 'middle-order', 'wicketkeeper', 'spinner', 'spinner', 'fast-bowler', 'fast-bowler', 'fast-bowler'];
  ok(has(withM([50], roles), 'spin-twins') && !has(withM([50], roles.map((r, i) => (i === 6 ? 'all-rounder' : r))), 'spin-twins'), 'spin twins: two spinners at 7 and 8');
  ok(!has(tour, 'one-era') && badgesFor(one, opts).find((b) => b.id === 'one-era')!.why === 'All eleven played in the 1980s', 'one era names the shared era');
  const ipl = Array.from({ length: 11 }, (_, i) => mk(i < 6 ? 'MI' : 'CSK', ['2018-22']));
  ok(badgesFor(ipl, { format: 'ipl', allEras: ['2008-12', '2013-17', '2018-22', '2023+'], modern: ['2018-22', '2023+'] }).some((b) => b.id === 'homegrown'), 'IPL: homegrown');
}

// ---- head-to-head record: counted once per pair of XIs
{
  const mem: Record<string, string> = {};
  const store = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; } };
  recordH2H(store, 'test', 'Asha', 'm1', 3, 2);
  recordH2H(store, 'test', 'Asha', 'm1', 3, 2);
  const r = recordH2H(store, 'test', 'asha', 'm2', 1, 4);
  ok(r.won === 1 && r.lost === 1 && r.drawn === 0, 'a repeat of the same pair is not counted twice; names ignore case', r);
  ok(h2hLine(r, 'Asha') === 'You and Asha are level 1–1', 'level line', h2hLine(r, 'Asha'));
  ok(h2hLine(recordH2H(store, 'test', 'Asha', 'm3', 5, 0), 'Asha') === 'You lead Asha 2–1', 'lead line');
  ok(recordH2H(store, 'odi', 'Asha', 'm1', 0, 5).lost === 1, 'each format has its own record');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
