/**
 * Helpers for merging GeoJSON route segments and extracting coordinates.
 * Ported from the Texas path animation kit so we can share behaviour.
 */

/**
 * Extract LineString coordinates from a FeatureCollection or Feature.
 * Supports MultiLineString features and mixed collections.
 * @param {GeoJSON.FeatureCollection|GeoJSON.Feature} geojson
 * @returns {Array<Array<Array<number>>>} List of LineString coordinate arrays.
 */
export function extractLineStrings(geojson) {
  if (!geojson) return [];

  const features = geojson?.type === 'Feature'
    ? [geojson]
    : Array.isArray(geojson?.features)
      ? geojson.features
      : [];

  const lines = [];

  features.forEach((feature) => {
    if (!feature?.geometry) return;
    const { geometry } = feature;

    if (geometry.type === 'LineString') {
      lines.push(geometry.coordinates);
    } else if (geometry.type === 'MultiLineString') {
      geometry.coordinates.forEach((coords) => lines.push(coords));
    }
  });

  return lines;
}

/**
 * Join multiple GeoJSON responses into a single MultiLineString FeatureCollection.
 * Mirrors the logic embedded in the transportation network layer.
 * @param {Array<GeoJSON.FeatureCollection|GeoJSON.Feature>} collections
 * @returns {GeoJSON.FeatureCollection}
 */
export function joinSegments(collections) {
  const coordinates = [];
  (collections || []).forEach((collection) => {
    extractLineStrings(collection).forEach((coords) => coordinates.push(coords));
  });

  return {
    type: 'FeatureCollection',
    features: coordinates.length
      ? [
          {
            type: 'Feature',
            geometry: {
              type: 'MultiLineString',
              coordinates,
            },
            properties: {},
          },
        ]
      : [],
  };
}

/**
 * Build an array of raw coordinates flattened into a single list, handy for
 * particle animations that expect a linear traversal.
 * @param {Array<GeoJSON.FeatureCollection|GeoJSON.Feature>} collections
 * @returns {Array<Array<number>>}
 */
export function flattenCoordinates(collections) {
  const coords = [];
  (collections || []).forEach((collection) => {
    extractLineStrings(collection).forEach((line) => {
      line.forEach((coord) => coords.push(coord));
    });
  });
  return coords;
}

export default {
  extractLineStrings,
  joinSegments,
  flattenCoordinates,
};
