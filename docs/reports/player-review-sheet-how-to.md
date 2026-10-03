# Player review sheet: how to use it

File: `docs/reports/player-review-sheet.csv` (opens in Excel or Google Sheets).
1,895 rows: every ODI, T20I and IPL player with 10 or more matches (players with fewer matches are
not listed: owner, 2026-10-03), including the bowlers the game leaves out because their spin or pace
is unknown. It shows only data the game already holds. Nothing
in it is a guess; the "Why it is flagged" column is only a hint about where to look first.

## Order of the rows

| Group | Rows | What it means |
|---|---|---|
| 1 Left out of the game | 12 | Regular bowlers with no known spin or pace. They are not in the game until you give a type. |
| 2 Check the role | 39 | Takes many wickets but is listed as a batter, or bats well but is listed as a bowler. |
| 3 Older ODI career | 191 | Career started before 2003, so the ball-by-ball data for his role is thin. |
| 4 Weaker source | 606 | The role came from Kaggle or Wikidata, not from his matches. |
| 5 No flag | 972 | Nothing looks wrong. |
| 6 Your earlier decision | 75 | You already decided these; they are at the end. |

Filter or sort by the Format column to do one format at a time.

## What to type

Only in the three columns on the right. Leave a row blank if it is fine.

- **YOUR ROLE** (one of): `opener`, `middle-order`, `wicketkeeper`, `all-rounder`, `spinner`, `fast-bowler`
- **YOUR BOWLING TYPE** (one of): `pace` or `spin`. For group 1 this is the only thing needed.
- **YOUR NOTE**: anything, such as a source or "he opens in T20 only".

Already filled in from what you told me: Shahid Afridi all-rounder; Heath Streak all-rounder and a
pace bowler; Saim Ayub is not a pacer (he needs a bowling type, or none).

## After you send it back

Save the sheet (keep it as CSV) and tell me where it is. I will read your three columns into
`scripts/cricsheet/owner-overrides.json`, rebuild the ODI, T20I and IPL data, re-check that the
World XIs and the pars you set still behave, and report what moved. That reader script is not
written yet.

To refresh the sheet after the data changes: `node scripts/cricsheet/player-review-sheet.mjs`.
