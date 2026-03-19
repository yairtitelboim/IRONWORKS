# MCP Infrastructure Search - Testing Guide

This guide walks you through testing the MCP Infrastructure Search feature step-by-step.

---

## Prerequisites

1. **Dependencies installed**: Run `npm install` if you haven't already
2. **OSM Data Files**: Ensure you have OSM cache files in `public/osm/` for at least one facility (e.g., `nc_power_tsmc_phoenix.json`)
3. **Server Port**: Make sure port 3001 is available for the Express server

---

## Step 1: Start the Backend Server

Open a terminal and start the Express server:

```bash
cd /Users/yairtitelboim/Documents/Kernel/ALLAPPS/NC
node server.js
```

You should see:
```
Proxy server running on http://localhost:3001
Claude API Key exists: true/false
```

**Keep this terminal open** - the server needs to stay running.

---

## Step 2: Start the React App

Open a **second terminal** and start the React development server:

```bash
cd /Users/yairtitelboim/Documents/Kernel/ALLAPPS/NC
npm start
```

The app should open in your browser at `http://localhost:3000`

---

## Step 3: Access the MCP Search Feature

1. **Wait for the map to load** in your browser
2. **Look for the nested circle button** (usually in the bottom-right or center of the map)
3. **Click the main button** to expand the tool options
4. **Find the purple "🔍" button** - this is the MCP Infrastructure Search button
5. **Click the purple button** - the MCP Chat Panel should appear on the right side

---

## Step 4: Test Basic Search Queries

### Test 1: Simple Query
Type in the search box:
```
substations near TSMC
```

**Expected Results:**
- ✅ Query appears in message history
- ✅ System responds with result count
- ✅ Purple markers appear on map
- ✅ Purple circle shows search radius
- ✅ Map auto-fits to show results
- ✅ Summary statistics appear below messages

### Test 2: Query with Radius
Type:
```
water infrastructure within 10km of Intel
```

**Expected Results:**
- ✅ Parses "10km" correctly
- ✅ Shows larger search radius circle
- ✅ Returns water-related infrastructure
- ✅ Statistics show average distances

### Test 3: Category-Specific Query
Type:
```
pipelines near Amkor
```

**Expected Results:**
- ✅ Filters to pipeline category
- ✅ Shows only pipeline features
- ✅ Category breakdown in statistics

---

## Step 5: Test Interactive Features

### Test Markers
1. **Click on a purple marker** on the map
2. **Verify popup appears** with:
   - Feature name
   - Category
   - Distance (km and meters)
   - Additional properties (if available)

### Test Message History
1. **Run multiple queries** (try 3-4 different searches)
2. **Scroll through message history** - should see all queries and responses
3. **Check timestamps** - each message should have a time
4. **Click "Clear" button** - history should reset

### Test Statistics
1. **After a search**, check the Summary Statistics panel
2. **Verify numbers**:
   - Total Results matches marker count
   - Average/Min/Max distances are reasonable
   - Category breakdown shows correct counts

### Test Export
1. **Run a search** that returns results
2. **Click "📥 GeoJSON" button** in statistics panel
3. **Verify file downloads** as `mcp-search-results-[timestamp].geojson`
4. **Click "📥 CSV" button**
5. **Verify file downloads** as `mcp-search-results-[timestamp].csv`
6. **Open CSV in Excel/Sheets** - verify data is correct

---

## Step 6: Test Error Handling

### Test Invalid Facility
Type:
```
substations near UnknownFacility
```

**Expected Results:**
- ✅ Error message appears: "No matching facility found"
- ✅ Error shown in message history (red styling)
- ✅ No markers appear on map

### Test Empty Query
1. **Leave search box empty**
2. **Click Search button**
3. **Button should be disabled** (grayed out)

### Test Network Error
1. **Stop the server** (Ctrl+C in server terminal)
2. **Try a search**
3. **Should show error message** about connection failure

---

## Step 7: Test Quick Actions

1. **Click "Substations near TSMC"** quick action button
2. **Should auto-fill and submit** the query
3. **Try other quick actions** - they should all work

---

## Step 8: Test Map Integration

### Test Radius Circle
1. **Run a search** with a specific radius (e.g., "within 5km")
2. **Verify purple circle** appears on map showing search area
3. **Circle should be semi-transparent** with dashed border

### Test Auto-Fit
1. **Run a search**
2. **Map should automatically zoom/pan** to show all results
3. **All markers should be visible** in viewport

### Test Marker Cleanup
1. **Run a search** - markers appear
2. **Run another search** - previous markers should be removed
3. **Only new markers** should be visible

---

## Troubleshooting

### Issue: "No results found"
**Possible Causes:**
- OSM cache file doesn't exist for that facility
- No infrastructure in that category/radius
- Facility name not recognized

**Solution:**
- Check `public/osm/` folder for facility data files
- Try a different facility (TSMC, Intel, Amkor are good test cases)
- Try a larger radius

### Issue: "Connection failed" or "Network error"
**Possible Causes:**
- Server not running on port 3001
- CORS issues
- Wrong API URL

**Solution:**
- Verify server is running: `curl http://localhost:3001/health`
- Check server terminal for errors
- Verify `MCPChatPanel.jsx` has correct API URL (`http://localhost:3001/api/mcp/search`)

### Issue: Markers not appearing
**Possible Causes:**
- `MCPSearchResults` component not mounted
- Event bus not working
- Map not initialized

**Solution:**
- Check browser console for errors
- Verify `MCPSearchResults` is imported in `Map/index.jsx`
- Check that `window.mapEventBus` exists (should be initialized in Map component)

### Issue: Query not parsing correctly
**Possible Causes:**
- Facility name not in `ncPowerSites.js`
- Query format not recognized

**Solution:**
- Check `src/config/ncPowerSites.js` for available facilities
- Try exact facility names: "TSMC", "Intel", "Amkor"
- Use format: "[category] near [facility]" or "[category] within [radius] of [facility]"

---

## Expected Console Logs

When testing, you should see these logs in the browser console:

```
🔍 MCP Search query: { facilityName: "...", facilityKey: "...", radius: 5000, ... }
✅ MCP Search results: { type: 'FeatureCollection', features: [...], summary: {...} }
🗺️ MCPSearchResults: Received search results
✅ MCPSearchResults: Added X markers
```

And in the server terminal:

```
🔍 MCP Search: { facilityKey: "...", radius: 5000, category: "...", dataPath: "..." }
✅ MCP Search results: { total: X, withinRadius: Y, category: "..." }
```

---

## Test Checklist

- [ ] Server starts without errors
- [ ] React app loads map successfully
- [ ] MCP button appears in nested circle button group
- [ ] Chat panel opens when button clicked
- [ ] Basic query works: "substations near TSMC"
- [ ] Radius parsing works: "within 10km"
- [ ] Category filtering works: "water infrastructure"
- [ ] Markers appear on map
- [ ] Radius circle displays
- [ ] Map auto-fits to results
- [ ] Popup cards show correct details
- [ ] Message history saves queries/responses
- [ ] Statistics calculate correctly
- [ ] GeoJSON export works
- [ ] CSV export works
- [ ] Error handling works (invalid facility)
- [ ] Quick actions work
- [ ] Clear history works
- [ ] Multiple searches don't conflict

---

## Quick Test Commands

If you want to test the API directly:

```bash
# Test API endpoint
curl -X POST http://localhost:3001/api/mcp/search \
  -H "Content-Type: application/json" \
  -d '{
    "facilityKey": "tsmc_phoenix",
    "radius": 5000,
    "category": "substation"
  }'
```

Should return GeoJSON with features array.

---

## Next Steps After Testing

Once testing is complete:
1. **Report any bugs** or issues found
2. **Note performance** - are queries fast enough?
3. **Check data accuracy** - are results correct?
4. **Test edge cases** - very large radius, no results, etc.
5. **Gather feedback** - is the UI intuitive?

---

## Need Help?

If something doesn't work:
1. Check browser console for errors (F12 → Console)
2. Check server terminal for errors
3. Verify all files are saved
4. Try restarting both server and React app
5. Check that OSM data files exist in `public/osm/`

