#!/usr/bin/env python3
import json
from pathlib import Path

DATA_DIR = Path("src/data")
MAP_FILE = Path("id_map.json")
TEST_STAT_FILE = Path("src/data/TestStat.csv")

def load_id_map() -> dict:
    if not MAP_FILE.is_file():
        return {}
    with MAP_FILE.open(encoding="utf-8") as f:
        data = json.load(f)
    return {k: str(v) for k, v in data.items()}

def load_teststat_ids() -> set:
    """Return a set of numeric IDs from TestStat.csv (as strings)."""
    ids = set()
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
            numeric_id = row[0].strip()
            if numeric_id:
                ids.add(numeric_id)
    return ids

def main():
    id_map = load_id_map()
    print(f"Loaded {len(id_map)} ID mappings from {MAP_FILE}")
    # Show first 5 mappings
    for k, v in list(id_map.items())[:5]:
        print(f"  {k} -> {v}")
    teststat_ids = load_teststat_ids()
    print(f"TestStat has {len(teststat_ids)} unique numeric IDs")
    # Show first 5 TestStat IDs
    print("First 5 TestStat IDs:", sorted(list(teststat_ids))[:5])
    # Check how many mapping values are in TestStat IDs
    mapping_values = set(id_map.values())
    print(f"Mapping values: {len(mapping_values)} unique values")
    intersection = mapping_values & teststat_ids
    print(f"Intersection size: {len(intersection)}")
    if len(intersection) < len(mapping_values):
        print("Some mapping values not found in TestStat:")
        # Show a few examples
        for v in list(mapping_values - teststat_ids)[:5]:
            print(f"  {v}")
    # Also check if any TestStat IDs are not in mapping values (not needed)
    # Now, let's check a specific player: don-bradman
    pid = "don-bradman"
    if pid in id_map:
        mapped_val = id_map[pid]
        print(f"\n{don-bradman}: maps to {mapped_val}")
        print(f"Is {mapped_val} in TestStat IDs? {mapped_val in teststat_ids}")
    else:
        print(f"{pid} not in id_map")

if __name__ == "__main__":
    main()