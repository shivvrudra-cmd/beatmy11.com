#!/usr/bin/env python3
import json
import re
from pathlib import Path

DATA_DIR = Path("src/data")
MD_FILE = Path("beatmy11.md")

def parse_key_stats(key_stats: str):
    """Parse key_stats string to extract runs, batting average, wickets.
    Returns a dict with keys: 'runs', 'avg', 'wickets'
    """
    stats = {}
    if not key_stats:
        return stats

    # Pattern for runs: numbers possibly with commas, followed by 'runs', optionally followed by '@' and a number (avg)
    runs_match = re.search(r'(\d[\d,]+)\s*runs(?:\s*@\s*(\d+\.?\d*))?', key_stats, re.IGNORECASE)
    if runs_match:
        runs_str = runs_match.group(1).replace(',', '')
        stats['runs'] = int(runs_str)
        if runs_match.group(2):
            stats['avg'] = float(runs_match.group(2))

    # Pattern for wickets: numbers possibly with commas, followed by 'wickets', optionally followed by '@' and a number (bowl avg)
    wickets_match = re.search(r'(\d[\d,]+)\s*wickets(?:\s*@\s*(\d+\.?\d*))?', key_stats, re.IGNORECASE)
    if wickets_match:
        wickets_str = wickets_match.group(1).replace(',', '')
        stats['wickets'] = int(wickets_str)
        # We don't store bowling average in JSON, so we ignore the second group

    # Pattern for dismissals: numbers followed by 'dismissals'
    dismissals_match = re.search(r'(\d+)\s*dismissals', key_stats, re.IGNORECASE)
    if dismissals_match:
        stats['dismissals'] = int(dismissals_match.group(1))

    return stats

def extract_players_from_md(content):
    """Extract all players from the md file, returning a dict:
    {era: {nation: [{name, role, key_stats}]}}
    """
    # We'll split by decade sections
    # Pattern: ## 1970s Roster, ## 1980s Roster, etc.
    # We want to capture the decade and the content until the next "## " or end of string.
    # We'll use a regex that matches from "## <decade> Roster ..." until the next "## " or end.
    # But note: there might be "##" inside the section (like in the table? unlikely).
    # We'll do a simple split by "## " and then check which section we are in.
    sections = re.split(r'\n## ', content)
    # The first section is the preamble (before the first "## ")
    all_data = {}
    for section in sections[1:]:  # skip the preamble
        # The first line of the section is the header: e.g., "1970s Roster (6 Viable Nations)"
        lines = section.split('\n')
        if not lines:
            continue
        header = lines[0]
        # Extract the decade from the header: e.g., "1970s Roster (6 Viable Nations)" -> "1970s"
        match = re.match(r'(\d{4}s)', header)
        if not match:
            continue
        era = match.group(1)
        # The rest of the section is the content for this decade
        decade_content = '\n'.join(lines[1:])
        # Now split the decade content by nation: each nation starts with "### "
        nation_sections = re.split(r'\n### ', decade_content)
        # The first nation section might be empty or have preamble; we'll skip if empty.
        era_data = {}
        for nation_section in nation_sections:
            if not nation_section.strip():
                continue
            nation_lines = nation_section.split('\n')
            # First line is the nation line: e.g., "🇦🇺 Australia"
            nation_line = nation_lines[0]
            # Extract nation name: everything after the first space (to remove the flag emoji)
            # But note: the flag might be more than one character? We'll split by space and take the second part if exists.
            parts = nation_line.split(' ', 1)
            if len(parts) == 2:
                nation_name = parts[1]
            else:
                nation_name = nation_line  # fallback
            # Now find the table: look for the line "| Player | Role | Key Stats |"
            table_started = False
            table_lines = []
            for line in nation_lines[1:]:
                if line.startswith('| Player | Role | Key Stats |'):
                    table_started = True
                    continue
                if table_started and line.startswith('|') and not line.startswith('| ---'):
                    # Data row
                    table_lines.append(line)
                if table_started and line.startswith('##'):
                    # We've hit the next decade's header? Actually, we are inside a nation section, so we break on any new "###" or "##"
                    # But we split by "### " for nations, so we shouldn't see "###" here. However, we might see "##" for the next decade.
                    break
            players = []
            for line in table_lines:
                parts = [p.strip() for p in line.split('|')[1:-1]]
                if len(parts) < 3:
                    continue
                name = parts[0]
                role = parts[1]
                key_stats = parts[2]
                players.append({
                    'name': name,
                    'role': role,
                    'key_stats': key_stats
                })
            era_data[nation_name] = players
        all_data[era] = era_data
    return all_data

def update_json_file(era: str, players_data: dict):
    json_path = DATA_DIR / f"{era}.json"
    if not json_path.exists():
        print(f"[WARNING] {json_path} not found")
        return
    with json_path.open(encoding='utf-8') as f:
        data = json.load(f)
    # Create a mapping from name to player object for easy update
    name_to_player = {}
    for player in data:
        name_to_player[player['name']] = player
    updated = 0
    for nation, players in players_data.items():
        for pinfo in players:
            name = pinfo['name']
            if name in name_to_player:
                player = name_to_player[name]
                stats = player.setdefault('stats', {})
                parsed = parse_key_stats(pinfo['key_stats'])
                # Update stats
                if 'runs' in parsed:
                    stats['testRuns'] = parsed['runs']
                if 'avg' in parsed:
                    stats['testAverage'] = parsed['avg']
                if 'wickets' in parsed:
                    stats['testWickets'] = parsed['wickets']
                # Note: we are not updating dismissals because there's no field in JSON
                updated += 1
    # Write back
    with json_path.open('w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"[OK] Updated {updated} players in {era}.json with stats from md file.")

def main():
    with MD_FILE.open(encoding='utf-8') as f:
        content = f.read()
    all_data = extract_players_from_md(content)
    for era in ['1970s', '1980s', '1990s', '2000s', '2010s', '2020s']:
        if era in all_data:
            update_json_file(era, all_data[era])
        else:
            print(f"[WARNING] No data found for {era}")

if __name__ == '__main__':
    main()