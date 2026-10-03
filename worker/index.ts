/**
 * Worker entry: serves the static site (ASSETS) and a tiny anonymous
 * telemetry API. Only /api/* runs this code (see run_worker_first in
 * wrangler.jsonc); everything else goes straight to the static assets.
 *
 *   POST /api/scores  { xi, userScore, houseScore, user, house, draws }
 *       one finished series, for recalibrating the series bands.
 *   POST /api/events  { name }   name ∈ EVENT_NAMES, counted per day.
 *   GET  /api/health  { ok: true }   "is the Worker up?" (no database call).
 *
 * Guards: POSTs only from the two site origins, JSON bodies of at most MAX_BODY bytes (an
 * oversized Content-Length is refused before the body is read), strict validation of every
 * field, and a rate limit on writes (2026-10-03): at most 120 a minute from one network address,
 * counted by Cloudflare's rate-limiting binding (API_LIMIT in wrangler.jsonc). The address is
 * only the counter's key inside Cloudflare for up to a minute; the site never stores it.
 *
 * Nothing identifying is stored: no IP, cookie, user agent or account.
 */

interface D1Result { run(): Promise<unknown> }
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
    } catch {
      return json(500);
    }
    return json(404);
  },
};
