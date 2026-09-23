import json
import re

def strip_comments(json_text):
    """Remove JavaScript-style comments from JSON text and fix resulting structure"""
    # Remove single line comments (// ...) but be careful not to create invalid JSON
    lines = json_text.split('\n')
    cleaned_lines = []

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # If line starts with //, it's a comment line
        if stripped.startswith('//'):
            # Check if this is part of a commented-out object that needs special handling
            # Look ahead to see if we have a pattern like:
            #   // {
            #   //   "field": value,
            #   //   ...
            #   // }

            # For now, just skip the comment line
            i += 1
            continue
        else:
            cleaned_lines.append(line)
            i += 1

    # Join back
    result = '\n'.join(cleaned_lines)

    # Now we need to fix the specific issue where we have:
    #   },
    #   "primaryRole": ...
    # which should either be:
    #   },
    #   {   // new object
    #       "primaryRole": ...
    #   },
    # or the fields should be removed entirely

    # Let's take a simpler approach: parse character by character to remove comments
    # but this is getting complex. Let me try a different strategy.

    return result

# Actually, let's just manually fix the known issue and use a more robust approach
def fix_1990s_json(content):
    # Remove the specific problematic commented section
    # Find the commented Gavin Rennie section and remove it entirely

    # Pattern to match the commented Gavin Rennie block
    import re

    # Look for the pattern:
    #   },
    #   // {
    #   //     ... (multiple lines)
    #   //     ...
    #   },
    #   {
    #
    # And replace with just:
    #   },
    #   {

    # Actually, let's just remove lines 2019-2023 (the commented lines) and see what happens
    lines = content.split('\n')

    # Remove the specific comment lines we know are problematic
    # Lines 2019-2023 (0-indexed, so 2018-2022 in array)
    if len(lines) > 2022:
        # Check if these are the comment lines we expect
        if (lines[2018].strip() == '},' and
            lines[2019].strip() == '// {' and
            lines[2020].strip() == '//   "id": "gavin-rennie",' and
            lines[2021].strip() == '//   "name": "Gavin Rennie",' and
            lines[2022].strip() == '//   "nation": "Zimbabwe",' and
            lines[2023].strip() == '//   "era": "1990s",'):

            # Remove lines 2019-2023
            del lines[2019:2024]  # Remove indices 2019,2020,2021,2022,2023

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