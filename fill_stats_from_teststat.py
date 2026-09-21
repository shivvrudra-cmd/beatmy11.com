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
    """Load TestStat.csv and create a lookup dict by cleaned player name."""
    if not TEST_STAT_FILE.is_file():
        print(f"[ERROR] TestStat file {TEST_STAT_FILE} not found.")
        return {}
    players_data = {}
    with TEST_STAT_FILE.open(encoding="utf-8") as f:
        # Find the header line (skip metadata lines)
        lines = f.readlines()
        header_line_idx = 0
        for i, line in enumerate(lines):
            if line.startswith(',Player,Span,Mat,Inns,NO,Runs,HS,Ave,100,50,0,,'):
                header_line_idx = i
                break
        f.seek(0)
        reader = csv.DictReader(f)
        # Skip metadata lines
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
    print(f"[INFO] Loaded {len(players_data)} player records from TestStat.csv")
    return players_data

def process_file(json_path: Path, teststat_lookup: dict):
    print(f"\nProcessing {json_path.name} ...")
    with json_path.open(encoding="utf-8") as f:
        data = json.load(f)
    updated = 0
    not_found = 0
    for player in data:
        # Construct a name to match: "First Last" as in JSON
        name = player.get('name', '')
        if not name:
            continue
        clean = clean_name(name)
        if clean in teststat_lookup:
            stats = player.setdefault('stats', {})
            ts = teststat_lookup[clean]
            # Update batting stats
            stats['testMatches'] = ts['testMatches']
            stats['testRuns'] = ts['testRuns']
            stats['testCenturies'] = ts['testCenturies']
            stats['testFifties'] = ts['testFifties']
            stats['testAverage'] = ts['testAverage']
            # Ensure other stats exist (default 0)
            for field, default in [("ballsFaced", 0), ("deliveriesBowled", 0), ("fiveWs", 0), ("tenWs", 0)]:
                stats.setdefault(field, default)
            updated += 1
        else:
            not_found += 1
            # Ensure defaults exist
            stats = player.setdefault('stats', {})
            for field, default in [("testMatches", 0), ("testRuns", 0), ("testCenturies", 0), ("testFifties", 0), ("testAverage", 0.0),
                                   ("ballsFaced", 0), ("deliveriesBowled", 0), ("fiveWs", 0), ("tenWs", 0)]:
                stats.setdefault(field, default)
    # Write back
    with json_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"   [OK] Updated {updated}/{len(data)} players with TestStat data.")
    if not_found > 0:
        print(f"   [WARNING] {not_found} players not found in TestStat.csv")
    return updated

def main():
    if not DATA_DIR.is_dir():
        print(f"[ERROR] Data directory {DATA_DIR} not found.")
        return
    teststat_lookup = load_teststat_data()
    if not teststat_lookup:
        return
    json_files = list(DATA_DIR.glob("*.json"))
    if not json_files:
        print(f"[ERROR] No JSON files found in {DATA_DIR}")
        return
    total_updated = 0
    for jf in json_files:
        total_updated += process_file(jf, teststat_lookup)
    print(f"\n[INFO] All done. Total player updates: {total_updated}")

if __name__ == "__main__":
    main()