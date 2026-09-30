/**
 * calibrate-series.ts — writes src/data/series-calibration.json, the sample
 * of drafted-XI team scores that src/lib/series.ts ranks a user's XI
 * against.
 *
 * The sample comes from a HUMAN-LIKE simulated drafter (owner-approved
 * 2026-09-29): it never sees ratings — only the stats printed on the cards
 * (batting average, runs, Tests, wickets, bowling average) — and misjudges
 * each player by a random amount. It uses the game's era and nation
 * respins when a draw looks weak, and plays the real draft rules from
 * player-logic. Replace this sample with real completed-draft scores once
 * the game is live.
 *
 * Usage: npx tsx scripts/calibrate-series.ts   (TRIALS=n to change size)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import {
  createDraft,
  applySpinResult,
  applyDraftPick,
  applyNationRespin,
  applyEraRespin,
  canRespinNation,
  canRespinEra,
  validatePoolPick,
  placementOptions,
  countsOf,
  reachableShapes,
  isXIValid,
  supplyFor,
  normalizePlayer,
  normalizeRole,
  slotOf,
  XI_SLOTS,
  NATIONS,
  type NormalizedPlayer,
  type DraftState,
  type XiRole,
} from '../src/lib/player-logic';
import { buildScoringContext, teamBlend } from '../src/lib/seven-metrics';
import { mulberry32, OUTCOME_BANDS, bandFor, wobble } from '../src/lib/series';
import { getHouseXI } from '../src/lib/opponent-xi';

const ERAS = ['legends', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];
const byEra: Record<string, NormalizedPlayer[]> = {};
for (const era of ERAS) {
  byEra[era] = JSON.parse(readFileSync(`src/data/${era}.json`, 'utf8')).map((p: any) => normalizePlayer(p, era));
}
const unique: NormalizedPlayer[] = [];
{
  const seen = new Set<string>();
  for (const era of ERAS) for (const p of byEra[era]) if (!seen.has(p.id)) { seen.add(p.id); unique.push(p); }
}
const ctx = buildScoringContext(unique);

function combos(eras: string[]) {
  const out: { era: string; nation: string }[] = [];
  for (const era of eras) for (const nation of NATIONS) if (poolFor(era, nation).length) out.push({ era, nation });
  return out;
}
function poolFor(era: string, nation: string): NormalizedPlayer[] {
  const out: NormalizedPlayer[] = [];
  const seen = new Set<string>();
  for (const f of ERAS) for (const p of byEra[f]) {
    const eras = Array.isArray(p.era) ? p.era : [p.era];
    if (!eras.includes(era) || p.nation !== nation || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}
const LEGEND_COMBOS = combos(['legends']);
const DRAFT_COMBOS = combos(ERAS.filter((e) => e !== 'legends'));

// ---- what a fan can see on the card: a rough 0–1 "looks good" value ----
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
function visibleBat(p: NormalizedPlayer): number {
  const s = p.stats;
  const avg = Number(s.testAverage) || 0;
  const tests = Number(s.testMatches) || 0;
  return clamp01((avg - 20) / 40) * 0.8 + clamp01(tests / 120) * 0.2;
}
function visibleBowl(p: NormalizedPlayer): number {
  const s = p.stats;
  const avg = Number(s.testBowlingAverage ?? s.bowlingAverage) || 60;
  const wkts = Number(s.testWickets) || 0;
  return clamp01((45 - avg) / 25) * 0.7 + clamp01(wkts / 450) * 0.3;
}
function visibleValue(p: NormalizedPlayer, role: XiRole): number {
  if (role === 'fast-bowler' || role === 'spinner') return visibleBowl(p);
  if (role === 'all-rounder') {
    const b = visibleBat(p), w = visibleBowl(p);
    return Math.max(b, w) + 0.5 * Math.min(b, w);
  }
  return visibleBat(p);
}

/** Misjudgment: a fan's read of a player is off by this much (sd, 0–1 scale). */
const MISJUDGE = Number(process.env.MISJUDGE ?? 0.12);
const RESPIN_BELOW = 0.45;

type Pick = { p: NormalizedPlayer; slot: string; role: XiRole; v: number };
function bestPick(draft: DraftState, pool: NormalizedPlayer[], noise: Map<string, number>): Pick | null {
  const supply = supplyFor(draft, pool);
  const counts = countsOf(draft);
  const shapes = reachableShapes(counts);
  let best: Pick | null = null;
  for (const p of pool) {
    if (validatePoolPick(draft, p, supply) !== null) continue;
    for (const s of XI_SLOTS) {
      if (draft.slots[s.key]) continue;
      for (const o of placementOptions(draft, p, s.key, supply)) {
        if (o.reason) continue;
        const needed = shapes.some((sh) => counts[o.role] < sh[o.role]) ? 0.05 : 0;
        const v = visibleValue(p, o.role) + (noise.get(p.id) ?? 0) + needed;
        if (!best || v > best.v) best = { p, slot: s.key, role: o.role, v };
      }
    }
  }
  return best;
}

function gaussian(rng: () => number) {
  return Math.sqrt(-2 * Math.log(Math.max(rng(), 1e-12))) * Math.cos(2 * Math.PI * rng());
}

function draftOnce(seed: number): DraftState | null {
  const rng = mulberry32(seed);
  const noise = new Map<string, number>();
  for (const p of unique) noise.set(p.id, gaussian(rng) * MISJUDGE);
  let draft = createDraft();
  const used = new Set<string>();
  const key = (c: { era: string; nation: string }) => `${c.era}|${c.nation}`;
  const nationCount = () => {
    const n: Record<string, number> = {};
    for (const s of draft.spinHistory) n[s.nation] = (n[s.nation] || 0) + 1;
    return n;
  };
  const pickFrom = <T,>(xs: T[]) => xs[Math.floor(rng() * xs.length)];
  for (let r = 0; r < 6; r++) {
    const src = r === 0 ? LEGEND_COMBOS : DRAFT_COMBOS;
    const nc = nationCount();
    const opts = src.filter((c) => !used.has(key(c)) && (nc[c.nation] || 0) < 2);
    const c = pickFrom(opts.length ? opts : src.filter((x) => !used.has(key(x))));
    used.add(key(c));
    draft = applySpinResult(draft, c.era, c.nation);
    let pool = poolFor(draft.currentEra!, draft.currentNation!);
    for (;;) {
      const b = bestPick(draft, pool, noise);
      if (b && b.v >= RESPIN_BELOW) break;
      const nc2 = nationCount();
      const natOpts = src.filter((x) => x.era === draft.currentEra && !used.has(key(x)) && (nc2[x.nation] || 0) < 2);
      const eraOpts = DRAFT_COMBOS.filter((x) => x.nation === draft.currentNation && !used.has(key(x)));
      if (canRespinNation(draft, natOpts.length)) {
        const x = pickFrom(natOpts); used.add(key(x)); draft = applyNationRespin(draft, x.nation);
      } else if (canRespinEra(draft, eraOpts.length)) {
        const x = pickFrom(eraOpts); used.add(key(x)); draft = applyEraRespin(draft, x.era);
      } else break;
      pool = poolFor(draft.currentEra!, draft.currentNation!);
    }
    const picks = r === 0 ? 1 : 2;
    for (let i = 0; i < picks; i++) {
      const b = bestPick(draft, pool, noise);
      if (!b) return null; // stalled — a real player would start over
      draft = applyDraftPick(draft, b.p, b.slot, b.role, supplyFor(draft, pool));
    }
  }
  return draft.gameComplete && isXIValid(draft) ? draft : null;
}

const TRIALS = Number(process.env.TRIALS ?? 600);
const scores: number[] = [];
let stalled = 0;
for (let seed = 1; seed <= TRIALS; seed++) {
  const d = draftOnce(seed * 7919);
  if (!d) { stalled++; continue; }
  const xi = d.selectedPlayers.map((p) => {
    const key = slotOf(d, p.uid);
    return { player: p, declaredRole: normalizeRole((key && d.slots[key]?.role) || p.primaryRole) };
  });
  scores.push(teamBlend(xi, ctx).score);
}
scores.sort((a, b) => a - b);
const q = (p: number) => scores[Math.min(scores.length - 1, Math.floor(p * scores.length))];
console.log(`human-like drafts: ${scores.length} complete, ${stalled} stalled`);
console.log(`team scores — p10 ${q(0.1)}, p25 ${q(0.25)}, median ${q(0.5)}, p75 ${q(0.75)}, p90 ${q(0.9)}, best ${scores[scores.length - 1]}`);

// Self-check: the scorelines these drafts get against the World XI (score gap +
// seeded wobble), next to the original owner targets.
const houseScore = teamBlend(getHouseXI().map((p) => ({ player: p, declaredRole: normalizeRole(p.primaryRole) })), ctx).score;
console.log(`World XI team score: ${houseScore}; drafts at or above it: ${((100 * scores.filter((s) => s >= houseScore).length) / scores.length).toFixed(1)}%`);
const tally = new Map<string, number>();
for (let i = 0; i < scores.length; i++) {
  const band = bandFor(wobble(scores[i] - houseScore, mulberry32(i + 1)));
  const k = `${band.user}-${band.house}`;
  tally.set(k, (tally.get(k) ?? 0) + 1);
}
let winShare = 0;
for (const b of OUTCOME_BANDS) {
  const k = `${b.user}-${b.house}`;
  if (b.user > b.house) winShare += (tally.get(k) ?? 0) / scores.length;
  console.log(`  ${k.padEnd(4)} target ${(b.share * 100).toFixed(0).padStart(2)}%  sample ${((100 * (tally.get(k) ?? 0)) / scores.length).toFixed(1)}%`);
}

writeFileSync(
  'src/data/series-calibration.json',
  JSON.stringify(
    {
      source: `human-like simulated drafter v1 (visible stats only, misjudge sd ${MISJUDGE}, respins below ${RESPIN_BELOW}); ${scores.length} drafts`,
      generated: new Date().toISOString().slice(0, 10),
      scores,
    },
    null,
    0,
  ) + '\n',
);
console.log(`series wins: ${(winShare * 100).toFixed(1)}% of drafts`);
console.log('wrote src/data/series-calibration.json');
