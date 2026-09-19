import re

with open('beatmy11.md', 'r', encoding='utf-8') as f:
    content = f.read()

# Let's manually find the 1990s section
era_name = "1990s"
header_pattern = f'## {era_name} Roster ('
start_idx = content.find(header_pattern)
print(f"Header pattern: {repr(header_pattern)}")
print(f"Start index: {start_idx}")

if start_idx != -1:
    # Find end of header line
    header_end = content.find('\n', start_idx)
    print(f"Header end index: {header_end}")
    if header_end == -1:
        header_end = len(content)

    # Get content after header
    content_after_header = content[header_end:].lstrip('\n')
    # Safe print for unicode
    sample = content_after_header[:100]
    print(f"Content after header first 100 chars: {repr(sample.encode('utf-8'))}")

    # Find next era section
    next_era_idx = content_after_header.find('## ')
    print(f"Next era index: {next_era_idx}")
    if next_era_idx == -1:
        era_section = content_after_header
        print("Taking section to end")
    else:
        era_section = content_after_header[:next_era_idx]
        print(f"Section length: {len(era_section)}")
        # Safe print for unicode
        sample = era_section[:200]
        print(f"Section first 200 chars: {repr(sample.encode('utf-8'))}")

    # Now split by nation sections
    nation_sections = re.split(r'\n### ', era_section)
    print(f"Found {len(nation_sections)} nation sections")

    for i, ns in enumerate(nation_sections[:3]):
        # Safe print for unicode
        sample = ns[:100]
        print(f"Section {i} first 100 chars: {repr(sample.encode('utf-8'))}")
else:
    print("Header not found!")