/**
 * HowSTAT reader (scripts/cricsheet/howstat-check.mjs): parses the owner's career tables in the
 * column layout they described, keeps blanks as "no value", and pairs rows with our players safely.
 */
// @ts-expect-error plain .mjs script
import { parseHowstat, matchHowstat } from '../scripts/cricsheet/howstat-check.mjs';

let pass = 0, fail = 0;
const ok = (cond: boolean, name: string, extra?: unknown) => {
  if (cond) pass++;
  else { fail++; console.log(`FAIL: ${name}`, extra ?? ''); }
};

const HEAD = ['Name', 'Known As', 'Born', 'Career', 'Matches', 'Inns', 'Runs', '100s', 'HS', 'Bat Avg', 'Wkts', '4W', 'Bowl Avg', 'E/R', 'Best'];
const ROWS = [
  ['Kohli, V', 'Virat Kohli', '05/11/1988', '2008-2026', '316', '304', '15,109', '55', '183', '59.02', '5', '0', '136.00', '6.16', '1/13'],
  ['Dhoni, MS', 'MS Dhoni', '07/07/1981', '2004-2019', '350', '297', '10773', '10', '183*', '50.58', '1', '0', '31.00', '5.17', '1/14'],
  ['Opener, A', 'Abe Opener', '', '2012', '3', '3', '40', '0', '22', '13.33', '', '', '', '', ''],
];
const tsv = [HEAD, ...ROWS].map((r) => r.join('\t')).join('\r\n');
const csv = [HEAD, ...ROWS].map((r) => r.map((c) => (c.includes(',') ? `"${c}"` : c)).join(',')).join('\n');

for (const [label, text] of [['tab-separated', tsv], ['comma-separated', csv]] as const) {
  const rows = parseHowstat(text);
  ok(rows.length === 3, `${label}: three players`, rows.length);
  const k = rows[0];
  ok(k.knownAs === 'Virat Kohli' && k.matches === 316 && k.runs === 15109 && k.hundreds === 55 && k.battingAverage === 59.02, `${label}: numbers parsed (thousands comma handled)`, k);
  ok(k.careerFrom === 2008 && k.careerTo === 2026, `${label}: career span`, k);
  ok(rows[1].highest === 183 && rows[1].careerFrom === 2004, `${label}: not-out star stripped from HS`, rows[1]);
  const a = rows[2];
  ok(a.wickets === null && a.bowlingAverage === null && a.economy === null, `${label}: blank bowling stays "no value", never 0`, a);
  ok(a.careerFrom === 2012 && a.careerTo === 2012, `${label}: single-year career`, a);
}
let threw = false;
try { parseHowstat('Foo,Bar\n1,2'); } catch { threw = true; }
ok(threw, 'a file without Name and Matches columns is rejected, not guessed');

// pairing: one-to-one, never a guess
const ours = [
  { name: 'Virat Kohli', scorecardName: 'V Kohli', stats: { matches: 311, runs: 14819, wickets: 5 } },
  { name: 'Mahendra Singh Dhoni', scorecardName: 'MS Dhoni', stats: { matches: 331, runs: 10274, wickets: 1 } },
  { name: 'R Sharma', scorecardName: 'R Sharma', stats: { matches: 44, runs: 100, wickets: 40 } },
];
const theirs = parseHowstat([HEAD,
  ROWS[0], ROWS[1],
  ['Sharma, RG', 'Rohit Sharma', '', '2007-2026', '281', '273', '11532', '33', '264', '48.45', '9', '0', '59.22', '5.24', '2/27'],
  ['Sharma, R', 'Rahul Sharma', '', '2011-2012', '4', '2', '1', '0', '1', '1.00', '6', '0', '29.50', '5.02', '3/43'],
].map((r) => r.join('\t')).join('\n'));
const m = matchHowstat(theirs, ours);
ok(m.pairs.length === 2 && m.pairs.every((x: { ours: { name: string }; theirs: { knownAs: string } }) =>
  (x.ours.name === 'Virat Kohli' && x.theirs.knownAs === 'Virat Kohli') || (x.ours.name === 'Mahendra Singh Dhoni' && x.theirs.knownAs === 'MS Dhoni')),
  'Kohli and Dhoni pair up', m.pairs.map((x: { ours: { name: string } }) => x.ours.name));
ok(m.unmatchedOurs.length === 1 && m.unmatchedOurs[0].name === 'R Sharma', '"R Sharma" fits two HowSTAT players, so it is left unmatched');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
