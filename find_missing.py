import json
from pathlib import Path

DATA_DIR = Path("src/data")
MAP_FILE = Path("id_map.json")

def load_id_map():
    if not MAP_FILE.is_file():
        return {}
    with MAP_FILE.open(encoding="utf-8") as f:
        data = json.load(f)
    return {k: int(v) for k, v in data.items()}

def get_players_from_file(file_path):
    with file_path.open(encoding="utf-8") as f:
        data = json.load(f)
    return [p["id"] for p in data]

def main():
    id_map = load_id_map()
    print(f"Loaded {len(id_map)} mappings")

    eras = ["1990s", "2000s", "2010s", "2020s"]
    all_players = set()
    for era in eras:
        file_path = DATA_DIR / f"{era}.json"
        if file_path.exists():
            players = get_players_from_file(file_path)
            all_players.update(players)
            print(f"{era}: {len(players)} players")

    print(f"Total unique players: {len(all_players)}")

    mapped_players = set(id_map.keys())
    missing = all_players - mapped_players
    print(f"Missing players: {len(missing)}")

    # Show first 20 missing
    print("\nFirst 20 missing players:")
    for i, player in enumerate(sorted(missing)[:20]):
        print(f"{i+1}. {player}")

if __name__ == "__main__":
    main()