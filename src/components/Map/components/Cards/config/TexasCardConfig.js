import cardFactory from '../factory/CardFactory';

// Texas-specific card configurations centered around Whitney, TX
// Whitney coordinates: 31.950° N, 97.320° W
const WHITNEY_COORDS = { lat: 31.950, lng: -97.320 };

// Nearby cities and points of interest
const NEARBY_LOCATIONS = {
  whitney: { lat: 31.950, lng: -97.320 },
  waco: { lat: 31.5493, lng: -97.1467 },
  fortWorth: { lat: 32.7555, lng: -97.3308 },
  dallas: { lat: 32.7767, lng: -96.7970 },
  austin: { lat: 30.2672, lng: -97.7431 },
  sanAntonio: { lat: 29.4241, lng: -98.4936 },
  houston: { lat: 29.7604, lng: -95.3698 }
};

const TEXAS_CARD_CONFIGS = {
  // Scene 0: Texas Grid Overview (centered on Whitney)
  'scene-0': [
    {
      id: 'texas-grid-overview-card',
      title: 'Texas Power Grid Overview',
      position: { lng: 400, lat: 300 }, // Centered on viewport
      nextSceneId: 'scene-1',
      content: {
        description: 'The **Texas power grid** serves over **29 million people** across **268,000 square miles**. **Whitney, TX** serves as a strategic central hub connecting major metropolitan areas and renewable energy zones.',
        data: {
          'Grid Coverage': '268,000 sq mi',
          'Population': '29.1M people',
          'Census Blocks': '914,231',
          'Central Hub': 'Whitney, TX'
        }
      },
      style: { 
        priority: 1,
        borderColor: '#dc2626'
      }
    }
  ],

  // Scene 1: Generation Planning (Howard-Solstice Project)
  'scene-1': [
    {
      id: 'howard-solstice-project-card',
      title: 'Howard-Solstice Project',
      position: { lng: 400, lat: 300 },
      nextSceneId: 'scene-2',
      content: {
        description: 'The **Howard-Solstice Transmission Line** is a 765-kV power line project connecting the Permian Basin to Central Texas, enhancing grid reliability.',
        data: {
          'Voltage': '765 kV',
          'Length': '300 miles',
          'Operator': 'AEP Texas',
          'Region': 'Permian Basin'
        }
      },
      style: { 
        priority: 1,
        borderColor: '#f59e0b'
      }
    }
  ],

  // Scene 2: Load Analysis (Central Texas)
  'scene-2': [
    {
      id: 'central-texas-load-card',
      title: 'Central Texas Load Centers',
      position: { lng: 400, lat: 300 },
      nextSceneId: 'scene-3',
      content: {
        description: 'Central Texas serves as a major load center with **Waco, Fort Worth, and Dallas** forming a high-demand triangle.',
        data: {
          'Peak Load': '75,000 MW',
          'Growth Rate': '3.2% annually',
          'Major Cities': '3',
          'Critical Areas': '5 identified'
        }
      },
      style: { 
        priority: 1,
        borderColor: '#4caf50'
      }
    }
  ],

  // Scene 3: Environmental Planning (Ozona area)
  'scene-3': [
    {
      id: 'environmental-assessment-card',
      title: 'Environmental Assessment',
      position: { lng: 400, lat: 300 },
      nextSceneId: 'scene-4',
      content: {
        description: 'Environmental impact assessment for transmission development with focus on **protected areas** and **wildlife corridors** in West Texas.',
        data: {
          'Study Focus': 'Environmental Impact',
          'Protected Areas': '15 locations',
          'Wildlife Corridors': '8 identified',
          'Mitigation Cost': '$50M estimated'
        }
      },
      style: { 
        priority: 1,
        borderColor: '#4caf50'
      }
    }
  ],

  // Scene 4: Infrastructure Siting (Fort Stockton area)
  'scene-4': [
    {
      id: 'infrastructure-siting-card',
      title: 'Infrastructure Siting Analysis',
      position: { lng: 50, lat: 100 },
      nextSceneId: 'scene-0',
      content: {
        description: 'Optimal siting analysis for new transmission infrastructure including **substations**, **transmission lines**, and **interconnection facilities**.',
        data: {
          'Siting Focus': 'Transmission Infrastructure',
          'Voltage Level': '345 kV',
          'Corridor Length': '500+ miles',
          'Construction Timeline': '3-5 years'
        }
      },
      style: { 
        priority: 1,
        borderColor: '#f59e0b'
      }
    }
  ]
};

// Legacy configurations for backward compatibility
const LEGACY_CARD_CONFIGS = {
  'transmission-overview': [
    {
      id: 'overview-card-1',
      title: 'Texas Transmission Overview',
      position: { lng: 400, lat: 300 },
      nextSceneId: 'generation-focus',
      content: {
        data: {
          'Transmission Lines': '40,000+ miles',
          'Generation Capacity': '85,000 MW',
          'Peak Demand': '75,000 MW',
          'Grid Reliability': '99.7%'
        },
        description: 'Comprehensive overview of Texas transmission infrastructure and capacity.'
      },
      style: { 
        priority: 1,
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        borderColor: '#4caf50'
      }
    }
  ]
};

// Merge all configurations
const ALL_CARD_CONFIGS = {
  ...TEXAS_CARD_CONFIGS,
  ...LEGACY_CARD_CONFIGS
};

// Export functions
export const getTexasCardsForScene = (sceneId) => {
  return ALL_CARD_CONFIGS[sceneId] || [];
};

export const getTexasSceneIds = () => {
  return Object.keys(ALL_CARD_CONFIGS);
};

export const createTexasCard = (templateName, overrides = {}) => {
  return cardFactory.createFromTemplate(`texas-${templateName}`, overrides);
};

export const getCardsForScene = getTexasCardsForScene; // Backward compatibility

export const getAvailableSceneIds = getTexasSceneIds; // Backward compatibility

// Register Texas-specific templates
cardFactory.registerTemplate('texas-overview', {
  type: 'scene',
  style: {
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderColor: '#dc2626'
  }
});

cardFactory.registerTemplate('texas-energy', {
  type: 'scene',
  style: {
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderColor: '#f59e0b'
  }
});

cardFactory.registerTemplate('texas-environment', {
  type: 'scene',
  style: {
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderColor: '#10b981'
  }
});

export default ALL_CARD_CONFIGS;
