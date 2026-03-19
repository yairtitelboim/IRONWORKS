import requests
import json

# Overpass API endpoint
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Query for I-10 segment between Ozona and Fort Stockton
query = """
[out:json][timeout:60];
(
  way[\"ref\"~\"10|I-10|IH 10|US 10\"][\"highway\"~\"trunk|motorway|primary\"](30.6,-103.0,30.95,-101.1);
);
out body;
>;
out skel qt;
"""

def fetch_i10_osm():
    print("Sending Overpass API request...")
    try:
        response = requests.post(OVERPASS_URL, data={'data': query})
        response.raise_for_status()
        data = response.json()
        print(f"Response received. Number of elements: {len(data.get('elements', []))}")
        out_path = "i10_ozona_fortstockton_raw.json"
        with open(out_path, "w") as f:
            json.dump(data, f)
        print(f"Saved raw JSON response to {out_path}")
    except Exception as e:
        print(f"Error fetching or saving OSM data: {e}")

if __name__ == "__main__":
    fetch_i10_osm() 