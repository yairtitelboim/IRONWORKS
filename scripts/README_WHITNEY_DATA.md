# Whitney Infrastructure Data Download System

This system provides a way to download Whitney, TX infrastructure data from OpenStreetMap and cache it locally for faster loading in the React application.

## Files Created

### 1. `scripts/download_whitney_data.js`
A Node.js script that mimics the OSMCall.jsx functionality to download Whitney infrastructure data from OpenStreetMap and save it to the public folder.

**Features:**
- Queries all Whitney zones (Data Center, Downtown, Lake Whitney)
- Queries major highway corridors
- Includes dedicated power facility search
- Processes OSM elements into GeoJSON features
- Saves data to `public/whitney-cache.json`

### 2. `src/components/Map/components/Cards/OSMCallCached.jsx`
A React component that loads Whitney infrastructure data from the cached JSON file instead of making live API calls.

**Features:**
- Loads data from `public/whitney-cache.json`
- Creates power facility markers (with test markers if none found)
- Displays all infrastructure features on the map
- Includes zone circles and animations
- Much faster than live API calls

### 3. Updated `NestedCircleButton.jsx`
Modified to use `OSMCallCached` instead of `OSMCall` for Whitney analysis.

## Usage

### 1. Download Whitney Data
Run the download script to fetch and cache Whitney infrastructure data:

```bash
npm run download-whitney
```

This will:
- Query OpenStreetMap for Whitney infrastructure
- Process the data into GeoJSON format
- Save it to `public/whitney-cache.json`
- Show progress and statistics

### 2. Use Cached Data
The React application will automatically load the cached data when you click the Whitney Infrastructure Analysis button.

## Data Structure

The cached data includes:

```json
{
  "features": [...], // Array of GeoJSON features
  "timestamp": 1234567890,
  "zones_queried": ["data_center", "downtown", "lake_whitney"],
  "zone_results": {...},
  "summary": {
    "office_building": 5,
    "commercial_building": 12,
    "power_facility": 8,
    // ... other categories
  },
  "whitney_insights": {
    "data_center_proximity": 15,
    "downtown_proximity": 23,
    "total_commercial_development": 17,
    // ... other insights
  }
}
```

## Power Facility Markers

The system includes special handling for power facilities:

- **Real Power Facilities**: If found in OSM data, creates orange lightning bolt markers
- **Test Markers**: If no real power facilities found, creates 2 test markers for demonstration
- **Interactive**: Click any power marker to see detailed information
- **Animated**: Markers appear with staggered animation

## Benefits

1. **Faster Loading**: No need to wait for live API calls
2. **Reliable**: Works even if Overpass API is slow or unavailable
3. **Consistent**: Same data every time, no API rate limits
4. **Offline Capable**: Works without internet connection
5. **Power Markers**: Guaranteed power facility visualization

## Updating Data

To refresh the Whitney data with latest OSM information:

1. Run `npm run download-whitney` again
2. The new data will be saved to `public/whitney-cache.json`
3. Refresh the React application to use the updated data

## Troubleshooting

### No Power Markers Appearing
- Check console logs for power facility detection
- Test markers should appear if no real power facilities found
- Verify the cached data includes power facilities

### Data Not Loading
- Ensure `public/whitney-cache.json` exists
- Check browser console for fetch errors
- Verify the JSON file is valid

### Performance Issues
- The cached version should be much faster than live API calls
- If still slow, check for large datasets or complex map rendering

## Development

To modify the data download:

1. Edit `scripts/download_whitney_data.js`
2. Modify the OSM queries or processing logic
3. Run `npm run download-whitney` to test changes
4. Update `OSMCallCached.jsx` if needed for new data structure


