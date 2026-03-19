# TSMC Phoenix Site Implementation Plan

## Overview
This document outlines the plan to add the TSMC (Taiwan Semiconductor Manufacturing Company) Phoenix facility to the mapping and analysis system. The TSMC Phoenix site is a major semiconductor manufacturing complex located in Phoenix, Arizona.

## Site Information
- **Name**: TSMC Arizona Corporation
- **Address**: 5088 W. Innovation Circle, Phoenix, AZ 85083, U.S.A.
- **Coordinates**: ~33.6°N, -112.2°W (to be verified via geocoding)
- **Facility Type**: Semiconductor Manufacturing (Fab)
- **Investment**: $40B+ (Phase 1 & 2 combined)
- **Status**: Under construction / Operational (Phase 1)

## Implementation Strategy

### Phase 1: Core Infrastructure Components

#### 1.1 Create TSMC Marker Component
**File**: `src/components/Map/components/LayerToggle.jsx`
**Pattern**: Follow CyrusOne marker implementation (lines 781-849)

**Implementation Steps**:
- Add state: `const [showTsmcMarker, setShowTsmcMarker] = useState(false);`
- Add marker ref: `const tsmcMarkerRef = useRef(null);`
- Create `addTsmcMarker()` function with:
  - Coordinates: `[-112.2, 33.6]` (verify via geocoding)
  - Custom marker styling (semiconductor theme - blue/purple)
  - Popup with TSMC facility details
- Add toggle section in LayerToggle UI (similar to CyrusOne section at line 1271)

**Marker Styling**:
```javascript
backgroundColor: '#3b82f6', // Blue for semiconductor
border: '3px solid white',
boxShadow: '0 2px 8px rgba(59, 130, 246, 0.5)',
```

#### 1.2 Create TSMC Layer Component
**File**: `src/components/Map/components/TSMCLayer.jsx`
**Pattern**: Follow `LucidLayer.jsx` structure

**Features**:
- Load TSMC building/facility GeoJSON data
- Display 3D building extrusions (if building data available)
- Show facility boundaries
- Support visibility toggle
- Color scheme: Blue/purple theme for semiconductor manufacturing

**Data Source**:
- Create `/public/tsmc-phoenix-buildings.geojson` (if building data available)
- Or use fallback polygon based on site boundaries

#### 1.3 Add to Configuration Files

**File**: `geoai_sites.py`
Add entry:
```python
{
    "id": "tsmc_phoenix",
    "name": "TSMC Arizona Semiconductor Fab",
    "summary": "$40B+ semiconductor manufacturing facility (Phase 1 & 2) producing advanced chips.",
    "coordinates": {"lat": 33.6, "lng": -112.2},  # Verify exact coordinates
    "radius": 3000  # 3km radius for analysis
}
```

**File**: `src/config/geographicConfig.js`
Add Phoenix/TSMC configuration:
```javascript
tsmc_phoenix: {
  coordinates: { lat: 33.6, lng: -112.2 },
  city: 'Phoenix',
  state: 'AZ',
  county: 'Maricopa County',
  region: 'Phoenix Metro',
  gridOperator: 'APS', // Arizona Public Service
  timezone: 'America/Phoenix',
  searchRadius: 10000,
  businessContext: 'TSMC Phoenix Semiconductor Manufacturing Analysis',
  dataCenterCompany: 'TSMC',
  facilityName: 'TSMC Arizona Fab'
}
```

### Phase 2: Layer Integration

#### 2.1 Update LayerToggle.jsx
**Location**: After CyrusOne section (~line 1290)

**Add**:
1. State management for TSMC layer visibility
2. Toggle section in UI
3. Event handlers for layer toggle
4. Integration with scene manager for state persistence

**Code Pattern**:
```javascript
// State
const [showTsmc, setShowTsmc] = useState(false);

// Toggle Section
<CategorySection>
  <CategoryHeader onClick={() => setShowTsmc(v => !v)}>
    <CategoryIcon>🔷</CategoryIcon>
    <CategoryTitle>TSMC Phoenix</CategoryTitle>
    <ToggleSwitch>
      <input
        type="checkbox"
        checked={showTsmc}
        onChange={() => setShowTsmc(v => !v)}
      />
    </ToggleSwitch>
  </CategoryHeader>
</CategorySection>

<TSMCLayer map={map} visible={showTsmc} />
```

#### 2.2 Update Transmission Layer State
**File**: `src/components/Map/components/LayerToggle.jsx`

Add to:
- `onTransmissionLayerStateUpdate` callback (line 178)
- `updateLayerStates` method (line 289)
- Scene manager `layerStates` prop (line 1646)
- `onLoadScene` handler (line 1679)

### Phase 3: Transmission Analysis Integration

#### 3.1 Phoenix-Specific Transmission Workflows
**File**: `src/components/Map/config/transmissionConfig.js`

**Add Phoenix Scene Templates**:
```javascript
PHOENIX_TSMC_OVERVIEW: {
  name: 'TSMC Phoenix Overview',
  description: 'Semiconductor facility and regional power infrastructure',
  layerState: {
    showTsmc: true,
    showKeyInfrastructure: true,
    showNcPower: false, // Not applicable to Phoenix
    showTransportation: true,
    showRoads: true,
    // ... other layers
  },
  camera: {
    zoom: 12,
    center: { lng: -112.2, lat: 33.6 },
    pitch: 45,
    bearing: 0
  }
}
```

**Add Phoenix Workflow**:
```javascript
{
  name: 'TSMC Phoenix Power Analysis',
  description: 'Analyze power infrastructure for semiconductor manufacturing',
  scenes: ['PHOENIX_TSMC_OVERVIEW', 'GENERATION_FOCUS', 'WATER_CONSTRAINTS'],
  duration: 2000
}
```

#### 3.2 Update AITransmissionNav
**File**: `src/components/Map/components/AITransmissionNav.jsx`

- Add Phoenix location detection
- Support Phoenix-specific workflows
- Update AI prompts to include TSMC context

### Phase 4: Data Preparation

#### 4.1 GeoJSON Data Files
**Files to Create**:
1. `/public/data/tsmc-phoenix-site.geojson` - Site boundary
2. `/public/data/tsmc-phoenix-buildings.geojson` - Building footprints (if available)
3. `/public/data/tsmc-phoenix-infrastructure.geojson` - Power/water infrastructure

**Data Sources**:
- OSM data extraction for Phoenix area
- Public planning documents
- Satellite imagery analysis
- Manual boundary creation if needed

#### 4.2 Card Configuration
**File**: `src/components/Map/components/Cards/config/TexasCardConfig.js` (or create Phoenix equivalent)

Add TSMC-specific cards:
- Power consumption analysis
- Water usage patterns
- Transportation access
- Regional infrastructure

### Phase 5: Testing & Validation

#### 5.1 Coordinate Verification
- Geocode "5088 W. Innovation Circle, Phoenix, AZ 85083"
- Verify exact coordinates
- Test marker placement
- Validate zoom levels

#### 5.2 Layer Functionality
- Test toggle visibility
- Verify scene persistence
- Check transmission state updates
- Validate AI navigation workflows

#### 5.3 Integration Testing
- Test with existing layers
- Verify no conflicts with other components
- Check performance with multiple layers
- Validate map interactions

## File Structure Summary

```
src/components/Map/components/
├── TSMCLayer.jsx                    [NEW]
└── LayerToggle.jsx                  [MODIFY]

src/config/
├── geographicConfig.js              [MODIFY]
└── transmissionConfig.js            [MODIFY]

src/components/Map/config/
└── transmissionConfig.js            [MODIFY]

public/data/
├── tsmc-phoenix-site.geojson        [NEW]
├── tsmc-phoenix-buildings.geojson   [NEW]
└── tsmc-phoenix-infrastructure.geojson [NEW]

geoai_sites.py                       [MODIFY]
```

## Implementation Order

1. **Week 1**: Core Components
   - Create TSMCLayer.jsx
   - Add marker to LayerToggle.jsx
   - Add configuration entries

2. **Week 2**: Integration
   - Update transmission config
   - Add Phoenix workflows
   - Integrate with scene manager

3. **Week 3**: Data & Polish
   - Create GeoJSON data files
   - Add card configurations
   - Testing & refinement

## Key Considerations

### Location Context
- Phoenix is in **Maricopa County, Arizona**
- Grid operator: **APS (Arizona Public Service)**
- Timezone: **America/Phoenix**
- Different from Texas (ERCOT) - different grid rules

### Semiconductor-Specific Needs
- **High power consumption** - need power infrastructure analysis
- **Water intensive** - water resource analysis critical
- **Clean room requirements** - environmental factors important
- **Transportation** - supply chain access analysis

### Integration Points
- Must work with existing transmission analysis system
- Should support scene saving/loading
- Needs to integrate with AI navigation workflows
- Should follow existing component patterns

## Success Criteria

✅ TSMC marker appears on map when toggle is enabled
✅ TSMC layer displays facility boundaries/buildings
✅ Toggle state persists in scene manager
✅ Phoenix-specific transmission workflows available
✅ AI navigation supports TSMC context
✅ No conflicts with existing functionality
✅ Performance remains acceptable with new layer

## Notes

- **Coordinate Verification**: Need to geocode the exact address to get precise coordinates
- **Data Availability**: May need to create GeoJSON manually if OSM data is insufficient
- **Styling**: Use semiconductor/tech theme (blue/purple) to differentiate from other facilities
- **Scale**: TSMC is a massive facility - ensure appropriate zoom levels and detail levels

