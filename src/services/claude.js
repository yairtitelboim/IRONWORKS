import axios from 'axios';

// LLM models for analysis
const llmModels = [
  { id: 'gpt4', name: 'GPT-4', color: '#3b82f6', confidence: 89 },
  { id: 'claude3', name: 'Claude 3', color: '#8b5cf6', confidence: 92 },
  { id: 'llama3', name: 'Llama 3', color: '#10b981', confidence: 85 },
  { id: 'deepseek', name: 'DeepSeek-R1', color: '#f97316', confidence: 87 }
];

// 15-minute city accessibility metrics
const accessibilityData = [
  { 
    factor: 'Public Transit',
    category: 'Mobility',
    'GPT-4': 85, 
    'Claude 3': 88, 
    'Llama 3': 82,
    'DeepSeek-R1': 84,
    description: '4 metro stops within 10-minute walk',
    impact: 'Excellent transit connectivity'
  },
  { 
    factor: 'Bike Infrastructure',
    category: 'Mobility', 
    'GPT-4': 75, 
    'Claude 3': 78, 
    'Llama 3': 72,
    'DeepSeek-R1': 76,
    description: '8.5 miles of protected bike lanes',
    impact: 'Strong cycling infrastructure'
  },
  { 
    factor: 'Essential Services',
    category: 'Accessibility', 
    'GPT-4': 92, 
    'Claude 3': 90, 
    'Llama 3': 88,
    'DeepSeek-R1': 89,
    description: '95% of essentials within 15 minutes',
    impact: 'Excellent daily needs access'
  },
  { 
    factor: 'Green Spaces',
    category: 'Accessibility', 
    'GPT-4': 68, 
    'Claude 3': 65, 
    'Llama 3': 70,
    'DeepSeek-R1': 66,
    description: '12 acres of parks and plazas',
    impact: 'Moderate green space access'
  },
  { 
    factor: 'Mixed-Use Development',
    category: 'Urban Design', 
    'GPT-4': 88, 
    'Claude 3': 85, 
    'Llama 3': 82,
    'DeepSeek-R1': 84,
    description: '78% mixed-use zoning',
    impact: 'Strong land use diversity'
  },
  { 
    factor: 'Walkability',
    category: 'Urban Design', 
    'GPT-4': 95, 
    'Claude 3': 92, 
    'Llama 3': 90,
    'DeepSeek-R1': 93,
    description: 'Walk Score: 92/100',
    impact: 'Excellent pedestrian environment'
  }
];

// Add export to the MOCK_RESPONSES declaration
export const MOCK_RESPONSES = {
  "Show me the most walkable neighborhoods": {
    content: [{
      text: JSON.stringify({
        action: "showMultipleLocations",
        locations: [
          {
            name: "Downtown LA Arts District",
            coordinates: [-118.2351, 34.0403],
            description: "Creative urban core",
            icons: {
              square: true,
              chart: true,
              circle: true
            },
            callout: {
              title: "Arts District",
              details: [
                "Walk Score: 92 • Transit Score: 88",
                "Mixed-use development • Cultural hub"
              ]
            }
          },
          {
            name: "Silver Lake",
            coordinates: [-118.2767, 34.0872],
            description: "Vibrant neighborhood",
            icons: {
              square: true,
              chart: true,
              circle: true
            },
            callout: {
              title: "Silver Lake",
              details: [
                "Walk Score: 89 • Transit Score: 82",
                "Local shops • Restaurant scene"
              ]
            }
          },
          {
            name: "Koreatown",
            coordinates: [-118.3009, 34.0611],
            description: "Dense urban district",
            icons: {
              square: true,
              chart: true,
              circle: true
            },
            callout: {
              title: "Koreatown",
              details: [
                "Walk Score: 91 • Transit Score: 86",
                "24/7 amenities • Transit-oriented"
              ]
            }
          }
        ],
        viewBounds: {
          sw: [-118.35, 34.02],
          ne: [-118.20, 34.10]
        },
        preGraphText: "I've analyzed LA's walkability patterns by combining pedestrian infrastructure data, amenity proximity, and urban design metrics. Let's examine how these neighborhoods perform in the 15-minute city framework.",
        postGraphText: "The data reveals that these neighborhoods excel in the 15-minute city metrics. The Arts District leads with a 92 walkability score, offering residents access to 95% of daily needs within a 15-minute walk. Both Silver Lake and Koreatown also demonstrate strong performance in mixed-use development and transit connectivity.\n\nWhich neighborhood would you like to explore in detail?",
        quickActions: [
          {
            text: "Transit Access",
            prompt: "SHOW_TRANSIT_ACCESS",
            icon: "🚇",
            description: "Public transportation coverage"
          },
          {
            text: "Essential Services",
            prompt: "SHOW_ESSENTIAL_SERVICES",
            icon: "🏪",
            description: "Daily needs within 15 min"
          },
          {
            text: "Bike Network",
            prompt: "SHOW_BIKE_NETWORK",
            icon: "🚲",
            description: "Cycling infrastructure"
          }
        ]
      })
    }]
  },
  "Where are the best-connected transit hubs?": {
    content: [{
      text: JSON.stringify({
        action: "showCommercialCluster",
        clusterData: {
          name: "Downtown LA Arts District",
          type: "Mixed-Use Urban Core",
          walkScore: 92,
          bikeScore: 86,
          transitScore: 88,
          address: "Arts District",
          city: "Los Angeles, CA 90013",
          amenitiesWithin15Min: 284,
          essentialServices: "95%",
          greenSpaces: "12 acres",
          lastMajorDev: "2022",
          keyFeatures: "Creative Offices, Residential Lofts, Art Galleries, Restaurants"
        },
        llmModels,
        accessibilityData,
        modelConclusions: [
          {
            id: 'llama3',
            name: 'Llama 3',
            color: '#10b981',
            accessTime: '12 min avg',
            walkabilityScore: 92,
            keyInsight: 'Excellent multi-modal connectivity',
            uniqueFinding: 'Integration of micro-mobility options enhances last-mile connectivity'
          },
          {
            id: 'deepseek',
            name: 'DeepSeek-R1',
            color: '#f97316',
            accessTime: '14 min avg',
            walkabilityScore: 88,
            keyInsight: 'Strong transit-oriented development',
            uniqueFinding: 'Mixed-use density supports high transit utilization'
          },
          {
            id: 'gpt4',
            name: 'GPT-4',
            color: '#3b82f6',
            accessTime: '11 min avg',
            walkabilityScore: 90,
            keyInsight: 'Comprehensive transit coverage',
            uniqueFinding: 'Strategic bus-rail integration reduces access times'
          },
          {
            id: 'claude3',
            name: 'Claude 3',
            color: '#8b5cf6',
            accessTime: '10 min avg',
            walkabilityScore: 94,
            keyInsight: 'Optimal pedestrian infrastructure',
            uniqueFinding: 'Enhanced streetscape design improves transit accessibility'
          }
        ],
        preGraphText: "I've analyzed the transit connectivity of this neighborhood through the lens of 15-minute city principles. Let's examine how different transportation modes integrate to create comprehensive accessibility.",
        postGraphText: "The analysis reveals exceptional transit connectivity in the Arts District:\n\n" +
                      "• Multiple transit modes within 5-minute walk\n" +
                      "• 95% of essential services accessible within 15 minutes\n" +
                      "• Strong integration of micro-mobility options\n" +
                      "• High-quality pedestrian infrastructure\n\n" +
                      "Would you like to explore specific aspects of the neighborhood's connectivity?"
      })
    }]
  },
  "Find neighborhoods with the fastest housing growth": {
    content: [{
      text: JSON.stringify({
        action: "showMultipleLocations",
        locations: [
          {
            name: "Brickell",
            coordinates: [-80.1998, 25.7650],
            description: "Miami's financial district",
            icons: {
              square: true,
              chart: true,
              circle: true
            },
            callout: {
              title: "Brickell",
              details: [
                "Growth: +12.4% • Occupancy: 92%",
                "Mixed-use development • High density zone"
              ]
            }
          },
          {
            name: "South Beach",
            coordinates: [-80.13, 25.7865],
            description: "Dense urban area",
            icons: {
              square: true,
              chart: true,
              circle: true
            },
            callout: {
              title: "South Beach",
              details: [
                "Growth: +9.2% • Occupancy: 88%",
                "Entertainment district • Tourism zone"
              ]
            }
          },
          {
            name: "Wynwood",
            coordinates: [-80.2000, 25.8050],
            description: "Creative district",
            icons: {
              square: true,
              chart: true,
              circle: true
            },
            callout: {
              title: "Wynwood",
              details: [
                "Growth: +15.7% • Occupancy: 85%",
                "Arts & Tech district • Cultural zone"
              ]
            }
          }
        ],
        viewBounds: {
          sw: [-80.30, 25.75],
          ne: [-80.10, 25.79]
        },
        preGraphText: "I've analyzed Miami's housing market trends by combining building permit data, occupancy rates, and demographic shifts—with a hint of energy efficiency metrics to gauge building performance. Let's examine how these factors have evolved over the past five years, focusing on Brickell and South Beach.",
        postGraphText: "The data reveals an interesting pattern: Brickell has emerged as Miami's premier housing growth zone, scoring a 92 on our housing development index by 2023—remarkably higher than both the Miami metro average and national benchmarks. While South Beach also shows robust residential demand with an 88 index score, Brickell's rapid influx of new multifamily developments and mixed-use projects signals a transformative shift in the urban landscape. Both areas have seen significant growth since 2020, challenging conventional views on Miami's residential markets.\n\nWhich area would you like to explore in detail?",
        followUpSuggestions: [
          {
            text: "Explore Brickell's housing dynamics",
            prompt: "SHOW_BRICKELL_HOUSING"
          },
          {
            text: "Explore South Beach's residential trends",
            prompt: "SHOW_SOUTHBEACH_HOUSING"
          },
          {
            text: "Explore Wynwood's mixed-use transformation",
            prompt: "SHOW_WYNWOOD_HOUSING"
          }
        ],
        quickActions: [
          {
            text: "Demographic Stats",
            prompt: "SHOW_BRICKELL_DEMOGRAPHICS",
            icon: "📊",
            description: "Income, age, education data"
          },
          {
            text: "Historical Trends",
            prompt: "SHOW_BRICKELL_HISTORY",
            icon: "📈",
            description: "Development since 2010"
          },
          {
            text: "AI Predictions",
            prompt: "SHOW_BRICKELL_FORECAST",
            icon: "🔮",
            description: "Growth forecast 2024-2025"
          }
        ]
      })
    }]
  },
  "ZOOM_TO_BRICKELL": {
    content: [{
      text: JSON.stringify({
        action: "navigate",
        coordinates: [-80.1918, 25.7650],
        zoomLevel: 16,
        poiInfo: {
          pmtId: "brickell_pmt",
          subdivisionId: "brickell_main",
          poiCount: 45,
          poiTypes: ["substation", "transformer", "solar_array", "smart_meter"]
        },
        preGraphText: "As we analyzed the infrastructure data, Brickell stood out as Miami's premier energy hub. Let's examine the power distribution network that makes this possible.",
        postGraphText: "The data reveals an impressive power infrastructure network, with over 45 critical nodes in this district alone. The area's modernization has attracted major investments in smart grid technology and renewable energy systems.",
        quickActions: [
          {
            text: "Power Grid Analysis",
            prompt: "SHOW_BRICKELL_POWER",
            icon: "⚡",
            description: "Energy distribution network"
          },
          {
            text: "Historical Trends",
            prompt: "SHOW_BRICKELL_HISTORY",
            icon: "📈",
            description: "Infrastructure evolution"
          },
          {
            text: "AI Predictions",
            prompt: "SHOW_BRICKELL_FORECAST",
            icon: "🔮",
            description: "Capacity forecast 2024-2025"
          }
        ],
        followUpSuggestions: [
          {
            text: "Show smart grid coverage",
            prompt: "SHOW_SMART_GRID_BRICKELL"
          },
          {
            text: "View renewable installations",
            prompt: "SHOW_RENEWABLE_ENERGY"
          },
          {
            text: "Compare to South Beach grid",
            prompt: "COMPARE_GRID_INFRASTRUCTURE"
          }
        ]
      })
    }]
  },
  "SHOW_BRICKELL_DINING": {
    content: [{
      text: JSON.stringify({
        action: "navigate",
        coordinates: [-80.1918, 25.7650],
        zoomLevel: 16,
        poiInfo: {
          pmtId: "brickell_pmt",
          subdivisionId: "brickell_main",
          poiCount: 45,
          poiTypes: ["substation", "transformer", "solar_array", "smart_meter"]
        },
        preGraphText: "Analyzing Brickell's power infrastructure... As Miami's financial hub, Brickell represents one of the most sophisticated urban power grids in Florida. The district combines traditional infrastructure with cutting-edge smart grid technology and renewable energy solutions. Let's examine the current state of its power distribution network and real-time consumption patterns.",
        postGraphText: "I've highlighted the major power distribution nodes in Brickell. The area features:\n\n" +
                      "• 45+ smart grid nodes\n" +
                      "• 8 power substations\n" +
                      "• 12 high-capacity transformers\n" +
                      "• 15+ renewable energy installations\n\n" +
                      "The orange highlights indicate energy hotspots, with brighter colors showing higher power consumption.",
        followUpSuggestions: [
          {
            text: "Show peak demand zones",
            prompt: "SHOW_PEAK_DEMAND_BRICKELL"
          },
          {
            text: "View grid resilience data",
            prompt: "SHOW_GRID_RESILIENCE"
          },
          {
            text: "Compare to South Beach",
            prompt: "COMPARE_POWER_INFRASTRUCTURE"
          }
        ],
        quickActions: [
          {
            text: "High Capacity Zones",
            prompt: "FILTER_HIGH_CAPACITY",
            icon: "⚡",
            description: "Areas with peak power demand"
          },
          {
            text: "Smart Grid Network",
            prompt: "FILTER_SMART_GRID",
            icon: "🔌",
            description: "Connected infrastructure"
          },
          {
            text: "Performance Metrics",
            prompt: "SHOW_METRICS",
            icon: "📊",
            description: "Real-time energy analytics"
          }
        ]
      })
    }]
  },
  "SHOW_BRICKELL_DEMOGRAPHICS": {
    content: [{
      text: JSON.stringify({
        action: "showDemographics",
        preGraphText: "Here's a demographic breakdown of Brickell:",
        postGraphText: "Brickell's population has grown significantly:\n\n" +
                      "• Current Population: 32,547\n" +
                      "• Median Age: 34\n" +
                      "• Household Income: $121,500\n" +
                      "• Population Density: 27,890/sq mi\n" +
                      "• Growth Rate: +12.4% (2023)\n\n" +
                      "This makes it one of Miami's fastest-growing urban cores.",
        quickActions: [
          {
            text: "Compare to South Beach",
            prompt: "COMPARE_GRID_METRICS",
            icon: "↗",
            description: "Area comparison"
          },
          {
            text: "Show Growth Trends",
            prompt: "SHOW_GRID_GROWTH",
            icon: "📈",
            description: "Historical data"
          },
          {
            text: "Future Forecast",
            prompt: "SHOW_FUTURE_TRENDS",
            icon: "🔮",
            description: "2024 projections"
          }
        ]
      })
    }]
  },
  "SHOW_BRICKELL_POWER": {
    content: [{
      text: JSON.stringify({
        action: "showPowerGrid",
        coordinates: [-80.1918, 25.765],
        zoomLevel: 16,
        preGraphText: "Analyzing Brickell's power infrastructure...",
        postGraphText: "I've highlighted the major power distribution nodes in Brickell...",
        quickActions: [
          {
            text: "High Capacity Zones",
            prompt: "FILTER_HIGH_CAPACITY",
            icon: "⚡"
          },
          {
            text: "Smart Grid Network",
            prompt: "FILTER_SMART_GRID",
            icon: "🔌"
          }
        ]
      })
    }]
  },
  "SHOW_GRID_GROWTH": {
    content: [{
      text: JSON.stringify({
        action: "showGridGrowth",
        preGraphText: "Let's analyze Brickell's power grid growth patterns over the past 5 years. We'll look at both capacity expansion and smart grid adoption rates.",
        postGraphText: "The data reveals two key trends:\n\n" +
                      "• Grid Capacity has grown by 47% since 2019, driven by new development\n" +
                      "• Smart Grid adoption accelerated in 2022, now covering 45% of the network\n\n" +
                      "This growth pattern suggests Brickell is leading Miami's power infrastructure modernization.",
        graphs: [
          {
            title: "Power Grid Capacity Growth",
            data: [
              { year: '2019', capacity: 580, smart: 150, baseline: 500 },
              { year: '2020', capacity: 620, smart: 200, baseline: 520 },
              { year: '2021', capacity: 680, smart: 280, baseline: 540 },
              { year: '2022', capacity: 780, smart: 390, baseline: 560 },
              { year: '2023', capacity: 850, smart: 425, baseline: 580 }
            ],
            dataKeys: ['capacity', 'smart', 'baseline'],
            labels: ['Total Capacity (MW)', 'Smart Grid (MW)', 'Baseline Need']
          },
          {
            title: "Infrastructure Distribution",
            data: [
              { name: 'Smart Meters', value: 45 },
              { name: 'Automated Switches', value: 28 },
              { name: 'Energy Storage', value: 15 },
              { name: 'Traditional', value: 12 }
            ]
          }
        ],
        quickActions: [
          {
            text: "Compare to South Beach",
            prompt: "COMPARE_GRID_METRICS",
            icon: "⚡",
            description: "Infrastructure comparison"
          },
          {
            text: "Future Projections",
            prompt: "SHOW_GRID_FORECAST",
            icon: "📈",
            description: "2024-2025 forecast"
          }
        ]
      })
    }]
  },
  "SHOW_FUTURE_TRENDS": {
    content: [{
      text: JSON.stringify({
        action: "showGraphs",
        preGraphText: "Here's our AI forecast for Brickell's housing dynamics across census blocks:",
        graphs: [
          {
            title: "Housing Density Growth",
            data: [
              { year: '2020', units: 450, luxury: 180, baseline: 400 },
              { year: '2021', units: 520, luxury: 220, baseline: 420 },
              { year: '2022', units: 580, luxury: 280, baseline: 440 },
              { year: '2023', units: 680, luxury: 350, baseline: 460 },
              { year: '2024', units: 750, luxury: 420, baseline: 480 },
              { year: '2025', units: 850, luxury: 510, baseline: 500 }
            ],
            dataKeys: ['units', 'luxury', 'baseline'],
            labels: ['Total Units', 'Luxury Units', 'Base Housing Need']
          },
          {
            title: "Census Block Development",
            data: [
              { name: 'High Density', value: 45 },
              { name: 'Mixed Use', value: 28 },
              { name: 'Residential', value: 15 },
              { name: 'Commercial', value: 12 }
            ]
          }
        ],
        postGraphText: "Analysis of Brickell's census blocks reveals several key trends:\n\n" +
                      "• Dramatic growth in central blocks (>1200 units) showing 15% annual increase\n" +
                      "• Mid-density blocks (600-900 units) experiencing rapid transformation\n" +
                      "• Stable growth in established areas (<300 units)\n" +
                      "• Mixed-use development driving density in blocks 2 and 3\n\n" +
                      "The orange gradient highlights intensity of development, with darker shades indicating established neighborhoods and brighter tones showing recent growth hotspots.",
        followUpSuggestions: [
          {
            text: "Analyze housing trends in detail",
            prompt: "SHOW_BRICKELL_HOUSING"
          },
          {
            text: "View development pipeline",
            prompt: "SHOW_DEVELOPMENT_PIPELINE"
          },
          {
            text: "Compare with nearby districts",
            prompt: "COMPARE_HOUSING_DENSITY"
          }
        ]
      })
    }]
  },
  "SHOW_SMART_GRID_IMPACT": {
    text: "Based on our analysis, smart grid adoption could lead to significant cost savings...",
    action: 'showCostAnalysis'
  },
  "SHOW_SUSTAINABILITY_FORECAST": {
    text: "Here's how Brickell's sustainability metrics are projected to evolve...",
    action: 'showSustainability'
  },
  "SHOW_GRID_DENSITY": {
    content: [{
      text: JSON.stringify({
        action: "navigate",
        coordinates: [-80.1918, 25.7650],
        zoomLevel: 16,
        poiInfo: {
          pmtId: "brickell_pmt",
          subdivisionId: "brickell_main",
          poiCount: 45,
          poiTypes: ["substation", "transformer", "solar_array", "smart_meter"],
          typeFollowUps: [
            {
              text: "Show substation distribution network",
              prompt: "SHOW_SUBSTATION_NETWORK"
            },
            {
              text: "View transformer load capacity",
              prompt: "VIEW_TRANSFORMER_CAPACITY"
            },
            {
              text: "Explore solar array efficiency",
              prompt: "EXPLORE_SOLAR_EFFICIENCY"
            },
            {
              text: "Analyze smart meter data patterns",
              prompt: "ANALYZE_SMART_METERS"
            }
          ]
        },
        preGraphText: "Analyzing Brickell's power grid density... The district features one of the most sophisticated urban power networks in Florida, with multiple layers of infrastructure supporting its high-energy demands.",
        postGraphText: "Key findings about Brickell's housing density:\n\n" +
                      "• Residential Density: 45+ units per acre\n" +
                      "• Mixed-Use Coverage: 85% of district\n" +
                      "• Occupancy Rate: 92% average\n" +
                      "• Development Capacity: 35% growth potential\n\n" +
                      "The highlighted zones show areas of highest residential concentration, with brighter colors indicating greater density of housing units and mixed-use developments.",
        followUpSuggestions: [
          {
            text: "Analyze power distribution by node type",
            prompt: "SHOW_NODE_DISTRIBUTION"
          },
          {
            text: "View smart meter coverage map",
            prompt: "SHOW_SMART_METER_MAP"
          },
          {
            text: "Show transformer load balancing",
            prompt: "SHOW_TRANSFORMER_LOADS"
          },
          {
            text: "Display solar array integration",
            prompt: "SHOW_SOLAR_INTEGRATION"
          }
        ],
        quickActions: [
          {
            text: "Infrastructure Map",
            prompt: "SHOW_INFRASTRUCTURE_MAP",
            icon: "🔌",
            description: "View power grid layout"
          },
          {
            text: "Load Analysis",
            prompt: "SHOW_LOAD_ANALYSIS",
            icon: "📊",
            description: "Current usage patterns"
          },
          {
            text: "Growth Forecast",
            prompt: "SHOW_DENSITY_FORECAST",
            icon: "📈",
            description: "Future capacity needs"
          }
        ],
        zoomOutButton: {
          text: "Zoom out to view full district",
          action: "zoomOut"
        }
      })
    }]
  },
  "VIEW_TRANSFORMER_CAPACITY": {
    content: [{
      text: "hi hi"
    }]
  },
  "Where are the major flood-prone areas?": {
    content: [{
      text: JSON.stringify({
        action: "showCommercialCluster",
        clusterData: {
          name: "Westheimer & Post Oak",
          type: "Retail & Office Hub",
          price: "$8.4M",
          priceUnit: "daily economic impact",
          address: "Post Oak Blvd & Westheimer Rd",
          city: "Houston, TX 77056",
          properties: 42,
          sqft: "1.2M",
          avgFloodDepth: 2.8,
          lastFlood: "Hurricane Harvey (2017)",
          keyTenants: "Galleria Mall, Financial Services, Luxury Retail",
          imageUrl: "https://images.unsplash.com/photo-1582225373839-3f67b3057106?q=80&w=2787&auto=format&fit=crop"
        },
        llmModels: [
          { id: 'gpt4', name: 'GPT-4', color: '#3b82f6', confidence: 89 },
          { id: 'claude3', name: 'Claude 3', color: '#8b5cf6', confidence: 92 },
          { id: 'llama3', name: 'Llama 3', color: '#10b981', confidence: 85 },
          { id: 'deepseek', name: 'DeepSeek-R1', color: '#f97316', confidence: 87 }
        ],
        riskFactorData: [
          { 
            factor: 'Elevation', 
            'GPT-4': 25, 
            'Claude 3': 20, 
            'Llama 3': 38,
            'DeepSeek-R1': 42, 
            description: 'Property sits 3.5ft below surrounding area'
          },
          { 
            factor: 'Building Age', 
            'GPT-4': 15, 
            'Claude 3': 23, 
            'Llama 3': 10,
            'DeepSeek-R1': 12, 
            description: 'Most structures built between 1990-2005'
          },
          { 
            factor: 'Power Infrastructure', 
            'GPT-4': 25, 
            'Claude 3': 30, 
            'Llama 3': 12,
            'DeepSeek-R1': 18, 
            description: 'Multiple substations with partial redundancy'
          },
          { 
            factor: 'Bayou Proximity', 
            'GPT-4': 20, 
            'Claude 3': 12, 
            'Llama 3': 32,
            'DeepSeek-R1': 25, 
            description: '0.6 miles to Buffalo Bayou'
          },
          { 
            factor: 'Business Continuity', 
            'GPT-4': 10, 
            'Claude 3': 15, 
            'Llama 3': 5,
            'DeepSeek-R1': 3, 
            description: '64% of businesses have continuity plans'
          },
          { 
            factor: 'Historical Flooding', 
            'GPT-4': 5, 
            'Claude 3': 5, 
            'Llama 3': 3,
            'DeepSeek-R1': 5, 
            description: '2 major flood events in past 10 years'
          }
        ],
        recoveryTimelineData: [
          { day: 0, 'GPT-4': 0, 'Claude 3': 0, 'Llama 3': 0, 'DeepSeek-R1': 0 },
          { day: 2, 'GPT-4': 8, 'Claude 3': 15, 'Llama 3': 5, 'DeepSeek-R1': 3 },
          { day: 4, 'GPT-4': 21, 'Claude 3': 32, 'Llama 3': 11, 'DeepSeek-R1': 9 },
          { day: 6, 'GPT-4': 36, 'Claude 3': 48, 'Llama 3': 18, 'DeepSeek-R1': 16 },
          { day: 8, 'GPT-4': 47, 'Claude 3': 62, 'Llama 3': 26, 'DeepSeek-R1': 35 },
          { day: 10, 'GPT-4': 58, 'Claude 3': 73, 'Llama 3': 35, 'DeepSeek-R1': 52 },
          { day: 12, 'GPT-4': 67, 'Claude 3': 81, 'Llama 3': 43, 'DeepSeek-R1': 63 },
          { day: 14, 'GPT-4': 74, 'Claude 3': 89, 'Llama 3': 51, 'DeepSeek-R1': 70 },
          { day: 16, 'GPT-4': 81, 'Claude 3': 94, 'Llama 3': 58, 'DeepSeek-R1': 76 },
          { day: 18, 'GPT-4': 86, 'Claude 3': 98, 'Llama 3': 65, 'DeepSeek-R1': 82 },
          { day: 20, 'GPT-4': 91, 'Claude 3': 100, 'Llama 3': 71, 'DeepSeek-R1': 87 },
          { day: 24, 'GPT-4': 97, 'Claude 3': 100, 'Llama 3': 83, 'DeepSeek-R1': 95 },
          { day: 28, 'GPT-4': 100, 'Claude 3': 100, 'Llama 3': 91, 'DeepSeek-R1': 98 },
          { day: 32, 'GPT-4': 100, 'Claude 3': 100, 'Llama 3': 96, 'DeepSeek-R1': 100 },
          { day: 36, 'GPT-4': 100, 'Claude 3': 100, 'Llama 3': 100, 'DeepSeek-R1': 100 }
        ],
        modelConclusions: [
          {
            id: 'llama3',
            name: 'Llama 3',
            color: '#10b981',
            recoveryTime: '36 days',
            riskScore: 78,
            keyInsight: 'Elevation is the dominant risk factor',
            uniqueFinding: 'Historical flood patterns suggest longer recovery periods than other models predict'
          },
          {
            id: 'deepseek',
            name: 'DeepSeek-R1',
            color: '#f97316',
            recoveryTime: '32 days',
            riskScore: 73,
            keyInsight: 'Elevation combined with bayou proximity creates compound risk',
            uniqueFinding: 'Retail businesses recover significantly slower than office spaces in this area'
          },
          {
            id: 'gpt4',
            name: 'GPT-4',
            color: '#3b82f6',
            recoveryTime: '24 days',
            riskScore: 65,
            keyInsight: 'Power infrastructure is the critical path dependency',
            uniqueFinding: 'Building proximity to backup power grid significantly reduces recovery time'
          },
          {
            id: 'claude3',
            name: 'Claude 3',
            color: '#8b5cf6',
            recoveryTime: '20 days',
            riskScore: 52,
            keyInsight: 'Business continuity plans most important for rapid recovery',
            uniqueFinding: 'Tenants with remote work capabilities recover 42% faster than those without'
          }
        ],
        milestoneCategories: [
          {
            name: "Power Restoration",
            icon: "⚡",
            category: "infrastructure",
            models: [
              { id: "claude3", day: 3, confidence: 92 },
              { id: "gpt4", day: 5, confidence: 88 },
              { id: "deepseek", day: 8, confidence: 85 },
              { id: "llama3", day: 10, confidence: 83 }
            ]
          },
          {
            name: "Emergency Services",
            icon: "🚑",
            category: "services",
            models: [
              { id: "claude3", day: 5, confidence: 93 },
              { id: "gpt4", day: 7, confidence: 94 },
              { id: "deepseek", day: 9, confidence: 91 },
              { id: "llama3", day: 12, confidence: 89 }
            ]
          },
          {
            name: "Road Access",
            icon: "🛣️",
            category: "infrastructure",
            models: [
              { id: "claude3", day: 7, confidence: 90 },
              { id: "gpt4", day: 10, confidence: 87 },
              { id: "deepseek", day: 13, confidence: 86 },
              { id: "llama3", day: 17, confidence: 82 }
            ]
          },
          {
            name: "Retail Reopening",
            icon: "🏪",
            category: "business",
            models: [
              { id: "claude3", day: 10, confidence: 88 },
              { id: "gpt4", day: 15, confidence: 84 },
              { id: "deepseek", day: 18, confidence: 81 },
              { id: "llama3", day: 25, confidence: 79 }
            ]
          },
          {
            name: "Office Buildings",
            icon: "🏢",
            category: "business",
            models: [
              { id: "claude3", day: 14, confidence: 87 },
              { id: "gpt4", day: 18, confidence: 83 },
              { id: "deepseek", day: 24, confidence: 85 },
              { id: "llama3", day: 28, confidence: 76 }
            ]
          },
          {
            name: "Full Operations",
            icon: "✅",
            category: "business",
            models: [
              { id: "claude3", day: 20, confidence: 92 },
              { id: "gpt4", day: 24, confidence: 88 },
              { id: "deepseek", day: 32, confidence: 86 },
              { id: "llama3", day: 36, confidence: 81 }
            ]
          }
        ],
        preGraphText: "I've analyzed the flood risk patterns across Houston, with a particular focus on the Westheimer & Post Oak intersection area. This region represents one of our high-priority monitoring zones due to its commercial density and historical flood impacts.",
        postGraphText: "The analysis reveals several critical insights about this area:\n\n" +
                      "• Historical Vulnerability: The area experienced significant flooding during Hurricane Harvey with depths reaching 2.8 feet\n" +
                      "• Infrastructure Impact: The commercial district's power grid and business operations face substantial risks\n" +
                      "• Recovery Patterns: Different AI models predict varying recovery timelines, ranging from 20 to 36 days\n" +
                      "• Risk Factors: Elevation and bayou proximity emerge as the dominant risk multipliers\n\n" +
                      "Would you like to explore specific aspects of the flood risk analysis in more detail?",
        followUpSuggestions: [
          {
            text: "Show historical flood patterns",
            prompt: "SHOW_HISTORICAL_FLOODS"
          },
          {
            text: "Analyze infrastructure vulnerabilities",
            prompt: "ANALYZE_INFRASTRUCTURE_RISK"
          },
          {
            text: "View elevation risk zones",
            prompt: "VIEW_ELEVATION_RISK"
          }
        ],
        quickActions: [
          {
            text: "Compare to Other Areas",
            prompt: "COMPARE_FLOOD_ZONES",
            icon: "🗺️",
            description: "View relative flood risks"
          },
          {
            text: "Mitigation Measures",
            prompt: "SHOW_MITIGATION",
            icon: "🛡️",
            description: "Current protection systems"
          },
          {
            text: "Real-time Monitoring",
            prompt: "SHOW_MONITORING",
            icon: "📊",
            description: "Live flood sensors"
          }
        ]
      })
    }]
  }
};

// Utility function to simulate API delay for standard flows
const simulateDelay = () => new Promise(resolve => setTimeout(resolve, 500));

// Utility function to simulate API delay for quick actions (slightly faster)
const simulateQuickActionDelay = () => new Promise(resolve => setTimeout(resolve, 300));

// Utility function for graph actions (even faster)
export const simulateGraphActionDelay = () => new Promise(resolve => setTimeout(resolve, 150));

// Add this new constant for loading states
export const LOADING_STEPS = [
  {
    icon: "🗺️",
    text: "Querying Miami-Dade GIS Database...",
    delay: 300
  },
  {
    icon: "🏢",
    text: "Accessing Local Business Registry 2024...",
    delay: 400
  },
  {
    icon: "🏗️",
    text: "Scanning Restaurant & Bar Permits...",
    delay: 500
  },
  {
    icon: "📊",
    text: "Loading Census Tract Demographics...",
    delay: 600
  },
  {
    icon: "🚇",
    text: "Checking Miami Transit Authority Data...",
    delay: 700
  },
  {
    icon: "📱",
    text: "Processing Social Activity Heatmaps...",
    delay: 800
  },
  {
    icon: "🏗️",
    text: "Analyzing Urban Development Records...",
    delay: 900
  },
  {
    icon: "📍",
    text: "Compiling Points of Interest...",
    delay: 1000
  }
];

// Add this constant for the Brickell callout response
const BRICKELL_CALLOUT_RESPONSE = {
  content: [{
    text: JSON.stringify({
      action: "showMultipleLocations",
      preGraphText: "As we saw in the economic trends, Brickell has emerged as Miami's premier dining destination. Let's take a closer look at what makes this area special.",
      postGraphText: "The data shows a remarkable concentration of high-end establishments, with over 45 restaurants and bars in this district alone. The area's rapid growth has attracted both Michelin-starred chefs and innovative local restaurateurs.",
      quickActions: [
        {
          text: "Demographic Stats",
          prompt: "SHOW_BRICKELL_DEMOGRAPHICS",
          icon: "📊",
          description: "Income, age, education data"
        },
        {
          text: "Historical Trends",
          prompt: "SHOW_BRICKELL_HISTORY",
          icon: "📈",
          description: "Development since 2010"
        },
        {
          text: "AI Predictions",
          prompt: "SHOW_BRICKELL_FORECAST",
          icon: "🔮",
          description: "Growth forecast 2024-2025"
        }
      ],
      followUpSuggestions: [
        {
          text: "Analyze power consumption trends",
          prompt: "ANALYZE_POWER_TRENDS"
        },
        {
          text: "Show infrastructure upgrades",
          prompt: "SHOW_INFRASTRUCTURE_UPDATES"
        },
        {
          text: "View digital connectivity map",
          prompt: "VIEW_CONNECTIVITY_MAP"
        }
      ]
    })
  }]
};

// Add map context validation
const validateMapContext = (context) => {
  console.log('🔍 Validating map context:', context);
  
  if (!context.mapBounds) {
    console.warn('⚠️ No map bounds provided');
    return false;
  }

  if (!context.visibleLayers) {
    console.warn('⚠️ No visible layers provided');
    return false;
  }

  return true;
};

// Update handleQuestion to use context
export const handleQuestion = async (prompt, context) => {
  console.log('📝 Processing question:', prompt);
  console.log('🌍 Context:', context);

  // Validate context
  if (!validateMapContext(context)) {
    console.warn('⚠️ Invalid map context, using default response');
    return MOCK_RESPONSES['default'];
  }

  // Check for mock responses first
  if (MOCK_RESPONSES[prompt]) {
    console.log('📦 Using mock response');
    return MOCK_RESPONSES[prompt];
  }

  try {
    const response = await askClaude(prompt, context);
    console.log('✅ Claude response:', response);
    return response;
  } catch (error) {
    console.error('❌ Error from Claude:', error);
    return null;
  }
};

export const askClaude = async (prompt, context = {}, mapBounds = null) => {
  console.log('Using mock response for development');
  
  // Use fastest delay for graph-only actions
  if (prompt === 'SHOW_GRID_GROWTH' || prompt === 'COMPARE_GRID_METRICS') {
    await simulateGraphActionDelay();
  } else if (prompt.startsWith('SHOW_') || prompt.startsWith('COMPARE_')) {
    await simulateQuickActionDelay();
  } else {
    await simulateDelay();
  }
  
  if (prompt === "ZOOM_TO_BRICKELL") {
    return BRICKELL_CALLOUT_RESPONSE;
  }

  // Check if we have a mock response for this prompt
  if (MOCK_RESPONSES[prompt]) {
    console.log('Mock Response:', JSON.stringify(MOCK_RESPONSES[prompt], null, 2));
    return MOCK_RESPONSES[prompt];
  }

  console.log('Sending request to Claude API via serverless proxy...');
  
  const isLocal = window.location.hostname === 'localhost';
  const CLAUDE_ENDPOINT = isLocal
    ? 'http://localhost:8080/proxy?url=' + encodeURIComponent('https://api.anthropic.com/v1/messages')
    : '/api/claude';
  
  // Create a strict geographic context
  const boundsContext = mapBounds ? 
    `CRITICAL GEOGRAPHIC CONSTRAINTS:
     1. You MUST ONLY analyze the area within these exact coordinates:
        Southwest: [${mapBounds.sw.lng}, ${mapBounds.sw.lat}]
        Northeast: [${mapBounds.ne.lng}, ${mapBounds.ne.lat}]
     2. This is in Miami, Florida. Never suggest locations outside Miami.
     3. Any coordinates you return MUST be within these bounds.
     4. If you cannot find relevant POIs within these bounds, say so - do not suggest other areas.` 
    : 'Stay within Miami, Florida bounds.';
  
  const headers = { 'Content-Type': 'application/json' };
  if (isLocal && process.env.REACT_APP_CLAUDE_API_KEY) {
    headers['x-api-key'] = process.env.REACT_APP_CLAUDE_API_KEY;
  }

  const response = await axios({
    method: 'post',
    url: CLAUDE_ENDPOINT,
    headers,
    data: {
      model: "claude-3-sonnet-20240229",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `You are a Miami-specific map navigation assistant. You MUST follow these rules:
                  1. ${boundsContext}
                  2. Never suggest locations outside Miami, Florida
                  3. Only analyze POIs and features visible in the current map view
                  4. If asked about areas outside the current view, respond with "Please navigate to that area first"

                  Current context: ${JSON.stringify(context)}
                  User request: ${prompt}
                  
                  Return a JSON object in this exact format:
                  {
                    "action": "navigate",
                    "coordinates": [longitude, latitude], // MUST be within current bounds
                    "zoomLevel": 16,
                    "explanation": "Explanation about visible Miami locations only",
                    "poiInfo": {
                      "pmtId": "ID of visible PMT boundary",
                      "subdivisionId": "ID of visible subdivision boundary",
                      "poiCount": "number of POIs in visible area",
                      "poiTypes": ["types of POIs found in visible area"]
                    },
                    "followUpSuggestions": [
                      {
                        "text": "suggestion about visible Miami areas only",
                        "prompt": "prompt about visible Miami areas only"
                      },
                      {
                        "text": "suggestion about visible Miami areas only",
                        "prompt": "prompt about visible Miami areas only"
                      },
                      {
                        "text": "suggestion about visible Miami areas only",
                        "prompt": "prompt about visible Miami areas only"
                      }
                    ]
                  }

                  IMPORTANT VALIDATION:
                  1. Before returning coordinates, verify they fall within the given bounds
                  2. All suggestions must reference only Miami locations
                  3. Only include POIs that are currently visible on the map
                  4. If no relevant data exists in the current view, say so instead of suggesting other areas`
      }]
    },
    timeout: 10000,
    withCredentials: true
  });

  // Validate response coordinates are within bounds
  const responseData = response.data;
  if (responseData?.content?.[0]?.text) {
    try {
      const parsed = JSON.parse(responseData.content[0].text);
      if (parsed.coordinates) {
        const [lng, lat] = parsed.coordinates;
        if (mapBounds && (
            lng < mapBounds.sw.lng || lng > mapBounds.ne.lng ||
            lat < mapBounds.sw.lat || lat > mapBounds.ne.lat
        )) {
          throw new Error('Coordinates outside bounds');
        }
      }
    } catch (e) {
      console.error('Invalid coordinates returned:', e);
      // Return a fallback response staying within bounds
      return {
        content: [{
          text: JSON.stringify({
            action: "navigate",
            coordinates: [mapBounds.sw.lng + (mapBounds.ne.lng - mapBounds.sw.lng)/2,
                        mapBounds.sw.lat + (mapBounds.ne.lat - mapBounds.sw.lat)/2],
            zoomLevel: 16,
            explanation: "Analyzing the center of your current view. Please adjust the map to see other areas.",
            poiInfo: {
              poiCount: 0,
              poiTypes: []
            },
            followUpSuggestions: [
              {
                text: "Zoom out to see more of the area",
                prompt: "What's visible in this wider area?"
              }
            ]
          })
        }]
      };
    }
  }

  return responseData;
};

export const parseClaudeResponse = (response) => {
  try {
    if (response?.content?.[0]?.text) {
      const parsed = JSON.parse(response.content[0].text);
      console.log('Parsed response:', parsed);
      
      // Return all fields from the parsed response
      return parsed;
    }

    if (response?.content) {
      return {
        preGraphText: response.content,
        postGraphText: null,
        poiInfo: null,
        followUps: [],
        quickActions: null
      };
    }

    throw new Error('Unexpected response format');
  } catch (e) {
    console.error("Error parsing response:", e);
    return {
      preGraphText: "Could not process the response. Please try again.",
      postGraphText: null,
      poiInfo: null,
      followUps: [],
      quickActions: null
    };
  }
};

// Panel-specific AI handling
export const handlePanelQuestion = async (question, map, setMessages, setIsLoading) => {
  console.log('🎯 Processing question:', question);
  setIsLoading(true);
  
  try {
    const bounds = map.current.getBounds();
    const mapBounds = {
      sw: bounds.getSouthWest(),
      ne: bounds.getNorthEast()
    };

    // Get response from Claude service
    const response = await askClaude(question, {}, mapBounds);
    const parsed = parseClaudeResponse(response);
    console.log('🔍 Parsed response:', parsed);

    // Handle map navigation if coordinates are present
    if (parsed?.coordinates && map.current) {
      console.log('🗺️ Navigating to:', parsed.coordinates);
      map.current.flyTo({
        center: parsed.coordinates,
        zoom: parsed.zoomLevel || 16,
        duration: 2000
      });
    }

    // Handle layer visibility changes
    if (parsed?.layers) {
      console.log('🎨 Updating layer visibility:', parsed.layers);
      parsed.layers.forEach(layer => {
        if (map.current.getLayer(layer.id)) {
          map.current.setLayoutProperty(
            layer.id,
            'visibility',
            layer.visible ? 'visible' : 'none'
          );
        }
      });
    }

    setMessages(prev => [...prev, 
      { isUser: true, content: question },
      { isUser: false, content: parsed }
    ]);

    return parsed;
  } catch (error) {
    console.error('❌ Error processing question:', error);
    setMessages(prev => [...prev, {
      isUser: false,
      content: {
        preGraphText: "Sorry, I encountered an error processing your request.",
        postGraphText: null,
        followUps: []
      }
    }]);
    return null;
  } finally {
    setIsLoading(false);
  }
};

export const handleQuickAction = async (action, map, setMessages, setIsLoading) => {
  if (action.prompt === 'VIEW_TRANSFORMER_CAPACITY') {
    const mockResponse = MOCK_RESPONSES[action.prompt];
    const parsedResponse = parseClaudeResponse(mockResponse);
    setMessages(prev => [...prev, {
      isUser: false,
      content: parsedResponse
    }]);
    return;
  }

  if (action.prompt === 'SHOW_FUTURE_TRENDS') {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const mockResponse = {
      isUser: false,
      content: {
        text: "Here's our AI forecast for energy infrastructure needs:",
        action: 'showGraphs',
        graphs: [
          {
            data: [
              { year: '2024-Q1', capacity: 850, smart: 880, baseline: 820 },
              { year: '2024-Q2', capacity: 900, smart: 950, baseline: 850 },
              { year: '2024-Q3', capacity: 950, smart: 1020, baseline: 880 },
              { year: '2024-Q4', capacity: 1000, smart: 1100, baseline: 910 }
            ]
          }
        ],
        postText: "The blue lines show projected energy demand under different growth scenarios."
      }
    };
    
    setMessages(prev => [...prev, mockResponse]);
    setIsLoading(false);
    return;
  }
  
  // Handle other actions
  const response = await askClaude(action.prompt);
  const parsedResponse = parseClaudeResponse(response);
  setMessages(prev => [...prev, {
    isUser: false,
    content: parsedResponse
  }]);
};

// Updated loading steps for the urban impact question
export const URBAN_IMPACT_LOADING_STEPS = [
  {
    icon: "map",
    text: "Analyzing urban density patterns..."
  },
  {
    icon: "route",
    text: "Identifying transit corridors and nodes..."
  }, 
  {
    icon: "building",
    text: "Mapping commercial and mixed-use zones..."
  },
  {
    icon: "search",
    text: "Locating underutilized parcels..."
  },
  {
    icon: "connection",
    text: "Evaluating connectivity between neighborhoods..."
  },
  {
    icon: "home",
    text: "Calculating potential housing impact..."
  },
  {
    icon: "target",
    text: "Synthesizing opportunity areas..."
  }
];

// Improved graph data for urban impact analysis with real estate and development focus
export const URBAN_IMPACT_GRAPH_DATA = {
  impactGraphs: [
    {
      type: "priorityMatrix",
      title: "Downtown LA Impact Priority Matrix",
      data: [
        { name: "Adaptive Reuse - Historic Core", effort: 60, impact: 92, category: "Housing", roi: 3.2 },
        { name: "Transit Corridors - Skid Row", effort: 55, impact: 85, category: "Transit", roi: 2.8 },
        { name: "Mobility Infrastructure", effort: 45, impact: 78, category: "Pedestrian", roi: 2.5 },
        { name: "Green Alley Network", effort: 40, impact: 65, category: "Green", roi: 2.2 },
        { name: "Service Hub Access Points", effort: 30, impact: 72, category: "Safety", roi: 2.9 },
        { name: "Mixed-Use Conversion - Arts District", effort: 65, impact: 88, category: "Housing", roi: 2.4 },
        { name: "Smart Intersection Upgrades", effort: 50, impact: 68, category: "Traffic", roi: 1.9 },
        { name: "Facade Improvements - Broadway", effort: 35, impact: 60, category: "Aesthetic", roi: 2.1 },
        { name: "Protected Bike Lanes", effort: 45, impact: 75, category: "Bike", roi: 2.3 }
      ]
    },
    {
      type: "benefitsBreakdown",
      title: "Downtown LA Benefits Breakdown",
      data: {
        "Housing Accessibility": 35,
        "Economic Revitalization": 28,
        "Pedestrian Mobility": 18,
        "Community Services": 12,
        "Environmental Impact": 7
      }
    },
    {
      type: "adaptiveReuseOpportunities",
      title: "Downtown LA Adaptive Reuse Opportunity Index",
      data: [
        { id: "Site 1", name: "San Fernando Building", score: 92, category: "Housing", potentialROI: 3.1, timeToCompletion: 18 },
        { id: "Site 2", name: "Pacific Electric Building", score: 88, category: "Mixed-Use", potentialROI: 2.9, timeToCompletion: 24 },
        { id: "Site 3", name: "Skid Row North", score: 85, category: "Housing", potentialROI: 3.0, timeToCompletion: 16 },
        { id: "Site 4", name: "Arts District Warehouses", score: 83, category: "Mixed-Use", potentialROI: 2.7, timeToCompletion: 20 },
        { id: "Site 5", name: "Central Corridor", score: 81, category: "Commercial", potentialROI: 2.6, timeToCompletion: 14 },
        { id: "Site 6", name: "Historic Core Buildings", score: 90, category: "Housing", potentialROI: 3.2, timeToCompletion: 22 },
        { id: "Site 7", name: "Broadway Theater District", score: 86, category: "Cultural", potentialROI: 2.8, timeToCompletion: 26 },
        { id: "Site 8", name: "DTLA 2040 Zone", score: 89, category: "Mixed-Use", potentialROI: 3.0, timeToCompletion: 24 },
        { id: "Site 9", name: "East Gateway", score: 79, category: "Commercial", potentialROI: 2.5, timeToCompletion: 18 },
        { id: "Site 10", name: "South Connector", score: 77, category: "Mixed-Use", potentialROI: 2.4, timeToCompletion: 20 }
      ]
    },
    {
      type: "developmentTimeline",
      title: "Downtown LA Implementation Timeline vs ROI Potential",
      data: [
        { type: "Historic Building Adaptive Reuse", months: 18, roi: 38, investment: 650 },
        { type: "Skid Row Mobility Infrastructure", months: 10, roi: 32, investment: 320 },
        { type: "Transit Corridor Development", months: 14, roi: 30, investment: 480 },
        { type: "Arts District Revitalization", months: 20, roi: 35, investment: 580 },
        { type: "Green Alley Network", months: 12, roi: 28, investment: 270 }
      ]
    }
  ],
  adaptiveReuseMetrics: {
    totalSites: 14,
    averageOpportunityScore: 83.5,
    potentialHousingUnits: 2800,
    estimatedJobsCreated: 1250,
    walkabilityImprovement: 48,
    averageROI: 2.85,
    averageCompletionTime: 21.5
  },
  interventionDetails: [
    {
      name: "Adaptive Reuse - DTLA Historic Buildings",
      description: "Repurposing historic buildings in downtown Los Angeles under the Adaptive Reuse Ordinance to create mixed-use spaces with residential units and commercial areas.",
      cost: "$4.2M - $6.5M",
      timeframe: "16-24 months",
      benefits: ["Create 800+ housing units", "Preserve architectural heritage", "70% increase in property values"]
    },
    {
      name: "Central City Transit Corridors",
      description: "Developing pedestrian-friendly transit corridors in Central City North connecting Skid Row to Union Station with improved sidewalks, lighting, and rest areas.",
      cost: "$3.8M - $5.2M",
      timeframe: "12-18 months",
      benefits: ["58% increase in pedestrian flow", "42% reduction in transit time", "Enhanced accessibility to services"]
    },
    {
      name: "Skid Row Mobility Infrastructure",
      description: "Enhancing mobility infrastructure in Skid Row under the DTLA Mobility Improvement Plan (MIP), with focus on accessibility for high-need populations.",
      cost: "$2.1M - $3.7M",
      timeframe: "8-12 months",
      benefits: ["45% improved service navigation", "Creates safe waiting areas", "Increases service utilization by 42%"]
    }
  ]
};

// Handle the specialized urban impact question
export const handleUrbanImpactQuestion = async (message, messages, setMessages, setSkeletonLoading) => {
  try {
    // Ensure we have the setMessages function
    if (!setMessages || typeof setMessages !== 'function') {
      console.error("setMessages is not a function", typeof setMessages);
      return;
    }
    
    // Check if messages is passed correctly
    if (!messages) {
      console.warn("Messages not provided to handleUrbanImpactQuestion, initializing as empty array");
      messages = [];
    }
    
    // Define our phases explicitly
    window.currentLoadingPhase = "PHASE_1_ICONS";
    console.log("Starting loading phase 1: Loading steps with icons");
    
    // Set a new message directly
    setMessages(prev => {
      // Ensure prev is an array
      const prevMessages = Array.isArray(prev) ? prev : [];
      // We'll filter out any previous processing steps
      return prevMessages.filter(msg => 
        !msg.content || !msg.content.processingStep
      );
    });

    // Phase 1: Show loading steps with loading icons
    await addProcessingStep(messages, setMessages, "chart", "Analyzing your question...", true, "svg", "pulse");
    await delay(600);
    await addProcessingStep(messages, setMessages, "map", "Gathering geo-spatial data...", true, "svg", "bounce");
    await delay(600);
    await addProcessingStep(messages, setMessages, "search", "Identifying relevant interventions...", true, "svg", "wave");
    await delay(600);
    await addProcessingStep(messages, setMessages, "target", "Generating impact analysis...", true, "svg", "rotate");
    
    // Make sure phase 1 is visible for at least 1.5 seconds total
    await delay(1500);
    
    // Clear processing steps before starting phase 2
    setMessages(prev => {
      // Ensure prev is an array
      const prevMessages = Array.isArray(prev) ? prev : [];
      // Remove any processing steps
      return prevMessages.filter(msg => 
        !msg.content || !msg.content.processingStep
      );
    });
    
    // Ensure complete separation with a short delay
    await delay(200);

    // Phase 2: Skeleton loading
    window.currentLoadingPhase = "PHASE_2_SKELETON";
    console.log("Starting loading phase 2: Skeleton loading");
    
    // Add a message with the skeleton
    setMessages(prev => {
      // Ensure prev is an array
      const prevMessages = Array.isArray(prev) ? prev : [];
      return [
        ...prevMessages.filter(msg => !msg.content || !msg.content.showSkeleton), // Remove any existing skeleton
        {
          role: "assistant",
          content: {
            showSkeleton: true,
            preGraphText: "Analyzing data...",
            inSkeletonPhase: true // Add an explicit flag to help with conditional rendering
          }
        }
      ];
    });
    
    // Generate the content with the API
    try {
      // Actual API call - keeping this code unchanged
      const userQuestion = typeof message === 'string' ? message.trim() : "Finding Downtown parcels with the highest emergency resilience potential...";
      const response = await urbanImpactAnalysis(userQuestion);
      
      // Final phase - displaying actual content
      window.currentLoadingPhase = "PHASE_3_CONTENT";
      console.log("Starting loading phase 3: Showing content");
      
      // Add a small delay before removing skeleton and showing content
      await delay(400);
      
      // Update message state with actual content
      setMessages(prev => {
        // Ensure prev is an array
        const prevMessages = Array.isArray(prev) ? prev : [];
        return [
          ...prevMessages.filter(msg => !msg.content || !msg.content.showSkeleton), // Remove skeleton
          {
            role: "assistant",
            content: {
              text: response.explanation,
              graphData: response,
            }
          }
        ];
      });
      
      // Reset the loading phase when complete
      window.currentLoadingPhase = null;
      
    } catch (error) {
      console.error("Error in urban impact analysis:", error);
      window.currentLoadingPhase = null;
      setMessages(prev => {
        // Ensure prev is an array
        const prevMessages = Array.isArray(prev) ? prev : [];
        return [
          ...prevMessages.filter(msg => !msg.content || !msg.content.showSkeleton), // Remove skeleton
          {
            role: "assistant",
            content: {
              text: "I'm sorry, I encountered an error analyzing the urban impact. Please try again."
            }
          }
        ];
      });
    }
  } catch (error) {
    console.error("Error in handleUrbanImpactQuestion:", error);
    window.currentLoadingPhase = null;
    
    if (typeof setMessages === 'function') {
      setMessages(prev => {
        // Ensure prev is an array
        const prevMessages = Array.isArray(prev) ? prev : [];
        return [
          ...prevMessages,
          {
            role: "assistant",
            content: {
              text: "I'm sorry, I encountered an error analyzing the urban impact. Please try again."
            }
          }
        ];
      });
    }
  }
};

// Data for the service corridors response
export const SERVICE_CORRIDORS_DATA = {
  corridorGraphs: [
    {
      type: "serviceHubs",
      title: "Service Corridor Potential",
      data: [
        { name: "Skid Row North", potential: 85, timeframe: 6, category: "Mixed-Use", cost: "$1.2M" },
        { name: "Central Corridor", potential: 78, timeframe: 12, category: "Housing", cost: "$3.6M" },
        { name: "East Gateway", potential: 72, timeframe: 8, category: "Commercial", cost: "$2.2M" },
        { name: "South Connector", potential: 65, timeframe: 10, category: "Social Services", cost: "$1.8M" },
        { name: "West Access", potential: 70, timeframe: 9, category: "Healthcare", cost: "$2.5M" }
      ]
    }
  ],
  sitesMetrics: {
    totalAdaptiveSites: 43,
    totalDevelopmentSites: 58,
    highPrioritySites: 17,
    estimatedHousingUnits: 1680,
    estimatedServiceSpaceSqFt: 125000,
    averageWalkingDistance: 6.5,
    averageCompletionTime: 24
  },
  serviceDetails: [
    {
      name: "Mixed-Use Development",
      description: "Converting 12 underutilized buildings into mixed-use developments with ground-floor services and upper-level housing.",
      impact: "High",
      timeframe: "18-30 months",
      cost: "$7.4M",
      benefits: ["Creates 620+ housing units", "Provides 45,000 sq ft of service space", "Improves neighborhood cohesion"]
    },
    {
      name: "Healthcare Access Points",
      description: "Establishing 8 accessible healthcare facilities strategically placed along major pedestrian routes.",
      impact: "Medium-High",
      timeframe: "12-18 months",
      cost: "$5.2M",
      benefits: ["Reduces ER visits by 35%", "Increases preventative care access", "Supports ongoing treatment"]
    },
    {
      name: "Infrastructure & Data Centers",
      description: "Developing 3 high-capacity data centers with integrated renewable energy systems and smart grid connectivity.",
      impact: "High",
      timeframe: "15-24 months",
      cost: "$9.8M",
      benefits: ["Powers digital infrastructure", "Creates sustainable energy hub", "Enables smart city services"]
    }
  ]
};

// Handle the service corridors question
export const handleServiceCorridorsQuestion = async (map, setMessages, setIsLoading) => {
  try {
    setIsLoading(true);
    
    const effectiveMap = map || window.mapComponent?.map;
    
    if (!effectiveMap) {
      console.error("No map object available");
      return;
    }
    
    // Add user question to messages
    setMessages(prevMessages => [
      ...prevMessages,
      {
        isUser: true,
        content: "Show potential service corridors around Skid Row"
      }
    ]);
    
    // Try to load the Zoning scene immediately if it exists
    console.log("Attempting to load Zoning scene");
    if (window.mapComponent && typeof window.mapComponent.loadSceneByName === 'function') {
      const sceneLoaded = window.mapComponent.loadSceneByName("Zoning");
      console.log("Scene load attempt result:", sceneLoaded);
    }
    
    // Show only one loading step with a shorter delay
    await simulateGraphActionDelay(); // Use the faster 250ms delay
    
    setMessages(prevMessages => [
      ...prevMessages,
      {
        isUser: false,
        content: { 
          processingStep: true,
          icon: 'transit',
          iconType: 'svg',
          animation: 'wave',
          text: "Analyzing service corridor opportunities...",
          useWhiteIcons: true
        }
      }
    ]);
    
    // Return the response with service corridors data
    setMessages(prevMessages => {
      // First remove all processing step messages
      const withoutProcessingSteps = prevMessages.filter(msg => 
        !msg.content || !msg.content.processingStep
      );
      
      // Find the most recent user message
      const mostRecentUserMsgIndex = withoutProcessingSteps.findIndex(
        msg => msg.isUser && msg.content === "Show potential service corridors around Skid Row"
      );
      
      return [
        ...withoutProcessingSteps.slice(0, mostRecentUserMsgIndex >= 0 ? mostRecentUserMsgIndex + 1 : withoutProcessingSteps.length),
        { 
          isUser: false, 
          content: {
            preGraphText: "I've identified strategic service corridor opportunities around Skid Row that could significantly improve service access and neighborhood connectivity. Analysis shows three key approaches:",
            graphData: SERVICE_CORRIDORS_DATA,
            postGraphText: "Analysis of 43 adaptive reuse sites and 58 development potential sites reveals opportunities to create efficient service corridors connecting Skid Row to surrounding neighborhoods. The highest potential exists in the northern section, where implementing mixed-use developments would create both housing and service spaces. Converting underutilized buildings and strategically placing healthcare access points would significantly improve quality of life while requiring moderate investment compared to new construction.",
            followUpSuggestions: [
              {
                text: "What infrastructure improvements would have most impact?",
                prompt: "What infrastructure improvements would have most impact in Skid Row?",
                animationDelay: 0.1
              },
              {
                text: "Map South Park's daily necessity gaps",
                prompt: "Map South Park's daily necessity gaps",
                animationDelay: 0.2
              },
              {
                text: "Show priority pedestrian corridors connecting to Union Station",
                prompt: "Show priority pedestrian corridors connecting to Union Station",
                animationDelay: 0.3
              }
            ]
          } 
        }
      ];
    });
  } catch (error) {
    console.error("Error in handleServiceCorridorsQuestion:", error);
    setMessages(prevMessages => [
      ...prevMessages,
      {
        isUser: false,
        content: { 
          preGraphText: "I'm sorry, I encountered an error while analyzing service corridors around Skid Row. Please try again.",
          postGraphText: "You may want to check if all map layers are loaded correctly or try refreshing the page."
        }
      }
    ]);
  } finally {
    setIsLoading(false);
  }
};

// Data for the infrastructure improvements response
export const INFRASTRUCTURE_IMPROVEMENTS_DATA = {
  improvementsMetrics: {
    highImpactImprovements: 6,
    estimatedCost: "$28.2M",
    estimatedTimeframe: "18-36 months",
    pedestrianFlow: "+62%",
    serviceAccessibility: "+48%",
    communityConnectivity: "+57%"
  },
  improvementDetails: [
    {
      name: "Central Transit Connector",
      description: "Developing a pedestrian-friendly transit corridor connecting Skid Row to Union Station with improved sidewalks, lighting, and rest areas.",
      impact: "Very High",
      timeframe: "24-30 months",
      cost: "$8.5M",
      benefits: ["Reduces transit time by 18 minutes", "Increases pedestrian safety", "Connects to employment hubs"]
    },
    {
      name: "5th Street Revitalization",
      description: "Transforming 5th Street into a multi-modal corridor with separated bike lanes, wider sidewalks, and pedestrian plazas.",
      impact: "High",
      timeframe: "18-24 months",
      cost: "$6.3M",
      benefits: ["Creates neighborhood gateway", "Improves business accessibility", "Provides safe cycling route"]
    },
    {
      name: "Green Alley Network",
      description: "Converting underutilized alleys into green pedestrian pathways with permeable surfaces, native plantings, and pedestrian amenities.",
      impact: "Medium-High",
      timeframe: "12-18 months",
      cost: "$4.2M",
      benefits: ["Adds 2.8 miles of pedestrian paths", "Reduces urban heat island effect", "Creates micro-mobility network"]
    },
    {
      name: "Service Hub Access Points",
      description: "Establishing clearly defined, well-lit access points to service hubs with wayfinding elements and safety features.",
      impact: "High",
      timeframe: "8-12 months",
      cost: "$3.7M",
      benefits: ["Improves service navigation", "Creates safe waiting areas", "Increases utilization by 42%"]
    },
    {
      name: "Smart Intersection Upgrades",
      description: "Implementing pedestrian-priority intersections with extended crossing times, safety islands, and smart traffic management.",
      impact: "Medium",
      timeframe: "10-14 months",
      cost: "$5.5M",
      benefits: ["Reduces pedestrian accidents by 38%", "Prioritizes walking mobility", "Improves ADA accessibility"]
    }
  ]
};

// Handle the infrastructure improvements question
export const handleInfrastructureImprovementsQuestion = async (map, setMessages, setIsLoading) => {
  try {
    setIsLoading(true);
    
    const effectiveMap = map || window.mapComponent?.map;
    
    if (!effectiveMap) {
      console.error("No map object available");
      return;
    }
    
    // Add user question to messages
    setMessages(prevMessages => [
      ...prevMessages,
      {
        isUser: true,
        content: "What infrastructure improvements would have most impact in Skid Row?"
      }
    ]);
    
    // Try to load the "Next" scene immediately if it exists
    console.log("Attempting to load Next scene for infrastructure improvements");
    if (window.mapComponent && typeof window.mapComponent.loadSceneByName === 'function') {
      const sceneLoaded = window.mapComponent.loadSceneByName("Next");
      console.log("Next scene load attempt result:", sceneLoaded);
    }
    
    // Show a quick loading step
    await simulateGraphActionDelay();
    
    setMessages(prevMessages => [
      ...prevMessages,
      {
        isUser: false,
        content: { 
          processingStep: true,
          icon: 'infrastructure',
          iconType: 'svg',
          animation: 'rotate',
          text: "Analyzing infrastructure improvement options...",
          useWhiteIcons: true
        }
      }
    ]);
    
    // Return the response with infrastructure improvements data
    setMessages(prevMessages => {
      // First remove all processing step messages
      const withoutProcessingSteps = prevMessages.filter(msg => 
        !msg.content || !msg.content.processingStep
      );
      
      // Find the most recent user message
      const mostRecentUserMsgIndex = withoutProcessingSteps.findIndex(
        msg => msg.isUser && msg.content === "What infrastructure improvements would have most impact in Skid Row?"
      );
      
      return [
        ...withoutProcessingSteps.slice(0, mostRecentUserMsgIndex >= 0 ? mostRecentUserMsgIndex + 1 : withoutProcessingSteps.length),
        { 
          isUser: false, 
          content: {
            preGraphText: "Based on my analysis of Skid Row's connectivity challenges, these infrastructure improvements would create the greatest positive impact for residents and service providers:",
            graphData: {
              infrastructureDetails: INFRASTRUCTURE_IMPROVEMENTS_DATA.improvementDetails,
              improvementsMetrics: INFRASTRUCTURE_IMPROVEMENTS_DATA.improvementsMetrics
            },
            postGraphText: "The Central Transit Connector would have the highest overall impact by significantly reducing travel time between Skid Row and key transit hubs. When combined with the 5th Street Revitalization, these improvements would create a comprehensive mobility network that enhances both north-south and east-west connectivity. The Green Alley Network provides a cost-effective opportunity to expand pedestrian paths while adding much-needed green space to the area.",
            followUpSuggestions: [
              {
                text: "Show potential funding sources for these improvements",
                prompt: "What are potential funding sources for Skid Row infrastructure improvements?",
                animationDelay: 0.1
              },
              {
                text: "Compare to similar initiatives in other cities",
                prompt: "Show examples of similar infrastructure improvements in other cities",
                animationDelay: 0.2
              },
              {
                text: "What community engagement would be needed?",
                prompt: "What community engagement would be needed for Skid Row improvements?",
                animationDelay: 0.3
              }
            ]
          } 
        }
      ];
    });
  } catch (error) {
    console.error("Error in handleInfrastructureImprovementsQuestion:", error);
    setMessages(prevMessages => [
      ...prevMessages,
      {
        isUser: false,
        content: { 
          preGraphText: "I'm sorry, I encountered an error while analyzing infrastructure improvements for Skid Row. Please try again.",
          postGraphText: "You may want to check if all map layers are loaded correctly or try refreshing the page."
        }
      }
    ]);
  } finally {
    setIsLoading(false);
  }
}; 

// Add new data constant for renewable energy capacity
export const INFRASTRUCTURE_DATA = {
  renewableCapacity: [
    { neighborhood: "Valley Glen", capacity: 45.2, potential: 78.5, type: "Solar" },
    { neighborhood: "North Hills", capacity: 42.8, potential: 72.3, type: "Mixed" },
    { neighborhood: "Chatsworth", capacity: 38.5, potential: 65.7, type: "Solar" },
    { neighborhood: "Sherman Oaks", capacity: 35.7, potential: 58.9, type: "Mixed" },
    { neighborhood: "Van Nuys", capacity: 33.2, potential: 61.4, type: "Solar" },
    { neighborhood: "Studio City", capacity: 31.8, potential: 54.2, type: "Mixed" },
    { neighborhood: "Northridge", capacity: 29.4, potential: 52.8, type: "Solar" },
    { neighborhood: "Panorama City", capacity: 27.9, potential: 49.5, type: "Solar" },
    { neighborhood: "Granada Hills", capacity: 26.3, potential: 47.1, type: "Mixed" },
    { neighborhood: "Sun Valley", capacity: 24.8, potential: 45.6, type: "Solar" }
  ],
  metrics: {
    totalCapacity: "335.6 MW",
    potentialCapacity: "+586.0 MW (174% increase)",
    solarPercentage: "65% Solar, 35% Mixed Energy",
    peakDemandCoverage: "42% of Peak Grid Demand"
  }
};

// Add handler function for infrastructure visualization
export const handleInfrastructureVisualization = async (map, setMessages, setIsLoading) => {
  console.log("🚀 Starting handleInfrastructureVisualization");
  try {
    setIsLoading(true);
    
    // Add custom message to indicate we're viewing infrastructure data
    console.log("👤 Adding user message");
    setMessages(prevMessages => [
      ...prevMessages,
      {
        isUser: true,
        content: "View Infrastructure & Data Centers Analysis"
      }
    ]);
    
    // Show loading step
    await simulateGraphActionDelay();
    
    console.log("⏳ Adding processing message");
    setMessages(prevMessages => [
      ...prevMessages,
      {
        isUser: false,
        content: { 
          processingStep: true,
          icon: 'analytics',
          iconType: 'svg',
          animation: 'pulse',
          text: "Analyzing renewable energy infrastructure...",
          useWhiteIcons: true
        }
      }
    ]);
    
    // Return the response with infrastructure data
    console.log("📊 Preparing visualization data with type 'renewableEnergy'");
    
    // Create the content payload
    const contentPayload = {
      type: "renewableEnergy",
      preGraphText: "Based on our analysis of renewable energy infrastructure across Los Angeles neighborhoods, here's a detailed breakdown of current capacity and future potential:",
      data: INFRASTRUCTURE_DATA,
      visualization: {
        title: "Neighborhood Renewable Energy Capacity",
        data: INFRASTRUCTURE_DATA.renewableCapacity.sort((a, b) => b.capacity - a.capacity),
        xAxis: {
          dataKey: "neighborhood",
          label: "Neighborhoods"
        },
        yAxis: {
          label: "Capacity (MW)"
        },
        bars: [
          {
            dataKey: "capacity",
            name: "Current Capacity",
            color: "#8b5cf6"
          },
          {
            dataKey: "potential",
            name: "Potential Capacity",
            color: "#c084fc"
          }
        ]
      },
      postGraphText: "The data reveals significant opportunities for expanding renewable energy capacity, particularly in Valley Glen and North Hills. Key findings:\n\n" +
                   `• Total Current Capacity: ${INFRASTRUCTURE_DATA.metrics.totalCapacity}\n` +
                   `• Potential Growth: ${INFRASTRUCTURE_DATA.metrics.potentialCapacity}\n` +
                   `• Solar Adoption: ${INFRASTRUCTURE_DATA.metrics.solarPercentage}\n` +
                   `• Peak Demand Coverage: ${INFRASTRUCTURE_DATA.metrics.peakDemandCoverage}\n\n` +
                   "The proposed data centers would be strategically placed to maximize grid efficiency while maintaining sustainable power distribution through integrated renewable sources.",
      quickActions: [
        {
          text: "Resource Planning",
          prompt: "SHOW_SOLAR_POTENTIAL",
          icon: "☀️",
          description: "View detailed solar capacity"
        },
        {
          text: "Grid Integration",
          prompt: "SHOW_GRID_INTEGRATION",
          icon: "🔌",
          description: "Smart grid connectivity"
        },
        {
          text: "Future Projections",
          prompt: "SHOW_ENERGY_FORECAST",
          icon: "📈",
          description: "2024-2025 capacity forecast"
        }
      ]
    };
    
    console.log("📝 Content payload:", contentPayload);
    
    setMessages(prevMessages => {
      // Remove processing step messages
      const withoutProcessingSteps = prevMessages.filter(msg => 
        !msg.content || !msg.content.processingStep
      );
      
      // Find the most recent user message
      const mostRecentUserMsgIndex = withoutProcessingSteps.findIndex(
        msg => msg.isUser && msg.content === "View Infrastructure & Data Centers Analysis"
      );
      
      const newMessages = [
        ...withoutProcessingSteps.slice(0, mostRecentUserMsgIndex >= 0 ? mostRecentUserMsgIndex + 1 : withoutProcessingSteps.length),
        { 
          isUser: false, 
          content: contentPayload
        }
      ];
      
      console.log("✅ Final message structure:", newMessages[newMessages.length - 1]);
      return newMessages;
    });
  } catch (error) {
    console.error("Error in handleInfrastructureVisualization:", error);
    setMessages(prevMessages => [
      ...prevMessages,
      {
        isUser: false,
        content: { 
          type: "renewableEnergy",
          preGraphText: "I'm sorry, I encountered an error while analyzing the infrastructure data. Please try again.",
          postGraphText: "You may want to check if all map layers are loaded correctly or try refreshing the page."
        }
      }
    ]);
  } finally {
    setIsLoading(false);
  }
};

// Utility function for delays with promises
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Utility function to add processing steps in the message UI
export const addProcessingStep = async (messages, setMessages, icon, text, useWhiteIcons = false, iconType = null, animation = null) => {
  // Ensure we have the setMessages function
  if (!setMessages || typeof setMessages !== 'function') {
    console.error("setMessages is not a function in addProcessingStep", typeof setMessages);
    return;
  }
  
  setMessages(prev => {
    // Ensure prev is an array
    const prevMessages = Array.isArray(prev) ? prev : [];
    
    // Find existing assistant message with processing steps
    const existingAssistantMessageIndex = prevMessages.findIndex(msg => 
      msg.role === "assistant" && msg.content && Array.isArray(msg.content.steps)
    );
    
    if (existingAssistantMessageIndex >= 0) {
      // Update existing message with a new step
      const updatedMessages = [...prevMessages];
      updatedMessages[existingAssistantMessageIndex] = {
        ...updatedMessages[existingAssistantMessageIndex],
        content: {
          ...updatedMessages[existingAssistantMessageIndex].content,
          steps: [
            ...updatedMessages[existingAssistantMessageIndex].content.steps,
            { icon, text, useWhiteIcons, iconType, animation }
          ]
        }
      };
      return updatedMessages;
    } else {
      // Create a new consolidated message with steps array
      return [
        ...prevMessages.filter(msg => 
          !msg.content || !msg.content.processingStep
        ),
        {
          role: "assistant",
          content: { 
            steps: [{ icon, text, useWhiteIcons, iconType, animation }],
            processingStep: true
          }
        }
      ];
    }
  });
  
  // Return a promise that resolves after a short delay
  return delay(100);
};

// Mock function for urban impact analysis API call
export const urbanImpactAnalysis = async (question) => {
  // Simulate API delay
  await delay(1500);
  
  // Return mock data
  return {
    explanation: "I've identified key areas in Downtown Los Angeles where strategic interventions could yield maximum impact with minimal changes. Based on analysis of adaptive reuse potential and development opportunities, three specific interventions stand out.",
    interventionDetails: [
      {
        name: "Adaptive Reuse - DTLA Historic Buildings",
        description: "Repurposing historic buildings in downtown Los Angeles under the Adaptive Reuse Ordinance to create mixed-use spaces with residential units and commercial areas.",
        cost: "$4.2M - $6.5M",
        timeframe: "16-24 months",
        benefits: ["Create 800+ housing units", "Preserve architectural heritage", "70% increase in property values"]
      },
      {
        name: "Central City Transit Corridors",
        description: "Developing pedestrian-friendly transit corridors in Central City North connecting Skid Row to Union Station with improved sidewalks, lighting, and rest areas.",
        cost: "$3.8M - $5.2M",
        timeframe: "12-18 months",
        benefits: ["58% increase in pedestrian flow", "42% reduction in transit time", "Enhanced accessibility to services"]
      },
      {
        name: "Skid Row Mobility Infrastructure",
        description: "Enhancing mobility infrastructure in Skid Row under the DTLA Mobility Improvement Plan (MIP), with focus on accessibility for high-need populations.",
        cost: "$2.1M - $3.7M",
        timeframe: "8-12 months",
        benefits: ["45% improved service navigation", "Creates safe waiting areas", "Increases service utilization by 42%"]
      }
    ],
    impactGraphs: [
      {
        type: "priorityMatrix",
        title: "Downtown LA Impact Priority Matrix",
        data: [
          { name: "Adaptive Reuse - Historic Core", effort: 60, impact: 92, category: "Housing", roi: 3.2 },
          { name: "Transit Corridors - Skid Row", effort: 55, impact: 85, category: "Transit", roi: 2.8 },
          { name: "Mobility Infrastructure", effort: 45, impact: 78, category: "Pedestrian", roi: 2.5 },
          { name: "Green Alley Network", effort: 40, impact: 65, category: "Green", roi: 2.2 },
          { name: "Service Hub Access Points", effort: 30, impact: 72, category: "Safety", roi: 2.9 }
        ]
      }
    ]
  };
};

// Handle neighborhood selection and display in the AIChatPanel
export const handleNeighborhoodSelection = async (neighborhoodData, setMessages) => {
  try {
    if (!setMessages || typeof setMessages !== 'function') {
      console.warn("setMessages is not a function in handleNeighborhoodSelection");
      return;
    }

    // Brief delay to simulate processing
    await simulateQuickActionDelay();
    
    // Format the content for the neighborhood data
    const neighborhoodMessage = {
      isUser: true,
      content: `Show development sites in ${neighborhoodData.name}`
    };
    
    // Create adaptive reuse site cards
    const adaptiveReuseCards = neighborhoodData.adaptiveReuse.map((marker, index) => {
      const mockScore = Math.floor(60 + Math.random() * 35); // Random score between 60-95
      const mockSources = [
        'LA City Planning Dept',
        'Community Redevelopment Agency',
        'Housing Innovation Challenge',
        'Mayor\'s Office',
        'LA County Housing Authority',
        'Urban Land Institute'
      ];
      const source = mockSources[index % mockSources.length];
      
      return {
        type: 'Adaptive Reuse',
        title: `Adaptive Reuse Site ${index + 1}`,
        description: marker.properties?.description || 'No description available',
        score: marker.properties?.quality_score || marker.properties?.score || mockScore,
        source: marker.properties?.source || source
      };
    });
    
    // Create development potential site cards
    const developmentCards = neighborhoodData.development.map((marker, index) => {
      const mockScore = Math.floor(55 + Math.random() * 35); // Random score between 55-90
      const mockSources = [
        'City Planning Commission',
        'Dept of Building & Safety',
        'LA City Council District Office',
        'Metro Transit Authority',
        'Private Developer Submission',
        'Economic Development Dept'
      ];
      const source = mockSources[index % mockSources.length];
      
      return {
        type: 'Development',
        title: `Development Site ${index + 1}`,
        description: marker.properties?.description || 'No description available',
        score: marker.properties?.quality_score || marker.properties?.score || mockScore,
        source: marker.properties?.source || source
      };
    });
    
    // Create response content object
    const responseContent = {
      neighborhoodData: {
        name: neighborhoodData.name,
        totalSites: neighborhoodData.markerCount,
        adaptiveReuseSites: adaptiveReuseCards,
        developmentSites: developmentCards
      },
      preGraphText: `Analyzing development opportunities in ${neighborhoodData.name}...`,
      postGraphText: `Found ${neighborhoodData.markerCount} total development sites (${neighborhoodData.adaptiveReuse.length} adaptive reuse, ${neighborhoodData.development.length} new development).`
    };
    
    // Add messages to the chat panel
    setMessages(prevMessages => [
      ...prevMessages,
      neighborhoodMessage,
      {
        isUser: false,
        content: responseContent
      }
    ]);
    
    return true;
  } catch (error) {
    console.error('Error handling neighborhood selection:', error);
    return false;
  }
};