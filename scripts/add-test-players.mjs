/**
 * add-test-players.mjs — adds the Test players the owner approved on 2026-10-03 to the era files in
 * src/data/, using the owner's HowSTAT exports (data-raw/howstat/test-*.csv, converted from the
 * Excel files by scripts/cricsheet/howstat-import.py's reader). Idempotent: a record whose id is
 * already in an era file is left alone.
 *
 * Rules (owner-approved):
 *  - Numbers are copied from HowSTAT, never estimated.
 *  - A player goes into every decade (1970s and later) in which he played at least 4 calendar years;
 *    if none, the decade with most years. (PROVISIONAL rule: it matches the existing eras 90% of the time.)
 *  - Dismissals: a keeper's catches + stumpings (keepers file), or his catches (catches list of 50+).
 *    Neither includes run outs (HowSTAT has no run-out table). A player with fewer than 50 catches
 *    has no exact figure: `dismissalsUnknown: 1`, and the rating counts him as an average fielder
 *    (src/lib/seven-metrics.ts).
 *  - Roles: wicketkeepers are confirmed by the keepers file; openers and middle-order are the
 *    owner-approved proposal (the tables do not say where a batter batted).
 *
 * Run: node scripts/add-test-players.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const csv = (f) => readFileSync(`data-raw/howstat/${f}`, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).map((l) => l.split(',')).slice(1).filter((r) => !/^No\. of/.test(r[0]));
const clean = (n) => n.replace(/\*/g, '');
const bat = new Map(csv('test-batting-2000-runs.csv').map((r) => [clean(r[0]) + '|' + r[1], r]));
const bowl = new Map(csv('test-bowling-100-wickets.csv').map((r) => [clean(r[0]) + '|' + r[1].split('/')[0], r]));
const kp = new Map(csv('test-keepers-100-dismissals.csv').map((r) => [clean(r[0]) + '|' + r[1], r]));
const ct = new Map(csv('test-catches-50.csv').map((r) => [clean(r[0]) + '|' + r[1], r]));

// [HowSTAT name, country, full name, primary role, secondary role]
// (Craig McMillan and Roshan Mahanama are already in the data, misspelled "Mcmilan" and "Mahnama": not added.)
const APPROVED = [
  ['R B Richardson', 'West Indies', 'Richie Richardson', 'middle-order', ''],
  ['K J Hughes', 'Australia', 'Kim Hughes', 'middle-order', ''],
  ['M A Butcher', 'England', 'Mark Butcher', 'opener', ''],
  ['M J Prior', 'England', 'Matt Prior', 'wicketkeeper', 'middle-order'],
  ['I J L Trott', 'England', 'Jonathan Trott', 'middle-order', ''],
  ['S R Watson', 'Australia', 'Shane Watson', 'opener', 'middle-order'],
  ['G A Hick', 'England', 'Graeme Hick', 'middle-order', ''],
  ['Ijaz Ahmed', 'Pakistan', 'Ijaz Ahmed', 'middle-order', ''],
  ['G R Marsh', 'Australia', 'Geoff Marsh', 'opener', ''],
  ['S M H Kirmani', 'India', 'Syed Kirmani', 'wicketkeeper', 'middle-order'],
  ['G N Yallop', 'Australia', 'Graham Yallop', 'middle-order', ''],
  ['J A Rudolph', 'South Africa', 'Jacques Rudolph', 'opener', ''],
  ['W W Hinds', 'West Indies', 'Wavell Hinds', 'opener', ''],
  ['R D Jacobs', 'West Indies', 'Ridley Jacobs', 'wicketkeeper', 'middle-order'],
  ['G S Blewett', 'Australia', 'Greg Blewett', 'middle-order', ''],
  ['G P Howarth', 'New Zealand', 'Geoff Howarth', 'middle-order', ''],
  ['A L Logie', 'West Indies', 'Gus Logie', 'middle-order', ''],
  ['D W Randall', 'England', 'Derek Randall', 'middle-order', ''],
  ['K R Rutherford', 'New Zealand', 'Ken Rutherford', 'middle-order', ''],
  ['A P Gurusinha', 'Sri Lanka', 'Asanka Gurusinha', 'middle-order', ''],
  ['S E Marsh', 'Australia', 'Shaun Marsh', 'opener', 'middle-order'],
  ['G J Whittall', 'Zimbabwe', 'Guy Whittall', 'middle-order', ''],
  ['J-P Duminy', 'South Africa', 'JP Duminy', 'middle-order', ''],
  ['J K Silva', 'Sri Lanka', 'Kaushal Silva', 'opener', ''],
  ['M R Marsh', 'Australia', 'Mitchell Marsh', 'middle-order', ''],
  ['M G Johnson', 'Australia', 'Mitchell Johnson', 'fast-bowler', ''],
  ['L G Rowe', 'West Indies', 'Lawrence Rowe', 'middle-order', ''],
  ['S V Manjrekar', 'India', 'Sanjay Manjrekar', 'middle-order', ''],
];

const erasOf = (career) => {
  const [a, b] = career.split('-');
  const last = b ? Number(b) : new Date().getFullYear();
  const years = {};
  for (let y = Number(a); y <= last; y++) { const d = `${Math.floor(y / 10) * 10}s`; years[d] = (years[d] ?? 0) + 1; }
  let decades = Object.keys(years).filter((d) => years[d] >= 4 && d >= '1970s');
  if (!decades.length) decades = [Object.entries(years).filter(([d]) => d >= '1970s').sort((p, q) => q[1] - p[1])[0][0]];
  return decades.sort();
};
const num = (v) => Number(v);
const slug = (n) => n.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');

const records = APPROVED.map(([how, country, full, role, sec]) => {
  const b = bat.get(how + '|' + country);
  if (!b) throw new Error(`not in the batting file: ${how} ${country}`);
  const [, , career, mat, , , runs, , tons, fifties, avg] = b;
  const stats = {
    testAverage: num(avg), testRuns: num(runs), testWickets: 0, testMatches: num(mat), testCenturies: num(tons), testFifties: num(fifties),
    fiveWs: 0, tenWs: 0, testBowlingAverage: 0, battingStrikeRate: 0, bowlingStrikeRate: 0,
  };
  const w = bowl.get(how + '|' + country);
  if (w) { const [, , m, , , wk, w5, w10, bavg] = w; if (num(m) !== num(mat)) throw new Error(`${how}: Tests differ between files`); Object.assign(stats, { testWickets: num(wk), fiveWs: num(w5), tenWs: num(w10), testBowlingAverage: num(bavg) }); }
  const k = kp.get(how + '|' + country), c = ct.get(how + '|' + country);
  if (k) stats.dismissals = num(k[5]);        // catches + stumpings
  else if (c) stats.dismissals = num(c[4]);   // catches
  else stats.dismissalsUnknown = 1;           // fewer than 50 catches: no exact figure
  const eras = erasOf(career);
  return { id: slug(full), name: full, nation: country, era: eras.length === 1 ? eras[0] : eras, primaryRole: role, secondaryRoles: sec ? [sec] : [], stats, _eras: eras };
});

const text = (r) => {
  const { _eras, ...rec } = r;
  const era = Array.isArray(rec.era) ? `[${rec.era.map((e) => JSON.stringify(e)).join(',')}]` : JSON.stringify(rec.era);
  const sec = rec.secondaryRoles.length ? `[\n${rec.secondaryRoles.map((x) => `      ${JSON.stringify(x)}`).join(',\n')}\n    ]` : '[]';
  const stats = Object.entries(rec.stats).map(([k, v]) => `      ${JSON.stringify(k)}: ${v}`).join(',\n');
  return `  {\n    "id": ${JSON.stringify(rec.id)},\n    "name": ${JSON.stringify(rec.name)},\n    "nation": ${JSON.stringify(rec.nation)},\n    "era": ${era},\n    "primaryRole": ${JSON.stringify(rec.primaryRole)},\n    "secondaryRoles": ${sec},\n    "stats": {\n${stats}\n    }\n  }`;
};

let added = 0;
for (const era of ['1970s', '1980s', '1990s', '2000s', '2010s', '2020s']) {
  const file = `src/data/${era}.json`;
  let src = readFileSync(file, 'utf8');
  const have = new Set(JSON.parse(src).map((p) => p.id));
  const mine = records.filter((r) => r._eras.includes(era) && !have.has(r.id));
  if (!mine.length) continue;
  if (!src.endsWith('\n]')) throw new Error(`${file}: unexpected end of file`);
  src = src.slice(0, -2) + ',\n' + mine.map(text).join(',\n') + '\n]';
  writeFileSync(file, src);
  added += mine.length;
  console.log(`${file}: +${mine.length} (${mine.map((r) => r.name).join(', ')})`);
}
console.log(`${records.length} players, ${added} era records added`);
for (const r of records) console.log(`  ${r.name.padEnd(20)} ${r.nation.padEnd(13)} ${r._eras.join(' ').padEnd(16)} ${r.primaryRole.padEnd(13)} ${r.stats.dismissalsUnknown ? 'fielding unknown' : 'dismissals ' + r.stats.dismissals}`);
