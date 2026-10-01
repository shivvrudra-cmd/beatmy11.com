# Difficulty analysis: is the five-Test series harder than intended?

Date: 2026-10-01. Read-only analysis: no source, data, test or config file was changed
(the throwaway scripts used were deleted). Nothing in Cloudflare, D1 or production was
queried.

## Short answer

Yes, by a wide margin, **for the simulated drafters**. Against the live house XI
(team score **89.4**) a human-like simulated drafter wins the series **1.5%** of the time
and a score-greedy "smart" drafter that uses respins wins **9.7%**, against an intended
~35%. The gap is structural: the series is decided by `userScore - houseScore`, and no
simulated drafter's median is within 8 points of the house. **How real people fare is
UNKNOWN**: no production data was read. The D1 `drafts` table (`user_score`,
`house_score`, `series_user`, `series_house`, `draws`, see PROJECT_CONTEXT section 12)
will give the real distribution once enough games exist; until then every number below
is about simulated drafters only.

## 1. Current behaviour (reproduced)

### How a score becomes a scoreline (`src/lib/series.ts`)

1. `gap = userScore - houseScore` (both from `teamBlend`, 1 decimal).
2. `gap' = gap + 2.5 * eps`, where `eps` is one standard-normal draw from
   `mulberry32(xiSeed(xi))`. `xiSeed` is FNV-1a over the sorted `id:role` pairs, so the
   draw is fixed per XI (order independent, role sensitive): the same XI always gets the
   same series, and there is no re-roll. `eps` is the first thing `playSeries` draws, so
   the other uses of the RNG (Test order, headlines) do not affect the scoreline.
3. `GAP_CUTS = [-14,-8,-1,1].map(c => c + PAR_GAP)` followed by absolute `[0, 3]`
   = **[-18, -12, -5, -3, 0, 3]**. `bandFor` counts how many cuts `gap'` has reached
   (`>=`), so exactly 0.0 is a 4-1.

| gap' (user - house) | scoreline |
|---|---|
| below -18 | 0-5 |
| -18 to -12 | 1-4 |
| -12 to -5 | 2-3 |
| -5 to -3 | 2-2 (one draw) |
| -3 to 0 | 3-2 |
| 0 to +3 | 4-1 |
| +3 or more | 5-0 |

**A series win is gap' >= -3, i.e. 3-2 or better.** The 2-2 draw is not a win. With
house 89.4, a drafter needs about **86.4 to be a coin flip**, 84.7 for a 25% chance and
88.1 for 75%. P(win) by XI score: 80 -> 0.5%, 82 -> 3.9%, 84 -> 16.9%, 86 -> 43.6%,
88 -> 73.9%, 89.4 -> 88.5%.

The intended shares (`OUTCOME_BANDS[].share`, still in the code as "design reference"):
0-5 10%, 1-4 10%, 2-3 35%, 2-2 10%, 3-2 20%, 4-1 10%, 5-0 5% (35% series wins).

### The two drafter models

Both drafters were run through the real engine (`teamBlend`, `scorePlayer`) and the
real draft rules from `player-logic`; the drafting policies are copied from the two
scripts (calibrate-series.ts for (a), beat-house-analysis.ts section C for (b)), not
re-written.

* **(a) human-like**: sees only card stats, misjudges each player by sd 0.12,
  respins when the best pick looks weak (calibrate-series.ts policy, seeds `i*7919`).
  5000 drafts, 0 stalled. (The committed `series-calibration.json` is the first 600 of
  this same stream.)
* **(b) smart**: picks the highest seven-metric score, respins when the best pick is
  below 80 (beat-house-analysis.ts policy, seeds `i`). 5000 drafts, 4991 complete
  (9 stalled).

| team score | min | p10 | median | p90 | p99 | max | mean |
|---|---|---|---|---|---|---|---|
| house XI | 89.4 | | | | | | |
| (a) human-like | 57.3 | 69.8 | 76.2 | 81.8 | 85.3 | 89.7 | 76.0 |
| (b) smart | 60.1 | 75.2 | 80.8 | 85.0 | 88.2 | 91.9 | 80.4 |

Only 1 of 5000 human-like drafts (and 17 of 4991 smart drafts, 0.3%) out-scores the
house. 18 and 214 respectively are within 3 points of it.

### Scoreline shares, percent, current constants (real per-XI seeds)

| | 0-5 | 1-4 | 2-3 | 2-2 | 3-2 | 4-1 | 5-0 | series wins |
|---|---|---|---|---|---|---|---|---|
| **Intended** | 10.0 | 10.0 | 35.0 | 10.0 | 20.0 | 10.0 | 5.0 | **35.0** |
| (a) human-like, current | 18.9 | 40.7 | 36.2 | 2.8 | 1.4 | 0.1 | 0.0 | **1.5** |
| (b) smart, current | 3.8 | 21.0 | 55.6 | 9.9 | 7.8 | 1.7 | 0.2 | **9.7** |

(Total variation distance from the intended shares: 40.7 and 31.6 points.) This matches
the roughly "0-5 18%, 1-4 40%, 2-3 37%..." quoted in PROJECT_CONTEXT for the 600
sample. The same numbers come out of the analytic calculation (mean over drafts of
`1 - Phi((-3 - gap)/2.5)`: 1.6% and 8.9%), so the seeded draw is not hiding anything.
The two halves of each sample agree (1.4/1.5% and 9.6/9.7%), so 5000 drafts is enough.

PROJECT_CONTEXT line 330 says the old "score-greedy simulated drafts beat the house
~14% of the time" claim was unconfirmed. Re-run: the greedy drafter out-scores the 89.4
house in **0.3%** of drafts and wins the *series* 9.7% (that 9.7% is mostly lucky
wobble at gaps of -3 or better).

## 2. How strong would real players have to be?

Real human win rates are **UNKNOWN**; this section only states the bar.

* To win the series 35% of the time with the current constants, the simulated
  drafters would need to be stronger by a uniform **+8.2 points** (human-like: median
  76.2 -> 84.4) or **+4.0 points** (smart: median 80.8 -> 84.8). Equivalently the
  typical real XI would need to score about **84.5-85** (a coin-flip XI is 86.4).
* The smart drafter is already a ceiling-ish model for what a player can do without
  seeing ratings (it reads the engine's own score for every pick). The best any drafter
  reached in 10,000 simulated drafts is 91.9, and only the top ~10% of smart drafts reach
  85. So a 35% win rate needs the typical real XI to score like the *top ~10%* of a
  perfect-information greedy drafter. That is plausible only if the engine's scores
  are easy to read off a card (a human sees cards, not 0-100 ratings: the ratings are
  revealed after the result).
* Unknown, and the thing that decides everything: the real distribution. Query the D1
  `drafts` table (read-only) once there are a few hundred completed games, compare its
  `user_score` percentiles with the two rows above, and recalibrate from that. Do not
  assume real players sit between the two models.

## 3. Candidate fixes

All results use the same 5000-draft samples and real seeds. "TV" is total variation
distance from the intended shares (half the sum of absolute differences, in points;
lower is better). Win = 3-2 or better.

### 3(i) Single-parameter changes

| change | drafter | 0-5 | 1-4 | 2-3 | 2-2 | 3-2 | 4-1 | 5-0 | wins | TV |
|---|---|---|---|---|---|---|---|---|---|---|
| none (current) | (a) | 18.9 | 40.7 | 36.2 | 2.8 | 1.4 | 0.1 | 0.0 | 1.5 | 40.7 |
| | (b) | 3.8 | 21.0 | 55.6 | 9.9 | 7.8 | 1.7 | 0.2 | 9.7 | 31.6 |
| **PAR_GAP only** (best compromise -8.9; routs stay at 0/+3) | (a) | 4.5 | 20.0 | 49.9 | 10.8 | 14.7 | 0.1 | 0.0 | 14.8 | 25.7 |
| | (b) | 0.6 | 5.0 | 35.5 | 17.1 | 40.1 | 1.7 | 0.2 | 41.9 | 27.6 |
| PAR_GAP only, tuned to exactly 35% wins for (a) (par -12.2) | (a) | 1.1 | 9.0 | 40.4 | 14.4 | 34.9 | 0.1 | 0.0 | 35.0 | 24.8 |
| PAR_GAP only, tuned to exactly 35% wins for (b) (par -8.0) | (b) | 0.8 | 6.8 | 40.6 | 16.9 | 33.1 | 1.7 | 0.2 | 35.0 | 25.6 |
| **Ladder shift** (all six cuts move together, routs stay +4/+7 above par): par -9 -> cuts [-23,-17,-10,-8,-5,-2] | (a) | 4.3 | 19.7 | 49.8 | 10.9 | 11.1 | 3.5 | 0.8 | 15.3 | 25.4 |
| | (b) | 0.5 | 4.8 | 34.7 | 17.1 | 23.2 | 13.6 | 5.9 | 42.8 | 14.9 |
| Ladder shift, par -8 | (a) | 6.1 | 23.6 | 50.3 | 9.9 | 7.7 | 2.1 | 0.3 | 10.1 | 28.9 |
| | (b) | 0.8 | 6.9 | 40.6 | 17.1 | 20.3 | 10.8 | 3.5 | 34.7 | 13.9 |
| Ladder shift, par -10 | (a) | 3.0 | 15.9 | 47.7 | 13.3 | 13.3 | 5.3 | 1.5 | 20.0 | 21.9 |
| | (b) | 0.3 | 3.5 | 27.9 | 16.6 | 25.1 | 17.0 | 9.7 | 51.7 | 23.3 |
| Ladder shift, par -12 | (a) | 1.3 | 9.6 | 41.3 | 14.4 | 18.0 | 11.1 | 4.3 | 33.4 | 11.8 |
| | (b) | 0.0 | 1.7 | 17.4 | 12.6 | 25.5 | 23.2 | 19.6 | 68.3 | 35.9 |
| PAR_GAP only, par -7 (cuts [-21,-15,-8,-6,0,3]; median per-draft result 2-3 for both) | (a) | 8.0 | 28.9 | 47.8 | 8.6 | 6.6 | 0.1 | 0.0 | 6.7 | 31.7 |
| | (b) | 1.2 | 9.4 | 46.6 | 16.1 | 24.8 | 1.7 | 0.2 | 26.6 | 22.6 |
| Ladder shift, par -7 (cuts [-21,-15,-8,-6,-3,0]; median per-draft result 2-3 for both) | (a) | 8.0 | 28.9 | 47.8 | 8.6 | 5.3 | 1.4 | 0.1 | 6.7 | 31.7 |
| | (b) | 1.2 | 9.4 | 46.6 | 16.1 | 17.0 | 7.8 | 1.8 | 26.6 | 17.8 |
| **sigma only** (best 6.2, current cuts) | (a) | 27.9 | 29.6 | 29.5 | 5.1 | 4.4 | 2.2 | 1.3 | 7.9 | 37.4 |
| | (b) | 11.5 | 22.6 | 36.7 | 8.4 | 9.8 | 5.5 | 5.5 | 20.9 | 16.3 |
| thresholds: shift + squeeze spacing by 0.8 (par -8.6, cuts [-19.8,-15.0,-9.4,-7.8,-5.4,-3.0]) | (a) | 11.7 | 25.2 | 40.9 | 7.9 | 9.3 | 3.5 | 1.5 | 14.3 | 22.8 |
| | (b) | 1.8 | 8.8 | 34.5 | 13.7 | 19.2 | 12.4 | 9.7 | 41.2 | 10.7 |

Findings:

* **No single parameter fits both drafters.** The two models differ by about 4.6 points
  in median and the intended shape is wide, so the "right" shift is -12 for (a) and -8
  for (b). Any one value is a bet on where real players sit.
* **sigma cannot fix it.** More luck only spreads results (win rate 1.5% -> 20% at
  sigma 12 for (a)) while wrecking the extremes: at sigma 6.2, 0-5 grows to 28%.
* **PAR_GAP alone leaves 4-1 and 5-0 unreachable** because the rout cuts are absolute
  (0 and +3 vs the house). At any par the human-like drafter gets 0.1% 4-1 and 0.0%
  5-0, versus an intended 15%. To get big wins the rout cuts must move too (ladder
  shift), or the house must get weaker (3(ii)).
* The best compromise of the ladder shift is **par -8.9 (round to -9)**: wins 15.3% /
  42.8%, i.e. it brackets the 35% target (a). The 2-2 draw stays above target for (b)
  (17%) at any par, which only a width change (the 0.8 spacing row) trims.
* A pure house-score change moves the gap exactly like moving the par (see 3(ii)).

### 3(ii) Changing the house XI

Because the series depends on `user - house`, lowering the house score by d is the same
as shifting every cut down by d. Break-even house scores with the current cuts: **81.2
for (a)** and **85.4 for (b)** (35% wins). Every row is exact (real `teamBlend`, all
roles kept, so the XI shape is unchanged: 1 all-rounder, 1 spinner).
Replacement players are all in `src/data/*.json`; no data was invented. "Rating" is the
player's seven-metric score in his own role.

| set (house score) | swaps | (a) wins / TV | (b) wins / TV |
|---|---|---|---|
| 89.4 (current) | none | 1.5 / 40.7 | 9.7 / 31.6 |
| **86.9** | Kallis -> Garfield Sobers (all-rounder, rating 99.2) | 5.2 / 32.8 | 23.0 / 20.7 |
| **85.9** | Kallis -> Angelo Mathews (all-rounder, rating 90.0, 119 Tests) | 8.3 / 30.2 | 30.1 / 16.1 |
| **84.5** | Kallis -> Mathews, Gavaskar -> Geoffrey Boycott (rating 94.6), Pollock -> Makhaya Ntini (rating 86.0) | 14.8 / 25.7 | 41.9 / 14.5 |
| **82.0** | the 84.5 set, but Gavaskar -> Desmond Haynes (85.2), Murali -> Nathan Lyon (89.5), Akram -> Bob Willis (83.6) as well | 29.0 / 14.3 | 63.2 / 32.6 |
| **80.3** | the 82.0 set plus Root -> Damien Martyn (85.8), Flower -> Alec Stewart (81.3) | 41.0 / 12.1 | 75.8 / 41.4 |

Full scoreline rows for these are in the appendix. Other single swaps and what they do
to the house score (alone): Kallis -> Ravindra Jadeja 87.7, Hadlee 87.7, Ashwin 88.0,
Imran Khan 88.1; Lara or Root -> Vaughan, Gower or Pujara about 88.2-88.4;
Murali -> Herath 88.5; Akram -> Ntini 88.5. **A single swap is worth 1-3.5 points at
most**, and only the all-rounder slot is heavy (he feeds both the batting and the
bowling unit). To lose 5 points while keeping the XI recognisably elite takes about
3 swaps; to lose 9 (the (a) break-even) takes 7 swaps and leaves only Bradman,
Tendulkar, Lara and Garner untouched. With replacements of rating >= 90 only, 10 swaps
reach 80.6, so it can't go much lower without choosing 80-85-rated players.

Trade-offs: the house stays a "legendary" side at 85.9-86.9 with one swap, but that
moves the win rate only to 5-23%. The 84.5 set produces **exactly the same** result as
the ladder shift at par -8.9 (the distributions are identical), at the cost of a weaker
and less iconic World XI, any share-card/OG/SEO copy that lists the XI (not
checked; look before changing), and a player-list edit that is
easy to undo. It requires no change to `series.ts` or its tests.

### 3(iii) Re-run the calibration so shares are rank-based again

This is the design before 2026-09-30 (`ac739ac`): rank the XI's score against the
sample of drafted XIs, wobble in normal space (sigma 0.35), then cut the percentile at
the owner shares 10/10/35/10/20/10/5. Reproduced with the real `rankPercentile`,
`normInv`, `normCdf` and the committed 600-draft sample:

| drafter | 0-5 | 1-4 | 2-3 | 2-2 | 3-2 | 4-1 | 5-0 | wins | TV |
|---|---|---|---|---|---|---|---|---|---|
| (a) human-like (the sample itself) | 9.6 | 11.3 | 35.5 | 9.4 | 19.9 | 10.3 | 4.1 | 34.2 | 2.0 |
| (b) smart | 1.4 | 2.7 | 15.8 | 7.7 | 25.9 | 24.5 | 22.0 | 72.4 | 37.4 |

* **What it fixes**: the shares equal the owner targets by construction for whatever
  sample is used. With a sample of real completed drafts from D1 it would be exactly
  the intended 35%, whatever real players turn out to be like.
* **What it loses**: (1) the result no longer depends on the house XI at all
  (changing the house, the engine or the bowling weights would not move the shares,
  only re-sampling would). The 2026-09-30 head-to-head redesign was made so that the
  House XI "drives difficulty". (2) It is self-referential: 35% of *the sample's*
  drafters win, so a better player base just moves the curve, nobody can ever "beat the
  house" in an absolute sense, and a 5-0 against a team that you out-score by -6 is
  possible. (3) The calibration file must be refreshed whenever the player pool or the
  engine changes (the stale file is the same hazard as the stale 80.8). (4) Players
  stronger than the sample (the smart row) get 72% wins and 22% 5-0s, i.e. the game
  is not harder for experts. (5) The score/percentile story on the share card
  ("top X% of drafts") would then also decide the scoreline, so the two cannot disagree
  anymore.

## 4. Recommendation

**Recommend option (i)-ladder shift: PAR_GAP from -4 to -9, with the two rout cuts moved
with it (cuts [-23, -17, -10, -8, -5, -2]).** I would not make it a one-parameter
change in the sense of leaving the rout cuts at 0/+3.

Resulting distribution (percent, 5000 drafts each, wins = 3-2 or better):

| | 0-5 | 1-4 | 2-3 | 2-2 | 3-2 | 4-1 | 5-0 | wins |
|---|---|---|---|---|---|---|---|---|
| Intended | 10.0 | 10.0 | 35.0 | 10.0 | 20.0 | 10.0 | 5.0 | 35.0 |
| (a) human-like | 4.3 | 19.7 | 49.8 | 10.9 | 11.1 | 3.5 | 0.8 | 15.3 |
| (b) smart | 0.5 | 4.8 | 34.7 | 17.1 | 23.2 | 13.6 | 5.9 | 42.8 |

Reasons:

1. It brackets the 35% target with the two models (15% / 43%) instead of betting on
   one; it is the minimum-TV compromise over both (summed TV 40.3, the lowest of any
   single shift), and the one-point sweeps show how it moves (par -8: 10/35, par -10:
   20/52).
2. It is the smallest change: two numbers in `series.ts`, no data or roster change, the
   World XI stays the legendary side and remains at 89.4, and it is reversible.
3. It keeps big wins reachable. PAR_GAP alone would leave 4-1/5-0 at about 0%.
4. It keeps the head-to-head design approved on 2026-09-30 (the house XI still decides
   difficulty), unlike rank-based, and the owner can re-tune par later from real D1
   scores with the same one constant.

Costs to flag honestly:

* The code comment and `docs` rule "a 4-1 needs to out-score the World XI, a 5-0 to beat
  it by 3" would no longer hold: at par -9 a 4-1 needs a gap of about -5. Tests
  `tests/series.test.ts` lines 53-54 hard-code the absolute 0 / +3 cuts and would need
  updating, and `PROJECT_CONTEXT.md` section 1 (the cuts table) too.
* The 2-2 draw stays high for the smart drafter (17%); trimming it needs a spacing
  change (3(i), last row) and is a second decision.
* It is a bet on the drafter model. If real players are closer to (a), wins land near
  15% (par -12 would then be the match); if closer to (b), 43% (par -8). The honest
  way to resolve this is to wait for real D1 data, then set par so the median-ish real
  player gets the intended shares.

**Decisions for the owner**

1. Is the intended 35% series-win rate meant to describe a typical real player, a
   good one, or a top one? (This decides between par -8, -9, -10 and -12.)
2. Should a 4-1 / 5-0 still require out-scoring the World XI? If yes, the only ways to
   make wins common are a weaker house (3(ii)) or accept 4-1/5-0 staying near 0-2% for
   ordinary drafters.
3. Keep the World XI recognisably the all-time greats (my pick), or weaken it
   (e.g. 3 swaps to 84.5)? Same difficulty, different product story.
4. Whether to wait for real D1 data (a few hundred completed games) before moving
   anything, or ship the -9 interim now.
5. Whether the long-run plan is the rank-based design (shares fixed at the owner's
   numbers, house XI no longer drives difficulty).

## 5. Surprising things found (stale comments and dead code)

None of this was changed.

* `src/lib/opponent-xi.ts` header: "Blend 80.8 ... set so a 5-Test series stays
  winnable". The live house score is 89.4.
* `src/lib/series.ts` `PAR_GAP` comment: "World XI's team score ~84" (it is 89.4),
  "only ~3% of [the simulated drafters] win at -4; -9.5 gave ~22%" (now 1.5% for the
  human-like model at -4; at -9.5 it is roughly 17%, between 15.3% at -9 and 20.0% at
  -10). The comment also says par is "a little below" the World XI; the house has
  since moved up (80.8 -> 89.4, PROJECT_CONTEXT section 5), so "4 below" now means a very
  different drafter.
* `src/pages/matchup.astro` header comment (lines 9-17) still describes the old
  design: "the XI's rank among drafted XIs plus a seeded wobble picks the scoreline" and
  "the result comes from the XI's rank". The code uses the score gap; the rank only
  feeds the "top X%" line.
* `scripts/beat-house-analysis.ts`: header says "confirm 87.5" (actual 89.4); its
  `useRespins` threshold is hard-coded 80; its section C and the "win rate at
  candidate house scores" table measure *raw score* wins (`user > house`, 72-83 only),
  not series wins, so it can't answer the series question as it stands.
* `scripts/calibrate-series.ts`: it **overwrites `src/data/series-calibration.json`**
  every run (don't run it just to read the self-check). Its self-check seeds the wobble
  with `mulberry32(i + 1)`, not the production `xiSeed`, so it matches the distribution
  but not an individual draft. Its drafter caps each nation at 2 spins; the
  beat-house drafter does not, so the two models differ slightly beyond skill.
* `normInv` is exported from `series.ts` but only the test file uses it in the
  current code (it was the wobble helper of the old rank design).
  `OUTCOME_BANDS[].share` is used only by the calibrate script and a test (sum = 1);
  the shares have no effect on the live scoreline. `playSeries`'s `percentile` /
  `topPercent` are display-only, as documented.
* `src/data/series-calibration.json` (n = 600, min 62.1, median 76.4, max 86.5) is a
  prefix of the same human-like stream used here, so "none of them out-scores the
  house" (PROJECT_CONTEXT) is true of the 600 but not of 5000 (one reached 89.7).
* The "wins 3-2 or better" definition counts only 3-2/4-1/5-0; the 10% 2-2 draw in the
  intended shares is not a win, so the intended win share is 35% (20+10+5), as used here.

## Appendix: full scoreline rows for the house sets (current cuts)

| house | drafter | 0-5 | 1-4 | 2-3 | 2-2 | 3-2 | 4-1 | 5-0 | wins | TV |
|---|---|---|---|---|---|---|---|---|---|---|
| 86.9 | (a) | 9.4 | 30.9 | 46.9 | 7.6 | 4.2 | 1.0 | 0.0 | 5.2 | 32.8 |
| | (b) | 1.3 | 11.1 | 48.9 | 15.6 | 15.4 | 6.2 | 1.4 | 23.0 | 20.7 |
| 85.9 | (a) | 7.1 | 26.2 | 48.9 | 9.4 | 6.5 | 1.6 | 0.2 | 8.3 | 30.2 |
| | (b) | 1.0 | 7.8 | 44.0 | 17.1 | 18.5 | 9.2 | 2.5 | 30.1 | 16.1 |
| 84.5 | (a) | 4.5 | 20.0 | 49.9 | 10.8 | 10.8 | 3.2 | 0.7 | 14.8 | 25.7 |
| | (b) | 0.6 | 5.0 | 35.5 | 17.1 | 23.0 | 13.3 | 5.6 | 41.9 | 14.5 |
| 82.0 | (a) | 1.7 | 11.6 | 43.5 | 14.2 | 16.8 | 9.2 | 3.0 | 29.0 | 14.3 |
| | (b) | 0.1 | 2.1 | 20.2 | 14.4 | 25.4 | 21.5 | 16.3 | 63.2 | 32.6 |
| 80.3 | (a) | 0.8 | 7.1 | 35.6 | 15.5 | 20.4 | 13.7 | 6.9 | 41.0 | 12.1 |
| | (b) | 0.0 | 1.1 | 12.4 | 10.7 | 23.4 | 24.9 | 27.4 | 75.8 | 41.4 |

Method note: all runs use the real `teamBlend`, `scorePlayer`, `xiSeed`, `mulberry32`,
`wobble`, `bandFor`, `rankPercentile`, `normInv`, `normCdf` and draft-rule functions.
Variant cut sets were evaluated by counting cuts reached on the same per-XI wobble the
live `wobble()` produces, since `bandFor` reads the fixed `GAP_CUTS` constant. Throwaway
scripts were removed after the run.
