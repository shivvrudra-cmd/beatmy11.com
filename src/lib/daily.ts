/**
 * daily.ts — the Daily Challenge: same spins for everyone each UTC day, plus a
 * streak for playing on consecutive days.
 *
 * Pure functions only (no DOM), so the rules are unit-tested. The pages call
 * `loadDaily` / `saveDaily` for the browser-side bits. Streaks live in the
 * player's own browser (localStorage): no account, cookie or server record.
 *
 * Rules (owner-approved 2026-10-01): the day resets at 00:00 UTC; no respins in
 * the daily; one scored attempt per day; missing a day resets the streak to 1;
 * challenge #1 is 2026-10-01.
 */

export const LAUNCH_DAY = '2026-10-01';
export const DAILY_STORAGE_KEY = 'bm11.daily.v1';
/** Day key of the daily draft in progress (cleared when a normal draft starts). */
export const DAILY_ACTIVE_KEY = 'bm11.daily.active';

const MS_PER_DAY = 86_400_000;

export interface DailyResult {
  user: number;
  house: number;
  draws: number;
}

export interface DailyState {
  /** Most recent day a daily was completed ('' if never). */
  lastDay: string;
  streak: number;
  best: number;
  /** Completed dailies by day key (latest 60 kept). */
  results: Record<string, DailyResult>;
}

export const emptyDaily = (): DailyState => ({ lastDay: '', streak: 0, best: 0, results: {} });

/** 'YYYY-MM-DD' for the UTC day containing `now`. */
export function utcDayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

const dayMs = (key: string) => Date.parse(`${key}T00:00:00Z`);

/** The previous day's key. */
export function previousDay(key: string): string {
  return utcDayKey(new Date(dayMs(key) - MS_PER_DAY));
}

/** Challenge number: the launch day is #1. */
export function dayNumber(key: string): number {
  return Math.round((dayMs(key) - dayMs(LAUNCH_DAY)) / MS_PER_DAY) + 1;
}

/** Milliseconds until the next 00:00 UTC. */
export function msUntilReset(now: Date = new Date()): number {
  return dayMs(utcDayKey(now)) + MS_PER_DAY - now.getTime();
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60_000));
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`;
}

export const hasPlayed = (s: DailyState, day: string): boolean => day in s.results;

/**
 * The streak to show on `today`: it is still alive if the last completed daily
 * was today or yesterday, otherwise it has lapsed to 0.
 */
export function currentStreak(s: DailyState, today: string): number {
  if (s.lastDay === today || s.lastDay === previousDay(today)) return s.streak;
  return 0;
}

/** Record a finished daily. Idempotent: a day already recorded is left alone. */
export function recordResult(s: DailyState, day: string, result: DailyResult): DailyState {
  if (hasPlayed(s, day)) return s;
  const consecutive = s.lastDay === previousDay(day);
  const streak = consecutive ? s.streak + 1 : 1;
  const keep = Object.keys(s.results).sort().slice(-59);
  const results: Record<string, DailyResult> = {};
  for (const k of keep) results[k] = s.results[k];
  results[day] = result;
  return { lastDay: day > s.lastDay ? day : s.lastDay, streak, best: Math.max(s.best, streak), results };
}

// ---------------------------------------------------------------- seeded spins

/** FNV-1a 32-bit hash of a string. */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: small seeded PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Which of the `count` spin options the daily lands on for `round` (0-based,
 * the round about to be spun). Seeded by day and round only, so every player
 * draws the same era and nation each round: the options depend on earlier
 * spins, never on who was picked.
 */
export function dailySpinIndex(day: string, round: number, count: number): number {
  if (count <= 0) return 0;
  return Math.floor(mulberry32(hashString(`bm11-daily:${day}:${round}`))() * count);
}

export interface SpinCombo {
  era: string;
  nation: string;
}

/**
 * The era×nation draws a spin can land on in `round` (0-based, the round about
 * to be spun), given the spins so far. The live rules: round 1 is Legends; a
 * spin never re-lands on a drawn era×nation pair, and a nation lands at most
 * twice per draft (relaxed only if that would leave nothing to draw).
 * /play and the daily tests share this so they can't drift apart.
 */
export function upcomingCombos(
  round: number,
  history: SpinCombo[],
  legendCombos: SpinCombo[],
  draftCombos: SpinCombo[],
): SpinCombo[] {
  const base = round === 0 ? legendCombos : draftCombos;
  const used = new Set(history.map((s) => `${s.era}|${s.nation}`));
  const counts: Record<string, number> = {};
  for (const s of history) counts[s.nation] = (counts[s.nation] || 0) + 1;
  const fresh = base.filter((c) => !used.has(`${c.era}|${c.nation}`) && (counts[c.nation] || 0) < 2);
  if (fresh.length > 0) return fresh;
  const pairFresh = base.filter((c) => !used.has(`${c.era}|${c.nation}`));
  return pairFresh.length > 0 ? pairFresh : base;
}

/**
 * Drops draws with fewer than `minPool` players from the options for the final spin (formats
 * that set DraftFormat.finalSpinMinPool). Falls back to the full list if nothing would be left.
 */
export function finalSpinOptions<T extends { count?: number }>(options: T[], round: number, minPool: number | undefined, rounds = 6): T[] {
  if (!minPool || round !== rounds - 1) return options;
  const big = options.filter((c) => (c.count ?? minPool) >= minPool);
  return big.length ? big : options;
}

/** The whole day's six spins, in order. */
export function dailySpins(day: string, legendCombos: SpinCombo[], draftCombos: SpinCombo[], rounds = 6): SpinCombo[] {
  const history: SpinCombo[] = [];
  for (let round = 0; round < rounds; round++) {
    const options = upcomingCombos(round, history, legendCombos, draftCombos);
    if (!options.length) break;
    history.push(options[dailySpinIndex(day, round, options.length)]);
  }
  return history;
}

// ---------------------------------------------------------------- sharing

export function dailyShareText(day: string, r: DailyResult, streak: number, words: { label?: string; xiNoun?: string; opponent?: string } = {}): string {
  const n = dayNumber(day);
  // A lost daily reads "went 1–4 with", never "lost to" (owner, 2026-10-02); the score is still there.
  const score = `${r.user}–${r.house}`;
  const opp = `the ${words.opponent ?? 'World XI'}`;
  const verdict = r.user === 5 ? `whitewashed ${opp} ${score}` : r.user > r.house ? `beat ${opp} ${score}` : r.user === r.house ? `drew with ${opp} ${score}` : `went ${score} with ${opp}`;
  const fire = streak > 1 ? ` 🔥${streak}` : '';
  const label = words.label ? `${words.label} ` : '';
  return `Beat My 11 ${label}Daily #${n}: my ${words.xiNoun ?? 'all-time Test XI'} ${verdict}${fire} 🏏 Same spins for everyone today. Can you do better?`;
}

/**
 * Each format has its own daily (its own spins, result and streak). `scope` is the format id;
 * the Test game ('test' or absent) keeps the original keys, so existing streaks are untouched.
 */
const scoped = (key: string, scope?: string) => (scope && scope !== 'test' ? `${key}.${scope}` : key);

// ---------------------------------------------------------------- browser storage

export function loadDaily(scope?: string): DailyState {
  try {
    const raw = JSON.parse(localStorage.getItem(scoped(DAILY_STORAGE_KEY, scope)) || 'null');
    if (raw && typeof raw === 'object' && typeof raw.streak === 'number' && raw.results && typeof raw.results === 'object') {
      return {
        lastDay: typeof raw.lastDay === 'string' ? raw.lastDay : '',
        streak: raw.streak,
        best: typeof raw.best === 'number' ? raw.best : raw.streak,
        results: raw.results,
      };
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return emptyDaily();
}

export function saveDaily(s: DailyState, scope?: string): void {
  try {
    localStorage.setItem(scoped(DAILY_STORAGE_KEY, scope), JSON.stringify(s));
  } catch {
    /* storage unavailable: the streak just won't persist */
  }
}

export function activeDailyDay(scope?: string): string | null {
  try {
    return localStorage.getItem(scoped(DAILY_ACTIVE_KEY, scope));
  } catch {
    return null;
  }
}

export function setActiveDaily(day: string | null, scope?: string): void {
  try {
    if (day) localStorage.setItem(scoped(DAILY_ACTIVE_KEY, scope), day);
    else localStorage.removeItem(scoped(DAILY_ACTIVE_KEY, scope));
  } catch {
    /* storage unavailable */
  }
}
