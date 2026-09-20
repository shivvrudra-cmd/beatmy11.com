import requests

# Test with Don Bradman's ID using the HTML page
espn_id = 4188
url = f"https://www.espncricinfo.com/ci/content/player/{espn_id}.html"

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
        # Check if the page contains expected text
        if "Don Bradman" in resp.text:
            print("Page contains 'Don Bradman'")
        else:
            print("Page does not contain 'Don Bradman'")
            # Print first 500 chars to see what we got
            print(f"First 500 chars: {resp.text[:500]}")
    else:
        print("FAILED: Non-200 status code")
        print(f"First 500 chars: {resp.text[:500]}")
except Exception as e:
    print(f"Exception: {e}")