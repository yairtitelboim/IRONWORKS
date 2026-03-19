#!/usr/bin/env python3
"""
Fetch Lake Whitney (Brazos River) shoreline geometry via the Overpass API.

The script queries natural=water relations and ways named "Lake Whitney"
within a bounding box around the reservoir, then exports the result as GeoJSON.
"""
import json
import urllib.request

OUT_PATH = "data/lake_whitney_shoreline.geojson"
BBOX = (31.73, -97.52, 32.05, -97.20)

OVERPASS_TEMPLATE = """
[out:json][timeout:120];
(
  relation["natural"="water"]["name"="Lake Whitney"]({south},{west},{north},{east});
  way["natural"="water"]["name"="Lake Whitney"]({south},{west},{north},{east});
  relation["waterway"="riverbank"]["name"="Lake Whitney"]({south},{west},{north},{east});
  way["waterway"="riverbank"]["name"="Lake Whitney"]({south},{west},{north},{east});
);
out body;
>;
out skel qt;
"""


def fetch_overpass_data(south, west, north, east):
    query = OVERPASS_TEMPLATE.format(south=south, west=west, north=north, east=east)
    data = query.encode("utf-8")
    url = "https://overpass-api.de/api/interpreter"

    with urllib.request.urlopen(url, data=data) as response:
        return json.loads(response.read().decode("utf-8"))


def build_geojson(overpass_json):
    nodes = {
        element["id"]: (element["lon"], element["lat"])
        for element in overpass_json.get("elements", [])
        if element["type"] == "node"
    }

    features = []
    for element in overpass_json.get("elements", []):
        if element["type"] not in {"way", "relation"}:
            continue
        coordinates = []
        if element["type"] == "way":
            coordinates = [nodes[node_id] for node_id in element["nodes"] if node_id in nodes]
        elif element["type"] == "relation":
            for member in element.get("members", []):
                if member["type"] == "way":
                    way = next((w for w in overpass_json["elements"] if w["type"] == "way" and w["id"] == member["ref"]), None)
                    if way:
                        coords = [nodes[node_id] for node_id in way["nodes"] if node_id in nodes]
                        coordinates.append(coords)
            if coordinates and isinstance(coordinates[0][0], (float, int)):
                coordinates = [coordinates]

        if not coordinates:
            continue

        feature = {
            "type": "Feature",
            "geometry": {
                "type": "MultiPolygon" if element["type"] == "relation" else "Polygon",
                "coordinates": [coordinates] if element["type"] == "way" else coordinates
            },
            "properties": {
                "id": element["id"],
                "tags": element.get("tags", {})
            }
        }
        features.append(feature)

    return {
        "type": "FeatureCollection",
        "features": features
    }


def main():
    data = fetch_overpass_data(*BBOX)
    if not data.get("elements"):
        raise SystemExit("No geometry found for Lake Whitney with the current Overpass query.")

    geojson = build_geojson(data)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(geojson, f, indent=2)
    print(f"Saved shoreline GeoJSON to {OUT_PATH} ({len(geojson['features'])} features).")


if __name__ == "__main__":
    main()
