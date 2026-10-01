/**
 * howstat-check.mjs — reads the owner's HowSTAT career tables and cross-checks them against the
 * Cricsheet-built data. It changes nothing: it writes docs/reports/white-ball-howstat-check.md.
 *
 * The owner saves one file per format and nation in data-raw/howstat/ (gitignored), named
 *   odi-india.csv, t20i-south-africa.csv, ...   (comma- or tab-separated, headers as on the site)
 * with the columns: Name, Known As, Born, Career, Matches, Inns, Runs, 100s, HS, Bat Avg, Wkts,
 * 4W, Bowl Avg, E/R, Best.
 *
 * What the files can supply: official totals (they include matches Cricsheet withholds), the real
 * career span (so pre-2004 ODI players can return) and display names. What they cannot: strike
 * rate, fifties, fielding or bowling type, which stay on Cricsheet and the other sources.
 *
 * Run: node scripts/cricsheet/howstat-check.mjs
 */
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NATIONS } from './build-white-ball.mjs';
import { parseHowstat, matchHowstat } from './howstat.mjs';

export { parseHowstat, matchHowstat };

const ROOT = process.cwd();
const DIR = join(ROOT, 'data-raw/howstat');
const slug = (n) => n.toLowerCase().replace(/\s+/g, '-');

function main() {
  mkdirSync(join(ROOT, 'docs/reports'), { recursive: true });
  const L = ['# HowSTAT cross-check', '', `Generated ${new Date().toISOString().slice(0, 10)} by \`scripts/cricsheet/howstat-check.mjs\`. Read-only: nothing in the game data was changed.`, ''];
  if (!existsSync(DIR)) {
    L.push('No files yet. Save tables as `data-raw/howstat/<format>-<nation>.csv` (e.g. `odi-india.csv`) and run this again.');
    writeFileSync(join(ROOT, 'docs/reports/white-ball-howstat-check.md'), L.join('\n') + '\n');
    console.log('no data-raw/howstat folder yet');
    return;
  }
  const files = new Set(readdirSync(DIR));
  let any = false;
  for (const fmt of ['odi', 't20i']) {
    const ours = JSON.parse(readFileSync(join(ROOT, `src/data/formats/${fmt}.json`), 'utf8'));
    for (const nation of NATIONS) {
      const file = `${fmt}-${slug(nation)}.csv`;
      if (!files.has(file)) continue;
      any = true;
      const rows = parseHowstat(readFileSync(join(DIR, file), 'utf8'));
      const mine = ours.filter((p) => p.nation === nation);
      const { pairs, unmatchedOurs, unmatchedTheirs } = matchHowstat(rows, mine);
      const diffs = pairs.map(({ ours: p, theirs: h }) => ({
        name: p.name, known: h.knownAs || h.name,
        dM: (h.matches ?? 0) - p.stats.matches, dR: (h.runs ?? 0) - p.stats.runs, dW: (h.wickets ?? 0) - p.stats.wickets,
        ours: p.stats, theirs: h,
      }));
      const exact = diffs.filter((d) => d.dM === 0 && d.dR === 0 && d.dW === 0).length;
      L.push(`## ${fmt.toUpperCase()} ${nation}`, '',
        `- HowSTAT rows: ${rows.length}; our players: ${mine.length}; paired: ${pairs.length}; identical on matches, runs and wickets: ${exact}`,
        `- Ours without a HowSTAT match: ${unmatchedOurs.length}${unmatchedOurs.length ? ` (${unmatchedOurs.slice(0, 8).map((p) => p.name).join(', ')}${unmatchedOurs.length > 8 ? ', …' : ''})` : ''}`,
        `- HowSTAT players not in our data (before the ODI cut-off, unknown bowling type, or under the match minimum): ${unmatchedTheirs.length}`, '',
        '| Player | Matches (ours / HowSTAT) | Runs | Wickets | Bat avg | Bowl avg | Economy |', '|---|---|---|---|---|---|---|');
      for (const d of diffs.sort((a, b) => Math.abs(b.dM) - Math.abs(a.dM) || b.theirs.matches - a.theirs.matches).slice(0, 40)) {
        const o = d.ours, h = d.theirs;
        L.push(`| ${d.known} | ${o.matches} / ${h.matches} | ${o.runs} / ${h.runs} | ${o.wickets} / ${h.wickets} | ${o.battingAverage ?? '–'} / ${h.battingAverage ?? '–'} | ${o.bowlingAverage ?? '–'} / ${h.bowlingAverage ?? '–'} | ${o.economy ?? '–'} / ${h.economy ?? '–'} |`);
      }
      L.push('');
      console.log(`${file}: ${rows.length} rows, ${pairs.length} paired, ${exact} identical`);
    }
  }
  if (!any) L.push('The folder exists but holds no files named `<format>-<nation>.csv` for the ten game nations.');
  writeFileSync(join(ROOT, 'docs/reports/white-ball-howstat-check.md'), L.join('\n') + '\n');
}

if (process.argv[1] && process.argv[1].endsWith('howstat-check.mjs')) main();
