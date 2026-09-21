#!/usr/bin/env python3
import json
import re
from pathlib import Path

DATA_DIR = Path("src/data")
MD_FILE = Path("beatmy11.md")

def parse_key_stats_for_wickets_dismissals(key_stats: str):
    """Extract wickets and dismissals from key_stats string.
    Returns a dict with keys 'wickets' and 'dismissals' (may be missing).
    """
    res = {}
    if not key_stats:
        return res
    # Wickets pattern: number possibly with commas, followed by 'wickets'
    wickets_match = re.search(r'(\d[\d,]+)\s*wickets', key_stats, re.IGNORECASE)
    if wickets_match:
        wickets_str = wickets_match.group(1).replace(',', '')
        res['wickets'] = int(wickets_str)
    # Dismissals pattern: number possibly with commas, followed by 'dismissals'
    dismissals_match = re.search(r'(\d[\d,]+)\s*dismissals', key_stats, re.IGNORECASE)
    if dismissals_match:
        dismissals_str = dismissals_match.group(1).replace(',', '')
        res['dismissals'] = int(dismissals_str)
    return res

def extract_player_key_stats_from_md(content):
    """Return a dict mapping player name to key stats string."""
    # We'll use the same extraction logic as before but only keep name and key_stats.
    sections = re.split(r'\n## ', content)
    # Skip preamble
    player_key_stats = {}
    for section in sections[1:]:
        lines = section.split('\n')
        if not lines:
            continue
        header = lines[0]
        # Extract decade from header (not needed)
        # The rest is decade content
        decade_content = '\n'.join(lines[1:])
        # Split by nation
        nation_sections = re.split(r'\n### ', decade_content)
        for nation_section in nation_sections[1:]:  # skip first preamble
            if not nation_section.strip():
                continue
            nation_lines = nation_section.split('\n')
            nation_line = nation_lines[0]
            # Extract nation name (not needed)
            # Find table
            table_started = False
            table_lines = []
            for line in nation_lines[1:]:
                if line.startswith('| Player | Role | Key Stats |'):
                    table_started = True
                    continue
                if table_started and line.startswith('|') and not line.startswith('| ---'):
                    table_lines.append(line)
                if table_started and line.startswith('##'):
                    break
            for line in table_lines:
                parts = [p.strip() for p in line.split('|')[1:-1]]
                if len(parts) < 3:
                    continue
                name = parts[0]
                # role = parts[1]  # not needed
                key_stats = parts[2]
                player_key_stats[name] = key_stats
    return player_key_stats

def update_json_file(json_path: Path, name_to_key_stats: dict):
    print(f"\nProcessing {json_path.name} ...")
    with json_path.open(encoding='utf-8') as f:
        data = json.load(f)
    updated_wickets = 0
    updated_dismissals = 0
    for player in data:
        name = player.get('name', '')
        if not name:
            continue
        key_stats = name_to_key_stats.get(name)
        if not key_stats:
            continue
        parsed = parse_key_stats_for_wickets_dismissals(key_stats)
        stats = player.setdefault('stats', {})
        # Update wickets if found and player is a bowler/all-rounder
        if 'wickets' in parsed:
            # Determine if player is a bowler: check primaryRole and secondaryRoles for bowler-related terms
            role_combined = (player.get('primaryRole', '') + ' ' + ' '.join(player.get('secondaryRoles', []))).lower()
            # Terms that indicate bowling contribution
            bowling_terms = ['bowler', 'all-rounder', 'fast bowler', 'spinner']
            if any(term in role_combined for term in bowling_terms):
                # Only update if current wickets is 0 or we want to always override? We'll override.
                stats['testWickets'] = parsed['wickets']
                updated_wickets += 1
            # else: do not update wickets for pure batsmen (keep as 0)
        # Update dismissals: if found and player is a wicketkeeper
        if 'dismissals' in parsed:
            role_combined = (player.get('primaryRole', '') + ' ' + ' '.join(player.get('secondaryRoles', []))).lower()
            if 'wicketkeeper' in role_combined:
                # Store dismissals in testWickets? We'll store in testWickets for lack of better field.
                stats['testWickets'] = parsed['dismissals']
                updated_dismissals += 1
            # else: ignore
    # Write back
    with json_path.open('w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"   [OK] Updated {updated_wickets} players with wickets from markdown, {updated_dismissals} with dismissals (stored in testWickets).")
    return updated_wickets + updated_dismissals

def main():
    if not DATA_DIR.is_dir():
        print(f"[ERROR] Data directory {DATA_DIR} not found.")
        return
    with MD_FILE.open(encoding='utf-8') as f:
        content = f.read()
    name_to_key_stats = extract_player_key_stats_from_md(content)
    print(f"Extracted key stats for {len(name_to_key_stats)} players from markdown.")
    eras = ['1970s', '1980s', '1990s', '2000s', '2010s', '2020s', 'legends']
    total_updated = 0
    for era in eras:
        json_path = DATA_DIR / f"{era}.json"
        if not json_path.exists():
            print(f"[WARNING] {json_path} not found")
            continue
        total_updated += update_json_file(json_path, name_to_key_stats)
    print(f"\n[INFO] Total updates from markdown (wickets/dismissals): {total_updated}")

if __name__ == "__main__":
    main()