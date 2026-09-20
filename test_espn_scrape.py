import requests
from bs4 import BeautifulSoup
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
        # Parse with BeautifulSoup
        soup = BeautifulSoup(resp.text, 'html.parser')

        # Look for stats - try to find career stats section
        # This is a simplified approach - we'll look for text patterns
        text_content = soup.get_text()

        # Look for batting stats
        if 'Matches' in text_content and 'Runs' in text_content:
            print("Found Matches and Runs in text")

            # Try to extract numbers using regex
            # Look for patterns like "Mat: 52" or "Matches: 52"
            mat_pattern = r'[Mm]atch(?:es)?\s*:?\s*(\d+)'
            runs_pattern = r'[Rr]uns\s*:?\s*(\d+)'
            bf_pattern = r'[Bb]alls\s*:?\s*(\d+)'

            mat_match = re.search(mat_pattern, text_content)
            runs_match = re.search(runs_pattern, text_content)
            bf_match = re.search(bf_pattern, text_content)

            if mat_match:
                print(f"Matches: {mat_match.group(1)}")
            if runs_match:
                print(f"Runs: {runs_match.group(1)}")
            if bf_match:
                print(f"Balls: {bf_match.group(1)}")

            # Print first 2000 chars of text to see what we're working with
            print("\nFirst 2000 chars of text content:")
            print(text_content[:2000])
        else:
            print("Did not find expected stats keywords")
            # Print first 2000 chars to see what we got
            print("\nFirst 2000 chars of text content:")
            print(text_content[:2000])
    else:
        print("FAILED: Non-200 status code")
        print(f"First 2000 chars: {resp.text[:2000]}")
except Exception as e:
    print(f"Exception: {e}")
    import traceback
    traceback.print_exc()