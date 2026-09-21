#!/usr/bin/env python3
import re

with open('beatmy11.md', encoding='utf-8') as f:
    lines = f.readlines()

# Find the 1990s section
for i, line in enumerate(lines):
    if line.strip() == '## 1990s Roster (9 Viable Nations)':
        print(f"Found 1990s section at line {i}")
        # Print the next few lines
        for j in range(i+1, min(i+20, len(lines))):
            print(f"{j:3d}: {repr(lines[j])}")
        break