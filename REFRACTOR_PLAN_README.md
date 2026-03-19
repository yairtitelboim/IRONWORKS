## Map + AI Refactor Plan

High‑level plan to make the map + AI stack easier to evolve without breaking complex interactions.

### 1. State Architecture & Ownership

- [ ] **Define shared state modules/contexts**
  - [ ] Create `AIInteractionState` (current provider, view mode, responses, Perplexity mode, marker details, cache stats).
  - [ ] Create `SceneState` (current scene id, saved scenes, active workflow).
  - [ ] Create `LayerState` (infra, NC power, routes, isochrones, TSMC/CyrusOne markers, etc.).
- [ ] **Refactor consumers to use shared state**
  - [ ] Update `BaseCard` to read/write AI state via context instead of local islands of state.
  - [ ] Update `AITransmissionNav` to use `SceneState` and `LayerState` instead of mixing in `window.mapComponent` and ad‑hoc props.
  - [ ] Update `LayerToggle` to act as a pure UI over `LayerState` (no direct Mapbox paint/layout logic).

### 2. Event Bus & Global Services

- [ ] **Centralize `mapEventBus` usage**
  - [ ] Create a `mapBus.ts` (or similar) module that wraps `window.mapEventBus` with typed events.
  - [ ] Replace direct `.on/.emit` usage in components with helpers from this module.
- [ ] **Remove ad‑hoc globals**
  - [ ] Replace `window.nodeAnimation` with a `NodeAnimationService` provided via context.
  - [ ] Replace `window.mapComponent.transmissionNav` / `.cards` with explicit APIs exposed from a central map controller.

### 3. BaseCard Decomposition

- [ ] **Extract behavior hooks from `BaseCard.jsx`**
  - [ ] `useSiteAnimations(map, updateToolFeedback, currentLocation)` – handles NC site datasets, overlays, and feedback.
  - [ ] `useMarkerSelection(map, nodeAnimation)` – centralize marker click, MCP marker handling, and legend/table sync.
  - [ ] `useResponseCacheAutoClear()` – encapsulate cache stats polling and auto‑clear countdown.
  - [ ] `useCardDrag(refs, isPerplexityMode)` – own the drag lifecycle (mousedown/move/up, `userSelect` changes).
- [ ] **Keep `BaseCard` as layout + wiring only**
  - [ ] Route props from hooks into `AIQuestionsSection`, `NestedCircleButton`, `LegendContainer`, and animations.

### 4. Tool / Backend Orchestration (OSM, MCP, Perplexity, SERP)

- [ ] **Introduce service layer for tools**
  - [ ] Create `mcpClient` with `searchInfrastructure(params)` used by quick actions in `AIResponseDisplayRefactored`.
  - [ ] Create `osmWhitneyService` for `OSMCall` (boundary fetch, infra fetch, map layer updates).
  - [ ] Create `perplexityService` / `startupEcosystemService` that encapsulate how `window.lastPerplexityAnalysisData` and `window.lastStartupEcosystemData` are populated.
- [ ] **Refactor components to be dumb about networking**
  - [ ] `AIResponseDisplayRefactored` should call injected callbacks (`onQuickAction`) instead of `fetch('http://localhost:3001/...')` directly.
  - [ ] `OSMCall` should invoke service methods and receive progress/summary via callbacks.
  - [ ] Move hard‑coded URLs into an `apiConfig`.

### 5. Map Style & Layer Control

- [ ] **Extract Mapbox style manipulation**
  - [ ] Create `mapStyleController` (`setRoadsEmphasis`, `setParksVisibility`, `setNcPowerVisibility`, `setGridHeatmapVisibility`, etc.).
  - [ ] Move all direct `setPaintProperty`, `setLayoutProperty`, `setFilter`, `moveLayer` calls out of `LayerToggle.jsx` into this module.
- [ ] **Connect LayerState → map effects**
  - [ ] Add `useLayerStateToMapEffects(map, layerState)` hook that calls `mapStyleController` functions in reaction to state changes.
  - [ ] Keep `LayerToggle` focused on toggles/UX only.

### 6. Animation System Consolidation

- [ ] **Create a shared animation theme**
  - [ ] Move keyframes (card slide‑in, skeleton shimmer, MCP halo, workflow morphing, etc.) into a single CSS module or design‑tokens file.
  - [ ] Replace inline `<style>` strings in `BaseCard`, `AIResponseDisplayRefactored`, and `AITransmissionNav` with classes from this theme.
- [ ] **Centralize animation policy**
  - [ ] Implement `useAnimationPolicy()` that reads reduced‑motion and performance data once.
  - [ ] Use that hook to toggle high‑cost effects in `AITransmissionNav`, `TableAnimationManager`, and node animations, instead of each component making its own decision.

### 7. Domain Data Mappers (Tables, Legend, Perplexity)

- [ ] **Introduce explicit mappers for table/legend rows**
  - [ ] `perplexityToNodes(analysisData)`, `serpToProperties(features)`, `osmInfraToNodes(geojson)`, etc.
  - [ ] Have `AIResponseDisplayRefactored` and `LegendContainer` depend on these mappers via imports/props, not `window.*`.
- [ ] **Clean up table rendering paths**
  - [ ] Make `renderMode === 'table'` code path in `AIResponseDisplayRefactored` delegate parsing to mappers and avoid inline transformation logic.
  - [ ] Ensure MCP marker details vs site text views are clearly distinguished via `responseMetadata` instead of string heuristics (`response.includes('Found **')`).

### 8. Map Integration Adapters

- [ ] **Wrap imperative marker logic**
  - [ ] Extract `createCyrusOneMarker(map)` and `createTsmcMarker(map)` helpers from `LayerToggle` into a `markersAdapter` module.
  - [ ] Use these helpers in effects so React components aren’t directly constructing DOM elements and Mapbox popups.
- [ ] **Limit direct access to `document`**
  - [ ] Ensure drag behaviors, style injections, and marker creation all flow through small adapter utilities or hooks with clear responsibilities.


