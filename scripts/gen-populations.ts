import { readFileSync, writeFileSync } from 'node:fs';
import { buildPopulations, BATTING_METRICS, BOWLING_METRICS, evaluationRole, rawMetrics } from '../src/lib/seven-metrics';
import { normalizePlayer, type NormalizedPlayer } from '../src/lib/player-logic';
const DATA_DIR = process.cwd() + '/src/data';
const byId = new Map<string, NormalizedPlayer>();
for (const era of ['legends','1970s','1980s','1990s','2000s','2010s','2020s']) {
  for (const p of JSON.parse(readFileSync(`${DATA_DIR}/${era}.json`,'utf8'))) {
    const n = normalizePlayer(p, era);
    if (!byId.has(n.id)) byId.set(n.id, n);
  }
}
const line = (p: NormalizedPlayer) => `${p.id}\t${p.name}\t${p.nation}\t${p.displayEra}\t${p.primaryRole}`;
const bat: string[] = [], bowl: string[] = [];
for (const p of byId.values()) {
  const role = evaluationRole(p);
  if (['opener','middle-order','wicketkeeper','all-rounder'].includes(role)) bat.push(line(p));
  if (['spinner','fast-bowler','all-rounder'].includes(role)) bowl.push(line(p));
}
bat.sort(); bowl.sort();
writeFileSync('scripts/populations/batting-population.tsv', `id\tname\tnation\tera\tprimaryRole\n${bat.join('\n')}\n`);
writeFileSync('scripts/populations/bowling-population.tsv', `id\tname\tnation\tera\tprimaryRole\n${bowl.join('\n')}\n`);
console.log(`batting=${bat.length} bowling=${bowl.length} unique=${byId.size}`);
