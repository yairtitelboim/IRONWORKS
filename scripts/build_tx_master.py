#!/usr/bin/env python3
import hashlib
import json
import math
import re
import zipfile
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from xml.etree import ElementTree as ET

from rapidfuzz import fuzz


ROOT = Path(__file__).resolve().parents[1]
EXCEL_PATH = ROOT / "data" / "dc11.xlsx"
GEOJSON_INPUT_PATH = ROOT / "public" / "data" / "texas_data_centers.geojson.bak_20260307_073020"
ERCOT_COUNTIES_PATH = ROOT / "public" / "data" / "ercot" / "ercot_counties_aggregated.geojson"
MASTER_OUTPUT_PATH = ROOT / "data" / "tx_master_dc_list.json"
CANONICAL_OUTPUT_PATH = ROOT / "data" / "canonical-facilities.json"
GEOJSON_OUTPUT_PATH = ROOT / "public" / "data" / "texas_data_centers.geojson"
MARKER_GEOJSON_OUTPUT_PATH = ROOT / "public" / "data" / "facility-markers.geojson"
ADDRESS_SEARCH_INDEX_OUTPUT_PATH = ROOT / "public" / "data" / "address-search-index.json"
GEOCODING_QUEUE_OUTPUT_PATH = ROOT / "data" / "geocoding_queue.json"
EXCLUDED_ZERO_MW_OUTPUT_PATH = ROOT / "data" / "tx_excluded_zero_mw_clusters.json"
SHEET_NAME = "NA Data Center Supply"

COLUMN_MAP = {
    "lat": 89,
    "long": 90,
    "state": 91,
    "city": 92,
    "zip": 93,
    "country": 95,
    "region": 96,
    "company": 97,
    "market": 98,
    "type": 99,
    "onsite_gas": 100,
    "end_user": 101,
    "tenant": 103,
    "uc_mw": 73,
    "full_capacity_mw": 76,
    "planned_mw": 79,
    "start_ops": 74,
    "installed_q1_24": 83,
}

EXCEL_WIN_FIELDS = {
    "lat",
    "long",
    "company",
    "city",
    "market",
    "type",
    "planned_mw",
    "uc_mw",
    "tenant",
    "end_user",
    "onsite_gas",
    "earliest_start_date",
    "installed_mw",
}
GEO_WIN_FIELDS = {
    "announced_date",
    "status",
    "probability_score",
    "source_count",
    "project_id",
    "article_title",
    "source_url",
    "source_name",
    "published_at",
    "last_seen_at",
}

DEFAULT_LAT = 31.503
DEFAULT_LON = -97.784

EXCLUDED_GEOJSON_ONLY_PROJECT_IDS = {
    "proj_a19b7d001ee2",  # Oracle, Santa Teresa (NM)
    "proj_cba04af5c0ac",  # aggregate Austin County listing
}
EXCLUDED_GEOJSON_ONLY_CITY_PHRASES = {
    "data center campus to be constructed in",
    "as epa moves to fast-track",
}


def col_ref_to_index(cell_ref: str) -> int:
    letters = "".join(ch for ch in cell_ref if ch.isalpha())
    idx = 0
    for ch in letters:
        idx = idx * 26 + (ord(ch.upper()) - ord("A") + 1)
    return idx - 1


def parse_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        if isinstance(v, float) and math.isnan(v):
            return None
        return float(v)
    s = str(v).strip()
    if not s or s.lower() in {"nan", "none", "null", "n/a", "-"}:
        return None
    s = s.replace(",", "")
    try:
        return float(s)
    except ValueError:
        return None


def parse_int(v: Any) -> Optional[int]:
    f = parse_float(v)
    if f is None:
        return None
    return int(round(f))


def norm_text(v: Any) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


def excel_serial_to_date_str(n: float) -> Optional[str]:
    if n <= 0:
        return None
    # Excel epoch with 1900 leap-year bug compensation.
    base = datetime(1899, 12, 30)
    try:
        dt = base + timedelta(days=float(n))
    except Exception:
        return None
    return dt.date().isoformat()


def parse_date(v: Any) -> Optional[str]:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return excel_serial_to_date_str(float(v))
    s = str(v).strip()
    if not s:
        return None
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s):
        return s
    if re.fullmatch(r"\d{1,2}/\d{1,2}/\d{2,4}", s):
        parts = s.split("/")
        m = int(parts[0])
        d = int(parts[1])
        y = int(parts[2])
        if y < 100:
            y += 2000 if y < 70 else 1900
        try:
            return datetime(y, m, d).date().isoformat()
        except ValueError:
            return None
    try:
        return datetime.fromisoformat(s.replace("Z", "")).date().isoformat()
    except Exception:
        return None


def strip_placeholder_announced_date(v: Optional[str]) -> Optional[str]:
    if not v:
        return None
    if re.fullmatch(r"\d{4}-01-01", v):
        return None
    return v


def normalize_company_name(name: Optional[str]) -> str:
    if not name:
        return ""
    s = name.lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    for token in [
        "data center",
        "data centers",
        "digital",
        "inc",
        "llc",
        "corp",
        "corporation",
        "co",
        "company",
        "ltd",
        "the",
    ]:
        s = re.sub(rf"\b{re.escape(token)}\b", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def normalize_type(v: Optional[str]) -> str:
    s = (v or "").strip().lower()
    if "hyper" in s:
        return "hyperscaler"
    if "colo" in s:
        return "colocation"
    if "edge" in s:
        return "edge"
    if "crypto" in s or "bitcoin" in s or "mining" in s:
        return "crypto"
    return "unknown"


def normalize_status(v: Optional[str]) -> str:
    s = (v or "").strip().lower().replace("-", "_").replace(" ", "_")
    if s in {"under_construction", "construction", "uc"}:
        return "under_construction"
    if s in {"operational", "active", "online", "existing"}:
        return "operational"
    if s in {"planned", "proposed", "announced"}:
        return "planned"
    if s in {"paused", "on_hold", "deferred"}:
        return "paused"
    if s in {"cancelled", "canceled", "dead_candidate"}:
        return "cancelled"
    return "unknown"


def is_placeholder_text(v: Optional[str]) -> bool:
    s = (v or "").strip().lower()
    return s in {"", "0", "unknown", "unknown project", "none", "null", "n/a", "na", "-", "tbd", "none known"}


def clean_text_field(v: Any) -> Optional[str]:
    s = norm_text(v)
    if s is None or is_placeholder_text(s):
        return None
    return re.sub(r"\s+", " ", s).strip()


def clean_city(v: Any) -> Optional[str]:
    city = clean_text_field(v)
    if city is None:
        return None
    if city.lower() in {"texas", "tx", "usa", "west", "east", "north", "south", "central"}:
        return None
    return city


def titleize_label(v: Optional[str]) -> Optional[str]:
    if not v:
        return None
    return " ".join(part.capitalize() for part in v.replace("_", " ").split())


def status_to_label(status: Optional[str]) -> str:
    return titleize_label(status or "unknown") or "Unknown"


def type_to_label(type_value: Optional[str]) -> Optional[str]:
    normalized = normalize_type(type_value)
    return None if normalized == "unknown" else titleize_label(normalized)


def derive_display_name(rec: Dict[str, Any]) -> str:
    for candidate in (
        clean_text_field(rec.get("project_name")),
        clean_text_field(rec.get("company")),
        clean_text_field(rec.get("city")),
    ):
        if candidate:
            return candidate
    return "Data center project"


def derive_source_label(source_name: Optional[str], source_url: Optional[str]) -> Optional[str]:
    cleaned_name = clean_text_field(source_name)
    if cleaned_name:
        return cleaned_name
    cleaned_url = clean_text_field(source_url)
    if not cleaned_url:
        return None
    try:
        host = cleaned_url.split("//", 1)[-1].split("/", 1)[0].lower()
        host = re.sub(r"^www\.", "", host)
        return host or None
    except Exception:
        return None


def safe_iso_datetime() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def parse_date_to_datetime(v: Optional[str]) -> Optional[datetime]:
    if not v:
        return None
    try:
        return datetime.fromisoformat(v)
    except Exception:
        return None


def compute_age_days(published_at: Optional[str], generated_at: datetime) -> Optional[int]:
    published = parse_date_to_datetime(published_at)
    if published is None:
        return None
    delta = generated_at.date() - published.date()
    return delta.days if delta.days >= 0 else None


def clean_probability_score(v: Any) -> str:
    s = (clean_text_field(v) or "unknown").lower()
    return s if s in {"high", "medium", "low", "unknown"} else "unknown"


def build_location_label(city: Optional[str], county: Optional[str]) -> Optional[str]:
    if city and county:
        return f"{city}, {county}"
    return city or county


def point_in_ring(lon: float, lat: float, ring: List[List[float]]) -> bool:
    inside = False
    if len(ring) < 3:
        return False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        intersects = ((yi > lat) != (yj > lat)) and (
            lon < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi
        )
        if intersects:
            inside = not inside
        j = i
    return inside


def point_in_polygon_coords(lon: float, lat: float, polygon_coords: List[List[List[float]]]) -> bool:
    if not polygon_coords:
        return False
    if not point_in_ring(lon, lat, polygon_coords[0]):
        return False
    for hole in polygon_coords[1:]:
        if point_in_ring(lon, lat, hole):
            return False
    return True


def compute_bbox(geometry: Dict[str, Any]) -> Optional[Tuple[float, float, float, float]]:
    coords = geometry.get("coordinates")
    if not coords:
        return None
    points: List[Tuple[float, float]] = []
    geometry_type = geometry.get("type")
    if geometry_type == "Polygon":
        for ring in coords:
            for pt in ring:
                points.append((pt[0], pt[1]))
    elif geometry_type == "MultiPolygon":
        for polygon in coords:
            for ring in polygon:
                for pt in ring:
                    points.append((pt[0], pt[1]))
    if not points:
        return None
    xs = [pt[0] for pt in points]
    ys = [pt[1] for pt in points]
    return (min(xs), min(ys), max(xs), max(ys))


def load_county_features() -> List[Dict[str, Any]]:
    if not ERCOT_COUNTIES_PATH.exists():
        return []
    data = json.loads(ERCOT_COUNTIES_PATH.read_text(encoding="utf-8"))
    features = []
    for feature in data.get("features", []):
        geometry = feature.get("geometry") or {}
        bbox = compute_bbox(geometry)
        if bbox is None:
            continue
        props = feature.get("properties") or {}
        county_name = clean_text_field(props.get("NAME") or props.get("name"))
        if county_name and not county_name.lower().endswith("county"):
            county_name = f"{county_name} County"
        features.append(
            {
                "county_name": county_name,
                "dominant_fuel_type": clean_text_field(props.get("dominant_fuel_type")),
                "bbox": bbox,
                "geometry": geometry,
            }
        )
    return features


def enrich_county(lat: Optional[float], lon: Optional[float], county_features: List[Dict[str, Any]]) -> Tuple[Optional[str], Optional[str]]:
    if lat is None or lon is None:
        return None, None
    for county in county_features:
        min_x, min_y, max_x, max_y = county["bbox"]
        if lon < min_x or lon > max_x or lat < min_y or lat > max_y:
            continue
        geometry = county["geometry"]
        geometry_type = geometry.get("type")
        if geometry_type == "Polygon":
            if point_in_polygon_coords(lon, lat, geometry.get("coordinates") or []):
                return county["county_name"], county["dominant_fuel_type"]
        elif geometry_type == "MultiPolygon":
            for polygon in geometry.get("coordinates") or []:
                if point_in_polygon_coords(lon, lat, polygon):
                    return county["county_name"], county["dominant_fuel_type"]
    return None, None


def build_canonical_record(raw: Dict[str, Any], generated_at: datetime, county_features: List[Dict[str, Any]]) -> Dict[str, Any]:
    latitude = parse_float(raw.get("lat"))
    longitude = parse_float(raw.get("long"))
    county_name, county_dominant_fuel = enrich_county(latitude, longitude, county_features)
    city = clean_city(raw.get("city"))
    tenant = clean_text_field(raw.get("tenant"))
    end_user = clean_text_field(raw.get("end_user"))
    power_source = clean_text_field(raw.get("onsite_gas"))
    status = normalize_status(raw.get("status"))
    type_value = normalize_type(raw.get("type"))
    source_url = clean_text_field(raw.get("source_url"))
    source_name = derive_source_label(raw.get("source_name"), source_url)
    published_at = parse_date(raw.get("published_at"))
    latest_signal_title = clean_text_field(raw.get("article_title"))
    canonical = {
        "project_id": raw.get("project_id"),
        "display_name": derive_display_name(raw),
        "company_name": clean_text_field(raw.get("company")),
        "status": status,
        "status_label": status_to_label(status),
        "city": city,
        "county": county_name,
        "state": "TX",
        "market": clean_text_field(raw.get("market")),
        "location_label": build_location_label(city, county_name),
        "latitude": latitude if latitude not in {0.0} else None,
        "longitude": longitude if longitude not in {0.0} else None,
        "geocode_confidence": clean_text_field(raw.get("geocode_confidence")),
        "geocoding_needs_review": bool(raw.get("geocoding_needs_review")),
        "planned_mw": parse_float(raw.get("planned_mw")),
        "installed_mw": parse_float(raw.get("installed_mw")),
        "total_mw": parse_float(raw.get("total_mw")),
        "type": type_value,
        "type_label": type_to_label(type_value),
        "tenant": tenant,
        "end_user": end_user,
        "power_source": power_source,
        "announced_date": parse_date(raw.get("announced_date")),
        "expected_completion_date": parse_date(raw.get("expected_completion_date")),
        "earliest_start_date": parse_date(raw.get("earliest_start_date")),
        "latest_signal_title": latest_signal_title,
        "latest_signal_url": source_url,
        "latest_signal_source": source_name,
        "latest_signal_published_at": published_at,
        "latest_signal_age_days": compute_age_days(published_at, generated_at),
        "latest_signal_placeholder": "Latest signal",
        "source_count": parse_int(raw.get("source_count")),
        "probability_score": clean_probability_score(raw.get("probability_score")),
        "data_source": clean_text_field(raw.get("data_source")) or "unknown",
        "dominant_fuel_type": county_dominant_fuel,
        "source_row_numbers": raw.get("source_row_numbers"),
        "notes": clean_text_field(raw.get("notes")),
    }
    return canonical


def build_marker_properties(canonical: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "project_id": canonical["project_id"],
        "display_name": canonical["display_name"],
        "project_name": canonical["display_name"],
        "company": canonical["company_name"],
        "company_name": canonical["company_name"],
        "status": canonical["status"],
        "status_label": canonical["status_label"],
        "city": canonical["city"],
        "county": canonical["county"],
        "location_label": canonical["location_label"],
        "location": canonical["location_label"] or canonical["city"],
        "planned_mw": canonical["planned_mw"],
        "installed_mw": canonical["installed_mw"],
        "total_mw": canonical["total_mw"],
        "size_mw": canonical["total_mw"],
        "type": canonical["type"],
        "type_label": canonical["type_label"],
        "tenant": canonical["tenant"],
        "power_source": canonical["power_source"],
        "latest_signal_title": canonical["latest_signal_title"],
        "latest_signal_url": canonical["latest_signal_url"],
        "latest_signal_source": canonical["latest_signal_source"],
        "latest_signal_published_at": canonical["latest_signal_published_at"],
        "latest_signal_placeholder": canonical["latest_signal_placeholder"],
        "source_count": canonical["source_count"],
        "article_title": canonical["latest_signal_title"],
        "source_url": canonical["latest_signal_url"],
        "source_name": canonical["latest_signal_source"],
        "published_at": canonical["latest_signal_published_at"],
        "data_source": canonical["data_source"],
        "probability_score": canonical["probability_score"],
        "dominant_fuel_type": canonical["dominant_fuel_type"],
    }


def build_address_search_item(canonical: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "project_id": canonical["project_id"],
        "display_name": canonical["display_name"],
        "city": canonical["city"],
        "county": canonical["county"],
        "market": canonical["market"],
        "status": canonical["status"],
        "status_label": canonical["status_label"],
        "planned_mw": canonical["planned_mw"],
        "installed_mw": canonical["installed_mw"],
        "total_mw": canonical["total_mw"],
        "type": canonical["type"],
        "type_label": canonical["type_label"],
        "tenant": canonical["tenant"],
        "end_user": canonical["end_user"],
        "power_source": canonical["power_source"],
        "latitude": canonical["latitude"],
        "longitude": canonical["longitude"],
    }


def pick_preferred_text(members: List[Dict[str, Any]], field: str, allow_placeholder: bool = True) -> Optional[str]:
    values: List[str] = []
    for m in members:
        val = norm_text(m.get(field))
        if val is None:
            continue
        if not allow_placeholder and is_placeholder_text(val):
            continue
        values.append(val)
    if values:
        return values[0]
    # Fallback: if we filtered placeholders out and found nothing, preserve first non-null original.
    for m in members:
        val = norm_text(m.get(field))
        if val is not None:
            return val
    return None


def needs_geocode_review(lat: Optional[float], lon: Optional[float]) -> bool:
    if lat is None or lon is None:
        return True
    if abs(lat) < 1e-9 or abs(lon) < 1e-9:
        return True
    if abs(lat - DEFAULT_LAT) < 1e-6 and abs(lon - DEFAULT_LON) < 1e-6:
        return True
    return False


def has_zero_coordinate(lat: Optional[float], lon: Optional[float]) -> bool:
    return lat == 0 or lon == 0


def passes_geojson_only_quality_floor(rec: Dict[str, Any]) -> bool:
    if rec.get("data_source") != "geojson_only":
        return True
    source_count = rec.get("source_count") or 0
    status = (rec.get("status") or "").strip().lower()
    prob = (rec.get("probability_score") or "").strip().lower()
    return source_count >= 2 or status == "operational" or prob in {"medium", "high"}


def dist_km(a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
    r = 6371.0
    p1 = math.radians(a_lat)
    p2 = math.radians(b_lat)
    dphi = math.radians(b_lat - a_lat)
    dlambda = math.radians(b_lon - a_lon)
    x = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(x), math.sqrt(max(0.0, 1 - x)))


def dist_deg(a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
    return math.sqrt((a_lat - b_lat) ** 2 + (a_lon - b_lon) ** 2)


def read_shared_strings(zf: zipfile.ZipFile) -> List[str]:
    path = "xl/sharedStrings.xml"
    if path not in zf.namelist():
        return []
    root = ET.fromstring(zf.read(path))
    ns = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    out = []
    for si in root.findall("x:si", ns):
        parts = []
        for t in si.findall(".//x:t", ns):
            parts.append(t.text or "")
        out.append("".join(parts))
    return out


def resolve_sheet_xml_path(zf: zipfile.ZipFile, sheet_name: str) -> str:
    wb = ET.fromstring(zf.read("xl/workbook.xml"))
    ns = {
        "x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
        "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    }
    rid = None
    for s in wb.findall("x:sheets/x:sheet", ns):
        if s.attrib.get("name") == sheet_name:
            rid = s.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
            break
    if not rid:
        raise ValueError(f"Sheet not found: {sheet_name}")

    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    rel_ns = {"r": "http://schemas.openxmlformats.org/package/2006/relationships"}
    target = None
    for rel in rels.findall("r:Relationship", rel_ns):
        if rel.attrib.get("Id") == rid:
            target = rel.attrib.get("Target")
            break
    if not target:
        raise ValueError(f"Workbook relationship target not found for {rid}")
    if target.startswith("/"):
        return target.lstrip("/")
    return f"xl/{target}"


def read_xlsx_sheet_rows(path: Path, sheet_name: str) -> List[Dict[int, Any]]:
    with zipfile.ZipFile(path, "r") as zf:
        shared = read_shared_strings(zf)
        sheet_path = resolve_sheet_xml_path(zf, sheet_name)
        root = ET.fromstring(zf.read(sheet_path))
    ns = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    rows_out: List[Dict[int, Any]] = []
    for row in root.findall(".//x:sheetData/x:row", ns):
        row_map: Dict[int, Any] = {"__rownum__": int(row.attrib.get("r", "0"))}
        for c in row.findall("x:c", ns):
            ref = c.attrib.get("r")
            if not ref:
                continue
            col_idx = col_ref_to_index(ref)
            t = c.attrib.get("t")
            value: Any = None
            if t == "inlineStr":
                is_node = c.find("x:is/x:t", ns)
                value = is_node.text if is_node is not None else None
            else:
                v_node = c.find("x:v", ns)
                if v_node is not None:
                    raw = v_node.text
                    if t == "s":
                        try:
                            value = shared[int(raw)] if raw is not None else None
                        except Exception:
                            value = None
                    else:
                        value = raw
            row_map[col_idx] = value
        rows_out.append(row_map)
    return rows_out


def parse_excel_clusters() -> Tuple[List[Dict[str, Any]], int, List[Dict[str, Any]]]:
    rows = read_xlsx_sheet_rows(EXCEL_PATH, SHEET_NAME)
    parsed_rows = []
    for row in rows:
        rownum = row.get("__rownum__", 0)
        if rownum < 6:
            continue
        raw_state = norm_text(row.get(COLUMN_MAP["state"]))
        if not raw_state:
            continue
        st = raw_state.strip().lower()
        if st not in {"texas", "tx"}:
            continue
        lat = parse_float(row.get(COLUMN_MAP["lat"]))
        lon = parse_float(row.get(COLUMN_MAP["long"]))
        company = norm_text(row.get(COLUMN_MAP["company"]))
        if not company:
            continue
        planned_mw = parse_float(row.get(COLUMN_MAP["planned_mw"])) or 0.0
        uc_mw = parse_float(row.get(COLUMN_MAP["uc_mw"])) or 0.0
        parsed_rows.append(
            {
                "__rownum__": rownum,
                "lat": lat,
                "long": lon,
                "state": "TX",
                "city": norm_text(row.get(COLUMN_MAP["city"])),
                "zip": norm_text(row.get(COLUMN_MAP["zip"])),
                "country": norm_text(row.get(COLUMN_MAP["country"])),
                "region": norm_text(row.get(COLUMN_MAP["region"])),
                "company": company,
                "market": norm_text(row.get(COLUMN_MAP["market"])),
                "type": normalize_type(norm_text(row.get(COLUMN_MAP["type"]))),
                "onsite_gas": norm_text(row.get(COLUMN_MAP["onsite_gas"])),
                "end_user": norm_text(row.get(COLUMN_MAP["end_user"])),
                "tenant": norm_text(row.get(COLUMN_MAP["tenant"])),
                "uc_mw": uc_mw,
                "full_capacity_mw": parse_float(row.get(COLUMN_MAP["full_capacity_mw"])),
                "planned_mw": planned_mw,
                "start_ops": parse_date(row.get(COLUMN_MAP["start_ops"])),
                "installed_q1_24": parse_float(row.get(COLUMN_MAP["installed_q1_24"])),
            }
        )

    grouped: Dict[Tuple[str, Optional[float], Optional[float]], List[Dict[str, Any]]] = defaultdict(list)
    for r in parsed_rows:
        lat = r["lat"]
        lon = r["long"]
        if lat is None or lon is None:
            lat_r = None
            lon_r = None
        else:
            lat_r = round(lat, 2)
            lon_r = round(lon, 2)
        grouped[(r["company"], lat_r, lon_r)].append(r)

    clusters: List[Dict[str, Any]] = []
    excluded_zero_mw_clusters: List[Dict[str, Any]] = []
    for (company, lat_r, lon_r), members in grouped.items():
        first = members[0]
        planned_sum = sum((m.get("planned_mw") or 0.0) for m in members)
        uc_sum = sum((m.get("uc_mw") or 0.0) for m in members)
        total_mw = planned_sum + uc_sum
        dates = sorted({m["start_ops"] for m in members if m.get("start_ops")})
        earliest = dates[0] if dates else None
        installed_values = sorted({float(v) for v in (m.get("installed_q1_24") for m in members) if v is not None})
        installed_max = max(installed_values) if installed_values else None
        installed_sum = float(sum(v for v in (m.get("installed_q1_24") for m in members) if v is not None)) if installed_values else None
        key_company = company or ""
        id_seed = f"{key_company}|{lat_r}|{lon_r}"
        excel_id = "ex_" + hashlib.md5(id_seed.encode("utf-8")).hexdigest()[:8]
        base_record = {
            "excel_id": excel_id,
            "project_id": f"proj_{excel_id}",
            "company": company,
            "city": pick_preferred_text(members, "city"),
            "state": "TX",
            "market": pick_preferred_text(members, "market"),
            "type": normalize_type(pick_preferred_text(members, "type") or "unknown"),
            "lat": first.get("lat"),
            "long": first.get("long"),
            "planned_mw": float(planned_sum) if planned_sum else None,
            "uc_mw": float(uc_sum) if uc_sum else None,
            "total_mw": float(total_mw) if total_mw > 0 else 0.0,
            "tenant": pick_preferred_text(members, "tenant", allow_placeholder=False),
            "end_user": pick_preferred_text(members, "end_user", allow_placeholder=False),
            "onsite_gas": pick_preferred_text(members, "onsite_gas", allow_placeholder=False),
            "earliest_start_date": earliest,
            "announced_date": None,
            "status": "planned",
            "probability_score": None,
            "source_count": None,
            "geocoding_needs_review": needs_geocode_review(first.get("lat"), first.get("long")),
            "notes": None,
            # Installed load captured in Excel; normalized name exposed to downstream consumers.
            "installed_mw": installed_sum,
            # Recovery hints for auditing.
            "installed_q1_24": installed_max,
            "installed_q1_24_sum": installed_sum,
            "installed_q1_24_values": installed_values if installed_values else None,
            "cluster_member_count": len(members),
            "source_row_numbers": sorted(m.get("__rownum__") for m in members if m.get("__rownum__") is not None),
            "zip": pick_preferred_text(members, "zip"),
            "country": pick_preferred_text(members, "country"),
            "region": pick_preferred_text(members, "region"),
            "full_capacity_mw": max((m.get("full_capacity_mw") for m in members if m.get("full_capacity_mw") is not None), default=None),
        }
        if total_mw <= 0 and (installed_sum is None or installed_sum <= 0):
            excluded_rec = dict(base_record)
            excluded_rec["data_source"] = "excel_zero_mw_excluded"
            excluded_zero_mw_clusters.append(excluded_rec)
            continue

        include_rec = dict(base_record)
        include_rec["data_source"] = "excel_base"
        clusters.append(include_rec)
    return clusters, len(parsed_rows), excluded_zero_mw_clusters


def apply_excel_cluster_overrides(clusters: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    # Manual business fix: Compass Datacenters Red Oak duplicate 36MW rows are one campus cluster.
    target_company = "compass datacenters"
    target_city = "red oak"
    target = [
        c
        for c in clusters
        if (c.get("company") or "").strip().lower() == target_company
        and (c.get("city") or "").strip().lower() == target_city
    ]
    if len(target) <= 1:
        return clusters

    keep = [c for c in clusters if c not in target]
    target_sorted = sorted(target, key=lambda x: x.get("excel_id") or "")
    base = dict(target_sorted[0])
    others = target_sorted[1:]

    planned = (base.get("planned_mw") or 0.0) + sum((o.get("planned_mw") or 0.0) for o in others)
    uc = (base.get("uc_mw") or 0.0) + sum((o.get("uc_mw") or 0.0) for o in others)
    base["planned_mw"] = float(planned) if planned > 0 else None
    base["uc_mw"] = float(uc) if uc > 0 else None
    total = planned + uc
    base["total_mw"] = float(total) if total > 0 else None

    # Preserve the earliest known start date in the merged cluster.
    dates = [d for d in [base.get("earliest_start_date")] + [o.get("earliest_start_date") for o in others] if d]
    base["earliest_start_date"] = min(dates) if dates else None

    merged_members = [base] + others
    base["tenant"] = pick_preferred_text(merged_members, "tenant", allow_placeholder=False)
    base["end_user"] = pick_preferred_text(merged_members, "end_user", allow_placeholder=False)
    base["onsite_gas"] = pick_preferred_text(merged_members, "onsite_gas", allow_placeholder=False)

    keep.append(base)
    return keep


def parse_geojson_records() -> List[Dict[str, Any]]:
    data = json.loads(GEOJSON_INPUT_PATH.read_text(encoding="utf-8"))
    feats = data.get("features", [])
    out = []
    for f in feats:
        props = dict(f.get("properties") or {})
        coords = ((f.get("geometry") or {}).get("coordinates") or [None, None])
        lon = parse_float(coords[0]) if len(coords) > 0 else None
        lat = parse_float(coords[1]) if len(coords) > 1 else None
        rec = {
            "project_id": norm_text(props.get("project_id")),
            "company": norm_text(props.get("company")),
            "city": norm_text(props.get("city")) or norm_text(props.get("location")),
            "state": "TX",
            "market": norm_text(props.get("market")),
            "type": normalize_type(norm_text(props.get("type"))),
            "lat": lat,
            "long": lon,
            "planned_mw": parse_float(props.get("planned_mw")),
            "uc_mw": parse_float(props.get("uc_mw")),
            "tenant": norm_text(props.get("tenant")),
            "end_user": norm_text(props.get("end_user")),
            "onsite_gas": norm_text(props.get("onsite_gas")),
            "earliest_start_date": parse_date(props.get("earliest_start_date") or props.get("start_ops")),
            "installed_mw": parse_float(props.get("installed_mw") or props.get("installed_q1_24")),
            "announced_date": strip_placeholder_announced_date(parse_date(props.get("announced_date"))),
            "status": normalize_status(norm_text(props.get("status"))),
            "probability_score": norm_text(props.get("probability_score")),
            "source_count": parse_int(props.get("source_count")),
            "article_title": norm_text(props.get("article_title")),
            "source_url": norm_text(props.get("source_url")),
            "source_name": norm_text(props.get("source_name")),
            "published_at": parse_date(props.get("published_at")),
            "last_seen_at": parse_date(props.get("last_seen_at")),
            "excel_id": None,
            "data_source": "geojson_only",
            "notes": None,
            "_all_props": props,
        }
        planned = rec["planned_mw"] or 0.0
        uc = rec["uc_mw"] or 0.0
        rec["total_mw"] = float(planned + uc) if (planned + uc) > 0 else None
        rec["geocoding_needs_review"] = needs_geocode_review(rec["lat"], rec["long"])
        out.append(rec)
    return out


def merge_records(excel_rec: Dict[str, Any], geo_rec: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    all_fields = {
        "project_id",
        "excel_id",
        "data_source",
        "company",
        "city",
        "state",
        "market",
        "type",
        "lat",
        "long",
        "planned_mw",
        "uc_mw",
        "total_mw",
        "tenant",
        "end_user",
        "onsite_gas",
        "earliest_start_date",
        "installed_mw",
        "announced_date",
        "status",
        "probability_score",
        "source_count",
        "article_title",
        "source_url",
        "source_name",
        "published_at",
        "last_seen_at",
        "geocoding_needs_review",
        "notes",
    }
    for field in all_fields:
        if field in EXCEL_WIN_FIELDS:
            out[field] = excel_rec.get(field) if excel_rec.get(field) is not None else geo_rec.get(field)
        elif field in GEO_WIN_FIELDS:
            out[field] = geo_rec.get(field) if geo_rec.get(field) is not None else excel_rec.get(field)
        else:
            out[field] = excel_rec.get(field) if excel_rec.get(field) is not None else geo_rec.get(field)
    out["excel_id"] = excel_rec.get("excel_id")
    out["data_source"] = "excel_geojson_merged"
    if not out.get("project_id"):
        out["project_id"] = f"proj_{out['excel_id']}" if out.get("excel_id") else f"proj_{hashlib.md5((out.get('company') or '').encode()).hexdigest()[:8]}"
    out["type"] = normalize_type(out.get("type"))
    out["status"] = normalize_status(out.get("status"))
    planned = out.get("planned_mw") or 0.0
    uc = out.get("uc_mw") or 0.0
    out["total_mw"] = float(planned + uc) if (planned + uc) > 0 else None
    out["geocoding_needs_review"] = needs_geocode_review(out.get("lat"), out.get("long"))
    return out


def find_best_match(geo: Dict[str, Any], excel_records: List[Dict[str, Any]], used_excel_ids: set) -> Optional[str]:
    glat = geo.get("lat")
    glon = geo.get("long")
    gname = normalize_company_name(geo.get("company"))

    # 1) Coordinate proximity within 0.05 deg.
    if glat is not None and glon is not None:
        candidates = []
        for ex in excel_records:
            if ex["excel_id"] in used_excel_ids:
                continue
            elat = ex.get("lat")
            elon = ex.get("long")
            if elat is None or elon is None:
                continue
            d = dist_deg(glat, glon, elat, elon)
            if d <= 0.05:
                candidates.append((d, ex["excel_id"]))
        if candidates:
            candidates.sort(key=lambda x: x[0])
            return candidates[0][1]

    # 2) Fuzzy company match within 50km.
    if glat is not None and glon is not None and gname:
        best: Optional[Tuple[float, str]] = None
        for ex in excel_records:
            if ex["excel_id"] in used_excel_ids:
                continue
            elat = ex.get("lat")
            elon = ex.get("long")
            if elat is None or elon is None:
                continue
            if dist_km(glat, glon, elat, elon) > 50:
                continue
            ename = normalize_company_name(ex.get("company"))
            if not ename:
                continue
            ratio = max(
                fuzz.ratio(gname, ename),
                100 if gname in ename or ename in gname else 0,
            )
            if ratio >= 85 and (best is None or ratio > best[0]):
                best = (ratio, ex["excel_id"])
        if best:
            return best[1]
    return None


def ensure_unique_project_ids(records: List[Dict[str, Any]]) -> None:
    seen = defaultdict(int)
    for r in records:
        pid = r.get("project_id") or ""
        seen[pid] += 1
        if seen[pid] > 1:
            suffix = seen[pid] - 1
            r["project_id"] = f"{pid}__dup{suffix}"


def main() -> None:
    generated_at = datetime.utcnow().replace(microsecond=0)
    excel_clusters, excel_rows_tx, excluded_zero_mw_clusters = parse_excel_clusters()
    excel_clusters = apply_excel_cluster_overrides(excel_clusters)
    geo_records = parse_geojson_records()
    county_features = load_county_features()

    excel_by_id = {r["excel_id"]: r for r in excel_clusters}
    used_excel_ids = set()
    merged_records: List[Dict[str, Any]] = []
    geo_only_records: List[Dict[str, Any]] = []

    for geo in geo_records:
        match_id = find_best_match(geo, excel_clusters, used_excel_ids)
        if match_id:
            used_excel_ids.add(match_id)
            merged_records.append(merge_records(excel_by_id[match_id], geo))
        else:
            rec = dict(geo)
            rec["data_source"] = "geojson_only"
            rec["status"] = normalize_status(rec.get("status"))
            rec["type"] = normalize_type(rec.get("type"))
            if not rec.get("project_id"):
                seed = f"{rec.get('company')}|{rec.get('lat')}|{rec.get('long')}"
                rec["project_id"] = "proj_" + hashlib.md5(seed.encode("utf-8")).hexdigest()[:10]
            company_l = (rec.get("company") or "").strip().lower()
            city_l = (rec.get("city") or "").strip().lower()
            project_id = rec.get("project_id")
            city_has_excluded_phrase = any(phrase in city_l for phrase in EXCLUDED_GEOJSON_ONLY_CITY_PHRASES)
            if (
                company_l == "unknown"
                or city_has_excluded_phrase
                or project_id in EXCLUDED_GEOJSON_ONLY_PROJECT_IDS
            ):
                continue
            geo_only_records.append(
                {k: v for k, v in rec.items() if not k.startswith("_")}
            )

    excel_only_records = []
    for ex in excel_clusters:
        if ex["excel_id"] not in used_excel_ids:
            rec = dict(ex)
            rec["data_source"] = "excel_base"
            rec["status"] = "planned"
            rec["announced_date"] = rec.get("announced_date")
            excel_only_records.append(rec)

    records = merged_records + excel_only_records + geo_only_records
    ensure_unique_project_ids(records)

    for r in records:
        r["state"] = "TX"
        r["type"] = normalize_type(r.get("type"))
        r["status"] = normalize_status(r.get("status"))
        planned = r.get("planned_mw")
        uc = r.get("uc_mw")
        planned = float(planned) if planned is not None else None
        uc = float(uc) if uc is not None else None
        r["planned_mw"] = planned
        r["uc_mw"] = uc
        total = (planned or 0.0) + (uc or 0.0)
        r["total_mw"] = float(total) if total > 0 else None
        r["source_count"] = parse_int(r.get("source_count"))
        installed = parse_float(r.get("installed_mw"))
        r["installed_mw"] = float(installed) if installed is not None else None
        r["announced_date"] = strip_placeholder_announced_date(parse_date(r.get("announced_date")))
        r["geocoding_needs_review"] = needs_geocode_review(r.get("lat"), r.get("long"))
        # Recover operational signal for installed-only facilities.
        if r.get("status") == "unknown" and (r.get("total_mw") in {None, 0.0}) and (r.get("installed_mw") or 0) > 0:
            r["status"] = "operational"
        if r.get("notes") is None:
            r["notes"] = None

    records.sort(key=lambda x: ((x.get("total_mw") or 0.0), x.get("project_id") or ""), reverse=True)

    canonical_records = [build_canonical_record(r, generated_at, county_features) for r in records]
    canonical_records.sort(key=lambda x: ((x.get("total_mw") or 0.0), x.get("project_id") or ""), reverse=True)

    master = {
        "generated_at": generated_at.isoformat() + "Z",
        "version": "1.0",
        "record_count": len(records),
        "sources": {
            "excel_file": EXCEL_PATH.name,
            "geojson_file": GEOJSON_INPUT_PATH.name,
        },
        "stats": {
            "excel_only": sum(1 for r in records if r["data_source"] == "excel_base"),
            "geojson_only": sum(1 for r in records if r["data_source"] == "geojson_only"),
            "merged": sum(1 for r in records if r["data_source"] == "excel_geojson_merged"),
            "geocoding_needs_review": sum(1 for r in records if r.get("geocoding_needs_review")),
            "with_tenant": sum(1 for r in records if norm_text(r.get("tenant"))),
            "with_onsite_gas": sum(1 for r in records if norm_text(r.get("onsite_gas"))),
        },
        "records": records,
    }

    MASTER_OUTPUT_PATH.write_text(json.dumps(master, indent=2), encoding="utf-8")

    canonical_payload = {
        "generated_at": generated_at.isoformat() + "Z",
        "version": "1.0",
        "record_count": len(canonical_records),
        "sources": {
            "excel_file": EXCEL_PATH.name,
            "geojson_file": GEOJSON_INPUT_PATH.name,
            "ercot_counties_file": ERCOT_COUNTIES_PATH.name if ERCOT_COUNTIES_PATH.exists() else None,
        },
        "stats": {
            "with_county": sum(1 for r in canonical_records if r.get("county")),
            "with_tenant": sum(1 for r in canonical_records if r.get("tenant")),
            "with_power_source": sum(1 for r in canonical_records if r.get("power_source")),
            "with_latest_signal_title": sum(1 for r in canonical_records if r.get("latest_signal_title")),
        },
        "facilities": canonical_records,
    }
    CANONICAL_OUTPUT_PATH.write_text(json.dumps(canonical_payload, indent=2), encoding="utf-8")

    excluded_zero_mw_payload = {
        "generated_at": generated_at.isoformat() + "Z",
        "version": "1.0",
        "record_count": len(excluded_zero_mw_clusters),
        "sources": {
            "excel_file": EXCEL_PATH.name,
            "geojson_file": GEOJSON_INPUT_PATH.name,
        },
        "stats": {
            "with_installed_q1_24": sum(1 for r in excluded_zero_mw_clusters if r.get("installed_q1_24") is not None),
            "geocoding_needs_review": sum(1 for r in excluded_zero_mw_clusters if r.get("geocoding_needs_review")),
        },
        "records": [{k: v for k, v in r.items() if v is not None} for r in excluded_zero_mw_clusters],
    }
    EXCLUDED_ZERO_MW_OUTPUT_PATH.write_text(json.dumps(excluded_zero_mw_payload, indent=2), encoding="utf-8")

    # Build geocoding queue from zero-coordinate records and exclude them from map export.
    zero_coord_records = [r for r in records if has_zero_coordinate(r.get("lat"), r.get("long"))]
    geocoding_queue = {
        "generated_at": generated_at.isoformat() + "Z",
        "records": [],
    }
    for r in zero_coord_records:
        company = (r.get("company") or "").strip()
        city = (r.get("city") or "").strip()
        query = f"{company} data center {city} Texas".strip()
        geocoding_queue["records"].append(
            {
                "project_id": r.get("project_id"),
                "company": r.get("company"),
                "city": r.get("city"),
                "state": "TX",
                "query": re.sub(r"\s+", " ", query),
                "lat": None,
                "long": None,
            }
        )
    GEOCODING_QUEUE_OUTPUT_PATH.write_text(json.dumps(geocoding_queue, indent=2), encoding="utf-8")

    geo_features = []
    geo_export_records = [
        r
        for r in records
        if passes_geojson_only_quality_floor(r) and not has_zero_coordinate(r.get("lat"), r.get("long"))
    ]
    for r in geo_export_records:
        props = dict(r)
        lat = props.pop("lat", None)
        lon = props.pop("long", None)
        geom = None
        if lat is not None and lon is not None:
            geom = {"type": "Point", "coordinates": [lon, lat]}
        geo_features.append({"type": "Feature", "geometry": geom, "properties": props})

    out_geo = {
        "type": "FeatureCollection",
        "_metadata": {
            "generated_at": generated_at.isoformat() + "Z",
            "generated_from": "tx_master_dc_list.json",
            "version": "1.0",
            "record_count": len(geo_export_records),
        },
        "features": geo_features,
    }
    GEOJSON_OUTPUT_PATH.write_text(json.dumps(out_geo, indent=2), encoding="utf-8")

    marker_features = []
    address_search_items = []
    for canonical in canonical_records:
        lat = canonical.get("latitude")
        lon = canonical.get("longitude")
        address_search_items.append(build_address_search_item(canonical))
        if lat is None or lon is None:
            continue
        marker_features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": build_marker_properties(canonical),
            }
        )
    marker_geojson = {
        "type": "FeatureCollection",
        "_metadata": {
            "generated_at": generated_at.isoformat() + "Z",
            "generated_from": CANONICAL_OUTPUT_PATH.name,
            "version": "1.0",
            "record_count": len(marker_features),
        },
        "features": marker_features,
    }
    MARKER_GEOJSON_OUTPUT_PATH.write_text(json.dumps(marker_geojson, indent=2), encoding="utf-8")

    address_search_index = {
        "generated_at": generated_at.isoformat() + "Z",
        "version": "1.0",
        "record_count": len(address_search_items),
        "generated_from": CANONICAL_OUTPUT_PATH.name,
        "facilities": address_search_items,
    }
    ADDRESS_SEARCH_INDEX_OUTPUT_PATH.write_text(json.dumps(address_search_index, indent=2), encoding="utf-8")

    # Validation report
    recs_with_coords = sum(1 for r in records if r.get("lat") is not None and r.get("long") is not None)
    recs_mw = sum(1 for r in records if (r.get("planned_mw") or 0) > 0)
    recs_tenant = sum(1 for r in records if norm_text(r.get("tenant")))
    recs_gas = sum(1 for r in records if norm_text(r.get("onsite_gas")))
    recs_with_county = sum(1 for r in canonical_records if r.get("county"))
    recs_with_power_source = sum(1 for r in canonical_records if r.get("power_source"))
    recs_with_latest_signal = sum(1 for r in canonical_records if r.get("latest_signal_title"))
    geocode_flagged = sum(1 for r in records if r.get("geocoding_needs_review"))
    pids = [r.get("project_id") for r in records]
    dup_count = len(pids) - len(set(pids))
    zeros = sum(1 for r in records if (r.get("lat") == 0 or r.get("long") == 0))
    excel_only_n = sum(1 for r in records if r["data_source"] == "excel_base")
    merged_n = sum(1 for r in records if r["data_source"] == "excel_geojson_merged")
    geo_only_n = sum(1 for r in records if r["data_source"] == "geojson_only")

    print(f"Excel TX rows parsed: {excel_rows_tx}")
    print(f"Excel clusters included (total_mw>0 or installed_mw>0): {len(excel_clusters)}")
    print(f"GeoJSON records parsed: {len(geo_records)}")
    print("")
    print(f"✓ Total records: {len(records)}")
    print(f"✓ Records with lat/long: {recs_with_coords}")
    print(f"✓ Records with planned_mw > 0: {recs_mw}")
    print(f"✓ Records with tenant: {recs_tenant}")
    print(f"✓ Records with onsite_gas: {recs_gas}")
    print(f"✓ Canonical records with county: {recs_with_county}")
    print(f"✓ Canonical records with power_source: {recs_with_power_source}")
    print(f"✓ Canonical records with latest_signal_title: {recs_with_latest_signal}")
    print(f"✓ geocoding_needs_review: {geocode_flagged}")
    print(f"✓ Duplicate project_ids: {dup_count}")
    print(f"✓ Records where lat == 0 or long == 0: {zeros}")
    print(f"✓ data_source breakdown: excel_only={excel_only_n}, merged={merged_n}, geojson_only={geo_only_n}")
    print(f"✓ GeoJSON export records (post quality floor, no zero coords): {len(geo_export_records)}")
    print(f"✓ Canonical output records: {len(canonical_records)}")
    print(f"✓ Marker GeoJSON records: {len(marker_features)}")
    print(f"✓ Address search index records: {len(address_search_items)}")
    print(f"✓ Geocoding queue records: {len(geocoding_queue['records'])}")
    print(f"✓ Excluded zero-MW Excel clusters: {len(excluded_zero_mw_clusters)}")
    print("")
    print("Top 10 by total_mw:")
    top10 = sorted(records, key=lambda x: x.get("total_mw") or 0.0, reverse=True)[:10]
    for i, r in enumerate(top10, 1):
        print(f"{i:>2}. {r.get('project_id')} | {r.get('company')} | {r.get('city')} | total_mw={r.get('total_mw')}")


if __name__ == "__main__":
    main()
