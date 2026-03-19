# Memphis: Linking Map Markers to the Timeline Panel

**Goal:** Tie map marker interactions (xAI sites, MLGW substations, xAI→MLGW lines) to the **TimelineGraphPanel** so that (1) clicking a marker updates the timeline (e.g. highlight/expand the relevant milestone), and (2) clicking a milestone in the timeline can drive map feedback (e.g. highlight or fly to the relevant markers).

**Relevant code:**  
- `src/components/Map/components/TimelineGraphPanel.jsx` — two modes: **narrative** (MEMPHIS_MILESTONES when `memphisLayersOn && !timelineState.siteKey`) and **site-change** (Recharts when `timeline:update` payload has data).  
- Memphis layers: `XAISitesPublicLayer.jsx`, `MLGW2026SubstationLayer.jsx`, `XAIToMLGWLinesLayer.jsx` — currently only open popups on click; they do **not** emit any event the timeline subscribes to.

---

## 1. Current state

### TimelineGraphPanel data flow

| Source | What the panel receives | How it’s used |
|--------|-------------------------|----------------|
| **Props** | `visible`, `memphisLayersOn` (from Map) | `memphisLayersOn` + no site data → **narrative mode** (milestones + key bullets). |
| **Config** | `MEMPHIS_MILESTONES` (default prop / import) | Rendered as horizontal milestone cards; click expands detail card. |
| **mapEventBus** | `timeline:update`, `timeline:clear` | Fills `timelineState` (siteKey, siteName, data, series) → **site-change mode** (Recharts). |
| **mapEventBus** | `timeline:playback`, `timeline:pause` | Playback state and active period highlight. |
| **mapEventBus (emit)** | `timeline:legendFocus` | When user toggles series in chart legend → map can highlight category. |

There is **no** subscription to marker clicks on Memphis layers. So when the user clicks an xAI site or a substation, the timeline panel does not react.

### Memphis layers today

- **XAISitesPublicLayer**: click → `queryRenderedFeatures` → `mapboxgl.Popup` with HTML. No `mapEventBus.emit`.
- **MLGW2026SubstationLayer**: same — click → popup only.
- **XAIToMLGWLinesLayer**: same — click → popup only.

So **marker information is not used in the timeline panel** today.

---

## 2. Event contract: marker ↔ timeline

### 2.1 Map → Timeline (marker selected)

When the user clicks a Memphis-related feature on the map, the layer should emit an event so the timeline can reflect the selection.

**Event name:** `memphis:markerSelected`

**Payload (suggested):**

```js
// xAI site click (XAISitesPublicLayer)
{ type: 'xai_site', id: string, name: string, phase?: string, capacity_mw?: number, coordinates: [lng, lat], ...properties }

// Substation click (MLGW2026SubstationLayer)
{ type: 'substation', id: string, name: string, substation_number?: string, coordinates: [lng, lat], ...properties }

// Connection line click (XAIToMLGWLinesLayer)
{ type: 'connection', from_name: string, to_name: string, distance_km: number, coordinates: [lng, lat], ...properties }
```

**Who listens:** `TimelineGraphPanel` (only when in **narrative mode** and panel visible).

**What the panel does with it:**

- **Map payload → milestone:** Decide which milestone(s) are “related” to this marker (see §3).
- **UI:** Set a **highlighted milestone** (e.g. `highlightedMilestoneId`) and/or **expand that milestone’s detail card** (`setExpandedMilestoneId(milestoneId)`). Optional: show a small strip “Selected: [name]” or “Selected: [from] → [to] (X km)” above the milestones.
- **Optional:** Emit a **one-shot** pulse or scroll the milestone row so the highlighted card is in view.

### 2.2 Timeline → Map (milestone focused)

When the user clicks or expands a **milestone** in the timeline (narrative mode), the panel can emit an event so the map can highlight or focus the relevant markers.

**Event name:** `memphis:milestoneFocused`

**Payload (suggested):**

```js
{ milestoneId: string, label: string }
// milestoneId one of: 'xai-150mw' | 'mlgw-fy2026' | 'advantage' | 'next-loads'
```

**Who listens:** Map layers (or a small coordinator in Map/index) that can:

- **Highlight** the relevant map features (e.g. for `mlgw-fy2026` highlight substation circles and advantage zone; for `advantage` highlight xAI sites + substations + lines).
- **Fly to** an extent that fits those features (optional).

Implementation can be: layers subscribe to `memphis:milestoneFocused` and set a “highlight” paint or a temporary pulse for the relevant layer/features. Alternatively, Map/index holds “focused milestone” state and passes it to layers as a prop so they can highlight without each layer subscribing to the bus.

---

## 3. Mapping: marker type ↔ milestone

So the timeline knows **which milestone to highlight** when it receives `memphis:markerSelected`:

| Marker type | Payload | Suggested milestone to highlight / expand |
|-------------|---------|-------------------------------------------|
| **xai_site** | name, phase, capacity_mw, … | Prefer **`advantage`** (“Sites near MLGW expansion”) — all xAI sites are “sites” in that story. If we want to call out the 150 MW blueprint site specifically, we could add a property or name match and highlight **`xai-150mw`** for that one. |
| **substation** | name, substation_number, … | **`mlgw-fy2026`** (“MLGW FY2026 substation work starts”) — direct match. |
| **connection** | from_name, to_name, distance_km | **`advantage`** (“Sites near MLGW expansion”) — the line encodes “this site → this substation,” i.e. who is near the expansion. |

**Reverse (milestone → map):**

| milestoneId | Map action (suggested) |
|-------------|-------------------------|
| **xai-150mw** | Highlight xAI sites (or the one that has the 150 MW narrative); optional fly to xAI sites. |
| **mlgw-fy2026** | Highlight MLGW substation circles and advantage zone fill; optional fly to substations. |
| **advantage** | Highlight xAI sites + substations + xAI→MLGW lines (and optionally advantage zone). |
| **next-loads** | Optional: dim or de-emphasize xAI/substations; or show a short tooltip “Other large loads: same process.” No strong marker set to highlight. |

This mapping can live in a small config or helper (e.g. `memphisTimelineMarkerMapping.js`) so both the panel and the map use the same rules.

---

## 4. How TimelineGraphPanel uses marker information (implementation sketch)

1. **State:** Add e.g. `highlightedMilestoneId` (string | null) and optionally `selectedMarkerSummary` (string for “Selected: …” strip).
2. **Subscribe:** In a `useEffect`, subscribe to `memphis:markerSelected`. In the handler:
   - Map `payload.type` + payload to a `milestoneId` (see §3).
   - `setHighlightedMilestoneId(milestoneId)`.
   - Optionally `setExpandedMilestoneId(milestoneId)` to open the detail card.
   - Optionally set `selectedMarkerSummary` from payload (e.g. `payload.name` or `payload.from_name + ' → ' + payload.to_name`).
3. **Clear highlight:** When the user closes the popup or clicks elsewhere, layers can emit e.g. `memphis:markerCleared` (or the panel clears `highlightedMilestoneId` on a short timeout, or when a new marker is selected we overwrite). Alternatively, “click outside” already closes the popup; we can clear highlight when another marker is selected or when the user clicks a milestone again to collapse.
4. **Render:** In narrative mode, when rendering milestone cards, add a visual “highlight” (e.g. border or background) when `milestoneId === highlightedMilestoneId`. If `selectedMarkerSummary` is set, render a thin strip above the milestones: “Selected: {selectedMarkerSummary}”.
5. **Emit on milestone click:** When the user clicks a milestone card, after expanding it (or in addition), emit `memphis:milestoneFocused` with `{ milestoneId: m.id, label: m.label }` so the map can highlight the right markers.

No change to **site-change mode** (Recharts) is required for this; the marker ↔ timeline link is only active in **narrative mode**.

---

## 5. How map layers use milestone focus (implementation sketch)

**Option A – Event bus (layers subscribe):**

- **XAISitesPublicLayer**, **MLGW2026SubstationLayer**, **XAIToMLGWLinesLayer** (and optionally the MLGW fill) subscribe to `memphis:milestoneFocused`.
- Each layer checks whether it is “in scope” for that milestone (e.g. MLGW layer for `mlgw-fy2026` and `advantage`; xAI for `xai-150mw` and `advantage`; lines for `advantage`).
- For a short period (e.g. 3–5 s) or until “cleared,” they set a highlight (e.g. circle-stroke-width, line-width, or a brief pulse via setPaintProperty or a second “highlight” layer).

**Option B – Central state in Map:**

- **Map/index.jsx** subscribes to `memphis:milestoneFocused` and sets state e.g. `focusedMilestoneId`.
- Pass `focusedMilestoneId` (and maybe `highlightedMarkerPayload` from `memphis:markerSelected`) as props to the layers. Layers receive e.g. `highlightForMilestone={focusedMilestoneId}` and adjust paint or show a highlight layer only when they are in scope for that milestone.

Option B keeps the bus usage one-way (timeline → Map) and avoids each layer depending on the bus; Map is the single subscriber and passes props down.

---

## 6. Summary: data flow

```
[User clicks xAI site on map]
  → XAISitesPublicLayer: popup + mapEventBus.emit('memphis:markerSelected', { type: 'xai_site', name, phase, ... })
  → TimelineGraphPanel (narrative mode): on('memphis:markerSelected') → setHighlightedMilestoneId('advantage'), setExpandedMilestoneId('advantage'), setSelectedMarkerSummary(name)
  → Panel renders: "advantage" card highlighted and expanded; optional "Selected: Colossus" strip

[User clicks substation on map]
  → MLGW2026SubstationLayer: popup + mapEventBus.emit('memphis:markerSelected', { type: 'substation', name, ... })
  → TimelineGraphPanel: setHighlightedMilestoneId('mlgw-fy2026'), setExpandedMilestoneId('mlgw-fy2026'), setSelectedMarkerSummary(name)

[User clicks connection line on map]
  → XAIToMLGWLinesLayer: popup + mapEventBus.emit('memphis:markerSelected', { type: 'connection', from_name, to_name, distance_km, ... })
  → TimelineGraphPanel: setHighlightedMilestoneId('advantage'), setSelectedMarkerSummary(`${from_name} → ${to_name} (${km} km)`)

[User clicks "MLGW FY2026" milestone in timeline]
  → TimelineGraphPanel: setExpandedMilestoneId('mlgw-fy2026'); mapEventBus.emit('memphis:milestoneFocused', { milestoneId: 'mlgw-fy2026', label: '...' })
  → Map (or MLGW layer): highlight substations + advantage zone; optional fly to extent
```

---

## 7. Implementation order and files

| Step | What | Files |
|------|------|--------|
| 1 | Emit `memphis:markerSelected` from Memphis layers on click (in addition to popup) | `XAISitesPublicLayer.jsx`, `MLGW2026SubstationLayer.jsx`, `XAIToMLGWLinesLayer.jsx` |
| 2 | Timeline: subscribe to `memphis:markerSelected`; add `highlightedMilestoneId` (and optional `selectedMarkerSummary`); map payload → milestoneId; highlight + expand milestone card | `TimelineGraphPanel.jsx` |
| 3 | Optional: “Selected: …” strip above milestones when `selectedMarkerSummary` is set | `TimelineGraphPanel.jsx` |
| 4 | Config/helper: marker type + payload → milestoneId (and milestoneId → which layers to highlight) | New `memphisTimelineMarkerMapping.js` or inside config |
| 5 | On milestone card click: emit `memphis:milestoneFocused` | `TimelineGraphPanel.jsx` |
| 6 | Map or layers: subscribe to `memphis:milestoneFocused`; highlight relevant markers (Option A or B above) | `Map/index.jsx` and/or `MLGW2026SubstationLayer.jsx`, `XAISitesPublicLayer.jsx`, `XAIToMLGWLinesLayer.jsx` |

This ties marker information (what the user clicked on the map) into the timeline panel (which milestone is highlighted/expanded) and optionally ties timeline milestone focus back to map highlighting, so the two stay in sync and support the “who gets power when” narrative.
