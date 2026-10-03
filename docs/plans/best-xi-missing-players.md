# Best-XI pages: why key players are missing (2026-10-03)

The owner reviewed PR #47 and found key players missing from the teams. Three separate causes,
found by printing every XI the generator would publish with the most-capped players it left out
(`.test-dist/seo-xis.ts`, read-only).

## 1. Many great players are not in the Test data at all (the main cause)

The Test data is a curated 536 players. Of 53 well-known names checked, **34 are absent**:

Wally Hammond, Herbert Sutcliffe, Ken Barrington, Fred Trueman, Brian Statham, Alec Bedser,
Tony Lock (England) · Keith Miller, Ray Lindwall, Richie Benaud, Neil Harvey, Clarrie Grimmett,
Bill O'Reilly (Australia) · Frank Worrell, Everton Weekes, Clyde Walcott, George Headley, Rohan
Kanhai, Lance Gibbs, Wes Hall, Charlie Griffith, Sonny Ramadhin, Alf Valentine (West Indies) ·
Graeme Pollock, Barry Richards, Mike Procter, Hugh Tayfield (South Africa) · Vinoo Mankad, Vijay
Hazare, Polly Umrigar, Yuvraj Singh (India) · Fazal Mahmood (Pakistan) · Bert Sutcliffe, John Reid
(New Zealand).

Mostly players from before 1970: the "Legends" group in the data holds 44 players, and most of
them are modern greats (Sangakkara, Steyn, Root and Ponting are in it), not the pre-1970 era.

This also affects the game itself: none of these players can be drafted.

**Fix:** add them to the Test data with real career figures. Never estimated. The owner supplies
the figures (as with the HowSTAT tables for the white-ball formats) or approves a source for me to
copy from, and decides each player's role. About 30 to 60 players would cover the obvious gaps.

## 2. The selection rule leaves out great all-rounders and keepers

Each player has one position, and the rule takes "the highest-rated players at each position, in
whichever of the three XI shapes rates best as a team". Because bowling is half of a team's score,
the two-spinner shape usually wins, so:

- all-time XI: no Kallis; India: no Kapil Dev; England: no Botham or Stokes; Australia, New
  Zealand and others likewise drop their best all-rounder;
- India's keeper is Pant, not Dhoni (Pant rates higher as a batter, and keepers are rated on
  batting only, by the engine's rule).

**Possible fixes (owner decides; each is a selection rule for these pages, not a scoring change):**
(a) always include the best all-rounder when he rates above a given level; (b) pick the shape
whose eleven have the highest combined player ratings rather than the best team blend; (c) leave
the rule and explain it on the page.

## 3. Short careers still rank high in small pools

Harry Brook (41 Tests) over Alastair Cook in England; Devon Conway (36) and Ajaz Patel (22) for New
Zealand; Jomel Warrican (25) for West Indies; an opener with 3 Tests for Zimbabwe. The engine
already pulls short careers towards the average, but in a small pool that is not enough.

**Possible fix:** a minimum number of Tests for these pages (for example 30 or 40). A new rule for
the SEO pages only; the game is unaffected.

## Recommended order

1. Owner supplies (or approves a source for) the missing players' career figures; add them.
2. Choose a fix for causes 2 and 3.
3. Re-run this check, then publish (PR #47 stays open until then).
