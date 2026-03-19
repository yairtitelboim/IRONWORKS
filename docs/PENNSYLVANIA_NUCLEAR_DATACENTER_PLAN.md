# Pennsylvania Nuclear & Data Center Power Analysis Plan

## Executive Summary

This document outlines a plan to repurpose the existing OSM/MCP/Map infrastructure system to analyze **data center power procurement strategies in Pennsylvania**, specifically comparing two distinct models:

> **"Grid vs Behind-the-Meter: How Microsoft and Amazon Approach Nuclear Power in Pennsylvania"**

### The Two Models

**1. Three Mile Island (TMI) - Microsoft/Constellation Model:**
- **Location**: Middletown, PA (near Harrisburg)
- **Strategy**: Grid-connected PPA (Power Purchase Agreement)
- **Mechanism**: Plant sells power TO the grid. Microsoft buys FROM the grid.
- **Transmission**: Shared transmission costs across all grid users
- **Connection Type**: Virtual PPA (no direct physical connection)
- **Deal**: 20-year agreement with Constellation Energy

**2. Susquehanna - Amazon/Talen Model:**
- **Location**: Berwick, PA (50 miles from TMI)
- **Strategy**: Behind-the-meter direct connection
- **Mechanism**: Direct physical connection—power never hits the grid
- **Transmission**: Dedicated transmission line (no grid sharing)
- **Connection Type**: Physical direct connection
- **Deal**: $650M data center campus purchase adjacent to nuclear plant

### MVP Scope (What We Implement Next)

**Goal for MVP (Phase 1–2):**  
Stand up a **Pennsylvania nuclear + data center view** inside the existing MCP + `AITransmissionNav` stack, without adding new backend services or external data pipelines.

**MVP Features (code we actually build next):**
1. **New facilities in config**: Add Three Mile Island, Susquehanna, and 1–2 representative data centers to the facility list (similar to `tsmc_phoenix`), with coordinates and simple metadata.
2. **OSM cache generation for PA**: Create `public/osm` JSONs around those facilities (power plants, transmission lines, substations, major water features) using a new `pa_nuclear_datacenter_osm` script, reusing the existing OSM tooling pattern.
3. **MCP search integration**: Wire these PA facilities into `/api/mcp/search` (facility → dataPath + coordinates) so MCP queries like “substations near Three Mile Island” or “water infrastructure near Susquehanna” return map markers.
4. **Map & AI UI wiring**:
   - Add PA-focused quick actions in `MCPChatPanel` (e.g., “Substations near TMI”, “Transmission near Susquehanna”).
   - Add one or two PA workflows/cards in `AITransmissionNav` that play scenes centered on these sites and call the MCP infrastructure search.
5. **Basic water visibility**: Include **only** coarse OSM water features for MVP (river segments, major intake/water-works tags) so water-related queries render, without yet modeling rights, volumes, or permits.

**Non-goals for MVP (explicitly deferred):**
- No new `/api/mcp/search-water` endpoint or water aggregation service.
- No automated integration with SRBC/DEP/EPA/USGS APIs (these stay as manual/CSV inputs later).
- No full cost model (power or water) beyond simple, static metadata on cards.
- No complex time-series or rights/permit analytics.

The rest of this document describes **the full multi-phase vision** (including water rights, permits, and cost modeling). The MVP should only implement the steps that reuse today’s OSM caches + `/api/mcp/search` + `MCPChatPanel` + `MCPSearchResults` + `AITransmissionNav`.

### Long-Term Goal (Beyond MVP)

Over later phases, evolve this into a comprehensive **power AND water infrastructure** analysis system that can:

**Power Infrastructure (future-complete vision):**
1. Map nuclear power plants and their capacities
2. Visualize transmission infrastructure (grid vs dedicated lines)
3. Identify data center locations and power procurement strategies
4. Compare grid-connected vs behind-the-meter models
5. Analyze transmission costs and routing
6. Track power purchase agreements (PPAs)
7. Calculate cost differences between models
8. Visualize power flow paths (grid vs direct)

**Water Infrastructure (future-complete vision):**
9. Map cooling water sources (Susquehanna River, intake facilities)
10. Track water rights and allocations for nuclear plants
11. Analyze data center water needs (cooling systems)
12. Compare water consumption between models
13. Map water infrastructure (intake pipes, cooling towers, discharge)
14. Track environmental permits and water usage rights
15. Visualize water flow paths (intake → cooling → discharge)

---

## Current State Analysis

### What We Have (Existing Infrastructure)

**OSM/MCP System:**
- ✅ OSM data collection scripts (`scripts/osm-tools/`)
- ✅ MCP infrastructure search API (`server.js` - `/api/mcp/search`)
- ✅ Query parser for natural language queries (`src/mcp/queryParser.js`)
- ✅ Map visualization components (`MCPSearchResults.jsx`)
- ✅ Facility configuration system (`src/config/ncPowerSites.js`)

**Current Data Coverage:**
- ✅ Texas facilities (TSMC Phoenix, Intel, Amkor, etc.)
- ✅ North Carolina facilities (Toyota, Vinfast, Wolfspeed)
- ✅ Arizona power infrastructure
- ❌ **No Pennsylvania data currently**

**Limitations:**
- ❌ No Pennsylvania facility configurations
- ❌ No nuclear power plant data
- ❌ No data center power procurement data
- ❌ No PPA (Power Purchase Agreement) tracking
- ❌ No behind-the-meter connection mapping
- ❌ No transmission cost analysis
- ❌ No grid vs direct connection comparison tools
- ❌ No water infrastructure data (cooling water, intake facilities)
- ❌ No water rights and allocation tracking
- ❌ No water consumption analysis for nuclear/data centers

---

## Data Sources & Collection Strategy

### Phase 1: Pennsylvania Facility Configuration & OSM Data Collection

**Goal**: Establish baseline infrastructure data for Pennsylvania nuclear/data center analysis

**New Facilities to Add:**

1. **Three Mile Island Nuclear Plant**
   - **Location**: Middletown, PA (40.1500°N, 76.7300°W)
   - **Operator**: Constellation Energy
   - **Capacity**: 819 MW (Unit 1, Unit 2 decommissioned)
   - **Status**: Operational (Unit 1)
   - **Key**: `three_mile_island_pa`
   - **Data Center Customer**: Microsoft (PPA)

2. **Susquehanna Nuclear Plant**
   - **Location**: Berwick, PA (41.1000°N, 76.1500°W)
   - **Operator**: Talen Energy
   - **Capacity**: 2,494 MW (Units 1 & 2)
   - **Status**: Operational
   - **Key**: `susquehanna_nuclear_pa`
   - **Data Center Customer**: Amazon (behind-the-meter)

3. **Microsoft Data Center (TMI Region)**
   - **Location**: Near Three Mile Island (exact location TBD)
   - **Power Source**: Grid-connected PPA with Constellation
   - **Key**: `microsoft_tmi_pa`
   - **Connection Type**: Virtual PPA (grid-connected)

4. **Amazon Data Center (Susquehanna)**
   - **Location**: Adjacent to Susquehanna plant
   - **Power Source**: Direct behind-the-meter connection
   - **Key**: `amazon_susquehanna_pa`
   - **Connection Type**: Physical direct connection

**OSM Data Collection:**

**File**: `scripts/osm-tools/pa_nuclear_datacenter_osm.py` (new)

**Queries to Execute:**

```python
# POWER INFRASTRUCTURE
# Nuclear power plants
node["power"="plant"]["nuclear"="yes"](around:50000, 40.1500, -76.7300);  # TMI area
node["power"="plant"]["nuclear"="yes"](around:50000, 41.1000, -76.1500);  # Susquehanna area

# Transmission infrastructure
way["power"="line"](around:50000, 40.1500, -76.7300);
way["power"="line"](around:50000, 41.1000, -76.1500);
node["power"="substation"](around:50000, 40.1500, -76.7300);
node["power"="substation"](around:50000, 41.1000, -76.1500);

# Power lines (all voltage levels)
way["power"="line"]["voltage"](around:50000, 40.1500, -76.7300);
way["power"="line"]["voltage"](around:50000, 41.1000, -76.1500);

# Substations
node["power"="substation"]["voltage"](around:50000, 40.1500, -76.7300);
node["power"="substation"]["voltage"](around:50000, 41.1000, -76.1500);

# Data centers (if tagged in OSM)
node["office"="data_center"](around:50000, 40.1500, -76.7300);
node["office"="data_center"](around:50000, 41.1000, -76.1500);
way["building"="data_center"](around:50000, 40.1500, -76.7300);
way["building"="data_center"](around:50000, 41.1000, -76.1500);

# WATER INFRASTRUCTURE
# Water intake facilities (for nuclear plant cooling)
node["man_made"="water_works"](around:50000, 40.1500, -76.7300);
node["man_made"="water_works"](around:50000, 41.1000, -76.1500);
way["man_made"="pipeline"]["substance"="water"](around:50000, 40.1500, -76.7300);
way["man_made"="pipeline"]["substance"="water"](around:50000, 41.1000, -76.1500);

# Cooling towers
node["man_made"="cooling_tower"](around:50000, 40.1500, -76.7300);
node["man_made"="cooling_tower"](around:50000, 41.1000, -76.1500);
way["man_made"="cooling_tower"](around:50000, 40.1500, -76.7300);
way["man_made"="cooling_tower"](around:50000, 41.1000, -76.1500);

# Water bodies (Susquehanna River, intake sources)
way["waterway"="river"](around:50000, 40.1500, -76.7300);
way["waterway"="river"](around:50000, 41.1000, -76.1500);
way["natural"="water"](around:50000, 40.1500, -76.7300);
way["natural"="water"](around:50000, 41.1000, -76.1500);

# Water treatment facilities
node["amenity"="water_treatment"](around:50000, 40.1500, -76.7300);
node["amenity"="water_treatment"](around:50000, 41.1000, -76.1500);

# Water discharge points
node["man_made"="outfall"](around:50000, 40.1500, -76.7300);
node["man_made"="outfall"](around:50000, 41.1000, -76.1500);
```

**Implementation Steps:**

1. **Create new OSM collection script**:
   ```bash
   # New file: scripts/osm-tools/pa_nuclear_datacenter_osm.py
   # Based on: scripts/osm-tools/nc_power_utility_osm.py
   ```

2. **Add Pennsylvania facilities to config**:
   ```javascript
   // src/config/ncPowerSites.js (or create paPowerSites.js)
   {
     name: 'Three Mile Island Nuclear Plant',
     shortName: 'TMI',
     key: 'three_mile_island_pa',
     coordinates: { lat: 40.1500, lng: -76.7300 },
     dataPath: '/osm/pa_nuclear_tmi.json',
     description: 'Nuclear power plant - Microsoft PPA (grid-connected)'
   },
   {
     name: 'Susquehanna Nuclear Plant',
     shortName: 'Susquehanna',
     key: 'susquehanna_nuclear_pa',
     coordinates: { lat: 41.1000, lng: -76.1500 },
     dataPath: '/osm/pa_nuclear_susquehanna.json',
     description: 'Nuclear power plant - Amazon behind-the-meter'
   }
   ```

3. **Generate OSM cache files**:
   ```bash
   python scripts/osm-tools/pa_nuclear_datacenter_osm.py
   # Output: public/osm/pa_nuclear_tmi.json
   # Output: public/osm/pa_nuclear_susquehanna.json
   ```

**Expected Output**: 
- 500-1,000 transmission line features per site
- 50-100 substation features per site
- Nuclear plant facilities
- Regional transmission infrastructure

---

### Phase 2: Nuclear Plant & Data Center Data Collection (Power + Water)

**Goal**: Collect detailed nuclear plant and data center information for both power AND water infrastructure

**Data Sources:**

1. **EIA (Energy Information Administration)**
   - Nuclear plant capacity and generation data
   - Plant operator information
   - Historical generation data
   - API: `https://www.eia.gov/api/`

2. **NRC (Nuclear Regulatory Commission)**
   - Plant licensing information
   - Safety and operational data
   - Public records: `https://www.nrc.gov/reading-rm/doc-collections/`

3. **PJM Interconnection**
   - Grid operator for Pennsylvania
   - Transmission infrastructure data
   - Power flow and capacity data
   - API: `https://www.pjm.com/api/`

4. **FERC (Federal Energy Regulatory Commission)**
   - Transmission line filings
   - Power purchase agreement records
   - Grid infrastructure data
   - Database: `https://www.ferc.gov/`

5. **Public Records & News**
   - Microsoft/Constellation PPA announcements
   - Amazon/Talen deal documentation
   - Local zoning and permit filings
   - State PUC (Public Utility Commission) records

6. **Water Infrastructure Data Sources**
   - **Susquehanna River Basin Commission (SRBC)**
     - Water withdrawal permits
     - Intake facility locations
     - Water allocation records
     - API: `https://www.srbc.net/`
   
   - **Pennsylvania DEP (Department of Environmental Protection)**
     - Water quality permits
     - Discharge permits (NPDES)
     - Cooling water intake permits
     - Database: `https://www.dep.pa.gov/`
   
   - **USGS (United States Geological Survey)**
     - Water withdrawal data
     - River flow data
     - Water quality monitoring
     - API: `https://waterdata.usgs.gov/nwis`
   
   - **EPA (Environmental Protection Agency)**
     - NPDES permit database
     - Water discharge monitoring
     - Cooling water intake regulations
     - Database: `https://www.epa.gov/`

**Data Collection Scripts:**

**File**: `scripts/pa/collect_nuclear_datacenter_data.js` (new)

**Data to Collect:**

```javascript
// Nuclear Plant Data
{
  plant_id: "TMI-1",
  name: "Three Mile Island Unit 1",
  operator: "Constellation Energy",
  capacity_mw: 819,
  status: "operational",
  coordinates: { lat: 40.1500, lng: -76.7300 },
  grid_operator: "PJM",
  connection_type: "grid_connected",
  ppa_customers: ["Microsoft"],
  transmission_lines: [...],
  substations: [...],
  // WATER INFRASTRUCTURE
  cooling_water_source: "Susquehanna River",
  water_intake_facilities: [...],
  cooling_towers: [...],
  water_withdrawal_mgd: 150, // Million gallons per day (estimated)
  water_discharge_facilities: [...],
  water_permits: [...],
  npdes_permit_number: "PA-XXXXX"
}

// Data Center Data
{
  datacenter_id: "microsoft-tmi",
  name: "Microsoft Data Center (TMI Region)",
  operator: "Microsoft",
  power_source: "grid_ppa",
  ppa_provider: "Constellation Energy",
  ppa_duration_years: 20,
  connection_type: "virtual_ppa",
  coordinates: { lat: 40.XXXX, lng: -76.XXXX },
  estimated_load_mw: 100, // TBD from public records
  transmission_costs: "shared_grid",
  // WATER INFRASTRUCTURE
  cooling_water_needs_mgd: 2, // Million gallons per day (estimated)
  water_source: "municipal" | "river" | "reclaimed",
  cooling_system_type: "air_cooled" | "water_cooled" | "hybrid"
}

{
  datacenter_id: "amazon-susquehanna",
  name: "Amazon Data Center (Susquehanna)",
  operator: "Amazon",
  power_source: "behind_the_meter",
  direct_connection: true,
  connection_provider: "Talen Energy",
  campus_value_usd: 650000000,
  connection_type: "physical_direct",
  coordinates: { lat: 41.XXXX, lng: -76.XXXX },
  estimated_load_mw: 500, // Estimated from $650M investment
  transmission_costs: "dedicated_line",
  // WATER INFRASTRUCTURE
  cooling_water_needs_mgd: 10, // Million gallons per day (estimated)
  water_source: "municipal" | "river" | "reclaimed",
  cooling_system_type: "air_cooled" | "water_cooled" | "hybrid",
  water_infrastructure_investment: "included_in_campus" // Part of $650M
}
```

**Implementation:**

1. **Create data collection script**:
   ```bash
   # scripts/pa/collect_nuclear_datacenter_data.js
   # Collects EIA, NRC, PJM, FERC data
   ```

2. **Create data files**:
   ```bash
   # public/pa/nuclear_plants.json
   # public/pa/datacenters.json
   # public/pa/transmission_infrastructure.json
   # public/pa/ppa_agreements.json
   ```

3. **Data validation and enrichment**:
   - Cross-reference multiple sources
   - Validate coordinates
   - Enrich with OSM data
   - Add metadata (last_updated, source, confidence)

---

### Phase 3: Transmission Infrastructure Analysis (Power) + Water Infrastructure Analysis

**Goal**: Map and analyze transmission infrastructure (power) AND water infrastructure differences between models

**Key Analysis Points:**

1. **Grid-Connected Model (TMI/Microsoft)**:
   - Power flows: Plant → Grid → Data Center
   - Transmission: Shared grid infrastructure
   - Costs: Shared across all grid users
   - Routing: Multiple possible paths through PJM grid

2. **Behind-the-Meter Model (Susquehanna/Amazon)**:
   - Power flows: Plant → Dedicated Line → Data Center
   - Transmission: Private dedicated line
   - Costs: Amazon pays for dedicated infrastructure
   - Routing: Single direct path

**Data to Collect:**

1. **PJM Transmission Data**:
   - Grid topology and routing
   - Transmission line capacities
   - Substation locations
   - Power flow paths

2. **FERC Transmission Filings**:
   - New transmission line applications
   - Behind-the-meter connection filings
   - Cost allocation records

3. **Satellite Imagery Analysis**:
   - Identify dedicated transmission lines
   - Map physical infrastructure
   - Compare grid vs direct connections

**Water Infrastructure Analysis:**

**Key Analysis Points:**

1. **Cooling Water Requirements**:
   - Nuclear plants: ~150 MGD (million gallons per day) per unit
   - Data centers: 2-10 MGD depending on size and cooling type
   - Total water footprint comparison

2. **Water Source Comparison**:
   - TMI: Susquehanna River intake
   - Susquehanna: Susquehanna River intake
   - Data centers: Municipal vs river vs reclaimed water

3. **Water Infrastructure**:
   - Intake facilities and pipelines
   - Cooling towers and systems
   - Discharge facilities and permits
   - Water treatment requirements

**Implementation:**

**File**: `scripts/pa/analyze_transmission_routes.js` (new) - Power analysis
**File**: `scripts/pa/analyze_water_infrastructure.js` (new) - Water analysis

**Output Format**:

```json
{
  "tmi_microsoft": {
    "connection_type": "grid_connected",
    "power_flow": {
      "source": "three_mile_island",
      "intermediate": ["pjm_grid", "substation_1", "substation_2"],
      "destination": "microsoft_datacenter",
      "estimated_distance_km": 25,
      "transmission_costs": "shared",
      "routing_paths": [
        {
          "path_id": "path_1",
          "substations": ["sub_1", "sub_2", "sub_3"],
          "transmission_lines": ["line_1", "line_2"],
          "voltage_kv": [345, 138],
          "estimated_losses_percent": 2.5
        }
      ]
    }
  },
  "susquehanna_amazon": {
    "connection_type": "behind_the_meter",
    "power_flow": {
      "source": "susquehanna_nuclear",
      "intermediate": [],
      "destination": "amazon_datacenter",
      "estimated_distance_km": 2,
      "transmission_costs": "dedicated",
      "routing_paths": [
        {
          "path_id": "direct_path",
          "substations": [],
          "transmission_lines": ["dedicated_line_1"],
          "voltage_kv": [500],
          "estimated_losses_percent": 0.5
        }
      ]
    }
  }
}
```

---

### Phase 4: Power Purchase Agreement (PPA) Data

**Goal**: Track and analyze PPA agreements (power) AND water rights/allocation agreements

**Data Sources:**

1. **Public PPA Announcements**:
   - Microsoft/Constellation press releases
   - SEC filings (if public companies)
   - State PUC filings

2. **Energy Market Data**:
   - PJM market prices
   - Nuclear power pricing
   - Long-term contract pricing

3. **Regulatory Filings**:
   - FERC filings (power)
   - State PUC records (power)
   - Environmental impact statements
   - **Water-specific**:
     - SRBC water withdrawal permits
     - PA DEP NPDES permits
     - EPA cooling water intake permits
     - Water rights allocations

**Data to Collect:**

```json
{
  "ppa_id": "microsoft_constellation_tmi",
  "buyer": "Microsoft",
  "seller": "Constellation Energy",
  "power_source": "Three Mile Island Nuclear",
  "agreement_type": "virtual_ppa",
  "duration_years": 20,
  "start_date": "2024-XX-XX",
  "capacity_mw": 100,
  "pricing_structure": "fixed_price", // or "indexed"
  "estimated_price_per_mwh": 50, // TBD from public records
  "grid_connection": true,
  "transmission_costs": "shared"
},
{
  "water_agreement_id": "tmi_water_withdrawal",
  "facility": "Three Mile Island",
  "water_source": "Susquehanna River",
  "withdrawal_mgd": 150,
  "permit_authority": "SRBC",
  "permit_number": "SRBC-XXXXX",
  "permit_status": "active",
  "cooling_system": "once_through",
  "discharge_permit": "NPDES-PA-XXXXX"
}
```

**Implementation:**

**File**: `scripts/pa/collect_ppa_data.js` (new)

**Output**: `public/pa/ppa_agreements.json`

---

### Phase 5: Cost Analysis & Comparison (Power + Water)

**Goal**: Calculate and compare costs between grid-connected and behind-the-meter models for BOTH power AND water

**Cost Components:**

1. **Grid-Connected Model (TMI/Microsoft)**:
   - Power purchase price (PPA rate)
   - Transmission costs (shared grid)
   - Distribution costs
   - Grid service charges
   - Losses (transmission losses ~2-3%)

2. **Behind-the-Meter Model (Susquehanna/Amazon)**:
   - Power purchase price (direct contract)
   - Dedicated transmission line costs
   - Infrastructure investment ($650M campus)
   - Maintenance costs
   - Losses (direct line losses ~0.5-1%)

**Water Cost Components:**

1. **Grid-Connected Model (TMI/Microsoft)**:
   - Water withdrawal costs (if applicable)
   - Municipal water costs (for data center)
   - Water treatment costs
   - Discharge permit fees
   - Water infrastructure maintenance

2. **Behind-the-Meter Model (Susquehanna/Amazon)**:
   - Shared water infrastructure with plant (potential savings)
   - Dedicated water line costs (if separate)
   - Water treatment costs
   - Discharge permit fees
   - Water infrastructure maintenance (shared vs dedicated)

**Analysis Script:**

**File**: `scripts/pa/analyze_power_costs.js` (new)

**Output Format**:

```json
{
  "comparison": {
    "grid_connected": {
      "model": "TMI/Microsoft",
      "total_cost_per_mwh": 55,
      "breakdown": {
        "power_price": 50,
        "transmission_shared": 3,
        "distribution": 1,
        "grid_services": 1,
        "losses_cost": 0.5
      },
      "transmission_distance_km": 25,
      "losses_percent": 2.5
    },
    "behind_the_meter": {
      "model": "Susquehanna/Amazon",
      "total_cost_per_mwh": 45,
      "breakdown": {
        "power_price": 42,
        "dedicated_line_amortized": 2,
        "maintenance": 0.5,
        "losses_cost": 0.5
      },
      "transmission_distance_km": 2,
      "losses_percent": 0.5,
      "infrastructure_investment_usd": 650000000
    },
    "water_costs": {
      "tmi_microsoft": {
        "total_cost_per_mgd": 50000, // Annual cost per MGD
        "breakdown": {
          "withdrawal_fees": 10000,
          "municipal_water": 30000,
          "treatment": 5000,
          "permit_fees": 3000,
          "maintenance": 2000
        },
        "total_annual_cost": 100000 // For 2 MGD data center
      },
      "susquehanna_amazon": {
        "total_cost_per_mgd": 30000, // Lower due to shared infrastructure
        "breakdown": {
          "shared_infrastructure": 15000,
          "treatment": 8000,
          "permit_fees": 4000,
          "maintenance": 3000
        },
        "total_annual_cost": 300000 // For 10 MGD data center
      }
    },
    "cost_difference": {
      "power": {
        "per_mwh": 10,
        "annual_savings_estimate": 8760000, // For 100 MW load
        "payback_period_years": 7.4
      },
      "water": {
        "per_mgd_savings": 20000,
        "annual_savings_estimate": 200000, // For 10 MGD
        "note": "Amazon benefits from shared water infrastructure"
      },
      "total_annual_savings": 8960000
    }
  }
}
```

---

## System Integration Plan

### Step 1: Extend Facility Configuration

**File**: `src/config/ncPowerSites.js` (or create `paPowerSites.js`)

**Add Pennsylvania Sites**:

```javascript
export const PA_POWER_SITES = [
  {
    name: 'Three Mile Island Nuclear Plant',
    shortName: 'TMI',
    key: 'three_mile_island_pa',
    coordinates: { lat: 40.1500, lng: -76.7300 },
    dataPath: '/osm/pa_nuclear_tmi.json',
    description: 'Nuclear power plant - Microsoft PPA (grid-connected)',
    type: 'nuclear_plant',
    operator: 'Constellation Energy',
    capacity_mw: 819,
    datacenter_customer: 'Microsoft',
    connection_type: 'grid_connected'
  },
  {
    name: 'Susquehanna Nuclear Plant',
    shortName: 'Susquehanna',
    key: 'susquehanna_nuclear_pa',
    coordinates: { lat: 41.1000, lng: -76.1500 },
    dataPath: '/osm/pa_nuclear_susquehanna.json',
    description: 'Nuclear power plant - Amazon behind-the-meter',
    type: 'nuclear_plant',
    operator: 'Talen Energy',
    capacity_mw: 2494,
    datacenter_customer: 'Amazon',
    connection_type: 'behind_the_meter'
  },
  {
    name: 'Microsoft Data Center (TMI Region)',
    shortName: 'Microsoft TMI',
    key: 'microsoft_tmi_pa',
    coordinates: { lat: 40.XXXX, lng: -76.XXXX }, // TBD
    dataPath: '/osm/pa_datacenter_microsoft.json',
    description: 'Microsoft data center - Grid-connected PPA',
    type: 'datacenter',
    operator: 'Microsoft',
    power_source: 'grid_ppa',
    connection_type: 'virtual_ppa'
  },
  {
    name: 'Amazon Data Center (Susquehanna)',
    shortName: 'Amazon Susquehanna',
    key: 'amazon_susquehanna_pa',
    coordinates: { lat: 41.XXXX, lng: -76.XXXX }, // TBD
    dataPath: '/osm/pa_datacenter_amazon.json',
    description: 'Amazon data center - Behind-the-meter direct connection',
    type: 'datacenter',
    operator: 'Amazon',
    power_source: 'behind_the_meter',
    connection_type: 'physical_direct',
    campus_value_usd: 650000000
  }
];
```

---

### Step 2: Extend OSM Query Script

**File**: `scripts/osm-tools/pa_nuclear_datacenter_osm.py` (new)

**Based on**: `scripts/osm-tools/nc_power_utility_osm.py`

**Key Modifications**:
- Update coordinates for Pennsylvania locations
- Add nuclear plant-specific queries
- Add data center location queries
- Expand transmission line queries
- Add PJM grid infrastructure queries

---

### Step 3: Extend MCP Query Parser

**File**: `src/mcp/queryParser.js`

**New Keywords**:

```javascript
const categoryKeywords = {
  // ... existing ...
  nuclear: ['nuclear', 'nuclear plant', 'nuclear power'],
  datacenter: ['data center', 'datacenter', 'data centre'],
  ppa: ['ppa', 'power purchase agreement', 'power contract'],
  behind_the_meter: ['behind the meter', 'direct connection', 'dedicated line'],
  transmission: ['transmission', 'transmission line', 'power line'],
  grid: ['grid', 'grid connected', 'grid connection']
};
```

**New Facility Recognition**:

```javascript
// Add Pennsylvania facility names
const facilityNames = {
  'three mile island': 'three_mile_island_pa',
  'tmi': 'three_mile_island_pa',
  'susquehanna': 'susquehanna_nuclear_pa',
  'microsoft': 'microsoft_tmi_pa',
  'amazon': 'amazon_susquehanna_pa'
};
```

---

### Step 4: Extend Backend API

**File**: `server.js`

**New Endpoint**: `POST /api/mcp/search-pa-nuclear`

**Implementation**:

```javascript
app.post('/api/mcp/search-pa-nuclear', async (req, res) => {
  const { facilityName, facilityKey, radius, category, analysisType } = req.body;
  
  // Load Pennsylvania-specific data
  const nuclearData = await loadNuclearPlantData(facilityKey);
  const datacenterData = await loadDatacenterData(facilityKey);
  const transmissionData = await loadTransmissionData(facilityKey, radius);
  const ppaData = await loadPPAData(facilityKey);
  
  // Combine data sources
  const allFeatures = [
    ...nuclearData.features,
    ...datacenterData.features,
    ...transmissionData.features
  ];
  
  // Add analysis metadata
  if (analysisType === 'cost_comparison') {
    const costAnalysis = await analyzePowerCosts(facilityKey);
    return res.json({
      type: 'FeatureCollection',
      features: allFeatures,
      analysis: {
        cost_comparison: costAnalysis
      },
      summary: {
        nuclear_plants: nuclearData.features.length,
        datacenters: datacenterData.features.length,
        transmission_lines: transmissionData.features.length,
        ppa_agreements: ppaData.length
      }
    });
  }
  
  return res.json({
    type: 'FeatureCollection',
    features: allFeatures,
    summary: {
      total: allFeatures.length
    }
  });
});
```

---

### Step 5: Create Pennsylvania-Specific Services

**New Files**:

1. **`src/services/pa/nuclearPlantService.js`**
   - Load nuclear plant data
   - Get plant capacity and status
   - Get operator information

2. **`src/services/pa/datacenterService.js`**
   - Load data center data
   - Get power procurement strategy
   - Get connection type

3. **`src/services/pa/transmissionService.js`**
   - Load transmission infrastructure
   - Calculate routing paths
   - Compare grid vs direct connections

4. **`src/services/pa/ppaService.js`**
   - Load PPA agreements
   - Get pricing information
   - Track agreement terms

5. **`src/services/pa/costAnalysisService.js`**
   - Calculate power costs
   - Calculate water costs
   - Compare models (power + water)
   - Generate cost breakdowns

6. **`src/services/pa/waterInfrastructureService.js`**
   - Load water infrastructure data
   - Get water withdrawal permits
   - Get cooling water systems
   - Track water rights and allocations

---

### Step 6: Update Frontend Components

**Files to Update**:

1. **`src/components/Map/components/MCPChatPanel.jsx`**
   - Add Pennsylvania-specific quick actions:
     ```javascript
     const PA_QUICK_ACTIONS = [
       { 
         label: 'Compare TMI vs Susquehanna power models', 
         query: 'compare grid connected vs behind the meter near Three Mile Island' 
       },
       { 
         label: 'Show transmission infrastructure near TMI', 
         query: 'transmission lines near Three Mile Island' 
       },
       { 
         label: 'Show Amazon direct connection', 
         query: 'behind the meter connection near Susquehanna' 
       },
       { 
         label: 'Cost comparison analysis', 
         query: 'power cost comparison Microsoft vs Amazon Pennsylvania' 
       }
     ];
     ```

2. **`src/components/Map/components/MCPSearchResults.jsx`**
   - Add support for nuclear plant markers
   - Add support for data center markers
   - Visualize power flow paths
   - Show connection types (grid vs direct)

3. **`src/components/Map/components/Cards/AIResponseDisplayRefactored.jsx`**
   - Display nuclear plant information
   - Display data center information
   - Show PPA details
   - Display cost comparisons

---

### Step 7: Add New Layer Toggles

**File**: `src/components/Map/components/LayerToggle.jsx`

**New Layers**:

```javascript
const PA_LAYERS = {
  'nuclear-plants': {
    name: 'Nuclear Power Plants',
    description: 'Nuclear plants in Pennsylvania',
    color: '#f59e0b'
  },
  'datacenters': {
    name: 'Data Centers',
    description: 'Data center locations and power strategies',
    color: '#3b82f6'
  },
  'transmission-grid': {
    name: 'Grid Transmission',
    description: 'PJM grid transmission infrastructure',
    color: '#8b5cf6'
  },
  'transmission-direct': {
    name: 'Direct Connections',
    description: 'Behind-the-meter direct connections',
    color: '#10b981'
  },
  'power-flow': {
    name: 'Power Flow Paths',
    description: 'Visualize power flow (grid vs direct)',
    color: '#ef4444'
  }
};
```

---

## Data File Structure

### New Data Files

```
public/
  pa/
    nuclear_plants.json              # Nuclear plant data
    datacenters.json                 # Data center locations
    transmission_infrastructure.json  # Transmission lines & substations
    ppa_agreements.json              # Power purchase agreements
    cost_analysis.json               # Cost comparisons (power + water)
    power_flow_paths.json            # Power routing analysis
    water_infrastructure.json        # Water intake, cooling, discharge
    water_rights_permits.json        # Water withdrawal permits, NPDES
    water_flow_paths.json            # Water flow analysis
  osm/
    pa_nuclear_tmi.json              # OSM data for TMI region
    pa_nuclear_susquehanna.json      # OSM data for Susquehanna region
    pa_datacenter_microsoft.json     # OSM data for Microsoft DC
    pa_datacenter_amazon.json        # OSM data for Amazon DC
```

### Data Schema

**Nuclear Plant Schema**:
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [lng, lat]
  },
  "properties": {
    "category": "nuclear_plant",
    "name": "Three Mile Island Unit 1",
    "operator": "Constellation Energy",
    "capacity_mw": 819,
    "status": "operational",
    "grid_operator": "PJM",
    "connection_type": "grid_connected",
    "datacenter_customers": ["Microsoft"],
    "eia_plant_id": "XXXX"
  }
}
```

**Data Center Schema**:
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [lng, lat]
  },
  "properties": {
    "category": "datacenter",
    "name": "Microsoft Data Center (TMI Region)",
    "operator": "Microsoft",
    "power_source": "grid_ppa",
    "connection_type": "virtual_ppa",
    "ppa_provider": "Constellation Energy",
    "ppa_duration_years": 20,
    "estimated_load_mw": 100,
    "transmission_costs": "shared"
  }
}
```

**Water Infrastructure Schema**:
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point" | "LineString" | "Polygon",
    "coordinates": [...]
  },
  "properties": {
    "category": "water_intake" | "cooling_tower" | "water_discharge" | "water_pipeline",
    "name": "TMI Cooling Water Intake",
    "facility": "three_mile_island",
    "water_source": "Susquehanna River",
    "withdrawal_mgd": 150,
    "permit_number": "SRBC-XXXXX",
    "permit_authority": "SRBC",
    "npdes_permit": "PA-XXXXX",
    "cooling_system_type": "once_through" | "cooling_tower",
    "discharge_temperature_c": 25,
    "status": "operational"
  }
}
```

**Transmission Line Schema**:
```json
{
  "type": "Feature",
  "geometry": {
    "type": "LineString",
    "coordinates": [[lng1, lat1], [lng2, lat2], ...]
  },
  "properties": {
    "category": "transmission_line",
    "voltage_kv": 345,
    "connection_type": "grid" | "dedicated",
    "source": "three_mile_island" | "susquehanna_nuclear",
    "destination": "microsoft_datacenter" | "amazon_datacenter" | "grid",
    "length_km": 25,
    "capacity_mw": 500
  }
}
```

---

## Implementation Timeline

### Phase 1: Foundation (Week 1-2)
- [ ] Create Pennsylvania facility configurations
- [ ] Create OSM data collection script
- [ ] Generate initial OSM cache files
- [ ] Test OSM data collection
- [ ] Add Pennsylvania sites to query parser

**Deliverables**:
- `src/config/paPowerSites.js`
- `scripts/osm-tools/pa_nuclear_datacenter_osm.py`
- `public/osm/pa_nuclear_tmi.json`
- `public/osm/pa_nuclear_susquehanna.json`

### Phase 2: Data Collection (Week 3-4)
- [ ] Collect EIA nuclear plant data (power)
- [ ] Collect NRC plant information (power)
- [ ] Collect PJM transmission data (power)
- [ ] Collect FERC transmission filings (power)
- [ ] **Collect SRBC water withdrawal permits (water)**
- [ ] **Collect PA DEP NPDES permits (water)**
- [ ] **Collect USGS water withdrawal data (water)**
- [ ] **Map water intake and discharge facilities (water)**
- [ ] Research Microsoft/Amazon deal details
- [ ] Create data center location data

**Deliverables**:
- `scripts/pa/collect_nuclear_datacenter_data.js`
- `public/pa/nuclear_plants.json`
- `public/pa/datacenters.json`
- `public/pa/transmission_infrastructure.json`

### Phase 3: Transmission Analysis (Power) + Water Infrastructure (Week 5-6)
- [ ] Map PJM grid infrastructure (power)
- [ ] Identify dedicated transmission lines (power)
- [ ] Calculate power flow paths (power)
- [ ] Compare grid vs direct routing (power)
- [ ] Analyze transmission costs (power)
- [ ] **Map water intake facilities (water)**
- [ ] **Map cooling water systems (water)**
- [ ] **Map water discharge facilities (water)**
- [ ] **Calculate water flow paths (water)**
- [ ] **Compare water infrastructure costs (water)**

**Deliverables**:
- `scripts/pa/analyze_transmission_routes.js`
- `public/pa/power_flow_paths.json`
- Transmission routing analysis

### Phase 4: PPA & Cost Analysis (Power + Water) (Week 7-8)
- [ ] Collect PPA agreement data (power)
- [ ] Research pricing information (power)
- [ ] **Collect water rights and permit data (water)**
- [ ] **Research water pricing and fees (water)**
- [ ] Calculate cost comparisons (power + water)
- [ ] Build cost analysis models (power + water)
- [ ] Generate cost breakdowns (power + water)

**Deliverables**:
- `scripts/pa/collect_ppa_data.js`
- `scripts/pa/analyze_power_costs.js`
- `public/pa/ppa_agreements.json`
- `public/pa/cost_analysis.json`

### Phase 5: System Integration (Week 9-10)
- [ ] Extend MCP API for Pennsylvania
- [ ] Create Pennsylvania services
- [ ] Update frontend components
- [ ] Add layer toggles
- [ ] Add visualization components

**Deliverables**:
- `src/services/pa/*.js` (all service files)
- Updated `server.js` with PA endpoints
- Updated `MCPChatPanel.jsx` with PA quick actions
- Updated `MCPSearchResults.jsx` for PA data
- New visualization components

### Phase 6: Testing & Documentation (Week 11-12)
- [ ] End-to-end testing
- [ ] Data validation
- [ ] Performance testing
- [ ] Documentation
- [ ] User guide

**Deliverables**:
- Test results
- Documentation
- User guide
- Performance metrics

---

## Answering Core Questions

### "How do Microsoft and Amazon approach nuclear power in Pennsylvania?"

**With this system, we can answer**:

1. **Power Procurement Strategy**
   - ✅ "Show me Microsoft's power procurement at TMI"
   - Returns: Grid-connected PPA, 20-year agreement, shared transmission costs

2. **Connection Type Comparison**
   - ✅ "Compare grid-connected vs behind-the-meter models"
   - Shows: TMI (grid) vs Susquehanna (direct) side-by-side

3. **Transmission Infrastructure**
   - ✅ "Show transmission infrastructure for both models"
   - Visualizes: Grid paths vs dedicated lines

4. **Cost Analysis**
   - ✅ "Compare power costs: Microsoft vs Amazon"
   - Calculates: Total cost per MWh, breakdown, savings

5. **Power Flow Visualization**
   - ✅ "Show power flow paths for both models"
   - Maps: Plant → Grid → DC vs Plant → Direct → DC

6. **Infrastructure Investment**
   - ✅ "Show infrastructure investments"
   - Displays: Amazon's $650M campus, Microsoft's grid connection

7. **Transmission Distance**
   - ✅ "Compare transmission distances"
   - Shows: ~25km grid path vs ~2km direct connection

8. **Losses Analysis**
   - ✅ "Compare transmission losses"
   - Calculates: ~2.5% grid losses vs ~0.5% direct losses

9. **Regulatory Context**
   - ✅ "Show regulatory filings"
   - Displays: FERC filings, PUC records, environmental reviews

10. **Future Expansion**
    - ✅ "Where could new data centers connect?"
    - Predicts: Optimal locations based on transmission capacity AND water availability

11. **Water Infrastructure Analysis**
    - ✅ "Show cooling water infrastructure for TMI and Susquehanna"
    - Maps: Intake facilities, cooling systems, discharge points

12. **Water Consumption Comparison**
    - ✅ "Compare water consumption: Microsoft vs Amazon data centers"
    - Calculates: Water needs, sources, costs per MGD

13. **Water Rights & Permits**
    - ✅ "Show water withdrawal permits for both plants"
    - Displays: SRBC permits, NPDES permits, allocation rights

14. **Environmental Impact**
    - ✅ "Compare water discharge impacts"
    - Analyzes: Temperature impacts, water quality, permit compliance

---

## Success Metrics

- **Data Coverage**: 
  - 2 nuclear plants mapped (power + water)
  - 2 data centers mapped (power + water)
  - 1,000+ transmission features (power)
  - 100+ water infrastructure features (water)
  - Complete PPA documentation (power)
  - Complete water permits and rights (water)

- **Query Accuracy**: 
  - Can answer 14/14 core questions about PA nuclear/data center power AND water

- **Visualization Quality**:
  - Clear comparison of grid vs direct models
  - Accurate power flow visualization
  - Cost breakdown clarity

- **User Queries**: 
  - Support natural language queries like "Compare Microsoft and Amazon power strategies"

---

## Next Steps

1. **Immediate**: Start Phase 1 (OSM data collection) - can begin today
2. **This Week**: Research exact data center locations (Microsoft TMI, Amazon Susquehanna)
3. **This Month**: File public records requests for PPA details, transmission filings
4. **Ongoing**: Monitor PJM grid data, FERC filings, news announcements

---

## Resources

- **EIA**: https://www.eia.gov/electricity/data/eia860/
- **NRC**: https://www.nrc.gov/
- **PJM Interconnection**: https://www.pjm.com/
- **FERC**: https://www.ferc.gov/
- **Pennsylvania PUC**: https://www.puc.pa.gov/
- **Constellation Energy**: https://www.constellationenergy.com/
- **Talen Energy**: https://www.talenenergy.com/
- **Susquehanna River Basin Commission**: https://www.srbc.net/
- **Pennsylvania DEP**: https://www.dep.pa.gov/
- **USGS Water Data**: https://waterdata.usgs.gov/nwis
- **EPA NPDES**: https://www.epa.gov/npdes

---

## Notes

- All data collection should prioritize **public records** and **open data**
- Respect data licensing and usage terms
- Consider data refresh cadence (monthly/quarterly)
- Maintain data provenance and source attribution
- Ensure compliance with FOIA/public records request requirements
- Coordinate with PJM for grid data access
- Consider privacy concerns for data center locations

---

## Appendix: Key Locations

### Three Mile Island
- **Coordinates**: 40.1500°N, 76.7300°W
- **Address**: Middletown, PA 17057
- **Distance to Microsoft DC**: ~25km (estimated, TBD)

### Susquehanna Nuclear Plant
- **Coordinates**: 41.1000°N, 76.1500°W
- **Address**: Berwick, PA 18603
- **Distance to Amazon DC**: ~2km (adjacent, estimated)

### Distance Between Sites
- **TMI to Susquehanna**: ~50 miles (~80km)

---

## Appendix: Power Procurement Models Comparison

| Aspect | Grid-Connected (TMI/Microsoft) | Behind-the-Meter (Susquehanna/Amazon) |
|--------|-------------------------------|--------------------------------------|
| **Connection Type** | Virtual PPA | Physical direct connection |
| **Power Flow** | Plant → Grid → Data Center | Plant → Direct Line → Data Center |
| **Transmission** | Shared grid infrastructure | Dedicated private line |
| **Transmission Costs** | Shared across all grid users | Amazon pays for dedicated line |
| **Transmission Distance** | ~25km (multiple paths) | ~2km (single direct path) |
| **Transmission Losses** | ~2.5% (grid routing) | ~0.5% (direct connection) |
| **Infrastructure Investment** | Minimal (uses existing grid) | $650M (dedicated campus) |
| **Flexibility** | Can switch providers | Locked to specific plant |
| **Regulatory Complexity** | Standard grid rules | Custom connection agreement |
| **Scalability** | Easy to scale (grid capacity) | Requires new infrastructure |
| **Water Source** | Municipal water (separate) | Shared with plant (potential savings) |
| **Water Infrastructure** | Separate data center water system | Shared cooling water infrastructure |
| **Water Costs** | Full municipal water rates | Shared infrastructure costs |
| **Water Permits** | Separate data center permits | May share plant water permits |

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-XX  
**Status**: Planning Phase

