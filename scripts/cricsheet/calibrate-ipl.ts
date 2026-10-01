/**
 * calibrate-ipl.ts — writes src/data/formats/ipl-series.json:
 *
 *   allStarXI     the opponent for the IPL series: the XI the owner approved on 2026-10-01
 *                 (owner-allstar-ipl.json), with its team score under the current engine.
 *   calibration   team scores of simulated human-like drafts, for the "top X% of drafts" line.
 *
 * It also prints how often those drafts would win the series under the current ladder
 * (reused from the Test game, PROVISIONAL), so the owner can decide the IPL difficulty.
 *
 * The drafter never sees ratings: only the numbers on the cards, misjudged by a random amount,
 * and it plays the real draft rules (no respin use: simpler, slightly pessimistic).
 *
 * Run: npx esbuild scripts/cricsheet/calibrate-ipl.ts --bundle --platform=node --format=cjs \
 *        --outfile=.test-dist/calibrate-ipl.cjs --log-level=error && node .test-dist/calibrate-ipl.cjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import {
  createDraft, applySpinResult, applyDraftPick, validatePoolPick, placementOptions, countsOf,
  reachableShapes, isXIValid, supplyFor, slotOf, XI_SLOTS,
  type NormalizedPlayer, type DraftState, type XiRole,
} from '../../src/lib/player-logic';
import { iplPlayers, iplPlayersByBlock, iplSpinCombos } from '../../src/lib/formats/ipl-store';
import { WB_FORMATS, buildWbContext, scoreWbPlayer, wbTeamBlend, type WbEntry } from '../../src/lib/white-ball-metrics';
import { upcomingCombos } from '../../src/lib/daily';
import { mulberry32, OUTCOME_BANDS, bandFor, wobble, PAR_GAP } from '../../src/lib/series';

const FMT = WB_FORMATS.ipl;
const players = iplPlayers();
const byBlock = iplPlayersByBlock();
const combos = iplSpinCombos();
const ctx = buildWbContext(players, FMT);
const poolFor = (era: string, nation: string) => byBlock[era].filter((p) => p.nation === nation);

// ---------------------------------------------------------------- All-Star XI (owner-approved, fixed)
// The opponent is the XI the owner approved (scripts/cricsheet/owner-allstar-ipl.json), scored in
// the roles they approved. It is never recomputed from ratings, so changing a weight changes the
// XI's score but not who is in it.
const rated = players.map((p) => ({ p, s: scoreWbPlayer(p, null, ctx, FMT) }));
const approved: { name: string; role: string }[] = JSON.parse(readFileSync('scripts/cricsheet/owner-allstar-ipl.json', 'utf8')).xi;
if (approved.length !== 11) throw new Error('owner-allstar-ipl.json must list exactly 11 players');
const xiPlayers = approved.map((a) => {
  const hits = players.filter((p) => p.name === a.name);
  if (hits.length !== 1) throw new Error(`All-Star XI: "${a.name}" matches ${hits.length} IPL players; fix owner-allstar-ipl.json`);
  return { p: hits[0], role: a.role, s: scoreWbPlayer(hits[0], a.role, ctx, FMT) };
});
const best = {
  xi: xiPlayers,
  score: wbTeamBlend(xiPlayers.map((x) => ({ player: x.p, declaredRole: x.role })), ctx, FMT).score,
};
console.log(`All-Star XI (owner-approved; team score ${best.score}):`);
for (const x of best.xi) console.log(`  ${x.s.role.padEnd(13)} ${x.p.name.padEnd(24)} ${x.s.score}  (${x.p.stats.matches} matches)`);
// For information only: what the engine itself would pick today.
const top = (role: string, n: number) => rated.filter((x) => x.s.role === role).sort((a, b) => b.s.score - a.s.score).slice(0, n);
console.log('engine top-rated now: ' + ['opener', 'middle-order', 'wicketkeeper', 'all-rounder', 'spinner', 'fast-bowler']
  .map((r) => `${r}: ${top(r, 3).map((x) => x.p.name).join(', ')}`).join(' | '));

// ---------------------------------------------------------------- human-like drafter
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) && v != null ? Number(v) : d);
function visibleBat(p: NormalizedPlayer): number {
  const s = p.stats;
  return clamp01((num(s.battingAverage, 0) - 15) / 30) * 0.5 + clamp01((num(s.strikeRate, 0) - 110) / 50) * 0.3 + clamp01(num(s.matches, 0) / 150) * 0.2;
}
function visibleBowl(p: NormalizedPlayer): number {
  const s = p.stats;
  return clamp01((10 - num(s.economy, 12)) / 3.5) * 0.5 + clamp01((40 - num(s.bowlingAverage, 60)) / 20) * 0.3 + clamp01(num(s.wickets, 0) / 150) * 0.2;
}
function visibleValue(p: NormalizedPlayer, role: XiRole): number {
  if (role === 'fast-bowler' || role === 'spinner') return visibleBowl(p);
  if (role === 'all-rounder') { const b = visibleBat(p), w = visibleBowl(p); return Math.max(b, w) + 0.5 * Math.min(b, w); }
  return visibleBat(p);
}
const MISJUDGE = Number(process.env.MISJUDGE ?? 0.12);
const gaussian = (rng: () => number) => Math.sqrt(-2 * Math.log(Math.max(rng(), 1e-12))) * Math.cos(2 * Math.PI * rng());

function draftOnce(seed: number): DraftState | null {
  const rng = mulberry32(seed);
  const noise = new Map<string, number>();
  for (const p of players) noise.set(p.id, gaussian(rng) * MISJUDGE);
  let draft = createDraft();
  for (let r = 0; r < 6; r++) {
    const options = upcomingCombos(r, draft.spinHistory, combos, combos);
    const c = options[Math.floor(rng() * options.length)];
    draft = applySpinResult(draft, c.era, c.nation);
    const pool = poolFor(c.era, c.nation);
    for (let i = 0; i < (r === 0 ? 1 : 2); i++) {
      const supply = supplyFor(draft, pool);
      const counts = countsOf(draft);
      const shapes = reachableShapes(counts);
      let pick: { p: NormalizedPlayer; slot: string; role: XiRole; v: number } | null = null;
      for (const p of pool) {
        if (validatePoolPick(draft, p, supply) !== null) continue;
        for (const s of XI_SLOTS) {
          if (draft.slots[s.key]) continue;
          for (const o of placementOptions(draft, p, s.key, supply)) {
            if (o.reason) continue;
            const needed = shapes.some((sh) => counts[o.role] < sh[o.role]) ? 0.05 : 0;
            const v = visibleValue(p, o.role) + (noise.get(p.id) ?? 0) + needed;
            if (!pick || v > pick.v) pick = { p, slot: s.key, role: o.role, v };
          }
        }
      }
      if (!pick) return null;
      draft = applyDraftPick(draft, pick.p, pick.slot, pick.role, supply);
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
  const xi: WbEntry[] = d.selectedPlayers.map((p) => {
    const key = slotOf(d, p.uid);
    return { player: p, declaredRole: (key && d.slots[key]?.role) || p.primaryRole };
  });
  scores.push(wbTeamBlend(xi, ctx, FMT).score);
}
scores.sort((a, b) => a - b);
const q = (p: number) => scores[Math.min(scores.length - 1, Math.floor(p * scores.length))];
console.log(`\nhuman-like IPL drafts: ${scores.length} complete, ${stalled} stalled`);
console.log(`team scores: p10 ${q(0.1)}, median ${q(0.5)}, p90 ${q(0.9)}, best ${scores[scores.length - 1]}; All-Star XI ${best.score}`);
const tally = new Map<string, number>();
for (let i = 0; i < scores.length; i++) {
  const band = bandFor(wobble(scores[i] - best.score, mulberry32(i + 1)));
  const k = `${band.user}-${band.house}`;
  tally.set(k, (tally.get(k) ?? 0) + 1);
}
let wins = 0;
console.log(`scorelines under the Test ladder (PAR_GAP ${PAR_GAP}, PROVISIONAL for IPL):`);
for (const b of OUTCOME_BANDS) {
  const k = `${b.user}-${b.house}`;
  const share = (tally.get(k) ?? 0) / scores.length;
  if (b.user > b.house) wins += share;
  console.log(`  ${k}  ${(share * 100).toFixed(1)}%`);
}
console.log(`series wins: ${(wins * 100).toFixed(1)}% of simulated drafts`);

writeFileSync(
  'src/data/formats/ipl-series.json',
  JSON.stringify({
    note: 'All-Star XI approved by the owner (scripts/cricsheet/owner-allstar-ipl.json); calibration is a simulated sample.',
    generated: new Date().toISOString().slice(0, 10),
    allStarXI: best.xi.map((x) => ({ id: x.p.id, name: x.p.name, role: x.s.role })),
    allStarScore: best.score,
    calibration: {
      source: `human-like simulated IPL drafter v1 (card stats only, misjudge sd ${MISJUDGE}, no respins); ${scores.length} drafts`,
      generated: new Date().toISOString().slice(0, 10),
      scores,
    },
  }) + '\n',
);
console.log('wrote src/data/formats/ipl-series.json');
