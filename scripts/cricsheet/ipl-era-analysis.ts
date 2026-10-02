/**
 * ipl-era-analysis.ts — numbers for docs/reports/ipl-era-normalisation.md: league rates per
 * season block, and how stint ratings spread across blocks under the chosen era mode.
 * Read-only. Run once per mode:
 *   npx esbuild scripts/cricsheet/ipl-era-analysis.ts --bundle --platform=node --format=cjs --outfile=.test-dist/ipl-era.cjs --log-level=error
 *   IPL_ERA_MODE=none node .test-dist/ipl-era.cjs   (then scaled, within)
 */
import { wbPlayers, iplLeagueRates } from '../../src/lib/formats/white-ball-store';
import { WB_FORMATS, buildWbContext, scoreWbPlayer } from '../../src/lib/white-ball-metrics';
import { IPL_BLOCKS } from '../../src/lib/formats/ipl-config';

const FMT = WB_FORMATS.ipl;
const players = wbPlayers('ipl');
const ctx = buildWbContext(players, FMT);
const rated = players.map((p) => ({ p, s: scoreWbPlayer(p, null, ctx, FMT) }));
const league = iplLeagueRates();
console.log(`mode: ${process.env.IPL_ERA_MODE ?? '(default)'}`);
console.log('league: ' + [...IPL_BLOCKS, 'all'].map((b) => `${b} SR ${league[b].strikeRate.toFixed(1)} econ ${league[b].economy.toFixed(2)}`).join(' | '));
const BAT = new Set(['opener', 'middle-order', 'wicketkeeper']);
const BOWL = new Set(['spinner', 'fast-bowler']);
for (const [name, set] of [['batters', BAT], ['bowlers', BOWL]] as const) {
  const group = rated.filter((x) => set.has(x.s.role));
  const top = [...group].sort((a, b) => b.s.score - a.s.score).slice(0, 50);
  console.log(`${name}: ` + IPL_BLOCKS.map((b) => {
    const g = group.filter((x) => x.p.stint!.block === b);
    const mean = g.reduce((a, x) => a + x.s.score, 0) / g.length;
    return `${b}: ${g.length} stints, mean rating ${mean.toFixed(1)}, ${top.filter((x) => x.p.stint!.block === b).length} of the top 50`;
  }).join(' | '));
}
