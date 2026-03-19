/**
 * Configuration for AI Transmission Navigation system
 * Defines which layers are relevant for transmission analysis and their groupings
 */

// Define transmission-relevant layer groups
export const TRANSMISSION_LAYER_GROUPS = {
  POWER_GENERATION: {
    label: 'Power Generation',
    layers: ['showKeyInfrastructure', 'showSupply'],
    icon: '⚡',
    color: '#FFD600'
  },
  DEMAND_CENTERS: {
    label: 'Demand Centers', 
    layers: ['showDataCenters', 'showDemand'],
    icon: '🏭',
    color: '#FF7043'
  },
  TRANSMISSION_LINES: {
    label: 'Transmission Network',
    layers: ['showTransportation', 'showRoads'],
    icon: '🔌',
    color: '#4FC3F7'
  },
  WATER_RESOURCES: {
    label: 'Water Resources',
    layers: ['showWater', 'showAquiferZones', 'showNewMajorAquifers', 'showTWDBGroundwater'],
    icon: '💧',
    color: '#00E676'
  },
  ENVIRONMENTAL: {
    label: 'Environmental',
    layers: ['showParks', 'showHUC8Subbasin'],
    icon: '🌲',
    color: '#8D6E63'
  },
  LAND_USE: {
    label: 'Land Use & Planning',
    layers: ['showBlocks', 'showBlockFill', 'showSources'],
    icon: '🗺️',
    color: '#AB47BC'
  }
};

// Pre-defined transmission analysis scenes
export const TRANSMISSION_SCENE_TEMPLATES = {
  OVERVIEW: {
    name: 'Transmission Overview',
    description: 'High-level view of generation, transmission, and demand',
    layerState: {
      showKeyInfrastructure: true,
      showDataCenters: true,
      showTransportation: true,
      showSupply: true,
      showDemand: true,
      // Turn off less relevant layers
      showParks: false,
      showBlocks: false,
      showBlockFill: false,
      showWater: false,
      showAquiferZones: false,
      showNewMajorAquifers: false,
      showHUC8Subbasin: false,
      showTWDBGroundwater: false,
      showSources: false
    },
    camera: {
      zoom: 6,
      center: { lng: -99.9, lat: 31.5 }, // Central Texas
      pitch: 0,
      bearing: 0
    }
  },
  
  GENERATION_FOCUS: {
    name: 'Power Generation Analysis',
    description: 'Focus on generation assets and supply capabilities',
    layerState: {
      showKeyInfrastructure: true,
      showSupply: true,
      showWater: true, // Water needed for power plants
      showAquiferZones: true,
      showNewMajorAquifers: true,
      showTWDBGroundwater: true,
      // Reduce other layers
      showDataCenters: false,
      showDemand: false,
      showTransportation: false,
      showParks: false,
      showBlocks: false,
      showBlockFill: false,
      showHUC8Subbasin: false,
      showSources: false
    }
  },

  DEMAND_ANALYSIS: {
    name: 'Demand Center Analysis', 
    description: 'Focus on load centers and consumption patterns',
    layerState: {
      showDataCenters: true,
      showDemand: true,
      showBlocks: true, // Population density
      showBlockFill: true,
      showTransportation: true, // Access to demand centers
      // Reduce generation focus
      showKeyInfrastructure: false,
      showSupply: false,
      showWater: false,
      showAquiferZones: false,
      showNewMajorAquifers: false,
      showTWDBGroundwater: false,
      showParks: false,
      showHUC8Subbasin: false,
      showSources: false
    }
  },

  TRANSMISSION_CORRIDORS: {
    name: 'Transmission Corridors',
    description: 'Focus on transmission paths and infrastructure',
    layerState: {
      showTransportation: true,
      showRoads: true,
      showKeyInfrastructure: true, // Substations
      showParks: true, // Environmental constraints
      showHUC8Subbasin: true,
      showSources: true, // Planning documents
      // Reduce demand/supply detail
      showDataCenters: false,
      showDemand: false,
      showSupply: false,
      showWater: false,
      showAquiferZones: false,
      showNewMajorAquifers: false,
      showTWDBGroundwater: false,
      showBlocks: false,
      showBlockFill: false
    }
  },

  WATER_CONSTRAINTS: {
    name: 'Water Resource Constraints',
    description: 'Analyze water availability for power generation',
    layerState: {
      showWater: true,
      showAquiferZones: true,
      showNewMajorAquifers: true,
      showTWDBGroundwater: true,
      showHUC8Subbasin: true,
      showKeyInfrastructure: true, // Power plants need water
      showSupply: true,
      // Turn off less relevant
      showDataCenters: false,
      showDemand: false,
      showTransportation: false,
      showParks: false,
      showBlocks: false,
      showBlockFill: false,
      showSources: false
    }
  },

  ENVIRONMENTAL_IMPACT: {
    name: 'Environmental Impact Assessment',
    description: 'Environmental and land use considerations',
    layerState: {
      showParks: true,
      showHUC8Subbasin: true,
      showNewMajorAquifers: true,
      showSources: true, // Planning documents
      showKeyInfrastructure: true,
      showTransportation: true,
      // Reduce operational layers
      showDataCenters: false,
      showDemand: false,
      showSupply: false,
      showWater: false,
      showAquiferZones: false,
      showTWDBGroundwater: false,
      showBlocks: false,
      showBlockFill: false
    }
  }
};

// AI Navigation prompts and scene transitions
export const AI_NAV_PROMPTS = {
  SCENE_TRANSITIONS: {
    'overview': () => TRANSMISSION_SCENE_TEMPLATES.OVERVIEW,
    'generation': () => TRANSMISSION_SCENE_TEMPLATES.GENERATION_FOCUS, 
    'demand': () => TRANSMISSION_SCENE_TEMPLATES.DEMAND_ANALYSIS,
    'transmission': () => TRANSMISSION_SCENE_TEMPLATES.TRANSMISSION_CORRIDORS,
    'corridors': () => TRANSMISSION_SCENE_TEMPLATES.TRANSMISSION_CORRIDORS,
    'water': () => TRANSMISSION_SCENE_TEMPLATES.WATER_CONSTRAINTS,
    'environmental': () => TRANSMISSION_SCENE_TEMPLATES.ENVIRONMENTAL_IMPACT,
    'constraints': () => TRANSMISSION_SCENE_TEMPLATES.ENVIRONMENTAL_IMPACT
  },
  
  ANALYSIS_WORKFLOWS: [
    {
      name: 'Full Transmission Analysis',
      description: 'Complete workflow covering all aspects',
      scenes: ['OVERVIEW', 'GENERATION_FOCUS', 'DEMAND_ANALYSIS', 'TRANSMISSION_CORRIDORS', 'WATER_CONSTRAINTS', 'ENVIRONMENTAL_IMPACT'],
      duration: 1500 // ms between scenes
    },
    {
      name: 'Generation Planning',
      description: 'Focus on generation siting and water resources',
      scenes: ['GENERATION_FOCUS', 'WATER_CONSTRAINTS', 'ENVIRONMENTAL_IMPACT'],
      duration: 2000
    },
    {
      name: 'Load Analysis',
      description: 'Demand center and transmission access analysis',
      scenes: ['DEMAND_ANALYSIS', 'TRANSMISSION_CORRIDORS'],
      duration: 2000
    },
    {
      name: 'Environmental Planning',
      description: 'Environmental constraints and land use planning',
      scenes: ['ENVIRONMENTAL_IMPACT', 'WATER_CONSTRAINTS'],
      duration: 1800
    },
    {
      name: 'Infrastructure Siting',
      description: 'Optimal siting for new transmission infrastructure',
      scenes: ['OVERVIEW', 'TRANSMISSION_CORRIDORS', 'ENVIRONMENTAL_IMPACT'],
      duration: 2200
    }
  ]
};

// Data sources specific to transmission analysis
export const TRANSMISSION_DATA_SOURCES = {
  powerPlants: '/data/key_infrastructure_howard_solstice.json',
  dataCenters: '/data/data_centers.json', 
  transmissionLines: '/data/transmission_lines.json',
  substations: '/data/substations.json',
  waterResources: '/data/water_resources.json',
  aquifers: '/data/aquifers.json',
  demandCenters: '/data/demand_centers.json',
  planningDocs: '/processed_planning_docs/'
};

// Export main configuration object
export const TRANSMISSION_CONFIG = {
  layerGroups: TRANSMISSION_LAYER_GROUPS,
  sceneTemplates: TRANSMISSION_SCENE_TEMPLATES,
  aiPrompts: AI_NAV_PROMPTS,
  dataSources: TRANSMISSION_DATA_SOURCES,
  storageKey: 'transmissionScenes_v1',
  title: 'AI Transmission Navigator'
}; 