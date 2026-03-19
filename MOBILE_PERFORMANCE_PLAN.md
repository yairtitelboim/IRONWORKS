# Mobile Performance Plan

**Goal:** Reduce initial load time on iPhone from ~10s to under 3s by cutting the JS bundle from 994 KB (gzipped) to ~400 KB.

**Current state:** All ~90 layer components, all card variants, and all analysis panels are bundled into a single `main.js` file. A user opening the app on their phone downloads everything upfront, even though they'll only interact with 2-3 layers in a session.

---

## Phase 1: Lazy-load layer components (biggest win)

**Estimated bundle reduction: 40-50%**

The `Map/index.jsx` orchestrator eagerly imports 17 heavy components. Most are only needed when a specific layer is toggled on or a specific feature is used.

### Components to lazy-load

| Component | Lines | When needed |
|---|---|---|
| `MCPSearchResults` | 1,660 | Only on MCP search |
| `DetailExpandedModal` | 1,361 | Only when expanding a detail |
| `PlanningDocsLayer` | ~400 | Only when layer toggled |
| `PlanningAnalysisLayer` | 1,373 | Only when layer toggled |
| `ErcotManager` | ~300 | Only for ERCOT features |
| `TimelineGraphPanel` | 1,380 | Only when timeline opened |
| `TimelineGraphToggle` | ~100 | Only when timeline opened |
| `NarrativePanel` | ~500 | Only for narrative mode |
| `NarrativePanelToggle` | ~100 | Only for narrative mode |
| `SceneManager` | ~400 | Only for scene switching |
| `PowerConnectionsLayer` | ~300 | Only when layer toggled |

### How to implement

Replace eager imports:

```javascript
// Before
import MCPSearchResults from './components/MCPSearchResults';

// After
const MCPSearchResults = React.lazy(() => import('./components/MCPSearchResults'));
```

Wrap lazy components in Suspense at render sites:

```javascript
<Suspense fallback={null}>
  {showMCPResults && <MCPSearchResults ... />}
</Suspense>
```

The `fallback={null}` avoids any visible loading flash since these components appear on user action.

### CardManager lazy loading

`CardManager` (imported from `./components/Cards`) bundles every card type. Refactor it to lazy-import each card type:

```javascript
const LocationSearchCard = React.lazy(() => import('./LocationSearchCard'));
const TexasDataCenterCard = React.lazy(() => import('./TexasDataCenterCard'));
const GeoAIChangeSummaryCard = React.lazy(() => import('./GeoAIChangeSummaryCard'));
```

This is the single biggest win because the Cards directory alone is 30,000 lines.

---

## Phase 2: Lazy-load the ~75 layer components not imported by index.jsx

These are loaded by `LayerToggle.jsx` or `ErcotManager.jsx`. They're currently all eagerly imported even though most are off by default.

### Pattern

`LayerToggle.jsx` conditionally renders layers based on toggle state. Replace:

```javascript
import MemphisPermitsHeatmapLayer from './MemphisPermitsHeatmapLayer';
```

With:

```javascript
const MemphisPermitsHeatmapLayer = React.lazy(() => import('./MemphisPermitsHeatmapLayer'));
```

Since layers only render when toggled on, wrapping in `<Suspense fallback={null}>` is safe — the user just clicked the toggle, a few hundred ms delay is invisible.

### Highest-value targets (by line count)

| Component | Lines |
|---|---|
| `AITransmissionNav` | 2,534 |
| `MCPChatPanel` | 2,124 |
| `ScannerSignalsPanel` | 2,057 |
| `TransportationNetworkLayer` | 1,593 |
| `ERCOTCountiesLayer` | 1,428 |
| `ERCOTCountiesTable` | 1,028 |
| `PropertyPricesLayer` | 1,006 |
| `TexasDataCentersLayer` | 994 |
| 5x ChangeAnimation layers | ~1,200 each |

---

## Phase 3: Vendor chunk splitting

CRA doesn't support custom webpack config without ejecting, but `react-app-rewired` or `craco` can add it non-destructively.

### Split targets

| Vendor | Size (approx) | When needed |
|---|---|---|
| `@turf/turf` | ~200 KB | Only for spatial analysis |
| `mapbox-gl` | ~250 KB | Always (keep in main) |
| `axios` | ~15 KB | Always (keep in main) |

Splitting Turf into a separate chunk that loads async with the first spatial operation would save ~200 KB from the critical path.

---

## Phase 4: Remove dead code

| File | Lines | Status |
|---|---|---|
| `AlphaEarthButton copy.jsx` | removed | Done (security commit) |
| `ResponseCache copy.mjs` | removed | Done |
| `OsmTool copy.js` | removed | Done |
| `PerplexityTool copy.mjs` | removed | Done |
| `src/components/Map/AINAV.jsx` | ~200 | Appears unused (old nav) |
| `src/components/Map/BUILDING.jsx` | ~200 | Appears unused |
| `src/components/Map/test.jsx` | ~200 | Test file in src |
| `src/components/index.jsx` | ~200 | Appears to be old root |

Verify each is truly unused with `grep -r "AINAV\|BUILDING" src/` before removing.

---

## Execution Order

1. **Phase 1** — Lazy-load the 11 components in `Map/index.jsx` and the card types in `CardManager`. This is the fastest win: ~2 hours of work, ~40% bundle reduction.

2. **Phase 2** — Lazy-load the remaining ~75 layer components in `LayerToggle` / `ErcotManager`. Methodical but straightforward: ~3 hours.

3. **Phase 4** — Remove dead code. Quick pass: ~30 minutes.

4. **Phase 3** — Vendor splitting with craco. More involved (new dependency, config file): ~2 hours.

### Expected result

| Metric | Before | After |
|---|---|---|
| Initial JS (gzipped) | 994 KB | ~350-400 KB |
| Time to interactive (iPhone) | ~8-10s | ~3-4s |
| Layers loaded on toggle | 0 (all preloaded) | Only active ones |

---

## How to verify

```bash
# Build and check output sizes
npm run build

# Analyze bundle (optional, with source-map-explorer)
npx source-map-explorer build/static/js/main.*.js
```

Compare the "File sizes after gzip" line in build output before and after each phase.
