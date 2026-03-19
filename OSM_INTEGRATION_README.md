# OSM Integration for Map Visualization

> **📋 Primary Documentation**: This README is part of the comprehensive system documentation. For the complete architectural overview and production readiness plan, see **[WEEK01_REPORT_SEPT2025.md](../WEEK01_REPORT_SEPT2025.md)**.

## Overview
This document outlines the OpenStreetMap (OSM) integration implemented in the DCC mapping application. The system queries OSM data through the Overpass API and renders it as interactive layers on a Mapbox GL JS map.

## Architecture

### Components
- **ActionButton**: Triggers OSM data queries and manages loading states
- **OSMLegend**: Displays dynamic legend for OSM features
- **Map Component**: Renders OSM data layers and manages map interactions

### Data Flow
1. User clicks ActionButton
2. ActionButton queries OSM Overpass API
3. OSM data is processed and categorized
4. Features are added to map as GeoJSON layers
5. OSMLegend updates to show feature categories and counts

## OSM Data Querying

### Overpass API Endpoint
```
https://overpass-api.de/api/interpreter
```

### Query Structure
The system uses Overpass QL to fetch geographic features within a specified radius around coordinates:

```overpass
[out:json][timeout:25];
(
  node["amenity"](around:6000, ${lat}, ${lng});
  node["shop"](around:6000, ${lat}, ${lng});
  node["leisure"](around:6000, ${lat}, ${lng});
  node["tourism"](around:6000, ${lat}, ${lng});
  node["office"](around:6000, ${lat}, ${lng});
  node["industrial"](around:6000, ${lat}, ${lng});
  
  way["building"](if: count(nodes) < 30)(around:6000, ${lat}, ${lng});
  way["highway"](if: count(nodes) < 25)(around:6000, ${lat}, ${lng});
  way["waterway"](if: count(nodes) < 25)(around:6000, ${lat}, ${lng});
  way["natural"="water"](if: count(nodes) < 25)(around:6000, ${lat}, ${lng});
  way["landuse"="residential"](if: count(nodes) < 20)(around:6000, ${lat}, ${lng});
  way["landuse"="commercial"](if: count(nodes) < 20)(around:6000, ${lat}, ${lng});
  way["landuse"="industrial"](if: count(nodes) < 20)(around:6000, ${lat}, ${lng});
  way["name"](if: count(nodes) < 25)(around:6000, ${lat}, ${lng});
);
out body;
>;
out skel qt;
```

### Query Parameters
- **Radius**: 6000 meters (6km) around specified coordinates
- **Node limits**: Prevents overly complex geometries
  - Buildings: max 30 nodes
  - Highways/Waterways: max 25 nodes
  - Land use: max 20 nodes
- **Feature types**: Points of interest, buildings, roads, waterways, land use

## Data Processing

### Feature Categorization
OSM features are automatically categorized into:

```javascript
const categories = {
  'building': 'building',
  'highway': 'road',
  'waterway': 'waterway',
  'natural': 'water',
  'landuse': 'landuse',
  'amenity': 'poi',
  'shop': 'poi',
  'leisure': 'poi',
  'tourism': 'poi',
  'office': 'poi',
  'industrial': 'poi'
};
```

### Polygon Quality Validation
Features are filtered based on quality metrics:

```javascript
const validatePolygonQuality = (coordinates, centerLat, centerLng) => {
  // Remove duplicate consecutive points
  const uniqueCoords = coordinates.filter((coord, index, arr) => {
    if (index === 0) return true;
    const prev = arr[index - 1];
    return !(coord[0] === prev[0] && coord[1] === prev[1]);
  });

  if (uniqueCoords.length < 3) return false;

  // Calculate area and perimeter
  const area = calculatePolygonArea(uniqueCoords);
  const perimeter = calculatePolygonPerimeter(uniqueCoords);
  
  // Filter out low-quality polygons
  if (area < 0.000001 || perimeter < 0.001) return false;
  if (area / perimeter < 0.0001) return false;

  // Check distance from center
  const centerDistance = calculateDistanceFromCenter(uniqueCoords, centerLat, centerLng);
  if (centerDistance > 0.1) return false;

  return true;
};
```

## Map Rendering

### Layer Types
OSM data is rendered as three distinct layer types:

#### 1. Fill Layers (Polygons)
```javascript
map.addSource(`osm-fill-${category}`, {
  type: 'geojson',
  data: {
    type: 'FeatureCollection',
    features: categoryFeatures
  }
});

map.addLayer({
  id: `osm-fill-${category}`,
  type: 'fill',
  source: `osm-fill-${category}`,
  paint: {
    'fill-color': getCategoryColor(category),
    'fill-opacity': 0.3
  }
});
```

#### 2. Line Layers (Roads, Waterways, Polygon Outlines)
```javascript
map.addLayer({
  id: `osm-line-${category}`,
  type: 'line',
  source: `osm-line-${category}`,
  paint: {
    'line-color': getCategoryColor(category),
    'line-width': getCategoryLineWidth(category)
  }
});
```

#### 3. Circle Layers (Points of Interest)
```javascript
map.addLayer({
  id: `osm-circle-${category}`,
  type: 'circle',
  source: `osm-circle-${category}`,
  paint: {
    'circle-color': getCategoryColor(category),
    'circle-radius': 3,
    'circle-opacity': 0.8
  }
});
```

### Color Coding
Each feature category has a distinct color:

```javascript
const getCategoryColor = (category) => {
  switch (category) {
    case 'building': return '#ef4444';      // Red
    case 'road': return '#f59e0b';         // Orange
    case 'waterway': return '#3b82f6';     // Blue
    case 'water': return '#0ea5e9';        // Light Blue
    case 'landuse': return '#10b981';      // Green
    case 'poi': return '#8b5cf6';          // Purple
    default: return '#6b7280';             // Gray
  }
};
```

### Line Weights
Different feature types have varying line thicknesses:

```javascript
const getCategoryLineWidth = (category) => {
  switch (category) {
    case 'road': return 1;        // Light weight for roads
    case 'waterway': return 2;    // Medium for waterways
    default: return 1;            // Thin for others
  }
};
```

## Visual Enhancements

### Search Radius Indicator
A dashed white circle shows the 6km search area:

```javascript
// Add dashed circle to show search radius
const circleCoords = generateCircleCoordinates(lat, lng, 6000, 64);
map.addSource('search-radius', {
  type: 'geojson',
  data: {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: circleCoords
    }
  }
});

map.addLayer({
  id: 'search-radius',
  type: 'line',
  source: 'search-radius',
  paint: {
    'line-color': 'rgba(255, 255, 255, 0.6)',
    'line-width': 1,
    'line-dasharray': [3, 3]
  }
});
```

### Auto-Zoom
Map automatically zooms to fit all OSM features:

```javascript
const bounds = new mapboxgl.LngLatBounds();
categoryFeatures.forEach(feature => {
  if (feature.geometry.type === 'Point') {
    bounds.extend(feature.geometry.coordinates);
  } else if (feature.geometry.type === 'LineString' || feature.geometry.type === 'Polygon') {
    feature.geometry.coordinates.forEach(coord => {
      if (Array.isArray(coord[0])) {
        coord.forEach(point => bounds.extend(point));
      } else {
        bounds.extend(coord);
      }
    });
  }
});

map.fitBounds(bounds, {
  padding: 50,
  duration: 2000
});
```

## Dynamic Legend

### OSMLegend Component
The legend automatically updates based on loaded OSM data:

```javascript
const OSMLegend = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [osmFeatures, setOsmFeatures] = useState([]);
  const [featureCounts, setFeatureCounts] = useState({});

  useEffect(() => {
    const handleDataLoaded = (event) => {
      setOsmFeatures(event.detail.features);
      setFeatureCounts(event.detail.counts);
      setIsVisible(true);
    };

    const handleDataCleared = () => {
      setIsVisible(false);
      setOsmFeatures([]);
      setFeatureCounts({});
    };

    window.mapEventBus.addEventListener('osm:dataLoaded', handleDataLoaded);
    window.mapEventBus.addEventListener('osm:dataCleared', handleDataCleared);

    return () => {
      window.mapEventBus.removeEventListener('osm:dataLoaded', handleDataLoaded);
      window.mapEventBus.removeEventListener('osm:dataCleared', handleDataCleared);
    };
  }, []);

  // Render legend items with color swatches and counts
};
```

### Event Communication
Components communicate via a global event bus:

```javascript
// Emit when OSM data is loaded
window.mapEventBus.dispatchEvent(new CustomEvent('osm:dataLoaded', {
  detail: {
    features: allFeatures,
    counts: featureCounts
  }
}));

// Emit when OSM data is cleared
window.mapEventBus.dispatchEvent(new CustomEvent('osm:dataCleared'));
```

## Usage Example

### Triggering OSM Query
```javascript
// Click ActionButton to query OSM data around coordinates
<ActionButton 
  onClick={handleOSMQuery}
  title="Query OSM Data"
  color="#10b981"
  size="10px"
  position={{ top: '-25px', left: 'calc(98% - 25px)' }}
  aiState={aiState}
  map={map}
  onLoadingChange={setIsActionButtonLoading}
/>
```

### Expected Response Format
OSM data is returned as GeoJSON features:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[lng1, lat1], [lng2, lat2], ...]]
      },
      "properties": {
        "category": "building",
        "tags": {
          "building": "yes",
          "name": "Building Name"
        }
      }
    }
  ]
}
```

## Performance Considerations

### Data Filtering
- **Node count limits** prevent overly complex geometries
- **Distance validation** removes features too far from center
- **Quality metrics** filter out malformed polygons

### Layer Management
- **Source cleanup** removes old data before adding new
- **Efficient rendering** uses appropriate layer types for different geometries
- **Memory management** clears sources when data is no longer needed

### Animation Optimization
- **Staggered delays** prevent overwhelming the map with simultaneous updates
- **Smooth transitions** use appropriate duration and easing functions

## Future Enhancements

### Potential Improvements
1. **Caching**: Store OSM data locally to reduce API calls
2. **Progressive loading**: Load features in chunks for better performance
3. **Custom styling**: Allow users to customize colors and line weights
4. **Feature filtering**: Add UI controls to show/hide specific categories
5. **Export functionality**: Allow users to download OSM data as GeoJSON

### Advanced Queries
1. **Time-based data**: Query historical OSM changes
2. **Attribute filtering**: Filter by specific tags or properties
3. **Spatial relationships**: Query features based on spatial relationships
4. **Custom geometries**: Support for complex spatial queries

## Troubleshooting

### Common Issues
1. **400 Bad Request**: Check Overpass query syntax and coordinate format
2. **Timeout errors**: Reduce query complexity or increase timeout value
3. **Missing features**: Verify coordinate system and search radius
4. **Performance issues**: Check node count limits and data filtering

### Debug Information
Enable console logging to troubleshoot issues:

```javascript
console.log('OSM Query:', overpassQuery);
console.log('OSM Response:', data);
console.log('Processed Features:', allFeatures);
```

## Dependencies

### Required Packages
- `mapbox-gl`: Map rendering and interaction
- `styled-components`: Legend styling (optional)

### Browser Support
- Modern browsers with ES6+ support
- WebGL support for Mapbox GL JS
- Fetch API for HTTP requests

---

*This documentation covers the OSM integration as implemented in the DCC mapping application. For technical questions or feature requests, refer to the component source code or contact the development team.*
