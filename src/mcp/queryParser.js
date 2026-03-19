/**
 * Natural Language Query Parser for Infrastructure Search
 * 
 * Extracts structured parameters from natural language queries like:
 * - "substations near TSMC"
 * - "water infrastructure within 10km of Intel"
 * - "pipelines 5 miles from Amkor"
 */

import { NC_POWER_SITES } from '../config/ncPowerSites.js';

/**
 * Parse a natural language query into structured search parameters
 * @param {string} query - Natural language query
 * @returns {Object} - { facilityName, facilityKey, radius, category, confidence }
 */
export const parseQuery = (query) => {
  if (!query || typeof query !== 'string') {
    return {
      facilityName: null,
      facilityKey: null,
      radius: 5000, // Default 5km
      category: null, // All categories
      confidence: 0,
      error: 'Invalid query'
    };
  }

  const lowerQuery = query.toLowerCase().trim();
  
  // Default values
  let facilityName = null;
  let facilityKey = null;
  let radius = null; // Will be set based on category or default
  let category = null; // null means all categories
  let confidence = 0.5; // Base confidence

  // Extract facility name/key
  // Match against known site names and keys
  for (const site of NC_POWER_SITES) {
    const siteNameLower = site.name.toLowerCase();
    const shortNameLower = site.shortName.toLowerCase();
    const keyLower = site.key.toLowerCase();
    
    // Check for exact matches or partial matches
    if (
      lowerQuery.includes(keyLower) ||
      lowerQuery.includes(siteNameLower) ||
      lowerQuery.includes(shortNameLower) ||
      lowerQuery.includes(site.name.split(' ')[0].toLowerCase()) // First word
    ) {
      facilityName = site.name;
      facilityKey = site.key;
      confidence += 0.3;
      break;
    }
  }

  // Extract radius
  // Patterns: "5km", "10 km", "5 miles", "3mi", "5000m", "within 10km", "within 5 miles"
  const radiusPatterns = [
    { pattern: /(\d+)\s*(?:km|kilometer|kilometers)/i, multiplier: 1000 },
    { pattern: /(\d+)\s*(?:mi|mile|miles)/i, multiplier: 1609.34 },
    { pattern: /(\d+)\s*m(?!i)/i, multiplier: 1 }, // meters (not miles)
    { pattern: /within\s+(\d+)\s*(?:km|kilometer|kilometers)/i, multiplier: 1000 },
    { pattern: /within\s+(\d+)\s*(?:mi|mile|miles)/i, multiplier: 1609.34 },
  ];

  for (const { pattern, multiplier } of radiusPatterns) {
    const match = lowerQuery.match(pattern);
    if (match) {
      const value = parseInt(match[1], 10);
      if (value > 0 && value < 1000) { // Sanity check: 0-1000 km
        radius = value * multiplier;
        confidence += 0.2;
        break;
      }
    }
  }

  // Extract category
  // Common infrastructure categories
  const categoryKeywords = {
    substation: ['substation', 'substations', 'power station', 'transformer'],
    water: ['water', 'water infrastructure', 'water line', 'water pipeline', 'aqueduct'],
    pipeline: ['pipeline', 'pipelines', 'gas line', 'gas pipeline'],
    tower: ['tower', 'towers', 'transmission tower', 'power tower'],
    line: ['line', 'lines', 'power line', 'transmission line'],
    plant: ['plant', 'power plant', 'generation'],
  };

  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword)) {
        category = cat;
        confidence += 0.2;
        break;
      }
    }
    if (category) break;
  }

  // Category-specific default radii (if no radius specified in query)
  // These are larger to account for strategic filtering - we need wider coverage
  // Note: Transmission infrastructure can span large distances, so substation searches need wider coverage
  const categoryDefaultRadii = {
    substation: 100000,   // 100km for substations (regional transmission coverage)
    line: 100000,         // 100km for transmission lines (they span long distances)
    tower: 50000,         // 50km for towers
    water: 30000,         // 30km for water infrastructure
    pipeline: 50000,      // 50km for pipelines
    plant: 20000,         // 20km for power plants
    default: 50000        // 50km default (increased from 5km)
  };

  // If no radius was extracted from query, use category-specific default
  if (radius === null) {
    radius = categoryDefaultRadii[category] || categoryDefaultRadii.default;
  }

  // Clamp radius to reasonable bounds (100m to 100km)
  radius = Math.max(100, Math.min(100000, radius));

  // If no facility found, confidence is low
  if (!facilityName) {
    confidence = Math.max(0, confidence - 0.5);
  }

  return {
    facilityName,
    facilityKey,
    radius: Math.round(radius),
    category,
    confidence,
    error: facilityName ? null : 'No matching facility found. Try: TSMC, Intel, Amkor, etc.'
  };
};

/**
 * Get facility by name or key
 * @param {string} nameOrKey - Facility name or key
 * @returns {Object|null} - Facility object or null
 */
export const getFacilityByNameOrKey = (nameOrKey) => {
  if (!nameOrKey) return null;
  
  const lower = nameOrKey.toLowerCase();
  return NC_POWER_SITES.find(site => 
    site.key.toLowerCase() === lower ||
    site.name.toLowerCase() === lower ||
    site.shortName.toLowerCase() === lower
  ) || null;
};

/**
 * Get all available facility names for autocomplete
 * @returns {Array} - Array of { name, key, shortName }
 */
export const getAvailableFacilities = () => {
  return NC_POWER_SITES.map(site => ({
    name: site.name,
    key: site.key,
    shortName: site.shortName
  }));
};

