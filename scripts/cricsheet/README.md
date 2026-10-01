# Rebuilding the ODI / T20I / IPL player data

The raw downloads live in `data-raw/` (gitignored). From the repo root:

```bash
mkdir -p data-raw/cricsheet data-raw/kaggle
cd data-raw/cricsheet
for f in odis_male_json ipl_json t20s_male_json; do curl -sSL -o $f.zip https://cricsheet.org/downloads/$f.zip; unzip -q -o $f.zip -d ${f%_json}; done
curl -sSL -o people.csv https://cricsheet.org/register/people.csv
curl -sSL -o names.csv https://cricsheet.org/register/names.csv
curl -sG https://query.wikidata.org/sparql -H "Accept: text/csv" --data-urlencode 'query=SELECT ?ci ?itemLabel ?styleLabel ?posLabel WHERE { ?item wdt:P2697 ?ci . OPTIONAL { ?item wdt:P2545 ?style . } OPTIONAL { ?item wdt:P413 ?pos . } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }' -o wikidata_cricketers.csv
cd ../kaggle
curl -sSL -o players.zip https://www.kaggle.com/api/v1/datasets/download/dhavalrupapara/cricket-players-worldwide-dataset && unzip -o players.zip
cd ../..
node scripts/cricsheet/build-white-ball.mjs
```

Sources and licences: Cricsheet match data and register (Open Data Commons Attribution, credit
"Cricsheet"); Wikidata (CC0); Kaggle "Cricket Players Dataset" by Dhaval Rupapara (CC0; only names,
country and bowling style are used, never the photos). Rules and decisions:
`docs/plans/white-ball-formats.md`. Results: `docs/reports/white-ball-data-report.md`.
