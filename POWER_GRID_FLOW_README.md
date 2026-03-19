# Power Grid Reliability Analysis - Complete Flow Documentation

> **📋 Primary Documentation**: This README is part of the comprehensive system documentation. For the complete architectural overview and production readiness plan, see **[WEEK01_REPORT_SEPT2025.md](../WEEK01_REPORT_SEPT2025.md)**.

## 🎯 **Overview**

This document describes the complete cascade that occurs when a user clicks the **"Power Grid Reliability - Analyze ERCOT grid stability and transmission capacity for Whitney site"** question in the `AskAnythingInput.jsx` component. The flow involves multiple systems working together to provide comprehensive power grid analysis with real-time data visualization.

---

## 🚀 **Complete User Journey**

### **Step 1: User Interaction**
**Location**: `src/components/Map/components/Cards/AskAnythingInput.jsx` & `src/components/Map/components/Cards/AIQuestionsSection.jsx`

```javascript
// Hardcoded question in AIQuestionsSection.jsx (lines 46-49)
{
  id: 'power_reliability',
  text: 'Power Grid Reliability - Analyze ERCOT grid stability and transmission capacity for Whitney site',
  query: 'For the CyrusOne data center site in Whitney, TX (Bosque County), provide a brief executive summary in 3 sentences: What is the power grid reliability score (1-10), what is the main risk factor, and which grid operator manages this area?'
}
```

**What Happens**:
1. User clicks the Power Grid Reliability question button
2. `handleAIQuery(questionData)` is called with the question object
3. The system detects `questionData.id === 'power_reliability'`

---

## 🧠 **Step 2: AI Query Processing**
**Location**: `src/hooks/useAIQuery.js`

### **2.1 Enhanced Prompt Generation**
```javascript
// Lines 29-90: getPowerGridPrompt function
const getPowerGridPrompt = (questionData) => {
  if (questionData.id === 'power_reliability') {
    return `You are an expert data center consultant analyzing power grid reliability for the CyrusOne site in Whitney, TX (Bosque County).

Available Tools:
- CLAUDE: Primary LLM for analysis and orchestration decisions (current system)
- SERP: Can search for power plants, utilities, transmission facilities near the site
- OSM: Can provide geographic context for power infrastructure
- PERPLEXITY: Can provide expert analysis based on infrastructure data from SERP and OSM
- FIRECRAWL: Can extract real-time power grid status and regulatory information

User Question: ${questionData.query}

Instructions:
1. Provide your expert analysis in 3 sentences as requested
2. ALWAYS use SERP, OSM, and PERPLEXITY tools for comprehensive analysis
3. PERPLEXITY tool should be used to analyze data from SERP and OSM tools
4. Respond in this JSON format:

{
  "textResponse": "Your 3-sentence expert analysis here",
  "useTools": true,
  "toolActions": [
    {
      "tool": "SERP",
      "reason": "Why SERP is needed for this analysis",
      "queries": ["power plants", "electric utilities", "transmission facilities"],
      "priority": "high",
      "expectedOutcome": "Real-time power infrastructure data near Whitney site"
    },
    {
      "tool": "OSM",
      "reason": "Why OSM is needed for geographic context",
      "queries": ["geographic features", "land use", "infrastructure context"],
      "priority": "medium",
      "expectedOutcome": "Geographic context and land use data around the site"
    },
    {
      "tool": "PERPLEXITY",
      "reason": "Why Perplexity is needed for comprehensive analysis",
      "queries": ["power grid analysis", "infrastructure assessment", "reliability evaluation"],
      "priority": "high",
      "expectedOutcome": "Detailed analysis based on SERP and OSM data findings"
    }
  ]
}`;
  }
}
```

### **2.2 Tool Feedback Initialization**
```javascript
// Lines 175-183: Initial tool feedback
if (questionData.id === 'power_reliability') {
  updateToolFeedback({
    isActive: true,
    tool: 'claude',
    status: 'Claude analyzing power grid with tool awareness...',
    progress: 20,
    details: 'Evaluating ERCOT grid stability and determining tool requirements'
  });
}
```

---

## 🌐 **Step 3: Server Communication**
**Location**: `server.js`

### **3.1 Claude API Request**
```javascript
// Lines 193-205: Request to Claude API
const requestBody = {
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 2000,
  system: getPowerGridPrompt(questionData),
  messages: [
    {
      role: 'user',
      content: questionData.query
    }
  ]
};

// Lines 230-236: API call to local proxy server
const response = await fetch('http://localhost:3001/api/claude', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(requestBody)
});
```

### **3.2 Server Processing**
**Location**: `server.js` (Claude API endpoint)

The server receives the enhanced prompt and forwards it to Claude 3.5 Sonnet, which:
1. Analyzes the power grid reliability question
2. Determines that tools are needed for comprehensive analysis
3. Returns a JSON response with both text analysis and tool instructions

---

## 🔧 **Step 4: Tool Orchestration**
**Location**: `src/utils/PowerGridToolExecutor.js`

### **4.1 Response Parsing and Tool Execution**
```javascript
// Lines 272-318: JSON response parsing
if (questionData.id === 'power_reliability') {
  try {
    const parsedResponse = JSON.parse(aiResponse);
    if (parsedResponse.textResponse && parsedResponse.toolActions) {
      
      // Channel 1: Display text response immediately
      const formattedResponse = `## Power Grid Reliability Analysis\n\n${parsedResponse.textResponse}`;
      updateResponseOnly(queryId, formattedResponse, responseCitations, false);
      
      // Channel 2: Execute tool actions if requested
      if (parsedResponse.useTools && parsedResponse.toolActions.length > 0) {
        await executePowerGridTools(correctedToolActions, queryId);
      }
    }
  } catch (parseError) {
    // Fallback to standard text processing
  }
}
```

### **4.2 Tool Execution Flow**
```javascript
// Lines 393-483: executePowerGridTools function
const executePowerGridTools = async (toolActions, queryId) => {
  // Create tool executor instance
  const toolExecutor = createPowerGridToolExecutor(map, updateToolFeedback, handleMarkerClick);
  
  // Execute tools based on Claude's recommendations
  const results = await toolExecutor.executeMultipleTools(toolActions);
  
  // Check for Perplexity analysis and update response
  const perplexityResult = results.results.find(r => r.tool === 'PERPLEXITY' && r.success);
  if (perplexityResult) {
    // Update response with Perplexity analysis
    updateResponseOnly(queryId, enhancedResponse, perplexityCitations, false);
  }
};
```

---

## 🛠️ **Step 5: Individual Tool Execution**

### **5.1 SERP Tool Execution**
**Location**: `src/utils/tools/SerpTool.js`

```javascript
// Lines 16-372: execute method
async execute(queries, coordinates, map, handleMarkerClick) {
  // Enhanced Google Places search for power infrastructure
  const enhancedResults = await this.executeEnhancedGooglePlacesSearch(
    originalQuery, 
    lat, 
    lng
  );
  
  // Process and categorize results
  const processedFeatures = this.processSerpResults(enhancedResults);
  
  // Add to map with proper styling
  this.addSerpFeaturesToMap(map, processedFeatures);
  
  // Emit data loaded event
  window.mapEventBus.emit('serp:dataLoaded', processedFeatures);
}
```

**What SERP Does**:
1. Searches for power plants, electric utilities, transmission facilities near Whitney, TX
2. Uses Google Places API as fallback if SERP API fails
3. Categorizes results into power plants, electric utilities, data centers
4. Adds markers to the map with color-coded categories
5. Emits `serp:dataLoaded` event for legend integration

### **5.2 OSM Tool Execution**
**Location**: `src/utils/tools/OsmTool.js`

```javascript
// Lines 15-69: execute method
async execute(queries, coordinates, map = null) {
  // Execute OSM Overpass API query
  const osmData = await this.executeOsmOverpassQuery(coordinates, map);
  
  // Process OSM elements into features
  const osmFeatures = await this.processOsmElements(osmData);
  
  // Add OSM features to map
  await this.addOsmFeaturesToMap(map, osmFeatures, lat, lng);
  
  // Emit data loaded event
  window.mapEventBus.emit('osm:dataLoaded', osmFeatures);
}
```

**What OSM Does**:
1. Queries OpenStreetMap Overpass API for geographic features
2. Searches for power lines, electrical facilities, transmission infrastructure
3. Provides geographic context around the Whitney site
4. Adds geographic features to the map
5. Emits `osm:dataLoaded` event

### **5.3 Dual Perplexity Analysis System**
**Location**: `src/utils/PowerGridToolExecutor.js`

The system implements a sophisticated **dual-analysis approach** with two distinct Perplexity calls:

#### **Phase 1: Node-Level Analysis**
```javascript
// Lines 36-38: First Perplexity call for detailed node analysis
const nodeAnalysisResult = await super.executeMultipleTools(toolActions);
```

**What Node-Level Analysis Does**:
1. Analyzes individual infrastructure components (power plants, utilities, transmission lines)
2. Provides detailed assessment for each specific node
3. Generates granular insights about each facility's capabilities and risks
4. Creates comprehensive node-by-node breakdown

#### **Phase 2: Site-Level Strategic Analysis**
```javascript
// Lines 40-41: Second Perplexity call for strategic site insights
const siteInsightsResult = await this.generateSiteInsights(nodeAnalysisResult, query);
```

**What Site-Level Analysis Does**:
1. Takes node-level analysis as input
2. Generates executive-level strategic insights
3. Provides aggregated site-wide power grid assessment
4. Creates high-level recommendations and risk summaries

#### **Dual Data Storage System**
```javascript
// Lines 44-49: Store both analysis levels
this.lastDualAnalysisResult = {
  nodeLevel: nodeAnalysisResult,    // Detailed node analysis
  siteLevel: siteInsightsResult,    // Strategic site insights
  query: query,
  timestamp: Date.now()
};
```

**Global Data Access**:
```javascript
// Lines 411-421: Global access functions
export const getGlobalDualAnalysisData = () => {
  if (globalToolExecutorInstance && globalToolExecutorInstance.hasDualAnalysisData()) {
    return globalToolExecutorInstance.getDualAnalysisData();
  }
  return null;
};

export const hasGlobalDualAnalysisData = () => {
  if (globalToolExecutorInstance) {
    return globalToolExecutorInstance.hasDualAnalysisData();
  }
  return false;
};
```

---

## 🗺️ **Step 6: Map Integration**
**Location**: `src/components/Map/components/TransportationNetworkLayer.jsx` & Map Components

### **6.1 Map Marker Display**
The tools add various markers to the map:

**SERP Markers**:
- 🔴 **Power Plants**: Red markers for generation facilities
- 🟡 **Electric Utilities**: Yellow markers for utility companies
- 🟣 **Data Centers**: Purple markers for existing data centers
- ⚫ **Other Infrastructure**: Gray markers for other facilities

**OSM Markers**:
- 🟢 **Geographic Features**: Green markers for geographic context
- 🔵 **Power Lines**: Blue markers for transmission infrastructure
- 🟠 **Land Use**: Orange markers for zoning and land use data

### **6.2 Legend Integration**
**Location**: `src/components/Map/components/Cards/LegendContainer.jsx`

```javascript
// Lines 55-90: handleSerpDataLoaded function
const handleSerpDataLoaded = (data) => {
  if (data && data.features) {
    const categories = {};
    data.features.forEach(feature => {
      const category = feature.properties.category;
      if (category) {
        categories[category] = (categories[category] || 0) + 1;
      }
    });
    
    setLegendData({
      categories: categories,
      totalFeatures: data.features.length,
      lastUpdated: new Date().toISOString()
    });
  }
};
```

**What the Legend Shows**:
- Total number of infrastructure features found
- Breakdown by category (power plants, utilities, etc.)
- Interactive legend items that highlight corresponding map markers
- Click functionality to zoom to specific infrastructure types

---

## 📊 **Step 7: Response Display**
**Location**: `src/components/Map/components/Cards/AIResponseDisplay.jsx`

### **7.1 Initial Claude Response**
```javascript
// Lines 108-236: renderResponseWithCitations function
const renderResponseWithCitations = (responseText, citations) => {
  // Process and format the response text
  const processedText = processFullResponse(responseText);
  
  return (
    <div style={{ lineHeight: '1.6' }}>
      {processedText.map((element, index) => (
        <span key={`text-${index}-${Date.now()}-${Math.random()}`}>
          {element}
        </span>
      ))}
    </div>
  );
};
```

### **7.2 Enhanced Response with Tool Data**
After tool execution completes, the response is updated with:
1. **Original Claude Analysis**: 3-sentence executive summary
2. **Tool Results**: Data from SERP, OSM, and Perplexity
3. **Data Sources**: Information about what data was used
4. **Enhanced Insights**: Combined analysis from all tools

---

## 🎛️ **Step 8: Dual Analysis Category Toggle System**
**Location**: `src/components/Map/components/Cards/CategoryToggle.jsx`

### **8.1 Dual Analysis Data Integration**
```javascript
// Lines 15-16: Access global dual analysis data
const dualAnalysisData = hasGlobalDualAnalysisData() ? getGlobalDualAnalysisData() : null;

// Lines 57-124: getActiveResponse function with dual analysis support
const getActiveResponse = () => {
  if (dualAnalysisData) {
    // Use dual analysis data when available
    if (viewMode === 'node' && dualAnalysisData.nodeLevel) {
      // Return node-level detailed analysis
      return dualAnalysisData.nodeLevel;
    } else if (viewMode === 'site' && dualAnalysisData.siteLevel) {
      // Return site-level strategic insights
      return dualAnalysisData.siteLevel;
    }
  }
  
  // Fallback to original response (backward compatible)
  return perplexityResponse;
};
```

### **8.2 View Mode Toggle System**
The system provides two distinct analysis modes:

#### **SITE Mode** (Default)
- **Data Source**: `dualAnalysisData.siteLevel`
- **Content**: Aggregated site-level strategic insights
- **Format**: Executive summary with high-level recommendations
- **Use Case**: Strategic decision-making and overview

#### **NODE Mode** 
- **Data Source**: `dualAnalysisData.nodeLevel`
- **Content**: Detailed node-level analysis for specific infrastructure
- **Format**: Granular breakdown of individual facilities
- **Use Case**: Technical analysis and detailed assessment

### **8.3 Category Filtering Across Dual Analysis**
The system provides 5 main categories that work across both analysis modes:
- **ALL**: Complete analysis (site or node level)
- **PWR**: Power generation and reliability analysis
- **TRN**: Transmission and grid infrastructure analysis
- **UTL**: Local utilities and services analysis
- **RSK**: Risk factors and mitigation analysis

### **8.4 Dynamic Response Switching**
```javascript
// Lines 86-124: Site-level vs Node-level response handling
if (viewMode === 'site' && dualAnalysisData.siteLevel) {
  // Handle site-level strategic analysis filtering
  return filterSiteLevelResponse(response, categoryId);
} else {
  // Handle node-level detailed analysis filtering
  return filterNodeLevelResponse(response, categoryId);
}
```

### **8.5 View Mode Toggle Button**
```javascript
// Lines 315-357: View mode toggle button
{dualAnalysisData && onViewModeChange && (
  <button
    onClick={() => {
      const newMode = viewMode === 'site' ? 'node' : 'site';
      onViewModeChange(newMode);
    }}
    title={`Currently: ${viewMode.toUpperCase()} mode - Click to switch to ${viewMode === 'site' ? 'NODE' : 'SITE'} mode`}
  >
    {viewMode.toUpperCase()}
  </button>
)}
```

---

## 🔄 **Step 9: Interactive Features**

### **9.1 Marker Interaction**
**Location**: `src/components/Map/components/Cards/LegendContainer.jsx`

```javascript
// Lines 112-170: handleLegendItemClick function
const handleLegendItemClick = (displayLabel) => {
  // Map display labels to categories
  const categoryMap = {
    'Power Plants': 'power plants',
    'Electric Utilities': 'electric utilities',
    'Data Centers': 'data centers'
  };
  
  // Find corresponding markers
  const markers = findMarkersByCategory(categoryMap[displayLabel]);
  
  // Highlight and zoom to markers
  highlightMarkerOnMap(markerData);
  zoomToMarker(markerData);
  
  // Update BaseCard with marker information
  handleMarkerClick(markerData);
};
```

### **9.2 CategoryToggle Integration**
When a user clicks on a legend item:
1. **Map Interaction**: Marker is highlighted in red and map zooms to it
2. **Mode Switch**: Automatically switches to NODE mode
3. **Category Filter**: Shows analysis specific to that infrastructure node
4. **BaseCard Update**: Displays detailed information about the selected marker

---

## 📈 **Step 10: Final User Experience**

### **10.1 Complete Dual Analysis Display**
The user sees:
1. **Claude's Initial Analysis**: 3-sentence executive summary
2. **Map Visualization**: Color-coded infrastructure markers
3. **Interactive Legend**: Categorized infrastructure with counts
4. **Dual Perplexity Analysis**: 
   - **Node-Level**: Detailed analysis of individual infrastructure components
   - **Site-Level**: Strategic aggregated insights and recommendations
5. **View Mode Toggle**: Switch between SITE and NODE analysis modes
6. **Category Filtering**: Filter analysis by infrastructure type across both modes
7. **Dynamic Response Switching**: Seamless transition between analysis levels

### **10.2 Enhanced Data Flow Summary**
```
User Click → Enhanced Prompt → Claude Analysis → Tool Orchestration → 
SERP Data → OSM Data → Dual Perplexity Analysis:
  ├── Phase 1: Node-Level Analysis (detailed infrastructure breakdown)
  └── Phase 2: Site-Level Analysis (strategic aggregated insights)
→ Dual Data Storage → Map Visualization → Legend Integration → 
View Mode Toggle → Category Filtering → Interactive Dual Display
```

### **10.3 Dual Analysis Benefits**
- **Comprehensive Coverage**: Both granular and strategic perspectives
- **Flexible Viewing**: Users can switch between detailed and executive views
- **Enhanced Filtering**: Category filters work across both analysis levels
- **Seamless UX**: Single interface for multiple analysis depths
- **Data Persistence**: Both analysis levels stored and accessible

---

## 🎯 **Key Components and Their Roles**

| Component | Role | Key Function |
|-----------|------|--------------|
| **AskAnythingInput.jsx** | User Interface | Displays question buttons and handles clicks |
| **useAIQuery.js** | AI Orchestration | Manages Claude communication and tool coordination |
| **PowerGridToolExecutor.js** | Dual Analysis Management | Executes dual Perplexity analysis (node + site level) |
| **SerpTool.js** | Infrastructure Data | Searches for power plants, utilities, transmission facilities |
| **OsmTool.js** | Geographic Context | Provides geographic features and power infrastructure mapping |
| **PerplexityTool.js** | AI Analysis | Generates comprehensive power grid analysis |
| **AIResponseDisplay.jsx** | Response Display | Shows Claude and dual Perplexity analysis results |
| **CategoryToggle.jsx** | Dual Analysis Filtering | Manages view mode switching and category filtering across dual analysis |
| **LegendContainer.jsx** | Map Legend | Interactive legend with marker highlighting |
| **TransportationNetworkLayer.jsx** | Map Integration | Manages map layers and marker display |

---

## 🔧 **Technical Architecture**

### **Event Bus Communication**
```javascript
// Global event bus for component communication
window.mapEventBus.emit('serp:dataLoaded', serpData);
window.mapEventBus.emit('osm:dataLoaded', osmData);
window.mapEventBus.emit('marker:selected', markerData);
window.mapEventBus.emit('marker:deselected');
```

### **Dual Analysis System**
- **Node-Level**: Detailed analysis of individual infrastructure components
- **Site-Level**: Aggregated strategic insights across all infrastructure
- **Mode Switching**: Seamless transition between analysis levels

### **Caching System**
- **Response Cache**: Stores Claude responses to avoid redundant API calls
- **Tool Cache**: Caches SERP and OSM data for performance
- **Auto-Clear**: Automatic cache cleanup to prevent memory issues

---

## 🎉 **Success Metrics**

The Power Grid Reliability analysis system successfully provides:

1. ✅ **Comprehensive Analysis**: Claude + Perplexity + Real Data
2. ✅ **Interactive Visualization**: Map markers with legend integration
3. ✅ **Dual-Mode Insights**: Site-level and node-level analysis
4. ✅ **Category Filtering**: Organized content by infrastructure type
5. ✅ **Real-Time Data**: Current power infrastructure information
6. ✅ **Seamless UX**: Smooth flow from question to analysis
7. ✅ **Error Handling**: Robust fallbacks for API failures
8. ✅ **Performance**: Cached responses and optimized tool execution

---

## 🚀 **Future Enhancements**

1. **Multi-Tool Coordination**: Enhanced coordination between all tools
2. **Real-Time Updates**: Live power grid status monitoring
3. **Advanced Filtering**: More granular category options
4. **Historical Analysis**: Track infrastructure changes over time
5. **Predictive Insights**: AI-powered future reliability predictions
6. **Regulatory Integration**: Real-time permit and approval tracking

---

This comprehensive flow demonstrates how the system transforms a simple user question into a rich, interactive analysis experience with real-time data visualization and AI-powered insights.
