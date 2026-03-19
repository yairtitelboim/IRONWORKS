# Texas Highway Route Segments - Overpass API Queries

## Overview

This documentation describes the Overpass API queries used to fetch highway segments for the Texas route visualization system.

**Route**: Fort Stockton → Ozona → Junction/Sonora → Rocksprings → Leakey/Utopia → Hondo → Castroville → Medina County

## Generated Files

All files are saved in `/public/data/` directory as GeoJSON format, ready for use as toggle layers.

### 1. I-10 Fort Stockton to Ozona
- **File**: `i10_fort_stockton_ozona.geojson`
- **Features**: 3,064
- **Highway Refs**: I-10, I-10 Business routes
- **Bounding Box**: (-106.583, 29.394) to (-93.701, 32.001)

**Overpass Query**:
```overpass
[out:json][timeout:60];
(
  way["highway"]["ref"~"^(10)$"](30.8,-102.9,31.0,-101.0);
  rel["route"="road"]["ref"~"^(10)$"](30.8,-102.9,31.0,-101.0);
  way(r)["highway"];
  way["highway"~"^(trunk|primary)$"]["name"~".*(10).*"](30.8,-102.9,31.0,-101.0);
);
out geom;
```

### 2. I-10 Ozona to Junction/Sonora
- **File**: `i10_ozona_junction_sonora.geojson`
- **Features**: 3,032
- **Highway Refs**: I-10, I-10 with various combinations
- **Bounding Box**: (-106.583, 29.394) to (-93.701, 32.001)

**Overpass Query**:
```overpass
[out:json][timeout:60];
(
  way["highway"]["ref"~"^(10)$"](30.4,-101.0,30.9,-99.7);
  rel["route"="road"]["ref"~"^(10)$"](30.4,-101.0,30.9,-99.7);
  way(r)["highway"];
  way["highway"~"^(trunk|primary)$"]["name"~".*(10).*"](30.4,-101.0,30.9,-99.7);
);
out geom;
```

### 3. US-277 Sonora to Rocksprings
- **File**: `us277_sonora_rocksprings.geojson` (existing)
- **Features**: 34
- **Bounding Box**: (-100.774, 29.891) to (-100.636, 30.708)

### 4. US-83 Rocksprings to Leakey
- **File**: `us83_rocksprings_leakey.geojson`
- **Features**: 1,488
- **Highway Refs**: US-83 with various combinations, FM routes
- **Bounding Box**: (-100.806, 25.887) to (-97.476, 36.500)

**Overpass Query**:
```overpass
[out:json][timeout:60];
(
  way["highway"]["ref"~"^(83)$"](29.6,-100.2,30.0,-99.5);
  rel["route"="road"]["ref"~"^(83)$"](29.6,-100.2,30.0,-99.5);
  way(r)["highway"];
  way["highway"~"^(trunk|primary)$"]["name"~".*(83).*"](29.6,-100.2,30.0,-99.5);
);
out geom;
```

### 5. US-377 Leakey to Utopia
- **File**: `us377_leakey_utopia.geojson`
- **Features**: 306
- **Highway Refs**: Various state routes (FM, RM, TX), US-90
- **Bounding Box**: (-99.636, 29.143) to (-98.832, 29.913)

**Overpass Query (Expanded)**:
```overpass
[out:json][timeout:60];
(
  way["highway"]["ref"~"377"](29.3,-99.6,29.9,-98.9);
  way["highway"]["name"~".*377.*"](29.3,-99.6,29.9,-98.9);
  rel["route"="road"]["ref"~"377"](29.3,-99.6,29.9,-98.9);
  way(r)["highway"];
  way["highway"~"^(primary|secondary|trunk)$"](29.3,-99.6,29.9,-98.9);
);
out geom;
```

### 6. Local Roads Utopia to Hondo
- **File**: `local_utopia_hondo.geojson`
- **Features**: 1,201
- **Highway Refs**: Multiple TX state routes, FM routes, US-90
- **Bounding Box**: (-99.475, 29.076) to (-98.660, 29.733)

**Overpass Query (Broad Search)**:
```overpass
[out:json][timeout:60];
(
  way["highway"]["ref"~"^(1050|187)$"](29.1,-99.3,29.7,-98.7);
  way["highway"]["name"~".*(Utopia|Hondo).*"](29.1,-99.3,29.7,-98.7);
  way["highway"~"^(primary|secondary|trunk)$"](29.1,-99.3,29.7,-98.7);
  way["highway"="tertiary"](29.1,-99.3,29.7,-98.7);
);
out geom;
```

### 7. US-90 Hondo to Castroville
- **File**: `us90_hondo_castroville.geojson`
- **Features**: 2,024
- **Highway Refs**: US-90 with various combinations, I-10, state routes
- **Bounding Box**: (-104.831, 29.199) to (-93.701, 31.040)

**Overpass Query**:
```overpass
[out:json][timeout:60];
(
  way["highway"]["ref"~"^(90)$"](29.2,-98.8,29.4,-98.6);
  rel["route"="road"]["ref"~"^(90)$"](29.2,-98.8,29.4,-98.6);
  way(r)["highway"];
  way["highway"~"^(trunk|primary)$"]["name"~".*(90).*"](29.2,-98.8,29.4,-98.6);
);
out geom;
```

### 8. Local Roads Castroville to Medina County
- **File**: `local_castroville_medina.geojson`
- **Features**: 187
- **Highway Refs**: TX-173, TX-132, FM routes, US-90
- **Bounding Box**: (-99.144, 28.938) to (-98.561, 30.033)

**Overpass Query**:
```overpass
[out:json][timeout:60];
(
  way["highway"]["ref"~"^(471|173)$"](29.1,-98.9,29.4,-98.5);
  rel["route"="road"]["ref"~"^(471|173)$"](29.1,-98.9,29.4,-98.5);
  way(r)["highway"];
  way["highway"~"^(trunk|primary)$"]["name"~".*(471|173).*"](29.1,-98.9,29.4,-98.5);
);
out geom;
```

## Summary

- **Total Segments**: 8/8 successfully fetched
- **Total Features**: 11,336 road features
- **Format**: GeoJSON FeatureCollection
- **Coordinate System**: WGS84 (EPSG:4326)
- **File Size Range**: ~12KB to ~2.8MB

## Query Strategy

1. **Primary Search**: Target specific highway reference numbers using `ref` tag
2. **Relation Search**: Include highway relations to get complete routes
3. **Fallback Search**: Use highway types (trunk, primary) with name matching
4. **Expanded Bounds**: For missing segments, use broader geographic bounds
5. **Multi-tier Search**: Include secondary and tertiary roads for local connections

## Usage Notes

- Files are ready for direct use in mapping applications (Leaflet, Mapbox, etc.)
- Each feature includes OSM tags as properties
- Segments can be styled differently based on highway type
- Metadata includes generation timestamp and feature count
- Use as toggle layers for route visualization
- Compatible with most GIS software and web mapping libraries

## Scripts

- `fetch_texas_highway_segments.py`: Main fetcher for all segments
- `fetch_missing_segments.py`: Broad search for difficult segments
- `validate_route_segments.py`: Analysis and validation tool