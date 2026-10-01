# Marketing and SEO action list (2026-10-02)

Built from `docs/reports/seo-audit-2026-10-01.md` and `docs/reports/traffic-digest-2026-10-01.md`,
checked against the site as it is today. Both reports were written when the site had three
indexable pages and one game. Several of their findings are already fixed.

## Where things stand

| Finding in the reports (1 Oct) | Today |
|---|---|
| Only 3 pages in the sitemap | **22**: home, 12 "best XI / best players" pages, 4 draft pages, 4 Pick any XI pages, privacy |
| Search Console still "processing" | Not re-checked (needs your login) |
| About 33 real visits a day (Cloudflare Web Analytics) | Not re-checked |
| `/play` has about 37 words Google can read | Still true, and now true of the 7 new game pages too |
| `/play` page is 341 KB | Game pages are 270-600 KB before compression, 40-85 KB as actually sent (see item 6) |
| Privacy page title too short | Fixed in this change |
| `/matchup` hidden from Google | Still hidden, as intended |

## Do this week, in order

### 1. Resubmit the sitemap in Search Console (you, 2 minutes)
Google was told about 3 pages; there are now 22. In Search Console open **Sitemaps**, and
resubmit `sitemap-index.xml`. Then look at **Pages** to see whether indexing has started.
*Why first:* nothing else matters for search until Google knows the pages exist.

### 2. Send the Pick any XI link to friends (you, today)
This is the strongest thing to share that the site has had: "Here is my all-time XI. Beat it."
The link shows your XI and asks them to pick theirs; the result shows both names. It works on
WhatsApp without the other person needing to understand the spin game first.
*What to send:* build your XI at `beatmy11.com/pick`, press "Challenge a friend".
*Do the same for the IPL* (`/ipl/pick`): for an Indian audience this is the easier conversation starter.

### 3. New post drafts (Claude writes, you post)
`launch-posts-v2.md` describes a Test-only game. It needs a v3 covering what is new:
four formats, the IPL with four overseas players, Pick any XI, a daily for each format.
Say "write v3" and I will draft them in the same style, with blanks for your own lines.
Same rules as before: your own account, one place a day, no claims about win rates.

### 4. Give the game pages some readable text (Claude builds)
Google ranks pages on text it can read. Each game page shows almost none, because the game loads
after the page does. A short "how this game works" section of 100-200 words on each of the
eight game pages (below the game, so the one-screen phone layout is untouched) fixes that.
*Needs your OK* because it adds visible text to the game pages.

### 5. Home page title and description (your call)
The home page still describes only the Test game:
"Can Your All-Time Test XI Beat the World XI?" That is a good, specific title and I would keep
it. The description could add one clause about ODI, T20I, IPL and Pick any XI. Say yes and I
will change it.

### 6. Page weight (Claude, low priority)
The game pages carry every player's data inside the page: 335 KB (Test) up to 603 KB (IPL
Pick any XI) before compression. Cloudflare compresses them to 41-83 KB, which is what phones
actually download, so this is not urgent. If Core Web Vitals in Search Console later flag slow
pages, the fix is to load player data separately from the page.

### 7. Judge success on real visits, not requests
Cloudflare "requests" include bots (the Netherlands and Poland were suspiciously high). Use
**Web Analytics visits** as the number to watch. Baseline: 33 visits in the first day.
The Test game also counts plays, shares and daily completions in its own database; the new
formats deliberately send nothing yet (item 8).

### 8. Decide whether to count plays in the new formats (your call)
The Test game records anonymous counters (page views, shares, dailies started and completed).
ODI, T20I, IPL and Pick any XI record nothing, so you cannot yet tell which game people prefer.
Adding counters for them is a small change to the Worker and the privacy page wording.
*Recommended*, since "which format do people play?" is the next question you will ask.

## Not worth doing now
- `/404` returning 200 when typed in literally: harmless.
- The same structured-data type on every page: harmless.
- Core Web Vitals, backlinks: wait until Search Console has data.

## Next check
The weekly traffic digest and SEO audit should be re-run on or after 2026-10-08, so there is a
week of data to compare with the 1 October baseline.
