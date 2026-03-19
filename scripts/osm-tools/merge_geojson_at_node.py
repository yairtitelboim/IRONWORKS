import geojson
import numpy as np

INTERSECTION = [-100.647867, 30.578935]
I10_PATH = "public/data/i10_ozona_sonora_snapped.geojson"
US277_PATH = "public/data/us277_sonora_rocksprings_snapped.geojson"
I10_OUT = "public/data/i10_ozona_sonora_merged.geojson"
US277_OUT = "public/data/us277_sonora_rocksprings_merged.geojson"

# Helper to check if two points are close
isclose = lambda a, b: np.allclose(a, b, atol=1e-6)

def split_at_node(features, intersection):
    new_features = []
    for f in features:
        coords = f["geometry"]["coordinates"]
        # Find all indices where the intersection node appears
        idxs = [i for i, pt in enumerate(coords) if isclose(pt, intersection)]
        if len(idxs) == 0:
            new_features.append(f)
        else:
            last_idx = 0
            for idx in idxs:
                if idx > last_idx:
                    seg = coords[last_idx:idx+1]
                    if len(seg) > 1:
                        new_features.append(geojson.Feature(
                            geometry=geojson.LineString(seg),
                            properties=f["properties"].copy()
                        ))
                        print(f"Split feature {f['properties'].get('id')} at intersection (segment {last_idx}-{idx}).")
                last_idx = idx
            # Add the remaining segment if any
            if last_idx < len(coords) - 1:
                seg = coords[last_idx:]
                if len(seg) > 1:
                    new_features.append(geojson.Feature(
                        geometry=geojson.LineString(seg),
                        properties=f["properties"].copy()
                    ))
    return new_features

def merge_features(features, intersection):
    merged = []
    skip_next = False
    for i, f in enumerate(features):
        if skip_next:
            skip_next = False
            continue
        coords = f["geometry"]["coordinates"]
        # Try to merge with next feature if they share the intersection node
        if i + 1 < len(features):
            next_coords = features[i+1]["geometry"]["coordinates"]
            if (isclose(coords[-1], intersection) and isclose(next_coords[0], intersection)):
                # Merge
                merged_coords = coords + next_coords[1:]
                merged.append(geojson.Feature(
                    geometry=geojson.LineString(merged_coords),
                    properties={**f["properties"], **features[i+1]["properties"]}
                ))
                skip_next = True
                print(f"Merged features {f['properties'].get('id')} and {features[i+1]['properties'].get('id')} at intersection.")
            else:
                merged.append(f)
        else:
            merged.append(f)
    return merged

# Process I-10
with open(I10_PATH) as f:
    i10 = geojson.load(f)
print(f"I-10: {len(i10['features'])} features before split.")
i10_split = split_at_node(i10["features"], INTERSECTION)
print(f"I-10: {len(i10_split)} features after split.")
i10_merged = merge_features(i10_split, INTERSECTION)
print(f"I-10: {len(i10_merged)} features after merge.")
with open(I10_OUT, "w") as f:
    geojson.dump(geojson.FeatureCollection(i10_merged), f)

# Process US-277
with open(US277_PATH) as f:
    us277 = geojson.load(f)
print(f"US-277: {len(us277['features'])} features before split.")
us277_split = split_at_node(us277["features"], INTERSECTION)
print(f"US-277: {len(us277_split)} features after split.")
us277_merged = merge_features(us277_split, INTERSECTION)
print(f"US-277: {len(us277_merged)} features after merge.")
with open(US277_OUT, "w") as f:
    geojson.dump(geojson.FeatureCollection(us277_merged), f) 