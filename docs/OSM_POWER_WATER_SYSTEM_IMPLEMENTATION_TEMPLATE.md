## OSM + Power + Water System Implementation Template

This README is a **blueprint** for building a system that looks and behaves like the Pennsylvania nuclear + datacenter implementation in this project, but for a **different geographic context** (different country, region, or set of industrial sites).

It walks through:
- Defining **sites** (nuclear plants, datacenters, industrial hubs) with **radius AOIs**.
- Writing an **OSM fetch + processing script** to create a local GeoJSON cache (power, water, other).
- Wiring those GeoJSONs into **Mapbox layers**, with consistent **colors, markers, popups, and legend**.
- Optional: connecting to **MCP search**, **GeoAI** summaries, and the **timeline graph**.

Use this as a high‑fidelity pattern: if you follow these steps, your project will **look and feel** like this one, just with your own geography and sites.

For clarity, this guide always includes **full file paths** (relative to the project root, e.g. `/Users/you/YourProject/`), and a **style guide** section so your UI and code match the conventions used here.

---

## 1. Architecture Overview (What We’re Re‑Creating)

At a high level, the system has four layers:

- **1) Site configuration**  
  - Defines key sites (e.g. nuclear plant + nearby datacenter), their coordinates, radius, colors, and descriptions.
  - Example file in this repo: `src/config/ncPowerSites.js`.

- **2) OSM data pipeline (per site)**  
  - Script hits the **Overpass API** with a circular AOI around each site.
  - Filters OSM features into three main buckets:
    - **Power** (transmission lines, substations, power plants, industrial power infra).
    - **Water** (rivers, canals, pipelines, water towers, treatment plants).
    - **Other** (pipelines, utilities, transport, context POIs).
  - Writes a **single GeoJSON per site** to `public/osm/<site_key>.json` with a clean, consistent schema.
  - Example: `public/osm/pa_nuclear_tmi.json`.

- **3) Frontend map integration**
  - `OSMCall` and related components load site GeoJSONs into **Mapbox GL** sources and layers.
  - Layers use a **standard color palette** (orange for power, blue for water, teal/light‑blue for other).
  - A **legend** allows toggling power/water/other per site.
  - Popups and markers use **category‑aware styling** and naming.

- **4) Optional higher‑level integration**
  - **MCP**: quick actions / chat queries that route to specific sites + categories.
  - **GeoAI**: site‑level summaries that reference the same OSM data.
  - **Timeline Graph**: if you also have GEE change data, you can reuse the timeline/animation pattern.

This README focuses on **OSM + power/water/other + legend + markers**. MCP, GeoAI, and timeline are optional layers on top.

---

## 1.1. Style & UX Guide (Match This Project)

To get something that **looks just like this project**, follow these style rules:

- **Map styling**
  - **Basemap**: Mapbox GL style with muted colors; overlays carry most visual weight.
  - **Power vs water vs other**:
    - Power: saturated orange ramp (`#f97316`, `#fb923c`).
    - Water: cyan/blue ramp (`#06b6d4`, `#38bdf8`).
    - Other/utility: teal/light‑blue (`#22d3ee`, `#60a5fa`).
  - **Halos & AOIs**:
    - Radial halos use soft, semi‑transparent fills around a site center.
    - Use consistent radii in meters (e.g. site radius, 2× radius, 3× radius).

- **Legend & markers**
  - Legend rows: site name in **shortName** form, count badge on the right.
  - Category rows: indented, single word (Power, Water, Transmission, Other).
  - Markers:
    - **Teardrop** markers for MCP/OSM infrastructure search results.
    - Color matches category (cyan water, purple power/other).
    - Popups use gradients and white text on top.

- **Cards & badges**
  - Response cards use dark glassmorphism:
    - Background: `rgba(15, 23, 42, 0.85)` style colors.
    - Borders: subtle (`rgba(255, 255, 255, 0.1)`).
  - Category badges:
    - Water: `background: rgba(6, 182, 212, 0.2); color: #22d3ee`.
    - MCP/power: `background: rgba(139, 92, 246, 0.2); color: rgba(192, 132, 252, 0.9)`.

- **Naming**
  - Avoid ever showing **"Unnamed"** to the user:
    - Don’t inject `"Unnamed"` into your sanitized GeoJSON.
    - In React, treat `"Unnamed"` as equivalent to “no name”; fall back to operator, ref, or category‑based labels.

Follow these conventions as you wire your own geography to keep the visual and interaction design aligned.

---

## 2. Phase 1 – Define Sites & Configuration

### 2.1. Site config file (pattern)

Create a config file that defines all your strategic sites. In this project, that’s:

- `src/config/ncPowerSites.js`

Each site entry looks like:

```js
export const NC_POWER_SITES = [
  {
    key: 'three_mile_island_pa',
    name: 'Three Mile Island Nuclear Plant',
    shortName: 'Three Mile Island',
    dataPath: '/osm/pa_nuclear_tmi.json',
    coordinates: { lat: 40.1500, lng: -76.7300 },
    radiusMeters: 25000,
    color: '#f97316',         // primary color for site halo / legend
    highlightColor: '#fdba74',
    description: 'Middletown, PA – Nuclear plant supplying grid power via PPA.'
  },
  // ... other sites ...
];
```

**For a new project**, create something similar, e.g.:

- `src/config/powerSites.js`

and include:

- **`key`**: unique string, also used in filenames (`<key>.json`).
- **`coordinates`**: `lat/lng` near the site’s center.
- **`radiusMeters`**: radius for OSM queries and map AOIs.
- **`dataPath`**: where the OSM cache GeoJSON will live (under `public/osm/`).
- **`color` / `highlightColor`**: used for halos/legend.

### 2.2. Export helpers

In the same file, add helpers to look up sites:

```js
export const POWER_SITES = [/* ... your sites ... */];

export const POWER_SITE_KEYS = new Set(POWER_SITES.map(site => site.key));

export const getPowerSiteByKey = (key) => {
  return POWER_SITES.find(site => site.key === key) || null;
};
```

You’ll use `getPowerSiteByKey` from:
- **OSM integration** to find `dataPath`, `coordinates`, `radiusMeters`.  
  - Example usage in this repo:  
    - `src/components/Map/components/Cards/OSMCall.jsx` (when deciding which OSM cache file to load).
- **Legend** to show site rows and counts.  
  - Example usage in this repo:  
    - `src/components/Map/components/Cards/LegendContainer.jsx` (when building the PA nuclear legend).

---

## 3. Phase 2 – OSM Fetch & Local Cache Script

### 3.1. Goals of the OSM script

For **each site**, the script should:

1. Build a **circular AOI** around the site center with a given radius (e.g. 15–25 km).
2. Query **Overpass (OpenStreetMap)** for:
   - **Power** infrastructure:  
     `power=line/substation/plant`, `man_made=pipeline` with power context, etc.
   - **Water** infrastructure:  
     `water=*`, `waterway=*`, `man_made=water_tower/water_works/reservoir_covered`, etc.
   - **Other**:  
     strategic buildings, pipelines, transport nodes, context POIs.
3. Normalize all features into a **single GeoJSON FeatureCollection** with:
   - `properties.site_key` – matches your `key`.
   - `properties.category` – one of: `'power'`, `'water'`, `'other'`.
   - `properties.subcategory` – finer classification (`'substation'`, `'plant'`, `'pipeline'`, `'canal'`, etc.).
   - `properties.name` – only when OSM has a **real** name.
   - `properties.tags` – raw OSM tags for debugging / advanced usage.
4. Write to `public/osm/<site_key>.json`.

### 3.2. Reference: Pennsylvania nuclear OSM script

In this repo, see:

- `scripts/osm-tools/pa_nuclear_datacenter_osm.py`

Key pieces:

- **Node/way → feature conversion**:

```python
def node_to_feature(site_key: str, element: Dict) -> Dict:
    lat = float(element.get("lat"))
    lon = float(element.get("lon"))
    tags = element.get("tags", {}) or {}
    category = categorize(tags)
    subcategory = infer_subcategory(tags)

    props = {
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

    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": props,
    }
```

- **Way → LineString or Polygon** uses the same `category` / `subcategory` logic and the same `name` filter.

- **Overpass request**:
  - `execute_overpass(query)` handles retries, throttle, and JSON parsing.

For your project, you can copy this script as a template, and change:

- Site list (keys + AOIs).
- Tag filters in `categorize()` / `infer_subcategory()`.
- Output directory (keep `public/osm/` if you want the same layout).

### 3.3. Suggested OSM cache structure

For each site (e.g. `example_nuclear_site`), write:

- `public/osm/example_nuclear_site.json`

Structure:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-76.73, 40.15] },
      "properties": {
        "site_key": "example_nuclear_site",
        "osm_type": "node",
        "osm_id": 123456789,
        "category": "power",
        "subcategory": "substation",
        "name": "Example Substation",
        "tags": { "power": "substation", "voltage": "230000", "name": "Example Substation" },
        "source": "openstreetmap"
      }
    },
    {
      "type": "Feature",
      "geometry": { "type": "LineString", "coordinates": [ /* ... */ ] },
      "properties": {
        "site_key": "example_nuclear_site",
        "osm_type": "way",
        "osm_id": 987654321,
        "category": "water",
        "subcategory": "pipeline",
        "tags": { "man_made": "pipeline", "substance": "water" },
        "source": "openstreetmap"
      }
    }
  ]
}
```

Note:
- **No synthetic `"Unnamed"` names**; only set `name` when real.
- Always include `category` and `subcategory` so layers/legend can filter cleanly.

---

## 4. Phase 3 – Map Layers & Colors (Match This Project)

### 4.1. Layer mounting pattern

The main pattern for mounting OSM infrastructure is implemented in:

- `src/components/Map/components/Cards/OSMCall.jsx`

It follows a consistent set of layers per site/source:

- **Polygons** (buildings, plants, reservoirs, yards):
  - Fill layer for polygon interiors.
  - Outline layer (stroke) with category‑based color.
  - Optional label layer using `text-field: ['get', 'name']`.

- **Lines** (transmission lines, pipelines, canals):
  - Halo layer (thick, translucent line under main line).
  - Main line layer with category‑colored stroke.

- **Points** (towers, substations, wells, towers, POIs):
  - Circle layer with styled radius and category color.

The colors match the legend and MCP markers:

- **Power**: bright orange (`#f97316`) and related shades.
- **Water**: bright cyan/blue (`#38bdf8`, `#06b6d4`).
- **Other/utility**: teal/light‑blue (`#22d3ee`, `#60a5fa`).

### 4.2. Category → color mapping (example)

In `OSMCall.jsx`, you’ll see expressions like:

```js
'line-color': [
  'case',
  ['==', ['get', 'category'], 'power'], '#f97316',
  ['==', ['get', 'category'], 'pipeline'], '#fb923c',
  ['==', ['get', 'category'], 'water'], '#38bdf8',
  ['==', ['get', 'category'], 'utility'], '#22d3ee',
  ['==', ['get', 'category'], 'other'], '#60a5fa',
  site.highlightColor
]
```

For your project, replicate this mapping exactly to get the same visual language:

- **Power** – orange ramp.
- **Water** – cyan/blue ramp.
- **Other** – teal/light blue.

### 4.3. Hooking up layers for a new site

Steps:

1. **Load the GeoJSON** (once per site):
   - In your equivalent of `OSMCall`, when the user selects a site or clicks an OSM button:
     - Fetch `public/osm/<site_key>.json`.
     - Add it as a **Mapbox source**, e.g. `osm-site-<site_key>-source`.

2. **Add layers for each geometry type**:
   - For polygons, lines, and points, add layers using `filter` expressions on `geometry-type` and `properties.category`.
   - Follow the same IDs naming scheme:
     - `<sourceId>-fill`, `<sourceId>-line`, `<sourceId>-circle`, `<sourceId>-labels`, etc.

3. **Include `site.highlightColor`** where appropriate:
   - E.g. halo color or default color for unlabeled features.

4. **Exclude Unnamed labels**:
   - For label layers, use filters:
     ```js
     ['has', 'name'],
     ['!=', ['get', 'name'], ''],
     ['!=', ['get', 'name'], 'Unnamed'],
     ['!=', ['get', 'name'], 'Unnamed Area']
     ```

If you mirror the structure from `OSMCall.jsx`, your new geography will render with the same visual density and halo/label behavior as this project.

### 4.4. Layer order & Mapbox GL considerations

The way layers are ordered in **Mapbox GL** is critical if you want the same visual result:

- **Base map vs overlays**
  - Base labels and roads come from the Mapbox style.
  - OSM overlays (power/water/other) must sit **on top of** the basemap but **under** MCP markers and popups.
  - In this repo, layers are often inserted **relative to existing layers** (`addLayer(layer, beforeId)`).

- **In this codebase**
  - Map initialization: `src/components/Map/index.jsx`
    - Map created with `<div ref={mapContainer} ... />` and `new mapboxgl.Map(...)` inside `useMapInitialization`.
  - OSM layers: `src/components/Map/components/Cards/OSMCall.jsx`
    - Uses `map.current.addLayer(...)` with carefully chosen `beforeId` values (`labelAnchorLayer`, `'startup-intelligence-markers'`, etc.) to ensure:
      - Infrastructure lines and polygons appear above roads but below key markers.
      - Labels don’t collide with card UI.

- **Recommended pattern**
  - When adding site infrastructure layers, always:
    - Identify a stable base layer ID in your style (e.g. `'water'` or `'road-label'`) and insert **just above** that.
    - For point markers (MCP/OSM markers), insert above most line/fill layers so markers are clickable.

Example (from `OSMCall.jsx`, simplified):

- Insert polygon fill layer:
  - `map.current.addLayer(fillLayerDef, labelAnchorLayer);`
- Later add label layer, positioned above:
  - `map.current.addLayer(labelLayerDef, anchorLayer);`

---

## 5. Phase 4 – Legend Integration & Layer Toggles

### 5.1. Legend structure

Legend logic in this project lives in:

- `src/components/Map/components/Cards/LegendContainer.jsx`

Internally, it:

- Takes a list of **sites** (from `ncPowerSites.js`).
- Computes **per‑site category counts** from OSM features.
- Builds **legend sections**:
  - One row per site (using `shortName`, `color`, `featureCount`).
  - Indented sub‑rows per category (`power`, `water`, `pipeline`, `other`, etc.).

For a new project:

1. **Import your site config** (e.g. `src/config/powerSites.js`).
2. **Filter** for the sites you want in this legend (PA uses:  
   `const legendSites = ncPowerData.sites.filter(site => site.key && site.key.endsWith('_pa'));`).
3. **Build legend items**:
   - Use a helper like `createSiteItems(sites)` that returns:
     - Site rows: `{ label: site.shortName, color: site.highlightColor, count: site.featureCount, siteKey: site.key }`.
     - Category rows: `{ label: 'Power', category: 'power', siteKey: site.key, isSubCategory: true }`, etc.

Concrete reference in this repo:

- `src/components/Map/components/Cards/LegendContainer.jsx` around:
  - `getLegendSections()` and `createSiteItems(sites)`.

### 5.2. Legend → layer toggles

`LegendContainer` wires click handlers to layer toggles:

- Main site row:
  - Calls `toggleSiteLayerVisibility(siteKey)` – toggles all layers for that site.
- Category row:
  - Calls `toggleSiteCategoryLayer(siteKey, category)` – toggles only `power` or `water` or `other`.

Your implementation should mirror:

- Keep a **map of layer IDs per site + category**.  
  - This project uses helpers like `toggleNcPowerSiteLayer(siteKey, category)` which know all layer IDs for that site/category.
- For each toggle, call:
  - `map.setLayoutProperty(layerId, 'visibility', 'none' | 'visible')`.

You can see the exact wiring in:

- `src/components/Map/components/Cards/LegendContainer.jsx`:
  - `toggleNcPowerSiteLayer(siteKey, category)` – applies visibility to all layers for that site/category.
  - `handleLegendItemClick(displayLabel, item)` – routes clicks to the right toggle function.

If you follow this pattern, your legend will:

- Look like this project (site header + category rows).
- Correctly show/hide power/water/other layers per site.

---

## 6. Phase 5 – Markers, Popups, and Name Handling

### 6.1. MCP search markers

Markers for MCP infrastructure search results are created in:

- `src/components/Map/components/MCPSearchResults.jsx`

For each feature:

1. A **teardrop marker** is added (`mapboxgl.Marker`).
2. A **popup** is created with:
   - Name (falling back to operator/ref/category).
   - Category (formatted from `properties.category`).
   - Category‑colored background: cyan for water, purple for power/other.
3. On click, the marker:
   - Recenters/zooms the map.
   - Updates `selectedMarker` in `BaseCard`.
   - Triggers halo/pulse animations.

If you want your new geography to behave the same:

- Reuse the name extraction logic:

```js
let name = null;
if (props.name && props.name !== 'Unnamed' && props.name.trim() !== '') {
  name = props.name;
} else if (props.operator && props.operator.trim() !== '') {
  name = props.operator;
} else if (props.ref && props.ref.trim() !== '') {
  name = `Ref: ${props.ref}`;
} else if (props['operator:ref'] && props['operator:ref'].trim() !== '') {
  name = props['operator:ref'];
} else if (props.power && props.power !== 'Unnamed' && props.power.trim() !== '') {
  name = props.power;
} else if (props.man_made && props.man_made !== 'Unnamed' && props.man_made.trim() !== '') {
  name = props.man_made;
} else if (props.substation && props.substation.trim() !== '') {
  name = props.substation;
} else if (props.type && props.type.trim() !== '') {
  name = props.type;
} else {
  const cat = props.category || props.power || props.man_made || 'infrastructure';
  name = `${cat.charAt(0).toUpperCase() + cat.slice(1)} ${index + 1}`;
}
```

- Maintain the **water vs power color split** using `isWaterCategory` checks, just like in the existing code.

### 6.2. Response card badges and marker details

The detail card that shows when you click a marker is implemented in:

- `src/components/Map/components/Cards/AIResponseDisplayRefactored.jsx`

Key patterns you should mirror:

- Marker is passed in as `selectedMarker` (and its `properties`).
- Card computes:
  - **Name** (with same fallbacks, and ignoring `"Unnamed"`).
  - **Category** and category color.
  - **Distance**, **coordinates**, **operator**, **power type**, etc.
- Badges for **“Power”**, **“Water”**, and other categories use:
  - Matching colors to markers and legend.
  - Text like `Water Infrastructure`, `Power Substation`, etc.

To replicate the look:

- Use the same color palette for badges:
  - Water badge background: `rgba(6, 182, 212, 0.2)`, text `#22d3ee`.
  - MCP/power badge: `rgba(139, 92, 246, 0.2)`, text `rgba(192, 132, 252, 0.9)`.
- Keep the name extraction logic **strict about avoiding `"Unnamed"`** and use category‑based fallbacks instead.

Full implementation reference:

- `src/components/Map/components/Cards/AIResponseDisplayRefactored.jsx`
  - Look at the `renderMarkerDetails` and related functions around:
    - Name computation.
    - Category badges.
    - “Infrastructure Details” section.

---

## 7. Phase 6 – Raster Tile Overlays (Sentinel / NAIP Style)

In this codebase, **GeoAI satellite overlays** (Sentinel and NAIP rasters) are added as **Mapbox raster tile layers** on top of the basemap and underneath vector overlays.

You can reuse this pattern to add **raster basemaps or analysis layers** for your own geography.

### 7.1. Backend: tile URL endpoints

In this project, the raster tiles come from:

- `alphaearth_server.py`
  - Sets up tile URLs like:
    - `/api/geoai/tiles/<tile_id>/{z}/{x}/{y}.png`
  - Stores them in `imagery_layers[layer_key]['tileUrl']`.

Your project can:

- Expose similar endpoints (e.g. `/api/yourapp/tiles/<tile_id>/{z}/{x}/{y}.png`).
- For each site, keep a small structure:

```json
{
  "id": "example_nuclear_corridor",
  "name": "Example Nuclear & Datacenter Corridor",
  "imagery": {
    "naip": {
      "tileUrl": "/api/geoai/tiles/example_naip/{z}/{x}/{y}.png",
      "minZoom": 11,
      "maxZoom": 18
    },
    "trueColor": {
      "tileUrl": "/api/geoai/tiles/example_sentinel/{z}/{x}/{y}.png",
      "minZoom": 10,
      "maxZoom": 18
    }
  }
}
```

### 7.2. Frontend: adding raster layers with Mapbox GL

The integration lives in:

- `src/hooks/useAIQuery.js` (raster overlay section).

Core pattern:

```js
// For each site with imagery configuration
sites.forEach(site => {
  if (!questionData.disableRaster) {
    const availableLayers = site.imagery || {};
    const layerConfigs = [
      { key: 'naip', opacity: 1,   defaultMinZoom: 11 },
      { key: 'trueColor', opacity: 0.4, defaultMinZoom: 10 }
    ];

    layerConfigs.forEach(config => {
      const layerInfo = availableLayers[config.key];
      if (!layerInfo || !layerInfo.tileUrl) return;

      const tileSourceId = `geoai-site-${site.id}-${config.key}-tilesource`;
      const tileLayerId  = `geoai-site-${site.id}-${config.key}-tilelayer`;
      const tileUrl      = buildCacheBustedUrl(geoaiApiBaseUrl, layerInfo.tileUrl, metadataVersionToken);

      mapInstance.addSource(tileSourceId, {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256,
        minzoom: layerInfo.minZoom ?? config.defaultMinZoom ?? 6,
        maxzoom: layerInfo.maxZoom ?? 19
      });

      mapInstance.addLayer({
        id: tileLayerId,
        type: 'raster',
        source: tileSourceId,
        paint: {
          'raster-opacity': config.opacity,
          'raster-fade-duration': 0
        }
      });
    });
  }
});
```

**Key Mapbox considerations:**

- **Opacity**:
  - Use `opacity=1` for NAIP (high‑res), `0.3–0.4` for Sentinel or analytical layers, so vector overlays remain visible.
- **Zoom range**:
  - `minzoom` high enough so tiles are not requested at global scale.
  - `maxzoom` matches the resolution of your dataset (e.g. 18–19).
- **Layer order**:
  - Insert raster layers **above** the basemap but **below** your OSM/MCP vector overlays.
  - You can use `map.addLayer(layerDef, beforeId)` where `beforeId` points to your vector overlay base layer.

### 7.3. Optional: user controls for raster overlays

You can add UI controls (toggles or quick actions) to:

- Enable/disable raster overlays (`questionData.disableRaster` pattern in `useAIQuery.js`).
- Switch between NAIP vs Sentinel vs analysis rasters.

For a new project, consider:

- A small **“Imagery” section** in your legend or layer toggle:
  - Checkboxes: `NAIP`, `Sentinel`, `Analysis`.
  - Each toggling `setLayoutProperty(tileLayerId, 'visibility', 'none' | 'visible')`.

---

## 8. Phase 7 – Optional: Timeline Graph & GeoAI

---

## 7. Phase 6 – Optional: Timeline Graph & GeoAI

If your new project also wants:

- **Animated rings + change polygons around the site**.
- A **Timeline Analysis** graph that quantifies change over time.
- **GeoAI** narratives that describe those changes.

Then:

1. Use **Google Earth Engine** scripts like:
   - `scripts/harris_nc_geoai_change.py`
   - `scripts/three_mile_island_pa_geoai_change.py`
   - `scripts/susquehanna_nuclear_pa_geoai_change.py`
2. Use **timeline integration**:
   - `src/utils/siteTimelineData.js`
   - `src/components/Map/components/TimelineGraphPanel.jsx`
   - `docs/TIMELINE_GRAPH_GEOAI_README.md` (in this repo) explains the full pattern.
3. Implement **per‑site change animations** similar to:
   - `src/components/Map/components/HarrisChangeAnimation.jsx`
   - `src/components/Map/components/LakeWhitneyDamChangeAnimation.jsx`

This is optional; you can add it once basic OSM + legend + markers are working.

---

## 9. End‑to‑End Example Checklist for a New Geography

Suppose you want to replicate this system for a new **“Example Nuclear + Datacenter Corridor”**.

### 9.1. Define the site

- Add to `src/config/powerSites.js`:

```js
{
  key: 'example_nuclear_corridor',
  name: 'Example Nuclear & Datacenter Corridor',
  shortName: 'Example Corridor',
  dataPath: '/osm/example_nuclear_corridor.json',
  coordinates: { lat: 12.3456, lng: -98.7654 },
  radiusMeters: 20000,
  color: '#f97316',
  highlightColor: '#fdba74',
  description: 'Example region with nuclear plant and adjacent datacenter campus.'
}
```

### 9.2. Generate OSM cache

1. Copy `scripts/osm-tools/pa_nuclear_datacenter_osm.py` to:
   - `scripts/osm-tools/example_nuclear_corridor_osm.py`.
2. Update:
   - Site list (`SITES` array) with your new `site_key`, coordinates, radius.
   - Overpass tag filters in `categorize()` / `infer_subcategory()` if needed.
3. Run:

```bash
python3 scripts/osm-tools/example_nuclear_corridor_osm.py
```

4. Confirm:
   - `public/osm/example_nuclear_corridor.json` exists.

### 9.3. Wire into map & OSM call

1. In your `OSMCall` equivalent:
   - Map `locationKey` / `siteKey` `'example_nuclear_corridor'` to:
     - `getPowerSiteByKey('example_nuclear_corridor')`.
     - `site.dataPath` (e.g. `/osm/example_nuclear_corridor.json`).
2. Ensure:
   - When the user chooses this location in the UI, `OSMCall` fetches and mounts this GeoJSON as described in Phase 3.

### 9.4. Legend & markers

1. In your `LegendContainer`:
   - Include this site in the `legendSites` list.
   - Use its `categories` counts to build legend rows.
2. Test front‑end:
   - Click the **OSM green button** → infrastructure appears around the site.
   - Open the **legend**:
     - Site row: “Example Corridor”.
     - Sub‑rows: “Power”, “Water”, “Other”.
   - Toggle each category; verify layers hide/show correctly.
   - Hover/click markers; verify popups and card badges:
     - No `"Unnamed"` in labels.
     - Colors and behavior match Pennsylvania nuclear view.

If all these steps work, your new geography should look **indistinguishable** from the existing Pennsylvania view, just with different coordinates, infrastructure, and narrative. This template is designed so another team can follow it step‑by‑step and end up with the same UX and visual fidelity. 


