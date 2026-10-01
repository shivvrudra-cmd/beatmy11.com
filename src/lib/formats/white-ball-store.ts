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
import opponentOnlyData from '../../data/formats/opponent-only.json';
import { normalizePlayer, type NormalizedPlayer, type RawPlayer } from '../player-logic';
import { WB_FORMATS, buildWbContext, canScoreAs, scoreWbPlayer, wbRole, type WbFormat, type WbRole } from '../white-ball-metrics';
import { IPL_BLOCKS, IPL_TEAM_CODES } from './ipl-config';
import { INTL_ERAS, WB_MIN_MATCHES } from './white-ball-config';

export type WbFormatId = WbFormat['id'];

export interface WbRecord {
  id: string;
  name: string;
  nation?: string;
  era?: string[];
  /** Ball-by-ball matches per decade (ODI, T20I). */
  eraMatches?: Record<string, number>;
  iplSpells?: { team: string; block: string; matches?: number }[];
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

/**
 * Everyone the fixed opponent XI may be picked from: the draftable players plus the owner's
 * opponent-only players (official HowSTAT career lines, no ball-by-ball matches; see
 * scripts/cricsheet/owner-opponent-only.json). Opponent-only players are never in a draft pool
 * and never in the ranking populations.
 */
export function wbOpponentPool(id: WbFormatId): WbRecord[] {
  const extra = ((opponentOnlyData as unknown as Record<string, WbRecord[]>)[id] ?? []);
  return [...wbPlayers(id), ...extra];
}

/** The era/block ids of a format, in order. */
export function wbEras(id: WbFormatId): readonly string[] {
  return id === 'ipl' ? IPL_BLOCKS : INTL_ERAS[id];
}

/**
 * Squad cut (owner, 2026-10-01): a draw shows at most 25 players, so the pool can be read on a
 * phone. Who stays: the players with the most matches for that team in that period, filling a
 * place count per role; spare places (a role the team is short of) go to the next most-played
 * players of any role. Then the draw's highest-rated players are guaranteed a place.
 * PROVISIONAL details (Claude's reading of "most matches, highest rated"; owner to confirm):
 * 5 guaranteed stars, who need at least 5 matches for that team in that period.
 */
export const SQUAD_SIZE = 25;
export const SQUAD_QUOTA: Record<WbRole, number> = {
  opener: 4, 'middle-order': 6, wicketkeeper: 3, 'all-rounder': 3, spinner: 3, 'fast-bowler': 6,
};
const SQUAD_STARS = 5;
const SQUAD_STAR_MIN_MATCHES = 5;

export interface SquadCandidate { id: string; name: string; role: WbRole; periodMatches: number; careerMatches: number; rating: number }

/** The ids that stay in one draw's squad. Deterministic. */
export function cutSquad(cands: SquadCandidate[]): Set<string> {
  if (cands.length <= SQUAD_SIZE) return new Set(cands.map((c) => c.id));
  const byPlayed = [...cands].sort((a, b) => b.periodMatches - a.periodMatches || b.careerMatches - a.careerMatches || a.name.localeCompare(b.name));
  const chosen = new Map<string, SquadCandidate>();
  for (const role of Object.keys(SQUAD_QUOTA) as WbRole[]) {
    for (const c of byPlayed.filter((x) => x.role === role).slice(0, SQUAD_QUOTA[role])) chosen.set(c.id, c);
  }
  for (const c of byPlayed) { if (chosen.size >= SQUAD_SIZE) break; chosen.set(c.id, c); }
  const stars = cands.filter((c) => c.periodMatches >= SQUAD_STAR_MIN_MATCHES)
    .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name)).slice(0, SQUAD_STARS);
  const starIds = new Set(stars.map((s) => s.id));
  for (const s of stars) {
    if (chosen.has(s.id)) continue;
    // Make room: the least-played non-star of the same role, else of the best-stocked role.
    const out = [...byPlayed].reverse().filter((c) => chosen.has(c.id) && !starIds.has(c.id));
    const roleCount = (r: WbRole) => [...chosen.values()].filter((c) => c.role === r).length;
    const victim = out.find((c) => c.role === s.role) ?? out.sort((a, b) => roleCount(b.role) - roleCount(a.role))[0];
    if (!victim) continue;
    chosen.delete(victim.id);
    chosen.set(s.id, s);
  }
  return new Set(chosen.keys());
}

/** Era (decade or season block) → normalized entries, after the squad cut. */
export function wbPlayersByEra(id: WbFormatId): Record<string, NormalizedPlayer[]> {
  const map: Record<string, NormalizedPlayer[]> = {};
  for (const e of wbEras(id)) map[e] = [];
  const all = wbPlayers(id);
  const fmt = WB_FORMATS[id];
  const ctx = buildWbContext(all, fmt);
  const rating = new Map(all.map((p) => [p.id, scoreWbPlayer(p, null, ctx, fmt).score]));
  // Candidates per draw ("era|team"), then the ids that survive the cut.
  const draws = new Map<string, SquadCandidate[]>();
  const add = (era: string, team: string, p: WbRecord, periodMatches: number) => {
    const k = `${era}|${team}`;
    if (!draws.has(k)) draws.set(k, []);
    draws.get(k)!.push({ id: p.id, name: p.name, role: wbRole(p), periodMatches, careerMatches: p.stats.matches ?? 0, rating: rating.get(p.id) ?? 0 });
  };
  for (const p of all) {
    if (id === 'ipl') for (const s of p.iplSpells ?? []) add(s.block, s.team, p, s.matches ?? 0);
    else for (const e of p.era ?? []) add(e, p.nation ?? '', p, p.eraMatches?.[e] ?? 0);
  }
  const kept = new Map([...draws].map(([k, c]) => [k, cutSquad(c)]));
  const inSquad = (era: string, team: string, pid: string) => kept.get(`${era}|${team}`)?.has(pid) ?? false;
  for (const p of all) {
    if (id === 'ipl') {
      for (const s of p.iplSpells ?? []) {
        if (!(s.team in IPL_TEAM_CODES) || !(s.block in map) || !inSquad(s.block, s.team, p.id)) continue;
        const raw: RawPlayer = { id: p.id, name: p.name, nation: s.team, era: [s.block], primaryRole: p.primaryRole, secondaryRoles: p.secondaryRoles, stats: p.stats };
        // The team code in the source id keeps uids unique when a player had two teams in one block.
        map[s.block].push(normalizePlayer(raw, `${s.block}@${IPL_TEAM_CODES[s.team]}`));
      }
    } else {
      const eras = (p.era ?? []).filter((e) => e in map && inSquad(e, p.nation ?? '', p.id));
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
