# Daily leaderboard: design (2026-10-02)

**Status: designed and built on an open pull request (#39), server and pages. Not merged, not
live, and the database migration has NOT been applied.** The owner must (1) agree to storing
display names, (2) apply the migration to production, (3) approve the privacy wording. Until the
migration is applied the board answers with an error and all leaderboard UI stays hidden.

## What the owner asked for

A leaderboard for each day's Daily Challenge with the best overall score at the top. Folded in:
"% who beat the World XI today" (future idea 8).

## Why it needs something new

Today the site has no way to show one player's result to another. The Worker only *accepts*
anonymous counters and Test scores; it has no read endpoint, and nothing tells two players apart.
A leaderboard needs: a place to store a score per player per day, a way to read the day's list,
and a way to stop one browser entering twice.

## The design

### What is stored (new table `daily_scores`, migration `0002_daily_scores.sql`)

| Column | What | Why |
|---|---|---|
| `day` | UTC date, set by the server | a player cannot post into another day |
| `format` | `test`, `odi`, `t20i`, `ipl` | one board per format per day |
| `player` | a random 32-character id made in the browser, kept in its local storage | one entry per browser per day; it is not a login and is not linked to a person |
| `xi_hash` | the same 8-character fingerprint the site already sends | shows that equal scores came from the same XI |
| `score` | overall team score, 0 to 100 | the ranking |
| `series_user`, `series_house`, `draws` | the scoreline | shown beside the score; gives "% who beat the World XI" |
| `name` | optional, typed by the player, cleaned to letters, digits, spaces and `.'-`, at most 20 characters | shown on the board; blank = "Anonymous" |
| `created_at` | time | ties: earlier entry ranks first |

Primary key `(day, format, player)` with `INSERT OR IGNORE`: the **first** result a browser sends
for a day and format is the one that counts, matching "one scored attempt a day".

Not stored: IP address, user agent, cookie, account, the list of players in the XI.

### The API (`worker/index.ts`)

- `POST /api/daily` `{ format, player, xi, score, user, house, draws, name? }`
  Same guards as the existing endpoints (site origins only, 1 KB limit, strict validation). The
  day is the server's UTC day. A score above 100 or below 0 is refused. The name is cleaned on the
  server again; the browser's cleaning is not trusted.
- `GET /api/daily/<format>/<day>` → `{ day, format, total, beat, entries: [{ rank, name, score, user, house }] }`
  The top 50. `beat` = how many entries won their series, so the page can say "23% beat the World
  XI today". With `?score=81.4` it also returns `rank`: where that score would stand, so a player
  outside the top 50 still sees "you are 212th of 640". Cached for 60 seconds
  (`Cache-Control: public, max-age=60`), so a busy day does not hit the database on every view.
  Days in the future or before launch return 404.

### The pages (built on the PR; the home page line is not)

- Result page, daily mode only: after the series, a small form "Add your score to today's board"
  with the optional name, off by default (the player chooses to post). Then the top 10, the
  player's own place, and "% who beat the World XI today".
- Home page Daily card: "Today's best: 84.2" and a link to the full board.
- Do Not Track: nothing is posted, as with the existing counters.

### Honest limits (say them on the page too)

1. **Scores can be faked.** The score is worked out in the browser. The Worker cannot re-score
   an XI: the player data and the engine are not on the server. Someone who knows how can post any
   number up to 100. Mitigations in the design: the cap, one entry per browser per day, the XI
   fingerprint stored beside the score. It is a **friendly board**, not a competition with prizes.
   A real fix means moving the engine and data into the Worker and re-scoring there: possible
   later, not small.
2. **One entry per browser, not per person.** Clearing site data or using a second browser gives
   another entry.
3. **Names are free text.** The cleaning removes symbols and markup, not rude words. **Moderating
   names is the owner's job**: a delete is one SQL statement per row (in the migration file's
   comments). If that is not acceptable, launch with no names (scores and scorelines only): the
   table and API work the same with the name left out.
4. **No rate limit in the Worker** (see `docs/reports/launch-audit-2026-10-02.md`): add the
   Cloudflare rate-limiting rule for `/api/*` before this goes live.

### Privacy page (must change before launch)

Add: what a leaderboard entry holds, that the name is optional and public, that the browser keeps
a random id to stop double entries, and how to ask for an entry to be removed (email). Draft
wording is in the pull request description.

## What the pull request contains

- `migrations/0002_daily_scores.sql` (not applied anywhere but the tests' stand-in database).
- `worker/index.ts`: the two endpoints.
- `tests/worker.test.ts`: validation, one entry per browser per day, ordering, rank, the share
  who won, name cleaning, caching header.
- No page changes. Nothing calls the new endpoints, so merging would not change the live site;
  it is still left unmerged because the handoff says anything with a migration or new stored data
  waits for the owner.

## Decisions made (2026-10-03)

- **Names are allowed** (owner): an optional name, shown publicly; the owner moderates. The
  privacy page now says so (this PR).
- The Cloudflare rate limit is done in code (PR #49); `POST /api/daily` is covered by it.
- Still open: apply the migration, then merge.

## For the owner to decide

1. Names: allow (and moderate), or scores only.
2. Apply the migration to production: `npx wrangler d1 migrations apply beatmy11 --remote`.
3. Is "first result of the day counts" right, or should the best of several count? (The daily is
   one scored attempt, so first = only, unless the browser's data is cleared.)
4. Top 50 and a 60-second cache: fine, or different?
