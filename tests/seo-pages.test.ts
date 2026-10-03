/**
 * Tests for the SEO content page models (src/lib/seo-pages.ts):
 * dedupe, role overrides, ranking determinism, exclusion of incomplete
 * players, XI validity and URL / metadata generation.
 */
import {
  PUBLISHED_ROLES,
  PUBLISHED_XI_SLUGS,
  ROLES,
  ROLE_OVERRIDES,
  ROLE_SLUGS,
  SEO_MIN_TESTS,
  allXiScopes,
  buildListPage,
  buildPopulation,
  buildPublishedPages,
  buildSeoData,
  buildXiPage,
  compareRanked,
  matchesScope,
  nationSlug,
  pickXI,
  scopeSlug,
} from '../src/lib/seo-pages';
import { allPlayersByEra, ERA_IDS, NATIONS, XI_SHAPES, normalizePlayer } from '../src/lib/player-store';
import type { RawPlayer } from '../src/lib/player-store';
import { scorePlayer } from '../src/lib/seven-metrics';

let pass = 0, fail = 0;
const ok = (cond: boolean, name: string, extra?: unknown) => {
  if (cond) pass++;
  else { fail++; console.log(`FAIL: ${name}`, extra ?? ''); }
};

const DATE = '1 January 2026';
const byEra = allPlayersByEra();
const data = buildSeoData(byEra);

// ---- dedupe ----
const rawIds = new Set<string>();
for (const era of ERA_IDS) for (const p of byEra[era]) rawIds.add(p.id);
const pop = buildPopulation(byEra);
ok(pop.players.length === rawIds.size, 'population has one entry per unique id', [pop.players.length, rawIds.size]);
ok(new Set(pop.players.map((u) => u.player.id)).size === pop.players.length, 'no duplicate ids in population');
{
  // first era file wins: the kept record's displayEra file is the first file listing the id
  let firstWins = true;
  for (const u of pop.players) {
    const firstFile = ERA_IDS.find((e) => byEra[e].some((p) => p.id === u.player.id))!;
    if (u.records[0].file !== firstFile) firstWins = false;
  }
  ok(firstWins, 'first era file wins the dedupe');
}
ok(data.populationSize === rawIds.size, 'populationSize counts unique players');

// ---- role conflicts and owner overrides ----
{
  const ids = data.conflicts.map((c) => c.id).sort();
  const expected = Object.keys(ROLE_OVERRIDES).filter((k) => k !== 'don-bradman').sort();
  ok(JSON.stringify(ids) === JSON.stringify(expected), 'exactly the five owner-decided data conflicts exist', ids);
  ok(data.conflicts.every((c) => c.overridden), 'every real conflict has an owner override');
  ok(!ids.includes('dale-steyn') && !ids.includes('roston-chase'), 'format-only role differences are not conflicts');
  const roleOf = (id: string) => data.ranked.find((r) => r.player.id === id)?.role;
  ok(roleOf('manoj-prabhakar') === 'opener', 'Prabhakar is an opener');
  ok(roleOf('hamilton-masakadza') === 'opener', 'Masakadza is an opener');
  ok(roleOf('brendan-taylor') === 'wicketkeeper', 'Taylor is a wicketkeeper');
  ok(roleOf('rohit-sharma') === 'opener', 'Rohit Sharma is an opener');
  ok(roleOf('usman-khawaja') === 'middle-order', 'Khawaja is middle-order');
  ok(roleOf('dale-steyn') === 'fast-bowler', 'Steyn is a fast bowler');
  ok(roleOf('don-bradman') === 'middle-order', 'Bradman is middle-order (owner reclassification)');
  ok(!ids.includes('don-bradman'), 'Bradman reclassification is not a data conflict');
  ok(buildPopulation(byEra, {}).players.find((u) => u.player.id === 'don-bradman')!.player.primaryRole === 'opener', 'without overrides Bradman stays opener (data untouched)');
  let threw2 = false;
  try { buildPopulation(byEra, { 'don-bradman': { role: 'spinner', file: 'owner', note: 'bogus' } }); } catch { threw2 = true; }
  ok(threw2, 'reclassifying to a role not in the data throws');
  const bad = { 'rohit-sharma': { role: 'spinner', file: '2020s', note: 'bogus' } };
  let threw = false;
  try { buildPopulation(byEra, bad); } catch { threw = true; }
  ok(threw, 'an override that matches no era record throws');
  const none = buildPopulation(byEra, {});
  ok(none.players.find((u) => u.player.id === 'rohit-sharma')!.player.primaryRole === 'middle-order', 'without overrides first file wins (Rohit = middle-order)');
}

// ---- ranking determinism and engine reuse ----
{
  const again = buildSeoData(allPlayersByEra());
  ok(JSON.stringify(again.ranked.map((r) => [r.player.id, r.role, r.score])) ===
     JSON.stringify(data.ranked.map((r) => [r.player.id, r.role, r.score])), 'ranking is identical across builds');
  let sorted = true;
  for (let i = 1; i < data.ranked.length; i++) if (compareRanked(data.ranked[i - 1], data.ranked[i]) > 0) sorted = false;
  ok(sorted, 'ranked list is sorted by the comparator');
  ok(data.ranked.every((r) => r.score === scorePlayer(r.player, r.role, data.ctx).score), 'scores come straight from scorePlayer');
  // comparator tie-break: equal score -> more Tests first -> id ascending
  const a = { ...data.ranked[0], score: 50, player: { ...data.ranked[0].player, id: 'b', stats: { ...data.ranked[0].player.stats, testMatches: 10 } } };
  const b = { ...data.ranked[0], score: 50, player: { ...data.ranked[0].player, id: 'a', stats: { ...data.ranked[0].player.stats, testMatches: 10 } } };
  const c = { ...data.ranked[0], score: 50, player: { ...data.ranked[0].player, id: 'z', stats: { ...data.ranked[0].player.stats, testMatches: 20 } } };
  ok(compareRanked(c, b) < 0 && compareRanked(b, a) < 0 && compareRanked(a, b) > 0, 'tie-break: Tests desc then id asc');
}

// ---- exclusion of incomplete players (never zero-filled) ----
{
  const stats = (o: Record<string, number> = {}) => ({
    testAverage: 40, testRuns: 4000, testWickets: 0, testMatches: 80, testCenturies: 10, testFifties: 20,
    fiveWs: 0, tenWs: 0, testBowlingAverage: 0, battingStrikeRate: 50, bowlingStrikeRate: 0, dismissals: 30, ...o,
  });
  const mk = (id: string, role: string, o: Record<string, number> = {}): RawPlayer => ({
    id, name: id, nation: 'India', era: ['1990s'], primaryRole: role, stats: stats(o),
  } as unknown as RawPlayer);
  const raws = [
    mk('ok-open', 'Opener'),
    mk('ok-open2', 'Opener', { testAverage: 45 }),
    mk('ok-mid', 'Middle-order', { testAverage: 35 }),
    mk('zero-matches', 'Opener', { testMatches: 0 }),
    mk('weird-role', 'Umpire'),
    mk('bowler-no-avg', 'Fast bowler', { testWickets: 100, testBowlingAverage: 0 }),
    mk('ok-bowler', 'Fast bowler', { testWickets: 150, testBowlingAverage: 25, fiveWs: 8, tenWs: 1 }),
  ];
  const fixture: Record<string, ReturnType<typeof normalizePlayer>[]> = {};
  for (const e of ERA_IDS) fixture[e] = [];
  fixture['1990s'] = raws.map((r) => normalizePlayer(r, '1990s'));
  const d = buildSeoData(fixture, {});
  const ex = new Map(d.excluded.map((e) => [e.id, e.reason]));
  ok(ex.has('zero-matches'), 'zero-match player is excluded', [...ex]);
  ok(ex.has('weird-role'), 'unknown role is excluded, not defaulted');
  ok(ex.has('bowler-no-avg'), 'bowler with no bowling average is excluded');
  ok(!ex.has('ok-open') && !ex.has('ok-bowler'), 'complete players are kept');
  const keptIds = d.ranked.map((r) => r.player.id);
  ok(!keptIds.includes('zero-matches') && !keptIds.includes('weird-role') && !keptIds.includes('bowler-no-avg'), 'excluded players never appear in rankings');
  const lp = buildListPage(d, 'opener', DATE)!;
  ok(lp.rows.length === 2 && lp.rows.every((r) => r.name !== 'zero-matches'), 'list page omits the excluded opener', lp.rows.map((r) => r.name));
  ok(buildListPage(d, 'spinner', DATE) === null, 'a role with no ranked players yields no page (no stubs)');
  ok(buildXiPage(d, { kind: 'all-time' }, DATE) === null, 'an unfillable XI yields no page (no stubs)');
}

// ---- the real data: nobody who should be ranked is excluded ----
ok(data.excluded.length === 0, 'no player is excluded from the real data', data.excluded);
ok(data.ranked.length === data.populationSize, 'every unique player is ranked');

// ---- XI validity across every scope the generator knows ----
const keeperRoles = ['wicketkeeper'];
let feasibleScopes = 0;
for (const scope of allXiScopes()) {
  const page = buildXiPage(data, scope, DATE);
  if (!page) continue;
  feasibleScopes++;
  const pool = data.ranked.filter((r) => matchesScope(r, scope) && (r.player.stats.testMatches ?? 0) >= SEO_MIN_TESTS);
  const pick = pickXI(pool, data.ctx)!;
  const slug = scopeSlug(scope);
  // Owner, 2026-10-03: best-XI pages only use players with SEO_MIN_TESTS+ Tests, and keep exactly one
  // all-rounder whenever the pool can fill a one-all-rounder shape.
  ok(pick.xi.every((p) => (p.player.stats.testMatches ?? 0) >= SEO_MIN_TESTS), `${slug}: every player has ${SEO_MIN_TESTS}+ Tests`);
  const eligible = pool.filter((c) => c.xiEligible);
  const canOneAR = XI_SHAPES.some((sh) => sh['all-rounder'] === 1 && ROLES.every((r) => eligible.filter((c) => c.role === r).length >= (sh[r] ?? 0)));
  if (canOneAR) ok(pick.xi.filter((p) => p.role === 'all-rounder').length === 1, `${slug}: exactly one all-rounder when the pool allows`);
  ok(pick.xi.length === 11 && new Set(pick.xi.map((p) => p.player.id)).size === 11, `${slug}: 11 distinct players`);
  const counts: Record<string, number> = {};
  for (const p of pick.xi) counts[p.role] = (counts[p.role] ?? 0) + 1;
  ok(XI_SHAPES.some((s) => ROLES.every((r) => (s[r] ?? 0) === (counts[r] ?? 0))), `${slug}: composition is a valid XI shape`, counts);
  ok(pick.xi.filter((p) => keeperRoles.includes(p.role)).length === 1, `${slug}: exactly one wicketkeeper`);
  ok(pick.xi.every((p) => matchesScope(p, scope)), `${slug}: every player matches the scope`);
  ok(pick.bench.every((b) => !pick.xi.some((x) => x.player.id === b.player.id)), `${slug}: bench is disjoint from the XI`);
  ok(page.xi.length === 11 && page.slug === slug, `${slug}: page model has 11 rows`);
}
ok(feasibleScopes >= 12, 'most scopes can fill an XI', feasibleScopes);

// ---- published pages: URLs, metadata, JSON-LD ----
const pages = buildPublishedPages(data, DATE);
const paths = pages.all.map((p) => p.path).sort();
const expectedPaths = [
  '/best-xi/', '/best-xi/all-time/', '/best-xi/legends/', '/best-xi/1970s/', '/best-xi/1980s/', '/best-xi/1990s/',
  '/best-xi/2000s/', '/best-xi/2010s/', '/best-xi/2020s/',
  '/best-xi/india/', '/best-xi/england/', '/best-xi/australia/', '/best-xi/pakistan/', '/best-xi/south-africa/',
  '/best-xi/west-indies/', '/best-xi/new-zealand/', '/best-xi/sri-lanka/', '/best-xi/bangladesh/', '/best-xi/zimbabwe/',
  '/best/', '/best/openers/', '/best/middle-order-batters/', '/best/wicketkeepers/', '/best/all-rounders/',
  '/best/fast-bowlers/', '/best/spinners/',
].sort();
ok(JSON.stringify(paths) === JSON.stringify(expectedPaths), 'exactly the 26 phase-1 URLs', paths);
ok(pages.all.length === 26 && PUBLISHED_XI_SLUGS.length + PUBLISHED_ROLES.length + 2 === 26, 'phase 1 is 26 pages');
ok(new Set(paths).size === paths.length, 'URLs are unique');
ok(paths.every((p) => /^\/best(-xi)?\/([a-z0-9-]+\/)?$/.test(p)), 'URLs are lowercase, hyphenated, trailing slash');
{
  const eraSlugs = new Set<string>(ERA_IDS);
  ok(NATIONS.every((n) => !eraSlugs.has(nationSlug(n))), 'no era slug collides with a nation slug');
  ok(new Set(allXiScopes().map(scopeSlug)).size === allXiScopes().length, 'XI scope slugs are unique');
  ok(new Set(ROLES.map((r) => ROLE_SLUGS[r])).size === ROLES.length, 'role slugs are unique');
  ok(buildXiPage(data, allXiScopes().find((s) => scopeSlug(s) === 'new-zealand')!, DATE)?.path === '/best-xi/new-zealand/', 'multi-word nation slug is hyphenated');
}
const titles = pages.all.map((p) => p.title);
const descs = pages.all.map((p) => p.description);
const h1s = pages.all.map((p) => p.h1);
ok(new Set(titles).size === titles.length, 'titles are unique', titles);
ok(new Set(descs).size === descs.length, 'meta descriptions are unique');
ok(new Set(h1s).size === h1s.length, 'H1s are unique');
ok(titles.every((t) => t.length <= 70 && t.includes('Beat My 11')), 'titles are short and branded', titles.filter((t) => t.length > 70));
ok(descs.every((d) => d.length <= 165 && d.length >= 70), 'descriptions are 70-165 chars', descs.filter((d) => d.length > 165));
ok(pages.all.filter((p) => p.kind !== 'hub').every((p) => /by our ratings/i.test(p.title)), 'non-hub titles say "by our ratings"');
ok(pages.all.every((p) => !/objectively|greatest ever|best ever/i.test(p.title + p.description + p.intro.join(' '))), 'no "objectively best" claims');
for (const p of pages.all) {
  const text = JSON.stringify(p);
  ok(!/undefined|NaN|\{[a-zA-Z]+\}|"null"/.test(text.replace(/"@context"/g, '')), `${p.path}: no unresolved placeholders`);
  ok(p.asOf.includes(DATE), `${p.path}: shows the stats-as-of date`);
  const bc = p.jsonLd.find((o) => o['@type'] === 'BreadcrumbList') as { itemListElement: { position: number; item: string }[] };
  ok(!!bc && bc.itemListElement.every((e, i) => e.position === i + 1 && e.item.startsWith('https://beatmy11.com/')), `${p.path}: BreadcrumbList valid`);
  ok(bc.itemListElement[bc.itemListElement.length - 1].item === `https://beatmy11.com${p.path}`, `${p.path}: last breadcrumb is the page`);
  const il = p.jsonLd.find((o) => o['@type'] === 'ItemList') as { numberOfItems: number; itemListElement: unknown[] };
  ok(!!il && il.numberOfItems === il.itemListElement.length, `${p.path}: ItemList count matches`);
  if (p.kind === 'xi') ok(il.numberOfItems === 11, `${p.path}: XI ItemList has 11 items`);
  if (p.kind === 'list') ok(il.numberOfItems === p.rows.length, `${p.path}: list ItemList matches visible rows`);
  // internal links only to published pages (no dead ends) and /play CTA exists in layout
  const linkPaths = p.related.flatMap((g) => g.links.map((l) => l.path));
  ok(linkPaths.every((l) => expectedPaths.includes(l)), `${p.path}: related links all point at published pages`);
}
// no numeric ratings leak into page models
{
  const xi = pages.xi[0];
  ok(!('score' in xi.xi[0]) && !Object.keys(xi.xi[0]).some((k) => /score|rating/i.test(k)), 'XI rows carry no rating field');
  ok(!JSON.stringify(pages.all).match(/"score"|"rating"/), 'no rating numbers in any page model');
}
// content comes from data: every list row number matches the player's stats
{
  const list = pages.lists.find((l) => l.role === 'wicketkeeper')!;
  ok(list.columns.some((c) => c.label === 'Dismissals'), 'wicketkeeper list shows dismissals');
  ok(/batting only/.test(list.methodNote) && /not part of the rating/.test(list.methodNote), 'keeper note says rated on batting only');
  const top = data.ranked.filter((r) => r.role === 'wicketkeeper')[0];
  ok(list.rows[0].id === top.player.id, 'list order follows the ranking');
  ok(list.rows[0].values[0] === String(top.player.stats.testMatches), 'list row Tests equals the data field');
  ok(list.rows.length === data.ranked.filter((r) => r.role === 'wicketkeeper').length, 'list contains every ranked keeper');
}

console.log(`seo-pages tests: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
