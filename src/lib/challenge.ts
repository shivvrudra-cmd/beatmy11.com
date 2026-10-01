/**
 * challenge.ts — challenge-a-friend links.
 *
 * Friend 1 finishes a draft and shares a link that carries the six spins they
 * drafted from (`c=`) and their scoreline (`vs=`). Friend 2 opens it, gets the
 * same six spins (no respins) and tries to beat the scoreline. Anyone can
 * redraft as often as they like; the result shows the try count.
 *
 * Pure functions plus tiny localStorage helpers. No accounts, no server record.
 */

export interface SpinCombo {
  era: string;
  nation: string;
}

export interface Scoreline {
  user: number;
  house: number;
}

export interface ChallengeState {
  /** Encoded spins (see encodeSpins) — also the challenge's identity. */
  spins: string;
  /** The scoreline to beat. */
  vs: Scoreline;
  /** Drafts started on this challenge. */
  tries: number;
  /** Best result so far, or null before the first finished draft. */
  best: Scoreline | null;
}

export const CHALLENGE_STORAGE_KEY = 'bm11.challenge.v1';

const NATION_CODES: Record<string, string> = {
  Australia: 'AUS', England: 'ENG', India: 'IND', Pakistan: 'PAK', 'West Indies': 'WI',
  'New Zealand': 'NZ', 'South Africa': 'SA', 'Sri Lanka': 'SL', Bangladesh: 'BAN', Zimbabwe: 'ZIM',
};
const CODE_TO_NATION: Record<string, string> = Object.fromEntries(Object.entries(NATION_CODES).map(([n, c]) => [c, n]));

/** `legends-ENG.1990s-IND. …` — era id, dash, nation code, pairs joined by dots. */
export function encodeSpins(spins: SpinCombo[]): string {
  return spins.map((s) => `${s.era}-${NATION_CODES[s.nation] ?? ''}`).join('.');
}

/**
 * Decode and validate against the real spin pools: six spins, round 1 from the
 * Legends pool, the rest from the draft pool, no era×nation pair twice. Anything
 * else (typos, tampering, a stale link after data changes) returns null.
 */
export function decodeSpins(raw: string | null | undefined, legend: SpinCombo[], draft: SpinCombo[]): SpinCombo[] | null {
  if (!raw || raw.length > 200) return null;
  const parts = raw.split('.');
  if (parts.length !== 6) return null;
  const out: SpinCombo[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < 6; i++) {
    const m = /^([a-z0-9]+)-([A-Z]{2,3})$/.exec(parts[i]);
    if (!m) return null;
    const nation = CODE_TO_NATION[m[2]];
    if (!nation) return null;
    const pool = i === 0 ? legend : draft;
    if (!pool.some((c) => c.era === m[1] && c.nation === nation)) return null;
    const key = `${m[1]}|${nation}`;
    if (seen.has(key)) return null;
    seen.add(key);
    out.push({ era: m[1], nation });
  }
  return out;
}

/**
 * Spins of the other formats (ODI, T20I, IPL). Their era ids ("2008-12", "2023+") and team codes
 * ("PBKS") do not fit the Test encoding, so each spin is `<era index><TEAM CODE>`, e.g.
 * `2MI.0CSK.…`: the era's position in the format's era list, then the team's short code.
 */
export interface SpinCodec {
  /** The format's era ids, in order. */
  eras: readonly string[];
  /** Team (nation or franchise) → short code of 2-4 capital letters. */
  teamCodes: Record<string, string>;
}

export function encodeSpinsWith(spins: SpinCombo[], codec: SpinCodec): string {
  return spins.map((s) => `${codec.eras.indexOf(s.era)}${codec.teamCodes[s.nation] ?? ''}`).join('.');
}

/** Decode and validate against the format's real draws: six spins, each a real draw, none twice. */
export function decodeSpinsWith(raw: string | null | undefined, codec: SpinCodec, round1: SpinCombo[], draft: SpinCombo[]): SpinCombo[] | null {
  if (!raw || raw.length > 200) return null;
  const parts = raw.split('.');
  if (parts.length !== 6) return null;
  const byCode = Object.fromEntries(Object.entries(codec.teamCodes).map(([team, c]) => [c, team]));
  const out: SpinCombo[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < 6; i++) {
    const m = /^(\d)([A-Z]{2,4})$/.exec(parts[i]);
    if (!m) return null;
    const era = codec.eras[Number(m[1])];
    const nation = byCode[m[2]];
    if (!era || !nation) return null;
    const pool = i === 0 ? round1 : draft;
    if (!pool.some((c) => c.era === era && c.nation === nation)) return null;
    const key = `${era}|${nation}`;
    if (seen.has(key)) return null;
    seen.add(key);
    out.push({ era, nation });
  }
  return out;
}

/** '3-2' → { user: 3, house: 2 }; the five-Test total must be ≤ 5. */
export function parseScoreline(raw: string | null | undefined): Scoreline | null {
  const m = /^([0-5])-([0-5])$/.exec(raw ?? '');
  if (!m) return null;
  const user = Number(m[1]);
  const house = Number(m[2]);
  return user + house <= 5 ? { user, house } : null;
}

export const scorelineText = (s: Scoreline) => `${s.user}–${s.house}`;

/** The series margin: wins minus the World XI's wins. */
const margin = (s: Scoreline) => s.user - s.house;

/** Did `mine` beat, match, or fall short of `target`? */
export function challengeOutcome(target: Scoreline, mine: Scoreline): 'beat' | 'matched' | 'short' {
  const d = margin(mine) - margin(target);
  return d > 0 ? 'beat' : d === 0 ? 'matched' : 'short';
}

export function betterOf(a: Scoreline | null, b: Scoreline): Scoreline {
  return a && margin(a) >= margin(b) ? a : b;
}

export function challengeShareText(target: Scoreline, mine: Scoreline, tries: number): string {
  const tried = tries > 1 ? ` in ${tries} tries` : ' first go';
  const out = challengeOutcome(target, mine);
  if (out === 'beat') return `I beat your ${scorelineText(target)} with ${scorelineText(mine)} from the same spins${tried} 🏏 Think you can top it?`;
  if (out === 'matched') return `I matched your ${scorelineText(target)} from the same spins${tried} 🏏 Can you beat it?`;
  return `I got ${scorelineText(mine)} from the same spins (you had ${scorelineText(target)}) 🏏 Think you can do better?`;
}

// ---------------------------------------------------------------- browser storage

/** Each format keeps its own friend's challenge; `scope` is the format id (Test: absent or 'test'). */
const scopedKey = (scope?: string) => (scope && scope !== 'test' ? `${CHALLENGE_STORAGE_KEY}.${scope}` : CHALLENGE_STORAGE_KEY);

export function loadChallenge(scope?: string): ChallengeState | null {
  try {
    const raw = JSON.parse(localStorage.getItem(scopedKey(scope)) || 'null');
    if (!raw || typeof raw.spins !== 'string' || !raw.vs || typeof raw.tries !== 'number') return null;
    const vs = parseScoreline(`${raw.vs.user}-${raw.vs.house}`);
    if (!vs) return null;
    const best = raw.best ? parseScoreline(`${raw.best.user}-${raw.best.house}`) : null;
    return { spins: raw.spins, vs, tries: raw.tries, best };
  } catch {
    return null;
  }
}

export function saveChallenge(c: ChallengeState | null, scope?: string): void {
  try {
    if (c) localStorage.setItem(scopedKey(scope), JSON.stringify(c));
    else localStorage.removeItem(scopedKey(scope));
  } catch {
    /* storage unavailable: the challenge just won't persist */
  }
}
