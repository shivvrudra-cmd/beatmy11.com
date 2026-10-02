# IPL: should players be rated against their own seasons? (2026-10-02)

**Status: adopted. The owner said "merge PR #38" on 2026-10-02, so option (c) below is live.
The open questions at the end (par −19, T20I) are still the owner's to revisit.**

## The owner's point

A strike rate of 130 was good in 2008–13 and is ordinary now. The IPL engine ranks every stint
against one list of all stints, so a recent batter looks better than an early one with the same
quality, and a recent bowler's economy looks worse.

## Is it true in the data? Yes.

League figures from every ball in the IPL data (`iplLeagueRates()` in
`src/lib/formats/white-ball-store.ts`; all players, not only draftable ones):

| Block | League strike rate | League economy rate |
|---|---|---|
| 2008–12 | 123.4 | 7.66 |
| 2013–17 | 128.9 | 8.00 |
| 2018–22 | 132.9 | 8.26 |
| 2023–now | 150.3 | 9.36 |
| All seasons | 133.5 | 8.29 |

The jump is mostly in the last block: scoring is about 22% faster than in 2008–12.

## What it does to ratings today

Mean rating of draftable stints by block, and how many of the 50 best-rated stints come from each
block (`scripts/cricsheet/ipl-era-analysis.ts`):

| | 2008–12 | 2013–17 | 2018–22 | 2023–now |
|---|---|---|---|---|
| **Batters today** (mean rating) | 47.3 | 54.9 | 58.6 | **66.8** |
| Batters today (of the top 50) | 6 | 12 | 12 | **20** |
| **Bowlers today** (mean rating) | **57.5** | 53.8 | 55.5 | 46.4 |
| Bowlers today (of the top 50) | **20** | 11 | 14 | 5 |

So today a 2023–now batter is rated about 20 points higher on average than a 2008–12 batter, and
a 2023–now bowler about 11 points lower than a 2008–12 bowler. That is the era, not the players.

## Three options compared

- **(a) Today:** one list, real numbers.
- **(b) Rank inside each block:** every one of the eight metrics is ranked only against stints of
  the same block.
- **(c) Scale two numbers:** before ranking, strike rate and economy are scaled to the league's
  level in the stint's block: `adjusted = real × (league figure, all seasons ÷ league figure, that
  block)`. A 2008–12 strike rate of 130 counts as 140.6; a 2023–now strike rate of 130 counts as
  115.5. The other six metrics are untouched. Cards still show the real numbers.

| | (a) today | (b) inside each block | (c) scale two numbers |
|---|---|---|---|
| Batters' mean rating, 2008–12 → 2023–now | 47.3 → 66.8 | 52.7 → 57.6 | 50.9 → 59.7 |
| Batters in the top 50, by block | 6 / 12 / 12 / 20 | 11 / 13 / 14 / 12 | 10 / 13 / 14 / 13 |
| Bowlers' mean rating, 2008–12 → 2023–now | 57.5 → 46.4 | 55.6 → 53.0 | 53.3 → 55.8 |
| Bowlers in the top 50, by block | 20 / 11 / 14 / 5 | 16 / 11 / 12 / 11 | 13 / 10 / 14 / 13 |
| All-Star XI team score | 92.8 | 92.8 | 93.0 |
| Kohli's best stint (the All-Star XI uses each player's best) | RCB 2023–now | RCB 2013–17 | RCB 2013–17 |
| Simulated series wins at today's par (−18.5) | 14.8% | 13.4% | 12.3% |
| Par that gives about 15% wins | −18.5 | −19 | −19 (14.4%) |
| Top-rated openers | Gill, Jaiswal, Kohli | Warner, Sehwag, Kohli | Warner, Kohli, Sehwag |

(600 simulated human-like drafts, 583 completed, same drafter as the live calibration.)

Both fixes remove most of the tilt. The small rise that remains for batters (51 → 60 under (c))
comes from the other metrics, mainly runs per match and fifty rate, which also rose with scoring.

## Recommendation: (c), scale strike rate and economy

- It fixes what the owner asked about and nothing else, in one sentence a player can understand.
- (b) treats every block as equally strong in everything, including batting average and wickets
  per match. That is a bigger claim than the data supports, and it needs four ranking lists sent
  to the browser instead of one.
- (c) keeps one list, so a great season still ranks above a merely good one from another block.

## What the pull request changes

- `src/lib/formats/white-ball-store.ts`: `IPL_ERA_NORMALISATION = 'scaled'` (one clearly named
  constant; `'none'` restores today's behaviour exactly). Each IPL stint gets two extra, hidden
  numbers (`era:strikeRate`, `era:economy`).
- `src/lib/white-ball-metrics.ts`: the IPL metrics rank on the adjusted number when one is present.
  ODI and T20I are untouched.
- `src/data/formats/ipl-series.json` regenerated: All-Star XI score 92.8 → 93.0, Kohli's stint
  RCB 2023–now → RCB 2013–17 (still the owner's eleven players, each at his best-rated stint),
  par −18.5 → −19 (tuned to the same "about 15%" as before: 14.4%).
- Tests: `tests/ipl-draft.test.ts` 16 → 24.

**PROVISIONAL / for the owner to decide:** whether to adopt it at all; (c) versus (b); the par of
−19; and whether runs per match and fifty rate should be scaled too (not done: nobody asked, and
it would be inventing more than was requested).

## Does T20I have the same effect?

Yes, smaller. From the ball-by-ball files, matches between the ten draftable nations:

| Decade | Matches | Strike rate | Economy |
|---|---|---|---|
| 2000s | 93 | 122.9 | 7.70 |
| 2010s | 435 | 125.3 | 7.81 |
| 2020s | 523 | 133.1 | 8.31 |

About 8% faster in the 2020s than the 2000s (the IPL: 22%). T20I cards are whole careers that
often span two decades, so the IPL fix does not carry over directly; it would need each player's
numbers split by decade, which the published data files do not hold (the raw files do). Not done.
**Owner to decide** whether it is worth doing. ODI was not analysed.

## A side finding (not changed)

`buildWbContext` keeps one record per player id when it builds the ranking lists. IPL stints share
their player's id, so a player with three stints contributes only his first to the lists (he is
still *scored* on the stint that was drafted). It affects all three options equally and is how the
live game works today; mentioned so the owner knows. Changing it would shift every IPL rating
slightly and needs its own decision.
