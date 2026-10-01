/**
 * HowSTAT reader (scripts/cricsheet/howstat-check.mjs): parses the owner's career tables in the
 * column layout they described, keeps blanks as "no value", and pairs rows with our players safely.
 */
// @ts-expect-error plain .mjs script
import { parseHowstat, matchHowstat } from '../scripts/cricsheet/howstat-check.mjs';
// @ts-expect-error plain .mjs script
import { parseStrikeRates, parseBowlingTable, careerFits } from '../scripts/cricsheet/howstat.mjs';
// @ts-expect-error plain .mjs script
import { withOfficialBatting, withOfficialBowling } from '../scripts/cricsheet/build-white-ball.mjs';

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

// ---- current players: "V Kohli*" with an open-ended career ("2008-")
{
  const rows = parseHowstat([HEAD,
    ['V Kohli*', 'Virat Kohli', '', '2008-', '316', '304', '15109', '55', '183*', '59.02', '5', '0', '136.0', '6.16', '1/13'],
  ].map((r) => r.join('\t')).join('\n'));
  ok(rows[0].name === 'V Kohli' && rows[0].careerFrom === 2008 && rows[0].careerTo === null && rows[0].active === true, 'an open-ended career has no end year (still playing)', rows[0]);
  ok(careerFits({ firstYear: 2008, lastYear: 2026 }, rows[0]), 'so a current player still pairs with his own record');
}

// ---- namesakes: the career-years guard
{
  const rows = parseHowstat([HEAD,
    ['Ijaz Ahmed', 'Ijaz Ahmed', '', '1986-2000', '250', '232', '6564', '10', '139*', '32.33', '5', '0', '95.00', '4.9', '2/31'],
  ].map((r) => r.join('\t')).join('\n'));
  const iftikhar = [{ name: 'Iftikhar Ahmed', scorecardName: 'Iftikhar Ahmed', firstYear: 2015, lastYear: 2024, matches: 25, runs: 600 }];
  ok(matchHowstat(rows, iftikhar).pairs.length === 1, 'without the guard a namesake pairs up (the bug)');
  ok(matchHowstat(rows, iftikhar, careerFits).pairs.length === 0, 'with the career-years guard Iftikhar Ahmed does not take Ijaz Ahmed\'s record');
  ok(careerFits({ firstYear: 2003, lastYear: 2012 }, { careerFrom: 1989, careerTo: 2012 }) && !careerFits({ firstYear: 2003, lastYear: 2012 }, { careerFrom: 2005, careerTo: 2012 }), 'career years must contain the player\'s matches');
}

// ---- the all-countries batting table (1000+ runs) with official strike rates
const sr = parseStrikeRates([
  ',Player,Country,Mat,Inns,NO,Runs,HS,100s,50s,Avg,S/R',
  '1.0,S R Tendulkar,India,463.0,452.0,41.0,18426.0,200*,49.0,96.0,44.83,86.24',
  '2.0,V Kohli*,India,316.0,304.0,48.0,15109.0,183.0,55.0,79.0,59.02,94.37',
].join('\n'));
ok(sr.length === 2 && sr[0].name === 'S R Tendulkar' && sr[0].highest === 200 && sr[0].strikeRate === 86.24 && sr[0].fifties === 96 && sr[0].notOuts === 41, 'strike-rate table parsed', sr[0]);
ok(sr[1].name === 'V Kohli' && sr[1].country === 'India', 'the "current player" star is dropped from the name', sr[1]);
// A header shifted one column left of the data (the T20I export): still read correctly.
const shifted = parseStrikeRates([
  'Player,Country,Mat,Inns,NO,Runs,HS,100s,50s,Avg,S/R',
  '1.0,Babar Azam*,Pakistan,145.0,136.0,18.0,4596.0,122.0,3.0,39.0,38.95,128.02',
  '3.0,R G Sharma*,India,159.0,151.0,19.0,4231.0,121*,5.0,32.0,32.05,140.85',
].join('\n'));
ok(shifted[0].name === 'Babar Azam' && shifted[0].country === 'Pakistan' && shifted[0].matches === 145 && shifted[0].runs === 4596 && shifted[0].strikeRate === 128.02 && shifted[0].fifties === 39,
  'a header one column left of the data is detected and corrected', shifted[0]);
ok(shifted[1].name === 'R G Sharma' && shifted[1].highest === 121 && shifted[1].hundreds === 5, 'shifted table: second row', shifted[1]);

const before = { matches: 146, cricsheetMatches: 146, innings: 140, notOuts: 12, runs: 5800, battingAverage: 45.3, strikeRate: 86.77, hundreds: 16, fifties: 30, highest: 200, fiftyRate: 0.3, wickets: 154, economy: 5.1, statsSource: 'cricsheet', fourWicketInnings: null };
const after = withOfficialBatting(before, sr[0]);
ok(after.matches === 463 && after.runs === 18426 && after.strikeRate === 86.24 && after.fifties === 96 && after.notOuts === 41 && after.hundreds === 49, 'official full-career batting line replaces the batting numbers', after);
ok(after.wickets === 154 && after.economy === 5.1 && after.battingSource === 'howstat-strike-rates', 'bowling is untouched and the source is recorded', after);
ok(Math.abs(after.fiftyRate - (96 + 49) / 463) < 0.0001, 'fifty rate follows the official numbers', after.fiftyRate);

// ---- the all-countries bowling table (100+ wickets)
const bowl = parseBowlingTable([
  ',Player,Country,Mat,Balls,Runs,Wkts,BBI,4w,Avg,S/R,E/R,1 - 3,4 - 7,8 - 11,B,C,CB,LBW',
  '1.0,M Muralitharan,Sri Lanka/ACC Asian XI,350.0,18811.0,12326.0,534.0,46233.0,25.0,23.08,35.23,3.93,24.3,51.5,24.2,22.8,46.1,8.2,12.2',
  '178.0,D J Willey*,England,73.0,3236.0,2977.0,100.0,46172.0,5.0,29.77,32.36,5.52,54.0,28.0,18.0,19.0,54.0,17.0,10.0',
].join('\n'));
ok(bowl.length === 2 && bowl[0].name === 'M Muralitharan' && bowl[0].country === 'Sri Lanka', 'bowling table: "Sri Lanka/ACC Asian XI" is Sri Lanka', bowl[0]);
ok(bowl[0].matches === 350 && bowl[0].ballsBowled === 18811 && bowl[0].runsConceded === 12326 && bowl[0].wickets === 534 && bowl[0].fourW === 25
  && bowl[0].bowlingAverage === 23.08 && bowl[0].ballsPerWicket === 35.23 && bowl[0].economy === 3.93, 'bowling table: every number in the right column (Runs here is runs conceded; S/R is balls per wicket)', bowl[0]);
ok(bowl[1].name === 'D J Willey', 'bowling table: current-player star dropped');
const bBefore = { matches: 343, cricsheetMatches: 80, runs: 663, strikeRate: 77.5, battingAverage: 6.8, ballsBowled: 4200, runsConceded: 2900, wickets: 120, bowlingAverage: 24.2, economy: 4.1, ballsPerWicket: 35, fourWicketInnings: 5, fourWicketRate: 0.06, statsSource: 'howstat' };
const bAfter = withOfficialBowling(bBefore, bowl[0]);
ok(bAfter.wickets === 534 && bAfter.ballsBowled === 18811 && bAfter.ballsPerWicket === 35.23 && bAfter.economy === 3.93 && bAfter.fourWicketInnings === 25, 'official full-career bowling line replaces the bowling numbers', bAfter);
ok(bAfter.matches === 350 && Math.abs(bAfter.fourWicketRate - 25 / 350) < 0.0001, 'full career can add matches (Asia XI); the 4-wicket rate follows', bAfter);
ok(bAfter.runs === 663 && bAfter.strikeRate === 77.5 && bAfter.bowlingSource === 'howstat-100-wickets', 'batting is untouched and the source is recorded', bAfter);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
