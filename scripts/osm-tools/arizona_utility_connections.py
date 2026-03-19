#!/usr/bin/env python3
"""
Download major utility connections (power lines, pipelines, water transmission)
between Cibola, AZ and Phoenix-area semiconductor sites from OSM.

This script focuses on major transmission infrastructure that connects:
- Cibola, AZ
- TSMC Phoenix
- Intel Ocotillo (Chandler)
- NXP Semiconductors (Chandler)
- Amkor Technology (Peoria)
- Other Phoenix-area sites

The resulting JSON file is stored in public/osm and loaded by the OSM toggle.
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
USER_AGENT = "arizona-utility-connections/1.0 (github.com/)"


def log(message: str) -> None:
    """Emit a timestamped log line with flush so the user can monitor progress in real time."""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S %Z")
    print(f"[{timestamp}] {message}", flush=True)


def handle_sigint(signum, frame):
    log("⚠️ Received interrupt signal; stopping gracefully.")
    sys.exit(1)


signal.signal(signal.SIGINT, handle_sigint)


# Site coordinates for connection analysis
SITES = [
    {
        "key": "cibola_az",
        "name": "Cibola, Arizona",
        "lat": 33.3164,
        "lon": -114.665,
    },
    {
        "key": "tsmc_phoenix",
        "name": "TSMC Arizona Semiconductor Fab Complex",
        "lat": 33.7250,
        "lon": -112.1667,
    },
    {
        "key": "tsmc_phoenix_water",
        "name": "TSMC Phoenix Water Infrastructure",
        "lat": 33.4484,
        "lon": -112.0740,
    },
    {
        "key": "intel_ocotillo",
        "name": "Intel Ocotillo Campus",
        "lat": 33.2431,
        "lon": -111.8844,
    },
    {
        "key": "nxp_chandler",
        "name": "NXP Semiconductors Fab Complex",
        "lat": 33.3260,
        "lon": -111.8617,
    },
    {
        "key": "amkor_phoenix",
        "name": "Amkor Technology Advanced Packaging & Test Facility",
        "lat": 33.7100,
        "lon": -112.2800,
    },
    {
        "key": "linde_phoenix",
        "name": "Linde Industrial Gas Plant",
        "lat": 33.7200,
        "lon": -112.1650,
    },
    {
        "key": "halo_vista",
        "name": "Halo Vista Development",
        "lat": 33.7150,
        "lon": -112.1600,
    },
]


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


def build_connection_query() -> str:
    """
    Build an Overpass query to find major utility connections between sites.
    Uses a bounding box covering the area from Cibola to Phoenix.
    """
    # Calculate bounding box covering all sites
    lats = [site["lat"] for site in SITES]
    lons = [site["lon"] for site in SITES]
    
    min_lat = min(lats) - 0.2  # ~22km buffer
    max_lat = max(lats) + 0.2
    min_lon = min(lons) - 0.2
    max_lon = max(lons) + 0.2
    
    bbox = f"{min_lat},{min_lon},{max_lat},{max_lon}"
    
    return f"""
    [out:json][timeout:180];
    (
      // Major power transmission lines (high voltage)
      way["power"="line"]["voltage"~"^(69|115|138|161|230|345|500|765)"]({bbox});
      way["power"="line"]["cables"~"^[0-9]+$"]({bbox});
      way["power"="line"]["name"~"transmission|Transmission|TRANSMISSION"]({bbox});
      
      // Major pipelines (gas, oil, water)
      way["pipeline"~"^(gas|oil|petroleum|water|crude)"]({bbox});
      way["man_made"="pipeline"]({bbox});
      way["substance"~"^(gas|oil|petroleum|water|crude)"]({bbox});
      
      // Water transmission infrastructure
      way["waterway"="canal"]({bbox});
      way["man_made"="pipeline"]["substance"="water"]({bbox});
      way["man_made"="pipeline"]["pipeline"="water"]({bbox});
      
      // Major power substations and switching stations (to identify connection points)
      node["power"~"^(substation|station|switch)"]({bbox});
      way["power"~"^(substation|station|switch)"]({bbox});
      
      // Major water treatment and distribution facilities
      node["amenity"~"^(water_treatment|water_works)"]({bbox});
      way["amenity"~"^(water_treatment|water_works)"]({bbox});
    );
    out body;
    >;
    out skel qt;
    """


def categorize(tags: Dict[str, str]) -> str:
    """Categorize infrastructure by type."""
    if not tags:
        return "other"

    # Power transmission
    if tags.get("power") == "line":
        voltage = tags.get("voltage", "")
        if voltage and any(v in voltage for v in ["69", "115", "138", "161", "230", "345", "500", "765"]):
            return "power_transmission"
        return "power"
    
    if tags.get("power") in ["substation", "station", "switch"]:
        return "power_facility"

    # Pipelines
    pipeline = tags.get("pipeline", "")
    substance = tags.get("substance", "")
    man_made = tags.get("man_made", "")
    
    if pipeline or man_made == "pipeline":
        if "gas" in (pipeline + substance).lower():
            return "pipeline_gas"
        elif "oil" in (pipeline + substance).lower() or "petroleum" in (pipeline + substance).lower():
            return "pipeline_oil"
        elif "water" in (pipeline + substance).lower():
            return "pipeline_water"
        return "pipeline"

    # Water infrastructure
    if tags.get("waterway") == "canal":
        return "water_canal"
    
    amenity = tags.get("amenity", "")
    if amenity in ["water_treatment", "water_works"]:
        return "water_facility"

    return "other"


def infer_subcategory(tags: Dict[str, str]) -> str:
    """Infer subcategory from tags."""
    for key in ("power", "pipeline", "substance", "voltage", "waterway", "amenity", "man_made"):
        if tags.get(key):
            return f"{key}:{tags[key]}"
    return "unknown"


def node_to_feature(element: Dict) -> Dict | None:
    """Convert OSM node to GeoJSON feature."""
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
            "osm_type": "node",
            "osm_id": element.get("id"),
            "name": tags.get("name", "Unnamed"),
            "category": category,
            "subcategory": subcategory,
            "tags": tags,
            "source": "openstreetmap",
            "connection_type": "facility",  # Nodes are typically facilities
        },
    }


def way_to_feature(element: Dict, node_lookup: Dict[int, Dict]) -> Dict | None:
    """Convert OSM way to GeoJSON feature."""
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
            "osm_type": "way",
            "osm_id": element.get("id"),
            "name": tags.get("name", "Unnamed"),
            "category": category,
            "subcategory": subcategory,
            "tags": tags,
            "source": "openstreetmap",
            "connection_type": "transmission_line",  # Ways are typically transmission lines
        },
    }


def execute_overpass(query: str, retries: int = 3, backoff: int = 10) -> Dict:
    """Execute Overpass query with retries."""
    for attempt in range(1, retries + 1):
        try:
            log(f"⏱️ Overpass request attempt {attempt}/{retries}")
            stop_heartbeat = heartbeat("⌛ Waiting for Overpass response")
            response = requests.post(
                OVERPASS_URL,
                data={"data": query},
                headers={"User-Agent": USER_AGENT},
                timeout=180,
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


def build_features(data: Dict) -> List[Dict]:
    """Build GeoJSON features from Overpass response."""
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
            feature = node_to_feature(element)
        elif element_type == "way":
            feature = way_to_feature(element, node_lookup)

        if feature:
            features.append(feature)

    return features


def summarize_categories(features: List[Dict]) -> Dict[str, int]:
    """Summarize features by category."""
    counts: Dict[str, int] = {}
    for feature in features:
        category = feature.get("properties", {}).get("category", "other")
        counts[category] = counts.get(category, 0) + 1
    return counts


def ensure_output_dir(path: Path) -> None:
    """Ensure output directory exists."""
    path.mkdir(parents=True, exist_ok=True)


def main() -> None:
    ensure_output_dir(OUTPUT_DIR)

    log("🔍 Fetching major utility connections between Cibola, AZ and Phoenix-area sites")
    log(f"📍 Analyzing connections between {len(SITES)} sites")
    
    query = build_connection_query()
    log("🧭 Built Overpass query for major transmission infrastructure")
    
    raw_data = execute_overpass(query)
    log("📦 Processing Overpass payload")
    
    features = build_features(raw_data)
    if not features:
        log("⚠️ No features returned; Overpass may have truncated the response.")
    else:
        log(f"✅ Found {len(features)} connection features")

    counts = summarize_categories(features)
    log(f"📊 Categories: {counts}")

    # Calculate bounding box
    lats = [site["lat"] for site in SITES]
    lons = [site["lon"] for site in SITES]
    envelope = {
        "min_lon": min(lons) - 0.2,
        "min_lat": min(lats) - 0.2,
        "max_lon": max(lons) + 0.2,
        "max_lat": max(lats) + 0.2,
    }

    payload = {
        "site": {
            "key": "arizona_utility_connections",
            "name": "Arizona Utility Connections (Cibola to Phoenix)",
            "description": "Major power transmission lines, pipelines, and water infrastructure connecting Cibola, AZ to Phoenix-area semiconductor sites",
            "sites_connected": [site["name"] for site in SITES],
            "bounding_box": envelope,
        },
        "summary": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "feature_count": len(features),
            "categories": counts,
            "raw_element_count": len(raw_data.get("elements", [])),
        },
        "features": features,
    }

    filename = "nc_power_arizona_utility_connections.json"
    filepath = OUTPUT_DIR / filename
    with filepath.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    
    log(f"💾 Saved {len(features)} connection features to {filepath.relative_to(PROJECT_ROOT)}")
    log("🎉 Arizona utility connections cache created successfully.")


if __name__ == "__main__":
    main()

