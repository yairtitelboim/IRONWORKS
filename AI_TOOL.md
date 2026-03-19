# AI Tool Integration Strategy: Context-Aware Query Processing

## Overview

This document outlines a reusable strategy for integrating AI tools (Perplexity, Claude, GPT, etc.) with our FIFA Houston infrastructure data context. The approach focuses on creating a flexible, context-aware query processing system that can work with multiple LLMs while maintaining consistency and reusability.

## Current Data Context

Based on our available JSON data sources in `/public/`:

### 🏗️ **Houston-Relevant Data Sources**

#### 1. **FIFA Houston Infrastructure Cache** 
- **File**: [`fifa-houston-cache.json`](/public/fifa-houston-cache.json) (3.4MB, 152,408 lines)
- **Type**: FIFA-related infrastructure and development data
- **Key Fields**: Infrastructure data, development patterns, FIFA venue context
- **Geographic Scope**: Houston area FIFA 2026 preparations
- **Use Case**: FIFA infrastructure analysis, development impact assessment

#### 2. **Houston Commercial Properties**
- **File**: [`houston_commercial_properties_smart_enhanced.json`](/public/houston_commercial_properties_smart_enhanced.json) (25KB, 1,053 lines)
- **Type**: Commercial real estate data
- **Key Fields**: Property details, pricing, location, amenities
- **Geographic Scope**: Houston commercial real estate market
- **Use Case**: Commercial property analysis, market intelligence

#### 3. **Houston Startup Infrastructure**
- **File**: [`startup-geographic-intelligence.geojson`](/public/startup-geographic-intelligence.geojson) (368KB, 5,716 lines)
- **Type**: Geographic intelligence for startups
- **Key Fields**: Location data, infrastructure proximity, market analysis
- **Geographic Scope**: Houston startup ecosystem
- **Use Case**: Startup location analysis, infrastructure assessment

#### 4. **Houston Startup Companies**
- **File**: [`startup-companies.json`](/public/startup-companies.json) (42KB, 1,363 lines)
- **Type**: Startup company data
- **Key Fields**: Company details, funding, location, industry
- **Geographic Scope**: Houston startup ecosystem
- **Use Case**: Startup ecosystem analysis, company intelligence

#### 5. **Houston Companies Database**
- **File**: [`companies/companies-9-24-2025-geocoded.json`](/public/companies/companies-9-24-2025-geocoded.json) (33MB+)
- **Type**: Comprehensive business database with geocoding
- **Key Fields**: Company names, addresses, coordinates, business types
- **Geographic Scope**: Houston metropolitan area businesses
- **Use Case**: Business density analysis, market intelligence, spatial clustering

#### 6. **TDLR Construction Data**
- **File**: [`Listings/TLDR/tdlr_houston_all_precise.geojson`](/public/Listings/TLDR/tdlr_houston_all_precise.geojson)
- **Type**: Texas Department of Licensing and Regulation construction permits
- **Key Fields**: Project details, permits, construction data
- **Geographic Scope**: Houston construction projects
- **Use Case**: Construction analysis, development tracking, permit correlation

### 📊 **Visualization Assets**
- **Files**: 
  - [`startup_infrastructure_heatmap.png`](/public/startup_infrastructure_heatmap.png) (235KB)
  - [`startup_clustering_analysis.png`](/public/startup_clustering_analysis.png) (395KB)
- **Type**: Analysis visualization images
- **Use Case**: Visual context for AI analysis, reference materials

## Proposed Architecture

### 1. **Context Processor Layer**

```javascript
// ContextProcessor.js
class ContextProcessor {
  constructor(dataSources) {
    this.dataSources = dataSources;
    this.contextCache = new Map();
  }

  // Process and structure context based on query intent
  processContext(query, intent) {
    const relevantData = this.extractRelevantData(query, intent);
    return this.structureForLLM(relevantData, intent);
  }

  // Extract relevant data based on query analysis
  extractRelevantData(query, intent) {
    const keywords = this.extractKeywords(query);
    const geographicScope = this.detectGeographicScope(query);
    
    return {
      fifa: this.filterFIFAData(keywords, geographicScope),
      companies: this.filterCompaniesData(keywords, geographicScope),
      realEstate: this.filterRealEstateData(keywords, geographicScope),
      startups: this.filterStartupData(keywords, geographicScope),
      tdlr: this.filterTDLRData(keywords, geographicScope)
    };
  }

  // Structure data for specific LLM
  structureForLLM(data, intent, llmType = 'perplexity') {
    const formatters = {
      perplexity: this.formatForPerplexity,
      claude: this.formatForClaude,
      gpt: this.formatForGPT
    };
    
    return formatters[llmType](data, intent);
  }
}
```

### 2. **Query Intent Classification**

```javascript
// QueryIntentClassifier.js
class QueryIntentClassifier {
  classifyIntent(query) {
    const patterns = {
      construction: ['construction', 'building', 'project', 'permit', 'contractor'],
      infrastructure: ['infrastructure', 'utility', 'power', 'water', 'transportation'],
      realEstate: ['property', 'real estate', 'housing', 'commercial', 'residential'],
      fifa: ['fifa', 'venue', 'stadium', 'event', 'capacity'],
      analysis: ['analyze', 'compare', 'trend', 'pattern', 'insight'],
      location: ['near', 'within', 'distance', 'proximity', 'location']
    };

    const scores = {};
    Object.keys(patterns).forEach(intent => {
      scores[intent] = patterns[intent].reduce((score, keyword) => {
        return score + (query.toLowerCase().includes(keyword) ? 1 : 0);
      }, 0);
    });

    return Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
  }
}
```

### 3. **LLM-Specific Formatters**

#### Perplexity Formatter
```javascript
formatForPerplexity(data, intent) {
  const context = {
    systemPrompt: `You are an expert analyst specializing in Houston infrastructure and FIFA 2026 preparations. 
    You have access to real-time data about construction projects, infrastructure, and real estate in the Houston area.
    Provide detailed, data-driven insights with specific references to the provided context.`,
    
    contextData: this.structureContextData(data),
    queryInstructions: this.getQueryInstructions(intent)
  };

  return {
    messages: [{
      role: 'system',
      content: context.systemPrompt
    }, {
      role: 'user', 
      content: `${context.queryInstructions}\n\nContext Data:\n${JSON.stringify(context.contextData, null, 2)}`
    }]
  };
}
```

#### Claude Formatter
```javascript
formatForClaude(data, intent) {
  return {
    systemPrompt: `You are a Houston infrastructure expert analyzing data for FIFA 2026 preparations.
    Focus on actionable insights and strategic recommendations.`,
    context: this.structureContextData(data),
    instructions: this.getClaudeInstructions(intent)
  };
}
```

### 4. **Context Data Structure**

```javascript
// Standardized context structure for all LLMs
structureContextData(data) {
  return {
    metadata: {
      timestamp: new Date().toISOString(),
      dataSource: 'houston-fifa-multi-source',
      geographicScope: 'Houston, TX',
      totalRecords: this.countTotalRecords(data)
    },
    fifa: {
      summary: this.summarizeFIFAData(data.fifa),
      venues: data.fifa,
      statistics: this.calculateFIFAStats(data.fifa)
    },
    companies: {
      summary: this.summarizeCompaniesData(data.companies),
      businesses: data.companies.slice(0, 15), // Top 15 most relevant
      statistics: this.calculateCompaniesStats(data.companies)
    },
    realEstate: {
      summary: this.summarizeRealEstateData(data.realEstate),
      properties: data.realEstate.slice(0, 10), // Top 10 most relevant
      statistics: this.calculateRealEstateStats(data.realEstate)
    },
    startups: {
      summary: this.summarizeStartupData(data.startups),
      companies: data.startups.slice(0, 10), // Top 10 most relevant
      statistics: this.calculateStartupStats(data.startups)
    },
    construction: {
      summary: this.summarizeTDLRData(data.tdlr),
      projects: data.tdlr.slice(0, 10), // Top 10 most relevant
      statistics: this.calculateTDLRStats(data.tdlr)
    }
  };
}
```

## Phased Implementation Strategy

### Phase 1: Perplexity Proof-of-Concept (Houston FIFA Case Study)

**Goal**: Transform `PerplexityCall.jsx` from a toggle button into a functional API integration that demonstrates the methodology using Houston FIFA data as a proof-of-concept.

#### **Phase 1 Objectives**
1. **API Integration**: Make `PerplexityCall.jsx` actually call the Perplexity API
2. **Data Stream Testing**: Feed different JSON data sources to Perplexity
3. **JSON Response Processing**: Get structured JSON responses back from Perplexity
4. **Map Visualization**: Display responses as sequential map layers to tell a story
5. **Methodology Validation**: Prove the approach works before scaling to multi-model

#### **Phase 1 Implementation Plan**

##### **1.1 Enhanced PerplexityCall.jsx**
```javascript
// Current: Just a toggle button
const handleClick = () => {
  if (onClick) {
    onClick(); // Only toggles mode
  }
};

// Phase 1: Actual API integration
const handleClick = async () => {
  setIsLoading(true);
  try {
    // 1. Prepare context from available data sources
    const context = await prepareHoustonFIFAContext();
    
    // 2. Call Perplexity API with structured prompt
    const response = await callPerplexityAPI(context);
    
    // 3. Process JSON response
    const analysis = parsePerplexityResponse(response);
    
    // 4. Update map with sequential layers
    await visualizeAnalysisOnMap(analysis);
    
  } catch (error) {
    console.error('Perplexity analysis failed:', error);
  } finally {
    setIsLoading(false);
  }
};
```

##### **1.2 Data Context Preparation**
```javascript
async function prepareHoustonFIFAContext() {
  // Load and structure available data sources
  const dataContext = {
    fifa: await loadFIFAData(), // fifa-houston-cache.json
    companies: await loadCompaniesData(), // companies-9-24-2025-geocoded.json
    realEstate: await loadRealEstateData(), // houston_commercial_properties_smart_enhanced.json
    startups: await loadStartupData(), // startup-companies.json
    construction: await loadTDLRData(), // tdlr_houston_all_precise.geojson
    geographic: {
      center: { lat: 29.7604, lng: -95.3698 }, // Houston coordinates
      radius: 5000 // 5km analysis radius
    }
  };
  
  return dataContext;
}
```

##### **1.3 Perplexity API Integration**
```javascript
async function callPerplexityAPI(context) {
  const prompt = `
You are analyzing Houston's FIFA 2026 preparation and its potential impact on local development.

Available Data:
- FIFA Infrastructure: ${context.fifa.length} records
- Local Businesses: ${context.companies.length} companies
- Real Estate: ${context.realEstate.length} properties
- Startups: ${context.startups.length} companies
- Construction: ${context.construction.length} projects

Analysis Request:
Analyze how FIFA 2026 infrastructure might create development catalysts in Houston. 
Focus on spatial patterns, business clustering, and potential growth zones.

Respond with a JSON structure containing:
1. catalystZones: Areas where FIFA investment might trigger development
2. businessClusters: Current business density patterns
3. growthPredictions: Potential development scenarios
4. mapLayers: Specific coordinates and data for visualization

Format your response as valid JSON only.
  `;

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.REACT_APP_PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.3
    })
  });

  return await response.json();
}
```

##### **1.4 Response Processing & Map Visualization**
```javascript
function parsePerplexityResponse(response) {
  try {
    const content = response.choices[0].message.content;
    const analysis = JSON.parse(content);
    
    return {
      catalystZones: analysis.catalystZones || [],
      businessClusters: analysis.businessClusters || [],
      growthPredictions: analysis.growthPredictions || [],
      mapLayers: analysis.mapLayers || [],
      confidence: analysis.confidence || 0.8,
      methodology: analysis.methodology || 'Perplexity spatial analysis'
    };
  } catch (error) {
    console.error('Failed to parse Perplexity response:', error);
    return null;
  }
}

async function visualizeAnalysisOnMap(analysis) {
  if (!analysis) return;
  
  // Clear existing layers
  clearMapLayers();
  
  // Add layers sequentially to tell the story
  await addBusinessClustersLayer(analysis.businessClusters);
  await delay(1000); // Pause for visual effect
  
  await addCatalystZonesLayer(analysis.catalystZones);
  await delay(1000);
  
  await addGrowthPredictionsLayer(analysis.growthPredictions);
  await delay(1000);
  
  // Add final analysis summary
  await addAnalysisSummaryLayer(analysis);
}
```

##### **1.5 Sequential Storytelling & Map Visualization**

**What the User Sees: Interactive Map Storytelling**

When a user asks a question in the "Ask Perplexity" component, the system transforms the AI response into a visual narrative on the map using three core scenarios:

###### **Scenario 1: "EaDo Becomes Houston's Permanent Party District"**
```javascript
// User Query: "How will FIFA 2026 transform EaDo into an entertainment district?"

// Map Layers Generated:
const eadoScenario = {
  // Layer 1: Current Entertainment Venues (Blue Circles)
  currentVenues: {
    source: 'serp-startup-ecosystem-markers',
    filter: ['==', ['get', 'category'], 'entertainment_venue'],
    paint: {
      'circle-color': '#3b82f6', // Blue
      'circle-radius': 8,
      'circle-opacity': 0.8
    },
    legendItem: {
      label: 'Current Entertainment Venues',
      color: '#3b82f6',
      count: 34,
      description: 'Existing bars, clubs, and entertainment spots'
    }
  },
  
  // Layer 2: FIFA Infrastructure Investment (Green Polygons)
  fifaInvestment: {
    source: 'osm-features',
    filter: ['==', ['get', 'category'], 'entertainment_venue'],
    paint: {
      'fill-color': 'rgba(16, 185, 129, 0.3)', // Green fill
      'line-color': '#10b981', // Green border
      'line-width': 2
    },
    legendItem: {
      label: 'FIFA Entertainment Zones',
      color: '#10b981',
      count: 15,
      description: 'New entertainment infrastructure planned'
    }
  },
  
  // Layer 3: Development Catalyst Zones (Orange Heatmap)
  catalystZones: {
    source: 'perplexity-analysis',
    type: 'heatmap',
    paint: {
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['get', 'development_potential'],
        0, 'rgba(0, 0, 255, 0)',
        0.5, 'rgba(255, 165, 0, 0.5)',
        1, 'rgba(255, 0, 0, 0.8)'
      ],
      'heatmap-radius': 50,
      'heatmap-opacity': 0.6
    },
    legendItem: {
      label: 'Development Catalyst Zones',
      color: '#f59e0b',
      count: 8,
      description: 'Areas with highest development potential'
    }
  }
};
```

###### **Scenario 2: "Walkability Beats FIFA Proximity"**
```javascript
// User Query: "Which areas prioritize pedestrian access over FIFA venue distance?"

// Map Layers Generated:
const walkabilityScenario = {
  // Layer 1: Current Walkability Score (Purple Lines)
  walkabilityRoutes: {
    source: 'osm-features',
    filter: ['==', ['get', 'category'], 'pedestrian_zone'],
    paint: {
      'line-color': [
        'interpolate',
        ['linear'],
        ['get', 'walkability_score'],
        0, '#6b7280', // Gray for low walkability
        0.5, '#8b5cf6', // Purple for medium
        1, '#7c3aed' // Bright purple for high
      ],
      'line-width': [
        'interpolate',
        ['linear'],
        ['get', 'walkability_score'],
        0, 2,
        1, 6
      ]
    },
    legendItem: {
      label: 'Walkability Routes',
      color: '#8b5cf6',
      count: 67,
      description: 'Pedestrian-friendly pathways and plazas'
    }
  },
  
  // Layer 2: FIFA Venue Proximity (Red Circles)
  fifaProximity: {
    source: 'fifa-venues',
    paint: {
      'circle-color': '#dc2626', // Red
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['get', 'distance_to_fifa'],
        0, 12, // Large for close
        2000, 4 // Small for far
      ],
      'circle-opacity': 0.7
    },
    legendItem: {
      label: 'FIFA Venue Proximity',
      color: '#dc2626',
      count: 12,
      description: 'Distance to FIFA 2026 venues'
    }
  },
  
  // Layer 3: Property Value Impact (Yellow Heatmap)
  propertyImpact: {
    source: 'real-estate-analysis',
    type: 'heatmap',
    paint: {
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['get', 'walkability_impact'],
        0, 'rgba(255, 255, 0, 0)',
        0.5, 'rgba(255, 255, 0, 0.3)',
        1, 'rgba(255, 255, 0, 0.6)'
      ]
    },
    legendItem: {
      label: 'Walkability Impact on Property Values',
      color: '#fbbf24',
      count: 45,
      description: 'Properties where walkability matters more than FIFA proximity'
    }
  }
};
```

###### **Scenario 3: "Unexpected Development Spillover"**
```javascript
// User Query: "Where might FIFA investment trigger development in unexpected areas?"

// Map Layers Generated:
const spilloverScenario = {
  // Layer 1: Unexpected Catalyst Nodes (Pink Circles)
  unexpectedNodes: {
    source: 'perplexity-analysis',
    filter: ['==', ['get', 'analysis_type'], 'unexpected_catalyst'],
    paint: {
      'circle-color': '#ec4899', // Pink
      'circle-radius': 10,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
      'circle-opacity': 0.9
    },
    legendItem: {
      label: 'Unexpected Catalyst Nodes',
      color: '#ec4899',
      count: 15,
      description: 'Areas where FIFA spending triggers unexpected development'
    }
  },
  
  // Layer 2: Market Forces Ignoring FIFA (Gray Polygons)
  marketForces: {
    source: 'market-analysis',
    filter: ['==', ['get', 'fifa_ignored'], true],
    paint: {
      'fill-color': 'rgba(107, 114, 128, 0.2)',
      'line-color': '#6b7280',
      'line-width': 1,
      'line-dasharray': [2, 2]
    },
    legendItem: {
      label: 'Market Forces Ignoring FIFA',
      color: '#6b7280',
      count: 8,
      description: 'Areas where development follows different patterns'
    }
  },
  
  // Layer 3: Development Probability (Color-coded Heatmap)
  developmentProbability: {
    source: 'spatial-analysis',
    type: 'heatmap',
    paint: {
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['get', 'development_probability'],
        0, 'rgba(0, 0, 0, 0)',
        0.3, 'rgba(255, 0, 0, 0.2)',
        0.6, 'rgba(255, 165, 0, 0.4)',
        1, 'rgba(0, 255, 0, 0.6)'
      ]
    },
    legendItem: {
      label: 'Development Probability',
      color: '#10b981',
      count: 23,
      description: 'Probability of development in unexpected areas'
    }
  }
};
```

###### **Layer Toggle Integration with LegendContainer.jsx**

The `LegendContainer.jsx` component will dynamically show/hide these layers based on the Perplexity analysis:

```javascript
// Enhanced LegendContainer for Perplexity Analysis
const perplexityLegendSections = [
  {
    title: 'Perplexity Analysis Results',
    items: [
      {
        label: 'Current State',
        color: '#3b82f6',
        count: 34,
        category: 'current_venues',
        isVisible: true,
        type: 'circle'
      },
      {
        label: 'FIFA Investment Zones',
        color: '#10b981',
        count: 15,
        category: 'fifa_zones',
        isVisible: true,
        type: 'polygon'
      },
      {
        label: 'Catalyst Zones',
        color: '#f59e0b',
        count: 8,
        category: 'catalyst_zones',
        isVisible: true,
        type: 'heatmap'
      },
      {
        label: 'Development Predictions',
        color: '#ec4899',
        count: 15,
        category: 'predictions',
        isVisible: true,
        type: 'circle'
      }
    ]
  }
];
```

###### **AIResponseDisplayRefactored.jsx Integration**

The response display component will narrate the story as layers appear:

```javascript
// Storytelling sequence in AIResponseDisplayRefactored.jsx
const storyNarration = {
  eadoScenario: [
    {
      step: 1,
      title: "Current Entertainment Landscape",
      description: "EaDo currently has 34 entertainment venues scattered across the district...",
      mapAction: "showCurrentVenues",
      duration: 3000
    },
    {
      step: 2,
      title: "FIFA Infrastructure Investment",
      description: "FIFA 2026 will add 15 new entertainment zones, creating a concentrated party district...",
      mapAction: "showFifaInvestment",
      duration: 4000
    },
    {
      step: 3,
      title: "Development Catalyst Zones",
      description: "These 8 areas show the highest potential for entertainment development...",
      mapAction: "showCatalystZones",
      duration: 5000
    },
    {
      step: 4,
      title: "EaDo's Transformation",
      description: "By 2026, EaDo will become Houston's permanent party district with 3x more entertainment venues...",
      mapAction: "showFinalPrediction",
      duration: 6000
    }
  ]
};
```

###### **Map Layer Management**

The system will use existing map layer infrastructure:

```javascript
// Integration with OSMCall.jsx and PerplexityTool.js
const mapLayerManagement = {
  // Use OSMCall.jsx for FIFA infrastructure data
  fifaInfrastructure: {
    source: 'osm-features',
    layers: ['osm-features-lines', 'osm-features-fill', 'osm-pois'],
    toggleFunction: 'toggleFifaLayer'
  },
  
  // Use PerplexityTool.js for AI analysis layers
  perplexityAnalysis: {
    source: 'perplexity-analysis',
    layers: ['perplexity-markers', 'perplexity-heatmap', 'perplexity-polygons'],
    toggleFunction: 'togglePerplexityLayer'
  },
  
  // Combine both for comprehensive visualization
  combinedAnalysis: {
    sources: ['osm-features', 'perplexity-analysis', 'real-estate-analysis'],
    layers: ['all-fifa-layers', 'all-perplexity-layers', 'all-analysis-layers'],
    legendIntegration: 'LegendContainer.jsx'
  }
};
```

###### **User Experience Flow**

1. **User Input**: Types question in "Ask Perplexity" component
2. **API Call**: Perplexity analyzes Houston data and returns structured JSON
3. **Layer Generation**: System creates map layers based on analysis
4. **Sequential Display**: Layers appear one by one with narration
5. **Interactive Legend**: User can toggle layers on/off via LegendContainer
6. **Story Completion**: Full narrative displayed in AIResponseDisplayRefactored

This creates an engaging, interactive storytelling experience where the map becomes a dynamic canvas for AI insights about Houston's FIFA development potential.

#### **Phase 1 Success Criteria**
- ✅ `PerplexityCall.jsx` successfully calls Perplexity API
- ✅ Returns structured JSON responses
- ✅ Displays sequential map layers
- ✅ Tells a coherent story about Houston FIFA development potential
- ✅ Demonstrates methodology works with real data
- ✅ Response time under 10 seconds
- ✅ Map visualization updates smoothly

#### **Phase 1 Deliverables**
1. **Functional PerplexityCall.jsx** - Real API integration
2. **Data Context System** - Structured data preparation
3. **JSON Response Parser** - Handles Perplexity responses
4. **Map Visualization Engine** - Sequential layer display
5. **Storytelling Framework** - Narrative structure for analysis
6. **Houston FIFA Case Study** - Complete proof-of-concept

#### **Houston FIFA Case Study: Proof-of-Concept Methodology**

The Houston FIFA 2026 case study serves as the perfect proof-of-concept because:

##### **Why Houston FIFA Works as Proof-of-Concept**
1. **Rich Data Ecosystem**: Multiple data sources (FIFA infrastructure, local businesses, real estate, startups, construction)
2. **Clear Catalyst Event**: FIFA 2026 creates a defined "before/after" analysis opportunity
3. **Spatial Complexity**: Houston's urban sprawl provides interesting geographic analysis challenges
4. **Economic Impact**: FIFA investment creates measurable development catalysts
5. **Timeline Pressure**: 2026 deadline creates urgency for analysis and planning

##### **Methodology Validation Through Houston Case**
```javascript
// The Houston case proves the methodology by showing:
const methodologyProof = {
  dataIntegration: {
    challenge: "Combine 5+ different data sources with different formats",
    solution: "Structured context preparation with geographic normalization",
    validation: "Successfully loads and processes all Houston data sources"
  },
  
  spatialAnalysis: {
    challenge: "Identify development patterns and catalyst zones",
    solution: "Perplexity AI analyzes spatial relationships and clustering",
    validation: "Generates meaningful catalyst zone predictions"
  },
  
  narrativeStorytelling: {
    challenge: "Present complex analysis in understandable format",
    solution: "Sequential map layers that build a coherent story",
    validation: "Users can follow the development scenario progression"
  },
  
  predictiveModeling: {
    challenge: "Predict future development based on FIFA investment",
    solution: "AI analyzes current patterns to project future scenarios",
    validation: "Generates plausible development scenarios with confidence scores"
  }
};
```

##### **Houston-Specific Analysis Framework**
```javascript
const houstonFIFAAnalysis = {
  currentState: {
    businessDensity: "Map existing business clusters in Houston",
    infrastructure: "Identify current transportation and utility networks",
    development: "Assess recent construction and development patterns"
  },
  
  fifaImpact: {
    venueLocations: "FIFA 2026 stadium and event locations",
    infrastructureInvestment: "Transportation and utility upgrades",
    economicInjection: "Direct spending and tourism impact"
  },
  
  catalystZones: {
    primary: "Areas directly adjacent to FIFA venues",
    secondary: "Transportation corridors and access routes",
    tertiary: "Unexpected development spillover areas"
  },
  
  scenarioModeling: {
    optimistic: "Maximum development potential scenario",
    realistic: "Most likely development pattern",
    conservative: "Minimal impact scenario",
    unexpected: "Surprise development in unexpected areas"
  }
};
```

##### **Expected Houston FIFA Insights**
The proof-of-concept should generate insights like:

1. **"EaDo becomes Houston's permanent party district"** - Entertainment venue clustering near FIFA zones
2. **"Walkability beats FIFA proximity"** - Properties prioritize pedestrian access over venue distance  
3. **"FIFA spending triggers development in completely random areas"** - Unexpected catalyst effects
4. **"Market forces ignore FIFA infrastructure entirely"** - Areas where development follows different patterns

##### **Success Metrics for Houston Case Study**
- **Data Processing**: Successfully loads and analyzes all 5+ data sources
- **API Integration**: Perplexity returns structured JSON responses
- **Map Visualization**: Sequential layers tell coherent development story
- **Insight Quality**: Generates actionable, specific insights about Houston
- **Methodology Transfer**: Framework can be applied to other cities/events
- **User Engagement**: Users find the analysis compelling and memorable

### Phase 2: Multi-Model Integration
1. **Add Claude Integration**: Parallel Claude analysis
2. **Add GPT4 Integration**: Creative insights and pattern recognition
3. **Add Gemini Integration**: Technical analysis and data processing
4. **Response Synthesis**: Compare and contrast model perspectives

### Phase 3: Advanced Spatial Analysis
1. **Spatial Analysis Engine**: Clustering, proximity analysis
2. **Catalyst Zone Modeling**: Dynamic development prediction
3. **Temporal Analysis**: Time-series development patterns
4. **Interactive Visualizations**: User-driven exploration

### Phase 4: Production System
1. **Performance Optimization**: Caching, parallel processing
2. **Error Handling**: Robust failure management
3. **User Experience**: Intuitive interface design
4. **Scalability**: Support for multiple cities and use cases

## Usage Examples

### Example 1: FIFA Catalyst Analysis
```javascript
const query = "What businesses are clustering near FIFA venues and why?";
const processor = new ContextProcessor(dataSources);
const context = processor.processContext(query, 'catalyst');
const multiModelResponse = await callAllModels(context);
```

### Example 2: Business Density Assessment
```javascript
const query = "Analyze business density patterns around FIFA infrastructure";
const processor = new ContextProcessor(dataSources);
const context = processor.processContext(query, 'businessDensity');
const multiModelResponse = await callAllModels(context);
```

### Example 3: Development Impact Prediction
```javascript
const query = "How will FIFA 2026 affect local business development patterns?";
const processor = new ContextProcessor(dataSources);
const context = processor.processContext(query, 'development');
const multiModelResponse = await callAllModels(context);
```

## Benefits of This Approach

1. **Reusability**: Same context processing for all LLMs
2. **Consistency**: Standardized data structure across AI tools
3. **Scalability**: Easy to add new data sources or LLMs
4. **Maintainability**: Centralized context processing logic
5. **Performance**: Caching and filtering for efficient data handling
6. **Flexibility**: Easy to customize for specific use cases

## Next Steps

1. **Implement ContextProcessor class**
2. **Create data filtering functions for each source**
3. **Build LLM-specific formatters**
4. **Integrate with existing Perplexity mode UI**
5. **Add response processing and display logic**
6. **Implement caching for performance optimization**

This architecture provides a solid foundation for context-aware AI query processing that can scale across multiple LLMs while maintaining consistency and reusability.

## Critical Analysis: Current State vs. Desired Output

### Current Implementation Gaps

#### 1. **PerplexityCall.jsx is Just a Toggle Button**
- **Current**: Only toggles Perplexity mode, no actual API integration
- **Missing**: Real Perplexity API calls with context-aware data processing
- **Impact**: Users get a mode toggle but no actual AI analysis

#### 2. **Multi-Model Analysis Not Implemented**
- **Current**: Single model responses (Claude OR Perplexity)
- **Desired**: Multi-model analysis like the example insight showing GPT4, Claude, and Gemini perspectives
- **Missing**: Parallel model execution and comparative analysis

#### 3. **No Spatial Analysis Integration**
- **Current**: Basic data filtering by keywords
- **Missing**: Geographic proximity analysis, clustering detection, spatial correlation
- **Example Need**: "34 entertainment venues clustering near FIFA zones"

#### 4. **No Catalyst Zone Modeling**
- **Current**: Static data display
- **Missing**: Dynamic modeling of how FIFA investments create development catalysts
- **Example Need**: "FIFA spending accidentally triggers development in completely random areas"

#### 5. **No Playful/Engaging Response Formatting**
- **Current**: Technical, dry responses
- **Missing**: Humorous, engaging tone that makes insights memorable
- **Example Need**: "Local model called everyone's bluff"

### Required Architecture Enhancements

#### 1. **Multi-Model Orchestration Layer**
```javascript
class MultiModelOrchestrator {
  async analyzeWithMultipleModels(query, context) {
    const models = ['claude', 'perplexity', 'gpt4', 'gemini'];
    const results = await Promise.all(
      models.map(model => this.callModel(model, query, context))
    );
    return this.synthesizeResults(results);
  }
  
  synthesizeResults(results) {
    // Create comparative analysis showing different model perspectives
    // Highlight disagreements and consensus
    // Format with playful, engaging tone
  }
}
```

#### 2. **Spatial Analysis Engine**
```javascript
class SpatialAnalysisEngine {
  detectClusters(data, radius) {
    // Find geographic clusters of similar features
    // Calculate density and proximity metrics
  }
  
  findCatalystZones(fifaData, developmentData) {
    // Identify areas where FIFA investment correlates with development
    // Model unexpected catalyst effects
  }
  
  analyzeWalkabilityVsProximity(venues, properties) {
    // Compare walkability scores vs FIFA proximity
    // Find surprising correlations
  }
}
```

#### 3. **Context-Aware Data Fusion**
```javascript
class ContextAwareFusion {
  fuseDataSources(query, intent) {
    // Combine FIFA + Companies + Real Estate + Startups + TDLR data
    // Create rich context for each model
    // Include geographic relationships and spatial patterns
  }
  
  generateModelSpecificContext(baseContext, modelType) {
    // Customize context for each model's strengths
    // Perplexity: Real-time data + web search
    // Claude: Strategic analysis + reasoning
    // GPT4: Creative insights + pattern recognition
    // Gemini: Technical analysis + data processing
  }
}
```

#### 4. **Engaging Response Formatter**
```javascript
class EngagingResponseFormatter {
  formatMultiModelInsight(analysis) {
    return {
      headline: this.createPlayfulHeadline(analysis),
      modelPerspectives: this.formatModelOpinions(analysis.models),
      spatialInsights: this.formatSpatialFindings(analysis.spatial),
      catalystAnalysis: this.formatCatalystEffects(analysis.catalysts),
      mapVisualization: this.generateMapInstructions(analysis)
    };
  }
}
```

### Data Integration Requirements

#### 1. **Real-Time Data Sources**
- **Missing**: Live construction updates, real estate price changes
- **Need**: Integration with APIs for current market conditions
- **Impact**: More accurate catalyst zone modeling

#### 2. **Spatial Relationship Mapping**
- **Missing**: Distance calculations, proximity analysis
- **Need**: Geographic analysis of how features relate spatially
- **Impact**: Better understanding of development patterns

#### 3. **Temporal Analysis**
- **Missing**: Time-series analysis of development patterns
- **Need**: Historical data to predict future catalyst effects
- **Impact**: More accurate modeling of FIFA's long-term impact

### Implementation Priority

#### Phase 1: Core Multi-Model Integration
1. **Implement real Perplexity API calls** (not just mode toggle)
2. **Add parallel model execution** for comparative analysis
3. **Create basic spatial analysis** for clustering detection

#### Phase 2: Advanced Spatial Analysis
1. **Implement catalyst zone modeling**
2. **Add walkability vs proximity analysis**
3. **Create dynamic development pattern prediction**

#### Phase 3: Engaging User Experience
1. **Implement playful response formatting**
2. **Add model disagreement highlighting**
3. **Create interactive map visualizations**

### Key Questions to Resolve

1. **API Integration**: How do we handle multiple API keys and rate limits?
2. **Data Freshness**: How often do we refresh context data for real-time analysis?
3. **Response Synthesis**: How do we balance different model opinions when they disagree?
4. **Performance**: How do we handle parallel API calls without overwhelming the system?
5. **User Experience**: How do we present complex multi-model analysis in an engaging way?

### Success Metrics

- **Multi-Model Coverage**: All 4 models (Claude, Perplexity, GPT4, Gemini) providing unique perspectives
- **Spatial Insights**: Accurate detection of clusters, catalyst zones, and unexpected correlations
- **Engagement**: Users find insights memorable and actionable
- **Accuracy**: Predictions about development patterns prove accurate over time
- **Performance**: Sub-10 second response times for complex multi-model analysis

## Detailed Analysis: useAIQuery.js Current Architecture

### Current Implementation Overview

The `useAIQuery` hook is a **single-model, sequential processing system** designed around Claude API integration with tool execution capabilities. Here's the detailed breakdown:

#### **Core Architecture (Lines 48-947)**

```javascript
export const useAIQuery = (map, updateToolFeedback, handleMarkerClick = null, locationKey = 'default') => {
  // Single model state management
  const [isLoading, setIsLoading] = useState(false);
  const [responses, setResponses] = useState([]);
  const [citations] = useState([]);
  const [pendingRequests, setPendingRequests] = useState(new Set());
  const [responseCache, setResponseCache] = useState({});
}
```

#### **Current Processing Flow**

1. **Query Reception** (Lines 224-286)
   - Receives `questionData` object
   - Generates unique `queryId`
   - Checks workflow cache first
   - Handles special case for `startup_ecosystem_analysis`

2. **Claude API Integration** (Lines 287-441)
   - Single API call to `http://localhost:3001/api/claude`
   - JSON response parsing with extensive sanitization
   - Caching system for performance optimization
   - Error handling and retry logic

3. **Tool Execution** (Lines 730-918)
   - Sequential tool execution via `executeStartupEcosystemTools`
   - Tools: SERP, OSM, Perplexity, Firecrawl
   - Results aggregation and response formatting
   - Workflow caching for complete analysis

### Critical Architectural Limitations

#### **1. Single-Model Design**
```javascript
// Current: Only Claude
const response = await fetch('http://localhost:3001/api/claude', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(requestBody)
});

// Needed: Multi-model orchestration
const responses = await Promise.all([
  callClaude(query, context),
  callPerplexity(query, context),
  callGPT4(query, context),
  callGemini(query, context)
]);
```

#### **2. Sequential Processing**
```javascript
// Current: One model → Tools → Response
const claudeResponse = await callClaude();
const toolResults = await executeTools();
const finalResponse = formatResponse();

// Needed: Parallel processing with synthesis
const [claudeResult, perplexityResult, gpt4Result, geminiResult] = await Promise.all([
  callClaude(query, context),
  callPerplexity(query, context),
  callGPT4(query, context),
  callGemini(query, context)
]);
const synthesizedInsight = synthesizeMultiModelResults([claudeResult, perplexityResult, gpt4Result, geminiResult]);
```

#### **3. No Spatial Analysis Integration**
```javascript
// Current: Basic geographic coordinates
const coordinates = locationConfig?.coordinates || { lat: 42.3601, lng: -71.0589 };

// Needed: Spatial analysis engine
const spatialAnalysis = await analyzeSpatialPatterns({
  coordinates,
  radius: 5000, // 5km radius
  dataSources: ['fifa', 'companies', 'realEstate', 'startups', 'tdlr'],
  analysisTypes: ['clustering', 'catalystZones', 'walkability', 'businessDensity']
});
```

#### **4. Limited Context Processing**
```javascript
// Current: Simple prompt construction
const requestBody = {
  model: 'claude-3-sonnet-20240229',
  max_tokens: 4000,
  messages: [{ role: 'user', content: prompt }]
};

// Needed: Rich context fusion
const contextFusion = await fuseDataSources({
  query,
  intent: classifyIntent(query),
  spatialContext: spatialAnalysis,
  temporalContext: getTemporalContext(),
  modelSpecificContext: generateModelSpecificContext(query, 'claude')
});
```

### Required Architectural Changes

#### **1. Multi-Model Orchestration Layer**
```javascript
class MultiModelOrchestrator {
  constructor() {
    this.models = {
      claude: new ClaudeProvider(),
      perplexity: new PerplexityProvider(),
      gpt4: new GPT4Provider(),
      gemini: new GeminiProvider()
    };
    this.spatialEngine = new SpatialAnalysisEngine();
    this.contextFusion = new ContextAwareFusion();
  }

  async analyzeQuery(query, locationKey) {
    // 1. Generate rich context
    const context = await this.contextFusion.fuseDataSources(query, locationKey);
    
    // 2. Perform spatial analysis
    const spatialAnalysis = await this.spatialEngine.analyzePatterns(context);
    
    // 3. Execute all models in parallel
    const modelResults = await Promise.all(
      Object.entries(this.models).map(([name, provider]) => 
        provider.analyze(query, context, spatialAnalysis)
      )
    );
    
    // 4. Synthesize results
    return this.synthesizeResults(modelResults, spatialAnalysis);
  }
}
```

#### **2. Enhanced State Management**
```javascript
// Current: Single model state
const [isLoading, setIsLoading] = useState(false);
const [responses, setResponses] = useState([]);

// Needed: Multi-model state
const [modelStates, setModelStates] = useState({
  claude: { isLoading: false, response: null, error: null },
  perplexity: { isLoading: false, response: null, error: null },
  gpt4: { isLoading: false, response: null, error: null },
  gemini: { isLoading: false, response: null, error: null }
});
const [synthesisState, setSynthesisState] = useState({
  isSynthesizing: false,
  synthesizedResponse: null,
  modelAgreements: [],
  modelDisagreements: []
});
```

#### **3. Spatial Analysis Integration**
```javascript
class SpatialAnalysisEngine {
  async analyzePatterns(context) {
    const analysis = {
      clusters: await this.detectClusters(context.data, 1000), // 1km radius
      catalystZones: await this.findCatalystZones(context.fifa, context.companies),
      walkabilityAnalysis: await this.analyzeWalkabilityVsProximity(context.fifa, context.realEstate),
      businessDensity: await this.analyzeBusinessDensity(context.companies),
      unexpectedCorrelations: await this.findUnexpectedCorrelations(context)
    };
    
    return analysis;
  }
  
  detectClusters(data, radius) {
    // Implement clustering algorithm (DBSCAN, K-means, etc.)
    // Return cluster centers, densities, and characteristics
  }
  
  findCatalystZones(fifaData, companiesData) {
    // Find areas where FIFA investment correlates with business development
    // Model "accidental catalyst effects" on local business growth
  }
}
```

#### **4. Response Synthesis System**
```javascript
class ResponseSynthesizer {
  synthesizeResults(modelResults, spatialAnalysis) {
    return {
      headline: this.createPlayfulHeadline(modelResults, spatialAnalysis),
      modelPerspectives: this.formatModelOpinions(modelResults),
      spatialInsights: this.formatSpatialFindings(spatialAnalysis),
      catalystAnalysis: this.formatCatalystEffects(spatialAnalysis.catalystZones),
      mapVisualization: this.generateMapInstructions(spatialAnalysis),
      confidence: this.calculateOverallConfidence(modelResults),
      disagreements: this.highlightModelDisagreements(modelResults)
    };
  }
  
  createPlayfulHeadline(modelResults, spatialAnalysis) {
    // Generate engaging headlines like:
    // "GPT4 spotted 34 entertainment venues clustering near FIFA zones"
    // "Claude identified 67 properties where walkability beats FIFA proximity"
    // "Local model called everyone's bluff - mapped 8 locations where market forces ignore FIFA"
  }
}
```

### Migration Strategy

#### **Phase 1: Parallel Model Integration**
1. **Extend current `useAIQuery`** to support multiple models
2. **Add model-specific providers** (Claude, Perplexity, GPT4, Gemini)
3. **Implement parallel execution** while maintaining current functionality
4. **Add basic response synthesis** for multi-model results

#### **Phase 2: Spatial Analysis Integration**
1. **Add SpatialAnalysisEngine** to the hook
2. **Integrate spatial analysis** into context generation
3. **Update response formatting** to include spatial insights
4. **Add map visualization** instructions

#### **Phase 3: Advanced Synthesis**
1. **Implement ResponseSynthesizer** for engaging output
2. **Add model disagreement highlighting**
3. **Create catalyst zone modeling**
4. **Add temporal analysis** for development pattern prediction

### Performance Considerations

#### **Current Performance Issues**
- **Sequential Processing**: 30+ seconds for complete analysis
- **Single Model Bottleneck**: If Claude fails, entire analysis fails
- **No Parallel Tool Execution**: Tools run sequentially even when independent

#### **Optimized Performance Targets**
- **Parallel Model Execution**: 5-8 seconds for multi-model analysis
- **Fault Tolerance**: Continue analysis even if one model fails
- **Parallel Tool Execution**: Independent tools run simultaneously
- **Smart Caching**: Cache model-specific results separately

### Code Refactoring Requirements

#### **1. Extract Model Providers**
```javascript
// Create separate files:
// - src/providers/ClaudeProvider.js
// - src/providers/PerplexityProvider.js
// - src/providers/GPT4Provider.js
// - src/providers/GeminiProvider.js
```

#### **2. Create Analysis Engines**
```javascript
// Create separate files:
// - src/engines/SpatialAnalysisEngine.js
// - src/engines/ContextFusionEngine.js
// - src/engines/ResponseSynthesizer.js
```

#### **3. Update useAIQuery Hook**
```javascript
// Refactor useAIQuery to:
// - Use MultiModelOrchestrator
// - Support parallel execution
// - Include spatial analysis
// - Provide synthesis capabilities
```

### Testing Strategy

#### **1. Unit Tests**
- Test each model provider independently
- Test spatial analysis algorithms
- Test response synthesis logic

#### **2. Integration Tests**
- Test multi-model orchestration
- Test parallel execution performance
- Test error handling and fallbacks

#### **3. Performance Tests**
- Measure response times for different query types
- Test with various data sizes
- Validate caching effectiveness

This analysis shows that the current `useAIQuery` hook needs significant architectural changes to support the multi-model, spatial analysis system described in the example insight. The migration should be done incrementally to maintain current functionality while adding new capabilities.
