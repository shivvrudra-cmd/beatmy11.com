import requests
import re

# Test with Don Bradman's ID using the HTML page
espn_id = 4188
url = f"https://www.espncricinfo.com/player/{espn_id}/don-bradman-{espn_id}"

print(f"Testing URL: {url}")

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}

try:
    resp = requests.get(url, headers=headers, timeout=30)
    print(f"Status Code: {resp.status_code}")
    print(f"Content-Type: {resp.headers.get('Content-Type', 'Unknown')}")
    if resp.status_code == 200:
        print("SUCCESS: Got 200 OK")
        # Get text content
        text_content = resp.text

        # Look for batting stats using regex patterns
        # Try to extract numbers for Matches, Runs, Balls Faced
        patterns = {
            'Matches': r'[Mm]atch(?:es)?\s*:?\s*(\d+)',
            'Runs': r'[Rr]uns\s*:?\s*(\d+)',
            'Balls Faced': r'[Bb]alls\s+(?:faced|Faced)\s*:?\s*(\d+)',
            'BF': r'BF\s*:?\s*(\d+)',
        }

        results = {}
        for name, pattern in patterns.items():
            match = re.search(pattern, text_content)
            if match:
                results[name] = match.group(1)
                print(f"{name}: {match.group(1)}")

        if results:
            print(f"\nFound stats: {results}")
        else:
            print("Did not find expected stats with regex patterns")
            # Look for any numbers in the text that might be stats
            # Print first 3000 chars to see what we're working with
            print("\nFirst 3000 chars of text content:")
            print(text_content[:3000])
    else:
        print("FAILED: Non-200 status code")
        print(f"First 3000 chars: {resp.text[:3000]}")
except Exception as e:
    print(f"Exception: {e}")
    import traceback
    traceback.print_exc()