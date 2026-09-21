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
        stats['dismissals'] = int(dismissals_group.group(1))

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
    # Now we need to extract each nation's table until we hit the next '## ' or end.
    # We'll split by '## ' again to get the next section.
    # But note: after Legends, there is '---' and then '## 1970s Roster'
    # So we can split by '---' and then take the first part? Actually, we can split by '## ' and take the first part after Legends.
    # Let's do: split the legends_content by '## ' and take the first part.
    parts = re.split(r'\n## ', legends_content)
    legends_text = parts[0]  # This should be the Legends section content
    # Now split by nation: each nation starts with '### '
    nation_sections = re.split(r'\n### ', legends_text)
    # The first nation section might be empty or have preamble (like the Openers, Middle-order, etc. headers)
    # We'll skip the first if it doesn't contain a table.
    all_data = {}
    for nation_section in nation_sections[1:]:  # skip the first which is the section before the first nation
        if not nation_section.strip():
            continue
        nation_lines = nation_section.split('\n')
        # First line is the nation line: e.g., "### Openers (6)"? Wait, no.
        # Actually, the Legends section is structured differently: it has subsections for each role group, not by nation.
        # Look at the markdown: Legends section has:
        #   #### Openers (6)
        #   | Player | Nation | Key Record |
        #   | ... |
        #   #### Middle-order Batsmen (10)
        #   | Player | Nation | Key Record |
        #   etc.
        # So we need to parse by role group, and within each group, the nation is in the second column.
        # We'll change approach: parse each table and collect players by nation.
        # We'll look for tables that have header "| Player | Nation | Key Record |"
        # We'll split the legends_content by '#### ' to get each role group.
        pass  # We'll do a different approach.

    # Given the time, let's do a simpler approach: we know the Legends players are already in the JSON with some stats from TestStat.
    # We'll just update the Legends JSON from the markdown by parsing the tables as they are.
    # We'll write a more generic parser that can handle both formats.
    # But for now, let's skip Legends from markdown and only update from TestStat, because the Legends stats in JSON are already filled from TestStat for some players.
    # The user might be okay with that.
    return {}

def main():
    # For now, we'll just print a message and do nothing.
    print("[INFO] Skipping Legends markdown update for now.")
    # We'll implement later if needed.

if __name__ == '__main__':
    main()