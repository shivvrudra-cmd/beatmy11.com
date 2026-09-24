// Game Engine for BeatMy11
// Handles spins, team building, and game logic

import type { Player } from './ratings';

interface SpinResult {
  nation: string;
  era: string;
  availablePlayers: Player[];
}

interface GameState {
  spinsRemaining: number;
  team: Player[];
  usedPlayers: Set<string>;
  rerolls: {
    team: boolean;
    era: boolean;
  };
  spinHistory: SpinResult[];
  isComplete: boolean;
}

// 10 Test Nations
const TEST_NATIONS = [
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'ENG', name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { code: 'IND', name: 'India', flag: '🇮🇳' },
  { code: 'PAK', name: 'Pakistan', flag: '🇵🇰' },
  { code: 'WI', name: 'West Indies', flag: '🇯🇲' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'SA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'SL', name: 'Sri Lanka', flag: '🇱🇰' },
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩' },
  { code: 'ZIM', name: 'Zimbabwe', flag: '🇿🇼' }
] as const;

// Eras
const ERAS = [
  { id: 'legends', name: 'Legends Era', emoji: '🏆' },
  { id: '1970s', name: '1970s', emoji: '📼' },
  { id: '1980s', name: '1980s', emoji: '📻' },
  { id: '1990s', name: '1990s', emoji: '💾' },
  { id: '2000s', name: '2000s', emoji: '📱' },
  { id: '2010s', name: '2010s', emoji: '📲' },
  { id: '2020s', name: '2020s', emoji: '🚀' }
] as const;

// Historical exclusions
const HISTORICAL_EXCLUSIONS: Record<string, string[]> = {
  'SA': ['1970s', '1980s'], // Apartheid isolation
  'SL': ['1970s'],          // Test status 1981
  'BD': ['1970s', '1980s', '1990s'], // Test status 2000
  'ZIM': ['1970s', '1980s'] // Test status 1992
};

// Load player data (in real implementation, this would fetch from JSON files)
// For now, we'll reference the JSON files we created
const PLAYER_DATA_MAP: Record<string, Player[]> = {
  legends: [], // Will be populated from legends.json
  '1970s': [], // Will be populated from 1970s.json
  '1980s': [], // Will be populated from 1980s.json
  '1990s': [], // Will be populated from 1990s.json
  '2000s': [], // Will be populated from 2000s.json
  '2010s': [], // Will be populated from 2010s.json
  '2020s': []  // Will be populated from 2020s.json
};

/**
 * Get a random spin result (nation + era)
 * Ensures the combination is historically valid
 */
export function getRandomSpin(): SpinResult {
  let nation: typeof TEST_NATIONS[number];
  let era: typeof ERAS[number];
  let attempts = 0;
  const maxAttempts = 20; // Prevent infinite loop

  do {
    nation = TEST_NATIONS[Math.floor(Math.random() * TEST_NATIONS.length)];
    era = ERAS[Math.floor(Math.random() * ERAS.length)];
    attempts++;

    // Check if this nation/era combination is valid
    if (isValidNationEraCombination(nation.code, era.id)) {
      break;
    }

    // If we've tried too many times, just return a valid combination
    if (attempts >= maxAttempts) {
      // Find a random valid combination
      const validCombinations: {nation: typeof TEST_NATIONS[number]; era: typeof ERAS[number]}[] = [];

      for (const n of TEST_NATIONS) {
        for (const e of ERAS) {
          if (isValidNationEraCombination(n.code, e.id)) {
            validCombinations.push({nation: n, era: e});
          }
        }
      }

      if (validCombinations.length > 0) {
        const randomIndex = Math.floor(Math.random() * validCombinations.length);
        return validCombinations[randomIndex];
      }

      // Fallback to first valid combination
      return {nation: TEST_NATIONS[0], era: ERAS[0]};
    }
  } while (true);

  // Get available players for this nation/era combination
  const availablePlayers = getAvailablePlayers(nation.code, era.id);

  return {
    nation: nation.name,
    nationCode: nation.code,
    nationFlag: nation.flag,
    era: era.name,
    eraId: era.id,
    eraEmoji: era.emoji,
    availablePlayers
  };
}

/**
 * Check if a nation/era combination is historically valid
 */
function isValidNationEraCombination(nationCode: string, eraId: string): boolean {
  const exclusions = HISTORICAL_EXCLUSIONS[nationCode] || [];
  return !exclusions.includes(eraId);
}

/**
 * Get available players for a nation/era combination
 * In a real implementation, this would filter the player data
 */
function getAvailablePlayers(nationCode: string, eraId: string): Player[] {
  // This would normally filter PLAYER_DATA_MAP[eraId] by nationCode
  // For now, returning empty array - in real implementation,
  // we'd import the actual JSON data
  return [];
}

/**
 * Initialize a new game state
 */
export function initializeGame(): GameState {
  return {
    spinsRemaining: 6,
    team: [],
    usedPlayers: new Set(),
    rerolls: {
      team: true,
      era: true
    },
    spinHistory: [],
    isComplete: false
  };
}

/**
 * Process a spin and return the result
 */
export function processSpin(gameState: GameState): SpinResult | null {
  if (gameState.spinsRemaining <= 0 || gameState.isComplete) {
    return null;
  }

  const spinResult = getRandomSpin();

  // Add to history
  gameState.spinHistory.push(spinResult);
  gameState.spinsRemaining--;

  return spinResult;
}

/**
 * Use a team reroll (keep era, get new nation)
 */
export function useTeamReroll(gameState: GameState, lastSpin: SpinResult): SpinResult | null {
  if (!gameState.rerolls.team) {
    return null; // No rerolls left
  }

  // Keep the same era, get a random nation
  let nation = TEST_NATIONS[Math.floor(Math.random() * TEST_NATIONS.length)];

  // Ensure it's a valid combination
  let attempts = 0;
  const maxAttempts = 10;

  while (!isValidNationEraCombination(nation.code, lastSpin.eraId) && attempts < maxAttempts) {
    nation = TEST_NATIONS[Math.floor(Math.random() * TEST_NATIONS.length)];
    attempts++;
  }

  if (attempts >= maxAttempts) {
    // If we can't find a valid nation, just use the original
    return lastSpin;
  }

  // Mark reroll as used
  gameState.rerolls.team = false;

  // Get available players for the new combination
  const availablePlayers = getAvailablePlayers(nation.code, lastSpin.eraId);

  return {
    nation: nation.name,
    nationCode: nation.code,
    nationFlag: nation.flag,
    era: lastSpin.era,
    eraId: lastSpin.eraId,
    eraEmoji: lastSpin.eraEmoji,
    availablePlayers
  };
}

/**
 * Use an era reroll (keep nation, get new era)
 */
export function useEraReroll(gameState: GameState, lastSpin: SpinResult): SpinResult | null {
  if (!gameState.rerolls.era) {
    return null; // No rerolls left
  }

  // Keep the same nation, get a random era
  let era = ERAS[Math.floor(Math.random() * ERAS.length)];

  // Ensure it's a valid combination
  let attempts = 0;
  const maxAttempts = 10;

  while (!isValidNationEraCombination(gameState.spinHistory[gameState.spinHistory.length - 1].nationCode, era.id) && attempts < maxAttempts) {
    era = ERAS[Math.floor(Math.random() * ERAS.length)];
    attempts++;
  }

  if (attempts >= maxAttempts) {
    // If we can't find a valid era, just use the original
    return lastSpin;
  }

  // Mark reroll as used
  gameState.rerolls.era = false;

  // Get available players for the new combination
  const availablePlayers = getAvailablePlayers(
    gameState.spinHistory[gameState.spinHistory.length - 1].nationCode,
    era.id
  );

  return {
    nation: gameState.spinHistory[gameState.spinHistory.length - 1].nation,
    nationCode: gameState.spinHistory[gameState.spinHistory.length - 1].nationCode,
    nationFlag: gameState.spinHistory[gameState.spinHistory.length - 1].nationFlag,
    era: era.name,
    eraId: era.id,
    eraEmoji: era.emoji,
    availablePlayers
  };
}

/**
 * Add a player to the team
 */
export function addPlayerToTeam(gameState: GameState, playerId: string, availablePlayers: Player[]): boolean {
  // Check if we've reached team size limit (12 players)
  if (gameState.team.length >= 12) {
    return false;
  }

  // Check if player is already used
  if (gameState.usedPlayers.has(playerId)) {
    return false;
  }

  // Check if player is available in current spin
  const player = availablePlayers.find(p => p.id === playerId);
  if (!player) {
    return false;
  }

  // Check role constraints (max 1 opener, 1 keeper, 1 all-rounder per spin)
  // This would be checked in the UI before calling this function

  // Add player to team
  gameState.team.push(player);
  gameState.usedPlayers.add(playerId);

  return true;
}

/**
 * Check if team is complete (12 players)
 */
export function isTeamComplete(gameState: GameState): boolean {
  return gameState.team.length >= 12;
}

/**
 * Complete the game (no more spins)
 */
export function completeGame(gameState: GameState): void {
  gameState.isComplete = true;
}

/**
 * Get the 12th man (player to be benched)
 * In real implementation, this would be chosen by user or auto-selected
 */
export function getTwelfthMan(gameState: GameState): Player | null {
  if (gameState.team.length !== 12) {
    return null;
  }

  // For now, just return the last player added
  // In real implementation, user would choose or we'd use strategy
  return gameState.team[gameState.team.length - 1] || null;
}

/**
 * Get the playing XI (team minus 12th man)
 */
export function getPlayingXI(gameState: GameState): Player[] {
  const twelfthManIndex = gameState.team.length - 1; // Last player as 12th man
  return [...gameState.team].slice(0, twelfthManIndex);
}