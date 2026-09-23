# Simple fix: remove the problematic commented/uncommented block from 1990s.json

with open('src/data/1990s.json', 'r') as f:
    lines = f.readlines()

# Remove lines 2019 through 2040 (0-indexed: 2018 through 2039)
# These contain the malformed Gavin Rennie section
if len(lines) > 2039:
    del lines[2018:2040]  # Remove indices 2018 through 2039 inclusive

with open('src/data/1990s_fixed.json', 'w') as f:
    f.writelines(lines)

print("Fixed JSON written to src/data/1990s_fixed.json")
print(f"Removed {2040-2018} lines")