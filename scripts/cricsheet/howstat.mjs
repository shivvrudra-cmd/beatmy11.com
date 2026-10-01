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
      name: at(r, idx.name) ?? '',
      knownAs: at(r, idx.knownAs) ?? '',
      born: at(r, idx.born) ?? '',
      careerFrom: years ? Number(years[1]) : null,
      careerTo: years && years[2] ? Number(years[2]) : years ? Number(years[1]) : null,
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
 */
export function matchHowstat(rows, players) {
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
      const h = unique(rows.filter((r) => !usedRow.has(r) && theirKey(r) === k));
      // ...and no other unpaired player of ours shares that key
      if (h && players.filter((o) => !usedPlayer.has(o) && ourKey(o) === k).length === 1) take(p, h);
    }
  }
  const names = (h) => [h.knownAs, h.name].filter(Boolean);
  const fits = (h, p) => names(h).some((n) => sameIdentity(p.scorecardName, n) || sameIdentity(p.name, n));
  for (const p of players) {
    if (usedPlayer.has(p)) continue;
    const hs = rows.filter((h) => !usedRow.has(h) && fits(h, p));
    if (hs.length === 1 && players.filter((o) => !usedPlayer.has(o) && fits(hs[0], o)).length === 1) take(p, hs[0]);
  }
  return { pairs, unmatchedOurs: players.filter((p) => !usedPlayer.has(p)), unmatchedTheirs: rows.filter((h) => !usedRow.has(h)) };
}

/**
 * Parse HowSTAT's "Batsman Strike Rates" table (all countries, batters with 1000+ runs):
 * Player, Country, Mat, Inns, NO, Runs, HS, 100s, 50s, Avg, S/R. These are FULL career totals
 * (they include ICC World XI / Asia XI matches) with the official strike rate.
 * A trailing "*" on a name marks a current player and is dropped.
 */
export function parseStrikeRates(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (!lines.length) return [];
  const split = (l) => {
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
  };
  const head = split(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9/]/g, ''));
  const col = (...names) => names.map((n) => head.indexOf(n)).find((i) => i >= 0) ?? -1;
  const idx = { name: col('player', 'name'), country: col('country'), matches: col('mat', 'matches'), innings: col('inns'), notOuts: col('no'),
    runs: col('runs'), highest: col('hs'), hundreds: col('100s'), fifties: col('50s'), battingAverage: col('avg', 'batavg'), strikeRate: col('s/r', 'sr') };
  if (idx.name < 0 || idx.strikeRate < 0 || idx.country < 0) throw new Error(`Strike-rate file: could not find Player, Country and S/R columns (saw: ${lines[0]})`);
  const num = (v) => { const x = Number(String(v ?? '').replace(/[,*]/g, '')); return String(v ?? '').trim() === '' || !Number.isFinite(x) ? null : x; };
  // Some exports have the header one column to the left of the data (the rank column has no
  // heading and the header row starts at "Player"). The player name is the first cell of a row
  // that is not a number, so its position tells us the shift to apply to every column.
  const body = lines.slice(1).map(split);
  const firstName = body.length ? body[0].findIndex((c) => c !== '' && num(c) === null) : idx.name;
  const shift = firstName >= 0 ? firstName - idx.name : 0;
  if (shift !== 0) for (const k of Object.keys(idx)) if (idx[k] >= 0) idx[k] += shift;
  return body.map((r) => ({
    name: String(r[idx.name] ?? '').replace(/\*+$/, '').trim(),
    knownAs: '',
    country: r[idx.country] ?? '',
    matches: num(r[idx.matches]), innings: num(r[idx.innings]), notOuts: num(r[idx.notOuts]), runs: num(r[idx.runs]),
    highest: num(r[idx.highest]), hundreds: num(r[idx.hundreds]), fifties: num(r[idx.fifties]),
    battingAverage: num(r[idx.battingAverage]), strikeRate: num(r[idx.strikeRate]),
  })).filter((p) => p.name);
}
