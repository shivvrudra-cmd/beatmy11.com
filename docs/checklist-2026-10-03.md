# Checklist and priorities (2026-10-03)

Ranked: 1 = do first. Each item says what is wrong, what is likely behind it (from the code, not
yet fixed), the size of the job, and what is needed from the owner. Tick items off as they merge.
Order of work: A (result page and cards) → B (rules you asked for) → C (data) → D (decisions) →
E (older open items).

## A. Bugs and polish you can see (fix first)

- [ ] **0. IPL: more than four overseas players can be picked (reported 2026-10-03; rule
  violation, so first).** The rule: once an XI has four overseas players, a fifth can never be
  picked. If the player who made the count four was picked in the current round, he can be removed
  and swapped for another overseas player in that round (count goes 4 → 3 → 4, never 5).
  *What the code does today:* the rule is checked when a player is picked, in the draft
  (`validatePoolPick` in `src/lib/player-logic.ts`) and in Pick any XI (`PickGame.astro`), and the
  tests cover it, so the failure is probably elsewhere. *Hypotheses, in order:* (a) a **wrong
  overseas flag in the data**: 332 stints' players are flagged overseas, 278 are flagged not
  overseas (of which 129 came from the owner's "assumed Indian" list, not from an international
  record), so a foreign player flagged Indian would be counted as home-grown; (b) a path that
  skips the check (moving a player between slots, changing a final-round pick, a restored saved
  draft); (c) the "OS" count in the header counts something different from the rule. *First step:*
  reproduce (ask: draft or Pick any XI, which players), then find which hypothesis it is. Add
  tests for the exact rule above (a fifth is blocked; 4 → remove → swap works). **Small to
  medium; data fix needs the owner's facts if it is (a).**

- [ ] **1. Result page lands on the last screen after an IPL draft (phone).** After drafting in
  the IPL and playing the series, the page opens on the share-card screen, skipping the first two.
  *Likely cause:* the result page never resets its scroll position, so it inherits the position
  the draft page was scrolled to (the IPL draft list is taller than the Test one).
  *Fix:* reset the scroll to the top on arrival and switch off the browser's scroll restoration;
  test with a pre-scrolled page. **Small.**
- [ ] **2. Last screen loads a little low and shifts up a second later.** Still happening after
  the fix in PR #24, which only fixed the page growing from one screen to three.
  *Likely causes still open:* the share card's picture arriving and changing the screen's layout,
  and the phone browser's toolbar changing the screen height. Needs a reproduction on your phone
  model (which phone and browser?). **Small to medium.** Do together with 1.
- [ ] **3. Match cards on screen 1: result line and second performer cut off (desktop), after the
  Player of the series card appears.** Lots of unused space on each card.
  *Fix:* put the second performer on the same row as the first, so the result line ("World XI
  won by 176 runs") fits, and make the cards stop being clipped by the Player of the series card.
  **Medium** (desktop and phone sizes both have tests that must keep passing).
- [ ] **4. Pick any XI share card.** (a) The card did not appear the first time (probably still
  drawing; there is no "drawing your card" state), (b) you want the card to show the XI the user
  picked, with the line "Can your all-time XI beat my XI?". *Today:* Pick any XI shares a link
  only, with no picture. *Fix:* draw the share card (like the result page's) from the picked XI,
  show a visible "making your card" state, send picture plus link. **Medium.**

## B. Rule changes you asked for

- [ ] **5. No ties or draws in ODI, T20I and IPL; rare super overs in T20I and IPL.** *Today:*
  the five-match series has one scoreline with a drawn match (2–2 with a tie or washout) in every
  format except Test. *Fix:* in limited overs every match has a winner; the scorelines become
  0–5, 1–4, 2–3, 3–2, 4–1, 5–0; a close match in T20I and IPL is sometimes decided in a super
  over (wording only, rare). *Needs from you:* this changes the difficulty ladder and the "top X%"
  figures, so I will re-tune it to keep the same win rate (about 15%) unless you say otherwise.
  Test keeps its draws. **Medium.**
- [ ] **6. Era respin on the first spin for ODI, T20I and IPL.** *Today:* no respin is allowed in
  round 1 for any format, because the Test game's round 1 is always the Legends era. The other
  formats have no Legends, so the rule does not fit them. *Fix:* allow it in those three; Test
  unchanged. **Small.**
- [ ] **7. A combination the user respun away never comes back in the same game.** *Today:* the
  game only avoids repeating combinations that were played, not ones that were respun. *Fix:*
  remember respun-away nation × era pairs and exclude them from later spins in that draft.
  Also applies to the daily (no respins there, so unaffected). **Small.**
- [ ] **8. Same player twice in the IPL (for example Buttler for two teams)?** *Answer: already
  not possible*: a player counts once per XI across teams and seasons ("… is already in your
  XI"). I will add a test that proves it for the IPL so it stays true, and show Buttler as the
  example. **Tiny.**

## C. Player groups and data (needs your facts; I will not guess)

- [ ] **9. Roles: Shahid Afridi to all-rounder; Heath Streak to all-rounder, also a fast bowler;
  Saim Ayub is not a pacer.** *Fix:* record these as your decisions in the owner overrides file,
  rebuild the white-ball data, re-tune par, re-check the opponent XIs. You gave three; the
  longer list (old ODI roles, spin or pace for about 40 minor bowlers, nine initials-only names)
  is still waiting on you in `docs/reports/white-ball-owner-list.md`: sending more now saves
  rebuilding repeatedly. **Small per player; the rebuild is the cost.**
- [ ] **10. Zimbabwe and Bangladesh best-XI pages have no Streak and no Shakib** (they appear as
  the "heath streak" and "shaking" reports). Cause: the page rule drops all-rounders when the
  two-spinner shape rates best, same cause as Kallis and Kapil Dev missing elsewhere. Part of
  item 17 (PR #47). Needs your choice of rule (see item 17).

## D. Decisions that need numbers first

- [ ] **11. ODI is too easy: should the World XI change, or the engine?** I will measure first:
  how often drafters of different skill win, how the ODI World XI's score compares with the
  strongest XIs possible, and which metrics reward drafters most. Then three options with
  numbers: raise the par (simplest), change some World XI players (your list: Jayasuriya,
  Tendulkar, Kohli, Viv Richards, de Villiers, Dhoni, Saqlain, Muralitharan, Akram, McGrath,
  Pollock), or change the weights (biggest change). *Needs from you:* a target win rate (the
  current provisional target is about 15%). **Analysis: medium.**
- [ ] **12. ODI and T20I cards: whole career or stats for that era?** *Today:* ODI and T20I cards
  show the whole career wherever the player is drawn; IPL already shows only the stint's numbers.
  *Recommendation:* leave ODI and T20I on whole career for now (an era split needs per-decade
  numbers per player, which the published data files do not hold; the raw files do, so it is
  possible but a data rebuild, and it changes every rating and the difficulty). Same question as
  the T20I era adjustment in `docs/reports/ipl-era-normalisation.md`. *Needs from you:* yes or no.

## E. Older open items

- [ ] **13. Logo: none of A to D worked.** *Needs from you:* a direction (rounder, more cricket,
  wordmark only, a colour, something you like on another site). I will make a second round of
  three. Page is the preview in PR #41, which I will close.
- [ ] **14. Phone check of the result page and the role tabs.** Yours; items 1 and 2 above
  probably replace most of it.
- [ ] **15. Cloudflare edge rule on `/api/*` (raised from 10 to 60 per 10 seconds by you).**
  Add a note to the docs; consider raising it further for shared mobile addresses.
- [ ] **16. First real leaderboard entry**: watch it appear, read the names, delete any rude one.
  Moderation command is in `migrations/0002_daily_scores.sql`.
- [ ] **17. Missing players in the best-XI pages (PR #47).** 34 great players are not in the
  Test data (list in `.test-dist/best-xi-findings.md`, to be moved into `docs/`). *Needs from
  you:* career figures or a source, and a choice for all-rounders and short careers. Also fixes
  the game's draft pool.
- [ ] **18. Protein site citations:** about a dozen wrong or unfindable sources
  (`docs/citation-check-2026-10-02.md` in that repo). Plus Google Analytics cookie consent, an
  About text in your words, and the "Team" author credit.
- [ ] **19. Uptime monitor** on `https://beatmy11.com/api/health` (free tools exist; yours).
- [ ] **20. Search Console:** resubmit the sitemap (it now includes `/terms`, the landing pages
  and any new best-XI pages).
- [ ] **21. Parked decisions:** IPL longevity bonus "75" (still unconfirmed), IPL difficulty after
  the stint change, T20I era adjustment, HSTS preload, a Boss XI and daily themes
  (`docs/plans/themes-and-boss-xi.md`), ads (`docs/plans/ads-plan.md`).
- [ ] **22. Marketing posts** (`docs/marketing/launch-posts-v3.md`) waiting to be posted.
- [ ] **23. The intermittent role-tab test** (retry added in PR #44; cause unknown).
