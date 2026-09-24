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

// NOTE: the XI formation now lives in XI_SLOTS below (fixed 11-slot lineup);
// XI_SIZE derives from it. The legacy FORMATION table was removed.

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

/** A drafted player: normalized player + the round they were picked in,
 *  plus the era of the spin that drafted them (the draw era — a player
 *  listed under several eras, e.g. Shaun Pollock in 1990s+2000s, is shown
 *  under the era the spin landed on). */
export interface DraftPick extends NormalizedPlayer {
  roundPicked: number;
  draftEra: string;
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
  /** The XI lineup: slot key → picked player uid (null = empty slot). */
  slots: Record<string, string | null>;
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
    slots: emptySlots(),
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

// ---------------------------------------------------------------------------
// XI slots — the right-pane lineup.
//
// The XI is 11 fixed slots: 2 openers, 3 middle-order batters + 1 mandatory
// wicketkeeper (the keeper bats in the middle order, so the keeper slot is
// one of the four middle-order rows), 1 all-rounder, 1 spinner, 3 fast
// bowlers. After each spin the user first selects a player from the pool,
// then selects the slot they go in; afterwards players can be moved between
// any slots their groups allow (e.g. Sangakkara — a middle-order batter who
// keeps wicket — can sit in a middle-order slot or the wicketkeeper slot).
// ---------------------------------------------------------------------------

/** One fixed slot in the XI lineup. */
export interface XiSlot {
  key: string;
  /** Role group that may occupy the slot. */
  group: string;
  label: string;
  /** The wicketkeeper slot must be filled before the XI can be compared. */
  required?: boolean;
}

export const XI_SLOTS: XiSlot[] = [
  { key: 'opener-1', group: 'opener', label: 'Opener 1' },
  { key: 'opener-2', group: 'opener', label: 'Opener 2' },
  { key: 'middle-1', group: 'middle-order', label: 'Middle Order 1' },
  { key: 'middle-2', group: 'middle-order', label: 'Middle Order 2' },
  { key: 'middle-3', group: 'middle-order', label: 'Middle Order 3' },
  { key: 'keeper', group: 'wicketkeeper', label: 'Wicketkeeper', required: true },
  { key: 'all-rounder', group: 'all-rounder', label: 'All-Rounder' },
  { key: 'spinner', group: 'spinner', label: 'Spinner' },
  { key: 'fast-1', group: 'fast-bowler', label: 'Fast Bowler 1' },
  { key: 'fast-2', group: 'fast-bowler', label: 'Fast Bowler 2' },
  { key: 'fast-3', group: 'fast-bowler', label: 'Fast Bowler 3' },
];

/** XI size derives from the slot lineup — always 11. */
export const XI_SIZE = XI_SLOTS.length;

/** Empty slot map for a fresh draft. */
export function emptySlots(): Record<string, string | null> {
  const slots: Record<string, string | null> = {};
  for (const s of XI_SLOTS) slots[s.key] = null;
  return slots;
}

export function slotByKey(key: string): XiSlot | undefined {
  return XI_SLOTS.find((s) => s.key === key);
}

export const DRAFT_GROUP_LABELS: Record<string, string> = {
  opener: 'Openers',
  'middle-order': 'Middle Order',
  'all-rounder': 'All-Rounders',
  spinner: 'Spinners',
  'fast-bowler': 'Fast Bowlers',
  wicketkeeper: 'Wicketkeeper',
};

/**
 * Every group a player belongs to: primary role first, then secondary
 * roles (e.g. Sangakkara → ['middle-order', 'wicketkeeper']).
 */
export function playerGroups(player: NormalizedPlayer): string[] {
  const groups = [player.primaryRole];
  for (const r of player.secondaryRoles ?? []) {
    if (r && !groups.includes(r)) groups.push(r);
  }
  return groups;
}

/** Can this player keep wicket (primary or secondary role)? */
export function isWicketkeeper(player: NormalizedPlayer): boolean {
  return playerGroups(player).includes('wicketkeeper');
}

/** Whether the XI contains someone who can keep wicket. */
export function hasWicketkeeper(xi: NormalizedPlayer[]): boolean {
  return xi.some(isWicketkeeper);
}

/** The mandatory wicketkeeper slot is filled. */
export function keeperSlotFilled(state: DraftState): boolean {
  return !!state.slots['keeper'];
}

/** The slot a picked player currently occupies, if any. */
export function slotOf(state: DraftState, uid: string): string | null {
  for (const s of XI_SLOTS) {
    if (state.slots[s.key] === uid) return s.key;
  }
  return null;
}

/** Picks in batting order (slot order) — the order saved for /matchup. */
export function orderedXI(state: DraftState): DraftPick[] {
  const byUid = new Map(state.selectedPlayers.map((p) => [p.uid, p]));
  const out: DraftPick[] = [];
  for (const s of XI_SLOTS) {
    const uid = state.slots[s.key];
    const p = uid ? byUid.get(uid) : undefined;
    if (p) out.push(p);
  }
  // Defensive: a pick missing its slot (shouldn't happen) goes last.
  for (const p of state.selectedPlayers) {
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

function groupLabels(player: NormalizedPlayer): string {
  return playerGroups(player)
    .map((g) => DRAFT_GROUP_LABELS[g] ?? g)
    .join(' / ');
}

/**
 * Validate picking `player` from the current pool (before a slot is
 * chosen). Returns null when legal, otherwise a human-readable reason —
 * the pool UI disables the card and shows this as its title.
 * Duplicate blocking is by RAW id: the same real player drawn from
 * another era file counts as the same player.
 */
export function validatePoolPick(
  state: DraftState,
  player: NormalizedPlayer,
): string | null {
  if (state.gameComplete) return 'Your XI is complete.';
  if (state.currentRound < 1) return 'Spin first to draw an era and nation.';
  if (state.selectedPlayers.some((p) => p.id === player.id)) {
    return `${player.name} is already in your XI.`;
  }
  if (
    state.picksThisRound.length >= selectionLimitForRound(state.currentRound)
  ) {
    return 'Round complete — spin again for the next draw.';
  }
  // A group is "filled" once every slot it can use is taken — then every
  // other player of that group becomes unpickable (the pool UI disables
  // them via this reason).
  const groups = playerGroups(player);
  const hasOpenSlot = XI_SLOTS.some(
    (s) => groups.includes(s.group) && !state.slots[s.key],
  );
  if (!hasOpenSlot) {
    return `No open slots for ${groupLabels(player)} — every slot is filled.`;
  }
  // The XI can never strand itself without a keeper: the final pick is
  // blocked unless it (or someone already picked) can keep wicket. Recovery
  // is always possible — the current round's pool is still open, every
  // non-Legends pool contains a keeper, and the final pick always lands in
  // round 6, whose pool is still open.
  if (
    state.selectedPlayers.length + 1 >= XI_SIZE &&
    !isWicketkeeper(player) &&
    !state.selectedPlayers.some(isWicketkeeper)
  ) {
    return 'Every XI needs a wicketkeeper — pick a keeper to complete your XI.';
  }
  return null;
}

/**
 * Validate placing `player` into `slotKey`. Null = legal.
 */
export function validateSlotPlacement(
  state: DraftState,
  player: NormalizedPlayer,
  slotKey: string,
): string | null {
  const poolReason = validatePoolPick(state, player);
  if (poolReason) return poolReason;
  const slot = slotByKey(slotKey);
  if (!slot) return 'Unknown slot.';
  if (state.slots[slotKey]) {
    return `${slot.label} is already taken — choose a glowing slot.`;
  }
  if (!playerGroups(player).includes(slot.group)) {
    return `${player.name} can't play there — they can only fill: ${groupLabels(player)}.`;
  }
  return null;
}

/**
 * Validate moving the occupant of `fromSlotKey` to `toSlotKey`. Covers
 * plain moves (target empty) and swaps (target occupied — both players
 * must be eligible for each other's slot). Null = legal.
 */
export function validateSlotMove(
  state: DraftState,
  fromSlotKey: string,
  toSlotKey: string,
): string | null {
  if (fromSlotKey === toSlotKey) return null;
  const uid = state.slots[fromSlotKey];
  const mover = state.selectedPlayers.find((p) => p.uid === uid);
  const toSlot = slotByKey(toSlotKey);
  const fromSlot = slotByKey(fromSlotKey);
  if (!mover || !toSlot || !fromSlot) return 'Nothing to move.';
  if (!playerGroups(mover).includes(toSlot.group)) {
    return `${mover.name} can't play there — they can only fill: ${groupLabels(mover)}.`;
  }
  const occupantUid = state.slots[toSlotKey];
  if (occupantUid) {
    const occupant = state.selectedPlayers.find((p) => p.uid === occupantUid);
    if (!occupant) return 'Nothing to move.';
    if (!playerGroups(occupant).includes(fromSlot.group)) {
      return `Can't swap — ${occupant.name} can't fill ${fromSlot.label}.`;
    }
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

/** Record a pick into a chosen slot. Invalid picks are idempotent
 *  no-ops — the state is returned unchanged. */
export function applyDraftPick(
  state: DraftState,
  player: NormalizedPlayer,
  slotKey: string,
): DraftState {
  if (validateSlotPlacement(state, player, slotKey) !== null) return state;
  const pick: DraftPick = {
    ...player,
    roundPicked: state.currentRound,
    draftEra: state.currentEra ?? player.displayEra,
  };
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
    slots: { ...state.slots, [slotKey]: player.uid },
    spinHistory,
    gameComplete: selectedPlayers.length >= XI_SIZE,
  };
}

/**
 * Move the occupant of one slot to another (or swap two occupants).
 * Invalid moves are idempotent no-ops. Moves never change the player set,
 * so they stay legal at any time — even after the draft is complete.
 */
export function applyDraftMove(
  state: DraftState,
  fromSlotKey: string,
  toSlotKey: string,
): DraftState {
  if (fromSlotKey === toSlotKey) return state;
  if (validateSlotMove(state, fromSlotKey, toSlotKey) !== null) return state;
  const slots = { ...state.slots };
  const mover = slots[fromSlotKey];
  slots[fromSlotKey] = slots[toSlotKey] ?? null;
  slots[toSlotKey] = mover ?? null;
  return { ...state, slots };
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
  const uid = state.selectedPlayers[idx].uid;
  const slots = { ...state.slots };
  for (const key of Object.keys(slots)) {
    if (slots[key] === uid) slots[key] = null;
  }
  const selectedPlayers = state.selectedPlayers.filter((_, i) => i !== idx);
  const picksThisRound = state.picksThisRound.filter((id) => id !== rawId);
  const spinHistory = state.spinHistory.map((s, i) =>
    i === state.spinHistory.length - 1
      ? { ...s, picks: s.picks.filter((id) => id !== rawId) }
      : s,
  );
  return { ...state, picksThisRound, selectedPlayers, slots, spinHistory };
}

// ---------------------------------------------------------------------------
// Draft persistence (localStorage, SSR-safe)
// ---------------------------------------------------------------------------

export interface SerializedDraft {
  v: 2;
  currentEra: string | null;
  currentNation: string | null;
  currentRound: number;
  gameComplete: boolean;
  spinHistory: SpinRecord[];
  picks: { uid: string; round: number; draftEra: string; slot: string | null }[];
}

/** Serialize a draft for `beatmy11.draft.v1`. Players are stored by uid and
 *  re-resolved against the embedded pool on load. */
export function serializeDraft(state: DraftState): SerializedDraft {
  return {
    v: 2,
    currentEra: state.currentEra,
    currentNation: state.currentNation,
    currentRound: state.currentRound,
    gameComplete: state.gameComplete,
    spinHistory: state.spinHistory.map((s) => ({ ...s, picks: [...s.picks] })),
    picks: state.selectedPlayers.map((p) => ({
      uid: p.uid,
      round: p.roundPicked,
      draftEra: p.draftEra,
      slot: slotOf(state, p.uid),
    })),
  };
}

/**
 * Rebuild a draft from stored data. `resolve` maps a uid back to a
 * normalized player from the current pool blob. Accepts v2 blobs (with
 * slots) and v1 blobs (no slots — picks are auto-assigned greedily, keepers
 * first so a keeper claims the keeper slot). Returns null when the data is
 * missing, malformed, or references players that no longer resolve — the
 * caller should then start clean.
 */
export function deserializeDraft(
  data: unknown,
  resolve: (uid: string) => NormalizedPlayer | null,
): DraftState | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Partial<SerializedDraft>;
  // Accept the current v2 shape and the legacy v1 shape (no slots).
  const version = (d as { v?: number }).v;
  if ((version !== 1 && version !== 2) || typeof d.currentRound !== 'number') return null;
  const selectedPlayers: DraftPick[] = [];
  const wantedSlots = new Map<string, string>();
  for (const entry of d.picks ?? []) {
    const p =
      entry && typeof entry.uid === 'string' ? resolve(entry.uid) : null;
    if (!p) return null;
    selectedPlayers.push({
      ...p,
      roundPicked: Number(entry.round) || 1,
      draftEra: String(entry.draftEra ?? p.displayEra),
    });
    const slotKey = typeof entry.slot === 'string' ? entry.slot : null;
    const slot = slotKey ? slotByKey(slotKey) : undefined;
    if (slot && playerGroups(p).includes(slot.group)) {
      wantedSlots.set(p.uid, slot.key);
    }
  }
  // Slot assignment: honour stored slots, then greedily place the rest.
  // Keepers go first so a keeper claims the keeper slot before batters fill
  // in around them. Bail out (null → start clean) on any inconsistency.
  const slots = emptySlots();
  for (const [uid, key] of wantedSlots) {
    if (slots[key]) return null;
    slots[key] = uid;
  }
  const unplaced = selectedPlayers
    .filter((p) => !wantedSlots.has(p.uid))
    .sort((a, b) => Number(isWicketkeeper(b)) - Number(isWicketkeeper(a)));
  for (const p of unplaced) {
    // A keeper-capable player claims the keeper slot first: otherwise a
    // keeper with a middle-order secondary role (e.g. Gilchrist) would
    // greedily fill a middle-order row and leave the mandatory keeper
    // slot empty.
    let target: (typeof XI_SLOTS)[number] | undefined;
    if (isWicketkeeper(p) && !slots.keeper) {
      target = slotByKey('keeper');
    } else {
      target = XI_SLOTS.find(
        (s) => playerGroups(p).includes(s.group) && !slots[s.key],
      );
    }
    if (!target) return null;
    slots[target.key] = p.uid;
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
    slots,
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
