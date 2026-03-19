# Timeline Graph & GeoAI Integration README

## High‑Level Concept

The **“Show Graph”** button in the bottom‑right of the map toggles a **Timeline Analysis** panel that visualizes **site‑level change metrics over time** (e.g., land use / development changes) for specific megaproject sites.

This panel is **tightly coupled to the same site animation + GeoAI analysis pipeline**:
- **Site animations** compute spatial change frames (per year/period).
- **Timeline graph** aggregates those frames into numeric metrics per period.
- **GeoAI** consumes those same metrics and spatial context to generate natural‑language summaries.

The result: users can **see** change over time on the map (animations + timeline) and **read** a GeoAI narrative about those changes in the card stack.

---

## Core Components

- `src/components/Map/components/TimelineGraphToggle.jsx`  
  Renders the floating **“Show Graph / Hide Graph”** button.

- `src/components/Map/components/TimelineGraphPanel.jsx`  
  Dark‑themed bottom panel that renders the **Timeline Analysis** chart using **Recharts**.

- `src/components/Map/index.jsx`  
  Owns `showTimelineGraph` state, adjusts map height, and wires in `TimelineGraphToggle` + `TimelineGraphPanel`.

- `src/utils/siteTimelineData.js`  
  Builds and publishes **timeline payloads** from site animation data.

- Site‑specific change animation components (examples):  
  - `HarrisChangeAnimation.jsx`  
  - `ToyotaBatteryChangeAnimation.jsx`  
  - `VinFastChangeAnimation.jsx`  
  - `WolfspeedChangeAnimation.jsx`  
  - `LakesideVillageChangeAnimation.jsx`, `LakeWhitneyDamChangeAnimation.jsx`, etc.

- `src/components/Map/components/Cards/BaseCard.jsx`  
  Orchestrates **starting a site animation** and **publishing its timeline**.

---

## UI Flow: From “Show Graph” to Timeline Panel

1. **User clicks the “Show Graph” button**  
   - Implemented in `TimelineGraphToggle.jsx`:
     - `visible` prop controls label and styling.
     - `onToggle` callback toggles `showTimelineGraph` in `Map/index.jsx`.
   - Button label and tooltip:
     - Hidden → label: **“Show Graph”**, title: “Show Timeline Graph”.
     - Visible → label: **“Hide Graph”**, title: “Hide Timeline Graph”.

2. **`showTimelineGraph` updates map layout**  
   - In `Map/index.jsx`, the main map div is rendered as:
     ```jsx
     <div
       ref={mapContainer}
       style={{
         position: 'absolute',
         top: 0,
         left: 0,
         right: 0,
         bottom: showTimelineGraph ? '300px' : '0',
         transition: 'bottom 0.3s ease'
       }}
     />
     ```
   - When the graph is visible, the map bottom is lifted by **300px**, creating space for the timeline panel.

3. **Map resizes after animation**  
   - A `useEffect` in `Map/index.jsx` listens to `showTimelineGraph`:
     ```javascript
     useEffect(() => {
       if (map.current) {
         const timeoutId = setTimeout(() => {
           map.current.resize();
         }, 350);
         return () => clearTimeout(timeoutId);
       }
     }, [showTimelineGraph]);
     ```
   - This ensures Mapbox recalculates layout after the CSS transition, preventing rendering glitches.

4. **Timeline panel visibility**  
   - `TimelineGraphPanel` receives `visible={showTimelineGraph}`.  
   - If `visible` is `false`, the component returns `null`.  
   - If `true`, it renders the full **Timeline Analysis** UI:
     - Header (`siteName`‑aware title).
     - Subheading (units and helpful message when no data).
     - Recharts chart with per‑period bars / lines, legend, tooltips, and selection tools.

---

## Data Flow: From Site Animation to Timeline Graph

The timeline graph **does not directly call GeoAI**. Instead, it visualizes **numeric metrics derived from the same change datasets that GeoAI describes**.

### 1. Starting a Site Animation (GeoAI / Location driven)

In `BaseCard.jsx`, site animations are started via `startSiteAnimation`:

```javascript
const startSiteAnimation = useCallback(async (siteKey, options = {}) => {
  if (!siteKey) return;

  const site = getNcPowerSiteByKey(siteKey);
  if (!site) return;

  await ensureSiteAnimationData(siteKey);   // Loads geojson change frames
  publishSiteTimelineData(siteKey);         // Publishes numeric timeline payload

  // ...then starts the site-specific animation controller...
}, [forceSiteAnimationUpdate]);
```

- **`ensureSiteAnimationData(siteKey)`**  
  Loads or builds per‑period **change GeoJSON** for that site (e.g., land use changes, new development zones).

- **`publishSiteTimelineData(siteKey)`** (in `siteTimelineData.js`)  
  - Calls `loadSiteTimelineData(siteKey, options)` which:
    - Gathers all change frames for the site.
    - Aggregates them into per‑period metrics (e.g., **hectares changed by category, per year/month**).
    - Produces a **timeline payload**:
      ```js
      {
        siteKey,
        siteName,
        data: [
          { period: '2018', total: 120, industrial: 80, residential: 40, /* ... */ },
          { period: '2019', total: 160, industrial: 90, residential: 70, /* ... */ },
          // ...
        ],
        series: [
          { key: 'industrial', label: 'Industrial', color: '#10b981' },
          { key: 'residential', label: 'Residential', color: '#3b82f6' },
          // ...
        ],
        units: 'ha',          // hectares of change
        generatedAt: <timestamp>
      }
      ```
  - Publishes it over the map event bus:
    ```javascript
    if (payload?.data?.length) {
      window.mapEventBus.emit('timeline:update', payload);
    } else {
      window.mapEventBus.emit('timeline:clear', { siteKey });
    }
    ```

### 2. TimelineGraphPanel Listens for Timeline Events

In `TimelineGraphPanel.jsx`:

```javascript
useEffect(() => {
  if (typeof window === 'undefined' || !window.mapEventBus?.on) return;

  const handleUpdate = (payload) => {
    if (!payload) return;
    setTimelineState({
      siteKey: payload.siteKey || null,
      siteName: payload.siteName || '',
      data: Array.isArray(payload.data) ? payload.data : [],
      series: Array.isArray(payload.series) ? payload.series : [],
      units: payload.units || 'ha',
      generatedAt: payload.generatedAt || Date.now()
    });
  };

  const handleClear = (payload) => {
    if (payload?.siteKey && payload.siteKey !== timelineState.siteKey) return;
    setTimelineState(prev => ({ ...prev, data: [], series: [] }));
  };

  const unsubscribeUpdate = window.mapEventBus.on('timeline:update', handleUpdate);
  const unsubscribeClear = window.mapEventBus.on('timeline:clear', handleClear);
  // ... also subscribes to 'timeline:playback' and 'timeline:pause'
}, []);
```

**Key points:**
- The **graph has no data** until a site animation has been started and `publishSiteTimelineData` has emitted `timeline:update`.
- If the current site is cleared or has no data, `timeline:clear` empties the chart.

### 3. Playback & Legend Focus (Graph ↔ Map)

- Site animation components (e.g. `HarrisChangeAnimation.jsx`) emit playback events:
  ```javascript
  window.mapEventBus.emit('timeline:pause',   { siteKey: SITE_KEY });
  window.mapEventBus.emit('timeline:playback', { siteKey: SITE_KEY, periodId, periodLabel, annualLabel, periodIndex, periodCount, timestamp });
  ```
- `TimelineGraphPanel` subscribes to these to:
  - Highlight the active period.
  - Control the progressive reveal of monthly bars/lines.

- Conversely, the timeline can emit **legend focus** events:
  ```javascript
  window.mapEventBus.emit('timeline:legendFocus', { siteKey, seriesKey });
  ```
  which the site animation components listen to, in order to:
  - Emphasize the corresponding change layer on the map (e.g. only industrial change, or only residential).

This creates a **two‑way link**:
- **Map animations → Timeline**: Playback events keep the graph synchronized with which year/period is currently animating.
- **Timeline legend → Map**: Legend clicks tell map layers which category to highlight.

---

## Relationship to GeoAI Data

### Shared Input: Site Change Data

Both the **Timeline Graph** and **GeoAI change summaries** use the **same underlying site change datasets**:

- Site animations (e.g. Harris, Toyota Battery, VinFast, Wolfspeed) are driven by **precomputed change GeoJSON** per period.
- `siteTimelineData` **aggregates those change frames** into numeric time series.
- GeoAI components (e.g. `GeoAIChangeSummaryCard` in `AIQuestionsSection.jsx`) use:
  - The same siteKey
  - Aggregated metrics (e.g. hectares changed, categories)
  - Spatial context (what changed where)
  to generate narrative summaries.

### Separation of Concerns

- **Timeline Graph**:
  - Purely **visual / numeric**.
  - Does **not** call LLMs or external AI APIs.
  - Listens for `timeline:update` and `timeline:playback` events and renders metrics per period and category.

- **GeoAI**:
  - Lives in the card stack (`GeoAI` button, `GeoAIChangeSummaryCard`, `AIQuestionsSection`).
  - Calls external AI providers (via existing GeoAI pipeline) using:
    - Node‑level / site‑level context
    - Aggregated metrics derived from those same change datasets
  - Produces **textual insights**: e.g. “Industrial footprint increased by 35% between 2018–2024; residential growth lagged until 2022…”

### How They Work Together

1. User selects a site / triggers GeoAI site animation.
2. `startSiteAnimation(siteKey)` runs:
   - Loads & animates change layers on the map.
   - Publishes timeline data via `publishSiteTimelineData(siteKey)`.
3. Optional: User clicks **“Show Graph”**:
   - Map lifts up; `TimelineGraphPanel` becomes visible.
   - Graph is populated with the **same metrics** GeoAI is reasoning about.
4. User reads the **GeoAI summary** in cards while:
   - Watching the **map animation**.
   - Scrubbing through or inspecting the **timeline graph** for numerical detail.

Net effect: **GeoAI explains**; **timeline graph quantifies**; **map animation shows**—all driven by the same underlying site change data.

---

## Testing the Full Flow

1. **Trigger a site animation**  
   - In the main card (`BaseCard`), choose a location that has a change animation (e.g. Harris, VinFast, Toyota Battery, Wolfspeed) and run its animation / GeoAI action.

2. **Verify timeline data is published**  
   - In DevTools console, look for `[timeline]` logs (from `siteTimelineData.js`) if debugging.
   - Confirm `window.mapEventBus` sees `timeline:update` events (you can temporarily log inside `TimelineGraphPanel`’s `handleUpdate`).

3. **Show the graph**  
   - Click **“Show Graph”** bottom‑right.
   - Ensure:
     - Map height shrinks and resizes cleanly.
     - Timeline header shows the correct site name.
     - Bars/lines appear with sensible values.

4. **Check playback sync**  
   - Start/stop the site animation and confirm:
     - The active period in the timeline matches what’s being animated.
     - Pausing animation emits `timeline:pause` events that stop playback highlighting.

5. **Legend focus ↔ map highlight**  
   - Click series entries in the timeline legend and confirm that specific change layers are emphasized on the map (where implemented).

6. **GeoAI coherence**  
   - Open the GeoAI change summary card (if present).
   - Validate that the narrative aligns with what the timeline graph shows numerically and what the animation shows spatially.

This README should give you (and other devs) a clear mental model for how the Timeline Analysis feature works and how it connects to GeoAI‑driven site analysis.

---

## Design Patterns & Principles (for Re‑Use in Other Projects)

### 1. Event‑Driven Architecture via Map Event Bus

- Use a **single, lightweight event bus** (`window.mapEventBus`) to decouple:
  - Map animations
  - Timeline graph
  - GeoAI / card UI
- Recommended event names:
  - `timeline:update` – push new timeline payload `{ siteKey, siteName, data, series, units }`.
  - `timeline:clear` – clear current timeline for a `siteKey`.
  - `timeline:playback` – mark a period as “active” (for both graph and map).
  - `timeline:pause` – stop playback.
  - `timeline:legendFocus` – request map highlight for a specific `seriesKey`.
- Pattern:
  - **Producers** (site loaders, animations) only **emit** events.
  - **Consumers** (timeline graph, change layers) only **subscribe** and update internal state.

### 2. Strict Separation of Concerns

- **Map / Animations**: Own **visual spatial state** (layers, camera, halos).
- **Timeline Graph**: Own **numeric state** (arrays of time‑series values).
- **GeoAI**: Own **semantics and narrative**, but never raw mapbox / chart state.
- Glue them with **small, typed payloads** (e.g. `{ siteKey, period, metrics }`) instead of reaching into each other’s components.

### 3. Stateless Toggle, Stateful Panel

- The **toggle button** (`TimelineGraphToggle`) should be:
  - Dumb, presentational.
  - Driven by props: `visible`, `onToggle`.
- The **panel** (`TimelineGraphPanel`) should:
  - Own its timeline state.
  - React only to bus events, not to toggle directly.
  - Be mount/unmount safe: return `null` when `visible === false`.

### 4. Idempotent Emissions

- Make `publishSiteTimelineData(siteKey)` safe to call multiple times:
  - Cache results in `timelineCache` to avoid recomputation.
  - Re‑emit the same payload when asked (if nothing changed).
- Map animations can call this every time an animation starts without worrying about duplicates.

### 5. Backwards‑Compatible Extensibility

- When designing your timeline payload, always:
  - Include a `generatedAt` timestamp.
  - Treat **unknown fields** as optional (ignore instead of crashing).
  - Prefer **additive evolution**: add new series/metrics rather than changing existing keys.

---

## Phased Implementation Guide for a New Project

You can replicate this pattern in another project by following these phases.

### Phase 1 – Basic Map + Toggle + Empty Graph

**Goal**: Get the “Show Graph” button and an empty timeline panel wired to your map.

1. **Add `showTimelineGraph` state** in your top‑level map component:
   ```javascript
   const [showTimelineGraph, setShowTimelineGraph] = useState(false);
   ```

2. **Adjust the map container** to make room for the graph:
   ```jsx
   <div
     ref={mapContainer}
     style={{
       position: 'absolute',
       top: 0,
       left: 0,
       right: 0,
       bottom: showTimelineGraph ? '300px' : '0',
       transition: 'bottom 0.3s ease'
     }}
   />
   ```

3. **Trigger Mapbox resize** when the graph visibility changes:
   ```javascript
   useEffect(() => {
     if (map.current) {
       const timeoutId = setTimeout(() => {
         map.current.resize();
       }, 350); // match CSS transition
       return () => clearTimeout(timeoutId);
     }
   }, [showTimelineGraph]);
   ```

4. **Add a simple toggle button** (can copy `TimelineGraphToggle`):
   ```jsx
   <TimelineGraphToggle
     visible={showTimelineGraph}
     onToggle={() => setShowTimelineGraph(v => !v)}
   />
   ```

5. **Add an empty graph panel shell**:
   ```jsx
   <TimelineGraphPanel visible={showTimelineGraph} />
   ```

At this phase, the graph can render **fake/static data** just to validate layout and styling.

---

### Phase 2 – Timeline Data Model & Event Bus Wiring

**Goal**: Define a reusable timeline payload and set up event plumbing.

1. **Define your timeline payload shape** (adapt as needed):
   ```ts
   type TimelinePoint = {
     period: string;          // e.g. '2018' or 'Q1 2024'
     total?: number;          // aggregate metric
     [seriesKey: string]: any; // per-series values (numbers)
   };

   type TimelineSeries = {
     key: string;             // 'industrial', 'residential', ...
     label: string;
     color: string;
   };

   type TimelinePayload = {
     siteKey: string;
     siteName: string;
     data: TimelinePoint[];
     series: TimelineSeries[];
     units?: string;          // e.g. 'ha', 'MW', 'm³'
     generatedAt: number | string;
   };
   ```

2. **Create a small timeline service** (like `siteTimelineData.js`):
   ```javascript
   const timelineCache = new Map();

   export const publishSiteTimelineData = async (siteKey, buildFn) => {
     let payload = timelineCache.get(siteKey);
     if (!payload) {
       payload = await buildFn(siteKey); // your own aggregator
       timelineCache.set(siteKey, payload);
     }

     if (typeof window !== 'undefined' && window.mapEventBus?.emit) {
       if (payload?.data?.length) {
         window.mapEventBus.emit('timeline:update', payload);
       } else {
         window.mapEventBus.emit('timeline:clear', { siteKey });
       }
     }
   };
   ```

3. **Hook it into your site/region selection**:
   - Whenever the user selects a site (or runs an analysis), call:
     ```javascript
     await publishSiteTimelineData(siteKey, buildTimelineForSite);
     ```
   - `buildTimelineForSite` is where you convert raw data → time series.

4. **Make your graph listen only to events**, not props:
   - Subscribe to `timeline:update` and `timeline:clear` inside `TimelineGraphPanel`.
   - Store payload in internal state as shown earlier.

---

### Phase 3 – Map Animations + Playback Sync

**Goal**: Connect animations (or other map behaviors) to the timeline, and vice‑versa.

1. **From map animations → timeline**:
   - When your animation advances to a new period:
     ```javascript
     window.mapEventBus.emit('timeline:playback', {
       siteKey,
       periodId,
       periodLabel,
       annualLabel,
       periodIndex,
       periodCount,
       timestamp: Date.now()
     });
     ```
   - When you stop/pause animation:
     ```javascript
     window.mapEventBus.emit('timeline:pause', { siteKey });
     ```

2. **In the graph**, subscribe to playback events:
   - Highlight the active period visually (e.g. ReferenceArea or a thicker bar).
   - Optionally auto‑reveal future months/years as playback advances.

3. **From timeline legend → map**:
   - Legend click emits `timeline:legendFocus`:
     ```javascript
     window.mapEventBus.emit('timeline:legendFocus', { siteKey, seriesKey: 'industrial' });
     ```
   - Map layers listen and adjust styling (e.g. only show **industrial** polygons at full opacity, fade the rest).

4. **GeoAI integration (optional but recommended)**:
   - When you have a stable timeline payload, you can pass **summary stats** into your LLM prompts:
     - Top 3 categories of change.
     - Peak years for a metric.
     - Growth/decline percentages.
   - Keep the prompt construction in a separate module so timeline logic stays independent.

---

## Practical Tips & Gotchas

- **Start simple**:
  - Get the toggle + empty graph working **before** wiring in site data or animations.
  - Use static fake data initially; only then plug in real aggregation.

- **Be strict about `siteKey`**:
  - Always verify that incoming payloads/events match the currently selected site.
  - Ignore events for other sites to avoid race conditions when users switch context quickly.

- **Guard against missing event bus**:
  - Wrap all `window.mapEventBus` usages in checks (`?.on`, `?.emit`, `?.off`) so server‑side rendering or storybook doesn’t crash.

- **Keep payloads small**:
  - Don’t send entire GeoJSON into the timeline; send **aggregated numbers** only.
  - This keeps the event bus lightweight and avoids expensive renders.

- **Coordinate durations**:
  - Match CSS transitions (map bottom, panel height) with JS delays (`setTimeout`) before calling `map.resize()` to avoid jitter.

- **Test each direction separately**:
  1. Site selection → `timeline:update` → graph updates.
  2. Animation playback → `timeline:playback` → graph highlight updates.
  3. Legend click → `timeline:legendFocus` → map layer highlight updates.

Following these phases and patterns, another project can replicate this **map + timeline + GeoAI** triad, swap in its own data sources and metrics (e.g. MW of generation, GWh, water volumes), and still get a clean, maintainable architecture. 

