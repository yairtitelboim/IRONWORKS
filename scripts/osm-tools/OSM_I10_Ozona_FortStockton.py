import overpy
import geojson

# Very small bounding box: (south, west, north, east)
# Focused on a short segment of I-10 between Ozona and Fort Stockton
BBOX = (30.75, -102.3, 30.85, -102.0)

OVERPASS_QUERY = f'''
[out:json][timeout:60];
(
  way["ref"~"10|I-10|IH 10|US 10"]["highway"~"trunk|motorway|primary"]({BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]});
);
out geom;
'''

def download_i10_ozona_fortstockton():
    api = overpy.Overpass()
    print("Querying OSM for I-10 between Ozona and Fort Stockton (small segment)...")
    print("Overpass Query:")
    print(OVERPASS_QUERY)
    try:
        result = api.query(OVERPASS_QUERY)
        print(f"Found {len(result.ways)} ways.")
        features = []
        for way in result.ways:
            print(f"Way ID: {way.id}, tags: {way.tags}, nodes: {len(way.nodes)}")
            coords = [(node.lon, node.lat) for node in way.nodes]
            features.append(geojson.Feature(
                geometry=geojson.LineString(coords),
                properties={
                    "id": way.id,
                    "name": way.tags.get("name", ""),
                    "ref": way.tags.get("ref", ""),
                    "highway": way.tags.get("highway", "")
                }
            ))
        if features:
            fc = geojson.FeatureCollection(features)
            out_path = "i10_ozona_fortstockton.geojson"
            with open(out_path, "w") as f:
                geojson.dump(fc, f)
            print(f"Saved GeoJSON to {out_path}")
        else:
            print("No features to save.")
    except Exception as e:
        print(f"Error during Overpass query or file write: {e}")

if __name__ == "__main__":
    download_i10_ozona_fortstockton() 