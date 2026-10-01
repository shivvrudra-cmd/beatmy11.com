/**
 * ipl-config.ts — IPL constants that are safe to bundle for the browser (no data imports).
 * Franchises and season blocks follow the owner's decisions in docs/plans/white-ball-formats.md.
 */

/** Season blocks: the IPL's "eras". */
export const IPL_BLOCKS = ['2008-12', '2013-17', '2018-22', '2023+'] as const;
export const IPL_BLOCK_NAMES: Record<string, string> = {
  '2008-12': '2008–12', '2013-17': '2013–17', '2018-22': '2018–22', '2023+': '2023–now',
};

/** Franchise → short code. Renamed teams are already merged in the data (Delhi, Punjab, Bengaluru, Pune Supergiant). */
export const IPL_TEAM_CODES: Record<string, string> = {
  'Chennai Super Kings': 'CSK',
  'Mumbai Indians': 'MI',
  'Royal Challengers Bengaluru': 'RCB',
  'Kolkata Knight Riders': 'KKR',
  'Delhi Capitals': 'DC',
  'Punjab Kings': 'PBKS',
  'Rajasthan Royals': 'RR',
  'Sunrisers Hyderabad': 'SRH',
  'Gujarat Titans': 'GT',
  'Lucknow Super Giants': 'LSG',
  'Deccan Chargers': 'DEC',
  'Kochi Tuskers Kerala': 'KTK',
  'Pune Warriors': 'PWI',
  'Rising Pune Supergiant': 'RPS',
  'Gujarat Lions': 'GL',
};
export const IPL_TEAMS = Object.keys(IPL_TEAM_CODES);

/** PROVISIONAL (owner to confirm): only players with at least this many IPL matches are draftable. */
export const IPL_MIN_MATCHES = 10;

/** Venues for the five-match series (flavour only). */
export const IPL_VENUES = ['Wankhede', 'Chepauk', 'Eden Gardens', 'Chinnaswamy', 'Narendra Modi Stadium'] as const;
