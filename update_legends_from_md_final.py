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

def extract_legends_from_md(content):
    """Extract Legends section from the md file.
    Returns a dict: {nation: [{name, role, key_stats}]}
    """
    # Find the Legends section
    # Pattern: ## Legends Era: 42 Players (LOCKED)
    # We'll split by '## Legends Era:'
    sections = re.split(r'## Legends Era: 42 Players \(LOCKED\)', content)
    if len(sections) < 2:
        print("[WARNING] Legends section not found")
        return {}
    # The content after the marker is in sections[1]
    legends_content = sections[1]
    # Now we need to extract until the next '## ' (which is the 1970s Roster) or end.
    # Split by '\n## ' and take the first part.
    parts = re.split(r'\n## ', legends_content)
    legends_text = parts[0]  # This should be the Legends section content
    # Now split by nation? Actually, Legends is grouped by role, not nation.
    # We'll parse each role group.
    # Split by '#### ' to get each role group (Openers, Middle-order batsmen, etc.)
    role_sections = re.split(r'\n#### ', legends_text)
    # The first element might be empty or a preamble; we'll skip if it doesn't contain a table.
    all_data = {}  # nation -> list of players
    for role_section in role_sections[1:]:  # skip the first
        if not role_section.strip():
            continue
        lines = role_section.split('\n')
        # The first line is the role header, e.g., "Openers (6)"
        # We don't really need the role, but we might want to store it.
        # Find the table: look for the line "| Player | Nation | Key Record |"
        table_started = False
        table_lines = []
        for line in lines[1:]:
            if line.startswith('| Player | Nation | Key Record |'):
                table_started = True
                continue
            if table_started and line.startswith('|') and not line.startswith('| ---'):
                # Data row
                table_lines.append(line)
            if table_started and line.startswith('####'):
                # Next role group
                break
        # Parse each table line
        for line in table_lines:
            parts = [p.strip() for p in line.split('|')[1:-1]]
            if len(parts) < 3:
                continue
            name = parts[0]
            nation = parts[1]
            key_stats = parts[2]
            # Initialize nation list if not present
            if nation not in all_data:
                all_data[nation] = []
            all_data[nation].append({
                'name': name,
                'role': '',  # We don't have the role from the header easily; we could store it but not needed for update.
                'key_stats': key_stats
            })
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
    legends_data = extract_legends_from_md(content)
    if legends_data:
        update_json_file('legends', legends_data)
    else:
        print("[WARNING] No Legends data extracted from md file.")

if __name__ == '__main__':
    main()