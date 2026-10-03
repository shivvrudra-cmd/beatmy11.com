/**
 * calibrate-white-ball.ts — writes src/data/formats/{odi,t20i,ipl}-series.json:
 *
 *   opponentXI    the fixed opponent for the format's series. If the owner has approved one
 *                 (scripts/cricsheet/owner-allstar-<format>.json) it is used as is and never
 *                 recomputed. Otherwise a CANDIDATE: the highest-scoring legal XI the engine can
 *                 field from primary roles, for the owner to approve or change.
 *   calibration   team scores of simulated human-like drafts, for the "top X% of drafts" line.
 *
 * It also prints how often those drafts would win the series under the current ladder (reused
 * from the Test game, PROVISIONAL), so the owner can decide each format's difficulty.
 *
 * The drafter never sees ratings: only the numbers on the cards, misjudged by a random amount,
 * and it plays the real draft rules (no respin use: simpler, slightly pessimistic).
 *
 * Run: npx esbuild scripts/cricsheet/calibrate-white-ball.ts --bundle --platform=node --format=cjs \
 *        --outfile=.test-dist/calibrate-white-ball.cjs --log-level=error && node .test-dist/calibrate-white-ball.cjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  createDraft, applySpinResult, applyDraftPick, validatePoolPick, placementOptions, countsOf,
  reachableShapes, isXIValid, supplyFor, slotOf, XI_SLOTS, XI_SHAPES,
  type NormalizedPlayer, type DraftState, type XiRole,
} from '../../src/lib/player-logic';
import { wbPlayers, wbOpponentPool, wbPlayersByEra, wbSpinCombos, type WbFormatId } from '../../src/lib/formats/white-ball-store';
import { WB_FORMATS, buildWbContext, scoreWbPlayer, wbTeamBlend, type WbEntry } from '../../src/lib/white-ball-metrics';
import { upcomingCombos, finalSpinOptions } from '../../src/lib/daily';
import { IPL_FORMAT } from '../../src/lib/formats/draft-format';
import { mulberry32, NO_DRAW_BANDS, bandFor, wobble, PAR_GAP } from '../../src/lib/series';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) && v != null ? Number(v) : d);
const gaussian = (rng: () => number) => Math.sqrt(-2 * Math.log(Math.max(rng(), 1e-12))) * Math.cos(2 * Math.PI * rng());
const MISJUDGE = Number(process.env.MISJUDGE ?? 0.12);
/** Formats whose difficulty the owner has fixed. None now: the IPL's "good for now" (2026-10-01) was for
 *  career stats; with stint stats (2026-10-02) its par is tuned like the others until the owner decides. */
const OWNER_DIFFICULTY = new Set<string>([]);
/** Provisional target for the others: about the IPL's simulated series-win rate. */
const TARGET_WIN = 0.15;
const TRIALS = Number(process.env.TRIALS ?? 600);
/** DRAFTER=rating: a drafter that can see the hidden ratings (the best a player could do by skill).
 *  ANALYZE=1: print win rates at the par now in the series file and write nothing (item 11, 2026-10-03). */
const DRAFTER = process.env.DRAFTER ?? 'human';
const ANALYZE = !!process.env.ANALYZE;

/** What "looks good" on a card differs by format: ODI strike rates and economies are lower. */
const LOOKS: Record<WbFormatId, { sr: [number, number]; econ: [number, number]; matches: number }> = {
  odi: { sr: [70, 40], econ: [6.5, 2.5], matches: 250 },
  t20i: { sr: [110, 50], econ: [10, 3.5], matches: 100 },
  ipl: { sr: [110, 50], econ: [10, 3.5], matches: 150 },
};

function run(id: WbFormatId) {
  const FMT = WB_FORMATS[id];
  const players = wbPlayers(id);
  const byEra = wbPlayersByEra(id);
  const combos = wbSpinCombos(id);
  const ctx = buildWbContext(players, FMT);
  const poolFor = (era: string, nation: string) => byEra[era].filter((p) => p.nation === nation);
  const rated = players.map((p) => ({ p, s: scoreWbPlayer(p, null, ctx, FMT) }));
  const top = (role: string, n: number) => rated.filter((x) => x.s.role === role).sort((a, b) => b.s.score - a.s.score).slice(0, n);
  console.log(`\n================ ${FMT.label}: ${players.length} draftable players, ${combos.length} draws`);

  // ---- opponent XI: owner-approved if present, otherwise the engine's candidate
  const ownerFile = `scripts/cricsheet/owner-allstar-${id}.json`;
  let xi: { p: (typeof players)[number]; role: string; score: number }[];
  const approved = existsSync(ownerFile);
  if (approved) {
    const list: { id?: string; name: string; role: string }[] = JSON.parse(readFileSync(ownerFile, 'utf8')).xi;
    if (list.length !== 11) throw new Error(`${ownerFile} must list exactly 11 players`);
    xi = list.map((a) => {
      // By id when given (display names can be corrected later), otherwise by exact name.
      const hits = wbOpponentPool(id).filter((p) => (a.id ? p.id === a.id : p.name === a.name));
      // IPL: a player has one record per stint; the opponent uses his best-rated one (owner, 2026-10-02).
      if (id === 'ipl' ? hits.length < 1 : hits.length !== 1) throw new Error(`${ownerFile}: "${a.name}" matches ${hits.length} ${FMT.label} players`);
      const best = hits.map((p) => ({ p, role: a.role, score: scoreWbPlayer(p, a.role, ctx, FMT).score })).sort((x, y) => y.score - x.score)[0];
      return best;
    });
  } else {
    const base = [...top('opener', 2), ...top('middle-order', 3), ...top('wicketkeeper', 1)];
    const pace = top('fast-bowler', 3);
    let best: { xi: typeof rated; score: number } | null = null;
    for (const shape of XI_SHAPES) {
      const flex = [...top('all-rounder', shape['all-rounder']), ...top('spinner', shape.spinner)];
      if (flex.length !== 2) continue;
      const cand = [...base, ...flex, ...pace];
      const score = wbTeamBlend(cand.map((x) => ({ player: x.p, declaredRole: x.s.role })), ctx, FMT).score;
      if (!best || score > best.score) best = { xi: cand, score };
    }
    if (!best) throw new Error(`${id}: no legal opponent XI`);
    xi = best.xi.map((x) => ({ p: x.p, role: x.s.role, score: x.s.score }));
  }
  const oppScore = wbTeamBlend(xi.map((x) => ({ player: x.p, declaredRole: x.role })), ctx, FMT).score;
  console.log(`Opponent XI (${approved ? 'owner-approved' : 'CANDIDATE, owner to approve'}; team score ${oppScore}):`);
  for (const x of xi) console.log(`  ${x.role.padEnd(13)} ${x.p.name.padEnd(24)} ${x.score}  (${x.p.stats.matches} matches${x.p.stint ? `, ${x.p.stint.team} ${x.p.stint.block}` : ''}${x.p.overseas ? ', overseas' : ''})`);
  if (approved) {
    console.log('engine top-rated now: ' + ['opener', 'middle-order', 'wicketkeeper', 'all-rounder', 'spinner', 'fast-bowler']
      .map((r) => `${r}: ${top(r, 3).map((x) => x.p.name).join(', ')}`).join(' | '));
  }

  // ---- human-like drafter
  const L = LOOKS[id];
  const visibleBat = (p: NormalizedPlayer) => {
    const s = p.stats;
    return clamp01((num(s.battingAverage, 0) - 15) / 30) * 0.5 + clamp01((num(s.strikeRate, 0) - L.sr[0]) / L.sr[1]) * 0.3 + clamp01(num(s.matches, 0) / L.matches) * 0.2;
  };
  const visibleBowl = (p: NormalizedPlayer) => {
    const s = p.stats;
    return clamp01((L.econ[0] - num(s.economy, L.econ[0] + 2)) / L.econ[1]) * 0.5 + clamp01((40 - num(s.bowlingAverage, 60)) / 20) * 0.3 + clamp01(num(s.wickets, 0) / L.matches) * 0.2;
  };
  const visibleValue = (p: NormalizedPlayer, role: XiRole) => {
    if (role === 'fast-bowler' || role === 'spinner') return visibleBowl(p);
    if (role === 'all-rounder') { const b = visibleBat(p), w = visibleBowl(p); return Math.max(b, w) + 0.5 * Math.min(b, w); }
    return visibleBat(p);
  };
  const draftOnce = (seed: number): DraftState | null => {
    const rng = mulberry32(seed);
    const noise = new Map<string, number>();
    for (const p of players) noise.set(p.id, gaussian(rng) * MISJUDGE);
    let draft = createDraft();
    for (let r = 0; r < 6; r++) {
      const options = finalSpinOptions(upcomingCombos(r, draft.spinHistory, combos, combos), r, id === 'ipl' ? IPL_FORMAT.finalSpinMinPool : undefined);
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
              const seen = DRAFTER === 'rating' ? scoreWbPlayer(p, o.role, ctx, FMT).score / 100 : visibleValue(p, o.role);
              const v = seen + (noise.get(p.id) ?? 0) + needed;
              if (!pick || v > pick.v) pick = { p, slot: s.key, role: o.role, v };
            }
          }
        }
        if (!pick) return null;
        draft = applyDraftPick(draft, pick.p, pick.slot, pick.role, supply);
      }
    }
    return draft.gameComplete && isXIValid(draft) ? draft : null;
  };

  const scores: number[] = [];
  let stalled = 0;
  for (let seed = 1; seed <= TRIALS; seed++) {
    const d = draftOnce(seed * 7919);
    if (!d) { stalled++; continue; }
    const entries: WbEntry[] = d.selectedPlayers.map((p) => {
      const key = slotOf(d, p.uid);
      return { player: p, declaredRole: (key && d.slots[key]?.role) || p.primaryRole };
    });
    scores.push(wbTeamBlend(entries, ctx, FMT).score);
  }
  scores.sort((a, b) => a - b);
  const q = (p: number) => scores[Math.min(scores.length - 1, Math.floor(p * scores.length))];
  console.log(`human-like drafts: ${scores.length} complete, ${stalled} stalled; team scores p10 ${q(0.1)}, median ${q(0.5)}, p90 ${q(0.9)}, best ${scores[scores.length - 1]}`);
  if (ANALYZE) {
    const cur = JSON.parse(readFileSync(`src/data/formats/${id}-series.json`, 'utf8')).parGap as number;
    const winsAt = (par: number) => { let w = 0; for (let i = 0; i < scores.length; i++) { const b = bandFor(wobble(scores[i] - oppScore, mulberry32(i + 1)), par, true); if (b.user > b.house) w++; } return w / scores.length; };
    const pct = (x: number) => (x * 100).toFixed(1) + '%';
    console.log(`ANALYSIS ${id} drafter=${DRAFTER} misjudge=${MISJUDGE}: opponent ${oppScore}, par now ${cur}, series wins ${pct(winsAt(cur))}; best simulated draft ${scores[scores.length - 1]}, p90 ${q(0.9)}, median ${q(0.5)}; wins at par ${Array.from({ length: 4 + Number(process.env.PAR_SPAN ?? 3) }, (_, k) => cur - 3 + k).map((x) => `${x}:${pct(winsAt(x))}`).join(' ')}`);
    return;
  }
  // Difficulty. IPL: the owner said the Test ladder is fine for now. ODI/T20I: under that ladder
  // nobody wins (their pools sit much further below a World XI), so until the owner decides, par is
  // set where simulated drafts win about as often as in the IPL (TARGET_WIN). PROVISIONAL.
  const winShare = (par: number) => {
    let w = 0;
    for (let i = 0; i < scores.length; i++) {
      const b = bandFor(wobble(scores[i] - oppScore, mulberry32(i + 1)), par, true);
      if (b.user > b.house) w++;
    }
    return w / scores.length;
  };
  let parGap = PAR_GAP;
  if (!OWNER_DIFFICULTY.has(id)) {
    let bestDiff = Infinity;
    for (let par = -5; par >= -40; par -= 0.5) {
      const diff = Math.abs(winShare(par) - TARGET_WIN);
      if (diff < bestDiff) { bestDiff = diff; parGap = par; }
    }
  }
  let wins = 0;
  const tally = new Map<string, number>();
  for (let i = 0; i < scores.length; i++) {
    const band = bandFor(wobble(scores[i] - oppScore, mulberry32(i + 1)), parGap, true);
    const k = `${band.user}-${band.house}`;
    tally.set(k, (tally.get(k) ?? 0) + 1);
    if (band.user > band.house) wins++;
  }
  console.log(`scorelines (par ${parGap}${OWNER_DIFFICULTY.has(id) ? ', owner: fine for now' : `, PROVISIONAL: tuned to ~${TARGET_WIN * 100}% wins; Test ladder would give ${(winShare(PAR_GAP) * 100).toFixed(1)}%`}): ` + NO_DRAW_BANDS.map((b) => `${b.user}-${b.house} ${(((tally.get(`${b.user}-${b.house}`) ?? 0) / scores.length) * 100).toFixed(0)}%`).join(', '));
  console.log(`series wins: ${((wins / scores.length) * 100).toFixed(1)}% of simulated drafts`);
  // CHECK_PAR=<par>: also print the win rate at a given par (to compare scoring variants like for like).
  if (process.env.CHECK_PAR) console.log(`at par ${process.env.CHECK_PAR}: ${(winShare(Number(process.env.CHECK_PAR)) * 100).toFixed(1)}% series wins`);
  if (process.env.DRY) return;

  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(
    `src/data/formats/${id}-series.json`,
    JSON.stringify({
      note: approved
        ? `Opponent XI approved by the owner (${ownerFile}); calibration is a simulated sample.`
        : 'CANDIDATE opponent XI (engine top-rated legal XI) and simulated calibration; owner to approve (docs/plans/white-ball-formats.md).',
      generated: today,
      opponentApproved: approved,
      opponentXI: xi.map((x) => ({ id: x.p.id, name: x.p.name, role: x.role, ...(x.p.stint ? { team: x.p.stint.team, block: x.p.stint.block } : {}) })),
      opponentScore: oppScore,
      parGap,
      parGapProvisional: !OWNER_DIFFICULTY.has(id),
      calibration: {
        source: `human-like simulated ${FMT.label} drafter v1 (card stats only, misjudge sd ${MISJUDGE}, no respins); ${scores.length} drafts`,
        generated: today,
        scores,
      },
    }) + '\n',
  );
}

const only = process.argv[2] as WbFormatId | undefined;
for (const id of (only ? [only] : ['odi', 't20i', 'ipl']) as WbFormatId[]) run(id);
console.log('\nwrote src/data/formats/{odi,t20i,ipl}-series.json');
