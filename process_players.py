import json, sys, os
filepath = sys.argv[1]
with open(filepath, "r") as f:
    data = json.load(f)
for player in data:
    stats = player.setdefault("stats", {})
    stats.setdefault("ballsFaced", 0)
    stats.setdefault("deliveriesBowled", 0)
    stats.setdefault("fiveWs", 0)
    stats.setdefault("tenWs", 0)
with open(filepath, "w") as f:
    json.dump(data, f, indent=2)
