import requests
import json

# Overpass API endpoint
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Expanded bounding box for US-277 segment between Sonora, TX and Rocksprings, TX
query = """
[out:json][timeout:60];
(
  way[\"ref\"~\"277\"][\"highway\"~\"primary|secondary|trunk|motorway\"](29.9,-100.9,30.7,-100.5);
);
out body;
>;
out skel qt;
"""

def fetch_277_osm():
    print("Sending Overpass API request for Sonora to Rocksprings (expanded to meet I-10)...")
    try:
        response = requests.post(OVERPASS_URL, data={'data': query})
        response.raise_for_status()
        data = response.json()
        print(f"Response received. Number of elements: {len(data.get('elements', []))}")
        out_path = "us277_sonora_rocksprings_raw.json"
        with open(out_path, "w") as f:
            json.dump(data, f)
        print(f"Saved raw JSON response to {out_path}")
    except Exception as e:
        print(f"Error fetching or saving OSM data: {e}")

if __name__ == "__main__":
    fetch_277_osm() 