/**
 * Full-draft integration sim against REAL data + REAL spin combos.
 *
 * For each seeded trial: pre-draw all 6 combos, then
 *  1. ORACLE: backtracking search (role-count abstraction — any shape-matching
 *     role vector is slot-assignable) decides whether a valid XI is
 *     achievable at all from this combo sequence.
 *  2. GREEDY: a competent-human player — every pick must pass the client's
 *     exact validation path (validatePoolPick → placementOptions →
 *     validateSlotPlacement, all with supply), preferring roles still needed
 *     by the most reachable shapes.
 *
 * Expectations:
 *  - achievable trials: greedy ALWAYS completes a valid XI (else the hard
 *    block is over-strict or a real dead-end exists → investigate);
 *  - unachievable trials: greedy must stall with every remaining pick
 *    blocked (the client's "start over" path), never produce an invalid XI;
 *  - no completed draft is ever invalid (isXIValid).
 */
import { readFileSync } from 'node:fs';
import {
  createDraft,
  applySpinResult,
  applyDraftPick,
  validatePoolPick,
  validateSlotPlacement,
  placementOptions,
  countsOf,
  reachableShapes,
  isXIValid,
  supplyFor,
  normalizePlayer,
  playerGroups,
  XI_SLOTS,
  XI_SHAPES,
  XI_ROLES,
  type NormalizedPlayer,
  type DraftState,
  type XiRole,
  type XiCounts,
} from '../src/lib/player-logic';

let pass = 0, fail = 0;
const ok = (cond: boolean, name: string, extra?: unknown) => {
  if (cond) { pass++; }
  else { fail++; console.log(`FAIL: ${name}`, extra ?? ''); }
};

// ---------------- real data + combos (same rules as player-store) ----------------
const ERAS = ['legends', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];
const DATA_DIR = process.cwd() + '/src/data';
const byEra: Record<string, NormalizedPlayer[]> = {};
for (const era of ERAS) {
  const raw = JSON.parse(readFileSync(`${DATA_DIR}/${era}.json`, 'utf8'));
  byEra[era] = raw.map((p: any) => normalizePlayer(p, era));
}
function spinCombos(eras: string[]) {
  const combos: { era: string; nation: string }[] = [];
  for (const eraId of eras) {
    const byNation = new Map<string, Set<string>>();
    for (const p of byEra[eraId]) {
      const erasOf = Array.isArray(p.era) ? p.era : [p.era];
      if (!erasOf.includes(eraId)) continue;
      if (!byNation.has(p.nation)) byNation.set(p.nation, new Set());
      byNation.get(p.nation)!.add(p.id);
    }
    for (const [nation, seen] of byNation) {
      if (seen.size > 0) combos.push({ era: eraId, nation });
    }
  }
  return combos;
}
const legendCombos = spinCombos(['legends']);
const draftCombos = spinCombos(ERAS.filter((e) => e !== 'legends'));

function poolFor(era: string, nation: string): NormalizedPlayer[] {
  const out: NormalizedPlayer[] = [];
  const seen = new Set<string>();
  for (const fileEra of ERAS) {
    for (const p of byEra[fileEra]) {
      const eras = Array.isArray(p.era) ? p.era : [p.era];
      if (!eras.includes(era) || p.nation !== nation) continue;
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
    }
  }
  return out;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROUND_LIMITS = [1, 2, 2, 2, 2, 2];
const shapeMax: XiCounts = countsOf(createDraft());
for (const s of XI_SHAPES) for (const r of XI_ROLES) shapeMax[r] = Math.max(shapeMax[r], s[r]);

// ---------------- oracle: is a valid XI achievable? ----------------
function shapeMatch(counts: XiCounts): boolean {
  return XI_SHAPES.some((s) => XI_ROLES.every((r) => counts[r] === s[r]));
}

function oracleAchievable(pools: NormalizedPlayer[][]): boolean {
  const memo = new Set<string>();
  const countsKey = (c: XiCounts) => XI_ROLES.map((r) => c[r]).join(',');
  function dfs(
    round: number, idx: number, total: number,
    counts: XiCounts, picked: string[],
  ): boolean {
    if (total === 11) return shapeMatch(counts);
    if (round >= 6) return false;
    if (idx >= ROUND_LIMITS[round]) return dfs(round + 1, 0, total, counts, picked);
    const key = `${round}:${idx}:${countsKey(counts)}:${[...picked].sort().join(',')}`;
    if (memo.has(key)) return false;
    const pickedSet = new Set(picked);
    // Try deficit-filling roles first (massive prune).
    const shapes = reachableShapes(counts);
    const need = (r: XiRole) => shapes.filter((s) => counts[r] < s[r]).length;
    const moves: { p: NormalizedPlayer; role: XiRole; score: number }[] = [];
    for (const p of pools[round]) {
      if (pickedSet.has(p.id)) continue;
      for (const role of playerGroups(p)) {
        if (counts[role] + 1 > shapeMax[role]) continue;
        const c2 = { ...counts, [role]: counts[role] + 1 };
        if (reachableShapes(c2).length === 0) continue;
        moves.push({ p, role, score: need(role) });
      }
    }
    moves.sort((a, b) => b.score - a.score);
    for (const m of moves) {
      const c2 = { ...counts, [m.role]: counts[m.role] + 1 };
      if (dfs(round, idx + 1, total + 1, c2, [...picked, m.p.id])) return true;
    }
    memo.add(key);
    return false;
  }
  return dfs(0, 0, 0, countsOf(createDraft()), []);
}

// ---------------- greedy competent-human play ----------------
interface GreedyResult {
  ok: boolean;
  stalled: boolean;
  draft: DraftState;
  multiRoleDecisions: number;
  shapeIdx: number;
}

function playGreedy(pools: NormalizedPlayer[][]): GreedyResult {
  let draft = createDraft();
  let multiRoleDecisions = 0;
  for (let r = 0; r < 6; r++) {
    const combo = comboOf(pools, r);
    draft = applySpinResult(draft, combo.era, combo.nation);
    for (let i = 0; i < ROUND_LIMITS[r]; i++) {
      const pool = pools[r];
      const supply = supplyFor(draft, pool);
      const counts = countsOf(draft);
      const shapes = reachableShapes(counts);
      const need = (role: XiRole) => shapes.filter((s) => counts[role] < s[role]).length;
      let best: { p: NormalizedPlayer; slot: string; role: XiRole; score: number } | null = null;
      for (const p of pool) {
        if (validatePoolPick(draft, p, supply) !== null) continue;
        for (const s of XI_SLOTS) {
          if (draft.slots[s.key]) continue;
          const options = placementOptions(draft, p, s.key, supply);
          const legal = options.filter((o) => !o.reason);
          if (!legal.length) continue;
          for (const o of legal) {
            if (validateSlotPlacement(draft, p, s.key, o.role, supply) !== null) continue;
            const score = need(o.role);
            if (!best || score > best.score) best = { p, slot: s.key, role: o.role, score };
          }
        }
      }
      if (!best) {
        return { ok: false, stalled: true, draft, multiRoleDecisions, shapeIdx: -1 };
      }
      const legalCount = placementOptions(draft, best.p, best.slot, supply).filter(
        (o) => !o.reason,
      ).length;
      if (legalCount > 1) multiRoleDecisions++;
      const before = draft.selectedPlayers.length;
      draft = applyDraftPick(draft, best.p, best.slot, best.role, supply);
      if (draft.selectedPlayers.length !== before + 1) {
        return { ok: false, stalled: false, draft, multiRoleDecisions, shapeIdx: -1 };
      }
    }
  }
  const valid = draft.gameComplete && isXIValid(draft);
  const c = countsOf(draft);
  const shapeIdx = !valid
    ? -1
    : c['middle-order'] === 4 && c['all-rounder'] === 1 && c.spinner === 0 ? 0
    : c['middle-order'] === 4 && c['all-rounder'] === 0 && c.spinner === 1 ? 1
    : 2;
  return { ok: valid, stalled: false, draft, multiRoleDecisions, shapeIdx };
}

// pools carry their combo; helper to keep the pairing obvious
function comboOf(pools: NormalizedPlayer[][], r: number): { era: string; nation: string } {
  return (pools as any)[`__combo${r}`];
}

// ---------------- run trials ----------------
const TRIALS = 120;
let achievableCount = 0;
let greedyWinsOnAchievable = 0;
let greedyStalledOnUnachievable = 0;
let invalidCompleted = 0;
let multiRoleTotal = 0;
const shapeHits = [0, 0, 0];
const failures: string[] = [];

for (let seed = 1; seed <= TRIALS; seed++) {
  const rand = mulberry32(seed);
  const combos: { era: string; nation: string }[] = [];
  combos.push(legendCombos[Math.floor(rand() * legendCombos.length)]);
  for (let r = 1; r < 6; r++) combos.push(draftCombos[Math.floor(rand() * draftCombos.length)]);
  const pools: NormalizedPlayer[][] = combos.map((c) => poolFor(c.era, c.nation));
  combos.forEach((c, r) => ((pools as any)[`__combo${r}`] = c));

  const t0 = Date.now();
  const achievable = oracleAchievable(pools);
  const oracleMs = Date.now() - t0;
  const g = playGreedy(pools);
  multiRoleTotal += g.multiRoleDecisions;

  if (achievable) {
    achievableCount++;
    if (g.ok) {
      greedyWinsOnAchievable++;
      shapeHits[g.shapeIdx]++;
    } else {
      failures.push(
        `seed ${seed}: achievable but greedy ${g.stalled ? 'stalled' : 'failed'} (oracle ${oracleMs}ms) combos=${combos.map((c) => `${c.era}/${c.nation}`).join(' | ')}`,
      );
    }
  } else {
    if (g.stalled && !g.ok) greedyStalledOnUnachievable++;
    else if (g.ok) failures.push(`seed ${seed}: oracle said unachievable but greedy completed?!`);
    else invalidCompleted++;
  }
  if (g.ok && !isXIValid(g.draft)) invalidCompleted++;
}

console.log(`trials: ${TRIALS}`);
console.log(`oracle-achievable: ${achievableCount}, greedy completed valid: ${greedyWinsOnAchievable}`);
console.log(`oracle-unachievable: ${TRIALS - achievableCount}, greedy correctly stalled: ${greedyStalledOnUnachievable}`);
console.log(`shape coverage on wins: 4MO+AR=${shapeHits[0]} 4MO+SP=${shapeHits[1]} 3MO+AR+SP=${shapeHits[2]}`);
console.log(`multi-role placements (role chips) ${multiRoleTotal} times`);
ok(failures.length === 0, 'no achievable draft defeats greedy; no oracle mismatch', failures.slice(0, 5));
ok(invalidCompleted === 0, 'no invalid XI ever completed');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
