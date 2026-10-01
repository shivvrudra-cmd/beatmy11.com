# White-ball formats (ODI, T20I, IPL): plan and decisions

Status: approved 2026-10-01 for an overnight build. Nothing here ships to players until the owner
reviews it. Everything new stays behind a hidden switch on branch `formats/white-ball`.

## Owner decisions (2026-10-01)

| Topic | Decision |
|---|---|
| Data source | Cricsheet (cricsheet.org), men's matches. Edge cases resolved with the owner. |
| Licence | Open Data Commons Attribution (ODC-By). Credit "Data: Cricsheet (cricsheet.org)" in the footer and on /privacy. |
| Formats | ODI, T20I, IPL. |
| Metrics | Approved as proposed (table below). |
| ODI coverage | Cricsheet ODIs start ~2003. Include **only players whose ODI career began in 2003 or later**, so every figure is a true career. Eras: 2000s (from 2003), 2010s, 2020s. Older players may come later from owner-supplied CSVs. |
| IPL teams | Merge renamed franchises (Delhi Daredevils = Delhi Capitals, Kings XI Punjab = Punjab Kings, Royal Challengers Bangalore = Bengaluru). Keep defunct teams (Deccan Chargers, Kochi Tuskers Kerala, Pune Warriors, Rising Pune Supergiant(s), Gujarat Lions) as their own. Spin = franchise × season block: 2008–12, 2013–17, 2018–22, 2023+. |
| XI shape | Same three shapes and positional slots as the Test game (2 openers, 3 middle order, 1 keeper, 2 flex AR/spin, 3 fast). |
| Series | Five matches vs a fixed opponent per format: World XI (ODI, T20I), All-Star XI (IPL). |
| Overnight scope | Data pipeline + tests + gap report for all three formats, then a full playable **IPL** mode, hidden. |

## Metrics (approved)

| | ODI | T20I and IPL |
|---|---|---|
| Batting | average, runs per match, strike rate, century rate | average, runs per match, strike rate, fifty rate |
| Bowling | average, wickets per match, economy, 4-or-5-wicket-innings rate | average, wickets per match, economy, balls per wicket |

Lower is better for: bowling average, economy, balls per wicket. Percentile-ranked against every
player in that format (never mixed across formats), with shrinkage toward the format's mean for short
careers, exactly like `src/lib/seven-metrics.ts`.

## Provisional constants (NOT decided by the owner; must be confirmed before release)

The owner approved *which* metrics, not their weights or thresholds. Until confirmed, use these
neutral defaults, keep them in ONE config object per format, and label them `PROVISIONAL`:

- Metric weights: equal (1/4 each) for batting and for bowling.
- Shrinkage prior: 30 matches (same as Test).
- Longevity full credit / long-career bonus: ODI 100 / 250 matches; T20I 50 / 120; IPL 60 / 180.
- Team blend: 40% batting / 50% bowling / 10% fielding (same as Test).
- Series ladder: reuse the Test `PAR_GAP` and cuts; report simulated win rates, do not tune.
- Opponent XI: propose the highest-rated legal XI per format from the engine as a *candidate* only.

## Data rules (hard)

1. Every number is computed from Cricsheet match files. Nothing is typed in, estimated, recalled
   from memory or zero-filled. Missing stays `null` and is listed in the gap report.
2. Afghanistan-involved matches are withheld by Cricsheet. Exclude Afghanistan as a nation in ODI and
   T20I; list affected players in the gap report. IPL data is unaffected.
3. Player identity: use Cricsheet's registry identifiers (the `registry.people` ids in each match file),
   not names, to aggregate careers.
4. Roles:
   - opener / middle order: from batting positions (opened in most innings = opener).
   - wicketkeeper: from matches where the player made stumpings or is listed as keeper; flag
     low-confidence cases.
   - spinner vs fast bowler: Cricsheet does not record it. Reuse the role from the existing Test
     data when the same player exists there (match by name + nation, flag ambiguous matches).
     Everyone else: role `null`, listed in `docs/reports/white-ball-roles-needed.md` for the owner.
     Never guess bowling type.
   - all-rounder: rule must be stated in the report and kept simple and explainable; flag it as
     provisional for the owner.
5. Store the raw Cricsheet downloads outside git (gitignored); commit only the derived JSON and the
   scripts that rebuild it, so the data is reproducible.

## Deliverables for the morning

- `scripts/cricsheet/` — download + aggregate scripts (rerunnable).
- `src/data/formats/{odi,t20i,ipl}/*.json` — derived players, same shape as the Test era files plus
  format-specific stats.
- Tests: aggregation correctness on a few hand-checked matches (from the raw files), no invented
  values, schema validation, every spin combo can produce a legal XI.
- `docs/reports/white-ball-data-report.md` — counts, coverage, gaps, Afghanistan note, role
  derivation results, provisional constants, simulated win rates.
- `docs/reports/white-ball-roles-needed.md` — players whose bowling type the owner must supply.
- IPL mode on `/play?format=ipl` (hidden: no link anywhere; noindex), result page support, tests.
- One PR with a preview link; never merged without the owner.
