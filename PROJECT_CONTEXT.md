# BeatMy11.com — Project Context

> **Purpose of this file:** give any AI assistant (or human) the full picture of what
> BeatMy11 is and what has actually been built, so it can work on the project without
> guessing. Facts here come from the code in this repo, not from memory.
> Last updated: 2026-10-02 (second pass, after the overnight run) — **brought up to date with
> `origin/master` at PR #37** (`d6be47e`). Sections 5 to 7 are unchanged from the regeneration at
> `5030e14`; everything else was checked against the code and the test counts were re-run.
> Anything the code could not settle is marked `UNCONFIRMED - owner to confirm`.
> Other documents: `docs/plans/` (decisions and plans), `docs/plans/future-ideas.md` (parked
> ideas), `docs/reports/` (generated data reports), `beatmy11.md` (the original vision, largely
> superseded).

---

## 1. What BeatMy11 is

A fantasy cricket web game (Astro + React islands + Tailwind + TypeScript) on Cloudflare
Workers with a D1 database. There are now **four formats and two ways to play**.

| | Test | ODI | T20I | IPL |
|---|---|---|---|---|
| Spin draft | `/play` | `/odi/play` | `/t20i/play` | `/ipl/play` |
| Result | `/matchup` | `/odi/matchup` | `/t20i/matchup` | `/ipl/matchup` |
| Pick any XI | `/pick` | `/odi/pick` | `/t20i/pick` | `/ipl/pick` |
| A spin draws | era × nation | decade × nation | decade × nation | season block × franchise |
| Fixed opponent | World XI | World XI | World XI | All-Star XI |
| Engine | `seven-metrics.ts` | `white-ball-metrics.ts` | same | same |
| Landing page (readable text + Play) | `/` | `/odi/` | `/t20i/` | `/ipl/` |
| Daily challenge, friend-challenge links, share pages (`/r/`, `/<format>/r/`) | yes | yes | yes | yes |
| Anonymous page and event counters | yes | yes (per format) | yes | yes |
| Anonymous series scores (for tuning difficulty) | yes | no | no | no |

**The spin draft loop** (all formats): six spins give exactly eleven picks into fixed slots →
the XI is scored and compared with the format's fixed opponent → a **five-match series**
scoreline, shown on a three-screen result page with a share card.

**Pick any XI** (2026-10-02): no spins. Search every player, fill the same eleven slots, send a
link to a friend, who picks their own XI; both see the same five-match series. See §9.

**How a scoreline is chosen** (`src/lib/series.ts`):

1. `gap = userTeamScore − opponentTeamScore`.
2. A seeded Gaussian wobble is added (`WOBBLE_SIGMA = 2.5`, seeded from the XI by `xiSeed`), so
   the same XI always gets the same series.
3. The wobbled gap is cut into seven scorelines. Every cut is **par plus a fixed offset**
   (−14, −8, −1, +1, +4, +7):

   | wobbled gap, relative to par | scoreline |
   |---|---|
   | below −14 | 0–5 |
   | −14 to −8 | 1–4 |
   | −8 to −1 | 2–3 |
   | −1 to +1 | 2–2 (one draw; a tie or washout in limited overs) |
   | +1 to +4 | 3–2 |
   | +4 to +7 | 4–1 |
   | +7 or more | 5–0 |

4. Par per format (difficulty):

   | Format | Par | Opponent score | Simulated series wins (human-like drafter, 600 drafts) | Status |
   |---|---|---|---|---|
   | Test | −7 (`PAR_GAP`) | 89.4 | 6.7% (smart drafter 26.6%); figures from 2026-10-01, not re-run | owner-approved |
   | ODI | −7 | 92.4 | 7.3% (a drafter who sees the hidden ratings: 42%) | owner-set 2026-10-03 (was −9, 16.2%) |
   | T20I | −11.5 | 93.8 | 14.0% | PROVISIONAL, tuned to about 15% |
   | IPL | −18 | 93.0 | 14.4% | PROVISIONAL, tuned to about 15% (re-tuned 2026-10-02 with the era adjustment, §6) |

   White-ball pars are written by `scripts/cricsheet/calibrate-white-ball.ts` into
   `src/data/formats/<format>-series.json`. The owner set the ODI par to −7 on 2026-10-03 and said "ok" to about 15% for T20I;
   the IPL figure was reset after the stint change (§6) and **is `UNCONFIRMED - owner to confirm`**.
   How often real players win is `UNCONFIRMED - owner to confirm` (production D1 was not read).

   **No draws in ODI, T20I and IPL** (owner, 2026-10-03, `NO_DRAW_BANDS`, `noDrawCuts` in `series.ts`):
   the 2–2 band is removed; the two cuts around it merge into one at par, so the scorelines are
   0–5, 1–4, 2–3, 3–2, 4–1, 5–0 and every match has a winner. Par was moved up by one point in each
   format so the simulated win rate stays the same (16.2%, 14.0%, 14.4%). The Pick any XI friend duel
   follows the same rule in these formats (its middle cuts −1/+1 become 0). In T20I and IPL about 1
   match in 20 is described as won in a super over (wording only, PROVISIONAL). Test keeps its draw.
   Old shared `/<format>/r/2-2` pages still exist for links already sent.

5. Each match gets a venue, a result consistent with the scoreline, a headline performer and a
   second performer. It is **not** a ball-by-ball simulation (§8).

Repo: `https://github.com/shivvrudra-cmd/beatmy11.com` (public). `master` is live. Work goes
through feature branches and PRs. The owner merges; on an unattended run the owner has
authorised Claude to merge its own PRs once local checks and the Cloudflare check pass, except
scoring changes, database migrations or new stored data, third-party scripts, the logo and legal
text, which always wait for the owner (`docs/handoff-2026-10-02.md`).

---

## 2. Tech stack & repo layout

- **Astro 7** (static, **59 pages built**), **React 19** islands, **Tailwind 4**, TypeScript.
  Node 24 (`.node-version`).
- **Hosting:** Cloudflare Workers with static assets (`wrangler.jsonc`): worker `beatmy11`,
  entry `worker/index.ts`, assets from `./dist`, the Worker runs only for `/api/*`, custom
  domains `beatmy11.com` and `www.beatmy11.com`, `workers_dev: false`, `preview_urls: true`,
  D1 binding `DB` (database `beatmy11`; previews use a separate empty database). Each branch
  gets a preview at `https://<branch-with-dashes>-beatmy11.shivvrudra.workers.dev`, and merging
  to `master` deploys (the owner confirmed "merged and deployed" repeatedly on 2026-10-01/02).
- **Security headers** (`public/_headers`, 2026-10-02): HSTS (one year, no preload), `nosniff`,
  `X-Frame-Options: DENY`, a referrer policy, a permissions policy and a Content-Security-Policy
  (this site only, plus Cloudflare Web Analytics, which Cloudflare injects on the live domain but
  **not** on previews). Any new third-party host (ads, other analytics) must be added to the
  policy or it will not load. Check a deployed copy with `node scripts/check-live-headers.mjs <url>`.
- **Tests:** `npm test` (16 esbuild-bundled node suites), `npx vitest run`, `npx playwright test`.
  `npm run build` must pass before any change is done. `node scripts/site-audit.mjs` checks the
  built site for broken links, missing alt text and third-party resources.

```
src/
  pages/
    index.astro            Home: hero, Daily Challenge card, the other formats' dailies directly
                           under it, "More ways to play" cards, World XI
    play.astro             Test spin draft
    matchup.astro          Test result (noindex)
    pick.astro             Test "Pick any XI"
    odi/ t20i/ ipl/        index.astro (landing page), play.astro, matchup.astro (noindex),
                           pick.astro, r/[result].astro (share pages) for each format
    r/[result].astro       Test shared-result pages, one per scoreline (7, noindex)
    best-xi/ best/         12 data-backed SEO pages (index + [slug] / [role])
    privacy.astro  share-demo.astro  404.astro
  components/
    DraftGame.astro        THE draft screen, shared by all four formats
    SeriesResult.astro     THE result screen, shared by all four formats
    PickGame.astro         THE "Pick any XI" screen, shared by all four formats
    SharedResult.astro     THE shared-result page (/r and /<format>/r)
    FormatLanding.astro    The /odi/, /t20i/, /ipl/ landing pages
    SiteLinks.astro, seo/
  lib/
    player-logic.ts        Draft rules: slots, shapes, placement, moves, respins, persistence,
                           the IPL four-overseas rule
    player-store.ts        Test player access (era files)
    game-engine.ts         Test spin generation
    opponent-xi.ts         The fixed Test World XI
    seven-metrics.ts       Test rating engine (§5)
    white-ball-metrics.ts  ODI / T20I / IPL rating engine (§6)
    series.ts              Five-match series from the score gap (§1, §8)
    result-insights.ts     Grade, titles and tips on the result page (§8)
    pick-xi.ts             "Pick any XI" rules: link XI, duel ladder, badges, head-to-head (§9)
    daily.ts               Daily Challenge rules and streak; spin-option helpers
    challenge.ts           Challenge-a-friend links for the Test draft
    draft-slots.ts         One saved draft per mode (normal, daily, challenge, ipl, odi, t20i)
    share-results.ts       Scoreline slugs, XI encode/decode for links
    share-card.ts          Canvas drawing of the 1080x1350 share card
    sfx.ts                 Synthesised sound effects, mute setting
    seo-pages.ts           Page models for /best-xi and /best
    telemetry.ts           Fire-and-forget anonymous POSTs
    formats/
      draft-format.ts      Per-format labels, card stats, pool layout, final-spin rule
      result-format.ts     Per-format result wording, venues, flags
      white-ball-store.ts  ODI/T20I/IPL player loading, IPL stints, the 25-player squad cut
      white-ball-result.ts Opponent XI, scoring context and calibration for a result page
      white-ball-config.ts, ipl-config.ts, ipl-store.ts
  data/
    legends.json 1970s.json … 2020s.json     Test: 790 records, 536 unique players
    series-calibration.json                   Test: 600 simulated-drafter team scores
    formats/odi.json t20i.json ipl.json       1,178 / 1,029 / 739 players
    formats/<format>-series.json              opponent XI, par, calibration sample
    formats/opponent-only.json                Viv Richards (ODI), Rashid Khan (T20I)
worker/index.ts            /api/scores, /api/events → D1; GET /api/health
public/_headers            Security headers and cache rules
migrations/0001_init.sql   D1 schema: drafts, events
scripts/                   Test diagnostics; cricsheet/ = the white-ball data pipeline (§7);
                           site-audit.mjs, check-live-headers.mjs (launch checks)
tests/                     §11
docs/                      plans/, reports/, previews/ (screenshots), design docs, archive/
```

---

## 3. The spin draft (`components/DraftGame.astro`)

**Six spins → eleven picks:** one pick from the first spin, two from each of the other five.
Test round 1 is always the Legends era; the other formats have no fixed first era.

- **Reels:** slot-machine style. When both reels spin, the nation/team stops first (about 1.1s)
  and the era about a second later. `prefers-reduced-motion` skips the animation.
- **Respins:** one nation/team respin and one era respin per draft, before a pick is made from
  the draw; no era respin in a fixed-era round; none in the Daily Challenge or a friend's challenge.
  Spins never repeat an era×nation pair, and a nation/team lands at most twice per draft.
- **Sounds** (`sfx.ts`): reel ticks, landings, picking, placing, removing, a blocked pick, the
  completed XI. Web Audio, no files. Mute button in the header, remembered in `beatmy11.sound`.
  On by default.
- **Cards show real career stats only, never ratings**, ordered by role then A–Z.
- **Slot-first placement:** tap a player, then a glowing slot; the slot decides the declared role.
- **Unavailable players go to the end** of the pool: players already in the XI or with no place
  left for their role *when the spin landed*. Decided once per spin, not as you pick.
- **Final-round picks stay changeable** after the XI is complete, until "Play the series".
  Earlier rounds are locked.
- **Pool layout** (`DraftFormat.poolLayout`):
  - Test: `'cards'` — swipeable cards and large reels. The owner wants the Test game kept as it is.
  - ODI, T20I, IPL: `'tabs'` — one role at a time behind role tabs, players as compact rows, slim
    reels on phones. After a placement the tab moves to the first role that still has a pick; a
    tab the player opens (tap or swipe left/right) stays open even if everything in it is greyed out.
    Since 2026-10-02 the roles sit side by side in a **native horizontal scroll-snap pager**: the
    list follows the finger, the lit tab follows the list, each role keeps its own scroll
    position, and a first-time "swipe for other roles" cue shows on touch screens until the first
    swipe (`beatmy11.swipeHint.v1`). A safety net nudges the list onto a role if it ever rests
    between two.

### The positional XI (all formats)

| Spots | Slot keys | Accepts |
|---|---|---|
| 1–2 | `opener-1/2` | openers |
| 3–5 | `bat-3/4/5` | middle order |
| 6 | `bat-6` | wicketkeeper (the only keeper slot) |
| 7–8 | `flex-7/8` | all-rounder **or** spinner |
| 9–11 | `fast-1/2/3` | fast bowlers |

Three valid shapes: 2 all-rounders, 1 all-rounder + 1 spinner, or 2 spinners in the flex pair.
Illegal picks are blocked with a reason, including picks that would leave the XI impossible to
complete from the current draw. Persistence: `beatmy11.userXI.v1` (XI array) and
`beatmy11.draft.v1` (serialized v4; players are stored by uid and re-resolved on load).
`draft-slots.ts` parks each mode's draft under its own keys so modes never overwrite each other.

### White-ball squads

- **Squad cut:** a draw shows at most **25 players** (`cutSquad` in `white-ball-store.ts`): the
  most matches for that team in that period, with places per role (4 openers, 6 middle order, 3
  keepers, 3 all-rounders, 3 spinners, 6 fast). The 12 highest-rated players of a draw are
  guaranteed a place if they played 20+ matches for that team in that period. Draws of 25 or
  fewer are untouched. Minimum pool to be spinnable: 5.
- **IPL four-overseas rule** (`MAX_OVERSEAS = 4`): a fifth overseas pick is blocked with a reason;
  overseas players carry an "OS" tag and the tab row shows "Overseas n/4".
- **IPL final spin** (`finalSpinMinPool: 11`): the sixth spin, and a respin in it, never lands on
  a squad of fewer than 11. Four one-season squads are that small (Kochi 2008–12, Pune Warriors
  2013–17, Gujarat Titans 2018–22, Lucknow 2018–22).
- A careless simulated IPL drafter still dead-ends in about 2.8% of drafts (17 of 600) because of
  the overseas rule. Every random set of six spins can be drafted into a legal XI (tested).

---

## 4. The fixed opponents

Scoring never selects players; each opponent is a fixed list.

- **Test World XI** (`opponent-xi.ts`, unchanged since 2026-09-29): Bradman, Gavaskar,
  Tendulkar, Lara, Root, Andy Flower (wk), Kallis, Muralitharan, Garner, Wasim Akram, Pollock.
  Team score **89.4** (batting 98.0, bowling 88.9, fielding 57.2; recomputed 2026-10-02).
  The file's header comment still says "Blend 80.8"; that comment is stale.
- **ODI World XI** (`scripts/cricsheet/owner-allstar-odi.json`, owner 2026-10-01): Jayasuriya,
  Tendulkar, Kohli, Viv Richards, de Villiers, Dhoni (wk), Saqlain Mushtaq, Muralitharan, Wasim
  Akram, McGrath, Pollock. Score 92.4.
- **T20I World XI** (`owner-allstar-t20i.json`): Rohit Sharma, Abhishek Sharma, Suryakumar Yadav,
  Kohli, Maxwell, Buttler (wk), Rashid Khan, Hasaranga, Bumrah, Malinga, Umar Gul. Score 93.8.
- **IPL All-Star XI** (`owner-allstar-ipl.json`): the owner's eleven players, each at his
  **best-rated stint** (chosen by the calibrate script): Kohli RCB 2013–17 (it was RCB 2023+
  before the era adjustment of 2026-10-02), Gayle RCB 2013–17, Rohit
  MI 2013–17, Suryakumar MI 2023+, Raina CSK 2008–12, de Villiers RCB 2013–17 (wk), Chahal RCB
  2018–22, Rashid Khan SRH 2018–22, Malinga MI 2008–12, Bumrah MI 2018–22, Bhuvneshwar SRH
  2013–17. Score 93.0. Exactly four overseas.
- **Opponent-only players** (`owner-opponent-only.json` → `opponent-only.json`): Viv Richards
  (ODI) and Rashid Khan (T20I) have no ball-by-ball matches in the data. Their career line comes
  from the owner's HowSTAT tables and their catches from the owner (100 and 49; run outs are not
  counted for anyone). They are never draftable and are not in the ranking populations.

---

## 5. Test rating engine (`seven-metrics.ts`) — unchanged since 2026-09-30

- **Seven metrics** from existing JSON fields (missing stays `null`): batting average, runs per
  match, century rate; bowling average (lower is better), wickets per match, five-wicket rate,
  ten-wicket rate. Rates use `testMatches`.
- **Role → metrics:** openers, middle order, keepers → batting; spinners, fast bowlers → bowling
  only; all-rounders → both halves. The **declared role** (slot) is the scoring role.
- **Percentiles** against the full eligible population (536 unique players), never split by era
  or nation. **Shrinkage:** `(matches·raw + 30·mean) / (matches + 30)`.
- **Half score** = 75% weighted metrics + 25% longevity (`min(1, Tests/50)`), then the long-career
  bonus (fills up to 80% of the remaining gap, complete at 200 Tests).
- **Weights:** batting 1/3 each; bowling 40% average / 35% wickets per match / 20% five-wicket
  rate / 5% ten-wicket rate.
- **All-rounder:** `100·(1 − (1−S)(1 − 0.5·W))`, stronger half S, weaker half W.
- **Team score** = 0.4·batting unit + 0.5·bowling unit + 0.1·fielding unit (fielding =
  dismissals per match over all eleven). Missing data throws; a misleading score is never shown.
- `ratings.ts` (the old model) was deleted on 2026-10-01 (PR #6).

## 6. White-ball rating engine (`white-ball-metrics.ts`)

Same design as the Test engine (percentiles, shrinkage prior 30 matches, 25% longevity,
long-career bonus fill 0.8, all-rounder formula, 40/50/10 team blend), with per-format metrics:

| | ODI | T20I and IPL |
|---|---|---|
| Batting | average, runs per match, strike rate, century rate (1/4 each) | strike rate **40%**; average, runs per match, fifty rate 20% each |
| Bowling | average, wickets per match, economy, 4+ wicket innings rate (1/4 each) | economy **40%**; average, wickets per match, balls per wicket 20% each |
| Full longevity credit / bonus complete | 100 / 330 matches | T20I 50 / 160; IPL 40 / 75 |

- The 40/20 T20 split is owner-confirmed (2026-10-01). IPL "40 matches" is owner-approved;
  **"75" is `UNCONFIRMED - owner to confirm`**.
- Populations are never mixed across formats. Draftable minimum: 10 matches (`WB_MIN_MATCHES`).
- **IPL era adjustment** (owner approved by merging PR #38, 2026-10-02): the IPL got faster
  (league strike rate 123.4 → 128.9 → 132.9 → 150.3 and economy 7.66 → 8.00 → 8.26 → 9.36 across
  the four blocks), so before ranking a stint's strike rate and economy are scaled to its block:
  `adjusted = real × (league over all seasons ÷ league in that block)`. Cards show the real
  numbers. The other six metrics are untouched; ODI and T20I are untouched.
  `IPL_ERA_NORMALISATION = 'scaled'` in `formats/white-ball-store.ts` (`'none'` restores the old
  behaviour). Analysis: `docs/reports/ipl-era-normalisation.md`.
- **IPL cards are stints** (owner, 2026-10-02): one player, one franchise, one block of seasons
  (2008–12, 2013–17, 2018–22, 2023+), carrying only the numbers from those matches. 947 draftable
  stints (10+ matches in the stint). A player has one record per stint (same `id`) and can be in
  an XI once. Roles stay per player (whole career). ODI and T20I use whole careers.

---

## 7. Data

**Test:** 7 era files, 790 records, 536 unique players, edited by hand; the JSON files are the
source of truth. `series-calibration.json` holds 600 simulated team scores for the "top X% of
drafts" line and the grade.

**White-ball** (`scripts/cricsheet/`, see `README.md` there and `docs/plans/white-ball-formats.md`):

- Built from **Cricsheet** ball-by-ball files (ODC-By; credited on `/privacy`), plus the owner's
  hand-exported **HowSTAT** tables for official career totals (ODI and T20I), plus the Kaggle
  players dataset (CC0) and the Test data for roles. Raw downloads live in gitignored `data-raw/`.
- Rebuild order: `howstat-import.py` → `build-white-ball.mjs` → `calibrate-white-ball.ts` →
  `howstat-check.mjs` → `owner-list.py` → tests and build.
- Owner-supplied facts, never guessed: `owner-overrides.json` (spin/pace, names, some roles),
  `owner-ipl-overseas.json` (14 overseas and 129 Indian among IPL players with no international
  record), the three `owner-allstar-*.json`, `owner-opponent-only.json`.
- Players: ODI 1,178 (820 draftable), T20I 1,029 (588 draftable), IPL 739 players (947 draftable
  stints). Every IPL player's stints add up exactly to his career.
- Afghanistan is not a draftable nation (Cricsheet withholds its matches); ODI data before 2003
  is thin, so older stars' totals come from HowSTAT while their role, fielding rate and some
  strike rates rest on few matches.
- **Open data items** (`UNCONFIRMED - owner to confirm`): roles of older ODI stars (Fleming,
  Astle, de Silva, Whittall, Streak and others), spin/pace for 167 minor bowlers and proper names
  for 9 initials-only players (`docs/reports/white-ball-owner-list.md`).
- Traps already hit are listed in `docs/handoff-2026-10-01.md` (namesake pairing, HowSTAT export
  quirks, do not scrape HowSTAT, Windows `git push` credential helper, never run `astro check`
  unattended).

---

## 8. The result page (`components/SeriesResult.astro`) — three screens, all formats

Revised 2026-10-02. **Per-player ratings are not shown anywhere** (owner: they taught players
which names to pick). Each screen is exactly one phone screen tall **from the first paint and
never changes height** (the page used to grow from one screen to three after the reveal, and the
browser's scroll snap then moved it by itself). Screens 2 and 3 are in the page but invisible
until the reveal ends; swiping down early ends the reveal. "BEAT MY 11" (home link) is at the top
left of all three. Sounds (`sfx.ts`) play for each match card, the verdict, the bars and the
grade, with a mute button on screen 1 (same setting as the draft); browsers only allow them after
the visitor has tapped the page.

1. **The series.** Large scoreline, verdict, "top/bottom X% of drafts", five match cards revealed
   one at a time, a "Player of the series" card (from the winning side; from the user's XI when
   level) with a series stat ("712 runs", "24 wickets"; generated like the headlines, never below
   the figures on the cards, PROVISIONAL ranges in `seriesTotals`), "Draft again". Headlines use initials ("M Muralitharan 7/86"); two or three of the
   five are headed by a batter and the rest by a bowler; each card also shows the other side's
   best effort with the other skill. On phones under 700px tall the cards drop the result line
   and the second performer so nothing scrolls.
2. **Strength and grade.** Batting, bowling and fielding bars fill together, then the overall bar
   (the rounded team score), then the grade, two titles and one tip (`result-insights.ts`):
   - Grade by rank among drafts: A+ top 5%, A top 20%, B top 50%, C the rest.
   - Titles: Dynasty / All-time contender / Solid XI / Work in progress ("Unbeatable" for a 5–0),
     and Batting heavy / Bowling attack / Well balanced (10-point gap between the two units).
   - Tips are about **this XI** (`xiTips`, 2026-10-02): the main tip names the unit that costs
     most against the opponent (gap × the unit's share of the score) in the numbers on the bars;
     other tips appear only when true for the XI (short careers, all-rounders, unused IPL overseas
     places, the keeper). The main tip shows 60% of the time; the same XI always reads the same
     tip. Counts and unit scores only: never a player's name or rating. PROVISIONAL wording. The
     older general tips remain as a fallback.
3. **Share.** The 1080×1350 share card (`share-card.ts`) lists **both XIs** side by side with a
   "Best pick" badge (no number) on the user's best player; "Share result", "Draft again",
   "Save the card". Results share `/r/<u>-<h>?xi=…&c=<spins>` (Test) or
   `/<format>/r/<u>-<h>?…` (ODI, T20I, IPL).
   **A lost series is never worded "I lost"** (owner, 2026-10-02; `share-results.ts`): a 2–3
   reads "I took the World XI to the decider", a 1–4 or 0–5 "Can you beat the World XI?", and the
   message "My XI went 1–4 with the World XI. Can yours do better?". The scoreline always shows.
   PROVISIONAL wording.

Share pages (`/r/<slug>`, `/<format>/r/<slug>`): seven static pages per format with per-scoreline
link-preview images (`public/og/`, `public/og/<format>/`), showing the sender's XI decoded from
`?xi=` and, when `c=` is present, a "same spins" challenge.

---

## 9. Pick any XI (`components/PickGame.astro`, `lib/pick-xi.ts`)

- **Build:** tap one of the eleven slots, search by name or filter by nation/team, pick. Same
  slot rules as the draft; IPL keeps the four-overseas rule. Slot rows show three career stats.
  A switcher at the top changes format.
- **Strength meter:** fills **only when all eleven are in**. A part-built XI would reveal single
  players' ratings (owner spotted this on 2026-10-02).
- **Challenge a friend:** the XI travels in the link (`?vs=<xi>&n=<name>`), encoded like the
  share links; nothing is stored on a server. The friend sees the XI (owner: visible), picks
  their own and plays. The result link (`&me=<xi>&m=<name>`) shows the same series to anyone.
- **Scoring between friends:** a symmetric ladder (`DUEL_CUTS`, owner-confirmed 2026-10-02):
  within 1 point 2–2, up to 4 points 3–2, up to 8 points 4–1, beyond 5–0; one seed per pair of XIs.
- **Result order:** scoreline and five matches → strength bars for both sides → slot-by-slot
  head to head (the same player in both XIs within a slot group faces himself) → share buttons.
- **Badges:** One nation / One franchise, World tour / League tour, Time traveller, New
  generation, No legends (Test), Homegrown (IPL); since 2026-10-02 also One era / One season
  block, Cult heroes (nobody above 30 Tests / 60 ODIs / 30 T20Is / 30 stint matches), Iron men
  (everyone at 100 / 200 / 75 / 50 or more) and Spin twins. Thresholds PROVISIONAL
  (`BADGE_MATCHES`); badges never touch scoring. The data has **no batting hand or bowling arm**,
  so "left-handers" style badges and themes cannot be built without new data.
- **Chain challenges** (2026-10-02): the link carries `k`, how many XIs in a row the XI in the
  link has beaten; "Pick my own XI" on a result takes on the winner with the run carried on. It is
  a number in a link (editable), a friendly count. Rules in `nextChain`, PROVISIONAL.
- **Beat the clock** (2026-10-02): an optional 90-second timer, off unless the player turns it on,
  not remembered. At zero the XI is locked as it stands. PROVISIONAL.
- **Head-to-head record** against a named friend, per format, in `beatmy11.h2h.v1` on the device.
- **No fixed opponent in this mode** (owner, 2026-10-02): any all-star XI beat the World XI 5–0.
- These XIs are **never sent** to the anonymous score collection. Saved build:
  `beatmy11.pick.<format>.v1`.

---

## 10. Daily Challenge, friend challenges, telemetry

- **Daily Challenge** (`daily.ts`, `/play?daily=1`, `/<format>/play?daily=1`): the same six
  spins for everyone each UTC day, no respins, one scored attempt a day, streak kept in the
  browser (`bm11.daily.v1`, one per format). Challenge #1 is 2026-10-01. The home page card shows
  the Test daily; the other formats' dailies sit directly under it.
- **Challenge a friend** (`challenge.ts`): a result link carries the six spins (`c=`) and the
  scoreline (`vs=`); the friend drafts from the same spins, any number of tries. All formats.
- **Telemetry** (`telemetry.ts`, `worker/index.ts`, `migrations/0001_init.sql`): fire-and-forget,
  never throws, does nothing under Do Not Track.
  - `POST /api/scores` — one finished Test series: XI hash, both team scores, scoreline. Stored
    with `INSERT OR IGNORE` in `drafts`.
  - `POST /api/events` — per-day counters in `events` for: `shared`, `view_home`, `view_play`,
    `view_result`, `view_shared`, `daily_started`, `daily_completed`, `challenge_started`,
    `challenge_completed`, `view_pick`, `pick_sent`, `pick_played`; ODI, T20I and IPL count under
    the same names with the format appended (`view_play_ipl`).
  - `GET /api/health` — `{"ok":true}`, no database call (2026-10-02).
  - Not stored: IP, cookie, user agent, account, player list. Requests must come from the two
    site origins; bodies over 1 KB are refused; writes are rate-limited to 120 a minute per network
    address with Cloudflare's rate-limiting binding (`API_LIMIT` in `wrangler.jsonc`; previews have
    their own entry because they do not inherit the production one). Series **scores** are sent by the Test draft only
    (`telemetry: false` elsewhere); Pick any XI never sends an XI.
  - **Cloudflare Web Analytics** (cookieless page views) is switched on in the owner's
    Cloudflare account and injected on the live domain only.
  - Row counts and whether the migration is applied in production:
    `UNCONFIRMED - owner to confirm` (production was not queried).
- `/privacy` describes all of this and carries the Cricsheet data credit.

---

## 11. Tests (run 2026-10-02 on `d6be47e`)

`npm test` — **16 suites, all pass, 1,326 assertions:**

| Suite | Passed | Covers |
|---|---|---|
| `xi-logic` | 195 | slots, roles, blocking, moves, persistence, final-round changes |
| `full-draft` | 242 | 120-trial real-data draft simulation, achievability oracle |
| `seven-metrics` | 147 | Test engine |
| `series` | 91 | ladder, wobble, headlines and balance, player of the series and its stat, grades, titles, tips about the XI |
| `share` | 137 | share slugs, XI encode/decode, share wording for every format and scoreline |
| `seo-pages` | 246 | /best-xi and /best page models |
| `daily` | 29 | daily spins, streaks |
| `challenge` | 35 | challenge links, per-format dailies |
| `white-ball-data` | 28 | aggregation on hand-checked matches, generated data sanity |
| `white-ball-metrics` | 32 | white-ball engine |
| `ipl-draft` | 24 | stints, overseas flags and rule, squads, final spin, achievability |
| `intl-draft` | 27 | ODI/T20I pools, squad cut, opponent-only players |
| `howstat` | 36 | HowSTAT readers and pairing |
| `pick-xi` | 34 | duel ladder, names, badges, chain challenges, head-to-head record |
| `telemetry` | 4 | every event the pages send is on the Worker's allow-list |
| `worker` | 19 | API guards: origin, size, validation, health, nothing identifying stored |

`npx vitest run`: 2 files, **5 passed** (the schema-test failure noted in the previous version
of this file was fixed in PR #6).

`npx playwright test`: **31 passed** — draft, share, XI-complete, daily, challenge, per-format
dailies and share pages, landing pages, modes isolated, mobile one-screen fit (several phone
sizes), white-ball draft-to-result for all three formats, the Pick any XI flow for all four, the
result page staying still on phones (`result-steady`), result sounds, the role-tab pager
(`role-tabs`, with emulated touch drags) and the Pick any XI clock.

`npm run build`: passes, **59 pages** plus `sitemap-index.xml`. The sitemap leaves out `/404`,
`/matchup` pages, `/share-demo` and `/r/*`; the white-ball play pages and the pick pages are in
it and indexable since 2026-10-02.

Not verified by a machine: how the sounds sound (a human ear), and how the role-tab swipe and the
result page feel under a real finger and with a real browser toolbar sliding in and out (the
tests use emulated touch in Chrome).

---

## 12. Hard rules for anyone (human or AI) working on this project

1. **Work in this repo, in place.** Never create a new project, copy or repository.
2. **Inspect actual data and code before changing anything.**
3. **Do not invent scoring rules** (weights, thresholds, ladders, difficulty). Ask the owner.
   Where a value had to be proposed, it is labelled PROVISIONAL in the code and listed here.
4. **Never fabricate player data, statistics, roles, names or photographs.** Missing data is
   flagged and listed for the owner, never estimated or zero-filled.
5. **Wicketkeepers are scored on batting; all-rounders on both; specialist bowlers on bowling
   only.** The declared role (slot) is the scoring role.
6. **Keep the draft separate from scoring.** Scoring takes explicit XIs and never selects players.
7. **Ratings are hidden.** No per-player rating appears on any screen; unit strengths and the
   overall score appear only for a complete XI. Do not add anything that lets a player read off
   an individual rating (this was a real leak in the first Pick any XI meter).
8. **The World XI / All-Star XI are fixed benchmarks.** They change only when the owner says so.
9. **Feature branch + PR.** Never push to `master`; never commit secrets. The owner merges,
   except as authorised for unattended runs (§1). Before merging: `npm test`, `npm run build`,
   `npx playwright test` all pass locally **and were actually run** (on 2026-10-02 one PR was
   merged while the browser tests had not started; the gate script now refuses that), and the
   Cloudflare check is green. Use `git add <files>`, never `git add -A <folder>`: two local-only
   reports were committed by mistake that way.
10. **The owner is new to coding:** explain what was done and why in plain language, and park
    unchosen ideas in `docs/plans/future-ideas.md`.

---

## 13. Open items

**Pull requests waiting for the owner (open, not merged)**
- **#39 Daily leaderboard** (new stored data + migration 0002, not applied): design in
  `docs/plans/daily-leaderboard.md` (on that branch). Server and pages are built there; the UI
  hides itself until the migration is applied.
- **#40 Terms page draft and privacy corrections** (legal text). The governing-law line is blank.
- **#41 Logo concepts** (preview page only; pick a direction, then close it).
- **#47 SEO pages**: publish the remaining 14 phase-1 pages (59 → 73 pages). The published set
  is the owner's list (`PUBLISHED_XI_SLUGS`, `PUBLISHED_ROLES` in `seo-pages.ts`).

**Waiting on the owner**
- Difficulty: play each white-ball format, especially the IPL after the stint change.
- IPL long-career bonus complete at 75 matches in a stint (proposed, not approved).
- Old ODI roles; spin/pace and names (`docs/reports/white-ball-owner-list.md`).
- From the launch audit (`docs/reports/launch-audit-2026-10-02.md`): an uptime monitor on
  `/api/health`, HSTS preload yes or no. (The API rate limit is done: PR #49.)
- Ads (`docs/plans/ads-plan.md`): a decision, an ad network account, consent choices.
- PROVISIONAL wording and numbers from 2026-10-02 (share wording, tips, series-stat ranges, badge
  thresholds, chain rules, the 90-second clock, the result sounds): listed with their exact values
  in `docs/morning-report-2026-10-02.md`.

**Not built**
- The leaderboard's home-page line (after #39 is decided).
- Daily themes for Pick any XI and a "Boss XI": proposals in `docs/plans/themes-and-boss-xi.md`.
- T20I era normalisation (the effect exists, about a third the size of the IPL's).
- Parked ideas: `docs/plans/future-ideas.md`.

**Known leftovers**
- No page uses React any more (the old React components were removed on 2026-10-02), but the
  React integration and packages are still installed. Removing them is a separate decision.
- `buildWbContext` keeps one record per player id, so an IPL player with several stints
  contributes only his first to the ranking lists (noted in the IPL era report; unchanged).
- Page weight: the game pages carry their player data in the HTML (`/odi/pick` 637 KB
  uncompressed).

---

## 14. Changelog since 2026-10-01 (from git history, PR numbers)

**2026-10-01**
- #6 test fix, `ratings.ts` removed. #7 Daily Challenge. #8 challenge-a-friend links and separate
  saved drafts per mode. #9 one-screen mobile draft layout.
- #10 ODI, T20I and IPL data, the white-ball engine and hidden playable modes; owner's ODI and
  T20I World XIs; opponent-only players; T20I official bowling lines.
- #11 white-ball squads cut to 25. #12 role tabs and slim reels for white-ball drafts.
- #13 owner fixes: final-round changes, SPIN centred, result-page tidy-ups, unavailable players
  to the end of the pool.
- #14 result page revision (three screens, strength and grade, both XIs on the card, ratings
  hidden). #15 slot-machine reels and sounds; nation stops before era.
- #16 role tabs stay on a chosen tab; swipe between roles.
- #17 IPL stint stats and the four-overseas rule.
- #18 Pick any XI for all four formats; home page cards; white-ball and pick pages public; small
  IPL squads never on the final spin; the pick-mode rework.

**2026-10-02**
- #19 this file regenerated. #20 daily challenge, friend-challenge links and share pages for ODI,
  T20I and IPL. #21 per-game anonymous counters. #22 landing pages `/odi/`, `/t20i/`, `/ipl/`.
- #23 handoff for the overnight run. **Overnight run (Claude, unattended):**
- #24 result page: three steady screens on phones, brand on every screen. #25 other dailies under
  the Daily Challenge card. #26 share wording for a lost series. #27 player-of-the-series stat.
  #28 tips about the player's own XI. #29 role tabs as a native swipe pager with a first-time cue;
  #36 its settle safety net.
- #30 launch audit: security headers, `/api/health`, API size guard, contrast fix, audit report,
  rollback note. **#31 fixed #30's Content-Security-Policy, which blocked Cloudflare Web Analytics
  on the live domain from 01:15 to 04:05 UTC** (page-view statistics for that window are
  missing; the game was unaffected). #32 untracked two local reports committed by mistake in #31.
- #33 sounds on the result page. #34 four more Pick any XI badges. #35 chain challenges. #37 the
  optional 90-second clock.
- #38 IPL era adjustment for strike rate and economy (merged by the owner's instruction).
- #44 the intermittent role-tab tap in the browser tests is retried and logged (cause unknown).
  #45 unused components removed. #46 challenge links say when an XI was picked against the clock.
- Open for the owner: #39, #40, #41, #47 (§13).

**Earlier history** (2026-09-24 → 2026-10-01: the game-flow rebuild, positional XI, engine V1 →
V2, five-Test series, share cards, Cloudflare Workers, telemetry, SEO foundation, par −7) is in
git and in `docs/difficulty-analysis.md`; it is not repeated here.
