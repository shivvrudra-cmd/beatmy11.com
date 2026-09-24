// Rating System for BeatMy11
// Era-normalized indices with diminishing returns

export interface Player {
  id: string;
  name: string;
  nation: string;
  era: string;
  primaryRole: string;
  secondaryRoles: string[];
  stats: {
    testAverage: number;
    testRuns: number;
    testWickets: number;
    testMatches: number;
    testCenturies: number;
    testFifties: number;
    // Bowling stats
    bowlingAverage?: number;
    bowlingStrikeRate?: number;
    // Derived stats
    battingIndex?: number;
    bowlingIndex?: number;
    volumeMultiplier?: number;
    finalRating?: number;
  };
}

// Era batting averages (mean of top-6 batsmen)
const ERA_BATTING_AVERAGES: Record<string, number> = {
  legends: 45.0, // Approximate for legends era
  '1970s': 32.5,
  '1980s': 38.2,
  '1990s': 35.8,
  '2000s': 34.1,
  '2010s': 33.7,
  '2020s': 32.9,
};

// Era bowling averages (mean of all bowlers)
const ERA_BOWLING_AVERAGES: Record<string, number> = {
  legends: 28.5,
  '1970s': 34.2,
  '1980s': 31.8,
  '1990s': 29.4,
  '2000s': 30.2,
  '2010s': 29.8,
  '2020s': 28.9,
};

// Era bowling strike rates (mean of all bowlers)
const ERA_BOWLING_SR: Record<string, number> = {
  legends: 68.0,
  '1970s': 72.5,
  '1980s': 65.2,
  '1990s': 58.8,
  '2000s': 55.1,
  '2010s': 53.7,
  '2020s': 52.3,
};

/**
 * Calculate batting index normalized against era contemporaries
 */
export function calculateBattingIndex(player: Player): number {
  const eraAvg = ERA_BATTING_AVERAGES[player.era] || 35.0;
  return (player.stats.testAverage / eraAvg) * 100;
}

/**
 * Calculate bowling index normalized against era contemporaries
 * Combines bowling average (60%) and strike rate (40%)
 */
export function calculateBowlingIndex(player: Player): number {
  if (!player.stats.bowlingAverage || !player.stats.bowlingStrikeRate) {
    // Estimate bowling stats if not available
    const eraAvg = ERA_BOWLING_AVERAGES[player.era] || 30.0;
    const eraSr = ERA_BOWLING_SR[player.era] || 60.0;

    // For all-rounders and batters who bowl occasionally
    const bowlingAverage = player.stats.testWickets > 0
      ? (player.stats.testRuns / player.stats.testWickets)
      : eraAvg * 1.5; // Poor bowler penalty

    const bowlingSR = player.stats.testWickets > 0
      ? (player.stats.testMatches * 450 / player.stats.testWickets) // Approx balls bowled
      : eraSr * 1.5;

    player.stats.bowlingAverage = bowlingAverage;
    player.stats.bowlingStrikeRate = bowlingSR;
  }

  const eraAvg = ERA_BOWLING_AVERAGES[player.era] || 30.0;
  const eraSr = ERA_BOWLING_SR[player.era] || 60.0;

  // Lower bowling average is better (invert for index)
  const avgIndex = (eraAvg / player.stats.bowlingAverage) * 100;

  // Lower strike rate is better (invert for index)
  const srIndex = (eraSr / player.stats.bowlingStrikeRate) * 100;

  // Weighted average: 60% average, 40% strike rate
  return (avgIndex * 0.6) + (srIndex * 0.4);
}

/**
 * Calculate volume multiplier based on Test matches played
 * Minimum 20 Tests to qualify, diminishing returns after 40 Tests
 */
export function calculateVolumeMultiplier(player: Player): number {
  const matches = player.stats.testMatches;
  if (matches < 20) return 0; // Not qualified

  // Volume multiplier = min(1, √(matches ÷ 40))
  return Math.min(1, Math.sqrt(matches / 40));
}

/**
 * Calculate final player rating
 */
export function calculatePlayerRating(player: Player): number {
  // Initialize derived stats if not present
  if (player.stats.battingIndex === undefined) {
    player.stats.battingIndex = calculateBattingIndex(player);
  }

  if (player.stats.bowlingIndex === undefined) {
    player.stats.bowlingIndex = calculateBowlingIndex(player);
  }

  if (player.stats.volumeMultiplier === undefined) {
    player.stats.volumeMultiplier = calculateVolumeMultiplier(player);
  }

  // Determine primary rating based on role
  let baseRating = 0;

  const isBatter =
    player.primaryRole === 'opener' ||
    player.primaryRole === 'middle-order' ||
    player.secondaryRoles.includes('opener') ||
    player.secondaryRoles.includes('middle-order');

  const isBowler =
    player.primaryRole === 'fast-bowler' ||
    player.primaryRole === 'spinner' ||
    player.secondaryRoles.includes('fast-bowler') ||
    player.secondaryRoles.includes('spinner');

  const isAllRounder =
    player.primaryRole === 'all-rounder' ||
    player.secondaryRoles.includes('all-rounder');

  const isWicketKeeper =
    player.primaryRole === 'wicketkeeper';

  if (isBatter && !isBowler) {
    // Specialist batter
    baseRating = player.stats.battingIndex;
  } else if (isBowler && !isBatter) {
    // Specialist bowler
    baseRating = player.stats.bowlingIndex;
  } else if (isAllRounder) {
    // All-rounder: average of both, but must contribute to both
    const battingContribution = player.stats.battingIndex > 50 ? player.stats.battingIndex : 0;
    const bowlingContribution = player.stats.bowlingIndex > 50 ? player.stats.bowlingIndex : 0;
    baseRating = (battingContribution + bowlingContribution) / 2;

    // Penalty for fake all-rounders
    if (battingContribution === 0 || bowlingContribution === 0) {
      baseRating *= 0.5; // 50% penalty
    }
  } else if (isWicketKeeper) {
    // Wicketkeeper: batting contribution only (keeping is assumed)
    baseRating = player.stats.battingIndex;
  } else {
    // Fallback
    baseRating = Math.max(player.stats.battingIndex, player.stats.bowlingIndex);
  }

  // Apply volume multiplier
  const ratedValue = baseRating * player.stats.volumeMultiplier;

  // Store for debugging
  player.stats.finalRating = ratedValue;

  return ratedValue;
}

/**
 * Apply Bradman curve (diminishing returns) to team total
 * Prevents single superstar from dominating
 */
export function applyBradmanCurve(teamTotal: number): number {
  // Concave curve: y = √x * 10 (calibrated so Bradman ~280 becomes reasonable)
  // This makes the 4th best player contribute more relatively than the best
  return Math.sqrt(teamTotal) * 10;
}

/**
 * Calculate team balance modifiers
 */
export function calculateTeamModifiers(team: Player[]): number {
  let modifier = 1.0; // Start with no modification

  // Count players by role
  const openers = team.filter(p =>
    p.primaryRole === 'opener' || p.secondaryRoles.includes('opener')
  ).length;

  const keepers = team.filter(p =>
    p.primaryRole === 'wicketkeeper' || p.secondaryRoles.includes('wicketkeeper')
  ).length;

  const allRounders = team.filter(p =>
    p.primaryRole === 'all-rounder' || p.secondaryRoles.includes('all-rounder')
  ).length;

  const fastBowlers = team.filter(p =>
    p.primaryRole === 'fast-bowler' || p.secondaryRoles.includes('fast-bowler')
  ).length;

  const spinners = team.filter(p =>
    p.primaryRole === 'spinner' || p.secondaryRoles.includes('spinner')
  ).length;

  // Apply penalties/bonuses

  // No frontline spinner penalty
  if (spinners === 0) {
    modifier *= 0.85; // -15%
  }

  // All bowlers same type penalty (all pace or all spin)
  if (fastBowlers > 0 && spinners === 0) {
    modifier *= 0.90; // -10%
  } else if (fastBowlers === 0 && spinners > 0) {
    modifier *= 0.90; // -10%
  }

  // Variety bonus (left-arm or wrist spinner) - simplified
  // In reality, we'd check specific bowler types

  // Keeper who averages under ~25 penalty
  const keeper = team.find(p =>
    p.primaryRole === 'wicketkeeper' || p.secondaryRoles.includes('wicketkeeper')
  );
  if (keeper && keeper.stats.testAverage < 25) {
    modifier *= 0.90; // -10% batting depth
  }

  // Top-heavy XI penalty (if top 3 players contribute >50% of total)
  const sortedByRating = [...team].sort((a, b) =>
    (b.stats.finalRating || 0) - (a.stats.finalRating || 0)
  );

  const topThreeContribution = sortedByRating.slice(0, 3)
    .reduce((sum, p) => sum + (p.stats.finalRating || 0), 0);

  const teamTotal = team.reduce((sum, p) => sum + (p.stats.finalRating || 0), 0);

  if (teamTotal > 0 && (topThreeContribution / teamTotal) > 0.5) {
    modifier *= 0.95; // -5%
  }

  return modifier;
}

/**
 * Calculate team score for match simulation
 */
export function calculateTeamScore(team: Player[]): number {
  // Sum of all player ratings
  const rawTotal = team.reduce((sum, player) => {
    return sum + (player.stats.finalRating || calculatePlayerRating(player));
  }, 0);

  // Apply Bradman curve (diminishing returns)
  const curvedTotal = applyBradmanCurve(rawTotal);

  // Apply team balance modifiers
  const modifier = calculateTeamModifiers(team);

  return curvedTotal * modifier;
}

/**
 * Simulate match outcome based on team strengths
 * Returns probability of team A winning (0-1)
 */
export function calculateWinProbability(teamA: Player[], teamB: Player[]): number {
  const scoreA = calculateTeamScore(teamA);
  const scoreB = calculateTeamScore(teamB);

  // Use logistic function to convert gap to probability
  // P(A wins) = 1 / (1 + e^(-k*(scoreA - scoreB)))
  // k controls steepness - using 0.1 for reasonable sensitivity
  const k = 0.1;
  const diff = scoreA - scoreB;
  const probability = 1 / (1 + Math.exp(-k * diff));

  return probability;
}

/**
 * Simulate 5-match series
 * Returns [teamAWins, teamBWins, draws]
 */
export function simulateSeries(teamA: Player[], teamB: Player[]): [number, number, number] {
  const winProbA = calculateWinProbability(teamA, teamB);
  const winProbB = calculateWinProbability(teamB, teamA);
  const drawProb = Math.max(0, 1 - (winProbA + winProbB)); // Simplified

  // For simplicity in cricket, we'll assume no draws in this simulation
  // and adjust probabilities accordingly
  const total = winProbA + winProbB;
  const adjWinProbA = winProbA / total;
  const adjWinProbB = winProbB / total;

  // Simulate 5 matches
  let teamAWins = 0;
  let teamBWins = 0;

  for (let i = 0; i < 5; i++) {
    if (Math.random() < adjWinProbA) {
      teamAWins++;
    } else {
      teamBWins++;
    }
  }

  return [teamAWins, teamBWins, 0];
}