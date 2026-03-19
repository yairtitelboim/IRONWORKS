
## 1. SERP Tool Data Collection (`SerpTool.js`)

### Data Sources
- **Primary**: SERP API (Google Places fallback)
- **Search Radius**: 15 miles (24,140 meters)
- **Cache Duration**: 30 minutes

### Infrastructure Detection
```javascript
// Enhanced Google Places search strategies
const searchStrategies = [
  'power_infrastructure_direct',    // Direct power searches
  'power_plants',                   // Power generation facilities
  'electrical_substations',         // Transmission infrastructure
  'grid_operators',                // ERCOT/utility operators
  'water_facilities',              // Cooling water sources
  'emergency_services'             // Backup power facilities
];
```

### Data Structure Returned
```javascript
{
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        name: 'TNMP Whitney Substation',
        category: 'electric utilities',
        infrastructure_type: 'electrical_transmission',
        criticality_level: 'critical',
        power_generation: false,
        transmission_capacity: true,
        // ... additional metadata
      }
    }
  ],
  powerPlantsCount: 2,
  substationsCount: 5,
  fiberConnectivity: 'Limited availability'
}
```

### Event Emission
```javascript
// Emits infrastructure counts for Site Assessment
window.mapEventBus.emit('serp:infrastructureCounts', {
  powerPlantsCount: 2,
  substationsCount: 5,
  fiberConnectivity: 'Limited availability',
  timestamp: Date.now()
});
```

## 2. OSM Tool Geographic Context (`OsmTool.js`)

### Data Sources
- **API**: OpenStreetMap Overpass API
- **Search Radius**: 15 miles (24,140 meters) - **Enhanced from 6 miles**
- **Cache Duration**: 24 hours

### Enhanced Substation Detection
```javascript
// Comprehensive substation search patterns
const query = `
  node["power"="substation"](around:${visualRadius}, ${lat}, ${lng});
  way["power"="substation"](around:${visualRadius}, ${lat}, ${lng});
  node["substation"~"transmission|distribution|primary"](around:${visualRadius}, ${lat}, ${lng});
  way["substation"~"transmission|distribution|primary"](around:${visualRadius}, ${lat}, ${lng});
  node["power"~"substation|switch"](around:${visualRadius}, ${lat}, ${lng});
  way["power"~"substation|switch"](around:${visualRadius}, ${lat}, ${lng});
`;
```

### Data Structure Returned
```javascript
{
  features: [...], // Visual map features
  powerInfrastructure: [...], // Power-specific infrastructure
  visualLayers: {
    substations: [...],      // Substation features
    powerPlants: [...],      // Power generation
    transmission: [...],     // Transmission lines
    water: [...],           // Water features
    industrial: [...],      // Industrial zones
    transportation: [...]   // Transportation access
  },
  // Infrastructure data for Site Assessment
  substationsCount: 0,  // Enhanced detection
  waterAccess: 'Water features available',
  landUse: 'Industrial zones present',
  transportationAccess: 'Major transportation nearby',
  criticalInfrastructure: 'Critical facilities nearby'
}
```

### Event Emission
```javascript
// Emits OSM infrastructure data for Site Assessment
window.mapEventBus.emit('osm:infrastructureData', {
  substationsCount: 0,
  waterAccess: 'Water features available',
  landUse: 'Industrial zones present',
  transportationAccess: 'Major transportation nearby',
  criticalInfrastructure: 'Critical facilities nearby',
  timestamp: Date.now()
});
```

## 3. Perplexity Tool AI Analysis (`PerplexityTool.js`)

### Data Processing
- **Input**: SERP + OSM infrastructure data
- **Analysis**: Data-driven power grid reliability assessment
- **Output**: Structured node analysis with scores and citations

### Enhanced Prompt Structure
```javascript
const analysisPrompt = `
You are conducting a POWER GRID RELIABILITY ANALYSIS for a data center site.

**INFRASTRUCTURE NODES TO ANALYZE (LIMIT: TOP 5 MOST CRITICAL):**
${infrastructureSummary.powerInfrastructure.slice(0, 5).map((item, index) =>
  `${index + 1}. **${item.name}** - ${item.category} (~${item.distance} miles)`
).join('\n')}

**MANDATORY DATA SOURCES:**
- EIA State Electricity Data: https://www.eia.gov/electricity/data/state/
- EIA Power Plant Data: https://www.eia.gov/electricity/data/eia860/
- ERCOT Public Reports: https://www.ercot.com/news/reports
- Texas PUC Filings: https://www.puc.texas.gov/
`;
```

### Structured Output Format
```javascript
// Each node analysis follows this structure:
## NODE X: **[Facility Name]**
- **Type:** [Facility type from EIA-860 database]
- **EIA Plant ID:** [EIA plant identifier with source link]

**1. POWER SCORE:** [X/10] **WITH SOURCE**
- **Nameplate Capacity:** [MW capacity from EIA-860 database]
- **Recent Generation:** [Actual generation from EIA state data]
- **Capacity Factor:** [From EIA Electric Power Monthly data]
- **Source Link:** [Direct EIA database URL]
- **Last Updated:** [Data timestamp from EIA]

**2. STABILITY SCORE:** [X/10] **WITH SOURCE**
- **ERCOT Zone:** [Load zone from ERCOT public reports]
- **Grid Integration:** [From FERC market oversight data]
- **Reliability Metrics:** [From EIA reliability data]
- **Source Link:** [ERCOT or FERC report URL]

// ... additional sections for transmission, reliability, regional context, data center impact
```

## 4. Data Integration in `useAIQuery.js`

### Infrastructure Data Storage
```javascript
// Store infrastructure data globally BEFORE Perplexity processing
window.lastInfrastructureData = {
  serp: {
    powerPlantsCount: serpResult.data?.data?.powerPlantsCount,
    substationsCount: serpResult.data?.data?.substationsCount,
    fiberConnectivity: serpResult.data?.data?.fiberConnectivity
  },
  osm: {
    substationsCount: osmResult.data?.substationsCount,
    waterAccess: osmResult.data?.waterAccess,
    landUse: osmResult.data?.landUse,
    transportationAccess: osmResult.data?.transportationAccess,
    criticalInfrastructure: osmResult.data?.criticalInfrastructure
  },
  timestamp: Date.now()
};
```

## 5. Data Parsing in `CategoryToggle.jsx`

### Infrastructure Data Injection
```javascript
const parseTableData = (response) => {
  // Retrieve infrastructure data from global storage
  const infrastructureData = window.lastInfrastructureData;
  
  if (infrastructureData) {
    const { serp, osm } = infrastructureData;
    
    // Inject real infrastructure data into each node
    nodes.forEach(node => {
      node.powerPlantsCount = serp?.powerPlantsCount || 'N/A';
      node.substationsCount = serp?.substationsCount || 'N/A';
      node.fiberConnectivity = serp?.fiberConnectivity || 'Unknown';
      node.waterAccess = osm?.waterAccess || 'Unknown';
      node.landUse = osm?.landUse || 'Unknown';
      node.transportationAccess = osm?.transportationAccess || 'Unknown';
      node.criticalInfrastructure = osm?.criticalInfrastructure || 'Unknown';
    });
  }
  
  return nodes;
};
```

## 6. Site Assessment Overview in `DetailExpandedModal.jsx`

### Timeline-Based Node Intelligence
The Site Assessment Overview transforms from static snapshots to **timeline-based change detection**:

```javascript
// Current static approach (to be replaced)
const SiteAssessment = ({ nodeData, powerGridData, siteAssessmentData, environmentalData }) => {
  return (
    <>
      {/* Primary Metrics - Real Data from Tools */}
      <div className="metrics-grid">
        <div className="power-reliability">
          <div className="score-circle">
            {nodeData.powerScore || 'N/A'}
          </div>
          <div>Power Reliability</div>
          <div>Source: Perplexity Analysis</div>
        </div>
        
        <div className="risk-assessment">
          <div className="risk-circle">
            {nodeData.risk || 'Unknown'}
          </div>
          <div>Risk Level</div>
          <div>Source: Perplexity Analysis</div>
        </div>
        
        <div className="node-type">
          <div className="type-circle">
            {nodeData.type || 'Unknown'}
          </div>
          <div>Node Type</div>
          <div>Source: SERP/OSM</div>
        </div>
      </div>

      {/* Infrastructure Proximity - Real Data from SERP/OSM */}
      <div className="infrastructure-proximity">
        <div className="power-plants">
          <div>Power Plants</div>
          <div>{nodeData.powerPlantsCount || 'Loading...'} within 15 miles</div>
          <div>Source: SERP</div>
        </div>
        
        <div className="substations">
          <div>Substations</div>
          <div>{nodeData.substationsCount || 'Loading...'} within 15 miles</div>
          <div>Source: OSM</div>
        </div>
        
        <div className="water-access">
          <div>Water Access</div>
          <div>{nodeData.waterAccess || 'Loading...'}</div>
          <div>Source: OSM</div>
        </div>
        
        <div className="fiber-connectivity">
          <div>Fiber Connectivity</div>
          <div>{nodeData.fiberConnectivity || 'Loading...'}</div>
          <div>Source: SERP</div>
        </div>
      </div>
    </>
  );
};
```

### Proposed Timeline Enhancement
```javascript
// Future timeline-based approach
const TimelineNodeIntelligence = ({ nodeData, historicalData }) => {
  return (
    <div className="timeline-view">
      <h3>Node Intelligence Timeline (Last 12 Months)</h3>
      
      {/* Power Reliability Score Timeline */}
      <div className="timeline-chart">
        <div className="chart-title">Power Reliability Score</div>
        <svg className="timeline-svg">
          {/* Timeline visualization with X=Time, Y=Score */}
          <path d="M 40 150 L 100 145 L 160 140 L 220 130 L 280 125 L 340 115" 
                stroke="#22c55e" strokeWidth="2" fill="none" />
        </svg>
        <div className="timeline-labels">
          <span>Jan</span><span>Apr</span><span>Jul</span><span>Oct</span><span>Dec</span>
        </div>
      </div>

      {/* Recent Changes Detected */}
      <div className="change-events">
        <h4>Recent Changes Detected:</h4>
        <div className="change-event">
          <div className="change-date">Oct 2025</div>
          <div className="change-description">New 345kV transmission line completed (+1 reliability)</div>
          <div className="change-source">Source: SERP detection</div>
        </div>
        <div className="change-event">
          <div className="change-date">Aug 2025</div>
          <div className="change-description">TNMP substation upgrade (+redundancy)</div>
          <div className="change-source">Source: OSM infrastructure change</div>
        </div>
      </div>
    </div>
  );
};
```

## Data Flow Summary

### 1. **Collection Phase**
- **SERP**: Infrastructure facilities within 15 miles
- **OSM**: Geographic context and visual mapping within 15 miles
- **Perplexity**: AI analysis of collected data

### 2. **Processing Phase**
- **useAIQuery.js**: Stores infrastructure data globally
- **CategoryToggle.jsx**: Injects real data into node objects
- **Event System**: Emits data via `window.mapEventBus`

### 3. **Display Phase**
- **DetailExpandedModal.jsx**: Renders Site Assessment Overview
- **Real Data Sources**: All metrics sourced from actual tool outputs
- **Timeline Intelligence**: Change detection for consulting value

### 4. **Consulting Value**
- **Monthly Intelligence Reports**: Not real-time dashboards
- **Change Detection**: What's different since last analysis
- **Investment Signals**: Which nodes are improving/degrading
- **Timeline Visualization**: X=Time, Y=Dynamic metric

## Key Technical Details

### Event Bus Integration
```javascript
// SERP emits infrastructure counts
window.mapEventBus.emit('serp:infrastructureCounts', data);

// OSM emits geographic data
window.mapEventBus.emit('osm:infrastructureData', data);

// Map component listens for events
useEffect(() => {
  const handleSerpData = (data) => setSerpCounts(data);
  const handleOsmData = (data) => setOsmData(data);
  
  window.mapEventBus.on('serp:infrastructureCounts', handleSerpData);
  window.mapEventBus.on('osm:infrastructureData', handleOsmData);
}, []);
```

### Data Structure Consistency
All tools return data in consistent format for seamless integration:
- **Counts**: `powerPlantsCount`, `substationsCount`
- **Access**: `waterAccess`, `fiberConnectivity`
- **Context**: `landUse`, `transportationAccess`, `criticalInfrastructure`
- **Timestamps**: For change detection and caching

This architecture enables the transformation from static data display to **dynamic consulting intelligence** that detects and contextualizes infrastructure changes affecting multi-hundred-million-dollar data center investments.

## File Locations

- **SERP Tool**: `src/utils/tools/SerpTool.js`
- **OSM Tool**: `src/utils/tools/OsmTool.js`
- **Perplexity Tool**: `src/utils/tools/PerplexityTool.js`
- **Data Integration**: `src/hooks/useAIQuery.js`
- **Data Parsing**: `src/components/Map/components/Cards/CategoryToggle.jsx`
- **Site Assessment**: `src/components/Map/components/DetailExpandedModal.jsx`

## Version History

- **v1.0** (Current): Initial documentation of data transmission sequence
- **Future**: Timeline-based node intelligence implementation