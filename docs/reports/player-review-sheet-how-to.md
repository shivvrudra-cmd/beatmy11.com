# Player review sheet: how to use it

File: `docs/reports/player-review-sheet.csv` (opens in Excel or Google Sheets).

**207 players**, not everyone: only the players the data flags as doubtful who have played **25 or
more matches** (owner's choice, "option A", 2026-10-03). Everyone else keeps the role the game works
out from how they batted and bowled. Players with fewer than 10 matches are not in the game at all.

Why these 207:
- 37 take many wickets but are listed as batters, or bat well but are listed as bowlers.
- 170 are ODI players whose career started before 2003, so the ball-by-ball data behind their role
  is thin.

## The columns

| Column | What it is |
|---|---|
| Format | ODI, T20I or IPL: the numbers are for that format only |
| Player, Matches | |
| Runs, Bat avg, Bat strike rate | batting numbers together |
| Wickets, Bowl avg, Economy, Bowl strike rate | bowling numbers together (bowl strike rate = balls per wicket) |
| Role in the game now | the role the game has for him today |
| **YOUR ROLE** | type here only if the role is wrong |
| **YOUR BOWLING TYPE** | `pace` or `spin`, only if you know it |

Roles to type (exact words): `opener`, `middle-order`, `wicketkeeper`, `all-rounder`, `spinner`,
`fast-bowler`. Leave a row blank if the role is right.

Your three earlier decisions are recorded: Shahid Afridi all-rounder; Heath Streak all-rounder and a
pace bowler (pre-filled in his row); Saim Ayub is not a pacer (needs a bowling type, or none).

## After you send it back

Save the sheet (keep it as CSV) and tell me where it is. I read your two columns into
`scripts/cricsheet/owner-overrides.json`, rebuild the ODI, T20I and IPL data, re-check that the
World XIs and the pars you set still behave, and report what moved. That reader script is not
written yet.

To refresh the sheet after the data changes: `node scripts/cricsheet/player-review-sheet.mjs`.
(The wider version, with every player and why each is flagged, can be made by changing the
`SHEET_MIN_MATCHES` and priority filter at the bottom of that script.)
