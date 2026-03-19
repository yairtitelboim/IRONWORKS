import geojson
import json
import numpy as np

I10_PATH = "public/data/i10_ozona_sonora.geojson"
US277_PATH = "public/data/us277_sonora_rocksprings.geojson"
I10_OUT = "public/data/i10_ozona_sonora_snapped.geojson"
US277_OUT = "public/data/us277_sonora_rocksprings_snapped.geojson"

# Helper to get all coordinates from all features
def get_all_coords(features):
    coords = []
    for f in features:
        coords.extend(f["geometry"]["coordinates"])
    return coords

# Load both GeoJSONs
with open(I10_PATH) as f:
    i10 = geojson.load(f)
with open(US277_PATH) as f:
    us277 = geojson.load(f)

# Get all coordinates from both sets
coords_i10 = get_all_coords(i10["features"])
coords_us277 = get_all_coords(us277["features"])

# Find the intersection node (coordinate shared by both)
intersection = None
for pt1 in coords_i10:
    for pt2 in coords_us277:
        if np.allclose(pt1, pt2, atol=1e-6):
            intersection = pt1
            break
    if intersection is not None:
        break

if intersection is None:
    print("No exact shared node found. Trying to find the closest pair.")
    # Find the closest pair
    min_dist = float("inf")
    for pt1 in coords_i10:
        for pt2 in coords_us277:
            dist = np.linalg.norm(np.array(pt1) - np.array(pt2))
            if dist < min_dist:
                min_dist = dist
                intersection = ((np.array(pt1) + np.array(pt2)) / 2).tolist()
    print(f"Using closest pair, distance: {min_dist}")
else:
    print(f"Found shared intersection node: {intersection}")

# Snap the nearest point on each line to the intersection node
def snap_nearest_point(features, intersection):
    min_dist = float("inf")
    best_feat = None
    best_idx = None
    for f in features:
        coords = f["geometry"]["coordinates"]
        for idx, pt in enumerate(coords):
            dist = np.linalg.norm(np.array(pt) - np.array(intersection))
            if dist < min_dist:
                min_dist = dist
                best_feat = f
                best_idx = idx
    if best_feat is not None:
        print(f"Snapping feature {best_feat['properties'].get('id', '?')} at index {best_idx} to intersection.")
        best_feat["geometry"]["coordinates"][best_idx] = intersection

snap_nearest_point(i10["features"], intersection)
snap_nearest_point(us277["features"], intersection)

with open(I10_OUT, "w") as f:
    geojson.dump(i10, f)
with open(US277_OUT, "w") as f:
    geojson.dump(us277, f)

print(f"Saved snapped I-10 to {I10_OUT}")
print(f"Saved snapped US-277 to {US277_OUT}") 