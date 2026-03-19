# OSM Power Infrastructure Data Collection & Mounting Guide

## Overview

This document describes how power transmission and distribution infrastructure data is collected from OpenStreetMap (OSM) and mounted on the map via the Infrastructure button in `NestedCircleButton.jsx`.

## Architecture

### Data Flow

```
Python Scripts (OSM Collection)
    ↓
GeoJSON Files (public/osm/{site_key}.json)
    ↓
loadInfrastructureData.js (Loading & Processing)
    ↓
Mapbox GL JS Layers (Visualization)
    ↓
LegendContainer.jsx (Toggle Controls)
```

## 1. OSM Data Collection

### Python Scripts

Power infrastructure data is collected using Python scripts located in `scripts/osm-tools/`:

- **`pinal_county_osm.py`** - Regional power infrastructure (100-mile radius)
- **`lucid_ev_campus_osm.py`** - Lucid EV Campus area (50-mile radius)
- **`cactus_wren_transmission_osm.py`** - Cactus Wren Battery Facility transmission lines (15-mile radius, 230KV/500KV focus)

### Reference Script

All scripts are based on `pa_nuclear_datacenter_osm.py`, which provides:
- **Overpass API integration** with retry logic and timeouts
- **Batched queries** for large radius searches
- **Strategic filtering** to prioritize high-voltage transmission lines
- **Health checks** to verify API connectivity
- **GeoJSON generation** with categorized features

### OSM Query Strategy

The scripts use a tiered approach to fetch power infrastructure:

1. **High-Priority Queries:**
   - `power=line` with `voltage>=230000` (230KV+ transmission lines)
   - `power=substation` (substations and switchyards)
   - `power=tower` (transmission towers)

2. **Medium-Priority Queries:**
   - `power=line` with `voltage>=138000` (138KV+ distribution lines)
   - `power=cable` (underground cables)

3. **Low-Priority Queries:**
   - General `power=line` features
   - Other power infrastructure

### Data Categorization

Features are categorized during collection:

```python
# Categories assigned in Python scripts
'power_500kv'    # 500KV transmission lines
'power_230kv'    # 230KV transmission lines
'power_345kv'    # 345KV transmission lines
'substation'     # Substations (Point/Polygon)
'switchyard'     # Switchyards (Point/Polygon)
'power'          # General power lines
```

### Cactus Wren Transmission Specialization

The `cactus_wren_transmission_osm.py` script is specifically configured for the Cactus Wren Battery Facility:

- **Radius:** 15 miles (24,140 meters)
- **Focus:** High-voltage transmission infrastructure
- **Prioritization:**
  - 500KV lines (highest priority)
  - 345KV lines
  - 230KV lines
  - Switchyards and substations

**Query Configuration:**
```python
SITES = [{
    'lat': 32.945047,
    'lon': -111.997392,
    'radius_m': 24140,  # 15 miles
    'output_key': 'cactus_wren_transmission'
}]
```

## 2. GeoJSON File Structure

### File Locations

GeoJSON files are stored in `public/osm/`:
- `pinal_county.json` - Regional infrastructure
- `lucid_ev_campus.json` - Lucid area infrastructure
- `cactus_wren_transmission.json` - Cactus Wren transmission lines

### Feature Properties

Each feature includes:

```json
{
  "type": "Feature",
  "geometry": {
    "type": "LineString",
    "coordinates": [[lng, lat], ...]
  },
  "properties": {
    "category": "power_500kv",
    "voltage": "500000",  // Voltage in volts (string)
    "osm_id": 123456789,
    "tags": {
      "power": "line",
      "voltage": "500000",
      "name": "Transmission Line Name"
    }
  }
}
```

### Voltage Storage

- **Format:** String (e.g., `"500000"` for 500KV)
- **Units:** Volts (500000 = 500KV)
- **Source:** OSM `voltage` tag
- **Fallback:** Category-based classification if voltage tag missing

## 3. Loading & Mounting Process

### Infrastructure Button Trigger

The Infrastructure button (⚡) in `NestedCircleButton.jsx` triggers the loading process:

**Location:** `src/components/Map/components/Cards/NestedCircleButton.jsx` (lines 718-934)

**Click Handler Flow:**
1. **Cleanup:** Removes existing infrastructure layers
2. **Load General Data:** Calls `loadAndMountInfrastructure()` for current location
3. **Load Cactus Wren Data:** Explicitly loads `cactus_wren_transmission.json`
4. **Mount Layers:** Adds Mapbox GL JS layers to the map
5. **Emit Events:** Sends data to `LegendContainer` for toggle controls

### Location-to-Site Mapping

The `getSiteKeyForLocation()` function maps location keys to site keys:

**Location:** `src/components/Map/utils/loadInfrastructureData.js` (lines 79-87)

```javascript
const LOCATION_TO_SITE_KEY = {
  'default': 'pinal_county',
  'lucid_ev_campus': 'lucid_ev_campus',
  'cactus_wren_battery': 'cactus_wren_transmission',
  'seattle': 'seattle',
  'boston': 'boston'
};
```

**Special Logic:**
- If map is centered within 10km of Cactus Wren coordinates, automatically loads transmission data
- Otherwise, uses the location key mapping

### Data Loading Function

**Function:** `loadInfrastructureGeoJSON(siteKey)`

**Location:** `src/components/Map/utils/loadInfrastructureData.js` (lines 92-114)

**Process:**
1. Fetches GeoJSON from `/osm/{siteKey}.json`
2. Validates response (404 handling)
3. Returns parsed GeoJSON or `null` on error

### Layer Mounting Function

**Function:** `addInfrastructureLayers(mapInstance, geoJSON, siteKey)`

**Location:** `src/components/Map/utils/loadInfrastructureData.js` (lines 120-730)

**Process:**

#### Step 1: Feature Filtering

```javascript
// Power features (all voltage levels)
const powerFeatures = geoJSON.features.filter(f => 
  f.properties?.category === 'power' || 
  f.properties?.category === 'power_line' ||
  f.properties?.category === 'power_230kv' ||
  f.properties?.category === 'power_500kv' ||
  f.properties?.category === 'substation' ||
  f.properties?.category === 'switchyard'
);

// Substations (Point/Polygon only - excludes LineString transmission lines)
const substationFeatures = geoJSON.features.filter(f => {
  // Only Point or Polygon geometries
  if (f.geometry?.type !== 'Point' && 
      f.geometry?.type !== 'Polygon' && 
      f.geometry?.type !== 'MultiPolygon') {
    return false;
  }
  // Check for substation tags...
});
```

#### Step 2: Voltage Processing

Voltage values are pre-processed to ensure they're in properties:

```javascript
const processedFeatures = powerLinesGeoJSON.features.map(f => {
  const props = f.properties || {};
  const tags = props.tags || {};
  
  // Copy voltage from tags to properties if missing
  if (!props.voltage && tags.voltage) {
    return {
      ...f,
      properties: {
        ...props,
        voltage: tags.voltage
      }
    };
  }
  return f;
});
```

#### Step 3: Layer Creation

**Power Lines Layer:**

- **Type:** `line`
- **Source:** `${siteKey}-power-lines`
- **Color Coding:**
  - 500KV: `#ff0000` (Red)
  - 345KV: `#ff3300` (Red-orange)
  - 230KV: `#ff6600` (Orange)
  - 138KV: `#ffaa00` (Yellow-orange)
  - Lower: `#ffcc00` (Yellow)

- **Width (Zoom-based):**
  - Zoom 9: 3-5px (based on voltage)
  - Zoom 12: 5-8px
  - Zoom 15: 8-12px
  - Zoom 18: 12-16px

**Substations Layer:**

- **Type:** `circle`
- **Source:** `${siteKey}-substations`
- **Color:** `#ff6600` (Orange)
- **Size:** 8-20px (zoom-based)

**Water Layers:**

- **Lines:** `line` type, `#3b82f6` (Blue)
- **Fill:** `fill` type, `#3b82f6` with 0.5 opacity

#### Step 4: Layer Insertion

Layers are inserted before label layers to ensure visibility:

```javascript
// Find label layer to insert before
const layers = mapInstance.getStyle().layers;
let beforeId = null;
for (let i = layers.length - 1; i >= 0; i--) {
  if (layers[i].type === 'symbol' && layers[i].id.includes('label')) {
    beforeId = layers[i].id;
    break;
  }
}

// Add layer before label layer
mapInstance.addLayer(layerConfig, beforeId);
```

## 4. Voltage Classification

### Classification Logic

**Location:** `src/components/Map/utils/loadInfrastructureData.js` (lines 664-700)

Voltage classification uses the `voltage` property (not category) because:
- Python scripts may incorrectly categorize all features as `power_500kv`
- Voltage property is more reliable (directly from OSM tags)

**Classification:**
```javascript
const parseVoltage = (voltageStr) => {
  const cleaned = String(voltageStr).replace(/[^\d]/g, '');
  const num = parseInt(cleaned);
  // If > 1000, assume volts; if < 1000, assume kV and convert
  return num > 1000 ? num : num * 1000;
};

// Classify by voltage
if (voltageNum >= 500000) return '500kv';
else if (voltageNum >= 345000 && voltageNum < 500000) return '345kv';
else if (voltageNum >= 230000 && voltageNum < 500000) return '230kv';
else return 'other';
```

### Summary Statistics

The function returns a summary object:

```javascript
{
  powerLines: 113,        // Total power line features
  power500KV: 24,        // 500KV lines
  power230KV: 89,        // 230KV lines
  substations: 0,        // Point/Polygon substations
  switchyards: 14,        // Switchyard features
  waterLines: 228,       // Water line features
  waterFill: 105         // Water polygon features
}
```

## 5. Mapbox GL JS Expressions

### Color Expression

**Location:** `src/components/Map/utils/loadInfrastructureData.js` (lines 383-401)

```javascript
'line-color': [
  'case',
  // Check if voltage property exists
  ['all', ['has', 'voltage'], ['!=', ['get', 'voltage'], null], ['!=', ['get', 'voltage'], '']],
  [
    'case',
    // Voltage-based color
    ['>=', ['to-number', ['get', 'voltage']], 500000], '#ff0000',  // Red
    ['>=', ['to-number', ['get', 'voltage']], 345000], '#ff3300',  // Red-orange
    ['>=', ['to-number', ['get', 'voltage']], 230000], '#ff6600',  // Orange
    ['>=', ['to-number', ['get', 'voltage']], 138000], '#ffaa00',  // Yellow-orange
    '#ffcc00'  // Yellow (default)
  ],
  // Category fallback
  ['==', ['get', 'category'], 'power_500kv'], '#ff0000',
  ['==', ['get', 'category'], 'power_230kv'], '#ff6600',
  '#ffcc00'  // Default yellow
]
```

### Width Expression

**Location:** `src/components/Map/utils/loadInfrastructureData.js` (lines 402-469)

**Important:** Mapbox requires `zoom` at the top level of `interpolate` expressions. Width is determined by voltage at each zoom level:

```javascript
'line-width': [
  'interpolate',
  ['linear'],
  ['zoom'],
  // At zoom 9
  9, [
    'case',
    ['all', ['has', 'voltage'], ...],
    [
      'case',
      ['>=', ['to-number', ['get', 'voltage']], 500000], 5,  // 500kV: 5px
      ['>=', ['to-number', ['get', 'voltage']], 345000], 4,  // 345kV: 4px
      ['>=', ['to-number', ['get', 'voltage']], 230000], 3,  // 230kV: 3px
      3  // Default: 3px
    ],
    // Category fallback...
  ],
  // At zoom 12, 15, 18...
]
```

## 6. Cactus Wren Transmission Integration

### Dual Loading Strategy

When the Infrastructure button is clicked:

1. **General Infrastructure:** Loads data for `currentLocation` (e.g., `pinal_county`)
2. **Cactus Wren Transmission:** Explicitly loads `cactus_wren_transmission.json`

**Location:** `src/components/Map/components/Cards/NestedCircleButton.jsx` (lines 771-814)

```javascript
// Load general infrastructure
await loadAndMountInfrastructure(map.current, currentLocation, updateToolFeedback);

// Also load Cactus Wren transmission data
const cactusGeoJSON = await loadInfrastructureGeoJSON('cactus_wren_transmission');
if (cactusGeoJSON && cactusGeoJSON.features.length > 0) {
  const cactusSummary = addInfrastructureLayers(map.current, cactusGeoJSON, 'cactus_wren_transmission');
  
  // Emit to legend
  window.mapEventBus.emit('infrastructure:dataLoaded', {
    location: 'cactus_wren_battery',
    siteKey: 'cactus_wren_transmission',
    features: cactusGeoJSON.features,
    summary: cactusSummary
  });
}
```

### Cleanup

Both datasets are cleaned up before loading:

```javascript
// Clear previous layers
const siteKey = getSiteKeyForLocation(currentLocation, map.current);
removeInfrastructureLayers(map.current, siteKey);  // General
removeInfrastructureLayers(map.current, 'cactus_wren_transmission');  // Cactus
```

## 7. Legend Integration

### Event Bus Communication

**Location:** `src/components/Map/components/Cards/LegendContainer.jsx`

The infrastructure data is communicated via `window.mapEventBus`:

**Events:**
- `infrastructure:dataCleared` - Clears legend data
- `infrastructure:loading` - Shows loading state
- `infrastructure:dataLoaded` - Adds data to legend

**Event Payload:**
```javascript
{
  location: 'default' | 'cactus_wren_battery',
  siteKey: 'pinal_county' | 'cactus_wren_transmission',
  features: [...],  // GeoJSON features
  summary: {
    powerLines: 113,
    power500KV: 24,
    power230KV: 89,
    substations: 0,
    switchyards: 14,
    waterLines: 228,
    waterFill: 105,
    total: 113
  },
  timestamp: 1234567890
}
```

### Legend Display

The legend shows:
- **Power Lines (500KV)** - Red lines
- **Power Lines (230KV)** - Orange lines
- **Switchyards** - Orange markers
- **Water Lines** - Blue lines
- **Water Bodies** - Blue fill

Each category has a toggle to show/hide layers.

## 8. Running the Collection Scripts

### Prerequisites

```bash
pip install requests overpy
```

### Generate Data

**Pinal County (Regional):**
```bash
cd scripts/osm-tools
python3 pinal_county_osm.py
# Output: public/osm/pinal_county.json
```

**Lucid EV Campus:**
```bash
python3 lucid_ev_campus_osm.py
# Output: public/osm/lucid_ev_campus.json
```

**Cactus Wren Transmission:**
```bash
python3 cactus_wren_transmission_osm.py
# Output: public/osm/cactus_wren_transmission.json
```

### Health Checks

All scripts include Overpass API health checks before running:
- Verifies API connectivity
- Checks response times
- Provides error messages if API is unavailable

## 9. Troubleshooting

### Common Issues

**1. Layers Not Visible:**
- Check z-ordering (layers should be before label layers)
- Verify line width and opacity settings
- Check if features have valid geometries

**2. Wrong Colors:**
- Verify voltage property exists in features
- Check Mapbox expression syntax
- Ensure `to-number` conversion is working

**3. Substations Missing:**
- Verify substations are Point/Polygon (not LineString)
- Check OSM tagging (power=substation, substation:type, etc.)
- Review filtering logic in `addInfrastructureLayers()`

**4. Voltage Classification Incorrect:**
- Check voltage property format (should be string like "500000")
- Verify `parseVoltage()` function logic
- Review classification thresholds

### Debug Logging

The code includes extensive console logging:
- `🛠️ Loading infrastructure data from: /osm/{siteKey}.json`
- `✅ Loaded infrastructure data: {count} features`
- `📊 Infrastructure data categories: {...}`
- `⚡ Power feature geometry breakdown: {...}`
- `✅ Added power lines layer "{siteKey}-power-lines"`

## 10. Future Enhancements

### Potential Improvements

1. **Real-time OSM Updates:**
   - Periodic refresh of GeoJSON files
   - Webhook integration for OSM changes

2. **Interactive Features:**
   - Click on power lines to show voltage/name
   - Hover tooltips with infrastructure details
   - Popup cards for substations

3. **Advanced Filtering:**
   - Filter by voltage range
   - Filter by infrastructure type
   - Time-based filtering (if OSM history available)

4. **Performance Optimization:**
   - Clustering for dense areas
   - Level-of-detail (LOD) based on zoom
   - Vector tile generation for large datasets

## 11. File Structure

```
src/components/Map/
├── utils/
│   └── loadInfrastructureData.js      # Main loading/mounting logic
├── components/
│   └── Cards/
│       ├── NestedCircleButton.jsx     # Infrastructure button trigger
│       └── LegendContainer.jsx        # Legend display & toggles

scripts/osm-tools/
├── pa_nuclear_datacenter_osm.py       # Reference script
├── pinal_county_osm.py               # Pinal County collection
├── lucid_ev_campus_osm.py             # Lucid area collection
└── cactus_wren_transmission_osm.py    # Cactus Wren transmission

public/osm/
├── pinal_county.json                  # Regional infrastructure
├── lucid_ev_campus.json               # Lucid area infrastructure
└── cactus_wren_transmission.json     # Cactus Wren transmission lines
```

## 12. Key Functions Reference

### `getSiteKeyForLocation(locationKey, mapInstance)`
Maps location keys to site keys, with special handling for Cactus Wren area.

### `loadInfrastructureGeoJSON(siteKey)`
Fetches and parses GeoJSON from `/osm/{siteKey}.json`.

### `addInfrastructureLayers(mapInstance, geoJSON, siteKey)`
Processes features, creates Mapbox sources, and adds layers with styling.

### `removeInfrastructureLayers(mapInstance, siteKey)`
Removes all infrastructure layers and sources for a site.

### `loadAndMountInfrastructure(mapInstance, locationKey, updateToolFeedback)`
Main orchestration function: loads data, mounts layers, and emits events.

---

**Last Updated:** 2024
**Maintainer:** Development Team
**Related Docs:** `docs/README.md` (general OSM infrastructure guide)

