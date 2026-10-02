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
  ok(health.status === 200 && (await health.json()).ok === true, 'GET /api/health answers ok');
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

  // ---- daily leaderboard (migration 0002; a small in-memory stand-in for the table)
  {
    type Row = { day: string; format: string; player: string; xi: string; score: number; u: number; h: number; d: number; name: string | null; at: number };
    const rows: Row[] = [];
    let clock = 0;
    const db = {
      prepare: (sql: string) => ({
        bind: (...v: any[]) => ({
          run: async () => {
            if (!sql.startsWith('INSERT OR IGNORE INTO daily_scores')) return;
            if (!rows.some((r) => r.day === v[0] && r.format === v[1] && r.player === v[2])) rows.push({ day: v[0], format: v[1], player: v[2], xi: v[3], score: v[4], u: v[5], h: v[6], d: v[7], name: v[8], at: clock++ });
          },
          all: async () => ({
            results: rows.filter((r) => r.day === v[0] && r.format === v[1]).sort((a, b) => b.score - a.score || a.at - b.at).slice(0, v[2])
              .map((r) => ({ name: r.name, score: r.score, series_user: r.u, series_house: r.h })),
          }),
          first: async () => {
            const day = rows.filter((r) => r.day === v[0] && r.format === v[1]);
            return sql.includes('AS above') ? { above: day.filter((r) => r.score > v[2]).length } : { total: day.length, beat: day.filter((r) => r.u > r.h).length };
          },
        }),
      }),
    };
    const denv = { ...env, DB: db };
    const day = new Date().toISOString().slice(0, 10);
    const id = (n: number) => n.toString(16).padStart(32, '0');
    const send = (b: Record<string, unknown>, origin: string | null = 'https://beatmy11.com') =>
      worker.fetch(new Request('https://beatmy11.com/api/daily', { method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify(b) }), denv);
    const entry = { format: 'test', player: id(1), xi: '0123abcd', score: 81.26, user: 3, house: 2, draws: 0, name: ' <b>Asha</b> 🏏 ' };
    ok((await send(entry)).status === 204 && rows.length === 1, 'a daily result is stored');
    ok(rows[0].day === day && rows[0].score === 81.3 && rows[0].name === 'bAshab', 'the server sets the day, rounds the score and cleans the name', rows[0]);
    ok((await send({ ...entry, score: 99 })).status === 204 && rows.length === 1 && rows[0].score === 81.3, 'one entry per browser per day per format: the first counts');
    ok((await send({ ...entry, format: 'ipl' })).status === 204 && rows.length === 2, 'another format is a separate board');
    ok((await send(entry, 'https://evil.example')).status === 403, 'other sites cannot post');
    const badDaily = [{ ...entry, format: 'hundred' }, { ...entry, player: 'me' }, { ...entry, player: 'G'.repeat(32) }, { ...entry, score: 100.1 }, { ...entry, score: -1 }, { ...entry, xi: 'zz' }, { ...entry, user: 4 }];
    let refusedDaily = 0;
    for (const b of badDaily) if ((await send(b)).status === 400) refusedDaily++;
    ok(refusedDaily === badDaily.length && rows.length === 2, 'malformed daily results are refused', refusedDaily);
    await send({ ...entry, player: id(2), score: 90, name: '' });
    await send({ ...entry, player: id(3), score: 70, user: 1, house: 4, name: 'x'.repeat(40) });
    await send({ ...entry, player: id(4), score: 81.3, user: 2, house: 3, name: 'Later' });
    const get = (path: string) => worker.fetch(new Request(`https://beatmy11.com${path}`), denv);
    const res = await get(`/api/daily/test/${day}`);
    const board = await res.json() as { total: number; beat: number; entries: { rank: number; name: string; score: number }[]; rank?: number };
    ok(res.status === 200 && res.headers.get('cache-control') === 'public, max-age=60', 'the board is readable and cached for a minute');
    ok(board.total === 4 && board.beat === 2, 'total entries and how many won their series', board);
    ok(board.entries.map((e) => e.score).join() === '90,81.3,81.3,70' && board.entries[1].name === 'bAshab' && board.entries[2].name === 'Later', 'best score first; equal scores in order of arrival', board.entries);
    ok(board.entries[0].name === '' && board.entries[3].name.length === 20, 'no name = anonymous; long names are cut to 20');
    ok(!JSON.stringify(board).includes(id(1)) && !JSON.stringify(board).includes('0123abcd'), 'the board never shows browser ids or XI fingerprints');
    ok(((await (await get(`/api/daily/test/${day}?score=75`)).json()) as { rank: number }).rank === 4, 'a score outside the list gets its rank');
    ok((await get('/api/daily/test/2099-01-01')).status === 404 && (await get('/api/daily/test/2026-09-30')).status === 404 && (await get('/api/daily/hundred/2026-10-01')).status === 404 && (await get('/api/daily/test/not-a-day')).status === 404, 'future days, days before launch and unknown formats: 404');
    ok(((await (await get(`/api/daily/odi/${day}`)).json()) as { total: number }).total === 0, 'an empty board is an empty list, not an error');
  }

  // a database failure never leaks details
  const broken = { ...env, DB: { prepare: () => ({ bind: () => ({ run: async () => { throw new Error('D1 down: secret detail'); } }) }) } };
  const res = await worker.fetch(new Request('https://beatmy11.com/api/events', { method: 'POST', headers: { origin: 'https://beatmy11.com' }, body: JSON.stringify({ name: 'shared' }) }), broken);
  ok(res.status === 500 && !(await res.text()).includes('secret'), 'a database error returns a bare 500');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();
