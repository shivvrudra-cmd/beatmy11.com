/**
 * result-insights.ts — the words on the result page's strength screen: the grade, the two titles
 * and the tip (owner, 2026-10-02). Pure and browser-safe.
 *
 * Grade: where the XI ranks among drafted XIs (the calibration sample), so it stays fair when
 * the scoring is retuned: A+ = top 5%, A = top 20%, B = top 50%, C = the rest. C is the lowest.
 * Titles: one from the grade ("Unbeatable" for a 5-0 series), one from the XI's shape.
 * Tips: true statements about how the engine scores, picked at random, leaning toward the part
 * of the game where the XI is furthest behind the opponent. They never name a player.
 */

export type Grade = 'A+' | 'A' | 'B' | 'C';
export type FormatId = 'test' | 'odi' | 't20i' | 'ipl';
export type Aspect = 'batting' | 'bowling' | 'fielding';

/** `percentile`: share of drafts this XI out-scores, 0–1 (SeriesResult.percentile). */
export function gradeFor(percentile: number): Grade {
  if (percentile >= 0.95) return 'A+';
  if (percentile >= 0.8) return 'A';
  if (percentile >= 0.5) return 'B';
  return 'C';
}

const GRADE_TITLES: Record<Grade, string> = {
  'A+': 'Dynasty',
  A: 'All-time contender',
  B: 'Solid XI',
  C: 'Work in progress',
};

export function gradeTitle(grade: Grade, seriesUser: number): string {
  return seriesUser === 5 ? 'Unbeatable' : GRADE_TITLES[grade];
}

/** Batting or bowling at least this far ahead of the other makes the XI "heavy" on that side. */
export const SHAPE_GAP = 10;

export function shapeTitle(batting: number, bowling: number): string {
  if (batting - bowling >= SHAPE_GAP) return 'Batting heavy';
  if (bowling - batting >= SHAPE_GAP) return 'Bowling attack';
  return 'Well balanced';
}

interface Tip {
  text: string;
  /** Shown more often when this is the XI's weakest part; absent = general. */
  aspect?: Aspect;
  /** Formats the tip is true for; absent = all. */
  formats?: FormatId[];
}

const T20: FormatId[] = ['t20i', 'ipl'];
const LONG_CAREER: Record<FormatId, string> = {
  test: 'about 50 Tests', odi: 'about 100 ODIs', t20i: 'about 50 T20Is', ipl: 'about 60 IPL matches',
};

const TIPS: Tip[] = [
  // fielding
  { aspect: 'fielding', text: 'Fielding counts catches and stumpings per match for all eleven players. A busy wicketkeeper lifts it the most.' },
  { aspect: 'fielding', text: 'Batters who took a lot of catches add to your fielding. A bowler who rarely caught anything adds little.' },
  { aspect: 'fielding', text: 'Fielding is 10% of your overall score. In a close series that is enough to decide it.' },
  // bowling
  { aspect: 'bowling', text: 'Bowling is half of your overall score, more than batting. Build the attack first.' },
  { aspect: 'bowling', text: 'Bowlers are judged on their average and their wickets per match. Look for bowlers who took wickets every game.' },
  { aspect: 'bowling', formats: ['test'], text: 'Five-wicket hauls count. Bowlers who ran through sides score higher than steady ones.' },
  { aspect: 'bowling', formats: ['odi'], text: 'In ODIs a bowler’s economy rate counts as much as wickets and average.' },
  { aspect: 'bowling', formats: T20, text: 'In T20 the economy rate matters most for a bowler, more than wickets or average.' },
  { aspect: 'bowling', text: 'An all-rounder counts in your bowling as well as your batting, so one who bowled little can pull your attack down.' },
  // batting
  { aspect: 'batting', formats: ['test', 'odi'], text: 'Batters are judged on their average, runs per match and how often they made a hundred.' },
  { aspect: 'batting', formats: ['odi'], text: 'In ODIs the strike rate counts as much as the batting average.' },
  { aspect: 'batting', formats: T20, text: 'In T20 the strike rate matters most for a batter, more than the average.' },
  { aspect: 'batting', text: 'Your wicketkeeper is scored as a batter. A keeper who made runs lifts your batting.' },
  { aspect: 'batting', text: 'Batting is 40% of your overall score, shared by your openers, middle order, keeper and all-rounders.' },
  // general
  { text: 'A brilliant short career is pulled back toward the average. Players who did it for years score higher.' },
  { text: 'Big names are not always the best pick. Read the numbers on the card.' },
  { text: 'Slots 7 and 8 are flexible: two spinners, two all-rounders, or one of each.' },
  { text: 'Specialist bowlers are scored on bowling only. A bowler who could not bat costs you nothing.' },
  { text: 'There is only one wicketkeeper slot, so take a good keeper when you see one.' },
  { text: 'The same XI always gets the same series, but a near-level XI can fall either side of the line.' },
];

/** All tips that are true for a format (the long-career tip is worded per format). */
export function tipsFor(format: FormatId): Tip[] {
  return [
    ...TIPS.filter((t) => !t.formats || t.formats.includes(format)),
    { text: `Long careers score higher: a player needs ${LONG_CAREER[format]} for full credit.` },
  ];
}

/**
 * One tip. Half the time it is about the part of the game where the XI is furthest behind the
 * opponent (`deficits`: opponent minus user, per aspect); otherwise any tip.
 */
export function pickTip(format: FormatId, deficits: Record<Aspect, number>, rng: () => number = Math.random): string {
  const all = tipsFor(format);
  const weakest = (Object.keys(deficits) as Aspect[]).sort((a, b) => deficits[b] - deficits[a])[0];
  const focused = all.filter((t) => t.aspect === weakest);
  const pool = focused.length && rng() < 0.5 ? focused : all;
  return pool[Math.floor(rng() * pool.length) % pool.length].text;
}
