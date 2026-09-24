/**
 * player-store.ts — data-file-backed player loading for Astro frontmatter.
 *
 * Pure logic lives in ./player-logic (no JSON imports, safe to bundle for
 * the client). This module adds the JSON pool loading used at build time to
 * server-render pages and embed the player data blob.
 */

import legendsData from '../data/legends.json';
import data1970s from '../data/1970s.json';
import data1980s from '../data/1980s.json';
import data1990s from '../data/1990s.json';
import data2000s from '../data/2000s.json';
import data2010s from '../data/2010s.json';
import data2020s from '../data/2020s.json';

export * from './player-logic';
import { normalizePlayer, ERA_IDS, NATIONS } from './player-logic';
import type { RawPlayer, NormalizedPlayer } from './player-logic';

const ERA_FILES: Record<string, RawPlayer[]> = {
  legends: legendsData as unknown as RawPlayer[],
  '1970s': data1970s as unknown as RawPlayer[],
  '1980s': data1980s as unknown as RawPlayer[],
  '1990s': data1990s as unknown as RawPlayer[],
  '2000s': data2000s as unknown as RawPlayer[],
  '2010s': data2010s as unknown as RawPlayer[],
  '2020s': data2020s as unknown as RawPlayer[],
};

/**
 * All normalized players for one era file. Dedupes by raw `id` within the
 * file (first occurrence wins) and namespaces every uid with the era id.
 */
export function playersForEra(eraId: string): NormalizedPlayer[] {
  const raw = ERA_FILES[eraId] ?? [];
  const seen = new Set<string>();
  const out: NormalizedPlayer[] = [];
  for (const p of raw) {
    if (!p || !p.id || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(normalizePlayer(p, eraId));
  }
  return out;
}

/** Era id → normalized, deduped player list. Used to embed the data blob. */
export function allPlayersByEra(): Record<string, NormalizedPlayer[]> {
  const map: Record<string, NormalizedPlayer[]> = {};
  for (const id of ERA_IDS) map[id] = playersForEra(id);
  return map;
}

/** uid → player index over every era (handy for restoring saved XIs). */
export function playerIndexByUid(): Record<string, NormalizedPlayer> {
  const idx: Record<string, NormalizedPlayer> = {};
  for (const id of ERA_IDS) {
    for (const p of playersForEra(id)) idx[p.uid] = p;
  }
  return idx;
}

/** One valid spin draw: an era×nation combo with at least one player. */
export interface SpinCombo {
  era: string;
  nation: string;
  /** Unique players (by raw id) whose `era` contains the era id and whose
   *  nation matches — i.e. the eligible pool size for this draw. */
  count: number;
}

/**
 * Every valid era×nation spin combo, computed from the real data at build
 * time. Combos with zero eligible players (e.g. 1970s+Bangladesh) are
 * excluded, so a spin can never draw a dead pool. `eraIds` lets the game
 * split the pool — round 1 draws only from the Legends era, the remaining
 * rounds from every other era.
 */
export function spinCombos(eraIds: readonly string[] = ERA_IDS): SpinCombo[] {
  const all = allPlayersByEra();
  const flat: NormalizedPlayer[] = [];
  for (const eraId of eraIds) flat.push(...all[eraId]);
  const combos: SpinCombo[] = [];
  for (const eraId of eraIds) {
    for (const nation of NATIONS) {
      const seen = new Set<string>();
      for (const p of flat) {
        const eras = Array.isArray(p.era) ? p.era : [p.era];
        if (eras.includes(eraId) && p.nation === nation) seen.add(p.id);
      }
      if (seen.size > 0) combos.push({ era: eraId, nation, count: seen.size });
    }
  }
  return combos;
}

/** Round-1 spin pool: Legends era only — every combo has ≥1 eligible player. */
export function legendsSpinCombos(): SpinCombo[] {
  return spinCombos(['legends']);
}

/** Rounds 2–6 spin pool: every era except Legends. */
export function draftSpinCombos(): SpinCombo[] {
  return spinCombos(ERA_IDS.filter((e) => e !== 'legends'));
}
