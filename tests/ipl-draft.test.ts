/**
 * IPL draft pools (src/lib/formats/ipl-store.ts): every franchise × season draw is real, every
 * player is draftable and scorable, and random spin sequences can be drafted into a legal XI.
 */
import { iplPlayers, iplPlayersByBlock, iplSpinCombos } from '../src/lib/formats/ipl-store';
import { IPL_BLOCKS, IPL_TEAM_CODES, IPL_MIN_MATCHES } from '../src/lib/formats/ipl-config';
import { upcomingCombos, mulberry32 } from '../src/lib/daily';
import { WB_FORMATS, buildWbContext, scoreWbPlayer, type WbRole } from '../src/lib/white-ball-metrics';
import { playerGroups, type NormalizedPlayer } from '../src/lib/player-logic';
import { achievable } from './oracle';

let pass = 0, fail = 0;
const ok = (cond: boolean, name: string, extra?: unknown) => {
  if (cond) pass++;
  else { fail++; console.log(`FAIL: ${name}`, extra ?? ''); }
};

const players = iplPlayers();
const byBlock = iplPlayersByBlock();
const combos = iplSpinCombos();
ok(players.length > 300, 'a real pool of IPL players', players.length);
ok(players.every((p) => (p.stats.matches ?? 0) >= IPL_MIN_MATCHES), `every player has ${IPL_MIN_MATCHES}+ IPL matches`);
ok(combos.length >= 35 && combos.every((c) => (IPL_BLOCKS as readonly string[]).includes(c.era) && c.nation in IPL_TEAM_CODES), 'combos are franchise × season block', combos.length);
ok(combos.every((c) => c.count >= 11), 'every draw has at least 11 players', combos.filter((c) => c.count < 11));

const poolFor = (era: string, nation: string): NormalizedPlayer[] => byBlock[era].filter((p) => p.nation === nation);
ok(combos.every((c) => poolFor(c.era, c.nation).some((p) => p.primaryRole === 'wicketkeeper')), 'every draw has a wicketkeeper');

// uids are unique even when a player had two teams in one block
const uids = Object.values(byBlock).flat().map((p) => p.uid);
ok(new Set(uids).size === uids.length, 'every spell has a unique uid');

// every role a player can be declared as is scorable (so the result page never fails)
const ctx = buildWbContext(players, WB_FORMATS.ipl);
let unscorable = 0;
for (const p of Object.values(byBlock).flat()) {
  for (const role of playerGroups(p)) {
    try { scoreWbPlayer({ id: p.id, name: p.name, primaryRole: p.primaryRole, stats: p.stats }, role as WbRole, ctx, WB_FORMATS.ipl); }
    catch { unscorable++; }
  }
}
ok(unscorable === 0, 'every declarable role of every player can be scored', unscorable);

// random spin sequences under the live spin rules: how many can make a legal XI?
const TRIALS = 300;
let stalled = 0;
const rng = mulberry32(20261001);
for (let t = 0; t < TRIALS; t++) {
  const history: { era: string; nation: string }[] = [];
  for (let round = 0; round < 6; round++) {
    const options = upcomingCombos(round, history, combos, combos);
    history.push(options[Math.floor(rng() * options.length)]);
  }
  if (!achievable(history.map((c) => poolFor(c.era, c.nation)))) stalled++;
}
console.log(`IPL: ${stalled} of ${TRIALS} random spin sequences cannot make a legal XI`);
ok(stalled === 0, 'every random IPL spin sequence can be drafted into a legal XI', stalled);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
