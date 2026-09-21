#!/usr/bin/env python3
import re
from pathlib import Path

MD_FILE = Path("beatmy11.md")

def extract_players_from_md(content):
    decade_pattern = r'## (\d{4}s) Roster \([^)]+\)(.*?)(?=## |$)'
    decades = re.findall(decade_pattern, content, re.DOTALL)
    all_data = {}
    for era, section in decades:
        nations = re.split(r'### ', section)
        nations = nations[1:]
        era_data = {}
        for nation_block in nations:
            lines = nation_block.strip().split('\n')
            if not lines:
                continue
            nation_line = lines[0]
            nation_name = nation_line.split(' ', 1)[1] if ' ' in nation_line else nation_line
            table_lines = []
            in_table = False
            for line in lines[1:]:
                if line.startswith('| Player | Role | Key Stats |'):
                    in_table = True
                    continue
                if in_table and line.startswith('|') and not line.startswith('| ---'):
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

def parse_key_stats(key_stats: str, role: str):
    stats = {}
    if not key_stats:
        return stats
    dismissals_match = re.search(r'(\d+)\s*dismissals', key_stats, re.IGNORECASE)
    if dismissals_match:
        stats['dismissals'] = int(dismissals_match.group(1))
    key_stats_no_dismiss = re.sub(r'\d+\s*dismissals', '', key_stats, flags=re.IGNORECASE)
    runs_match = re.search(r'(\d{1,3}(?:,\d{3})*)\s*runs\s*(?:@\s*(\d+\.?\d*))?', key_stats_no_dismiss)
    if runs_match:
        runs_str = runs_match.group(1).replace(',', '')
        stats['runs'] = int(runs_str)
        if runs_match.group(2):
            stats['avg'] = float(runs_match.group(2))
    wickets_match = re.search(r'(\d{1,3}(?:,\d{3})*)\s*wickets\s*(?:@\s*(\d+\.?\d*))?', key_stats_no_dismiss)
    if wickets_match:
        wickets_str = wickets_match.group(1).replace(',', '')
        stats['wickets'] = int(wickets_str)
        if wickets_match.group(2):
            stats['bowl_avg'] = float(wickets_match.group(2))
    return stats

with MD_FILE.open(encoding='utf-8') as f:
    content = f.read()

all_data = extract_players_from_md(content)
for era in ['1970s', '1980s', '1990s', '2000s', '2010s', '2020s']:
    if era in all_data:
        print(f"\n=== {era} ===")
        for nation, players in all_data[era].items():
            if players:
                print(f"  {nation}: {len(players)} players")
                # Show first player
                p = players[0]
                print(f"    Example: {p['name']} - {p['role']} - {p['key_stats']}")
                parsed = parse_key_stats(p['key_stats'], p['role'])
                print(f"    Parsed: {parsed}")
    else:
        print(f"\n=== {era} NOT FOUND ===")