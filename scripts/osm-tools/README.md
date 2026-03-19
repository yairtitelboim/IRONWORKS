# OSM Infrastructure Data Collection Guide

This guide explains how to set up a script to download key Water and Power infrastructure data from OpenStreetMap (OSM) for a new location, which will then be loaded and displayed on the map.

## Overview

The system works in three stages:

1. **Data Collection**: Python script queries OSM via Overpass API to download power and water infrastructure
2. **Strategic Filtering**: Features are scored and filtered based on importance (voltage, distance, type, etc.)
3. **Map Integration**: GeoJSON files are loaded by the frontend and rendered on the map

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Python Script (scripts/osm-tools/pa_nuclear_datacenter_osm.py) │
│  - Queries OSM via Overpass API                             │
│  - Calculates strategic scores                              │
│  - Filters features (score >= threshold)                    │
│  - Generates GeoJSON                                        │
└──────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  GeoJSON Cache (public/osm/*.json)                         │
│  - Stored in public folder for direct access                │
│  - Contains filtered, strategic infrastructure              │
└──────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend Component (src/components/Map/components/Cards/   │
│                        OSMCallCached.jsx)                    │
│  - Loads GeoJSON from public/osm/                           │
│  - Renders layers on Mapbox map                             │
│  - Filters by site radius for display                       │
└─────────────────────────────────────────────────────────────┘
```

## Key Files Reference

### Python Script (Data Collection)
- **Main Script**: `scripts/osm-tools/pa_nuclear_datacenter_osm.py`
  - Queries OSM via Overpass API
  - Implements strategic scoring algorithm
  - Filters and exports GeoJSON

### Configuration Files
- **Site Configuration**: `src/config/ncPowerSites.js`
  - Defines site metadata (coordinates, radius, colors, data paths)
  - Maps site keys to GeoJSON file paths
  - Used by both frontend and backend

- **Geographic Config**: `src/config/geographicConfig.js`
  - Defines location display names and metadata
  - Used by LoadingCard and other UI components

### Frontend Components
- **OSM Data Loader**: `src/components/Map/components/Cards/OSMCallCached.jsx`
  - Loads cached GeoJSON from `public/osm/`
  - Renders power lines, substations, water features on map
  - Handles distance filtering and layer animations

- **Loading Card**: `src/components/Map/components/Cards/LoadingCard.jsx`
  - Displays loading status during OSM data processing
  - Shows site-specific messages

### Backend API
- **MCP Search Endpoint**: `server.js` (POST `/api/mcp/search`)
  - Loads OSM GeoJSON files for MCP infrastructure search
  - Filters features by category and distance
  - Applies importance scoring

## Step-by-Step Setup Guide

### Step 1: Create Your Python Script

Create a new Python script in `scripts/osm-tools/` based on the PA nuclear script:

```bash
cp scripts/osm-tools/pa_nuclear_datacenter_osm.py scripts/osm-tools/your_location_osm.py
```

### Step 2: Configure Site Information

Edit your script and update the `SITES` configuration:

```python
SITES = [
    {
        "key": "your_site_key",           # Unique identifier (e.g., "data_center_ca")
        "name": "Your Site Name",          # Full display name
        "lat": 37.7749,                    # Latitude (decimal degrees)
        "lon": -122.4194,                  # Longitude (decimal degrees)
        "radius_m": 160934,                 # Radius in meters (100 miles = 160934)
        "note": "Your site description",
        "output_key": "your_site_key",     # Output filename (without .json)
    },
]
```

**Key Parameters:**
- `radius_m`: Search radius in meters
  - **100 miles** = 160,934 meters (for strategic regional coverage)
  - **50 km** = 50,000 meters (for local infrastructure)
  - **25 km** = 25,000 meters (for immediate area)

### Step 3: Adjust Strategic Scoring (Optional)

The script uses a strategic scoring system to prioritize important infrastructure. Key scoring factors:

- **Voltage Level**: Higher voltage = higher score
  - 345kV+ = 50 points
  - 230kV = 40 points
  - 138kV = 30 points

- **Distance Bonus**: Closer features get bonus points
  - Within 1km = +30 points
  - Within 5km = +20 points
  - Within 10km = +10 points

- **Infrastructure Type**: 
  - Power plants = +35 points
  - Substations = +15-30 points
  - Transmission lines = +10 points

- **Named Infrastructure**: +10 points

To adjust scoring, modify the `calculate_strategic_score()` function in your script.

### Step 4: Adjust Filtering Thresholds

```python
# Strategic filtering parameters
STRATEGIC_SCORE_THRESHOLD = 25  # Only save features with score >= 25
MAX_FEATURES_PER_SITE = 5000    # Hard limit per site (performance)
```

**Recommendations:**
- **STRATEGIC_SCORE_THRESHOLD**: 
  - Lower (10-15) = More features, less selective
  - Higher (25-30) = Fewer features, more strategic
  - Features within 10km automatically use threshold of 10

- **MAX_FEATURES_PER_SITE**: 
  - 5000 = Good for 100-mile radius
  - 10000 = For very dense infrastructure areas
  - Higher values may impact map performance

### Step 5: Customize OSM Query (Optional)

The `build_query()` function constructs the Overpass API query. It prioritizes:

1. **TIER 1**: High-voltage transmission (345kV+)
2. **TIER 2**: Major substations (230kV)
3. **TIER 3**: Power plants and generators
4. **TIER 4**: Sub-transmission (138-161kV)
5. **TIER 5**: Named substations
6. **TIER 6**: Major water infrastructure
7. **TIER 7**: Other power infrastructure
8. **TIER 8**: Other water infrastructure

To customize what gets collected, modify the query tiers in `build_query()`.

### Step 6: Add Site Configuration

Add your site to `src/config/ncPowerSites.js`:

```javascript
{
  key: 'your_site_key',
  name: 'Your Site Name',
  shortName: 'Your Site',
  dataPath: '/osm/your_site_key.json',  // Must match output_key from Python script
  coordinates: { lat: 37.7749, lng: -122.4194 },
  radiusMeters: 25000,  // Display radius (25km) - can be different from collection radius
  color: '#3b82f6',
  highlightColor: '#60a5fa',
  description: 'Your site description'
}
```

**Important**: The `dataPath` must match the output filename from your Python script (without the `.json` extension in the path).

### Step 7: Add Geographic Configuration

Add your location to `src/config/geographicConfig.js`:

```javascript
your_site_key: {
  coordinates: { lat: 37.7749, lng: -122.4194 },
  city: 'Your City',
  state: 'CA',
  county: 'Your County',
  region: 'Your Region',
  gridOperator: 'CAISO',  // Or appropriate grid operator
  timezone: 'America/Los_Angeles',
  searchRadius: 25000,
  businessContext: 'Your site infrastructure analysis',
  dataCenterCompany: 'Your Company',
  facilityName: 'Your Facility Name'
}
```

### Step 8: Run the Script

```bash
cd scripts/osm-tools
python3 your_location_osm.py
```

The script will:
1. Query OSM via Overpass API
2. Calculate strategic scores for each feature
3. Filter features based on threshold
4. Generate GeoJSON file in `public/osm/your_site_key.json`

**Expected Output:**
```
[2025-01-XX XX:XX:XX UTC] 📦 Processing 1 sites
[2025-01-XX XX:XX:XX UTC] ⚙️  Strategic filtering: score >= 25, max 5000 features per site
[2025-01-XX XX:XX:XX UTC] 🔄 Fetching OSM data for Your Site Name (your_site_key)
[2025-01-XX XX:XX:XX UTC] 🧭 Building Overpass query for Your Site Name (radius 100.0 miles / 160.9 km)
[2025-01-XX XX:XX:XX UTC] ⏱️ Overpass request attempt 1/3 (timeout: 300s)
[2025-01-XX XX:XX:XX UTC] ✅ Overpass request succeeded.
[2025-01-XX XX:XX:XX UTC] 📦 Processing Overpass payload for your_site_key
[2025-01-XX XX:XX:XX UTC]    Raw elements: 1234
[2025-01-XX XX:XX:XX UTC]    Strategic scores: min=25.0, max=95.0, avg=42.5
[2025-01-XX XX:XX:XX UTC]    Strategic tiers: {'critical': 50, 'high': 200, 'medium': 300}
[2025-01-XX XX:XX:XX UTC] ✅ Wrote your_site_key.json: 550 strategic features, 2.3 MB, categories={'power': 400, 'water': 150}
```

### Step 9: Verify Output

Check that the GeoJSON file was created:

```bash
ls -lh public/osm/your_site_key.json
```

Verify the file structure:

```bash
python3 -c "import json; data = json.load(open('public/osm/your_site_key.json')); print(f'Features: {len(data[\"features\"])}'); print(f'Categories: {data[\"summary\"][\"categories\"]}')"
```

### Step 10: Test on Map

1. Start your development server
2. Navigate to the map
3. Select your location from the location selector
4. Click the green OSM button in the nested circle buttons
5. Verify that power lines, substations, and water features appear on the map

## Customization Examples

### Example 1: Data Center in California

```python
SITES = [
    {
        "key": "data_center_ca",
        "name": "Silicon Valley Data Center",
        "lat": 37.3875,
        "lon": -122.0575,
        "radius_m": 80467,  # 50 miles
        "note": "Silicon Valley data center - 50 mile radius",
        "output_key": "data_center_ca",
    },
]
```

### Example 2: Manufacturing Plant in Texas

```python
SITES = [
    {
        "key": "manufacturing_tx",
        "name": "Austin Manufacturing Plant",
        "lat": 30.2672,
        "lon": -97.7431,
        "radius_m": 40234,  # 25 miles
        "note": "Austin manufacturing - 25 mile radius",
        "output_key": "manufacturing_tx",
    },
]
```

## Troubleshooting

### Issue: No features returned

**Possible causes:**
1. Strategic threshold too high - lower `STRATEGIC_SCORE_THRESHOLD` to 10-15
2. OSM data sparse in area - check OSM website for coverage
3. Query too restrictive - review `build_query()` tiers

**Solution:**
```python
STRATEGIC_SCORE_THRESHOLD = 10  # Lower threshold
```

### Issue: Too many features (performance)

**Solution:**
```python
MAX_FEATURES_PER_SITE = 3000  # Reduce limit
STRATEGIC_SCORE_THRESHOLD = 30  # Increase threshold
```

### Issue: Overpass timeout

**Solution:**
- Use batching strategy (automatically enabled for radius > 50km)
- Reduce radius
- Simplify query (remove lower priority tiers)

### Issue: Features not showing on map

**Check:**
1. File exists in `public/osm/` with correct name
2. `dataPath` in `ncPowerSites.js` matches filename
3. Site key matches between config and script
4. Browser console for errors
5. GeoJSON structure is valid

## Advanced: Custom Scoring for Regional Patterns

Different regions may tag infrastructure differently. To adapt:

1. **Analyze OSM patterns** in your region:
   ```bash
   # Use test_osm_patterns.py as reference
   python3 scripts/osm-tools/test_osm_patterns.py
   ```

2. **Adjust switchyard recognition** in `calculate_strategic_score()`:
   ```python
   # Add regional patterns
   is_switchyard_pattern = any(pattern in name_lower for pattern in [
       " sub", "sub ", "substation", "switchyard",
       "your-regional-pattern"  # Add your patterns
   ])
   ```

3. **Update operator list** for your region:
   ```python
   if any(major in operator_lower for major in [
       "pjm", "constellation", "your-regional-operator"
   ]):
       score += 15
   ```

## Performance Considerations

### File Size Guidelines
- **< 5 MB**: Excellent performance
- **5-10 MB**: Good performance
- **10-20 MB**: Acceptable, may have slight delays
- **> 20 MB**: Consider reducing features or radius

### Feature Count Guidelines
- **< 1000 features**: Very fast loading
- **1000-3000 features**: Fast loading
- **3000-5000 features**: Good performance
- **> 5000 features**: May impact map performance

### Radius vs Performance Trade-offs
- **25 km (15 miles)**: ~500-1000 features, < 2 MB
- **50 km (30 miles)**: ~1500-3000 features, 3-5 MB
- **100 km (60 miles)**: ~3000-5000 features, 5-10 MB
- **100 miles (160 km)**: ~5000+ features, 10-20 MB

## Reference: Complete File Paths

### Python Scripts
- Main PA script: `scripts/osm-tools/pa_nuclear_datacenter_osm.py`
- Test script: `scripts/osm-tools/test_osm_patterns.py`
- NC Power script (reference): `scripts/osm-tools/nc_power_utility_osm.py`

### Configuration
- Site config: `src/config/ncPowerSites.js`
- Geographic config: `src/config/geographicConfig.js`

### Frontend Components
- OSM loader: `src/components/Map/components/Cards/OSMCallCached.jsx`
- Loading card: `src/components/Map/components/Cards/LoadingCard.jsx`
- Nested buttons: `src/components/Map/components/Cards/NestedCircleButton.jsx`

### Backend
- MCP API: `server.js` (POST `/api/mcp/search`)

### Output Directory
- GeoJSON cache: `public/osm/*.json`

## Next Steps

After setting up your script:

1. **Run the script** to generate initial data
2. **Test on map** to verify features appear correctly
3. **Adjust scoring** if needed based on what appears
4. **Iterate** on radius and thresholds to optimize
5. **Document** any regional OSM tagging patterns you discover

For questions or issues, refer to the PA nuclear script as a working reference implementation.

