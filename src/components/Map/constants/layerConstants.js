export const COLORS = {
  roads: '#4A90E2',      // Blue
  publicTransit: '#9B59B6', // Purple
  bikeInfra: '#2ECC71',    // Green
  pedestrian: '#E67E22',    // Orange
  default: '#666666',        // Default gray color
  transit: '#9B59B6',  // Purple
  bike: '#2ECC71',     // Green
  dataCenter: '#00FF00',  // Bright green for data centers
  demand: '#FF2222',      // Bright red for demand layer
  supply: '#00CC66',       // Green for supply layer
  water: '#0099FF',        // Bright blue for water layer
  // Startup ecosystem colors
  startups: '#10b981',     // Green for startups
  investors: '#f59e0b',    // Orange for investors
  coWorking: '#8b5cf6',    // Purple for co-working
  universities: '#ef4444', // Red for universities
  offices: '#3b82f6',      // Blue for offices
  services: '#06b6d4',     // Cyan for services
  corporate: '#6b7280'     // Gray for corporate
};

export const TRANSPORTATION_CATEGORIES = {
  roads: ['road-simple', 'bridge-simple', 'tunnel-simple', 'road-label-simple']
};

export const ZONING_LAYER_IDS = [
  'zoning-fill',
  'zoning-outline',
  'zoning-hover',
  'zoning-inner-glow',
  'zoning-hover-glow'
];

export const DEFAULT_EXPANDED_CATEGORIES = {
  publicTransit: true,
  bikeNetwork: true,
  pedestrianNetwork: true,
  transportation: true,
  planning: true,
  parks: true,
  employment: true,
  neighborhoods: true,
  localZones: true,
  // Startup ecosystem categories
  startups: true,
  investors: true,
  coWorking: true,
  universities: true,
  offices: true,
  services: true,
  corporate: true
};

// Startup ecosystem layer configuration
export const STARTUP_ECOSYSTEM_LAYERS = {
  startups: {
    id: 'startup-companies',
    type: 'circle',
    paint: {
      'circle-radius': 8,
      'circle-color': '#10b981',
      'circle-stroke-width': 0, // No white border
      'circle-opacity': 0.8
    }
  },
  investors: {
    id: 'investors-vcs',
    type: 'circle',
    paint: {
      'circle-radius': 10,
      'circle-color': '#f59e0b',
      'circle-stroke-width': 0, // No white border
      'circle-opacity': 0.8
    }
  },
  coWorking: {
    id: 'co-working-spaces',
    type: 'circle',
    paint: {
      'circle-radius': 7,
      'circle-color': '#8b5cf6',
      'circle-stroke-width': 0, // No white border
      'circle-opacity': 0.8
    }
  },
  universities: {
    id: 'universities-research',
    type: 'circle',
    paint: {
      'circle-radius': 9,
      'circle-color': '#ef4444',
      'circle-stroke-width': 0, // No white border
      'circle-opacity': 0.8
    }
  },
  offices: {
    id: 'office-buildings',
    type: 'circle',
    paint: {
      'circle-radius': 6,
      'circle-color': '#3b82f6',
      'circle-stroke-width': 0, // No white border
      'circle-opacity': 0.8
    }
  },
  services: {
    id: 'professional-services',
    type: 'circle',
    paint: {
      'circle-radius': 5,
      'circle-color': '#06b6d4',
      'circle-stroke-width': 0, // No white border
      'circle-opacity': 0.8
    }
  },
  corporate: {
    id: 'corporate-innovation',
    type: 'circle',
    paint: {
      'circle-radius': 8,
      'circle-color': '#6b7280',
      'circle-stroke-width': 0, // No white border
      'circle-opacity': 0.8
    }
  }
}; 