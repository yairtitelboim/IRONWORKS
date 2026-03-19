// Whitney, TX analysis constants

export const WHITNEY_SITES = [
  {
    id: 'whitney-data-center',
    name: 'Whitney Data Center Campus',
    city: 'Whitney',
    state: 'TX',
    lat: 31.9315,
    lng: -97.347,
    provider: 'Data Center Infrastructure',
    confidence: 0.95,
    lastVerified: new Date().toISOString(),
    provenanceURLs: []
  },
  {
    id: 'whitney-downtown',
    name: 'Whitney Downtown Core',
    city: 'Whitney',
    state: 'TX',
    lat: 31.951,
    lng: -97.323,
    provider: 'Civic Center',
    confidence: 0.95,
    lastVerified: new Date().toISOString(),
    provenanceURLs: []
  },
  {
    id: 'lake-whitney-gateway',
    name: 'Lake Whitney Gateway',
    city: 'Whitney',
    state: 'TX',
    lat: 31.857,
    lng: -97.402,
    provider: 'Recreation & Tourism',
    confidence: 0.95,
    lastVerified: new Date().toISOString(),
    provenanceURLs: []
  },
  {
    id: 'whitney-power-facility',
    name: 'Whitney Power Infrastructure',
    city: 'Whitney',
    state: 'TX',
    lat: 31.93,
    lng: -97.35,
    provider: 'Power Infrastructure',
    confidence: 0.90,
    lastVerified: new Date().toISOString(),
    provenanceURLs: []
  }
];

export const WHITNEY_ZONES = {
  data_center: {
    lat: 31.9315,
    lng: -97.347,
    name: 'Whitney Data Center Campus',
    radius: 1200,
    focus: 'Primary data center development zone'
  },
  downtown: {
    lat: 31.951,
    lng: -97.323,
    name: 'Whitney Downtown Core',
    radius: 1500,
    focus: 'Civic center, services, and growth corridor'
  },
  lake_whitney: {
    lat: 31.857,
    lng: -97.402,
    name: 'Lake Whitney Gateway',
    radius: 2000,
    focus: 'Recreation, tourism, and hydropower assets'
  }
};

export const CACHE_KEY = 'whitney_infrastructure_analysis';
export const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
