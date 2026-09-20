import requests

# Test with Don Bradman's ID using .html instead of .csv
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
        else:
            print("Page may not contain Don Bradman reference")
            # Print first 500 chars to see what we got
            print(f"First 500 chars: {resp.text[:500]}")
    else:
        print("FAILED: Non-200 status code")
        print(f"First 500 chars: {resp.text[:500]}")
except Exception as e:
    print(f"Exception: {e}")