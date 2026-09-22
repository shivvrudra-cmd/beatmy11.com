import re
import json

def extract_roster_data():
    with open('beatmy11.md', 'r', encoding='utf-8') as f:
        content = f.read()

    # extract 1980s roster section
    pattern = r'## 1980s Roster \(7 Viable Nations\)(.*?)(?:\n## |$)'
    match = re.search(pattern, content, re.DOTALL)
    if not match:
        return []
    section = match.group(1)

    # split by nation headers
    nation_blocks = re.split(r'\n### ', section)
    players = []

    for block in nation_blocks:
        if not block.strip():
            continue
        lines = block.split('\n')
        # first line is nation header
        nation_header = lines[0].strip()
        # Extract nation name: remove any leading emoji/flag and take the rest
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
        for line in data_lines:
            parts = [part.strip() for part in line.split('|') if part.strip() != '']
            if not parts:
                continue
            player_name = parts[0]
            role = parts[1] if len(parts) > 1 else ''
            key_stats = parts[2] if len(parts) > 2 else ''

            players.append({
                'name': player_name,
                'nation': nation_name,
                'role': role,
                'key_stats': key_stats
            })

    return players

def parse_key_stats(key_stats):
    """Parse key stats string into test statistics dictionary"""
    stats = {
        'testAverage': 0.0,
        'testRuns': 0,
        'testWickets': 0,
        'testMatches': 0,
        'testCenturies': 0,
        'testFifties': 0,
        'fiveWs': 0,
        'tenWs': 0,
        'testBowlingAverage': 0.0,
        'battingStrikeRate': 0.0,
        'bowlingStrikeRate': 0.0,
        'dismissals': 0
    }

    # Extract runs and average
    runs_match = re.search(r'(\d+(?:,\d+)*)\s*runs', key_stats, re.IGNORECASE)
    if runs_match:
        stats['testRuns'] = int(runs_match.group(1).replace(',', ''))

    avg_match = re.search(r'@\s*(\d+\.?\d*)', key_stats)
    if avg_match:
        stats['testAverage'] = float(avg_match.group(1))

    # Extract wickets
    wickets_match = re.search(r'(\d+(?:,\d+)*)\s*wickets', key_stats, re.IGNORECASE)
    if wickets_match:
        stats['testWickets'] = int(wickets_match.group(1).replace(',', ''))

    # Extract matches
    matches_match = re.search(r'(\d+(?:,\d+)*)\s*matches', key_stats, re.IGNORECASE)
    if matches_match:
        stats['testMatches'] = int(matches_match.group(1).replace(',', ''))

    # Extract centuries
    centuries_match = re.search(r'(\d+(?:,\d+)*)\s*centuries', key_stats, re.IGNORECASE)
    if centuries_match:
        stats['testCenturies'] = int(centuries_match.group(1).replace(',', ''))

    # Extract fifties
    fifties_match = re.search(r'(\d+(?:,\d+)*)\s*fifties', key_stats, re.IGNORECASE)
    if fifties_match:
        stats['testFifties'] = int(fifties_match.group(1).replace(',', ''))

    # Extract 5w
    five_ws_match = re.search(r'(\d+(?:,\d+)*)\s*5w', key_stats, re.IGNORECASE)
    if five_ws_match:
        stats['fiveWs'] = int(five_ws_match.group(1).replace(',', ''))

    # Extract 10w
    ten_ws_match = re.search(r'(\d+(?:,\d+)*)\s*10w', key_stats, re.IGNORECASE)
    if ten_ws_match:
        stats['tenWs'] = int(ten_ws_match.group(1).replace(',', ''))

    # Extract dismissals (for wicketkeepers)
    dismissals_match = re.search(r'(\d+(?:,\d+)*)\s*dismissals', key_stats, re.IGNORECASE)
    if dismissals_match:
        stats['dismissals'] = int(dismissals_match.group(1).replace(',', ''))

    # Calculate bowling average if we have wickets and runs conceded
    # This is approximate - we don't have runs conceded directly
    # For now, we'll leave it as 0.0 and let it be calculated later if needed

    return stats

def determine_primary_role(role_str):
    """Determine primary role from role string"""
    role_lower = role_str.lower()
    if 'opener' in role_lower:
        return 'opener'
    elif 'middle-order' in role_lower or 'middle order' in role_lower:
        return 'middle-order'
    elif 'wicketkeeper' in role_lower or 'wicket keeper' in role_lower:
        return 'wicketkeeper'
    elif 'all-rounder' in role_lower or 'all rounder' in role_lower:
        return 'all-rounder'
    elif 'fast bowler' in role_lower or 'fast-bowler' in role_lower:
        return 'fast-bowler'
    elif 'spinner' in role_lower:
        return 'spinner'
    else:
        # Default to middle-order if unclear
        return 'middle-order'

def determine_secondary_roles(role_str, primary_role):
    """Determine secondary roles from role string"""
    secondary = []
    role_lower = role_str.lower()

    # Check for multiple roles
    if 'opener' in role_lower and primary_role != 'opener':
        secondary.append('opener')
    if ('middle-order' in role_lower or 'middle order' in role_lower) and primary_role != 'middle-order':
        secondary.append('middle-order')
    if ('wicketkeeper' in role_lower or 'wicket keeper' in role_lower) and primary_role != 'wicketkeeper':
        secondary.append('wicketkeeper')
    if ('all-rounder' in role_lower or 'all rounder' in role_lower) and primary_role != 'all-rounder':
        secondary.append('all-rounder')
    if ('fast bowler' in role_lower or 'fast-bowler' in role_lower) and primary_role != 'fast-bowler':
        secondary.append('fast-bowler')
    if 'spinner' in role_lower and primary_role != 'spinner':
        secondary.append('spinner')

    return secondary

def slugify(name):
    """Convert name to slug format"""
    return name.lower().replace(' ', '-').replace('.', '')

def main():
    # Get missing players from check_missing.py output
    missing_players = [
        'Saleem Malik', 'Phil Simmons', 'Richie Richardson', 'Gus Logie', 'Carl Hooper',
        'Courtney Walsh', 'Roger Harper', 'Bruce Edgar', 'Andrew Jones', 'Jeremy Coney',
        'John Reid', 'Stephen Boock', 'Ian Smith', 'Chris Cairns', 'Martin Snedden',
        'Danny Morrison', 'Willie Watson', 'Sidath Wettimuny', 'Brendon Kuruppu',
        'Aravinda de Silva', 'Arjuna Ranatunga', 'Roy Dias', 'Duleep Mendis',
        'Rumesh Ratnayake', 'Asanka Gurusinha', 'Amal Silva', 'Ravi Ratnayeke',
        'Graeme Labrooy', 'Somachandra de Silva', 'Lalith Kaluperuma', 'Asoka de Silva'
    ]

    # Extract all roster data
    all_roster_players = extract_roster_data()

    # Filter for missing players
    missing_player_data = []
    for player in all_roster_players:
        if player['name'] in missing_players:
            missing_player_data.append(player)

    print(f"Found {len(missing_player_data)} missing players")

    # Generate player objects
    new_players = []
    for player_data in missing_player_data:
        stats = parse_key_stats(player_data['key_stats'])
        primary_role = determine_primary_role(player_data['role'])
        secondary_roles = determine_secondary_roles(player_data['role'], primary_role)

        # Special handling for some players based on known data
        name = player_data['name']
        nation = player_data['nation']

        # Override stats for known players where we can extract better data from key_stats
        # This is a simplified approach - in reality we'd want more accurate stats

        player_obj = {
            'id': slugify(name),
            'name': name,
            'nation': nation,
            'era': '1980s',
            'primaryRole': primary_role,
            'secondaryRoles': secondary_roles,
            'stats': stats
        }

        new_players.append(player_obj)
        print(f"Added: {name} ({nation}) - {primary_role}")

    # Load existing 1980s.json
    with open('src/data/1980s.json', 'r', encoding='utf-8') as f:
        existing_data = json.load(f)

    # Combine existing and new players
    updated_data = existing_data + new_players

    # Write back to file
    with open('src/data/1980s.json', 'w', encoding='utf-8') as f:
        json.dump(updated_data, f, indent=2)

    print(f"\nSuccessfully added {len(new_players)} players to 1980s.json")
    print(f"Total players now: {len(updated_data)}")

if __name__ == '__main__':
    main()