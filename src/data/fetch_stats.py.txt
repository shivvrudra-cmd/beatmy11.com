import json
import re
import time
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager


def setup_driver():
    """Sets up a headless Chrome browser instance."""
    chrome_options = Options()
    chrome_options.add_argument("--headless")  # Run in background without window UI
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
    )

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    return driver


def parse_numeric(val_str):
    """Utility function to clean string numbers into float or int."""
    if not val_str:
        return 0
    # Extract numeric pattern (handles floats like 42.4 and ints like 2683)
    match = re.search(r"[-+]?\d*\.\d+|\d+", str(val_str))
    if match:
        val = match.group()
        return float(val) if "." in val else int(val)
    return 0


def scrape_google_stats(driver, player_name):
    """Executes search on Google and extracts Test cricket statistics."""
    query = f"{player_name} stats"
    search_url = f"https://www.google.com/search?q={query.replace(' ', '+')}"

    driver.get(search_url)
    time.sleep(2)  # Allow dynamic DOM content to load

    soup = BeautifulSoup(driver.page_source, "html.parser")

    # Dictionary to store mapped values
    extracted_stats = {
        "testMatches": 0,
        "testRuns": 0,
        "testAverage": 0.0,
        "testCenturies": 0,
        "testFifties": 0,
        "testWickets": 0,
        "testBowlingAverage": 0.0,
        "fiveWs": 0,
        "battingStrikeRate": 0.0,
        "bowlingStrikeRate": 0.0,
        "dismissals": 0,
    }

    # Search Google table / grid rows for player stats
    rows = soup.find_all(["tr", "div"], class_=True)

    catches, run_outs, stumpings = 0, 0, 0

    for row in rows:
        text = row.get_text(" ", strip=True).lower()

        # Filtering test cricket stats table row entries
        if "test" in text or "tests" in text:
            # Map statistical metrics from text labels
            cells = [cell.get_text(strip=True) for cell in row.find_all(["td", "th", "span"])]
            
            for i, cell in enumerate(cells):
                cell_lower = cell.lower()
                
                # Dynamic matching logic based on common Google layout tags
                if "mat" in cell_lower or "matches" in cell_lower:
                    if i + 1 < len(cells): extracted_stats["testMatches"] = parse_numeric(cells[i+1])
                elif "runs" in cell_lower:
                    if i + 1 < len(cells): extracted_stats["testRuns"] = parse_numeric(cells[i+1])
                elif "hs" in cell_lower or "ave" in cell_lower or "avg" in cell_lower:
                    if i + 1 < len(cells): extracted_stats["testAverage"] = parse_numeric(cells[i+1])
                elif "100" in cell_lower or "100s" in cell_lower:
                    if i + 1 < len(cells): extracted_stats["testCenturies"] = parse_numeric(cells[i+1])
                elif "50" in cell_lower or "50s" in cell_lower:
                    if i + 1 < len(cells): extracted_stats["testFifties"] = parse_numeric(cells[i+1])
                elif "wkts" in cell_lower or "wickets" in cell_lower:
                    if i + 1 < len(cells): extracted_stats["testWickets"] = parse_numeric(cells[i+1])
                elif "5w" in cell_lower or "5i" in cell_lower:
                    if i + 1 < len(cells): extracted_stats["fiveWs"] = parse_numeric(cells[i+1])
                elif "sr" in cell_lower or "strike rate" in cell_lower:
                    if i + 1 < len(cells): extracted_stats["battingStrikeRate"] = parse_numeric(cells[i+1])
                elif "catches" in cell_lower or "ct" in cell_lower:
                    if i + 1 < len(cells): catches = parse_numeric(cells[i+1])
                elif "stumpings" in cell_lower or "st" in cell_lower:
                    if i + 1 < len(cells): stumpings = parse_numeric(cells[i+1])
                elif "run outs" in cell_lower:
                    if i + 1 < len(cells): run_outs = parse_numeric(cells[i+1])

    # Sum dismissals (Catches + Run Outs + Stumpings)
    extracted_stats["dismissals"] = catches + run_outs + stumpings

    return extracted_stats


def process_json_file(input_filename, output_filename):
    """Reads players dataset, populates missing stats, and writes back."""
    with open(input_filename, "r", encoding="utf-8") as f:
        players = json.load(f)

    driver = setup_driver()

    try:
        for idx, player in enumerate(players):
            name = player.get("name")
            print(f"[{idx+1}/{len(players)}] Fetching stats for: {name}...")

            fetched_stats = scrape_google_stats(driver, name)

            # Update stats dictionary preserving existing tenWs
            for key, val in fetched_stats.items():
                if val != 0 or player["stats"].get(key) == 0:
                    player["stats"][key] = val

            time.sleep(1)  # Gentle delay between requests

    finally:
        driver.quit()

    # Write updated data back to file
    with open(output_filename, "w", encoding="utf-8") as f:
        json.dump(players, f, indent=2)

    print(f"\nProcessing complete! File saved as: {output_filename}")


if __name__ == "__main__":
    # Specify your JSON input file name
    process_json_file("1970s.json", "1970s_updated.json")