# TSMC Phoenix Sites Analysis & Implementation Plan

## OSM Button Analysis

### How the Green OSM Button Works

#### 1. **Data Flow Architecture**
- **Data Source**: Fetches infrastructure data from OpenStreetMap via Overpass API
- **Caching Strategy**: 
  - Global in-memory cache (30 min TTL)
  - Local file cache (`/whitney-cache.json`)
  - Compressed data storage for performance
- **Processing Pipeline**:
  1. Check cache → if expired/missing, fetch from OSM
  2. Query multiple zones (data_center, downtown, regional)
  3. Process features into GeoJSON format
  4. Add to map as vector layers

#### 2. **Marker System**
- **Site Markers**: Red circular DOM markers (26px) for key sites
- **Central Marker**: Main site marker with pulsing animation
- **Zone Markers**: Secondary markers for analysis zones
- **Marker Data Structure**:
  ```javascript
  {
    id: 'site-id',
    name: 'Site Name',
    type: 'Key Site',
    category: 'Infrastructure Site',
    coordinates: [lng, lat],
    formatter: 'pinal',
    zonesAnalyzed: 3,
    provider: 'Site Provider',
    confidence: '95%',
    provenance: [urls]
  }
  ```

#### 3. **Visual Layers**
- **Infrastructure Layers**:
  - `osm-features-lines`: Line features (roads, boundaries)
  - `osm-features-fill`: Polygon fills (buildings, areas)
  - `osm-pois`: Point of interest circles
  - `osm-highway-junctions`: Major intersections
- **Color Coding**: Category-based colors (government=red, education=purple, etc.)
- **Animation**: Fade-in opacity animations for layers

#### 4. **Event System**
- Uses `window.mapEventBus` for communication
- Emits `marker:clicked` events for popup display
- Emits `osm:dataLoaded` for legend updates
- Popups handled by `MarkerPopupCard` component

#### 5. **Site Data Structure** (from `pinalSites.js`)
```javascript
{
  id: 'unique-id',
  name: 'Site Name',
  address: 'Street Address',
  city: 'City',
  state: 'State',
  lat: 33.6,
  lng: -112.2,
  queryHints: ['search terms'],
  notes: 'Description'
}
```

---

## TSMC Phoenix Sites Implementation

### Key Sites Around TSMC Phoenix

Based on the provided data, here are the critical sites to display:

#### 1. **TSMC Arizona Fab Complex** (Main Site)
- **Location**: 5088 W. Innovation Circle, Phoenix, AZ 85083
- **Investment**: $165B total (started $12B in 2020)
- **Status**: Largest foreign greenfield investment in U.S. history
- **Fabs**: 3 fabs total
- **Water Demand**: 17.2M gallons/day when complete
- **Current**: Fab 1 operational (4.75M gallons/day)
- **Coordinates**: ~33.6°N, -112.2°W

#### 2. **Phoenix Water Supply System**
- **Allocated**: 11.4M gallons/day from Phoenix
- **Current Usage**: 4.75M gallons/day (Fab 1)
- **Gap**: 5.8M gallons/day shortfall when all 3 fabs online
- **Type**: Municipal water infrastructure

#### 3. **Water Reclamation Plant** (Under Construction)
- **Investment**: $1B+
- **Size**: 15 acres
- **Operational**: 2028
- **Recycling Rate**: 90% target
- **Remaining Demand**: 1.72M gallons/day still needed from municipal supply
- **Type**: Water treatment/recycling facility

#### 4. **Power Infrastructure** (APS Grid)
- **Grid Operator**: APS (Arizona Public Service)
- **Type**: High-voltage transmission infrastructure
- **Critical**: Semiconductor fabs require massive power capacity

#### 5. **Transportation Infrastructure**
- **Highways**: I-10, Loop 303, etc.
- **Type**: Access routes for supply chain

### Implementation Plan

#### Phase 1: Create Site Data File
**File**: `src/data/tsmcPhoenixSites.js`

```javascript
const TSMC_PHOENIX_SITES = [
  {
    id: 'tsmc-arizona-fab-complex',
    name: 'TSMC Arizona Semiconductor Fab Complex',
    address: '5088 W. Innovation Circle',
    city: 'Phoenix',
    state: 'AZ',
    lat: 33.6,
    lng: -112.2,
    investment: '$165B',
    investmentStart: '$12B (2020)',
    status: 'Largest foreign greenfield investment in U.S. history',
    fabs: 3,
    waterDemandTotal: '17.2M gallons/day',
    waterDemandCurrent: '4.75M gallons/day (Fab 1)',
    waterGap: '5.8M gallons/day shortfall',
    queryHints: ['TSMC Arizona', 'Phoenix semiconductor', 'Maricopa County fab'],
    notes: 'Three-fab complex producing advanced chips. Phase 1 operational, Phases 2-3 under construction.'
  },
  {
    id: 'phoenix-water-allocation',
    name: 'Phoenix Municipal Water Allocation',
    city: 'Phoenix',
    state: 'AZ',
    lat: 33.4484,
    lng: -112.0740,
    waterAllocated: '11.4M gallons/day',
    waterCurrent: '4.75M gallons/day',
    waterGap: '5.8M gallons/day shortfall',
    type: 'Municipal Water Infrastructure',
    queryHints: ['Phoenix water supply', 'municipal water allocation', 'TSMC water'],
    notes: 'Phoenix granted 11.4M gallons/day access. Current demand 4.75M gallons/day from Fab 1. Gap = 5.8M gallons/day shortfall when all three fabs online.'
  },
  {
    id: 'tsmc-water-reclamation-plant',
    name: 'TSMC Water Reclamation Plant',
    city: 'Phoenix',
    state: 'AZ',
    lat: 33.6, // Approximate - verify location
    lng: -112.2,
    investment: '$1B+',
    size: '15 acres',
    operational: '2028',
    recyclingRate: '90%',
    remainingDemand: '1.72M gallons/day',
    type: 'Water Treatment/Recycling',
    queryHints: ['TSMC water reclamation', 'Phoenix water recycling', 'semiconductor water treatment'],
    notes: 'Building $1B+ water reclamation plant (15 acres, operational 2028) to hit 90% recycling. But that still leaves 1.72M gallons/day new demand from municipal supply.'
  },
  {
    id: 'aps-transmission-hub',
    name: 'APS Transmission Infrastructure',
    city: 'Phoenix',
    state: 'AZ',
    lat: 33.6, // Approximate - verify location
    lng: -112.2,
    gridOperator: 'APS',
    type: 'Power Transmission',
    queryHints: ['APS transmission', 'Phoenix power grid', 'semiconductor power supply'],
    notes: 'Critical high-voltage transmission infrastructure supporting TSMC power requirements.'
  }
];
```

#### Phase 2: Create TSMC Sites Button Component
**File**: `src/components/Map/components/Cards/TSMCSitesCall.jsx`

**Key Features**:
- Similar structure to `OSMCall.jsx`
- Fetch OSM infrastructure data around TSMC site
- Display key sites as markers
- Show water infrastructure prominently
- Display power transmission lines
- Create zones for analysis:
  - TSMC Fab Complex (primary)
  - Water Infrastructure Zone
  - Power Infrastructure Zone
  - Transportation Corridor

#### Phase 3: Marker Styling
- **TSMC Fab**: Blue/purple theme (semiconductor)
- **Water Infrastructure**: Blue/cyan theme
- **Power Infrastructure**: Yellow/orange theme
- **Transportation**: Gray/green theme

#### Phase 4: Popup Content
**Custom Formatter**: `tsmc-phoenix`

Display:
- Investment amounts
- Water demand metrics
- Construction status
- Operational dates
- Infrastructure details

#### Phase 5: Integration
- Add button to `NestedCircleButton.jsx`
- Add location theme for `tsmc_phoenix`
- Update `geographicConfig.js` if needed
- Create custom popup formatter

### Data Requirements

1. **Site Coordinates**: Need to verify/geocode exact locations
2. **OSM Data**: Infrastructure around TSMC site
3. **Water Infrastructure**: Pipes, treatment plants, allocation points
4. **Power Infrastructure**: Transmission lines, substations
5. **Transportation**: Highways, access roads

### Visual Design

- **Color Scheme**: Blue/purple for semiconductor theme
- **Water Emphasis**: Highlight water infrastructure with special styling
- **Gap Visualization**: Show water shortfall visually
- **Timeline**: Display construction phases and operational dates

### Success Criteria

✅ Display TSMC Fab Complex as primary marker
✅ Show water infrastructure with demand metrics
✅ Display power transmission infrastructure
✅ Show water reclamation plant (under construction)
✅ Visualize water shortfall gap
✅ Interactive popups with detailed information
✅ Integration with existing marker/popup system

