#!/usr/bin/env python3
import json
import csv
import re
from pathlib import Path

DATA_DIR = Path("src/data")
MAP_FILE = Path("id_map.json")
TEST_STAT_FILE = Path("src/data/TestStat.csv")

def clean_name(name: str) -> str:
    """Remove accents, punctuation, and make lowercase for matching."""
    # Remove asterisk and any non-alphanumeric except spaces
    name = re.sub(r'[^\w\s]', '', name)
    # Replace multiple spaces with single
    name = re.sub(r'\s+', ' ', name)
    return name.strip().lower()

def load_id_map() -> dict:
    if not MAP_FILE.is_file():
        print(f"[ERROR] Mapping file {MAP_FILE} not found.")
        return {}
    with MAP_FILE.open(encoding="utf-8") as f:
        data = json.load(f)
    return {k: str(v) for k, v in data.items()}

def load_teststat_data() -> dict:
    if not TEST_STAT_FILE.is_file():
        print(f"[ERROR] TestStat file {TEST_STAT_FILE} not found.")
        return {}
    print(f"[INFO] Loading TestStat data from {TEST_STAT_FILE}...")
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

def main():
    id_map = load_id_map()
    print(f"Loaded {len(id_map)} ID mappings from {MAP_FILE}")
    teststat_lookup = load_teststat_data()
    if not teststat_lookup:
        return

    json_path = DATA_DIR / "1990s.json"
    with json_path.open(encoding="utf-8") as f:
        data = json.load(f)

    updated = 0
    not_found = 0
    for player in data:
        pid = player.get("id")
        if pid not in id_map:
            not_found += 1
            continue
        teststat_name = id_map[pid]
        clean = clean_name(teststat_name)
        if clean in teststat_lookup:
            ts = teststat_lookup[clean]
            stats = player.setdefault("stats", {})
            # Update only matches, centuries, fifties (and maybe runs and average if they are zero?)
            # We'll update matches, centuries, fifties unconditionally because they are likely zero now.
            stats['testMatches'] = ts['testMatches']
            stats['testCenturies'] = ts['testCenturies']
            stats['testFifties'] = ts['testFifties']
            # Optionally update runs and average if they are zero (but they are not)
            if stats.get('testRuns', 0) == 0:
                stats['testRuns'] = ts['testRuns']
            if stats.get('testAverage', 0) == 0.0:
                stats['testAverage'] = ts['testAverage']
            updated += 1
        else:
            not_found += 1

    with json_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"[OK] Updated {updated} players with TestStat data (matches, centuries, fifties).")
    print(f"[WARNING] {not_found} players not found in TestStat.csv (either missing mapping or name not found).")

if __name__ == "__main__":
    main()