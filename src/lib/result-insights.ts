/**
 * result-insights.ts — the words on the result page's strength screen: the grade, the two titles
 * and the tip (owner, 2026-10-02). Pure and browser-safe.
 *
 * Grade: where the XI ranks among drafted XIs (the calibration sample), so it stays fair when
 * the scoring is retuned: A+ = top 5%, A = top 20%, B = top 50%, C = the rest. C is the lowest.
 * Titles: one from the grade ("Unbeatable" for a 5-0 series), one from the XI's shape.
 * Tips: about THIS XI (owner, 2026-10-02: the general tips read as irrelevant). `xiTips` builds
 * them from the three unit scores already on the screen and a few facts about the eleven; the
 * general statements below remain as the fallback. Tips never name a player and never show an
 * individual rating.
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
  test: 'about 50 Tests', odi: 'about 100 ODIs', t20i: 'about 50 T20Is', ipl: 'about 40 matches in one IPL stint',
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

// ---------------------------------------------------------------- tips about this XI

/** Matches for full long-career credit, per format (the engines' longevityFullMatches). */
export const FULL_CREDIT_MATCHES: Record<FormatId, number> = { test: 50, odi: 100, t20i: 50, ipl: 40 };
const FULL_CREDIT_WORDS: Record<FormatId, string> = {
  test: '50 Tests', odi: '100 ODIs', t20i: '50 T20Is', ipl: '40 matches in that IPL stint',
};
/** Share of the overall score each unit carries (the engines' 40 / 50 / 10 team blend). */
const UNIT_SHARE: Record<Aspect, number> = { batting: 0.4, bowling: 0.5, fielding: 0.1 };
/** A short-career tip is offered from this many players below the full-credit mark. PROVISIONAL. */
export const SHORT_CAREER_MIN = 3;

/** What the tip may know about an XI: unit scores (never a single player's rating) and counts. */
export interface XiFacts {
  /** The user's unit scores, as on the three bars. */
  mine: Record<Aspect, number>;
  /** The fixed opponent's unit scores. */
  theirs: Record<Aspect, number>;
  /** "World XI" / "All-Star XI". */
  opponent: string;
  /** Players in the XI with fewer matches than FULL_CREDIT_MATCHES. */
  shortCareers: number;
  /** Players scored as all-rounders (0, 1 or 2). */
  allRounders: number;
  /** IPL only: overseas players in the XI (the rule allows four). */
  overseasUsed?: number;
  /** The keeper's career catches and stumpings per match, when known. */
  keeperPerMatch?: number | null;
}

/** The unit where the XI loses most overall points to the opponent, or null when it trails nowhere. */
export function costliestUnit(f: Pick<XiFacts, 'mine' | 'theirs'>): Aspect | null {
  const cost = (a: Aspect) => UNIT_SHARE[a] * (f.theirs[a] - f.mine[a]);
  const worst = (['bowling', 'batting', 'fielding'] as Aspect[]).sort((a, b) => cost(b) - cost(a))[0];
  return cost(worst) > 0 ? worst : null;
}

/**
 * Tips about this XI, most useful first: [0] is always the one thing that would help most (the
 * unit that costs most against the opponent, in the numbers on the bars); the rest are other
 * true facts about the eleven that apply. PROVISIONAL wording.
 */
export function xiTips(format: FormatId, f: XiFacts): string[] {
  const r = (v: number) => Math.round(v);
  const bat = r(f.mine.batting), bowl = r(f.mine.bowling), field = r(f.mine.fielding);
  const worst = costliestUnit(f);
  const tips: string[] = [];
  if (worst === 'bowling') {
    tips.push(bowl < bat
      ? `Your bowling scored ${bowl} and your batting ${bat}. Bowling is half the overall score, so a stronger attack is the quickest way up.`
      : `Your bowling scored ${bowl}. That is where you lose most ground to the ${f.opponent}, and bowling is half the overall score.`);
  } else if (worst === 'batting') {
    tips.push(bat < bowl
      ? `Your batting scored ${bat} and your bowling ${bowl}. Batting is 40% of the overall score, so stronger batters are the quickest way up.`
      : `Your batting scored ${bat}. That is where you lose most ground to the ${f.opponent}, and batting is 40% of the overall score.`);
  } else if (worst === 'fielding') {
    tips.push(`Your fielding scored ${field}. It is 10% of the overall score, but it is where you lose most ground to the ${f.opponent}.`);
  } else {
    tips.push(`Batting ${bat}, bowling ${bowl}, fielding ${field}: your XI is level with or ahead of the ${f.opponent} in every part of the game.`);
  }
  if (f.shortCareers >= SHORT_CAREER_MIN) {
    tips.push(`${f.shortCareers} of your eleven played fewer than ${FULL_CREDIT_WORDS[format]}. Longer careers get full credit and score higher for the same numbers.`);
  }
  if (f.allRounders >= 1 && worst === 'bowling') {
    tips.push(f.allRounders === 2
      ? `Both your all-rounders count in your bowling (${bowl}) as well as your batting. One who bowled little pulls the attack down.`
      : `Your all-rounder counts in your bowling (${bowl}) as well as your batting. One who bowled little pulls the attack down.`);
  }
  if (f.allRounders === 0) {
    tips.push('You picked no all-rounder, so slots 7 and 8 count only in your bowling. An all-rounder counts in your batting too.');
  }
  if (format === 'ipl' && typeof f.overseasUsed === 'number' && f.overseasUsed < 4) {
    tips.push(`You used ${f.overseasUsed} of your 4 overseas places. The rule only stops a fifth; an unused place is worth nothing.`);
  }
  if (typeof f.keeperPerMatch === 'number' && f.keeperPerMatch > 0 && f.theirs.fielding - f.mine.fielding > 10) {
    tips.push(`Your keeper took ${f.keeperPerMatch.toFixed(1)} catches and stumpings a match. Fielding (${field}) counts those for all eleven, and the keeper usually adds most.`);
  }
  return tips;
}

/** No tip is longer than this, so it fits screen 2 on the smallest phones (tested). */
export const TIP_MAX_CHARS = 170;

/** Chance that the tip shown is the main one (xiTips[0]) rather than another fact. PROVISIONAL. */
export const MAIN_TIP_SHARE = 0.6;

/** One tip about this XI. Seed `rng` from the XI so the same XI always reads the same tip. */
export function pickXiTip(format: FormatId, f: XiFacts, rng: () => number = Math.random): string {
  const tips = xiTips(format, f);
  if (tips.length === 1 || rng() < MAIN_TIP_SHARE) return tips[0];
  const rest = tips.slice(1);
  return rest[Math.floor(rng() * rest.length) % rest.length];
}
