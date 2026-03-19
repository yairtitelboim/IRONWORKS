/**
 * Location Utilities
 * Helper functions for coordinate-to-location mapping and SERP API integration
 */

import { GEOGRAPHIC_CONFIG } from '../config/geographicConfig.js';

/**
 * Get location configuration by coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} tolerance - Tolerance for coordinate matching (default 0.1)
 * @returns {Object|null} Location configuration or null if not found
 */
export const getGeographicConfigByCoordinates = (lat, lng, tolerance = 0.1) => {
  for (const [key, config] of Object.entries(GEOGRAPHIC_CONFIG)) {
    const { coordinates } = config;
    if (
      Math.abs(lat - coordinates.lat) < tolerance &&
      Math.abs(lng - coordinates.lng) < tolerance
    ) {
      return { key, ...config };
    }
  }
  return null;
};

/**
 * Get SERP API location string for coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} Location string for SERP API (e.g., "Memphis,Tennessee,United States")
 */
export const getSerpLocationString = (lat, lng) => {
  const locationConfig = getGeographicConfigByCoordinates(lat, lng);
  if (locationConfig) {
    return `${locationConfig.city},${locationConfig.state},United States`;
  }
  return null; // Use coordinates directly if no match found
};

/**
 * Check if coordinates are within Texas ERCOT region
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} True if coordinates are in Texas ERCOT region
 */
export const isTexasERCOTRegion = (lat, lng) => {
  const locationConfig = getGeographicConfigByCoordinates(lat, lng);
  return locationConfig && locationConfig.state === 'TX' && locationConfig.gridOperator === 'ERCOT';
};

/**
 * Get all Texas ERCOT location coordinates
 * @returns {Array} Array of {key, city, state, coordinates} for all Texas locations
 */
export const getTexasERCOTLocations = () => {
  return Object.entries(GEOGRAPHIC_CONFIG)
    .filter(([key, config]) => config.state === 'TX' && config.gridOperator === 'ERCOT')
    .map(([key, config]) => ({
      key,
      city: config.city,
      state: config.state,
      coordinates: config.coordinates
    }));
};
