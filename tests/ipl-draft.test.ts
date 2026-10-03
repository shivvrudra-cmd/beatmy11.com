/**
 * IPL draft pools (src/lib/formats/ipl-store.ts): every franchise × season draw is real, every
 * player is draftable and scorable, and random spin sequences can be drafted into a legal XI.
 */
import { iplPlayers, iplPlayersByBlock, iplSpinCombos } from '../src/lib/formats/ipl-store';
import { IPL_BLOCKS, IPL_TEAM_CODES, IPL_MIN_MATCHES } from '../src/lib/formats/ipl-config';
import { upcomingCombos, finalSpinOptions, mulberry32 } from '../src/lib/daily';
import { IPL_FORMAT } from '../src/lib/formats/draft-format';
import { WB_FORMATS, buildWbContext, scoreWbPlayer, type WbRole } from '../src/lib/white-ball-metrics';
import { playerGroups, createDraft, validatePoolPick, applySpinResult, applyDraftPick, applyDraftDeselect, placementOptions, serializeDraft, deserializeDraft, overseasCount, XI_SLOTS, type NormalizedPlayer } from '../src/lib/player-logic';
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

// the rule through real picks: 4 overseas fill up, a fifth is refused, and removing one of this
// round's picks allows a swap (4 -> 3 -> 4, never 5); a saved draft with five is not restored
{
  const combo = iplSpinCombos().find((c) => poolFor(c.era, c.nation).filter((p) => p.overseas).length >= 6)!;
  const pool = poolFor(combo.era, combo.nation);
  const osPool = pool.filter((p) => p.overseas);
  let d = applySpinResult(createDraft(), combo.era, combo.nation);
  // pretend four overseas picks are already in the XI from earlier rounds
  d = { ...d, currentRound: 5, selectedPlayers: osPool.slice(0, 4).map((p) => ({ ...p, roundPicked: 1, draftEra: combo.era })) };
  const slotFor = (st: typeof d, p: NormalizedPlayer) => { for (const s of XI_SLOTS) { if (st.slots[s.key]) continue; const o = placementOptions(st, p, s.key).find((x) => !x.reason); if (o) return { s, o }; } return null; };
  const before = d.selectedPlayers.length;
  const fifth = osPool[4];
  for (const s of XI_SLOTS) for (const role of ['opener','middle-order','wicketkeeper','all-rounder','spinner','fast-bowler'] as const) d = applyDraftPick(d, fifth, s.key, role as never);
  ok(d.selectedPlayers.length === before && overseasCount(d.selectedPlayers) === 4, 'applyDraftPick never lets a fifth overseas player in');
  // swap: a picked-this-round overseas player is removed, another goes in
  const six = { ...applySpinResult(createDraft(), combo.era, combo.nation) };
  let e = { ...six, currentRound: 2, selectedPlayers: osPool.slice(0, 3).map((p) => ({ ...p, roundPicked: 1, draftEra: combo.era })) };
  const pick = slotFor(e, osPool[3]);
  if (pick) {
    e = applyDraftPick(e, osPool[3], pick.s.key, pick.o.role);
    ok(overseasCount(e.selectedPlayers) === 4, 'fourth overseas player is allowed');
    e = applyDraftDeselect(e, osPool[3].id);
    ok(overseasCount(e.selectedPlayers) === 3, 'removing an overseas pick from this round frees the place');
    const again = slotFor(e, osPool[4]);
    if (again) e = applyDraftPick(e, osPool[4], again.s.key, again.o.role);
    ok(overseasCount(e.selectedPlayers) <= 4, 'the swap never makes it five');
  }
  // a saved draft with five overseas players is dropped
  const bad = { ...d, selectedPlayers: osPool.slice(0, 5).map((p) => ({ ...p, roundPicked: 1, draftEra: combo.era })), slots: {} as typeof d.slots };
  const ser = JSON.parse(JSON.stringify(serializeDraft(bad)));
  ok(deserializeDraft(ser, (uid) => osPool.find((p) => p.uid === uid) ?? null) === null, 'a saved draft with five overseas players is not restored');
}

// random spin sequences under the live spin rules: how many can make a legal XI?
const TRIALS = 300;
let stalled = 0;
let smallLast = 0;
const rng = mulberry32(20261001);
for (let t = 0; t < TRIALS; t++) {
  const history: { era: string; nation: string }[] = [];
  for (let round = 0; round < 6; round++) {
    const options = finalSpinOptions(upcomingCombos(round, history, combos, combos), round, IPL_FORMAT.finalSpinMinPool);
    history.push(options[Math.floor(rng() * options.length)]);
  }
  if (history[5] && (combos.find((c) => c.era === history[5].era && c.nation === history[5].nation)?.count ?? 0) < 11) smallLast++;
  if (!achievable(history.map((c) => poolFor(c.era, c.nation)))) stalled++;
}
console.log(`IPL: ${stalled} of ${TRIALS} random spin sequences cannot make a legal XI`);
ok(smallLast === 0, 'the final spin never lands on a squad of fewer than 11', smallLast);
ok(stalled === 0, 'every random IPL spin sequence can be drafted into a legal XI', stalled);

// ---- era normalisation (PROPOSED rule; docs/reports/ipl-era-normalisation.md)
{
  const { wbPlayers, iplLeagueRates, IPL_ERA_NORMALISATION } = require('../src/lib/formats/white-ball-store') as typeof import('../src/lib/formats/white-ball-store');
  const league = iplLeagueRates();
  ok(league['2008-12'].strikeRate < league['2013-17'].strikeRate && league['2018-22'].strikeRate < league['2023+'].strikeRate && league['2008-12'].economy < league['2023+'].economy, 'the league got faster block by block (from the data)', league);
  const withMode = (mode: string) => { process.env.IPL_ERA_MODE = mode; const out = wbPlayers('ipl'); delete process.env.IPL_ERA_MODE; return out; };
  const none = withMode('none'), scaled = withMode('scaled');
  ok(none.length === scaled.length && none.every((p) => !Object.keys(p.stats).some((k) => k.startsWith('era:'))), 'mode none: no adjusted numbers, the old behaviour');
  ok(scaled.every((p, i) => p.stats.strikeRate === none[i].stats.strikeRate && p.stats.economy === none[i].stats.economy), 'the real numbers on the cards are never changed');
  const early = scaled.find((p) => p.stint!.block === '2008-12' && (p.stats.strikeRate ?? 0) > 0)!;
  const late = scaled.find((p) => p.stint!.block === '2023+' && (p.stats.strikeRate ?? 0) > 0)!;
  ok(early.stats['era:strikeRate']! > early.stats.strikeRate! && late.stats['era:strikeRate']! < late.stats.strikeRate!, 'a 2008-12 strike rate is scaled up, a 2023+ one down');
  ok(Math.abs(early.stats['era:strikeRate']! - early.stats.strikeRate! * league.all.strikeRate / league['2008-12'].strikeRate) < 1e-9, 'scaled = real x league overall / league in the block');
  const lateBowler = scaled.find((p) => p.stint!.block === '2023+' && (p.stats.economy ?? 0) > 0)!;
  ok(lateBowler.stats['era:economy']! < lateBowler.stats.economy!, 'a 2023+ economy rate is scaled down (bowlers in a faster era are not punished)');
  // Same strike rate, different blocks: the earlier one ranks higher under the proposed rule only.
  const FMT = WB_FORMATS.ipl;
  const pct = (list: typeof scaled, block: string) => {
    const ctx = buildWbContext(list, FMT);
    const base = list.find((p) => p.stint!.block === block && p.primaryRole === 'middle-order')!;
    const twin = { ...base, stats: { ...base.stats, strikeRate: 135 } };
    if ('era:strikeRate' in base.stats) twin.stats['era:strikeRate'] = 135 * league.all.strikeRate / league[block].strikeRate;
    return scoreWbPlayer(twin, 'middle-order', ctx, FMT).normalized.strikeRate;
  };
  ok(pct(scaled, '2008-12') > pct(scaled, '2023+') + 15, 'a strike rate of 135 is worth much more in 2008-12 than in 2023+', [pct(scaled, '2008-12'), pct(scaled, '2023+')]);
  ok(IPL_ERA_NORMALISATION === 'scaled', 'this branch proposes the scaled rule');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
