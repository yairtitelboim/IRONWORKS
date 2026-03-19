#!/usr/bin/env python3
"""
Download power & utility infrastructure caches from OSM for megasites.

Generates GeoJSON FeatureCollections for:
  - Toyota Battery Manufacturing North Carolina (Liberty, NC)
  - VinFast EV Manufacturing Campus (Moncure, NC)
  - Wolfspeed Silicon Carbide Fab (Siler City, NC)
  - TSMC Arizona Semiconductor Fab Complex (Phoenix, AZ)

The resulting JSON files are stored in public/osm and are consumed directly
by the frontend OSM toggle so that the application can operate without
live Overpass API calls.
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path
from threading import Event, Thread
from typing import Dict, List

import requests
import signal
import sys


PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = PROJECT_ROOT / "public" / "osm"
OVERPASS_URL = "https://overpass.kumi.systems/api/interpreter"
USER_AGENT = "nc-power-utility-cache/1.0 (github.com/)"


def log(message: str) -> None:
    """Emit a timestamped log line with flush so the user can monitor progress in real time."""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S %Z")
    print(f"[{timestamp}] {message}", flush=True)


def handle_sigint(signum, frame):
    log("⚠️ Received interrupt signal; stopping gracefully.")
    sys.exit(1)


signal.signal(signal.SIGINT, handle_sigint)


SITES = [
    {
        "key": "toyota_battery_nc",
        "name": "Toyota Battery Manufacturing North Carolina",
        "lat": 35.88,
        "lon": -79.57,
        "radius_m": 12000,
        "note": "Greensboro-Randolph Megasite focus area near Liberty, NC.",
    },
    {
        "key": "vinfast_nc",
        "name": "VinFast EV Manufacturing Campus",
        "lat": 35.62,
        "lon": -79.08,
        "radius_m": 11000,
        "note": "Triangle Innovation Point industrial megasite near Moncure, NC.",
    },
    {
        "key": "wolfspeed_nc",
        "name": "Wolfspeed Silicon Carbide Fab",
        "lat": 35.72,
        "lon": -79.49,
        "radius_m": 10000,
        "note": "Chatham-Siler City Advanced Manufacturing Site.",
    },
    {
        "key": "raleigh_grid",
        "name": "Raleigh Grid Resiliency Hub",
        "lat": 35.7796,
        "lon": -78.6382,
        "radius_m": 9000,
        "note": "Downtown Raleigh government & utility coordination district.",
    },
    {
        "key": "greensboro_grid",
        "name": "Greensboro Infrastructure Core",
        "lat": 36.0726,
        "lon": -79.7920,
        "radius_m": 9000,
        "note": "Downtown Greensboro civic, utility, and grid resiliency hub.",
    },
    {
        "key": "harris_nc",
        "name": "Shearon Harris Nuclear Power Plant",
        "lat": 35.6506,
        "lon": -78.9531,
        "radius_m": 12000,
        "note": "Harris nuclear facility and surrounding grid/water infrastructure.",
    },
    {
        "key": "tsmc_phoenix",
        "name": "TSMC Arizona Semiconductor Fab Complex",
        "lat": 33.75,
        "lon": -112.25,
        "radius_m": 40234,  # 25 miles in meters - captures regional pipeline infrastructure without excessive data
        "note": "TSMC Phoenix semiconductor fab complex - $165B investment, 3 fabs requiring 17.2M gallons/day water when complete. Address: 5088 W Innovation Circle, Phoenix, AZ 85083. 25-mile radius for regional infrastructure.",
    },
    {
        "key": "tsmc_phoenix_water",
        "name": "TSMC Phoenix Water Infrastructure",
        "lat": 33.4484,
        "lon": -112.0740,
        "radius_m": 12000,
        "note": "Phoenix municipal water allocation and water reclamation infrastructure for TSMC.",
    },
    {
        "key": "cibola_az",
        "name": "Cibola, Arizona",
        "lat": 33.3164,
        "lon": -114.665,
        "radius_m": 16093,  # 10 miles in meters
        "note": "Cibola, AZ infrastructure area - 10 mile radius covering power, water, and utility infrastructure.",
    },
]


POWER_TAGS = {"power", "generator:type"}
WATER_MAN_MADE = {"water_tower", "water_works", "reservoir_covered", "plant"}
WATER_AMENITIES = {"water_treatment", "water_works", "drinking_water"}
PIPELINE_VALUES = {"pipeline", "gas", "oil", "sewer", "water"}


def heartbeat(message: str, interval: int = 10):
    """
    Emit a log message every `interval` seconds until the returned stop
    function is called. This keeps long-running requests chatty so we
    know they are still alive.
    """
    stop_event = Event()

    def _runner():
        ticks = 0
        while not stop_event.wait(interval):
            ticks += 1
            log(f"{message} (waiting {ticks * interval}s)")

    thread = Thread(target=_runner, daemon=True)
    thread.start()

    def stop():
        stop_event.set()
        thread.join(timeout=interval + 1)

    return stop


def build_query(lat: float, lon: float, radius_m: int) -> str:
    """Compose an Overpass query covering power and utility infrastructure."""
    return f"""
    [out:json][timeout:180];
    (
      node["power"](around:{radius_m},{lat},{lon});
      way["power"](around:{radius_m},{lat},{lon});

      node["man_made"~"^(water_tower|water_works|reservoir_covered|pipeline|plant)$"](around:{radius_m},{lat},{lon});
      way["man_made"~"^(water_tower|water_works|reservoir_covered|pipeline|plant)$"](around:{radius_m},{lat},{lon});

      node["amenity"~"^(water_treatment|water_works|power_station)$"](around:{radius_m},{lat},{lon});
      way["amenity"~"^(water_treatment|water_works|power_station)$"](around:{radius_m},{lat},{lon});

      node["waterway"~"^(canal|drain|ditch)$"](around:{radius_m},{lat},{lon});
      way["waterway"~"^(canal|drain|ditch)$"](around:{radius_m},{lat},{lon});

      node["pipeline"](around:{radius_m},{lat},{lon});
      way["pipeline"](around:{radius_m},{lat},{lon});
    );
    out body;
    >;
    out skel qt;
    """


def categorize(tags: Dict[str, str]) -> str:
    if not tags:
        return "other"

    if any(key in tags for key in POWER_TAGS):
        return "power"

    amenity = tags.get("amenity", "")
    if amenity in WATER_AMENITIES:
        return "water"

    man_made = tags.get("man_made", "")
    if man_made in WATER_MAN_MADE:
        return "water"
    if man_made == "pipeline":
        return "pipeline"

    pipeline = tags.get("pipeline", "")
    if pipeline or pipeline in PIPELINE_VALUES:
        return "pipeline"

    if tags.get("utility"):
        return "utility"

    waterway = tags.get("waterway", "")
    if waterway in {"canal", "drain", "ditch"}:
        return "water"

    if tags.get("landuse") == "industrial" and tags.get("industrial") in {"power", "water"}:
        return tags.get("industrial")

    return "other"


def infer_subcategory(tags: Dict[str, str]) -> str:
    for key in ("power", "generator:type", "amenity", "man_made", "pipeline", "waterway", "utility"):
        if tags.get(key):
            return f"{key}:{tags[key]}"
    if tags.get("landuse"):
        return f"landuse:{tags['landuse']}"
    return "unknown"


def node_to_feature(site_key: str, element: Dict) -> Dict | None:
    try:
        lon = float(element["lon"])
        lat = float(element["lat"])
    except (KeyError, TypeError, ValueError):
        return None

    tags = element.get("tags", {}) or {}
    category = categorize(tags)
    subcategory = infer_subcategory(tags)

    return {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [lon, lat],
        },
        "properties": {
            "site_key": site_key,
            "osm_type": "node",
            "osm_id": element.get("id"),
            "name": tags.get("name", "Unnamed"),
            "category": category,
            "subcategory": subcategory,
            "tags": tags,
            "source": "openstreetmap",
        },
    }


def way_to_feature(site_key: str, element: Dict, node_lookup: Dict[int, Dict]) -> Dict | None:
    node_ids = element.get("nodes") or []
    coordinates: List[List[float]] = []

    for node_id in node_ids:
        node = node_lookup.get(node_id)
        if not node:
            continue
        try:
            coordinates.append([float(node["lon"]), float(node["lat"])])
        except (KeyError, TypeError, ValueError):
            continue

    if len(coordinates) < 2:
        return None

    is_closed = coordinates[0] == coordinates[-1]
    if is_closed and len(coordinates) >= 4:
        geometry = {
            "type": "Polygon",
            "coordinates": [coordinates],
        }
    else:
        geometry = {
            "type": "LineString",
            "coordinates": coordinates,
        }

    tags = element.get("tags", {}) or {}
    category = categorize(tags)
    subcategory = infer_subcategory(tags)

    return {
        "type": "Feature",
        "geometry": geometry,
        "properties": {
            "site_key": site_key,
            "osm_type": "way",
            "osm_id": element.get("id"),
            "name": tags.get("name", "Unnamed"),
            "category": category,
            "subcategory": subcategory,
            "tags": tags,
            "source": "openstreetmap",
        },
    }


def execute_overpass(query: str, retries: int = 3, backoff: int = 10) -> Dict:
    for attempt in range(1, retries + 1):
        try:
            log(f"⏱️ Overpass request attempt {attempt}/{retries}")
            stop_heartbeat = heartbeat("⌛ Waiting for Overpass response")
            response = requests.post(
                OVERPASS_URL,
                data={"data": query},
                headers={"User-Agent": USER_AGENT},
                timeout=120,
            )
            stop_heartbeat()

            if response.status_code in {429, 502, 503}:
                log(f"⚠️ Overpass throttled us ({response.status_code}); backing off.")
                if attempt == retries:
                    response.raise_for_status()
                time.sleep(backoff * attempt)
                continue

            response.raise_for_status()
            log("✅ Overpass request succeeded.")
            try:
                return response.json()
            except ValueError as exc:
                snippet = response.text[:200].strip()
                log(f"⚠️ Overpass returned non-JSON payload (first 200 chars): {snippet!r}")
                raise exc
        except (requests.exceptions.RequestException, ValueError) as exc:
            if 'stop_heartbeat' in locals():
                stop_heartbeat()
            if attempt >= retries:
                raise RuntimeError(f"Overpass request failed after {attempt} attempts") from exc
            log(f"⚠️ Request error: {exc}. Retrying in {backoff * attempt}s.")
            time.sleep(backoff * attempt)


def build_features(site_key: str, data: Dict) -> List[Dict]:
    elements = data.get("elements", [])
    node_lookup = {
        element["id"]: element
        for element in elements
        if element.get("type") == "node"
    }

    features: List[Dict] = []
    for element in elements:
        element_type = element.get("type")
        feature = None
        if element_type == "node":
            feature = node_to_feature(site_key, element)
        elif element_type == "way":
            feature = way_to_feature(site_key, element, node_lookup)

        if feature:
            features.append(feature)

    return features


def summarize_categories(features: List[Dict]) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for feature in features:
        category = feature.get("properties", {}).get("category", "other")
        counts[category] = counts.get(category, 0) + 1
    return counts


def fetch_site_data(site: Dict) -> Dict:
    log(f"🧭 Building Overpass query for {site['name']} (radius {site['radius_m']}m)")
    query = build_query(site["lat"], site["lon"], site["radius_m"])
    raw_data = execute_overpass(query)
    log(f"📦 Processing Overpass payload for {site['key']}")
    features = build_features(site["key"], raw_data)
    if not features:
        log("⚠️ No features returned for this site; Overpass may have truncated the response.")

    counts = summarize_categories(features)

    envelope = {
        "min_lon": site["lon"] - site["radius_m"] / 111320,
        "min_lat": site["lat"] - site["radius_m"] / 110540,
        "max_lon": site["lon"] + site["radius_m"] / 111320,
        "max_lat": site["lat"] + site["radius_m"] / 110540,
    }

    return {
        "site": {
            "key": site["key"],
            "name": site["name"],
            "center": {"lat": site["lat"], "lng": site["lon"]},
            "radius_m": site["radius_m"],
            "note": site["note"],
        },
        "summary": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "feature_count": len(features),
            "categories": counts,
            "query_radius_m": site["radius_m"],
            "bounding_box": envelope,
            "raw_element_count": len(raw_data.get("elements", [])),
        },
        "features": features,
    }


def ensure_output_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def write_site_file(site: Dict, payload: Dict) -> Path:
    # Use consistent naming: nc_power_ prefix for all sites (including TSMC)
    filename = f"nc_power_{site['key']}.json"
    filepath = OUTPUT_DIR / filename
    with filepath.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    return filepath


def main() -> None:
    ensure_output_dir(OUTPUT_DIR)

    # Process sites in batches with 30-second intervals
    BATCH_SIZE = 2  # Process 2 sites per batch
    BATCH_INTERVAL = 30  # 30 seconds between batches
    
    total_sites = len(SITES)
    batches = [SITES[i:i + BATCH_SIZE] for i in range(0, total_sites, BATCH_SIZE)]
    
    log(f"📦 Processing {total_sites} sites in {len(batches)} batches (2 sites per batch, {BATCH_INTERVAL}s intervals)")
    
    for batch_num, batch in enumerate(batches, 1):
        log(f"🔄 Starting batch {batch_num}/{len(batches)} ({len(batch)} sites)")
        
        for site in batch:
            log(f"🔍 Fetching OSM infrastructure for {site['name']} ({site['key']})")
            payload = fetch_site_data(site)
            output_file = write_site_file(site, payload)
            log(
                f"💾 Saved {payload['summary']['feature_count']} features "
                f"to {output_file.relative_to(PROJECT_ROOT)} (categories: {payload['summary']['categories']})"
            )
            # Small delay between sites in same batch
            if site != batch[-1]:  # Don't wait after last site in batch
                log("⏳ Waiting 2s before next site in batch...")
                time.sleep(2)
        
        # Wait 30 seconds before next batch (except after last batch)
        if batch_num < len(batches):
            log(f"⏳ Batch {batch_num} complete. Waiting {BATCH_INTERVAL}s before next batch...")
            time.sleep(BATCH_INTERVAL)

    log("🎉 Power & utility caches refreshed (NC and TSMC Phoenix sites).")


if __name__ == "__main__":
    main()
