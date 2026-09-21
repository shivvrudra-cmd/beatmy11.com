#!/usr/bin/env python3
import json
import csv
import re
from pathlib import Path

DATA_DIR = Path("src/data")
MAP_FILE = Path("id_map.json")
TEST_STAT_FILE = Path("src/data/TestStat.csv")

def load_id_map() -> dict:
    if not MAP_FILE.is_file():
        print(f"[ERROR] Mapping file {MAP_FILE} not found.")
        return {}
    with MAP_FILE.open(encoding="utf-8") as f:
        data = json.load(f)
    # The values are strings; we'll keep them as strings for lookup.
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
            # The first column is the numeric ID, but the DictReader uses the header.
            # The header does not include the first column? Let's check the header line:
            # ,Player,Span,Mat,Inns,NO,Runs,HS,Ave,100,50,0,,
            # So the first column is empty (the leading comma) and is ignored.
            # Actually, the first column in the CSV is the numeric ID, but the header has an empty first field.
            # Therefore, the DictReader will not have a key for the numeric ID.
            # We need to read the CSV differently: we can use the first column as the key.
            # Let's read the row as a list and take the first element.
            pass  # We'll change approach.

    # Instead, let's read the CSV with csv.reader and use the first column as key.
    print(f"[INFO] Loading TestStat data from {TEST_STAT_FILE}...")
    players_data = {}
    with TEST_STAT_FILE.open(encoding="utf-8") as f:
        reader = csv.reader(f)
        # Find the header line (skip metadata lines)
        lines = list(reader)  # This reads the entire file, but we can do it line by line.
        # We'll reset and do it again.
    # Let's do it properly:
    players_data = {}
    with TEST_STAT_FILE.open(encoding="utf-8") as f:
        lines = f.readlines()
        header_line_idx = 0
        for i, line in enumerate(lines):
            if line.startswith(',Player,Span,Mat,Inns,NO,Runs,HS,Ave,100,50,0,,'):
                header_line_idx = i
                break
        # Now we know the header line index.
        # We'll create a reader that starts from the header line.
        from io import StringIO
        header_and_data = ''.join(lines[header_line_idx:])
        reader = csv.DictReader(StringIO(header_and_data))
        for row in reader:
            # The first column (numeric ID) is not in the header, so we need to get it from the row.
            # Actually, the DictReader will ignore the first column because the header doesn't have a name for it.
            # We can't get it this way.
            # Let's go back to using csv.reader and get the first column by index.
            pass

    # Let's do a simple approach: read the CSV with csv.reader and assume the first column is the numeric ID.
    # We'll skip the header lines until we find the line that starts with ',Player,Span,...'
    # Then, for each subsequent row, the first element is the numeric ID.
    print(f"[INFO] Loading TestStat data from {TEST_STAT_FILE}...")
    players_data = {}
    with TEST_STAT_FILE.open(encoding="utf-8") as f:
        reader = csv.reader(f)
        # Skip metadata lines until we find the header line
        for row in reader:
            if row and row[0] == '' and len(row) > 1 and row[1] == 'Player':
                # This is the header line: ['', 'Player', 'Span', ...]
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
            # We need to map by the header names. Let's get the header from the broken row we broke at.
            # We didn't save the header. Let's redo: we'll read the file once to get the header, then again to get the data.
            # Given the file is not too big, we can read it all.
            break  # We'll break and do it again.

    # Let's read the entire file and split by lines.
    with TEST_STAT_FILE.open(encoding="utf-8") as f:
        lines = f.readlines()
    # Find the header line
    header_line_idx = 0
    for i, line in enumerate(lines):
        if line.startswith(',Player,Span,Mat,Inns,NO,Runs,HS,Ave,100,50,0,,'):
            header_line_idx = i
            break
    # The header line
    header = lines[header_line_idx].strip()
    # Parse the header to get column names
    header_reader = csv.reader([header])
    header_fields = next(header_reader)
    # Now process the data lines
    players_data = {}
    for line in lines[header_line_idx+1:]:
        # Parse the line
        row = csv.reader([line.strip()]).__next__()
        if not row:
            continue
        numeric_id = row[0].strip()
        if not numeric_id:
            continue
        # Create a dict for this player
        player_dict = {}
        for i, field in enumerate(header_fields):
            if i < len(row):
                player_dict[field] = row[i]
            else:
                player_dict[field] = ''
        # Now we have the player dict with keys: '', 'Player', 'Span', 'Mat', 'Inns', 'NO', 'Runs', 'HS', 'Ave', '100', '50', '0', '', 'Country'
        # The first field is empty (the leading comma). We'll ignore it.
        # We want to store by numeric_id.
        players_data[numeric_id] = {
            'testMatches': int(player_dict.get('Mat', 0)) if player_dict.get('Mat', '').isdigit() else 0,
            'testRuns': int(player_dict.get('Runs', 0)) if player_dict.get('Runs', '').isdigit() else 0,
            'testCenturies': int(player_dict.get('100', 0)) if player_dict.get('100', '').isdigit() else 0,
            'testFifties': int(player_dict.get('50', 0)) if player_dict.get('50', '').isdigit() else 0,
            'testAverage': float(player_dict.get('Ave', 0)) if player_dict.get('Ave', '').replace('.','',1).isdigit() else 0.0,
        }

    print(f"[INFO] Loaded {len(players_data)} player records from TestStat.csv")
    return players_data

def main():
    id_map = load_id_map()
    print(f"Loaded {len(id_map)} ID mappings from {MAP_FILE}")
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