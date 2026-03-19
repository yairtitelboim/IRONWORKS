# Vertical narrative panel (scrollable story container)

**Reference:** Map UIs that pair a narrative panel (right side) with the map — e.g. title, legend, source, and scrollable paragraphs that explain the data (Ruhr Valley, dams, munitions, flight paths). Content scrolls vertically inside the panel.

---

## IF we can add it

**Yes.** The map already has:
- **Left:** LayerToggle (collapsible).
- **Bottom:** TimelineGraphPanel (horizontal timeline / milestones).
- **Right:** TimelineGraphToggle button (bottom-right); cards can appear.

A **right-side vertical narrative panel** fits without conflicting:
- Fixed right edge, fixed width (~300–360px), full height (or minus bottom timeline when open). It overlays the map or can sit in a column; overlay keeps map full width on small screens.
- Content is scrollable (`overflow-y: auto`) so multiple sections (headings + body text) can scroll past as the user reads.
- Can be **collapsible** (open/close via a “Story” or “Narrative” control) so it doesn’t permanently consume space. When closed, only a small button remains (e.g. next to “Show Graph”).

**When to show:** When the user opens “Story” / “Narrative”, or optionally when any Memphis-story layer is on (auto-open). Prefer a dedicated toggle so the user controls visibility.

---

## HOW we add it

### 1. Content

- **Source:** Config-driven (e.g. `MEMPHIS_NARRATIVE_SECTIONS` in `memphisNarrativeTimeline.js` or a dedicated config). Each section: `{ id, title, body }`. Body can be a string or array of paragraphs.
- **Copy:** Same narrative as the timeline + gaps doc: constraint (firm power + MLGW timing), blueprint (150 MW, DR, new substation), who gets power when (12–18 vs 24–36 mo), price on substation proximity. Optionally a short intro and source/attribution at the bottom.

### 2. Component

- **NarrativePanel.jsx:**
  - Props: `visible`, `onClose`, `sections` (from config), optional `title` (e.g. “Memphis: power & delivery”).
  - Layout: Fixed position, right: 0, top: 0, bottom: 0 (or bottom: 300px when timeline is open so it doesn’t sit under the timeline). Width 320–360px. z-index below modals but above map (e.g. 1500).
  - Header: title + close button.
  - Body: scrollable container (`overflow-y: auto`, flex: 1, minHeight: 0`) with sections rendered as `<section>` or `<div>` (heading + body). Same dark theme as TimelineGraphPanel.
  - Optional: legend or key bullets at top (e.g. “Constraint: firm power + MLGW delivery”) then scrollable sections below.

### 3. Map wiring

- **State:** `showNarrativePanel` (boolean). Default false.
- **Toggle:** A “Story” or “Narrative” button in the same area as TimelineGraphToggle (bottom-right). Stacked vertically (Story above Graph) or side-by-side so both are one click away.
- **Render:** `<NarrativePanel visible={showNarrativePanel} onClose={() => setShowNarrativePanel(false)} sections={MEMPHIS_NARRATIVE_SECTIONS} />`. When timeline is open, panel `bottom` can be set to 300px so it doesn’t overlap the timeline strip.

### 4. Optional enhancements

- **Auto-open:** When `memphisLayersOn` becomes true, set `showNarrativePanel` to true once (e.g. via useEffect with a ref so it only auto-opens once per session).
- **Scene persistence:** If scenes save UI state, include `showNarrativePanel` so “Memphis story” scenes can reopen with the narrative panel open.
- **Per-scene or per-view content:** Later, `sections` could depend on current scene or active layers (e.g. Colossus vs Southaven) so the narrative updates with the view.

---

## Summary

| Aspect | Choice |
|--------|--------|
| **IF** | Yes; right-side vertical panel fits current layout. |
| **Content** | Config-driven sections (title + body), scrollable. |
| **Component** | NarrativePanel: fixed right, scrollable body, header + close. |
| **Control** | Dedicated “Story” / “Narrative” toggle (e.g. next to TimelineGraphToggle). |
| **Layout** | Panel bottom aligns with top of timeline when timeline open (bottom: 300px), else full height. |

This gives a single vertical “story” container that scrolls past the screen as the user reads, matching the reference pattern and complementing the horizontal timeline at the bottom.
