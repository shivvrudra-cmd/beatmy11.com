/**
 * white-ball-result.ts — build-time inputs for a white-ball format's result page (server side
 * only): the fixed opponent XI, the engine's ranking populations, the calibration sample and the
 * format's difficulty, all from src/data/formats/<format>-series.json
 * (written by scripts/cricsheet/calibrate-white-ball.ts).
 */
import odiSeries from '../../data/formats/odi-series.json';
import t20iSeries from '../../data/formats/t20i-series.json';
import iplSeries from '../../data/formats/ipl-series.json';
import { WB_FORMATS, buildWbContext } from '../white-ball-metrics';
import { wbPlayers, wbOpponentPool, type WbFormatId } from './white-ball-store';

interface SeriesFile {
  opponentXI: { id: string; name: string; role: string; team?: string; block?: string }[];
  parGap: number;
  calibration: { source: string; generated: string; scores: number[] };
}
const SERIES: Record<WbFormatId, SeriesFile> = {
  odi: odiSeries as SeriesFile, t20i: t20iSeries as SeriesFile, ipl: iplSeries as SeriesFile,
};

export function wbResultProps(id: WbFormatId) {
  const players = wbPlayers(id);
  const pool = wbOpponentPool(id);
  // IPL opponents are stints: the same player id exists once per franchise and block.
  const find = (h: SeriesFile['opponentXI'][number]) =>
    pool.find((p) => p.id === h.id && (!h.team || (p.stint?.team === h.team && p.stint?.block === h.block)));
  const series = SERIES[id];
  // The opponent is scored in the role it was picked for.
  const houseXI = series.opponentXI.map((h) => {
    const p = find(h);
    if (!p) throw new Error(`${id} opponent XI player ${h.name} (${h.id}) is not in the pool; rerun scripts/cricsheet/calibrate-white-ball.ts`);
    return { id: p.id, uid: p.id, name: p.name, nation: p.stint?.team ?? p.nation ?? '', era: p.stint?.block ?? '', primaryRole: h.role, secondaryRoles: [], stats: p.stats };
  });
  return {
    houseXI,
    scoringContext: buildWbContext(players, WB_FORMATS[id]),
    calibration: series.calibration,
    parGap: series.parGap,
  };
}
