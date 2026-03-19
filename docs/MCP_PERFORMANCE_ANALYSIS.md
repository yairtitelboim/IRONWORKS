# MCP Performance Analysis - Feature Count & Mapbox Limits

## Current State Analysis

### Existing OSM Data (25km radius)

**Three Mile Island:**
- **Total Features:** 61,358
- **File Size:** 31 MB
- **Power Features:** ~40,000+ (estimated)
- **Water Features:** ~20,000+ (estimated)

**Susquehanna:**
- **Total Features:** 66,695
- **File Size:** 34 MB
- **Power Features:** ~45,000+ (estimated)
- **Water Features:** ~20,000+ (estimated)

### Current Display Limits

**MCPSearchResults.jsx:**
- **MAX_POPUPS:** 20 (markers with popups)
- **No limit** on markers without popups (but still creates DOM elements + halos)
- **Each marker creates:**
  - 1 DOM marker element
  - 2 Mapbox layers (halo fill + halo line)
  - 1 popup (for first 20)

**Performance Impact:**
- 20 markers with popups = ~60 Mapbox layers (20 markers + 40 halo layers)
- Additional markers without popups = more DOM elements + halo layers
- No current limit on total markers displayed

## 100 Mile Radius Projections

### Scale Calculation

**Current:** 25km radius = 61,358 features
**Proposed:** 160km radius (100 miles) = **6.4x larger radius**

**Area scaling:** Area = π × r²
- 25km area: ~1,963 km²
- 160km area: ~80,425 km²
- **Area increase: ~41x**

### Conservative Estimates (Without Strategic Filtering)

**Worst Case:**
- **Features per site:** 61,358 × 41 = **~2.5 million features**
- **File size per site:** 31 MB × 41 = **~1.3 GB per file**
- **Total for both sites:** **~2.6 GB**

**This is NOT feasible for:**
- Browser memory
- Mapbox performance
- Network transfer
- File I/O

### Realistic Estimates (With Strategic Filtering)

**If we filter to top 1% strategic nodes:**
- **Features per site:** 61,358 × 0.01 × 10 (accounting for more strategic nodes at distance) = **~6,000-10,000 features**
- **File size per site:** ~5-10 MB
- **Total for both sites:** **~10-20 MB**

**This is manageable but still needs limits.**

## Mapbox Performance Limits

### Recommended Limits

Based on Mapbox GL JS best practices:

1. **Markers (DOM elements):**
   - **Recommended:** < 100 markers
   - **Maximum:** ~500 markers (performance degrades)
   - **Current:** No limit (problematic)

2. **GeoJSON Source Features:**
   - **Recommended:** < 10,000 features per source
   - **Maximum:** ~50,000 features (with clustering)
   - **Current:** 61,358 features (at limit)

3. **Map Layers:**
   - **Recommended:** < 50 layers
   - **Maximum:** ~100 layers
   - **Current:** 20 markers = 40 halo layers (approaching limit)

4. **File Size:**
   - **Recommended:** < 10 MB per GeoJSON file
   - **Maximum:** ~50 MB (with compression)
   - **Current:** 31-34 MB (approaching limit)

## Strategic Filtering Strategy

### Phase 1: OSM Collection Filtering (Critical)

**Filter during OSM collection to reduce data:**

```python
# Strategic filtering thresholds
STRATEGIC_SCORE_THRESHOLD = 25  # Only save features with score >= 25
MAX_FEATURES_PER_SITE = 5000    # Hard limit per site

# After calculating strategic scores:
strategic_features = [
    f for f in features 
    if f["properties"]["strategic_score"] >= STRATEGIC_SCORE_THRESHOLD
]

# Sort by score and limit
strategic_features.sort(key=lambda f: f["properties"]["strategic_score"], reverse=True)
strategic_features = strategic_features[:MAX_FEATURES_PER_SITE]
```

**Expected Results:**
- **Features per site:** 3,000-5,000 (down from 60,000+)
- **File size per site:** 3-5 MB (down from 31 MB)
- **Strategic nodes only:** High-voltage, named, major operators

### Phase 2: Server-Side Filtering

**Additional filtering in server.js:**

```javascript
// After loading OSM data, apply additional filters
const MAX_FEATURES_TO_RETURN = 200;  // Limit API response

// Filter by:
// 1. Strategic score (already in data)
// 2. Category match
// 3. Distance within query radius
// 4. Sort by importance
// 5. Limit to top N

const filteredFeatures = features
  .filter(f => {
    // Category match
    if (category && !matchesCategory(f, category)) return false;
    // Distance within radius
    if (distance > searchRadius) return false;
    return true;
  })
  .sort((a, b) => {
    // Sort by strategic_score (from OSM) + distance
    const scoreA = (a.properties?.strategic_score || 0) - (a.properties?.distance_m || 0) / 1000;
    const scoreB = (b.properties?.strategic_score || 0) - (b.properties?.distance_m || 0) / 1000;
    return scoreB - scoreA;
  })
  .slice(0, MAX_FEATURES_TO_RETURN);
```

### Phase 3: Frontend Display Limits

**Update MCPSearchResults.jsx:**

```javascript
// Performance-optimized limits
const MAX_MARKERS_WITH_POPUPS = 20;      // Keep current
const MAX_MARKERS_WITHOUT_POPUPS = 80;   // Add limit (was unlimited)
const MAX_TOTAL_MARKERS = 100;           // Hard limit

// Apply limits
const featuresToProcess = features.slice(0, MAX_MARKERS_WITH_POPUPS);
const featuresWithoutPopups = features.slice(
  MAX_MARKERS_WITH_POPUPS, 
  MAX_MARKERS_WITH_POPUPS + MAX_MARKERS_WITHOUT_POPUPS
);

// Don't add markers beyond MAX_TOTAL_MARKERS
if (features.length > MAX_TOTAL_MARKERS) {
  console.warn(`⚠️ Limiting display to ${MAX_TOTAL_MARKERS} markers (${features.length} available)`);
}
```

## Performance Optimization Strategies

### 1. Clustering (For High-Density Areas)

**Option:** Use Mapbox clustering for markers when zoomed out

```javascript
// Add clustering to GeoJSON source
map.addSource('mcp-markers', {
  type: 'geojson',
  data: featureCollection,
  cluster: true,
  clusterMaxZoom: 14,  // Cluster until zoom 14
  clusterRadius: 50     // 50px radius for clusters
});

// Add cluster layer
map.addLayer({
  id: 'mcp-clusters',
  type: 'circle',
  source: 'mcp-markers',
  filter: ['has', 'point_count'],
  paint: {
    'circle-color': '#8b5cf6',
    'circle-radius': [
      'step',
      ['get', 'point_count'],
      20,   // 1-10 markers
      30,   // 11-50 markers
      40    // 51+ markers
    ]
  }
});
```

**Benefits:**
- Can handle 10,000+ features
- Automatically groups nearby markers
- Better performance at low zoom

**Trade-offs:**
- More complex implementation
- Need separate handling for clustered vs individual markers

### 2. Viewport-Based Filtering

**Only show markers in current viewport:**

```javascript
// Filter features by viewport bounds
const bounds = map.getBounds();
const viewportFeatures = features.filter(feature => {
  const [lng, lat] = feature.geometry.coordinates;
  return bounds.contains([lng, lat]);
});

// Limit viewport features
const viewportLimit = 50;  // Max markers in viewport
const limitedFeatures = viewportFeatures.slice(0, viewportLimit);
```

**Benefits:**
- Only renders visible markers
- Better performance
- Scales with zoom level

**Trade-offs:**
- Markers disappear when panning
- Need to update on map move

### 3. Zoom-Based Density

**Show fewer markers when zoomed out:**

```javascript
const currentZoom = map.getZoom();
let maxMarkers;

if (currentZoom >= 12) {
  maxMarkers = 100;  // High zoom: show more
} else if (currentZoom >= 10) {
  maxMarkers = 50;   // Medium zoom: show fewer
} else {
  maxMarkers = 20;   // Low zoom: show very few
}

const limitedFeatures = features.slice(0, maxMarkers);
```

### 4. Lazy Loading / Progressive Rendering

**Load markers in batches:**

```javascript
const BATCH_SIZE = 20;
const BATCH_DELAY = 100; // ms between batches

async function loadMarkersInBatches(features) {
  for (let i = 0; i < features.length; i += BATCH_SIZE) {
    const batch = features.slice(i, i + BATCH_SIZE);
    await addMarkersBatch(batch);
    await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
  }
}
```

## Recommended Implementation Plan

### Step 1: Aggressive OSM Filtering (Critical)

**Update `pa_nuclear_datacenter_osm.py`:**

```python
# Strategic filtering parameters
STRATEGIC_SCORE_THRESHOLD = 25  # Only strategic nodes
MAX_FEATURES_PER_SITE = 5000     # Hard limit

# Expected results:
# - 3,000-5,000 features per site (down from 60,000+)
# - 3-5 MB file size (down from 31 MB)
# - Only high-voltage, named, major infrastructure
```

### Step 2: Server-Side Limits

**Update `server.js`:**

```javascript
// Limit API response
const MAX_FEATURES_TO_RETURN = 200;  // Top 200 strategic features

// Sort by: strategic_score + distance
// Return only top N
```

### Step 3: Frontend Display Limits

**Update `MCPSearchResults.jsx`:**

```javascript
const MAX_MARKERS_WITH_POPUPS = 20;
const MAX_MARKERS_WITHOUT_POPUPS = 80;
const MAX_TOTAL_MARKERS = 100;  // Hard limit

// Add zoom-based filtering (optional)
// Add viewport filtering (optional)
```

### Step 4: Monitor Performance

**Add performance logging:**

```javascript
console.log('📊 MCP Performance:', {
  totalFeatures: features.length,
  markersWithPopups: featuresToProcess.length,
  markersWithoutPopups: featuresWithoutPopups.length,
  totalMarkers: markersRef.current.length,
  haloLayers: haloRefsRef.current.length,
  mapLayers: Object.keys(map.getStyle().layers).length
});
```

## Expected Performance After Optimization

### File Sizes
- **Before:** 31-34 MB per site
- **After:** 3-5 MB per site (with strategic filtering)
- **Reduction:** ~85-90%

### Feature Counts
- **Before:** 61,000+ features per site
- **After:** 3,000-5,000 strategic features per site
- **Reduction:** ~95%

### Displayed Markers
- **Before:** Unlimited (could be 1000+)
- **After:** Max 100 markers (20 with popups, 80 without)
- **Performance:** Smooth, no lag

### Mapbox Layers
- **Before:** 40+ layers (20 markers × 2 halos)
- **After:** 200 layers max (100 markers × 2 halos)
- **Status:** Within limits (< 100 recommended, but acceptable)

## Testing Plan

1. **Test with current data:**
   - Load 61,358 features
   - Measure: load time, render time, FPS
   - Check: memory usage, browser console warnings

2. **Test with filtered data:**
   - Load 5,000 strategic features
   - Measure: same metrics
   - Compare: performance improvement

3. **Test with display limits:**
   - Limit to 100 markers
   - Measure: render performance
   - Verify: smooth interaction

4. **Test at different zoom levels:**
   - Low zoom (5-8): Should show fewer markers
   - High zoom (12+): Should show more markers
   - Verify: performance stays consistent

## Recommendations

### Immediate Actions

1. **✅ Implement strategic filtering in OSM script** (Phase 4)
   - Filter to score >= 25
   - Limit to 5,000 features per site
   - Re-generate cache files

2. **✅ Add display limits in MCPSearchResults.jsx**
   - MAX_TOTAL_MARKERS = 100
   - MAX_MARKERS_WITHOUT_POPUPS = 80

3. **✅ Add server-side limits**
   - MAX_FEATURES_TO_RETURN = 200

### Future Enhancements (If Needed)

1. **Clustering** - If still too many markers
2. **Viewport filtering** - Only show visible markers
3. **Zoom-based density** - Fewer markers when zoomed out
4. **Lazy loading** - Load markers in batches

## Summary

**Current State:**
- 61,358 features per site (25km radius)
- 31 MB file size
- No display limits
- **Performance risk:** High

**With 100 Mile + Strategic Filtering:**
- 3,000-5,000 strategic features per site
- 3-5 MB file size
- 100 marker display limit
- **Performance:** Good

**Key Insight:** Strategic filtering during OSM collection is critical. Without it, 100-mile radius would be impossible. With it, we get comprehensive coverage of important infrastructure while maintaining performance.

