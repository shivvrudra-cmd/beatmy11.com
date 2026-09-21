import json
import os

def update_era_files():
    # Read legends.json
    with open('src/data/legends.json', 'r') as f:
        legends = json.load(f)

    # Process each legend
    for player in legends:
        # Get the era field
        era_field = player.get('era', [])

        # Convert to list if it's a string
        if isinstance(era_field, str):
            era_field = [era_field]

        # Filter out 'legends' to get the actual eras
        actual_eras = [era for era in era_field if era != 'legends']

        # For each actual era, update the corresponding file
        for era in actual_eras:
            era_file = f'src/data/{era}.json'

            # Check if file exists
            if os.path.exists(era_file):
                # Read the era file
                with open(era_file, 'r') as f:
                    era_data = json.load(f)

                # Create player object for this era (copy from legends but set era to just this era)
                era_player = player.copy()
                era_player['era'] = era

                # Check if player already exists in the era file (by id)
                existing_index = None
                for i, p in enumerate(era_data):
                    if p.get('id') == player.get('id'):
                        existing_index = i
                        break

                # Update or add
                if existing_index is not None:
                    era_data[existing_index] = era_player
                else:
                    era_data.append(era_player)

                # Write back to file
                with open(era_file, 'w') as f:
                    json.dump(era_data, f, indent=2)

                print(f"Updated {player['name']} in {era}.json")
            else:
                print(f"File {era_file} not found for {player['name']}")

if __name__ == '__main__':
    update_era_files()