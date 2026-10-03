import { z } from "zod";

/**
 * Zod schemas for BeatMy11 player/data structures.
 * Mirrors the shape of the era JSON files in src/data/*.json.
 * Unknown extra keys are stripped (not rejected) so future data
 * enrichment doesn't break validation — required shape is enforced.
 */
export const playerStatsSchema = z.object({
  testAverage: z.number(),
  testRuns: z.number(),
  testWickets: z.number(),
  testMatches: z.number(),
  testCenturies: z.number(),
  /** Absent for bowlers added from the per-country tables, which have no fifties column (owner, 2026-10-03). */
  testFifties: z.number().optional(),
  fiveWs: z.number(),
  tenWs: z.number(),
  testBowlingAverage: z.number(),
  battingStrikeRate: z.number(),
  bowlingStrikeRate: z.number(),
  /** Absent only when dismissalsUnknown is 1 (owner, 2026-10-03; see seven-metrics.ts). */
  dismissals: z.number().optional(),
  dismissalsUnknown: z.number().optional(),
}).refine((s) => s.dismissals !== undefined || s.dismissalsUnknown === 1, { message: "dismissals missing and not flagged dismissalsUnknown" });

export const playerRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  nation: z.string().min(1),
  // Cross-era players carry an array (e.g. ["1970s","1980s"]); the game
  // normalizes with `Array.isArray(p.era) ? p.era : [p.era]`.
  era: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  primaryRole: z.string().min(1),
  // The game accepts an array or a single string (player-logic.ts:
  // "secondaryRoles may be an array or a single string").
  secondaryRoles: z.union([z.array(z.string()), z.string()]),
  stats: playerStatsSchema,
});

export type PlayerRecord = z.infer<typeof playerRecordSchema>;
