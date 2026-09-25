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
  /** The XI lineup: slot key → occupant (player uid + declared role), null = empty. */
  slots: Record<string, SlotOccupant | null>;
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
// XI slots — the right-pane lineup, spots 1–11.
//
// Spots 1–2 take openers; spots 3–7 are flexible batting slots that accept
// middle-order batters, the wicketkeeper and the all-rounder; spot 8 takes
// the spinner or the all-rounder; spots 9–11 take fast bowlers. A player
// placed into a flexible slot is DECLARED as one of the roles the data says
// they can play there (primary role by default) — the declaration is what
// counts toward the XI composition, and it is stored on the slot itself.
// ---------------------------------------------------------------------------

/** The six roles that count toward an XI composition. */
export type XiRole =
  | 'opener'
  | 'middle-order'
  | 'wicketkeeper'
  | 'all-rounder'
  | 'spinner'
  | 'fast-bowler';

export const XI_ROLES: XiRole[] = [
  'opener',
  'middle-order',
  'wicketkeeper',
  'all-rounder',
  'spinner',
  'fast-bowler',
];

/** Right-pane slot groups — the units players can be rearranged within. */
export const XI_SLOT_GROUP_LABELS: Record<string, string> = {
  openers: 'Openers',
  batting: 'Batting 3\u20137',
  'spot-8': 'Spot 8',
  fast: 'Fast Bowlers',
};

/** One slot in the XI lineup. */
export interface XiSlot {
  key: string;
  /** Roles a placed player may be declared as in this slot. */
  roles: XiRole[];
  /** Slot group key (see XI_SLOT_GROUP_LABELS). */
  group: string;
  label: string;
}

export const XI_SLOTS: XiSlot[] = [
  { key: 'opener-1', roles: ['opener'], group: 'openers', label: 'Opener 1' },
  { key: 'opener-2', roles: ['opener'], group: 'openers', label: 'Opener 2' },
  {
    key: 'bat-3',
    roles: ['middle-order', 'wicketkeeper', 'all-rounder'],
    group: 'batting',
    label: 'Batting 3',
  },
  {
    key: 'bat-4',
    roles: ['middle-order', 'wicketkeeper', 'all-rounder'],
    group: 'batting',
    label: 'Batting 4',
  },
  {
    key: 'bat-5',
    roles: ['middle-order', 'wicketkeeper', 'all-rounder'],
    group: 'batting',
    label: 'Batting 5',
  },
  {
    key: 'bat-6',
    roles: ['middle-order', 'wicketkeeper', 'all-rounder'],
    group: 'batting',
    label: 'Batting 6',
  },
  {
    key: 'bat-7',
    roles: ['middle-order', 'wicketkeeper', 'all-rounder'],
    group: 'batting',
    label: 'Batting 7',
  },
  {
    key: 'spin-ar',
    roles: ['spinner', 'all-rounder'],
    group: 'spot-8',
    label: 'Spot 8',
  },
  { key: 'fast-1', roles: ['fast-bowler'], group: 'fast', label: 'Fast Bowler 9' },
  { key: 'fast-2', roles: ['fast-bowler'], group: 'fast', label: 'Fast Bowler 10' },
  { key: 'fast-3', roles: ['fast-bowler'], group: 'fast', label: 'Fast Bowler 11' },
];

/** XI size derives from the slot lineup — always 11. */
export const XI_SIZE = XI_SLOTS.length;

/** A filled slot records the player and the role they were declared as. */
export interface SlotOccupant {
  uid: string;
  role: XiRole;
}

/** Empty slot map for a fresh draft. */
export function emptySlots(): Record<string, SlotOccupant | null> {
  const slots: Record<string, SlotOccupant | null> = {};
  for (const s of XI_SLOTS) slots[s.key] = null;
  return slots;
}

export function slotByKey(key: string): XiSlot | undefined {
  return XI_SLOTS.find((s) => s.key === key);
}

/** Declared role of a slot's occupant, if filled. */
export function slotRoleOf(
  state: DraftState,
  slotKey: string,
): XiRole | null {
  return state.slots[slotKey]?.role ?? null;
}

/**
 * Left-pane pool display groups, in batting-to-bowling order. Grouping is by
 * primary role; wicketkeepers get their own group and are never folded into
 * middle order. `kind` selects the stat columns per group.
 */
export const POOL_GROUPS: { label: string; roles: XiRole[]; kind: string }[] = [
  { label: 'Openers', roles: ['opener'], kind: 'bat' },
  { label: 'Middle Order', roles: ['middle-order'], kind: 'bat' },
  { label: 'Wicketkeeper', roles: ['wicketkeeper'], kind: 'bat' },
  { label: 'All-Rounders', roles: ['all-rounder'], kind: 'ar' },
  { label: 'Spinners', roles: ['spinner'], kind: 'bowl' },
  { label: 'Fast Bowlers', roles: ['fast-bowler'], kind: 'bowl' },
];

export const DRAFT_GROUP_LABELS: Record<string, string> = {
  opener: 'Openers',
  'middle-order': 'Middle Order',
  'all-rounder': 'All-Rounders',
  spinner: 'Spinners',
  'fast-bowler': 'Fast Bowlers',
  wicketkeeper: 'Wicketkeeper',
};

/** Singular role labels for messages ("declared as Wicketkeeper", …). */
export const XI_ROLE_LABELS: Record<XiRole, string> = {
  opener: 'Opener',
  'middle-order': 'Middle-order batter',
  wicketkeeper: 'Wicketkeeper',
  'all-rounder': 'All-rounder',
  spinner: 'Spinner',
  'fast-bowler': 'Fast bowler',
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

/**
 * Roles `player` could be declared as in `slotKey` — the intersection of
 * the slot's accepted roles with the groups the data marks them eligible
 * for. Empty when the player can't play there at all.
 */
export function declarableRoles(
  player: NormalizedPlayer,
  slotKey: string,
): XiRole[] {
  const slot = slotByKey(slotKey);
  if (!slot) return [];
  const groups = playerGroups(player);
  return slot.roles.filter((r) => groups.includes(r));
}

/**
 * Default declaration: the primary role when the slot accepts it,
 * otherwise the first compatible group (groups are primary-first, so this
 * is deterministic).
 */
export function defaultDeclaredRole(
  player: NormalizedPlayer,
  slotKey: string,
): XiRole | null {
  const roles = declarableRoles(player, slotKey);
  if (roles.length === 0) return null;
  const primary = player.primaryRole as XiRole;
  return roles.includes(primary) ? primary : roles[0];
}

/** The slot a picked player currently occupies, if any. */
export function slotOf(state: DraftState, uid: string): string | null {
  for (const s of XI_SLOTS) {
    if (state.slots[s.key]?.uid === uid) return s.key;
  }
  return null;
}

/** Picks in batting order (slot order) — the order saved for /matchup. */
export function orderedXI(state: DraftState): DraftPick[] {
  const byUid = new Map(state.selectedPlayers.map((p) => [p.uid, p]));
  const out: DraftPick[] = [];
  for (const s of XI_SLOTS) {
    const uid = state.slots[s.key]?.uid;
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

// ---------------------------------------------------------------------------
// XI composition — the valid lineups and the hard-block validators.
//
// Valid XIs (11 players):
//   2 openers · 3–4 middle-order · 1 wicketkeeper (separate from middle
//   order) · 3 fast bowlers · plus the all-rounder / spinner balance: when
//   four middle-order spots are taken the XI holds exactly one of the
//   all-rounder or the spinner; when only three are taken it holds both.
// Every pool pick is validated up front: a card is disabled unless some
// placement keeps at least one valid XI reachable — including the supply
// check that picks still owed to the current round can actually be filled
// from the current pool. A draft can never dead-end.
// ---------------------------------------------------------------------------

/** Declared-role counts across the filled slots. */
export type XiCounts = Record<XiRole, number>;

export function emptyCounts(): XiCounts {
  return {
    opener: 0,
    'middle-order': 0,
    wicketkeeper: 0,
    'all-rounder': 0,
    spinner: 0,
    'fast-bowler': 0,
  };
}

/** The only valid XI compositions. */
export const XI_SHAPES: XiCounts[] = [
  {
    opener: 2,
    'middle-order': 4,
    wicketkeeper: 1,
    'all-rounder': 1,
    spinner: 0,
    'fast-bowler': 3,
  },
  {
    opener: 2,
    'middle-order': 4,
    wicketkeeper: 1,
    'all-rounder': 0,
    spinner: 1,
    'fast-bowler': 3,
  },
  {
    opener: 2,
    'middle-order': 3,
    wicketkeeper: 1,
    'all-rounder': 1,
    spinner: 1,
    'fast-bowler': 3,
  },
];

/** Declared-role tally for the current draft. */
export function countsOf(state: DraftState): XiCounts {
  const counts = emptyCounts();
  for (const s of XI_SLOTS) {
    const occ = state.slots[s.key];
    if (occ) counts[occ.role] += 1;
  }
  return counts;
}

/** Per-role maximum across the three XI shapes. */
const shapeMax: XiCounts = {
  opener: 2,
  'middle-order': 4,
  wicketkeeper: 1,
  'all-rounder': 1,
  spinner: 1,
  'fast-bowler': 3,
};

function countsFitShape(counts: XiCounts, shape: XiCounts): boolean {
  return XI_ROLES.every((r) => counts[r] <= shape[r]);
}

/**
 * Shapes a draft can still become: the counts must fit component-wise.
 * (Every shape sums to 11, so the deficit always exactly matches the
 * picks remaining — no separate arithmetic check is needed.)
 */
export function reachableShapes(counts: XiCounts): XiCounts[] {
  return XI_SHAPES.filter((s) => countsFitShape(counts, s));
}

/** Roles still needed to reach `shape` from `counts`. */
export function deficitOf(
  counts: XiCounts,
  shape: XiCounts,
): { role: XiRole; need: number }[] {
  const out: { role: XiRole; need: number }[] = [];
  for (const r of XI_ROLES) {
    const need = shape[r] - counts[r];
    if (need > 0) out.push({ role: r, need });
  }
  return out;
}

/** Picks remaining in rounds after the current one. */
function futurePicks(state: DraftState): number {
  if (state.currentRound < 1) return DRAFT_ROUNDS * 2 - 1;
  let n = 0;
  for (let r = state.currentRound + 1; r <= DRAFT_ROUNDS; r++) {
    n += selectionLimitForRound(r);
  }
  return n;
}

/**
 * Could `role` still be filled from `candidates` (unpicked pool players)
 * into the currently empty slots of `slots`? The supply check behind the
 * hard block: picks owed to the current round must come from this pool.
 */
export function canFillRole(
  slots: Record<string, SlotOccupant | null>,
  candidates: NormalizedPlayer[],
  role: XiRole,
): boolean {
  for (const p of candidates) {
    if (!playerGroups(p).includes(role)) continue;
    for (const s of XI_SLOTS) {
      if (slots[s.key]) continue;
      if (s.roles.includes(role)) return true;
    }
  }
  return false;
}

/** Human-readable per-role cap messages for the hard block. */
function roleCapReason(role: XiRole, have: number): string {
  switch (role) {
    case 'opener':
      return 'Both opener spots are filled.';
    case 'middle-order':
      return `Middle-order is at its maximum of 4 (${have} picked).`;
    case 'wicketkeeper':
      return 'Your XI already has its wicketkeeper.';
    case 'all-rounder':
      return 'Your XI already has its all-rounder.';
    case 'spinner':
      return 'Your XI already has its spinner.';
    case 'fast-bowler':
      return 'All three fast-bowler spots are filled.';
  }
}

/** "1 wicketkeeper, 2 fast bowlers" style deficit summary. */
function deficitLabel(
  deficit: { role: XiRole; need: number }[],
): string {
  return deficit
    .map(
      ({ role, need }) =>
        `${need} ${need === 1 ? XI_ROLE_LABELS[role].toLowerCase() : `${XI_ROLE_LABELS[role].toLowerCase()}s`}`,
    )
    .join(', ');
}

export interface PickSupply {
  /** Current round's pool (uids resolve against it). */
  pool: NormalizedPlayer[];
  /** Picks remaining in later rounds. */
  futurePicks: number;
}

/** Default supply context: derive round bookkeeping from the state, with
 *  the pool supplied by the caller. Omit the pool to skip the supply check
 *  (pure reachability — used by tests and placement). */
export function supplyFor(
  state: DraftState,
  pool: NormalizedPlayer[] = [],
): PickSupply {
  return { pool, futurePicks: futurePicks(state) };
}

/**
 * Validate picking `player` from the current pool (before a slot is
 * chosen). Returns null when legal, otherwise a human-readable reason —
 * the pool UI disables the card and shows this as its title.
 * Duplicate blocking is by RAW id: the same real player drawn from
 * another era file counts as the same player.
 *
 * Hard block: a pick is legal only if some (slot, declared role) keeps a
 * valid XI reachable AND every pick still owed to the current round after
 * this one can be filled from the current pool. When `supply.pool` is
 * empty the supply check is skipped (pure reachability).
 */
export function validatePoolPick(
  state: DraftState,
  player: NormalizedPlayer,
  supply?: PickSupply,
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
  const counts = countsOf(state);
  const pickedIds = new Set(state.selectedPlayers.map((p) => p.id));

  // Every role the player could declare in any slot. Per-role caps are the
  // most actionable reason and fire even when the matching slots are already
  // filled — but only when EVERY declarable role is capped, so a
  // keeper-capped Sangakkara can still be picked as a batter.
  const allRoles: XiRole[] = [];
  for (const s of XI_SLOTS) {
    for (const r of declarableRoles(player, s.key)) {
      if (!allRoles.includes(r)) allRoles.push(r);
    }
  }
  if (allRoles.length === 0) {
    return `No open slots for ${groupLabels(player)} — every slot is filled.`;
  }
  if (allRoles.every((r) => counts[r] + 1 > shapeMax[r])) {
    return roleCapReason(allRoles[0], counts[allRoles[0]]);
  }

  let sawCompatibleSlot = false;
  let supplyBlock: string | null = null;
  let comboBlock: { role: XiRole } | null = null;

  for (const s of XI_SLOTS) {
    if (state.slots[s.key]) continue;
    const roles = declarableRoles(player, s.key);
    if (roles.length === 0) continue;
    sawCompatibleSlot = true;
    for (const role of roles) {
      const counts2: XiCounts = { ...counts, [role]: counts[role] + 1 };
      let shapeFit = false;
      for (const shape of XI_SHAPES) {
        if (!countsFitShape(counts2, shape)) continue;
        shapeFit = true;
        // Supply check: picks still owed to this round after this pick
        // must be fillable from the current pool.
        if (supply && supply.pool.length > 0) {
          const deficit = deficitOf(counts2, shape);
          const dTotal = deficit.reduce((n, d) => n + d.need, 0);
          const needFromPool = Math.max(0, dTotal - supply.futurePicks);
          if (needFromPool > 0) {
            const slotsAfter = {
              ...state.slots,
              [s.key]: { uid: player.uid, role },
            };
            const candidates = supply.pool.filter(
              (p) => p.id !== player.id && !pickedIds.has(p.id),
            );
            const satisfiable = deficit.some((d) =>
              canFillRole(slotsAfter, candidates, d.role),
            );
            if (!satisfiable) {
              supplyBlock = `you'd still need ${deficitLabel(deficit)} with no one left in this draw to fill it`;
              continue;
            }
          }
        }
        return null; // some placement keeps a valid XI reachable
      }
      // No shape fits this declaration at all — remember it for the reason.
      if (!shapeFit && !comboBlock) comboBlock = { role };
    }
  }

  if (!sawCompatibleSlot) {
    return `No open slots for ${groupLabels(player)} — every slot is filled.`;
  }
  if (supplyBlock) {
    return `Picking ${player.name} now would strand your XI — ${supplyBlock}.`;
  }
  if (comboBlock) {
    return (
      `Picking ${player.name} as ${XI_ROLE_LABELS[comboBlock.role].toLowerCase()} ` +
      `leaves no valid XI combination from here.`
    );
  }
  return `No valid XI fits ${player.name} from here.`;
}

/**
 * Why declaring `player` as `role` in `slotKey` breaks the XI, else null.
 * With `supply`, also rejects declarations that would strand a role still
 * needed from the current draw.
 */
function rolePlacementReason(
  state: DraftState,
  player: NormalizedPlayer,
  slotKey: string,
  role: XiRole,
  supply?: PickSupply,
): string | null {
  const counts = countsOf(state);
  if (counts[role] + 1 > shapeMax[role]) return roleCapReason(role, counts[role]);
  const counts2: XiCounts = { ...counts, [role]: counts[role] + 1 };
  const shapes = reachableShapes(counts2);
  if (shapes.length === 0) {
    return `${player.name} as ${XI_ROLE_LABELS[role].toLowerCase()} leaves no valid XI combination from here.`;
  }
  if (supply && supply.pool.length > 0) {
    const slotsAfter: Record<string, SlotOccupant | null> = {
      ...state.slots,
      [slotKey]: { uid: player.uid, role },
    };
    for (const shape of shapes) {
      const deficit = deficitOf(counts2, shape);
      const dTotal = deficit.reduce((n, d) => n + d.need, 0);
      const needFromPool = Math.max(0, dTotal - supply.futurePicks);
      if (needFromPool === 0) return null;
      const pickedIds = new Set(state.selectedPlayers.map((p) => p.id));
      const candidates = supply.pool.filter(
        (p) => p.id !== player.id && !pickedIds.has(p.id),
      );
      if (deficit.some((d) => canFillRole(slotsAfter, candidates, d.role))) {
        return null;
      }
    }
    return `${player.name} as ${XI_ROLE_LABELS[role].toLowerCase()} would strand your XI — no one left in this draw could complete it.`;
  }
  return null;
}

/**
 * Legal declarations for placing `player` into `slotKey`: one entry per
 * declarable role, with null meaning "legal" and a string carrying the
 * reason it isn't. The pool UI glows the slot when any entry is legal;
 * the role chooser offers the legal ones.
 */
export function placementOptions(
  state: DraftState,
  player: NormalizedPlayer,
  slotKey: string,
  supply?: PickSupply,
): { role: XiRole; reason: string | null }[] {
  const slot = slotByKey(slotKey);
  if (!slot) return [];
  if (state.slots[slotKey]) {
    return declarableRoles(player, slotKey).map((role) => ({
      role,
      reason: `${slot.label} is already taken — choose a glowing slot.`,
    }));
  }
  return declarableRoles(player, slotKey).map((role) => ({
    role,
    reason: rolePlacementReason(state, player, slotKey, role, supply),
  }));
}

/** Validate placing `player` into `slotKey` declared as `role`. Null = legal. */
export function validateSlotPlacement(
  state: DraftState,
  player: NormalizedPlayer,
  slotKey: string,
  role: XiRole,
  supply?: PickSupply,
): string | null {
  // Pool-level guards first (duplicate, round over, draft complete).
  const poolReason = validatePoolPick(state, player, supply);
  if (poolReason) return poolReason;
  const slot = slotByKey(slotKey);
  if (!slot) return 'Unknown slot.';
  if (!declarableRoles(player, slotKey).includes(role)) {
    return `${player.name} can't play there as ${XI_ROLE_LABELS[role].toLowerCase()} — they can only fill: ${groupLabels(player)}.`;
  }
  const opt = placementOptions(state, player, slotKey, supply).find(
    (o) => o.role === role,
  );
  return opt ? opt.reason : 'Unknown slot.';
}

/**
 * Validate moving the occupant of `fromSlotKey` to `toSlotKey`. Covers
 * plain moves (target empty) and swaps (target occupied). The declared
 * role travels with the player when the destination accepts it, otherwise
 * it is re-derived (primary role first). Null = legal.
 */
export interface MoveOptions {
  /**
   * When true, the move is only allowed within one slot group (openers /
   * batting 3-7 / spot 8 / fast bowlers). Used once the XI is complete, so
   * the finished lineup can be rearranged but its composition can't change.
   */
  sameGroupOnly?: boolean;
}

export function validateSlotMove(
  state: DraftState,
  fromSlotKey: string,
  toSlotKey: string,
  supply?: PickSupply,
  options?: MoveOptions,
): string | null {
  if (fromSlotKey === toSlotKey) return null;
  const fromSlot = slotByKey(fromSlotKey);
  const toSlot = slotByKey(toSlotKey);
  const occ = state.slots[fromSlotKey];
  const mover = occ
    ? state.selectedPlayers.find((p) => p.uid === occ.uid)
    : undefined;
  if (!mover || !toSlot || !fromSlot || !occ) return 'Nothing to move.';
  if (options?.sameGroupOnly && fromSlot.group !== toSlot.group) {
    return (
      `Once your XI is complete, ${mover.name} can only be rearranged within ` +
      `the ${XI_SLOT_GROUP_LABELS[fromSlot.group]} group.`
    );
  }
  const newRole = toSlot.roles.includes(occ.role)
    ? occ.role
    : defaultDeclaredRole(mover, toSlotKey);
  if (!newRole) {
    return `${mover.name} can't play there — they can only fill: ${groupLabels(mover)}.`;
  }
  const counts = countsOf(state);
  counts[occ.role] -= 1;
  counts[newRole] += 1;
  const toOcc = state.slots[toSlotKey];
  let backRole: XiRole | null = null;
  if (toOcc) {
    const occupant = state.selectedPlayers.find((p) => p.uid === toOcc.uid);
    if (!occupant) return 'Nothing to move.';
    backRole = fromSlot.roles.includes(toOcc.role)
      ? toOcc.role
      : defaultDeclaredRole(occupant, fromSlotKey);
    if (!backRole) {
      return `Can't swap — ${occupant.name} can't fill ${fromSlot.label}.`;
    }
    counts[toOcc.role] -= 1;
    counts[backRole] += 1;
  }
  if (!reachableShapes(counts).length) {
    return `Moving ${mover.name} there would break your XI — no valid lineup fits from here.`;
  }
  if (supply && supply.pool.length > 0) {
    // A move can re-declare roles (e.g. fast bowler → middle-order), so the
    // same stranding check as picks applies: the picks still owed must be
    // able to complete the XI from this draw plus future rounds.
    const slotsAfter: Record<string, SlotOccupant | null> = {
      ...state.slots,
      [fromSlotKey]: toOcc ? { uid: toOcc.uid, role: backRole as XiRole } : null,
      [toSlotKey]: { uid: occ.uid, role: newRole },
    };
    const pickedIds = new Set(state.selectedPlayers.map((p) => p.id));
    const candidates = supply.pool.filter((p) => !pickedIds.has(p.id));
    const completable = reachableShapes(counts).some((shape) => {
      const deficit = deficitOf(counts, shape);
      const dTotal = deficit.reduce((n, d) => n + d.need, 0);
      if (Math.max(0, dTotal - supply.futurePicks) === 0) return true;
      return deficit.some((d) => canFillRole(slotsAfter, candidates, d.role));
    });
    if (!completable) {
      return `Moving ${mover.name} there would strand your XI — no one left in this draw could complete it.`;
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

/**
 * Record a pick into a chosen slot, declared as `role`. Invalid picks are
 * idempotent no-ops — the state is returned unchanged.
 */
export function applyDraftPick(
  state: DraftState,
  player: NormalizedPlayer,
  slotKey: string,
  role: XiRole,
  supply?: PickSupply,
): DraftState {
  if (validateSlotPlacement(state, player, slotKey, role, supply) !== null) {
    return state;
  }
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
    slots: { ...state.slots, [slotKey]: { uid: player.uid, role } },
    spinHistory,
    gameComplete: selectedPlayers.length >= XI_SIZE,
  };
}

/**
 * Move the occupant of one slot to another (or swap two occupants),
 * re-deriving declarations exactly as `validateSlotMove` does. Invalid
 * moves are idempotent no-ops. Moves never change the player set, so they
 * stay legal at any time — even after the draft is complete.
 */
export function applyDraftMove(
  state: DraftState,
  fromSlotKey: string,
  toSlotKey: string,
  supply?: PickSupply,
  options?: MoveOptions,
): DraftState {
  if (fromSlotKey === toSlotKey) return state;
  if (validateSlotMove(state, fromSlotKey, toSlotKey, supply, options) !== null)
    return state;
  const fromSlot = slotByKey(fromSlotKey)!;
  const toSlot = slotByKey(toSlotKey)!;
  const occ = state.slots[fromSlotKey]!;
  const mover = state.selectedPlayers.find((p) => p.uid === occ.uid)!;
  const newRole = toSlot.roles.includes(occ.role)
    ? occ.role
    : defaultDeclaredRole(mover, toSlotKey)!;
  const slots = { ...state.slots };
  const toOcc = slots[toSlotKey];
  if (toOcc) {
    const occupant = state.selectedPlayers.find((p) => p.uid === toOcc.uid)!;
    const backRole = fromSlot.roles.includes(toOcc.role)
      ? toOcc.role
      : defaultDeclaredRole(occupant, fromSlotKey)!;
    slots[fromSlotKey] = { uid: toOcc.uid, role: backRole };
  } else {
    slots[fromSlotKey] = null;
  }
  slots[toSlotKey] = { uid: occ.uid, role: newRole };
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
    if (slots[key]?.uid === uid) slots[key] = null;
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

/**
 * Is the XI complete AND a valid lineup? Guards the Compare XIs step for
 * drafts restored from older saves, which the validators below never let
 * a live draft violate.
 */
export function isXIValid(state: DraftState): boolean {
  if (!state.gameComplete || state.selectedPlayers.length !== XI_SIZE) {
    return false;
  }
  const counts = countsOf(state);
  return XI_SHAPES.some((s) => XI_ROLES.every((r) => counts[r] === s[r]));
}

// ---------------------------------------------------------------------------
// Draft persistence (localStorage, SSR-safe)
// ---------------------------------------------------------------------------

export interface SerializedDraft {
  v: 3;
  currentEra: string | null;
  currentNation: string | null;
  currentRound: number;
  gameComplete: boolean;
  spinHistory: SpinRecord[];
  picks: {
    uid: string;
    round: number;
    draftEra: string;
    slot: string | null;
    role: XiRole | null;
  }[];
}

/** Serialize a draft for `beatmy11.draft.v1`. Players are stored by uid and
 *  re-resolved against the embedded pool on load. */
export function serializeDraft(state: DraftState): SerializedDraft {
  return {
    v: 3,
    currentEra: state.currentEra,
    currentNation: state.currentNation,
    currentRound: state.currentRound,
    gameComplete: state.gameComplete,
    spinHistory: state.spinHistory.map((s) => ({ ...s, picks: [...s.picks] })),
    picks: state.selectedPlayers.map((p) => {
      const key = slotOf(state, p.uid);
      return {
        uid: p.uid,
        round: p.roundPicked,
        draftEra: p.draftEra,
        slot: key,
        role: key ? slotRoleOf(state, key) : null,
      };
    }),
  };
}

/** v2 slot keys → v3 (slot key, declared role). */
const V2_SLOT_REMAP: Record<string, { slot: string; role: XiRole }> = {
  'opener-1': { slot: 'opener-1', role: 'opener' },
  'opener-2': { slot: 'opener-2', role: 'opener' },
  'middle-1': { slot: 'bat-3', role: 'middle-order' },
  'middle-2': { slot: 'bat-4', role: 'middle-order' },
  'middle-3': { slot: 'bat-5', role: 'middle-order' },
  keeper: { slot: 'bat-6', role: 'wicketkeeper' },
  'all-rounder': { slot: 'bat-7', role: 'all-rounder' },
  spinner: { slot: 'spin-ar', role: 'spinner' },
  'fast-1': { slot: 'fast-1', role: 'fast-bowler' },
  'fast-2': { slot: 'fast-2', role: 'fast-bowler' },
  'fast-3': { slot: 'fast-3', role: 'fast-bowler' },
};

/**
 * Rebuild a draft from stored data. `resolve` maps a uid back to a
 * normalized player from the current pool blob. Accepts v3 blobs (slots +
 * declared roles), v2 blobs (fixed slots, remapped) and v1 blobs (no slots
 * — picks are placed greedily, keepers first, keeping a valid XI
 * reachable). Returns null when the data is missing, malformed, or
 * references players that no longer resolve — the caller should then
 * start clean.
 */
export function deserializeDraft(
  data: unknown,
  resolve: (uid: string) => NormalizedPlayer | null,
): DraftState | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Partial<SerializedDraft>;
  const version = (d as { v?: number }).v;
  if ((version !== 1 && version !== 2 && version !== 3) || typeof d.currentRound !== 'number') {
    return null;
  }
  const selectedPlayers: DraftPick[] = [];
  const wanted = new Map<string, { slot: string; role: XiRole }>();
  const wantedSlots = new Set<string>();
  const claimSlot = (p: NormalizedPlayer, slot: string, role: XiRole) => {
    // First claim wins — a duplicate stored slot falls back to greedy.
    if (!wantedSlots.has(slot)) {
      wanted.set(p.uid, { slot, role });
      wantedSlots.add(slot);
    }
  };
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
    if (!slotKey) continue;
    if (version === 3) {
      const role = (entry as { role?: unknown }).role;
      if (
        slotByKey(slotKey) &&
        typeof role === 'string' &&
        (slotByKey(slotKey)!.roles as string[]).includes(role) &&
        playerGroups(p).includes(role)
      ) {
        claimSlot(p, slotKey, role as XiRole);
      }
    } else if (version === 2) {
      const remap = V2_SLOT_REMAP[slotKey];
      if (remap && playerGroups(p).includes(remap.role)) {
        claimSlot(p, remap.slot, remap.role);
      }
    }
  }
  // Slot assignment: honour stored slots, then greedily place the rest.
  // Keepers go first so a keeper claims a batting slot as wicketkeeper
  // before batters fill in around them. Every placement must keep a valid
  // XI reachable; bail out (null → start clean) on any inconsistency.
  const slots = emptySlots();
  const counts = emptyCounts();
  const place = (uid: string, slotKey: string, role: XiRole): boolean => {
    if (slots[slotKey]) return false;
    const counts2: XiCounts = { ...counts, [role]: counts[role] + 1 };
    if (!reachableShapes(counts2).length) return false;
    slots[slotKey] = { uid, role };
    counts[role] += 1;
    return true;
  };
  for (const [uid, w] of wanted) {
    if (!place(uid, w.slot, w.role)) return null;
  }
  const byUid = new Map(selectedPlayers.map((p) => [p.uid, p]));
  const unplaced = selectedPlayers
    .filter((p) => ![...wanted.keys()].includes(p.uid))
    .sort((a, b) => Number(isWicketkeeper(b)) - Number(isWicketkeeper(a)));
  for (const p of unplaced) {
    let done = false;
    // Prefer declaring a keeper-capable player as wicketkeeper while the
    // XI still needs one.
    const rolePrefs: XiRole[] = [];
    if (isWicketkeeper(p) && counts.wicketkeeper < 1) rolePrefs.push('wicketkeeper');
    for (const s of XI_SLOTS) {
      if (slots[s.key]) continue;
      const decl = declarableRoles(p, s.key);
      const ordered = [
        ...rolePrefs.filter((r) => decl.includes(r)),
        ...decl.filter((r) => !rolePrefs.includes(r)),
      ];
      // Default (primary-first) declaration first within the rest.
      const def = defaultDeclaredRole(p, s.key);
      ordered.sort((a, b) => (a === def ? -1 : b === def ? 1 : 0));
      for (const role of ordered) {
        if (place(p.uid, s.key, role)) {
          done = true;
          break;
        }
      }
      if (done) break;
    }
    if (!done) return null;
  }
  void byUid;
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
