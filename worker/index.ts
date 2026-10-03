/**
 * Worker entry: serves the static site (ASSETS) and a tiny anonymous
 * telemetry API. Only /api/* runs this code (see run_worker_first in
 * wrangler.jsonc); everything else goes straight to the static assets.
 *
 *   POST /api/scores  { xi, userScore, houseScore, user, house, draws }
 *       one finished series, for recalibrating the series bands.
 *   POST /api/events  { name }   name ∈ EVENT_NAMES, counted per day.
 *   GET  /api/health  { ok: true }   "is the Worker up?" (no database call).
 *   POST /api/daily   one Daily Challenge result for the leaderboard   } docs/plans/daily-leaderboard.md;
 *   GET  /api/daily/<format>/<day>   that day's top scores             } needs migration 0002 (owner applies).
 *
 * Guards: POSTs only from the two site origins, JSON bodies of at most MAX_BODY bytes (an
 * oversized Content-Length is refused before the body is read), strict validation of every
 * field, and a rate limit on writes (2026-10-03): at most 120 a minute from one network address,
 * counted by Cloudflare's rate-limiting binding (API_LIMIT in wrangler.jsonc). The address is
 * only the counter's key inside Cloudflare for up to a minute; the site never stores it.
 *
 * Nothing identifying is stored: no IP, cookie, user agent or account.
 */

interface D1Result {
  run(): Promise<unknown>;
  all?<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first?<T = Record<string, unknown>>(): Promise<T | null>;
}
interface D1Statement { bind(...v: unknown[]): D1Result }
interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> };
  DB: { prepare(sql: string): D1Statement };
  /** Cloudflare rate-limiting binding (wrangler.jsonc). Absent in tests and local dev. */
  API_LIMIT?: { limit(o: { key: string }): Promise<{ success: boolean }> };
}

const ALLOWED_ORIGINS = new Set(['https://beatmy11.com', 'https://www.beatmy11.com']);
const BASE_EVENTS = ['shared', 'view_home', 'view_play', 'view_result', 'view_shared', 'daily_started', 'daily_completed', 'challenge_started', 'challenge_completed', 'view_pick', 'pick_sent', 'pick_played'];
// ODI, T20I and IPL count under the same names with the format appended, e.g. "view_play_ipl"
// (src/lib/telemetry.ts). The home page is one page, so it has no per-format counter.
const EVENT_NAMES = new Set([
  ...BASE_EVENTS,
  ...['odi', 't20i', 'ipl'].flatMap((f) => BASE_EVENTS.filter((e) => e !== 'view_home').map((e) => `${e}_${f}`)),
]);
const MAX_BODY = 1024;

const json = (status: number, body: unknown = {}) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });

const isInt = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const isScore = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  const text = await req.text();
  if (text.length > MAX_BODY) return null;
  try {
    const body = JSON.parse(text);
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
}

async function postScore(body: Record<string, unknown>, env: Env): Promise<Response> {
  const { xi, userScore, houseScore, user, house, draws } = body;
  if (
    typeof xi !== 'string' || !/^[0-9a-f]{8}$/.test(xi) ||
    !isScore(userScore) || !isScore(houseScore) ||
    !isInt(user, 0, 5) || !isInt(house, 0, 5) || !isInt(draws, 0, 5) ||
    user + house + draws !== 5
  ) return json(400, { error: 'invalid' });

  await env.DB
    .prepare(
      'INSERT OR IGNORE INTO drafts (xi_hash, user_score, house_score, series_user, series_house, draws) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(xi, userScore, houseScore, user, house, draws)
    .run();
  return json(204);
}

// ---------------------------------------------------------------- daily leaderboard
// docs/plans/daily-leaderboard.md. Needs migrations/0002_daily_scores.sql, which the owner
// applies. Until then these endpoints answer 500 (no such table) and nothing on the site calls them.
const DAILY_FORMATS = new Set(['test', 'odi', 't20i', 'ipl']);
/** Daily Challenge #1 (src/lib/daily.ts LAUNCH_DAY). */
const DAILY_LAUNCH = '2026-10-01';
const BOARD_SIZE = 50;
const today = () => new Date().toISOString().slice(0, 10);
/** Letters, digits, spaces and . ' - only; at most 20 characters ('' = anonymous). */
const cleanName = (raw: unknown) =>
  typeof raw === 'string' ? raw.replace(/[^\p{L}\p{N} .'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20) : '';

async function postDaily(body: Record<string, unknown>, env: Env): Promise<Response> {
  const { format, player, xi, score, user, house, draws } = body;
  if (
    typeof format !== 'string' || !DAILY_FORMATS.has(format) ||
    typeof player !== 'string' || !/^[0-9a-f]{32}$/.test(player) ||
    typeof xi !== 'string' || !/^[0-9a-f]{8}$/.test(xi) ||
    !isScore(score) ||
    !isInt(user, 0, 5) || !isInt(house, 0, 5) || !isInt(draws, 0, 5) || user + house + draws !== 5
  ) return json(400, { error: 'invalid' });
  // The day is the server's: a browser cannot post into yesterday or tomorrow. The first result
  // a browser sends for a day and format is the one that counts.
  await env.DB
    .prepare('INSERT OR IGNORE INTO daily_scores (day, format, player, xi_hash, score, series_user, series_house, draws, name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(today(), format, player, xi, Math.round(score * 10) / 10, user, house, draws, cleanName(body.name) || null)
    .run();
  return json(204);
}

async function getDaily(url: URL, env: Env): Promise<Response> {
  const m = /^\/api\/daily\/([a-z0-9]+)\/(\d{4}-\d{2}-\d{2})$/.exec(url.pathname);
  if (!m || !DAILY_FORMATS.has(m[1])) return json(404);
  const [, format, day] = m;
  if (Number.isNaN(Date.parse(`${day}T00:00:00Z`)) || day < DAILY_LAUNCH || day > today()) return json(404);
  const top = await env.DB
    .prepare('SELECT name, score, series_user, series_house FROM daily_scores WHERE day = ? AND format = ? ORDER BY score DESC, created_at ASC LIMIT ?')
    .bind(day, format, BOARD_SIZE).all!<{ name: string | null; score: number; series_user: number; series_house: number }>();
  const totals = await env.DB
    .prepare('SELECT COUNT(*) AS total, SUM(CASE WHEN series_user > series_house THEN 1 ELSE 0 END) AS beat FROM daily_scores WHERE day = ? AND format = ?')
    .bind(day, format).first!<{ total: number; beat: number | null }>();
  const out: Record<string, unknown> = {
    day, format, total: totals?.total ?? 0, beat: totals?.beat ?? 0,
    entries: top.results.map((r, i) => ({ rank: i + 1, name: r.name ?? '', score: r.score, user: r.series_user, house: r.series_house })),
  };
  // ?score=81.4: where that score stands (for a player outside the top 50).
  const raw = url.searchParams.get('score');
  if (raw !== null && /^\d{1,3}(\.\d)?$/.test(raw) && Number(raw) <= 100) {
    const above = await env.DB
      .prepare('SELECT COUNT(*) AS above FROM daily_scores WHERE day = ? AND format = ? AND score > ?')
      .bind(day, format, Number(raw)).first!<{ above: number }>();
    out.rank = (above?.above ?? 0) + 1;
  }
  return new Response(JSON.stringify(out), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60', 'x-content-type-options': 'nosniff' },
  });
}

async function postEvent(body: Record<string, unknown>, env: Env): Promise<Response> {
  const { name } = body;
  if (typeof name !== 'string' || !EVENT_NAMES.has(name)) return json(400, { error: 'invalid' });
  const day = new Date().toISOString().slice(0, 10);
  await env.DB
    .prepare('INSERT INTO events (day, name, count) VALUES (?, ?, 1) ON CONFLICT (day, name) DO UPDATE SET count = count + 1')
    .bind(day, name)
    .run();
  return json(204);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(req);

    if (pathname === '/api/health') return req.method === 'GET' || req.method === 'HEAD' ? json(200, { ok: true, limiter: !!env.API_LIMIT }) : json(405);
    if (req.method === 'GET' && pathname.startsWith('/api/daily/')) {
      try { return await getDaily(new URL(req.url), env); } catch { return json(500); }
    }
    if (req.method !== 'POST') return json(405);
    // Too many writes from one address in the last minute: refuse. If the binding is missing (local
    // tests) or fails, the request goes through: telemetry must never break the game.
    if (env.API_LIMIT) {
      try {
        const { success } = await env.API_LIMIT.limit({ key: `w:${req.headers.get('cf-connecting-ip') ?? 'unknown'}` });
        if (!success) return json(429, { error: 'slow down' });
      } catch { /* fail open */ }
    }
    // Browsers always send Origin on cross-origin POSTs; reject other sites.
    const origin = req.headers.get('origin');
    if (!origin || !ALLOWED_ORIGINS.has(origin)) return json(403);

    // Refuse an oversized body before reading it.
    const declared = Number(req.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_BODY) return json(413, { error: 'too large' });
    const body = await readBody(req);
    if (!body) return json(400, { error: 'invalid' });
    try {
      if (pathname === '/api/scores') return await postScore(body, env);
      if (pathname === '/api/events') return await postEvent(body, env);
      if (pathname === '/api/daily') return await postDaily(body, env);
    } catch {
      return json(500);
    }
    return json(404);
  },
};
