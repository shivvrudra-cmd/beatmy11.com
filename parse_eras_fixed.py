import re
import json

def parse_markdown_table(lines):
    """Parse a markdown table and return list of rows"""
    # Find the header line
    header_idx = -1
    for i, line in enumerate(lines):
        if line.strip().startswith('| Player | Role | Key Stats |'):
            header_idx = i
            break

    if header_idx == -1:
        return []

    # Skip the separator line (usually the next line)
    data_lines = []
    for i in range(header_idx + 2, len(lines)):
        line = lines[i].strip()
        if not line.startswith('|'):
            break
        data_lines.append(line)

    # Parse each data line
    players = []
    for line in data_lines:
        # Split by | and remove empty first and last elements
        parts = [p.strip() for p in line.split('|')[1:-1]]
        if len(parts) >= 3:
            player_name = parts[0]
            role = parts[1]
            key_stats = parts[2]

            # Generate ID from player name
            player_id = re.sub(r'[^a-z0-9]+', '-', player_name.lower()).strip('-')

            # Parse roles
            roles = [r.strip() for r in role.split('/')]
            primaryRole = roles[0]
            secondaryRoles = roles[1:] if len(roles) > 1 else []

            player = {
                "id": player_id,
                "name": player_name,
                "nation": "",  # Will be filled by caller
                "era": "",     # Will be filled by caller
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

    return players

def extract_era_data(content, era_name):
    """Extract all nation data for a given era"""
    # Find the era section header
    header_pattern = f'## {era_name} Roster ('
    start_idx = content.find(header_pattern)
    if start_idx == -1:
        print(f"Could not find {era_name} section")
        return []

    # Move past the header line to find the actual content
    # Find the end of the header line
    header_end = content.find('\n', start_idx)
    if header_end == -1:
        header_end = len(content)

    # Skip the header line and any blank lines that follow
    content_after_header = content[header_end:].lstrip('\n')

    # Now we need to find where this era section ends
    # Look for the next era header (## ) or end of content
    next_era_idx = content_after_header.find('## ')
    if next_era_idx == -1:
        era_section = content_after_header
    else:
        era_section = content_after_header[:next_era_idx]

    # Split by nation sections (lines starting with ### )
    # We need to be careful about the splitting - split on '\n### '
    # but preserve the content after it
    nation_sections = re.split(r'\n### ', era_section)

    all_players = []
    for nation_section in nation_sections:
        if not nation_section.strip():
            continue

        lines = nation_section.strip().split('\n')
        if not lines:
            continue

        # First line is the nation header (e.g., "### 🇦🇺 Australia")
        nation_header = lines[0]
        # Remove the leading "### "
        if nation_header.startswith('### '):
            nation_header = nation_header[4:]
        # Split by space once to separate flag from nation name
        parts = nation_header.split(' ', 1)
        if len(parts) == 2:
            nation_name = parts[1]
        else:
            nation_name = parts[0]  # fallback

        # The rest is the table
        table_lines = lines[1:]
        players = parse_markdown_table(table_lines)

        # Set nation and era for each player
        for player in players:
            player["nation"] = nation_name
            player["era"] = era_name

        all_players.extend(players)

    return all_players

with open('beatmy11.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Process each era
eras = ["1990s", "2000s", "2010s", "2020s"]

for era in eras:
    players = extract_era_data(content, era)
    if players:
        with open(f'src/data/{era}.json', 'w', encoding='utf-8') as f:
            json.dump(players, f, indent=2)
        print(f"Created {len(players)} players for {era}")
    else:
        print(f"No players found for {era}")