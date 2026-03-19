# TSMC Phoenix OSM Integration Summary

## Changes Made

### 1. Python Script Update
**File**: `scripts/osm-tools/nc_power_utility_osm.py`

Added two TSMC Phoenix sites:
- `tsmc_phoenix`: Main fab complex (15km radius)
- `tsmc_phoenix_water`: Water infrastructure zone (12km radius)

These will generate JSON files:
- `/public/osm/nc_power_tsmc_phoenix.json`
- `/public/osm/nc_power_tsmc_phoenix_water.json`

### 2. Site Configuration Update
**File**: `src/config/ncPowerSites.js`

Added TSMC Phoenix sites to `NC_POWER_SITES` array:
- `tsmc_phoenix`: Main fab complex (blue theme)
- `tsmc_phoenix_water`: Water infrastructure (cyan theme)

### 3. OSM Button Integration
**File**: `src/components/Map/components/Cards/OSMCall.jsx`

- Added import for `TSMC_PHOENIX_SITES`
- Conditionally uses TSMC sites when `locationKey === 'tsmc_phoenix'` or `'tsmc_phoenix_water'`
- Blue/purple marker styling for TSMC sites (vs red for other locations)
- Uses `'tsmc-phoenix'` formatter for popups

### 4. Location Theme
**File**: `src/components/Map/components/Cards/NestedCircleButton.jsx`

Added location themes:
- `tsmc_phoenix`: Blue theme (#3b82f6)
- `tsmc_phoenix_water`: Cyan theme (#06b6d4)

### 5. Site Data File
**File**: `src/data/tsmcPhoenixSites.js`

Created with 6 key sites:
1. TSMC Arizona Fab Complex (main site)
2. Phoenix Water Allocation
3. TSMC Water Reclamation Plant
4. APS Transmission Hub
5. Loop 303 Corridor
6. I-10 Corridor

## How It Works

1. **Python Script**: Run `python scripts/osm-tools/nc_power_utility_osm.py` to generate OSM JSON files
2. **Location Selection**: When user selects `tsmc_phoenix` location, OSM button will:
   - Load TSMC Phoenix OSM infrastructure data
   - Display TSMC Phoenix sites as blue markers
   - Show water, power, and transportation infrastructure
3. **Markers**: Blue circular markers (26px) for TSMC sites
4. **Popups**: Custom `tsmc-phoenix` formatter (needs implementation)

## Next Steps

1. **Run Python Script**: Generate OSM JSON files
   ```bash
   python scripts/osm-tools/nc_power_utility_osm.py
   ```

2. **Verify Location Key**: Ensure `tsmc_phoenix` is available in location selector
   - Should appear in `getAvailableLocations()` from `geographicConfig.js`

3. **Create Popup Formatter**: Add `tsmc-phoenix` formatter to `MarkerPopupCard.jsx` to display:
   - Investment amounts
   - Water demand metrics
   - Construction status
   - Operational dates

4. **Test**: 
   - Select TSMC Phoenix location
   - Click OSM button
   - Verify markers appear
   - Check popups display correctly

## Key Data Points to Display

- **Investment**: $165B total (started $12B in 2020)
- **Status**: Largest foreign greenfield investment in U.S. history
- **Fabs**: 3 fabs total
- **Water Demand**: 17.2M gallons/day when complete
- **Current**: 4.75M gallons/day (Fab 1)
- **Gap**: 5.8M gallons/day shortfall
- **Reclamation Plant**: $1B+, 15 acres, operational 2028, 90% recycling
- **Remaining Demand**: 1.72M gallons/day from municipal supply

