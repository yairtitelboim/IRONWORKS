// Whitney, TX analysis constants

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
