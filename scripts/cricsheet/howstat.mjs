/**
 * howstat.mjs — reads the owner's HowSTAT career tables (data-raw/howstat/<format>-<nation>.csv,
 * converted from their Excel exports by howstat-import.py) and pairs the rows with our players.
 * Pure functions: no files are written here.
 */
import { norm, sameIdentity } from './names.mjs';

/** Parse one HowSTAT table (comma or tab separated; quoted fields allowed). */
export function parseHowstat(text) {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split(/\r?\n/)[0] ?? '';
  const sep = firstLine.includes('\t') ? '\t' : ',';
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (q) {
      if (ch === '"' && clean[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(field.trim()); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(field.trim()); field = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field.trim()); if (row.some((c) => c !== '')) rows.push(row); }
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9/]/g, ''));
  const col = (...names) => names.map((n) => head.indexOf(n)).find((i) => i >= 0) ?? -1;
  const idx = {
    name: col('name'), knownAs: col('knownas'), born: col('born'), career: col('career'),
    matches: col('matches', 'mat'), innings: col('inns', 'innings'), runs: col('runs'), hundreds: col('100s'),
    highest: col('hs'), battingAverage: col('batavg'), wickets: col('wkts'), fourW: col('4w'),
    bowlingAverage: col('bowlavg'), economy: col('e/r', 'er'), best: col('best'),
  };
  if (idx.name < 0 || idx.matches < 0) throw new Error(`HowSTAT file: could not find the Name and Matches columns (saw: ${rows[0].join(' | ')})`);
  // Blank, "-" and similar mean "no value" (e.g. no bowling average): null, never 0.
  const numOrNull = (v) => { const x = Number(String(v ?? '').replace(/[,*]/g, '')); return v === undefined || String(v).trim() === '' || !Number.isFinite(x) ? null : x; };
  const at = (r, i) => (i >= 0 ? r[i] : undefined);
  return rows.slice(1).map((r) => {
    const career = String(at(r, idx.career) ?? '');
    const years = career.match(/(\d{4})(?:\D+(\d{4}))?/);
    return {
      // A trailing "*" marks a current player.
      name: String(at(r, idx.name) ?? '').replace(/\*+$/, '').trim(),
      knownAs: String(at(r, idx.knownAs) ?? '').replace(/\*+$/, '').trim(),
      active: /\*\s*$/.test(String(at(r, idx.name) ?? '')) || /\d{4}\s*-\s*$/.test(career),
      born: at(r, idx.born) ?? '',
      careerFrom: years ? Number(years[1]) : null,
      // "2008-2019" ends in 2019; "2012" is a one-year career; "2008-" is still going (no end).
      careerTo: years && years[2] ? Number(years[2]) : years && !/\d{4}\s*-\s*$/.test(career) ? Number(years[1]) : null,
      matches: numOrNull(at(r, idx.matches)),
      innings: numOrNull(at(r, idx.innings)),
      runs: numOrNull(at(r, idx.runs)),
      hundreds: numOrNull(at(r, idx.hundreds)),
      highest: numOrNull(String(at(r, idx.highest) ?? '').replace('*', '')),
      battingAverage: numOrNull(at(r, idx.battingAverage)),
      wickets: numOrNull(at(r, idx.wickets)),
      fourW: numOrNull(at(r, idx.fourW)),
      bowlingAverage: numOrNull(at(r, idx.bowlingAverage)),
      economy: numOrNull(at(r, idx.economy)),
    };
  }).filter((p) => p.name);
}

/**
 * Pair HowSTAT rows with our players of one nation. In order of certainty:
 *   1. HowSTAT "Name" equals the Cricsheet scorecard name ("H H Pandya" = "HH Pandya");
 *   2. HowSTAT "Known As" equals our display name;
 *   3. same surname with a shared initial, one-to-one in both directions.
 * Each HowSTAT row is used once. Anything less certain stays unmatched.
 *
 * `compatible(player, row)` is a hard guard applied at every step: a row can only be paired with
 * a player it could really belong to (see careerFits). Without it, namesakes pair up: "Iftikhar
 * Ahmed" (2015-) took "Ijaz Ahmed" (1986-2000), and "Irfan Khan" took "Imran Khan".
 */
export function matchHowstat(rows, players, compatible = () => true) {
  rows = [...rows];
  const allRows = rows;
  const rowsFor = (p) => allRows.filter((h) => compatible(p, h));
  const pairs = [];
  const usedRow = new Set(), usedPlayer = new Set();
  const take = (p, h) => { pairs.push({ ours: p, theirs: h }); usedRow.add(h); usedPlayer.add(p); };
  const unique = (list) => (list.length === 1 ? list[0] : null);
  // Exact keys first: [their key, our key].
  const exact = [
    [(h) => norm(h.name), (p) => norm(p.scorecardName)],
    [(h) => norm(h.knownAs), (p) => norm(p.name)],
  ];
  for (const [theirKey, ourKey] of exact) {
    for (const p of players) {
      if (usedPlayer.has(p)) continue;
      const k = ourKey(p);
      if (!k) continue;
      const h = unique(rowsFor(p).filter((r) => !usedRow.has(r) && theirKey(r) === k));
      // ...and no other unpaired player of ours shares that key
      if (h && players.filter((o) => !usedPlayer.has(o) && ourKey(o) === k && compatible(o, h)).length === 1) take(p, h);
    }
  }
  const names = (h) => [h.knownAs, h.name].filter(Boolean);
  const fits = (h, p) => names(h).some((n) => sameIdentity(p.scorecardName, n) || sameIdentity(p.name, n));
  for (const p of players) {
    if (usedPlayer.has(p)) continue;
    const hs = rowsFor(p).filter((h) => !usedRow.has(h) && fits(h, p));
    if (hs.length === 1 && players.filter((o) => !usedPlayer.has(o) && fits(hs[0], o) && compatible(o, hs[0])).length === 1) take(p, hs[0]);
  }
  return { pairs, unmatchedOurs: players.filter((p) => !usedPlayer.has(p)), unmatchedTheirs: rows.filter((h) => !usedRow.has(h)) };
}

/** Split one CSV/TSV line (quoted fields allowed). */
function splitLine(l) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',' || ch === '\t') { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}
const numOrNull = (v) => { const x = Number(String(v ?? '').replace(/[,*]/g, '')); return String(v ?? '').trim() === '' || !Number.isFinite(x) ? null : x; };

/**
 * Shared reader for HowSTAT's all-countries tables. `columns` maps our field names to the
 * possible header spellings. Handles a header row that sits one column left of the data (the rank
 * column has no heading): the player name is the first non-numeric cell of a row, which gives the
 * shift. A trailing "*" on a name marks a current player; "Sri Lanka/ACC Asian XI" is Sri Lanka.
 */
function parseAllCountriesTable(text, columns, label) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (!lines.length) return [];
  const head = splitLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9/]/g, ''));
  const idx = {};
  for (const [k, names] of Object.entries(columns)) idx[k] = names.map((n) => head.indexOf(n)).find((i) => i >= 0) ?? -1;
  if (idx.name < 0 || idx.country < 0) throw new Error(`${label}: could not find the Player and Country columns (saw: ${lines[0]})`);
  const body = lines.slice(1).map(splitLine);
  const firstName = body.length ? body[0].findIndex((c) => c !== '' && numOrNull(c) === null) : idx.name;
  const shift = firstName >= 0 ? firstName - idx.name : 0;
  if (shift !== 0) for (const k of Object.keys(idx)) if (idx[k] >= 0) idx[k] += shift;
  return body.map((r) => {
    const row = { name: String(r[idx.name] ?? '').replace(/\*+$/, '').trim(), knownAs: '', country: String(r[idx.country] ?? '').split('/')[0].trim() };
    for (const k of Object.keys(columns)) if (k !== 'name' && k !== 'country') row[k] = idx[k] >= 0 ? numOrNull(r[idx[k]]) : null;
    return row;
  }).filter((p) => p.name);
}

/**
 * HowSTAT's "Batsman Strike Rates" table (batters with 1000+ runs): Player, Country, Mat, Inns,
 * NO, Runs, HS, 100s, 50s, Avg, S/R. FULL career totals (ICC World XI / Asia XI matches
 * included) with the official strike rate.
 */
export function parseStrikeRates(text) {
  const rows = parseAllCountriesTable(text, {
    name: ['player', 'name'], country: ['country'], matches: ['mat', 'matches'], innings: ['inns'], notOuts: ['no'],
    runs: ['runs'], highest: ['hs'], hundreds: ['100s'], fifties: ['50s'], battingAverage: ['avg', 'batavg'], strikeRate: ['s/r', 'sr'],
  }, 'Strike-rate file');
  if (rows.length && rows.every((r) => r.strikeRate === null)) throw new Error('Strike-rate file: no S/R column found');
  return rows;
}

/**
 * HowSTAT's "Players with 100+ wickets" table (50+ for T20I): Player, Country, Mat, Balls, Runs, Wkts, BBI, 4w,
 * Avg, S/R, E/R (plus wicket breakdowns that are not used). FULL career bowling totals with the
 * official bowling strike rate (balls per wicket) and economy.
 */
export function parseBowlingTable(text) {
  const rows = parseAllCountriesTable(text, {
    name: ['player', 'name'], country: ['country'], matches: ['mat', 'matches'], ballsBowled: ['balls'], runsConceded: ['runs'],
    wickets: ['wkts'], fourW: ['4w'], bowlingAverage: ['avg', 'bowlavg'], ballsPerWicket: ['s/r', 'sr'], economy: ['e/r', 'er'],
  }, 'Bowling file');
  if (rows.length && rows.every((r) => r.wickets === null)) throw new Error('Bowling file: no Wkts column found');
  return rows;
}

/**
 * Could this official record belong to a player seen in the match files from `firstYear` to
 * `lastYear`? His matches must fall inside the record's career years (one year of slack at the
 * end, because the match files can be newer than the table), and the record cannot have fewer
 * runs than the match files already show for him.
 */
export function careerFits(player, row) {
  if (row.careerFrom != null && player.firstYear != null && player.firstYear < row.careerFrom) return false;
  if (row.careerTo != null && player.lastYear != null && player.lastYear > row.careerTo + 1) return false;
  return true;
}
