/**
 * Tests for the share links (src/lib/share-results.ts).
 */
import { SHARE_RESULTS, encodeXI, decodeXI, type SharedPick } from '../src/lib/share-results';
import { OUTCOME_BANDS } from '../src/lib/series';

const OUTCOME_SLUGS = OUTCOME_BANDS.map((b) => `${b.user}-${b.house}`);

let pass = 0, fail = 0;
const ok = (cond: boolean, name: string, extra?: unknown) => {
  if (cond) pass++;
  else { fail++; console.log(`FAIL: ${name}`, extra ?? ''); }
};

ok(SHARE_RESULTS.length === 7, 'one share result per scoreline');
ok(SHARE_RESULTS.map((r) => r.slug).join() === OUTCOME_SLUGS.join(), 'slugs follow the outcome bands');

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
