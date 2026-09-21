import json
import re
import time
import requests
from bs4 import BeautifulSoup
from duckduckgo_search import DDGS

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def parse_numeric(val_str):
    """Clean string numbers into float or int safely."""
    if not val_str or val_str.strip() in ["-", "", "N/A", "null"]:
        return 0
    clean_str = val_str.replace(",", "").strip()
    match = re.search(r"[-+]?\d*\.\d+|\d+", clean_str)
    if match:
        val = match.group()
        return float(val) if "." in val else int(val)
    return 0

def find_cricinfo_url(player_name):
    """Finds the ESPNCricinfo player profile URL using DuckDuckGo."""
    query = f"{player_name} espncricinfo player profile"
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=3))
            for r in results:
                href = r.get("href", "")
                if "espncricinfo.com/cricket-players/" in href or "espncricinfo.com/player/" in href:
                    return href
    except Exception as e:
        print(f"  └─ Search error: {e}")
    return None

def fetch_player_stats(profile_url):
    """Parses player profile page for Test stats."""
    try:
        response = requests.get(profile_url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(response.text, "html.parser")
        
        fetched_stats = {}
        tables = soup.find_all("table")
        
        for table in tables:
            rows = table.find_all("tr")
            for row in rows:
                cols = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
                if len(cols) > 1 and "Tests" in cols[0]:
                    # Batting Table Mapping: [Format, Mat, Inns, NO, Runs, HS, Ave, BF, SR, 100s, 50s, 4s, 6s, Ct, St]
                    if len(cols) >= 11 and "testRuns" not in fetched_stats:
                        fetched_stats["testMatches"] = parse_numeric(cols[1])
                        fetched_stats["testRuns"] = parse_numeric(cols[4])
                        fetched_stats["testAverage"] = parse_numeric(cols[6])
                        fetched_stats["battingStrikeRate"] = parse_numeric(cols[8])
                        fetched_stats["testCenturies"] = parse_numeric(cols[9])
                        fetched_stats["testFifties"] = parse_numeric(cols[10])
                        
                        catches = parse_numeric(cols[13]) if len(cols) > 13 else 0
                        stumpings = parse_numeric(cols[14]) if len(cols) > 14 else 0
                        fetched_stats["dismissals"] = catches + stumpings

                    # Bowling Table Mapping: [Format, Mat, Inns, Balls, Runs, Wkts, BBI, BBM, Ave, Econ, SR, 4w, 5w, 10w]
                    elif len(cols) >= 13 and "testWickets" not in fetched_stats:
                        fetched_stats["testWickets"] = parse_numeric(cols[5])
                        fetched_stats["testBowlingAverage"] = parse_numeric(cols[8])
                        fetched_stats["bowlingStrikeRate"] = parse_numeric(cols[10])
                        fetched_stats["fiveWs"] = parse_numeric(cols[12])

        return fetched_stats
    except Exception as e:
        print(f"  └─ Profile parsing error: {e}")
        return {}

def process_json_file(input_filename, output_filename):
    """Reads players dataset, populates missing stats, and saves output."""
    with open(input_filename, "r", encoding="utf-8") as f:
        players = json.load(f)

    updated_count = 0

    for idx, player in enumerate(players):
        name = player.get("name")
        print(f"[{idx+1}/{len(players)}] Fetching stats for: {name}...")

        profile_url = find_cricinfo_url(name)
        if not profile_url:
            print(f"  └─ Could not find profile URL for {name}")
            continue

        fetched_stats = fetch_player_stats(profile_url)

        if fetched_stats:
            updated_count += 1
            for key, val in fetched_stats.items():
                if val != 0:
                    player["stats"][key] = val

        # Delay to prevent hitting rate limits
        time.sleep(2)

    with open(output_filename, "w", encoding="utf-8") as f:
        json.dump(players, f, indent=2)

    print(f"\nProcessing complete! Successfully updated {updated_count}/{len(players)} players.")
    print(f"Saved output to: {output_filename}")

if __name__ == "__main__":
    process_json_file("1970s.json", "1970s_updated.json")