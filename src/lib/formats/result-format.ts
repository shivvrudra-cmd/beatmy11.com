/**
 * result-format.ts — what differs between formats on the series result screen
 * (src/components/SeriesResult.astro). Browser-safe constants only.
 */
import { TEST_FLAVOUR, type SeriesFlavour } from '../series';
import { TEST_FORMAT } from './draft-format';
import { IPL_BLOCK_NAMES, IPL_TEAM_CODES, IPL_VENUES } from './ipl-config';
import { INTL_ERA_NAMES, ODI_VENUES, T20I_VENUES } from './white-ball-config';

export interface ResultFormat {
  id: 'test' | 'ipl' | 'odi' | 't20i';
  /** Saved-draft slot this result reads (see ../draft-slots). */
  slotMode: 'normal' | 'ipl' | 'odi' | 't20i';
  opponent: string;
  /** "Test" / "match", used as "1st Test · Lord's". */
  matchNoun: string;
  matchPlural: string;
  eyebrow: string;
  startTitle: string;
  /** "all-time Test XI" / "IPL XI", for share text. */
  xiNoun: string;
  playHref: string;
  homeHref: string;
  flavour: SeriesFlavour;
  teamCodes: Record<string, string>;
  eraNames: Record<string, string>;
  /** Share pages (/r/<scoreline>, or /<format>/r/<scoreline>) and challenge links. All formats
   *  since 2026-10-02. */
  shareLinks: boolean;
  /** Shown before "Daily Challenge" outside the Test game: "ODI", "T20I", "IPL". */
  dailyLabel?: string;
  /** Test only for now: anonymous score and event counters (keeps the Test calibration clean). */
  telemetry: boolean;
  /** Data credit (required by the data licence). Shown on /privacy, not on the result page. */
  credit?: string;
  /** Difficulty for this format (see PAR_GAP in ../series); the Test game uses the default. */
  parGap?: number;
}

export const TEST_RESULT: ResultFormat = {
  id: 'test',
  slotMode: 'normal',
  opponent: 'World XI',
  matchNoun: 'Test',
  matchPlural: 'Tests',
  eyebrow: 'The five-Test series',
  startTitle: 'Five Tests. One series.',
  xiNoun: 'all-time Test XI',
  playHref: '/play',
  homeHref: '/',
  flavour: TEST_FLAVOUR,
  teamCodes: TEST_FORMAT.teamCodes,
  eraNames: TEST_FORMAT.eraNames,
  shareLinks: true,
  telemetry: true,
};

export const IPL_RESULT: ResultFormat = {
  id: 'ipl',
  slotMode: 'ipl',
  opponent: 'All-Star XI',
  matchNoun: 'match',
  matchPlural: 'matches',
  eyebrow: 'The five-match series',
  startTitle: 'Five matches. One series.',
  xiNoun: 'IPL XI',
  playHref: '/ipl/play',
  homeHref: '/',
  flavour: { venues: IPL_VENUES, opponent: 'All-Star XI', kind: 't20' },
  teamCodes: IPL_TEAM_CODES,
  eraNames: IPL_BLOCK_NAMES,
  shareLinks: true,
  dailyLabel: 'IPL',
  telemetry: false,
  credit: 'Match data: Cricsheet (cricsheet.org), Open Data Commons Attribution licence. Totals leave out matches Cricsheet withholds.',
};

export const ODI_RESULT: ResultFormat = {
  id: 'odi',
  slotMode: 'odi',
  opponent: 'World XI',
  matchNoun: 'ODI',
  matchPlural: 'ODIs',
  eyebrow: 'The five-ODI series',
  startTitle: 'Five ODIs. One series.',
  xiNoun: 'ODI XI',
  playHref: '/odi/play',
  homeHref: '/',
  flavour: { venues: ODI_VENUES, opponent: 'World XI', kind: 'odi' },
  teamCodes: TEST_FORMAT.teamCodes,
  eraNames: INTL_ERA_NAMES,
  shareLinks: true,
  dailyLabel: 'ODI',
  telemetry: false,
  credit: 'Match data: Cricsheet (cricsheet.org), Open Data Commons Attribution licence. Totals leave out matches Cricsheet withholds.',
};

export const T20I_RESULT: ResultFormat = {
  id: 't20i',
  slotMode: 't20i',
  opponent: 'World XI',
  matchNoun: 'T20I',
  matchPlural: 'T20Is',
  eyebrow: 'The five-T20I series',
  startTitle: 'Five T20Is. One series.',
  xiNoun: 'T20I XI',
  playHref: '/t20i/play',
  homeHref: '/',
  flavour: { venues: T20I_VENUES, opponent: 'World XI', kind: 't20' },
  // Afghanistan is not draftable, but the World XI has an opponent-only Afghan player (Rashid Khan).
  teamCodes: { ...TEST_FORMAT.teamCodes, Afghanistan: 'AFG' },
  eraNames: INTL_ERA_NAMES,
  shareLinks: true,
  dailyLabel: 'T20I',
  telemetry: false,
  credit: 'Match data: Cricsheet (cricsheet.org), Open Data Commons Attribution licence. Totals leave out matches Cricsheet withholds.',
};
