/**
 * The Worker's API guards (worker/index.ts), run against a stand-in database: only the two site
 * origins may post, bodies are small and strictly validated, and /api/health answers.
 */
import worker from '../worker/index';

let pass = 0, fail = 0;
const ok = (cond: boolean, name: string, extra?: unknown) => {
  if (cond) pass++;
  else { fail++; console.log(`FAIL: ${name}`, extra ?? ''); }
};

async function main() {
  const writes: unknown[][] = [];
  const env = {
    ASSETS: { fetch: async () => new Response('static', { status: 200 }) },
    DB: { prepare: (_sql: string) => ({ bind: (...v: unknown[]) => ({ run: async () => { writes.push(v); } }) }) },
  };
  const call = (path: string, init: RequestInit = {}) => worker.fetch(new Request(`https://beatmy11.com${path}`, init), env);
  const post = (path: string, body: unknown, origin: string | null = 'https://beatmy11.com', headers: Record<string, string> = {}) =>
    call(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}), ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  const score = { xi: '0123abcd', userScore: 81.2, houseScore: 89.4, user: 2, house: 3, draws: 0 };

  // health
  const health = await call('/api/health');
  { const h = await health.json(); ok(health.status === 200 && h.ok === true && h.limiter === false, 'GET /api/health answers ok and says whether the rate limiter is attached', h); }
  ok(health.headers.get('cache-control') === 'no-store' && health.headers.get('x-content-type-options') === 'nosniff', 'API answers are never cached or sniffed');
  ok((await call('/api/health', { method: 'POST', headers: { origin: 'https://beatmy11.com' } })).status === 405, 'health is read-only');
  ok(writes.length === 0, 'health does not touch the database');

  // pages are not the Worker's business
  ok((await (await call('/play')).text()) === 'static', 'everything outside /api goes to the static site');

  // origin and method
  ok((await call('/api/events')).status === 405, 'GET on a write endpoint is refused');
  ok((await post('/api/events', { name: 'shared' }, null)).status === 403, 'no Origin: refused');
  ok((await post('/api/events', { name: 'shared' }, 'https://evil.example')).status === 403, 'another site: refused');
  ok((await post('/api/events', { name: 'shared' }, 'https://www.beatmy11.com')).status === 204, 'www origin accepted');

  // size and shape
  ok((await post('/api/events', { name: 'shared' }, 'https://beatmy11.com', { 'content-length': '5000' })).status === 413, 'an oversized Content-Length is refused before reading');
  ok((await post('/api/events', JSON.stringify({ name: 'shared', pad: 'x'.repeat(2000) }))).status === 400, 'an oversized body is refused');
  ok((await post('/api/events', 'not json')).status === 400 && (await post('/api/events', '"text"')).status === 400, 'only JSON objects');
  ok((await post('/api/events', { name: 'made_up' })).status === 400 && (await post('/api/events', { name: 'view_home_ipl' })).status === 400, 'unknown event names are refused');
  ok((await post('/api/events', { name: 'view_play_ipl' })).status === 204, 'a per-format event is counted');

  // scores
  const before = writes.length;
  ok((await post('/api/scores', score)).status === 204 && writes.length === before + 1, 'a valid score is stored');
  const bad = [
    { ...score, xi: 'not-hex' }, { ...score, xi: '0123abcd0' }, { ...score, userScore: 101 }, { ...score, houseScore: -1 },
    { ...score, userScore: '81' }, { ...score, user: 3 }, { ...score, user: 2.5 }, { ...score, draws: 6 }, { xi: score.xi },
  ];
  let refused = 0;
  for (const b of bad) if ((await post('/api/scores', b)).status === 400) refused++;
  ok(refused === bad.length && writes.length === before + 1, 'malformed scores are refused and never stored', refused);
  ok(writes[before].length === 6 && !writes.flat().some((v) => typeof v === 'string' && /\d+\.\d+\.\d+\.\d+|Mozilla/.test(v)), 'only the six score fields are stored: no IP, no user agent');
  ok((await post('/api/nothing', {})).status === 404, 'unknown API path: 404');

  // ---- rate limit (Cloudflare binding; a stand-in that allows three writes per address)
  {
    const seen = new Map<string, number>();
    const limited = {
      ...env,
      API_LIMIT: { limit: async ({ key }: { key: string }) => { const n = (seen.get(key) ?? 0) + 1; seen.set(key, n); return { success: n <= 3 }; } },
    };
    const hit = (ip: string) => worker.fetch(new Request('https://beatmy11.com/api/events', {
      method: 'POST', headers: { origin: 'https://beatmy11.com', 'cf-connecting-ip': ip, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'shared' }),
    }), limited);
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await hit('203.0.113.7')).status);
    ok(codes.join() === '204,204,204,429,429', 'writes beyond the limit from one address get 429', codes);
    ok((await hit('198.51.100.2')).status === 204, 'another address is not affected');
    ok([...seen.keys()].every((k) => k.startsWith('w:')), 'the counter key is the address, held by Cloudflare only');
    const health = await worker.fetch(new Request('https://beatmy11.com/api/health'), limited);
    ok(health.status === 200 && !seen.has('w:unknown'), 'reading /api/health is not counted');
    const failing = { ...env, API_LIMIT: { limit: async () => { throw new Error('binding down'); } } };
    const r = await worker.fetch(new Request('https://beatmy11.com/api/events', { method: 'POST', headers: { origin: 'https://beatmy11.com' }, body: JSON.stringify({ name: 'shared' }) }), failing);
    ok(r.status === 204, 'if the limiter fails, the request still goes through');
  }

  // a database failure never leaks details
  const broken = { ...env, DB: { prepare: () => ({ bind: () => ({ run: async () => { throw new Error('D1 down: secret detail'); } }) }) } };
  const res = await worker.fetch(new Request('https://beatmy11.com/api/events', { method: 'POST', headers: { origin: 'https://beatmy11.com' }, body: JSON.stringify({ name: 'shared' }) }), broken);
  ok(res.status === 500 && !(await res.text()).includes('secret'), 'a database error returns a bare 500');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();
