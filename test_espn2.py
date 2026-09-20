import requests

# Test with Don Bradman's ID using the stats.espncricinfo.com domain
espn_id = 4188
url = f"http://stats.espncricinfo.com/ci/engine/player/{espn_id}.csv"
params_batting = "class=1;template=results;type=batting;view=innings"

print(f"Testing URL: {url}")
print(f"Params: {params_batting}")

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
}

try:
    resp = requests.get(url, params=params_batting, headers=headers, timeout=30)
    print(f"Status Code: {resp.status_code}")
    print(f"Content-Type: {resp.headers.get('Content-Type', 'Unknown')}")
    print(f"First 200 chars of response: {resp.text[:200]}")

    if resp.status_code == 200:
        print("SUCCESS: Got 200 OK")
        # Check if it's CSV by looking for commas and typical CSV headers
        if ',' in resp.text and ('Runs' in resp.text or 'BF' in resp.text):
            print("Appears to be CSV data")
        else:
            print("Response does not look like CSV")
    else:
        print("FAILED: Non-200 status code")

except Exception as e:
    print(f"Exception: {e}")