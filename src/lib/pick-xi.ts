/**
 * pick-xi.ts — the rules of the "Pick any XI" mode (owner, 2026-10-02): no spins, any player,
 * the usual eleven slots, played against a friend's XI or the format's fixed opponent.
 * Pure and browser-safe (the head-to-head store takes its storage as an argument).
 *
 * The XI travels in the link (`?vs=<xi>`), encoded like the share links (share-results.ts).
 * Nothing is stored on a server and these XIs are not sent to the anonymous score collection.
 */
import { OUTCOME_BANDS, hashSeed, type OutcomeBand } from './series';

/**
 * Friend v friend scoreline ladder. PROVISIONAL (Claude's proposal; owner to confirm): unlike
 * the game against the fixed opponent, neither side gets a head start, so the cuts are
 * symmetric around a level gap. `gap` = my team score minus theirs, after the seeded wobble.
 *   below -8: 0-5 | -8..-4: 1-4 | -4..-1: 2-3 | -1..1: 2-2 | 1..4: 3-2 | 4..8: 4-1 | 8+: 5-0
 */
export const DUEL_CUTS = [-8, -4, -1, 1, 4, 8] as const;

export function duelBand(gap: number): OutcomeBand {
  let i = 0;
  while (i < DUEL_CUTS.length && gap >= DUEL_CUTS[i]) i++;
  return OUTCOME_BANDS[i];
}

/** One seed for a pair of XIs, whoever is looking at it. `a` is the challenger (`vs`), `b` the responder. */
export const duelSeed = (aKeys: string[], bKeys: string[]) => hashSeed(`${aKeys.join(',')}|${bKeys.join(',')}`);

/** A display name typed by a player: plain text, trimmed, at most 20 characters. */
export function cleanName(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/[^\p{L}\p{N} .'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20);
}
export const xiLabel = (name: string, fallback: string) => (name ? `${name}'s XI` : fallback);

// ---------------------------------------------------------------- chain challenges
// A challenge that travels through a group (2026-10-02). The link carries `k`: how many XIs the
// XI in `vs` has beaten in a row. Whoever opens a result and picks their own XI takes on the
// winner, with the count carried on. It is a number in a link: anyone can edit it, so it is a
// friendly count, not a record.

/** `k` from a link: a whole number from 0 to 99, anything else is 0. */
export function parseChain(raw: string | null | undefined): number {
  const n = Number(raw);
  return /^\d{1,2}$/.test(String(raw ?? '')) && Number.isInteger(n) ? n : 0;
}

/**
 * After a series between the holder (the XI in `vs`, with `k` wins in a row) and a challenger:
 * who the next person faces and that XI's run. The holder winning adds one; the challenger
 * winning starts a run of one; a drawn series keeps the holder, whose run stays as it was.
 * `challenger`/`holder`: matches won by each.
 */
export function nextChain(k: number, challenger: number, holder: number): { winner: 'holder' | 'challenger'; chain: number } {
  if (challenger > holder) return { winner: 'challenger', chain: 1 };
  return { winner: 'holder', chain: holder > challenger ? Math.min(99, k + 1) : k };
}

/** "has beaten 3 XIs in a row" ('' for none). */
export const chainText = (chain: number) => (chain >= 1 ? `has beaten ${chain} XI${chain === 1 ? '' : 's'} in a row` : '');

// ---------------------------------------------------------------- badges
export interface BadgePlayer {
  /** Nation (Test, ODI, T20I) or franchise (IPL). */
  team: string;
  /** Every era (decade, "legends", or IPL season block) the player belongs to. */
  eras: string[];
  overseas?: boolean;
  /** Career matches in this format (an IPL card: matches in that stint). Absent = unknown. */
  matches?: number | null;
  /** The role the player fills in this XI (the slot's role). */
  role?: string;
}

/**
 * Match counts for the two career-length badges. PROVISIONAL (badges only; they never touch
 * scoring): "Cult heroes" = nobody above `few`; "Iron men" = everybody at or above `many`.
 */
export const BADGE_MATCHES: Record<'test' | 'odi' | 't20i' | 'ipl', { few: number; many: number; noun: string }> = {
  test: { few: 30, many: 100, noun: 'Tests' },
  odi: { few: 60, many: 200, noun: 'ODIs' },
  t20i: { few: 30, many: 75, noun: 'T20Is' },
  ipl: { few: 30, many: 50, noun: 'matches in the stint' },
};
export interface Badge { id: string; name: string; why: string }

/**
 * Badges for an interesting XI. They reward imagination, since the strongest possible XI is the
 * same for everyone. `allEras`: the format's eras in order; `modern`: the eras that count as
 * "new generation".
 */
export function badgesFor(xi: BadgePlayer[], opts: { format: 'test' | 'odi' | 't20i' | 'ipl'; allEras: readonly string[]; modern: readonly string[] }): Badge[] {
  if (xi.length !== 11) return [];
  const out: Badge[] = [];
  const ipl = opts.format === 'ipl';
  const teams = new Set(xi.map((p) => p.team));
  if (teams.size === 1) out.push({ id: 'one-team', name: ipl ? 'One franchise' : 'One nation', why: `All eleven from ${[...teams][0]}` });
  if (teams.size >= 7) out.push({ id: 'world-tour', name: ipl ? 'League tour' : 'World tour', why: `${teams.size} different ${ipl ? 'franchises' : 'nations'}` });
  const covered = new Set(xi.flatMap((p) => p.eras));
  if (opts.allEras.length >= 3 && opts.allEras.every((e) => covered.has(e))) out.push({ id: 'time-traveller', name: 'Time traveller', why: 'A player from every era' });
  if (xi.every((p) => p.eras.some((e) => opts.modern.includes(e)))) out.push({ id: 'new-generation', name: 'New generation', why: 'Every player from the modern eras' });
  if (opts.format === 'test' && xi.every((p) => !p.eras.includes('legends'))) out.push({ id: 'no-legends', name: 'No legends', why: 'Not one player from the Legends era' });
  if (ipl && xi.every((p) => !p.overseas)) out.push({ id: 'homegrown', name: 'Homegrown', why: 'No overseas players' });
  // 2026-10-02: four more, each from data the site holds (eras, match counts, slot roles).
  const shared = opts.allEras.filter((e) => xi.every((p) => p.eras.includes(e)));
  if (shared.length) out.push({ id: 'one-era', name: ipl ? 'One season block' : 'One era', why: `All eleven played in ${shared[0] === 'legends' ? 'the Legends era' : ipl ? shared[0] : `the ${shared[0]}`}` });
  const m = BADGE_MATCHES[opts.format];
  // Unknown match counts never earn a badge.
  if (xi.every((p) => typeof p.matches === 'number')) {
    if (xi.every((p) => (p.matches as number) <= m.few)) out.push({ id: 'cult-heroes', name: 'Cult heroes', why: `Nobody with more than ${m.few} ${m.noun}` });
    if (xi.every((p) => (p.matches as number) >= m.many)) out.push({ id: 'iron-men', name: 'Iron men', why: `Everyone with ${m.many} or more ${m.noun}` });
  }
  const flex = (role: string) => xi.filter((p) => p.role === role).length;
  if (flex('spinner') === 2) out.push({ id: 'spin-twins', name: 'Spin twins', why: 'Two spinners at 7 and 8' });
  return out;
}

// ---------------------------------------------------------------- head-to-head record
export interface H2HRecord { won: number; lost: number; drawn: number; seen: string[] }
type Store = Pick<Storage, 'getItem' | 'setItem'>;
const H2H_KEY = 'beatmy11.h2h.v1';
const h2hId = (format: string, name: string) => `${format}:${name.toLowerCase()}`;

function loadAll(store: Store): Record<string, H2HRecord> {
  try {
    const v = JSON.parse(store.getItem(H2H_KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

/**
 * Record one series against a named friend, once per pair of XIs (`matchKey`), and return the
 * running record. Kept on this device only.
 */
export function recordH2H(store: Store, format: string, name: string, matchKey: string, mine: number, theirs: number): H2HRecord {
  const all = loadAll(store);
  const id = h2hId(format, name);
  const rec: H2HRecord = all[id] && Array.isArray(all[id].seen) ? all[id] : { won: 0, lost: 0, drawn: 0, seen: [] };
  if (!rec.seen.includes(matchKey)) {
    if (mine > theirs) rec.won++;
    else if (mine < theirs) rec.lost++;
    else rec.drawn++;
    rec.seen = [...rec.seen, matchKey].slice(-50);
    all[id] = rec;
    try {
      store.setItem(H2H_KEY, JSON.stringify(all));
    } catch {
      /* not remembered */
    }
  }
  return rec;
}

export function h2hLine(rec: H2HRecord, name: string): string {
  const { won, lost, drawn } = rec;
  const tail = drawn ? `, ${drawn} drawn` : '';
  if (won > lost) return `You lead ${name} ${won}–${lost}${tail}`;
  if (lost > won) return `${name} leads you ${lost}–${won}${tail}`;
  return `You and ${name} are level ${won}–${lost}${tail}`;
}
