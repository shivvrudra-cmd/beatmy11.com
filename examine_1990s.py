#!/usr/bin/env python3
import json
from pathlib import Path

DATA_DIR = Path("src/data")
json_path = DATA_DIR / "1990s.json"
with json_path.open(encoding='utf-8') as f:
    data = json.load(f)

print(f"Total players: {len(data)}")
# Let's look at the first 5 players
for i, player in enumerate(data[:5]):
    print(f"\nPlayer {i+1}: {player['name']} (id: {player['id']})")
    stats = player.get('stats', {})
    for key, value in stats.items():
        print(f"  {key}: {value}")

# Let's also check for players that have zero matches (should be filled from TestStat by name)
zero_matches = [p for p in data if p.get('stats', {}).get('testMatches', 0) == 0]
print(f"\nPlayers with zero matches: {len(zero_matches)}")
if zero_matches:
    print("First 5:")
    for p in zero_matches[:5]:
        print(f"  {p['name']} (id: {p['id']})")

# Check for players that have zero centuries
zero_centuries = [p for p in data if p.get('stats', {}).get('testCenturies', 0) == 0]
print(f"\nPlayers with zero centuries: {len(zero_centuries)}")
if zero_centuries:
    print("First 5:")
    for p in zero_centuries[:5]:
        print(f"  {p['name']} (id: {p['id']})")

# Check for players that have zero fifties
zero_fifties = [p for p in data if p.get('stats', {}).get('testFifties', 0) == 0]
print(f"\nPlayers with zero fifties: {len(zero_fifties)}")
if zero_fifties:
    print("First 5:")
    for p in zero_fifties[:5]:
        print(f"  {p['name']} (id: {p['id']})")

# Check for players that have zero wickets (but note: batsmen should have zero wickets)
zero_wickets = [p for p in data if p.get('stats', {}).get('testWickets', 0) == 0]
print(f"\nPlayers with zero wickets: {len(zero_wickets)}")
if zero_wickets:
    print("First 5:")
    for p in zero_wickets[:5]:
        print(f"  {p['name']} (id: {p['id']}) - {p.get('primaryRole', '')}")

# Check for players that have zero runs (should be none after markdown update)
zero_runs = [p for p in data if p.get('stats', {}).get('testRuns', 0) == 0]
print(f"\nPlayers with zero runs: {len(zero_runs)}")
if zero_runs:
    print("First 5:")
    for p in zero_runs[:5]:
        print(f"  {p['name']} (id: {p['id']})")

# Check for players that have zero average (should be none after markdown update)
zero_avg = [p for p in data if p.get('stats', {}).get('testAverage', 0) == 0.0]
print(f"\nPlayers with zero average: {len(zero_avg)}")
if zero_avg:
    print("First 5:")
    for p in zero_avg[:5]:
        print(f"  {p['name']} (id: {p['id']})")