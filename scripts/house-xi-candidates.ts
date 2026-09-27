/**
 * house-xi-candidates.ts (phase 2) — brute-force the 7 open slots around the
 * fixed four (Bradman/O, Tendulkar/MO, Kallis/AR, Warne/SP) for a valid
 * 3MO+AR+SP XI with mean in [84, 85].
 * Usage: npx tsx scripts/house-xi-candidates.ts
 */
import { readFileSync } from 'node:fs';
import {
  normalizePlayer,
  playerGroups,
  type NormalizedPlayer,
} from '../src/lib/player-logic';
import {
  buildScoringContext,
  scorePlayer,
  type ScoringContext,
} from '../src/lib/seven-metrics';

const ERAS = ['legends', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];
const DATA_DIR = process.cwd() + '/src/data';
const players: NormalizedPlayer[] = [];
{
  const seen = new Set<string>();
  for (const era of ERAS) {
    const raw = JSON.parse(readFileSync(`${DATA_DIR}/${era}.json`, 'utf8'));
    for (const r of raw) {
      const p = normalizePlayer(r, era);
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      players.push(p);
    }
  }
}
const ctx: ScoringContext = buildScoringContext(players);
const legends = players.filter((p) =>
  (Array.isArray(p.era) ? p.era : [p.era]).includes('legends'),
);
const byId = new Map(legends.map((p) => [p.id, p]));
function s(id: string, role: string): number {
  const p = byId.get(id)!;
  return scorePlayer(p, role, ctx).score ?? -1;
}

// Fixed four.
const FIXED: [string, string][] = [
  ['don-bradman', 'opener'],
  ['sachin-tendulkar', 'middle-order'],
  ['jacques-kallis', 'all-rounder'],
  ['shane-warne', 'spinner'],
];
const fixedSum = FIXED.reduce((t, [id, r]) => t + s(id, r), 0);
console.log(`fixed four sum: ${fixedSum.toFixed(1)}`);

// Candidate pools for the 7 open slots (iconic legends only).
const OPENERS = ['jack-hobbs', 'len-hutton', 'sunil-gavaskar', 'gordon-greenidge', 'graham-gooch', 'hanif-mohammad'];
const MOS = ['viv-richards', 'ricky-ponting', 'brian-lara', 'javed-miandad', 'martin-crowe', 'rahul-dravid', 'greg-chappell'];
const WKS = ['adam-gilchrist'];
const FBS = ['malcolm-marshall', 'dennis-lillee', 'glenn-mcgrath', 'curtly-ambrose', 'wasim-akram', 'waqar-younis', 'dale-steyn', 'richard-hadlee'];

const LO = 84 * 11;
const HI = 85 * 11;
interface Cand { total: number; team: [string, string][]; }
const inBand: Cand[] = [];
let bestOver: Cand | null = null;

for (const o of OPENERS) {
  for (let a = 0; a < MOS.length; a++) {
    for (let b = a + 1; b < MOS.length; b++) {
      for (const w of WKS) {
        for (let x = 0; x < FBS.length; x++) {
          for (let y = x + 1; y < FBS.length; y++) {
            for (let z = y + 1; z < FBS.length; z++) {
              const team: [string, string][] = [
                ...FIXED,
                [o, 'opener'],
                [MOS[a], 'middle-order'],
                [MOS[b], 'middle-order'],
                [w, 'wicketkeeper'],
                [FBS[x], 'fast-bowler'],
                [FBS[y], 'fast-bowler'],
                [FBS[z], 'fast-bowler'],
              ];
              const total = team.reduce((t, [id, r]) => t + s(id, r), 0);
              if (total >= LO && total <= HI) inBand.push({ total, team });
              else if (total > HI && (!bestOver || total < bestOver.total))
                bestOver = { total, team };
            }
          }
        }
      }
    }
  }
}
console.log(`in-band candidates [84,85]: ${inBand.length}`);
inBand.sort((a, b) => Math.abs(a.total - 84.5 * 11) - Math.abs(b.total - 84.5 * 11));
// Prefer continuity with the current house XI as tiebreak.
const CURRENT = new Set(['jack-hobbs','viv-richards','ricky-ponting','adam-gilchrist','malcolm-marshall','glenn-mcgrath']);
inBand.sort((a, b) => {
  const ca = a.team.filter(([id]) => CURRENT.has(id)).length;
  const cb = b.team.filter(([id]) => CURRENT.has(id)).length;
  if (cb !== ca) return cb - ca;
  return Math.abs(a.total - 84.5 * 11) - Math.abs(b.total - 84.5 * 11);
});
const show = (c: Cand) => {
  console.log(`\nmean ${(c.total / 11).toFixed(1)} (total ${c.total.toFixed(1)}):`);
  for (const [id, r] of c.team)
    console.log(`  ${String(s(id, r)).padStart(5)}  ${byId.get(id)!.name} (${r})`);
};
console.log('\n--- top in-band (continuity first) ---');
inBand.slice(0, 3).forEach(show);
if (bestOver) {
  console.log('\n--- closest above band (for reference) ---');
  show(bestOver);
}
