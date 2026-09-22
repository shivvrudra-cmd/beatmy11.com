import re
import json

def get_roster_players():
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
        # first line is nation header, skip
        # find table lines
        table_lines = []
        in_table = False
        for line in lines[1:]:
            stripped = line.strip()
            if stripped.startswith('|'):
                in_table = True
                table_lines.append(line)
            elif in_table and stripped == '':
                break
            else:
                if in_table:
                    break
        if len(table_lines) < 3:
            continue
        data_lines = table_lines[2:]  # skip header and separator
        for line in data_lines:
            parts = [p.strip() for p in line.split('|') if p.strip() != '']
            if parts:
                player_name = parts[0]
                role = parts[1] if len(parts) > 1 else ''
                # key stats = parts[2] if exists
                players.append((player_name, role))
    return players

if __name__ == '__main__':
    players = get_roster_players()
    print(f"Found {len(players)} players in roster")
    for p in players:
        print(f"{p[0]} ({p[1]})")