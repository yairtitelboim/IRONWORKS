#!/usr/bin/env python3
"""
Compute area/perimeter statistics for the Lake Whitney shoreline buffer.
Outputs JSON summary used by GeoAI workflows.

Requirements:
  pip install shapely pyproj
"""
import json
from pathlib import Path

from shapely.geometry import shape
from shapely.ops import transform
from pyproj import Transformer

BUFFER_PATH = Path("data/lake_whitney_shore_buffer_150ft.geojson")
RING_PATH = Path("data/lake_whitney_shore_ring_150ft.geojson")
OUTPUT_STATS_PATH = Path("public/data/lake_whitney_shoreline_stats.json")

WGS84 = "EPSG:4326"
TEXAS_CENTRAL_FT = "EPSG:2277"  # NAD83 / Texas Central (ftUS)


def load_geometry(path: Path):
    data = json.loads(path.read_text())
    return shape(data["features"][0]["geometry"])


def to_projected(geom):
    transformer = Transformer.from_crs(WGS84, TEXAS_CENTRAL_FT, always_xy=True)
    return transform(transformer.transform, geom)


def main():
    if not BUFFER_PATH.exists() or not RING_PATH.exists():
        raise SystemExit("Missing buffer or ring GeoJSON files. Run generate_lake_whitney_buffer.py first.")

    buffer_geom = to_projected(load_geometry(BUFFER_PATH))
    ring_geom = to_projected(load_geometry(RING_PATH))

    shoreline_length_ft = ring_geom.length
    ring_area_sqft = ring_geom.area
    ring_area_acres = ring_area_sqft / 43560.0

    stats = {
        "shoreline": {
            "length_ft": shoreline_length_ft,
            "length_miles": shoreline_length_ft / 5280.0,
            "polygon_count": len(ring_geom.geoms) if ring_geom.geom_type == "MultiPolygon" else 1,
            "buffer_area_sqft": ring_area_sqft,
            "buffer_area_acres": ring_area_acres,
            "buffer_width_ft": 150.0
        }
    }

    OUTPUT_STATS_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_STATS_PATH.write_text(json.dumps(stats, indent=2))
    print(f"Saved shoreline stats to {OUTPUT_STATS_PATH}")


if __name__ == "__main__":
    main()
