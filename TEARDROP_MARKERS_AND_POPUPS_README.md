# Teardrop Markers & Popup Cards Guide

## Overview

This guide explains how to create DOM-based teardrop markers (like those used in OSM layers) and how the popup card system works when markers are clicked.

## Architecture

The system uses three main components:
1. **Marker Creation** - DOM-based teardrop markers using Mapbox GL JS
2. **Event Bus** - `window.mapEventBus` for inter-component communication
3. **Popup System** - `MarkerPopupManager` handles popup display and formatting

---

## 1. Creating Teardrop Markers

### Basic Setup

Teardrop markers are created using Mapbox GL's `Marker` class with DOM elements. Here's the pattern from `OSMCall.jsx`:

```javascript
import mapboxgl from 'mapbox-gl';

// Constants for marker styling
const NC_MARKER_DEFAULT_COLOR = '#dc2626';  // Red
const NC_MARKER_ACTIVE_COLOR = '#22c55e';   // Green
const NC_MARKER_DIM_OPACITY = 0.35;
const NC_MARKER_BASE_OPACITY = 0.85;

// Inject CSS styles for marker animations
let markerStylesInjected = false;
const injectMarkerStyles = () => {
  if (markerStylesInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.setAttribute('data-nc-marker-styles', 'true');
  style.textContent = `
    .nc-marker-active {
      filter: drop-shadow(0 0 12px rgba(34, 197, 94, 0.55));
    }
  `;
  document.head.appendChild(style);
  markerStylesInjected = true;
};

// Helper to apply color to marker SVG
const applyMarkerColor = (element, color) => {
  if (!element) return;
  const svg = element.querySelector('svg');
  if (svg) {
    svg.style.color = color;
  }
  element.style.color = color;
  element.querySelectorAll('path').forEach((path) => {
    if (path.hasAttribute('fill')) {
      path.setAttribute('fill', color);
    }
  });
};
```

### Creating a Marker

```javascript
// Inject styles first
injectMarkerStyles();

// Create the marker
const teardropMarker = new mapboxgl.Marker({
  color: NC_MARKER_DEFAULT_COLOR,  // Default red color
  anchor: 'bottom',                 // Anchor point at bottom of marker
  offset: [0, 20]                   // Offset from coordinates
})
  .setLngLat([site.coordinates.lng, site.coordinates.lat])
  .addTo(map.current);

// Get the DOM element and customize it
const teardropEl = teardropMarker.getElement();
teardropEl.style.cursor = 'pointer';
teardropEl.style.transition = 'filter 0.15s ease, opacity 0.15s ease';
teardropEl.title = site.name;  // Tooltip text
teardropEl.style.opacity = isInitiallyActive ? '1' : String(NC_MARKER_BASE_OPACITY);
applyMarkerColor(teardropEl, isInitiallyActive ? NC_MARKER_ACTIVE_COLOR : NC_MARKER_DEFAULT_COLOR);
```

### Marker State Management

```javascript
let isActive = false;

const setActiveState = (active) => {
  isActive = active;
  if (active) {
    teardropEl.style.opacity = '1';
    teardropEl.classList.add('nc-marker-active');
    applyMarkerColor(teardropEl, NC_MARKER_ACTIVE_COLOR);
  } else {
    teardropEl.classList.remove('nc-marker-active');
    teardropEl.style.opacity = String(NC_MARKER_DIM_OPACITY);
    teardropEl.style.filter = '';
    applyMarkerColor(teardropEl, NC_MARKER_DEFAULT_COLOR);
  }
};
```

### Adding Click Handler

```javascript
teardropEl.addEventListener('click', () => {
  // Update active state for all markers
  if (ncMarkersRef.current?.length) {
    ncMarkersRef.current.forEach((markerInstance) => {
      const markerData = markerInstance.__ncMarkerData;
      if (!markerData) return;
      markerData.setActive(markerInstance === teardropMarker);
    });
  }

  // Emit event to show popup
  if (window.mapEventBus) {
    const payload = {
      id: `site-${site.key}`,
      name: site.name,
      type: 'Power & Utility Infrastructure',
      category: 'North Carolina Megasite',
      coordinates: [site.coordinates.lng, site.coordinates.lat],
      formatter: 'pinal',  // Determines popup formatting
      featureCount,
      summary: summary,
      categories,
      siteMetadata: site,
      analysisStatus: site.description || 'Infrastructure context loaded',
      isAutomatic: false
    };

    window.mapEventBus.emit('marker:clicked', payload);
  }
});
```

### Storing Marker Data

```javascript
// Attach metadata to marker for later access
teardropMarker.__ncMarkerData = {
  key: site.key,
  marker: teardropMarker,
  element: teardropEl,
  setActive: setActiveState,
  resetAppearance: () => {
    isActive = false;
    teardropEl.classList.remove('nc-marker-active');
    teardropEl.style.opacity = String(NC_MARKER_BASE_OPACITY);
    teardropEl.style.filter = '';
    applyMarkerColor(teardropEl, NC_MARKER_DEFAULT_COLOR);
  }
};

// Store in ref array for cleanup
ncMarkersRef.current.push(teardropMarker);
```

---

## 2. Configuration in index.jsx

### Event Bus Setup

The event bus is initialized in `index.jsx`:

```javascript
// Define window level event bus for communication
if (!window.mapEventBus) {
  window.mapEventBus = {
    listeners: {},
    emit: function(event, data) {
      if (this.listeners[event]) {
        this.listeners[event].forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`Error in mapEventBus listener for ${event}:`, error);
          }
        });
      }
    },
    on: function(event, callback) {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(callback);
      
      // Return unsubscribe function
      return () => {
        if (this.listeners[event]) {
          this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
      };
    },
    off: function(event, callback) {
      if (this.listeners[event] && callback) {
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
      } else if (this.listeners[event]) {
        this.listeners[event] = [];
      }
    }
  };
}
```

### PopupManager Integration

The `PopupManager` component is rendered in the map:

```javascript
<PopupManager map={map} />
```

The `MarkerPopupManager` is rendered inside `BaseCard`:

```javascript
<MarkerPopupManager map={map} />
```

---

## 3. Popup Card System

### Event Flow

1. **Marker Clicked** → `window.mapEventBus.emit('marker:clicked', payload)`
2. **MarkerPopupManager Listens** → `window.mapEventBus.on('marker:clicked', handleMarkerClicked)`
3. **Popup Rendered** → `MarkerPopupCard` component displays the popup

### Marker Click Payload Structure

```javascript
const payload = {
  id: 'unique-marker-id',              // Required: unique identifier
  name: 'Site Name',                    // Required: display name
  type: 'Power & Utility Infrastructure', // Optional: type/category
  category: 'North Carolina Megasite',   // Optional: subcategory
  coordinates: [lng, lat],              // Required: [longitude, latitude]
  formatter: 'pinal',                   // Required: popup formatter type
  featureCount: 1234,                   // Optional: number of features
  summary: {                            // Optional: summary data
    feature_count: 1234,
    categories: { power: 50, water: 30 }
  },
  categories: { power: 50, water: 30 }, // Optional: category breakdown
  siteMetadata: {                        // Optional: additional metadata
    key: 'site-key',
    coordinates: { lat: 33.75, lng: -112.25 }
  },
  analysisStatus: 'Infrastructure loaded', // Optional: status message
  isAutomatic: false                    // Optional: auto-triggered popup
};
```

### Popup Formatters

The `formatter` field determines which formatting function is used:

#### Available Formatters

1. **`'pinal'`** - For North Carolina/Pinal County infrastructure sites
   - Uses `formatPinalData()` from `PopupCards.jsx`
   - Displays infrastructure summary, categories, feature counts

2. **`'startup'`** - For startup/company markers
   - Uses `formatStartupData()` from `PopupCards.jsx`
   - Displays company info, funding, industries

3. **`'tdlr'`** - For TDLR (Texas Department of Licensing) markers
   - Uses `formatTDLRData()` from `PopupCards.jsx`
   - Displays facility info, work type, project details

4. **`'whitney'`** - For Whitney, TX markers
   - Special handling for multiple popups
   - Uses custom formatting

5. **`'tsmc-phoenix'`** - For TSMC Phoenix sites
   - Custom formatter for semiconductor facilities

### Creating a Custom Formatter

1. **Add formatter function** in `src/components/Map/components/PopupCards.jsx`:

```javascript
export const formatCustomData = (props) => {
  return {
    typewriter: true,  // Use typewriter effect
    title: props.name || 'Custom Site',
    sections: [
      {
        title: 'Overview',
        content: props.description || 'No description available'
      },
      {
        title: 'Details',
        content: `Feature Count: ${props.featureCount || 0}`
      }
    ]
  };
};
```

2. **Import in MarkerPopupCard.jsx**:

```javascript
import { formatCustomData } from '../PopupCards';
```

3. **Add formatter case** in `MarkerPopupManager.jsx`:

```javascript
const isCustomMarker = markerData.formatter === 'custom';

if (isCustomMarker) {
  const formattedData = formatCustomData(markerData);
  // Handle popup display
}
```

4. **Emit with formatter** when creating marker:

```javascript
window.mapEventBus.emit('marker:clicked', {
  id: 'custom-marker-1',
  name: 'Custom Site',
  formatter: 'custom',  // Use your custom formatter
  // ... other data
});
```

---

## 4. Popup Card Component

### MarkerPopupCard Structure

The `MarkerPopupCard` component receives:
- `nodeData` - The marker payload data
- `position` - Screen coordinates `{ x, y }`
- `isVisible` - Boolean visibility state
- `onClose` - Close handler function
- `map` - Map instance for zoom functionality

### Typewriter Effect

Most popups use the `TypewriterPopupCard` component which creates a typing animation effect:

```javascript
<TypewriterPopupCard
  nodeData={formattedData}
  position={popupPosition}
  isVisible={isVisible}
  onClose={closePopup}
  map={map}
/>
```

The formatter function should return an object with `typewriter: true`:

```javascript
{
  typewriter: true,
  title: 'Site Name',
  sections: [
    { title: 'Section 1', content: 'Content here' },
    { title: 'Section 2', content: 'More content' }
  ]
}
```

---

## 5. Complete Example

### Creating a New Site with Teardrop Markers

```javascript
// 1. Define site configuration
const SITE_CONFIG = {
  key: 'my-site',
  name: 'My Infrastructure Site',
  coordinates: { lat: 33.75, lng: -112.25 },
  radiusMeters: 10000,
  color: '#3b82f6',
  highlightColor: '#60a5fa'
};

// 2. Create markers function
const createSiteMarkers = useCallback((siteData, activeSiteKey = null) => {
  if (!map?.current) return;

  // Clear existing markers
  if (Array.isArray(markersRef.current)) {
    markersRef.current.forEach(marker => marker.remove());
  }
  markersRef.current = [];

  // Inject styles
  injectMarkerStyles();

  // Create marker
  const isInitiallyActive = SITE_CONFIG.key === activeSiteKey;
  const marker = new mapboxgl.Marker({
    color: '#3b82f6',
    anchor: 'bottom',
    offset: [0, 20]
  })
    .setLngLat([SITE_CONFIG.coordinates.lng, SITE_CONFIG.coordinates.lat])
    .addTo(map.current);

  const markerEl = marker.getElement();
  markerEl.style.cursor = 'pointer';
  markerEl.title = SITE_CONFIG.name;

  // Add click handler
  markerEl.addEventListener('click', () => {
    if (window.mapEventBus) {
      window.mapEventBus.emit('marker:clicked', {
        id: `site-${SITE_CONFIG.key}`,
        name: SITE_CONFIG.name,
        type: 'Infrastructure',
        category: 'Custom Site',
        coordinates: [SITE_CONFIG.coordinates.lng, SITE_CONFIG.coordinates.lat],
        formatter: 'pinal',  // or your custom formatter
        featureCount: siteData?.featureCount || 0,
        summary: siteData?.summary || {},
        siteMetadata: SITE_CONFIG,
        isAutomatic: false
      });
    }
  });

  // Store marker
  markersRef.current.push(marker);
}, [map]);
```

---

## 6. Best Practices

### Marker Management

- **Store markers in refs** for cleanup:
  ```javascript
  const markersRef = useRef([]);
  ```

- **Clean up on unmount**:
  ```javascript
  useEffect(() => {
    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
    };
  }, []);
  ```

### Event Bus Usage

- **Always check if event bus exists**:
  ```javascript
  if (window.mapEventBus) {
    window.mapEventBus.emit('marker:clicked', payload);
  }
  ```

- **Unsubscribe from events**:
  ```javascript
  useEffect(() => {
    const unsubscribe = window.mapEventBus.on('marker:clicked', handler);
    return () => unsubscribe();
  }, []);
  ```

### Popup Data

- **Include required fields**: `id`, `name`, `coordinates`, `formatter`
- **Use consistent formatter names** across the codebase
- **Include metadata** for debugging and future features

---

## 7. File Locations

- **Marker Creation**: `src/components/Map/components/Cards/OSMCall.jsx`
- **Popup Manager**: `src/components/Map/components/Cards/MarkerPopupManager.jsx`
- **Popup Card**: `src/components/Map/components/Cards/MarkerPopupCard.jsx`
- **Popup Formatters**: `src/components/Map/components/PopupCards.jsx`
- **Typewriter Effect**: `src/components/Map/components/Cards/TypewriterPopupCard.jsx`
- **Map Component**: `src/components/Map/index.jsx`

---

## 8. Troubleshooting

### Markers Not Appearing

1. Check map is initialized: `if (!map?.current) return;`
2. Verify coordinates are valid: `[lng, lat]` format
3. Check marker is added to map: `.addTo(map.current)`

### Popups Not Showing

1. Verify event bus exists: `if (window.mapEventBus)`
2. Check payload structure matches expected format
3. Verify `formatter` field matches an existing formatter
4. Check browser console for errors

### Styling Issues

1. Ensure `injectMarkerStyles()` is called
2. Verify CSS classes are applied correctly
3. Check marker element exists: `marker.getElement()`

---

## Summary

1. **Create markers** using `mapboxgl.Marker` with DOM customization
2. **Emit events** via `window.mapEventBus.emit('marker:clicked', payload)`
3. **Format popups** using formatter functions in `PopupCards.jsx`
4. **Display popups** via `MarkerPopupManager` → `MarkerPopupCard`
5. **Use typewriter effect** by returning `{ typewriter: true }` from formatter

The system is designed to be extensible - add new formatters and marker types as needed!

