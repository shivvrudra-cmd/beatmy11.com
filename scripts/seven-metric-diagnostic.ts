/**
 * Diagnostic: scores representative players and the fixed house XI with the
 * finalized seven-metric engine, printing every intermediate number.
 * Run: node_modules/.bin/esbuild scripts/seven-metric-diagnostic.ts --bundle
 *   --platform=node --format=cjs --outfile=.diag-dist/diag.cjs --log-level=error
 *   && node .diag-dist/diag.cjs
 * (Not part of the site build; dev/diagnostic use only.)
 */
import { readFileSync } from 'node:fs';
import {
  METRICS,
  BATTING_METRICS,
  BOWLING_METRICS,
  buildScoringContext,
  scorePlayer,
  compareXIs,
  type NormalizedPlayer,
} from '../src/lib/seven-metrics';
import { normalizePlayer } from '../src/lib/player-logic';
import { getHouseXI } from '../src/lib/opponent-xi';

const DATA_DIR = process.cwd() + '/src/data';
const byId = new Map<string, NormalizedPlayer>();
for (const era of ['legends', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s']) {
  const raw = JSON.parse(readFileSync(`${DATA_DIR}/${era}.json`, 'utf8'));
  for (const p of raw) {
    const n = normalizePlayer(p, era);
    if (!byId.has(n.id)) byId.set(n.id, n);
  }
}
const CTX = buildScoringContext([...byId.values()]);
const P = (id: string): NormalizedPlayer => {
  const p = byId.get(id);
  if (!p) throw new Error(`diagnostic player missing: ${id}`);
  return p;
};

const f1 = (x: number | null | undefined) =>
  x === null || x === undefined ? '   n/a' : x.toFixed(1).padStart(6);
const f3 = (x: number | null | undefined) =>
  x === null || x === undefined ? 'n/a' : String(Math.round(x * 1000) / 1000);

console.log('=== POPULATIONS (unique players, deduped by id) ===');
for (const def of METRICS) {
  const pop = CTX.populations[def.key];
  console.log(
    `${def.label}: n=${pop.length} min=${f3(pop[0])} max=${f3(pop[pop.length - 1])}`,
  );
}

console.log('\n=== SAMPLE PLAYERS ===');
const samples: [string, string][] = [
  ['don-bradman', 'middle-order'], // top batting, older era (legends)
  ['jack-hobbs', 'opener'], // opener, older era (legends)
  ['sachin-tendulkar', 'middle-order'], // middle order, modern-ish
  ['steve-smith', 'middle-order'], // middle order, modern era
  ['adam-gilchrist', 'wicketkeeper'], // keeper
  ['kumar-sangakkara', 'wicketkeeper'], // keeper
  ['shane-warne', 'spinner'], // spinner, older era
  ['muttiah-muralitharan', 'spinner'], // spinner
  ['glenn-mcgrath', 'fast-bowler'], // fast bowler, older era
  ['sydney-barnes', 'fast-bowler'], // fast bowler, oldest era
  ['jasprit-bumrah', 'fast-bowler'], // fast bowler, modern era
  ['jacques-kallis', 'all-rounder'], // all-rounder
  ['garfield-sobers', 'all-rounder'], // all-rounder, older era
  ['imran-khan', 'all-rounder'], // all-rounder
];
for (const [id, declared] of samples) {
  const s = scorePlayer(P(id), declared, CTX);
  const p = P(id);
  console.log(`\n${s.name} | era=${p.displayEra} | ${p.nation} | role=${s.role}`);
  console.log('  raw:        ' + METRICS.map((m) => `${m.key}=${f3(s.raw[m.key])}`).join(' '));
  console.log('  adjusted:   ' + METRICS.map((m) => `${m.key}=${f3(s.adjusted[m.key])}`).join(' '));
  console.log('  normalized: ' + METRICS.map((m) => `${m.key}=${f1((s.normalized as Record<string, number | null>)[m.key])}`).join(' '));
  const bat = BATTING_METRICS.map((k) => `${k}:${f1((s.normalized as Record<string, number | null>)[k])}`).join(' ');
  const bowl = BOWLING_METRICS.map((k) => `${k}:${f1((s.normalized as Record<string, number | null>)[k])}`).join(' ');
  if (s.role === 'all-rounder') {
    console.log(`  batting [${bat}] -> ${f1(s.battingScore)}`);
    console.log(`  bowling [${bowl}] -> ${f1(s.bowlingScore)}`);
    console.log(`  FINAL (50/50) = ${f1(s.score)}`);
  } else if (s.battingScore !== null) {
    console.log(`  batting [${bat}] -> FINAL = ${f1(s.score)}`);
  } else {
    console.log(`  bowling [${bowl}] -> FINAL = ${f1(s.score)}`);
  }
}

console.log('\n=== FIXED HOUSE XI (new engine) ===');
const house = getHouseXI().map((player) => ({ player }));
const cmp = compareXIs(house, house, CTX);
for (const ps of cmp.userPlayers) {
  console.log(
    `${ps.name} (${ps.role}): score=${f1(ps.score)}` +
      (ps.battingScore !== null && ps.bowlingScore !== null
        ? ` [bat=${f1(ps.battingScore)} bowl=${f1(ps.bowlingScore)}]`
        : ''),
  );
}
console.log(`\nHOUSE XI SCORE (mean of 11) = ${cmp.userScore}`);
console.log(`self-comparison: user=${cmp.userScore} opponent=${cmp.opponentScore} diff=${cmp.difference} -> ${cmp.result}`);
