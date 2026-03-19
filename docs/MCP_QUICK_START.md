# MCP Infrastructure Search - Quick Start Guide

## 🚀 Quick Start (3 Steps)

### Step 1: Start the Server
```bash
# Terminal 1
cd /Users/yairtitelboim/Documents/Kernel/ALLAPPS/NC
node server.js
```
**Wait for:** `Proxy server running on http://localhost:3001`

### Step 2: Start the React App
```bash
# Terminal 2 (new terminal window)
cd /Users/yairtitelboim/Documents/Kernel/ALLAPPS/NC
npm start
```
**Wait for:** Browser opens at `http://localhost:3000`

### Step 3: Find and Click the MCP Button
1. **Wait for map to load**
2. **Look for the nested circle button** (usually bottom-right or center of map)
3. **Click it** to expand tool options
4. **Find the purple 🔍 button** (5th button, after Perplexity)
5. **Click the purple button** → Chat panel opens on right side

---

## 🧪 First Test Query

Type this in the search box:
```
substations near TSMC
```

**What should happen:**
- ✅ Message appears in chat history
- ✅ System responds with result count
- ✅ Purple markers appear on map
- ✅ Purple circle shows search radius
- ✅ Map zooms to show results
- ✅ Statistics panel appears below

---

## 📋 Test Queries to Try

| Query | What It Tests |
|-------|---------------|
| `substations near TSMC` | Basic search, facility recognition |
| `water infrastructure within 10km of Intel` | Radius parsing, category filtering |
| `pipelines near Amkor` | Category-specific search |
| `power lines within 5km of TSMC` | Different category, smaller radius |
| `substations near UnknownFacility` | Error handling |

---

## 🎯 What to Look For

### ✅ Success Indicators:
- **Chat Panel**: Opens on right side, purple theme
- **Message History**: Shows your query + system response
- **Map Markers**: Purple dots appear on map
- **Radius Circle**: Semi-transparent purple circle
- **Statistics**: Shows total count, distances, categories
- **Export Buttons**: GeoJSON and CSV buttons in stats panel

### ❌ Common Issues:
- **"Connection failed"** → Server not running (check Terminal 1)
- **"No matching facility"** → Try: TSMC, Intel, Amkor (exact names)
- **No markers appear** → Check browser console (F12) for errors
- **Button not visible** → Map might not be fully loaded, wait a few seconds

---

## 🔧 Quick Troubleshooting

### Server Not Running?
```bash
# Check if port 3001 is in use
lsof -i :3001

# If server crashed, restart it
node server.js
```

### React App Not Loading?
```bash
# Check if port 3000 is in use
lsof -i :3000

# Restart React app
npm start
```

### Test API Directly
```bash
# Test if API works
curl -X POST http://localhost:3001/api/mcp/search \
  -H "Content-Type: application/json" \
  -d '{"facilityKey": "tsmc_phoenix", "radius": 5000}'
```

---

## 📸 Visual Guide

### Finding the Button:
```
Map View
┌─────────────────────────────────┐
│                                 │
│         [Map Content]           │
│                                 │
│                    ┌─────────┐ │
│                    │  Main    │ │ ← Click this first
│                    │  Button  │ │
│                    └─────────┘ │
│                         │       │
│                    ┌────┴────┐ │
│                    │  OSM    │ │
│                    │  GeoAI  │ │
│                    │ Firecrawl│ │
│                    │Perplexity│ │
│                    │   🔍    │ │ ← Then click this purple one!
│                    └─────────┘ │
└─────────────────────────────────┘
```

### Chat Panel Location:
```
┌─────────────────────────────────┐
│  Map                            │
│                                 │
│                    ┌──────────┐ │
│                    │  🔍      │ │ ← Chat Panel
│                    │  Search  │ │   (Right side)
│                    │          │ │
│                    │  Query:  │ │
│                    │  [____]  │ │
│                    │          │ │
│                    │  History │ │
│                    │  Stats   │ │
│                    └──────────┘ │
└─────────────────────────────────┘
```

---

## 🎓 Testing Checklist

Run through these in order:

- [ ] Server starts (`node server.js`)
- [ ] React app starts (`npm start`)
- [ ] Map loads in browser
- [ ] Nested circle button is visible
- [ ] Can expand button group
- [ ] Purple 🔍 button is visible
- [ ] Chat panel opens when clicked
- [ ] Can type in search box
- [ ] "substations near TSMC" returns results
- [ ] Markers appear on map
- [ ] Can click markers to see popups
- [ ] Statistics show correct numbers
- [ ] Export buttons work (GeoJSON & CSV)
- [ ] Message history saves queries
- [ ] Clear button resets history

---

## 💡 Pro Tips

1. **Start with TSMC** - It has the largest dataset (59MB), so most likely to have results
2. **Use exact facility names**: TSMC, Intel, Amkor (not "TSMC Phoenix" in query)
3. **Check browser console** (F12) if something doesn't work - errors will show there
4. **Try different radii**: 5km, 10km, 20km to see different result sets
5. **Export results** to verify data quality

---

## 🐛 Still Having Issues?

1. **Check browser console** (F12 → Console tab) for JavaScript errors
2. **Check server terminal** for API errors
3. **Verify OSM files exist**: `ls public/osm/nc_power_*.json`
4. **Run test script**: `./test-mcp.sh`
5. **Check network tab** (F12 → Network) to see if API calls are being made

---

## 📚 Full Documentation

For detailed testing instructions, see: `docs/MCP_TESTING_GUIDE.md`
For implementation details, see: `docs/MCP_INFRASTRUCTURE_SEARCH_PLAN.md`

