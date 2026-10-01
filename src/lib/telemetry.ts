/**
 * Anonymous, fire-and-forget telemetry (see worker/index.ts). Never throws,
 * never blocks the UI, and does nothing when the browser sends Do Not Track.
 */

const dnt = () => typeof navigator !== 'undefined' && navigator.doNotTrack === '1';

function post(path: string, body: unknown): void {
  if (dnt()) return;
  try {
    void fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* telemetry must never break the game */
  }
}

export interface ScoreReport {
  /** xiSeed of the drafted XI (same XI → same hash, so repeats are ignored). */
  seed: number;
  userScore: number;
  houseScore: number;
  user: number;
  house: number;
  draws: number;
}

export function reportScore(r: ScoreReport): void {
  post('/api/scores', {
    xi: (r.seed >>> 0).toString(16).padStart(8, '0'),
    userScore: Math.round(r.userScore * 100) / 100,
    houseScore: Math.round(r.houseScore * 100) / 100,
    user: r.user,
    house: r.house,
    draws: r.draws,
  });
}

export type EventName =
  | 'shared' | 'view_home' | 'view_play' | 'view_result' | 'view_shared'
  | 'daily_started' | 'daily_completed' | 'challenge_started' | 'challenge_completed'
  // "Pick any XI": page opened, challenge link sent, a friend's XI played.
  | 'view_pick' | 'pick_sent' | 'pick_played';

/** The other formats count separately: the same event names with the format id appended. */
export const EVENT_FORMATS = ['odi', 't20i', 'ipl'] as const;

/**
 * Add one to today's counter for `name`. `format` (owner, 2026-10-02): events from ODI, T20I and
 * IPL are counted under `<name>_<format>`, so each game's plays, shares and dailies can be told
 * apart. The Test game ('test' or absent) keeps the original names.
 */
export function reportEvent(name: EventName, format?: string): void {
  const suffix = format && (EVENT_FORMATS as readonly string[]).includes(format) ? `_${format}` : '';
  post('/api/events', { name: `${name}${suffix}` });
}
