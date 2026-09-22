import json
import re
import os

# Read beatmy11.md
md_path = 'beatmy11.md'
if not os.path.exists(md_path):
    print(f"Error: {md_path} not found")
    exit(1)

with open(md_path, 'r', encoding='utf-8') as f:
    md_content = f.read()

# Extract the 1980s roster section
pattern = r'## 1980s Roster \(7 Viable Nations\)(.*?)(?:\n## |$)'
match = re.search(pattern, md_content, re.DOTALL)
if not match:
    print("Could not find 1980s roster section")
    exit(1)

section_1980s = match.group(1)

# Split by nation headers (which start with '### ')
nation_blocks = re.split(r'\n### ', section_1980s)
nations = []
for block in nation_blocks:
    if not block.strip():
        continue
    lines = block.split('\n')
    nation_header = lines[0].strip()
    # Extract nation name: remove any leading emoji/flag and take the rest
    # Find the first space after any potential emoji sequence
    # We'll assume the nation name starts after the first space if the first character is not a letter
    if nation_header and not nation_header[0].isalpha():
        space_index = nation_header.find(' ')
        if space_index != -1:
            nation_name = nation_header[space_index+1:].strip()
        else:
            nation_name = nation_header
    else:
        nation_name = nation_header

    # Collect table lines
    table_lines = []
    in_table = False
    for line in lines[1:]:
        stripped = line.strip()
        if stripped.startswith('|'):
            in_table = True
            table_lines.append(line)
        elif in_table and stripped == '':
            # End of table (blank line after table starts)
            break
        else:
            if in_table:
                # We've left the table
                break

    if not table_lines or len(table_lines) < 3:
        continue

    # Skip header and separator
    data_lines = table_lines[2:]
    players = []
    for line in data_lines:
        parts = [part.strip() for part in line.split('|') if part.strip() != '']
        if not parts:
            continue
        player_name = parts[0]
        # Remove any potential footnote markers like [1] but we assume clean names
        players.append(player_name)

    nations.append((nation_name, players))

# Read existing 1980s.json
existing_1980s_path = 'src/data/1980s.json'
if not os.path.exists(existing_1980s_path):
    print(f"Error: {existing_1980s_path} not found")
    exit(1)

with open(existing_1980s_path, 'r', encoding='utf-8') as f:
    existing_1980s = json.load(f)

existing_names = set(player['name'].lower() for player in existing_1980s)

# Read legends.json and 1970s.json
legends_path = 'src/data/legends.json'
seventies_path = 'src/data/1970s.json'
if not os.path.exists(legends_path) or not os.path.exists(seventies_path):
    print("Error: legends.json or 1970s.json not found")
    exit(1)

with open(legends_path, 'r', encoding='utf-8') as f:
    legends = json.load(f)
with open(seventies_path, 'r', encoding='utf-8') as f:
    seventies = json.load(f)

# Build lookup: legends first, then seventies
lookup = {}
for player in legends:
    lookup[player['name'].lower()] = player
for player in seventies:
    if player['name'].lower() not in lookup:
        lookup[player['name'].lower()] = player

# Find missing players
new_players = []
for nation, players in nations:
    for player_name in players:
        key = player_name.lower()
        if key not in existing_names:
            if key in lookup:
                player_obj = lookup[key]
                new_player = player_obj.copy()
                new_player['era'] = '1980s'
                new_players.append(new_player)
            else:
                print(f"Warning: Player '{player_name}' not found in legends or 1970s.json")

# Add new players to existing list
updated_1980s = existing_1980s + new_players

# Write back
with open(existing_1980s_path, 'w', encoding='utf-8') as f:
    json.dump(updated_1980s, f, indent=2)

print(f"Successfully added {len(new_players)} new players to 1980s.json")
if new_players:
    print("Added players:")
    for p in new_players:
        print(f"  - {p['name']} ({p['nation']})")