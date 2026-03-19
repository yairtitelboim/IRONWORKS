#!/usr/bin/env python3
"""
Download power & basic water infrastructure caches from OSM for
Pennsylvania nuclear + data center analysis (MVP).

Generates GeoJSON FeatureCollections for:
  - Three Mile Island Nuclear Plant (Middletown, PA)
  - Susquehanna Steam Electric Station (Berwick, PA)

The resulting JSON files are stored in public/osm and consumed directly
by the MCP infrastructure search endpoint so the app can operate without
live Overpass calls at runtime.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from threading import Event, Thread
from typing import Dict, List

import requests
import signal
import sys
import time


PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = PROJECT_ROOT / "public" / "osm"
OVERPASS_URL = "https://overpass.kumi.systems/api/interpreter"
USER_AGENT = "pa-nuclear-datacenter-cache/1.0"


def log(message: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S %Z")
    print(f"[{ts}] {message}", flush=True)


def handle_sigint(signum, frame):
    log("⚠️ Received interrupt signal; stopping gracefully.")
    sys.exit(1)


signal.signal(signal.SIGINT, handle_sigint)


# 100 miles = 160,934 meters
RADIUS_100_MILES = 160934

SITES = [
    {
        "key": "pa_nuclear_tmi",
        "name": "Three Mile Island Nuclear Plant",
        "lat": 40.1500,
        "lon": -76.7300,
        "radius_m": RADIUS_100_MILES,  # 100 miles for strategic coverage
        "note": "Three Mile Island - 100 mile radius for strategic power/water infrastructure",
        "output_key": "pa_nuclear_tmi",
    },
    {
        "key": "pa_nuclear_susquehanna",
        "name": "Susquehanna Steam Electric Station",
        "lat": 41.1000,
        "lon": -76.1500,
        "radius_m": RADIUS_100_MILES,  # 100 miles
        "note": "Susquehanna - 100 mile radius for strategic power/water infrastructure",
        "output_key": "pa_nuclear_susquehanna",
    },
]

# Strategic filtering parameters
STRATEGIC_SCORE_THRESHOLD = 25  # Only save features with score >= 25
MAX_FEATURES_PER_SITE = 5000    # Hard limit per site (performance)


POWER_TAGS = {"power", "generator:type"}
WATER_MAN_MADE = {"water_tower", "water_works", "reservoir_covered", "plant", "cooling_tower"}
WATER_AMENITIES = {"water_treatment", "water_works"}


def heartbeat(message: str, interval: int = 10):
    """Emit a log message every `interval` seconds until stopped."""
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
    """
    Compose an Overpass query prioritizing strategic infrastructure:
    1. High-voltage transmission (345kV+) - CRITICAL
    2. Major substations (transmission level)
    3. Power plants and generators
    4. Major water infrastructure
    5. Regional transmission lines
    6. Named infrastructure (more likely to be important)
    
    For 100-mile radius, we prioritize strategic nodes to keep query manageable.
    """
    # Increase timeout for large radius queries
    timeout = 300 if radius_m > 50000 else 180
    
    return f"""
    [out:json][timeout:{timeout}];
    (
      // TIER 1: CRITICAL - High-voltage transmission (345kV+)
      node["power"="substation"]["voltage"~"^3[4-9][0-9]|^[4-9][0-9][0-9]"](around:{radius_m},{lat},{lon});
      way["power"="line"]["voltage"~"^3[4-9][0-9]|^[4-9][0-9][0-9]"](around:{radius_m},{lat},{lon});
      
      // TIER 2: HIGH - Major substations (230kV, transmission level)
      node["power"="substation"]["voltage"~"^2[0-3][0-9]|^230"](around:{radius_m},{lat},{lon});
      way["power"="line"]["voltage"~"^2[0-3][0-9]|^230"](around:{radius_m},{lat},{lon});
      
      // TIER 3: HIGH - Power plants and generators
      node["power"~"plant|generator"](around:{radius_m},{lat},{lon});
      way["power"~"plant|generator"](around:{radius_m},{lat},{lon});
      
      // TIER 3.5: HIGH - Switchyard patterns (regional tagging - often tagged as lines with "Sub" in name)
      // Catch switchyards that may be tagged as lines but have switchyard indicators
      way["power"="line"]["name"~"[Ss]ub|Switchyard|Switch yard|Junction|Tie"](around:{radius_m},{lat},{lon});
      node["power"="line"]["name"~"[Ss]ub|Switchyard|Switch yard|Junction|Tie"](around:{radius_m},{lat},{lon});
      
      // TIER 4: MEDIUM - Sub-transmission (138-161kV)
      node["power"="substation"]["voltage"~"^1[3-6][0-9]|^138|^161"](around:{radius_m},{lat},{lon});
      way["power"="line"]["voltage"~"^1[3-6][0-9]|^138|^161"](around:{radius_m},{lat},{lon});
      
      // TIER 5: MEDIUM - Named substations (likely important)
      node["power"="substation"]["name"](around:{radius_m},{lat},{lon});
      
      // TIER 6: MEDIUM - Major water infrastructure
      node["man_made"~"water_works|water_treatment"](around:{radius_m},{lat},{lon});
      way["man_made"~"water_works|water_treatment"](around:{radius_m},{lat},{lon});
      node["amenity"~"water_treatment|water_works"](around:{radius_m},{lat},{lon});
      
      // TIER 7: LOW - Other power infrastructure (distribution, but still collect)
      node["power"="substation"](around:{radius_m},{lat},{lon});
      way["power"="line"](around:{radius_m},{lat},{lon});
      
      // TIER 8: LOW - Other water infrastructure
      node["man_made"~"water_tower|reservoir"](around:{radius_m},{lat},{lon});
      way["pipeline"="water"](around:{radius_m},{lat},{lon});

      // POWER TRANSMISSION ROUTES (some grids map lines only as relations)
      relation["type"="route"]["route"="power"](around:{radius_m},{lat},{lon});

      // CONTEXT: Major rivers and water bodies (waterways for infrastructure analysis)
      way["waterway"~"river|stream|canal|ditch|drain"](around:{radius_m},{lat},{lon});
      way["natural"="water"](around:{radius_m},{lat},{lon});
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
        return "water"  # Water treatment facilities

    waterway = tags.get("waterway", "")
    if waterway in ["river", "stream", "canal", "ditch", "drain"]:
        return "waterway"  # Separate category for waterways (rivers, streams)

    if tags.get("natural") == "water":
        return "water_body"  # Separate category for water bodies (lakes, reservoirs)

    return "other"


def infer_subcategory(tags: Dict[str, str]) -> str:
    for key in ("power", "generator:type", "amenity", "man_made", "waterway"):
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

    props: Dict[str, object] = {
        "site_key": site_key,
        "osm_type": "node",
        "osm_id": element.get("id"),
        "category": category,
        "subcategory": subcategory,
        "tags": tags,
        "source": "openstreetmap",
    }

    # Only set a name when OSM actually has one; avoid synthetic "Unnamed" labels
    name = tags.get("name")
    if name and name.strip() and name not in {"Unnamed", "Unnamed Area"}:
        props["name"] = name
    
    # Add voltage and operator to properties for easier access
    if tags.get("voltage"):
        props["voltage"] = tags.get("voltage")
    if tags.get("voltage:primary"):
        props["voltage:primary"] = tags.get("voltage:primary")
    if tags.get("operator"):
        props["operator"] = tags.get("operator")
    if tags.get("operator:ref"):
        props["operator:ref"] = tags.get("operator:ref")
    if tags.get("substation:type"):
        props["substation:type"] = tags.get("substation:type")

    return {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [lon, lat],
        },
        "properties": props,
    }


def way_to_feature(site_key: str, element: Dict, node_lookup: Dict[int, Dict]) -> Dict | None:
    node_ids = element.get("nodes") or []
    coords: List[List[float]] = []

    for node_id in node_ids:
        node = node_lookup.get(node_id)
        if not node:
            continue
        try:
            coords.append([float(node["lon"]), float(node["lat"])])
        except (KeyError, TypeError, ValueError):
            continue

    if len(coords) < 2:
        return None

    is_closed = coords[0] == coords[-1]
    if is_closed and len(coords) >= 4:
        geometry = {"type": "Polygon", "coordinates": [coords]}
    else:
        geometry = {"type": "LineString", "coordinates": coords}

    tags = element.get("tags", {}) or {}
    category = categorize(tags)
    subcategory = infer_subcategory(tags)

    props: Dict[str, object] = {
        "site_key": site_key,
        "osm_type": "way",
        "osm_id": element.get("id"),
        "category": category,
        "subcategory": subcategory,
        "tags": tags,
        "source": "openstreetmap",
    }

    # Only set a name when OSM actually has one; avoid synthetic "Unnamed" labels
    name = tags.get("name")
    if name and name.strip() and name not in {"Unnamed", "Unnamed Area"}:
        props["name"] = name
    
    # Add voltage and operator to properties for easier access
    if tags.get("voltage"):
        props["voltage"] = tags.get("voltage")
    if tags.get("voltage:primary"):
        props["voltage:primary"] = tags.get("voltage:primary")
    if tags.get("operator"):
        props["operator"] = tags.get("operator")
    if tags.get("operator:ref"):
        props["operator:ref"] = tags.get("operator:ref")

    return {
        "type": "Feature",
        "geometry": geometry,
        "properties": props,
    }


def parse_voltage(voltage_str: str) -> float | None:
    """Parse voltage string to numeric value in kV"""
    import re
    if not voltage_str:
        return None
    # Extract number
    match = re.search(r'(\d+(?:\.\d+)?)', str(voltage_str))
    if match:
        value = float(match.group(1))
        # If very large (>1000), assume volts, convert to kV
        if value > 1000:
            value = value / 1000
        return value
    return None


def calculate_strategic_score(element: Dict, site_lat: float = None, site_lon: float = None) -> float:
    """
    Calculate strategic importance score (0-100)
    Higher score = more strategic/important
    
    Scoring factors:
    - Voltage level (higher = more critical)
    - Infrastructure type (substation > line > tower)
    - Named vs unnamed (named = more important)
    - Operator (major operators = more critical)
    - Distance from site (closer = bonus, especially within 10km)
    - Switchyard patterns (recognize switchyards even if tagged as lines)
    """
    tags = element.get("tags", {}) or {}
    score = 0.0
    
    # Calculate distance from site (if coordinates provided)
    distance_km = None
    if site_lat and site_lon:
        try:
            if element.get("type") == "node":
                elat = float(element.get("lat", 0))
                elon = float(element.get("lon", 0))
                if elat and elon:
                    # Simple distance calculation (Haversine approximation)
                    import math
                    dlat = math.radians(elat - site_lat)
                    dlon = math.radians(elon - site_lon)
                    a = math.sin(dlat/2)**2 + math.cos(math.radians(site_lat)) * math.cos(math.radians(elat)) * math.sin(dlon/2)**2
                    distance_km = 6371 * 2 * math.asin(math.sqrt(a))
            elif element.get("type") == "way" and element.get("nodes"):
                # For ways, use first node as approximation
                # (More accurate distance would require node lookup, but this is good enough for scoring)
                pass  # Will calculate during feature building
        except (ValueError, TypeError, KeyError):
            pass
    
    # 1. VOLTAGE SCORING (Power infrastructure)
    voltage_str = tags.get("voltage") or tags.get("voltage:primary") or tags.get("voltage:secondary") or ""
    if voltage_str:
        voltage_val = parse_voltage(voltage_str)
        if voltage_val:
            if voltage_val >= 345:
                score += 50  # Extra high voltage (transmission backbone)
            elif voltage_val >= 230:
                score += 40  # High voltage (transmission)
            elif voltage_val >= 138:
                score += 30  # Sub-transmission
            elif voltage_val >= 69:
                score += 20  # Distribution
            else:
                score += 10  # Low voltage
    
    # 2. INFRASTRUCTURE TYPE SCORING
    power_type = tags.get("power") or tags.get("substation") or tags.get("man_made") or ""
    name = tags.get("name") or ""
    name_lower = name.lower() if name else ""
    
    # Check for switchyard patterns in names (regional OSM tagging - switchyards often tagged as lines)
    is_switchyard_pattern = any(pattern in name_lower for pattern in [
        " sub", "sub ", "substation", "switchyard", "switch yard", 
        "tmi -", "tmi-", "junction", "tie", "busbar", "bay"
    ])
    
    if power_type == "plant" or power_type == "generator":
        score += 35  # Power plants are very strategic
    elif power_type == "substation":
        substation_type = tags.get("substation:type") or tags.get("substation")
        if substation_type == "transmission":
            score += 30
        elif substation_type == "primary":
            score += 25
        else:
            score += 15
    elif power_type == "line":
        # Lines that look like switchyards get higher score
        if is_switchyard_pattern:
            score += 25  # Switchyard infrastructure (tagged as line but is switchyard)
        else:
            score += 10  # Regular transmission lines
    
    # 3. WATER INFRASTRUCTURE SCORING
    if tags.get("man_made") in ["water_works", "water_treatment"]:
        score += 30
    elif tags.get("amenity") in ["water_treatment", "water_works"]:
        score += 25
    elif tags.get("man_made") == "water_tower":
        score += 15
    
    # Waterways (rivers, streams, canals) - important for infrastructure analysis
    waterway = tags.get("waterway", "")
    if waterway in ["river", "stream", "canal", "ditch", "drain"]:
        # Major rivers get higher score, but all waterways are important
        if waterway == "river":
            score += 25  # Named rivers are strategic
        else:
            score += 20  # Streams, canals are also important
        # Named waterways are more important
        if name and name.strip() and name not in {"Unnamed", "Unnamed Area"}:
            score += 5  # Additional bonus for named waterways
    
    # Natural water bodies (lakes, reservoirs)
    if tags.get("natural") == "water":
        score += 20  # Water bodies are important for infrastructure
        if name and name.strip() and name not in {"Unnamed", "Unnamed Area"}:
            score += 5  # Named water bodies are more important
    
    # 4. NAMED INFRASTRUCTURE (more likely to be important)
    if name and name.strip() and name not in {"Unnamed", "Unnamed Area"}:
        score += 10
        # Extra bonus for switchyard-related names
        if is_switchyard_pattern:
            score += 10  # Additional bonus for switchyard patterns
    
    # 5. OPERATOR SCORING (major operators = more strategic)
    operator = tags.get("operator") or tags.get("operator:ref") or ""
    if operator:
        operator_lower = operator.lower()
        if any(major in operator_lower for major in ["pjm", "constellation", "talen", "exelon", "firstenergy", "met-ed", "meted"]):
            score += 15
        elif "electric" in operator_lower or "power" in operator_lower:
            score += 5
    
    # 6. DISTANCE BONUS (features within 10km get significant boost)
    # This ensures on-site and nearby infrastructure is always included
    if distance_km is not None:
        if distance_km <= 1.0:
            score += 30  # Very close (on-site or adjacent) - major bonus
        elif distance_km <= 5.0:
            score += 20  # Within 5km - significant bonus
        elif distance_km <= 10.0:
            score += 10  # Within 10km - moderate bonus
    
    return min(100, score)  # Cap at 100


def get_strategic_tier(score: float) -> str:
    """Classify strategic tier"""
    if score >= 60:
        return "critical"
    elif score >= 40:
        return "high"
    elif score >= 25:
        return "medium"
    else:
        return "low"


def execute_overpass(query: str, retries: int = 3, backoff: int = 10, timeout: int = 300) -> Dict:
    """
    Execute Overpass query with retry logic and timeout handling.
    For very large queries, may need batching (handled in fetch_site_data if needed).
    """
    for attempt in range(1, retries + 1):
        try:
            log(f"⏱️ Overpass request attempt {attempt}/{retries} (timeout: {timeout}s)")
            stop_heartbeat = heartbeat("⌛ Waiting for Overpass response")
            response = requests.post(
                OVERPASS_URL,
                data={"data": query},
                headers={"User-Agent": USER_AGENT},
                timeout=timeout,
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
        except requests.exceptions.Timeout as exc:
            if "stop_heartbeat" in locals():
                stop_heartbeat()
            if attempt >= retries:
                log("⚠️ Query timed out - this may indicate query is too large for single request")
                log("   Consider using batching strategy for very large radius queries")
                raise RuntimeError(f"Overpass query timed out after {timeout}s") from exc
            log(f"⚠️ Request timeout: {exc}. Retrying with longer timeout in {backoff * attempt}s.")
            time.sleep(backoff * attempt)
            timeout = int(timeout * 1.5)  # Increase timeout for retry
        except (requests.exceptions.RequestException, ValueError) as exc:
            if "stop_heartbeat" in locals():
                stop_heartbeat()
            if attempt >= retries:
                raise RuntimeError(f"Overpass request failed after {attempt} attempts") from exc
            log(f"⚠️ Request error: {exc}. Retrying in {backoff * attempt}s.")
            time.sleep(backoff * attempt)


def build_features(site_key: str, data: Dict, site_lat: float = None, site_lon: float = None) -> List[Dict]:
    """
    Build features from OSM elements and apply strategic filtering.
    Only includes features with strategic_score >= STRATEGIC_SCORE_THRESHOLD.
    Features within 10km use a lower threshold (10 instead of 25) to ensure
    on-site infrastructure is captured.
    """
    elements = data.get("elements", [])
    node_lookup = {
        element["id"]: element
        for element in elements
        if element.get("type") == "node"
    }
    way_lookup = {
        element["id"]: element
        for element in elements
        if element.get("type") == "way"
    }

    features: List[Dict] = []
    for element in elements:
        # Calculate distance for scoring (if site coordinates provided)
        distance_km = None
        if site_lat and site_lon:
            try:
                if element.get("type") == "node":
                    elat = float(element.get("lat", 0))
                    elon = float(element.get("lon", 0))
                    if elat and elon:
                        import math
                        dlat = math.radians(elat - site_lat)
                        dlon = math.radians(elon - site_lon)
                        a = math.sin(dlat/2)**2 + math.cos(math.radians(site_lat)) * math.cos(math.radians(elat)) * math.sin(dlon/2)**2
                        distance_km = 6371 * 2 * math.asin(math.sqrt(a))
                elif element.get("type") == "way" and element.get("nodes"):
                    # For ways, use first node as approximation for distance-based scoring
                    # (More accurate distance calculation happens in server.js)
                    first_node_id = element.get("nodes", [])[0] if element.get("nodes") else None
                    if first_node_id and first_node_id in node_lookup:
                        first_node = node_lookup[first_node_id]
                        elat = float(first_node.get("lat", 0))
                        elon = float(first_node.get("lon", 0))
                        if elat and elon:
                            import math
                            dlat = math.radians(elat - site_lat)
                            dlon = math.radians(elon - site_lon)
                            a = math.sin(dlat/2)**2 + math.cos(math.radians(site_lat)) * math.cos(math.radians(elat)) * math.sin(dlon/2)**2
                            distance_km = 6371 * 2 * math.asin(math.sqrt(a))
            except (ValueError, TypeError, KeyError, IndexError):
                pass
        
        # Calculate strategic score for this element (with distance context)
        strategic_score = calculate_strategic_score(element, site_lat, site_lon)
        
        # Dynamic threshold: Lower for features within 10km (capture on-site infrastructure)
        # This accounts for regional OSM tagging patterns where switchyards may be
        # tagged as lines or lack proper metadata
        threshold = 10 if (distance_km and distance_km <= 10.0) else STRATEGIC_SCORE_THRESHOLD
        
        # Filter: Only include strategic nodes (score >= threshold)
        if strategic_score < threshold:
            continue  # Skip non-strategic features
        
        etype = element.get("type")
        feature = None
        if etype == "node":
            feature = node_to_feature(site_key, element)
        elif etype == "way":
            feature = way_to_feature(site_key, element, node_lookup)
        elif etype == "relation":
            # Many power grids are mapped as route=power relations whose member
            # ways lack explicit power tags. Promote those to explicit power
            # MultiLineString features so they render as transmission lines.
            tags = element.get("tags", {}) or {}
            if tags.get("route") == "power":
                # Build one MultiLineString from all member ways we can resolve
                coords_segments: List[List[List[float]]] = []
                for member in element.get("members") or []:
                    if member.get("type") != "way":
                        continue
                    way = way_lookup.get(member.get("ref"))
                    if not way:
                        continue
                    way_feature = way_to_feature(site_key, way, node_lookup)
                    if not way_feature:
                        continue
                    geom = way_feature.get("geometry") or {}
                    if geom.get("type") == "LineString":
                        coords = geom.get("coordinates") or []
                        if len(coords) >= 2:
                            coords_segments.append(coords)

                if coords_segments:
                    feature = {
                        "type": "Feature",
                        "geometry": {
                            "type": "MultiLineString",
                            "coordinates": coords_segments,
                        },
                        "properties": {
                            "site_key": site_key,
                            "osm_type": "relation",
                            "osm_id": element.get("id"),
                            "name": tags.get("name", "Unnamed"),
                            # Force these to be treated as power for styling
                            "category": "power",
                            "subcategory": infer_subcategory(tags) or "route:power",
                            "tags": tags,
                            "source": "openstreetmap",
                        },
                    }

        if feature:
            # Add strategic metadata to feature properties
            feature["properties"]["strategic_score"] = strategic_score
            feature["properties"]["strategic_tier"] = get_strategic_tier(strategic_score)
            features.append(feature)

    # Sort by strategic score (highest first)
    features.sort(key=lambda f: f.get("properties", {}).get("strategic_score", 0), reverse=True)
    
    # Limit to top N features (performance)
    if len(features) > MAX_FEATURES_PER_SITE:
        log(f"⚠️ Limiting features from {len(features)} to {MAX_FEATURES_PER_SITE} (top strategic nodes)")
        features = features[:MAX_FEATURES_PER_SITE]

    return features


def summarize_categories(features: List[Dict]) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for feature in features:
        cat = feature.get("properties", {}).get("category", "other")
        counts[cat] = counts.get(cat, 0) + 1
    return counts


def fetch_site_data_batched(site: Dict, batch_radius_m: int = 50000) -> Dict:
    """
    Fetch site data using batched queries if radius is very large.
    Splits query into concentric rings or sectors to avoid timeout.
    """
    radius_m = site["radius_m"]
    
    # If radius is manageable, use single query
    if radius_m <= batch_radius_m:
        return fetch_site_data(site)
    
    log(f"📦 Using batched query strategy for large radius ({radius_m/1000:.1f} km)")
    
    # Strategy: Query in concentric rings
    # Inner ring: 0-50km (high priority)
    # Outer ring: 50km-100 miles (strategic only)
    inner_radius = min(50000, radius_m)
    outer_radius = radius_m
    
    all_elements = []
    
    # Inner ring query (full detail)
    log(f"   Query 1/2: Inner ring (0-{inner_radius/1000:.1f} km)")
    try:
        inner_query = build_query(site["lat"], site["lon"], inner_radius)
        inner_data = execute_overpass(inner_query, timeout=300)
        inner_elements = inner_data.get("elements", [])
        all_elements.extend(inner_elements)
        log(f"   Inner ring: {len(inner_elements)} elements")
        time.sleep(10)  # Be polite to Overpass
    except Exception as e:
        log(f"   ⚠️ Inner ring query failed: {e}")
    
    # Outer ring query (strategic only - already prioritized in build_query)
    if outer_radius > inner_radius:
        log(f"   Query 2/2: Outer ring ({inner_radius/1000:.1f}-{outer_radius/1000:.1f} km)")
        try:
            # For outer ring, we can use a simpler query focused on high-voltage
            outer_query = f"""
            [out:json][timeout:300];
            (
              // Only high-voltage transmission in outer ring
              node["power"="substation"]["voltage"~"^3[4-9][0-9]|^[4-9][0-9][0-9]"](around:{outer_radius},{site["lat"]},{site["lon"]});
              way["power"="line"]["voltage"~"^3[4-9][0-9]|^[4-9][0-9][0-9]"](around:{outer_radius},{site["lat"]},{site["lon"]});
              node["power"="plant"](around:{outer_radius},{site["lat"]},{site["lon"]});
            );
            out body;
            >;
            out skel qt;
            """
            outer_data = execute_overpass(outer_query, timeout=300)
            outer_elements = outer_data.get("elements", [])
            # Filter out elements already in inner ring (rough check)
            inner_ids = {el["id"] for el in all_elements}
            outer_elements = [el for el in outer_elements if el["id"] not in inner_ids]
            all_elements.extend(outer_elements)
            log(f"   Outer ring: {len(outer_elements)} new elements")
        except Exception as e:
            log(f"   ⚠️ Outer ring query failed: {e}")
    
    # Combine and process
    combined_data = {"elements": all_elements}
    log(f"📦 Processing combined payload: {len(all_elements)} total elements")
    features = build_features(site["key"], combined_data, site["lat"], site["lon"])
    
    if not features:
        log("⚠️ No strategic features returned; threshold may be too high.")
    else:
        scores = [f.get("properties", {}).get("strategic_score", 0) for f in features]
        if scores:
            log(f"   Strategic scores: min={min(scores):.1f}, max={max(scores):.1f}, avg={sum(scores)/len(scores):.1f}")
            tiers = {}
            for f in features:
                tier = f.get("properties", {}).get("strategic_tier", "low")
                tiers[tier] = tiers.get(tier, 0) + 1
            log(f"   Strategic tiers: {tiers}")
    
    # Build summary (reuse existing logic)
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
            "query_radius_miles": round(site["radius_m"] / 1609.34, 1),
            "bounding_box": envelope,
            "raw_element_count": len(all_elements),
            "strategic_threshold": STRATEGIC_SCORE_THRESHOLD,
            "max_features_limit": MAX_FEATURES_PER_SITE,
            "strategic_filtering": True,
            "batched_query": True,
        },
        "features": features,
    }


def fetch_site_data(site: Dict) -> Dict:
    """
    Fetch OSM data for a single site.
    For very large radius (>50km), automatically uses batched strategy.
    """
    radius_km = site["radius_m"] / 1000
    radius_miles = site["radius_m"] / 1609.34
    
    # Use batching for very large radius
    if site["radius_m"] > 50000:
        return fetch_site_data_batched(site)
    
    log(f"🧭 Building Overpass query for {site['name']} (radius {radius_miles:.1f} miles / {radius_km:.1f} km)")
    query = build_query(site["lat"], site["lon"], site["radius_m"])
    
    # Use longer timeout for large radius queries
    timeout = 300 if site["radius_m"] > 50000 else 180
    raw_data = execute_overpass(query, timeout=timeout)
    
    log(f"📦 Processing Overpass payload for {site['key']}")
    log(f"   Raw elements: {len(raw_data.get('elements', []))}")
    
    features = build_features(site["key"], raw_data, site["lat"], site["lon"])
    
    if not features:
        log("⚠️ No strategic features returned for this site; Overpass may have truncated the response or threshold too high.")
    else:
        # Log strategic score distribution
        scores = [f.get("properties", {}).get("strategic_score", 0) for f in features]
        if scores:
            log(f"   Strategic scores: min={min(scores):.1f}, max={max(scores):.1f}, avg={sum(scores)/len(scores):.1f}")
            # Count by tier
            tiers = {}
            for f in features:
                tier = f.get("properties", {}).get("strategic_tier", "low")
                tiers[tier] = tiers.get(tier, 0) + 1
            log(f"   Strategic tiers: {tiers}")

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
            "query_radius_miles": round(site["radius_m"] / 1609.34, 1),
            "bounding_box": envelope,
            "raw_element_count": len(raw_data.get("elements", [])),
            "strategic_threshold": STRATEGIC_SCORE_THRESHOLD,
            "max_features_limit": MAX_FEATURES_PER_SITE,
            "strategic_filtering": True,
        },
        "features": features,
    }


def ensure_output_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def write_site_file(site: Dict, payload: Dict) -> Path:
    # Align filenames with server.js expectations
    output_key = site.get("output_key", site["key"])
    filename = f"{output_key}.json"
    filepath = OUTPUT_DIR / filename
    with filepath.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    return filepath


def main() -> None:
    ensure_output_dir(OUTPUT_DIR)

    log(f"📦 Processing {len(SITES)} Pennsylvania nuclear sites")
    log(f"⚙️  Strategic filtering: score >= {STRATEGIC_SCORE_THRESHOLD}, max {MAX_FEATURES_PER_SITE} features per site")
    
    for site in SITES:
        log(f"🔄 Fetching OSM data for {site['name']} ({site['key']})")
        try:
        payload = fetch_site_data(site)
        output_path = write_site_file(site, payload)
            file_size_mb = output_path.stat().st_size / (1024 * 1024)
        log(
            f"✅ Wrote {output_path.name}: "
                f"{payload['summary']['feature_count']} strategic features, "
                f"{file_size_mb:.1f} MB, "
            f"categories={payload['summary']['categories']}"
        )
        except Exception as e:
            log(f"❌ Error processing {site['name']}: {e}")
            import traceback
            log(traceback.format_exc())
            continue
        
        # Small pause between sites to be polite to Overpass
        if site != SITES[-1]:  # Don't wait after last site
            log("⏳ Waiting 5s before next site...")
        time.sleep(5)

    log("🎉 Completed Pennsylvania nuclear OSM cache generation with strategic filtering.")


if __name__ == "__main__":
    main()


