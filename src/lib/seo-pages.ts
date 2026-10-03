/**
 * seo-pages.ts — page models for the statically generated SEO content pages
 * (/best-xi/..., /best/...). See docs/seo-content-plan.md.
 *
 * Pure and build-time: it reads the same era data the game uses and invents
 * nothing.
 *
 * - Population: every unique player (deduped by raw id, first era file wins —
 *   exactly the rule matchup.astro uses to build the scoring population).
 * - Ranking: the existing V2 engine. `buildScoringContext` over the whole
 *   population, then `scorePlayer(player, primaryRole, ctx).score`. NO new
 *   maths. Ratings are used only to ORDER players; they are never put in the
 *   page models (the owner decided these pages show rank + real career
 *   stats, not numbers; ratings stay a reveal on /play and the result page).
 * - XI selection: the highest-rated players in each position for each XI_SHAPE; the shape with
 *   the best existing `teamBlend` wins. Owner, 2026-10-03: every best XI keeps exactly one
 *   all-rounder (the shape with one all-rounder and one spinner) when the pool can fill it, and
 *   the best-XI pages only consider players with at least SEO_MIN_TESTS Tests.
 * - Missing data: players with an invalid role or an uncomputable metric are
 *   EXCLUDED and reported (`SeoData.excluded`); nothing is zero-filled.
 * - Copy is generated only from real data fields and counts.
 */

import { allPlayersByEra, ERA_IDS, NATIONS, XI_SHAPES } from './player-store';
import type { NormalizedPlayer, XiCounts } from './player-store';
import {
  METRICS,
  ROLE_METRICS,
  auditMetrics,
  buildScoringContext,
  hasFieldingData,
  rawFielding,
  scorePlayer,
  teamBlend,
  type EvaluationRole,
  type ScoringContext,
} from './seven-metrics';

export const SITE_URL = 'https://beatmy11.com';
export const SITE_NAME = 'Beat My 11';

// ---------------------------------------------------------------------------
// Vocabulary (hand-written constants, listed in the PR for owner review)
// ---------------------------------------------------------------------------

export const ROLES: EvaluationRole[] = [
  'opener',
  'middle-order',
  'wicketkeeper',
  'all-rounder',
  'spinner',
  'fast-bowler',
];

export const ROLE_SLUGS: Record<EvaluationRole, string> = {
  opener: 'openers',
  'middle-order': 'middle-order-batters',
  wicketkeeper: 'wicketkeepers',
  'all-rounder': 'all-rounders',
  spinner: 'spinners',
  'fast-bowler': 'fast-bowlers',
};

/** Plural noun for copy, e.g. "openers". */
export const ROLE_PLURAL: Record<EvaluationRole, string> = {
  opener: 'openers',
  'middle-order': 'middle-order batters',
  wicketkeeper: 'wicketkeepers',
  'all-rounder': 'all-rounders',
  spinner: 'spinners',
  'fast-bowler': 'fast bowlers',
};

/** Singular noun for copy, e.g. "opener". */
export const ROLE_SINGULAR: Record<EvaluationRole, string> = {
  opener: 'opener',
  'middle-order': 'middle-order batter',
  wicketkeeper: 'wicketkeeper',
  'all-rounder': 'all-rounder',
  spinner: 'spinner',
  'fast-bowler': 'fast bowler',
};

/** Title words that precede "by Our Ratings" on role pages. */
const ROLE_TITLE: Record<EvaluationRole, string> = {
  opener: 'Greatest Test Openers',
  'middle-order': 'Greatest Test Middle-Order Batters',
  wicketkeeper: 'Best Test Wicketkeepers',
  'all-rounder': 'Greatest Test All-Rounders',
  spinner: 'Greatest Test Spinners',
  'fast-bowler': 'Greatest Test Fast Bowlers',
};

export const NATION_ADJECTIVE: Record<string, string> = {
  Australia: 'Australian',
  Bangladesh: 'Bangladeshi',
  England: 'English',
  India: 'Indian',
  'New Zealand': 'New Zealand',
  Pakistan: 'Pakistani',
  'South Africa': 'South African',
  'Sri Lanka': 'Sri Lankan',
  'West Indies': 'West Indian',
  Zimbabwe: 'Zimbabwean',
};

export const nationSlug = (nation: string): string =>
  nation.toLowerCase().replace(/\s+/g, '-');

export const ALL_TIME_SLUG = 'all-time';

export const eraLabel = (era: string): string =>
  era === 'legends' ? 'the Legends era' : `the ${era}`;

/** Era / nation / all-time XI scopes. */
export type XiScope =
  | { kind: 'all-time' }
  | { kind: 'era'; era: string }
  | { kind: 'nation'; nation: string };

export const scopeSlug = (s: XiScope): string =>
  s.kind === 'all-time' ? ALL_TIME_SLUG : s.kind === 'era' ? s.era : nationSlug(s.nation);

/** Every XI scope the generator knows how to build. */
export function allXiScopes(): XiScope[] {
  return [
    { kind: 'all-time' },
    ...ERA_IDS.map((era): XiScope => ({ kind: 'era', era })),
    ...NATIONS.map((nation): XiScope => ({ kind: 'nation', nation })),
  ];
}

/**
 * The MVP set the owner approved: 12 pages. Anything else the generator can
 * build stays unpublished until added here.
 */
export const PUBLISHED_XI_SLUGS: readonly string[] = [
  ALL_TIME_SLUG,
  '1990s',
  '2000s',
  'legends',
  'india',
  'england',
];
export const PUBLISHED_ROLES: readonly EvaluationRole[] = [
  'opener',
  'wicketkeeper',
  'fast-bowler',
  'spinner',
];

/** Best-XI pages only consider players with at least this many Tests (owner, 2026-10-03). Page rule only: the game is unaffected. */
export const SEO_MIN_TESTS = 50;

export const XI_HUB_PATH = '/best-xi/';
export const ROLE_HUB_PATH = '/best/';
export const xiPath = (slug: string): string => `/best-xi/${slug}/`;
export const rolePath = (role: EvaluationRole): string => `/best/${ROLE_SLUGS[role]}/`;

// ---------------------------------------------------------------------------
// Population, ranking, exclusions
// ---------------------------------------------------------------------------

export interface UniquePlayer {
  /** First-file record (the one the game and /matchup use). */
  player: NormalizedPlayer;
  /** Era ids the player appears in (union of `era` arrays and file ids), chronological. */
  eras: string[];
  /** Primary role recorded in each era file the player appears in. */
  records: { file: string; role: string }[];
}

/**
 * Owner-decided roles for players whose era files disagree on primaryRole
 * (decided 2026-10-01). Applied here, in page generation only: the JSON data
 * files are untouched and /play and /matchup are unaffected. The role must
 * match the role recorded in one of the player's era files (checked at
 * build time). Every other player uses the first era file's role, the same
 * dedupe rule /matchup uses. Casing/format differences (e.g. "Fast bowler"
 * vs "fast-bowler") are not conflicts: normalizePlayer canonicalises them.
 */
export const OWNER_RECLASS = 'owner';

export const ROLE_OVERRIDES: Record<string, { role: string; file: string; note: string }> = {
  // Single-record player reclassified by the owner (role is his listed secondary role).
  'don-bradman': { role: 'middle-order', file: OWNER_RECLASS, note: 'owner: classed as middle-order on these pages (data says opener, secondary middle-order)' },
  'manoj-prabhakar': { role: 'opener', file: '1990s', note: 'owner: the 1990s record (opener)' },
  'hamilton-masakadza': { role: 'opener', file: '2000s', note: 'owner: the 2000s record (opener)' },
  'brendan-taylor': { role: 'wicketkeeper', file: '2010s', note: 'owner: the 2010s record (wicketkeeper)' },
  'rohit-sharma': { role: 'opener', file: '2020s', note: 'owner: the 2020s record (opener)' },
  'usman-khawaja': { role: 'middle-order', file: '2010s', note: 'owner: the 2010s record (middle-order)' },
};

export interface RoleConflict {
  id: string;
  name: string;
  /** Role used: the owner override, or the first era file's role. */
  chosen: { file: string; role: string };
  /** True when chosen comes from ROLE_OVERRIDES rather than first-file-wins. */
  overridden: boolean;
  /** Other roles recorded in the other era files. */
  alternatives: { file: string; role: string }[];
}

export interface Exclusion {
  id: string;
  name: string;
  reason: string;
}

export interface RankedPlayer {
  uni: UniquePlayer;
  player: NormalizedPlayer;
  role: EvaluationRole;
  /** Used for ordering only. Never rendered. */
  score: number;
  /** True when dismissals are present so the existing teamBlend can score an XI containing him. */
  xiEligible: boolean;
}

export interface SeoData {
  ctx: ScoringContext;
  /** Number of unique players in the database (including any excluded). */
  populationSize: number;
  /** Ranked players, ordered by the shared comparator. */
  ranked: RankedPlayer[];
  excluded: Exclusion[];
  conflicts: RoleConflict[];
}

/** Dedupe by raw id, first era file wins; collect era membership and role conflicts. */
export function buildPopulation(
  byEra: Record<string, NormalizedPlayer[]> = allPlayersByEra(),
  overrides: typeof ROLE_OVERRIDES = ROLE_OVERRIDES,
): { players: UniquePlayer[]; conflicts: RoleConflict[] } {
  const map = new Map<string, UniquePlayer>();
  const order: string[] = [];
  for (const file of ERA_IDS) {
    for (const p of byEra[file] ?? []) {
      let u = map.get(p.id);
      if (!u) {
        u = { player: p, eras: [], records: [] };
        map.set(p.id, u);
        order.push(p.id);
      }
      u.records.push({ file, role: p.primaryRole });
      const eraList = Array.isArray(p.era) ? p.era : [p.era];
      for (const e of [file, ...eraList]) if (!u.eras.includes(e)) u.eras.push(e);
    }
  }
  const players = order.map((id) => map.get(id)!);
  for (const u of players) {
    u.eras.sort((a, b) => ERA_IDS.indexOf(a as never) - ERA_IDS.indexOf(b as never));
  }
  const conflicts: RoleConflict[] = [];
  for (const u of players) {
    let chosen = u.records[0];
    const alternativesOf = (c: { file: string; role: string }) =>
      u.records.filter((r) => r.role !== c.role);
    const ov = overrides[u.player.id];
    if (ov && ov.file === OWNER_RECLASS) {
      // Owner reclassification of a single-record player: no data conflict,
      // but the new role must be one the data already lists for him
      // (a secondary role), so nothing is invented.
      if (!u.player.secondaryRoles.includes(ov.role) && !u.records.some((r) => r.role === ov.role)) {
        throw new Error(
          `[seo-pages] reclassification of ${u.player.id} to ${ov.role} is not a role listed in his data`,
        );
      }
      u.player = { ...u.player, primaryRole: ov.role };
      continue;
    }
    if (alternativesOf(chosen).length === 0) continue; // all records agree
    let overridden = false;
    if (ov) {
      const rec = u.records.find((r) => r.file === ov.file && r.role === ov.role);
      if (!rec) {
        throw new Error(
          `[seo-pages] role override for ${u.player.id} (${ov.role} in ${ov.file}) matches no era record`,
        );
      }
      chosen = rec;
      overridden = true;
      u.player = { ...u.player, primaryRole: ov.role };
    }
    conflicts.push({
      id: u.player.id,
      name: u.player.name,
      chosen,
      overridden,
      alternatives: alternativesOf(chosen),
    });
  }
  return { players, conflicts };
}

/** The one ordering rule: rating desc, then Tests desc, then id asc (stable builds). */
export function compareRanked(a: RankedPlayer, b: RankedPlayer): number {
  if (b.score !== a.score) return b.score - a.score;
  const am = a.player.stats.testMatches ?? 0;
  const bm = b.player.stats.testMatches ?? 0;
  if (bm !== am) return bm - am;
  return a.player.id < b.player.id ? -1 : a.player.id > b.player.id ? 1 : 0;
}

export function buildSeoData(
  byEra: Record<string, NormalizedPlayer[]> = allPlayersByEra(),
  overrides: typeof ROLE_OVERRIDES = ROLE_OVERRIDES,
): SeoData {
  const { players, conflicts } = buildPopulation(byEra, overrides);
  // Same population as matchup.astro: every unique player.
  const ctx = buildScoringContext(players.map((u) => u.player));
  const ranked: RankedPlayer[] = [];
  const excluded: Exclusion[] = [];
  for (const uni of players) {
    const p = uni.player;
    const role = p.primaryRole as EvaluationRole;
    if (!ROLES.includes(role)) {
      excluded.push({ id: p.id, name: p.name, reason: `unrecognised role "${p.primaryRole}"` });
      continue;
    }
    const gaps = auditMetrics([{ player: p, declaredRole: role }]);
    if (gaps.length > 0) {
      excluded.push({
        id: p.id,
        name: p.name,
        reason: `missing metric(s): ${gaps.map((g) => g.metric).join(', ')}`,
      });
      continue;
    }
    const score = scorePlayer(p, role, ctx).score;
    if (score === null) {
      excluded.push({ id: p.id, name: p.name, reason: 'score uncomputable' });
      continue;
    }
    ranked.push({ uni, player: p, role, score, xiEligible: hasFieldingData(p) });
  }
  ranked.sort(compareRanked);
  return { ctx, populationSize: players.length, ranked, excluded, conflicts };
}

let cached: SeoData | null = null;
/** Cached per build; also prints the exclusion report once. */
export function getSeoData(): SeoData {
  if (cached) return cached;
  cached = buildSeoData();
  if (cached.excluded.length > 0) {
    console.warn(
      `[seo-pages] ${cached.excluded.length} player(s) excluded from rankings:\n` +
        cached.excluded.map((e) => `  - ${e.name} (${e.id}): ${e.reason}`).join('\n'),
    );
  }
  return cached;
}

// ---------------------------------------------------------------------------
// Filters and XI selection
// ---------------------------------------------------------------------------

export function matchesScope(r: RankedPlayer, scope: XiScope): boolean {
  if (scope.kind === 'all-time') return true;
  if (scope.kind === 'era') return r.uni.eras.includes(scope.era);
  return r.player.nation === scope.nation;
}

const SHAPE_ORDER: EvaluationRole[] = [
  'opener',
  'middle-order',
  'wicketkeeper',
  'all-rounder',
  'spinner',
  'fast-bowler',
];

export interface XiPick {
  xi: RankedPlayer[];
  bench: RankedPlayer[];
  shape: XiCounts;
}

/**
 * Highest-rated players per position for each XI_SHAPE; the shape with the
 * best existing teamBlend wins (first listed shape on an exact tie). Returns
 * null when no shape can be filled from the candidates.
 */
export function pickXI(candidates: RankedPlayer[], ctx: ScoringContext): XiPick | null {
  const pool = candidates.filter((c) => c.xiEligible).sort(compareRanked);
  const byRole = new Map<EvaluationRole, RankedPlayer[]>();
  for (const r of ROLES) byRole.set(r, pool.filter((c) => c.role === r));
  let best: { score: number; xi: RankedPlayer[]; shape: XiCounts } | null = null;
  // Exactly one all-rounder (owner, 2026-10-03): try the one-all-rounder shapes first, and only fall
  // back to the others if the pool cannot fill one of them.
  const oneAllRounder = XI_SHAPES.filter((sh) => sh['all-rounder'] === 1);
  const orders = [oneAllRounder, XI_SHAPES];
  for (const shapes of orders) {
    if (best !== null) break;
    best = bestShape(shapes);
  }
  function bestShape(shapes: readonly XiCounts[]): { score: number; xi: RankedPlayer[]; shape: XiCounts } | null {
  let found: { score: number; xi: RankedPlayer[]; shape: XiCounts } | null = null;
  for (const shape of shapes) {
    let feasible = true;
    const xi: RankedPlayer[] = [];
    for (const role of SHAPE_ORDER) {
      const need = shape[role];
      const have = byRole.get(role)!;
      if (have.length < need) {
        feasible = false;
        break;
      }
      xi.push(...have.slice(0, need));
    }
    if (!feasible) continue;
    const score = teamBlend(
      xi.map((x) => ({ player: x.player, declaredRole: x.role })),
      ctx,
    ).score;
    if (found === null || score > found.score) found = { score, xi, shape };
  }
  return found;
  }
  if (!best) return null;
  const used = new Set(best.xi.map((x) => x.player.id));
  const bench: RankedPlayer[] = [];
  for (const role of SHAPE_ORDER) {
    const next = byRole.get(role)!.find((c) => !used.has(c.player.id));
    if (next) bench.push(next);
  }
  return { xi: best.xi, bench, shape: best.shape };
}

// ---------------------------------------------------------------------------
// Display rows (real career stats only)
// ---------------------------------------------------------------------------

export interface Column {
  key: string;
  label: string;
}

export interface Row {
  id: string;
  name: string;
  nation: string;
  role: EvaluationRole;
  roleLabel: string;
  /** "1990s, 2000s" */
  played: string;
  /** Column values, aligned to the page's columns. */
  values: string[];
  /** One-line summary used in compact tables. */
  statLine: string;
}

const num = (v: number | undefined): string =>
  v === undefined || !Number.isFinite(v) ? 'n/a' : Number(v.toFixed(2)).toLocaleString('en-US');
const int = (v: number | undefined): string =>
  v === undefined || !Number.isFinite(v) ? 'n/a' : Math.round(v).toLocaleString('en-US');
const bowlAvg = (v: number | undefined): string =>
  v === undefined || !Number.isFinite(v) || v <= 0 ? 'n/a' : num(v);

const BATTING_COLS: Column[] = [
  { key: 'tests', label: 'Tests' },
  { key: 'runs', label: 'Runs' },
  { key: 'bat', label: 'Bat avg' },
  { key: 'hundreds', label: '100s' },
];
const BOWLING_COLS: Column[] = [
  { key: 'tests', label: 'Tests' },
  { key: 'wkts', label: 'Wkts' },
  { key: 'bowl', label: 'Bowl avg' },
  { key: 'five', label: '5W' },
  { key: 'ten', label: '10W' },
];
const AR_COLS: Column[] = [
  { key: 'tests', label: 'Tests' },
  { key: 'runs', label: 'Runs' },
  { key: 'bat', label: 'Bat avg' },
  { key: 'hundreds', label: '100s' },
  { key: 'wkts', label: 'Wkts' },
  { key: 'bowl', label: 'Bowl avg' },
  { key: 'five', label: '5W' },
];

export function columnsForRole(role: EvaluationRole): Column[] {
  if (role === 'wicketkeeper') return [...BATTING_COLS, { key: 'dismissals', label: 'Dismissals' }];
  if (role === 'all-rounder') return AR_COLS;
  if (role === 'spinner' || role === 'fast-bowler') return BOWLING_COLS;
  return BATTING_COLS;
}

function cellFor(key: string, p: NormalizedPlayer): string {
  const s = p.stats;
  switch (key) {
    case 'tests': return int(s.testMatches);
    case 'runs': return int(s.testRuns);
    case 'bat': return num(s.testAverage);
    case 'hundreds': return int(s.testCenturies);
    case 'wkts': return int(s.testWickets);
    case 'bowl': return bowlAvg(s.testBowlingAverage);
    case 'five': return int(s.fiveWs);
    case 'ten': return int(s.tenWs);
    case 'dismissals': return int(s.dismissals);
    default: return 'n/a';
  }
}

function statLineFor(r: RankedPlayer): string {
  const s = r.player.stats;
  const tests = `${int(s.testMatches)} Tests`;
  const batting = `${int(s.testRuns)} runs at ${num(s.testAverage)}, ${int(s.testCenturies)} hundreds`;
  const bowling = `${int(s.testWickets)} wickets at ${bowlAvg(s.testBowlingAverage)}, ${int(s.fiveWs)} five-wicket hauls`;
  if (r.role === 'all-rounder') return `${tests}; ${batting}; ${bowling}`;
  if (r.role === 'spinner' || r.role === 'fast-bowler') return `${tests}; ${bowling}`;
  if (r.role === 'wicketkeeper') return `${tests}; ${batting}; ${int(s.dismissals)} dismissals`;
  return `${tests}; ${batting}`;
}

const playedLabel = (eras: string[]): string =>
  eras.map((e) => (e === 'legends' ? 'Legends' : e)).join(', ');

export function toRow(r: RankedPlayer, columns: Column[]): Row {
  return {
    id: r.player.id,
    name: r.player.name,
    nation: r.player.nation,
    role: r.role,
    roleLabel: ROLE_SINGULAR[r.role],
    played: playedLabel(r.uni.eras),
    values: columns.map((c) => cellFor(c.key, r.player)),
    statLine: statLineFor(r),
  };
}

// ---------------------------------------------------------------------------
// Page models
// ---------------------------------------------------------------------------

export interface Crumb {
  name: string;
  path: string;
}

export interface LinkItem {
  label: string;
  path: string;
}

interface PageBase {
  path: string;
  title: string;
  description: string;
  h1: string;
  /** Short line above the H1. */
  eyebrow: string;
  breadcrumbs: Crumb[];
  /** Intro paragraphs generated from data. */
  intro: string[];
  related: { heading: string; links: LinkItem[] }[];
  /** "Career Test totals ... as of {date}." */
  asOf: string;
  jsonLd: Record<string, unknown>[];
}

export interface XiPage extends PageBase {
  kind: 'xi';
  scope: XiScope;
  slug: string;
  xi: Row[];
  bench: Row[];
  /** "2 openers, 3 middle-order batters, ..." */
  shapeText: string;
  poolLine: string;
  nationsLine: string;
  /** Number of players in the filtered pool. */
  poolSize: number;
}

export interface ListPage extends PageBase {
  kind: 'list';
  role: EvaluationRole;
  columns: Column[];
  rows: Row[];
  methodNote: string;
}

export interface HubPage extends PageBase {
  kind: 'hub';
  entries: { label: string; path: string; blurb: string }[];
}

export type SeoPage = XiPage | ListPage | HubPage;

export const formatBuildDate = (d: Date): string =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const absolute = (path: string): string => `${SITE_URL}${path}`;

export function breadcrumbLd(crumbs: Crumb[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: absolute(c.path),
    })),
  };
}

export function itemListLd(
  name: string,
  items: { name: string; url: string }[],
  ordered: boolean,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    itemListOrder: ordered
      ? 'https://schema.org/ItemListOrderAscending'
      : 'https://schema.org/ItemListUnordered',
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      url: it.url,
    })),
  };
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

function shapeTextOf(shape: XiCounts): string {
  const parts = SHAPE_ORDER.filter((r) => shape[r] > 0).map((r) =>
    plural(shape[r], ROLE_SINGULAR[r], ROLE_PLURAL[r]),
  );
  return parts.length > 1
    ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
    : parts.join('');
}

/** Methodology sentence assembled from the engine's own metric labels. */
export function methodText(): string {
  const label = (k: string) => METRICS.find((m) => m.key === k)!.label.toLowerCase();
  const bat = ROLE_METRICS.opener.map(label).join(', ');
  const bowl = ROLE_METRICS['fast-bowler'].map(label).join(', ');
  return (
    `Our ratings use seven career measures. Openers, middle-order batters and wicketkeepers are rated on ${bat}. ` +
    `Spinners and fast bowlers are rated on ${bowl}. All-rounders are rated on all seven. ` +
    'Every player is ranked against the whole database, and players with short careers are weighted toward the average so a hot streak cannot outrank a long career.'
  );
}

const asOfLine = (date: string): string =>
  `Career Test totals from the ${SITE_NAME} database, as of ${date}.`;

/** Links to published pages only, so there are no dead ends. */
function xiLinks(exceptSlug?: string): LinkItem[] {
  return PUBLISHED_XI_SLUGS.filter((s) => s !== exceptSlug).map((s) => ({
    label: xiLabelForSlug(s),
    path: xiPath(s),
  }));
}
function roleLinks(exceptRole?: EvaluationRole): LinkItem[] {
  return PUBLISHED_ROLES.filter((r) => r !== exceptRole).map((r) => ({
    label: ROLE_TITLE[r],
    path: rolePath(r),
  }));
}

export function xiLabelForSlug(slug: string): string {
  if (slug === ALL_TIME_SLUG) return 'Best all-time Test XI';
  if ((ERA_IDS as readonly string[]).includes(slug)) {
    return slug === 'legends' ? 'Best Test XI of the Legends era' : `Best Test XI of the ${slug}`;
  }
  const nation = NATIONS.find((n) => nationSlug(n) === slug);
  return nation ? `Best ${NATION_ADJECTIVE[nation]} Test XI` : slug;
}

export function buildXiPage(
  data: SeoData,
  scope: XiScope,
  date: string,
): XiPage | null {
  const pool = data.ranked.filter((r) => matchesScope(r, scope) && (r.player.stats.testMatches ?? 0) >= SEO_MIN_TESTS);
  const pick = pickXI(pool, data.ctx);
  if (!pick) return null;
  const slug = scopeSlug(scope);
  const path = xiPath(slug);
  const label = xiLabelForSlug(slug);

  let title: string;
  let description: string;
  let h1: string;
  let scopeLine: string;
  if (scope.kind === 'all-time') {
    title = `Best All-Time Test XI, by Our Ratings | ${SITE_NAME}`;
    h1 = 'Best All-Time Test XI';
    description = `Our highest-rated all-time Test XI from ${pool.length} players with ${SEO_MIN_TESTS}+ Tests, with career stats for each pick. Then draft your own and see if it beats mine.`;
    scopeLine = `This is the top-rated player at each position from the ${pool.length} Test players in the ${SITE_NAME} database who played at least ${SEO_MIN_TESTS} Tests, with one all-rounder in the side.`;
  } else if (scope.kind === 'era') {
    const el = eraLabel(scope.era);
    title = `Best Test XI of ${el}, by Our Ratings | ${SITE_NAME}`;
    h1 = `Best Test XI of ${el}`;
    description = `Our highest-rated Test XI of ${el}, from ${pool.length} players with ${SEO_MIN_TESTS}+ Tests, with career stats for each pick. Draft yours and see if it beats mine.`;
    scopeLine = `Players are included if they played in ${el} and have at least ${SEO_MIN_TESTS} Tests: ${pool.length} players in the ${SITE_NAME} database, with one all-rounder in the side. Ratings use each player's full Test career, not only those years.`;
  } else {
    const adj = NATION_ADJECTIVE[scope.nation];
    title = `Best ${adj} Test XI, by Our Ratings | ${SITE_NAME}`;
    h1 = `Best ${adj} Test XI`;
    description = `Our highest-rated ${adj} Test XI from ${pool.length} ${adj} players with ${SEO_MIN_TESTS}+ Tests, with career stats for each pick. Draft yours and see if it beats mine.`;
    scopeLine = `The pool is the ${pool.length} ${adj} players in the ${SITE_NAME} database with at least ${SEO_MIN_TESTS} Tests, across every era, with one all-rounder in the side.`;
  }

  const xi = pick.xi.map((r) => toRow(r, columnsForRole(r.role)));
  const bench = pick.bench.map((r) => toRow(r, columnsForRole(r.role)));

  const nationCounts = new Map<string, number>();
  for (const r of pick.xi) nationCounts.set(r.player.nation, (nationCounts.get(r.player.nation) ?? 0) + 1);
  const nationEntries = [...nationCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const nationsLine =
    scope.kind === 'nation'
      ? `All eleven players are from ${scope.nation}.`
      : `This XI draws on ${plural(nationEntries.length, 'nation', 'nations')}: ${nationEntries.map(([n, c]) => `${n} (${c})`).join(', ')}.`;

  const poolCounts = ROLES.map((role) => ({
    role,
    n: pool.filter((p) => p.role === role).length,
  })).filter((x) => x.n > 0);
  const poolLine = `Pool by position: ${poolCounts.map((x) => `${x.n} ${x.n === 1 ? ROLE_SINGULAR[x.role] : ROLE_PLURAL[x.role]}`).join(', ')}.`;

  const shapeText = shapeTextOf(pick.shape);
  const intro = [
    `${scopeLine} The XI has ${shapeText}, picked by our ratings: the highest-rated players at each position, in whichever of the three XI shapes in the game rates best as a team.`,
    nationsLine,
  ];

  const breadcrumbs: Crumb[] = [
    { name: 'Home', path: '/' },
    { name: 'Best Test XIs', path: XI_HUB_PATH },
    { name: label, path },
  ];
  const itemName = `${label}, by our ratings`;
  const jsonLd = [
    breadcrumbLd(breadcrumbs),
    itemListLd(
      itemName,
      pick.xi.map((r) => ({ name: r.player.name, url: `${absolute(path)}#player-${r.player.id}` })),
      true,
    ),
  ];

  return {
    kind: 'xi',
    scope,
    slug,
    path,
    title,
    description,
    h1,
    eyebrow: 'Test XI, by our ratings',
    breadcrumbs,
    intro,
    xi,
    bench,
    shapeText,
    poolLine,
    nationsLine,
    poolSize: pool.length,
    related: [
      { heading: 'More Test XIs', links: [{ label: 'All Test XIs', path: XI_HUB_PATH }, ...xiLinks(slug)] },
      { heading: 'Best by position', links: roleLinks() },
    ],
    asOf: asOfLine(date),
    jsonLd,
  };
}

export function buildListPage(data: SeoData, role: EvaluationRole, date: string): ListPage | null {
  const list = data.ranked.filter((r) => r.role === role);
  if (list.length === 0) return null;
  const columns = columnsForRole(role);
  const rows = list.map((r) => toRow(r, columns));
  const path = rolePath(role);
  const plur = ROLE_PLURAL[role];
  const lead = ROLE_TITLE[role];
  const title = `${lead} by Our Ratings | ${SITE_NAME}`;
  const h1 = lead;
  const top = Math.min(10, list.length);
  const description = `All ${list.length} Test ${plur} in our database ranked by our ratings, with career stats. Then draft your own XI and see if it beats mine.`;

  const metrics = ROLE_METRICS[role].map((k) => METRICS.find((m) => m.key === k)!.label.toLowerCase());
  const methodNote =
    role === 'wicketkeeper'
      ? `Wicketkeepers are rated on batting only (${metrics.join(', ')}). Dismissals are shown for information and are not part of the rating.`
      : role === 'all-rounder'
        ? `All-rounders are rated on batting and bowling together (${metrics.join(', ')}).`
        : role === 'spinner' || role === 'fast-bowler'
          ? `${capitalize(plur)} are rated on bowling only (${metrics.join(', ')}).`
          : `${capitalize(plur)} are rated on batting only (${metrics.join(', ')}).`;

  const intro = [
    `${list.length} ${plur} from the ${data.populationSize} Test players in the ${SITE_NAME} database, ranked by our ratings. The first ${top} are the top ${top}.`,
    methodNote,
  ];
  const breadcrumbs: Crumb[] = [
    { name: 'Home', path: '/' },
    { name: 'Greatest Test players by position', path: ROLE_HUB_PATH },
    { name: lead, path },
  ];
  const jsonLd = [
    breadcrumbLd(breadcrumbs),
    itemListLd(
      `${lead}, by our ratings`,
      list.map((r) => ({ name: r.player.name, url: `${absolute(path)}#player-${r.player.id}` })),
      true,
    ),
  ];
  return {
    kind: 'list',
    role,
    path,
    title,
    description,
    h1,
    eyebrow: 'Ranked by our ratings',
    breadcrumbs,
    intro,
    columns,
    rows,
    methodNote,
    related: [
      { heading: 'More by position', links: [{ label: 'All positions', path: ROLE_HUB_PATH }, ...roleLinks(role)] },
      { heading: 'Best Test XIs', links: [{ label: 'All Test XIs', path: XI_HUB_PATH }, ...xiLinks()] },
    ],
    asOf: asOfLine(date),
    jsonLd,
  };
}

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export function buildXiHub(xiPages: XiPage[], date: string): HubPage {
  const path = XI_HUB_PATH;
  const entries = xiPages.map((p) => ({
    label: p.h1,
    path: p.path,
    blurb: `Highest-rated XI from ${p.poolSize} players.`,
  }));
  const breadcrumbs: Crumb[] = [
    { name: 'Home', path: '/' },
    { name: 'Best Test XIs', path },
  ];
  return {
    kind: 'hub',
    path,
    title: `Best Test XIs by Era and Nation, by Our Ratings | ${SITE_NAME}`,
    description: `Our highest-rated Test XIs: all-time, by era and by nation, built from career stats of ${xiPages[0]?.poolSize ?? 0} players. Then draft your own.`,
    h1: 'Best Test XIs',
    eyebrow: 'By our ratings',
    breadcrumbs,
    intro: [
      `Each XI is the highest-rated player at every position from the ${SITE_NAME} database, using our ratings and full Test career numbers.`,
    ],
    entries,
    related: [{ heading: 'Best by position', links: [{ label: 'All positions', path: ROLE_HUB_PATH }, ...roleLinks()] }],
    asOf: asOfLine(date),
    jsonLd: [
      breadcrumbLd(breadcrumbs),
      itemListLd('Best Test XIs, by our ratings', entries.map((e) => ({ name: e.label, url: absolute(e.path) })), false),
    ],
  };
}

export function buildRoleHub(listPages: ListPage[], date: string): HubPage {
  const path = ROLE_HUB_PATH;
  const entries = listPages.map((p) => ({
    label: p.h1,
    path: p.path,
    blurb: `${p.rows.length} ranked, led by ${p.rows[0]?.name ?? 'n/a'}.`,
  }));
  const breadcrumbs: Crumb[] = [
    { name: 'Home', path: '/' },
    { name: 'Greatest Test players by position', path },
  ];
  return {
    kind: 'hub',
    path,
    title: `Greatest Test Players by Position, by Our Ratings | ${SITE_NAME}`,
    description: 'Test openers, wicketkeepers, spinners and fast bowlers ranked by our ratings, with career stats for every player. Then draft your own XI.',
    h1: 'Greatest Test Players by Position',
    eyebrow: 'Ranked by our ratings',
    breadcrumbs,
    intro: [
      `Every list ranks players from the ${SITE_NAME} database by our ratings, using full Test career numbers.`,
    ],
    entries,
    related: [{ heading: 'Best Test XIs', links: [{ label: 'All Test XIs', path: XI_HUB_PATH }, ...xiLinks()] }],
    asOf: asOfLine(date),
    jsonLd: [
      breadcrumbLd(breadcrumbs),
      itemListLd('Greatest Test players by position, by our ratings', entries.map((e) => ({ name: e.label, url: absolute(e.path) })), false),
    ],
  };
}

export interface PublishedPages {
  xi: XiPage[];
  lists: ListPage[];
  xiHub: HubPage;
  roleHub: HubPage;
  all: SeoPage[];
}

/** The 12 approved pages. Throws if a published page cannot be built (never a stub). */
export function buildPublishedPages(data: SeoData, date: string): PublishedPages {
  const xi: XiPage[] = [];
  for (const slug of PUBLISHED_XI_SLUGS) {
    const scope = allXiScopes().find((s) => scopeSlug(s) === slug);
    if (!scope) throw new Error(`[seo-pages] unknown published XI slug: ${slug}`);
    const page = buildXiPage(data, scope, date);
    if (!page) throw new Error(`[seo-pages] no feasible XI for published page: ${slug}`);
    xi.push(page);
  }
  const lists: ListPage[] = [];
  for (const role of PUBLISHED_ROLES) {
    const page = buildListPage(data, role, date);
    if (!page) throw new Error(`[seo-pages] empty list for published page: ${role}`);
    lists.push(page);
  }
  const xiHub = buildXiHub(xi, date);
  const roleHub = buildRoleHub(lists, date);
  return { xi, lists, xiHub, roleHub, all: [xiHub, ...xi, roleHub, ...lists] };
}
