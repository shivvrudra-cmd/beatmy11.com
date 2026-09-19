import re
import json

with open('beatmy11.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the 1990s section
pattern = r'## 1990s Roster \(9 Viable Nations\)(.*?)(?=## |$)'
match = re.search(pattern, content, re.DOTALL)
if match:
    section = match.group(1)
    # Now we need to extract the tables for each nation
    # Each nation section starts with '### 🇦🇺 Australia' etc.
    # We'll split by '### '
    nations = re.split(r'### ', section)
    # The first element is empty or the text before the first nation
    nations = nations[1:]
    players = []
    for nation in nations:
        # Extract the nation flag and name
        # The first line of the nation is like '🇦🇺 Australia'
        lines = nation.strip().split('\n')
        if not lines:
            continue
        nation_line = lines[0]
        # Extract the nation name from the line (after the flag and space)
        # We'll assume the format is '🇦🇺 Australia' or similar
        # We'll take everything after the first space
        nation_name = nation_line.split(' ', 1)[1] if ' ' in nation_line else nation_line
        # The rest of the nation section is a table
        # We'll look for the table lines
        # The table starts after a line that is '| Player | Role | Key Stats |'
        # and ends before the next nation or the end
        # We'll find the index of the header
        table_lines = []
        in_table = False
        for line in lines[1:]:
            if line.startswith('| Player | Role | Key Stats |'):
                in_table = True
                continue
            if in_table and line.startswith('|') and not line.startswith('| ---'):
                # This is a data row
                table_lines.append(line)
            if in_table and line.startswith('##'):
                break
        # Now parse each table line
        for line in table_lines:
            # Split by '|' and remove empty first and last
            parts = [p.strip() for p in line.split('|')[1:-1]]
            if len(parts) < 3:
                continue
            player_name = parts[0]
            role = parts[1]
            key_stats = parts[2]
            # We need to generate an id from the player name
            # We'll use a simple slug: lowercase, replace spaces and punctuation with hyphens
            player_id = re.sub(r'[^a-z0-9]+', '-', player_name.lower()).strip('-')
            # Determine primaryRole and secondaryRoles from the role string
            # The role string might contain '/' for multiple roles
            roles = [r.strip() for r in role.split('/')]
            primaryRole = roles[0]
            secondaryRoles = roles[1:] if len(roles) > 1 else []
            # Create player object
            player = {
                "id": player_id,
                "name": player_name,
                "nation": nation_name,
                "era": "1990s",
                "primaryRole": primaryRole,
                "secondaryRoles": secondaryRoles,
                "stats": {
                    "testAverage": 0.0,
                    "testRuns": 0,
                    "testWickets": 0,
                    "testMatches": 0,
                    "testCenturies": 0,
                    "testFifties": 0,
                    "ballsFaced": 0,
                    "deliveriesBowled": 0,
                    "fiveWs": 0,
                    "tenWs": 0
                }
            }
            players.append(player)
    # Write to file
    with open('src/data/1990s.json', 'w', encoding='utf-8') as out:
        json.dump(players, out, indent=2)
    print(f"Created {len(players)} players for 1990s")
else:
    print("1990s section not found")