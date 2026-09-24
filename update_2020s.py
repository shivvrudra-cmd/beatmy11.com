import json

# Load 2010s.json
with open('src/data/2010s.json', 'r') as f:
    data_2010s = json.load(f)

# Find players with era containing both "2010s" and "2020s"
players_to_transfer = []
for player in data_2010s:
    eras = player.get('era', [])
    if isinstance(eras, str):
        eras = [eras]
    if '2010s' in eras and '2020s' in eras:
        players_to_transfer.append({
            'id': player['id'],
            'stats': player['stats']
        })

print(f"Found {len(players_to_transfer)} players to transfer from 2010s to 2020s")

# Load 2020s.json
with open('src/data/2020s.json', 'r') as f:
    data_2020s = json.load(f)

# Create a dict for quick lookup of existing players in 2020s
existing_players = {player['id']: player for player in data_2020s}

# Update existing players and track new ones to add
updated_count = 0
new_players = []

for player_info in players_to_transfer:
    player_id = player_info['id']
    stats = player_info['stats']

    if player_id in existing_players:
        # Update existing player's stats
        existing_players[player_id]['stats'] = stats
        updated_count += 1
        print(f"Updated stats for {player_id}")
    else:
        # Find the original player from 2010s to get full details
        original_player = None
        for player in data_2010s:
            if player['id'] == player_id:
                original_player = player
                break

        if original_player:
            # Create new player entry for 2020s
            new_player = original_player.copy()
            # Update era to just ["2020s"] for the 2020s file
            new_player['era'] = ["2020s"]
            new_players.append(new_player)
            print(f"Added new player {player_id} to 2020s")

# Add new players to the 2020s data
data_2020s.extend(new_players)

# Save updated 2020s.json
with open('src/data/2020s.json', 'w') as f:
    json.dump(data_2020s, f, indent=2)

print(f"\nSummary:")
print(f"- Updated stats for {updated_count} existing players")
print(f"- Added {len(new_players)} new players")
print(f"- Total players in 2020s.json: {len(data_2020s)}")