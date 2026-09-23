import json
import re

def fix_1990s_json(content):
    # Remove the Gavin Rennie commented block (lines 2019-2040 in original, 0-indexed 2018-2039)
    lines = content.split('\n')

    # We know the exact lines to remove based on our earlier analysis
    # But let's make it more robust by searching for the pattern

    # Find the start of the Gavin Rennie commented block
    start_idx = None
    for i, line in enumerate(lines):
        if line.strip() == '// {':
            # Check if the next few lines match the expected pattern
            if (i+1 < len(lines) and '//   "id": "gavin-rennie",' in lines[i+1] and
                i+2 < len(lines) and '//   "name": "Gavin Rennie",' in lines[i+2] and
                i+3 < len(lines) and '//   "nation": "Zimbabwe",' in lines[i+3] and
                i+4 < len(lines) and '//   "era": "1990s",' in lines[i+4]):
                start_idx = i
                break

    if start_idx is not None:
        # Find the end of the block (the closing brace that belongs to this object)
        # We'll look for a line that is just '}' at the same indentation level as the opening brace
        # But since it's commented, we need to be careful.
        # Instead, let's just remove a fixed number of lines based on what we know.
        # From our earlier analysis, the block is 22 lines (from line 2019 to 2040 inclusive)
        # Let's remove 22 lines starting from start_idx
        end_idx = start_idx + 22  # exclusive
        if end_idx <= len(lines):
            del lines[start_idx:end_idx]

    # Now join the lines back
    content = '\n'.join(lines)

    # Fix the missing value for "fiveWs": ,
    # Replace any occurrence of '"fiveWs": ,' with '"fiveWs": 0,'
    content = re.sub(r'"fiveWs":\s*,', '"fiveWs": 0,', content)

    return content

# Load and fix the 1990s.json
with open('src/data/1990s.json', 'r') as f:
    content_1990s = f.read()
    content_1990s = fix_1990s_json(content_1990s)
    players_1990s = json.loads(content_1990s)

# Load the 2000s.json
with open('src/data/2000s.json', 'r') as f:
    players_2000s = json.load(f)

# Create a dictionary of 2000s players by id for easy lookup
players_2000s_dict = {player['id']: player for player in players_2000s}

# Track updates
updates_made = []

# Find players in 1990s with era containing both "1990s" and "2000s"
for player_1990s in players_1990s:
    era = player_1990s.get('era', [])
    # Check if era is a list and contains both "1990s" and "2000s"
    if isinstance(era, list) and '1990s' in era and '2000s' in era:
        player_id = player_1990s['id']
        # Check if this player exists in 2000s.json
        if player_id in players_2000s_dict:
            # Update the stats
            players_2000s_dict[player_id]['stats'] = player_1990s['stats'].copy()
            updates_made.append(player_id)
            print(f"Updated {player_id}: {player_1990s['name']}")
        else:
            print(f"Player {player_id} ({player_1990s['name']}) not found in 2000s.json")
    # Also handle case where era is a string (though unlikely based on data)
    elif isinstance(era, str) and '1990s' in era and '2000s' in era:
        player_id = player_1990s['id']
        if player_id in players_2000s_dict:
            players_2000s_dict[player_id]['stats'] = player_1990s['stats'].copy()
            updates_made.append(player_id)
            print(f"Updated {player_id}: {player_1990s['name']}")
        else:
            print(f"Player {player_id} ({player_1990s['name']}) not found in 2000s.json")

# Save the updated 2000s.json
with open('src/data/2000s.json', 'w') as f:
    json.dump(list(players_2000s_dict.values()), f, indent=2)

print(f"\nTotal updates made: {len(updates_made)}")
print("Updated player IDs:", updates_made)