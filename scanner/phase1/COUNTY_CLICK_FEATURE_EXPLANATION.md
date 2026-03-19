# ERCOT County Click Feature - How It Works

## Overview

When a user clicks on a county name in an ERCOT card, the map automatically zooms to and selects that county on the map. This is achieved through **DOM manipulation** and **programmatic map interaction** using Mapbox GL JS.

---

## Architecture

```
ERCOT Card (React Component)
    ↓
User clicks county name
    ↓
handleCountyClick() function
    ↓
1. Find county in map source data
2. Calculate county centroid
3. Check if county is visible
4. Either:
   a) Fire click event directly (if visible)
   b) Zoom to county first, then fire click (if not visible)
    ↓
Map layer click handler receives event
    ↓
Map zooms to county and highlights it
```

---

## Step-by-Step Process

### Step 1: User Clicks County Name

**Location**: `src/components/Map/components/ScannerSignalsPanel.jsx` (line ~1573)

The county name is rendered as a clickable button:

```jsx
<button
  onClick={(e) => {
    e.stopPropagation();  // Prevent card click
    handleCountyClick(signal.county, signal);
  }}
  className="text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
  title={`Click to select ${signal.county} County on map`}
>
  {signal.county} County, Texas
</button>
```

**Key Points:**
- `e.stopPropagation()` prevents the card's click handler from firing
- County name comes from `signal.county` (extracted from ERCOT CSV)
- Button has hover styling to indicate it's clickable

---

### Step 2: handleCountyClick() Function

**Location**: `src/components/Map/components/ScannerSignalsPanel.jsx` (line ~660)

This function performs the following operations:

#### 2.1: Access Map Instance

```javascript
const mapInstance = window.mapInstance;
const SOURCE_ID = 'ercot-counties-source';
const FILL_LAYER_ID = 'ercot-counties-fill';
```

**Key Points:**
- Map instance is stored in `window.mapInstance` (global reference)
- ERCOT counties are loaded as a Mapbox source: `ercot-counties-source`
- The fill layer ID: `ercot-counties-fill`

#### 2.2: Get Source Features

```javascript
const getSourceFeatures = () => {
  const source = mapInstance.getSource(SOURCE_ID);
  if (!source) return null;
  
  // Try getting from source data directly
  if (source._data && source._data.features) {
    return source._data.features;
  }
  
  // Fallback: querySourceFeatures
  try {
    const features = mapInstance.querySourceFeatures(SOURCE_ID);
    if (features && features.length > 0) {
      return features;
    }
  } catch (e) {
    console.warn('querySourceFeatures failed:', e);
  }
  
  return null;
};
```

**Key Points:**
- Features are GeoJSON features with geometry and properties
- Each feature has a `properties.NAME` field with the county name
- Features are retrieved from the Mapbox source data

#### 2.3: Wait for Source to Be Ready

```javascript
const waitForSource = (maxAttempts = 30, delay = 150) => {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const checkSource = () => {
      attempts++;
      const source = mapInstance.getSource(SOURCE_ID);
      const features = getSourceFeatures();
      
      if (source && features && features.length > 0) {
        resolve(features);
      } else if (attempts >= maxAttempts) {
        reject(new Error(`Source not ready after ${maxAttempts} attempts`));
      } else {
        setTimeout(checkSource, delay);
      }
    };
    checkSource();
  });
};
```

**Key Points:**
- Polls every 150ms for up to 30 attempts (4.5 seconds total)
- Ensures the ERCOT counties layer is loaded before proceeding
- Returns a Promise that resolves when features are available

#### 2.4: Normalize County Name

```javascript
const normalizedCountyName = countyName
  .toLowerCase()
  .replace(/\s*,\s*texas\s*$/i, '')  // Remove ", Texas"
  .replace(/\s+county\s*$/i, '')      // Remove "County"
  .trim();
```

**Example:**
- Input: `"Travis County, Texas"` or `"Travis County"`
- Output: `"travis"`

**Why:** County names in the map data may have different formats, so normalization ensures matching works.

#### 2.5: Find County Feature

```javascript
let countyFeature = allFeatures.find(f => {
  const name = f.properties?.NAME || f.properties?.name;
  if (!name) return false;
  const normalizedName = name.toLowerCase().trim();
  
  // Exact match after normalization
  if (normalizedName === normalizedCountyName) {
    return true;
  }
  // Also try matching the original name
  if (name.toLowerCase() === countyName.toLowerCase()) {
    return true;
  }
  return false;
});
```

**Key Points:**
- Searches through all county features in the source
- Matches by `properties.NAME` field
- Uses normalized names for flexible matching
- Falls back to flexible matching (contains) if exact match fails

#### 2.6: Calculate County Centroid

```javascript
const centroid = turf.centroid(countyFeature.geometry);
const [lng, lat] = centroid.geometry.coordinates;
```

**Key Points:**
- Uses `@turf/turf` library to calculate the geographic center of the county polygon
- Returns `[longitude, latitude]` coordinates
- This is where the map will zoom to

#### 2.7: Check if County is Visible

```javascript
// Convert geographic coordinates to screen/pixel coordinates
const point = mapInstance.project([lng, lat]);

// Query rendered features at this point
const renderedFeatures = mapInstance.queryRenderedFeatures(point, {
  layers: [FILL_LAYER_ID]
});
```

**Key Points:**
- `mapInstance.project()` converts lat/lng to screen pixel coordinates
- `queryRenderedFeatures()` checks if the county is currently visible on screen
- Only works if the county is within the current map viewport

---

### Step 3: Trigger Map Interaction

The function has two paths depending on whether the county is visible:

#### Path A: County is Visible (Direct Click)

```javascript
if (renderedFeatures.length > 0) {
  // County is visible, trigger click directly
  const clickEvent = {
    point: point,
    lngLat: { lng, lat },
    features: renderedFeatures,
    originalEvent: {
      preventDefault: () => {},
      stopPropagation: () => {}
    }
  };
  
  // Fire the click event on the specific layer
  mapInstance.fire('click', clickEvent);
}
```

**Key Points:**
- Creates a synthetic click event object
- Includes the point, coordinates, and features
- `mapInstance.fire('click', clickEvent)` dispatches the event
- Mapbox routes this to the layer's click handler

#### Path B: County Not Visible (Zoom First)

```javascript
else {
  // County not currently visible, zoom to it first
  const bbox = turf.bbox(countyFeature.geometry);
  mapInstance.fitBounds(bbox, {
    padding: 50,
    duration: 500,
    maxZoom: 10
  });

  // Wait for zoom animation to complete, then trigger click
  setTimeout(() => {
    const newPoint = mapInstance.project([lng, lat]);
    const newRenderedFeatures = mapInstance.queryRenderedFeatures(newPoint, {
      layers: [FILL_LAYER_ID]
    });

    if (newRenderedFeatures.length > 0) {
      const clickEvent = {
        point: newPoint,
        lngLat: { lng, lat },
        features: newRenderedFeatures,
        originalEvent: {
          preventDefault: () => {},
          stopPropagation: () => {}
        }
      };
      mapInstance.fire('click', clickEvent);
    }
  }, 600);
}
```

**Key Points:**
- Uses `turf.bbox()` to get the bounding box of the county
- `mapInstance.fitBounds()` zooms the map to show the county
- Waits 600ms for zoom animation to complete
- Then queries again and fires click event

---

### Step 4: Map Layer Click Handler

**Location**: `src/components/Map/components/ERCOTCountiesLayer.jsx` (line ~330)

The ERCOT counties layer has a click handler that receives the fired event:

```javascript
mapInstance.on('click', FILL_LAYER_ID, (e) => {
  const feature = e.features[0];
  if (feature) {
    // Zoom into the county area
    const bbox = turf.bbox(feature.geometry);
    const centroid = turf.centroid(feature.geometry);
    
    // Calculate appropriate zoom level based on county size
    const lngDiff = bbox[2] - bbox[0];
    const latDiff = bbox[3] - bbox[1];
    const maxDiff = Math.max(lngDiff, latDiff);
    
    let zoomLevel = 9; // Default
    if (maxDiff < 0.1) zoomLevel = 11;      // Very small county
    else if (maxDiff < 0.2) zoomLevel = 10; // Small county
    else if (maxDiff < 0.5) zoomLevel = 9;  // Medium county
    else if (maxDiff < 1.0) zoomLevel = 8;  // Large county
    else zoomLevel = 7;                     // Very large county
    
    // Zoom to county centroid
    mapInstance.flyTo({
      center: centroid.geometry.coordinates,
      zoom: zoomLevel,
      duration: 1000,
      essential: true
    });
    
    // Emit event for table integration
    if (window.mapEventBus) {
      window.mapEventBus.emit('ercot-county:map-selected', {
        countyId: clickedCountyId,
        countyName: props.NAME || props.name,
        properties: props,
        geometry: feature.geometry
      });
    }
  }
});
```

**Key Points:**
- Handler is registered on the `ercot-counties-fill` layer
- Calculates appropriate zoom level based on county size
- Uses `flyTo()` for smooth animation
- Emits event via `window.mapEventBus` for other components (like ERCOTCountiesTable)

---

## Key Technologies

### 1. Mapbox GL JS

- **`mapInstance.getSource()`**: Gets the GeoJSON source
- **`mapInstance.project()`**: Converts lat/lng to screen coordinates
- **`mapInstance.queryRenderedFeatures()`**: Checks what's visible at a point
- **`mapInstance.fitBounds()`**: Zooms to a bounding box
- **`mapInstance.flyTo()`**: Smoothly animates to a location
- **`mapInstance.fire()`**: Programmatically triggers events

### 2. Turf.js

- **`turf.centroid()`**: Calculates geographic center of a polygon
- **`turf.bbox()`**: Calculates bounding box of a geometry

### 3. DOM Manipulation

- **`window.mapInstance`**: Global reference to map instance
- **`window.mapEventBus`**: Event bus for component communication
- **Synthetic Events**: Creating click events programmatically

---

## Data Flow

```
ERCOT Signal Data
    ↓
signal.county = "Travis"
    ↓
User clicks "Travis County, Texas" button
    ↓
handleCountyClick("Travis", signal)
    ↓
1. Get all county features from map source
2. Find feature where properties.NAME = "Travis"
3. Calculate centroid: [lng, lat]
4. Check if visible on screen
    ↓
If visible:
  → Fire click event directly
    ↓
If not visible:
  → Zoom to county first (fitBounds)
  → Wait 600ms
  → Fire click event
    ↓
Map layer click handler receives event
    ↓
Zoom to county (flyTo with appropriate zoom level)
    ↓
Emit 'ercot-county:map-selected' event
    ↓
Other components (ERCOTCountiesTable) listen and update
```

---

## Error Handling

The function includes several error handling mechanisms:

1. **Source Not Found**: Checks if ERCOT counties source exists
2. **Features Not Loaded**: Waits with polling, times out after 4.5 seconds
3. **County Not Found**: Logs available counties for debugging
4. **Geometry Missing**: Checks for `countyFeature.geometry` before calculating centroid
5. **Map Not Available**: Checks `window.mapInstance` before proceeding

---

## Example: Clicking "Travis County"

1. User sees ERCOT card with "Where: Travis County, Texas"
2. User clicks on "Travis County, Texas" (blue, underlined text)
3. `handleCountyClick("Travis", signal)` is called
4. Function finds Travis County feature in map source
5. Calculates centroid: `[-97.7431, 30.3072]`
6. Checks if Travis is visible (probably not if viewing whole Texas)
7. Zooms to Travis County using `fitBounds()`
8. After 600ms, fires click event
9. Map layer handler receives event
10. Map flies to Travis County with zoom level 9
11. County is highlighted/selected on map
12. ERCOTCountiesTable (if visible) scrolls to Travis row

---

## Why This Approach?

### Benefits:

1. **Seamless UX**: User clicks county name → map automatically shows it
2. **Works Even If Not Visible**: Handles cases where county is off-screen
3. **Smooth Animation**: Uses `flyTo()` for pleasant transitions
4. **Reuses Existing Handlers**: Fires real click events, so all existing handlers work
5. **No State Management**: Doesn't need to track map state in React

### Trade-offs:

1. **Requires Map Instance**: Needs `window.mapInstance` to be available
2. **Requires Layer to Be Loaded**: ERCOT counties layer must be enabled
3. **Timing Sensitive**: Uses `setTimeout` which could be unreliable
4. **Global State**: Relies on `window.mapInstance` (not ideal for React)

---

## Potential Improvements

1. **Use React Context**: Instead of `window.mapInstance`, use React Context
2. **Promise-based**: Replace `setTimeout` with `mapInstance.once('moveend')`
3. **Better Error Messages**: Show user-friendly messages if layer not enabled
4. **Loading States**: Show spinner while zooming
5. **Accessibility**: Add keyboard navigation support

---

## Summary

The county click feature works by:

1. **Finding the county** in the map's GeoJSON source data
2. **Calculating its center** using Turf.js
3. **Checking visibility** using Mapbox's query methods
4. **Zooming if needed** using `fitBounds()`
5. **Firing a synthetic click event** using `mapInstance.fire()`
6. **Letting the map layer handler** do the actual zooming and highlighting

This creates a seamless connection between the ERCOT card UI and the map, allowing users to quickly navigate to any county mentioned in a signal.

