# Plan: Ask Anything → Location Search Flow

## Goal
Replace the current Claude-based "Ask Anything" flow with a **location/address search** flow:
1. User types an address or location name
2. Geocode the query → get coordinates
3. Map navigates (flyTo) to that location
4. Response card shows location info (no Claude API)

---

## Current State

### AskAnythingInput.jsx
- Calls `onSubmit({ id: 'custom_question', text, query, isCustom: true })` with user input
- No distinction between "location search" vs "AI question"

### useAIQuery (handleAIQuery)
- Receives all custom queries
- Sends to Claude API → errors when Claude fails or is unavailable
- Has `map` ref for flyTo
- Has `addResponse` (via setResponses) - can add responses directly
- Has `manualResponse` path - can add response without Claude

### Geocoding
- `geocodeSites.js` has `geocodeWithNominatim` (private) - OSM Nominatim, free
- `REACT_APP_MAPBOX_ACCESS_TOKEN` available - Mapbox Geocoding API option
- Nominatim: `https://nominatim.openstreetmap.org/search?q=...&format=json`

---

## Implementation Plan

### Phase 1: Geocoding Utility

**Option A: Add to geocodeSites.js**
- Export `geocodeQuery(query: string): Promise<{ lat, lng, displayName } | null>`
- Reuse Nominatim logic (no API key needed)
- Add `countrycodes=us` for US bias (or omit for global)

**Option B: Mapbox Geocoding**
- Use `https://api.mapbox.com/geocoding/v5/mapbox.places/{encodeURIComponent(query)}.json?access_token=...`
- Better for addresses (Mapbox uses same data as map)
- Requires token (already in env)

**Recommendation:** Start with Nominatim (free, no new deps). Add Mapbox fallback later if needed.

**New file or function:**
```js
// src/utils/geocodeQuery.js
export async function geocodeQuery(query) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('q', query.trim());
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');
  const resp = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  const json = await resp.json();
  if (!json?.length) return null;
  const top = json[0];
  return { lat: parseFloat(top.lat), lng: parseFloat(top.lon), displayName: top.display_name };
}
```

---

### Phase 2: Location Search Handler in useAIQuery

**In `handleAIQuery`**, add early branch for custom location queries:

```js
// At start of handleAIQuery, after queryId setup:
if (questionData.isCustom && questionData.query) {
  const query = String(questionData.query).trim();
  // Treat all custom queries as location search (user can type address or place name)
  const locationResult = await handleLocationSearch(query);
  if (locationResult) return; // Success: geocoded, flew, added response
  // Fallback: show "Location not found" response
}
```

**New function `handleLocationSearch`** (inside useAIQuery or extracted):
1. Call `geocodeQuery(query)`
2. If no result → `addResponse` with "Location not found" message, return false
3. If result → `map.current.flyTo({ center: [lng, lat], zoom: 14, duration: 1000 })`
4. `addResponse` with location card:
   - `responseType: 'location_search'`
   - Content: display name, coordinates, formatted address
   - Optional: if in Texas, check if point falls in ERCOT county → include county info

---

### Phase 3: Response Card for Location Search

**In AIResponseDisplayRefactored.jsx:**
- Add `location_search` response type (similar to `texas_data_center_detail`, `ercot_county_detail`)
- Header: `{displayName}` or "Location"
- Body: coordinates, formatted address
- Optional: if coordinates in Texas, emit `ercot-county:map-selected` or query ERCOT county at point → show county data in same card

**Response shape:**
```js
addResponse({
  response: `**${displayName}**\n\n${lat.toFixed(4)}, ${lng.toFixed(4)}`,
  content: content,
  query: `Location: ${query}`,
  citations: [],
  isLoading: false,
  metadata: {
    responseType: 'location_search',
    source: 'ask-anything',
    coordinates: [lng, lat],
    displayName,
    timestamp: Date.now()
  }
});
```

---

### Phase 4: AskAnythingInput UX (Optional)

- Update placeholder: "Search address or location..."
- No change to submit flow—still calls `onSubmit` with same shape
- `handleAIQuery` routes all custom queries to location search (no Claude)

---

## File Changes Summary

| File | Changes |
|------|---------|
| `src/utils/geocodeQuery.js` | **New** – geocodeQuery(query) using Nominatim |
| `src/hooks/useAIQuery.js` | Add handleLocationSearch; call it for custom queries before Claude |
| `src/components/Map/components/Cards/AIResponseDisplayRefactored.jsx` | Add `location_search` header/body rendering |
| `src/components/Map/components/Cards/AskAnythingInput.jsx` | Optional: placeholder text |

---

## Edge Cases

1. **Empty query** – Already handled by AskAnythingInput (checks `inputValue.trim()`)
2. **Geocode fails** – Show "Location not found. Try a different address or place name."
3. **Map not ready** – Check `map?.current` before flyTo
4. **Texas + ERCOT** – Optional: if point in Texas, load ERCOT counties GeoJSON, check point-in-polygon, add county info to response

---

## Testing Checklist

- [ ] Type "Austin, TX" → map flies to Austin, card shows location
- [ ] Type "123 Main St, Dallas" → geocodes, flies, shows address
- [ ] Type "Whitney, Texas" → flies to Whitney
- [ ] Type "xyz invalid" → "Location not found" in card
- [ ] No Claude API calls for custom queries
- [ ] Skeleton buffer (1s) still works for location responses

---

## Rollback

If issues arise:
1. Remove `handleLocationSearch` branch from handleAIQuery
2. Revert to Claude for custom queries (or show "Location search coming soon")
3. Delete `geocodeQuery.js` if unused
