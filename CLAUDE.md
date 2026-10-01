# BeatMy11.com

Fantasy cricket game: draft an all-time Test XI and see if it beats the house XI.
Full context and hard rules: @PROJECT_CONTEXT.md (read it before changing game logic or scoring).

## Stack
Astro (static) + React islands + Tailwind, TypeScript. Hosted on Cloudflare Workers
(`worker/index.ts`, `wrangler.jsonc`) with a D1 database (`migrations/`). Repo: GitHub `master` = live.

## Commands
- `npm run dev` - local dev server
- `npm test` - logic test suites (must pass)
- `npm run test:e2e` - Playwright
- `npm run build` - must pass before any change is considered done

## Working rules
- Work in place in this repo. Never create copies or new projects.
- Inspect existing code/data before changing anything.
- Never fabricate player data or stats. Missing data is flagged, never estimated.
- Do not invent scoring rules. Ask the owner.
- Make changes on a feature branch and open a PR. Never push directly to `master`.
- Never commit secrets or tokens.

## Owner context
Owner is new to coding, SEO and marketing: explain what you did and why in plain language.
Growth goals: SEO + social sharing (India and global Test fans). Planned features: daily
challenge with streaks, challenge-a-friend links, ODI/T20/IPL formats.
