// Dynamic card configurations for scenes
// Each scene ID can have multiple associated cards

const CARD_CONFIGS = {
  // Workflow 0: Texas Grid Overview (Scene 0)
  'scene-0': [
    {
      id: 'texas-grid-overview-card',
      title: 'Texas Census Data',
      position: { lat: 31.0, lng: -100.0 },
      nextSceneId: 'scene-1',
      content: {
        description: 'Texas has **914,231** census blocks, according to Census.gov. In addition to census blocks, Texas also has **5,265** census tracts and **15,811** block groups.'
      },
      style: { 
        priority: 1,
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        borderColor: '#dc2626'
      }
    }
  ],

  // Workflow 1: Generation Planning (Scene 1)
  'scene-1': [
    {
      id: 'generation-planning-card',
      title: 'Howard-Solstice Project',
      position: { lat: 32.8, lng: -98.8 },
      nextSceneId: 'scene-2',
      content: {
        data: {
          'Voltage': '765 kV',
          'Length': '300 miles',
          'Operator': 'AEP Texas',
          'Region': 'Permian Basin'
        },
        description: 'The Howard-Solstice Transmission Line Project is a 765-kV power line project in Texas, spearheaded by AEP Texas, to enhance the reliability of the electric grid in the Permian Basin region. It involves constructing a 300-mile transmission line connecting the Solstice Substation near Fort Stockton to a substation near San Antonio.'
      },
      style: { 
        priority: 1,
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        borderColor: '#f59e0b'
      }
    }
  ],

  // Workflow 2: Load Analysis (Scene 2) - San Antonio/Castroville
  'scene-2': [
    {
      id: 'load-analysis-card',
      title: 'Load Center Analysis',
      position: { lat: 29.324, lng: -98.707 },  // Castroville, TX
      nextSceneId: 'scene-3',
      content: {
        data: {
          'Analysis Type': 'Demand Centers',
          'Peak Load': '75,000 MW',
          'Growth Rate': '3.2% annually',
          'Critical Areas': '5 identified'
        },
        description: 'Detailed analysis of electricity demand patterns, load centers, and transmission access requirements for major metropolitan areas.'
      },
      style: { 
        priority: 1,
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        borderColor: '#4caf50'
      }
    }
  ],

  // Workflow 3: Environmental Planning (Scene 3) - Ozona, TX
  'scene-3': [
    {
      id: 'environmental-planning-card',
      title: 'Environmental Assessment',
      position: { lat: 30.7132, lng: -101.2007 },  // Ozona, TX
      nextSceneId: 'scene-4',
      content: {
        data: {
          'Study Focus': 'Environmental Impact',
          'Protected Areas': '15 locations',
          'Wildlife Corridors': '8 identified',
          'Mitigation Cost': '$50M estimated'
        },
        description: 'Environmental impact assessment and mitigation strategies for transmission development with focus on protected areas and wildlife corridors.'
      },
      style: { 
        priority: 1,
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        borderColor: '#4caf50'
      }
    }
  ],

  // Workflow 4: Infrastructure Siting (Scene 4) - Fort Stockton, TX
  'scene-4': [
    {
      id: 'infrastructure-siting-card',
      title: 'Infrastructure Siting Analysis',
      position: { lat: 30.8951, lng: -102.8779 },  // Fort Stockton, TX
      nextSceneId: 'scene-0',
      content: {
        data: {
          'Siting Focus': 'Transmission Infrastructure',
          'Voltage Level': '345 kV',
          'Corridor Length': '500+ miles',
          'Construction Timeline': '3-5 years'
        },
        description: 'Optimal siting analysis for new transmission infrastructure including substations, transmission lines, and interconnection facilities.'
      },
      style: { 
        priority: 1,
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        borderColor: '#f59e0b'
      }
    }
  ],

  // Legacy configurations for backward compatibility
  'transmission-overview': [
    {
      id: 'overview-card-1',
      title: 'Texas Transmission Overview',
      position: { lat: 31.0, lng: -100.0 },
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
  ],
  
  'generation-focus': [
    {
      id: 'generation-card-1',
      title: 'Generation Planning Hub',
      position: { lat: 30.5, lng: -97.5 },
      nextSceneId: 'water-constraints',
      content: {
        data: {
          'Planned Generation': '15,000 MW',
          'Water Requirements': '2.5B gallons/year',
          'Environmental Impact': 'Under Review'
        },
        description: 'Strategic planning for new generation facilities and water resource management.'
      },
      style: { 
        priority: 1,
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        borderColor: '#4caf50'
      }
    }
  ],
  
  'demand-analysis': [
    {
      id: 'demand-card-1',
      title: 'Load Center Analysis',
      position: { lat: 29.7, lng: -95.3 },
      nextSceneId: 'transmission-corridors',
      content: {
        data: {
          'Peak Load': '12,000 MW',
          'Growth Rate': '3.2% annually',
          'Industrial Demand': '45%',
          'Residential Demand': '35%'
        },
        description: 'Detailed analysis of electricity demand patterns and growth projections.'
      },
      style: { 
        priority: 1,
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        borderColor: '#4caf50'
      }
    }
  ],
  
  'transmission-corridors': [
    {
      id: 'corridor-card-1',
      title: 'Critical Transmission Path',
      position: { lat: 31.5, lng: -99.0 },
      nextSceneId: 'environmental-impact',
      content: {
        data: {
          'Voltage Level': '345 kV',
          'Capacity': '2,000 MW',
          'Length': '150 miles',
          'Status': 'Planning Phase'
        },
        description: 'High-priority transmission corridor connecting renewable generation to load centers.'
      },
      style: { 
        priority: 1,
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        borderColor: '#4caf50'
      }
    }
  ],
  
  'water-constraints': [
    {
      id: 'water-card-1',
      title: 'Water Resource Planning',
      position: { lat: 30.0, lng: -98.0 },
      nextSceneId: 'environmental-impact',
      content: {
        data: {
          'Available Water': '500,000 acre-ft',
          'Generation Demand': '300,000 acre-ft',
          'Conservation Target': '20% reduction',
          'Aquifer Status': 'Moderate Stress'
        },
        description: 'Water availability and conservation strategies for power generation.'
      },
      style: { 
        priority: 1,
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        borderColor: '#4caf50'
      }
    }
  ],
  
  'environmental-impact': [
    {
      id: 'environmental-card-1',
      title: 'Environmental Assessment',
      position: { lat: 29.0, lng: -100.0 },
      nextSceneId: 'transmission-overview',
      content: {
        data: {
          'Protected Areas': '15 locations',
          'Wildlife Corridors': '8 identified',
          'Mitigation Cost': '$50M estimated',
          'Permit Status': 'In Progress'
        },
        description: 'Environmental impact assessment and mitigation strategies for transmission development.'
      },
      style: { 
        priority: 1,
        backgroundColor: 'rgba(26, 26, 26, 0.95)',
        borderColor: '#4caf50'
      }
    }
  ]
};

// Get cards for a specific scene
export const getCardsForScene = (sceneId) => {
  return CARD_CONFIGS[sceneId] || [];
};

// Get all available scene IDs that have cards
export const getAvailableSceneIds = () => {
  return Object.keys(CARD_CONFIGS);
};

// Add cards for a scene dynamically
export const addCardsForScene = (sceneId, cards) => {
  if (!CARD_CONFIGS[sceneId]) {
    CARD_CONFIGS[sceneId] = [];
  }
  CARD_CONFIGS[sceneId].push(...cards);
};

// Update card configuration
export const updateCardConfig = (sceneId, cardId, updates) => {
  const sceneCards = CARD_CONFIGS[sceneId];
  if (sceneCards) {
    const cardIndex = sceneCards.findIndex(card => card.id === cardId);
    if (cardIndex !== -1) {
      CARD_CONFIGS[sceneId][cardIndex] = {
        ...sceneCards[cardIndex],
        ...updates
      };
      return true;
    }
  }
  return false;
};

export default CARD_CONFIGS;