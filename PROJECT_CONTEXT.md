# BeatMy11.com — Project Context

> **Purpose of this file:** give any AI assistant (or human) the full picture of what
> BeatMy11 is and what has actually been built, so it can work on the project without
> guessing. Facts here come from the code in this repo, not from memory.
> Last updated: 2026-09-25. `beatmy11.md` is the original vision/spec document and is
> **partly superseded** — where the two disagree, this file describes what is live.

---

## 1. What BeatMy11 is

BeatMy11 is a fantasy cricket web game (Astro + Tailwind + TypeScript). The loop:

1. The user builds an **all-time Test XI** through a spin-based draft (`/play`).
2. The user's XI is compared against a **fixed, deterministic house XI** ("Beat My 11").
3. First release answers exactly one question: **"Does Your XI Beat Mine?"**
   showing **Your XI score**, **My XI score**, and the verdict.

There is deliberately **no** 5-match Test series, no ball-by-ball simulation, and no
AI-generated "why you won" explanation in this release. Those are later features.

Repo: `https://github.com/shivvrudra-cmd/beatmy11.com` (public). `master` is the
live branch; the owner pulls from GitHub and tests on their own PC.

---

## 2. Tech stack & repo layout

- **Astro** (static site, 5 pages), **TypeScript**, **Tailwind CSS**, **Vitest**.
- `npm test` runs all suites; `npm run build` must pass before any change is done.

```
src/
  pages/
    index.astro     Landing page
    play.astro      The spin draft + XI builder (main game screen)
    matchup.astro   Result page: Your XI score vs My XI score + verdict
    share-demo.astro / 404.astro
  lib/
    game-engine.ts    Spin logic (era+nation generation)
    player-logic.ts   Draft rules: quotas, slot system, placement, moves, validation
    player-store.ts   Player data access / normalization
    opponent-xi.ts    The FIXED deterministic house XI (never random)
    ratings.ts        OLD scoring model (still live on /matchup — see §6)
    seven-metrics.ts  NEW seven-metric engine: specified layer only (see §6)
    design-tokens.ts
  data/
    legends.json 1970s.json 1980s.json 1990s.json 2000s.json 2010s.json 2020s.json
                  794 normalized player records total (see §7)
  components/ layouts/ styles/
tests/
  xi-logic.test.ts       127 assertions: slots, roles, blocking, moves, persistence
  seven-metrics.test.ts   44 assertions: metric defs, roles, audit, gated comparison
  full-draft.test.ts     120-trial real-data full-draft simulation (all XI shapes)
```

---

## 3. Game flow (`/play`)

**Spin-first draft, 6 spins → exactly 11 picks:**

- **Round 1:** always the **Legends** era, 1 pick.
- **Rounds 2–6:** the other eras, 2 picks each. Total = 11 players.
- Each spin lands on **Era + Nation**; the left pane shows a role-grouped player pool
  for that combination (Openers / Middle Order / **Wicketkeeper** (own group) /
  All-rounder / Spinner / Fast bowlers).
- Two-step drafting: select a player from the pool, then place them into a glowing
  compatible slot in the right-pane XI.
- Picked players display the era the spin landed on.
- The XI panel groups players by role with counts and role-specific stat columns.

**Hard rules enforced during the draft** (`src/lib/player-logic.ts`):

- Exactly **1 wicketkeeper**, mandatory — a draft cannot complete without one.
  (Data check: 6 Legends-era nation combos have zero keepers in the pool, but all
  non-Legends combos have ≥1 keeper, so the keeper is always obtainable in rounds 2–6.)
- Pool cards for filled role groups disable with the reason as a tooltip.

---

## 4. Positional XI system (the right pane)

The XI is **11 fixed slots**, each storing a **declared role**:

| Spots | Slot group        | Accepts                                              |
|-------|-------------------|------------------------------------------------------|
| 1–2   | Openers           | openers only                                         |
| 3–7   | Batting group     | middle order / wicketkeeper / all-rounder            |
| 8     | Spot 8            | spinner **or** all-rounder                           |
| 9–11  | Fast bowlers      | fast bowlers only                                    |

Exactly **three valid completed XI shapes** exist:

1. 2 openers / 4 middle order / 1 keeper / 1 all-rounder / 0 spinner / 3 fast
2. 2 openers / 4 middle order / 1 keeper / 0 all-rounder / 1 spinner / 3 fast
3. 2 openers / 3 middle order / 1 keeper / 1 all-rounder / 1 spinner / 3 fast

Mechanics:

- When a multi-role player has more than one legal declaration for a slot, a
  **role chooser** appears; the slot stores the declared role.
- **Hard blocking with supply context**: illegal picks/moves are blocked and the UI
  explains why (e.g. which legal slots remain).
- **After the XI is complete, players can only be rearranged within the same slot
  group** — the finished lineup's composition can no longer change. (Draft-time
  moves are unrestricted within the rules.)
- Moves can re-declare roles and can strand the XI; this is handled, not forbidden.
- **Persistence v3** (localStorage): v2 slot states remap, v1 migrates.

`/matchup` currently receives `beatmy11.userXI.v1` as a plain 11-player array in
slot/batting order — the scoring contract both engines share.

---

## 5. The opponent: fixed house XI

`src/lib/opponent-xi.ts` supplies one **fixed, deterministic** house XI.
There is no random opponent selection anywhere in the comparison flow — an older
spec section describing random "Legends" opponents is outdated and was never
implemented. Player selection and scoring are fully separated: scoring functions
take explicit `userXI` and `opponentXI` arrays and know nothing about how the
opponent was chosen.

---

## 6. Rating engines

### 6a. Old model — `src/lib/ratings.ts` (STILL LIVE on `/matchup`)

Era-normalized batting/bowling indexes, volume multiplier, Bradman concave curve,
team-balance modifiers, logistic win probability, plus a random 5-match simulator.
**Known problems (do not copy these patterns):** it mutates player stats, and when
bowling figures are unavailable it estimates them (`testRuns / testWickets`) or
silently converts missing numbers to zero. `matchup.astro` inherits the
silent-zero behavior. This model is slated for replacement.

### 6b. New model — `src/lib/seven-metrics.ts` (specified layer, NOT yet wired in)

Implements only what the owner explicitly specified; everything else is gated
rather than invented:

- **Seven metrics**, computed directly from existing JSON fields (no recalculation,
  no estimation — missing values are `null` and flagged):
  - Batting: **Batting Average** (`testAverage`), **Runs per Match**
    (`testRuns / testMatches`), **Century Rate** (`testCenturies / testMatches`)
  - Bowling: **Bowling Average** (`testBowlingAverage` — the *only* lower-is-better
    metric), **Wickets per Bowler-Match** (`testWickets / testMatches`),
    **Five-Wicket-Haul Rate** (`fiveWs / testMatches`),
    **Ten-Wicket-Match Rate** (`tenWs / testMatches`)
- **Role → metric mapping:**
  - Openers, middle order, wicketkeepers → the 3 batting metrics
  - Spinners, fast bowlers → the 4 bowling metrics **only**
    (no artificial batting score for specialist bowlers in this release)
  - All-rounders → **all 7** (separate batting and bowling sets)
- **Declared role drives evaluation** when supplied; otherwise primary role.
- Deterministic per-player scoring, a missing-data audit (`auditMetrics`), and a
  structured `compareXIs(userXI, opponentXI)` API returning a `TeamComparison`.
- `compareXIs` is fully implemented (finalized 2026-09-25): **percentile-rank
  normalization** across the full eligible scoring population (unique players,
  deduped by id; never split by era/nation/pool/XI) on a 0–100 scale with
  bowling average directionally inverted; **weights** 1/3 per batting metric,
  1/4 per bowling metric, all-rounder 50/50; **XI score = arithmetic mean** of
  the 11 player scores; declared role is the scoring role; missing data throws
  `IncompletePlayerData` instead of producing a misleading score.
- The architecture returns per-player detail in `TeamComparison`, but the
  first release displays only **Your XI score, My XI score, and the verdict**.
- Fixed house XI under the new engine scores **83.6** (diagnostic run
  2026-09-25; see `scripts/seven-metric-diagnostic.ts` to reproduce).

### Scoring decisions — all resolved 2026-09-25 (owner-specified, V1)

1. Normalization: percentile-rank vs full eligible population, 0–100.
2. Weights: batting 1/3 each; bowling 1/4 each.
3. All-rounder: 50% batting / 50% bowling.
4. XI aggregation: arithmetic mean of 11 player scores.
5. `testMatches` confirmed as the denominator for the five derived rates.
6. Declared non-AR role → scored under the declaration (never silently AR).
7. Shrinkage (owner-approved 2026-09-25, W=20): before percentile ranking,
   each metric value is blended with 20 matches of population-mean
   performance — adjusted = (matches × raw + 20 × mean) / (matches + 20) —
   using testMatches as the sample size for all seven metrics. Kills the
   tiny-sample hot-streak problem (Kaia 99.4 → 68.5, Padikkal 99.7 → 80.4;
   no ≤5-Test player in any role's top 10). Missing values stay missing.

---

## 7. Data

- 7 era files (`legends.json`, `1970s.json` … `2020s.json`), **794 normalized
  player records**. Each record carries `id, name, era[], nation, primaryRole,
  roles[], battingHand, bowlingArm, isWicketkeeper`, plus a `stats` object with
  `testMatches, testRuns, testAverage, testCenturies, testWickets,
  testBowlingAverage, fiveWs, tenWs` (among others).
- Existing raw CSVs and fetch scripts live alongside the JSON (`TestStat.csv`,
  `fetch_stats.py`) — the JSON files are the source of truth at runtime.
- **Known data gaps** (owner filled these in manually on 2026-09-25; re-run the
  missing-data audit after any data edit):
  - 6 bowler records had `testBowlingAverage: 0`: Saqlain Mushtaq (in both
    `1990s.json` and `2000s.json`), Mohammed Siraj, Lahiru Kumara, Zahid Mahmood
    (`2020s.json`), Prosper Utseya (`2000s.json`).
  - 2 records had `testMatches: 0` (breaking all per-match rates): Prosper Utseya
    (`2000s.json`, recorded 53 wickets / 0 matches — contradictory row) and
    Tanunurwa Makoni (`2020s.json`, recorded 184 runs / 0 matches — contradictory).

---

## 8. Tests

- `tests/xi-logic.test.ts` — 127 assertions: slot system, declared roles, blocking,
  move-stranding regression, persistence migration.
- `tests/seven-metrics.test.ts` — 44 assertions: all six roles, keeper batting
  evaluation, all-rounder dual evaluation, no batting score for specialist
  bowlers, metric directionality, determinism, missing-data flags, gated
  `compareXIs` (expects the `MissingScoringSpec` throw until a spec is supplied).
- `tests/full-draft.test.ts` — 120-trial real-data simulation drafting complete
  XIs in all three shapes, with a backtracking achievability oracle.
- All suites green; `npm run build` produces the 5 static pages cleanly.

---

## 9. Hard rules for anyone (human or AI) working on this project

1. **Work in this repo, in place.** Never create a new project, copy, ZIP, or repository.
2. **Inspect actual JSON/schema and existing code before changing anything.** An early
   implementation assumed the wrong game flow and had to be fully rebuilt.
3. **Do not invent unresolved mathematical rules** (normalization, weights,
   aggregation). Ask the owner.
4. **Never fabricate player data, statistics, eras, or historical-player
   photographs.** Missing data is flagged, never estimated or zero-filled.
   For imagery: legally sourced/public-domain (attributed), neutral silhouettes,
   stylized portraits, or abstract cricket imagery only.
5. **Wicketkeepers are evaluated on batting. Genuine all-rounders get batting AND
   bowling evaluation. Specialist spinners/fast bowlers get no batting score**
   (this release).
6. **Keep the spin/draft system separate from scoring.** Scoring takes explicit
   XIs; it never selects players.
7. **First release shows only:** Your XI score, My XI score, "Does Your XI Beat
   Mine?" — no series sim, no ball-by-ball, no AI explanations.
8. After verified changes: commit and push to `master` (owner supplies a fresh
   GitHub PAT in chat each time; it is used once, never stored, then revoked).

---

## 10. Recent history (2026-09-24 → 2026-09-25)

- Game-flow rebuild: spin-first draft, fixed house XI, old-model verdict.
- Quota rules → revised positional XI (fixed slots, declared roles, hard blocking,
  v3 persistence) → pool/move follow-up (own Wicketkeeper pool group, same-group
  rearrangement after completion).
- Rating audit: old model mapped, §11 premise found outdated, data gaps flagged.
- Seven-metric specified layer (`seven-metrics.ts` + tests), deliberately gated —
  **not yet wired into `/matchup`**; the old model is still what users see.
- Owner filled the 7 missing-data records manually (2026-09-25).
- Seven-metric engine finalized to the owner's V1 spec (2026-09-25):
  percentile normalization, weights, 50/50 all-rounders, mean aggregation,
  real `compareXIs`; 79 assertions green; diagnostic script added; house XI
  scores 83.6 under the new engine. `/matchup` still on the old model
  pending owner approval of the numbers.
