import json
import re
import time
import requests
from bs4 import BeautifulSoup


HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}


def parse_numeric(val_str):
    """Clean string numbers into float or int safely."""
    if not val_str or val_str.strip() in ["-", "", "N/A", null]:
        return 0
    clean_str = val_str.replace(",", "").strip()
    match = re.search(r"[-+]?\d*\.\d+|\d+", clean_str)
    if match:
        val = match.group()
        return float(val) if "." in val else int(val)
    return 0


def get_cricinfo_stats(player_name):
    """Searches ESPNCricinfo directly to extract player's Test career statistics."""
    search_url = f"https://www.espncricinfo.com/ci/content/player/search.html?search={player_name.replace(' ', '+')}"
    
    try:
        response = requests.get(search_url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Find first matching player profile link
        player_link = soup.find("a", href=re.compile(r"/cricket-players/"))
        if not player_link:
            print(f"  └─ Could not locate player profile on Cricinfo for {player_name}")
            return {}

        profile_url = "https://www.espncricinfo.com" + player_link["href"]
        
        # Request player profile page
        prof_res = requests.get(profile_url, headers=HEADERS, timeout=10)
        prof_soup = BeautifulSoup(prof_res.text, "html.parser")
        
        # Scrape Career Statistics Table
        tables = prof_soup.find_all("table")
        
        fetched_stats = {}
        
        for table in tables:
            rows = table.find_all("tr")
            for row in rows:
                cols = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
                if len(cols) > 1 and "Tests" in cols[0]:
                    # Format matches ESPNCricinfo standard table structure
                    # Batting: [Format, Mat, Inns, NO, Runs, HS, Ave, BF, SR, 100s, 50s, 4s, 6s, Ct, St]
                    if len(cols) >= 11:
                        fetched_stats["testMatches"] = parse_numeric(cols[1])
                        fetched_stats["testRuns"] = parse_numeric(cols[4])
                        fetched_stats["testAverage"] = parse_numeric(cols[6])
                        fetched_stats["battingStrikeRate"] = parse_numeric(cols[8])
                        fetched_stats["testCenturies"] = parse_numeric(cols[9])
                        fetched_stats["testFifties"] = parse_numeric(cols[10])
                        
                        # Extract Catches & Stumpings if present in batting table
                        catches = parse_numeric(cols[13]) if len(cols) > 13 else 0
                        stumpings = parse_numeric(cols[14]) if len(cols) > 14 else 0
                        fetched_stats["dismissals"] = catches + stumpings

                elif len(cols) > 1 and "Tests" in cols[0] and "testWickets" not in fetched_stats:
                    # Bowling: [Format, Mat, Inns, Balls, Runs, Wkts, BBI, BBM, Ave, Econ, SR, 4w, 5w, 10w]
                    if len(cols) >= 13:
                        fetched_stats["testWickets"] = parse_numeric(cols[5])
                        fetched_stats["testBowlingAverage"] = parse_numeric(cols[8])
                        fetched_stats["bowlingStrikeRate"] = parse_numeric(cols[10])
                        fetched_stats["fiveWs"] = parse_numeric(cols[12])

        return fetched_stats

    except Exception as e:
        print(f"  └─ Error fetching data for {player_name}: {e}")
        return {}


def process_json_file(input_filename, output_filename):
    """Reads players dataset, populates missing stats, and writes back."""
    with open(input_filename, "r", encoding="utf-8") as f:
        players = json.load(f)

    updated_count = 0

    for idx, player in enumerate(players):
        name = player.get("name")
        print(f"[{idx+1}/{len(players)}] Fetching stats for: {name}...")

        fetched_stats = get_cricinfo_stats(name)

        if fetched_stats:
            updated_count += 1
            for key, val in fetched_stats.items():
                # Update non-zero scraped values
                if val != 0:
                    player["stats"][key] = val

        # Friendly delay to prevent rate-limiting
        time.sleep(1.5)

    # Save to new output file
    with open(output_filename, "w", encoding="utf-8") as f:
        json.dump(players, f, indent=2)

    print(f"\nFinished! Updated {updated_count}/{len(players)} players.")
    print(f"File saved as: {output_filename}")


if __name__ == "__main__":
    process_json_file("1970s.json", "1970s_updated.json")