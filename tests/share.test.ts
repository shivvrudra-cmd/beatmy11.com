/**
 * Tests for the share links (src/lib/share-results.ts).
 */
import { SHARE_RESULTS, shareResultsFor, shareTextFor, encodeXI, decodeXI, type SharedPick } from '../src/lib/share-results';
import { dailyShareText } from '../src/lib/daily';
import { OUTCOME_BANDS } from '../src/lib/series';

const OUTCOME_SLUGS = OUTCOME_BANDS.map((b) => `${b.user}-${b.house}`);

let pass = 0, fail = 0;
const ok = (cond: boolean, name: string, extra?: unknown) => {
  if (cond) pass++;
  else { fail++; console.log(`FAIL: ${name}`, extra ?? ''); }
};

ok(SHARE_RESULTS.length === 7, 'one share result per scoreline');
ok(SHARE_RESULTS.map((r) => r.slug).join() === OUTCOME_SLUGS.join(), 'slugs follow the outcome bands');

// A lost series is never worded "I lost" (owner, 2026-10-02), in any format, anywhere it is shared.
const FORMAT_WORDS = [
  { opponent: 'World XI', xiNoun: 'all-time Test XI', matchNoun: 'Test' },
  { opponent: 'World XI', xiNoun: 'ODI XI', matchNoun: 'ODI' },
  { opponent: 'World XI', xiNoun: 'T20I XI', matchNoun: 'T20I' },
  { opponent: 'All-Star XI', xiNoun: 'IPL XI', matchNoun: 'match' },
];
for (const w of FORMAT_WORDS) {
  const results = shareResultsFor(w);
  for (const r of results) {
    const all = [r.imageHeadline, r.title, r.challenge, shareTextFor(r.user, r.house, w), dailyShareText('2026-10-02', r, 1, w)].join(' | ');
    ok(!/\b(lost|lose|beaten|beat me)\b/i.test([r.imageHeadline, r.title, shareTextFor(r.user, r.house, w), dailyShareText('2026-10-02', r, 1, w)].join(' | ')), `${w.xiNoun} ${r.slug}: no "lost" in what the player sends`, all);
    ok(all.includes(w.opponent) && !(w.opponent !== 'World XI' && all.includes('World XI')), `${w.xiNoun} ${r.slug}: names this format's opponent`, all);
    // Truthful: the message and the title always carry the real scoreline.
    const score = `${r.user}–${r.house}`;
    ok(shareTextFor(r.user, r.house, w).includes(score) && dailyShareText('2026-10-02', r, 1, w).includes(score), `${w.xiNoun} ${r.slug}: the scoreline is in the message`);
    ok(r.title.includes(score), `${w.xiNoun} ${r.slug}: the scoreline is in the link title`, r.title);
  }
  const close = results.find((r) => r.slug === '2-3')!;
  ok(close.imageHeadline === `I took the ${w.opponent} to the decider`, `${w.xiNoun}: 2–3 headline`, close.imageHeadline);
  ok(close.title.includes(`fifth ${w.matchNoun}`) && shareTextFor(2, 3, w).includes(`fifth ${w.matchNoun}`), `${w.xiNoun}: 2–3 names the fifth ${w.matchNoun}`, close.title);
  for (const slug of ['1-4', '0-5']) ok(results.find((r) => r.slug === slug)!.imageHeadline === `Can you beat the ${w.opponent}?`, `${w.xiNoun}: ${slug} headline is the dare`);
}

const xi: SharedPick[] = [
  { id: 'jack-hobbs', role: 'opener' },
  { id: 'sunil-gavaskar', role: 'opener' },
  { id: 'don-bradman', role: 'middle-order' },
  { id: 'sachin-tendulkar', role: 'middle-order' },
  { id: 'brian-lara', role: 'middle-order' },
  { id: 'garfield-sobers', role: 'all-rounder' },
  { id: 'adam-gilchrist', role: 'wicketkeeper' },
  { id: 'shane-warne', role: 'spinner' },
  { id: 'malcolm-marshall', role: 'fast-bowler' },
  { id: 'glenn-mcgrath', role: 'fast-bowler' },
  { id: 'dale-steyn', role: 'fast-bowler' },
];
const known = new Set(xi.map((p) => p.id));
const has = (id: string) => known.has(id);
const enc = encodeXI(xi);

ok(JSON.stringify(decodeXI(enc, has)) === JSON.stringify(xi), 'encode → decode round-trips', enc);
ok(enc.length < 200, 'link stays short', enc.length);
ok(decodeXI(null, has) === null, 'no param → null');
ok(decodeXI(encodeXI(xi.slice(0, 10)), has) === null, 'ten picks rejected');
ok(decodeXI(enc.replace('don-bradman', 'not-a-player'), has) === null, 'unknown id rejected');
ok(decodeXI(enc.replace('don-bradman.b', 'don-bradman.x'), has) === null, 'unknown role rejected');
ok(decodeXI(enc.replace('don-bradman', '<b>hi</b>'), () => true) === null, 'markup rejected even if "known"');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
