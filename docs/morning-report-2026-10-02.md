# Morning report: the overnight run of 2026-10-02

For the owner. What was asked: `docs/handoff-2026-10-02.md`. Everything below is checked against
GitHub and the live site, not from memory.

## 1. Merged and live on beatmy11.com

Each was merged only after the Cloudflare check on the pull request was green; the production
build after each merge succeeded and the live site answered.

| PR | What changed for a player |
|---|---|
| #23 | (docs) the handoff itself |
| #24 | **Result page no longer scrolls by itself on phones.** All three screens exist at a fixed height from the start. The bars fill only when you swipe down yourself. "BEAT MY 11" (home link) is on all three screens. |
| #25 | Home page: "Today's other dailies" sits directly under the Daily Challenge card. |
| #26 | Share card and messages never say "I lost" (wording below). |
| #27 | "Player of the series" shows a series stat ("712 runs", "24 wickets"). |
| #28 | The tip on screen 2 is about your own XI (texts below). |
| #29, #36 | ODI/T20I/IPL role tabs: the list follows your finger and snaps to a role; a first-time "swipe for other roles" cue; a safety net so the list never rests between two roles. |
| #30 | Launch audit fixes: security headers, `/api/health`, an API size guard, a contrast fix for small grey text, an audit report and a rollback note. |
| #31 | Fix for #30 (see "Things that went wrong"). |
| #32 | (docs) removed two files committed by mistake; corrected the audit note. |
| #33 | Sounds on the result page, with a mute button. |
| #34 | Four more Pick any XI badges. |
| #35 | Chain challenges: "has beaten 3 XIs in a row". |
| #37 | Pick any XI: an optional 90-second clock (off unless turned on). |

Second site, **freeproteincalculator.com** (pushed to `origin/main`, live): each of the 12
`/protein-intake/<weight>-kg/` pages has a bar chart drawn from that page's own numbers and a
step-by-step sum a reader can check. An audit with the list of what only you can supply is in
that repo: `docs/launch-audit-2026-10-02.md`.

## 2. Open pull requests waiting for you (not merged, on purpose)

| PR | What | What you decide |
|---|---|---|
| **#38** | IPL ratings adjusted for the season block. Your point is true in the data: league strike rate 123 → 150 and economy 7.7 → 9.4 from 2008–12 to 2023–now; today a recent batter rates about 20 points higher than an early one of the same standing. The PR scales strike rate and economy to the block's league level. | Adopt or not; this method or ranking inside each block; par −19; whether to look at T20I too. |
| **#39** | Daily leaderboard: design and the server half. The database migration is **not applied**; no page yet. | Names or scores only; that scores can be faked (a friendly board); apply the migration; privacy wording. |
| **#40** | Draft terms page; three additions to the privacy page that describe what the site already does. | Read every line; fill in the governing-law line; approve or change. |
| **#41** | Four logo sketches: https://design-logo-concepts-beatmy11.shivvrudra.workers.dev/logo-concepts | Pick a direction. My view: A (floodlight eleven). C reads as a pause button. They are sketches, not finished artwork. |

## 3. Every PROVISIONAL choice, with its exact value

You can change any of these; none is a scoring rule except where marked.

**Share wording when the series is lost** (`src/lib/share-results.ts`)
- 2–3 headline: "I took the World XI to the decider". Message: "My ODI XI took the World XI to the
  fifth ODI: 2–3 🏏 Can yours do better?" (A 2–3 is always 2–2 going into the last match.)
- 1–4 and 0–5 headline: "Can you beat the World XI?". Message: "My ODI XI went 1–4 with the World XI
  🏏 Can yours do better?"
- Daily: "…my all-time Test XI went 1–4 with the World XI…".
- "World XI" becomes "All-Star XI" in the IPL; "fifth ODI" becomes fifth Test / T20I / match.

**Player-of-the-series stat** (`seriesTotals` in `src/lib/series.ts`): the figures on the match
cards, plus for each match he is not on a card: runs = career average × 0.7 to 1.8 (Test) or × 0.5
to 1.4 (ODI, T20); wickets = 2 to 5 (Test) or 0 to 3 (ODI, T20). Caps: 900 runs / 34 wickets
(Test), 500 / 18 (ODI), 350 / 16 (T20).

**Tips** (`xiTips` in `src/lib/result-insights.ts`; numbers are examples)
1. "Your bowling scored 64 and your batting 88. Bowling is half the overall score, so a stronger attack is the quickest way up."
2. "Your bowling scored 82. That is where you lose most ground to the World XI, and bowling is half the overall score."
3. "Your batting scored 70 and your bowling 84. Batting is 40% of the overall score, so stronger batters are the quickest way up."
4. "Your batting scored 88. That is where you lose most ground to the World XI, and batting is 40% of the overall score."
5. "Your fielding scored 30. It is 10% of the overall score, but it is where you lose most ground to the World XI."
6. "Batting 99, bowling 95, fielding 70: your XI is level with or ahead of the World XI in every part of the game."
7. "4 of your eleven played fewer than 50 Tests. Longer careers get full credit and score higher for the same numbers." (100 ODIs / 50 T20Is / 40 matches in that IPL stint; shown from 3 players)
8. "Both your all-rounders count in your bowling (64) as well as your batting. One who bowled little pulls the attack down." (also a one all-rounder version)
9. "You picked no all-rounder, so slots 7 and 8 count only in your bowling. An all-rounder counts in your batting too."
10. "You used 2 of your 4 overseas places. The rule only stops a fifth; an unused place is worth nothing." (IPL)
11. "Your keeper took 1.9 catches and stumpings a match. Fielding (41) counts those for all eleven, and the keeper usually adds most." (when fielding is more than 10 behind)

The main tip (1 to 6) shows 60% of the time; otherwise one of the others that is true for the XI.

**Badges** (`BADGE_MATCHES` in `src/lib/pick-xi.ts`): Cult heroes = nobody above 30 Tests / 60
ODIs / 30 T20Is / 30 stint matches. Iron men = everyone at 100 / 200 / 75 / 50 or more.

**Chain challenges** (`nextChain`): the holder winning adds one; the challenger winning starts a
run of one; a drawn series keeps the holder and the run. Stops counting at 99.

**Clock**: 90 seconds; at zero the XI is locked as it stands; "Clear my XI" restarts it.

**Role tabs**: cue text "‹ swipe for other roles ›"; the settle nudge waits 0.3 seconds.

**Result sounds**: the notes in `src/lib/sfx.ts` (match won, lost, level; series won, lost, level;
bars; grade).

**Security headers** (`public/_headers`): HSTS for one year without `includeSubDomains` or
`preload`; the Content-Security-Policy allows inline scripts and styles (Astro needs it).

**Contrast**: the dim grey `#6b7694` became `#7f8aa9`.

**Proposed scoring (PR #38, not live)**: `IPL_ERA_NORMALISATION = 'scaled'`, par −19.

## 4. Things that went wrong (and what was done)

1. **Cloudflare Web Analytics was blocked for about 2 hours 50 minutes** (01:15 to 04:05 UTC).
   The new security policy in #30 was tested on the preview build, where it blocked nothing. The
   live domain also carries Cloudflare's analytics script, which previews do not, and the policy
   blocked it. The game was unaffected; page-view statistics for that window are missing. Fixed
   in #31 and re-checked on the live site. The check script now runs against the live site too.
2. **Two local report files were committed to the public repo by mistake** in #31
   (`docs/reports/seo-audit-2026-10-01.md`, `traffic-digest-2026-10-01.md`: traffic counts and
   SEO notes, no passwords or keys). Removed from the repo in #32; they are still visible in that
   commit's history. Tell me if you want the history rewritten (that needs a force-push, which I
   will not do on my own).
3. **PR #33 was merged while the browser tests had not actually run** (the test server timed out
   starting, and my command chain went on to merge). I ran the full suite on `master` straight
   after: 30 passed. The gate script now retries a slow start and the merge step cannot run
   unless the gate passed; it did stop the next bad run (#37 waited for the #36 fix).
4. **The handoff named the wrong remote for the protein site.** The `group` remote's `main` is an
   old, different tree. The live site is built from `origin/main`, so I pushed there and left
   `group` alone.

## 5. What needs you

- The four open pull requests (section 2).
- Cloudflare dashboard: a rate-limiting rule for `/api/*` (one free rule), and an uptime monitor
  on `https://beatmy11.com/api/health`.
- Ads: `docs/plans/ads-plan.md`. Short answer: not on the game screens; room on the text pages;
  needs your account, a consent banner and a looser security policy. Nothing was added.
- Daily themes and a Boss XI: `docs/plans/themes-and-boss-xi.md`. "Left-handers only" cannot be
  built: the data has no batting hand or bowling arm for anyone.
- Protein site: Google Analytics is live there with cookies and **no consent banner**; articles
  are signed by a "Team" with the credential "Nutrition Research & Content". Both are yours to
  decide (that repo's audit).
- Still waiting from before: names for 9 initials-only players, spin or pace for the minor
  bowlers, old ODI roles, posting the marketing drafts, the Search Console sitemap.

## 6. Not verified

- **Sounds**: a test counts the notes; nobody has heard them. Browsers play them only after the
  visitor has tapped the page, so on a fresh result page the first sounds are silent until a tap.
- **Touch**: the role-tab swipe and the result page were tested with emulated touch in desktop
  Chrome. A real finger, Safari on an iPhone, and the browser toolbar sliding in and out were not.
- **The phone result bug itself**: I reproduced its cause (the page growing from one screen to
  three under a mandatory scroll snap) and the test fails on the old code and passes on the new.
  I did not see the original glitch on a real phone, so please check it on yours.
- The logo page and the protein chart were looked at in Chromium only, light theme only for the
  chart.
- The owner's two pasted checklists are not in the repo; the audit covers the items the handoff
  named from them.

## 7. Numbers at the end of the run

`npm test`: 16 suites, 1,318 assertions, all pass. `npx vitest run`: 5 pass. `npx playwright
test`: 31 pass. `npm run build`: 59 pages. `node scripts/site-audit.mjs`: 0 problems.
`node scripts/check-live-headers.mjs https://beatmy11.com`: 0 problems.
