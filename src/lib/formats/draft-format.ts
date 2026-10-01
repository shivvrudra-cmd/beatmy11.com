/**
 * draft-format.ts — what differs between game formats on the draft screen
 * (src/components/DraftGame.astro). Browser-safe: constants only, no data imports.
 *
 * The draft rules themselves (slots, shapes, spins, respins) are shared and live in
 * ../player-logic. A format only changes labels, the reels' vocabulary, which stats a card
 * shows, whether round 1 is a fixed era, and where the result page is.
 */
import { IPL_BLOCKS, IPL_BLOCK_NAMES, IPL_TEAM_CODES, IPL_TEAMS } from './ipl-config';
import { INTL_ERAS, INTL_ERA_NAMES } from './white-ball-config';

/** One stat on a player card. `keys`: the first present stat is shown (pairs use two keys). */
export interface StatCell {
  label: string;
  kind: 'int' | 'avg' | 'pair';
  keys: string[];
}

export interface DraftFormat {
  id: 'test' | 'ipl' | 'odi' | 't20i';
  /** Which saved-draft slot this format uses (see ../draft-slots). 'normal' = the Test game, which
   *  also has the daily and friend-challenge modes chosen by the link. */
  slotMode: 'normal' | 'ipl' | 'odi' | 't20i';
  teamLabel: string;
  eraLabel: string;
  respinTeam: string;
  respinEra: string;
  eraNames: Record<string, string>;
  /** Era values the reel flickers through while spinning. */
  eraList: string[];
  teams: string[];
  teamCodes: Record<string, string>;
  /** Short team text for the reel (long franchise names don't fit); defaults to the team name. */
  teamReel?: Record<string, string>;
  /** Round 1 always draws this era (Test: 'legends'); null = any draw. */
  round1FixedEra: string | null;
  /** How the pool of a draw is shown. 'cards' (default): swipeable cards. 'tabs': one role at a
   *  time behind role tabs, as compact rows (owner, 2026-10-01, for the 25-player white-ball squads). */
  poolLayout?: 'cards' | 'tabs';
  matchupHref: string;
  homeHref: string;
  copy: {
    startTitle: string;
    startSub: string;
    round1Pick: string;
    readySub: string;
    empty: string;
    spinAriaFirst: string;
    spinAria: string;
  };
  stats: { batter: StatCell[]; keeper: StatCell[]; allRounder: StatCell[]; bowler: StatCell[] };
}

export const TEST_FORMAT: DraftFormat = {
  id: 'test',
  slotMode: 'normal',
  teamLabel: 'Nation',
  eraLabel: 'Era',
  respinTeam: 'New nation',
  respinEra: 'New era',
  eraNames: {
    legends: 'Legends', '1970s': '1970s', '1980s': '1980s', '1990s': '1990s',
    '2000s': '2000s', '2010s': '2010s', '2020s': '2020s',
  },
  eraList: ['1970s', '1980s', '1990s', '2000s', '2010s', '2020s'],
  teams: ['Australia', 'Bangladesh', 'England', 'India', 'New Zealand', 'Pakistan', 'South Africa', 'Sri Lanka', 'West Indies', 'Zimbabwe'],
  teamCodes: {
    Australia: 'AUS', England: 'ENG', India: 'IND', Pakistan: 'PAK', 'West Indies': 'WI',
    'New Zealand': 'NZ', 'South Africa': 'SA', 'Sri Lanka': 'SL', Bangladesh: 'BAN', Zimbabwe: 'ZIM',
  },
  round1FixedEra: 'legends',
  matchupHref: '/matchup',
  homeHref: '/',
  copy: {
    startTitle: 'Spin for your Legend',
    startSub: 'Round 1 always draws the Legends era. You pick one.',
    round1Pick: 'Pick your Legend — 1 player.',
    readySub: 'Eleven picked. Time to face the World XI over five Tests.',
    empty: 'Under the lights, fate picks the era and the nation. You pick the XI.',
    spinAriaFirst: 'Spin to draw your Legend — a random nation from the Legends era',
    spinAria: 'Spin to draw a random era and nation',
  },
  stats: {
    batter: [
      { label: 'Tests', kind: 'int', keys: ['testMatches'] },
      { label: 'Runs', kind: 'int', keys: ['testRuns'] },
      { label: 'Avg', kind: 'avg', keys: ['testAverage'] },
      { label: '50s/100s', kind: 'pair', keys: ['testFifties', 'testCenturies'] },
    ],
    keeper: [
      { label: 'Tests', kind: 'int', keys: ['testMatches'] },
      { label: 'Runs', kind: 'int', keys: ['testRuns'] },
      { label: 'Avg', kind: 'avg', keys: ['testAverage'] },
      { label: 'Dismissals', kind: 'int', keys: ['dismissals'] },
    ],
    allRounder: [
      { label: 'Tests', kind: 'int', keys: ['testMatches'] },
      { label: 'Bat avg', kind: 'avg', keys: ['testAverage'] },
      { label: 'Wkts', kind: 'int', keys: ['testWickets'] },
      { label: 'Bowl avg', kind: 'avg', keys: ['testBowlingAverage', 'bowlingAverage'] },
    ],
    bowler: [
      { label: 'Tests', kind: 'int', keys: ['testMatches'] },
      { label: 'Wkts', kind: 'int', keys: ['testWickets'] },
      { label: 'Bowl avg', kind: 'avg', keys: ['testBowlingAverage', 'bowlingAverage'] },
      { label: '5W/10W', kind: 'pair', keys: ['fiveWs', 'tenWs'] },
    ],
  },
};

export const IPL_FORMAT: DraftFormat = {
  id: 'ipl',
  slotMode: 'ipl',
  teamLabel: 'Team',
  eraLabel: 'Seasons',
  respinTeam: 'New team',
  respinEra: 'New seasons',
  eraNames: IPL_BLOCK_NAMES,
  eraList: [...IPL_BLOCKS].map((b) => IPL_BLOCK_NAMES[b]),
  teams: IPL_TEAMS,
  teamCodes: IPL_TEAM_CODES,
  teamReel: IPL_TEAM_CODES,
  round1FixedEra: null,
  poolLayout: 'tabs',
  matchupHref: '/ipl/matchup',
  homeHref: '/',
  copy: {
    startTitle: 'Spin for your first pick',
    startSub: 'Each spin draws an IPL team and a block of seasons.',
    round1Pick: 'Pick 1 player.',
    readySub: 'Eleven picked. Time to face the All-Star XI over five matches.',
    empty: 'Under the lights, fate picks the team and the seasons. You pick the XI.',
    spinAriaFirst: 'Spin to draw a random IPL team and block of seasons',
    spinAria: 'Spin to draw a random IPL team and block of seasons',
  },
  stats: {
    batter: [
      { label: 'Mat', kind: 'int', keys: ['matches'] },
      { label: 'Runs', kind: 'int', keys: ['runs'] },
      { label: 'Avg', kind: 'avg', keys: ['battingAverage'] },
      { label: 'SR', kind: 'avg', keys: ['strikeRate'] },
    ],
    keeper: [
      { label: 'Mat', kind: 'int', keys: ['matches'] },
      { label: 'Runs', kind: 'int', keys: ['runs'] },
      { label: 'Avg', kind: 'avg', keys: ['battingAverage'] },
      { label: 'SR', kind: 'avg', keys: ['strikeRate'] },
    ],
    allRounder: [
      { label: 'Bat avg', kind: 'avg', keys: ['battingAverage'] },
      { label: 'SR', kind: 'avg', keys: ['strikeRate'] },
      { label: 'Wkts', kind: 'int', keys: ['wickets'] },
      { label: 'Econ', kind: 'avg', keys: ['economy'] },
    ],
    bowler: [
      { label: 'Mat', kind: 'int', keys: ['matches'] },
      { label: 'Wkts', kind: 'int', keys: ['wickets'] },
      { label: 'Econ', kind: 'avg', keys: ['economy'] },
      { label: 'Bowl avg', kind: 'avg', keys: ['bowlingAverage'] },
    ],
  },
};

/** ODI and T20I: nations and decades like the Test game, white-ball stats on the cards, no fixed
 *  first round (there is no Legends era in this data). */
function intlFormat(id: 'odi' | 't20i', label: string, matchWord: string): DraftFormat {
  return {
    id,
    slotMode: id,
    teamLabel: 'Nation',
    eraLabel: 'Era',
    respinTeam: 'New nation',
    respinEra: 'New era',
    eraNames: INTL_ERA_NAMES,
    eraList: [...INTL_ERAS[id]],
    teams: TEST_FORMAT.teams,
    teamCodes: TEST_FORMAT.teamCodes,
    round1FixedEra: null,
    poolLayout: 'tabs',
    matchupHref: `/${id}/matchup`,
    homeHref: '/',
    copy: {
      startTitle: 'Spin for your first pick',
      startSub: `Each spin draws a nation and a decade of ${label} cricket.`,
      round1Pick: 'Pick 1 player.',
      readySub: `Eleven picked. Time to face the World XI over five ${matchWord}.`,
      empty: 'Under the lights, fate picks the era and the nation. You pick the XI.',
      spinAriaFirst: 'Spin to draw a random era and nation',
      spinAria: 'Spin to draw a random era and nation',
    },
    stats: IPL_FORMAT.stats,
  };
}
export const ODI_FORMAT: DraftFormat = intlFormat('odi', 'ODI', 'ODIs');
export const T20I_FORMAT: DraftFormat = intlFormat('t20i', 'T20I', 'T20Is');
