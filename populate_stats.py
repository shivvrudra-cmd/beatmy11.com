#!/usr/bin/env python3
"""
Populate missing cricket stats (ballsFaced, deliveriesBowled, fiveWs, tenWs)
from ESPNcricinfo Statsguru CSV exports.

Usage:
    1. Create a mapping file `id_map.json` that maps your internal player IDs
       (the "id" field in src/data/*.json) to ESPNcricinfo numeric player IDs.
       Example:
       {
         "don-bradman": 4188,
         "sachin-tendulkar": 35320,
         ...
       }
    2. (Optional) If you already have downloaded CSV files, place them in a
       folder named `espn_csv/` and name them `<espn_id>_batting.csv` and
       `<espn_id>_bowling.csv`. The script will use them if present,
       otherwise it will download them on‑the‑fly.
    3. Run: python populate_stats.py
"""

import json
import os
import sys
import time
from pathlib import Path
from typing import Dict, Any, Optional

import requests

# ------------------- Configuration -------------------
DATA_DIR = Path("src/data")
MAP_FILE = Path("id_map.json")
CSV_DIR = Path("espn_csv")
CSV_DIR.mkdir(exist_ok=True)

# Base URL for Statsguru CSV export (career aggregates, Tests only)
# Example: https://stats.cricinfo.com/ci/engine/player/4188.csv?class=1;template=results;type=batting
STATSGURU_BASE = "https://stats.cricinfo.com/ci/engine/player/{}.csv"
PARAMS_BATTING = "class=1;template=results;type=batting;view=innings"
PARAMS_BOWLING = "class=1;template=results;type=bowling;view=innings"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
}

# ------------------- Helper Functions -------------------
def load_id_map() -> Dict[str, int]:
    if not MAP_FILE.is_file():
        print(f"[ERROR] Mapping file {MAP_FILE} not found. Create it first.")
        sys.exit(1)
    with MAP_FILE.open(encoding="utf-8") as f:
        data = json.load(f)
    # Ensure values are ints
    return {k: int(v) for k, v in data.items()}

def load_json_file(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)

def save_json_file(path: Path, data):
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def download_csv(espn_id: int, kind: str) -> Optional[Path]:
    """
    Download batting or bowling CSV for a player.
    Returns path to saved file, or None on failure.
    """
    csv_path = CSV_DIR / f"{espn_id}_{kind}.csv"
    if csv_path.is_file():
        return csv_path

    url = STATSGURU_BASE.format(espn_id)
    params = PARAMS_BATTING if kind == "batting" else PARAMS_BOWLING
    try:
        resp = requests.get(url, params=params, headers=HEADERS, timeout=30)
        resp.raise_for_status()
    except Exception as e:
        print(f"[WARNING] Failed to download {kind} CSV for ID {espn_id}: {e}")
        return None

    # ESPN returns HTML if something goes wrong; check content-type
    if "text/csv" not in resp.headers.get("Content-Type", ""):
        # Sometimes still returns CSV despite header; we'll check first line
        pass
    csv_path.write_bytes(resp.content)
    # Be nice to the server
    time.sleep(0.2)
    return csv_path

def parse_batting_csv(csv_path: Path) -> Dict[str, Any]:
    """Return dict with ballsFaced."""
    import csv
    with csv_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        # Career totals are usually the first data row
        try:
            row = next(reader)
        except StopIteration:
            return {}
        bf = row.get("BF") or row.get("BallsFaced") or row.get("ballsFaced")
        if bf is None or bf == "":
            # Fallback: sometimes column is named "Balls"
            bf = row.get("Balls")
        return {"ballsFaced": int(bf) if bf and bf.isdigit() else 0}

def parse_bowling_csv(csv_path: Path) -> Dict[str, Any]:
    """Return dict with deliveriesBowled, fiveWs, tenWs."""
    import csv
    with csv_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        try:
            row = next(reader)
        except StopIteration:
            return {}
        deliveries = row.get("Balls") or row.get("deliveriesBowled") or row.get("Delivery")
        five_w = row.get("5w") or row.get("FiveW") or row.get("5W")
        ten_w = row.get("10w") or row.get("TenW") or row.get("10W")
        out = {}
        if deliveries and deliveries.isdigit():
            out["deliveriesBowled"] = int(deliveries)
        else:
            out["deliveriesBowled"] = 0
        out["fiveWs"] = int(five_w) if five_w and five_w.isdigit() else 0
        out["tenWs"] = int(ten_w) if ten_w and ten_w.isdigit() else 0
        return out

def update_player_stats(player: Dict[str, Any], espn_id: int):
    """Update a single player dict in-place."""
    stats = player.setdefault("stats", {})
    # Batting
    bat_path = download_csv(espn_id, "batting")
    if bat_path:
        bat_data = parse_batting_csv(bat_path)
        for k, v in bat_data.items():
            stats[k] = v
    # Bowling
    bowl_path = download_csv(espn_id, "bowling")
    if bowl_path:
        bowl_data = parse_bowling_csv(bowl_path)
        for k, v in bowl_data.items():
            stats[k] = v
    # Ensure defaults exist if something went missing
    for field, default in [("ballsFaced", 0), ("deliveriesBowled", 0), ("fiveWs", 0), ("tenWs", 0)]:
        stats.setdefault(field, default)

def process_file(json_path: Path, id_map: Dict[str, int]):
    print(f"\nProcessing {json_path.name} ...")
    data = load_json_file(json_path)
    updated = 0
    for player in data:
        pid = player.get("id")
        if pid not in id_map:
            # Skip players we don't have a mapping for
            continue
        espn_id = id_map[pid]
        # Quick check: if all four fields already non-zero we could skip,
        # but we just update anyway (overwrites with fresh data).
        update_player_stats(player, espn_id)
        updated += 1
    save_json_file(json_path, data)
    print(f"   [OK] Updated {updated}/{len(data)} players with ESPN data.")
    return updated

def main():
    if not DATA_DIR.is_dir():
        print(f"[ERROR] Data directory {DATA_DIR} not found.")
        sys.exit(1)

    id_map = load_id_map()
    print(f"Loaded {len(id_map)} ID mappings from {MAP_FILE}")

    json_files = list(DATA_DIR.glob("*.json"))
    if not json_files:
        print(f"[ERROR] No JSON files found in {DATA_DIR}")
        sys.exit(1)

    total_updated = 0
    for jf in json_files:
        total_updated += process_file(jf, id_map)

    print(f"\n[INFO] All done. Total player updates: {total_updated}")
    print("[INFO] Tip: After this runs, you can compute strike-rates in your UI:")
    print("       Batting SR = (testRuns / ballsFaced) * 100")
    print("       Bowling SR = deliveriesBowled / testWickets  (if testWickets > 0)")

if __name__ == "__main__":
    main()