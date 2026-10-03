/**
 * Shared test helper: can a legal XI be drafted from six pools (1 pick from the first, 2 from each
 * of the rest)? Backtracking over role counts, as in tests/full-draft.test.ts.
 */
import {
  createDraft, countsOf, reachableShapes, playerGroups, XI_SHAPES, XI_ROLES, MAX_OVERSEAS,
  type NormalizedPlayer, type XiRole, type XiCounts,
} from '../src/lib/player-logic';

const ROUND_LIMITS = [1, 2, 2, 2, 2, 2];
const shapeMax: XiCounts = countsOf(createDraft());
for (const sh of XI_SHAPES) for (const r of XI_ROLES) shapeMax[r] = Math.max(shapeMax[r], sh[r]);
const shapeMatch = (c: XiCounts) => XI_SHAPES.some((sh) => XI_ROLES.every((r) => c[r] === sh[r]));

export function achievable(pools: NormalizedPlayer[][]): boolean {
  const memo = new Set<string>();
  const key = (c: XiCounts) => XI_ROLES.map((r) => c[r]).join(',');
  const overseasIds = new Set(pools.flat().filter((p) => p.overseas).map((p) => p.id));
  // A pick only matters later if the same player is offered in another pool, or counts toward the
  // overseas cap, so only those picks go into the memo key (keeps the memo small as pools grow).
  const occurrences = new Map<string, number>();
  for (const pool of pools) for (const p of pool) occurrences.set(p.id, (occurrences.get(p.id) ?? 0) + 1);
  const relevant = (id: string) => (occurrences.get(id) ?? 0) > 1 || overseasIds.has(id);
  function dfs(round: number, idx: number, total: number, counts: XiCounts, picked: string[]): boolean {
    if (total === 11) return shapeMatch(counts);
    if (round >= 6) return false;
    if (idx >= ROUND_LIMITS[round]) return dfs(round + 1, 0, total, counts, picked);
    const k = `${round}:${idx}:${key(counts)}:${picked.filter(relevant).sort().join(',')}`;
    if (memo.has(k)) return false;
    const taken = new Set(picked);
    const overseasFull = picked.filter((x) => overseasIds.has(x)).length >= MAX_OVERSEAS;
    for (const p of pools[round]) {
      if (taken.has(p.id)) continue;
      if (p.overseas && overseasFull) continue;
      for (const role of playerGroups(p) as XiRole[]) {
        if (counts[role] + 1 > shapeMax[role]) continue;
        const c2 = { ...counts, [role]: counts[role] + 1 };
        if (reachableShapes(c2).length === 0) continue;
        if (dfs(round, idx + 1, total + 1, c2, [...picked, p.id])) return true;
      }
    }
    memo.add(k);
    return false;
  }
  return dfs(0, 0, 0, countsOf(createDraft()), []);
}
