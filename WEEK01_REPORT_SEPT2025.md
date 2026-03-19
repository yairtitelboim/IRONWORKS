# Power Grid Data Flow Documentation
**Date**: September 8, 2025  
**Version**: 1.1  
**System**: DCC (Data Center Consulting) Power Grid Analysis Platform

---

## WEEK01_REPORT_SEPT2025: Production Readiness Plan

### **Executive Summary**

This section outlines the strategic plan to transform the current hardcoded Power Grid Analysis system into a production-ready, geographically flexible platform while maintaining all valuable APIs and adding robust error handling and rate limiting.

### **Current Production Blockers**

#### **1. Hardcoded Geographic Dependencies**
```javascript
// PowerGridStrategy.js - Line 10
this.coordinates = { lat: 31.9315, lng: -97.347 }; // Whitney, TX ONLY

// Multiple hardcoded locations throughout codebase
const WHITNEY_COORDS = { lat: 31.950, lng: -97.320 };
```

#### **2. Single-Use Case Limitation**
- **Only works for**: CyrusOne site in Whitney, TX
- **Only analyzes**: Power grid reliability
- **Only serves**: One specific data center company

#### **3. No Geographic Flexibility**
- **Hardcoded coordinates** in multiple files
- **Static query generation** based on Whitney, TX
- **No location switching** capability

### **Strategic Solution: Geographic Configuration System**

#### **1. Dynamic Geographic Configuration**
```javascript
// New file: src/config/geographicConfig.js
export const GEOGRAPHIC_CONFIG = {
  // Default configuration (current Whitney, TX)
  default: {
    coordinates: { lat: 31.9315, lng: -97.347 },
    city: 'Whitney',
    state: 'TX',
    county: 'Bosque County',
    region: 'North Central Texas',
    gridOperator: 'ERCOT',
    timezone: 'America/Chicago',
    searchRadius: 5000, // 5km
    businessContext: 'CyrusOne DWF10 Data Center Site'
  },
  
  // Easy to add new locations
  austin: {
    coordinates: { lat: 30.2672, lng: -97.7431 },
    city: 'Austin',
    state: 'TX', 
    county: 'Travis County',
    region: 'Central Texas',
    gridOperator: 'ERCOT',
    timezone: 'America/Chicago',
    searchRadius: 5000,
    businessContext: 'Data Center Site Analysis'
  },
  
  dallas: {
    coordinates: { lat: 32.7767, lng: -96.7970 },
    city: 'Dallas',
    state: 'TX',
    county: 'Dallas County', 
    region: 'North Texas',
    gridOperator: 'ERCOT',
    timezone: 'America/Chicago',
    searchRadius: 5000,
    businessContext: 'Data Center Site Analysis'
  }
};

// Easy location switching
export const getGeographicConfig = (locationKey = 'default') => {
  return GEOGRAPHIC_CONFIG[locationKey] || GEOGRAPHIC_CONFIG.default;
};
```

#### **2. Location-Aware PowerGridStrategy**
```javascript
// src/utils/strategies/PowerGridStrategy.js
export class PowerGridStrategy {
  constructor(locationConfig = null) {
    // Use provided config or default
    this.config = locationConfig || getGeographicConfig('default');
    
    // Generate location-specific queries
    this.defaultQueries = this.generateLocationQueries();
    
    // Set location-specific parameters
    this.coordinates = this.config.coordinates;
    this.searchRadius = this.config.searchRadius;
    this.gridOperator = this.config.gridOperator;
  }
  
  generateLocationQueries() {
    const { city, state, county, region } = this.config;
    return [
      `power plants near ${city} ${state}`,
      `electric utilities ${county} ${state}`,
      `electrical substations ${city} ${state}`,
      `${this.gridOperator} transmission ${city} ${state}`
    ];
  }
  
  // Easy location switching
  switchLocation(locationKey) {
    this.config = getGeographicConfig(locationKey);
    this.coordinates = this.config.coordinates;
    this.defaultQueries = this.generateLocationQueries();
  }
}
```

### **API Strategy: Keep All Valuable APIs + Add Robustness**

#### **1. SERP API (Keep + Enhance with Fallback Chain)**
```javascript
// Enhanced SERP with better fallback chain
const executeSERP = async (queries, coordinates, config) => {
  try {
    // Primary: SERP API
    const serpResponse = await callSerpAPI(queries, coordinates);
    return { success: true, data: serpResponse, source: 'SERP' };
  } catch (serpError) {
    console.warn('SERP API failed, trying Google Places fallback:', serpError);
    
    try {
      // Fallback: Google Places API
      const placesResponse = await callGooglePlacesAPI(queries, coordinates);
      return { success: true, data: placesResponse, source: 'Google Places' };
    } catch (placesError) {
      console.error('All SERP fallbacks failed:', placesError);
      return { success: false, error: placesError, source: 'None' };
    }
  }
};
```

#### **2. Perplexity API (Keep + Rate Limiting)**
```javascript
// Enhanced Perplexity with rate limiting
const executePerplexity = async (queries, coordinates, config) => {
  // Check rate limits
  if (!await checkRateLimit('perplexity', config.userId)) {
    throw new Error('Perplexity rate limit exceeded');
  }
  
  try {
    const response = await callPerplexityAPI(queries, coordinates);
    await incrementUsage('perplexity', config.userId);
    return { success: true, data: response, source: 'Perplexity' };
  } catch (error) {
    console.error('Perplexity API failed:', error);
    return { success: false, error, source: 'Perplexity' };
  }
};
```

#### **3. Firecrawl API (Keep + Future Development)**
```javascript
// Firecrawl for future regulatory analysis
const executeFirecrawl = async (queries, coordinates, config) => {
  // Feature flag for future development
  if (!config.features.firecrawl) {
    return { success: false, error: 'Firecrawl not enabled', source: 'Firecrawl' };
  }
  
  try {
    const response = await callFirecrawlAPI(queries, coordinates);
    return { success: true, data: response, source: 'Firecrawl' };
  } catch (error) {
    console.error('Firecrawl API failed:', error);
    return { success: false, error, source: 'Firecrawl' };
  }
};
```

#### **4. AlphaEarth Integration (Keep + Future Development)**
```javascript
// AlphaEarth for environmental intelligence
const executeAlphaEarth = async (queries, coordinates, config) => {
  // Feature flag for future development
  if (!config.features.alphaEarth) {
    return { success: false, error: 'AlphaEarth not enabled', source: 'AlphaEarth' };
  }
  
  try {
    const response = await callAlphaEarthAPI(queries, coordinates);
    return { success: true, data: response, source: 'AlphaEarth' };
  } catch (error) {
    console.error('AlphaEarth API failed:', error);
    return { success: false, error, source: 'AlphaEarth' };
  }
};
```

### **Rate Limiting & Error Handling System**

#### **1. Rate Limiting Implementation**
```javascript
// src/utils/rateLimiting.js
export class RateLimiter {
  constructor() {
    this.usage = new Map(); // userId -> { api: count }
    this.limits = {
      serp: { requests: 100, window: 3600000 }, // 100/hour
      perplexity: { requests: 50, window: 3600000 }, // 50/hour
      firecrawl: { requests: 20, window: 3600000 }, // 20/hour
      alphaearth: { requests: 10, window: 3600000 } // 10/hour
    };
  }
  
  async checkRateLimit(api, userId) {
    const key = `${userId}-${api}`;
    const now = Date.now();
    const limit = this.limits[api];
    
    if (!this.usage.has(key)) {
      this.usage.set(key, { count: 0, resetTime: now + limit.window });
    }
    
    const usage = this.usage.get(key);
    
    // Reset if window expired
    if (now > usage.resetTime) {
      usage.count = 0;
      usage.resetTime = now + limit.window;
    }
    
    return usage.count < limit.requests;
  }
  
  async incrementUsage(api, userId) {
    const key = `${userId}-${api}`;
    const usage = this.usage.get(key);
    if (usage) {
      usage.count++;
    }
  }
}
```

#### **2. Enhanced Error Handling**
```javascript
// src/utils/errorHandling.js
export class ErrorHandler {
  static handleAPIError(api, error, fallback = null) {
    console.error(`${api} API Error:`, error);
    
    // Log error for monitoring
    this.logError(api, error);
    
    // Return graceful fallback
    if (fallback) {
      return { success: false, error: error.message, fallback: fallback };
    }
    
    return { success: false, error: error.message };
  }
  
  static logError(api, error) {
    // Send to monitoring service (e.g., Sentry, DataDog)
    console.log(`Error logged for ${api}:`, {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}
```

### **Easy Location Switching Implementation**

#### **1. Location Selector Component**
```javascript
// src/components/LocationSelector.jsx
const LocationSelector = ({ currentLocation, onLocationChange }) => {
  const locations = Object.keys(GEOGRAPHIC_CONFIG);
  
  return (
    <select 
      value={currentLocation} 
      onChange={(e) => onLocationChange(e.target.value)}
      className="location-selector"
    >
      {locations.map(location => (
        <option key={location} value={location}>
          {GEOGRAPHIC_CONFIG[location].city}, {GEOGRAPHIC_CONFIG[location].state}
        </option>
      ))}
    </select>
  );
};
```

#### **2. Update useAIQuery to Support Location Selection**
```javascript
// src/hooks/useAIQuery.js
export const useAIQuery = (map, updateToolFeedback, handleMarkerClick = null, locationKey = 'default') => {
  // Get location-specific configuration
  const locationConfig = getGeographicConfig(locationKey);
  
  // Update prompt to be location-aware
  const getPowerGridPrompt = (questionData) => {
    if (questionData.id === 'power_reliability') {
      return `You are an expert data center consultant analyzing power grid reliability for a data center site in ${locationConfig.city}, ${locationConfig.state} (${locationConfig.county}).

Available Tools:
- CLAUDE: Primary LLM for analysis and orchestration decisions
- SERP: Can search for power plants, utilities, transmission facilities near the site
- OSM: Can provide geographic context for power infrastructure  
- PERPLEXITY: Can provide expert analysis based on infrastructure data from SERP and OSM
- FIRECRAWL: Can extract real-time power grid status and regulatory information
- ALPHAEARTH: Can provide environmental intelligence and change detection

Location Context: ${locationConfig.businessContext}
Grid Operator: ${locationConfig.gridOperator}
Region: ${locationConfig.region}

User Question: ${questionData.query}

[Rest of prompt remains the same but now location-aware]`;
    }
    // ... rest of function
  };
};
```

### **Implementation Timeline**

#### **Week 1: Geographic Configuration System**
- [ ] Create `src/config/geographicConfig.js`
- [ ] Update `PowerGridStrategy.js` to be location-aware
- [ ] Update `useAIQuery.js` to support location selection
- [ ] Test location switching functionality

#### **Week 2: Rate Limiting and Error Handling**
- [ ] Implement `RateLimiter` class
- [ ] Add `ErrorHandler` class
- [ ] Update all API calls with rate limiting
- [ ] Add comprehensive error handling

#### **Week 3: Location Selector UI and Testing**
- [ ] Create `LocationSelector` component
- [ ] Update `BaseCard.jsx` to support location switching
- [ ] Add map centering on location change
- [ ] Test all location configurations

#### **Week 4: Production Deployment**
- [ ] Deploy to Vercel with new features
- [ ] Add environment-based configuration
- [ ] Implement monitoring and logging
- [ ] Performance testing and optimization

### **Benefits of Enhanced Implementation**

1. **Improved Claude Analysis**: Structured 4-point preliminary assessment framework
2. **Geographic Flexibility**: Location-aware prompts supporting multiple grid operators
3. **Professional Formatting**: Enhanced response structure with methodology sections
4. **Preserved Architecture**: 100% compatibility with existing dual data layer
5. **Cache Preservation**: All existing cached responses remain valid
6. **Demo Reliability**: Dual tool assessment sequence unchanged

### **Current Status: Vercel POC Deployment + Documentation Cleanup**

The current system is already deployed on Vercel as a proof-of-concept, demonstrating:
- ✅ **Working Power Grid Analysis** for Whitney, TX
- ✅ **Real API Integration** with SERP, OSM, Perplexity
- ✅ **Interactive Map Visualization** with data parsing
- ✅ **Table-based Data Display** with category filtering
- ✅ **Comprehensive Documentation** with WEEK01_REPORT_SEPT2025.md as primary reference
- ✅ **README Cleanup** - Removed 6 irrelevant README files, added references to primary documentation

**Completed Tasks (December 19, 2024)**:
- ✅ **Production Readiness Analysis** - Identified hardcoded dependencies and geographic limitations
- ✅ **Documentation Consolidation** - Created comprehensive WEEK01_REPORT_SEPT2025.md
- ✅ **README References** - Added references to primary documentation in all relevant README files
- ✅ **File Cleanup** - Removed irrelevant README files from different projects

**Enhanced Implementation (September 8, 2025)**:
- ✅ **Claude Prompt Enhancement** - Improved initial analysis quality with 4-point structured framework
- ✅ **Geographic Flexibility** - Added location-aware prompts supporting ERCOT, CAISO, NYISO grid operators
- ✅ **Professional Response Structure** - Enhanced formatting with methodology sections and confidence scoring
- ✅ **Dual Data Layer Preservation** - Maintained full compatibility with existing SERP→OSM→Perplexity pipeline

**Next Steps**: Complete SITE mode implementation for full dual analysis capability (Claude + Perplexity integration).

---

## Overview

This document provides a comprehensive, step-by-step analysis of the complete data flow from user interaction to data visualization in the Power Grid Analysis system. The flow is organized into three distinct phases: **User Interaction & Query Processing**, **Tool Execution & Data Collection**, and **Data Parsing & Visualization**.

---

## Phase 1: User Interaction & Query Processing

### 1.1 Initial User Interaction
**Component**: `AskAnythingInput.jsx`  
**Location**: Lines 78-110

**Step 1**: User clicks the Plus (+) icon in the input bar
```javascript
onClick={onToggleSuggestions}
```

**Step 2**: Toggle state changes to show quick questions panel
```javascript
const [isQuickQuestionsOpen, setIsQuickQuestionsOpen] = useState(false);
```

### 1.2 Question Display & Selection
**Component**: `AIQuestionsSection.jsx`  
**Location**: Lines 53-73, 676-760

**Step 3**: Executive questions are displayed when panel opens
```javascript
const [executiveQuestions, setExecutiveQuestions] = useState({
  initial: [
    {
      id: 'power_reliability',
      text: 'Power Grid Reliability - Analyze ERCOT grid stability and transmission capacity for Whitney site',
      query: 'For the CyrusOne data center site in Whitney, TX (Bosque County), provide a brief executive summary in 3 sentences: What is the power grid reliability score (1-10), what is the main risk factor, and which grid operator manages this area?'
    },
    // ... other questions
  ]
});
```

**Step 4**: User clicks on ERCOT Power Grid Reliability question
```javascript
onClick={(e) => {
  e.preventDefault();
  e.stopPropagation();
  setIsProcessingQuestion(true);
  setIsQuickQuestionsOpen(false);
  handleAIQuery(question); // ← CRITICAL: Triggers AI query
}}
```

### 1.3 AI Query Processing
**Component**: `useAIQuery.js` hook  
**Location**: Lines 147-184

**Step 5**: `handleAIQuery` function processes the question
```javascript
const handleAIQuery = async (questionData) => {
  const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Check cache first
  if (responseCache[cacheKey]) {
    // Return cached response
    return;
  }
  
  // Set loading state
  updateResponseOnly(queryId, null, [], true);
  
  // Add tool feedback for Power Grid question
  if (questionData.id === 'power_reliability') {
    updateToolFeedback({
      isActive: true,
      tool: 'claude',
      status: 'Claude analyzing power grid with tool awareness...',
      progress: 20,
      details: 'Evaluating ERCOT grid stability and determining tool requirements'
    });
  }
}
```

**Step 6**: Tool execution is triggered
```javascript
const executePowerGridTools = async (toolActions, queryId) => {
  const toolExecutor = createPowerGridToolExecutor(map, updateToolFeedback, handleMarkerClick);
  const results = await toolExecutor.executeMultipleTools(toolActions);
}
```

---

## Phase 2: Tool Execution & Data Collection

### 2.1 PowerGridToolExecutor Initialization
**Component**: `PowerGridToolExecutor.js`  
**Location**: Lines 13-24

**Step 7**: PowerGridToolExecutor is created with strategy
```javascript
export class PowerGridToolExecutor extends ToolExecutor {
  constructor(map, updateToolFeedback, handleMarkerClick = null) {
    super(map, updateToolFeedback, handleMarkerClick);
    this.setStrategy(new PowerGridStrategy());
    this.dualAnalysisEnabled = false; // Feature flag
  }
}
```

### 2.2 PowerGridStrategy Configuration
**Component**: `PowerGridStrategy.js`  
**Location**: Lines 7-35

**Step 8**: Strategy provides power grid specific configuration
```javascript
export class PowerGridStrategy {
  constructor() {
    this.coordinates = { lat: 31.9315, lng: -97.347 }; // Whitney, TX
    this.defaultQueries = [
      'power plants near Whitney TX',
      'electric utilities Bosque County Texas', 
      'electrical substations Whitney TX',
      'ERCOT transmission Whitney Texas'
    ];
    this.toolPriorities = {
      'SERP': 'high',      // Primary for infrastructure data
      'OSM': 'medium',     // Secondary for geographic context
      'PERPLEXITY': 'low', // Alternative analysis
      'FIRECRAWL': 'low'   // Regulatory updates
    };
  }
}
```

### 2.3 Tool Execution Sequence
**Component**: `ToolExecutor.js`  
**Location**: Lines 67-171

**Step 9**: Tools are executed in sequence: SERP → OSM → PERPLEXITY
```javascript
async executeMultipleTools(toolActions) {
  // Sort tools to ensure proper execution order
  const sortedActions = this.sortToolsByExecutionOrder(toolActions);
  
  for (const action of sortedActions) {
    try {
      const result = await this.executeTool(action);
      results.push(result);
      
      // Store data for next tool
      toolData[action.tool.toLowerCase()] = result.data;
    } catch (error) {
      errors.push({ tool: action.tool, error: error.message });
    }
  }
}
```

### 2.4 SERP Tool Execution
**Component**: `SerpTool.js`  
**Location**: Lines 16-372

**Step 10**: SERP searches for power infrastructure
```javascript
async execute(queries, coordinates, map, handleMarkerClick) {
  // Enhanced Google Places search for power infrastructure
  const enhancedResults = await this.executeEnhancedGooglePlacesSearch(
    originalQuery, lat, lng
  );
  
  // Process and categorize results
  const processedFeatures = this.processSerpResults(enhancedResults);
  
  // Add to map with proper styling
  this.addSerpFeaturesToMap(map, processedFeatures);
  
  // Emit data loaded event for legend
  window.mapEventBus.emit('serp:dataLoaded', processedFeatures);
}
```

**What SERP Does**:
- Searches for power plants, electric utilities, transmission facilities near Whitney, TX
- Uses Google Places API as fallback if SERP API fails
- Categorizes results into power plants, electric utilities, data centers
- Adds markers to the map with color-coded categories
- Emits `serp:dataLoaded` event for legend integration

### 2.5 OSM Tool Execution
**Component**: `OsmTool.js`  
**Location**: Lines 15-69

**Step 11**: OSM queries geographic data
```javascript
async execute(queries, coordinates, map = null) {
  // Execute OSM Overpass query
  const osmData = await this.executeOsmOverpassQuery(coordinates, map);
  
  // Process OSM elements
  const osmFeatures = await this.processOsmElements(osmData);
  
  // Add features to map
  if (map && osmFeatures.length > 0) {
    await this.addOsmFeaturesToMap(map, osmFeatures, lat, lng);
  }
}
```

**What OSM Does**:
- Queries OpenStreetMap for geographic context
- Searches for transmission lines, substations, power infrastructure
- Adds geographic features to the map
- Provides spatial context for power grid analysis

### 2.6 Perplexity Tool Execution
**Component**: `PerplexityTool.js`  
**Location**: Lines 128-205

**Step 12**: Perplexity performs AI analysis with previous tool data
```javascript
async execute(queries, coordinates, previousResults = null) {
  // Use data-driven analysis if previous results available
  if (previousResults && (previousResults.serpData || previousResults.osmData)) {
    return await this.executeDataDrivenAnalysis(queries, coordinates, previousResults);
  }
  
  // Fallback to basic analysis
  return await this.executeBasicAnalysis(queries, coordinates);
}
```

**Step 13**: Data-driven analysis with SERP and OSM data
```javascript
async executeDataDrivenAnalysis(queries, coordinates, previousResults) {
  // Build infrastructure summary from previous results
  const infrastructureSummary = this.buildInfrastructureSummary(previousResults);
  
  // Build enhanced prompt with infrastructure data
  const prompt = this.buildDataDrivenPrompt(coordinates, infrastructureSummary);
  
  // Execute Perplexity API call
  const response = await this.callPerplexityAPI(prompt);
  
  // Parse and validate response
  return this.processPerplexityResponse(response);
}
```

**What Perplexity Does**:
- Analyzes SERP and OSM data to generate structured power grid analysis
- Creates detailed node-level analysis with power scores, stability scores
- Generates structured data in format: `## NODE X: **[Facility Name]**`
- Provides source citations and reliability metrics
- Returns data ready for table parsing

---

## Phase 3: Data Parsing & Visualization

### 3.1 Response Processing & Display
**Component**: `AIQuestionsSection.jsx`  
**Location**: Lines 296-589

**Step 14**: Response is displayed in AIQuestionsSection
```javascript
{aiState.responses && aiState.responses.map((responseData, index) => {
  return (
    <div key={index}>
      {/* CategoryToggle Component - Only show for Perplexity responses */}
      {(() => {
        const isPerplexityResponse = responseContent.length > 2000 && 
                                   responseContent.toLowerCase().includes('node') && 
                                   (responseContent.toLowerCase().includes('power score') ||
                                    responseContent.toLowerCase().includes('ercot'));
        
        if (isPerplexityResponse) {
          return (
            <CategoryToggle
              perplexityResponse={responseContent}
              selectedCategory={selectedCategories[index] || 'text'}
              onCategoryChange={(categoryId, filteredContent, tableData) => 
                handleCategoryChange(index, categoryId, filteredContent, tableData)
              }
              viewMode={viewMode}
            />
          );
        }
      })()}
    </div>
  );
})}
```

### 3.2 CategoryToggle Data Parsing
**Component**: `CategoryToggle.jsx`  
**Location**: Lines 284-412

**Step 15**: Perplexity response is parsed into structured table data
```javascript
const parseTableData = (response) => {
  const nodes = [];
  const nodeRegex = /## NODE (\d+): \*\*(.*?)\*\*/g;
  let match;
  
  while ((match = nodeRegex.exec(response)) !== null) {
    const nodeNumber = match[1];
    const nodeName = match[2];
    
    // Extract data for this node
    const nodeContent = response.substring(nodeStart, nodeEnd);
    
    // Parse power scores, stability scores, capacity, etc.
    const powerScoreMatch = nodeContent.match(/\*\*1\. POWER SCORE:\*\* \*\*(\d+)\/10\*\*/);
    const stabilityScoreMatch = nodeContent.match(/\*\*2\. STABILITY SCORE:\*\* \*\*(\d+)\/10\*\*/);
    const capacityMatch = nodeContent.match(/\*\*Nameplate Capacity:\*\* \*\*(.+?)\*\*/);
    
    nodes.push({
      id: nodeNumber,
      name: nodeName,
      type: typeMatch ? typeMatch[1].trim() : 'Unknown',
      powerScore: finalPowerScore,
      risk: riskLevel,
      capacity: capacityMatch ? capacityMatch[1].trim() : 'N/A',
      // ... other properties
    });
  }
  
  return nodes;
};
```

### 3.3 Category Filtering
**Component**: `CategoryToggle.jsx`  
**Location**: Lines 373-412

**Step 16**: Data is filtered by category (Power, Transmission, Utilities, etc.)
```javascript
const filterTableDataByCategory = (nodes, category) => {
  if (category === 'all') return nodes;
  
  const categoryMap = {
    'power': ['power plant', 'generation', 'coal', 'natural gas', 'nuclear'],
    'transmission': ['transmission', 'substation', 'transformer', 'line'],
    'utilities': ['utility', 'electric', 'distribution', 'grid'],
    'risk': ['risk', 'outage', 'failure', 'vulnerability']
  };
  
  const searchTerms = categoryMap[category] || [];
  return nodes.filter(node => {
    return searchTerms.some(term => 
      node.name.toLowerCase().includes(term) ||
      node.type.toLowerCase().includes(term) ||
      node.content.toLowerCase().includes(term)
    );
  });
};
```

### 3.4 Table Rendering
**Component**: `InfrastructureSummaryTable.jsx`  
**Location**: Lines 12-24

**Step 17**: Filtered data is rendered in table format
```javascript
const InfrastructureSummaryTable = ({ 
  nodes, 
  onTableRowClick, 
  nodeAnimation, 
  onDetailToggle = null
}) => {
  const handleRowClick = (node) => {
    if (onTableRowClick) {
      onTableRowClick(node);
    }
    
    // Trigger animation
    if (nodeAnimation && node.coordinates) {
      nodeAnimation.triggerNodeAnimation(node.coordinates, {
        type: 'pulse',
        intensity: 0.8,
        duration: 3.0,
        nodeData: node
      });
    }
  };
  
  return (
    <div className="infrastructure-table">
      {/* Table headers and rows */}
    </div>
  );
};
```

### 3.5 Legend Integration
**Component**: `LegendContainer.jsx`  
**Location**: Lines 52-82

**Step 18**: SERP data is integrated with legend
```javascript
useEffect(() => {
  const handleSerpDataLoaded = (data) => {
    const features = data.features || [];
    const featureCounts = {};
    
    features.forEach(feature => {
      const category = feature.properties?.category || 'other';
      featureCounts[category] = (featureCounts[category] || 0) + 1;
    });

    setLegendData({
      serpFeatures: features,
      featureCounts: featureCounts,
      totalFeatures: features.length,
      lastUpdated: data.timestamp || Date.now()
    });
  };

  window.mapEventBus.on('serp:dataLoaded', handleSerpDataLoaded);
}, []);
```

### 3.6 Map Visualization
**Component**: `BaseCard.jsx`  
**Location**: Lines 239-274

**Step 19**: Map interactions are handled
```javascript
const handleMarkerClick = (markerData) => {
  setSelectedMarker(markerData);
  setViewMode('node');
  setSelectedAIProvider('perplexity');
  
  // Emit marker selection event
  if (window.mapEventBus) {
    window.mapEventBus.emit('marker:selected', markerData);
  }
  
  // Trigger animation
  if (window.nodeAnimation && markerData.coordinates) {
    const animationType = markerData.category === 'power plants' ? 'pulse' :
                         markerData.category === 'electric utilities' ? 'ripple' :
                         'pulse';
    
    window.nodeAnimation.triggerNodeAnimation(markerData.coordinates, {
      type: animationType,
      intensity: 0.8,
      duration: 3.0,
      nodeData: markerData
    });
  }
};
```

### 3.7 Core UI Components Architecture

#### **BaseCard.jsx - Main Container Component**
**Location**: Lines 177-760

**Key Features**:
- **Draggable Interface**: Full drag-and-drop functionality with visual feedback
- **State Management**: Centralized AI state management with `useAIQuery` hook
- **Animation System**: Integrated NodeAnimation system for map interactions
- **Cache Management**: Automatic response cache clearing with countdown timer
- **View Mode Switching**: Seamless switching between 'node' and 'site' analysis modes

**Critical Functions**:
```javascript
// Marker click handling with animation triggers
const handleMarkerClick = (markerData) => {
  setSelectedMarker(markerData);
  setViewMode('node');
  setSelectedAIProvider('perplexity');
  // Animation system integration
  window.nodeAnimation.triggerNodeAnimation(markerData.coordinates, {
    type: animationType,
    intensity: 0.8,
    duration: 3.0,
    nodeData: markerData
  });
};

// View mode management
const handleViewModeChange = (newViewMode) => {
  setViewMode(newViewMode);
  if (newViewMode === 'node') {
    setSelectedAIProvider('perplexity');
  } else {
    setSelectedAIProvider('claude');
  }
};
```

#### **NestedCircleButton.jsx - Tool Access Interface**
**Location**: Lines 8-708

**Key Features**:
- **Expandable Tool Menu**: Collapsible interface for accessing all analysis tools
- **Tool Integration**: Direct integration with SERP, OSM, Perplexity, Firecrawl, and AlphaEarth
- **Hover States**: Rich hover feedback with tool descriptions
- **Auto-collapse Logic**: Intelligent auto-collapse when new responses arrive
- **Drag Handle**: Integrated drag functionality for card movement

**Tool Button Layout**:
```javascript
// Tool positioning system
const toolPositions = {
  clear: 'calc(98% - 158px)',    // Gray - Clear map data
  alpha: 'calc(98% - 133px)',    // Red - AlphaEarth
  serp: 'calc(98% - 108px)',     // Purple - SERP API
  osm: 'calc(98% - 83px)',       // Green - OSM
  firecrawl: 'calc(98% - 58px)', // Orange - Firecrawl
  perplexity: 'calc(98% - 33px)' // Blue - Perplexity
};
```

**Auto-collapse Logic**:
```javascript
// Intelligent response change detection
useEffect(() => {
  if (aiState.response && 
      aiState.response !== lastResponseRef.current && 
      isExpanded && 
      !aiState.isLoading) {
    
    // Only auto-close on substantial changes
    if (currentResponse.substring(0, 200) !== lastResponse.substring(0, 200) &&
        Math.abs(currentResponse.length - lastResponse.length) > 50) {
      setIsExpanded(false);
    }
  }
}, [aiState.response, aiState.isLoading, isExpanded]);
```

#### **CategoryToggle.jsx - Data Filtering Interface**
**Location**: Lines 1-536

**Key Features**:
- **Dynamic Category System**: Context-aware categories that adapt to view mode
- **Marker-Specific Filtering**: Intelligent filtering based on selected map markers
- **Table Data Integration**: Direct integration with structured table data parsing
- **View Mode Support**: Different category sets for 'node' vs 'site' analysis

**Category Definitions**:
```javascript
const getCategories = (currentViewMode) => [
  { id: 'text', icon: 'TXT', description: 'Original Claude Response (Text View)' },
  { id: 'all', icon: 'ALL', description: 'Full Node Details' },
  { id: 'pwr', icon: 'PWR', description: 'Node Power Score' },
  { id: 'trn', icon: 'TRN', description: 'Node Transmission' },
  { id: 'utl', icon: 'UTL', description: 'Local Infrastructure' },
  { id: 'risk', icon: 'RSK', description: 'Node Risk Factors' }
];
```

**Marker-Specific Filtering**:
```javascript
// Intelligent marker-to-node matching
const targetNodes = nodes.filter(node => {
  const nodeText = node.toLowerCase();
  const markerTitle = currentSelectedMarker.title?.toLowerCase() || '';
  
  // Primary match: Exact title match
  if (markerTitle && nodeText.includes(markerTitle)) {
    return true;
  }
  
  // Secondary match: Cleaned title match
  const cleanMarkerTitle = markerTitle
    .replace(/\s+(inc|llc|ltd|corp|corporation|company|co)\.?$/i, '')
    .replace(/\s+(services|systems|solutions|group|associates)\.?$/i, '');
  
  if (cleanMarkerTitle && nodeText.includes(cleanMarkerTitle)) {
    return true;
  }
  
  return false;
});
```

#### **InfrastructureSummaryTable.jsx - Data Display Component**
**Location**: Lines 1-198

**Key Features**:
- **Animated Table Rows**: Smooth animations for row selection and expansion
- **Interactive Row Clicks**: Direct integration with map marker selection
- **Score Visualization**: Color-coded power scores and risk levels
- **Key Insights Panel**: Automated insights generation from table data

**Table Column Configuration**:
```javascript
const columns = [
  { key: 'id', align: 'left', color: '#ffffff', fontWeight: '500' },
  { key: 'type', align: 'left', color: '#d1d5db', render: (node) => getTypeAbbreviation(node.type) },
  { 
    key: 'powerScore', 
    align: 'center', 
    fontWeight: '600',
    render: (node) => (
      <span style={{
        color: node.powerScore >= 8 ? '#10b981' : 
               node.powerScore >= 6 ? '#f59e0b' : '#ef4444'
      }}>
        {node.powerScore}/10
      </span>
    )
  },
  {
    key: 'risk',
    align: 'center',
    fontWeight: '500',
    render: (node) => (
      <span style={{
        color: node.risk === 'Low' ? '#10b981' : 
               node.risk === 'Medium' ? '#f59e0b' : '#ef4444'
      }}>
        {node.risk}
      </span>
    )
  }
];
```

**Row Click Handling**:
```javascript
const handleRowClick = (node) => {
  // Toggle row selection
  const newSelectedId = selectedRowId === node.id ? null : node.id;
  setSelectedRowId(newSelectedId);
  
  // Auto-expand detail row
  setExpandedRowId(newSelectedId);
  
  // Trigger map integration
  if (onTableRowClick) {
    onTableRowClick(node);
  }
};
```

#### **TopBar.jsx - Control Interface**
**Location**: Lines 1-327

**Key Features**:
- **AI Provider Selection**: Dropdown for switching between Claude, OpenAI, and Perplexity
- **View Mode Controls**: NODE/SITE mode switching (currently NODE-only)
- **Cache Management**: Live/Cache mode toggle for API call optimization
- **Response Identification**: Unique response ID display for debugging

**AI Provider Management**:
```javascript
const handleProviderChange = (providerId) => {
  setAiState('selectedAIProvider', providerId);
  setLocalDropdownOpen(false);
  console.log(`🎯 AI Provider changed to: ${providerId}`);
};

// Provider options with color coding
const providers = [
  { id: 'claude', name: 'Claude', color: '#ff6b35' },
  { id: 'openai', name: 'OpenAI', color: '#10a37f' },
  { id: 'perplexity', name: 'Perplexity', color: '#6366f1' }
];
```

**Cache Mode Toggle**:
```javascript
const handleCacheToggle = () => {
  const newMode = cacheMode === 'cache' ? 'live' : 'cache';
  setCacheMode(newMode);
  
  // Global cache control
  if (typeof window !== 'undefined') {
    if (newMode === 'cache') {
      window.enablePerplexityCache?.();
    } else {
      window.disablePerplexityCache?.();
    }
  }
};
```

---

## Data Flow Summary

### Input → Processing → Output

1. **User Input**: Plus icon click → Question selection
2. **Query Processing**: `handleAIQuery` → Tool executor creation
3. **Tool Execution**: SERP (infrastructure) → OSM (geographic) → Perplexity (analysis)
4. **Data Collection**: Google Places API → OpenStreetMap → Perplexity API
5. **Data Parsing**: Regex parsing → Category filtering → Table structuring
6. **Visualization**: Table rendering → Map markers → Legend integration
7. **User Interaction**: Marker clicks → Table row clicks → Animations

### Key Data Transformations

1. **Question Object** → **Tool Actions** → **API Calls**
2. **Raw API Responses** → **Structured Data** → **Table Rows**
3. **Perplexity Text** → **Regex Parsing** → **Node Objects**
4. **Node Objects** → **Category Filtering** → **Filtered Tables**
5. **Map Coordinates** → **Marker Styling** → **Visual Feedback**

### Performance Optimizations

1. **Caching**: Response cache, SERP cache, OSM cache
2. **Parallel Execution**: Tools run in sequence but with parallel API calls
3. **Data Preprocessing**: Structured data is cached for instant table rendering
4. **Lazy Loading**: Components only render when data is available
5. **Event-Driven Updates**: MapEventBus for efficient component communication

---

## Technical Architecture

### Component Hierarchy
```
BaseCard.jsx (Main Container - 760 lines)
├── NestedCircleButton.jsx (Tool Access Interface - 708 lines)
│   ├── AlphaEarthButton.jsx (Environmental Intelligence)
│   ├── SerpAPI.jsx (Infrastructure Search)
│   ├── OSMCall.jsx (Geographic Data)
│   ├── FirecrawlCall.jsx (Web Crawling)
│   └── PerplexityCall.jsx (AI Analysis)
├── AIQuestionsSection.jsx (Query Interface)
│   ├── TopBar.jsx (Control Interface - 327 lines)
│   │   ├── AI Provider Dropdown (Claude/OpenAI/Perplexity)
│   │   ├── View Mode Controls (NODE/SITE)
│   │   └── Cache Management (Live/Cache)
│   ├── CategoryToggle.jsx (Data Filtering - 536 lines)
│   │   ├── Dynamic Category System (TXT/ALL/PWR/TRN/UTL/RSK)
│   │   ├── Marker-Specific Filtering
│   │   └── Table Data Integration
│   ├── InfrastructureSummaryTable.jsx (Data Display - 198 lines)
│   │   ├── AnimatedTableRow.jsx (Row Animations)
│   │   ├── Score Visualization (Color-coded)
│   │   └── Key Insights Panel
│   ├── CategoryTableHeader.jsx (Table Headers)
│   ├── CategoryExpandedModal.jsx (Detail Views)
│   └── AIResponseDisplayRefactored.jsx (Response Rendering)
├── LegendContainer.jsx (Map Legend)
├── LoadingCard.jsx (Loading States)
└── MarkerPopupManager.jsx (Map Interactions)
```

### Component Interaction Flow
```
User Interaction → BaseCard → NestedCircleButton → Tool Execution
                ↓
            AIQuestionsSection → CategoryToggle → InfrastructureSummaryTable
                ↓
            TopBar → View Mode Control → Data Filtering
                ↓
            Map Integration → Marker Selection → Animation System
```

### Key Architectural Patterns

#### **1. Event-Driven Architecture**
- **MapEventBus**: Global event system for component communication
- **Marker Selection Events**: `marker:selected`, `marker:deselected`
- **Data Loading Events**: `serp:dataLoaded`, `osm:dataLoaded`
- **Animation Events**: `nodeAnimation:trigger`, `nodeAnimation:complete`

#### **2. State Management Patterns**
- **Centralized AI State**: `useAIQuery` hook manages all AI-related state
- **Local Component State**: UI-specific state managed locally
- **Global Animation State**: `window.nodeAnimation` for map animations
- **Cache State Management**: Separate cache systems for different data types

#### **3. Data Flow Patterns**
- **Unidirectional Data Flow**: Props down, events up
- **Data Transformation Pipeline**: Raw API → Parsed Data → Filtered Data → Display
- **Lazy Loading**: Components only render when data is available
- **Memoization**: `useMemo` and `useCallback` for performance optimization

#### **4. UI/UX Patterns**
- **Progressive Disclosure**: Expandable interfaces (NestedCircleButton, CategoryToggle)
- **Contextual Filtering**: Marker-specific data filtering
- **Visual Feedback**: Hover states, animations, loading indicators
- **Responsive Design**: Adaptive layouts based on data availability

#### **5. Error Handling Patterns**
- **Graceful Degradation**: Fallback UI when data is unavailable
- **User-Friendly Messages**: Clear explanations for missing data
- **Retry Mechanisms**: Auto-retry for failed API calls
- **Debug Information**: Response IDs and error logging

### Design Decisions & Trade-offs

#### **1. Component Size vs. Maintainability**
- **Large Components**: BaseCard (760 lines), NestedCircleButton (708 lines)
- **Trade-off**: Fewer files vs. harder to maintain
- **Solution**: Clear internal organization with well-defined sections

#### **2. State Management Complexity**
- **Centralized vs. Distributed**: Mixed approach for different concerns
- **AI State**: Centralized in `useAIQuery`
- **UI State**: Distributed across components
- **Global State**: Minimal use of global variables

#### **3. Performance vs. Features**
- **Animation System**: Rich animations vs. performance impact
- **Real-time Updates**: Frequent re-renders vs. responsive UI
- **Cache Management**: Memory usage vs. response speed

#### **4. User Experience vs. Development Complexity**
- **Auto-collapse Logic**: Smart behavior vs. complex state management
- **Marker Filtering**: Intelligent matching vs. potential false positives
- **View Mode Switching**: Seamless transitions vs. state synchronization

### Tool Execution Chain
```
useAIQuery.js
└── PowerGridToolExecutor.js
    ├── PowerGridStrategy.js
    ├── SerpTool.js
    ├── OsmTool.js
    └── PerplexityTool.js
```

### Data Flow Pipeline
```
User Click → Question → AI Query → Tool Actions → API Calls → 
Raw Data → Parsing → Filtering → Table Rendering → Map Visualization
```

---

## Critical Analysis: Current "Pretend" Approach vs. "Honest Orchestrator"

### **System Enhancement (September 8, 2025)**

#### **Enhanced Two-Phase Architecture**
**Implemented Sequence**: The system now follows this precise flow:

1. **Phase 1: Enhanced Claude Analysis** (via Server.js)
   - Quick preliminary response with structured 4-point framework
   - Location-aware analysis (ERCOT/CAISO/NYISO support)
   - Professional formatting with confidence scoring

2. **Phase 2: Dual Tool Assessment** (via ERCOT question trigger)
   - **Step 1**: SERP/Google Places data collection
   - **Step 2**: OSM geographic context gathering  
   - **Step 3**: Perplexity analysis fed via ToolExecutor.js
   - **Step 4**: CategoryToggle.jsx filtering → InfrastructureSummaryTable.jsx display

3. **Phase 3: NODE vs SITE Analysis** (TopBar.jsx)
   - NODE mode: Perplexity detailed analysis (active)
   - SITE mode: Reserved for future Claude integration (planned)

#### **Previous "Pretend" Problem (Resolved)**
The original Power Grid prompt in `useAIQuery.js` (lines 28-90) created a misleading system where:

1. **Claude is told it can use tools it cannot actually use**:
```javascript
// Lines 33-38: MISLEADING
Available Tools:
- SERP: Can search for power plants, utilities, transmission facilities near the site
- OSM: Can provide geographic context for power infrastructure
- PERPLEXITY: Can provide expert analysis based on infrastructure data from SERP and OSM
- FIRECRAWL: Can extract real-time power grid status and regulatory information
```

2. **Claude is asked to analyze data it doesn't have access to**:
```javascript
// Lines 44-47: IMPOSSIBLE
1. Provide your expert analysis in 3 sentences as requested
2. ALWAYS use SERP, OSM, and PERPLEXITY tools for comprehensive analysis
3. PERPLEXITY tool should be used to analyze data from SERP and OSM tools
```

3. **Tool actions are hardcoded, not dynamic**:
```javascript
// Lines 53-75: STATIC
"toolActions": [
  {
    "tool": "SERP",
    "reason": "Why SERP is needed for this analysis",
    "queries": ["power plants", "electric utilities", "transmission facilities"],
    "priority": "high",
    "expectedOutcome": "Real-time power infrastructure data near Whitney site"
  }
  // ... same hardcoded actions for every query
]
```

#### **What Actually Happens**
1. **Claude receives**: User query + misleading tool instructions
2. **Claude returns**: Hardcoded JSON with static tool actions
3. **System executes**: Tools based on Claude's "fake" instructions
4. **Result**: Works but is architecturally dishonest

### **Proposed "Honest Orchestrator" Approach**

#### **1. Clear Role Definition**
```javascript
const getPowerGridPrompt = (questionData) => {
  return `You are a power grid analysis orchestrator for the CyrusOne site in Whitney, TX (Bosque County).

YOUR ROLE:
- Analyze the user's question to understand what information is needed
- Determine which data collection tools should be used
- Provide an initial analysis based on your knowledge
- Return instructions for the system to execute specific tools

YOU CANNOT:
- Execute tools yourself
- Access real-time data
- See tool results

USER QUESTION: ${questionData.query}

ANALYSIS REQUIRED:
1. What specific information does this question need?
2. Which tools would provide that information?
3. What should the system search for?
4. What's your initial assessment based on general knowledge?

RESPOND IN THIS FORMAT:
{
  "initialAnalysis": "Your 3-sentence analysis based on general knowledge",
  "informationNeeded": ["specific data points needed"],
  "toolInstructions": [
    {
      "tool": "SERP",
      "searchQueries": ["specific search terms"],
      "reason": "Why this search is needed",
      "priority": "high/medium/low"
    }
  ],
  "expectedOutcome": "What the tools should find"
}`;
};
```

#### **2. Dynamic Tool Selection Examples**

**Query: "What is the power grid reliability score?"**
```javascript
{
  "initialAnalysis": "Based on general ERCOT knowledge, the Whitney area has moderate reliability with some transmission constraints.",
  "informationNeeded": [
    "Current power plant capacity near Whitney",
    "Transmission line capacity and condition", 
    "Recent grid stability events",
    "ERCOT reliability metrics for the area"
  ],
  "toolInstructions": [
    {
      "tool": "SERP",
      "searchQueries": ["power plants near Whitney TX", "ERCOT transmission lines Bosque County", "power grid reliability Whitney Texas"],
      "reason": "Need current infrastructure data and reliability metrics",
      "priority": "high"
    },
    {
      "tool": "OSM", 
      "searchQueries": ["power infrastructure Whitney TX", "transmission lines Bosque County"],
      "reason": "Need geographic context of power infrastructure",
      "priority": "medium"
    },
    {
      "tool": "PERPLEXITY",
      "searchQueries": ["ERCOT grid reliability analysis Whitney TX", "power grid risk assessment Bosque County"],
      "reason": "Need expert analysis of grid reliability factors",
      "priority": "high"
    }
  ]
}
```

**Query: "What are the main transmission lines serving this area?"**
```javascript
{
  "initialAnalysis": "The Whitney area is likely served by multiple transmission lines from ERCOT's North Central zone.",
  "informationNeeded": [
    "Transmission line routes and capacity",
    "Substation locations and interconnections",
    "Line condition and age",
    "Redundancy and backup routes"
  ],
  "toolInstructions": [
    {
      "tool": "SERP",
      "searchQueries": ["transmission lines Whitney TX", "ERCOT substations Bosque County", "power line routes Whitney"],
      "reason": "Need specific transmission infrastructure data",
      "priority": "high"
    },
    {
      "tool": "OSM",
      "searchQueries": ["power lines Whitney TX", "electrical infrastructure Bosque County"],
      "reason": "Need geographic mapping of transmission routes",
      "priority": "high"
    }
    // No Perplexity needed for this factual query
  ]
}
```

#### **3. Honest Limitation Handling**
```javascript
// Query: "What will happen to power reliability in 5 years?"
{
  "initialAnalysis": "I cannot predict future power grid conditions, but I can analyze current infrastructure and identify potential risk factors.",
  "informationNeeded": [
    "Current infrastructure age and condition",
    "Planned upgrades or expansions",
    "Historical reliability trends",
    "Environmental and regulatory factors"
  ],
  "toolInstructions": [
    {
      "tool": "SERP",
      "searchQueries": ["ERCOT grid expansion plans", "power infrastructure upgrades Whitney TX", "future transmission projects Texas"],
      "reason": "Need information about planned infrastructure changes",
      "priority": "high"
    }
  ],
  "limitations": "Cannot predict future events, only analyze current conditions and trends"
}
```

### **Implementation Changes Required**

#### **1. Remove Hardcoded Elements**
- Remove static tool action templates
- Remove misleading "Available Tools" section
- Remove hardcoded query arrays

#### **2. Add Query Analysis Logic**
- Implement dynamic tool selection based on query content
- Add information need analysis
- Add limitation detection and handling

#### **3. Improve Response Structure**
- Make JSON response more flexible and query-aware
- Add proper error handling for unsupported queries
- Add confidence scoring for tool recommendations

#### **4. Enhanced Response Parsing**
- Update `executePowerGridTools` to handle new JSON structure
- Add validation for dynamic tool instructions
- Improve error handling for malformed responses

### **Benefits of Honest Approach**

1. **Transparent**: Claude knows its actual capabilities and limitations
2. **Dynamic**: Tool selection based on real query analysis
3. **Intelligent**: Different queries get different tool strategies
4. **Honest**: No pretending Claude can do things it can't
5. **Flexible**: Can handle various types of power grid questions
6. **Maintainable**: Easier to debug and improve
7. **Scalable**: Can easily add new tools or modify existing ones

### **Migration Strategy**

1. **Phase 1**: Implement honest prompt alongside current system
2. **Phase 2**: Add query analysis logic and dynamic tool selection
3. **Phase 3**: Update response parsing to handle new JSON structure
4. **Phase 4**: Remove old hardcoded system
5. **Phase 5**: Add advanced features (limitation handling, confidence scoring)

---

## **Updated Architecture Flow (December 20, 2024)**

### **Enhanced Two-Phase Analysis Sequence**

**Phase 1: Claude Preliminary Analysis** (Server.js → useAIQuery.js)
1. User clicks ERCOT Power Grid Reliability question
2. Enhanced Claude prompt provides structured preliminary analysis:
   - Initial Assessment (ERCOT/grid operator knowledge)
   - Critical Infrastructure Factors  
   - Data Requirements
   - Regional Context (location-aware)
3. Professional formatting with confidence scoring
4. Immediate display in AIResponseDisplayRefactored.jsx

**Phase 2: Dual Tool Assessment** (Triggered separately)
1. **Information Gathering Stage**: 
   - SERP/Google Places: Power infrastructure data collection
   - OSM: Geographic context and spatial relationships
2. **Analysis Stage**:
   - Data fed to PerplexityTool.js via ToolExecutor.js
   - Comprehensive technical analysis generated
3. **Display Stage**:
   - Response filtered through CategoryToggle.jsx
   - Tables rendered via InfrastructureSummaryTable.jsx
   - NODE vs SITE analysis modes (NODE active, SITE planned)

**Phase 3: Future SITE Mode Integration** (Planned)
- Feed Perplexity NODE analysis back to Claude
- Generate comprehensive SITE-level strategic assessment
- Display unified analysis in BaseCard.jsx

### **Key Enhancement Benefits**
- ✅ **Preserved Demo Functionality**: Dual data layer works identically
- ✅ **Enhanced User Experience**: Better initial Claude responses
- ✅ **Geographic Flexibility**: Multi-location support without architecture changes
- ✅ **Cache Compatibility**: All existing cached responses remain valid
- ✅ **Professional Quality**: Structured analysis framework with confidence scoring

This documentation provides a complete understanding of the enhanced two-phase analysis flow with improved Claude integration while preserving all existing dual data layer functionality.
