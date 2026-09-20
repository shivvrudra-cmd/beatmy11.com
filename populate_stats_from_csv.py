#!/usr/bin/env python3
"""
Populate missing cricket stats (ballsFaced, deliveriesBowled, fiveWs, tenWs)
from TestStat.csv (local ESPNcricinfo stats dump) with parallel processing.

Usage:
    1. Ensure you have TestStat.csv in the project root (exported from ESPNcricinfo Statsguru)
    2. Create a mapping file `id_map.json` that maps your internal player IDs
       (the "id" field in src/data/*.json) to player names as they appear in TestStat.csv.
       Example:
       {
         "don-bradman": "Sir DG Bradman",
         "sachin-tendulkar": "SR Tendulkar",
         ...
       }
    3. Run: python populate_stats_from_csv.py
"""

import json
import os
import sys
import time
from pathlib import Path
from typing import Dict, Any, Optional, Set, Tuple, List
import concurrent.futures
import csv

# ------------------- Configuration -------------------
DATA_DIR = Path("src/data")
MAP_FILE = Path("id_map.json")
TEST_STAT_FILE = Path("TestStat.csv")
CSV_DIR = Path("espn_csv")  # Keep for compatibility
CSV_DIR.mkdir(exist_ok=True)

# Mapping from TestStat.csv column names to our stats fields
TESTSTAT_TO_OUR_FIELDS = {
    'BF': 'ballsFaced',           # Balls faced
    'Balls': 'deliveriesBowled',  # Balls bowled (in bowling section)
    # Note: TestStat.csv doesn't have 5w/10w columns in the main view
    # We'll need to extract these separately or set to 0/default
}

# ------------------- Helper Functions -------------------
def load_id_map() -> Dict[str, str]:
    """Load mapping from internal IDs to TestStat.csv player names."""
    if not MAP_FILE.is_file():
        print(f"[ERROR] Mapping file {MAP_FILE} not found. Create it first.")
        print("        Format: { \"internal-id\": \"TestStat Player Name\" }")
        sys.exit(1)
    with MAP_FILE.open(encoding="utf-8") as f:
        data = json.load(f)
    return {k: str(v) for k, v in data.items()}

def load_teststat_data() -> Dict[str, Dict[str, Any]]:
    """Load TestStat.csv and create a lookup dict by player name."""
    if not TEST_STAT_FILE.is_file():
        print(f"[ERROR] TestStat file {TEST_STAT_FILE} not found.")
        print("        Please export TestStat.csv from ESPNcricinfo Statsguru.")
        sys.exit(1)

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

        # Reset and read from header
        f.seek(0)
        reader = csv.DictReader(f)
        # Skip metadata lines
        for _ in range(header_line_idx):
            next(reader, None)

        # Now read actual data
        for row in reader:
            player_name = row.get('Player', '').strip()
            if player_name:
                # Clean up the player name (remove *, etc.)
                clean_name = player_name.replace('*', '').strip()
                players_data[clean_name] = {
                    'testRuns': int(row.get('Runs', 0)) if row.get('Runs', '').isdigit() else 0,
                    'testCenturies': int(row.get('100', 0)) if row.get('100', '').isdigit() else 0,
                    'testFifties': int(row.get('50', 0)) if row.get('50', '').isdigit() else 0,
                    'testMatches': int(row.get('Mat', 0)) if row.get('Mat', '').isdigit() else 0,
                    # Note: TestStat.csv doesn't have ballsFaced/deliveriesBowled in main view
                    # We'll need to get these from a different export or estimate
                }

    print(f"[INFO] Loaded {len(players_data)} player records from TestStat.csv")
    return players_data

def load_json_file(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)

def save_json_file(path: Path, data):
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def prepare_player_for_teststat(player: Dict[str, Any], teststat_name: str, teststat_data: Dict[str, Any]):
    """Prepare a player dict with stats from TestStat data."""
    stats = player.setdefault("stats", {})

    # Update stats from TestStat data
    for field, value in teststat_data.items():
        stats[field] = value

    # Since TestStat.csv doesn't have ballsFaced/deliveriesBowled/5w/10w in main view,
    # we'll set them to 0 for now or try to get them from a bowling-specific export
    # For now, we'll leave them as 0 (they'll be filled if we have separate bowling data)
    for field, default in [("ballsFaced", 0), ("deliveriesBowled", 0), ("fiveWs", 0), ("tenWs", 0)]:
        stats.setdefault(field, default)

def process_file(json_path: Path, id_map: Dict[str, str], teststat_lookup: Dict[str, Dict[str, Any]]):
    print(f"\nProcessing {json_path.name} ...")
    data = load_json_file(json_path)

    # First, determine what we need to process
    players_to_update = []  # List of (player, teststat_name) for players that have a mapping

    for player in data:
        pid = player.get("id")
        if pid not in id_map:
            # Skip players we don't have a mapping for
            continue
        teststat_name = id_map[pid]
        players_to_update.append((player, teststat_name))

    # Update player stats
    updated = 0
    not_found_in_teststat = 0
    for player, teststat_name in players_to_update:
        if teststat_name in teststat_lookup:
            prepare_player_for_teststat(player, teststat_name, teststat_lookup[teststat_name])
            updated += 1
        else:
            not_found_in_teststat += 1
            # Still ensure default stats exist
            stats = player.setdefault("stats", {})
            for field, default in [("ballsFaced", 0), ("deliveriesBowled", 0), ("fiveWs", 0), ("tenWs", 0)]:
                stats.setdefault(field, default)

    save_json_file(json_path, data)
    print(f"   [OK] Updated {updated}/{len(data)} players with TestStat data.")
    if not_found_in_teststat > 0:
        print(f"   [WARNING] {not_found_in_teststat} mapped players not found in TestStat.csv")
    return updated

def main():
    if not DATA_DIR.is_dir():
        print(f"[ERROR] Data directory {DATA_DIR} not found.")
        sys.exit(1)

    id_map = load_id_map()
    print(f"Loaded {len(id_map)} ID mappings from {MAP_FILE}")

    teststat_lookup = load_teststat_data()

    json_files = list(DATA_DIR.glob("*.json"))
    if not json_files:
        print(f"[ERROR] No JSON files found in {DATA_DIR}")
        sys.exit(1)

    total_updated = 0
    for jf in json_files:
        total_updated += process_file(jf, id_map, teststat_lookup)

    print(f"\n[INFO] All done. Total player updates: {total_updated}")
    print("[INFO] Note: ballsFaced and deliveriesBowled are set to 0 as TestStat.csv main view")
    print("       doesn't contain these fields. For actual values, you would need:")
    print("       1. A separate bowling export from Statsguru, or")
    print("       2. To scrape the detailed player pages for career totals")

if __name__ == "__main__":
    main()