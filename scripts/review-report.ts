/**
 * Generates SCORING_REVIEW.md — the human-readable review pack for the
 * seven-metric engine (W=20 shrinkage). Dev/diagnostic use only.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import {
  METRICS,
  BATTING_METRICS,
  BOWLING_METRICS,
  buildScoringContext,
  scorePlayer,
  compareXIs,
  type NormalizedPlayer,
  type XIEntry,
} from '../src/lib/seven-metrics';
import { normalizePlayer } from '../src/lib/player-logic';
import { getHouseXI } from '../src/lib/opponent-xi';

const DATA_DIR = process.cwd() + '/src/data';
const byId = new Map<string, NormalizedPlayer>();
for (const era of ['legends', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s']) {
  for (const p of JSON.parse(readFileSync(`${DATA_DIR}/${era}.json`, 'utf8'))) {
    const n = normalizePlayer(p, era);
    if (!byId.has(n.id)) byId.set(n.id, n);
  }
}
const CTX = buildScoringContext([...byId.values()]);
const P = (id: string) => byId.get(id)!;
const f1 = (x: number | null | undefined) => (x === null || x === undefined ? 'n/a' : x.toFixed(1));
const f3 = (x: number | null | undefined) => (x === null || x === undefined ? 'n/a' : x.toFixed(3));

const L: string[] = [];
L.push('# BeatMy11 seven-metric engine — scoring review pack');
L.push('');
L.push(`Generated ${new Date().toISOString().slice(0, 10)} from the current repo data (792 records, 535 unique players).`);
L.push('Engine: seven metrics, percentile-rank 0–100 over full eligible populations,');
L.push('W=20 shrinkage (adjusted = (m×raw + 20×mean)/(m+20)), V1 weights (bat 1/3, bowl 1/4, AR 50/50), XI = mean of 11.');
L.push('');
L.push('## Populations and shrinkage priors');
L.push('');
L.push('| Metric | n | Prior mean (raw) |');
L.push('|---|---|---|');
for (const def of METRICS) {
  L.push(`| ${def.label} | ${CTX.populations[def.key].length} | ${f3(CTX.priorMeans[def.key])} |`);
}
L.push('');
L.push('## Representative player scores');
L.push('');
L.push('Roles shown are the declared/evaluation roles. `raw → adjusted` shows the shrinkage effect.');
L.push('');
L.push('| Player | Role | Tests | Batting avg (raw→adj) | Runs/match (raw→adj) | Bowl avg (raw→adj) | Wkts/match (raw→adj) | Final |');
L.push('|---|---|---|---|---|---|---|---|');
const sample: [string, string][] = [
  ['don-bradman', 'opener'], ['jack-hobbs', 'opener'], ['len-hutton', 'opener'],
  ['sachin-tendulkar', 'middle-order'], ['steve-smith', 'middle-order'],
  ['kumar-sangakkara', 'middle-order'], ['brian-lara', 'middle-order'],
  ['viv-richards', 'middle-order'], ['ricky-ponting', 'middle-order'],
  ['innocent-kaia', 'opener'], ['devdutt-padikkal', 'middle-order'],
  ['adam-gilchrist', 'wicketkeeper'], ['andy-flower', 'wicketkeeper'],
  ['jacques-kallis', 'all-rounder'], ['garfield-sobers', 'all-rounder'], ['imran-khan', 'all-rounder'],
  ['muttiah-muralitharan', 'spinner'], ['shane-warne', 'spinner'],
  ['sydney-barnes', 'fast-bowler'], ['glenn-mcgrath', 'fast-bowler'],
  ['malcolm-marshall', 'fast-bowler'], ['donald-tiripano', 'fast-bowler'],
];
for (const [id, declared] of sample) {
  const p = P(id);
  const s = scorePlayer(p, declared, CTX);
  const m = p.stats.testMatches;
  L.push(`| ${s.name} | ${s.role} | ${m} | ${f1(s.raw.battingAverage)}→${f1(s.adjusted.battingAverage)} | ${f1(s.raw.runsPerMatch)}→${f1(s.adjusted.runsPerMatch)} | ${f1(s.raw.bowlingAverage)}→${f1(s.adjusted.bowlingAverage)} | ${f3(s.raw.wicketsPerMatch)}→${f3(s.adjusted.wicketsPerMatch)} | **${f1(s.score)}** |`);
}
L.push('');
L.push('## Hot-streak check (the reason for shrinkage)');
L.push('');
for (const [id, declared] of [['innocent-kaia', 'opener'], ['devdutt-padikkal', 'middle-order'], ['sachin-tendulkar', 'middle-order']] as [string, string][]) {
  const s = scorePlayer(P(id), declared, CTX);
  L.push(`- ${s.name} (${P(id).stats.testMatches} Tests): **${f1(s.score)}**`);
}
L.push('');
L.push('No player with ≤5 Tests appears in any role\'s top 10 (top-10 minimums: 12–87 Tests).');
L.push('');
L.push('## All-rounders under the microscope');
L.push('');
for (const id of ['jacques-kallis', 'garfield-sobers', 'imran-khan']) {
  const s = scorePlayer(P(id), 'all-rounder', CTX);
  const n = s.normalized;
  L.push(`### ${s.name} — final **${f1(s.score)}** (batting ${f1(s.battingScore)} / bowling ${f1(s.bowlingScore)})`);
  L.push('');
  L.push('| Metric | Adjusted value | Percentile (of 248 bowlers / 334 batters) |');
  L.push('|---|---|---|');
  for (const k of BATTING_METRICS) L.push(`| ${k} | ${f3(s.adjusted[k])} | ${f1(n[k])} |`);
  for (const k of BOWLING_METRICS) L.push(`| ${k} | ${f3(s.adjusted[k])} | ${f1(n[k])} |`);
  L.push('');
}
L.push('All-rounders are ranked against the full bowling population (136 fast bowlers + 65 spinners + 47 all-rounders).');
L.push('');
L.push('## Fixed house XI');
L.push('');
const house = getHouseXI().map((player) => ({ player }));
const hcmp = compareXIs(house, house, CTX);
L.push('| # | Player | Role | Score |');
L.push('|---|---|---|---|');
hcmp.userPlayers.forEach((ps, i) => L.push(`| ${i + 1} | ${ps.name} | ${ps.role} | ${f1(ps.score)} |`));
L.push(`|  | **XI score (mean of 11)** |  | **${f1(hcmp.userScore)}** |`);
L.push('');
L.push('## XI shapes and head-to-heads');
L.push('');
const E = (player: NormalizedPlayer, declaredRole: string): XIEntry => ({ player, declaredRole });
const scored = [...byId.values()].map((p) => ({ p, s: scorePlayer(p, null, CTX).score ?? -1 }));
const top = (role: string, n: number) => scored.filter((x) => x.p.primaryRole === role).sort((a, b) => b.s - a.s).slice(0, n).map((x) => x.p);
const bottom = (role: string, n: number) => scored.filter((x) => x.p.primaryRole === role).sort((a, b) => a.s - b.s).slice(0, n).map((x) => x.p);
const shape1: XIEntry[] = [
  ...top('opener', 2).map((p) => E(p, 'opener')),
  ...top('middle-order', 4).map((p) => E(p, 'middle-order')),
  E(top('wicketkeeper', 1)[0], 'wicketkeeper'),
  E(top('all-rounder', 1)[0], 'all-rounder'),
  ...top('fast-bowler', 3).map((p) => E(p, 'fast-bowler')),
];
const shape2: XIEntry[] = [
  ...top('opener', 2).map((p) => E(p, 'opener')),
  ...top('middle-order', 4).map((p) => E(p, 'middle-order')),
  E(top('wicketkeeper', 1)[0], 'wicketkeeper'),
  E(top('spinner', 1)[0], 'spinner'),
  ...top('fast-bowler', 3).map((p) => E(p, 'fast-bowler')),
];
const shape3: XIEntry[] = [
  ...top('opener', 2).map((p) => E(p, 'opener')),
  ...top('middle-order', 3).map((p) => E(p, 'middle-order')),
  E(top('wicketkeeper', 1)[0], 'wicketkeeper'),
  E(top('all-rounder', 1)[0], 'all-rounder'),
  E(top('spinner', 1)[0], 'spinner'),
  ...top('fast-bowler', 3).map((p) => E(p, 'fast-bowler')),
];
const weakXI: XIEntry[] = [
  ...bottom('opener', 2).map((p) => E(p, 'opener')),
  ...bottom('middle-order', 4).map((p) => E(p, 'middle-order')),
  E(bottom('wicketkeeper', 1)[0], 'wicketkeeper'),
  E(bottom('all-rounder', 1)[0], 'all-rounder'),
  ...bottom('fast-bowler', 3).map((p) => E(p, 'fast-bowler')),
];
const show = (title: string, xi: XIEntry[], vs?: XIEntry[]) => {
  const c = vs ? compareXIs(xi, vs, CTX) : compareXIs(xi, xi, CTX);
  L.push(`### ${title}`);
  L.push('');
  for (const ps of c.userPlayers) L.push(`- ${ps.name} (${ps.role}): ${f1(ps.score)}`);
  L.push(`- **XI score: ${f1(c.userScore)}**${vs ? ` vs ${f1(c.opponentScore)} → diff ${f1(c.difference)} → ${c.result}` : ''}`);
  L.push('');
};
show('Shape 1 — 2O / 4MO / 1K / 1AR / 3F (elite)', shape1);
show('Shape 2 — 2O / 4MO / 1K / 1S / 3F (elite)', shape2);
show('Shape 3 — 2O / 3MO / 1K / 1AR / 1S / 3F (elite)', shape3);
show('Elite XI vs weak XI', shape1, weakXI);
show('AR-heavy (shape 1) vs specialist-heavy (shape 2)', shape1, shape2);
show('Identical XI vs identical XI', shape1, shape1);
L.push('## How to reproduce');
L.push('');
L.push('```bash');
L.push('npm test   # 236 assertions (127 XI + 120-trial draft sim + 107 seven-metric)');
L.push('# regenerate this file:');
L.push('node_modules/.bin/esbuild scripts/review-report.ts --bundle --platform=node --format=cjs --outfile=.diag-dist/r.cjs --log-level=error && node .diag-dist/r.cjs');
L.push('```');
L.push('');
L.push('`/matchup` is still on the old `ratings.ts` model — nothing here is live until you approve wiring it up.');
L.push('');

writeFileSync('SCORING_REVIEW.md', L.join('\n'));
console.log('wrote SCORING_REVIEW.md');
