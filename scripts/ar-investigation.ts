import { readFileSync } from 'node:fs';
import { buildScoringContext, adjustedMetrics, percentileRank, BOWLING_METRICS, evaluationRole } from '../src/lib/seven-metrics';
import { normalizePlayer, type NormalizedPlayer } from '../src/lib/player-logic';
const DATA_DIR = process.cwd() + '/src/data';
const byId = new Map<string, NormalizedPlayer>();
for (const era of ['legends','1970s','1980s','1990s','2000s','2010s','2020s']) {
  for (const p of JSON.parse(readFileSync(`${DATA_DIR}/${era}.json`,'utf8'))) {
    const n = normalizePlayer(p, era);
    if (!byId.has(n.id)) byId.set(n.id, n);
  }
}
const CTX = buildScoringContext([...byId.values()]);
const POPS = CTX.populations;
// population composition by role
const comp: Record<string, number> = {};
for (const p of byId.values()) {
  const r = evaluationRole(p);
  if (['spinner','fast-bowler','all-rounder'].includes(r)) comp[r] = (comp[r] ?? 0) + 1;
}
console.log('bowling population composition:', comp, 'total:', Object.values(comp).reduce((a,b)=>a+b,0));
for (const id of ['jacques-kallis','garfield-sobers','imran-khan']) {
  const p = byId.get(id)!; const raw = adjustedMetrics(p, CTX);
  console.log(`\n${p.name} [${p.primaryRole}]`);
  for (const k of BOWLING_METRICS) {
    const v = raw[k]!; const pop = POPS[k]; const n = pop.length;
    const below = pop.filter(x => x > v).length; // lower-is-better only for bowlingAverage
    const isBowlAvg = k === 'bowlingAverage';
    const bl = isBowlAvg ? pop.filter(x => x > v).length : pop.filter(x => x < v).length;
    const eq = pop.filter(x => x === v).length;
    const pct = percentileRank(v, pop, !isBowlAvg)!;
    console.log(`  ${k}: adjusted=${v.toFixed(3)} below=${bl} equal=${eq} n=${n} -> ${pct.toFixed(1)} (ordinal ~${Math.round(bl + eq/2)} of ${n})`);
  }
}
// all-rounder-only bowling sub-population sizes (for the report's alternatives section)
const arOnly: Record<string, number> = {};
for (const p of byId.values()) if (evaluationRole(p) === 'all-rounder') arOnly['all-rounder'] = (arOnly['all-rounder'] ?? 0) + 1;
console.log('\nall-rounders in bowling population:', arOnly);
