import re

with open('beatmy11.md', 'r', encoding='utf-8') as f:
    content = f.read()

era_name = '1990s'
print(f"Looking for era: {era_name}")

# Let's see what the pattern actually looks like
pattern = rf'## {era_name} Roster $$$$\d+ Viable Nations$$$$(.*?)(?=## |$)'
print(f'Pattern: {repr(pattern)}')

# Try to find the marker manually first
start_marker = f'## {era_name} Roster ('
start = content.find(start_marker)
print(f"Start marker '{start_marker}' found at index: {start}")

if start != -1:
    # Find the closing parenthesis
    end_paren = content.find(')', start)
    print(f"Closing parenthesis found at index: {end_paren}")
    if end_paren != -1:
        content_after = content[end_paren+1:]
        # Print ascii-safe representation
        print("First 100 chars after marker:", repr(content_after[:100]).encode('ascii', 'backslashreplace').decode('ascii'))

        # Now look for next ## or end
        next_hash = content_after.find('##')
        if next_hash != -1:
            section = content_after[:next_hash]
            print(f"Section found, length: {len(section)}")
            print("First 200 chars of section:", repr(section[:200]).encode('ascii', 'backslashreplace').decode('ascii'))
        else:
            section = content_after
            print(f"Section to end, length: {len(section)}")
            print("First 200 chars of section:", repr(section[:200]).encode('ascii', 'backslashreplace').decode('ascii'))

# Now try the regex
match = re.search(pattern, content, re.DOTALL)
if match:
    print('Regex MATCH found')
    print(f'Section length: {len(match.group(1))}')
    print("First 200 chars:", repr(match.group(1)[:200]).encode('ascii', 'backslashreplace').decode('ascii'))
else:
    print('Regex NO MATCH')

    # Let's try a simpler pattern without the lookahead
    pattern2 = rf'## {era_name} Roster $$$$\d+ Viable Nations$$$$(.*?)(?=##)'
    print(f'Trying simpler pattern: {repr(pattern2)}')
    match2 = re.search(pattern2, content, re.DOTALL)
    if match2:
        print('Simpler pattern MATCH')
        print(f'Section length: {len(match2.group(1))}')
    else:
        print('Simpler pattern NO MATCH')

        # Let's just try to find the section between the marker and next ##
        if start != -1 and end_paren != -1:
            # Look for next ## after the closing parenthesis
            next_hash = content.find('##', end_paren+1)
            if next_hash != -1:
                section = content[end_paren+1:next_hash]
                print(f'Manual section length: {len(section)}')
                print("First 200 chars:", repr(section[:200]).encode('ascii', 'backslashreplace').decode('ascii'))
            else:
                section = content[end_paren+1:]
                print(f'Manual section to end: {len(section)}')
                print("First 200 chars:", repr(section[:200]).encode('ascii', 'backslashreplace').decode('ascii'))