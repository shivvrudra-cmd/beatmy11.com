/**
 * build-white-ball.mjs — builds ODI, T20I and IPL player data from Cricsheet match files.
 *
 * Plan and owner decisions: docs/plans/white-ball-formats.md.
 *
 * Owner-supplied facts: scripts/cricsheet/owner-overrides.json (spin/pace, names; source 'owner').
 * Inputs (downloaded into data-raw/, which is gitignored; see scripts/cricsheet/README.md):
 *   data-raw/cricsheet/{odis_male,t20s_male,ipl}/*.json   Cricsheet match files (ODC-By licence)
 *   data-raw/cricsheet/people.csv, names.csv               Cricsheet register (ids, full names)
 *   data-raw/cricsheet/wikidata_cricketers.csv             Wikidata bowling styles (CC0)
 *   data-raw/kaggle/players_data_with_all_info.csv         Kaggle "Cricket Players Dataset" (CC0)
 *   src/data/*.json                                        the owner's Test data (roles)
 *
 * Outputs:
 *   src/data/formats/{odi,t20i,ipl}.json
 *   docs/reports/white-ball-data-report.md
 *   docs/reports/white-ball-roles-needed.md
 *
 * Every stat is counted from the ball-by-ball files. Nothing is estimated or typed in; anything
 * that cannot be counted is null and reported. Run: node scripts/cricsheet/build-white-ball.mjs
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { norm, sameIdentity } from './names.mjs';
import { parseHowstat, parseStrikeRates, matchHowstat } from './howstat.mjs';

export { norm, sameIdentity };

const ROOT = process.cwd();
export const ODI_FIRST_SEEN_CUTOFF = '2004-01-01';
const RAW = join(ROOT, 'data-raw');

// The game's nations (the Test game's ten). Afghanistan is withheld by Cricsheet.
export const NATIONS = [
  'Australia', 'Bangladesh', 'England', 'India', 'New Zealand',
  'Pakistan', 'South Africa', 'Sri Lanka', 'West Indies', 'Zimbabwe',
];

// IPL: renamed franchises are one team (owner, 2026-10-01); defunct teams stay separate.
export const IPL_FRANCHISE = {
  'Delhi Daredevils': 'Delhi Capitals',
  'Kings XI Punjab': 'Punjab Kings',
  'Royal Challengers Bangalore': 'Royal Challengers Bengaluru',
  'Rising Pune Supergiants': 'Rising Pune Supergiant',
};
export const IPL_BLOCKS = [
  { id: '2008-12', from: 2008, to: 2012 },
  { id: '2013-17', from: 2013, to: 2017 },
  { id: '2018-22', from: 2018, to: 2022 },
  { id: '2023+', from: 2023, to: 9999 },
];

// Format definitions. `quota` = a bowler's maximum legal balls in one innings.
const FORMATS = [
  { id: 'odi', dir: 'odis_male', matchType: 'ODI', quota: 60, intl: true },
  { id: 't20i', dir: 't20s_male', matchType: 'T20', quota: 24, intl: true },
  { id: 'ipl', dir: 'ipl', matchType: 'T20', quota: 24, intl: false },
];

// Dismissals credited to the bowler.
const BOWLER_WICKETS = new Set(['bowled', 'caught', 'caught and bowled', 'lbw', 'stumped', 'hit wicket']);
// Ways an innings ends without the batter being out.
const NOT_OUT_KINDS = new Set(['retired hurt', 'retired not out']);

// ------------------------------------------------------------------ helpers
function readCsv(path) {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
const round = (v, d = 2) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const decade = (year) => `${Math.floor(year / 10) * 10}s`;

// ------------------------------------------------------------------ count one format
export function aggregate(matches, fmt) {
  const P = new Map(); // cricsheet id -> accumulator
  const get = (id, name) => {
    if (!P.has(id)) {
      P.set(id, {
        id, scoreName: name, names: new Set([name]), teams: new Map(), years: new Set(), blocks: new Set(), firstDate: null, lastDate: null,
        matches: 0, innings: 0, runs: 0, ballsFaced: 0, outs: 0, fifties: 0, hundreds: 0, highest: 0,
        positions: [], ballsBowled: 0, runsConceded: 0, wickets: 0, fourPlusInnings: 0, fiveWInnings: 0,
        catches: 0, stumpings: 0, keptMatches: 0,
      });
    }
    return P.get(id);
  };

  for (const m of matches) {
    const info = m.info;
    const reg = info.registry.people;
    const date = info.dates[0];
    const year = Number(date.slice(0, 4));
    for (const [team, players] of Object.entries(info.players)) {
      const t = fmt.intl ? team : IPL_FRANCHISE[team] ?? team;
      for (const name of players) {
        const p = get(reg[name], name);
        p.names.add(name);
        p.matches += 1;
        p.teams.set(t, (p.teams.get(t) ?? 0) + 1);
        p.years.add(year);
        if (!fmt.intl) {
          const b = IPL_BLOCKS.find((x) => year >= x.from && year <= x.to);
          p.blocks.add(`${t}|${b.id}`);
        }
        if (!p.firstDate || date < p.firstDate) p.firstDate = date;
        if (!p.lastDate || date > p.lastDate) p.lastDate = date;
      }
    }

    for (const inn of m.innings ?? []) {
      if (inn.super_over) continue; // super overs are not part of career records
      const order = []; // batting arrival order
      const arrive = (n) => { if (!order.includes(n)) order.push(n); };
      const batRuns = new Map();
      const outThisInnings = new Set();
      const bowlerW = new Map();
      for (const over of inn.overs ?? []) {
        for (const d of over.deliveries) {
          arrive(d.batter);
          arrive(d.non_striker);
          const ex = d.extras ?? {};
          const wide = 'wides' in ex;
          const noball = 'noballs' in ex;
          // batting
          batRuns.set(d.batter, (batRuns.get(d.batter) ?? 0) + d.runs.batter);
          if (!wide) get(reg[d.batter], d.batter).ballsFaced += 1;
          // bowling
          const bw = get(reg[d.bowler], d.bowler);
          if (!wide && !noball) bw.ballsBowled += 1;
          bw.runsConceded += d.runs.batter + (ex.wides ?? 0) + (ex.noballs ?? 0);
          for (const w of d.wickets ?? []) {
            arrive(w.player_out);
            if (!NOT_OUT_KINDS.has(w.kind)) outThisInnings.add(w.player_out);
            if (BOWLER_WICKETS.has(w.kind)) {
              bw.wickets += 1;
              bowlerW.set(d.bowler, (bowlerW.get(d.bowler) ?? 0) + 1);
            }
            if (w.kind === 'caught and bowled') bw.catches += 1;
            for (const f of w.fielders ?? []) {
              if (f.substitute || !f.name) continue;
              const fp = reg[f.name] ? get(reg[f.name], f.name) : null;
              if (!fp) continue;
              if (w.kind === 'caught') fp.catches += 1;
              if (w.kind === 'stumped') fp.stumpings += 1;
            }
          }
        }
      }
      order.forEach((name, i) => {
        if (!reg[name]) return;
        const p = get(reg[name], name);
        const r = batRuns.get(name) ?? 0;
        p.innings += 1;
        p.runs += r;
        p.positions.push(i + 1);
        if (outThisInnings.has(name)) p.outs += 1;
        if (r >= 100) p.hundreds += 1;
        else if (r >= 50) p.fifties += 1;
        if (r > p.highest) p.highest = r;
      });
      for (const [name, w] of bowlerW) {
        const p = get(reg[name], name);
        if (w >= 4) p.fourPlusInnings += 1;
        if (w >= 5) p.fiveWInnings += 1;
      }
    }
  }
  return P;
}

// ------------------------------------------------------------------ derived stats
export function careerStats(p, fmt) {
  const avg = p.outs > 0 ? p.runs / p.outs : null;
  return {
    matches: p.matches,
    innings: p.innings,
    runs: p.runs,
    notOuts: p.innings - p.outs,
    highest: p.highest,
    battingAverage: round(avg),
    strikeRate: p.ballsFaced > 0 ? round((p.runs / p.ballsFaced) * 100) : null,
    ballsFaced: p.ballsFaced,
    fifties: p.fifties,
    hundreds: p.hundreds,
    ballsBowled: p.ballsBowled,
    runsConceded: p.runsConceded,
    wickets: p.wickets,
    bowlingAverage: p.wickets > 0 ? round(p.runsConceded / p.wickets) : null,
    economy: p.ballsBowled > 0 ? round((p.runsConceded / p.ballsBowled) * 6) : null,
    ballsPerWicket: p.wickets > 0 ? round(p.ballsBowled / p.wickets, 1) : null,
    fourWicketInnings: p.fourPlusInnings,
    fiveWicketInnings: p.fiveWInnings,
    catches: p.catches,
    stumpings: p.stumpings,
    dismissals: p.catches + p.stumpings,
    // Rates measured on the ball-by-ball matches. They stay valid when the totals above are
    // replaced by official career totals that include matches Cricsheet does not have.
    fiftyRate: p.matches > 0 ? round((p.fifties + p.hundreds) / p.matches, 4) : null,
    fourWicketRate: p.matches > 0 ? round(p.fourPlusInnings / p.matches, 4) : null,
    dismissalsPerMatch: p.matches > 0 ? round((p.catches + p.stumpings) / p.matches, 4) : null,
  };
}

/**
 * Official career totals from the owner's HowSTAT tables replace the Cricsheet counts they cover
 * (matches, innings, runs, hundreds, highest, averages, wickets, economy, 4-wicket innings), so
 * matches Cricsheet withholds or lacks are included. What HowSTAT's list does not have stays on
 * Cricsheet: strike rate, fifties and fielding, kept as rates so they are not understated.
 * A "-" in HowSTAT (no average) stays null.
 */
export function withOfficialTotals(stats, h) {
  const out = { ...stats, statsSource: 'howstat', cricsheetMatches: stats.matches };
  const set = (k, v) => { if (v !== null && v !== undefined) out[k] = v; };
  set('matches', h.matches);
  set('innings', h.innings);
  set('runs', h.runs);
  set('hundreds', h.hundreds);
  set('highest', h.highest);
  // HowSTAT prints 0 for "no average" as well as for a real 0, so a 0 falls back to the
  // ball-by-ball figure, which knows whether the player was ever dismissed.
  out.battingAverage = h.battingAverage ? h.battingAverage : stats.battingAverage;
  if (h.innings !== null && h.runs !== null && h.battingAverage) out.notOuts = Math.max(0, h.innings - Math.round(h.runs / h.battingAverage));
  set('wickets', h.wickets);
  out.bowlingAverage = h.wickets ? h.bowlingAverage : null;
  if (h.economy !== null) out.economy = h.economy;
  set('fourWicketInnings', h.fourW);
  if (h.wickets && h.bowlingAverage) {
    out.runsConceded = Math.round(h.bowlingAverage * h.wickets);
    if (h.economy) {
      out.ballsBowled = Math.round((out.runsConceded / h.economy) * 6);
      out.ballsPerWicket = round((h.bowlingAverage / h.economy) * 6, 1);
    }
  } else if (h.wickets === 0) {
    out.ballsPerWicket = null;
  }
  if (h.matches && h.fourW !== null) out.fourWicketRate = round(h.fourW / h.matches, 4);
  return out;
}

/**
 * Official full-career BATTING line from HowSTAT's strike-rate table (batters with 1000+ runs):
 * matches, innings, not outs, runs, highest, hundreds, fifties, average and the official strike
 * rate. It replaces the batting numbers (the per-country table's and Cricsheet's); bowling and
 * fielding are untouched.
 */
export function withOfficialBatting(stats, b) {
  const out = { ...stats, battingSource: 'howstat-strike-rates', cricsheetMatches: stats.cricsheetMatches ?? stats.matches };
  for (const k of ['matches', 'innings', 'notOuts', 'runs', 'highest', 'hundreds', 'fifties', 'battingAverage', 'strikeRate']) {
    if (b[k] !== null && b[k] !== undefined) out[k] = b[k];
  }
  if (b.matches && b.fifties !== null && b.hundreds !== null) out.fiftyRate = round((b.fifties + b.hundreds) / b.matches, 4);
  // Bowling and fielding rates were measured per the earlier match count; keep them per match.
  if (stats.matches && out.matches !== stats.matches && stats.statsSource === 'howstat' && stats.fourWicketInnings !== null) {
    out.fourWicketRate = round(stats.fourWicketInnings / out.matches, 4);
  }
  return out;
}

// ------------------------------------------------------------------ main
function main() {
  const people = new Map(readCsv(join(RAW, 'cricsheet/people.csv')).map((r) => [r.identifier, r]));
  // Every known spelling of a player: register names + match-file names. The display name is
  // the fullest one ("Shakib Al Hasan" over "S Al Hasan", "Chris Gayle" over "CH Gayle").
  const nameVariants = new Map();
  const addName = (id, n) => { if (!n) return; if (!nameVariants.has(id)) nameVariants.set(id, new Set()); nameVariants.get(id).add(n); };
  for (const r of readCsv(join(RAW, 'cricsheet/names.csv'))) addName(r.identifier, r.name);
  for (const r of people.values()) { addName(r.identifier, r.name); addName(r.identifier, r.unique_name.replace(/\s*\(\d+\)$/, '')); }
  const nameScore = (n) => {
    const words = n.split(/\s+/);
    const initials = words.filter((w) => /^[A-Z]{1,3}$/.test(w)).length; // "MS", "CH", "S"
    // A full name has 2+ words and no initials; a lone surname ("Chakravarthy") ranks low.
    return (initials === 0 && words.length >= 2 ? 1000 : 0) + (words.length >= 2 ? 200 : 0) + (words[0].length > 2 ? 100 : 0) + n.length;
  };
  // Cricsheet's alternate names contain errors: Pat Cummins's id ("PJ Cummins") also lists
  // "Anderson Cummins", who is a different registered player ("AC Cummins"). So an alias that does
  // not fit this player's own register name is dropped when it fits ANOTHER registered player.
  // Aliases that fit nobody else are kept: "PWH de Silva" really is "Wanindu Hasaranga".
  const registerBySurname = new Map();
  for (const r of people.values()) {
    const k = norm(r.name.trim().split(/\s+/).slice(-1)[0]);
    if (!registerBySurname.has(k)) registerBySurname.set(k, []);
    registerBySurname.get(k).push(r);
  }
  const trustedAlias = (id, canonical, v) => {
    if (sameIdentity(canonical, v)) return true;
    const sameSurname = registerBySurname.get(norm(v.trim().split(/\s+/).slice(-1)[0])) ?? [];
    return !sameSurname.some((r) => r.identifier !== id && sameIdentity(r.name, v));
  };
  const bestName = (id, extra) => {
    const canonical = people.get(id)?.name ?? [...extra][0];
    const all = new Set([...(nameVariants.get(id) ?? []), ...extra]);
    const ok = [...all].filter((v) => trustedAlias(id, canonical, v));
    return (ok.length ? ok : [canonical]).sort((a, b) => nameScore(b) - nameScore(a))[0];
  };

  // Owner's Test data: name+nation -> role (best source).
  const testByKey = new Map();
  for (const f of readdirSync(join(ROOT, 'src/data'))) {
    if (!f.endsWith('.json') || f === 'series-calibration.json') continue;
    for (const p of JSON.parse(readFileSync(join(ROOT, 'src/data', f), 'utf8'))) {
      testByKey.set(`${norm(p.name)}|${p.nation}`, p);
    }
  }
  // Kaggle profiles: fullname+country and initial+surname+country (unique only).
  const kaggle = readCsv(join(RAW, 'kaggle/players_data_with_all_info.csv')).filter((r) => r.gender === 'm');
  const kgFull = new Map(), kgInit = new Map();
  const addIdx = (map, key, r) => map.set(key, map.has(key) ? 'AMBIGUOUS' : r);
  for (const r of kaggle) {
    addIdx(kgFull, `${norm(r.fullname)}|${r.country_name}`, r);
    if (r.firstname && r.lastname) addIdx(kgInit, `${norm(r.firstname)[0]}${norm(r.lastname)}|${r.country_name}`, r);
  }
  // Wikidata bowling style by Cricinfo id.
  const wd = new Map();
  for (const r of readCsv(join(RAW, 'cricsheet/wikidata_cricketers.csv'))) if (r.styleLabel) wd.set(r.ci, r.styleLabel);

  // Facts the owner supplied (spin/pace, display names), keyed by Cricsheet id. Highest priority.
  const overrides = JSON.parse(readFileSync(join(ROOT, 'scripts/cricsheet/owner-overrides.json'), 'utf8'));
  const report = { formats: {}, rolesNeeded: [], ambiguous: [] };
  // Resolved from ODI/T20I (same Cricsheet id): nation and bowling type, reused for IPL players.
  const intlKnown = new Map();

  // ---- pass 1: count every format
  const counted = {};
  for (const fmt of FORMATS) {
    const dir = join(RAW, 'cricsheet', fmt.dir);
    const matches = [];
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      const m = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      if (m.info.gender !== 'male' || m.info.match_type !== fmt.matchType) continue;
      if (!fmt.intl && m.info.event?.name !== 'Indian Premier League') continue;
      matches.push(m);
    }
    counted[fmt.id] = { matches: matches.length, acc: aggregate(matches, fmt) };
  }

  // ---- who is who: each Cricsheet player's nation (international side; IPL-only players are
  // treated as Indian domestic players), indexed by surname for the looser Kaggle match below.
  const mainTeam = (p) => [...p.teams.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const nationOf = new Map();
  for (const id of ['odi', 't20i']) for (const p of counted[id].acc.values()) if (!nationOf.has(p.id)) nationOf.set(p.id, mainTeam(p));
  for (const p of counted.ipl.acc.values()) if (!nationOf.has(p.id)) nationOf.set(p.id, 'India');
  const lastWord = (n) => norm(String(n).trim().split(/\s+/).slice(-1)[0]);
  const csBySurname = new Map();
  for (const [id, nation] of nationOf) {
    const name = people.get(id)?.name;
    if (!name) continue;
    const key = `${lastWord(name)}|${nation}`;
    if (!csBySurname.has(key)) csBySurname.set(key, []);
    csBySurname.get(key).push({ id, name });
  }
  const kgBySurname = new Map();
  for (const r of kaggle) {
    const key = `${lastWord(r.fullname)}|${r.country_name}`;
    if (!kgBySurname.has(key)) kgBySurname.set(key, []);
    kgBySurname.get(key).push(r);
  }
  /**
   * Looser Kaggle match for names the exact lookups miss ("HV Patel" ~ "Harshal Patel"): same
   * nation and surname with a shared initial, accepted only when it is one-to-one in BOTH
   * directions (exactly one Kaggle profile fits this player, and exactly one of our players fits
   * that profile). Anything less certain is left unmatched.
   */
  const fuzzyKaggle = (id, regName, nation) => {
    const key = `${lastWord(regName)}|${nation}`;
    const fits = (kgBySurname.get(key) ?? []).filter((r) => sameIdentity(regName, r.fullname));
    if (fits.length !== 1) return null;
    const rivals = (csBySurname.get(key) ?? []).filter((c) => sameIdentity(c.name, fits[0].fullname));
    return rivals.length === 1 && rivals[0].id === id ? fits[0] : null;
  };

  // ---- official career totals (owner's HowSTAT tables), paired per format and nation
  const official = { odi: new Map(), t20i: new Map() };
  const hsDir = join(RAW, 'howstat');
  const hsReport = [];
  if (existsSync(hsDir)) {
    for (const id of ['odi', 't20i']) {
      for (const nation of NATIONS) {
        const file = join(hsDir, `${id}-${nation.toLowerCase().replace(/\s+/g, '-')}.csv`);
        if (!existsSync(file)) continue;
        const rows = parseHowstat(readFileSync(file, 'utf8'));
        const ours = [...counted[id].acc.values()].filter((p) => mainTeam(p) === nation)
          .map((p) => ({ id: p.id, scorecardName: people.get(p.id)?.name ?? p.scoreName, name: bestName(p.id, p.names) }));
        const { pairs, unmatchedOurs } = matchHowstat(rows, ours);
        for (const { ours: o, theirs } of pairs) official[id].set(o.id, theirs);
        hsReport.push(`${id.toUpperCase()} ${nation}: ${rows.length} HowSTAT rows, ${pairs.length} paired, ${unmatchedOurs.length} of ours unpaired`);
      }
    }
  }
  // Full-career batting lines with official strike rates (all countries in one table per format).
  const officialBatting = { odi: new Map(), t20i: new Map() };
  for (const id of ['odi', 't20i']) {
    const file = join(hsDir, `${id}-batting-strike-rates.csv`);
    if (!existsSync(file)) continue;
    const all = parseStrikeRates(readFileSync(file, 'utf8'));
    let paired = 0;
    for (const nation of NATIONS) {
      const rows = all.filter((r) => r.country === nation);
      const ours = [...counted[id].acc.values()].filter((p) => mainTeam(p) === nation)
        .map((p) => ({ id: p.id, scorecardName: people.get(p.id)?.name ?? p.scoreName, name: bestName(p.id, p.names) }));
      for (const { ours: o, theirs } of matchHowstat(rows, ours).pairs) { officialBatting[id].set(o.id, theirs); paired++; }
    }
    hsReport.push(`${id.toUpperCase()} batting strike-rate table: ${all.length} rows (all countries), ${paired} paired with our players`);
  }
  report.howstat = hsReport;

  // ---- pass 2: roles and output
  for (const fmt of FORMATS) {
    const { acc } = counted[fmt.id];
    const matches = { length: counted[fmt.id].matches };
    const out = [];
    const counts = { matches: matches.length, players: acc.size, kept: 0, roleSource: {}, excluded: {} };
    const exclude = (why) => { counts.excluded[why] = (counts.excluded[why] ?? 0) + 1; };

    for (const p of acc.values()) {
      const nation = fmt.intl ? [...p.teams.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;
      if (fmt.intl && !NATIONS.includes(nation)) { exclude('not one of the 10 game nations'); continue; }
      // Cricsheet's ODIs start in late 2002; anyone first seen before 2004 almost always debuted
      // earlier (Ponting, Gayle), so their totals would be partial. From 2004 first appearances
      // match real debuts (Dhoni Dec 2004, de Villiers 2005). Owner to confirm this cut-off.
      // ...unless the owner's HowSTAT table supplies the player's official career totals.
      // HowSTAT's tables are per country, so a player who also appeared for another side (ICC World
      // XI, or a second country) has MORE matches in Cricsheet than in his country's table. Those
      // official rows are partial careers and are not used; the ball-by-ball counts are kept.
      const hsRow = official[fmt.id]?.get(p.id) ?? null;
      const hs = hsRow && hsRow.matches !== null && hsRow.matches >= p.matches ? hsRow : null;
      if (hsRow && !hs) counts.partialOfficial = (counts.partialOfficial ?? 0) + 1;
      const hb0 = officialBatting[fmt.id]?.get(p.id) ?? null;
      const hb = hb0 && hb0.matches !== null && hb0.matches >= p.matches ? hb0 : null;
      if (fmt.id === 'odi' && p.firstDate < ODI_FIRST_SEEN_CUTOFF && !hs) { exclude(`first Cricsheet ODI before ${ODI_FIRST_SEEN_CUTOFF} and no official totals (career incomplete)`); continue; }

      const reg = people.get(p.id) ?? {};
      const full = bestName(p.id, p.names);
      const known = intlKnown.get(p.id);
      const intlNation = nation ?? known?.nation ?? null; // IPL: their international side, if any
      let stats = hs ? withOfficialTotals(careerStats(p, fmt), hs) : { ...careerStats(p, fmt), statsSource: 'cricsheet' };
      // The strike-rate table holds full careers (World XI matches included), so it applies even
      // when the per-country row above was partial and could not be used.
      if (hb) { stats = withOfficialBatting(stats, hb); counts.officialBatting = (counts.officialBatting ?? 0) + 1; }

      // --- role evidence
      // IPL players without an international side: Indian domestic players (the large majority).
      const lookupNation = intlNation ?? (fmt.intl ? null : 'India');
      const test = lookupNation
        ? testByKey.get(`${norm(full)}|${lookupNation}`) ?? (hs?.knownAs ? testByKey.get(`${norm(hs.knownAs)}|${lookupNation}`) : null) ?? null
        : null;
      let kg = null;
      if (lookupNation) {
        kg = kgFull.get(`${norm(full)}|${lookupNation}`) ?? null;
        if (!kg || kg === 'AMBIGUOUS') {
          const parts = (reg.name ?? p.scoreName).split(/\s+/);
          const k2 = kgInit.get(`${norm(parts[0])[0]}${norm(parts.slice(1).join(' '))}|${lookupNation}`);
          kg = k2 && k2 !== 'AMBIGUOUS' ? k2 : kg === 'AMBIGUOUS' ? 'AMBIGUOUS' : null;
        }
      }
      if (!kg && !fmt.intl) {
        // IPL: try every nation; accept only a single unambiguous match.
        const hits = new Set();
        for (const n of [...NATIONS, 'Afghanistan', 'Netherlands', 'Ireland', 'Scotland', 'Nepal', 'United States of America']) {
          const h = kgFull.get(`${norm(full)}|${n}`);
          if (h && h !== 'AMBIGUOUS') hits.add(h);
        }
        kg = hits.size === 1 ? [...hits][0] : hits.size > 1 ? 'AMBIGUOUS' : null;
      }
      if (kg === 'AMBIGUOUS') { report.ambiguous.push({ format: fmt.id, name: full, id: p.id }); kg = null; }
      let kgHow = kg ? 'exact' : null;
      if (!kg && reg.name && lookupNation) {
        kg = fuzzyKaggle(p.id, reg.name, lookupNation);
        if (kg) { kgHow = 'surname + initial, one-to-one'; counts.fuzzy = (counts.fuzzy ?? 0) + 1; }
      }
      // Still only initials ("A T Rayudu")? Use the matched Kaggle profile's full name if it has none.
      let displayName = full;
      if (kg?.fullname && nameScore(full) < 1000 && nameScore(kg.fullname) >= 1000 && sameIdentity(reg.name ?? full, kg.fullname)) displayName = kg.fullname;
      // HowSTAT's "Known As" is the name fans use ("Suryakumar Yadav" for "SA Yadav").
      if (hs?.knownAs) displayName = hs.knownAs;
      else if (known?.name) displayName = known.name;
      if (overrides[p.id]?.name) displayName = overrides[p.id].name;
      const wdStyle = ['key_cricinfo', 'key_cricinfo_2', 'key_cricinfo_3'].map((k) => wd.get(reg[k])).find(Boolean);

      const bowlingType = (() => {
        const ov = overrides[p.id];
        if (ov?.bowlingType) return { type: ov.bowlingType, source: 'owner' };
        if (known?.bowlingType) return { type: known.bowlingType, source: known.bowlingTypeSource };
        const tr = test ? [test.primaryRole, ...(Array.isArray(test.secondaryRoles) ? test.secondaryRoles : [])].map((x) => String(x).toLowerCase()) : [];
        if (tr.some((r) => r.includes('spin'))) return { type: 'spin', source: 'test-data' };
        if (tr.some((r) => r.includes('fast'))) return { type: 'pace', source: 'test-data' };
        const ks = kg?.bowlingstyle ?? '';
        if (/fast|medium/.test(ks)) return { type: 'pace', source: 'kaggle' };
        if (/break|orthodox|googly|chinaman/.test(ks)) return { type: 'spin', source: 'kaggle' };
        if (wdStyle && /spin|break|orthodox/.test(wdStyle)) return { type: 'spin', source: 'wikidata' };
        if (wdStyle && /fast|seam|medium/.test(wdStyle)) return { type: 'pace', source: 'wikidata' };
        return { type: null, source: null };
      })();

      // --- role from what the player did (provisional rules; see report)
      const quotaShare = p.matches ? p.ballsBowled / p.matches / fmt.quota : 0;
      const regularBowler = quotaShare >= 0.4;
      const openerShare = p.positions.length ? p.positions.filter((x) => x <= 2).length / p.positions.length : 0;
      const topSeven = p.positions.length ? p.positions.filter((x) => x <= 7).length / p.positions.length : 0;
      const battingThreshold = fmt.id === 'odi' ? 25 : 18;
      const genuineBatter = (stats.battingAverage ?? 0) >= battingThreshold && topSeven >= 0.5 && p.innings >= 5;
      const keeperEvidence =
        (test && [test.primaryRole].concat(test.secondaryRoles ?? []).some((r) => String(r).toLowerCase().includes('wicket'))) ||
        (kg && kg.position === 'Wicketkeeper') ||
        (p.stumpings >= 3 && p.stumpings / p.matches >= 0.05);
      const batSlot = openerShare >= 0.5 ? 'opener' : 'middle-order';
      // The other batting position also counts if he batted there in 20%+ of his innings (10+ innings).
      const otherSlot = batSlot === 'opener' ? 'middle-order' : 'opener';
      const otherShare = batSlot === 'opener' ? 1 - openerShare : openerShare;
      const batSlots = p.positions.length >= 10 && otherShare >= 0.2 ? [batSlot, otherSlot] : [batSlot];

      let primaryRole, secondaryRoles = [], roleSource = 'match-data';
      if (keeperEvidence && !regularBowler) {
        primaryRole = 'wicketkeeper';
        secondaryRoles = [...batSlots];
        roleSource = test ? 'test-data' : kg?.position === 'Wicketkeeper' ? 'kaggle' : 'match-data (stumpings)';
      } else if (regularBowler && genuineBatter) {
        primaryRole = 'all-rounder';
        if (bowlingType.type) secondaryRoles = [bowlingType.type === 'spin' ? 'spinner' : 'fast-bowler', ...batSlots];
        else secondaryRoles = [...batSlots];
        roleSource = 'match-data';
      } else if (regularBowler) {
        if (!bowlingType.type) {
          report.rolesNeeded.push({ format: fmt.id, id: p.id, name: displayName, nation: intlNation, matches: p.matches, wickets: p.wickets, teams: [...p.teams.keys()].join(', ') });
          exclude('regular bowler, spin/pace unknown (owner to supply)');
          continue;
        }
        primaryRole = bowlingType.type === 'spin' ? 'spinner' : 'fast-bowler';
        roleSource = bowlingType.source;
      } else if (p.innings >= 1) {
        primaryRole = batSlot;
        secondaryRoles = batSlots.slice(1);
      } else {
        exclude('never batted or bowled regularly');
        continue;
      }
      counts.roleSource[roleSource] = (counts.roleSource[roleSource] ?? 0) + 1;

      const years = [...p.years].sort();
      const player = {
        id: `cs-${p.id}`,
        cricsheetId: p.id,
        name: displayName,
        scorecardName: reg.name ?? p.scoreName,
        nation: intlNation ?? undefined,
        era: fmt.intl ? [...new Set(years.map(decade))] : undefined,
        iplSpells: fmt.intl ? undefined : [...p.blocks].sort().map((s) => { const [team, block] = s.split('|'); return { team, block }; }),
        iplTeams: fmt.intl ? undefined : [...p.teams.keys()],
        primaryRole,
        secondaryRoles,
        isWicketkeeper: primaryRole === 'wicketkeeper',
        bowlingType: bowlingType.type,
        roleSource,
        bowlingTypeSource: bowlingType.source,
        firstMatch: p.firstDate,
        lastMatch: p.lastDate,
        stats,
      };
      out.push(player);
      counts.kept += 1;
      if (fmt.intl && (bowlingType.type || !intlKnown.has(p.id))) {
        intlKnown.set(p.id, { nation: intlNation, bowlingType: bowlingType.type, bowlingTypeSource: bowlingType.source, format: fmt.id, name: hs?.knownAs ?? intlKnown.get(p.id)?.name });
      }
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    mkdirSync(join(ROOT, 'src/data/formats'), { recursive: true });
    writeFileSync(join(ROOT, 'src/data/formats', `${fmt.id}.json`), JSON.stringify(out, null, 1) + '\n');
    report.formats[fmt.id] = counts;
    console.log(`${fmt.id}: ${matches.length} matches, ${counts.kept} players kept`, counts.excluded, counts.roleSource);
  }

  writeReports(report);
}

function writeReports(report) {
  mkdirSync(join(ROOT, 'docs/reports'), { recursive: true });
  const L = [];
  L.push('# White-ball data report', '', `Generated by \`scripts/cricsheet/build-white-ball.mjs\` on ${new Date().toISOString().slice(0, 10)}.`, '');
  L.push('Data: Cricsheet (cricsheet.org, ODC-By), men\'s matches. Roles: owner Test data, Kaggle "Cricket Players Dataset" (CC0), Wikidata (CC0), then match data.', '');
  for (const [id, c] of Object.entries(report.formats)) {
    L.push(`## ${id.toUpperCase()}`, '', `- Matches counted: ${c.matches}`, `- Players seen: ${c.players}`, `- Players kept: ${c.kept}`);
    for (const [why, n] of Object.entries(c.excluded)) L.push(`- Excluded, ${why}: ${n}`);
    L.push(`- Role source: ${Object.entries(c.roleSource).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    L.push(`- Kaggle profiles matched by surname + initial (one-to-one both ways): ${c.fuzzy ?? 0}`);
    if (c.officialBatting) L.push(`- Players with the official full-career batting line (strike rate, 50s, not outs): ${c.officialBatting}`);
    if (c.partialOfficial) L.push(`- Official rows not used because they cover fewer matches than Cricsheet (the player also appeared for another side): ${c.partialOfficial}`);
    L.push('');
  }
  if (report.howstat?.length) {
    L.push('## Official totals (HowSTAT, supplied by the owner)', '',
      'For paired ODI and T20I players, matches, innings, runs, hundreds, highest score, both averages, wickets, economy and 4-wicket innings are the official career totals (including matches Cricsheet withholds). Strike rate, fifties and fielding are rates measured on the Cricsheet ball-by-ball matches. Unpaired players keep Cricsheet counts.', '',
      ...report.howstat.map((x) => `- ${x}`), '');
  }
  L.push('## Provisional role rules (owner to confirm)', '',
    '- Regular bowler: averages at least 40% of the format\'s bowling quota per match (ODI 24 balls, T20 9.6 balls).',
    '- Genuine batter: batting average at least 25 (ODI) / 18 (T20), batting in the top 7 in at least half their innings, 5+ innings.',
    '- All-rounder: regular bowler AND genuine batter.',
    '- Opener: batted at 1 or 2 in at least half their innings; otherwise middle order. The other batting position is added as a second role when the player batted there in at least 20% of 10+ innings.',
    '- Wicketkeeper: keeper in the owner\'s Test data, or "Wicketkeeper" in the Kaggle profile, or 3+ stumpings at 1 per 20 matches; and not a regular bowler.',
    '- Spin or pace: Test data, then Kaggle bowling style, then Wikidata. Never guessed: unknown regular bowlers are left out and listed in white-ball-roles-needed.md.',
    '- ODI: players whose first Cricsheet ODI is before 2004 are left out: Cricsheet ODIs begin in late 2002, and players first seen in 2003 are mostly earlier debutants (Ponting, Gayle). Real 2003 debutants (e.g. Michael Clarke) are lost unless the owner confirms them.',
    '- Matches involving Afghanistan are withheld by Cricsheet, so every ODI/T20I career here misses its matches against Afghanistan (totals slightly below official records).',
    '- Afghanistan: matches withheld by Cricsheet; not a game nation.', '');
  L.push(`## Ambiguous name matches (role lookup skipped): ${report.ambiguous.length}`, '');
  for (const a of report.ambiguous.slice(0, 50)) L.push(`- ${a.format}: ${a.name} (${a.id})`);
  writeFileSync(join(ROOT, 'docs/reports/white-ball-data-report.md'), L.join('\n') + '\n');

  const R = ['# Bowlers whose spin/pace type is unknown', '',
    'These regular bowlers are left out of the game until their bowling type is known. Fill the "type" column with `spin` or `pace` (from a source you trust) and Claude will add them.', '',
    '| Format | Name | Nation / teams | Matches | Wickets | Cricsheet id | type |', '|---|---|---|---|---|---|---|'];
  for (const r of report.rolesNeeded.sort((a, b) => b.matches - a.matches)) {
    R.push(`| ${r.format} | ${r.name} | ${r.nation ?? r.teams} | ${r.matches} | ${r.wickets} | ${r.id} | |`);
  }
  writeFileSync(join(ROOT, 'docs/reports/white-ball-roles-needed.md'), R.join('\n') + '\n');
}

if (process.argv[1] && process.argv[1].endsWith('build-white-ball.mjs')) main();
