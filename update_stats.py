import json
import os

files = [
    r"src/data/legends.json",
    r"src/data/1970s.json",
    r"src/data/1980s.json",
]

def update_file(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    changed = False
    for player in data:
        stats = player.get("stats")
        if not stats:
            stats = {}
            player["stats"] = stats
            changed = True
        # ensure fields exist
        for field, default in [("ballsFaced", 0), ("deliveriesBowled", 0), ("fiveWs", 0), ("tenWs", 0)]:
            if field not in stats:
                stats[field] = default
                changed = True
    if changed:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Updated {path}")
    else:
        print(f"No changes needed for {path}")

if __name__ == "__main__":
    for f in files:
        update_file(f)