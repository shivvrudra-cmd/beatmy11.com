#!/usr/bin/env python3
import re

with open('beatmy11.md', encoding='utf-8') as f:
    content = f.read()

# Let's see what the 1990s section looks like by finding it manually
import re
pattern = r'## (\d{4}s) Roster \([^)]+\)(.*?)(?=## |$)'
matches = re.findall(pattern, content, re.DOTALL)
print(f"Found {len(matches)} matches with pattern:")
for era, section in matches:
    print(f"Era: {era}")
    print(f"Section length: {len(section)}")
    print(f"First 200 chars of section: {repr(section[:200])}")
    print()

# Let's also try to split by '## ' and see what we get
sections = re.split(r'## ', content)
print(f"Split by '## ' gives {len(sections)} sections:")
for i, sec in enumerate(sections[:10]):  # first 10
    print(f"{i}: {repr(sec[:100])}")
    if '1990s' in sec:
        print(f"  -> Found 1990s in section {i}")
        # Print the first 500 chars of this section
        print(f"  Section content: {repr(sec[:500])}")