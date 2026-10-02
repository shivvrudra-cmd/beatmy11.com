# Ads: is there room? (2026-10-02)

**Short answer:** not on the game screens, yes elsewhere. **Nothing has been added.** No ad script,
no analytics script, no empty slot. Ads need the owner's ad-network account and decisions about
consent, so this is a plan only.

## Where ads must not go

- **The draft** (`/play`, `/<format>/play`): on a phone it is exactly one screen, measured by tests.
  An ad would push the XI dock off the screen.
- **Result screen 1** (the series): exactly one screen, measured by tests.
- Anything that covers the game or appears between a tap and its result.

## Where there is room

| Slot | Page | Suggested size | Height to reserve so the page does not jump |
|---|---|---|---|
| 1 | Home, between "More ways to play" and "The World XI" | responsive banner | 100px phone, 90px desktop (a 250px box is an option on desktop) |
| 2 | Landing pages `/odi/`, `/t20i/`, `/ipl/`, between text sections | in-article | 250px |
| 3 | `/best-xi/*` and `/best/*`, after the first table and at the end | in-article | 250px each |
| 4 | Pick any XI, **below** the builder (in the "How it works" text) | in-article | 250px |
| 5 | Result screens 2 and 3 | none recommended | Both are one fixed screen now; an ad would need a fourth screen below the share buttons. Possible, but it is the moment players share, so it costs the most goodwill. |
| 6 | Share pages `/r/*`, below "Draft your XI" | banner | 100px |

Best value for least harm: slots 2 and 3 (text pages that search visitors land on), then 1.
The pages people play on stay clean.

Every slot must have its height reserved in CSS before the ad loads, or the page jumps as it
arrives (bad for visitors and for Google's layout-shift measure).

## What has to happen first

1. **An ad network account, and its approval.** Networks such as Google AdSense review a site
   before serving ads. They want enough readable, original content. Today the text pages are the
   12 `/best-xi` and `/best` pages, three landing pages, the home page and privacy. That may be
   thin for approval; a few more content pages (the SEO plan already lists some) would help.
2. **`ads.txt`** at the site root, with the line the network gives you. One small file.
3. **A consent banner.** Ads set cookies and personalise. Visitors in the EU, UK and several other
   places must be asked first, with a real "no". Google requires a certified consent tool for
   those regions. Today the site sets no cookies and needs no banner; ads change that.
4. **The privacy page** rewritten to name the ad network, the cookies and how to opt out. The
   terms draft (PR #40) already says the page will be updated before ads are added.
5. **The Content-Security-Policy** in `public/_headers` must list the ad network's hosts, or the
   ads will be blocked (this is what happened to Cloudflare's own analytics on 2026-10-02). Ad
   networks load scripts from many hosts, so the policy gets much looser; that is the price.
6. **Do Not Track**: the site honours it for its own counters today. Decide whether ads do too.

## Likely effect on speed

The site is fast because pages load almost nothing from elsewhere. An ad script is typically
several hundred kilobytes of JavaScript from third parties, loaded on every page that has a slot.
Expect slower loading and a lower performance score on those pages. Keeping ads off the game
pages keeps the game itself as fast as it is.

## Alternatives worth a thought

- **A single sponsor line** ("Daily Challenge brought to you by ...") is one image and a link: no
  cookies, no consent banner, no third-party script. It needs someone to sell it.
- **Affiliate links** on the Best XI pages (books, memorabilia) are plain links with a disclosure.
- Wait until there is traffic. At a few hundred visitors a week, display ads earn very little;
  the consent banner and the slower pages cost something from day one.

## Decisions for the owner

1. Ads at all, now or later?
2. Which network?
3. Which slots (recommendation: 2 and 3 first)?
4. Accept a consent banner on a site that currently needs none?
