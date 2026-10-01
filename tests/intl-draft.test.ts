/**
 * ODI and T20I draft pools (src/lib/formats/white-ball-store.ts): every nation × decade draw is
 * real, every player is scorable in every role they can be declared as, and random spin sequences
 * can be drafted into a legal XI.
 */
import { wbPlayers, wbOpponentPool, wbPlayersByEra, wbSpinCombos, wbEras, cutSquad, SQUAD_SIZE, SQUAD_QUOTA, type SquadCandidate, type WbFormatId } from '../src/lib/formats/white-ball-store';
import { wbResultProps } from '../src/lib/formats/white-ball-result';
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


// ---- squad cut: at most 25 per draw, the regulars first, the top-rated guaranteed
{
  const mk = (i: number, role: WbRole, periodMatches: number, rating = 50): SquadCandidate => ({ id: `p${i}`, name: `P${String(i).padStart(2, '0')}`, role, periodMatches, careerMatches: periodMatches, rating });
  const roles: WbRole[] = ['opener', 'middle-order', 'wicketkeeper', 'all-rounder', 'spinner', 'fast-bowler'];
  const big = Array.from({ length: 48 }, (_, i) => mk(i, roles[i % 6], 60 - i));
  const kept = cutSquad(big);
  const count = (r: WbRole) => big.filter((c) => kept.has(c.id) && c.role === r).length;
  ok(kept.size === SQUAD_SIZE, 'a big draw is cut to 25', kept.size);
  ok(roles.every((r) => count(r) >= Math.min(SQUAD_QUOTA[r], 8)), 'every role keeps its place count', roles.map(count));
  ok(kept.has('p0') && !kept.has('p47'), 'the most-played stay, the least-played go');
  const star = [...big.slice(0, 47), mk(47, 'fast-bowler', 20, 99)];
  const keptStar = cutSquad(star);
  ok(keptStar.has('p47') && keptStar.size === SQUAD_SIZE, 'a top-rated player with few matches is guaranteed a place', keptStar.size);
  ok(!cutSquad([...big.slice(0, 47), mk(47, 'fast-bowler', 19, 99)]).has('p47'), 'but not a visitor with under 20 matches for the team');
  ok(cutSquad(big.slice(0, 20)).size === 20, 'a draw of 25 or fewer is left alone');
  for (const id of ['odi', 't20i', 'ipl'] as WbFormatId[]) {
    const sizes = new Map<string, number>();
    for (const [era, list] of Object.entries(wbPlayersByEra(id))) for (const p of list) sizes.set(`${era}|${p.nation}`, (sizes.get(`${era}|${p.nation}`) ?? 0) + 1);
    const over = [...sizes].filter(([, n]) => n > SQUAD_SIZE);
    ok(over.length === 0, `${id}: no draw shows more than 25 players`, over);
  }
}

// ---- opponent-only players (Viv Richards, Rashid Khan): in the World XI, never in a draft
for (const id of ['odi', 't20i'] as WbFormatId[]) {
  const draftIds = new Set(wbPlayers(id).map((p) => p.id));
  const extra = wbOpponentPool(id).filter((p) => !draftIds.has(p.id));
  const inPools = Object.values(wbPlayersByEra(id)).flat().filter((p) => extra.some((e) => e.id === p.id));
  ok(extra.length === 1 && inPools.length === 0, `${id}: the opponent-only player is in no draft pool`, { extra: extra.map((p) => p.name), inPools: inPools.length });
  const house = wbResultProps(id).houseXI;
  ok(house.length === 11 && extra.every((e) => house.some((h) => h.id === e.id)), `${id}: the owner's World XI resolves, opponent-only player included`, house.map((h) => h.name));
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
