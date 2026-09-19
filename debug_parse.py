import re

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
    # Find the era section
    pattern = rf'## {era_name} Roster \(\d+ Viable Nations\)(.*?)(?=## |$)'
    match = re.search(pattern, content, re.DOTALL)
    if not match:
        print(f"Could not find {era_name} section")
        return []

    section = match.group(1)
    print(f"Section for {era_name} length: {len(section)}")
    print(f"First 200 chars of section: {section[:200]}")

    # Split by nation sections (lines starting with ### )
    nation_sections = re.split(r'\n### ', section)
    print(f"Found {len(nation_sections)} nation sections")

    all_players = []
    for i, nation_section in enumerate(nation_sections):
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
        print(f"  {nation_name}: {len(players)} players")

    return all_players

with open('beatmy11.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Process each era
eras = ["1990s", "2000s", "2010s", "2020s"]

for era in eras:
    print(f"\n=== Processing {era} ===")
    players = extract_era_data(content, era)
    if players:
        print(f"Created {len(players)} players for {era}")
    else:
        print(f"No players found for {era}")
