# Memphis Map: Strategy for Unique, Goal‑Aligned Markers

**Goal:** Make markers feel **unique per layer** and **aligned with the project narrative**: constraint = firm power + MLGW delivery timing; price driver = substation proximity (12–18 mo vs 24–36 mo). Each layer should be instantly readable and reinforce “who gets power when.”

**Primary references:**

1. **VEGAS2** — markers, animation techniques, event flow:  
   `/Users/yairtitelboim/Documents/Kernel/ALLAPPS/VEGAS2/docs/MARKERS_AND_ANIMATION_README.md`

2. **UTHA** — circle stack (base + halo + pulse), rAF pulse formula, line glow, deck.gl TripsLayer, minimal auto-labels, delayed popup:  
   `/Users/yairtitelboim/Documents/Kernel/ALLAPPS/UTHA/docs/MAP_LAYERS_ANIMATION_AND_VISUALIZATION.md`

Below we map both into MEM.

---

## 0. What we took from VEGAS2 (explicit mapping)

| VEGAS2 (section / component) | Technique | MEM use |
|------------------------------|-----------|---------|
| **§3.1 CSS keyframes** (`TimelineGraphPanel.jsx`) | `markerHalo`: idle glow (scale 1→1.1, drop-shadow). `markerSnapPulse`: one-shot scale 1→1.3→1.1 (0.6s). Trigger: threshold or `golf-course:clicked`. | xAI **idle glow** (halo or circle-opacity pulse). **One-shot pulse** when popup opens (like markerSnapPulse). |
| **§3.1** | Marker `left`/color: **CSS transition** (e.g. `left 0.8s ease-out`). | If we animate a “focus” marker position, use CSS transition. |
| **§3.2 Mapbox paint** (`OSMCallCached.jsx`) | **Golf pulse**: halo line + fill; **rAF loop** updates fill-opacity and halo together. | Same pattern: MLGW fill pulse, Colossus halo; use for **xAI halo circle** or **AOI circle** line-opacity. |
| **§3.3 Power Circle** (`PowerCircleLayer.jsx`) | Handle: dragstart → DOM style; dragend → **setTimeout(500ms)** then restore. | “Momentary emphasis” pattern: one-shot marker change then restore (e.g. on click). |
| **§3.4 Node Animation System** | `triggerNodeAnimation(lngLat, { type, category })` from legend/match; pulse, ripple, glow. | Optional: legend or timeline triggers pulse on xAI/substation marker. |
| **§3.5 Popup** | Popup: `fadeIn 0.2s`; **typewriter** (10ms/char) when expanded. MCP: CSS class + `triggerPulseEffect` on click. | Memphis popups: shared fadeIn; optional typewriter for long narrative. |
| **§2.1 Symbol layers** | text-halo-width, text-halo-color, text-halo-blur; minzoom. | We use halos in xAI/MLGW/lines; keep and match VEGAS2 readability. |
| **§2.2 React vs Mapbox** | Timeline marker = React (left %). Popups = React + `map.project(lngLat)`. Handle = Mapbox Marker (DOM). | MEM: Mapbox Popup + HTML; for floating marker could use React + project() like SNWA Purveyor. |

**VEGAS2 files to open when implementing:**  
`TimelineGraphPanel.jsx` (keyframes, threshold), `OSMCallCached.jsx` (golf rAF loop), `PowerCircleLayer.jsx` (handle + 500ms reset), `NODE_ANIMATION_SYSTEM_README.md` (if we add trigger API).

---

## 0b. What we took from UTHA (explicit mapping)

Utah’s doc (§1 layer inventory, §2 marker patterns, §4 animation) gives concrete implementation patterns we can reuse.

| UTHA (section / component) | Technique | MEM use |
|----------------------------|-----------|---------|
| **§2.1 Circle stack** | **Three circle layers** per point: (1) **base** – solid; (2) **halo** – larger, low opacity, blur; (3) **pulse** – animated in rAF. Order: pulse below halo below base. | **xAI sites** and/or **MLGW substations**: add halo + pulse layers behind current circle (same source, insert before base). Gives “glow” without changing base shape. |
| **§4.1 Pulse formula** | `pulseStart = Date.now()`; in rAF: `elapsed % PERIOD`, `t = elapsed/PERIOD`, `wave = (sin(t*2π)+1)/2`; then `setPaintProperty(PULSE_LAYER_ID, 'circle-radius', base + wave*delta)` (and opacity, blur). | Use this **exact formula** for xAI or MLGW pulse layer (e.g. 2s period, radius 8→16, opacity/blur waved). Utah: UtahStrategicNodesLayer, UtahDataCentersLayer, SMRLayer, REITLayer. |
| **§2.2 Line + glow** | **HIFLDTransmissionLayer**: two line layers – **glow** (wider, blur, lower opacity) and **core** (thinner, full opacity). Same source. | **xAI→MLGW lines**: add a **glow line** layer behind current line (wider, e.g. line-blur, lower line-opacity) so the connection “glows.” |
| **§4.2 deck.gl TripsLayer** | **PeeringDBAnimatedConnectionsLayer**: LineStrings → TripsLayer; **requestAnimationFrame** updates `currentTime`; moving particles along path (`loopLength`, `trailLength`, `fadeTrail`). | Optional **“flow”** for xAI→MLGW: same connection data in **deck.gl TripsLayer** (via MapboxLayer) for particles moving toward substation. Bigger lift; dash-offset is lighter weight. |
| **§3.3 Minimal auto-labels** | **UtahDataCentersLayer** / **SMRLayer**: after 1s, for each feature add `mapboxgl.Popup({ closeButton: false, closeOnClick: false }).setHTML(buildMinimalPopupHTML(name)).addTo(map)`; store in ref; CSS `pink-glow-pulse` / `violet-glow-pulse` on content. | Optional: **always-visible** minimal name labels for xAI sites (or substations) via small HTML popups + CSS glow keyframe, instead of or in addition to Mapbox symbol layer. |
| **§3.5 Delayed full popup** | **UtahStrategicNodesLayer** / **UtahDataCentersLayer**: click → **easeTo** point → **setTimeout(2s)** → then create full `mapboxgl.Popup` with detail. | Optional: xAI or substation click → fly to point → 2s delay → show full popup (so user lands before reading). |
| **§4.3 NodeAnimation** | **nodeAnimation.js**: data-driven (infrastructure_type, criticality) → animation type; **single RAF** updates `animation_progress` per feature, then `source.setData()`; **triggerNodeAnimation** for one-off. | Same idea as VEGAS2 §3.4: optional shared util for “trigger pulse at lngLat” from legend/timeline; or per-layer pulse loop is enough. |
| **§4.4 CSS on popup** | Minimal label popups use injected keyframes: `pink-glow-pulse`, `violet-glow-pulse` (box-shadow expand/fade, 2.5s infinite). | Memphis popup content: optional **subtle glow** keyframe on open (one-shot or slow idle) to match Utah’s “label lives” feel. |

**UTHA files to open when implementing:**  
`UtahStrategicNodesLayer.jsx`, `UtahDataCentersLayer.jsx` (circle stack + pulse loop + minimal labels + delayed popup), `SMRLayer.jsx` (pulse + minimal label), `HIFLDTransmissionLayer.jsx` (line + glow), `PeeringDBAnimatedConnectionsLayer.jsx` (TripsLayer), `MapboxLayerWrapper.js` (deck.gl), `nodeAnimation.js` (if we add trigger API).

---

## 1. Principles

1. **Differentiate by role, not just color**  
   xAI sites = *demand* (load). MLGW substations = *supply* (delivery). Lines = *connection*. Permits/parcels = *evidence*. Each should have a distinct **form** or **motion** so the eye can separate them without reading labels.

2. **Reinforce the narrative in the visual**  
   - “Who gets power when” → substations and advantage zone should feel like *capacity / timing*.  
   - “Substation proximity” → lines from xAI to MLGW should feel like *paths to power*, not decorative.  
   - “2 GW push” / phases → xAI sites can feel like *anchors* or *destinations* (slightly more prominent, optional subtle pulse).

3. **Keep it subtle and professional**  
   No carnival. Prefer: idle glow, slow pulse, or one-shot emphasis on click/hover. Match the existing dark popup and purple/blue palette where it makes sense.

4. **Reuse patterns from VEGAS2 and UTHA**  
   - **VEGAS2:** CSS keyframes (one-shot, idle glow), rAF + setPaintProperty (golf-style pulse), feature-state, delayed reset, popup fadeIn/typewriter.  
   - **UTHA:** **Circle stack** (base + halo + pulse), **rAF pulse formula** (wave = (sin(t*2π)+1)/2 on radius/opacity/blur), **line + glow line**, optional deck.gl TripsLayer for path flow, **minimal auto-labels** (popup with CSS glow), **delayed full popup** (easeTo + 2s then popup), NodeAnimation-style trigger.  
   - **Feature-state or hover** for instant feedback (Memphis Counties already does this).

---

## 2. Layer‑by‑layer visual strategy

### 2.1 xAI Sites (Public) — *demand / anchor*

**Role:** These are the *loads*: Colossus, Southaven, Stanton. The map should read “these are where power is needed.”

**Current:** Purple circle (`#a78bfa`), symbol label (phase / “xAI”), no stroke, no animation.

**Proposed:**

| Aspect | Change | Rationale |
|--------|--------|-----------|
| **Shape** | Keep circle, or add optional **circle-stroke-width: 2**, **circle-stroke-color: rgba(255,255,255,0.4)** so they read as “nodes” not just dots. | Slight ring makes them feel like anchors; still works at small zoom. |
| **Size** | Slightly larger than substations at same zoom (e.g. radius +2px at each break) so “demand” reads as primary. | Hierarchy: xAI sites = destinations; substations = delivery points. |
| **Idle motion** | Optional **very slow** pulse: circle-opacity or circle-radius oscillating (e.g. 0.88 → 0.98 over ~3s). Or a **soft halo** (second circle behind, lower opacity, same center) that pulses. | Like VEGAS2 timeline marker “idle glow”; signals “this is important” without distraction. |
| **On click** | Keep current popup; optional **one-shot** scale or glow (e.g. CSS class on a React overlay, or brief setPaintProperty pulse) when popup opens. | Reinforces “you selected this site.” |
| **Label** | Keep phase/capacity in label; ensure “Phase 3”, “Southaven” are visible. Optional: small MW badge in popup only. | Narrative: scale and phase are in the copy; map supports with clear labels. |

**Implementation notes:**  
- Idle pulse: same pattern as MLGW (rAF loop, `setPaintProperty('circle-opacity', value)` or add a halo circle layer with pulsed opacity).  
- One-shot on click: either a temporary paint change (e.g. circle-radius * 1.2 for 300ms then back) or a DOM overlay with CSS keyframe (like VEGAS2 `markerSnapPulse`).

---

### 2.2 MLGW FY2026 Substation Work — *supply / delivery*

**Role:** *Where* power is delivered. Advantage zone = “who gets power first” geography.

**Current:** Blue circle (`#60a5fa`), fill zone with **pulsing fill-opacity** (already unique). Symbol label “Sub #N”.

**Proposed:**

| Aspect | Change | Rationale |
|--------|--------|-----------|
| **Shape** | Differentiate from xAI: e.g. **circle-stroke-width: 1**, **circle-stroke-color: #0ea5e9** (slightly brighter outline), or use a **small “diamond” via symbol layer** (icon) instead of circle for substations only. | If we keep circles, stroke + color (blue vs purple) already separate; “diamond” or hex icon would make substations read as infrastructure. |
| **Idle** | Keep existing **fill-opacity pulse** for the advantage zone. Optionally add a **very subtle** circle pulse (e.g. circle-opacity 0.9 → 1) in sync with fill pulse so the point feels “alive” with the zone. | Reinforces “this is the delivery node”; ties point to zone. |
| **Label** | Keep “Sub #N”; optional add “FY2026” or a tiny year badge in popup only. | Timeline is in narrative; map stays clean. |

**Implementation:**  
- Sync circle-opacity with existing `startPulse()` so one rAF drives both fill and (optionally) circle opacity.

---

### 2.3 xAI → Nearest MLGW Substation — *connection / path*

**Role:** *Paths to power.* Distance (km) is the key number; the line is “this site connects to this substation.”

**Current:** Dashed purple line, white label at midpoint (“X km”).

**Proposed:**

| Aspect | Change | Rationale |
|--------|--------|-----------|
| **Line** | Keep dash; optional **slight gradient** (purple at xAI end, blue at MLGW end) via line-gradient if Mapbox supports, or keep solid purple and rely on **animated dash offset** (line-dasharray + periodic setPaintProperty) for a subtle “flow” toward the substation. | “Flow” suggests direction of connection; gradient would reinforce xAI → MLGW. |
| **Label** | Keep “X km” at midpoint. Optional: **slightly larger** or **bold** so distance reads as the main takeaway. | Proximity = 12–18 vs 24–36 mo; distance is the story. |
| **On hover** | Highlight the line (e.g. line-width +1, line-opacity 1) and optionally the two endpoints (if we have refs to their layers). | Like VEGAS2 hover emphasis; clarifies which connection is selected. |

**Implementation:**  
- Animated dash: one rAF loop, `setPaintProperty(LINES_LAYER_ID, 'line-dasharray', [offset, 2, 2-offset, 2])` with offset cycling 0 → 2.  
- Hover: mouseenter/mouseleave on line layer, setPaintProperty for that layer (or use feature-state if we have one feature per line).

---

### 2.4 Memphis Colossus Change (2023→2024) — *evidence*

**Current:** Fill-extrusion by change type, industrial halo pulse, dashed orange circle (Colossus AOI).

**Proposed:**

| Aspect | Change | Rationale |
|--------|--------|-----------|
| **Extrusion** | Keep; already unique. Optional: **hover** on extrusion raises opacity or adds a thin outline so the clicked segment is clear. | We already have click → popup; hover could preview. |
| **AOI circle** | Keep dashed orange. Optional: **idle pulse** of line-opacity (e.g. 0.7 → 1) so the 5 km circle reads as “focus area.” | Like golf halo in VEGAS2; subtle. |

---

### 2.5 Permits (Colossus + DeSoto) — *evidence*

**Role:** Activity near Colossus / Stateline; COM vs RES.

**Current:** Small circles, color by Sub_Type (orange/blue), no labels, popup on click.

**Proposed:**

| Aspect | Change | Rationale |
|--------|--------|-----------|
| **Shape** | Keep circles. Optional: **circle-stroke-width: 0.5**, **circle-stroke-color: rgba(255,255,255,0.2)** so they don’t bleed into the basemap. | Read as “data points,” not primary features. |
| **No idle animation** | Keep static. Permits = evidence layer; motion should stay on xAI/substation/connection. | Avoid clutter; hierarchy. |
| **Hover** | Optional: **circle-radius +1** or **circle-opacity 1** on hover (feature-state or queryRenderedFeatures + highlight that feature). | Quick feedback without adding animation. |

---

### 2.6 Parcels (DeSoto Stateline, Colossus top parcels) — *place*

**Current:** Fill + outline (DeSoto purple; Colossus top parcels separate).

**Proposed:**

| Aspect | Change | Rationale |
|--------|--------|-----------|
| **Fill** | Keep; already distinct (purple tint for DeSoto). Optional: **hover** fill-opacity bump via feature-state if we add it. | Parcels = boundaries; no need for pulse. |
| **Outline** | Ensure stroke is visible at all zooms; optional **dash** for “reference” parcels (e.g. Colossus top) vs solid for “focus” (DeSoto Stateline). | Visual distinction between “ranking” vs “single site.” |

---

## 3. Techniques to adopt (VEGAS2 + UTHA)

| Technique | VEGAS2 | UTHA | MEM use |
|-----------|--------|------|---------|
| **Circle stack (base + halo + pulse)** | — | §2.1 UtahStrategicNodes, UtahDataCenters, REIT, SMR | xAI and/or MLGW: add halo + pulse circle layers behind base (same source). |
| **rAF pulse formula** (radius/opacity/blur wave) | Golf: fill-opacity only | §4.1 wave = (sin+1)/2, setPaintProperty on pulse layer | Use Utah formula for xAI/MLGW pulse layer (2s period, radius 8→16). |
| **CSS keyframes (idle glow)** | Timeline markerHalo | — | xAI idle glow or halo circle. |
| **CSS keyframes (one-shot pulse)** | markerSnapPulse | — | xAI or substation one-shot on popup open. |
| **Line + glow line** | — | §2.2 HIFLD: glow layer + core layer | xAI→MLGW: add glow line (wider, blur, lower opacity) behind core line. |
| **Feature-state (hover)** | — | — | Memphis Counties; extend to permits, lines (hover width). |
| **Trigger on click** | Golf → timeline + pulse | — | xAI/substation → brief marker emphasis when popup opens. |
| **Popup entrance** | fadeIn 0.2s | — | .memphis-layer-popup fadeIn. |
| **Minimal auto-labels** (popup + CSS glow) | — | §3.3 UtahDataCenters, SMR | Optional: always-visible name popups for xAI/substations with glow keyframe. |
| **Delayed full popup** (easeTo + 2s) | — | §3.5 UtahStrategicNodes, UtahDataCenters | Optional: click → fly to → 2s → show full popup. |
| **deck.gl TripsLayer** (path particles) | — | §4.2 PeeringDBAnimatedConnections | Optional: xAI→MLGW “flow” as moving particles (heavier; dash-offset is lighter). |

---

## 4. Color and hierarchy (summary)

- **xAI sites:** Purple `#a78bfa` — *demand*; optional white/light stroke; optional idle pulse.  
- **MLGW substations:** Blue `#60a5fa` — *supply*; optional stroke; zone already pulses.  
- **Lines:** Purple `#a78bfa` (or gradient) — *connection*; optional dash animation.  
- **Permits:** Orange/blue by type — *evidence*; small, optional stroke, no motion.  
- **Parcels / change:** Keep current (purple, extrusion colors, orange AOI circle).

This keeps a **consistent palette** (purple/blue/orange) while giving each layer a **distinct behavior** (pulse, stroke, hover, one-shot) so the map feels unique and aligned with “firm power + MLGW delivery + substation proximity.”

---

## 5. Implementation order

1. **Low effort, high recognition**  
   - Add **circle-stroke** to xAI sites and (optionally) to MLGW substations; slight size bump for xAI circles.  
   - Add **hover** on xAI→MLGW lines (line-width or opacity).  
   - **(UTHA)** Optionally add **line + glow line** for xAI→MLGW (second line layer: wider, blur, lower opacity).

2. **Idle motion (circle stack from UTHA)**  
   - xAI sites: add **halo + pulse** circle layers (same source, below base); use **UTHA §4.1 pulse formula** (wave on radius/opacity/blur, 2s period).  
   - MLGW: same circle stack optional, or just sync base circle-opacity with existing fill pulse.

3. **One-shot on click**  
   - When xAI or substation popup opens, trigger a **brief** scale or glow (VEGAS2 markerSnapPulse-style or setPaintProperty).

4. **Line “flow”**  
   - Light: animated line-dash offset for xAI→MLGW.  
   - Heavy (UTHA): deck.gl **TripsLayer** for particles along path (see PeeringDBAnimatedConnectionsLayer).

5. **Permits / parcels**  
   - Optional feature-state hover for permits; optional dashed outline for Colossus top parcels.

6. **Optional (UTHA)**  
   - **Minimal auto-labels**: small always-visible name popups for xAI (or substations) with CSS glow keyframe.  
   - **Delayed full popup**: click → easeTo → setTimeout(2s) → show full popup.

---

## 6. Files to touch

| Change | MEM file(s) | Reference (UTHA) |
|--------|-------------|------------------|
| xAI circles: stroke, size, **halo + pulse stack** | `XAISitesPublicLayer.jsx` | `UtahStrategicNodesLayer.jsx`, `UtahDataCentersLayer.jsx` |
| MLGW circles: stroke, optional sync pulse or stack | `MLGW2026SubstationLayer.jsx` | same |
| Lines: hover, **glow line**, optional dash or TripsLayer | `XAIToMLGWLinesLayer.jsx` | `HIFLDTransmissionLayer.jsx`, `PeeringDBAnimatedConnectionsLayer.jsx` |
| Permits: stroke, optional hover | `ColossusPermitsLayer.jsx`, `DesotoPermitsLayer.jsx` | — |
| Colossus AOI circle: optional pulse | `MemphisColossusChangeLayer.jsx` | — |
| Popup entrance / one-shot trigger / minimal labels | Shared popup CSS or layer-specific click handler | `UtahDataCentersLayer.jsx` (minimal + delayed popup) |
| Optional: shared “memphis marker animation” helpers | New util or extend existing (e.g. `memphisMarkerUtils.js`) | `UTHA/src/utils/nodeAnimation.js` |

This strategy makes markers **unique per layer** and **visually aligned** with the Memphis narrative (demand, supply, connection, evidence), reusing patterns from **VEGAS2** (CSS keyframes, event-driven pulse, popup) and **UTHA** (circle stack, rAF pulse formula, line glow, optional TripsLayer, minimal labels, delayed popup).
