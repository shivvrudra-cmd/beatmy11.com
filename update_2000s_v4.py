import json
import re

def fix_1990s_json(content):
    # Remove the specific problematic commented section that's malformed
    # Find the block from line 2019 "// {" through line 2039 "    }" and remove it
    lines = content.split('\n')

    # Find start and end of the problematic block
    start_idx = None
    end_idx = None

    for i, line in enumerate(lines):
        stripped = line.strip()
        if start_idx is None and stripped == '// {':
            start_idx = i
        elif start_idx is not None and stripped == '}':
            # Check if this is the closing brace of the Gavin Rennie object
            # Look at the context - it should be at the right indentation
            if i > start_idx and lines[i-1].strip() == '"dismissals": 0':
                end_idx = i
                break

    # If we found the block, remove it
    if start_idx is not None and end_idx is not None:
        # Remove lines from start_idx to end_idx (inclusive)
        del lines[start_idx:end_idx+1]

    return '\n'.join(lines)

# Load both files
with open('src/data/1990s.json', 'r') as f:
    content_1990s = f.read()
    # Fix the JSON before parsing
    content_1990s = fix_1990s_json(content_1990s)
    players_1990s = json.loads(content_1990s)

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