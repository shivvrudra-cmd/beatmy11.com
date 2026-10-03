/**
 * leaderboard.ts — the browser side of the daily leaderboard (docs/plans/daily-leaderboard.md).
 * PROPOSAL: lives on an unmerged pull request until the owner agrees to the stored data and
 * applies migration 0002. Until the Worker's table exists the board endpoint answers with an
 * error, `fetchBoard` returns null, and every piece of leaderboard UI stays hidden.
 *
 * Nothing is sent unless the player presses "Add my score". Do Not Track: nothing is sent at all.
 * It is a friendly board: the score is worked out in the browser and cannot be checked by the
 * server.
 */
const PLAYER_KEY = 'beatmy11.player.v1';
const POSTED_KEY = 'beatmy11.board.v1';

export type BoardFormat = 'test' | 'odi' | 't20i' | 'ipl';
export interface BoardEntry { rank: number; name: string; score: number; user: number; house: number }
export interface Board { day: string; format: string; total: number; beat: number; entries: BoardEntry[]; rank?: number }

const dnt = () => typeof navigator !== 'undefined' && navigator.doNotTrack === '1';

/** A random id kept in this browser so it cannot enter the same day twice. Not a login. */
export function playerId(): string {
  try {
    const have = localStorage.getItem(PLAYER_KEY);
    if (have && /^[0-9a-f]{32}$/.test(have)) return have;
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const id = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(PLAYER_KEY, id);
    return id;
  } catch {
    return '';
  }
}

/** Has this browser already added a score for this format today? */
export function hasPosted(format: string, day: string): boolean {
  try { return JSON.parse(localStorage.getItem(POSTED_KEY) || '{}')[format] === day; } catch { return false; }
}
function markPosted(format: string, day: string): void {
  try {
    const all = JSON.parse(localStorage.getItem(POSTED_KEY) || '{}');
    all[format] = day;
    localStorage.setItem(POSTED_KEY, JSON.stringify(all));
  } catch { /* not remembered; the server still keeps one entry per browser */ }
}

/** The day's board (top 50, totals, and the rank of `score` when given). Null when unavailable. */
export async function fetchBoard(format: string, day: string, score?: number): Promise<Board | null> {
  try {
    const q = typeof score === 'number' ? `?score=${(Math.round(score * 10) / 10).toFixed(1)}` : '';
    const res = await fetch(`/api/daily/${format}/${day}${q}`);
    if (!res.ok) return null;
    const b = await res.json();
    return b && Array.isArray(b.entries) && typeof b.total === 'number' ? (b as Board) : null;
  } catch {
    return null;
  }
}

export interface DailyPost { format: string; day: string; seed: number; score: number; user: number; house: number; draws: number; name: string }

/** Add today's result to the board. True when the server accepted it. */
export async function postDaily(p: DailyPost): Promise<boolean> {
  const player = playerId();
  if (dnt() || !player) return false;
  try {
    const res = await fetch('/api/daily', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        format: p.format, player, xi: (p.seed >>> 0).toString(16).padStart(8, '0'),
        score: Math.round(p.score * 10) / 10, user: p.user, house: p.house, draws: p.draws, name: p.name,
      }),
    });
    if (res.ok) markPosted(p.format, p.day);
    return res.ok;
  } catch {
    return false;
  }
}

export const canPost = () => !dnt();

// ---------------------------------------------------------------- wording (pure)
export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** "You are 12th of 340 today. 23% beat the World XI." (the second sentence needs 5+ entries). */
export function boardLine(b: Pick<Board, 'total' | 'beat' | 'rank'>, opponent: string): string {
  if (!b.total) return 'No scores on today’s board yet.';
  const place = b.rank ? `You are ${ordinal(Math.min(b.rank, b.total))} of ${b.total} today.` : `${b.total} on today’s board.`;
  return b.total >= 5 ? `${place} ${Math.round((b.beat / b.total) * 100)}% beat the ${opponent}.` : place;
}
