# Texas data center – tracked bugs and fixes

## Laptop: second card shows "Unknown Project" (fixed)

**Symptom:** On laptop only, clicking a Texas data center marker showed two cards: the main LocationSearchCard (correct) and a second card (Mapbox popup) that always showed "Unknown Project".

**Cause:** The popup and some event payloads used `props.project_name`, but the GeoJSON / master list schema uses `company` (and optionally `city`), not `project_name`. So the fallback "Unknown Project" was always used.

**Fix (2026-03-07):** In `TexasDataCentersLayer.jsx`:

- Added `getProjectDisplayName(props)` that returns `project_name || company || name || city || 'Unknown Project'`.
- Popup title and markdown formatter now use this helper.
- All `data-center:selected`, `__lastTexasDataCenterPowerCircle`, `animateClickPulse`, and analytics `query_text` now use `getProjectDisplayName(props)` so the "second card" (popup) and any dependent UI show the correct name (e.g. company).

**Note:** On mobile, marker click opens the LocationSearchCard only (no popup). On desktop, both the sidebar LocationSearchCard and the map popup are shown; both now use the same display name.

---

## CLUSTER MAP count not updating when user changes power circle radius (fixed)

**Symptom:** The first card in Opposition ("CLUSTER MAP") should show the number of data center markers inside the power circle radius. When the user changes the circle dynamically (drags the radius handle on the map), the count did not update.

**Cause:** `power-circle:radius-changed` is emitted by PowerCircleLayer when the user drags the handle. LocationSearchCard's handler only updated `powerCircleRadiusMiles` when the event's center matched the *card's* (lng, lat)—i.e. the search location. When the circle is centered on a *marker* (after clicking a data center), the circle center is the marker, not the search address, so the match failed and `powerCircleRadiusMiles` was never updated. Thus `oppositionCircleStats` (which drives CLUSTER MAP's count) did not recompute with the new radius.

**Fix (2026-03-07):** In LocationSearchCard's `handleRadiusChanged`, accept the event when the emitted center matches *either* the card center (search location) *or* the current power circle center (`window.__lastTexasDataCenterPowerCircle.center` or `lastSelectedMarkerCenterRef.current.center`). Then `setPowerCircleRadiusMiles(Number(data.radius))` runs when the user resizes the circle regardless of whether the circle is centered on the search point or the selected marker, and the CLUSTER MAP count updates.
