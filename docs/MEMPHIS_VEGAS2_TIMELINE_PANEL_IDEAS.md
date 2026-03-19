# Adopting VEGAS2 Timeline Panel Ideas in MEM

**Source:** [VEGAS2/docs/TIMELINE_GRAPH_GEOAI_README.md](../../../VEGAS2/docs/TIMELINE_GRAPH_GEOAI_README.md) and VEGAS2 `TimelineGraphPanel.jsx`.

---

## What VEGAS2 Does Creatively

1. **Event-driven legend → map**
   - Clicking a series in the timeline legend emits `timeline:legendFocus` with `{ siteKey, seriesKey, label, color, active }`.
   - Map change layers (e.g. Harris, VinFast, Wolfspeed) subscribe and highlight that category (dim others, emphasize one).
   - **MEM:** Already has this: `TimelineGraphPanel` emits `timeline:legendFocus`; Harris, PaNuclear, LakeWhitneyDam, etc. listen. Memphis Colossus change layer could subscribe too to highlight change classes when the user has site-change data in the panel.

2. **Breakdown / detail card on click**
   - Vegas viewport mode shows a horizontal “pressure” scale with a dynamic marker and a **category label** above it. Clicking the label opens a **breakdown card** (positioned above the marker) with “Viewport Breakdown”, total, and per-category breakdown. Card has fadeIn animation and click-outside to close.
   - **MEM:** We don’t have viewport pressure data. We can reuse the **pattern**: in narrative mode, make each **milestone card** clickable; on click, show a small popover/card with the full `detail` text (and optional link). That mirrors “click to expand” and avoids truncation.

3. **Pulse / halo animations**
   - Vegas injects `<style>` with keyframes: `pulseGlow`, `markerSnapPulse`, `textSnapPulse`, `barFatPulse`, `fadeIn`. Used when playback advances or threshold is crossed (marker and label pulse).
   - **MEM:** We can add a light touch: e.g. **fadeIn** when the narrative panel first shows, or a very subtle pulse on the key bullets. Keeps the panel feeling responsive without Vegas-specific logic.

4. **ReferenceArea / ReferenceLine**
   - Vegas uses Recharts `ReferenceArea` (blue tint) and `ReferenceLine` (yellow dashed line) for the active playback period. **MEM** already does this in site-change mode. No change.

5. **CustomTooltip**
   - Vegas tooltip supports water policy units, SNWA restrictions, and formatted totals. **MEM** tooltip is already adequate; we can align styling or units formatting if we add new data types later.

6. **Snapshot vs timeline vs viewport**
   - Vegas has multiple “modes”: multi-period timeline (bars over time), single snapshot (category bars), viewport (pressure scale + marker + breakdown card). **MEM** already has two modes (site-change chart vs narrative milestones). The idea of “different layout for different content” is the same.

---

## What We’re Reusing in MEM

| Idea | Use in MEM |
|------|------------|
| **Legend → map** | Already wired. Optionally have MemphisColossusChangeLayer subscribe to `timeline:legendFocus` when Colossus timeline data is shown so legend clicks highlight change classes on the map. |
| **Click-to-expand card** | Make narrative milestone cards clickable; on click show a small “detail” popover with full text (and optional link). Reuses Vegas’s breakdown-card pattern for our milestone content. |
| **fadeIn on show** | Add a short CSS fadeIn (or slide-up) when the narrative block mounts so the milestone row doesn’t pop in abruptly. |
| **Keyframes in panel** | If we add pulse/fadeIn, inject a minimal `<style>` block in TimelineGraphPanel (narrative section only) to avoid polluting global CSS. |

---

## Implementation Status

- **Legend focus:** Already in MEM; extend to Memphis Colossus change layer if/when we drive timeline from Colossus animation.
- **Milestone detail popover:** Add in TimelineGraphPanel narrative block: click on a milestone card toggles expanded state; render a small card (breakdown-card style) with full `detail` and optional `source_url` link.
- **Entrance animation:** Add `fadeIn` or `slideUp` to the narrative milestone row when `showNarrativeMode` is true (e.g. 0.25s ease-out).
