/**
 * IPL draft pools (src/lib/formats/ipl-store.ts): every franchise × season draw is real, every
 * player is draftable and scorable, and random spin sequences can be drafted into a legal XI.
 */
import { iplPlayers, iplPlayersByBlock, iplSpinCombos } from '../src/lib/formats/ipl-store';
import { IPL_BLOCKS, IPL_TEAM_CODES, IPL_MIN_MATCHES } from '../src/lib/formats/ipl-config';
import { upcomingCombos, mulberry32 } from '../src/lib/daily';
import { WB_FORMATS, buildWbContext, scoreWbPlayer, type WbRole } from '../src/lib/white-ball-metrics';
import { playerGroups, createDraft, validatePoolPick, type NormalizedPlayer } from '../src/lib/player-logic';
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
// Stints need 10+ matches for that team in that block, so one-season teams have small squads.
ok(combos.every((c) => c.count >= 8), 'every draw has at least 8 players', combos.filter((c) => c.count < 8));
ok(combos.filter((c) => c.count < 11).length <= 4, 'at most four draws are under 11 players', combos.filter((c) => c.count < 11));

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

// stints: a card carries only that franchise's matches in that block, and every draft card says
// whether the player is overseas
{
  const cummins = players.filter((p) => p.name === 'Pat Cummins');
  ok(cummins.length >= 2 && new Set(cummins.map((p) => `${p.stint!.team}|${p.stint!.block}`)).size === cummins.length, 'a player has one record per stint', cummins.length);
  const kkr = cummins.find((p) => p.stint!.team === 'Kolkata Knight Riders' && p.stint!.block === '2018-22');
  const career = cummins.reduce((n, p) => n + (p.stats.matches ?? 0), 0);
  ok(!!kkr && (kkr.stats.matches ?? 0) < career, 'a stint shows fewer matches than the career', { kkr: kkr?.stats.matches, career });
  ok(players.every((p) => typeof p.overseas === 'boolean'), 'every draftable IPL player is known to be Indian or overseas');
  ok(players.some((p) => p.name === 'Rashid Khan' && p.overseas === true) && players.some((p) => p.name === 'Virat Kohli' && p.overseas === false), 'overseas flags: Rashid Khan yes, Kohli no');
}
// the four-overseas rule
{
  const os = Object.values(byBlock).flat().filter((p) => p.overseas);
  const five = [...new Map(os.map((p) => [p.id, p])).values()].slice(0, 5);
  let d = { ...createDraft(), currentRound: 3, currentEra: 'x', currentNation: 'y' };
  d = { ...d, selectedPlayers: five.slice(0, 4).map((p) => ({ ...p, roundPicked: 1, draftEra: 'x' })) };
  ok(validatePoolPick(d, five[4]) === 'Your XI already has four overseas players.', 'a fifth overseas player is blocked');
  const local = Object.values(byBlock).flat().find((p) => !p.overseas)!;
  ok(validatePoolPick(d, local) !== 'Your XI already has four overseas players.', 'an Indian player is not blocked by the overseas rule');
}

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
