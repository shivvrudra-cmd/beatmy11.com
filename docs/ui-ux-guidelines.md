# BeatMy11 UI/UX Guidelines

Distilled from the uploaded guideline docs (`vercel-ui.md`, `accessibility.md`,
`astro.md`, `tailwind.md`, `AGENTS.md` — the same set used for
freeproteincalculator.com), adapted to BeatMy11's reality: a dark-first,
mobile-first Astro + Tailwind v4 draft game. This doc governs *how* UI work is
done; `docs/design-system.md` remains the token/component reference.

## What was kept, what was ignored

Kept: Vercel's UI principles (simplicity, clarity, consistency, accessibility,
performance, responsiveness); WCAG 2.2 AA accessibility requirements; Astro
conventions (static-first, minimal JS, smallest hydration); Tailwind v4
utility-first styling; the agent working rules (plan before code, smallest
change, ask when unclear).

Ignored: the "micro-tool website / rank on Google / beginner-friendly content"
framing — BeatMy11 is a game, not a content micro-tool. Cloudflare
Pages specifics (no such deploy config in this repo). Light-mode-first
assumptions — this product is dark-first by design.

## Design principles

1. **Clean, minimal, professional.** Every screen should feel production-ready.
   Avoid clutter; avoid unnecessary visual effects.
2. **Mobile-first, always.** Design at 360px first; scale up. Touch targets ≥
   44px; thumb-reachable primary actions.
3. **Visually educative, not paragraph-heavy.** Show state with visuals (bars,
   badges, segments, grouping) instead of explaining it in copy. Shrink copy,
   badges, and metadata by default.
4. **Consistent.** Reuse the existing `bm11-*` component classes and Tailwind
   utilities; don't invent new one-off styles per screen.
5. **Accessible.** Required, not optional — see below.
6. **Fast.** Every UI decision weighs Core Web Vitals, bundle size, and
   responsiveness.

## Stack rules (Astro + Tailwind v4)

- **Astro-first:** prefer static rendering and Astro features over client-side
  JS. Only hydrate when absolutely necessary, with the smallest directive that
  works. (The /play draft game is the justified exception — it's interactive
  by nature.)
- **Tailwind utilities first:** prefer utility classes over new custom CSS.
  The existing `bm11-*` classes in `src/styles/globals.css` are the shared
  component layer — reuse them; don't duplicate their class combinations
  inline. New custom CSS only when Tailwind can't do it cleanly.
- **Tokens stay in sync:** colors live in three places (`globals.css`
  `:root`, `tailwind.config.mjs`, `src/lib/design-tokens.ts`). Any palette
  change updates all three.
- **No inline styles** except for dynamic values (e.g. `--era-accent`).
- **TypeScript where appropriate;** keep components small and focused; comment
  only where intent isn't obvious.

## Accessibility (WCAG 2.2 AA)

- Semantic HTML: `header/nav/main/section/article/aside/footer`; one `h1` per
  page; logical heading hierarchy.
- All interactive elements keyboard-usable (Tab / Shift+Tab / Enter / Space /
  arrows where appropriate). Never remove focus outlines — `:focus-visible`
  ring is already global.
- Buttons: descriptive labels; visible hover, focus, **disabled**, and loading
  states where appropriate.
- Never rely on color alone to communicate state — pair with text, shape, or
  icon. (E.g. round progress uses segments + a text label, not just color.)
- Maintain contrast (see "Contrast notes" in `design-system.md`); support
  color-vision deficiencies.
- Icons don't communicate alone — pair with text.
- Images: meaningful images get descriptive alt text; decorative ones get empty
  alt. **Never generate fake historical player photographs.**
- Respect `prefers-reduced-motion`; keep transitions subtle.
- ARIA only when semantic HTML can't solve it; screen-reader labels for
  custom visual progress (already done via `role="img"` + `aria-label`).
- Accessibility must hold on mobile, tablet, and desktop.

## Page-by-page UX direction

### Homepage (`/`)
- One clear H1, one primary CTA ("Start drafting" → `/play`). No competing
  CTAs above the fold.
- Hero must communicate the game in one glance: spin → draft → compare.
  Prefer a visual (era/nation motif, XI formation graphic) over paragraphs.
- Below the fold: how-it-works in ≤3 steps, the house XI teaser, FAQ kept
  short. Cut anything that doesn't earn its scroll.

### Draft (`/play`)
- The spin zone is the hero: era/nation reels, spin button, and the
  6-segment round bar must all be fully visible without scrolling on a phone.
- Pool cards: name + nation code + era + key stats only. No avatars, no role
  chips in the results context; keep pool cards scannable.
- XI panel: 11 fixed slots, name + declared position. Sticky on desktop,
  collapsible sheet on mobile. The 0/11 counter is the progress source of
  truth.
- Dead-end states (stalled draft, invalid XI) surface "Start over" — never
  during a live draft.

### Results (`/matchup`)
- Verdict first: who won, by how much, in one glance. "Tale of the tape"
  (both XI scores) directly under it.
- Both XIs grouped under position headings; cards show name + nation-code
  badge + era + role-specific stats. No avatars, no redundant role chips.
- V1 answers only "Does Your XI Beat Mine?" — no series, no simulation
  detail, no lengthy explanations.

## Component patterns

- **Buttons:** `.bm11-btn` + variant. Always define hover, focus-visible,
  disabled, and (where async) loading states.
- **Cards:** `.bm11-card` — balanced padding, `rounded-xl`, hairline border,
  soft deep shadow. Clear hierarchy inside: title → meta → stats.
- **Badges/chips:** `.bm11-chip` (muted meta), `.bm11-era-chip` (era, accent
  via `--era-accent`), `.bm11-nation-code` (nation code pill, results pages).
- **Progress:** segmented bars + text labels; never color alone.
- **Skeletons:** `.bm11-skeleton` for loading states (shimmer respects
  reduced motion).
- **Empty/error states:** explain what happened and the one action that fixes
  it (e.g. dead-end draft → "Start over").

## Performance

- Optimize for Core Web Vitals; keep bundles small; avoid new dependencies
  for things Astro/Tailwind already do.
- Lazy-load below-the-fold images; Astro image optimization where practical.

## Working process

1. Explain the plan before writing code.
2. Make the smallest necessary change; don't modify unrelated files.
3. Don't rebuild the draft system — visual work happens in place.
4. Ask when requirements are unclear; never guess on game-flow changes.
5. Verify: tests green (`npm test`), production build passing (`npm run build`).
