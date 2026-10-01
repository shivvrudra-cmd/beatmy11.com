/**
 * Daily Challenge rules (src/lib/daily.ts): day maths, streaks, seeded spins,
 * and a guarantee that every upcoming day's spins can be drafted into a valid
 * XI (the daily has no respins, so an undraftable day would hurt everyone).
 */
import { readFileSync } from 'node:fs';
import {
  LAUNCH_DAY, utcDayKey, previousDay, dayNumber, msUntilReset, formatCountdown, emptyDaily,
  recordResult, currentStreak, hasPlayed, dailySpinIndex, dailySpins, upcomingCombos, dailyShareText,
  type DailyResult,
} from '../src/lib/daily';
import {
  createDraft, countsOf, reachableShapes, normalizePlayer, playerGroups, XI_SHAPES, XI_ROLES,
  type NormalizedPlayer, type XiRole, type XiCounts,
} from '../src/lib/player-logic';

let pass = 0, fail = 0;
const ok = (cond: boolean, name: string, extra?: unknown) => {
  if (cond) pass++;
  else { fail++; console.log(`FAIL: ${name}`, extra ?? ''); }
};
const win: DailyResult = { user: 3, house: 2, draws: 0 };

// ---- day maths
ok(utcDayKey(new Date('2026-10-01T23:59:59Z')) === '2026-10-01', 'utc day key, late evening');
ok(utcDayKey(new Date('2026-10-02T00:00:00Z')) === '2026-10-02', 'utc day key, midnight');
ok(previousDay('2026-03-01') === '2026-02-28', 'previous day across month');
ok(previousDay('2027-01-01') === '2026-12-31', 'previous day across year');
ok(dayNumber(LAUNCH_DAY) === 1, 'launch day is #1');
ok(dayNumber('2026-10-12') === 12, 'day number counts days');
ok(msUntilReset(new Date('2026-10-01T23:00:00Z')) === 3_600_000, 'reset countdown');
ok(formatCountdown(3_600_000 + 5 * 60_000) === '1h 05m', 'countdown format');

// ---- streaks
let s = emptyDaily();
ok(currentStreak(s, '2026-10-01') === 0 && !hasPlayed(s, '2026-10-01'), 'fresh state');
s = recordResult(s, '2026-10-01', win);
ok(s.streak === 1 && s.best === 1 && hasPlayed(s, '2026-10-01'), 'first daily starts streak at 1');
const again = recordResult(s, '2026-10-01', { user: 5, house: 0, draws: 0 });
ok(again === s, 'a day already played is never rescored');
s = recordResult(s, '2026-10-02', win);
s = recordResult(s, '2026-10-03', win);
ok(s.streak === 3 && s.best === 3, 'consecutive days extend the streak');
ok(currentStreak(s, '2026-10-04') === 3, 'streak still alive the day after');
ok(currentStreak(s, '2026-10-05') === 0, 'streak lapses after a missed day');
s = recordResult(s, '2026-10-06', win);
ok(s.streak === 1 && s.best === 3, 'missed day resets streak, best is kept');
let m = emptyDaily();
for (const d of ['2026-02-27', '2026-02-28', '2026-03-01']) m = recordResult(m, d, win);
ok(m.streak === 3, 'streak crosses a month boundary');
let big = emptyDaily();
let d = '2026-10-01';
for (let i = 0; i < 100; i++) {
  big = recordResult(big, d, win);
  d = utcDayKey(new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000));
}
ok(Object.keys(big.results).length <= 60 && big.streak === 100, 'history is capped, streak is not');

// ---- seeded spins
ok(dailySpinIndex('2026-10-01', 2, 10) === dailySpinIndex('2026-10-01', 2, 10), 'same day+round, same index');
ok(dailySpinIndex('2026-10-01', 0, 0) === 0, 'no options is safe');
let inRange = true;
for (let r = 0; r < 6; r++) for (const n of [1, 2, 7, 59]) {
  const i = dailySpinIndex('2026-10-05', r, n);
  if (!(i >= 0 && i < n && Number.isInteger(i))) inRange = false;
}
ok(inRange, 'index is always a valid option');

// ---- real data + combos (same rules as player-store)
const ERAS = ['legends', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];
const byEra: Record<string, NormalizedPlayer[]> = {};
for (const era of ERAS) {
  byEra[era] = JSON.parse(readFileSync(`${process.cwd()}/src/data/${era}.json`, 'utf8')).map((p: any) => normalizePlayer(p, era));
}
function spinCombos(eras: string[]) {
  const combos: { era: string; nation: string }[] = [];
  for (const eraId of eras) {
    const nations = new Set<string>();
    for (const p of byEra[eraId]) {
      const erasOf = Array.isArray(p.era) ? p.era : [p.era];
      if (erasOf.includes(eraId)) nations.add(p.nation);
    }
    for (const nation of nations) combos.push({ era: eraId, nation });
  }
  return combos;
}
const legend = spinCombos(['legends']);
const draft = spinCombos(ERAS.filter((e) => e !== 'legends'));
function poolFor(era: string, nation: string): NormalizedPlayer[] {
  const out: NormalizedPlayer[] = [];
  const seen = new Set<string>();
  for (const f of ERAS) for (const p of byEra[f]) {
    const eras = Array.isArray(p.era) ? p.era : [p.era];
    if (!eras.includes(era) || p.nation !== nation || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

const a = dailySpins('2026-10-01', legend, draft);
const b = dailySpins('2026-10-01', legend, draft);
ok(a.length === 6 && JSON.stringify(a) === JSON.stringify(b), 'same date gives the same six spins');
ok(a[0].era === 'legends' && a.slice(1).every((c) => c.era !== 'legends'), 'round 1 is Legends, the rest are not');
ok(new Set(a.map((c) => `${c.era}|${c.nation}`)).size === 6, 'no era×nation pair repeats');
const counts: Record<string, number> = {};
for (const c of a) counts[c.nation] = (counts[c.nation] || 0) + 1;
ok(Object.values(counts).every((n) => n <= 2), 'a nation lands at most twice');
const distinct = new Set<string>();
for (let i = 0; i < 60; i++) {
  const day = utcDayKey(new Date(Date.parse('2026-10-01T00:00:00Z') + i * 86_400_000));
  distinct.add(JSON.stringify(dailySpins(day, legend, draft)));
}
ok(distinct.size > 55, 'different days give different spins', distinct.size);
ok(upcomingCombos(0, [], legend, draft).every((c) => c.era === 'legends'), 'upcomingCombos: round 1 pool is Legends');

// ---- every upcoming day is draftable (oracle: backtracking over role counts)
const ROUND_LIMITS = [1, 2, 2, 2, 2, 2];
const shapeMax: XiCounts = countsOf(createDraft());
for (const sh of XI_SHAPES) for (const r of XI_ROLES) shapeMax[r] = Math.max(shapeMax[r], sh[r]);
const shapeMatch = (c: XiCounts) => XI_SHAPES.some((sh) => XI_ROLES.every((r) => c[r] === sh[r]));
function achievable(pools: NormalizedPlayer[][]): boolean {
  const memo = new Set<string>();
  const key = (c: XiCounts) => XI_ROLES.map((r) => c[r]).join(',');
  function dfs(round: number, idx: number, total: number, counts: XiCounts, picked: string[]): boolean {
    if (total === 11) return shapeMatch(counts);
    if (round >= 6) return false;
    if (idx >= ROUND_LIMITS[round]) return dfs(round + 1, 0, total, counts, picked);
    const k = `${round}:${idx}:${key(counts)}:${[...picked].sort().join(',')}`;
    if (memo.has(k)) return false;
    const taken = new Set(picked);
    for (const p of pools[round]) {
      if (taken.has(p.id)) continue;
      for (const role of playerGroups(p) as XiRole[]) {
        if (counts[role] + 1 > shapeMax[role]) continue;
        const c2 = { ...counts, [role]: counts[role] + 1 };
        if (reachableShapes(c2).length === 0) continue;
        if (dfs(round, idx + 1, total + 1, c2, [...picked, p.id])) return true;
      }
    }
    memo.add(k);
    return false;
  }
  return dfs(0, 0, 0, countsOf(createDraft()), []);
}
const DAYS = 400;
const bad: string[] = [];
for (let i = 0; i < DAYS; i++) {
  const day = utcDayKey(new Date(Date.parse(`${LAUNCH_DAY}T00:00:00Z`) + i * 86_400_000));
  const spins = dailySpins(day, legend, draft);
  if (!achievable(spins.map((c) => poolFor(c.era, c.nation)))) bad.push(day);
}
console.log(`undraftable days in the next ${DAYS}: ${bad.length}${bad.length ? ' → ' + bad.slice(0, 10).join(', ') : ''}`);
ok(bad.length === 0, 'every daily for the next 400 days can be drafted into a valid XI', bad.slice(0, 10));

// ---- share text
const t = dailyShareText('2026-10-12', win, 5);
ok(t.includes('#12') && t.includes('3–2') && t.includes('🔥5') && t.includes('beat'), 'share text', t);
ok(!dailyShareText('2026-10-12', win, 1).includes('🔥'), 'no flame for a 1-day streak');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
