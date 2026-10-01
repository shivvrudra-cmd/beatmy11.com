/**
 * ipl-store.ts — build-time IPL player loading (imports the data file; server side only).
 *
 * The IPL draft spins franchise × season block. A player appears in every (team, block) they
 * played in, as one normalized entry per spell, so the existing draft rules in ../player-logic
 * work unchanged: the "nation" field carries the franchise and "era" the season block.
 * Stats are always the player's whole IPL career.
 */
import iplData from '../../data/formats/ipl.json';
import { normalizePlayer, type NormalizedPlayer, type RawPlayer } from '../player-logic';
import { WB_FORMATS, canScoreAs, wbRole, type WbRole } from '../white-ball-metrics';
import { IPL_BLOCKS, IPL_TEAM_CODES, IPL_MIN_MATCHES } from './ipl-config';

interface IplRecord {
  id: string;
  name: string;
  primaryRole: string;
  secondaryRoles: string[];
  iplSpells: { team: string; block: string }[];
  stats: Record<string, number | null>;
}

const FMT = WB_FORMATS.ipl;

/** Draftable IPL players: enough matches, and every role they can be declared as is scorable. */
export function iplPlayers(): IplRecord[] {
  const out: IplRecord[] = [];
  for (const p of iplData as unknown as IplRecord[]) {
    if ((p.stats.matches ?? 0) < IPL_MIN_MATCHES) continue;
    if (!canScoreAs(p, wbRole(p), FMT)) continue; // e.g. a batter never dismissed: no average
    const secondaryRoles = (p.secondaryRoles ?? []).filter((r) => canScoreAs(p, r as WbRole, FMT));
    out.push({ ...p, secondaryRoles });
  }
  return out;
}

/** Season block → normalized entries (one per player spell in that block). */
export function iplPlayersByBlock(): Record<string, NormalizedPlayer[]> {
  const map: Record<string, NormalizedPlayer[]> = {};
  for (const b of IPL_BLOCKS) map[b] = [];
  for (const p of iplPlayers()) {
    for (const s of p.iplSpells) {
      if (!(s.team in IPL_TEAM_CODES) || !(s.block in map)) continue;
      const raw: RawPlayer = {
        id: p.id, name: p.name, nation: s.team, era: [s.block],
        primaryRole: p.primaryRole, secondaryRoles: p.secondaryRoles, stats: p.stats,
      };
      // The team code in the source id keeps uids unique when a player had two teams in one block.
      map[s.block].push(normalizePlayer(raw, `${s.block}@${IPL_TEAM_CODES[s.team]}`));
    }
  }
  return map;
}

/** Unique players as the scoring engine needs them (one per player). */
export function iplScoringPlayers(): IplRecord[] {
  return iplPlayers();
}

export interface IplCombo { era: string; nation: string; count: number }

/** Every franchise × season-block draw that has players. */
export function iplSpinCombos(): IplCombo[] {
  const byBlock = iplPlayersByBlock();
  const combos: IplCombo[] = [];
  for (const block of IPL_BLOCKS) {
    const counts = new Map<string, number>();
    for (const p of byBlock[block]) counts.set(p.nation, (counts.get(p.nation) ?? 0) + 1);
    for (const [nation, count] of counts) combos.push({ era: block, nation, count });
  }
  return combos;
}
