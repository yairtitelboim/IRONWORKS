# Memphis Narrative + TimelineGraphPanel Integration Plan

**References:**
- [MEMPHIS_MAP_NARRATIVE_GAPS_AND_ANALYSES.md](./MEMPHIS_MAP_NARRATIVE_GAPS_AND_ANALYSES.md) – narrative gaps and recommended fixes
- [LayerToggle.jsx](../src/components/Map/components/LayerToggle.jsx) – current Memphis-related layers
- [TimelineGraphPanel.jsx](../src/components/Map/components/TimelineGraphPanel.jsx) – existing timeline panel (site change chart)

---

## 1. Goal

Use **TimelineGraphPanel** (and optionally LayerToggle) so the map clearly shows:

- **Constraint:** Firm power contracts + MLGW delivery timing (not TVA generation).
- **Timeline:** Who gets power when — “12–18 month advantage” near FY2026 substations vs “24–36 months + board” elsewhere.
- **Blueprint:** xAI’s first 150 MW = board approval, demand response, new substation (template for next projects).

The narrative doc calls this out as an optional but high-value piece: *“Simple timeline strip or table … one row per major milestone … small timeline component or table in a side panel/card, driven by the same JSON as (2).”*

---

## 2. Current State

### 2.1 TimelineGraphPanel today

- **Purpose:** Stacked bar chart of **site-level landcover change** over time (e.g. ha/month by category).
- **Data:** Driven by `mapEventBus` (`timeline:update`, `timeline:clear`, `timeline:playback`, `timeline:pause`). Payload: `siteKey`, `siteName`, `data[]`, `series[]`, `units`.
- **Visibility:** Controlled by parent (`visible={showTimelineGraph}`). User opens via **TimelineGraphToggle** (floating button).
- **Empty state:** “Run a site animation to populate change metrics.”

### 2.2 Memphis-relevant layers (LayerToggle)

| Layer | Prop | Narrative role |
|-------|------|-----------------|
| Memphis Counties | `showMemphisCounties` | Region context |
| AI Power Expansion | `showMemphisAIExpansion` | AI expansion context |
| MLGW FY2026 Substation Work | `showMLGW2026` | Advantage zone, who gets power when |
| xAI Sites (Public) | `showXAISitesPublic` | Colossus, Stateline, Stanton |
| xAI → Nearest MLGW Substation | `showXAIToMLGW` | Proximity / constraint |
| Memphis Colossus Change (2023→2024) | `showMemphisColossusChange` | Colossus build-out |
| Memphis Colossus top parcels | `showMemphisColossusTopParcels` | Parcel story |
| Colossus permits (Shelby) | `showColossusPermits` | Activity |
| DeSoto permits | `showDesotoPermits` | Southaven activity |
| DeSoto Stateline parcel | `showDesotoStatelineParcel` | 2400 Stateline |

### 2.3 Narrative doc “timeline” (item 6)

- **Content:** One row per milestone, e.g.  
  - xAI 150 MW TVA board approval (date)  
  - MLGW FY2026 substation work starts  
  - Typical energization 12–18 mo  
  - Next large loads: 18–36 mo + board  
- **Data:** Same JSON as “(2) Extract timeline from MLGW/TVA documents” (substation + xAI approval dates).
- **UI:** “Small timeline component or table in a side panel/card.”

So we have **two distinct timeline concepts:**

1. **Site change timeline** (current panel): time-series of change area by category at a specific site (e.g. Colossus, Toyota, Wolfspeed).
2. **Memphis narrative / milestone timeline** (doc): ordered list of *events* (approval dates, FY2026 start, 12–18 vs 24–36 mo).

---

## 3. Proposed Direction: One Panel, Two Modes

Keep a **single** TimelineGraphPanel and toggle its **content** by context:

| Mode | When to show | Content |
|------|----------------|--------|
| **Memphis narrative (milestones)** | User has any “Memphis story” layer on and no site change data loaded | Milestone strip/table (events + short copy) |
| **Site change (current)** | User has run a site animation / `timeline:update` fired for a site | Stacked bar chart (current behavior) |

Rationale:

- One place for “timeline” avoids multiple overlapping panels.
- Narrative doc asks for a “small timeline component … in a side panel/card” — same panel, different view.
- Layer-aware behavior: when Memphis layers are on, opening the panel shows the **story** (milestones) until a site animation overwrites it.

---

## 4. Implementation Plan

### 4.1 Data: Memphis milestone config

Add a small config or JSON (aligned with narrative doc §2, analysis 2):

- **File:** e.g. `src/config/memphisNarrativeTimeline.js` or `public/data/memphis_timeline.json`.
- **Shape (example):**

```js
// memphisNarrativeTimeline.js
export const MEMPHIS_MILESTONES = [
  { id: 'xai-150mw', date: '2024-XX-XX', label: 'xAI 150 MW TVA board approval', detail: 'Demand response, new substation, reserve margin (blueprint for next projects).' },
  { id: 'mlgw-fy2026', date: '2026', label: 'MLGW FY2026 substation work starts', detail: 'Construction starts this year; energization typically 12–18 months.' },
  { id: 'advantage', date: null, label: 'Sites near MLGW expansion', detail: '~12–18 month advantage. Outside advantage zone: ~24–36 months + TVA board approval.' },
  { id: 'next-loads', date: null, label: 'Next large loads', detail: 'Same process: 18–36 months, board approval.' }
];
```

- **Source:** Populate from MLGW budget book / TVA board minutes when available (narrative doc §2, analyses 1–2).

### 4.2 TimelineGraphPanel: add “narrative” mode

- **New props (optional):**
  - `mode: 'site-change' | 'narrative'` (or infer from data).
  - `memphisMilestones: Array<{ id, date?, label, detail? }>` (or load inside panel from config).
- **Logic:**
  - If `mode === 'narrative'` (or no `timelineState.siteKey` and `memphisMilestones?.length` and narrative layers on): render **milestone view**.
  - Else if `timelineState.data.length`: render **existing stacked bar chart**.
  - Else: empty state — for narrative mode suggest “Turn on Memphis / MLGW / xAI layers” or show milestones anyway if data exists; for site mode keep “Run a site animation.”
- **Milestone UI (inside same panel):**
  - Simple **vertical timeline** or **table**: date (if present) | label | detail.
  - Same header area; subheading e.g. “Power & delivery timeline: who gets power when.”
  - Optional: 2–4 bullet “Key” lines from narrative doc (constraint = firm power + MLGW timing; price on substation proximity).

### 4.3 When to show narrative mode

- **Option A (recommended):** Pass Memphis-relevant layer flags from Map into the panel, e.g.  
  `memphisNarrativeLayersOn = showMLGW2026 || showXAISitesPublic || showXAIToMLGW || showMemphisColossusChange || showMemphisCounties`.
- **Rule:**  
  - If `memphisNarrativeLayersOn && !timelineState.siteKey` (no site change data in play) → show **narrative** content.  
  - If `timelineState.siteKey` and site data loaded → show **site change** chart (current behavior).  
  - When user clears site timeline or switches to a scene with only Memphis layers, panel can fall back to narrative view.

### 4.4 Map index wiring

- **Already available:** `showTimelineGraph`, `showMLGW2026`, `showXAISitesPublic`, `showXAIToMLGW`, `showMemphisColossusChange`, `showMemphisCounties`, etc.
- **Change:** Pass a derived flag and optional milestones into the panel, e.g.  
  `<TimelineGraphPanel visible={showTimelineGraph} memphisLayersOn={…} memphisMilestones={MEMPHIS_MILESTONES} />`  
  (or load milestones inside the panel from config when `memphisLayersOn` is true).

### 4.5 LayerToggle

- **Option 1:** Do **not** add a separate “Timeline” toggle inside LayerToggle; keep using the existing **TimelineGraphToggle** so the panel stays a single, consistent entry point.  
- **Option 2:** Add a “Timeline / Story timeline” row in LayerToggle that calls `setShowTimelineGraph(true)` (and optionally focuses the panel). Only if product wants the timeline discoverable from the layer list.
- **Scenes:** If `showTimelineGraph` is ever persisted in scenes (LayerToggle/SceneManager), include it in saved layer state so “Memphis story” scenes can open with the timeline panel already open.

### 4.6 Colossus in site timeline (optional, later)

- Narrative doc also calls for **scale** (Phase 3, 150 MW, 2 GW) and **site change** at Colossus. If you add Colossus to `siteTimelineConfig.js` and drive `timeline:update` from a Colossus animation:
  - With panel open, the panel would switch to **site change** view for Colossus (stacked bars).
  - When the user closes or clears that site’s timeline, the panel can show **narrative** milestones again if Memphis layers are still on.

---

## 5. Summary: How We Use the Component

| Aspect | Use |
|--------|-----|
| **TimelineGraphPanel** | Single bottom panel: either **Memphis milestone timeline** (when Memphis layers on, no site data) or **site change chart** (when a site animation has loaded data). |
| **TimelineGraphToggle** | Unchanged: user opens/closes the panel. |
| **Layer state** | Map passes “Memphis narrative layers on” (and optionally milestones) into the panel so it can choose narrative vs site-change view. |
| **Data** | New `memphisNarrativeTimeline` config (or JSON) for milestone rows; later align with MLGW/TVA timeline extraction (narrative doc §2). |
| **LayerToggle** | No required change; optional “Open timeline” entry for discoverability. |

This addresses the narrative doc’s **timeline** gap (who gets power when), **blueprint** and **constraint** (short copy in milestone view or Key bullets), and uses the existing TimelineGraphPanel so the Memphis story and site-level change share one place.

---

## 6. Order of implementation

1. **Add `memphisNarrativeTimeline` config** (or JSON) with placeholder milestones. — **Done:** `src/config/memphisNarrativeTimeline.js` with `MEMPHIS_MILESTONES` and `MEMPHIS_NARRATIVE_KEY_BULLETS`.
2. **Extend TimelineGraphPanel** with narrative mode: when no site data and `memphisMilestones` + Memphis layers on, render milestone table/strip and optional Key bullets. — **Done:** `showNarrativeMode`; milestone grid + key bullets; empty state suggests Memphis layers when applicable.
3. **Wire Map → panel:** pass `memphisLayersOn` and `memphisMilestones` (or load inside panel). — **Done:** Map derives `memphisLayersOn` from Memphis layer state; passes to `TimelineGraphPanel`; panel uses default milestones from config.
4. **Refine copy** from MLGW/TVA when timeline extraction (narrative doc analysis 2) is done.
5. **(Optional)** Add “Timeline” to LayerToggle and/or persist `showTimelineGraph` in scenes.
