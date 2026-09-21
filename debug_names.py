#!/usr/bin/env python3
import json
import csv
import re
from pathlib import Path

DATA_DIR = Path("src/data")
TEST_STAT_FILE = Path("src/data/TestStat.csv")

def clean_name(name: str) -> str:
    """Remove accents, punctuation, and make lowercase for matching."""
    # Remove asterisk and any non-alphanumeric except spaces
    name = re.sub(r'[^\w\s]', '', name)
    # Replace multiple spaces with single
    name = re.sub(r'\s+', ' ', name)
    return name.strip().lower()

def load_teststat_data():
    if not TEST_STAT_FILE.is_file():
        return {}
    players_data = {}
    with TEST_STAT_FILE.open(encoding="utf-8") as f:
        lines = f.readlines()
        header_line_idx = 0
        for i, line in enumerate(lines):
            if line.startswith(',Player,Span,Mat,Inns,NO,Runs,HS,Ave,100,50,0,,'):
                header_line_idx = i
                break
        f.seek(0)
        reader = csv.DictReader(f)
        for _ in range(header_line_idx):
            next(reader, None)
        for row in reader:
            player_name = row.get('Player', '').strip()
            if player_name:
                clean = clean_name(player_name)
                players_data[clean] = {
                    'testMatches': int(row.get('Mat', 0)) if row.get('Mat', '').isdigit() else 0,
                    'testRuns': int(row.get('Runs', 0)) if row.get('Runs', '').isdigit() else 0,
                    'testCenturies': int(row.get('100', 0)) if row.get('100', '').isdigit() else 0,
                    'testFifties': int(row.get('50', 0)) if row.get('50', '').isdigit() else 0,
                    'testAverage': float(row.get('Ave', 0)) if row.get('Ave', '').replace('.','',1).isdigit() else 0.0,
                }
    return players_data

def main():
    teststat_lookup = load_teststat_data()
    # Let's check a few players from 1990s.json that we know should be there
    with open('src/data/1990s.json', encoding='utf-8') as f:
        players = json.load(f)
    # Let's look for Sachin Tendulkar
    for p in players:
        if p['id'] == 'sachin-tendulkar':
            print(f"Found Sachin: {p['name']}")
            clean = clean_name(p['name'])
            print(f"Cleaned name: '{clean}'")
            if clean in teststat_lookup:
                print("Found in TestStat:", teststat_lookup[clean])
            else:
                print("NOT found in TestStat")
                # Let's see what names are in TestStat that contain tendulkar
                for k in teststat_lookup.keys():
                    if 'tendulkar' in k:
                        print(f"  Possible match: {k}")
            break

    # Let's also check a few more
    for p in players[:5]:
        print(f"\nPlayer: {p['name']} (id: {p['id']})")
        clean = clean_name(p['name'])
        print(f"  Cleaned: '{clean}'")
        if clean in teststat_lookup:
            print(f"  Found: {teststat_lookup[clean]}")
        else:
            print(f"  NOT found")
            # Try to find similar names
            matches = [k for k in teststat_lookup.keys() if p['name'].lower().split()[0] in k]
            if matches:
                print(f"  Similar: {matches[:3]}")

if __name__ == "__main__":
    main()