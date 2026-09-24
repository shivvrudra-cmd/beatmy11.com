/**
 * opponent-xi.ts — the fixed house XI ("My XI").
 *
 * The opponent is isolated in this one module so that replacing it later
 * (a different fixed XI, a seeded random XI, …) is a single-file change:
 * update HOUSE_PLAYER_IDS / getHouseXI here and every consumer follows.
 *
 * Build-time only: it imports legends.json, so it must NOT be imported from
 * client `<script>` bundles. matchup.astro's frontmatter normalizes the XI
 * here and embeds it as JSON for its client verdict script.
 *
 * The XI is fully deterministic — there is no randomness anywhere in the
 * opponent path.
 */

import legendsData from '../data/legends.json';
import { normalizePlayer } from './player-logic';
import type { NormalizedPlayer, RawPlayer } from './player-logic';

/**
 * Raw ids of the fixed house XI. Every id is verified present in
 * legends.json; getHouseXI() throws at build time if one goes missing.
 */
export const HOUSE_PLAYER_IDS = [
  'don-bradman',
  'jack-hobbs',
  'sachin-tendulkar',
  'viv-richards',
  'ricky-ponting',
  'garfield-sobers',
  'imran-khan',
  'adam-gilchrist',
  'malcolm-marshall',
  'shane-warne',
  'glenn-mcgrath',
] as const;

let cached: NormalizedPlayer[] | null = null;

/** The fixed house XI, normalized via player-logic. Cached per build. */
export function getHouseXI(): NormalizedPlayer[] {
  if (cached) return cached;
  const byId = new Map(
    (legendsData as unknown as RawPlayer[]).map((p) => [p.id, p]),
  );
  cached = HOUSE_PLAYER_IDS.map((id) => {
    const raw = byId.get(id);
    if (!raw) {
      throw new Error(`[opponent-xi] house player missing from legends.json: ${id}`);
    }
    return normalizePlayer(raw, 'legends');
  });
  return cached;
}
