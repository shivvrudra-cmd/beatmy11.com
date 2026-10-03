# Test data update from the owner's HowSTAT tables (2026-10-03)

The owner exported Test tables from HowSTAT by hand (HowSTAT is behind Cloudflare's bot check and is
not scraped; see `docs/handoff-2026-10-01.md`). Files read: bowlers with 100+ wickets, all-rounders
with 1,000+ runs and 100+ wickets, batters with 2,000+ runs, keepers with 100+ dismissals, and
players with 50+ catches (all countries). Converted to `data-raw/howstat/test-*.csv` (gitignored).
Tools: `scripts/add-test-players.mjs`, `scripts/fix-test-numbers.mjs` (both re-runnable).

## What changed

- **28 players added** (36 era records; unique Test players 536 to 564, records 790 to 826): Richie
  Richardson, Kim Hughes, Mark Butcher, Matt Prior, Jonathan Trott, Shane Watson, Graeme Hick, Ijaz
  Ahmed, Geoff Marsh, Syed Kirmani, Graham Yallop, Jacques Rudolph, Wavell Hinds, Ridley Jacobs, Greg
  Blewett, Geoff Howarth, Gus Logie, Derek Randall, Ken Rutherford, Asanka Gurusinha, Shaun Marsh,
  Guy Whittall, JP Duminy, Kaushal Silva, Mitchell Marsh, Mitchell Johnson, Lawrence Rowe, Sanjay
  Manjrekar. Numbers are copied from HowSTAT, never estimated. Openers and middle-order roles are the
  owner-approved proposal (the tables do not say where a batter batted); keepers are confirmed by the
  keepers file. **Eras: a decade counts if the player played at least 4 calendar years in it**
  (owner: correct; matches the existing eras 90% of the time; PROVISIONAL).
- **Fielding:** 9 of the 28 have exact dismissals (keepers: catches + stumpings; Richardson, Hughes,
  Butcher, Hick, Logie: catches). HowSTAT has no run-out table, so none of these includes run outs
  (the older Test players' figures do). The other 19 have fewer than 50 catches, so their figure is
  unknown: `dismissalsUnknown: 1`, and the rating counts them as an average fielder
  (`dismissalsUnknown`, `hasFieldingData` in `seven-metrics.ts`). Unflagged missing dismissals are
  still an error.
- **Numbers corrected for 21 existing players** to match HowSTAT (32 values): Atapattu's average
  (44.4 to 39.02), Samuels' runs (3,564 to 3,917), Stokes' hundreds (12 to 14), McKenzie's average,
  Coney's Tests (40 to 52), Pollock's and Chandrasekhar's ten-wicket hauls, Bishoo and Gabriel and
  others by small amounts. Names fixed: "Roshan Mahnama", "Craig Mcmilan", "Mohammad AMir".
- **Draws need 5 players** (`MIN_DRAW_POOL` in `player-store.ts`): adding Gurusinha created a
  one-player 1980s Sri Lanka draw that made 40 of the next 400 daily challenges undraftable. Every
  existing draw had 10 or more players, so no existing draw is removed.

## Effect on the game (measured)

Test World XI score 89.4 (unchanged); 600 simulated human-like drafts win the series 6.7% before and
6.8% after at par -7 (unchanged). Draw sizes grew by one to four players in 27 era and nation draws.

## Not done, and why

- **Pre-1970 greats** (Hammond, Lindwall, Benaud, Trueman, Worrell, Headley...): the owner decided
  against adding more Legends.
- **About 60 bowlers** (Broad, Willis, McDermott, Dilley, Cairns, Malcolm, Finn, Kasprowicz and
  others) are in the bowlers file but no file gives their career years, so they cannot be placed in an
  era. Needs the per-country Test career tables with a Career column.
- **Not in the batting file** (under 2,000 runs): Sammy, Solkar, Brearley, R Arnold: skipped.
- **Possible data issue, not changed:** Kepler Wessels is listed under Australia with 40 Tests (his
  South Africa count; he played 24 for Australia and 40 for South Africa).
- Kirmani and Prior etc. were added only where HowSTAT and our data had no matching player; Craig
  McMillan and Roshan Mahanama were already in the data under misspelled names.
