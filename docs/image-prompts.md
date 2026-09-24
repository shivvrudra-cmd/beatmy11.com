# BeatMy11 — Image Prompts & Asset Pipeline

> Policy: **SVG/CSS-first.** Raster images are only created when they materially
> improve the experience (app icons, OG/social). No AI-generated player
> photographs are used anywhere — historical players are represented by neutral
> silhouette/initials medallions (`src/components/PlayerAvatar.astro`).

## How the PNGs were produced (deterministic, no generative AI)

All raster assets in `public/` were rendered locally from hand-authored SVG
masters with `cairosvg` (no system converters were available in the build
environment). Re-render after editing a master with:

```bash
pip install cairosvg
python3 - <<'EOF'
from cairosvg import svg2png
svg2png(url='public/images/branding/beatmy11-icon-1024.svg', write_to='public/icon-512.png', output_width=512, output_height=512)
svg2png(url='public/images/branding/beatmy11-icon-1024.svg', write_to='public/icon-192.png', output_width=192, output_height=192)
svg2png(url='public/images/branding/beatmy11-icon-1024.svg', write_to='public/apple-touch-icon.png', output_width=180, output_height=180)
svg2png(url='public/images/branding/og-image.svg', write_to='public/og-image.png', output_width=1200, output_height=630)
EOF
```

Note: PNG text falls back to DejaVu Sans at render time (Inter is not a system
font in the build environment). On-page inline SVGs use real Inter via Google Fonts.

## AI image-generation prompts

None. Zero AI-generated raster images were produced for this visual system —
every visual is hand-authored SVG or CSS. If a future asset genuinely needs
generative imagery, document it here with this template:

```markdown
### `path/to/file.webp`
- **Purpose:** …
- **Dimensions:** …×…
- **Placement:** …
- **Style:** …
- **Prompt:** (exact prompt text)
- **Format / size:** WebP, ~… KB
- **License / source notes:** …
```

## Asset inventory

### Branding (`public/images/branding/`, SVG masters)

| File | Purpose | Notes |
|---|---|---|
| `beatmy11-logo.svg` | Primary logo (dark bg) | Gold-outlined shield, red seamed ball, white "11", BEATMY11 wordmark + "ALL-TIME TEST XI" tagline |
| `beatmy11-mark.svg` | Compact icon-only mark | Same shield/ball/11, no wordmark |
| `beatmy11-logo-mono.svg` | Monochrome logo | Single-color `#F1F5F9`, inherits `currentColor` in `Logo.astro` |
| `beatmy11-icon-1024.svg` | App-icon master | Render source for all PNG icons |
| `og-image.svg` | Social-card master | Dark navy stadium scene, 1200×630 |

Rendered in `src/components/Logo.astro` (`variant`: `full` \| `mark` \| `mono`).

### Favicons & app icons (`public/`)

| File | Format | Dimensions | ~Size |
|---|---|---|---|
| `favicon.svg` | SVG | 64×64 viewBox | 0.6 KB |
| `apple-touch-icon.png` | PNG | 180×180 | 8 KB |
| `icon-192.png` | PNG | 192×192 | 9 KB |
| `icon-512.png` | PNG | 512×512 | 23 KB |

Wired in `src/layouts/BaseLayout.astro` + `public/site.webmanifest`.

### Social (`public/`)

| File | Format | Dimensions | ~Size |
|---|---|---|---|
| `og-image.png` | PNG | 1200×630 | 70 KB |

Default `og:image` / `twitter:image` in `BaseLayout.astro`. Share-card
*templates* (player / team / era) are pure HTML/CSS in
`src/components/ShareCard.astro` — no raster needed.

### Decorative / UI icons

`src/components/icons/CricketIcons.astro` — 9 original stroke-based icons
(`ball`, `bat`, `stumps`, `trophy`, `helmet`, `pitch`, `captain`, `star`,
`wicket`), 24×24 `currentColor`. Era badges: `src/components/EraBadge.astro`
(SVG per era, accent-colored).

## Performance strategy

- SVG for all logos/icons/motifs (sub-KB to a few KB each).
- Only 4 PNGs total (~110 KB combined), each at exactly its display size —
  no oversized sources, no duplicates.
- Player imagery: zero network requests (inline SVG `data:` URI medallions,
  `loading="lazy"`).
- No autoplay video, no animated raster backgrounds; motion is CSS-only and
  disabled under `prefers-reduced-motion`.
