/**
 * player-review-sheet.mjs — writes docs/reports/player-review-sheet.csv, one row per ODI, T20I and
 * IPL player, for the owner to check roles and spin/pace in a spreadsheet (2026-10-03).
 *
 * Only data the project already holds is shown: nothing is guessed. The "hint" column is a flag to
 * help the owner look in the right places first; it never changes a role. The owner types
 * corrections into the three "YOUR ..." columns; a later script reads them into
 * scripts/cricsheet/owner-overrides.json (it does not exist yet).
 *
 * The sheet lists only the doubtful players (groups 1 to 3) with 25 or more matches, in few columns
 * (owner's choice, 2026-10-03: "option A"). Run: node scripts/cricsheet/player-review-sheet.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const MIN_MATCHES = { odi: 10, t20i: 10, ipl: 10 };
const FORMAT_LABEL = { odi: 'ODI', t20i: 'T20I', ipl: 'IPL' };
const BAT_THRESHOLD = { odi: 25, t20i: 18, ipl: 18 };
const BATTING_ROLES = new Set(['opener', 'middle-order', 'wicketkeeper']);
const BOWLING_ROLES = new Set(['spinner', 'fast-bowler']);

const load = (f) => {
  const d = JSON.parse(readFileSync(`src/data/formats/${f}.json`, 'utf8'));
  return Array.isArray(d) ? d : d.players;
};

// The regular bowlers the game leaves out because their spin/pace is unknown (a generated report).
const leftOut = [];
for (const line of readFileSync('docs/reports/white-ball-roles-needed.md', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\| (odi|t20i|ipl) \| (.+?) \| (.*?) \| (\d+) \| (\d+) \| ([0-9a-f]+) \|/);
  // Owner, 2026-10-03: players with fewer than 10 matches are not listed at all.
  if (m && Number(m[4]) >= MIN_MATCHES[m[1]]) leftOut.push({ format: m[1], name: m[2], teams: m[3], matches: Number(m[4]), wickets: Number(m[5]), id: m[6] });
}

// The three decisions the owner has already given (checklist item 9, 2026-10-03), filled in so they
// are not lost; the owner can change them.
const GIVEN = {
  'Shahid Afridi': { role: 'all-rounder', bowling: '', note: 'you said: all-rounder' },
  'Heath Streak': { role: 'all-rounder', bowling: 'pace', note: 'you said: all-rounder, also a fast bowler' },
  'Saim Ayub': { role: '', bowling: '', note: 'you said: not a pacer (please give spin, or no bowling type)' },
};

const rows = [];
for (const f of ['odi', 't20i', 'ipl']) {
  for (const p of load(f)) {
    const s = p.stats ?? {};
    const matches = s.matches ?? 0;
    if (matches < MIN_MATCHES[f]) continue;
    const teams = f === 'ipl' ? (p.iplTeams ?? []).join(', ') : p.nation ?? '';
    const careerStart = Array.isArray(s.officialCareer) ? s.officialCareer[0] : null;
    const notInGame = f === 'ipl' && p.overseas == null ? 'not in the game: country unknown' : '';
    let priority = 5;
    let hint = '';
    if (p.roleSource === 'owner' || p.bowlingTypeSource === 'owner') { priority = 6; hint = 'already your decision'; }
    else {
      const wpm = matches ? (s.wickets ?? 0) / matches : 0;
      if (BATTING_ROLES.has(p.primaryRole) && (s.wickets ?? 0) >= 25 && wpm >= 0.4) { priority = 2; hint = 'takes many wickets but is listed as a batter'; }
      else if (BOWLING_ROLES.has(p.primaryRole) && (s.battingAverage ?? 0) >= BAT_THRESHOLD[f] && (s.innings ?? 0) >= 15) { priority = 2; hint = 'bats well but is listed as a bowler'; }
      else if (f === 'odi' && careerStart && careerStart < 2003) { priority = 3; hint = 'career started before 2003, so the match data for his role is thin'; }
      else if (p.roleSource === 'kaggle' || p.roleSource === 'wikidata') { priority = 4; hint = `role comes from ${p.roleSource}, not from his matches`; }
    }
    rows.push({
      priority, format: f, name: p.name, teams, matches,
      runs: s.runs ?? '', avg: s.battingAverage ?? '', sr: s.strikeRate ?? '', wickets: s.wickets ?? '', econ: s.economy ?? '',
      bowlAvg: s.bowlingAverage ?? '', bowlSr: s.ballsPerWicket ?? '',
      role: p.primaryRole, other: (p.secondaryRoles ?? []).join(' / '), roleSource: p.roleSource ?? '',
      bowling: p.bowlingType ?? '', bowlingSource: p.bowlingTypeSource ?? '',
      hint: [hint, notInGame].filter(Boolean).join('; '),
      given: GIVEN[p.name] ?? null,
    });
  }
}
for (const l of leftOut) {
  rows.push({
    priority: 1, format: l.format, name: l.name, teams: l.teams, matches: l.matches, runs: '', avg: '', sr: '', wickets: l.wickets, econ: '', bowlAvg: '', bowlSr: '',
    role: '(left out)', other: '', roleSource: '', bowling: '(unknown)', bowlingSource: '', hint: 'LEFT OUT OF THE GAME: spin or pace needed',
  });
}
const order = { odi: 0, t20i: 1, ipl: 2 };
rows.sort((a, b) => a.priority - b.priority || order[a.format] - order[b.format] || b.matches - a.matches);

const PRIORITY = { 1: '1 Left out of the game', 2: '2 Check the role', 3: '3 Older ODI career', 4: '4 Weaker source', 5: '5 No flag', 6: '6 Your earlier decision' };

// Option A (owner, 2026-10-03): only the players the data flags as doubtful (groups 1 to 3) who have
// played 25 or more matches. Few columns: who, how many matches, the batting numbers together, the
// bowling numbers together, the role the game has now, and room for the owner's answer.
const SHEET_MIN_MATCHES = 25;
const picked = rows.filter((r) => r.priority <= 3 && r.matches >= SHEET_MIN_MATCHES);
const head = ['Format', 'Player', 'Matches',
  'Runs', 'Bat avg', 'Bat strike rate',
  'Wickets', 'Bowl avg', 'Economy', 'Bowl strike rate',
  'Role in the game now', 'YOUR ROLE', 'YOUR BOWLING TYPE'];
const cell = (v) => { const t = String(v ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
const lines = [head.join(',')];
for (const r of picked) {
  lines.push([FORMAT_LABEL[r.format], r.name, r.matches, r.runs, r.avg, r.sr, r.wickets, r.bowlAvg, r.econ, r.bowlSr,
    r.role, r.given?.role ?? '', r.given?.bowling ?? ''].map(cell).join(','));
}
// UTF-8 with a byte order mark so Excel reads names with accents correctly.
writeFileSync('docs/reports/player-review-sheet.csv', String.fromCharCode(0xfeff) + lines.join(String.fromCharCode(13, 10)) + String.fromCharCode(13, 10));
const by = {};
for (const r of picked) by[r.priority] = (by[r.priority] ?? 0) + 1;
console.log(`rows: ${picked.length} of ${rows.length}`, Object.entries(by).map(([k, v]) => `${PRIORITY[k]}: ${v}`).join(' | '));
