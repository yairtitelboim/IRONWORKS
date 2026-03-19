/**
 * Power Circle Geometry Utilities
 *
 * Clean, reusable functions for generating and clipping power circle geometries.
 */

import * as turf from '@turf/turf';

export const generateCircle = (center, radiusMiles) => {
  return turf.circle(center, radiusMiles, {
    steps: 128,
    units: 'miles',
    properties: { radius_miles: radiusMiles, center }
  });
};

/**
 * Generate a mask polygon that covers a large area with the circle as a hole
 * Creates a "donut" shape for darkening everything outside the circle
 */
export const generateMask = (center, radiusMiles, maskExtent = 20) => {
  const [lon, lat] = center;
  const minLon = Math.max(-180, lon - maskExtent);
  const maxLon = Math.min(180, lon + maskExtent);
  const minLat = Math.max(-85, lat - maskExtent);
  const maxLat = Math.min(85, lat + maskExtent);
  const bbox = [minLon, minLat, maxLon, maxLat];
  const outerPolygon = turf.bboxPolygon(bbox);
  const circlePolygon = generateCircle(center, radiusMiles);

  try {
    const maskPolygon = turf.difference(outerPolygon, circlePolygon);
    if (maskPolygon?.geometry) {
      return {
        type: 'Feature',
        properties: { mask: true, center, radius_miles: radiusMiles },
        geometry: maskPolygon.geometry
      };
    }
  } catch (_) {}

  const outerRing = [
    [minLon, minLat],
    [maxLon, minLat],
    [maxLon, maxLat],
    [minLon, maxLat],
    [minLon, minLat]
  ];
  const circleCoords = [...circlePolygon.geometry.coordinates[0]].reverse();
  return {
    type: 'Feature',
    properties: { mask: true, center, radius_miles: radiusMiles },
    geometry: { type: 'Polygon', coordinates: [outerRing, circleCoords] }
  };
};

/**
 * Clip power line features to within a circle boundary
 */
export const clipFeaturesToCircle = (masterGeoJSON, circlePolygon) => {
  if (!masterGeoJSON?.features) return { type: 'FeatureCollection', features: [] };
  const clippedFeatures = [];

  masterGeoJSON.features.forEach((feature) => {
    if (feature.geometry?.type !== 'LineString' || !feature.geometry.coordinates?.length) return;
    const coords = feature.geometry.coordinates;

    try {
      const lineString = turf.lineString(coords);
      const intersection = turf.lineIntersect(lineString, circlePolygon);
      const startPoint = turf.point(coords[0]);
      const endPoint = turf.point(coords[coords.length - 1]);
      const startInside = turf.booleanPointInPolygon(startPoint, circlePolygon);
      const endInside = turf.booleanPointInPolygon(endPoint, circlePolygon);
      const hasIntersection = intersection.features.length > 0;

      if (!startInside && !endInside && !hasIntersection) return;
      if (startInside && endInside) {
        clippedFeatures.push(ensurePowerFeature(feature));
        return;
      }

      const clippedCoords = [];
      let prevInside = false;
      for (let i = 0; i < coords.length; i++) {
        const coord = coords[i];
        const point = turf.point(coord);
        const isInside = turf.booleanPointInPolygon(point, circlePolygon);

        if (isInside) {
          clippedCoords.push(coord);
        } else if (prevInside && i > 0) {
          const prevCoord = coords[i - 1];
          const segment = turf.lineString([prevCoord, coord]);
          const intersections = turf.lineIntersect(segment, circlePolygon);
          if (intersections.features.length > 0) {
            clippedCoords.push(intersections.features[0].geometry.coordinates);
          }
        } else if (!prevInside && isInside && i > 0) {
          const prevCoord = coords[i - 1];
          const segment = turf.lineString([prevCoord, coord]);
          const intersections = turf.lineIntersect(segment, circlePolygon);
          if (intersections.features.length > 0) {
            clippedCoords.push(intersections.features[0].geometry.coordinates);
          }
          clippedCoords.push(coord);
        }
        prevInside = isInside;
      }

      if (clippedCoords.length >= 2) {
        clippedFeatures.push(ensurePowerFeature({
          ...feature,
          geometry: { type: 'LineString', coordinates: clippedCoords }
        }));
      }
    } catch (err) {
      try {
        const lineString = turf.lineString(coords);
        const intersection = turf.lineIntersect(lineString, circlePolygon);
        const startPoint = turf.point(coords[0]);
        const endPoint = turf.point(coords[coords.length - 1]);
        if (
          turf.booleanPointInPolygon(startPoint, circlePolygon) ||
          turf.booleanPointInPolygon(endPoint, circlePolygon) ||
          intersection.features.length > 0
        ) {
          clippedFeatures.push(ensurePowerFeature(feature));
        }
      } catch (_) {}
    }
  });

  return { type: 'FeatureCollection', features: clippedFeatures };
};

/** Ensure feature has infra_type for HIFLD (power-only) */
const ensurePowerFeature = (f) => ({
  ...f,
  properties: { ...(f.properties || {}), infra_type: 'power' }
});

/**
 * Pre-filter master GeoJSON to a local subset (performance)
 */
export const prefilterLocalSubset = (masterGeoJSON, center, bufferMiles = 15) => {
  if (!masterGeoJSON?.features) return { type: 'FeatureCollection', features: [] };
  const [centerLon, centerLat] = center;
  const latDegrees = bufferMiles / 69;
  const lonDegrees = bufferMiles / (69 * Math.cos((centerLat * Math.PI) / 180));
  const minLon = centerLon - lonDegrees;
  const maxLon = centerLon + lonDegrees;
  const minLat = centerLat - latDegrees;
  const maxLat = centerLat + latDegrees;

  const bboxFiltered = masterGeoJSON.features.filter((feature) => {
    if (!feature?.geometry || feature.geometry.type !== 'LineString') return false;
    const coords = feature.geometry.coordinates;
    if (!coords?.length) return false;
    return coords.some(([lon, lat]) => lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat);
  });

  const filteredFeatures = bboxFiltered.filter((feature) => {
    const coords = feature.geometry.coordinates;
    if (!coords?.length) return false;
    return coords.some(([lon, lat]) => {
      const dLat = lat - centerLat;
      const dLon = (lon - centerLon) * Math.cos((centerLat * Math.PI) / 180);
      const distanceMiles = Math.sqrt(dLat * dLat + dLon * dLon) * 69;
      return distanceMiles <= bufferMiles * 1.5;
    });
  });

  return { type: 'FeatureCollection', features: filteredFeatures };
};
