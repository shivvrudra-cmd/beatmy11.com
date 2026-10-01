/**
 * white-ball-store.ts — build-time player loading for ODI, T20I and IPL (imports the data files;
 * server side only).
 *
 * One normalized entry per player per draw they belong to, so the shared draft rules in
 * ../player-logic work unchanged:
 *   ODI / T20I  draw = nation × decade; a player appears in every decade they played in.
 *   IPL         draw = franchise × season block; the "nation" field carries the franchise.
 * Stats are always the player's whole career in that format.
 */
import odiData from '../../data/formats/odi.json';
import t20iData from '../../data/formats/t20i.json';
import iplData from '../../data/formats/ipl.json';
import { normalizePlayer, type NormalizedPlayer, type RawPlayer } from '../player-logic';
import { WB_FORMATS, canScoreAs, wbRole, type WbFormat, type WbRole } from '../white-ball-metrics';
import { IPL_BLOCKS, IPL_TEAM_CODES } from './ipl-config';
import { INTL_ERAS, WB_MIN_MATCHES } from './white-ball-config';

export type WbFormatId = WbFormat['id'];

export interface WbRecord {
  id: string;
  name: string;
  nation?: string;
  era?: string[];
  iplSpells?: { team: string; block: string }[];
  primaryRole: string;
  secondaryRoles: string[];
  stats: Record<string, number | null>;
}

const DATA: Record<WbFormatId, WbRecord[]> = {
  odi: odiData as unknown as WbRecord[],
  t20i: t20iData as unknown as WbRecord[],
  ipl: iplData as unknown as WbRecord[],
};

/** Draftable players: enough matches, and every role they can be declared as is scorable. */
export function wbPlayers(id: WbFormatId): WbRecord[] {
  const fmt = WB_FORMATS[id];
  const out: WbRecord[] = [];
  for (const p of DATA[id]) {
    if ((p.stats.matches ?? 0) < WB_MIN_MATCHES[id]) continue;
    if (!canScoreAs(p, wbRole(p), fmt)) continue; // e.g. a batter never dismissed: no average
    out.push({ ...p, secondaryRoles: (p.secondaryRoles ?? []).filter((r) => canScoreAs(p, r as WbRole, fmt)) });
  }
  return out;
}

/** The era/block ids of a format, in order. */
export function wbEras(id: WbFormatId): readonly string[] {
  return id === 'ipl' ? IPL_BLOCKS : INTL_ERAS[id];
}

/** Era (decade or season block) → normalized entries. */
export function wbPlayersByEra(id: WbFormatId): Record<string, NormalizedPlayer[]> {
  const map: Record<string, NormalizedPlayer[]> = {};
  for (const e of wbEras(id)) map[e] = [];
  for (const p of wbPlayers(id)) {
    if (id === 'ipl') {
      for (const s of p.iplSpells ?? []) {
        if (!(s.team in IPL_TEAM_CODES) || !(s.block in map)) continue;
        const raw: RawPlayer = { id: p.id, name: p.name, nation: s.team, era: [s.block], primaryRole: p.primaryRole, secondaryRoles: p.secondaryRoles, stats: p.stats };
        // The team code in the source id keeps uids unique when a player had two teams in one block.
        map[s.block].push(normalizePlayer(raw, `${s.block}@${IPL_TEAM_CODES[s.team]}`));
      }
    } else {
      const eras = (p.era ?? []).filter((e) => e in map);
      for (const e of eras) {
        const raw: RawPlayer = { id: p.id, name: p.name, nation: p.nation, era: eras, primaryRole: p.primaryRole, secondaryRoles: p.secondaryRoles, stats: p.stats };
        map[e].push(normalizePlayer(raw, e));
      }
    }
  }
  return map;
}

export interface WbCombo { era: string; nation: string; count: number }

/** A draw needs at least this many players to be worth spinning. */
const MIN_POOL = 5;

/** Every draw (era × nation, or block × franchise) that has players. */
export function wbSpinCombos(id: WbFormatId): WbCombo[] {
  const byEra = wbPlayersByEra(id);
  const combos: WbCombo[] = [];
  for (const era of wbEras(id)) {
    const counts = new Map<string, number>();
    for (const p of byEra[era]) counts.set(p.nation, (counts.get(p.nation) ?? 0) + 1);
    for (const [nation, count] of counts) if (count >= MIN_POOL) combos.push({ era, nation, count });
  }
  return combos;
}
