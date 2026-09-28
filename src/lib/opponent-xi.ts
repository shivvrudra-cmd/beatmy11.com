/**
 * opponent-xi.ts — the fixed house XI ("My XI").
 *
 * The opponent is isolated in this one module so that replacing it later
 * (a different fixed XI, a seeded random XI, …) is a single-file change:
 * update HOUSE_PLAYER_IDS here and every consumer follows.
 *
 * Build-time only: it imports the era data files, so it must NOT be imported
 * from client `<script>` bundles. matchup.astro's frontmatter normalizes the
 * XI here and embeds it as JSON for its client verdict script.
 *
 * The XI is fully deterministic — there is no randomness anywhere in the
 * opponent path. Declared roles come from each player's primaryRole, which
 * the matchup page uses directly as the scoring role.
 */

import { normalizePlayer } from './player-logic';
import { playersForEra, ERA_IDS } from './player-store';
import type { NormalizedPlayer, RawPlayer } from './player-logic';

/**
 * Raw ids of the fixed house XI, in batting order. Every id is verified
 * present in the era data; getHouseXI() throws at build time if one goes
 * missing. Blend 81.6 under the 40/50/10 team score — hard but fair:
 * ~24% user win rate with one nation-respin and one era-respin in play
 * (forced-redraw semantics). 8 represented nations.
 */
export const HOUSE_PLAYER_IDS = [
  'don-bradman', // opener (AUS)
  'sunil-gavaskar', // opener (IND)
  'sachin-tendulkar', // middle-order (IND)
  'brian-lara', // middle-order (WIN)
  'joe-root', // middle-order (ENG)
  'adam-gilchrist', // wicketkeeper (AUS)
  'richard-hadlee', // all-rounder (NZL)
  'muttiah-muralitharan', // spinner (SRI)
  'joel-garner', // fast-bowler (WIN)
  'wasim-akram', // fast-bowler (PAK)
  'dale-steyn', // fast-bowler (RSA)
] as const;

let cached: NormalizedPlayer[] | null = null;

/** The fixed house XI, normalized via player-logic. Cached per build. */
export function getHouseXI(): NormalizedPlayer[] {
  if (cached) return cached;
  const byId = new Map<string, { raw: RawPlayer; era: (typeof ERA_IDS)[number] }>();
  for (const era of ERA_IDS) {
    for (const raw of playersForEra(era) as RawPlayer[]) {
      if (!byId.has(raw.id)) byId.set(raw.id, { raw, era });
    }
  }
  cached = HOUSE_PLAYER_IDS.map((id) => {
    const hit = byId.get(id);
    if (!hit) {
      throw new Error(`[opponent-xi] house player missing from era data: ${id}`);
    }
    return normalizePlayer(hit.raw, hit.era);
  });
  return cached;
}
