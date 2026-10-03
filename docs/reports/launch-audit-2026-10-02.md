# Launch audit: beatmy11.com (2026-10-02)

The owner pasted two generic checklists ("6 traps in AI-built apps" and a 20-point launch list
with a backend follow-up). The pasted text itself is not in the repo, so this audit covers the
items the handoff (`docs/handoff-2026-10-02.md`, section E) names from them. If a point from the
original lists is missing here, paste the list into `docs/` and it will be added.

How it was checked: the code, `npm audit`, the built site (`node scripts/site-audit.mjs`, new),
`curl -I` against the live site, and Playwright against a preview build for the headers.

Status words: **OK** = already fine. **Fixed** = changed in the pull request that added this
file. **Owner** = only the owner can do it. **N/A** = does not apply, with the reason.

## 1. Does not apply today (and why)

| Item | Status | Why |
|---|---|---|
| Age gate | N/A | No sign-up, no accounts, nothing collected from a person. |
| Marketing email rules (unsubscribe, consent) | N/A | The site sends no email and collects no addresses. |
| Subscription and refund terms | N/A | Nothing is sold. |
| DMCA / copyright agent | N/A | Visitors cannot upload anything. |
| Password hashing, 2FA, admin routes | N/A | No accounts, no admin pages. The only server code is `worker/index.ts`. |
| CSRF tokens | N/A | No sessions and no cookies, so there is nothing to forge. The two write endpoints accept only anonymous counters and check the `Origin`. |
| Session replay | N/A | The built pages load no third-party script (checked on all 59). On the live domain Cloudflare adds one: its Web Analytics beacon (`static.cloudflareinsights.com`), which counts page views without cookies and records no sessions. |
| Cookie banner | N/A today | The site sets no cookies. The only third-party script is Cloudflare Web Analytics, which is cookieless. It becomes necessary with ads or Google Analytics (see `docs/plans/ads-plan.md`). |
| Contact form validation and spam protection | N/A | No form; contact is a `mailto:` link on `/privacy`. |

## 2. Already done (verified)

| Item | Status | Evidence |
|---|---|---|
| HTTPS | OK | `https://beatmy11.com` answers 200 over HTTPS; Cloudflare custom domain. |
| Fonts self-hosted | OK | `@fontsource` packages; no request to Google Fonts from any page. |
| Privacy page | OK | `/privacy`. One gap found, see section 4. |
| Custom 404 | OK | `src/pages/404.astro`; `not_found_handling: "404-page"` in `wrangler.jsonc`. |
| Favicon and app icons | OK | `favicon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, web manifest. |
| Sitemap and robots.txt | OK | `sitemap-index.xml`; robots allows everything except `/api/`. |
| Titles and descriptions | OK | Every one of the 59 pages has both (script check). |
| Link-preview (OG) images | OK | Default image plus 28 per-scoreline images. |
| Worker validates input and origin | OK | Now covered by `tests/worker.test.ts` (19 checks). |
| Secrets not in the frontend or the repo | OK | No keys or tokens in tracked files; `.env*` is ignored; the Worker has no secrets (D1 is a binding). |
| Alt text on images | OK | Every `<img>` in the built site has `alt`, `width` and `height` (script check). |
| Broken internal links | OK | None across 59 pages (script check). |
| Dependencies | OK | `npm audit`: 0 vulnerabilities. Four minor updates exist (astro 7.3.5, lucide-react, motion, vitest); not applied unattended because none is a security fix. |

## 3. Fixed in this pull request

| Item | What was done |
|---|---|
| Security headers | `public/_headers` now sends, for every page: `Strict-Transport-Security` (one year; no `includeSubDomains` and no `preload`, both hard to undo), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy` that turns off camera, microphone, location and similar, and a `Content-Security-Policy`. |
| Content-Security-Policy | Scripts, styles, fonts and images from this site only; `data:` and `blob:` images for the share card; API calls to this site only; no frames, no plugins. It allows inline scripts and styles (`'unsafe-inline'`) because Astro inlines small ones; that is weaker than a strict policy but still blocks every other host. Tested on the preview build: all pages and a full draft-to-result flow in each format, with no blocked resource. **If ads or analytics are added later, their hosts must be added to this line or they will not load.** Lesson from the first deploy: the preview passed, but the live domain also carries Cloudflare's Web Analytics beacon, which the first version of the policy blocked from 01:15 to 04:05 UTC on 2026-10-02, about 2 hours 50 minutes (the game was unaffected; Cloudflare Web Analytics page views for that window are missing). The beacon's two hosts are now allowed and the live site was re-checked. |
| API size guard | The Worker refuses a body whose declared size is over 1 KB before reading it (it already refused after reading). |
| `/api/health` | `GET /api/health` returns `{"ok":true}`. It does not touch the database. |
| API responses | `Cache-Control: no-store` and `nosniff` on every API answer. |
| Colour contrast | The "dim" grey (`#6b7694`) was 4.48:1 on the page background and 3.5:1 on cards, under the WCAG AA minimum of 4.5:1 for small text. It is now `#7f8aa9`: 5.9:1 on the background, 4.6:1 on the lightest card. Muted text (`#9aa6c4`, 8.3:1), body text and lime already passed. The share card image and OG images keep the old grey (decorative dash only). |
| A repeatable check | `scripts/site-audit.mjs` (links, alt text, titles, third-party resources, page weight). |
| Rollback note | `docs/rollback.md`. |

## 4. Open, with the reason

| Item | Status | Detail |
|---|---|---|
| Rate limiting on `/api/*` | **Done 2026-10-03** (PR #49) | Done in code with Cloudflare's rate-limiting binding (no dashboard setting needed): writes to the API are limited to 120 a minute per network address, then answer 429 until the minute passes. Reads (`/api/health`, pages) are never limited. Tested on the preview build: requests one after another were refused after about 130 and recovered after a minute. A very fast parallel burst can slip through before Cloudflare's counters catch up (Cloudflare documents the counting as approximate), so this stops sustained hammering rather than every instant burst. The address is only the counter's key inside Cloudflare for up to a minute; the site stores nothing new. `GET /api/health` now also says whether the limiter is attached (`"limiter":true`). The 120 is PROVISIONAL (many phone users in India share one address through their carrier, so it is kept generous). |
| Counters can be inflated | Known | A non-browser client can fake the `Origin` header. The data is only used for tuning and rough traffic counts. Treat it as approximate. |
| Privacy page wording | PR only | Three things the page does not say: (0) Cloudflare Web Analytics counts page views (cookieless); (1) the optional name typed in "Pick any XI" travels in the challenge link; (2) the browser also remembers the sound setting, daily streaks, friend records and the swipe hint. Drafted on the terms-page pull request for the owner to review (legal text is not merged unattended). |
| Terms page | PR only | Drafted, not merged: see the terms-page pull request. |
| Page weight | Note | The game pages carry their player data inside the HTML: `/odi/pick` 637 KB, `/ipl/pick` 605 KB, `/ipl/play` 523 KB, `/play` 335 KB (uncompressed; Cloudflare compresses them to roughly a fifth). Fine on 4G; a later improvement is to load the data as a separate cached file. |
| Image sizes | Note | 38 images, 13.7 MB in total, but 29 of them are link-preview images (about 490 KB each) that only social networks fetch. Pages themselves load almost no images. Converting OG images to JPEG would roughly halve them; not urgent. |
| HSTS preload / includeSubDomains | Owner | Left off on purpose. Turn on only if every subdomain of beatmy11.com will always be HTTPS. |
| Dependency updates | Owner or next session | Four minor updates, none security-related. |
| Monitoring | Owner | `/api/health` exists (now with `"limiter":true`); nothing pings it yet. A free uptime monitor pointed at `https://beatmy11.com/api/health` would do. |

## 5. What the site stores in the browser (for the cookie question)

No cookies. Local storage only, on the visitor's device, never sent anywhere unless they share a link:

| Key | What |
|---|---|
| `beatmy11.draft.v1`, `beatmy11.userXI.v1`, `bm11.slot`, `bm11.parked.*` | the draft in progress and the finished XI, per mode |
| `beatmy11.pick.<format>.v1` | the XI being built in Pick any XI |
| `bm11.daily.v1`, `bm11.daily.active` (per format) | daily results and streak |
| `bm11.challenge.v1` (per format) | a friend's challenge in progress |
| `beatmy11.h2h.v1` | win/loss record against named friends |
| `beatmy11.sound` | sound on or off |
| `beatmy11.swipeHint.v1` | whether the "swipe" cue has been seen |
