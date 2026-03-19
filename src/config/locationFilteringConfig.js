/**
 * Location-Specific Filtering Configuration
 * Provides location-aware filtering for CategoryToggle component
 * Replaces hardcoded utility names and keywords with location-specific mappings
 */

export const LOCATION_FILTERING_CONFIG = {
  // Default (Whitney, TX)
  default: {
    utilities: ['Oncor', 'Daniels Electric', 'Hilco Electric'],
    transmission: ['Oncor', 'ERCOT Transmission', 'Substation'],
    powerGeneration: ['Bosque Power Plant', 'Coal-fired', 'Natural Gas Plant', 'Wind Farm'],
    waterUtilities: ['City of Whitney', 'Bosque County Water', 'Municipal Water'],
    gridOperator: 'ERCOT',
    region: 'North Central Texas'
  },

  // Austin, TX
  austin: {
    utilities: ['Austin Energy', 'Pedernales Electric', 'Bluebonnet Electric'],
    transmission: ['Oncor', 'LCRA', 'Austin Energy Transmission'],
    powerGeneration: ['Natural Gas Plant', 'Wind Farm', 'Solar Farm', 'Coal Plant'],
    waterUtilities: ['Austin Water', 'Travis County Water', 'Municipal Water'],
    gridOperator: 'ERCOT',
    region: 'Central Texas'
  },

  // Dallas, TX
  dallas: {
    utilities: ['Oncor', 'CoServ', 'Denton Municipal Electric'],
    transmission: ['Oncor', 'AEP Texas', 'Transmission'],
    powerGeneration: ['Natural Gas Plant', 'Coal Plant', 'Nuclear Plant', 'Wind Farm'],
    waterUtilities: ['Dallas Water Utilities', 'Trinity River Authority'],
    gridOperator: 'ERCOT',
    region: 'North Texas'
  },

  // Houston, TX
  houston: {
    utilities: ['CenterPoint Energy', 'Entergy Texas', 'Texas New Mexico Power'],
    transmission: ['CenterPoint Energy', 'Entergy Texas', 'Transmission'],
    powerGeneration: ['Natural Gas Plant', 'Refinery Power', 'Petrochemical', 'Wind Farm'],
    waterUtilities: ['Houston Public Works', 'Harris County Water'],
    gridOperator: 'ERCOT',
    region: 'Southeast Texas'
  },

  // San Antonio, TX
  sanantonio: {
    utilities: ['CPS Energy', 'Guadalupe Valley Electric', 'Pedernales Electric'],
    transmission: ['CPS Energy', 'Oncor', 'Transmission'],
    powerGeneration: ['Natural Gas Plant', 'Wind Farm', 'Solar Farm', 'Coal Plant'],
    waterUtilities: ['San Antonio Water System', 'Bexar County Water'],
    gridOperator: 'ERCOT',
    region: 'South Texas'
  }
};

/**
 * Get location-specific filtering configuration for CategoryToggle
 * @param {string} locationKey - The location key (default, austin, dallas, etc.)
 * @param {string} category - The category to filter (pwr, trn, utl, risk)
 * @returns {Object} Filtering configuration with keywords and typeMatches
 */
export const getLocationSpecificFiltering = (locationKey, category) => {
  const config = LOCATION_FILTERING_CONFIG[locationKey] || LOCATION_FILTERING_CONFIG.default;
  
  switch (category) {
    case 'pwr':
      return {
        keywords: config.powerGeneration,
        typeMatches: ['Power Plant', 'Generation', 'Natural Gas', 'Wind', 'Solar', 'Coal', 'Nuclear']
      };
    case 'trn':
      return {
        keywords: config.transmission,
        typeMatches: ['Substation', 'Transmission', 'Electric Utility', 'Grid']
      };
    case 'utl':
      return {
        keywords: [...config.utilities, ...config.waterUtilities],
        typeMatches: ['Water', 'Utility', 'Municipal', 'Electric']
      };
    case 'risk':
      return {
        keywords: ['Weather', 'Resilience', 'Redundancy', 'Risk', 'Vulnerable'],
        typeMatches: ['Risk', 'Weather', 'Resilience', 'Redundancy']
      };
    default:
      return { keywords: [], typeMatches: [] };
  }
};

/**
 * Get all location-specific keywords for a location (for debugging/testing)
 * @param {string} locationKey - The location key
 * @returns {Object} All keywords for the location
 */
export const getLocationKeywords = (locationKey) => {
  return LOCATION_FILTERING_CONFIG[locationKey] || LOCATION_FILTERING_CONFIG.default;
};

/**
 * Check if a node matches location-specific criteria
 * @param {Object} node - The node object to check
 * @param {string} locationKey - The location key
 * @param {string} category - The category to check against
 * @returns {boolean} True if node matches location-specific criteria
 */
export const matchesLocationCriteria = (node, locationKey, category) => {
  const filtering = getLocationSpecificFiltering(locationKey, category);
  const nodeText = (node.content || node.name || '').toLowerCase();
  const nodeType = (node.type || '').toLowerCase();
  
  // Check keyword matches
  const keywordMatch = filtering.keywords.some(keyword => 
    nodeText.includes(keyword.toLowerCase())
  );
  
  // Check type matches
  const typeMatch = filtering.typeMatches.some(type => 
    nodeType.includes(type.toLowerCase())
  );
  
  return keywordMatch || typeMatch;
};
