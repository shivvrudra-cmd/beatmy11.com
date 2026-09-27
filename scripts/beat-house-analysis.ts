/**
 * beat-house-analysis.ts — can ANY XI beat the fixed house XI (87.5)?
 *
 * Three questions, answered against real data with the real engine:
 *  A. House XI breakdown — confirm 87.5 and see who carries it.
 *  B. Ceiling per valid shape — the max-mean XI of 11 distinct players,
 *     solved exactly via min-cost max-flow over (role-slot, player)
 *     assignment using seven-metric scores for game-legal declarations.
 *  C. Realistic draft — Monte Carlo over random spin sequences with a
 *     score-greedy player using the client's exact validation path;
 *     measures completed-XI scores vs the house.
 *
 * Usage: npx tsx scripts/beat-house-analysis.ts
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
  normalizeRole,
  slotOf,
  playerGroups,
  XI_SLOTS,
  XI_SHAPES,
  XI_ROLES,
  type NormalizedPlayer,
  type DraftState,
  type XiRole,
  type XiCounts,
} from '../src/lib/player-logic';
import {
  buildScoringContext,
  scorePlayer,
  compareXIs,
  type ScoringContext,
} from '../src/lib/seven-metrics';
import { getHouseXI } from '../src/lib/opponent-xi';

// ---------------- data (same rules as tests + matchup) ----------------
const ERAS = ['legends', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];
const DATA_DIR = process.cwd() + '/src/data';
const byEra: Record<string, NormalizedPlayer[]> = {};
for (const era of ERAS) {
  const raw = JSON.parse(readFileSync(`${DATA_DIR}/${era}.json`, 'utf8'));
  byEra[era] = raw.map((p: any) => normalizePlayer(p, era));
}
// matchup.astro population: unique players, first era occurrence wins.
const players: NormalizedPlayer[] = [];
{
  const seen = new Set<string>();
  for (const era of ERAS)
    for (const p of byEra[era]) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      players.push(p);
    }
}
const ctx: ScoringContext = buildScoringContext(players);
console.log(`population: ${players.length} unique players\n`);

// Seven-metric score cache: playerId -> role -> score (null = unusable).
const scoreCache = new Map<string, Map<string, number | null>>();
function sevenScore(p: NormalizedPlayer, role: string): number | null {
  let m = scoreCache.get(p.id);
  if (!m) {
    m = new Map();
    scoreCache.set(p.id, m);
  }
  if (!m.has(role)) {
    let s: number | null = null;
    try {
      s = scorePlayer(p, role, ctx).score;
    } catch {
      s = null;
    }
    m.set(role, s);
  }
  return m.get(role) ?? null;
}

// ---------------- A. house XI ----------------
const houseXI = getHouseXI();
const houseEntries = houseXI.map((p) => ({
  player: p,
  declaredRole: normalizeRole(p.primaryRole),
}));
const houseCmp = compareXIs(houseEntries, houseEntries, ctx);
console.log('=== A. HOUSE XI ===');
console.log(`house score: ${houseCmp.opponentScore} (expected 87.5)`);
const ranked = [...houseCmp.opponentPlayers].sort(
  (a, b) => (b.score ?? 0) - (a.score ?? 0),
);
for (const ps of ranked)
  console.log(`  ${String(ps.score).padStart(5)}  ${ps.name} (${ps.role})`);
console.log('');

// ---------------- B. ceiling per shape (min-cost max-flow) ----------------
// Graph: source -> role nodes (cap = count) -> player nodes (cap 1,
// cost = -score*10 int) -> sink. 11 units of flow = optimal XI.
function ceilingXI(shape: XiCounts) {
  const roles = XI_ROLES.filter((r) => shape[r] > 0);
  const rIdx = new Map<string, number>(roles.map((r, i) => [r, i]));
  const pList = players;
  const N = 2 + roles.length + pList.length;
  const SRC = 0;
  const SNK = N - 1;
  const roleNode = (i: number) => 1 + i;
  const playerNode = (i: number) => 1 + roles.length + i;
  interface Edge {
    to: number;
    rev: number;
    cap: number;
    cost: number;
  }
  const g: Edge[][] = Array.from({ length: N }, () => []);
  const addEdge = (u: number, v: number, cap: number, cost: number) => {
    g[u].push({ to: v, rev: g[v].length, cap, cost });
    g[v].push({ to: u, rev: g[u].length - 1, cap: 0, cost: -cost });
  };
  roles.forEach((r, i) => addEdge(SRC, roleNode(i), shape[r], 0));
  pList.forEach((p, i) => addEdge(playerNode(i), SNK, 1, 0));
  pList.forEach((p, i) => {
    for (const r of playerGroups(p)) {
      const ri = rIdx.get(r);
      if (ri === undefined) continue;
      const s = sevenScore(p, r);
      if (s === null) continue;
      addEdge(roleNode(ri), playerNode(i), 1, -Math.round(s * 10));
    }
  });
  // Successive shortest augmenting path (Bellman-Ford; tiny graph).
  const INF = 1e18;
  let flow = 0;
  while (flow < 11) {
    const dist = new Array(N).fill(INF);
    const prevV = new Array(N).fill(-1);
    const prevE = new Array(N).fill(-1);
    dist[SRC] = 0;
    for (let it = 0; it < N; it++) {
      let upd = false;
      for (let v = 0; v < N; v++) {
        if (dist[v] === INF) continue;
        for (let e = 0; e < g[v].length; e++) {
          const ed = g[v][e];
          if (ed.cap > 0 && dist[ed.to] > dist[v] + ed.cost) {
            dist[ed.to] = dist[v] + ed.cost;
            prevV[ed.to] = v;
            prevE[ed.to] = e;
            upd = true;
          }
        }
      }
      if (!upd) break;
    }
    if (dist[SNK] === INF) break;
    let v = SNK;
    while (v !== SRC) {
      const pv = prevV[v];
      const pe = prevE[v];
      g[pv][pe].cap -= 1;
      g[v][g[pv][pe].rev].cap += 1;
      v = pv;
    }
    flow++;
  }
  // Assignment from the residual graph: role->player forward edges at
  // cap 0 are exactly the edges carrying flow (reassignments via reverse
  // edges are already netted out).
  const assignment = new Map<string, NormalizedPlayer[]>();
  roles.forEach((r, i) => {
    for (const ed of g[roleNode(i)]) {
      const pi = ed.to - 1 - roles.length;
      if (pi >= 0 && pi < pList.length && ed.cap === 0) {
        if (!assignment.has(r)) assignment.set(r, []);
        assignment.get(r)!.push(pList[pi]);
      }
    }
  });
  const entries = [...assignment.entries()].flatMap(([role, ps]) =>
    ps.map((p) => ({ player: p, declaredRole: role })),
  );
  const mean =
    Math.round(
      (entries.reduce((s, e) => s + (sevenScore(e.player, e.declaredRole) ?? 0), 0) /
        entries.length) *
        10,
    ) / 10;
  return { entries, mean, flow };
}

console.log('=== B. CEILING XI PER SHAPE (best 11 distinct players) ===');
const SHAPE_NAMES = ['4MO+AR', '4MO+SP', '3MO+AR+SP'];
XI_SHAPES.forEach((shape, i) => {
  const { entries, mean, flow } = ceilingXI(shape);
  console.log(`\n${SHAPE_NAMES[i]}: ceiling ${mean} (flow ${flow}/11)`);
  const order: XiRole[] = [
    'opener',
    'middle-order',
    'wicketkeeper',
    'all-rounder',
    'spinner',
    'fast-bowler',
  ];
  for (const r of order) {
    for (const e of entries.filter((x) => x.declaredRole === r)) {
      console.log(
        `  ${String(sevenScore(e.player, r)).padStart(5)}  ${e.player.name} (${r})`,
      );
    }
  }
});
console.log('');

// ---------------- C. realistic draft: score-greedy Monte Carlo ----------------
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
    for (const [nation, seen] of byNation)
      if (seen.size > 0) combos.push({ era: eraId, nation });
  }
  return combos;
}
const legendCombos = spinCombos(['legends']);
const draftCombos = spinCombos(ERAS.filter((e) => e !== 'legends'));
function poolFor(era: string, nation: string): NormalizedPlayer[] {
  const out: NormalizedPlayer[] = [];
  const seen = new Set<string>();
  for (const fileEra of ERAS)
    for (const p of byEra[fileEra]) {
      const eras = Array.isArray(p.era) ? p.era : [p.era];
      if (!eras.includes(era) || p.nation !== nation) continue;
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
    }
  return out;
}
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ROUND_LIMITS = [1, 2, 2, 2, 2, 2];

/** Score-greedy player: best seven-metric value among feasible picks,
 *  preferring roles still needed by reachable shapes as tiebreak. */
function playQualityGreedy(pools: NormalizedPlayer[][]): DraftState | null {
  let draft = createDraft();
  for (let r = 0; r < 6; r++) {
    const combo = (pools as any)[`__combo${r}`];
    draft = applySpinResult(draft, combo.era, combo.nation);
    for (let i = 0; i < ROUND_LIMITS[r]; i++) {
      const pool = pools[r];
      const supply = supplyFor(draft, pool);
      const counts = countsOf(draft);
      const shapes = reachableShapes(counts);
      const need = (role: XiRole) =>
        shapes.filter((s) => counts[role] < s[role]).length;
      let best: {
        p: NormalizedPlayer;
        slot: string;
        role: XiRole;
        q: number;
        n: number;
      } | null = null;
      for (const p of pool) {
        if (validatePoolPick(draft, p, supply) !== null) continue;
        for (const s of XI_SLOTS) {
          if (draft.slots[s.key]) continue;
          const options = placementOptions(draft, p, s.key, supply);
          for (const o of options) {
            if (o.reason) continue;
            if (validateSlotPlacement(draft, p, s.key, o.role, supply) !== null)
              continue;
            const q = sevenScore(p, o.role);
            if (q === null) continue;
            const n = need(o.role);
            if (
              !best ||
              q > best.q ||
              (q === best.q && n > best.n)
            )
              best = { p, slot: s.key, role: o.role, q, n };
          }
        }
      }
      if (!best) return null; // stalled — user would start over
      draft = applyDraftPick(draft, best.p, best.slot, best.role, supply);
    }
  }
  return draft.gameComplete && isXIValid(draft) ? draft : null;
}

const TRIALS = 200;
const scores: number[] = [];
let completed = 0;
let wins = 0;
let ties = 0;
let best = -1;
let bestNames = '';
for (let seed = 1; seed <= TRIALS; seed++) {
  const rand = mulberry32(seed);
  const combos: { era: string; nation: string }[] = [];
  combos.push(legendCombos[Math.floor(rand() * legendCombos.length)]);
  // Draw without replacement — matches the live game's no-repeat-combo rule.
  const remaining = [...draftCombos];
  for (let r = 1; r < 6; r++) {
    const idx = Math.floor(rand() * remaining.length);
    combos.push(remaining.splice(idx, 1)[0]);
  }
  const pools: NormalizedPlayer[][] = combos.map((c) => poolFor(c.era, c.nation));
  combos.forEach((c, r) => ((pools as any)[`__combo${r}`] = c));
  const draft = playQualityGreedy(pools);
  if (!draft) continue;
  completed++;
  const entries = draft.selectedPlayers.map((sp) => {
    const slotKey = slotOf(draft, sp.uid);
    const role = (slotKey && draft.slots[slotKey]?.role) || sp.primaryRole;
    return { player: sp, declaredRole: normalizeRole(role) };
  });
  const cmp = compareXIs(entries, houseEntries, ctx);
  scores.push(cmp.userScore);
  if (cmp.result === 'user') wins++;
  else if (cmp.result === 'tie') ties++;
  if (cmp.userScore > best) {
    best = cmp.userScore;
    bestNames = entries
      .map((e) => `${e.player.name} (${e.declaredRole})`)
      .join(', ');
  }
}
scores.sort((a, b) => a - b);
const pct = (p: number) => scores[Math.min(scores.length - 1, Math.floor((p / 100) * scores.length))];
console.log('=== C. REALISTIC DRAFT (score-greedy, 200 random spin sequences) ===');
console.log(`completed XIs: ${completed}/${TRIALS} (rest stalled — user starts over)`);
console.log(`wins vs house: ${wins}, ties: ${ties}, losses: ${completed - wins - ties}`);
console.log(`win rate of completed drafts: ${((wins / Math.max(1, completed)) * 100).toFixed(1)}%`);
if (scores.length) {
  console.log(
    `draft XI scores — p10 ${pct(10)}, median ${pct(50)}, p90 ${pct(90)}, best ${best}`,
  );
  console.log(`best draft XI (${best}): ${bestNames}`);
  console.log('\nwin rate at candidate house scores (same 200 drafts):');
  for (const h of [80, 81, 82, 83, 84, 85, 86, 87, 87.5]) {
    const w = scores.filter((s) => s > h).length;
    const t = scores.filter((s) => Math.abs(s - h) < 1e-9).length;
    console.log(
      `  house ${h}: ${w} wins / ${t} ties of ${completed} = ${(100 * w / completed).toFixed(1)}% wins`,
    );
  }
}
