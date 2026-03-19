/**
 * Location Utilities (Node.js version)
 * Helper functions for coordinate-to-location mapping and SERP API integration
 * Used by server.js and proxy-server.js
 */

// Texas ERCOT locations configuration (Node.js compatible)
const TEXAS_LOCATIONS = {
  default: {
    coordinates: { lat: 31.9315, lng: -97.347 },
    city: 'Whitney',
    state: 'Texas'
  },
  austin: {
    coordinates: { lat: 30.2672, lng: -97.7431 },
    city: 'Austin',
    state: 'Texas'
  },
  dallas: {
    coordinates: { lat: 32.7767, lng: -96.7970 },
    city: 'Dallas',
    state: 'Texas'
  },
  houston: {
    coordinates: { lat: 29.7604, lng: -95.3698 },
    city: 'Houston',
    state: 'Texas'
  },
  sanantonio: {
    coordinates: { lat: 29.4241, lng: -98.4936 },
    city: 'San Antonio',
    state: 'Texas'
  }
};

/**
 * Get SERP API location string for coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} tolerance - Tolerance for coordinate matching (default 0.1)
 * @returns {string|null} Location string for SERP API or null if no match
 */
function getSerpLocationString(lat, lng, tolerance = 0.1) {
  for (const [key, config] of Object.entries(TEXAS_LOCATIONS)) {
    const { coordinates } = config;
    if (
      Math.abs(lat - coordinates.lat) < tolerance &&
      Math.abs(lng - coordinates.lng) < tolerance
    ) {
      return `${config.city},${config.state},United States`;
    }
  }
  return null; // Use coordinates directly if no match found
}

/**
 * Check if coordinates are within Texas region
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} True if coordinates are in Texas region
 */
function isTexasRegion(lat, lng) {
  return getSerpLocationString(lat, lng) !== null;
}

module.exports = {
  getSerpLocationString,
  isTexasRegion,
  TEXAS_LOCATIONS
};
