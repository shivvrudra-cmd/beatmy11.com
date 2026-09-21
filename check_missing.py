#!/usr/bin/env python3
import json
from pathlib import Path

DATA_DIR = Path("src/data")
eras = ['1970s', '1980s', '1990s', '2000s', '2010s', '2020s', 'legends']
for era in eras:
    json_path = DATA_DIR / f"{era}.json"
    if not json_path.exists():
        continue
    with json_path.open(encoding='utf-8') as f:
        data = json.load(f)
    missing_matches = [p for p in data if p.get('stats', {}).get('testMatches', 0) == 0]
    missing_centuries = [p for p in data if p.get('stats', {}).get('testCenturies', 0) == 0]
    missing_fifties = [p for p in data if p.get('stats', {}).get('testFifties', 0) == 0]
    print(f"{era}: {len(data)} players")
    print(f"  missing matches: {len(missing_matches)}")
    print(f"  missing centuries: {len(missing_centuries)}")
    print(f"  missing fifties: {len(missing_fifties)}")
    # Show first few missing matches
    if missing_matches:
        print(f"    Example missing matches: {missing_matches[0]['name']} ({missing_matches[0]['id']})")
    if missing_centuries:
        print(f"    Example missing centuries: {missing_centuries[0]['name']} ({missing_centuries[0]['id']})")