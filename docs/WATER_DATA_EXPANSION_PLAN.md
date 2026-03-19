# Water Data Expansion Plan: TSMC Phoenix Water Supply Analysis

## Executive Summary

This document outlines a plan to expand the MCP infrastructure search system with comprehensive water data to answer critical questions about **TSMC's water supply in Phoenix**, specifically:

> **"TSMC Is Building Three Fabs in Phoenix. Where Does the Water Come From?"**

### The Problem

- **Current allocation**: 4.7M gallons/day for Fab 1
- **Projected need**: 12-18M gallons/day for 3 fabs
- **Gap**: 7-13M gallons/day shortfall
- **Source**: Agricultural retirement + water rights arbitrage
- **Current data**: Only basic OSM waterways (canals, drains) - **insufficient for analysis**

### The Goal

Build a comprehensive water data layer that can:
1. Map water allocations and rights
2. Track agricultural land retirement
3. Identify CAP (Central Arizona Project) water transfers
4. Show State Trust land conversions
5. Visualize groundwater rights
6. Connect water sources to TSMC facility

---

## Current State Analysis

### What We Have (TSMC Phoenix Water Dataset)

**Location**: `public/osm/nc_power_tsmc_phoenix_water.json`

**Statistics**:
- 414 water features (1.9% of total dataset)
- 177 canals (mostly unnamed)
- 197 drains
- 8 water towers
- 2 water works facilities
- 1 reservoir

**Limitations**:
- ❌ No capacity/flow data
- ❌ No water allocation information
- ❌ No connection to TSMC facility
- ❌ No agricultural land data
- ❌ No CAP water data
- ❌ No State Trust land data
- ❌ No groundwater rights data

---

## Data Sources & Collection Strategy

### Phase 1: Municipal Water Infrastructure (OSM Expansion)

**Goal**: Expand OSM queries to capture complete municipal water system

**New OSM Tags to Query**:
```python
# Water distribution infrastructure
node["man_made"="pipeline"]["substance"="water"](around:radius, lat, lon);
way["man_made"="pipeline"]["substance"="water"](around:radius, lat, lon);

# Treatment facilities
node["amenity"="water_treatment"](around:radius, lat, lon);
way["amenity"="water_treatment"](around:radius, lat, lon);
relation["amenity"="water_treatment"](around:radius, lat, lon);

# Reclamation facilities
node["man_made"="wastewater_plant"](around:radius, lat, lon);
way["man_made"="wastewater_plant"](around:radius, lat, lon);

# Pumping stations
node["man_made"="pumping_station"]["pumping_station"="water_works"](around:radius, lat, lon);
way["man_made"="pumping_station"]["pumping_station"="water_works"](around:radius, lat, lon);

# Water storage
node["man_made"="reservoir"](around:radius, lat, lon);
way["man_made"="reservoir"](around:radius, lat, lon);
```

**Implementation**:
- Update `scripts/osm-tools/nc_power_utility_osm.py`
- Add new category: `municipal_water`
- Expand `WATER_MAN_MADE` and `WATER_AMENITIES` constants
- Regenerate cache files

**Expected Output**: 200-500 additional water infrastructure features

---

### Phase 2: Phoenix Water Services Department Data

**Goal**: Get official municipal water allocation and distribution data

**Data Sources**:
1. **Phoenix Water Services Department**
   - Water allocation records
   - Service area boundaries
   - Treatment plant locations and capacities
   - Distribution network maps

2. **SRP (Salt River Project)**
   - Water rights and allocations
   - Canal system data
   - Water delivery infrastructure

3. **ADWR (Arizona Department of Water Resources)**
   - Groundwater rights
   - Active Management Area (AMA) data
   - Water allocation permits

**Collection Methods**:
- **Public Records Requests**: FOIA requests for water allocation data
- **API Integration**: Check for public APIs (SRP, ADWR)
- **Web Scraping**: Extract data from public databases
- **Manual Data Entry**: For critical non-digital records

**Data Format**:
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [lng, lat]
  },
  "properties": {
    "category": "water_allocation",
    "facility": "TSMC Phoenix Fab 1",
    "allocation_gpd": 4700000,
    "source": "Phoenix Water Services",
    "permit_number": "W-XXXXX",
    "status": "active",
    "year_granted": 2021
  }
}
```

**Implementation**:
- Create new data file: `public/water/phoenix_water_allocations.json`
- Add parser: `src/services/water/phoenixWaterService.js`
- Integrate with MCP search

---

### Phase 3: Agricultural Land & Water Rights Data

**Goal**: Track agricultural retirement and water rights transfers

**Data Sources**:
1. **Arizona State Land Department**
   - State Trust land auctions
   - Land use conversions (ag → industrial)
   - Water rights associated with land parcels

2. **Maricopa County Assessor**
   - Agricultural land parcels
   - Land use changes
   - Property ownership transfers

3. **USDA Agricultural Census**
   - Farm acreage by county
   - Irrigation data
   - Crop water use

4. **CAP (Central Arizona Project)**
   - Water allocation records
   - Agricultural water cuts (512,000 AF/year)
   - Water transfer records

**Collection Methods**:
- **State Trust Land Database**: Query auction records for TSMC's 902-acre filing
- **County GIS Data**: Download parcel data with land use codes
- **CAP Public Records**: Request water allocation and transfer data
- **Satellite/Thermal Imagery**: Use Landsat/MODIS to identify fallow fields

**Data Format**:
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[lng, lat], ...]]
  },
  "properties": {
    "category": "agricultural_land",
    "parcel_id": "XXX-XXX-XXX",
    "current_use": "agricultural",
    "previous_use": "agricultural",
    "water_rights": {
      "groundwater_af_per_year": 500,
      "cap_allocation_af_per_year": 200,
      "transferable": true
    },
    "status": "fallow" | "active" | "converted",
    "conversion_date": "2025-01-XX",
    "new_use": "industrial",
    "buyer": "TSMC" | null,
    "thermal_analysis": {
      "irrigation_reduction_date": "2024-06-XX",
      "confidence": "high"
    }
  }
}
```

**Implementation**:
- Create new data file: `public/water/phoenix_agricultural_water_rights.json`
- Add parser: `src/services/water/agriculturalWaterService.js`
- Add thermal imagery analysis: `src/services/water/thermalAnalysisService.js`

---

### Phase 4: CAP Water Transfer Data

**Goal**: Map CAP water cuts and transfers to industrial use

**Data Sources**:
1. **Central Arizona Project (CAP)**
   - Water allocation database
   - Transfer records (ag → municipal/industrial)
   - Annual allocation reports

2. **Arizona Water Banking Authority**
   - Water storage and recovery
   - Long-term storage credits (LTSC)

**Collection Methods**:
- **CAP Annual Reports**: Extract allocation data
- **Water Transfer Database**: Query public transfer records
- **Water Banking Records**: Track stored water credits

**Data Format**:
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [lng, lat]
  },
  "properties": {
    "category": "cap_water_transfer",
    "source": "agricultural",
    "destination": "industrial" | "municipal",
    "volume_af_per_year": 512000,
    "transfer_date": "2023-XX-XX",
    "recipient": "Phoenix Water Services" | "TSMC",
    "status": "active"
  }
}
```

**Implementation**:
- Create new data file: `public/water/cap_water_transfers.json`
- Add parser: `src/services/water/capWaterService.js`

---

### Phase 5: State Trust Land & TSMC Filings

**Goal**: Map TSMC's 902-acre State Trust land filing and associated water rights

**Data Sources**:
1. **Arizona State Land Department**
   - Auction records (January 2026)
   - Parcel boundaries
   - Water rights documentation

2. **TSMC Public Filings**
   - Land acquisition documents
   - Water rights applications

**Collection Methods**:
- **State Land Department Database**: Query auction records
- **Public Records Requests**: TSMC filings
- **GIS Parcel Data**: Download parcel boundaries

**Data Format**:
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[lng, lat], ...]]
  },
  "properties": {
    "category": "state_trust_land",
    "parcel_id": "XXX",
    "buyer": "TSMC",
    "auction_date": "2026-01-XX",
    "acres": 902,
    "price_per_acre": 900000,
    "water_rights": {
      "groundwater_af_per_year": 6500,
      "cap_substitution_rights": true,
      "transferable": true
    },
    "previous_use": "agricultural",
    "new_use": "industrial",
    "adjacent_parcels_affected": ["parcel_id_1", "parcel_id_2"]
  }
}
```

**Implementation**:
- Create new data file: `public/water/tsmc_state_trust_land.json`
- Add parser: `src/services/water/stateTrustLandService.js`

---

### Phase 6: Thermal Imagery Analysis

**Goal**: Identify farms reducing irrigation 6-12 months before public filings

**Data Sources**:
1. **Landsat 8/9 Thermal Bands**
   - Surface temperature data
   - Irrigation detection

2. **MODIS Thermal Data**
   - Daily temperature composites
   - Crop health indicators

3. **Sentinel-2**
   - NDVI (Normalized Difference Vegetation Index)
   - Crop stress detection

**Collection Methods**:
- **Google Earth Engine**: Access Landsat/MODIS data
- **USGS EarthExplorer**: Download historical imagery
- **Planet Labs API**: High-resolution imagery (if available)

**Analysis Pipeline**:
1. Download thermal imagery for Phoenix area (2023-2025)
2. Calculate surface temperature anomalies
3. Identify irrigation reduction patterns
4. Correlate with land ownership changes
5. Predict future water rights transfers

**Data Format**:
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[lng, lat], ...]]
  },
  "properties": {
    "category": "thermal_analysis",
    "parcel_id": "XXX",
    "irrigation_reduction_date": "2024-06-15",
    "confidence": "high" | "medium" | "low",
    "temperature_anomaly": -2.5,
    "ndvi_change": -0.15,
    "months_before_filing": 8,
    "predicted_conversion": true
  }
}
```

**Implementation**:
- Create analysis script: `scripts/water/thermal_irrigation_analysis.py`
- Use Google Earth Engine or USGS API
- Generate GeoJSON output
- Create new data file: `public/water/phoenix_thermal_irrigation_analysis.json`

---

## System Integration Plan

### Step 1: Extend OSM Query Script

**File**: `scripts/osm-tools/nc_power_utility_osm.py`

**Changes**:
1. Add new water infrastructure tags to query
2. Add `municipal_water` category
3. Expand categorization logic
4. Regenerate cache files

**New Categories**:
```python
WATER_MUNICIPAL = {
    "pipeline": "water",
    "water_treatment": "treatment",
    "wastewater_plant": "reclamation",
    "pumping_station": "pumping",
    "reservoir": "storage"
}
```

---

### Step 2: Create Water Data Service Layer

**New Files**:
- `src/services/water/phoenixWaterService.js` - Municipal water data
- `src/services/water/agriculturalWaterService.js` - Ag land & water rights
- `src/services/water/capWaterService.js` - CAP water transfers
- `src/services/water/stateTrustLandService.js` - State Trust land
- `src/services/water/thermalAnalysisService.js` - Thermal imagery analysis

**Service Interface**:
```javascript
// src/services/water/waterDataService.js
export const fetchWaterData = async (params) => {
  const { facilityKey, radius, category } = params;
  
  // Aggregate data from all sources
  const [
    municipalWater,
    agriculturalRights,
    capTransfers,
    stateTrustLand,
    thermalAnalysis
  ] = await Promise.all([
    phoenixWaterService.fetchAllocations(facilityKey, radius),
    agriculturalWaterService.fetchRights(facilityKey, radius),
    capWaterService.fetchTransfers(facilityKey, radius),
    stateTrustLandService.fetchParcels(facilityKey, radius),
    thermalAnalysisService.fetchAnalysis(facilityKey, radius)
  ]);
  
  return {
    type: 'FeatureCollection',
    features: [
      ...municipalWater.features,
      ...agriculturalRights.features,
      ...capTransfers.features,
      ...stateTrustLand.features,
      ...thermalAnalysis.features
    ],
    summary: {
      municipal_water: municipalWater.features.length,
      agricultural_rights: agriculturalRights.features.length,
      cap_transfers: capTransfers.features.length,
      state_trust_land: stateTrustLand.features.length,
      thermal_analysis: thermalAnalysis.features.length
    }
  };
};
```

---

### Step 3: Extend MCP Query Parser

**File**: `src/mcp/queryParser.js`

**New Keywords**:
```javascript
const categoryKeywords = {
  // ... existing ...
  water_allocation: ['water allocation', 'water rights', 'water permit'],
  agricultural_water: ['agricultural water', 'farm water', 'irrigation water'],
  cap_water: ['cap water', 'central arizona project', 'canal water'],
  state_trust_land: ['state trust land', 'trust land', 'state land'],
  water_transfer: ['water transfer', 'water rights transfer']
};
```

---

### Step 4: Extend Backend API

**File**: `server.js`

**New Endpoint**: `POST /api/mcp/search-water`

**Implementation**:
```javascript
app.post('/api/mcp/search-water', async (req, res) => {
  const { facilityName, facilityKey, radius, category } = req.body;
  
  // Load all water data sources
  const waterData = await fetchWaterData({
    facilityKey,
    radius: radius || 5000,
    category
  });
  
  // Filter by category if specified
  let features = waterData.features;
  if (category) {
    features = features.filter(f => {
      const props = f.properties || {};
      return props.category === category ||
             props.subcategory?.includes(category);
    });
  }
  
  // Calculate distances
  const facilityPoint = getFacilityCoordinates(facilityKey);
  features = features.map(f => {
    const distance = calculateDistance(facilityPoint, f.geometry);
    return {
      ...f,
      properties: {
        ...f.properties,
        distance_m: distance
      }
    };
  });
  
  // Sort by distance
  features.sort((a, b) => 
    (a.properties.distance_m || Infinity) - 
    (b.properties.distance_m || Infinity)
  );
  
  return res.json({
    type: 'FeatureCollection',
    features: features.slice(0, 100),
    summary: waterData.summary
  });
});
```

---

### Step 5: Add New Layer Toggle

**File**: `src/components/Map/components/LayerToggle.jsx`

**New Layer**:
```javascript
const WATER_LAYERS = {
  'water-allocations': {
    name: 'Water Allocations',
    description: 'Phoenix water allocations and permits',
    color: '#06b6d4'
  },
  'agricultural-water-rights': {
    name: 'Agricultural Water Rights',
    description: 'Farm water rights and transfers',
    color: '#84cc16'
  },
  'cap-water-transfers': {
    name: 'CAP Water Transfers',
    description: 'Central Arizona Project water transfers',
    color: '#3b82f6'
  },
  'state-trust-land': {
    name: 'State Trust Land',
    description: 'State Trust land parcels and auctions',
    color: '#f59e0b'
  },
  'thermal-irrigation': {
    name: 'Thermal Irrigation Analysis',
    description: 'Farms reducing irrigation (predictive)',
    color: '#ef4444'
  }
};
```

---

### Step 6: Update MCP Client

**File**: `src/services/mcpClient.js`

**New Function**:
```javascript
export const searchWaterInfrastructure = async ({
  facilityName,
  facilityKey,
  radius,
  category
}) => {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/mcp/search-water`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      facilityName,
      facilityKey,
      radius,
      category
    })
  });
  
  if (!response.ok) {
    throw new Error(`Water search failed (${response.status})`);
  }
  
  return response.json();
};
```

---

### Step 7: Update Frontend Components

**Files**:
- `src/components/Map/components/MCPChatPanel.jsx` - Add water-specific quick actions
- `src/components/Map/components/MCPSearchResults.jsx` - Handle new water feature types
- `src/components/Map/components/Cards/AIResponseDisplayRefactored.jsx` - Display water allocation data

**New Quick Actions**:
```javascript
const WATER_QUICK_ACTIONS = [
  { label: 'Water Allocations near TSMC', query: 'water allocations near TSMC' },
  { label: 'Agricultural Water Rights', query: 'agricultural water rights within 10km of TSMC' },
  { label: 'CAP Water Transfers', query: 'CAP water transfers near TSMC' },
  { label: 'State Trust Land', query: 'state trust land near TSMC' }
];
```

---

## Data File Structure

### New Data Files

```
public/
  water/
    phoenix_water_allocations.json          # Municipal water allocations
    phoenix_agricultural_water_rights.json  # Ag land & water rights
    cap_water_transfers.json                # CAP transfer records
    tsmc_state_trust_land.json              # TSMC's 902-acre filing
    phoenix_thermal_irrigation_analysis.json # Thermal imagery analysis
```

### Data Schema

All water data files follow GeoJSON FeatureCollection format:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point" | "Polygon" | "LineString",
        "coordinates": [...]
      },
      "properties": {
        "category": "water_allocation" | "agricultural_water" | "cap_water" | "state_trust_land" | "thermal_analysis",
        "subcategory": "...",
        "name": "...",
        "allocation_gpd": 4700000,
        "source": "...",
        "status": "active" | "pending" | "transferred",
        "metadata": {...}
      }
    }
  ],
  "metadata": {
    "source": "...",
    "last_updated": "2025-01-XX",
    "total_features": 1234
  }
}
```

---

## Implementation Timeline

### Phase 1: OSM Expansion (Week 1)
- [ ] Update OSM query script
- [ ] Regenerate cache files
- [ ] Test new water infrastructure data

### Phase 2: Municipal Water Data (Week 2-3)
- [ ] Request Phoenix Water Services data
- [ ] Parse and structure data
- [ ] Create `phoenixWaterService.js`
- [ ] Integrate with MCP system

### Phase 3: Agricultural & Water Rights (Week 4-5)
- [ ] Collect State Trust land data
- [ ] Collect agricultural parcel data
- [ ] Create `agriculturalWaterService.js`
- [ ] Create `stateTrustLandService.js`

### Phase 4: CAP Water Data (Week 6)
- [ ] Request CAP transfer records
- [ ] Parse CAP allocation data
- [ ] Create `capWaterService.js`

### Phase 5: Thermal Analysis (Week 7-8)
- [ ] Set up Google Earth Engine or USGS API
- [ ] Develop thermal analysis pipeline
- [ ] Generate irrigation reduction predictions
- [ ] Create `thermalAnalysisService.js`

### Phase 6: Integration & Testing (Week 9-10)
- [ ] Integrate all services
- [ ] Update MCP backend API
- [ ] Update frontend components
- [ ] Add layer toggles
- [ ] Test end-to-end queries
- [ ] Documentation

---

## Answering the Core Question

### "TSMC Is Building Three Fabs in Phoenix. Where Does the Water Come From?"

**With this expanded dataset, we can answer**:

1. **Current Allocation**
   - ✅ "Show me TSMC's current water allocation"
   - Returns: 4.7M gallons/day for Fab 1, source: Phoenix Water Services

2. **Projected Need**
   - ✅ "What's TSMC's total water need for 3 fabs?"
   - Calculates: 12-18M gallons/day based on fab specifications

3. **The Gap**
   - ✅ "What's the water shortfall for TSMC?"
   - Calculates: 7-13M gallons/day gap

4. **Agricultural Retirement**
   - ✅ "Show me agricultural land converted to industrial near TSMC"
   - Shows: State Trust land parcels, ag → industrial conversions

5. **CAP Water Cuts**
   - ✅ "Show me CAP water transfers from agriculture"
   - Shows: 512,000 AF/year cuts, transfer records

6. **State Trust Land**
   - ✅ "Show me TSMC's State Trust land filing"
   - Shows: 902-acre parcel, auction date, water rights

7. **Water Rights Arbitrage**
   - ✅ "Show me land with transferable water rights near TSMC"
   - Shows: Parcels with $900K-$1.5M/acre premium

8. **Predictive Analysis**
   - ✅ "Show me farms reducing irrigation"
   - Shows: Thermal imagery analysis, 6-12 months before filings

9. **Water Supply Route**
   - ✅ "How does water get to TSMC?"
   - Shows: Municipal distribution network, canals, treatment facilities

10. **Future Water Sources**
    - ✅ "Where will Fabs 2 and 3 get water?"
    - Predicts: Based on agricultural retirement patterns, State Trust land, CAP transfers

---

## Success Metrics

- **Data Coverage**: 10,000+ water-related features (vs. current 414)
- **Query Accuracy**: Can answer 10/10 core questions about TSMC water supply
- **Predictive Power**: Identify water rights transfers 6-12 months before public filings
- **User Queries**: Support natural language queries like "Where will TSMC get water for Fabs 2 and 3?"

---

## Next Steps

1. **Immediate**: Start Phase 1 (OSM expansion) - can be done today
2. **This Week**: File public records requests for Phoenix Water Services, CAP, State Land Department
3. **This Month**: Set up thermal imagery analysis pipeline
4. **Ongoing**: Monitor State Trust land auctions, water transfer records

---

## Resources

- **Phoenix Water Services**: https://www.phoenix.gov/waterservices
- **Central Arizona Project**: https://www.cap-az.com
- **Arizona State Land Department**: https://land.az.gov
- **ADWR**: https://www.azwater.gov
- **Google Earth Engine**: https://earthengine.google.com
- **USGS EarthExplorer**: https://earthexplorer.usgs.gov

---

## Notes

- All data collection should prioritize **public records** and **open data**
- Respect data licensing and usage terms
- Consider data refresh cadence (monthly/quarterly)
- Maintain data provenance and source attribution
- Ensure compliance with FOIA/public records request requirements

