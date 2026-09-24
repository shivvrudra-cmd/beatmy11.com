/**
 * player-logic.ts — framework-free player normalization + XI selection logic.
 *
 * Pure logic with NO data-file imports, so it can be bundled for the client
 * without dragging the ~400KB of player JSON into the JS bundle. (The data
 * itself is embedded in the page as a JSON blob; see player-store.ts.)
 *
 * Importable from Astro frontmatter (SSR/SSG) AND from client
 * `<script type="module">` blocks. No DOM access at module scope.
 *
 * Data facts handled here (do NOT "fix" the JSON files instead):
 * - Player `id`s repeat across era files AND inside a single file, so every
 *   player gets a namespaced `uid` of the form `${sourceEraId}:${id}`.
 * - `era` is sometimes a string, sometimes an array of strings; the original
 *   value is kept on `era` and a single display id is derived as `displayEra`.
 * - `primaryRole` casing is inconsistent ('Opener' vs 'opener', 'Fast bowler'
 *   vs 'fast-bowler'); `normalizeRole` canonicalises everything to the
 *   lowercase-hyphen form the components and ratings.ts understand.
 * - `secondaryRoles` may be an array or a single string.
 * - ratings.ts expects `stats.bowlingAverage` / `stats.bowlingStrikeRate` but
 *   the data files carry `testBowlingAverage` / `bowlingStrikeRate` (0 for
 *   non-bowlers); those are mapped onto fresh cloned stat objects here.
 */

/** Raw player shape as it appears in src/data/*.json (loose on purpose). */
export interface RawPlayer {
  id: string;
  name: string;
  nation?: string;
  era?: string | string[];
  primaryRole?: unknown;
  secondaryRoles?: unknown;
  stats?: Record<string, number | null | undefined>;
}

/** Normalized player: stable identity, canonical roles, cloned stats. */
export interface NormalizedPlayer {
  /** Namespaced identity `${sourceEraId}:${id}` — unique across all eras. */
  uid: string;
  /** Raw id from the data file (NOT unique across eras). */
  id: string;
  name: string;
  nation: string;
  /** Original `era` value (string | string[]). */
  era: string | string[];
  /** Single era id for display chips ('legends' | '1970s' | …). */
  displayEra: string;
  /** Normalized primary role: opener | middle-order | all-rounder |
   *  wicketkeeper | spinner | fast-bowler */
  primaryRole: string;
  /** Normalized secondary roles (array, primary role excluded). */
  secondaryRoles: string[];
  /** Cloned stats with `bowlingAverage` / `bowlingStrikeRate` mapped. */
  stats: Record<string, number>;
}

/** Era ids in chronological order — matches src/data/*.json and ERAS tokens. */
export const ERA_IDS = [
  'legends',
  '1970s',
  '1980s',
  '1990s',
  '2000s',
  '2010s',
  '2020s',
] as const;

export type EraId = (typeof ERA_IDS)[number];

/**
 * Canonicalise a role string to the lowercase-hyphen form used by the
 * components and ratings.ts: 'Fast bowler' → 'fast-bowler',
 * 'Middle-order' → 'middle-order', etc.
 */
export function normalizeRole(role: unknown): string {
  return String(role ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

function normalizeSecondaryRoles(raw: unknown, primary: string): string[] {
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : typeof raw === 'string' && raw
      ? [raw]
      : [];
  const out: string[] = [];
  for (const r of list) {
    const n = normalizeRole(r);
    if (n && n !== primary && !out.includes(n)) out.push(n);
  }
  return out;
}

/** Normalize one raw player; `sourceEraId` is the id of its data file. */
export function normalizePlayer(p: RawPlayer, sourceEraId: string): NormalizedPlayer {
  // Clone stats so the shared JSON objects are never mutated.
  const stats: Record<string, number> = {};
  for (const [k, v] of Object.entries(p.stats ?? {})) {
    if (v == null) continue;
    const n = Number(v);
    if (!Number.isNaN(n)) stats[k] = n;
  }
  // Map the data-file bowling fields onto the names ratings.ts expects.
  if ((stats.testBowlingAverage ?? 0) > 0) {
    stats.bowlingAverage = stats.testBowlingAverage;
  }
  if ((stats.bowlingStrikeRate ?? 0) > 0) {
    stats.bowlingStrikeRate = stats.bowlingStrikeRate;
  }

  const primaryRole = normalizeRole(p.primaryRole);
  const eraList = Array.isArray(p.era) ? p.era : p.era ? [p.era] : [];

  return {
    uid: `${sourceEraId}:${p.id}`,
    id: p.id,
    name: p.name,
    nation: p.nation ?? '',
    era: p.era ?? sourceEraId,
    displayEra: eraList[0] ?? sourceEraId,
    primaryRole,
    secondaryRoles: normalizeSecondaryRoles(p.secondaryRoles, primaryRole),
    stats,
  };
}

export interface FormationGroup {
  role: string;
  label: string;
  slots: number;
}

/**
 * XI formation. 11 slots total — mirrors the formation inside XIBuilder.astro;
 * keep the two in sync if either changes.
 */
export const FORMATION: FormationGroup[] = [
  { role: 'opener', label: 'Openers', slots: 2 },
  { role: 'middle-order', label: 'Middle Order', slots: 3 },
  { role: 'all-rounder', label: 'All-Rounders', slots: 1 },
  { role: 'wicketkeeper', label: 'Wicketkeeper', slots: 1 },
  { role: 'spinner', label: 'Spinners', slots: 2 },
  { role: 'fast-bowler', label: 'Fast Bowlers', slots: 2 },
];

export const XI_SIZE = FORMATION.reduce((n, g) => n + g.slots, 0); // 11

/**
 * Validate adding `player` to `xi`.
 * @returns null when the add is legal, otherwise a human-readable reason.
 */
export function validateAdd(
  xi: NormalizedPlayer[],
  player: NormalizedPlayer,
): string | null {
  if (xi.some((p) => p.uid === player.uid)) {
    return `${player.name} is already in your XI.`;
  }
  if (xi.length >= XI_SIZE) {
    return `Your XI is full — ${XI_SIZE} players selected.`;
  }
  const group = FORMATION.find((g) => g.role === player.primaryRole);
  if (group) {
    const used = xi.filter((p) => p.primaryRole === player.primaryRole).length;
    if (used >= group.slots) {
      return `No ${group.label} slots left (${group.slots} max).`;
    }
  }
  return null;
}

/** Number of players currently occupying a formation role. */
export function countRole(xi: NormalizedPlayer[], role: string): number {
  return xi.filter((p) => p.primaryRole === role).length;
}

// ---------------------------------------------------------------------------
// Persistence (localStorage, SSR-safe)
// ---------------------------------------------------------------------------

export const XI_STORAGE_KEY = 'beatmy11.userXI.v1';

function storageAvailable(): boolean {
  return typeof localStorage !== 'undefined';
}

/** Persist the user's XI (full normalized player objects). */
export function saveUserXI(players: NormalizedPlayer[]): void {
  if (!storageAvailable()) return;
  try {
    localStorage.setItem(XI_STORAGE_KEY, JSON.stringify(players));
  } catch {
    /* storage full / blocked — the in-memory XI still works */
  }
}

/** Load the saved XI, or null when nothing valid is stored. */
export function loadUserXI(): NormalizedPlayer[] | null {
  if (!storageAvailable()) return null;
  try {
    const raw = localStorage.getItem(XI_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    // Re-validate shape lightly; drop anything that isn't a player object.
    const players = parsed.filter(
      (p): p is NormalizedPlayer =>
        !!p && typeof p === 'object' && typeof (p as NormalizedPlayer).uid === 'string',
    );
    return players.length ? players : null;
  } catch {
    return null;
  }
}

/** Clear the saved XI. */
export function clearUserXI(): void {
  if (!storageAvailable()) return;
  try {
    localStorage.removeItem(XI_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Draft game state (client-safe; no data imports)
// ---------------------------------------------------------------------------
// Centralized state for the spin-draft flow on /play: 6 spins, 1 pick in
// round 1 (your Legend), 2 picks in rounds 2–6, 11 players total. All
// transitions are pure functions returning a new state — the page keeps ONE
// `draft` object as its single source of truth and re-renders from it.

/** The 10 Test nations, in the order used across the site. */
export const NATIONS = [
  'Australia',
  'Bangladesh',
  'England',
  'India',
  'New Zealand',
  'Pakistan',
  'South Africa',
  'Sri Lanka',
  'West Indies',
  'Zimbabwe',
] as const;

export type Nation = (typeof NATIONS)[number];

/** Six spins per draft; round 1 allows 1 pick (your Legend), rounds 2–6 allow 2. */
export const DRAFT_ROUNDS = 6;

/** Draft extras (spin history, round bookkeeping) live under this key. The
 *  plain player array stays under XI_STORAGE_KEY so /matchup keeps working. */
export const DRAFT_STORAGE_KEY = 'beatmy11.draft.v1';

/** A drafted player: normalized player + the round they were picked in. */
export interface DraftPick extends NormalizedPlayer {
  roundPicked: number;
}

/** One spin: the drawn combo plus the raw ids picked from it. */
export interface SpinRecord {
  round: number;
  era: string;
  nation: string;
  /** Raw player ids picked in this round. */
  picks: string[];
}

export interface DraftState {
  currentEra: string | null;
  currentNation: string | null;
  /** Round currently being drafted (1..6); 0 = draft not started. */
  currentRound: number;
  /** Raw ids picked in the current round. */
  picksThisRound: string[];
  selectedPlayers: DraftPick[];
  spinHistory: SpinRecord[];
  isSpinning: boolean;
  gameComplete: boolean;
}

/** Fresh draft: pre-spin state. */
export function createDraft(): DraftState {
  return {
    currentEra: null,
    currentNation: null,
    currentRound: 0,
    picksThisRound: [],
    selectedPlayers: [],
    spinHistory: [],
    isSpinning: false,
    gameComplete: false,
  };
}

/** Picks allowed in a round: 1 in round 1 (your Legend), 2 in rounds 2–6. */
export function selectionLimitForRound(round: number): number {
  return round === 1 ? 1 : 2;
}

/** Players still needed to reach a full XI. */
export function remainingSelections(state: DraftState): number {
  return Math.max(0, XI_SIZE - state.selectedPlayers.length);
}

/** Raw ids of every selected player (cross-era duplicate blocking). */
export function selectedRawIds(state: DraftState): Set<string> {
  return new Set(state.selectedPlayers.map((p) => p.id));
}

/**
 * A round is complete when its pick limit is reached, OR when every
 * unpicked player in the current pool is already taken (defensive
 * fallback — with the split spin pools every combo has enough players
 * for its round, so this should rarely trigger).
 * `unpickedInPool` = pool players whose raw id is not yet selected.
 */
export function isRoundComplete(state: DraftState, unpickedInPool: number): boolean {
  if (state.currentRound < 1 || state.currentRound > DRAFT_ROUNDS) return false;
  if (state.picksThisRound.length >= selectionLimitForRound(state.currentRound)) {
    return true;
  }
  return unpickedInPool <= 0;
}

/**
 * May a new spin start? Only before the draft starts, or once the
 * previous round is complete. Never while spinning, never after the
 * draft is complete, never past round 6.
 */
export function canSpin(state: DraftState, unpickedInPool: number): boolean {
  if (state.isSpinning || state.gameComplete) return false;
  if (state.currentRound === 0) return true;
  if (state.currentRound >= DRAFT_ROUNDS) return false;
  return isRoundComplete(state, unpickedInPool);
}

/**
 * Validate picking `player` right now. Returns null when legal, otherwise
 * a human-readable reason. Duplicate blocking is by RAW id: the same real
 * player drawn from another era file counts as the same player.
 * No formation/role rules are enforced here — deliberately (spec §11).
 */
export function validateDraftPick(
  state: DraftState,
  player: NormalizedPlayer,
): string | null {
  if (state.gameComplete) return 'Your XI is complete.';
  if (state.currentRound < 1) return 'Spin first to draw an era and nation.';
  if (state.selectedPlayers.some((p) => p.id === player.id)) {
    return `${player.name} is already in your XI.`;
  }
  if (state.picksThisRound.length >= selectionLimitForRound(state.currentRound)) {
    return 'Round complete — spin again for the next draw.';
  }
  return null;
}

/**
 * Record a spin result. Callers must check `canSpin` first; the transition
 * itself just advances the round and opens a fresh spin-history record.
 */
export function applySpinResult(
  state: DraftState,
  era: string,
  nation: string,
): DraftState {
  const round = state.currentRound + 1;
  return {
    ...state,
    currentEra: era,
    currentNation: nation,
    currentRound: round,
    picksThisRound: [],
    spinHistory: [...state.spinHistory, { round, era, nation, picks: [] }],
    isSpinning: false,
  };
}

/** Record a pick. Invalid picks (duplicates, over the round limit) are
 *  idempotent no-ops — the state is returned unchanged. */
export function applyDraftPick(
  state: DraftState,
  player: NormalizedPlayer,
): DraftState {
  if (validateDraftPick(state, player) !== null) return state;
  const pick: DraftPick = { ...player, roundPicked: state.currentRound };
  const spinHistory = state.spinHistory.map((s, i) =>
    i === state.spinHistory.length - 1
      ? { ...s, picks: [...s.picks, player.id] }
      : s,
  );
  const selectedPlayers = [...state.selectedPlayers, pick];
  return {
    ...state,
    picksThisRound: [...state.picksThisRound, player.id],
    selectedPlayers,
    spinHistory,
    gameComplete: selectedPlayers.length >= XI_SIZE,
  };
}

/**
 * Remove a pick — but ONLY from the active round. Picks from earlier
 * rounds are locked in (keeps the per-round accounting honest).
 * Idempotent no-op when the pick isn't removable.
 */
export function applyDraftDeselect(state: DraftState, rawId: string): DraftState {
  if (state.gameComplete) return state;
  const idx = state.selectedPlayers.findIndex(
    (p) => p.id === rawId && p.roundPicked === state.currentRound,
  );
  if (idx < 0) return state;
  const selectedPlayers = state.selectedPlayers.filter((_, i) => i !== idx);
  const picksThisRound = state.picksThisRound.filter((id) => id !== rawId);
  const spinHistory = state.spinHistory.map((s, i) =>
    i === state.spinHistory.length - 1
      ? { ...s, picks: s.picks.filter((id) => id !== rawId) }
      : s,
  );
  return { ...state, picksThisRound, selectedPlayers, spinHistory };
}

// ---------------------------------------------------------------------------
// Draft persistence (localStorage, SSR-safe)
// ---------------------------------------------------------------------------

export interface SerializedDraft {
  v: 1;
  currentEra: string | null;
  currentNation: string | null;
  currentRound: number;
  gameComplete: boolean;
  spinHistory: SpinRecord[];
  picks: { uid: string; round: number }[];
}

/** Serialize a draft for `beatmy11.draft.v1`. Players are stored by uid and
 *  re-resolved against the embedded pool on load. */
export function serializeDraft(state: DraftState): SerializedDraft {
  return {
    v: 1,
    currentEra: state.currentEra,
    currentNation: state.currentNation,
    currentRound: state.currentRound,
    gameComplete: state.gameComplete,
    spinHistory: state.spinHistory.map((s) => ({ ...s, picks: [...s.picks] })),
    picks: state.selectedPlayers.map((p) => ({ uid: p.uid, round: p.roundPicked })),
  };
}

/**
 * Rebuild a draft from stored data. `resolve` maps a uid back to a
 * normalized player from the current pool blob. Returns null when the data
 * is missing, malformed, or references players that no longer resolve —
 * the caller should then start clean.
 */
export function deserializeDraft(
  data: unknown,
  resolve: (uid: string) => NormalizedPlayer | null,
): DraftState | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Partial<SerializedDraft>;
  if (d.v !== 1 || typeof d.currentRound !== 'number') return null;
  const selectedPlayers: DraftPick[] = [];
  for (const entry of d.picks ?? []) {
    const p =
      entry && typeof entry.uid === 'string' ? resolve(entry.uid) : null;
    if (!p) return null;
    selectedPlayers.push({ ...p, roundPicked: Number(entry.round) || 1 });
  }
  const spinHistory: SpinRecord[] = Array.isArray(d.spinHistory)
    ? d.spinHistory
        .filter(
          (s): s is SpinRecord =>
            !!s &&
            typeof s === 'object' &&
            typeof (s as SpinRecord).round === 'number',
        )
        .map((s) => ({
          round: s.round,
          era: String(s.era ?? ''),
          nation: String(s.nation ?? ''),
          picks: Array.isArray(s.picks) ? s.picks.map(String) : [],
        }))
    : [];
  const last = spinHistory[spinHistory.length - 1];
  return {
    currentEra: d.currentEra ?? null,
    currentNation: d.currentNation ?? null,
    currentRound: d.currentRound,
    picksThisRound:
      last && last.round === d.currentRound ? [...last.picks] : [],
    selectedPlayers,
    spinHistory,
    isSpinning: false,
    gameComplete: d.gameComplete === true || selectedPlayers.length >= XI_SIZE,
  };
}

/** Persist draft extras (spin history, round bookkeeping). */
export function saveDraft(state: DraftState): void {
  if (!storageAvailable()) return;
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(serializeDraft(state)));
  } catch {
    /* storage full / blocked — the in-memory draft still works */
  }
}

/** Load the saved draft blob (still needs `deserializeDraft` + a resolver). */
export function loadDraft(): unknown {
  if (!storageAvailable()) return null;
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Clear saved draft extras. */
export function clearDraft(): void {
  if (!storageAvailable()) return;
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
