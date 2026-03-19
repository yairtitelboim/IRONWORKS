# Pinal County OSM Analysis - Modular Refactor

This refactor splits the previous monolithic `OSMCall.jsx` into focused modules. Behavior is unchanged; the code is easier to read, test, and evolve.

## Modules

- `src/config/pinalConfig.js`
  - `PINAL_ZONES`, `CACHE_KEY`, `CACHE_DURATION`.
- `src/utils/pinalMapUtils.js`
  - Geometry + scoring: `generateCircleCoordinates`, `calculateDistance`, `calculateCentroid`,
    `calculateDevelopmentScore`, `calculateAccessibilityScore`, `calculatePinalMetrics`.
- `src/utils/overpassQueries.js`
  - Overpass builders: `buildPinalBoundaryQuery`, `buildZoneInfrastructureQuery(zone)`.
- `src/utils/overpassClient.js`
  - `fetchOverpassJSON(query, options)` with multi-endpoint + retry.
  - Timestamped logs for request lifecycle.
- `src/utils/pinalAnalysis.js`
  - Orchestrates data fetching and processing:
    - `fetchPinalBoundary()`
    - `fetchZoneInfrastructure()`
    - `runPinalAnalysis()` → returns `{ features, summary, pinal_insights, zones_queried, zone_results, boundary, timestamp }`.
  - Precise timestamped console logs for each step.
- `src/components/Map/layers/pinalLayers.js`
  - Mapbox layer helpers: `removePinalLayers`, `addPinalCountyBoundaryToMap`, `addPinalInfrastructureToMap`.
- `src/components/Map/popups/pinalPopups.js`
  - HTML templates for popups: `analyzingPopup`, `analysisCompletePopup`, `zonePopup`.

## Intended Component Flow (OSMCall.jsx)

1. User clicks the Pinal button.
2. UI sets loading → shows analyzing popup (`analyzingPopup`).
3. Analysis pipeline runs:
   - `fetchPinalBoundary()` (Overpass → GeoJSON)
   - `fetchZoneInfrastructure()` (Overpass per zone)
   - `calculatePinalMetrics(features)` and build summaries/insights
4. Map update:
   - `addPinalCountyBoundaryToMap(map, boundary)` (if found)
   - `addPinalInfrastructureToMap(map, features)`
5. Emit `pinal:analysisComplete` + `osm:dataLoaded` to event bus.
6. UI popup switches to `analysisCompletePopup` with counts.

## Console Log Contract (timestamped)
All logs are prefixed with ISO timestamps for sequencing:

- Overpass client
  - `[YYYY-MM-DDTHH:mm:ss.sssZ] Overpass POST start (endpoint) attempt N`
  - `[...Z] Overpass POST success (endpoint)`
  - `[...Z] Overpass POST failed (endpoint) - <message>`
- Analysis pipeline
  - `[...Z] Analysis: start`
  - `[...Z] Boundary: build query` → `Boundary: overpass response received` → `Boundary: processed into GeoJSON`
  - `[...Z] Zone <Name>: build query` → `Zone <Name>: received <N> elements` → `Zone <Name>: produced <N> features`
  - `[...Z] Zones total features: <N>`
  - `[...Z] Analysis: results ready`

These logs allow you to correlate user interaction → network → processing → map rendering in near real-time.

## Next Wiring Step (in `OSMCall.jsx`)
- Replace inline Overpass + processing with calls to:
  - `runPinalAnalysis()` → get `results`
  - `addPinalCountyBoundaryToMap(map.current, results.boundary)`
  - `addPinalInfrastructureToMap(map.current, results.features)`
  - Use `analyzingPopup(...)` and `analysisCompletePopup(...)` for popups.

Keep the component focused on UI and event orchestration; leave data and rendering details to the modules above.


