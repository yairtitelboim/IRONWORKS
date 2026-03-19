// Geometry and scoring utilities for Whitney, TX analysis

// Generate circle coordinates for a given center and radius (km)
export function generateCircleCoordinates(centerLat, centerLng, radiusKm, numPoints = 64) {
  const coordinates = [];
  const radiusDegrees = radiusKm / 111.32; // Convert km to degrees (approximate)
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    const lat = centerLat + (radiusDegrees * Math.cos(angle));
    const lng = centerLng + (radiusDegrees * Math.sin(angle) / Math.cos(centerLat * Math.PI / 180));
    coordinates.push([lng, lat]);
  }
  return coordinates;
}

// Haversine distance in meters
export function calculateDistance(coord1, coord2) {
  const R = 6371; // km
  const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
  const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(coord1[1] * Math.PI / 180) * Math.cos(coord2[1] * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1000; // meters
}

export function calculateCentroid(coordinates) {
  let x = 0, y = 0;
  coordinates.forEach(coord => {
    x += coord[0];
    y += coord[1];
  });
  return [x / coordinates.length, y / coordinates.length];
}

export function calculateDevelopmentScore(feature) {
  let score = 50; // Base score
  const levels = parseInt(feature.properties.building_levels) || 0;
  if (levels >= 20) score += 30;
  else if (levels >= 10) score += 20;
  else if (levels >= 5) score += 10;

  // Distance to primary Whitney reference point (CyrusOne DFW7 campus)
  const primaryCampusCenter = [31.9315, -97.347];
  const coords = feature.geometry.type === 'Point'
    ? feature.geometry.coordinates
    : calculateCentroid(feature.geometry.coordinates[0]);
  const distance = calculateDistance(coords, primaryCampusCenter);

  if (distance < 200) score += 25;
  else if (distance < 500) score += 15;
  else if (distance < 1000) score += 5;

  return Math.min(100, Math.max(0, score));
}

export function calculateAccessibilityScore(feature, allFeatures) {
  const coords = feature.geometry.type === 'Point'
    ? feature.geometry.coordinates
    : calculateCentroid(feature.geometry.coordinates[0]);

  const transitFeatures = allFeatures.filter(f =>
    f.properties.category === 'transit_hub' ||
    f.properties.category === 'bus_stop' ||
    f.properties.category === 'highway_access'
  );

  let score = 0;
  transitFeatures.forEach(transit => {
    const transitCoords = transit.geometry.type === 'Point'
      ? transit.geometry.coordinates
      : calculateCentroid(transit.geometry.coordinates[0]);
    const distance = calculateDistance(coords, transitCoords);
    if (distance < 200) score += 30;
    else if (distance < 500) score += 20;
    else if (distance < 1000) score += 10;
  });

  return Math.min(100, score);
}

// Apply metrics to a feature set (mutates features)
export function calculatePinalMetrics(features) {
  // Preserve original property keys for downstream compatibility.
  const primaryCampusCenter = [31.9315, -97.347]; // CyrusOne DFW7 campus
  const whitneyDowntownCenter = [31.951, -97.323]; // Whitney downtown core

  features.forEach(feature => {
    if (feature.geometry.type === 'Point' || feature.geometry.type === 'Polygon') {
      let coords;
      if (feature.geometry.type === 'Point') {
        coords = feature.geometry.coordinates;
      } else {
        coords = calculateCentroid(feature.geometry.coordinates[0]);
      }

      feature.properties.distance_to_casa_grande = calculateDistance(coords, primaryCampusCenter);
      feature.properties.distance_to_florence = calculateDistance(coords, whitneyDowntownCenter);

      if (feature.properties.category.includes('office') || feature.properties.category.includes('commercial')) {
        feature.properties.development_score = calculateDevelopmentScore(feature);
      }

      feature.properties.accessibility_score = calculateAccessibilityScore(feature, features);
    }
  });

  return features;
}
