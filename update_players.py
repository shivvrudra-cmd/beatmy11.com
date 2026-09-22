import json

# Load the source and target files
with open('C:/Users/shiva/BeatMy11.com/src/data/1980s.json', 'r') as f:
    players_1980s = json.load(f)

with open('C:/Users/shiva/BeatMy11.com/src/data/1990s.json', 'r') as f:
    players_1990s = json.load(f)

with open('C:/Users/shiva/BeatMy11.com/src/data/2000s.json', 'r') as f:
    players_2000s = json.load(f)

# Create a dictionary of 1980s players by id for easy lookup
players_1980s_dict = {player['id']: player for player in players_1980s}

# Players to copy from 1980s to 1990s (era contains both 1980s and 1990s)
players_to_copy_1990s = [
    'kepler-wessels',
    'david-boon',
    'allan-border',
    'greg-matthews',
    'merv-hughes',
    'javed-miandad',
    'martin-crowe',
    'kapil-dev',
    'wasim-akram',
    'graham-gooch',
    'mohd-azharuddin',
    'manoj-prabhakar',
    'desmond-haynes',
    'john-emburey',
    'john-wright',
    'saleem-malik'
]

# Player to copy from 1980s to 2000s (era contains 1980s, 1990s, and 2000s)
player_to_copy_2000s = 'steve-waugh'

print("Processing 1990s.json updates...")

# Process 1990s.json updates
updated_1990s = []
existing_ids_1990s = {player['id'] for player in players_1990s}

for player_id in players_to_copy_1990s:
    if player_id in players_1980s_dict:
        player_data = players_1980s_dict[player_id]
        if player_id in existing_ids_1990s:
            print(f"Replacing existing player: {player_id}")
            # Remove existing player
            players_1990s = [p for p in players_1990s if p['id'] != player_id]
            # Add updated player
            players_1990s.append(player_data)
        else:
            print(f"Adding new player: {player_id}")
            players_1990s.append(player_data)
    else:
        print(f"Warning: Player {player_id} not found in 1980s.json")

print("\nProcessing 2000s.json updates...")
# Process 2000s.json updates
if player_to_copy_2000s in players_1980s_dict:
    player_data = players_1980s_dict[player_to_copy_2000s]
    if any(p['id'] == player_to_copy_2000s for p in players_2000s):
        print(f"Replacing existing player: {player_to_copy_2000s}")
        # Remove existing player
        players_2000s = [p for p in players_2000s if p['id'] != player_to_copy_2000s]
        # Add updated player
        players_2000s.append(player_data)
    else:
        print(f"Adding new player: {player_to_copy_2000s}")
        players_2000s.append(player_data)
else:
    print(f"Warning: Player {player_to_copy_2000s} not found in 1980s.json")

# Save updated files
print("\nSaving updated files...")
with open('C:/Users/shiva/BeatMy11.com/src/data/1990s.json', 'w') as f:
    json.dump(players_1990s, f, indent=2)

with open('C:/Users/shiva/BeatMy11.com/src/data/2000s.json', 'w') as f:
    json.dump(players_2000s, f, indent=2)

print("Done!")