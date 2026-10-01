/**
 * draft-slots.ts — keeps the normal game, the Daily Challenge and a friend's
 * challenge from overwriting each other's saved draft.
 *
 * /play and /matchup read ONE draft from fixed localStorage keys
 * (`beatmy11.draft.v1`, `beatmy11.userXI.v1`). Those "live" keys always hold the
 * draft of the mode named by `bm11.slot`. Switching mode parks the live draft
 * under that mode's own keys and loads the other mode's draft (or an empty one).
 *
 * Which mode /play runs is decided only by the link: /play = normal,
 * /play?daily=1 = daily, /play?c=… = challenge, /ipl/play = the IPL format.
 * Nothing a player did earlier can turn a plain /play into a daily.
 */

export type DraftMode = 'normal' | 'daily' | 'challenge' | 'ipl';

const LIVE_DRAFT = 'beatmy11.draft.v1';
const LIVE_XI = 'beatmy11.userXI.v1';
const SLOT_KEY = 'bm11.slot';
const parked = (mode: DraftMode, what: 'draft' | 'xi') => `bm11.parked.${mode}.${what}`;

const get = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const set = (k: string, v: string | null): void => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* storage unavailable: nothing to keep apart */
  }
};

/** The mode that currently owns the live draft keys (normal if never set). */
export function currentMode(): DraftMode {
  const v = get(SLOT_KEY);
  return v === 'daily' || v === 'challenge' || v === 'ipl' ? v : 'normal';
}

/** Make `mode` the owner of the live keys, parking the previous owner's draft. */
export function switchMode(mode: DraftMode): void {
  const from = currentMode();
  if (from === mode) return;
  set(parked(from, 'draft'), get(LIVE_DRAFT));
  set(parked(from, 'xi'), get(LIVE_XI));
  set(LIVE_DRAFT, get(parked(mode, 'draft')));
  set(LIVE_XI, get(parked(mode, 'xi')));
  set(parked(mode, 'draft'), null);
  set(parked(mode, 'xi'), null);
  set(SLOT_KEY, mode === 'normal' ? null : mode);
}

/** The saved draft blob (raw JSON) belonging to `mode`, wherever it is stored. */
export function draftBlobFor(mode: DraftMode): string | null {
  return currentMode() === mode ? get(LIVE_DRAFT) : get(parked(mode, 'draft'));
}

/** Delete `mode`'s saved draft and XI, wherever they are stored. */
export function clearDraftFor(mode: DraftMode): void {
  if (currentMode() === mode) {
    set(LIVE_DRAFT, null);
    set(LIVE_XI, null);
  } else {
    set(parked(mode, 'draft'), null);
    set(parked(mode, 'xi'), null);
  }
}

/** Number of players picked in `mode`'s saved draft (0 if none). */
export function pickCountFor(mode: DraftMode): number {
  try {
    const raw = draftBlobFor(mode);
    const d = raw ? JSON.parse(raw) : null;
    return Array.isArray(d?.picks) ? d.picks.length : 0;
  } catch {
    return 0;
  }
}
