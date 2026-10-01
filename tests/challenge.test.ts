/**
 * Challenge-a-friend rules (src/lib/challenge.ts): spin encoding round-trips
 * and rejects tampering, scoreline comparison, and share text.
 */
import { readFileSync } from 'node:fs';
import {
  encodeSpins, decodeSpins, parseScoreline, challengeOutcome, betterOf, challengeShareText,
} from '../src/lib/challenge';
import { dailySpins, dailyShareText } from '../src/lib/daily';
import { encodeSpinsWith, decodeSpinsWith } from '../src/lib/challenge';
import { wbSpinCombos } from '../src/lib/formats/white-ball-store';
import { IPL_FORMAT, ODI_FORMAT } from '../src/lib/formats/draft-format';
import { modeFor, formatOfMode, kindOfMode } from '../src/lib/draft-slots';
import { shareResultsFor } from '../src/lib/share-results';
import { normalizePlayer, type NormalizedPlayer } from '../src/lib/player-logic';

let pass = 0, fail = 0;
const ok = (cond: boolean, name: string, extra?: unknown) => {
  if (cond) pass++;
  else { fail++; console.log(`FAIL: ${name}`, extra ?? ''); }
};

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

// ---- encode / decode
let roundTrips = 0;
for (let i = 0; i < 200; i++) {
  const day = new Date(Date.parse('2026-10-01T00:00:00Z') + i * 86_400_000).toISOString().slice(0, 10);
  const spins = dailySpins(day, legend, draft);
  const enc = encodeSpins(spins);
  const back = decodeSpins(enc, legend, draft);
  if (back && JSON.stringify(back) === JSON.stringify(spins) && /^[A-Za-z0-9.-]+$/.test(enc) && enc.length < 100) roundTrips++;
}
ok(roundTrips === 200, 'spins survive encode → decode, and the code is short and URL-safe', roundTrips);

const good = dailySpins('2026-10-01', legend, draft);
const enc = encodeSpins(good);
ok(decodeSpins(null, legend, draft) === null && decodeSpins('', legend, draft) === null, 'empty is rejected');
ok(decodeSpins(enc.split('.').slice(0, 5).join('.'), legend, draft) === null, 'five spins are rejected');
ok(decodeSpins(enc + '.legends-ENG', legend, draft) === null, 'seven spins are rejected');
ok(decodeSpins(enc.replace('legends', '1990s'), legend, draft) === null, 'round 1 must be a Legends spin');
ok(decodeSpins(enc.replace(/-[A-Z]+/, '-XXX'), legend, draft) === null, 'unknown nation is rejected');
ok(decodeSpins('<script>alert(1)</script>', legend, draft) === null, 'junk is rejected');
const parts = enc.split('.');
ok(decodeSpins([parts[0], parts[1], parts[1], parts[3], parts[4], parts[5]].join('.'), legend, draft) === null, 'a repeated pair is rejected');
ok(decodeSpins('x'.repeat(500), legend, draft) === null, 'oversized input is rejected');

// ---- scorelines
ok(JSON.stringify(parseScoreline('3-2')) === '{"user":3,"house":2}', 'parse 3-2');
ok(parseScoreline('4-4') === null && parseScoreline('6-0') === null && parseScoreline('3-2-1') === null && parseScoreline(null) === null, 'bad scorelines rejected');
ok(challengeOutcome({ user: 3, house: 2 }, { user: 4, house: 1 }) === 'beat', '4–1 beats 3–2');
ok(challengeOutcome({ user: 3, house: 2 }, { user: 3, house: 2 }) === 'matched', 'same scoreline matches');
ok(challengeOutcome({ user: 3, house: 2 }, { user: 2, house: 3 }) === 'short', '2–3 falls short of 3–2');
ok(challengeOutcome({ user: 2, house: 2 }, { user: 3, house: 2 }) === 'beat', 'a win beats a 2–2 draw');
ok(challengeOutcome({ user: 2, house: 3 }, { user: 2, house: 2 }) === 'beat', 'a draw beats a 2–3 loss');
ok(JSON.stringify(betterOf(null, { user: 1, house: 4 })) === '{"user":1,"house":4}', 'best of nothing is the first result');
ok(JSON.stringify(betterOf({ user: 3, house: 2 }, { user: 2, house: 3 })) === '{"user":3,"house":2}', 'best keeps the better result');

// ---- share text
const t = challengeShareText({ user: 3, house: 2 }, { user: 4, house: 1 }, 3);
ok(t.includes('beat your 3–2') && t.includes('4–1') && t.includes('3 tries'), 'beat text with tries', t);
ok(challengeShareText({ user: 3, house: 2 }, { user: 4, house: 1 }, 1).includes('first go'), 'first-go wording');
ok(challengeShareText({ user: 3, house: 2 }, { user: 1, house: 4 }, 2).includes('you had 3–2'), 'short text names the target');

// ---- other formats: their own spin encoding, saved-draft modes, share wording
for (const f of [IPL_FORMAT, ODI_FORMAT]) {
  const combos = wbSpinCombos(f.id as 'ipl' | 'odi');
  const codec = { eras: Object.keys(f.eraNames), teamCodes: f.teamCodes };
  const spins = dailySpins('2026-10-02', combos, combos);
  const enc = encodeSpinsWith(spins, codec);
  const dec = decodeSpinsWith(enc, codec, combos, combos);
  ok(spins.length === 6 && /^(\d[A-Z]{2,4}\.){5}\d[A-Z]{2,4}$/.test(enc), `${f.id}: six spins encode as <era index><team code>`, enc);
  ok(JSON.stringify(dec) === JSON.stringify(spins.map((c) => ({ era: c.era, nation: c.nation }))), `${f.id}: spins survive the link`, { enc, dec });
  ok(decodeSpinsWith(enc.replace(/^\d/, '9'), codec, combos, combos) === null, `${f.id}: an unknown era is rejected`);
  ok(decodeSpinsWith(`${enc.split('.')[0]}.${enc.split('.').slice(0, 5).join('.')}`, codec, combos, combos) === null, `${f.id}: a repeated draw is rejected`);
  ok(decodeSpinsWith(enc.split('.').slice(0, 5).join('.'), codec, combos, combos) === null, `${f.id}: five spins are rejected`);
}
ok(modeFor('test', 'daily') === 'daily' && modeFor('ipl', 'normal') === 'ipl' && modeFor('odi', 'challenge') === 'odi-challenge', 'saved-draft modes per format');
ok(formatOfMode('t20i-daily') === 't20i' && formatOfMode('challenge') === 'test' && kindOfMode('ipl-challenge') === 'challenge' && kindOfMode('ipl') === 'normal', 'mode → format and kind');
{
  const ipl = shareResultsFor({ opponent: 'All-Star XI', xiNoun: 'IPL XI' });
  ok(ipl.length === 7 && ipl.every((r) => !/World XI|Test XI/.test(r.title + r.challenge + r.imageHeadline)), 'IPL share pages never say World XI or Test XI', ipl.map((r) => r.title));
  const t = dailyShareText('2026-10-02', { user: 3, house: 2, draws: 0 }, 2, { label: 'IPL', xiNoun: 'IPL XI', opponent: 'All-Star XI' });
  ok(t.includes('IPL Daily #2') && t.includes('my IPL XI beat the All-Star XI 3–2') && dailyShareText('2026-10-02', { user: 3, house: 2, draws: 0 }, 1).includes('all-time Test XI beat the World XI'), 'daily share text per format', t);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
