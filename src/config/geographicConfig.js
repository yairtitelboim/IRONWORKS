/**
 * Geographic Configuration System
 * Enables location flexibility for production deployment
 * 
 * This configuration allows the system to work with any geographic location
 * with Austin, TX as the default for Tx transmission analysis.
 */

export const GEOGRAPHIC_CONFIG = {
  // Texas statewide view (default)
  texas: {
    coordinates: { lat: 31.0, lng: -99.5 },
    city: 'Texas',
    state: '',
    county: '',
    region: 'Statewide',
    gridOperator: 'ERCOT',
    timezone: 'America/Chicago',
    searchRadius: 200000,
    businessContext: 'Texas Statewide Data Center & Power Analysis',
    dataCenterCompany: 'Generic',
    facilityName: 'Texas Statewide View'
  },

  // Default configuration (Austin, TX - Tx transmission analysis)
  default: {
    coordinates: { lat: 30.2672, lng: -97.7431 },
    city: 'Austin',
    state: 'TX',
    county: 'Travis County',
    region: 'Central Texas',
    gridOperator: 'ERCOT',
    timezone: 'America/Chicago',
    searchRadius: 10000,
    businessContext: 'Austin, TX Metro Area Analysis',
    dataCenterCompany: 'Generic',
    facilityName: 'Austin Metro Innovation Hub'
  },

  whitney: {
    coordinates: { lat: 31.9315, lng: -97.347 },
    city: 'Whitney',
    state: 'TX',
    county: 'Bosque County',
    region: 'Central Texas',
    gridOperator: 'ERCOT',
    timezone: 'America/Chicago',
    searchRadius: 8000,
    businessContext: 'Whitney, TX Regional Data Center Analysis',
    dataCenterCompany: 'CyrusOne',
    facilityName: 'CyrusOne DFW7 Data Center'
  },

  lake_whitney_dam_aoi: {
    coordinates: { lat: 31.867, lng: -97.367 },
    city: 'Lake Whitney Dam',
    state: 'TX',
    county: 'Hill County',
    region: 'Brazos Hydropower Corridor',
    gridOperator: 'ERCOT',
    timezone: 'America/Chicago',
    searchRadius: 4500,
    businessContext: 'Lake Whitney Dam hydropower, recreation, and tailrace monitoring',
    dataCenterCompany: 'USACE',
    facilityName: 'Lake Whitney Dam AOI'
  },

  lake_whitney_lakeside: {
    coordinates: { lat: 31.98, lng: -97.405 },
    city: 'Lakeside Village',
    state: 'TX',
    county: 'Hill County',
    region: 'Lake Whitney North Shore',
    gridOperator: 'ERCOT',
    timezone: 'America/Chicago',
    searchRadius: 4500,
    businessContext: 'Lakeside Village shoreline and marina monitoring',
    dataCenterCompany: 'N/A',
    facilityName: 'Lakeside Village Circular AOI'
  },

  austin: {
    coordinates: { lat: 30.2672, lng: -97.7431 },
    city: 'Austin',
    state: 'TX',
    county: 'Travis County',
    region: 'Central Texas',
    gridOperator: 'ERCOT',
    timezone: 'America/Chicago',
    searchRadius: 10000,
    businessContext: 'Austin, TX Metro Area Analysis',
    dataCenterCompany: 'Generic',
    facilityName: 'Austin Metro Innovation Hub'
  },

  memphis: {
    coordinates: { lat: 35.1495, lng: -90.0489 },
    city: 'Memphis',
    state: 'TN',
    county: 'Shelby County',
    region: 'Mid-South',
    gridOperator: 'TVA',
    timezone: 'America/Chicago',
    searchRadius: 10000,
    businessContext: 'Memphis, TN Metro Area Analysis',
    dataCenterCompany: 'Generic',
    facilityName: 'Memphis Metro Innovation Hub'
  },

  // Legacy configuration (Pinal County, AZ - Regional Development)
  pinal_county: {
    coordinates: { lat: 32.9043, lng: -111.3447 },
    city: 'Pinal County',
    state: 'AZ',
    county: 'Pinal County',
    region: 'Central Arizona',
    gridOperator: 'APS',
    timezone: 'America/Phoenix',
    searchRadius: 10000,
    businessContext: 'Pinal County Regional Development Analysis',
    dataCenterCompany: 'Generic',
    facilityName: 'Pinal County Innovation Hub'
  },

  tsmc_phoenix: {
    coordinates: { lat: 33.75, lng: -112.25 }, // 5088 W Innovation Circle, Phoenix, AZ 85083
    city: 'Phoenix',
    state: 'AZ',
    county: 'Maricopa County',
    region: 'Phoenix Metro',
    gridOperator: 'APS',
    timezone: 'America/Phoenix',
    searchRadius: 40234, // 25 miles in meters
    businessContext: 'TSMC Phoenix Semiconductor Manufacturing Analysis',
    dataCenterCompany: 'TSMC',
    facilityName: 'TSMC Arizona Fab'
  },

  seattle: {
    coordinates: { lat: 47.6062, lng: -122.3321 },
    city: 'Seattle',
    state: 'WA',
    county: 'King County',
    region: 'Pacific Northwest',
    gridOperator: 'BPA',
    timezone: 'America/Los_Angeles',
    searchRadius: 5000, // 5km for dense urban startup mapping
    businessContext: 'Seattle Startup Ecosystem Analysis',
    dataCenterCompany: 'Generic',
    facilityName: 'Seattle Innovation Hub'
  },

  boston: {
    coordinates: { lat: 42.3601, lng: -71.0589 },
    city: 'Boston',
    state: 'MA',
    county: 'Suffolk County',
    region: 'New England',
    gridOperator: 'ISO-NE',
    timezone: 'America/New_York',
    searchRadius: 5000,
    businessContext: 'Boston Startup Ecosystem Analysis',
    dataCenterCompany: 'Generic',
    facilityName: 'Boston Innovation Hub'
  },

  toyota_battery_nc: {
    coordinates: { lat: 35.88, lng: -79.57 },
    city: 'Liberty',
    state: 'NC',
    county: 'Randolph County',
    region: 'Greensboro-Randolph Megasite',
    gridOperator: 'Duke Energy',
    timezone: 'America/New_York',
    searchRadius: 12000,
    businessContext: 'Toyota Battery Manufacturing NC utility infrastructure analysis',
    dataCenterCompany: 'Toyota / Panasonic',
    facilityName: 'Toyota Battery Manufacturing North Carolina'
  },

  vinfast_nc: {
    coordinates: { lat: 35.62, lng: -79.08 },
    city: 'Moncure',
    state: 'NC',
    county: 'Chatham County',
    region: 'Triangle Innovation Point',
    gridOperator: 'Duke Energy',
    timezone: 'America/New_York',
    searchRadius: 11000,
    businessContext: 'VinFast EV campus utility infrastructure analysis',
    dataCenterCompany: 'VinFast',
    facilityName: 'VinFast EV Manufacturing Campus'
  },

  wolfspeed_nc: {
    coordinates: { lat: 35.72, lng: -79.49 },
    city: 'Siler City',
    state: 'NC',
    county: 'Chatham County',
    region: 'Chatham-Siler City Advanced Manufacturing Site',
    gridOperator: 'Duke Energy',
    timezone: 'America/New_York',
    searchRadius: 10000,
    businessContext: 'Wolfspeed silicon carbide fab utility infrastructure analysis',
    dataCenterCompany: 'Wolfspeed',
    facilityName: 'Wolfspeed Siler City Campus'
  },

  harris_nc: {
    coordinates: { lat: 35.6506, lng: -78.9531 },
    city: 'New Hill',
    state: 'NC',
    county: 'Wake & Chatham Counties',
    region: 'Shearon Harris Nuclear Energy Complex',
    gridOperator: 'Duke Energy Progress',
    timezone: 'America/New_York',
    searchRadius: 12000,
    businessContext: 'Shearon Harris Nuclear Power Plant grid and cooling infrastructure analysis',
    dataCenterCompany: 'Duke Energy',
    facilityName: 'Shearon Harris Nuclear Power Plant'
  },

  three_mile_island_pa: {
    coordinates: { lat: 40.1500, lng: -76.7300 },
    city: 'Three Mile Island',
    state: 'PA',
    county: 'Dauphin County',
    region: 'Middletown, PA',
    gridOperator: 'PJM',
    timezone: 'America/New_York',
    searchRadius: 25000,
    businessContext: 'Three Mile Island Nuclear Plant infrastructure analysis',
    dataCenterCompany: 'Constellation Energy',
    facilityName: 'Three Mile Island Nuclear Plant'
  },

  susquehanna_nuclear_pa: {
    coordinates: { lat: 41.1000, lng: -76.1500 },
    city: 'Susquehanna Nuclear',
    state: 'PA',
    county: 'Luzerne County',
    region: 'Berwick, PA',
    gridOperator: 'PJM',
    timezone: 'America/New_York',
    searchRadius: 25000,
    businessContext: 'Susquehanna Steam Electric Station infrastructure analysis',
    dataCenterCompany: 'Talen Energy',
    facilityName: 'Susquehanna Steam Electric Station'
  }
};

/**
 * Get geographic configuration for a specific location
 * @param {string} locationKey - The location key (default, austin, dallas, etc.)
 * @returns {Object} Geographic configuration object
 */
export const getGeographicConfig = (locationKey = 'texas') => {
  return GEOGRAPHIC_CONFIG[locationKey] || GEOGRAPHIC_CONFIG.texas;
};

/**
 * Get all available locations
 * @returns {Array} Array of location objects with key, city, state
 */
export const getAvailableLocations = () => {
  return Object.entries(GEOGRAPHIC_CONFIG).map(([key, config]) => ({
    key,
    city: config.city,
    state: config.state,
    region: config.region,
    gridOperator: config.gridOperator
  }));
};

/**
 * Validate if a location key exists
 * @param {string} locationKey - The location key to validate
 * @returns {boolean} True if location exists
 */
export const isValidLocation = (locationKey) => {
  return locationKey in GEOGRAPHIC_CONFIG;
};

/**
 * Get location display name
 * @param {string} locationKey - The location key
 * @returns {string} Display name (e.g., "Whitney, TX")
 */
export const getLocationDisplayName = (locationKey) => {
  const config = getGeographicConfig(locationKey);
  return config.state ? `${config.city}, ${config.state}` : config.city;
};

/**
 * Get location-specific search queries
 * @param {string} locationKey - The location key
 * @returns {Array} Array of search queries for the location
 */
export const getLocationQueries = (locationKey) => {
  const config = getGeographicConfig(locationKey);
  const { city, state, county, region } = config;
  
  return [
    `startups ${city} ${state}`,
    `venture capital ${city} ${state}`,
    `tech companies ${county} ${state}`,
    `innovation hubs ${city} ${state}`,
    `startup ecosystem ${region}`,
    `coworking spaces ${city} ${state}`
  ];
};
