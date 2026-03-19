/**
 * North Carolina Power & Utility Infrastructure Sites
 * Defines metadata for local OSM cache files that describe
 * power, water, and utility infrastructure around the state's
 * strategic megaproject locations.
 */

export const NC_POWER_SITES = [
  {
    key: 'toyota_battery_nc',
    name: 'Toyota Battery Manufacturing North Carolina',
    shortName: 'Toyota Battery NC',
    dataPath: '/osm/nc_power_toyota_battery_nc.json',
    coordinates: { lat: 35.85347, lng: -79.57169 },
    radiusMeters: 12000,
    color: '#0ea5e9',
    highlightColor: '#38bdf8',
    description: 'Liberty, NC Greensboro-Randolph Megasite – EV battery manufacturing campus.'
  },
  {
    key: 'vinfast_nc',
    name: 'VinFast EV Manufacturing Campus',
    shortName: 'VinFast NC',
    dataPath: '/osm/nc_power_vinfast_nc.json',
    coordinates: { lat: 35.62, lng: -79.08 },
    radiusMeters: 11000,
    color: '#f97316',
    highlightColor: '#fb923c',
    description: 'Triangle Innovation Point, Moncure, NC – VinFast EV assembly facility.'
  },
  {
    key: 'wolfspeed_nc',
    name: 'Wolfspeed Silicon Carbide Fab',
    shortName: 'Wolfspeed NC',
    dataPath: '/osm/nc_power_wolfspeed_nc.json',
    coordinates: { lat: 35.72, lng: -79.49 },
    radiusMeters: 10000,
    color: '#a855f7',
    highlightColor: '#c084fc',
    description: 'Chatham-Siler City Advanced Manufacturing Site – $5B semiconductor fab.'
  },
  {
    key: 'raleigh_grid',
    name: 'Raleigh Grid Resiliency Hub',
    shortName: 'Raleigh Grid',
    dataPath: '/osm/nc_power_raleigh_grid.json',
    coordinates: { lat: 35.7796, lng: -78.6382 },
    radiusMeters: 9000,
    color: '#3b82f6',
    highlightColor: '#60a5fa',
    description: 'Downtown Raleigh government & utility coordination district.'
  },
  {
    key: 'greensboro_grid',
    name: 'Greensboro Infrastructure Core',
    shortName: 'Greensboro Core',
    dataPath: '/osm/nc_power_greensboro_grid.json',
    coordinates: { lat: 36.0726, lng: -79.792 },
    radiusMeters: 9000,
    color: '#22d3ee',
    highlightColor: '#38e1ff',
    description: 'Downtown Greensboro civic, utility, and grid resiliency hub.'
  },
  {
    key: 'harris_nc',
    name: 'Shearon Harris Nuclear Power Plant',
    shortName: 'Harris Nuclear',
    dataPath: '/osm/nc_power_harris_nc.json',
    coordinates: { lat: 35.6506, lng: -78.9531 },
    radiusMeters: 12000,
    color: '#14b8a6',
    highlightColor: '#2dd4bf',
    description: 'New Hill, NC – Nuclear plant, switchyard, and cooling reservoir infrastructure.'
  },
  {
    key: 'three_mile_island_pa',
    name: 'Three Mile Island Nuclear Plant',
    shortName: 'Three Mile Island',
    // Placeholder path; PA OSM script will generate this cache
    dataPath: '/osm/pa_nuclear_tmi.json',
    coordinates: { lat: 40.1500, lng: -76.7300 },
    radiusMeters: 25000, // ~25 km regional radius for MCP searches
    color: '#f97316',
    highlightColor: '#fdba74',
    description: 'Middletown, PA – Nuclear plant supplying grid power via PPA (Microsoft/Constellation model).'
  },
  {
    key: 'susquehanna_nuclear_pa',
    name: 'Susquehanna Steam Electric Station',
    shortName: 'Susquehanna Nuclear',
    dataPath: '/osm/pa_nuclear_susquehanna.json',
    coordinates: { lat: 41.1000, lng: -76.1500 },
    radiusMeters: 25000,
    color: '#22c55e',
    highlightColor: '#4ade80',
    description: 'Berwick, PA – Nuclear plant with adjacent $650M Amazon data center campus (behind-the-meter model).'
  },
  {
    key: 'tsmc_phoenix',
    name: 'TSMC Arizona Semiconductor Fab Complex',
    shortName: 'TSMC Phoenix',
    dataPath: '/osm/nc_power_tsmc_phoenix.json',
    coordinates: { lat: 33.7250, lng: -112.1667 }, // 43rd Ave & Dove Valley Rd, North Phoenix, AZ
    radiusMeters: 40234, // 25 miles in meters
    color: '#3b82f6',
    highlightColor: '#60a5fa',
    description: 'Phoenix, AZ – $165B semiconductor fab complex (6 fabs planned, 17,200 gal/day water need, gap: 5,800 gal/day = 6,500 AF/year).'
  },
  {
    key: 'tsmc_phoenix_water',
    name: 'TSMC Phoenix Water Infrastructure',
    shortName: 'TSMC Water',
    dataPath: '/osm/nc_power_tsmc_phoenix_water.json',
    coordinates: { lat: 33.4484, lng: -112.0740 },
    radiusMeters: 12000,
    color: '#06b6d4',
    highlightColor: '#22d3ee',
    description: 'Phoenix, AZ – Municipal water allocation (11.4M gal/day) and reclamation infrastructure.'
  },
  {
    key: 'amkor_technology_phoenix',
    name: 'Amkor Technology Advanced Packaging & Test Facility',
    shortName: 'Amkor Technology',
    dataPath: '/osm/nc_power_amkor_phoenix.json',
    coordinates: { lat: 33.7100, lng: -112.2800 },
    radiusMeters: 8000,
    color: '#8b5cf6',
    highlightColor: '#a78bfa',
    description: 'Peoria, AZ – $7B advanced packaging & test facility. Water need: ~2,500 AF/year.'
  },
  {
    key: 'intel_ocotillo_chandler',
    name: 'Intel Ocotillo Campus',
    shortName: 'Intel Ocotillo',
    dataPath: '/osm/nc_power_intel_ocotillo.json',
    coordinates: { lat: 33.2431, lng: -111.8844 },
    radiusMeters: 10000,
    color: '#0ea5e9',
    highlightColor: '#38bdf8',
    description: 'Chandler, AZ – $50B+ semiconductor fab complex (Fab 12, 22, 32, 52, 62). Water need: ~3,000 AF/year. Has 12-acre on-site reclamation facility (9M gal/day capacity).'
  },
  {
    key: 'nxp_semiconductors_chandler',
    name: 'NXP Semiconductors Fab Complex',
    shortName: 'NXP Semiconductors',
    dataPath: '/osm/nc_power_nxp_chandler.json',
    coordinates: { lat: 33.3260, lng: -111.8617 },
    radiusMeters: 7000,
    color: '#ec4899',
    highlightColor: '#f472b6',
    description: 'Chandler, AZ – Semiconductor fab complex (2 fabs, 30+ years operations). Water need: ~1,500 AF/year.'
  },
  {
    key: 'linde_industrial_gas_phoenix',
    name: 'Linde Industrial Gas Plant',
    shortName: 'Linde Gas Plant',
    dataPath: '/osm/nc_power_linde_phoenix.json',
    coordinates: { lat: 33.7200, lng: -112.1650 },
    radiusMeters: 5000,
    color: '#10b981',
    highlightColor: '#34d399',
    description: 'North Phoenix, AZ – $600M on-site industrial gas supply (N₂, O₂, Ar) for TSMC operations. Adjacent to TSMC campus.'
  },
  {
    key: 'halo_vista_phoenix',
    name: 'Halo Vista Development',
    shortName: 'Halo Vista',
    dataPath: '/osm/nc_power_halo_vista.json',
    coordinates: { lat: 33.7150, lng: -112.1600 },
    radiusMeters: 15000,
    color: '#f59e0b',
    highlightColor: '#fbbf24',
    description: 'Phoenix, AZ – $7B mixed-use ecosystem (2,300 acres). Industrial, residential, retail, office. Water need: ~2,000 AF/year. NW corner I-17 & Loop 303.'
  },
  {
    key: 'cibola_az',
    name: 'Cibola, Arizona',
    shortName: 'Cibola AZ',
    dataPath: '/osm/nc_power_cibola_az.json',
    coordinates: { lat: 33.3164, lng: -114.665 },
    radiusMeters: 16093, // 10 miles in meters
    color: '#8b5cf6',
    highlightColor: '#a78bfa',
    description: 'Cibola, AZ – Infrastructure area covering power, water, and utility infrastructure within 10-mile radius.'
  },
  {
    key: 'arizona_utility_connections',
    name: 'Arizona Utility Connections',
    shortName: 'AZ Connections',
    dataPath: '/osm/nc_power_arizona_utility_connections.json',
    coordinates: { lat: 33.5, lng: -113.0 }, // Center point between Cibola and Phoenix
    radiusMeters: 0, // Not a radius-based query
    color: '#ef4444',
    highlightColor: '#f87171',
    description: 'Major power transmission lines, pipelines, and water infrastructure connecting Cibola, AZ to Phoenix-area semiconductor sites.'
  }
];

export const NC_POWER_SITE_KEYS = new Set(NC_POWER_SITES.map(site => site.key));

export const getNcPowerSiteByKey = (key) => {
  return NC_POWER_SITES.find(site => site.key === key) || null;
};

export const isNcPowerLocation = (locationKey) => NC_POWER_SITE_KEYS.has(locationKey);
