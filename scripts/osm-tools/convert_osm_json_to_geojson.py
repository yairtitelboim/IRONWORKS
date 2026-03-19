import json
import geojson
import sys

RAW_PATH = sys.argv[1] if len(sys.argv) > 1 else "i10_ozona_fortstockton_raw.json"
GEOJSON_PATH = sys.argv[2] if len(sys.argv) > 2 else "i10_ozona_fortstockton.geojson"

def convert_osm_to_geojson():
    print(f"Loading OSM JSON from {RAW_PATH}...")
    with open(RAW_PATH) as f:
        data = json.load(f)
    nodes = {el['id']: el for el in data['elements'] if el['type'] == 'node'}
    ways = [el for el in data['elements'] if el['type'] == 'way']
    print(f"Found {len(nodes)} nodes and {len(ways)} ways.")
    features = []
    for way in ways:
        try:
            coords = [(nodes[nid]['lon'], nodes[nid]['lat']) for nid in way['nodes'] if nid in nodes]
            if len(coords) < 2:
                continue
            features.append(geojson.Feature(
                geometry=geojson.LineString(coords),
                properties={
                    "id": way['id'],
                    "tags": way.get('tags', {})
                }
            ))
        except Exception as e:
            print(f"Error processing way {way['id']}: {e}")
    fc = geojson.FeatureCollection(features)
    with open(GEOJSON_PATH, "w") as f:
        geojson.dump(fc, f)
    print(f"Saved {len(features)} features to {GEOJSON_PATH}")

if __name__ == "__main__":
    convert_osm_to_geojson() 