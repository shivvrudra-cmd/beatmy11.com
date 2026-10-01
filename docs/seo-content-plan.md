# SEO content pages: plan (design only, nothing built)

Status: PLAN FOR OWNER REVIEW. No source code was changed. Facts below come from
the real JSON in `src/data/*.json` and from `player-store.ts`, `player-logic.ts`,
`seven-metrics.ts`, `opponent-xi.ts`, `BaseLayout.astro`, `astro.config.mjs`.

Goal: statically generated, data-backed pages that can rank for searches like
"best Test XI of the 1990s", "greatest Test openers", "best Test wicketkeepers",
"best Indian Test XI", and send readers into `/play`.

Hard rules this plan obeys (CLAUDE.md / PROJECT_CONTEXT.md section 9):
no invented data, no estimated stats, no invented scoring maths, owner decides
anything not already specified, work on a branch and PR only.

---

## 0. What the data actually is (measured, not assumed)

- 7 files, 790 records, but only **536 unique players** (id). 185 players appear in
  2 era files, 33 in 3, 5 in 4. The game and `/matchup` already dedupe by id with
  "first file wins" (order: legends, 1970s ... 2020s). All SEO code must use the
  same dedupe so that rankings match the game's rating context.
- Unique players per era tag (a player counts in every era in their `era[]`):
  legends 44, 1970s 76, 1980s 83, 1990s 118, 2000s 148, 2010s 171, 2020s 162.
- Unique players per nation: Australia 67, England 74, India 64, West Indies 57,
  Pakistan 65, South Africa 41, New Zealand 61, Sri Lanka 41, Bangladesh 30,
  Zimbabwe 36.
- Unique players per primary role: opener 115, middle-order 119, all-rounder 46,
  wicketkeeper 54, fast-bowler 136, spinner 66.
- Record fields: `id, name, nation, era (string | string[]), primaryRole,
  secondaryRoles, stats{testAverage, testRuns, testWickets, testMatches,
  testCenturies, testFifties, fiveWs, tenWs, testBowlingAverage,
  battingStrikeRate, bowlingStrikeRate, dismissals}`. All 12 stat keys are present
  on every unique player. There is NO batting hand, bowling arm, `isWicketkeeper`,
  birth date, debut year, bio or photo field in the files (PROJECT_CONTEXT section 7
  mentions some of these; the real JSON does not carry them). Copy can only use what
  exists.
- Stats are **career totals**, not per-decade. "Best XI of the 1990s" therefore
  means "best-rated players who played in the 1990s by their career numbers", and
  the page must say so (see risk R3).
- Role strings are inconsistently cased in the raw files ("Fast bowler",
  "Middle-order", "fast-bowler"). Always go through `normalizePlayer` /
  `normalizeRole`.
- The dataset is a curated 536, not every Test cricketer. Copy must say "of the
  536 Test players in the Beat My 11 database", never "of all Test players".

## 1. Page types, URLs, counts and search intent

All URLs lowercase, trailing slash canonical (Astro `build.format` default
directory output gives `/best-xi/1990s/index.html`).

| # | Type | URL | Pages | Search intent it targets |
|---|------|-----|-------|--------------------------|
| A | All-time XI | `/best-xi/all-time/` | 1 | "best all time test XI" (highest volume) |
| B | Era XI | `/best-xi/{legends,1970s,1980s,1990s,2000s,2010s,2020s}/` | 7 | "best test XI of the 1990s" |
| C | Nation XI | `/best-xi/{australia,bangladesh,england,india,new-zealand,pakistan,south-africa,sri-lanka,west-indies,zimbabwe}/` | 10 | "best Indian test XI", "best Australian test team of all time" |
| D | Role list | `/best/{openers,middle-order-batters,wicketkeepers,all-rounders,spinners,fast-bowlers}/` | 6 | "greatest test openers", "best test wicketkeepers" |
| E | Role x nation list (phase 2) | `/best/{role}/{nation}/` e.g. `/best/openers/india/` | up to 23 (threshold 10) | "best Indian Test openers" |
| F | Role x era list (phase 2) | `/best/{role}/{era}/` e.g. `/best/fast-bowlers/1990s/` | up to 31 (threshold 10) | "best fast bowlers of the 1990s" |
| G | Hubs | `/best-xi/` and `/best/` | 2 | navigation, "best test XI" head term, internal-link spine |
| H | Player pages (phase 3, optional) | `/players/{id}/` | up to 536 | "{player} test stats" |

Totals: MVP phase 1 = A+B+C+D+G = 26 pages. Phase 2 adds E+F (about 54 at
threshold 10, 91 at threshold 5). Phase 3 adds H.

Why each is distinct and not thin or duplicate:
- A, B, C answer different qualifiers (all-time / decade / country) and each shows
  a different 11. Overlap between XIs is expected (Bradman is in many) but the
  page's primary entity set differs, and each page carries its own ranked bench.
- D lists a whole role (15 to 25 ranked rows) which an XI page cannot; different
  intent ("who are the best openers" vs "pick me a team").
- E/F are only generated where the group has at least 10 ranked players so the page
  has a real ranked list. Smaller groups (e.g. Bangladesh wicketkeepers: 2) are NOT
  generated; they appear only as a row inside the nation XI. Threshold 10 gives
  23 role x nation and 31 role x era pages (counts at thresholds 5/8/10 were
  measured: 50/31/23 and 41/35/31). Threshold is an owner decision.
- Nation x era XI (e.g. "best Indian XI of the 1990s") is NOT planned: pools are
  too thin (India 1990s has 13 players; India has only 12 fast bowlers across all
  eras, so many combos cannot fill an XI shape).
- H is deferred: with only 12 stat fields and no bio, player pages risk being thin
  against entrenched sites. Revisit after measuring A to F.

Slug rules: nation slugs are the lowercased hyphenated `NATIONS` values; era slugs
are the `ERA_IDS` values. In the single `[slug]` route for B and C, a build-time
assertion must prove era slugs and nation slugs never collide (they cannot today).

Skip-rather-than-stub rule: a page is generated only if its data supports it (an
XI page needs at least one feasible entry from `XI_SHAPES`; a list page needs the
threshold). No empty or "coming soon" pages, ever.

## 2. Per page type: data, ranking, templates, copy, linking, JSON-LD, sitemap

### 2.0 Shared ranking engine (no new rules)

Reuse exactly what `/matchup` does:

1. Build the player population the same way `matchup.astro` does: iterate
   `ERA_IDS`, `playersForEra(eraId)`, skip repeated `id` (first occurrence wins).
2. `ctx = buildScoringContext(population)` (V2 engine, shrinkage prior 30 Tests).
3. A player's rating = `scorePlayer(player, role, ctx).score` (0 to 100, one decimal).
   Role = the player's normalized `primaryRole` (see decision D4).
4. Players whose `score` is `null` (an applicable metric is uncomputable) are
   excluded from every ranking and listed in a build-time report. Never zero-filled.
5. Build-time `auditMetrics` runs on the whole population and the build FAILS on any
   gap among players that would be ranked, mirroring `IncompletePlayerData`.

Ranking within a list (D, E, F): descending `score`. Tie-break is NOT defined by the
owner; a deterministic tiebreak is needed so builds are stable. Proposal: unrounded
score, then `testMatches` descending, then `id` ascending. FLAG: owner decision D6
(this is new behaviour, small, but not specified).

New code needed is selection and presentation only; it computes no new metric.

XI selection (A, B, C), which is a selection rule, not a scoring rule:
- Candidate pool = unique players matching the page filter (all / era tag / nation).
- Slots follow the existing positional system and `XI_SHAPES`: 2 openers, 3 middle
  order, 1 wicketkeeper, 3 fast bowlers, and two further spots filled as
  (2 all-rounders) or (1 all-rounder + 1 spinner) or (2 spinners).
- Within each role group take the top players by rating (rule above). For the
  remaining shape choice, evaluate each feasible shape's team score with the
  existing `teamBlend` (40% batting, 50% bowling, 10% fielding) and publish the
  highest. Nothing new is weighted; teamBlend is already owner-approved.
- Simplification flagged as decision D5: per-group top-N then pick shape by
  `teamBlend`, versus a full search maximising `teamBlend` (fielding couples
  groups, so greedy is not always exactly optimal). Recommend the simple, explainable
  version and say so on the page ("the highest-rated player at each position").
- A player is used once per XI and is placed in his own primary role (no
  re-declaration), so no "declared role collapse" cases (e.g. a specialist declared
  as all-rounder) can occur.
- No per-nation cap on era/all-time XIs (not specified; would be an invented rule).
  Mixed-nation XIs are the natural result and are stated as such in copy.
- XI page also shows a bench: next best 1 to 2 players per group (ranked list rows).
- The house XI (`opponent-xi.ts`) is hand-picked and deliberately tuned, not
  computed. A computed `/best-xi/all-time/` will not equal it. See decision D1.

Display of numbers (decision D2): `/play` deliberately shows real stats and no
ratings until the result screen. SEO pages would publish ratings and let players
look up the "best pick". Options: (a) rank order + real stats only, no numeric
rating (recommended default), (b) show the 0 to 100 rating. The plan below assumes
(a); switching to (b) is a template change only.

### 2.1 Page type A: `/best-xi/all-time/`

- Data: whole population; stats fields shown per role (below).
- Title: `Best All-Time Test XI: Ranked by 536 Players' Career Stats | Beat My 11`
  (kept under about 60 chars in production: `Best All-Time Test XI (Data-Ranked) | Beat My 11`).
- Meta: `The highest-rated all-time Test XI from {N} players, ranked on batting and
  bowling career stats. See the eleven, then draft your own and see if it beats mine.`
  ({N} is `population.length`).
- H1: `Best All-Time Test XI`
- Copy (all template-driven): intro sentence with N and the method name; the XI as a
  table in batting order (position, player, nation, role, key stats); a "How this XI
  was picked" paragraph stating the rule in D5 verbatim; a "Bench" list; a nation
  count line generated from the XI ("{k} nations represented: ...").
- Per-player row fields:
  - batters/keepers: `testMatches, testRuns, testAverage, testCenturies`, keepers
    also `dismissals`.
  - bowlers: `testMatches, testWickets, testBowlingAverage, fiveWs, tenWs`.
  - all-rounders: both sets.
  Label them "Tests", "Runs", "Bat avg", "100s", "Wkts", "Bowl avg", "5W", "10W",
  "Dismissals". A bowling average of 0 / missing is never printed (shown as "n/a"
  and the player excluded from ranking per rules above).
- No biography text. No claims like "greatest ever" beyond the ranked-by-method
  statement.
- CTA block: "Think you can pick better? Draft your own all-time XI and see if it
  beats Mine." Button to `/play`. Secondary links to `/best-xi/` hub, the era and
  nation XI pages, and the six role pages.

### 2.2 Page type B: `/best-xi/{era}/`

- Filter: `era` array contains the era id (the same membership test `spinCombos`
  uses). Legends = the existing "Legends" bucket (44 players); do not describe what
  qualifies a Legend beyond "the Legends era group in the database" (owner decision
  D7: is a plain-language definition available?).
- Title: `Best Test XI of the {1990s} | Beat My 11` (legends: `Best Test XI of the
  Legends Era | Beat My 11`).
- Meta: `The highest-rated Test XI of players who played in the {1990s}, chosen from
  {n} players using career batting and bowling stats. Draft yours and see if it
  beats mine.` ({n} = count of unique players whose `era` includes the era.)
- H1: `Best Test XI of the {1990s}`
- Copy: as A, plus an honest scope paragraph: "Players are included if they played
  in the {1990s}. Ratings use full Test career numbers, not just those years." Plus
  a nation tally generated from the XI, plus the era's pool size per role from the
  data ("{n} openers, {n} wicketkeepers ... in this era").
- Links: previous / next era, all-time XI, nation XIs for nations in this XI, role
  pages, `/play` CTA (copy: "Spin the {1990s} yourself").

### 2.3 Page type C: `/best-xi/{nation}/`

- Filter: `nation === X`, all eras.
- Title: `Best {Indian} Test XI of All Time | Beat My 11`. Use the nation adjective
  only from a fixed constant map the owner reviews (Australian, Bangladeshi,
  English, Indian, New Zealand, Pakistani, South African, Sri Lankan, West Indian,
  Zimbabwean). The map is a hand-written constant, not data; list it in the PR for
  review.
- Meta: `The highest-rated {nation} Test XI from {n} {nation} players in the
  database, ranked on career batting and bowling stats. Can your XI beat mine?`
- H1: `Best {Indian} Test XI of All Time`
- Copy: as A, plus the era spread of the XI generated from each player's `era`
  array, and the pool per role. For Bangladesh/Zimbabwe, which have thin groups (BAN
  wicketkeepers 2, ZIM middle order 4), the page prints the real pool sizes so the
  reader sees why choices are limited. If no shape is feasible the page is skipped.
- Links: sibling nation XIs, role x nation pages (phase 2), era XIs, `/play`.

### 2.4 Page type D: `/best/{role}/`

- Filter: normalized `primaryRole` equals the role. Primary role only. Secondary
  roles are ignored (decision D4), which keeps the engine's declared-role behaviour
  intact and avoids listing a batter on the bowlers page.
- Mapping slug to role: openers to `opener`, middle-order-batters to
  `middle-order`, wicketkeepers to `wicketkeeper`, all-rounders to `all-rounder`,
  spinners to `spinner`, fast-bowlers to `fast-bowler`.
- List: top 25 rows (or all if fewer), then a collapsed "full ranking" up to the
  entire role list (115 openers, 136 fast bowlers, etc.) so the page is a true
  reference list (decision D8: top-25 vs full list on one page; recommend full
  list, server-rendered, with top 10 visually prominent).
- Title: `Greatest Test {Openers}: Top {25} Ranked by Career Stats | Beat My 11`
  (per-role noun map: Openers, Middle-Order Batters, Wicketkeepers, All-Rounders,
  Spinners, Fast Bowlers). Keepers: `Best Test Wicketkeepers, Ranked | Beat My 11`.
- Meta: `The {top 25} Test {openers} in our database of {n}, ranked using career
  {batting} stats. See the list, then build your own XI.` ({batting}/{bowling}/
  {batting and bowling} comes from `ROLE_METRICS`).
- H1: `Greatest Test {Openers}`
- Role-specific honesty text, generated from the engine's role map:
  - wicketkeepers: "Wicketkeepers are rated on batting only. Dismissals are shown
    for information and are not part of the rating." (Directly true to
    `ROLE_METRICS`; fielding only enters the engine at team level.)
  - spinners / fast bowlers: "Rated on bowling only."
  - all-rounders: "Rated on batting and bowling together." (ARs are ranked against
    the same full populations as specialists, V2.)
- Methodology box on every page (shared component): lists the seven metrics from
  `METRICS` by name and which apply to this role. Metric names and role map are
  imported from `seven-metrics.ts` so copy can never drift from the engine. The
  75% metrics / 25% longevity and shrinkage details are NOT restated in marketing
  copy; link to a `/how-ratings-work/` page only if the owner wants one (decision
  D9).

### 2.5 Page types E and F (phase 2)

Same template as D with a narrowed filter. Ranking still uses the single global
population context (percentiles are never split by nation or era, per the spec).
Titles: `Best {Indian} Test Openers | Beat My 11`, `Best Fast Bowlers of the
{1990s} | Beat My 11`. Only generated at or above the player threshold. Lists are
shorter so each links to its parent D page and its sibling XI page.

### 2.6 Hubs (G)

`/best-xi/`: grid of all XI pages with generated one-liners ("{n} players, {k}
nations"). `/best/`: grid of role pages. Both link to `/play`. These carry
head-term titles ("Best Test XI Lists", "Greatest Test Cricketers by Role").

### 2.7 Internal linking to `/play`

- Every page: header link, in-content CTA card after the XI/list, footer link.
  CTA copy is varied per page type using the page's own facts, e.g. era page:
  "Spin {1990s} players into your own XI". The `/play` URL stays plain (no query
  params); a prefilled-era deep link would be a game change and is out of scope.
- Add `/best-xi/` (and `/best/`) to the home page and footer so link equity flows
  down. This touches shared components (implementation item).
- Breadcrumb trail and sibling/parent links as above; every page links to at
  least: hub, 3 related pages, `/play`.

### 2.8 JSON-LD

`BaseLayout.astro` today always emits one `WebApplication` block with the page
description and has NO canonical tag and NO robots meta. Planned (additive, small
layout change): optional `canonical`, optional `noindex`, and a way to pass extra
JSON-LD blocks (the existing site-wide `WebApplication` block stays).

Per page:
- `BreadcrumbList`: Home, then the hub (`/best-xi/` or `/best/`), then the page.
- `ItemList` (`itemListOrder: https://schema.org/ItemListOrderDescending` for
  ranked lists, `Unordered` for an XI in batting order), `numberOfItems`, and
  `itemListElement` of `ListItem` with `position` and `name` (the player name).
  Items point at `#player-{id}` fragment anchors on the same page; no per-player URL
  exists in phase 1. In phase 3, items get `url` to `/players/{id}/`.
- Do NOT emit `Person` with invented properties. If a `Person` is ever added, only
  `name` and `nationality` (from data) are allowed. No `aggregateRating`,
  no `Review`, no `FAQPage` unless the Q&A text is also visible on the page and
  generated from data (e.g. "How many nations are in this XI?" answered from the XI).
- Escape with the same `.replace(/</g, '\\u003c')` the layout already uses.

### 2.9 Sitemap

`@astrojs/sitemap` already includes every generated static page and filters
`/404`, `/share-demo`, `/r/`. New pages are picked up automatically at build, so
no filter change is needed for phase 1. Needed changes:
- Pages skipped by the thin-page rule do not exist, so they cannot leak in.
- If a page is ever built but set `noindex`, it must also be excluded in the
  sitemap `filter`.
- Optionally set `lastmod` from a fixed data-version constant (not `new Date()`,
  which would change every build and teach Google to ignore lastmod). Decision D10.
- `robots.txt` already allows all and points at `sitemap-index.xml`; unchanged.
- After deploy: submit `sitemap-index.xml` in Google Search Console and Bing
  Webmaster Tools (owner action; the owner is new to SEO so this is spelled out in
  the PR description).

## 3. Data-quality risks and how pages handle them

Verified against the real files today (re-run on every build):

| # | Risk | Evidence | Handling |
|---|------|----------|----------|
| R1 | Known gaps from PROJECT_CONTEXT section 7 (6 bowlers with bowling avg 0; Utseya and Makoni with 0 matches) | Owner filled these 2026-09-25. Today: no unique player has `testMatches <= 0`; no bowler (spinner, fast bowler, all-rounder) has a missing bowling average. | Build-time audit; any player whose role-applicable metric is null is EXCLUDED from rankings and printed in a build report. Build fails if a gap appears for a player who would be ranked. Never zero-fill or estimate. |
| R2 | Non-bowlers with `testBowlingAverage: 0` but `testWickets > 0` (Ponting, Laxman, Cook, Jaffer, Butt, Ashraful, Azhar Ali, Vijay, Athanaze, Hodge) | Real rows. 0 means "not a bowler" here. | Harmless under primaryRole scoring (batting metrics only). Reason enough to forbid re-declaring them as all-rounders on any page. Print "n/a" never "0" for bowling average. |
| R3 | Stats are career totals, no snapshot date in the data | No date field in JSON | Copy says "career Test stats in the Beat My 11 database". No "as of {date}", no "currently". 2020s pages describe active players' stats as the database holds them; owner must tell us the snapshot date if it should be stated (decision D3). |
| R4 | Players whose role differs between era files | 6 players: Manoj Prabhakar (middle-order in 1980s file, opener in 1990s), Hamilton Masakadza (opener 2000s, middle-order 2010s), Brendan Taylor (middle-order 2000s, wicketkeeper 2010s), Rohit Sharma (middle-order 2010s, opener 2020s), Usman Khawaja (middle-order 2010s, opener 2020s). Dale Steyn differs only in formatting. | Default: first-file-wins, identical to the game/matchup dedupe, so ratings match the game. Alternative (decision D4): era pages use the role recorded in that era's file, which is truer for "XI of the 2020s". A build test lists these players; each should show only once per page. |
| R5 | Tiny samples | 9 players under 10 Tests, 70 under 20, 139 under 30 | The engine's shrinkage (30-match prior) already handles ranking. Show the "Tests" column on every row. Optional minimum-Tests floor is a NEW rule (decision D11); not applied by default. Build test: no player under 10 Tests appears in any XI or in a top-10 (flag, do not silently drop). |
| R6 | Players with 0 dismissals | Dilip Vengsarkar, Makhaya Ntini, Prosper Utseya (explicit 0, not missing) | `rawFielding` treats explicit 0 as 0; they remain eligible. Not shown as a defect. Dismissals column only printed for wicketkeepers and where real. Worth the owner confirming these three are true zeros and not blanks (data check, not a code issue). |
| R7 | Duplicate display of the same player across era-tag pages | 185 players in 2 eras, 38 of 44 legends also in another era | Expected and honest ("played in"). One XI can include a player on two era pages. Copy states membership rule. |
| R8 | A computed XI might contradict the owner's hand-picked house XI or look odd (e.g. a bowler-heavy XI) | `opponent-xi.ts` is manually chosen and tuned | Decision D1; page does not say "the house XI". |
| R9 | All-rounder pool is small and lopsided | 46 ARs, Beau Webster has 11 wickets as an AR | AR page ranks them with the engine unchanged; Tests/wkts shown. No extra rule. |
| R10 | Name-only duplicates | None found (536 unique names) | Build test keeps it that way. |

Exclusion policy summary: excluded = uncomputable score (null) or role not valid
(`evaluationRole` falls back to middle-order for unknown roles; a build test must
fail instead of silently falling back). Flagged-but-included = small sample, role
conflict. Everything excluded is printed by the build, never silently.

## 4. Minimum viable first batch, checklist, test plan

### 4.1 MVP (smallest set that proves the concept): 12 pages

- `/best-xi/` hub, `/best-xi/all-time/`, `/best-xi/1990s/`, `/best-xi/india/`
- `/best/` hub, `/best/openers/`, `/best/wicketkeepers/`
- plus the remaining 5 pages that come free from the same two route templates and
  cost no new code: `/best-xi/2000s/`, `/best-xi/legends/`, `/best-xi/england/`,
  `/best/fast-bowlers/`, `/best/spinners/`.

Rationale: it exercises both templates (XI and list), the three filters (all, era,
nation), a role with batting-only scoring (openers), the keeper special-case copy,
and a bowler role, and all four target queries from the brief are covered. Full
Phase 1 (26 pages) is the same code with more `getStaticPaths` entries, so the
MVP is only worth splitting if the owner wants a smaller first PR.

Success measure after launch (owner, in Search Console): impressions and indexed
page count for these pages after 4 to 6 weeks; clicks to `/play` via the existing
anonymous page-view counters (see decision D12 about whether to add a new
`view_seo` event).

### 4.2 Implementation checklist (for a later build PR, on a feature branch)

1. New pure module `src/lib/seo-pages.ts`: build population (same dedupe as
   `matchup.astro`), `ctx`, rank lists, XI selection, page-model builders. No
   JSON imports duplicated: use `playersForEra` / `ERA_IDS` / `NATIONS`.
2. Slug maps (era, nation, role), nation-adjective map, role-noun map as constants.
3. Astro routes: `src/pages/best-xi/[slug].astro` (all-time, eras, nations),
   `src/pages/best/[role].astro`, hubs `best-xi/index.astro`, `best/index.astro`;
   each with `getStaticPaths` driven by the page-model builder (skip rules inside).
4. Components: `XiTable`, `RankedList`, `PlayCta`, `MethodBox`, `Breadcrumbs`,
   `JsonLd` (small, reuse design tokens and existing dark theme).
5. `BaseLayout.astro`: add optional `canonical`, `noindex`, and extra JSON-LD
   (backward compatible; existing pages unchanged). Add `<link rel="canonical">`
   to new pages only unless the owner also wants it site-wide.
6. Link `/best-xi/` and `/best/` from home and footer.
7. Build-time audit script run in `astro build` via the page-model builder (throws
   on gaps) plus a printed exclusion report.
8. Sitemap: verify new pages appear; decide `lastmod` (D10).
9. Update `PROJECT_CONTEXT.md` (new pages, no longer "5 static pages") and note the
   build count.
10. PR description explains each change in plain language (owner is new to SEO)
    and lists every owner decision taken.

### 4.3 Test plan

Unit tests (added to the existing esbuild-bundled suites, `npm test`):
- Population dedupe: 536 unique ids from 790 records; first-file-wins; matches the
  matchup population id-for-id.
- Determinism: building the page models twice yields identical output; tie-break
  cases covered.
- Ranking integrity: for each role, order equals sort by `scorePlayer().score`
  using `buildScoringContext`; every ranked player has non-null score.
- XI validity: every generated XI has exactly 11 distinct players, one keeper, and
  role counts equal to a member of `XI_SHAPES`; each player is in the filter set
  (era tag includes era; nation matches).
- Skip rules: pages below threshold or with no feasible shape are not generated
  (assert the exact path list for phase 1).
- Slug safety: no collision between era and nation slugs; all slugs map back to
  the original values.
- Gap audit: `auditMetrics` over the ranked set is empty; negative test with a
  fixture containing a 0-match player proves it is excluded and reported, not
  zero-filled.
- Copy: golden tests that every number in generated copy equals a field or count
  from the data (e.g. N, n, stats), and that no template contains an unresolved
  `{placeholder}`.
- Role-conflict list equals the 6 known players (alerts the owner if data changes).

Build / output checks:
- `npm run build` passes; page count equals expected (5 existing + new).
- For every new page: exactly one `<h1>`, `<title>` and meta description within
  length bounds (title at most about 60 chars, description at most about 155),
  one canonical equal to its own URL, valid JSON-LD parseable with `JSON.parse`,
  `ItemList` length equals visible list length, BreadcrumbList positions 1..n.
- Sitemap contains each new URL once and none of the excluded ones.
- No duplicate `<title>` or meta description across pages (script over `dist/`).
- Playwright (`npm run test:e2e`): load one XI page and one list page, click the
  `/play` CTA and confirm `/play` loads; mobile viewport check (the site is
  mobile-first) that tables scroll or reflow rather than overflow.
- Manual: Lighthouse SEO and accessibility pass on two pages; rich results test on
  the JSON-LD; confirm Cloudflare serves `/best-xi/1990s/` (trailing slash handling)
  on a preview deploy before merge.

## 5. Owner decisions required

| ID | Decision | Recommendation |
|----|----------|----------------|
| D1 | A computed `/best-xi/all-time/` will not match the hand-tuned house XI. Publish it anyway? | Yes, but never call it "the house XI" or "My XI"; copy says "highest-rated by our method". |
| D2 | Show numeric 0 to 100 ratings on SEO pages, or only rank + real stats? `/play` hides ratings by design. | Rank + real stats only. |
| D3 | The date the stats were captured, if it should be printed (esp. 2020s). | Do not print a date unless supplied. |
| D4 | Which role per player: first-file-wins (matches game) vs the role in that era's file; secondary roles ignored? | First-file-wins for all pages except era XIs which use the era file's role (needs owner nod); primary role only. |
| D5 | XI selection: top-rated per slot + best shape by `teamBlend`, versus exhaustive `teamBlend` maximisation? Also confirm no per-nation cap. | Simple per-slot rule, no cap. |
| D6 | Tie-break order (unrounded score, then Tests, then id). | Accept. |
| D7 | What defines the "Legends" era in plain language, for page copy? | Owner supplies one sentence, otherwise omit the definition. |
| D8 | List pages: top 25 only, or full role list on one page? | Full list, top 10 prominent. |
| D9 | Create a public "how ratings work" page (SEO value and trust)? | Yes, later; separate PR. Needs owner approval of wording because it describes scoring. |
| D10 | Sitemap `lastmod` source (fixed data-version vs none). | None in MVP. |
| D11 | Minimum-Tests floor for pages (new rule) or rely on shrinkage only? | Rely on shrinkage; show Tests column. |
| D12 | New anonymous `view_seo` counter in `telemetry.ts` to measure SEO-to-play flow? | Yes, small follow-up. |
| D13 | Thresholds for phase 2 (role x nation, role x era): 5, 8 or 10 players. | 10 (23 + 31 pages). |
| D14 | Nation adjectives (Indian, West Indian, ...) and role nouns: hand-written constants, owner reviews. | Review in PR. |
| D15 | Phase 3 player pages: worth it given no bio data? | Defer; measure A to F first. |

Everything in this document that is not listed above reuses existing, owner-approved
engine behaviour (percentile ranking, shrinkage, role-to-metric map, `teamBlend`,
`XI_SHAPES`) with no changes.

---

## 6. Owner decisions as built (2026-10-01)

The 12-page MVP was built from this plan. Decisions that changed or settled items above:

- D1: the computed all-time XI is published, always labelled "by our ratings".
- D2: rank + real career stats only; no numeric ratings on these pages.
- D3: a "stats as of {build date}" line is shown on every page (career totals only).
- D4: first era file wins (same dedupe as /matchup), EXCEPT five owner overrides in
  `ROLE_OVERRIDES` (`src/lib/seo-pages.ts`): Prabhakar opener (1990s record),
  Masakadza opener (2000s), Taylor wicketkeeper (2010s), Rohit Sharma opener (2020s),
  Khawaja middle-order (2010s). Steyn and Roston Chase differ only in
  capitalisation/format and are not conflicts. The era-file-role variant for era
  XIs was NOT adopted (one role per player on every page).
- D6: tie-break is the rounded one-decimal rating, then Tests (desc), then id (asc).
- All other decisions use the defaults in section 5.
