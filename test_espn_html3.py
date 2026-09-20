import requests

# Test with Don Bradman's ID using .html with parameters on stats.cricinfo.com
espn_id = 4188
url = f"https://stats.cricinfo.com/ci/engine/player/{espn_id}.html"
params = "class=1;template=results;type=batting;view=innings"

print(f"Testing URL: {url}")
print(f"Params: {params}")

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
}

try:
    resp = requests.get(url, params=params, headers=headers, timeout=30)
    print(f"Status Code: {resp.status_code}")
    print(f"Content-Type: {resp.headers.get('Content-Type', 'Unknown')}")
    if resp.status_code == 200:
        print("SUCCESS: Got 200 OK")
        # Check if the page contains expected text
        if "Don Bradman" in resp.text or "bradman" in resp.text.lower():
            print("Page contains Don Bradman reference")
            # Look for a table with class="engineTable" or similar
            if '<table' in resp.text:
                print("Page contains a table")
                # Try to find the career averages row
                # We'll just print a snippet around where "Career" appears
                import re
                career_matches = re.findall(r'[^>]*Career[^<]*', resp.text, re.IGNORECASE)
                if career_matches:
                    print(f"Found career mentions: {career_matches[:5]}")
                else:
                    print("No career mentions found")
            else:
                print("Page does not contain a table")
        else:
            print("Page may not contain Don Bradman reference")
            # Print first 1000 chars to see what we got
            print(f"First 1000 chars: {resp.text[:1000]}")
    else:
        print("FAILED: Non-200 status code")
        print(f"First 1000 chars: {resp.text[:1000]}")
except Exception as e:
    print(f"Exception: {e}")