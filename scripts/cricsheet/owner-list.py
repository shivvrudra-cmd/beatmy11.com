"""
owner-list.py: writes docs/reports/white-ball-owner-list.md, the two short lists the owner fills in:
the most-played bowlers with no known spin/pace type, and players still shown with initials.
Run after scripts/cricsheet/build-white-ball.mjs:  python scripts/cricsheet/owner-list.py
"""
import json

rows = [l for l in open('docs/reports/white-ball-roles-needed.md', encoding='utf-8') if l[:6] in ('| odi ', '| t20i', '| ipl ')]
seen = {}
for l in rows:
    c = [x.strip() for x in l.strip().strip('|').split('|')]
    e = seen.setdefault(c[5], {'name': c[1], 'where': c[2], 'fm': [], 'max': 0, 'wk': 0})
    e['fm'].append(f"{c[0].upper()} {c[3]}")
    e['max'] = max(e['max'], int(c[3]))
    e['wk'] += int(c[4])
top = sorted(seen.items(), key=lambda kv: -kv[1]['max'])[:40]

names = {}
for f in ['odi', 't20i', 'ipl']:
    for p in json.load(open(f'src/data/formats/{f}.json', encoding='utf-8')):
        w = p['name'].split()
        if any(len(x) <= 3 and x.isupper() for x in w[:-1]) and p['stats']['matches'] >= 30:
            e = names.setdefault(p['cricsheetId'], {'name': p['name'], 'where': p.get('nation') or ', '.join(p.get('iplTeams', [])[:3]), 'fm': []})
            e['fm'].append(f"{f.upper()} {p['stats']['matches']}")

L = ['# Two short lists for the owner', '',
     'Reply in chat with the answers (e.g. "1 pace, 2 spin" and "A Sai Sudharsan"). They are stored as owner-supplied facts in `scripts/cricsheet/owner-overrides.json`.', '',
     f'## 1. Spin or pace? The {len(top)} most-played bowlers with no known type', '',
     f'{len(seen)} regular bowlers are left out of the game because no source says whether they bowl spin or pace. These are the ones with the most matches (ball-by-ball matches; older ODI players show only their matches from 2003 on).', '',
     '| # | Player (as listed) | Nation / teams | Matches | Wickets | Your answer |', '|---|---|---|---|---|---|']
for i, (cid, e) in enumerate(top, 1):
    L.append(f"| {i} | {e['name']} | {e['where']} | {', '.join(e['fm'])} | {e['wk']} | |")
L += ['', '## 2. Full names? Players with 30+ matches still shown with initials', '',
      'Give the name fans know them by. Leave any that are right as they are (e.g. AB de Villiers).', '',
      '| Letter | Shown as | Nation / teams | Matches | Should be |', '|---|---|---|---|---|']
for i, (cid, e) in enumerate(sorted(names.items(), key=lambda kv: kv[1]['name'])):
    letter = chr(65 + i) if i < 26 else 'A' + chr(65 + i - 26)
    L.append(f"| {letter} | {e['name']} | {e['where']} | {', '.join(e['fm'])} | |")
open('docs/reports/white-ball-owner-list.md', 'w', encoding='utf-8').write('\n'.join(L) + '\n')
print(len(seen), 'unknown bowlers;', len(top), 'listed;', len(names), 'names with initials')
for l in L[9:21]: print(l)
print('...')
for l in L[-len(names):]: print(l)
