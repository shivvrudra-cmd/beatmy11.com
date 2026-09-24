# BeatMy11 Design System

Dark-first design language for BeatMy11. Three sources of truth, kept in sync:

| Layer | File | Purpose |
|---|---|---|
| CSS variables + component classes | `src/styles/globals.css` | Runtime theming, shared utilities |
| Tailwind theme | `tailwind.config.mjs` | Utility classes (`bg-brand-surface`, `text-era-nineties`, …) |
| TypeScript tokens | `src/lib/design-tokens.ts` | Eras, nations, role labels for app logic |

## Color tokens

Defined on `:root` in `globals.css` (also mirrored as Tailwind `brand.*` colors):

| CSS variable | Tailwind | Hex | Usage |
|---|---|---|---|
| `--bm11-bg` | `brand-bg` | `#070B14` | Page background |
| `--bm11-surface` | `brand-surface` | `#0D1424` | Panels, inputs |
| `--bm11-elevated` | `brand-elevated` | `#141D33` | Cards, popovers |
| `--bm11-border` | `brand-border` | `rgba(148,163,184,.14)` | Hairline borders |
| `--bm11-text` | `brand-text` | `#F1F5F9` | Primary text |
| `--bm11-muted` | `brand-muted` | `#94A3B8` | Secondary text |
| `--bm11-primary` | `brand-primary` | `#22C55E` | Primary actions |
| `--bm11-primary-strong` | `brand-primary-strong` | `#16A34A` | Primary hover |
| `--bm11-gold` | `gold` | `#C9A227` | Championship accents |
| `--bm11-danger` | `brand-danger` | `#EF4444` | Errors, destructive |
| `--bm11-warning` | `brand-warning` | `#F59E0B` | Warnings |
| `--bm11-success` | `brand-success` | `#22C55E` | Success states |
| `--bm11-ring` | `brand-ring` | `#4ADE80` | Focus rings |

`color-scheme: dark` is set so native controls and scrollbars render dark.

## Utility classes

All defined in `globals.css` under `@layer components` / `@layer utilities`.

- `.bm11-surface` — flat surface background.
- `.bm11-card` — elevated card: `elevated` bg, hairline border, `rounded-xl`, deep soft shadow.
- `.bm11-btn` — button base (inline-flex, semibold, rounded, transitions, disabled + active-press states). Always pair with a variant.
- `.bm11-btn-primary` — green primary action. Dark text on green (see contrast notes).
- `.bm11-btn-ghost` — quiet secondary: transparent with hairline border, subtle hover fill.
- `.bm11-chip` — small muted pill for metadata tags.
- `.bm11-era-chip` — era pill with a glowing accent dot. Set the accent inline:
  ```html
  <span class="bm11-era-chip" style="--era-accent: var(--era-1990s)">1990s</span>
  ```
  ```astro
  <span class="bm11-era-chip" style={`--era-accent: ${era.accent}`}>{era.name}</span>
  ```
- `.bm11-input` — dark text input with placeholder styling and green focus ring.
- `.bm11-skeleton` — loading placeholder with shimmer sweep (respects reduced motion).
- `.bm11-stat-num` — `tabular-nums` for stats, scores and averages so columns align.
- `.bm11-hero-grid` — faint stat-grid texture for hero/section backgrounds.
- `.bm11-pitch-lines` — subtle cricket-pitch motif (gold-tinted central strip + crease ticks). Decorative only — keep opacity low and never place text directly over the strip without a scrim.
- `.glass-bg` — dark frosted-glass panel (dark-adapted).
- `.animate-pulse-subtle` — gentle opacity pulse for live indicators.
- `.text-balance`, `.tap-highlight-color`, `.content-auto`, `.img-zoomed` — small helpers.

### Usage examples

```astro
<button class="bm11-btn bm11-btn-primary">Spin the wheel</button>
<button class="bm11-btn bm11-btn-ghost">Reroll era</button>

<article class="bm11-card p-6">
  <span class="bm11-chip">Test · 142 caps</span>
  <p class="bm11-stat-num">Avg 52.34 · 11,953 runs</p>
</article>

<input class="bm11-input" placeholder="Search players…" />
<div class="bm11-skeleton h-24 w-full"></div>

<section class="bm11-hero-grid">
  <!-- hero content -->
</section>
```

## Era system

Seven eras, each with a fixed accent color. Defined in `src/lib/design-tokens.ts` as `ERAS`, as `--era-*` CSS variables, and as Tailwind `era.*` colors (decade keys use word forms because `70s` is not a valid identifier: `bg-era-nineties`).

| Era | CSS var | Tailwind | Accent | Range |
|---|---|---|---|---|
| Legends | `--era-legends` | `era-legends` | `#C9A227` | 1877–1970s |
| 1970s | `--era-1970s` | `era-seventies` | `#C26936` | 1970–1979 |
| 1980s | `--era-1980s` | `era-eighties` | `#D64045` | 1980–1989 |
| 1990s | `--era-1990s` | `era-nineties` | `#2AA198` | 1990–1999 |
| 2000s | `--era-2000s` | `era-noughties` | `#3B82F6` | 2000–2009 |
| 2010s | `--era-2010s` | `era-tens` | `#8B5CF6` | 2010–2019 |
| 2020s | `--era-2020s` | `era-twenties` | `#2DD4BF` | 2020–today |

Era accents are for dots, chips, glows and small highlights — never for body text on dark backgrounds (most fail AA as text).

`NATIONS` (10 Test nations) and `ROLE_LABELS` (`opener`, `middle-order`, `wicketkeeper`, `all-rounder`, `fast-bowler`, `spinner` → display labels) also live in `design-tokens.ts`. Role keys match `primaryRole` in `src/data/*.json`.

## Contrast notes (WCAG AA, verified)

| Pair | Ratio | Verdict |
|---|---|---|
| `#052E16` text on `#22C55E` (primary button) | 6.54:1 | ✅ AA + AAA |
| `#052E16` text on `#16A34A` (primary hover) | 4.52:1 | ✅ AA |
| ~~white on `#16A34A`~~ | 3.30:1 | ❌ rejected — do not use |
| `#F1F5F9` on `#070B14` (body) | 17.97:1 | ✅ |
| `#94A3B8` on `#070B14` / `#0D1424` / `#141D33` (muted text) | 7.7 / 7.2 / 6.5:1 | ✅ |
| `#C9A227` on `#070B14` (gold accents) | 8.14:1 | ✅ |

Decision: `.bm11-btn-primary` uses **dark green text `#052E16` on `#22C55E`**, not white on `#16A34A`. The white-on-green combo (3.30:1) fails AA for normal text, so it is banned for buttons and body copy. When pairing white text with green, use a darker green (e.g. `#14532D`/`primary-900`).

## Motion & accessibility

- `prefers-reduced-motion: reduce` disables all animations/transitions globally (shimmer, pulse, transitions).
- `:focus-visible` gets a 2px `--bm11-ring` (`#4ADE80`) outline with 2px offset — visible on the dark background.
- `::selection` uses a translucent green wash.

## What changed / removed

- Old light-mode `body` rules and the `prefers-color-scheme: dark` override are gone — the site is dark-first, always.
- `.glass-bg` was redefined for dark (was white-based).
- `.prose` was removed — it depended on the Tailwind typography plugin, which is not installed.
