#!/usr/bin/env python3
import json
from pathlib import Path

DATA_DIR = Path("src/data")
for era in ['1970s', '1980s', '1990s', '2000s', '2010s', '2020s', 'legends']:
    json_path = DATA_DIR / f"{era}.json"
    if not json_path.exists():
        continue
    with json_path.open(encoding='utf-8') as f:
        data = json.load(f)
    non_zero_runs = sum(1 for p in data if p.get('stats', {}).get('testRuns', 0) > 0)
    non_zero_wickets = sum(1 for p in data if p.get('stats', {}).get('testWickets', 0) > 0)
    non_zero_matches = sum(1 for p in data if p.get('stats', {}).get('testMatches', 0) > 0)
    print(f"{era}: {len(data)} players")
    print(f"  Non-zero runs: {non_zero_runs}")
    print(f"  Non-zero wickets: {non_zero_wickets}")
    print(f"  Non-zero matches: {non_zero_matches}")