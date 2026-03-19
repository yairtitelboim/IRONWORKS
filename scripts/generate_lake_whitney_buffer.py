#!/usr/bin/env python3
"""
Generate a 150-foot shoreline buffer for Lake Whitney using the previously
downloaded shoreline GeoJSON (data/lake_whitney_shoreline.geojson).

Requirements (install via pip):
  pip install shapely pyproj
"""
from pathlib import Path
import json

from shapely.geometry import Polygon, mapping
from shapely.ops import transform, unary_union
from pyproj import Transformer

SHORELINE_PATH = Path("data/lake_whitney_shoreline.geojson")
OUTPUT_BUFFER_PATH = Path("data/lake_whitney_shore_buffer_150ft.geojson")
OUTPUT_RING_PATH = Path("data/lake_whitney_shore_ring_150ft.geojson")
PUBLIC_OUTPUT_BUFFER_PATH = Path("public/data/lake_whitney_shore_buffer_150ft.geojson")
PUBLIC_OUTPUT_RING_PATH = Path("public/data/lake_whitney_shore_ring_150ft.geojson")
BUFFER_FT = 150.0

# CRS: WGS84 -> NAD83 / Texas Central (ftUS)
WGS84 = "EPSG:4326"
TEXAS_CENTRAL_FT = "EPSG:2277"


def _build_polygon(coords):
    if not coords:
        return None

    # If coordinates are nested (Polygon -> [shell, holes...])
    if isinstance(coords[0][0], (float, int)):
        shell = coords
        holes = []
    else:
        shell = coords[0]
        holes = coords[1:]

    if not shell or len(shell) < 4:
        return None

    if shell[0] != shell[-1]:
        shell = shell + [shell[0]]

    cleaned_holes = []
    for hole in holes:
        if not hole or len(hole) < 4:
            continue
        if hole[0] != hole[-1]:
            hole = hole + [hole[0]]
        cleaned_holes.append(hole)

    polygon = Polygon(shell, cleaned_holes)
    if not polygon.is_valid:
        polygon = polygon.buffer(0)
    return polygon


def load_shoreline(path: Path):
    data = json.loads(path.read_text())
    polygons = []
    for feature in data["features"]:
        geom = feature["geometry"]
        gtype = geom["type"]
        coords = geom["coordinates"]
        if gtype == "Polygon":
            poly = _build_polygon(coords)
            if poly and not poly.is_empty:
                polygons.append(poly)
        elif gtype == "MultiPolygon":
            for poly_coords in coords:
                poly = _build_polygon(poly_coords)
                if poly and not poly.is_empty:
                    polygons.append(poly)
        else:
            raise ValueError(f"Unsupported geometry type: {gtype}")

    if not polygons:
        raise ValueError("No valid polygons extracted from shoreline GeoJSON.")
    return polygons


def project_geometry(geom, forward=True):
    if forward:
        transformer = Transformer.from_crs(WGS84, TEXAS_CENTRAL_FT, always_xy=True)
    else:
        transformer = Transformer.from_crs(TEXAS_CENTRAL_FT, WGS84, always_xy=True)
    return transform(transformer.transform, geom)


def main():
    if not SHORELINE_PATH.exists():
        raise SystemExit(f"Missing shoreline file: {SHORELINE_PATH}")

    geometries = load_shoreline(SHORELINE_PATH)
    if not geometries:
        raise SystemExit("No shoreline features found in input GeoJSON.")

    # Merge all shoreline polygons
    shoreline_union = unary_union(geometries)

    # Project to feet
    shoreline_projected = project_geometry(shoreline_union, forward=True)

    # Buffer outward by 150 feet
    buffered_projected = shoreline_projected.buffer(BUFFER_FT)

    # Create ring (buffer minus original shoreline)
    ring_projected = buffered_projected.difference(shoreline_projected)

    # Reproject back to WGS84
    buffered_wgs84 = project_geometry(buffered_projected, forward=False)
    ring_wgs84 = project_geometry(ring_projected, forward=False)

    # Write outputs
    buffer_feature = {
        "type": "Feature",
        "properties": {
            "name": "Lake Whitney Shoreline Buffer",
            "distance_ft": BUFFER_FT
        },
        "geometry": mapping(buffered_wgs84)
    }

    ring_feature = {
        "type": "Feature",
        "properties": {
            "name": "Lake Whitney Shoreline Ring",
            "distance_ft": BUFFER_FT
        },
        "geometry": mapping(ring_wgs84)
    }

    buffer_geojson = {
        "type": "FeatureCollection",
        "features": [buffer_feature]
    }

    ring_geojson = {
        "type": "FeatureCollection",
        "features": [ring_feature]
    }

    for path in [OUTPUT_BUFFER_PATH, PUBLIC_OUTPUT_BUFFER_PATH]:
      path.parent.mkdir(parents=True, exist_ok=True)
      path.write_text(json.dumps(buffer_geojson, indent=2))

    for path in [OUTPUT_RING_PATH, PUBLIC_OUTPUT_RING_PATH]:
      path.parent.mkdir(parents=True, exist_ok=True)
      path.write_text(json.dumps(ring_geojson, indent=2))

    print(f"Buffer saved to {OUTPUT_BUFFER_PATH} and {PUBLIC_OUTPUT_BUFFER_PATH}")
    print(f"Shoreline ring saved to {OUTPUT_RING_PATH} and {PUBLIC_OUTPUT_RING_PATH}")


if __name__ == "__main__":
    main()
