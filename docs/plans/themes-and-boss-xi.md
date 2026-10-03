# Daily themes and a "Boss XI" for Pick any XI: proposals (2026-10-02)

Neither is built. Both need a decision from the owner about rules, and the handoff says not to
invent scoring or to touch the World XI / All-Star XI. This note says what is possible with the
data the site holds.

## 1. Daily themes ("one rule for everyone today")

### What the data can and cannot support

Checked on 2026-10-02:

| Rule | Possible? | Why |
|---|---|---|
| Left-handers only, left-arm bowlers only | **No** | No batting hand or bowling arm for any player in any format (0 of 790 Test records; the white-ball files hold only pace or spin). |
| Debuted after a given year | **No (Test), partly (white-ball)** | Test records have an era, not a debut year. ODI/T20I/IPL records have first and last match dates from the ball-by-ball files, so "first match in 2015 or later" works there, with the caveat that ODI data before 2003 is thin. |
| One nation / one franchise only | Yes | `nation` / stint team. |
| No two players from the same nation | Yes | same. |
| One era only, or "no Legends" | Yes | `era` / season block. |
| Nobody with more than N matches ("cult heroes") | Yes | match counts. |
| Everyone with at least N matches | Yes | match counts. |
| Two spinners at 7 and 8, or two all-rounders | Yes | slot roles. |
| IPL: no overseas players, or exactly four | Yes | `overseas`. |
| Names starting with a letter | Yes, but silly | names. |

So about eight honest themes exist today. Left-handers, the owner's first example, needs new data:
batting hand and bowling arm for every player in all four formats (a few thousand records). That is the owner's to supply or approve a
source for; it will not be guessed.

### How it would work (proposal)

- Opt-in: a "Today's theme" switch on Pick any XI, off by default (as the owner asked).
- The day's theme is chosen by the date from a fixed list, the same for everyone, like the Daily
  Challenge spins.
- The picker greys out players who do not fit, with the reason.
- The challenge link carries the theme, so a friend plays the same rule.
- Scoring does not change. A themed XI is scored like any other.

### Decisions for the owner

1. Which of the eight possible themes, and in what order?
2. "Ranked on the same rule" (the owner's words): ranked how? Against friends (works today, no
   server) or on a board (needs the leaderboard, PR #39)?
3. Supply hand/arm data, or drop the left-hander idea?

## 2. A "Boss XI" for Pick any XI

### The problem

In Pick any XI a player can choose anyone. The strongest possible XI under the engine cannot be
beaten, only equalled by picking the same eleven. That is why the owner removed the World XI from
this mode (any all-star XI beat it 5–0). So "beat the Boss XI" has no fair rule unless the player
is restricted in some way. No fair unrestricted rule is obvious; these are the options.

| Option | Rule | Fair? | Cost |
|---|---|---|---|
| A. Beat it under today's theme | The Boss XI is the best XI that fits today's theme; the player must also fit the theme, **and may not use any Boss XI player** | Yes: the player has the second-best eleven at most, so a win needs luck from the series wobble and a near-equal XI | Needs daily themes first. The Boss XI is computed by the engine per theme, which shows players the eleven highest-rated names for that theme: **a ratings leak** unless the owner accepts that. |
| B. Beat it without its players | A fixed Boss XI chosen by the owner; the player may not pick any of the eleven | Yes, and simple | The owner chooses the eleven (it must not be the World XI or All-Star XI, which stay fixed benchmarks). Everyone will converge on the same "best of the rest" XI after a week. |
| C. Budget | Every player costs points by career length or caps; build an XI under a budget to beat the Boss | Could be | Any price list based on ratings leaks them; one based on matches played is honest but arbitrary. This is a new scoring-like rule: the owner's to design. |
| D. Match it | Win by having the better player in most of the eleven slots | No | The slot-by-slot view already exists between friends; against a best-possible XI it is unwinnable. |

**Recommendation:** B, if the owner wants a Boss at all: it is one fixed list, no new rules, and no
ratings are revealed beyond eleven names the owner chose. Its weakness (everyone finds the same
answer) is the same weakness the owner already noted for this mode (idea 5 in the future-ideas
list: a limit to stop identical "best" XIs).

### Decisions for the owner

1. Is a Boss XI wanted, given the above?
2. If yes: option B, and which eleven per format?
