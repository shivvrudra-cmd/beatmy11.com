import json
import os

def update_player_stats(file_path):
    """Update player stats in a JSON file"""
    print(f"Processing {file_path}")

    with open(file_path, 'r') as f:
        data = json.load(f)

    # Fields to add with default values
    fields_to_add = {
        "testBowlingAverage": 0.0,
        "battingStrikeRate": 0.0,
        "bowlingStrikeRate": 0.0,
        "dismissals": 0
    }

    # Fields to remove
    fields_to_remove = ["ballsFaced", "deliveriesBowled"]

    updated_count = 0
    for player in data:
        if "stats" in player:
            stats = player["stats"]

            # Add new fields if they don't exist
            for field, default_value in fields_to_add.items():
                if field not in stats:
                    stats[field] = default_value

            # Remove specified fields
            for field in fields_to_remove:
                if field in stats:
                    del stats[field]

            updated_count += 1

    # Write back to file
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"Updated {updated_count} players in {file_path}")
    return updated_count

def main():
    # List of files to process
    files = [
        "src/data/1970s.json",
        "src/data/1980s.json",
        "src/data/1990s.json",
        "src/data/2000s.json",
        "src/data/2010s.json",
        "src/data/2020s.json",
        "src/data/legends.json"
    ]

    total_updated = 0
    for file_path in files:
        if os.path.exists(file_path):
            updated = update_player_stats(file_path)
            total_updated += updated
        else:
            print(f"File not found: {file_path}")

    print(f"\nTotal players updated across all files: {total_updated}")

if __name__ == "__main__":
    main()