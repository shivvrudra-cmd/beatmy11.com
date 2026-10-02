# Future ideas (not scheduled)

Ideas the owner liked but did not pick for the current version. Bring them up when the related
feature is being worked on, or when the owner asks what to build next. Add new ones at the bottom
with the date; move an idea out of this file when it gets built.

| # | Idea | For | Added | Notes |
|---|---|---|---|---|
| 2 | Daily theme: one constraint for everyone that day, ranked on the same rule | Pick any XI | 2026-10-02 | Proposal in `docs/plans/themes-and-boss-xi.md`. Eight themes are possible from data we hold. "Left-handers only" is **not**: the data has no batting hand or bowling arm. Needs the owner's choices. |
| 5 | A limit to stop identical "best" XIs (two per nation, a Legends cap, or a points budget) | Pick any XI | 2026-10-02 | Owner chose no limits for version 1. Revisit if every shared XI looks the same. |
| 6 | Taller 9:16 share card for phone screens and stories | Result page | 2026-10-02 | Owner said no for now. |
| 8 | "% of players who beat the World XI today" on the daily | Daily challenge | 2026-10-01 | Designed into the daily leaderboard (PR #39, `docs/plans/daily-leaderboard.md` on that branch); waits for that decision. |
| 10 | A "Boss XI" for Pick any XI | Pick any XI | 2026-10-02 | Options and a recommendation in `docs/plans/themes-and-boss-xi.md`. No fair unrestricted rule exists; needs the owner. |
| 15 | T20I ratings adjusted for the decade, like the IPL proposal | Scoring | 2026-10-02 | The effect exists (strike rate 123 → 133, economy 7.7 → 8.3 from the 2000s to the 2020s). Needs per-decade numbers per player; see `docs/reports/ipl-era-normalisation.md` on PR #38. Owner decides. |
| 16 | Re-score daily results on the server so a leaderboard cannot be faked | Daily leaderboard | 2026-10-02 | Means moving the engine and player data into the Worker. Not small. |
| 17 | A sponsor line or affiliate links instead of display ads | Money | 2026-10-02 | No cookies or consent banner needed; see `docs/plans/ads-plan.md`. |
| 18 | Load player data as a separate cached file instead of inside each game page | Speed | 2026-10-02 | `/odi/pick` is 637 KB of HTML uncompressed. |

## Built (moved out of the list)

| # | Idea | Built |
|---|---|---|
| 1 | Beat-the-clock: 90 seconds to pick eleven (opt-in) | PR #37, 2026-10-02 |
| 3 | Chain challenges with a visible run | PR #35, 2026-10-02 |
| 4 | More badges (One era, Cult heroes, Iron men, Spin twins) | PR #34, 2026-10-02 |
| 9 | Sounds on the result page | PR #33, 2026-10-02 |
| 13 | A landing page per format | PR #22, 2026-10-02 |
| 14 | The challenge link says when an XI was picked against the clock | PR #46, 2026-10-02 |
