# BeatMy11.com — Project Context

> **Purpose of this file:** give any AI assistant (or human) the full picture of what
> BeatMy11 is and what has actually been built, so it can work on the project without
> guessing. Facts here come from the code in this repo, not from memory.
> Last updated: 2026-10-01 — **regenerated from the code and git history at
> `origin/master` commit `498e793`** (the 2026-09-25 version was badly stale: it said
> the old model was live and the result was two scores). Anything the code could not
> settle is marked `UNCONFIRMED - owner to confirm`. `beatmy11.md` is the original
> vision/spec document and is **partly superseded** — where the two disagree, this
> file describes what is live. `SCORING_REVIEW.md` is a generated snapshot of the
> scoring numbers (see the pointer at its top).

---

## 1. What BeatMy11 is

BeatMy11 is a fantasy cricket web game (Astro + React islands + Tailwind +
TypeScript), hosted on Cloudflare Workers with a D1 database. The loop:

1. The user builds an **all-time Test XI** through a spin-based draft (`/play`).
2. The user's XI is scored with the seven-metric engine and compared with a
   **fixed, deterministic house XI**, called the **World XI** in the UI (`/matchup`).
3. The result is a **five-Test series** between the two XIs, with a share card and a
   shareable link.

**How the scoreline is chosen** (`src/lib/series.ts`, current code — head-to-head,
since 2026-09-30):

1. `gap = userTeamScore − houseTeamScore` (both from `teamBlend`, see §6).
2. A seeded Gaussian **wobble** is added: `gap' = gap + 2.5·ε` (`WOBBLE_SIGMA = 2.5`),
   seeded from the XI (`xiSeed`: FNV-1a over sorted `id:role` pairs), so the same XI
   always gets the same series but a near-level XI can land either side.
3. `gap'` is cut into seven scorelines by `GAP_CUTS`, with `PAR_GAP = -4`:

   | gap' (user − World XI) | scoreline |
   |---|---|
   | below −18 | 0–5 |
   | −18 to −12 | 1–4 |
   | −12 to −5 | 2–3 |
   | −5 to −3 | 2–2 (one draw) |
   | −3 to 0 | 3–2 |
   | 0 to +3 | 4–1 (must out-score the World XI) |
   | +3 or more | 5–0 (must beat it by 3) |

4. Each Test gets a venue in fixed order (Lord's, MCG, Eden Gardens, Newlands,
   Kensington Oval), a result consistent with the scoreline (a 3–2 / 2–3 series is
   level 2–2 going into the fifth Test), and one flavour headline whose hero comes
   from the side that won it, with figures scaled from the hero's real career
   numbers. It is **not** a ball-by-ball simulation.
5. The **calibration sample** (`src/data/series-calibration.json`, 600 team scores
   from a simulated "human-like" drafter, generated 2026-09-30 by
   `scripts/calibrate-series.ts`) is used **only for the "top X% of drafts" line**
   (and by the script's reports). It does **not** pick the scoreline any more. The
   older design (rank vs the sample picks the scoreline, 5–0 5% … 0–5 10%) was
   replaced on 2026-09-30; `OUTCOME_BANDS[].share` survives only as a design reference.

**Does the house XI score influence the result? Yes — completely.** The scoreline
comes from `userScore − houseScore` (plus wobble). Change the house XI, the engine
or any constant and difficulty changes. Current numbers: the house XI scores **89.4**
under the live engine (§6c); the simulated drafters in the calibration sample score
62.1–86.5 (median 76.4, 90th percentile 82.1) so none of them out-scores it. Applying
the real cuts and wobble to that sample gives roughly 0–5 18%, 1–4 40%, 2–3 37%,
2–2 3%, 3–2 1.5%, 4–1 0.2%, 5–0 0% (reproduced with a throwaway script on
2026-10-01). So a simulated drafter wins the series ~2% of the time; `PAR_GAP`
was tuned (−11.5 → −9.5 → −4) because real human drafts are expected to be much
stronger than the simulated drafter. **How often real players beat the house is
UNCONFIRMED - owner to confirm** (D1 holds the real scores; this doc did not read
production).

`/matchup` shows the animated Test-by-Test reveal, the scoreline, verdict copy, the
XI's "top X% of drafts" rank, a share card (PNG) with Share / Save buttons, and —
revealed here for the first time — every player's rating (0–100) for both XIs, with
a "Best pick" badge on the user's highest-rated player. The two raw team scores are
**not displayed** (owner decision, 2026-09-29), but they are what drives the series
and are sent anonymously to D1 (§12).

Repo: `https://github.com/shivvrudra-cmd/beatmy11.com` (public). `master` is the
live branch and deploys to Cloudflare (see §2). Work goes through feature branches
and PRs (CLAUDE.md); the owner tests on their own PC.

---

## 2. Tech stack & repo layout

- **Astro 7** (static site, 13 pages built), **React 19 islands** (shadcn/ui, lucide,
  motion), **Tailwind 4**, **TypeScript**. Node 24 (`.node-version`).
- **Hosting:** Cloudflare Workers with static assets. `wrangler.jsonc`: worker
  `beatmy11`, entry `worker/index.ts`, assets from `./dist`, the Worker runs **only
  for `/api/*`** (`run_worker_first`), custom domains `beatmy11.com` and
  `www.beatmy11.com`, `workers_dev: false`, `preview_urls: true`, D1 binding `DB`
  (database `beatmy11`; a separate empty D1 database is used for preview deployments).
  Git commits show deploys moved Pages → Workers on 2026-09-30. Whether Cloudflare
  auto-deploys from GitHub `master` is **UNCONFIRMED - owner to confirm** (commit
  "Trigger Cloudflare auto-deploy" suggests it; nothing in the repo defines it).
- **Tests:** `npm test` (esbuild-bundled node suites, see §8), `npm run test:unit`
  (Vitest), `npm run test:e2e` (Playwright). `npm run build` must pass before any
  change is done.

```
src/
  pages/
    index.astro       Landing page ("Floodlit" one-screen home)
    play.astro        The spin draft + XI builder ("Floodlit night" field/dock UI)
    matchup.astro     Result page: five-Test series, share card, player ratings (noindex)
    r/[result].astro  Shared-result landing pages, one per scoreline (7 pages, noindex)
    privacy.astro     What the site stores (links in footer)
    share-demo.astro  Share-card demo page (not in sitemap)
    404.astro
  lib/
    game-engine.ts    Spin logic (era+nation generation; only imports a type from ratings.ts)
    player-logic.ts   Draft rules: slots, shapes, placement, moves, respins, persistence
    player-store.ts   Player data access / normalization
    player-schema.ts  zod schema for a player record (used by the Vitest suite)
    opponent-xi.ts    The FIXED deterministic house XI (never random)
    seven-metrics.ts  THE live rating engine (V2) — see §6
    series.ts         Five-Test series from the score gap — see §1
    share-results.ts  Seven shareable scorelines + XI encode/decode for /r links
    share-card.ts     Canvas drawing of the 1080x1350 share card (browser only)
    telemetry.ts      Fire-and-forget anonymous POSTs to the Worker
    floodlight.ts, design-tokens.ts, utils.ts
    ratings.ts        OLD scoring model — DEAD CODE, see §6a
  data/
    legends.json 1970s.json 1980s.json 1990s.json 2000s.json 2010s.json 2020s.json
        790 records, 536 unique players (see §7)
    series-calibration.json   600 simulated-drafter team scores (see §1)
  components/ layouts/ styles/
worker/index.ts     Cloudflare Worker: /api/scores and /api/events -> D1 (see §12)
migrations/0001_init.sql   D1 schema: drafts, events
public/             favicon/icons, og-image.png, og/<u>-<h>.png (7 scoreline previews),
                    robots.txt, _headers (cache rules), site.webmanifest
scripts/            calibrate-series.ts, gen-og-images.ts, review-report.ts and
                    diagnostics (§6d)
tests/              see §8
docs/               design-system.md, ui-ux-guidelines.md, image-prompts.md,
                    archive/ (ESPN investigation notes, stats summary, id_map.json)
```

---

## 3. Game flow (`/play`)

**Spin-first draft, 6 spins → exactly 11 picks:**

- **Round 1:** always the **Legends** era, 1 pick.
- **Rounds 2–6:** the other eras, 2 picks each. Total = 11 players.
- **"Floodlit night" design** (rebuilt 2026-09-29, mobile-first): Era × Nation
  reels, a swipeable/scrollable pool of player cards for the draw, and the XI
  shown as a cricket field (desktop) or grouped dock (phone: 1–2 / 3–5 /
  6–8 / 9–11).
- **Respins:** one nation respin and one era respin per draft (a forced redraw; the
  era respin is unavailable in round 1; unavailable once a pick is made from the
  draw). A respin can never re-land on an era×nation pair already drawn, spins never
  re-land on a drawn era×nation combo, and a nation can land **at most twice per
  draft** (`play.astro`).
- Cards show **real Test stats only — no ratings** — ordered by role, then A–Z, never
  by strength, so the best pick is the player's judgment. Ratings are revealed on the
  result screen.
- **Slot-first placement:** tap a card, then the XI slot; the tapped slot decides the
  declared role. A chooser appears only when a slot/player allows more than one legal
  declaration (e.g. slots 7–8: all-rounder or spinner).
- Picked players display the era the spin landed on.
- "Start over" / "Draft again" is available only after the verdict.

**Hard rules enforced during the draft** (`src/lib/player-logic.ts`):

- Exactly **1 wicketkeeper**, mandatory, and the keeper's spot is spot 6 only.
  A draft cannot complete without one; the fixed spin pools guarantee a keeper is
  obtainable.
- Pool cards for filled role groups disable with the reason as a tooltip.

---

## 4. Positional XI system

The XI is **11 fixed slots** (`XI_SLOTS`), each storing a **declared role**:

| Spots | Slot keys | Accepts |
|-------|-----------|---------|
| 1–2   | `opener-1/2` | openers only |
| 3–5   | `bat-3/4/5`  | middle order only |
| 6     | `bat-6`      | wicketkeeper only (since 2026-09-29) |
| 7–8   | `flex-7/8`   | all-rounder **or** spinner |
| 9–11  | `fast-1/2/3` | fast bowlers only |

Exactly **three valid completed XI shapes** exist (`XI_SHAPES`; unchanged):

1. 2 openers / 3 middle order / 1 keeper / 2 all-rounders / 0 spinners / 3 fast
2. 2 openers / 3 middle order / 1 keeper / 1 all-rounder / 1 spinner / 3 fast
3. 2 openers / 3 middle order / 1 keeper / 0 all-rounders / 2 spinners / 3 fast

Mechanics:

- **Hard blocking with supply context**: illegal picks/moves are blocked and the UI
  explains why.
- **After the XI is complete, players can only be rearranged within the same slot
  group.** Moves can re-declare roles and can strand the XI; handled, not forbidden.
- **Persistence:** the XI array is stored under `beatmy11.userXI.v1` (plain 11-player
  array, slot/batting order); draft extras (spin history, respin tokens, picks with
  slot and declared role) under `beatmy11.draft.v1`, serialized as **v4** (v1–v3
  blobs migrate/remap).
- `/matchup` reads both keys: the XI array for the players and the draft blob for
  each pick's **declared role**, which is the role the pick is scored under.

---

## 5. The opponent: fixed house XI ("World XI")

`src/lib/opponent-xi.ts` supplies one **fixed, deterministic** house XI; no random
opponent selection exists anywhere. Player selection and scoring are separated:
scoring functions take explicit XI arrays.

Current `HOUSE_PLAYER_IDS` (batting order): Don Bradman (opener, AUS), Sunil
Gavaskar (opener, IND), Sachin Tendulkar (MO, IND), Brian Lara (MO, WIN), Joe Root
(MO, ENG), Andy Flower (WK, ZIM), Jacques Kallis (AR, RSA), Muttiah Muralitharan
(spinner, SRI), Joel Garner (fast, WIN), Wasim Akram (fast, PAK), Shaun Pollock
(fast, RSA) — 8 nations. Its shape is shape 2 (1 AR + 1 spinner). The roster has
been unchanged since 2026-09-29 (commit `8dfa7cd`). **Declared role for scoring =
each player's `primaryRole`** (not a user declaration).

**House XI team score = 89.4** under the live engine (batting unit 98.0, bowling
unit 88.9, fielding unit 57.2; per-player: Bradman 100.0, Gavaskar 98.1, Tendulkar
99.6, Lara 99.1, Root 99.0, Flower 91.1, Kallis 99.6, Muralitharan 99.7, Garner
86.1, Akram 94.0, Pollock 88.4 — these match `SCORING_REVIEW.md`).

**The "80.8" in earlier versions of this file was a stale number, not a context
mismatch.** It was correct on 2026-09-29 (commit `8dfa7cd`) and went out of date after
two later scoring changes. Reproduced on 2026-10-01 with throwaway scripts (since
deleted) using exactly the context `matchup.astro` builds (`buildScoringContext`
over every unique player from `playersForEra` over `ERA_IDS`, deduped by id, house
players round-tripped through the page's `toScoringPlayer` and declared as
`primaryRole`):

| engine state | house team score |
|---|---|
| V2 as of 2026-09-29 (bowling weights 1/4 each, no long-career bonus) | **80.8** |
| + bowling weights 40/35/20/5 only (`d766073`, 09-30) | 84.2 |
| + long-career bonus only (`b00e249`, 09-30) | 86.7 |
| both (current code) | **89.4** |

The independent check that gave 89.4 (SEO-page code using `getSeoData().ctx` and
`primaryRole`) was therefore also right: that context is the same population as
`/matchup` (the SEO code comments say so), and with the current constants every
reproduction gives 89.4. There is no second context; the only discrepancy was the
documentation lagging the code. (`getSeoData` lives on branch `content/mvp-pages`,
not on `master`.)

Stale numbers elsewhere in the repo that this doc cannot fix: the header comment of
`src/lib/opponent-xi.ts` still says "Blend 80.8", `series.ts` says the World XI
scores "~84", and `scripts/beat-house-analysis.ts` says "confirm 87.5". Code
comments were left alone (docs-only change); the owner may want them refreshed.

---

## 6. Rating engines

### 6a. `src/lib/ratings.ts` — OLD model, **no longer used by any page**

`/matchup` has used the seven-metric engine since 2026-09-25 (`ba25ac6`).
`ratings.ts` is imported only for a `Player` **type** in `game-engine.ts`; nothing
calls its scoring or simulator. It mutates player stats and estimates/zero-fills
missing figures — do not copy those patterns. It is dead code that could be deleted
(removal not done here; `UNCONFIRMED - owner to confirm` whether to delete).

### 6b. `src/lib/seven-metrics.ts` — the live engine (V2 + 2026-09-30 changes)

Pure, deterministic, wired into `/matchup`. All constants below are read from the
code on 2026-10-01.

- **Seven metrics** from existing JSON fields (never recalculated or estimated;
  missing stays `null`): Batting Average, Runs per Match (`testRuns/testMatches`),
  Century Rate; Bowling Average (the only lower-is-better metric), Wickets per
  Bowler-Match, Five-Wicket-Haul Rate, Ten-Wicket-Match Rate. Rates use `testMatches`.
- **Role → metrics:** openers, middle order, wicketkeepers → 3 batting metrics;
  spinners, fast bowlers → 4 bowling metrics only (no batting score for specialists);
  all-rounders → all 7 as separate batting and bowling halves. The **declared role**
  (slot) is the scoring role; a non-AR declaration is never silently scored as AR.
- **Percentile normalization:** each metric value is ranked 0–100 against the full
  eligible population (batting metrics: every unique player whose *primary* role is
  batting-evaluated, incl. all-rounders; bowling likewise), never split by era,
  nation or XI. Bowling average inverted. Ties share averaged rank. **All-rounders
  are ranked against the same full populations as specialists** (V2; the earlier
  AR-only populations are gone).
- **Shrinkage:** `adjusted = (matches·raw + 30·populationMean) / (matches + 30)`
  (`SHRINKAGE_PRIOR_MATCHES = 30`, was 20), on all seven metrics and on fielding,
  using `testMatches`. Population = 536 unique players (batting metrics n=334,
  bowling n=248, per `SCORING_REVIEW.md`).
- **Half score** (batting half / bowling half) = 75% weighted metric mean + 25%
  **longevity** (`min(1, Tests/50)·100`; `LONGEVITY_WEIGHT 0.25`,
  `LONGEVITY_FULL_CREDIT_TESTS 50`), then the **long-career bonus**: the half fills
  up to 80% of its remaining gap to 100, reached at 200 Tests, scaled linearly from
  50 Tests (`LONGEVITY_BONUS_FILL 0.8`, `LONGEVITY_BONUS_FULL_TESTS 200`; owner
  2026-09-30, added so Tendulkar's 200 Tests aren't under-rated vs shorter careers).
- **Weights inside the 75%:** batting 1/3 each; bowling **40% average / 35% wickets
  per match / 20% five-wicket rate / 5% ten-wicket rate** (owner-approved
  2026-09-30; was 1/4 each).
- **All-rounder:** the stronger half leads and the weaker half fills 50% of the gap
  to 100: `100·(1 − (1−S)(1 − 0.5·W))` (`ALL_ROUNDER_GAP_FILL 0.5`). A second skill
  only adds. (This replaced V1's 50/50 and the interim 60/40.)
- **Fielding** is not a player metric: dismissals per match (shrunk, percentile-ranked
  over all unique players, one population, no role split) enters only at the XI level.
- **Team score (`teamBlend`)** = `0.4·battingUnit + 0.5·bowlingUnit + 0.1·fieldingUnit`
  (`TEAM_BATTING_SHARE 0.4`, `TEAM_BOWLING_SHARE 0.5`, `TEAM_FIELDING_SHARE 0.1`).
  The batting unit is the mean batting half over batting-role entries, the bowling
  unit the mean bowling half over bowling-role entries (an all-rounder feeds both),
  fielding the mean over all 11. Rounded to 1 decimal.
- `compareXIs(userXI, houseXI, ctx)` returns the two team scores, difference and
  per-player `PlayerScore`s; missing data throws `IncompletePlayerData` (a misleading
  score is never produced; `/matchup` shows an error and tells the user to draft again).
- **The page scores players with a stats subset:** `matchup.astro`'s
  `toScoringPlayer` keeps only the engine's stat fields and turns `testAverage` /
  bowling averages that are not > 0 into `null`.

### 6c. Reproducing numbers

`buildScoringContext(unique players)` once, then `teamBlend`/`compareXIs`. The house
XI scores 89.4 (§5). `SCORING_REVIEW.md` (generated by `scripts/review-report.ts`)
lists the per-player numbers; its header and house-XI section match the live engine
except where its own pointer note says otherwise.

### 6d. Scripts (`scripts/`, dev only, not in the build)

`calibrate-series.ts` (rewrites `series-calibration.json`; uses `getHouseXI`,
`teamBlend`, `bandFor`, `wobble` and the real draft rules to report scoreline shares),
`gen-og-images.ts` (Playwright-rendered link-preview PNGs, §13), `review-report.ts`
(regenerates `SCORING_REVIEW.md`), `seven-metric-diagnostic.ts`,
`xi-shape-diagnostic.ts`, `beat-house-analysis.ts` (can any XI beat the house?),
`house-xi-candidates.ts`, `ar-investigation.ts`, `gen-populations.ts`
(writes `scripts/populations/*.tsv`). Several comments in these scripts are stale
(old shapes, old house score, "W=20"). **The 2026-09-29 claim "score-greedy simulated
drafts beat the house ~14% of the time" is superseded and has not been re-run
against the 89.4 house: UNCONFIRMED - owner to confirm.**

### Scoring decisions (owner-specified; history)

V1 (2026-09-25): percentile normalization 0–100; batting 1/3 each, bowling 1/4 each;
50/50 all-rounder; mean-of-11 XI score; `testMatches` as the rate denominator;
declared non-AR role scored as declared; shrinkage W=20; all-rounder-only
populations ("Option A"). **Superseded since:** 40/50/10 team blend (09-27),
60/40 AR blend (09-27, then replaced), V2 (09-29: full populations, longevity, stronger
AR logic, W=30), bowling weights 40/35/20/5 (09-30), long-career bonus (09-30). See §11.

---

## 7. Data

- 7 era files, **790 normalized player records, 536 unique players** (players spanning
  eras appear in several files; the engine dedupes by `id`). Each record carries `id,
  name, era[], nation, primaryRole, roles[], battingHand, bowlingArm, isWicketkeeper`,
  plus `stats` with `testMatches, testRuns, testAverage, testCenturies, testWickets,
  testBowlingAverage, fiveWs, tenWs, dismissals` (among others). `dismissals` is
  required for the fielding unit.
- `TestStat.csv` (and a NZ stats CSV) sit next to the JSON for provenance — the JSON
  files are the source of truth. Data is maintained by editing the JSONs directly
  (the one-off Python scripts were removed 2026-09-28). Recent data-only edits:
  stat corrections, dead duplicate records dropped, Zimbabwe spinner (Adam Huckle)
  added, Joel Garner / Joe Root / extra India opener added to Legends, Jerome Taylor,
  Azharuddin, Shakib, Campbell fixes (2026-09-27 → 09-29).
- The seven missing-data records the owner filled on 2026-09-25 (Saqlain Mushtaq x2,
  Siraj, Lahiru Kumara, Zahid Mahmood, Prosper Utseya, Tanunurwa Makoni) remain
  filled; the missing-data audit test expects zero gaps. Re-run tests after any data edit.
- **Data-validation caveat:** `src/data/series-calibration.json` is a JSON object
  living in the same folder as the era files, and the Vitest schema test globs
  `src/data/*.json` (see §8).

---

## 8. Tests (run 2026-10-01 on `origin/master` `498e793`)

`npm test` (esbuild bundle + node, five suites) — **all pass**:

| Suite | Result |
|---|---|
| `tests/xi-logic.test.ts` | 192 passed, 0 failed — slots, declared roles, blocking, move-stranding regression, persistence migration |
| `tests/full-draft.test.ts` | 242 passed, 0 failed — 120-trial real-data full-draft simulation, all XI shapes, backtracking achievability oracle |
| `tests/seven-metrics.test.ts` | 147 passed, 0 failed — metrics, roles, V2 all-rounder/longevity/shrinkage, team blend, determinism, missing-data flags |
| `tests/series.test.ts` | 29 passed, 0 failed — gap cuts, wobble, seeding, test order, full series |
| `tests/share.test.ts` | 9 passed, 0 failed — share slugs, XI encode/decode |

Total **619** assertions in `npm test`.

`npx vitest run` (`tests/unit/`): **4 passed, 1 FAILED** (2 files). The failure is
`player-schema.test.ts` ("every record in every era JSON file matches the player
schema"): it globs `src/data/*.json` and `series-calibration.json` is an object, not an
array, so it fails with "series-calibration.json should be a JSON array". It is a
test-scope bug introduced when the calibration file was added (2026-09-29), not a
data problem; fix (not done here, docs-only task) is to exclude that file or move it.
`scoring.test.ts` (4 tests, `percentileRank`) passes. `npm test` does not run
Vitest, so CI-style checks that only run `npm test` miss it.

`npm run test:e2e` (Playwright: `tests/e2e/draft.spec.ts`, `share.spec.ts`,
`xi-complete.spec.ts`): **not run** for this update (needs browsers) —
`UNCONFIRMED - owner to confirm` it passes today.

`npm run build`: passes, **13 pages** (`/`, `/play`, `/matchup`, `/privacy`, `/404`,
`/share-demo`, 7 x `/r/<u>-<h>`) plus `sitemap-index.xml`.

---

## 9. Hard rules for anyone (human or AI) working on this project

1. **Work in this repo, in place.** Never create a new project, copy, ZIP, or repository.
2. **Inspect actual JSON/schema and existing code before changing anything.** An early
   implementation assumed the wrong game flow and had to be fully rebuilt.
3. **Do not invent unresolved mathematical rules** (normalization, weights,
   aggregation, series cuts). Ask the owner.
4. **Never fabricate player data, statistics, eras, or historical-player
   photographs.** Missing data is flagged, never estimated or zero-filled.
   For imagery: legally sourced/public-domain (attributed), neutral silhouettes,
   stylized portraits, or abstract cricket imagery only.
5. **Wicketkeepers are evaluated on batting. Genuine all-rounders get batting AND
   bowling evaluation. Specialist spinners/fast bowlers get no batting score.**
   (Still true in the code.)
6. **Keep the spin/draft system separate from scoring.** Scoring takes explicit
   XIs; it never selects players.
7. **~~First release shows only: Your XI score, My XI score, no series sim~~ — CONTRADICTED
   BY THE CODE (flagged).** The shipped result is the five-Test series and the raw team
   scores are not shown. The surviving parts: no ball-by-ball simulation and no AI
   explanations exist. Owner to confirm the replacement wording:
   `UNCONFIRMED - owner to confirm`.
8. **~~After verified changes: commit and push to `master` with a PAT~~ — CONTRADICTED
   BY CLAUDE.md (flagged).** CLAUDE.md says: feature branch + PR, never push directly to
   `master`, never commit secrets. Follow CLAUDE.md.

---

## 10. History (2026-09-24 → 2026-09-25, kept as background)

- Game-flow rebuild: spin-first draft, fixed house XI.
- Quota rules → revised positional XI (fixed slots, declared roles, hard blocking,
  persistence) → pool/move follow-up (own Wicketkeeper pool group, same-group
  rearrangement after completion).
- Rating audit: old model mapped, data gaps flagged; owner filled the 7 missing-data
  records (2026-09-25).
- Seven-metric engine specified, then finalized to the owner's V1 spec (percentile
  normalization, weights, 50/50 all-rounders, mean aggregation, `compareXIs`), then
  shrinkage (W=20) and AR-only populations ("Option A"), then **wired into `/matchup`
  on 2026-09-25 (`ba25ac6`, owner-approved)** — the old model stopped being used there.
  Everything after that is in §11.

---

## 11. Changelog since 2026-09-25 (from git history)

**2026-09-27**
- Spins never re-land on a drawn era×nation combo; one nation respin + one era
  respin per draft; nation capped at two landings per draft (09-27).
- Slot-reel spin UI; slot-first placement replaces the role bar; slot-first
  declarations (the tapped slot decides the role); decluttered pool cards and slots.
- Scoring: all-rounder blend 60/40 toward the stronger discipline; then
  **team score = 40% batting / 50% bowling / 10% fielding** with fielding (dismissals
  per match) for all players (`762ad2d`). House XI swapped several times (Miandad,
  Murali, Lara, Root, Wasim in; Ambrose in for Marshall).
- Results: nation-code badge replaces flag emoji; cards stripped to name/code/era.

**2026-09-28**
- Design B formation (2 openers / 3 MO / 1 WK / 3 fast + all-rounder/spinner flex
  pair) — the current three-shape system (`3cdf3da`). Mobile rework (draw sheet,
  grouped XI slots, dense pool rows). Bold Dark theme; 6-segment round bar; design
  docs added; 59 obsolete Python scripts removed.

**2026-09-29**
- **Rating engine V2** (`eca0ea3`): all-rounders ranked against full populations,
  stronger-half-leads gap-fill 0.5, 25% longevity (full credit at 50 Tests),
  shrinkage prior 30. House XI to 80.8 at the time (Flower, Pollock, Kallis in).
- **Five-Test series result** and Floodlit `/matchup` (`ac739ac`) — the result is now
  a series, not two scores. Floodlit `/play` and homepage redesigns. Keepers only on
  spot 6 (rules change). Vitest + Playwright + zod + shadcn/ui foundations. Data fixes
  (data only). `npm test` made to run on Windows.

**2026-09-30**
- Share previews, per-scoreline OG images, `/r/<u>-<h>` pages, 404 and share-demo
  restyled; share card with the drafted XI; shared links list the XI (`cf5a098`).
- **Series now compares your XI to the World XI** (`d766073`): scoreline from the
  score gap + wobble instead of rank vs the sample; **bowling weights 40/35/20/5**.
  Then tuned: `PAR_GAP` −11.5 → −9.5 → −4; 4–1 needs gap > 0 and 5–0 needs +3
  (`c2b23ce`, `1f2a6d7`).
- **Long-career bonus** for batting/bowling halves (`b00e249`); "Weakest pick" sticker
  dropped. House XI score is now **89.4**.
- Mobile result page as three one-swipe panels; one-screen draft page; desktop
  three-panel result page; "Draft again" at the bottom of the series screen.
- Deployment: Cloudflare Pages tweaks, then Workers static assets, custom domains
  `beatmy11.com`/`www`, workers.dev disabled. Repo root cleaned (one-off scripts
  removed, ESPN notes archived to `docs/archive/`).
- **Anonymous score collection** (`267dd90`): Worker + D1 + telemetry client + share
  counter (§12).

**2026-10-01**
- First-party page-view counters (home, play, result, shared link) (`9021e6f`);
  Privacy page + footer links, contact `hello@beatmy11.com` (`54ffd9f`);
  `robots.txt` with sitemap (`d53b636`).
- **SEO foundation (PR #1, `498e793`):** canonical tags, richer schema.org JSON-LD,
  `/matchup` and `/r/*` set `noindex` and are excluded from the sitemap, self-hosted
  fonts (Bebas Neue, Inter via `@fontsource`), `@astrojs/sitemap`, a Wrangler
  `previews` block with a separate preview D1 database, and `CLAUDE.md` added.

(There is also a branch `origin/content/mvp-pages` with 12 data-backed SEO pages
(`/best-xi/*`, `/best/*`). It is **not merged to `master`**, so it is not documented
as live here; add a section when it lands.)

---

## 12. Telemetry and D1 (what is collected)

Code: `src/lib/telemetry.ts` (client), `worker/index.ts` (server),
`migrations/0001_init.sql` (schema). **Nothing was queried in production for this
update; row counts are `UNCONFIRMED - owner to confirm`, and whether the D1 migration
has been applied to the production database is `UNCONFIRMED - owner to confirm`.**

- **Client:** fire-and-forget `fetch` with `keepalive`, never throws, **does nothing
  when the browser sends Do Not Track (`navigator.doNotTrack === '1'`)**.
- **`POST /api/scores`** — one finished series: `{ xi, userScore, houseScore, user,
  house, draws }`. `xi` is the 8-hex-digit `xiSeed` hash of the XI (not the player
  list). Validated (scores 0–100, user+house+draws = 5). Stored with
  `INSERT OR IGNORE` into **`drafts`** (`xi_hash` PRIMARY KEY, `created_at`,
  `user_score`, `house_score`, `series_user`, `series_house`, `draws`) — a repeat XI is
  not counted twice. Purpose: recalibrating the series bands from real drafts.
- **`POST /api/events`** — `{ name }` where name ∈ `shared`, `view_home`, `view_play`,
  `view_result`, `view_shared`; upserts a per-day counter in **`events`**
  (`day`, `name`, `count`, PK `(day, name)`). Page views are reported from
  `BaseLayout.astro` by path (`/`, `/play`, `/matchup`, `/r/*`); `shared` is reported
  when the Share button is tapped.
- **Not stored:** IP, cookie, user agent, account, or player list. Body limit 1 KB;
  only POST; requests must carry an `Origin` of `https://beatmy11.com` or
  `https://www.beatmy11.com`. `/api/` is disallowed in `robots.txt`.
- `/privacy` describes all of this in plain language (last updated 1 Oct 2026).
- No third-party analytics scripts are present in `src/` (checked by search).

---

## 13. Sharing

- **`/matchup`** builds a share URL `/r/<user>-<house>?xi=<encoded ids+roles>`
  (`encodeXI` in `share-results.ts`) and a **1080x1350 PNG share card** drawn in the
  browser (`share-card.ts`: scoreline, headline, the 11 players with role/nation tags,
  "Top X% of drafts" when in the top half). "Share result" uses the Web Share API
  with the card file where supported, else shares text+link, else (desktop) saves the
  card and copies the message. A "Save the card" link is also offered.
- **`/r/<slug>`** — seven static pages (`5-0 4-1 3-2 2-2 2-3 1-4 0-5`, from
  `OUTCOME_BANDS`), `noindex`, each with its own title/description and link-preview
  image `public/og/<slug>.png` (1200x630, made by `scripts/gen-og-images.ts` with
  Playwright; PNGs are committed). The page shows the challenge, the sender's XI
  decoded client-side from `?xi=` (unknown ids ignored), and a "Draft your XI" button.
  Because the site is static, **previews exist per scoreline, not per XI**; the XI
  itself travels in the share card and the link.
- `public/og-image.png` is the default preview for other pages.

---
