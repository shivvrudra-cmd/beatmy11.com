#!/usr/bin/env python3
with open('beatmy11.md', encoding='utf-8') as f:
    lines = f.readlines()

# Find the 1990s section
for i, line in enumerate(lines):
    if line.strip() == '## 1990s Roster (9 Viable Nations)':
        print(f"Found 1990s section at line {i}")
        # Print from i-2 to i+30
        for j in range(max(0, i-2), min(len(lines), i+30)):
            print(f"{j:4d}: {repr(lines[j].rstrip())}")
        break