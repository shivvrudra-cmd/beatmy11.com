// BeatMy11 design tokens — single source of truth for eras, nations and roles.
//
// Color values here mirror:
//   - the CSS custom properties in src/styles/globals.css (:root --bm11-*, --era-*)
//   - the Tailwind theme extensions in tailwind.config.mjs (brand, gold, era)
// Keep the three in sync when adding or changing a token.

export interface EraToken {
  /** Stable id used in player data (e.g. player.era) and CSS var suffixes. */
  id: string;
  /** Display name. */
  name: string;
  /** Human-readable span, e.g. '1980–1989'. */
  range: string;
  /** Hex accent color for dots, chips and highlights. */
  accent: string;
  tagline: string;
}

export const ERAS: EraToken[] = [
  {
    id: 'legends',
    name: 'Legends',
    range: '1877–1970s',
    accent: '#C9A227',
    tagline: 'The immortals who transcend eras.',
  },
  {
    id: '1970s',
    name: '1970s',
    range: '1970–1979',
    accent: '#C26936',
    tagline: 'Where Test cricket met its fiercest pace.',
  },
  {
    id: '1980s',
    name: '1980s',
    range: '1980–1989',
    accent: '#D64045',
    tagline: 'The decade of the great all-rounders.',
  },
  {
    id: '1990s',
    name: '1990s',
    range: '1990–1999',
    accent: '#2AA198',
    tagline: 'Icons under lights, rivalries reborn.',
  },
  {
    id: '2000s',
    name: '2000s',
    range: '2000–2009',
    accent: '#3B82F6',
    tagline: 'The broadcast era at full throttle.',
  },
  {
    id: '2010s',
    name: '2010s',
    range: '2010–2019',
    accent: '#8B5CF6',
    tagline: 'The analytics age of the modern great.',
  },
  {
    id: '2020s',
    name: '2020s',
    range: '2020–today',
    accent: '#2DD4BF',
    tagline: 'Data-driven cricket, new frontiers.',
  },
];

/** The ten Test-playing nations in the spin pool. */
export const NATIONS: string[] = [
  'Australia',
  'England',
  'India',
  'Pakistan',
  'West Indies',
  'New Zealand',
  'South Africa',
  'Sri Lanka',
  'Bangladesh',
  'Zimbabwe',
];

/** Canonical player role keys, matching `primaryRole` in src/data/*.json. */
export type PlayerRole =
  | 'opener'
  | 'middle-order'
  | 'wicketkeeper'
  | 'all-rounder'
  | 'fast-bowler'
  | 'spinner';

/** Display labels for the canonical role keys. */
export const ROLE_LABELS: Record<PlayerRole, string> = {
  opener: 'Opener',
  'middle-order': 'Middle Order',
  wicketkeeper: 'Wicketkeeper',
  'all-rounder': 'All-Rounder',
  'fast-bowler': 'Fast Bowler',
  spinner: 'Spinner',
};
