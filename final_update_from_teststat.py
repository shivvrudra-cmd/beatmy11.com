#!/usr/bin/env python3
import json
import csv
from pathlib import Path

DATA_DIR = Path("src/data")
MAP_FILE = Path("id_map.json")
TEST_STAT_FILE = Path("src/data/TestStat.csv")

def load_id_map() -> dict:
    """Load mapping from internal IDs to TestStat numeric IDs."""
    if not MAP_FILE.is_file():
        print(f"[ERROR] Mapping file {MAP_FILE} not found.")
        return {}
    with MAP_FILE.open(encoding="utf-8") as f:
        data = json.load(f)
    # Ensure values are strings
    return {k: str(v) for k, v in data.items()}

def load_teststat_data() -> dict:
    """Load TestStat.csv and return a dict keyed by numeric ID (string)."""
    if not TEST_STAT_FILE.is_file():
        print(f"[ERROR] TestStat file {TEST_STAT_FILE} not found.")
        return {}
    print(f"[INFO] Loading TestStat data from {TEST_STAT_FILE}...")
    players_data = {}
    with TEST_STAT_FILE.open(encoding="utf-8") as f:
        reader = csv.reader(f)
        # Skip metadata lines until we find the header line
        for row in reader:
            if row and row[0] == '' and len(row) > 1 and row[1] == 'Player':
                # This is the header line: ['', 'Player', 'Span', 'Mat', 'Inns', 'NO', 'Runs', 'HS', 'Ave', '100', '50', '0', '', 'Country']
                break
        # Now process the rest of the rows
        for row in reader:
            if not row:
                continue
            # The first column is the numeric ID (as string)
            numeric_id = row[0].strip()
            if not numeric_id:
                continue
            # The row columns: [numeric_id, Player, Span, Mat, Inns, NO, Runs, HS, Ave, 100, 50, 0, , Country]
            # We'll extract the fields we need by index (since we know the header structure)
            # But to be safe, we can also use the header we just read.
            # However, we didn't save the header row. Let's reconstruct the indices from the header we just read.
            # We'll store the header row from the break above.
            pass  # We'll need to redo.

    # Let's do it again but save the header.
    players_data = {}
    with TEST_STAT_FILE.open(encoding="utf-8") as f:
        reader = csv.reader(f)
        header = None
        for row in reader:
            if row and row[0] == '' and len(row) > 1 and row[1] == 'Player':
                header = row
                break
        if header is None:
            print("[ERROR] Could not find header line in TestStat.csv")
            return {}
        # Now process the rest
        for row in reader:
            if not row:
                continue
            numeric_id = row[0].strip()
            if not numeric_id:
                continue
            # Create a dict from header and row
            # But note: the first element of header is empty string due to leading comma.
            # We'll zip header and row, but they may have different lengths if row has extra fields?
            # We'll assume they match.
            row_dict = {}
            for h, v in zip(header, row):
                row_dict[h] = v
            # Now extract the fields we need
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
            players_data[numeric_id] = {
                'testMatches': matches,
                'testRuns': runs,
                'testCenturies': centuries,
                'testFifties': fifties,
                'testAverage': average,
            }
    print(f"[INFO] Loaded {len(players_data)} player records from TestStat.csv")
    return players_data

def main():
    id_map = load_id_map()
    if not id_map:
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
        with json_path.open(encoding="utf-8") as f:
            data = json.load(f)

        updated = 0
        not_found = 0
        for player in data:
            pid = player.get("id")
            if pid not in id_map:
                not_found += 1
                continue
            numeric_id = id_map[pid]
            if numeric_id in teststat_lookup:
                ts = teststat_lookup[numeric_id]
                stats = player.setdefault("stats", {})
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

        with json_path.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"[OK] Era {era}: Updated {updated} players with TestStat data.")
        if not_found > 0:
            print(f"   [WARNING] {not_found} players not found in TestStat.csv (missing mapping or numeric ID not found).")
        total_updated += updated

    print(f"\n[INFO] Total player updates across all eras: {total_updated}")

if __name__ == "__main__":
    main()