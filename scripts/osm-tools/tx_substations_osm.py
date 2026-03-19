#!/usr/bin/env python3
"""
Download Texas-wide substations from OpenStreetMap via Overpass.

Why tiled queries:
- A single Texas-wide Overpass query is too large and tends to timeout.
- This script slices Texas into tiles, fetches each tile, and deduplicates
  features across tile boundaries.

Output:
- public/data/texas_osm_substations.geojson
"""

from __future__ import annotations

import argparse
import json
import math
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple

import requests


PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = PROJECT_ROOT / "public" / "data" / "texas_osm_substations.geojson"

OVERPASS_ENDPOINTS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
]

# Texas bounding box (south, west, north, east)
TEXAS_BBOX = (25.83, -106.66, 36.50, -93.50)


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S %Z")
    print(f"[{ts}] {msg}", flush=True)


def build_tiles(bbox: Tuple[float, float, float, float], tile_deg: float) -> List[Tuple[float, float, float, float]]:
    south, west, north, east = bbox
    tiles: List[Tuple[float, float, float, float]] = []
    lat = south
    while lat < north:
        lat2 = min(lat + tile_deg, north)
        lon = west
        while lon < east:
            lon2 = min(lon + tile_deg, east)
            tiles.append((lat, lon, lat2, lon2))
            lon = lon2
        lat = lat2
    return tiles


def overpass_query_for_tile(tile: Tuple[float, float, float, float], timeout_s: int) -> str:
    s, w, n, e = tile
    return f"""
[out:json][timeout:{timeout_s}];
(
  node["power"~"^(substation|sub_station|transformer)$"]({s},{w},{n},{e});
  way["power"~"^(substation|sub_station|transformer)$"]({s},{w},{n},{e});
  node["substation"]({s},{w},{n},{e});
  way["substation"]({s},{w},{n},{e});
);
out body;
>;
out skel qt;
"""


def fetch_overpass(query: str, retries: int = 2) -> Dict:
    last_err = None
    for endpoint in OVERPASS_ENDPOINTS:
        for attempt in range(1, retries + 1):
            try:
                resp = requests.post(
                    endpoint,
                    data={"data": query},
                    timeout=240,
                    headers={"User-Agent": "tx-substations-osm/1.0"},
                )
                if not resp.ok:
                    raise RuntimeError(f"{endpoint} -> HTTP {resp.status_code}")
                return resp.json()
            except Exception as err:
                last_err = err
                log(f"  Overpass error on {endpoint} attempt {attempt}/{retries}: {err}")
                time.sleep(1.0 * attempt)
    raise RuntimeError(f"All Overpass endpoints failed: {last_err}")


def centroid(coords: List[List[float]]) -> List[float]:
    if not coords:
        return [0.0, 0.0]
    x = sum(c[0] for c in coords) / len(coords)
    y = sum(c[1] for c in coords) / len(coords)
    return [x, y]


def midpoint(coords: List[List[float]]) -> List[float]:
    if not coords:
        return [0.0, 0.0]
    mid = len(coords) // 2
    return coords[mid]


def extract_features(payload: Dict) -> List[Dict]:
    elements = payload.get("elements", [])
    nodes = {e["id"]: e for e in elements if e.get("type") == "node"}
    features: List[Dict] = []

    for e in elements:
        e_type = e.get("type")
        tags = e.get("tags") or {}

        if e_type == "node":
            if "power" not in tags and "substation" not in tags:
                continue
            try:
                lon = float(e["lon"])
                lat = float(e["lat"])
            except Exception:
                continue
            features.append(
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [lon, lat]},
                    "properties": {
                        "osm_type": "node",
                        "osm_id": e.get("id"),
                        "name": tags.get("name", ""),
                        "power": tags.get("power", ""),
                        "substation": tags.get("substation", ""),
                        "voltage": tags.get("voltage", ""),
                        "operator": tags.get("operator", ""),
                        "source": "openstreetmap",
                    },
                }
            )
            continue

        if e_type == "way":
            if "power" not in tags and "substation" not in tags:
                continue
            node_ids = e.get("nodes") or []
            coords: List[List[float]] = []
            for nid in node_ids:
                n = nodes.get(nid)
                if not n:
                    continue
                try:
                    coords.append([float(n["lon"]), float(n["lat"])])
                except Exception:
                    continue
            if len(coords) < 2:
                continue

            is_closed = coords[0] == coords[-1] and len(coords) >= 4
            point = centroid(coords[:-1] if is_closed else coords) if is_closed else midpoint(coords)

            features.append(
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": point},
                    "properties": {
                        "osm_type": "way",
                        "osm_id": e.get("id"),
                        "name": tags.get("name", ""),
                        "power": tags.get("power", ""),
                        "substation": tags.get("substation", ""),
                        "voltage": tags.get("voltage", ""),
                        "operator": tags.get("operator", ""),
                        "source": "openstreetmap",
                        "derived_from_geometry": "polygon_centroid" if is_closed else "line_midpoint",
                    },
                }
            )

    return features


def dedupe(features: List[Dict]) -> List[Dict]:
    seen = set()
    out = []
    for f in features:
        p = f.get("properties", {})
        key = (p.get("osm_type"), p.get("osm_id"))
        if key in seen:
            continue
        seen.add(key)
        out.append(f)
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch Texas-wide OSM substations.")
    parser.add_argument("--tile-deg", type=float, default=1.2, help="Tile size in degrees (default: 1.2)")
    parser.add_argument("--sleep", type=float, default=0.4, help="Seconds between tile requests (default: 0.4)")
    parser.add_argument("--timeout", type=int, default=180, help="Overpass timeout per tile query in seconds")
    parser.add_argument("--batch-size", type=int, default=8, help="Number of tiles per batch (default: 8)")
    parser.add_argument("--batch-pause", type=float, default=2.0, help="Seconds between batches (default: 2.0)")
    parser.add_argument("--max-runtime-min", type=float, default=35.0, help="Hard runtime cap in minutes (default: 35)")
    parser.add_argument("--max-tile-seconds", type=float, default=210.0, help="Health warning threshold per tile in seconds (default: 210)")
    parser.add_argument("--start-tile", type=int, default=1, help="1-based tile index to start from (default: 1)")
    parser.add_argument("--end-tile", type=int, default=0, help="1-based tile index to end at, 0 means last tile")
    parser.add_argument("--merge-existing", action="store_true", help="Merge existing output file features before writing")
    args = parser.parse_args()

    tiles = build_tiles(TEXAS_BBOX, args.tile_deg)
    total_tiles = len(tiles)
    start_idx = max(0, args.start_tile - 1)
    end_idx = total_tiles if args.end_tile <= 0 else min(total_tiles, args.end_tile)
    if start_idx >= end_idx:
        raise ValueError(f"Invalid tile range: start={args.start_tile}, end={args.end_tile or total_tiles}")

    selected_tiles = tiles[start_idx:end_idx]
    selected_total = len(selected_tiles)
    max_runtime_s = args.max_runtime_min * 60.0
    started = time.monotonic()
    log(
        "Texas tiling ready: "
        f"{total_tiles} tiles total, running {selected_total} tiles "
        f"(start={args.start_tile}, end={end_idx}), tile size={args.tile_deg}deg, "
        f"batch_size={args.batch_size}, max_runtime={args.max_runtime_min}m"
    )

    all_features: List[Dict] = []
    if args.merge_existing and OUTPUT_PATH.exists():
        try:
            with OUTPUT_PATH.open("r", encoding="utf-8") as f:
                existing = json.load(f)
            existing_features = existing.get("features", [])
            if isinstance(existing_features, list):
                all_features.extend(existing_features)
                log(f"Loaded {len(existing_features)} existing features for merge.")
        except Exception as err:
            log(f"⚠️ Could not load existing output for merge: {err}")

    failures = 0
    tiles_processed = 0
    health_warnings = 0
    stopped_due_to_runtime = False

    for batch_start in range(0, selected_total, args.batch_size):
        elapsed_before_batch = time.monotonic() - started
        if elapsed_before_batch > max_runtime_s:
            stopped_due_to_runtime = True
            log(
                f"⛔ Runtime cap reached before batch start "
                f"({elapsed_before_batch:.1f}s > {max_runtime_s:.1f}s). Stopping."
            )
            break

        batch_tiles = selected_tiles[batch_start: batch_start + args.batch_size]
        batch_idx = (batch_start // args.batch_size) + 1
        batch_total = math.ceil(selected_total / args.batch_size)
        log(f"Starting batch {batch_idx}/{batch_total} with {len(batch_tiles)} tiles")

        for offset, tile in enumerate(batch_tiles, start=1):
            elapsed_now = time.monotonic() - started
            if elapsed_now > max_runtime_s:
                stopped_due_to_runtime = True
                log(
                    f"⛔ Runtime cap reached mid-batch "
                    f"({elapsed_now:.1f}s > {max_runtime_s:.1f}s). Stopping."
                )
                break

            i = start_idx + batch_start + offset
            s, w, n, e = tile
            tile_started = time.monotonic()
            log(f"[{i}/{total_tiles}] Tile bbox=({s:.3f},{w:.3f},{n:.3f},{e:.3f})")
            try:
                q = overpass_query_for_tile(tile, args.timeout)
                data = fetch_overpass(q)
                feats = extract_features(data)
                all_features.extend(feats)
                log(f"  fetched {len(feats)} substation features")
            except Exception as err:
                failures += 1
                log(f"  tile failed: {err}")
            finally:
                tile_elapsed = time.monotonic() - tile_started
                tiles_processed += 1
                if tile_elapsed > args.max_tile_seconds:
                    health_warnings += 1
                    log(
                        f"  ⚠️ Health check: slow tile ({tile_elapsed:.1f}s) exceeded "
                        f"max-tile-seconds={args.max_tile_seconds:.1f}s"
                    )

            time.sleep(args.sleep)

        if stopped_due_to_runtime:
            break

        if batch_start + args.batch_size < selected_total and args.batch_pause > 0:
            elapsed_after_batch = time.monotonic() - started
            if elapsed_after_batch + args.batch_pause <= max_runtime_s:
                log(f"Batch pause: sleeping {args.batch_pause:.1f}s")
                time.sleep(args.batch_pause)
            else:
                stopped_due_to_runtime = True
                log("⛔ Skipping next batch: runtime cap would be exceeded during batch pause.")
                break

    merged = dedupe(all_features)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    output = {
        "type": "FeatureCollection",
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source": "openstreetmap/overpass",
            "region": "texas",
            "feature_type": "substations",
            "tiles_total": total_tiles,
            "tiles_selected_start": args.start_tile,
            "tiles_selected_end": end_idx,
            "tiles_processed": tiles_processed,
            "tiles_failed": failures,
            "health_warnings": health_warnings,
            "stopped_due_to_runtime": stopped_due_to_runtime,
            "max_runtime_minutes": args.max_runtime_min,
            "max_tile_seconds": args.max_tile_seconds,
            "features_before_dedupe": len(all_features),
            "features_after_dedupe": len(merged),
        },
        "features": merged,
    }

    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(output, f)

    mb = OUTPUT_PATH.stat().st_size / (1024 * 1024)
    log(f"Done. Wrote {len(merged)} features to {OUTPUT_PATH.relative_to(PROJECT_ROOT)} ({mb:.2f} MB)")


if __name__ == "__main__":
    main()
