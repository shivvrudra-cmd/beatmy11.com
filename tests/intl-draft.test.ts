/**
 * ODI and T20I draft pools (src/lib/formats/white-ball-store.ts): every nation × decade draw is
 * real, every player is scorable in every role they can be declared as, and random spin sequences
 * can be drafted into a legal XI.
 */
import { wbPlayers, wbPlayersByEra, wbSpinCombos, wbEras, type WbFormatId } from '../src/lib/formats/white-ball-store';
import { WB_MIN_MATCHES } from '../src/lib/formats/white-ball-config';
import { upcomingCombos, mulberry32 } from '../src/lib/daily';
import { WB_FORMATS, buildWbContext, scoreWbPlayer, type WbRole } from '../src/lib/white-ball-metrics';
import { playerGroups, type NormalizedPlayer } from '../src/lib/player-logic';
import { achievable } from './oracle';

let pass = 0, fail = 0;
const ok = (cond: boolean, name: string, extra?: unknown) => {
  if (cond) pass++;
  else { fail++; console.log(`FAIL: ${name}`, extra ?? ''); }
};

for (const id of ['odi', 't20i'] as WbFormatId[]) {
  const fmt = WB_FORMATS[id];
  const players = wbPlayers(id);
  const byEra = wbPlayersByEra(id);
  const combos = wbSpinCombos(id);
  const poolFor = (era: string, nation: string): NormalizedPlayer[] => {
    const seen = new Set<string>();
    return Object.values(byEra).flat().filter((p) => {
      const eras = Array.isArray(p.era) ? p.era : [p.era];
      if (!eras.includes(era) || p.nation !== nation || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  };
  ok(players.length > 300, `${id}: a real pool of players`, players.length);
  ok(players.every((p) => (p.stats.matches ?? 0) >= WB_MIN_MATCHES[id]), `${id}: every player has ${WB_MIN_MATCHES[id]}+ matches`);
  ok(combos.length >= 24 && combos.every((c) => wbEras(id).includes(c.era)), `${id}: combos are nation × decade`, combos.length);
  const thin = combos.filter((c) => poolFor(c.era, c.nation).length < 5).map((c) => `${c.nation} ${c.era} (${poolFor(c.era, c.nation).length})`);
  console.log(`${id}: ${combos.length} draws; smallest pools: ${combos.map((c) => [poolFor(c.era, c.nation).length, `${c.nation} ${c.era}`] as const).sort((a, b) => a[0] - b[0]).slice(0, 4).map((x) => `${x[1]} ${x[0]}`).join(', ')}`);
  ok(thin.length === 0, `${id}: every draw has at least 5 players`, thin);
  const noKeeper = combos.filter((c) => !poolFor(c.era, c.nation).some((p) => p.primaryRole === 'wicketkeeper')).map((c) => `${c.nation} ${c.era}`);
  // Not required per draw (other draws supply a keeper; the 300 trials below prove drafts finish),
  // but worth seeing: gaps here come from the ODI cut-off excluding pre-2004 debutants.
  if (noKeeper.length) console.log(`${id}: draws with no wicketkeeper: ${noKeeper.join(', ')}`);
  const uids = Object.values(byEra).flat().map((p) => p.uid);
  ok(new Set(uids).size === uids.length, `${id}: uids are unique`);

  const ctx = buildWbContext(players, fmt);
  let unscorable = 0;
  for (const p of Object.values(byEra).flat()) {
    for (const role of playerGroups(p)) {
      try { scoreWbPlayer({ id: p.id, name: p.name, primaryRole: p.primaryRole, stats: p.stats }, role as WbRole, ctx, fmt); }
      catch { unscorable++; }
    }
  }
  ok(unscorable === 0, `${id}: every declarable role of every player can be scored`, unscorable);

  const TRIALS = 300;
  let stalled = 0;
  const rng = mulberry32(id === 'odi' ? 20261001 : 20261002);
  for (let t = 0; t < TRIALS; t++) {
    const history: { era: string; nation: string }[] = [];
    for (let round = 0; round < 6; round++) {
      const options = upcomingCombos(round, history, combos, combos);
      history.push(options[Math.floor(rng() * options.length)]);
    }
    if (!achievable(history.map((c) => poolFor(c.era, c.nation)))) stalled++;
  }
  console.log(`${id}: ${stalled} of ${TRIALS} random spin sequences cannot make a legal XI`);
  ok(stalled === 0, `${id}: every random spin sequence can be drafted into a legal XI`, stalled);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
