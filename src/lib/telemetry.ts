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

export type EventName = 'shared' | 'view_home' | 'view_play' | 'view_result' | 'view_shared' | 'daily_started' | 'daily_completed' | 'challenge_started' | 'challenge_completed';

export function reportEvent(name: EventName): void {
  post('/api/events', { name });
}
