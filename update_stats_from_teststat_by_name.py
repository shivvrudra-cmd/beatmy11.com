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

def load_teststat_data() -> dict:
    """Load TestStat.csv and create a lookup dict by cleaned player name."""
    if not TEST_STAT_FILE.is_file():
        print(f"[ERROR] TestStat file {TEST_STAT_FILE} not found.")
        return {}
    print(f"[INFO] Loading TestStat data from {TEST_STAT_FILE}...")
    players_data = {}
    with TEST_STAT_FILE.open(encoding="utf-8") as f:
        reader = csv.reader(f)
        # Find the header line (skip metadata lines)
        header = None
        for row in reader:
            if row and row[0] == '' and len(row) > 1 and row[1] == 'Player':
                header = row
                break
        if header is None:
            print("[ERROR] Could not find header line in TestStat.csv")
            return {}
        # Now process the rest of the rows
        for row in reader:
            if not row:
                continue
            # The first column is the numeric ID (as string) - we don't need it for name lookup
            # But we need to map the header to the row values.
            # Create a dict from header and row
            row_dict = {}
            for h, v in zip(header, row):
                row_dict[h] = v
            player_name = row_dict.get('Player', '').strip()
            if player_name:
                clean = clean_name(player_name)
                # Store the stats we need
                try:
                    matches = int(row_dict.get('Mat', 0)) if row_dict.get('Mat', '').isdigit() else 0
                    runs = int(row_dict.get('Runs', 0)) if row_dict.get('Runs', '').isdigit() else 0
                    centuries = int(row_dict.get('100', 0)) if row_dict.get('100', '').isdigit() else 0
                    fifties = int(row_dict.get('50', 0)) if row_dict.get('50', '').isdigit() else 0
                    ave = row_dict.get('Ave', '0')
                    average = float(ave) if ave.replace('.', '', 1).isdigit() else 0.0
                except ValueError:
                    # If conversion fails, skip this row
                    continue
                players_data[clean] = {
                    'testMatches': matches,
                    'testRuns': runs,
                    'testCenturies': centuries,
                    'testFifties': fifties,
                    'testAverage': average,
                }
    print(f"[INFO] Loaded {len(players_data)} player records from TestStat.csv")
    return players_data

def update_json_file(json_path: Path, teststat_lookup: dict):
    print(f"\nProcessing {json_path.name} ...")
    with json_path.open(encoding="utf-8") as f:
        data = json.load(f)
    updated = 0
    not_found = 0
    for player in data:
        name = player.get('name', '')
        if not name:
            continue
        clean = clean_name(name)
        if clean in teststat_lookup:
            ts = teststat_lookup[clean]
            stats = player.setdefault('stats', {})
            # Update batting stats from TestStat
            stats['testMatches'] = ts['testMatches']
            stats['testRuns'] = ts['testRuns']
            stats['testCenturies'] = ts['testCenturies']
            stats['testFifties'] = ts['testFifties']
            stats['testAverage'] = ts['testAverage']
            # Note: we do not update testWickets, ballsFaced, deliveriesBowled, fiveWs, tenWs, dismissals here.
            updated += 1
        else:
            not_found += 1
            # Ensure defaults exist for consistency (though they should already be set from markdown)
            stats = player.setdefault('stats', {})
            for field, default in [("testMatches", 0), ("testRuns", 0), ("testCenturies", 0), ("testFifties", 0), ("testAverage", 0.0)]:
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
    eras = ['1970s', '1980s', '1990s', '2000s', '2010s', '2020s', 'legends']
    total_updated = 0
    for era in eras:
        json_path = DATA_DIR / f"{era}.json"
        if not json_path.exists():
            print(f"[WARNING] {json_path} not found")
            continue
        total_updated += update_json_file(json_path, teststat_lookup)
    print(f"\n[INFO] All done. Total player updates: {total_updated}")

if __name__ == "__main__":
    main()