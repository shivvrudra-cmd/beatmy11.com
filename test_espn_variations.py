import requests

# Test with Don Bradman's ID using different URL formats
espn_id = 4188

urls_to_test = [
    f"https://stats.cricinfo.com/ci/engine/player/{espn_id}.csv?class=1;template=results;type=batting;view=innings",
    f"https://stats.cricinfo.com/ci/engine/player/{espn_id}.csv?class=1;template=results;type=batting",
    f"http://stats.espncricinfo.com/ci/engine/player/{espn_id}.csv?class=1;template=results;type=batting;view=innings",
    f"http://stats.espncricinfo.com/ci/engine/player/{espn_id}.csv?class=1;template=results;type=batting",
    f"https://stats.espncricinfo.com/ci/engine/player/{espn_id}.csv?class=1;template=results;type=batting;view=innings",
    f"https://stats.espncricinfo.com/ci/engine/player/{espn_id}.csv?class=1;template=results;type=batting",
]

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
}

for url in urls_to_test:
    print(f"\nTesting URL: {url}")
    try:
        resp = requests.get(url, headers=headers, timeout=30)
        print(f"  Status Code: {resp.status_code}")
        print(f"  Content-Type: {resp.headers.get('Content-Type', 'Unknown')}")
        if resp.status_code == 200:
            print("  SUCCESS: Got 200 OK")
            # Check if it's CSV by looking for commas and typical CSV headers
            if ',' in resp.text and ('Runs' in resp.text or 'BF' in resp.text or 'Balls' in resp.text):
                print("  Appears to be CSV data")
                # Print first line
                lines = resp.text.strip().split('\n')
                if lines:
                    print(f"  First line: {lines[0]}")
            else:
                print("  Response does not look like CSV")
                print(f"  First 200 chars: {resp.text[:200]}")
        else:
            print("  FAILED: Non-200 status code")
            # Print first 200 chars of error page
            print(f"  First 200 chars: {resp.text[:200]}")
    except Exception as e:
        print(f"  Exception: {e}")