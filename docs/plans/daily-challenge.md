# Daily Challenge with Streaks: spec and tickets

## Goal
Give players a reason to come back every day: one shared draft per day (same spins for everyone),
a score to compare, and a streak for playing on consecutive days.

## What exists today
- Spins come from `getRandomSpin()` in `src/lib/game-engine.ts` using `Math.random()`, so drafts are not repeatable.
- Static Astro site on Cloudflare Workers + D1. The worker (`worker/index.ts`) only handles `/api/scores` and `/api/events`.
- D1 has `drafts` and `events`. No accounts, no IP or cookie stored (see the privacy note in `migrations/0001_init.sql`).
- `/r/<scoreline>` share pages with per-scoreline preview images.

## Spec

### Player experience
1. Home page shows a "Daily Challenge" card: today's date, the streak, and a Play button (or "Done today: 3-2" if already played).
2. The daily draft uses the same sequence of spins for everyone that UTC day. Pick-by-pick choices are still the player's.
3. At the end the player sees the normal series result plus: today's result, current streak, best streak, and "X% of players beat the house today".
4. Share button posts "BeatMy11 Daily #<n>: I beat the World XI 3-2, streak 5" and links to `/r/` (v1) or a daily share page.
5. One scored attempt per day. Extra tries are practice (the normal game).

### Rules
- Day boundary is UTC (simple, matches D1). Show "resets in hh:mm".
- Streak = consecutive UTC days with a completed daily. Missing a day resets it to 1. No streak freezes in v1.
- Day number: days since the launch date (the "#n" in shares).

### Determinism (the core technical decision)
- Add `seededRandom(seed)` (mulberry32) and thread an optional `rng` through `getRandomSpin` (and the nation/era picks near lines 211-260).
- Seed = hash of the date string (`2026-10-02`). Spin number k uses the k-th draw from the same stream, so everyone gets identical spins.
- Spins must not depend on which players the user already took. Choose the replace/reroll rule explicitly (open question 2).
- Unit tests: same date gives the same spin sequence; different dates give different sequences; all combinations are valid.

### Streak storage (privacy-first, no accounts)
- Streaks live in `localStorage` (`bm11.daily = { lastDay, streak, best, results }`). This fits the "no cookies, no IP, no accounts" stance.
- Tradeoff: clearing browser data or switching device loses the streak. Accounts are out of scope for v1.
- Server side adds only anonymous aggregates: reuse `drafts` plus a new `daily_results (day, user_score_band, won, count)` table for "X% beat the house today". No per-player rows.
- Cheating is trivial (edit localStorage). Acceptable because there is no prize or public leaderboard.

### Out of scope for v1
Leaderboards, accounts, streak freezes, push or email reminders, ODI/T20 variants.

## Tickets (in build order)

| # | Ticket | Size | Notes |
|---|--------|------|-------|
| 1 | Seeded RNG and deterministic spin sequence in `game-engine.ts`, with unit tests | S | No UI change; safe to merge alone |
| 2 | Daily state module (`src/lib/daily.ts`): day number, UTC rollover, streak logic, localStorage load/save, with unit tests (missed day, same-day replay, month boundary) | S | Pure functions, easy to test |
| 3 | `/play?daily=1` mode: uses the seeded spins and locks one scored attempt per day | M | Touches the 1189-line `play.astro`; biggest risk |
| 4 | Home page Daily card (streak, played/not played, countdown) | S | |
| 5 | D1 migration `0002_daily.sql` and `/api/daily` (POST result, GET today's stats); validate the day (reject future or stale dates) | M | Preview D1 is separate (`beatmy11-preview`) |
| 6 | Result screen: streak, "% beat the house", daily share text | S | Uses ticket 5 |
| 7 | Playwright e2e: complete a daily, reload, confirm locked; fake the date for streak rollover | M | |
| 8 | Telemetry events (`daily_started`, `daily_completed`) so the plan can be judged by real numbers | XS | Add to `EVENT_NAMES` |

Suggested PR split: PR A = tickets 1-2 (logic only), PR B = 3-4, PR C = 5-6-8, then 7 alongside each.

## Decisions (owner, 2026-10-01): UTC reset, no re-spins, browser-only streaks, launch today (#1 = 2026-10-01)

## Original open questions
1. UTC reset, or IST? (UTC is simpler; IST feels more natural for an Indian audience, but can be added later.)
2. If a spin gives nothing good, may the player re-spin in the daily? Recommendation: no re-spins, so every run is comparable.
3. Is localStorage-only streak storage acceptable for v1? (Recommendation: yes.)
4. Launch date for "#1"?
