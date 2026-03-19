import json
from shapely.geometry import LineString, Point, mapping
from shapely.ops import linemerge, split

# File paths
I10_PATH = "public/data/i10_ozona_sonora_snapped.geojson"
US277_PATH = "public/data/us277_sonora_rocksprings_snapped.geojson"
I10_OUT = "public/data/i10_ozona_sonora_trimmed.geojson"
US277_OUT = "public/data/us277_sonora_rocksprings_trimmed.geojson"

# Intersection point (Sonora)
intersection = Point(-100.647867, 30.578935)

def merge_lines(features):
    lines = [LineString(f["geometry"]["coordinates"]) for f in features]
    merged = linemerge(lines)
    if merged.geom_type == "MultiLineString":
        merged = max(merged.geoms, key=lambda l: l.length)
    return merged

def trim_line(line, intersection, from_start=True, ozona_point=None):
    nearest = line.interpolate(line.project(intersection))
    split_lines = split(line, nearest)
    line_parts = [g for g in split_lines.geoms if g.geom_type == "LineString"]
    if not line_parts:
        return line
    if from_start and ozona_point is not None:
        # Pick the segment that contains both Ozona and the intersection
        for seg in line_parts:
            if seg.distance(ozona_point) < 1e-6 and seg.distance(intersection) < 1e-6:
                return seg
        # Fallback: pick the segment whose start is closest to Ozona
        return min(line_parts, key=lambda seg: ozona_point.distance(Point(seg.coords[0])))
    if from_start:
        return line_parts[0]
    else:
        return line_parts[-1]

def trim_line_between(line, point_a, point_b):
    # Project both points onto the line
    dist_a = line.project(point_a)
    dist_b = line.project(point_b)
    # Ensure correct order
    start_dist, end_dist = sorted([dist_a, dist_b])
    # Interpolate points
    start_pt = line.interpolate(start_dist)
    end_pt = line.interpolate(end_dist)
    # Slice the line between these two points
    sliced = split(line, start_pt)
    # Find the segment containing end_pt
    for seg in sliced.geoms:
        if seg.distance(end_pt) < 1e-6 or seg.contains(end_pt):
            final = split(seg, end_pt)
            return final.geoms[0]
    return line

# Load GeoJSONs
with open(I10_PATH) as f:
    i10 = json.load(f)
with open(US277_PATH) as f:
    us277 = json.load(f)

i10_line = merge_lines(i10["features"])
us277_line = merge_lines(us277["features"])

# For I-10: robustly slice from Ozona to intersection
ozona_point = Point(i10_line.coords[0])
i10_trimmed = trim_line_between(i10_line, ozona_point, intersection)
# For US-277: slice from intersection to end (as before)
us277_trimmed = trim_line(us277_line, intersection, from_start=False)

with open(I10_OUT, "w") as f:
    json.dump({
        "type": "Feature",
        "geometry": mapping(i10_trimmed),
        "properties": {}
    }, f)
with open(US277_OUT, "w") as f:
    json.dump({
        "type": "Feature",
        "geometry": mapping(us277_trimmed),
        "properties": {}
    }, f)

print("Trimmed I-10 saved to", I10_OUT)
print("Trimmed US-277 saved to", US277_OUT) 