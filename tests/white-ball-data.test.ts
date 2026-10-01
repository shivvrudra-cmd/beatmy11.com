/**
 * White-ball data (scripts/cricsheet/build-white-ball.mjs):
 *  1. the counting rules, on a hand-made match whose totals are worked out by hand;
 *  2. sanity of the generated src/data/formats/*.json (no invented or impossible values).
 */
import { readFileSync } from 'node:fs';
// @ts-expect-error plain .mjs build script
import { aggregate, careerStats, sameIdentity, NATIONS, IPL_BLOCKS, ODI_FIRST_SEEN_CUTOFF } from '../scripts/cricsheet/build-white-ball.mjs';

let pass = 0, fail = 0;
const ok = (cond: boolean, name: string, extra?: unknown) => {
  if (cond) pass++;
  else { fail++; console.log(`FAIL: ${name}`, extra ?? ''); }
};

// ---- 1. hand-made match. Team A bats; B bowls.
// Ball by ball (A1 & A2 open, A3 in at 3):
//  1. B1 to A1: 4 runs                          A1 4 (1 ball)       B1: 4 runs, 1 legal ball
//  2. B1 wide (1 extra)                          -                   B1: +1 run, not legal
//  3. B1 no-ball, A1 hits 2 (2 + 1 nb)          A1 6 (2 balls)      B1: +3 runs, not legal
//  4. B1 to A1: 2 byes                           A1 6 (3 balls)      B1: +0 runs, legal (2 legal)
//  5. B1 to A1: caught by B2                     A1 out, 6 (4 balls) B1: wkt 1, legal (3)
//  6. B2 to A2: run out (fielder B1)             A2 out, 0 (1 ball)  B2: no wicket, legal (1)
//  7. B2 to A3: 1 run                            A3 1 (1 ball)       B2: +1 run, legal (2)
//  8. B2 to A3: A3 retired hurt (0)              A3 not out          B2: legal (3)
//  9. B2 to A4: caught and bowled by B2          A4 out, 0 (1 ball)  B2: wkt 1, catch, legal (4)
// Then a super over (must be ignored): B1 bowls, A1 hits 6.
const D = (batter: string, non: string, bowler: string, runs: number, extras?: Record<string, number>, wicket?: object) => ({
  batter, non_striker: non, bowler,
  runs: { batter: runs, extras: extras ? Object.values(extras).reduce((a, b) => a + b, 0) : 0, total: 0 },
  ...(extras ? { extras } : {}),
  ...(wicket ? { wickets: [wicket] } : {}),
});
const match = {
  info: {
    dates: ['2015-03-01'], gender: 'male', match_type: 'ODI',
    players: { A: ['A1', 'A2', 'A3', 'A4'], B: ['B1', 'B2'] },
    registry: { people: { A1: 'a1', A2: 'a2', A3: 'a3', A4: 'a4', B1: 'b1', B2: 'b2' } },
  },
  innings: [
    {
      team: 'A',
      overs: [
        { over: 0, deliveries: [
          D('A1', 'A2', 'B1', 4),
          D('A1', 'A2', 'B1', 0, { wides: 1 }),
          D('A1', 'A2', 'B1', 2, { noballs: 1 }),
          D('A1', 'A2', 'B1', 0, { byes: 2 }),
          D('A1', 'A2', 'B1', 0, undefined, { kind: 'caught', player_out: 'A1', fielders: [{ name: 'B2' }] }),
        ] },
        { over: 1, deliveries: [
          D('A2', 'A3', 'B2', 0, undefined, { kind: 'run out', player_out: 'A2', fielders: [{ name: 'B1' }] }),
          D('A3', 'A4', 'B2', 1),
          D('A3', 'A4', 'B2', 0, undefined, { kind: 'retired hurt', player_out: 'A3' }),
          D('A4', 'A1', 'B2', 0, undefined, { kind: 'caught and bowled', player_out: 'A4', fielders: [{ name: 'B2' }] }),
        ] },
      ],
    },
    { team: 'A', super_over: true, overs: [{ over: 0, deliveries: [D('A1', 'A2', 'B1', 6)] }] },
  ],
};
const P = aggregate([match], { id: 'odi', intl: true, quota: 60 });
const s = (id: string) => careerStats(P.get(id), { id: 'odi' });
const a1 = s('a1'), a2 = s('a2'), a3 = s('a3'), a4 = s('a4'), b1 = s('b1'), b2 = s('b2');

ok(a1.runs === 6 && a1.ballsFaced === 4 && a1.innings === 1 && a1.notOuts === 0, 'A1: 6 off 4, out (wide not faced, byes not his, super over ignored)', a1);
ok(a1.battingAverage === 6 && a1.strikeRate === 150, 'A1: average 6, strike rate 150', a1);
ok(a2.runs === 0 && a2.innings === 1 && a2.notOuts === 0 && a2.ballsFaced === 1, 'A2: run out for 0 off 1', a2);
ok(a3.innings === 1 && a3.notOuts === 1 && a3.battingAverage === null, 'A3: retired hurt is not out; no average without a dismissal', a3);
ok(b1.ballsBowled === 3 && b1.runsConceded === 8 && b1.wickets === 1, 'B1: 3 legal balls, 8 runs (4 + wide 1 + 2 + nb 1; byes not charged), 1 wicket', b1);
ok(b1.economy === 16 && b1.bowlingAverage === 8, 'B1: economy 16.00, average 8', b1);
ok(b2.ballsBowled === 4 && b2.runsConceded === 1 && b2.wickets === 1, 'B2: run-out is not a bowler wicket; retired hurt is not a wicket', b2);
ok(b2.catches === 2 && b1.catches === 0 && b1.stumpings === 0, 'B2: two catches (one caught, one caught-and-bowled); run-out is not a catch', { b1, b2 });
ok(a4.innings === 1 && a4.ballsFaced === 1, 'A4 batted once', a4);
ok(P.get('a1').positions[0] === 1 && P.get('a2').positions[0] === 2 && P.get('a3').positions[0] === 3, 'batting order from arrival');
ok(P.get('b1').matches === 1 && P.get('a1').matches === 1, 'one appearance each');

// Milestones and 4-wicket innings.
const big = { ...match, innings: [{ team: 'A', overs: [{ over: 0, deliveries: [
  ...Array.from({ length: 25 }, () => D('A1', 'A2', 'B1', 4)),
  ...['A2', 'A3', 'A4', 'A1'].map((who) => D(who, 'A1', 'B2', 0, undefined, { kind: 'bowled', player_out: who })),
] }] }] };
const Pb = aggregate([big], { id: 'odi', intl: true, quota: 60 });
const big1 = careerStats(Pb.get('a1'), { id: 'odi' }), bigB2 = careerStats(Pb.get('b2'), { id: 'odi' });
ok(big1.hundreds === 1 && big1.fifties === 0 && big1.highest === 100, 'a hundred counts as a hundred, not also a fifty', big1);
ok(bigB2.fourWicketInnings === 1 && bigB2.fiveWicketInnings === 0 && bigB2.wickets === 4, '4-wicket innings counted', bigB2);

ok(sameIdentity('PJ Cummins', 'Pat Cummins') && !sameIdentity('PJ Cummins', 'Anderson Cummins') && sameIdentity('MS Dhoni', 'Mahendra Singh Dhoni') && sameIdentity('SL Malinga', 'Lasith Malinga') && !sameIdentity('PJ Cummins', 'Miguel Cummins'), 'name identity: surname plus a shared initial (middle names allowed)');

// ---- 2. generated data sanity
const ROLES = new Set(['opener', 'middle-order', 'wicketkeeper', 'all-rounder', 'spinner', 'fast-bowler']);
for (const fmt of ['odi', 't20i', 'ipl']) {
  const data = JSON.parse(readFileSync(`${process.cwd()}/src/data/formats/${fmt}.json`, 'utf8'));
  ok(data.length > 300, `${fmt}: a real pool of players`, data.length);
  const ids = new Set();
  let bad: string[] = [];
  for (const p of data) {
    const st = p.stats;
    if (ids.has(p.id)) bad.push(`dup ${p.id}`);
    ids.add(p.id);
    if (!ROLES.has(p.primaryRole)) bad.push(`role ${p.name}`);
    // Known register error: Pat Cummins's id also lists "Anderson Cummins" (a different player).
    if (p.scorecardName === 'PJ Cummins' && p.name !== 'Pat Cummins') bad.push(`name ${p.scorecardName} -> ${p.name}`);
    if (fmt !== 'ipl' && !NATIONS.includes(p.nation)) bad.push(`nation ${p.name}`);
    if (fmt === 'odi' && p.firstMatch < ODI_FIRST_SEEN_CUTOFF) bad.push(`odi cutoff ${p.name}`);
    if (fmt === 'ipl' && !(p.iplSpells?.length && p.iplSpells.every((x: { block: string }) => IPL_BLOCKS.some((b: { id: string }) => b.id === x.block)))) bad.push(`ipl spells ${p.name}`);
    if ((p.primaryRole === 'spinner' || p.primaryRole === 'fast-bowler') && !p.bowlingType) bad.push(`bowler without type ${p.name}`);
    if (st.matches < 1 || st.innings > st.matches || st.notOuts < 0 || st.notOuts > st.innings) bad.push(`counts ${p.name}`);
    if (st.fifties + st.hundreds > st.innings) bad.push(`milestones ${p.name}`);
    if (st.battingAverage != null && Math.abs(st.battingAverage - st.runs / (st.innings - st.notOuts)) > 0.01) bad.push(`avg ${p.name}`);
    if (st.economy != null && Math.abs(st.economy - (st.runsConceded / st.ballsBowled) * 6) > 0.01) bad.push(`econ ${p.name}`);
    if (st.wickets > 0 && st.ballsBowled === 0) bad.push(`wickets without balls ${p.name}`);
    for (const [k, v] of Object.entries(st)) if (typeof v === 'number' && !Number.isFinite(v)) bad.push(`${k} ${p.name}`);
  }
  ok(bad.length === 0, `${fmt}: every record is consistent`, bad.slice(0, 10));
  const has = (n: string) => data.some((p: { name: string }) => p.name === n);
  ok(has('Pat Cummins') && has('Lasith Malinga') && has('Wanindu Hasaranga') && !has('Anderson Cummins'),
    `${fmt}: names resolve correctly (Cummins, Malinga by middle name, Hasaranga by alias)`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
