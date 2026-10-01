/**
 * Telemetry names: every event the pages can send is on the Worker's allow-list, and nothing else is.
 */
import { readFileSync } from 'node:fs';
import { EVENT_FORMATS } from '../src/lib/telemetry';

let pass = 0, fail = 0;
const ok = (cond: boolean, name: string, extra?: unknown) => {
  if (cond) pass++;
  else { fail++; console.log(`FAIL: ${name}`, extra ?? ''); }
};

// The Worker's list, rebuilt the way worker/index.ts builds it (the file itself is not importable here).
const src = readFileSync(`${process.cwd()}/worker/index.ts`, 'utf8');
const base: string[] = JSON.parse(/const BASE_EVENTS = (\[[^\]]+\]);/.exec(src)![1].replace(/'/g, '"'));
const allowed = new Set([...base, ...['odi', 't20i', 'ipl'].flatMap((f) => base.filter((e) => e !== 'view_home').map((e) => `${e}_${f}`))]);
ok(src.includes("['odi', 't20i', 'ipl'].flatMap((f) => BASE_EVENTS.filter((e) => e !== 'view_home')"), 'the Worker builds its list the way this test expects');

const client = readFileSync(`${process.cwd()}/src/lib/telemetry.ts`, 'utf8');
const names = [...client.matchAll(/\| '([a-z_]+)'/g)].map((m) => m[1]).concat(['shared']);
ok(names.length >= 12 && names.every((n) => allowed.has(n)), 'every client event name is allowed by the Worker', names.filter((n) => !allowed.has(n)));
ok(EVENT_FORMATS.every((f) => allowed.has(`view_play_${f}`) && allowed.has(`daily_completed_${f}`) && allowed.has(`pick_played_${f}`)), 'per-format names are allowed');
ok(!allowed.has('view_home_ipl') && !allowed.has('view_play_test') && allowed.size === 12 + 3 * 11, 'nothing extra is allowed', allowed.size);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
