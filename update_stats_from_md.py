#!/usr/bin/env python3
import json
import re
from pathlib import Path

DATA_DIR = Path("src/data")
MD_FILE = Path("beatmy11.md")

def parse_key_stats(key_stats: str, role: str):
    """Parse key_stats string to extract relevant stats.
    Returns a dict with possible keys: runs, avg, centuries, fifties, wickets, bowl_avg, dismissals
    """
    stats = {}
    if not key_stats:
        return stats
    # Remove any commas and split by spaces? Better to use regex.
    # Examples:
    # "7,525 runs @ 43.5" -> runs=7525, avg=43.5
    # "5,312 runs" -> runs=5312
    # "4,356 runs, 395 dismissals" -> runs=4356, dismissals=395
    # "708 wickets @ 25.4" -> wickets=708, bowl_avg=25.4
    # "208 wickets" -> wickets=208
    # "5,200 runs, 383 wickets" -> runs=5200, wickets=383
    # "10,099 runs" -> runs=10099
    # "7,975 runs" -> runs=7975
    # "5,768 runs" -> runs=5768
    # "1,381 runs, 130 dismissals" -> runs=1381, dismissals=130
    # "1,692 runs, 147 dismissals" -> runs=1692, dismissals=147
    # "208 wickets" -> wickets=208
    # "185 wickets" -> wickets=185
    # "414 wickets" -> wickets=414
    # "373 wickets" -> wickets=373
    # "178 wickets" -> wickets=178
    # "39 wickets" -> wickets=39
    # "121 wickets" -> wickets=121
    # "71 wickets" -> wickets=71
    # "96 wickets" -> wickets=96
    # "311 wickets" -> wickets=311
    # "58 wickets" -> wickets=58
    # "236 wickets" -> wickets=236
    # "208 wickets" -> wickets=208
    # "185 wickets" -> wickets=185
    # "41 wickets" -> wickets=41
    # "154 dismissals" -> dismissals=154
    # "130 dismissals" -> dismissals=130
    # "147 dismissals" -> dismissals=147
    # "192 dismissals" -> dismissals=192
    # "207 dismissals" -> dismissals=207
    # "627 runs" -> runs=627
    # "3,012 runs" -> runs=3012
    # "5,762 runs" -> runs=5762
    # "3,012 runs" -> runs=3012
    # "7,172 runs" -> runs=7172
    # "4,702 runs" -> runs=4702
    # "3,116 runs" -> runs=3116
    # "3,520 runs, 218 wickets" -> runs=3520, wickets=218
    # "1,685 runs, 143 dismissals" -> runs=1685, dismissals=143
    # "4,531 runs, 362 wickets" -> runs=4531, wickets=362
    # "93 wickets" -> wickets=93
    # "44 wickets" -> wickets=44
    # "98 wickets" -> wickets=98
    # "71 wickets" -> wickets=71
    # "46 wickets" -> wickets=46
    # "3,457 runs" -> runs=3457
    # "2,858 runs" -> runs=2858
    # "1,374 runs" -> runs=1374
    # "4,794 runs @ 51.5" -> runs=4794, avg=51.5
    # "1,974 runs" -> runs=1974
    # "1,374 runs" -> runs=1374
    # "1,147 runs" -> runs=1147
    # "1,990 runs, 229 wickets" -> runs=1990, wickets=229

    # First, look for dismissals pattern: (\d+)\s*dismissals
    dismissals_match = re.search(r'(\d+)\s*dismissals', key_stats, re.IGNORECASE)
    if dismissals_match:
        stats['dismissals'] = int(dismissals_match.group(1))
    # Remove the dismissals part to avoid interference
    key_stats_no_dismiss = re.sub(r'\d+\s*dismissals', '', key_stats, flags=re.IGNORECASE)

    # Look for runs and average: (\d{1,3}(?:,\d{3})*)\s*runs\s*(?:@\s*(\d+\.?\d*))?
    runs_match = re.search(r'(\d{1,3}(?:,\d{3})*)\s*runs\s*(?:@\s*(\d+\.?\d*))?', key_stats_no_dismiss)
    if runs_match:
        runs_str = runs_match.group(1).replace(',', '')
        stats['runs'] = int(runs_str)
        if runs_match.group(2):
            stats['avg'] = float(runs_match.group(2))

    # Look for wickets and average: (\d{1,3}(?:,\d{3})*)\s*wickets\s*(?:@\s*(\d+\.?\d*))?
    wickets_match = re.search(r'(\d{1,3}(?:,\d{3})*)\s*wickets\s*(?:@\s*(\d+\.?\d*))?', key_stats_no_dismiss)
    if wickets_match:
        wickets_str = wickets_match.group(1).replace(',', '')
        stats['wickets'] = int(wickets_str)
        if wickets_match.group(2):
            stats['bowl_avg'] = float(wickets_match.group(2))

    # Look for centuries and fifties: maybe pattern like "(\d+)/(\d+)" for 100s/50s?
    # In the Legends section, we had "50s/100s: 45/34" but in decade rosters, it's not present.
    # We'll skip for now; we can get from TestStat.csv later.
    return stats

def extract_players_from_md(content):
    """Extract all players from the md file, returning a dict:
    {era: {nation: [{name, role, key_stats}]}}
    """
    # We'll split by decade sections
    # Pattern: ## 1970s Roster, ## 1980s Roster, etc.
    decade_pattern = r'## (\d{4}s) Roster \([^)]+\)(.*?)(?=## |$)'
    decades = re.findall(decade_pattern, content, re.DOTALL)
    # Also Legends? We'll handle separately if needed.
    all_data = {}
    for era, section in decades:
        # Now split by nation: ### 🇦🇺 Australia etc.
        nation_pattern = r'### [^\n]+\n([^\n]+\n)*?\| Player \| Role \| Key Stats \|[\s\S]*?(?=### |## |$)'
        # Simpler: split by '### '
        nations = re.split(r'### ', section)
        # First element is preamble
        nations = nations[1:]
        era_data = {}
        for nation_block in nations:
            lines = nation_block.strip().split('\n')
            if not lines:
                continue
            # First line is nation flag and name
            nation_line = lines[0]
            # Extract nation name (everything after first space)
            nation_name = nation_line.split(' ', 1)[1] if ' ' in nation_line else nation_line
            # Find the table lines
            table_lines = []
            in_table = False
            for line in lines[1:]:
                if line.startswith('| Player | Role | Key Stats |'):
                    in_table = True
                    continue
                if in_table and line.startswith('|') and not line.startswith('| ---'):
                    # Data row
                    table_lines.append(line)
                if in_table and line.startswith('##'):
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
                parsed = parse_key_stats(pinfo['key_stats'], pinfo['role'])
                # Update stats
                for key, value in parsed.items():
                    stats[key] = value
                # Ensure we have testMatches from somewhere? We'll leave 0 for now.
                # We'll also ensure we have testCenturies and testFifties from TestStat.csv later.
                # For now, we at least have runs, avg, wickets, bowl_avg, dismissals.
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