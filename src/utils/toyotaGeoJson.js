import * as turf from '@turf/turf';
import { fetchOverpassJSON } from './overpassClient';

// Default Toyota Battery Manufacturing NC centroid (near Liberty, NC)
const DEFAULT_CENTER = [-79.571693, 35.85347]; // [lng, lat]

// Classify highway category similar to OSMCall.jsx
function classifyHighway(tags = {}) {
  const ref = tags.ref || '';
  const name = tags.name || '';
  const hw = tags.highway || '';

  if (hw === 'motorway' || /\bI[-\s]?\d+\b/i.test(ref) || /Interstate/i.test(name)) {
    return { category: 'interstate', priority: 3 };
  }
  if (hw === 'trunk' || /\bUS[-\s]?\d+\b/i.test(ref) || /US Highway/i.test(name)) {
    return { category: 'us_highway', priority: 3 };
  }
  if (/\b(NC|SR|State Route)[-\s]?\d+\b/i.test(ref) || /State Route|NC\s*\d+/i.test(name)) {
    return { category: 'state_highway', priority: 2 };
  }
  if (hw === 'primary') return { category: 'primary_road', priority: 2 };
  if (hw === 'secondary') return { category: 'secondary_road', priority: 1 };
  return { category: 'highway_access', priority: 1 };
}

function wayToCoordinates(elements, way) {
  if (!way.nodes || way.nodes.length === 0) return [];
  const nodes = way.nodes.map(id => elements.find(e => e.id === id)).filter(Boolean);
  return nodes.map(n => [n.lon, n.lat]);
}

export async function generateToyotaGeoJson(options = {}) {
  const center = options.center || DEFAULT_CENTER; // [lng, lat]
  const radiusKm = options.radiusKm || 2.0;
  const searchMeters = Math.max(1000, Math.floor((options.searchMeters || 5000)));

  const [lng, lat] = center;

  // AOI buffers
  const aoi = turf.circle(center, radiusKm, { steps: 128, units: 'kilometers' });
  const aoi5 = turf.circle(center, radiusKm * 2.5, { steps: 128, units: 'kilometers' });

  // Overpass queries (industrial, power, roads)
  const overpassQuery = `
    [out:json][timeout:25];
    (
      // Industrial landuse and buildings
      way["landuse"="industrial"](around:${searchMeters}, ${lat}, ${lng});
      way["building"="industrial"](around:${searchMeters}, ${lat}, ${lng});

      // Power infrastructure
      node["power"~"^(station|substation|generator|transformer|tower|pole)$"](around:${searchMeters}, ${lat}, ${lng});
      way["power"~"^(station|substation|generator|transformer|tower|pole|line)$"](around:${searchMeters}, ${lat}, ${lng});

      // Highways and connectors
      way["highway"~"^(motorway|trunk|primary|secondary)$"](around:${searchMeters}, ${lat}, ${lng});
    );
    out body; >; out skel qt;
  `;

  let osmData;
  try {
    osmData = await fetchOverpassJSON(overpassQuery, { retriesPerEndpoint: 1, totalEndpoints: 2 });
  } catch (e) {
    // Fallback to empty collection on failure; caller can replace with local file
    return {
      type: 'FeatureCollection',
      features: [
        // AOI visuals so caller still has something to render
        {
          type: 'Feature',
          geometry: aoi.geometry,
          properties: { category: 'aoi', name: 'Toyota AOI (2km)', priority: 1 }
        },
        {
          type: 'Feature',
          geometry: aoi5.geometry,
          properties: { category: 'aoi_outer', name: 'Toyota AOI (5km)', priority: 0 }
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: center },
          properties: {
            name: 'Toyota Battery Manufacturing North Carolina',
            category: 'industrial',
            priority: 3,
            zone: 'toyota_site',
            zone_name: 'Toyota Battery Manufacturing North Carolina'
          }
        }
      ]
    };
  }

  const features = [];

  // AOI features
  features.push({ type: 'Feature', geometry: aoi.geometry, properties: { category: 'aoi', name: 'Toyota AOI (2km)', priority: 1 } });
  features.push({ type: 'Feature', geometry: aoi5.geometry, properties: { category: 'aoi_outer', name: 'Toyota AOI (5km)', priority: 0 } });
  features.push({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: center },
    properties: {
      name: 'Toyota Battery Manufacturing North Carolina',
      category: 'industrial',
      priority: 3,
      zone: 'toyota_site',
      zone_name: 'Toyota Battery Manufacturing North Carolina'
    }
  });

  // Convert OSM elements
  const elements = Array.isArray(osmData.elements) ? osmData.elements : [];
  elements.forEach(el => {
    if (el.type === 'node') {
      // Power nodes
      if (el.tags && (el.tags.power || el.tags.amenity === 'power' || el.tags.landuse === 'power')) {
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [el.lon, el.lat] },
          properties: {
            osm_id: el.id,
            osm_type: 'node',
            name: el.tags.name || 'Power Facility',
            power: el.tags.power || null,
            landuse: el.tags.landuse || null,
            amenity: el.tags.amenity || null,
            category: 'power_facility',
            priority: 3,
            zone: 'toyota_power',
            zone_name: 'Toyota Power Infrastructure'
          }
        });
      }
    } else if (el.type === 'way') {
      // Highways
      if (el.tags && el.tags.highway) {
        const coords = wayToCoordinates(elements, el);
        if (coords.length >= 2) {
          const { category, priority } = classifyHighway(el.tags);
          features.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: coords },
            properties: {
              osm_id: el.id,
              osm_type: 'way',
              name: el.tags.name || 'Highway',
              highway: el.tags.highway,
              ref: el.tags.ref || null,
              category,
              priority,
              zone: 'toyota_access',
              zone_name: 'Toyota Regional Access'
            }
          });
        }
        return;
      }

      // Industrial landuse/buildings
      if (el.tags && (el.tags.landuse === 'industrial' || el.tags.building === 'industrial')) {
        const ring = wayToCoordinates(elements, el);
        if (ring.length >= 3) {
          // ensure closed
          if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
            ring.push(ring[0]);
          }
          features.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [ring] },
            properties: {
              osm_id: el.id,
              osm_type: 'way',
              landuse: el.tags.landuse || null,
              building: el.tags.building || null,
              name: el.tags.name || 'Industrial Area',
              category: 'industrial',
              priority: 2,
              zone: 'toyota_industrial',
              zone_name: 'Toyota Industrial Context'
            }
          });
        }
      }
    }
  });

  return { type: 'FeatureCollection', features };
}

export default generateToyotaGeoJson;


