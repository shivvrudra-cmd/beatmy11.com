/**
 * XI-shape diagnostics: runs the finalized engine against the three legal XI
 * shapes plus elite/weak, batting-heavy/bowling-heavy, AR-heavy/specialist,
 * and identical-vs-identical comparisons.
 * Dev/diagnostic use only — not part of the site build.
 */
import { readFileSync } from 'node:fs';
import {
  buildScoringContext,
  scorePlayer,
  compareXIs,
  type NormalizedPlayer,
  type ScoringContext,
  type XIEntry,
} from '../src/lib/seven-metrics';
import { normalizePlayer } from '../src/lib/player-logic';

const DATA_DIR = process.cwd() + '/src/data';
const byId = new Map<string, NormalizedPlayer>();
for (const era of ['legends', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s']) {
  const raw = JSON.parse(readFileSync(`${DATA_DIR}/${era}.json`, 'utf8'));
  for (const p of raw) {
    const n = normalizePlayer(p, era);
    if (!byId.has(n.id)) byId.set(n.id, n);
  }
}
const CTX = buildScoringContext([...byId.values()]);

// score every unique player under their primary role
const scored = [...byId.values()].map((p) => ({
  p,
  s: scorePlayer(p, null, CTX).score ?? -1,
}));
const top = (role: string, n: number) =>
  scored.filter((x) => x.p.primaryRole === role).sort((a, b) => b.s - a.s).slice(0, n).map((x) => x.p);
const bottom = (role: string, n: number) =>
  scored.filter((x) => x.p.primaryRole === role).sort((a, b) => a.s - b.s).slice(0, n).map((x) => x.p);

const E = (player: NormalizedPlayer, declaredRole: string): XIEntry => ({ player, declaredRole });

function show(title: string, xi: XIEntry[], vs?: XIEntry[]) {
  console.log(`\n=== ${title} ===`);
  const cmp = vs ? compareXIs(xi, vs, CTX) : compareXIs(xi, xi, CTX);
  for (const ps of cmp.userPlayers) {
    console.log(`  ${ps.name} (${ps.role}): ${ps.score}`);
  }
  console.log(`  XI SCORE = ${cmp.userScore}`);
  if (vs) {
    console.log(`  vs opponent ${cmp.opponentScore}: diff ${cmp.difference} -> ${cmp.result}`);
  }
  return cmp;
}

// pick lists (printed for auditability)
const elites: Record<string, NormalizedPlayer[]> = {
  opener: top('opener', 2), 'middle-order': top('middle-order', 4),
  wicketkeeper: top('wicketkeeper', 1), 'all-rounder': top('all-rounder', 2),
  spinner: top('spinner', 2), 'fast-bowler': top('fast-bowler', 4),
};
const weaks: Record<string, NormalizedPlayer[]> = {
  opener: bottom('opener', 2), 'middle-order': bottom('middle-order', 4),
  wicketkeeper: bottom('wicketkeeper', 1), 'all-rounder': bottom('all-rounder', 1),
  spinner: bottom('spinner', 1), 'fast-bowler': bottom('fast-bowler', 3),
};
console.log('elite picks:', Object.entries(elites).map(([r, ps]) => `${r}=[${ps.map((p) => p.name).join(', ')}]`).join(' '));
console.log('weak picks:', Object.entries(weaks).map(([r, ps]) => `${r}=[${ps.map((p) => p.name).join(', ')}]`).join(' '));

// Shape 1: 2O / 4MO / 1K / 1AR / 0S / 3F (elite)
const shape1 = [
  ...elites.opener.map((p) => E(p, 'opener')),
  ...elites['middle-order'].map((p) => E(p, 'middle-order')),
  E(elites.wicketkeeper[0], 'wicketkeeper'),
  E(elites['all-rounder'][0], 'all-rounder'),
  ...elites['fast-bowler'].slice(0, 3).map((p) => E(p, 'fast-bowler')),
];
// Shape 2: 2O / 4MO / 1K / 0AR / 1S / 3F (elite)
const shape2 = [
  ...elites.opener.map((p) => E(p, 'opener')),
  ...elites['middle-order'].map((p) => E(p, 'middle-order')),
  E(elites.wicketkeeper[0], 'wicketkeeper'),
  E(elites.spinner[0], 'spinner'),
  ...elites['fast-bowler'].slice(0, 3).map((p) => E(p, 'fast-bowler')),
];
// Shape 3: 2O / 3MO / 1K / 1AR / 1S / 3F (elite)
const shape3 = [
  ...elites.opener.map((p) => E(p, 'opener')),
  ...elites['middle-order'].slice(0, 3).map((p) => E(p, 'middle-order')),
  E(elites.wicketkeeper[0], 'wicketkeeper'),
  E(elites['all-rounder'][0], 'all-rounder'),
  E(elites.spinner[0], 'spinner'),
  ...elites['fast-bowler'].slice(0, 3).map((p) => E(p, 'fast-bowler')),
];
show('SHAPE 1 (2O/4MO/1K/1AR/0S/3F) elite', shape1);
show('SHAPE 2 (2O/4MO/1K/0AR/1S/3F) elite', shape2);
show('SHAPE 3 (2O/3MO/1K/1AR/1S/3F) elite', shape3);

// Elite vs weak (shape 1 frame)
const weakXI = [
  ...weaks.opener.map((p) => E(p, 'opener')),
  ...weaks['middle-order'].map((p) => E(p, 'middle-order')),
  E(weaks.wicketkeeper[0], 'wicketkeeper'),
  E(weaks['all-rounder'][0], 'all-rounder'),
  ...weaks['fast-bowler'].map((p) => E(p, 'fast-bowler')),
];
show('ELITE XI vs WEAK XI', shape1, weakXI);

// Batting-heavy vs bowling-heavy (shape 2 frame)
const batHeavy = [
  ...elites.opener.map((p) => E(p, 'opener')),
  ...elites['middle-order'].map((p) => E(p, 'middle-order')),
  E(elites.wicketkeeper[0], 'wicketkeeper'),
  E(weaks.spinner[0], 'spinner'),
  ...weaks['fast-bowler'].map((p) => E(p, 'fast-bowler')),
];
const bowlHeavy = [
  ...weaks.opener.map((p) => E(p, 'opener')),
  ...weaks['middle-order'].map((p) => E(p, 'middle-order')),
  E(weaks.wicketkeeper[0], 'wicketkeeper'),
  E(elites.spinner[0], 'spinner'),
  ...elites['fast-bowler'].slice(0, 3).map((p) => E(p, 'fast-bowler')),
];
show('BATTING-HEAVY vs BOWLING-HEAVY', batHeavy, bowlHeavy);

// AR-heavy (shape 1, elite AR) vs specialist-heavy (shape 2, elite spinner, no AR)
show('AR-HEAVY (shape 1) vs SPECIALIST-HEAVY (shape 2)', shape1, shape2);

// Identical vs identical
show('IDENTICAL vs IDENTICAL', shape1, shape1);
