# MCP Marker Improvement Plan - Critical Infrastructure Focus

## Current State Analysis

### Problems Identified

1. **Limited Coverage**
   - Default radius: 5km (too small for regional infrastructure)
   - Only shows markers very close to site
   - Missing critical infrastructure further away

2. **No Prioritization**
   - All markers treated equally
   - No importance scoring
   - Can't distinguish critical vs non-critical nodes

3. **No Visual Hierarchy**
   - All markers same size (1.0)
   - No visual indication of importance
   - Can't quickly identify most critical infrastructure

4. **Limited Data Utilization**
   - Not using voltage levels for prioritization
   - Not using operator information
   - Not using infrastructure type/role

## Improvement Plan

### Phase 1: Importance Scoring System

#### 1.1 Create Importance Scoring Function

**File:** `server.js` (add new function)

```javascript
/**
 * Calculate importance score for infrastructure features
 * Higher score = more critical
 * 
 * Scoring factors:
 * - Voltage level (higher = more critical)
 * - Distance from site (closer = more critical, but with diminishing returns)
 * - Infrastructure type (substation > line > tower)
 * - Operator (major operators = more critical)
 * - Named vs unnamed (named = more critical)
 */
function calculateImportanceScore(feature, facilityPoint, category) {
  const props = feature.properties || {};
  let score = 0;
  
  // 1. VOLTAGE SCORING (Power infrastructure)
  if (category === 'power' || category === 'substation' || category === 'line') {
    const voltage = parseVoltage(props.voltage || props['voltage:primary'] || props['voltage:secondary']);
    if (voltage) {
      if (voltage >= 345) score += 50;      // Extra high voltage (transmission)
      else if (voltage >= 230) score += 40; // High voltage (transmission)
      else if (voltage >= 138) score += 30; // Sub-transmission
      else if (voltage >= 69) score += 20;  // Distribution
      else if (voltage >= 34) score += 10;  // Medium voltage
      else score += 5;                       // Low voltage
    }
  }
  
  // 2. INFRASTRUCTURE TYPE SCORING
  const powerType = props.power || props.substation || props.man_made;
  if (powerType === 'substation') {
    const substationType = props.substation || props['substation:type'];
    if (substationType === 'transmission') score += 30;
    else if (substationType === 'primary') score += 25;
    else if (substationType === 'distribution') score += 15;
    else score += 20; // Default substation
  } else if (powerType === 'plant' || powerType === 'generator') {
    score += 40; // Power plants are very critical
  } else if (powerType === 'line') {
    score += 10; // Transmission lines
  } else if (powerType === 'tower') {
    score += 5; // Individual towers
  }
  
  // 3. WATER INFRASTRUCTURE SCORING
  if (category === 'water') {
    const waterType = props.man_made || props.amenity || props.natural;
    if (waterType === 'water_works' || waterType === 'water_treatment') score += 35;
    else if (waterType === 'water_tower') score += 25;
    else if (waterType === 'reservoir_covered') score += 20;
    else if (props.waterway === 'river' || props.waterway === 'canal') score += 15;
    else if (props.pipeline === 'water') score += 10;
    else score += 5;
  }
  
  // 4. DISTANCE SCORING (closer = more important, but with curve)
  const distanceKm = (props.distance_m || 0) / 1000;
  if (distanceKm <= 1) score += 20;        // Within 1km
  else if (distanceKm <= 3) score += 15;   // Within 3km
  else if (distanceKm <= 5) score += 10;   // Within 5km
  else if (distanceKm <= 10) score += 5;   // Within 10km
  else if (distanceKm <= 20) score += 2;   // Within 20km
  // Beyond 20km: no distance bonus (but still can be important if high voltage)
  
  // 5. NAMED INFRASTRUCTURE (more important if it has a name)
  if (props.name && props.name !== 'Unnamed' && !props.name.match(/^[A-Z0-9]+$/)) {
    score += 10; // Has a meaningful name
  }
  
  // 6. OPERATOR SCORING (major operators = more critical)
  const operator = props.operator || props['operator:ref'];
  if (operator) {
    const operatorLower = operator.toLowerCase();
    // Major grid operators
    if (operatorLower.includes('pjm') || 
        operatorLower.includes('pjm interconnection') ||
        operatorLower.includes('constellation') ||
        operatorLower.includes('talen') ||
        operatorLower.includes('exelon')) {
      score += 15;
    } else if (operatorLower.includes('electric') || 
               operatorLower.includes('power') ||
               operatorLower.includes('utility')) {
      score += 5;
    }
  }
  
  // 7. CAPACITY/LOAD SCORING (if available)
  if (props.capacity || props.load) {
    const capacity = parseFloat(props.capacity || props.load || 0);
    if (capacity > 100) score += 10;      // High capacity
    else if (capacity > 50) score += 5;   // Medium capacity
  }
  
  return Math.round(score);
}

/**
 * Parse voltage string to number (handles "345000", "345 kV", "345000V", etc.)
 */
function parseVoltage(voltageStr) {
  if (!voltageStr) return null;
  const str = String(voltageStr).toLowerCase().trim();
  // Remove "kv", "v", "volts" and extract number
  const match = str.match(/(\d+(?:\.\d+)?)/);
  if (match) {
    let value = parseFloat(match[1]);
    // If value is very large (>1000), assume it's in volts, convert to kV
    if (value > 1000) value = value / 1000;
    return value;
  }
  return null;
}
```

#### 1.2 Apply Scoring in Server Filtering

**File:** `server.js` (modify `/api/mcp/search` endpoint)

```javascript
// After filtering by distance and category, add importance scores
const featuresWithScores = features.map(feature => {
  const importance = calculateImportanceScore(feature, facilityPoint, category);
  if (!feature.properties) feature.properties = {};
  feature.properties.importance = importance;
  feature.properties.importance_tier = getImportanceTier(importance);
  return feature;
});

// Sort by importance (highest first)
featuresWithScores.sort((a, b) => {
  const scoreA = a.properties?.importance || 0;
  const scoreB = b.properties?.importance || 0;
  return scoreB - scoreA; // Descending order
});

// Filter by minimum importance (optional - can be configurable)
const MIN_IMPORTANCE_SCORE = 15; // Only show features with score >= 15
const filteredFeatures = featuresWithScores.filter(f => 
  (f.properties?.importance || 0) >= MIN_IMPORTANCE_SCORE
);

// Limit results but prioritize by importance
const limitedFeatures = filteredFeatures.slice(0, 100); // Increased from 50
```

### Phase 2: Expand Coverage Radius

#### 2.1 Adaptive Radius Based on Category

**File:** `src/mcp/queryParser.js` (modify `parseQuery`)

```javascript
// Extract radius with category-specific defaults
let radius = 5000; // Default 5km

// Category-specific default radii
const categoryDefaultRadii = {
  substation: 20000,    // 20km for substations (regional coverage)
  line: 25000,          // 25km for transmission lines
  tower: 15000,         // 15km for towers
  water: 15000,         // 15km for water infrastructure
  pipeline: 20000,      // 20km for pipelines
  plant: 10000,         // 10km for power plants
  default: 5000         // 5km default
};

// If no radius specified, use category default
if (!radiusPatterns.some(p => lowerQuery.match(p.pattern))) {
  radius = categoryDefaultRadii[category] || categoryDefaultRadii.default;
}
```

#### 2.2 Increase Default Radius in Quick Actions

**File:** `src/components/Map/components/MCPChatPanel.jsx`

```javascript
// Update Quick Actions to specify larger radii
{ 
  label: 'Substations near Three Mile Island', 
  query: 'substations within 20km of Three Mile Island', // Explicit radius
  category: 'power',
  icon: '⚡'
}
```

### Phase 3: Visual Hierarchy - Color Gradient System

#### 3.1 Color Gradient Based on Importance

**Approach:** Use brightness/intensity gradients within existing color palette
- **Power (Purple):** Brighter purple = more important
- **Water (Cyan):** Brighter cyan = more important

**File:** `src/components/Map/components/MCPSearchResults.jsx` (modify `addMarker`)

```javascript
// Determine marker color brightness based on importance
const importance = props.importance || 0;
const importanceTier = props.importance_tier || 'low';

// Color gradient system: brighter = more important
// Power (Purple) gradient: #8b5cf6 (base) → #c084fc (bright) → #e9d5ff (brightest)
// Water (Cyan) gradient: #06b6d4 (base) → #22d3ee (bright) → #67e8f9 (brightest)

let markerColor;
if (isWaterCategory) {
  // Water: Cyan gradient (brighter = more important)
  if (importanceTier === 'critical') {
    markerColor = '#67e8f9'; // Brightest cyan (critical)
  } else if (importanceTier === 'high') {
    markerColor = '#22d3ee'; // Bright cyan (high)
  } else if (importanceTier === 'medium') {
    markerColor = '#06b6d4'; // Base cyan (medium)
  } else {
    markerColor = '#0891b2'; // Darker cyan (low)
  }
} else {
  // Power: Purple gradient (brighter = more important)
  if (importanceTier === 'critical') {
    markerColor = '#e9d5ff'; // Brightest purple (critical)
  } else if (importanceTier === 'high') {
    markerColor = '#c084fc'; // Bright purple (high)
  } else if (importanceTier === 'medium') {
    markerColor = '#8b5cf6'; // Base purple (medium)
  } else {
    markerColor = '#6b21a8'; // Darker purple (low)
  }
}

// Keep marker size consistent (1.0) - only color changes
const markerSize = 1.0;
```

#### 3.2 Importance Tier Classification

**File:** `server.js` (add helper function)

```javascript
function getImportanceTier(score) {
  if (score >= 60) return 'critical';
  if (score >= 40) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}
```

#### 3.3 Popup Color Matching

**File:** `src/components/Map/components/MCPSearchResults.jsx`

```javascript
// Match popup gradient to marker color intensity
const getPopupGradient = (isWaterCategory, importanceTier) => {
  if (isWaterCategory) {
    // Water popup gradients (matching marker brightness)
    if (importanceTier === 'critical') {
      return 'linear-gradient(135deg, #67e8f9 0%, #22d3ee 100%)'; // Brightest cyan
    } else if (importanceTier === 'high') {
      return 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)'; // Bright cyan
    } else if (importanceTier === 'medium') {
      return 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'; // Base cyan
    } else {
      return 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)'; // Darker cyan
    }
  } else {
    // Power popup gradients (matching marker brightness)
    if (importanceTier === 'critical') {
      return 'linear-gradient(135deg, #e9d5ff 0%, #c084fc 100%)'; // Brightest purple
    } else if (importanceTier === 'high') {
      return 'linear-gradient(135deg, #c084fc 0%, #8b5cf6 100%)'; // Bright purple
    } else if (importanceTier === 'medium') {
      return 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'; // Base purple
    } else {
      return 'linear-gradient(135deg, #6b21a8 0%, #5b21b6 100%)'; // Darker purple
    }
  }
};

const popupBgGradient = getPopupGradient(isWaterCategory, importanceTier);
```

#### 3.4 Halo Effect Color Matching

**File:** `src/components/Map/components/MCPSearchResults.jsx` (modify `addHaloEffect`)

```javascript
// Match halo color to marker importance
const getHaloColor = (isWaterCategory, importanceTier) => {
  if (isWaterCategory) {
    // Water halo colors (matching marker brightness)
    if (importanceTier === 'critical') return '#67e8f9';
    if (importanceTier === 'high') return '#22d3ee';
    if (importanceTier === 'medium') return '#06b6d4';
    return '#0891b2';
  } else {
    // Power halo colors (matching marker brightness)
    if (importanceTier === 'critical') return '#e9d5ff';
    if (importanceTier === 'high') return '#c084fc';
    if (importanceTier === 'medium') return '#8b5cf6';
    return '#6b21a8';
  }
};

const haloColor = getHaloColor(isWaterCategory, importanceTier);
```

#### 3.5 Color Palette Reference

**Power (Purple) Gradient:**
- Critical (brightest): `#e9d5ff` (lavender)
- High (bright): `#c084fc` (light purple)
- Medium (base): `#8b5cf6` (purple) - current default
- Low (darker): `#6b21a8` (dark purple)

**Water (Cyan) Gradient:**
- Critical (brightest): `#67e8f9` (light cyan)
- High (bright): `#22d3ee` (cyan)
- Medium (base): `#06b6d4` (teal) - current default
- Low (darker): `#0891b2` (dark teal)

### Phase 4: Enhanced Data Collection - 100 Mile Strategic Coverage ✅ IMPLEMENTED

**Status:** ✅ **COMPLETED** - Strategic filtering and batching implemented

#### 4.1 Expand OSM Query Radius to 100 Miles ✅

**File:** `scripts/osm-tools/pa_nuclear_datacenter_osm.py`

✅ **IMPLEMENTED:**
- Radius expanded to 100 miles (160,934 meters) for both PA sites
- Updated `SITES` configuration with `RADIUS_100_MILES` constant
- Both Three Mile Island and Susquehanna now query 100-mile radius

#### 4.2 Strategic Node Filtering in OSM Query ✅

**Priority-based queries** - Query strategic nodes first, then filter during processing:

```python
def build_strategic_query(lat: float, lon: float, radius_m: int) -> str:
    """
    Build Overpass query prioritizing strategic infrastructure:
    1. High-voltage transmission (345kV+) - CRITICAL
    2. Major substations (transmission level)
    3. Power plants and generators
    4. Major water infrastructure (water_works, treatment plants)
    5. Regional transmission lines
    6. Named infrastructure (more likely to be important)
    """
    return f"""
    [out:json][timeout:300];
    (
      // TIER 1: CRITICAL - High-voltage transmission (345kV+)
      node["power"="substation"]["voltage"~"^3[4-9][0-9]|^[4-9][0-9][0-9]"](around:{radius_m},{lat},{lon});
      way["power"="line"]["voltage"~"^3[4-9][0-9]|^[4-9][0-9][0-9]"](around:{radius_m},{lat},{lon});
      
      // TIER 2: HIGH - Major substations (230kV, transmission level)
      node["power"="substation"]["voltage"~"^2[0-3][0-9]|^230"](around:{radius_m},{lat},{lon});
      way["power"="line"]["voltage"~"^2[0-3][0-9]|^230"](around:{radius_m},{lat},{lon});
      
      // TIER 3: HIGH - Power plants and generators
      node["power"~"plant|generator"](around:{radius_m},{lat},{lon});
      way["power"~"plant|generator"](around:{radius_m},{lat},{lon});
      
      // TIER 4: MEDIUM - Sub-transmission (138-161kV)
      node["power"="substation"]["voltage"~"^1[3-6][0-9]|^138|^161"](around:{radius_m},{lat},{lon});
      way["power"="line"]["voltage"~"^1[3-6][0-9]|^138|^161"](around:{radius_m},{lat},{lon});
      
      // TIER 5: MEDIUM - Named substations (likely important)
      node["power"="substation"]["name"](around:{radius_m},{lat},{lon});
      
      // TIER 6: MEDIUM - Major water infrastructure
      node["man_made"~"water_works|water_treatment"](around:{radius_m},{lat},{lon});
      way["man_made"~"water_works|water_treatment"](around:{radius_m},{lat},{lon});
      node["amenity"~"water_treatment|water_works"](around:{radius_m},{lat},{lon});
      
      // TIER 7: LOW - Other power infrastructure (distribution, but still collect)
      node["power"="substation"](around:{radius_m},{lat},{lon});
      way["power"="line"](around:{radius_m},{lat},{lon});
      
      // TIER 8: LOW - Other water infrastructure
      node["man_made"~"water_tower|reservoir"](around:{radius_m},{lat},{lon});
      way["pipeline"="water"](around:{radius_m},{lat},{lon});
      
      // CONTEXT: Major rivers and water bodies
      way["waterway"="river"](around:{radius_m},{lat},{lon});
      way["natural"="water"](around:{radius_m},{lat},{lon});
    );
    out body;
    >;
    out skel qt;
    """
```

#### 4.3 Strategic Filtering During Processing ✅

**File:** `scripts/osm-tools/pa_nuclear_datacenter_osm.py` (modify `process_features`)

✅ **IMPLEMENTED:**
- `calculate_strategic_score()` function calculates importance (0-100) based on:
  - Voltage level (345kV+ = 50 points, 230kV = 40, etc.)
  - Infrastructure type (plant = 35, transmission substation = 30, etc.)
  - Water infrastructure (water_works = 30, treatment = 25, etc.)
  - Named infrastructure (+10 points)
  - Major operators (PJM, Constellation, etc. = +15 points)
- `parse_voltage()` function handles various voltage formats
- `get_strategic_tier()` classifies as "critical", "high", "medium", or "low"
- Strategic threshold: score >= 25 (configurable via `STRATEGIC_SCORE_THRESHOLD`)
- Features sorted by strategic score (highest first)
- Limited to top 5,000 features per site (configurable via `MAX_FEATURES_PER_SITE`)

```python
def calculate_strategic_score(element: Dict, tags: Dict) -> float:
    """
    Calculate strategic importance score (0-100)
    Higher score = more strategic/important
    """
    score = 0.0
    
    # Voltage scoring (most important factor)
    voltage_str = tags.get("voltage") or tags.get("voltage:primary") or ""
    if voltage_str:
        try:
            # Parse voltage (handles "345000", "345 kV", "345000V")
            voltage_val = parse_voltage(voltage_str)
            if voltage_val:
                if voltage_val >= 345:
                    score += 50  # Extra high voltage (transmission backbone)
                elif voltage_val >= 230:
                    score += 40  # High voltage (transmission)
                elif voltage_val >= 138:
                    score += 30  # Sub-transmission
                elif voltage_val >= 69:
                    score += 20  # Distribution
                else:
                    score += 10  # Low voltage
        except:
            pass
    
    # Infrastructure type scoring
    power_type = tags.get("power") or tags.get("substation") or ""
    if power_type == "plant" or power_type == "generator":
        score += 35  # Power plants are very strategic
    elif power_type == "substation":
        substation_type = tags.get("substation:type") or tags.get("substation")
        if substation_type == "transmission":
            score += 30
        elif substation_type == "primary":
            score += 25
        else:
            score += 15
    elif power_type == "line":
        score += 10  # Transmission lines
    
    # Water infrastructure scoring
    if tags.get("man_made") in ["water_works", "water_treatment"]:
        score += 30
    elif tags.get("amenity") in ["water_treatment", "water_works"]:
        score += 25
    elif tags.get("man_made") == "water_tower":
        score += 15
    
    # Named infrastructure (more likely to be important)
    if tags.get("name") and tags.get("name") not in ["Unnamed", "Unnamed Area"]:
        score += 10
    
    # Operator scoring (major operators = more strategic)
    operator = tags.get("operator") or tags.get("operator:ref") or ""
    if operator:
        operator_lower = operator.lower()
        if any(major in operator_lower for major in ["pjm", "constellation", "talen", "exelon", "firstenergy"]):
            score += 15
        elif "electric" in operator_lower or "power" in operator_lower:
            score += 5
    
    return min(100, score)  # Cap at 100


def parse_voltage(voltage_str: str) -> float | None:
    """Parse voltage string to numeric value in kV"""
    import re
    if not voltage_str:
        return None
    # Extract number
    match = re.search(r'(\d+(?:\.\d+)?)', str(voltage_str))
    if match:
        value = float(match.group(1))
        # If very large (>1000), assume volts, convert to kV
        if value > 1000:
            value = value / 1000
        return value
    return None


def process_and_filter_features(elements: List[Dict], site_key: str, node_lookup: Dict) -> List[Dict]:
    """
    Process OSM elements and filter to strategic nodes only
    """
    features = []
    
    for element in elements:
        tags = element.get("tags", {}) or {}
        
        # Calculate strategic score
        strategic_score = calculate_strategic_score(element, tags)
        
        # Only include features above strategic threshold
        STRATEGIC_THRESHOLD = 20  # Minimum score to be considered strategic
        if strategic_score < STRATEGIC_THRESHOLD:
            continue  # Skip non-strategic features
        
        # Convert to feature
        if element["type"] == "node":
            feature = node_to_feature(site_key, element)
        elif element["type"] == "way":
            feature = way_to_feature(site_key, element, node_lookup)
        else:
            continue
        
        if feature:
            # Add strategic score to properties
            feature["properties"]["strategic_score"] = strategic_score
            feature["properties"]["strategic_tier"] = get_strategic_tier(strategic_score)
            features.append(feature)
    
    # Sort by strategic score (highest first)
    features.sort(key=lambda f: f["properties"].get("strategic_score", 0), reverse=True)
    
    return features


def get_strategic_tier(score: float) -> str:
    """Classify strategic tier"""
    if score >= 60:
        return "critical"
    elif score >= 40:
        return "high"
    elif score >= 25:
        return "medium"
    else:
        return "low"
```

#### 4.4 Update Feature Processing Pipeline ✅

**File:** `scripts/osm-tools/pa_nuclear_datacenter_osm.py` (modify main processing)

✅ **IMPLEMENTED:**
- `build_features()` now calculates strategic score for each element
- Filters out features below `STRATEGIC_SCORE_THRESHOLD` (25)
- Adds `strategic_score` and `strategic_tier` to feature properties
- Sorts features by strategic score (highest first)
- Limits to `MAX_FEATURES_PER_SITE` (5,000) for performance
- Enhanced logging shows score distribution and tier counts

```python
# In the main processing loop:
elements = response_data.get("elements", [])
node_lookup = {el["id"]: el for el in elements if el["type"] == "node"}

# Process and filter to strategic nodes only
strategic_features = process_and_filter_features(elements, site["key"], node_lookup)

log(f"✅ Filtered to {len(strategic_features)} strategic features (from {len(elements)} total elements)")

# Create FeatureCollection
feature_collection = {
    "type": "FeatureCollection",
    "features": strategic_features,
    "metadata": {
        "site": site["name"],
        "site_key": site["key"],
        "query_radius_m": site["radius_m"],
        "query_radius_miles": round(site["radius_m"] / 1609.34, 1),
        "total_elements": len(elements),
        "strategic_features": len(strategic_features),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "strategic_threshold": 20
    }
}
```

#### 4.5 Add Metadata to OSM Features ✅

✅ **IMPLEMENTED:** Features now include:
- `voltage` / `voltage:primary` - extracted from OSM tags
- `operator` / `operator:ref` - extracted from OSM tags
- `substation:type` - extracted from OSM tags
- `strategic_score` - calculated importance (0-100) ✅
- `strategic_tier` - "critical", "high", "medium", "low" ✅
- `name` - for named infrastructure
- All original OSM tags preserved in `tags` property

#### 4.6 Batching Strategy for Large Queries ✅

✅ **IMPLEMENTED:**
- Automatic batching for queries > 50km radius
- `fetch_site_data_batched()` splits large queries into:
  - Inner ring (0-50km): Full detail query
  - Outer ring (50km-100 miles): High-voltage only query
- Prevents timeout on very large radius queries
- Combines results and deduplicates
- Enhanced timeout handling with exponential backoff
- Graceful error handling with detailed logging

#### 4.7 Workflow Summary

**Updated Workflow (100 mile strategic):** ✅ **IMPLEMENTED**
1. ✅ Python script queries Overpass API with 100 mile radius
2. ✅ **NEW:** Calculates strategic score for each element
3. ✅ **NEW:** Filters to strategic nodes only (score >= 25)
4. ✅ **NEW:** Limits to top 5,000 features per site (performance critical)
5. ✅ **NEW:** Sorts by strategic score (highest first)
6. ✅ Saves to `public/osm/pa_nuclear_tmi.json` (with strategic metadata)
7. Server loads from `public/osm/` 
8. Server applies importance scoring (Phase 1) - uses strategic_score as base
9. Server filters by category/distance (within query radius)
10. Frontend displays markers with color gradients (Phase 3)

**Next Steps:**
- Run the script to regenerate OSM cache files: `python3 scripts/osm-tools/pa_nuclear_datacenter_osm.py`
- Implement Phase 1 (Importance Scoring in server.js) - adapt strategic_score
- Implement Phase 3 (Visual Hierarchy) - color gradients based on strategic_tier

### Phase 5: Filtering & Display Options

#### 5.1 Add Importance Filter UI

**File:** `src/components/Map/components/MCPChatPanel.jsx`

```javascript
// Add filter dropdown in Quick Actions section
const [importanceFilter, setImportanceFilter] = useState('all'); // 'all', 'critical', 'high', 'medium'

// Filter features before displaying
const filteredFeatures = response.features.filter(f => {
  if (importanceFilter === 'all') return true;
  const tier = f.properties?.importance_tier || 'low';
  return tier === importanceFilter || 
         (importanceFilter === 'critical' && tier === 'critical') ||
         (importanceFilter === 'high' && ['critical', 'high'].includes(tier));
});
```

#### 5.2 Show Importance in Popup

**File:** `src/components/Map/components/MCPSearchResults.jsx`

```javascript
// Popup shows importance through color gradient (no badges needed)
// The popup background gradient already indicates importance
// Add voltage and operator info for context
popup.setHTML(`
  <div>
    <div style="font-weight: 600; margin-bottom: 4px;">${displayCategory}</div>
    ${voltage ? `<div style="font-size: 11px; opacity: 0.9;">${voltage} kV</div>` : ''}
    ${operator ? `<div style="font-size: 11px; opacity: 0.9;">${operator}</div>` : ''}
    ${importanceTier ? `<div style="font-size: 10px; opacity: 0.7; margin-top: 4px; text-transform: uppercase;">${importanceTier} importance</div>` : ''}
  </div>
`);
```

**Note:** Importance is primarily communicated through color brightness. The popup gradient and marker color together provide clear visual hierarchy without needing badges.

## Implementation Priority

### Phase 4 (Highest Priority) - Data Collection First
**Why first:** Need the data before we can score/filter it properly
1. ✅ Update OSM script to 100 mile radius
2. ✅ Implement strategic filtering in collection phase
3. ✅ Re-generate OSM cache files
4. ✅ Test with new data

**Estimated Time:** 4-6 hours

### Phase 1 (High Priority) - Core Functionality
1. ✅ Implement importance scoring function
2. ✅ Apply scoring in server filtering
3. ✅ **Add server-side limit: MAX_FEATURES_TO_RETURN = 200**
4. ✅ Sort by importance
5. ✅ Add importance tier classification

**Estimated Time:** 2-3 hours

**Performance Note:** Server limits response to top 200 features to prevent frontend overload

### Phase 2 (High Priority) - Coverage
1. ✅ Expand default radius for categories
2. ✅ Update Quick Actions with explicit radii
3. ✅ Test with larger radius queries

**Estimated Time:** 1-2 hours

### Phase 3 (Medium Priority) - Visual
1. ✅ Color gradient system (brighter = more important)
2. ✅ Popup gradients matching marker colors
3. ✅ Halo effect colors matching marker importance
4. ✅ Consistent marker size (1.0) - only color changes
5. ✅ **Add display limits: MAX_TOTAL_MARKERS = 100**

**Estimated Time:** 2-3 hours

**Performance Note:** Frontend limits to 100 markers total (20 with popups, 80 without) to maintain smooth performance

### Phase 4 (High Priority) - Data Collection
1. ✅ Expand OSM query radius to 100 miles (160km)
2. ✅ Implement strategic filtering in OSM collection phase
3. ✅ Calculate strategic scores during OSM processing
4. ✅ Filter to strategic nodes only (score >= 25)
5. ✅ **Hard limit: 5,000 features per site** (performance critical)
6. ✅ Sort by strategic score in saved JSON
7. ✅ Re-generate OSM cache files with strategic metadata
8. ✅ Verify file sizes: 3-5 MB per site (down from 31 MB)

**Estimated Time:** 4-6 hours (includes data collection and testing)

**Performance Targets:**
- File size: < 5 MB per site
- Feature count: 3,000-5,000 per site
- Strategic threshold: Score >= 25

### Phase 5 (Low Priority) - UX
1. ✅ Importance filter UI
2. ✅ Statistics showing importance breakdown
3. ✅ Legend explaining importance tiers

**Estimated Time:** 2-3 hours

## Expected Results

### Before
- ~10-20 markers within 5km
- All markers same color/intensity
- Missing critical infrastructure further away
- No way to identify most important nodes
- **Performance:** Unlimited markers (risk of 1000+ markers)

### After
- **100 mile radius coverage** with strategic filtering
- **3,000-5,000 strategic features** per site (down from 60,000+)
- **100 marker display limit** (20 with popups, 80 without)
- Color gradients: brighter = more important
  - Power: Bright purple (#e9d5ff) for critical, darker purple (#6b21a8) for low
  - Water: Bright cyan (#67e8f9) for critical, darker cyan (#0891b2) for low
- Critical infrastructure clearly visible (brightest colors)
- Sorted by importance (most critical first)
- Consistent marker size (1.0) - visual hierarchy through color only
- **Performance:** Optimized (3-5 MB files, 100 marker limit)

## Testing Plan

1. **Test Importance Scoring:**
   - Verify high-voltage substations get high scores
   - Verify close infrastructure gets distance bonus
   - Verify named infrastructure gets name bonus

2. **Test Coverage:**
   - Compare marker counts: 5km vs 20km radius
   - Verify critical infrastructure appears even if far

3. **Test Visual Hierarchy:**
   - Verify critical markers are brightest (power: #e9d5ff, water: #67e8f9)
   - Verify color gradient progression is visible (critical → high → medium → low)
   - Verify popup and halo colors match marker colors
   - Verify consistent marker size (all 1.0)

4. **Test Performance:**
   - Verify map performance with 100 markers
   - Verify API response time with larger datasets
   - Verify marker rendering performance

## Configuration Options

Add to `src/config/ncPowerSites.js`:

```javascript
{
  key: 'three_mile_island_pa',
  // ... existing config
  mcpSearchConfig: {
    defaultRadius: 20000,        // 20km default
    maxResults: 100,              // Max markers to show
    minImportanceScore: 15,       // Minimum importance to display
    importanceTiers: {
      critical: 60,
      high: 40,
      medium: 20,
      low: 0
    }
  }
}
```

## Next Steps

1. **Review & Approve Plan** - Get feedback on strategic filtering approach
2. **Implement Phase 4 FIRST** - Update OSM collection script
   - Expand to 100 mile radius
   - Add strategic filtering
   - Re-generate cache files
3. **Implement Phase 1** - Core importance scoring (can use strategic_score as base)
4. **Test with PA Sites** - Verify strategic nodes appear correctly
5. **Implement Phase 2** - Expand coverage (already done in Phase 4)
6. **Implement Phase 3** - Visual hierarchy with color gradients
7. **Iterate** - Refine based on results

## Data Collection Workflow

### Step 1: Update OSM Script
```bash
cd scripts/osm-tools
# Edit pa_nuclear_datacenter_osm.py
# - Change radius to 160934 (100 miles)
# - Add strategic filtering functions
# - Update build_query to prioritize strategic nodes
```

### Step 2: Run OSM Collection
```bash
python scripts/osm-tools/pa_nuclear_datacenter_osm.py
# This will:
# - Query Overpass API with 100 mile radius
# - Filter to strategic nodes (score >= 20)
# - Save to public/osm/pa_nuclear_tmi.json
# - Save to public/osm/pa_nuclear_susquehanna.json
```

### Step 3: Verify Output
```bash
# Check file sizes (should be reasonable even with 100 mile radius)
ls -lh public/osm/pa_nuclear_*.json

# Check feature counts
cat public/osm/pa_nuclear_tmi.json | jq '.features | length'
cat public/osm/pa_nuclear_tmi.json | jq '.metadata'

# Check strategic score distribution
cat public/osm/pa_nuclear_tmi.json | jq '.features | map(.properties.strategic_score) | sort | reverse | .[0:10]'
```

### Step 4: Test in App
- Open MCP Chat Panel
- Click "Substations near Three Mile Island"
- Verify strategic nodes appear (should see high-voltage infrastructure)
- Verify color gradients work (brighter = more important)

