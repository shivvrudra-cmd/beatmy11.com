/**
 * Shared test helper: can a legal XI be drafted from six pools (1 pick from the first, 2 from each
 * of the rest)? Backtracking over role counts, as in tests/full-draft.test.ts.
 */
import {
  createDraft, countsOf, reachableShapes, playerGroups, XI_SHAPES, XI_ROLES,
  type NormalizedPlayer, type XiRole, type XiCounts,
} from '../src/lib/player-logic';

const ROUND_LIMITS = [1, 2, 2, 2, 2, 2];
const shapeMax: XiCounts = countsOf(createDraft());
for (const sh of XI_SHAPES) for (const r of XI_ROLES) shapeMax[r] = Math.max(shapeMax[r], sh[r]);
const shapeMatch = (c: XiCounts) => XI_SHAPES.some((sh) => XI_ROLES.every((r) => c[r] === sh[r]));

export function achievable(pools: NormalizedPlayer[][]): boolean {
  const memo = new Set<string>();
  const key = (c: XiCounts) => XI_ROLES.map((r) => c[r]).join(',');
  function dfs(round: number, idx: number, total: number, counts: XiCounts, picked: string[]): boolean {
    if (total === 11) return shapeMatch(counts);
    if (round >= 6) return false;
    if (idx >= ROUND_LIMITS[round]) return dfs(round + 1, 0, total, counts, picked);
    const k = `${round}:${idx}:${key(counts)}:${[...picked].sort().join(',')}`;
    if (memo.has(k)) return false;
    const taken = new Set(picked);
    for (const p of pools[round]) {
      if (taken.has(p.id)) continue;
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
