/**
 * fix-test-numbers.mjs — brings a vetted list of existing Test players' numbers in line with the
 * owner's HowSTAT exports (data-raw/howstat/test-*.csv). The owner (2026-10-03): "all stats are
 * correct in HowSTAT". Only the listed players and only fields that differ are changed, and every
 * change is printed. Run: node scripts/fix-test-numbers.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const csv = (f) => readFileSync(`data-raw/howstat/${f}`, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).map((l) => l.split(',')).slice(1).filter((r) => !/^No\. of/.test(r[0]));
const clean = (n) => n.replace(/\*/g, '');
const bat = new Map(csv('test-batting-2000-runs.csv').map((r) => [clean(r[0]) + '|' + r[1], r]));
const bowl = new Map(csv('test-bowling-100-wickets.csv').map((r) => [clean(r[0]) + '|' + r[1].split('/')[0], r]));

// [our id, HowSTAT name, country, kind]. Vetted by hand: Dwayne vs Darren Bravo, Wasim vs Ramiz Raja and
// Saeed vs Sarfaraz Ahmed are different people and are NOT here.
const LIST = [
  ['ben-stokes', 'Ben Stokes', 'England', 'bat'], ['marvan-atapattu', 'M S Atapattu', 'Sri Lanka', 'bat'], ['marlon-samuels', 'M N Samuels', 'West Indies', 'bat'],
  ['neil-mckenzie', 'N D McKenzie', 'South Africa', 'bat'], ['aiden-markram', 'A K Markram', 'South Africa', 'bat'], ['shubman-gill', 'Shubman Gill', 'India', 'bat'],
  ['jeremy-coney', 'J V Coney', 'New Zealand', 'bat'], ['shai-hope', 'S D Hope', 'West Indies', 'bat'], ['alviro-petersen', 'A N Petersen', 'South Africa', 'bat'],
  ['mahela-jayawardene', 'D P M D Jayawardene', 'Sri Lanka', 'bat'],
  ['harbhajan-singh', 'Harbhajan Singh', 'India', 'both'],
  ['ravichandran-ashwin', 'R Ashwin', 'India', 'bowl'], ['shaun-pollock', 'S M Pollock', 'South Africa', 'bowl'], ['bs-chandrasekhar', 'B S Chandrasekhar', 'India', 'bowl'],
  ['chris-martin', 'C S Martin', 'New Zealand', 'bowl'], ['shannon-gabriel', 'S T Gabriel', 'West Indies', 'bowl'], ['mohammed-siraj', 'Mohammed Siraj', 'India', 'bowl'],
  ['colin-croft', 'C E H Croft', 'West Indies', 'bowl'], ['mohammad-amir', 'Mohammad Amir', 'Pakistan', 'bowl'], ['devendra-bishoo', 'D Bishoo', 'West Indies', 'bowl'],
];
const files = ['legends', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'].map((f) => ({ f, path: `src/data/${f}.json`, text: readFileSync(`src/data/${f}.json`, 'utf8') }));
const ids = new Map(); // id -> stats (from the first file)
for (const x of files) for (const p of JSON.parse(x.text)) if (!ids.has(p.id)) ids.set(p.id, p);

let changes = 0;
const patch = (id, key, value) => {
  for (const x of files) {
    const at = x.text.indexOf(`"id": ${JSON.stringify(id)}`);
    if (at < 0) continue;
    const st = x.text.indexOf('"stats": {', at), en = x.text.indexOf('}', st);
    const block = x.text.slice(st, en);
    const re = new RegExp(`("${key}": )(-?[0-9.]+)`);
    if (!re.test(block)) throw new Error(`${id}: no ${key} in ${x.f}`);
    x.text = x.text.slice(0, st) + block.replace(re, `$1${value}`) + x.text.slice(en);
  }
};
for (const [id, how, country, kind] of LIST) {
  const p = ids.get(id);
  if (!p) { console.log(`MISSING id ${id}`); continue; }
  const s = p.stats, want = {};
  const b = bat.get(how + '|' + country), w = bowl.get(how + '|' + country);
  if (kind !== 'bowl') {
    if (!b) throw new Error(`${how}: not in the batting file`);
    Object.assign(want, { testMatches: +b[3], testRuns: +b[6], testCenturies: +b[8], testFifties: +b[9], testAverage: +b[10] });
  }
  if (kind !== 'bat') {
    if (!w) throw new Error(`${how}: not in the bowling file`);
    Object.assign(want, { testMatches: +w[2], testWickets: +w[5], fiveWs: +w[6], tenWs: +w[7], testBowlingAverage: +w[8] });
  }
  for (const [k, v] of Object.entries(want)) {
    const old = s[k];
    if (Math.abs(Number(old) - v) > (k === 'testAverage' || k === 'testBowlingAverage' ? 0.005 : 0)) { console.log(`${p.name}: ${k} ${old} -> ${v}`); patch(id, k, v); changes++; }
  }
}
for (const x of files) writeFileSync(x.path, x.text);
console.log(`${changes} number(s) changed`);
