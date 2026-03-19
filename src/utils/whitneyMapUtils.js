// Whitney, TX Map Utilities

/**
 * Generate circle coordinates for Whitney zones
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude  
 * @param {number} radiusKm - Radius in kilometers
 * @param {number} steps - Number of steps for circle approximation
 * @returns {Array} Array of [lng, lat] coordinates
 */
export function generateCircleCoordinates(lat, lng, radiusKm, steps = 64) {
  const coordinates = [];
  const earthRadius = 6371; // Earth's radius in kilometers
  
  for (let i = 0; i <= steps; i++) {
    const angle = (i * 360) / steps;
    const angleRad = (angle * Math.PI) / 180;
    
    const latRad = (lat * Math.PI) / 180;
    const lngRad = (lng * Math.PI) / 180;
    
    const newLat = Math.asin(
      Math.sin(latRad) * Math.cos(radiusKm / earthRadius) +
      Math.cos(latRad) * Math.sin(radiusKm / earthRadius) * Math.cos(angleRad)
    );
    
    const newLng = lngRad + Math.atan2(
      Math.sin(angleRad) * Math.sin(radiusKm / earthRadius) * Math.cos(latRad),
      Math.cos(radiusKm / earthRadius) - Math.sin(latRad) * Math.sin(newLat)
    );
    
    coordinates.push([
      (newLng * 180) / Math.PI,
      (newLat * 180) / Math.PI
    ]);
  }
  
  return coordinates;
}

/**
 * Calculate Whitney-specific metrics for infrastructure features
 * @param {Array} features - Array of GeoJSON features
 * @returns {Array} Enhanced features with Whitney metrics
 */
export function calculateWhitneyMetrics(features) {
  // Whitney Data Center coordinates
  const dataCenterLat = 31.9315;
  const dataCenterLng = -97.347;
  
  // Whitney Downtown coordinates  
  const downtownLat = 31.951;
  const downtownLng = -97.323;
  
  return features.map(feature => {
    const coords = feature.geometry.coordinates;
    let lat, lng;
    
    if (feature.geometry.type === 'Point') {
      [lng, lat] = coords;
    } else if (feature.geometry.type === 'LineString') {
      // Use first coordinate for distance calculation
      [lng, lat] = coords[0];
    } else if (feature.geometry.type === 'Polygon') {
      // Use first coordinate of first ring
      [lng, lat] = coords[0][0];
    }
    
    // Calculate distances to key Whitney locations
    const distanceToDataCenter = calculateDistance(lat, lng, dataCenterLat, dataCenterLng);
    const distanceToDowntown = calculateDistance(lat, lng, downtownLat, downtownLng);
    
    // Calculate development score based on category and priority
    let developmentScore = 50; // Base score
    
    if (feature.properties.category === 'power_facility') {
      developmentScore += 30; // High priority for power
    }
    if (feature.properties.category === 'government_facility') {
      developmentScore += 25; // High priority for government
    }
    if (feature.properties.category === 'office_building' || 
        feature.properties.category === 'commercial_building') {
      developmentScore += 20; // Commercial development
    }
    if (feature.properties.priority === 3) {
      developmentScore += 15; // High priority features
    }
    if (feature.properties.priority === 2) {
      developmentScore += 10; // Medium priority features
    }
    
    // Accessibility score based on distance to key locations
    let accessibilityScore = 50;
    if (distanceToDataCenter < 2000) { // Within 2km of data center
      accessibilityScore += 25;
    }
    if (distanceToDowntown < 2000) { // Within 2km of downtown
      accessibilityScore += 20;
    }
    
    return {
      ...feature,
      properties: {
        ...feature.properties,
        distance_to_data_center: distanceToDataCenter,
        distance_to_downtown: distanceToDowntown,
        development_score: Math.min(100, developmentScore),
        accessibility_score: Math.min(100, accessibilityScore)
      }
    };
  });
}

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - First latitude
 * @param {number} lng1 - First longitude
 * @param {number} lat2 - Second latitude  
 * @param {number} lng2 - Second longitude
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}
