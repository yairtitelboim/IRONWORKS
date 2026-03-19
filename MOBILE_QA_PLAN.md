# Mobile QA Plan — Switchyard (PHA)

Scope: https://switchyard-six.vercel.app/ in mobile viewport (tested at ~390×844).

Goal: Fix the highest-friction UX issues that block adoption during the 4–6 week test. Keep it lightweight, reliable, and obviously valuable for first-time users.

Primary ICP lens for this QA pass: **site selector / broker / early-stage DC developer** evaluating a location quickly.

---

## TL;DR Priority Order

**P0 (must-fix):**
1) Duplicate Scenes UI / panel clutter
2) Bottom sheet overlaps attribution + info button
3) Mode confusion: Flow/tools controls feel like they disappear

**P1 (high impact):**
4) Search bar oversized on mobile
5) County/location card typography + spacing
6) Tap-target conflicts / map label noise

**P2 (nice):**
7) Attribution default state polish

---

## P0 — Must Fix

### 1) Duplicate “Saved Scenes” UI / panel clutter

**Observed**
- “Saved Scenes” appears duplicated (two headings/controls in DOM: multiple close buttons + save inputs).
- On mobile, this creates clutter and can cause focus/z-index and interaction confusion.

**Why it matters**
- First-time users (especially on mobile) interpret this as a buggy prototype.

**Fix**
- Ensure only **one** Scenes panel instance renders.
- On mobile: default to **collapsed/hidden**. Require explicit user action to open.
- Consider merging “Scenes” and “Layers” into a single “Tools” drawer on mobile.

**Acceptance Criteria**
- Only one Scenes/Layers panel exists in the DOM at a time.
- On first load (mobile), map is clean (no panels open).

---

### 2) Bottom sheet overlap with Mapbox attribution + info button

**Observed**
- When the location/county bottom sheet is visible, the Mapbox attribution UI and bottom-right info button compete for the same bottom area.
- Risk of partially covered controls and mis-taps near the iOS home indicator.

**Fix**
- Add safe-area-aware bottom padding for the sheet.
- Reposition or hide the bottom-right info button while the sheet is open.
- Keep attribution accessible without overlap (e.g., move it up or collapse it under a tap).

**Acceptance Criteria**
- With the sheet open, no controls are partially covered.
- Bottom-right buttons remain tappable; no overlap with the home indicator.

---

### 3) Mode confusion — “Flow” / tools feel like they disappear

**Observed**
- After onboarding and interactions, some controls become hard to find or feel like they “vanished.”

**Fix**
- Provide a single persistent entry point (e.g. a “Tools” button) that toggles Layers/Scenes/Flow.
- Avoid tiny edge buttons that compete with map gestures.

**Acceptance Criteria**
- A user can always complete: Search → view result → close → search again.
- There is always a clear path to re-open Tools and Search.

---

## P1 — High Impact Improvements

### 4) Search bar is oversized / visually heavy on mobile

**Observed**
- Search bar consumes a lot of vertical real estate; styling reads like a modal.

**Fix**
- Reduce height/padding at the mobile breakpoint.
- Soften glow/border.
- Consider collapsing secondary icons into a menu.

**Acceptance Criteria**
- More map visible above the fold.
- Search remains clearly the primary action.

---

### 5) County/location card typography + spacing

**Observed**
- Dense, run-on text (e.g. “Dallas County446 projects…”) indicates spacing/line-break issues.

**Fix**
- Force a structured layout:
  - Title line
  - Subtitle (projects, GW)
  - Then 2-column key/value rows or bullets (Dominant fuel, Baseload/Renewable/Storage, DC count, etc.)

**Acceptance Criteria**
- No run-on text.
- Key metrics readable at a glance without scrolling.

---

### 6) Tap-target conflicts / map label noise

**Observed**
- Many overlapping labels (“1y ago”, “7mo ago”), clusters, white point markers, ring, etc.
- On mobile this increases accidental selections.

**Fix**
- When the bottom sheet is open/expanded: reduce or hide non-essential label layers.
- Increase hit tolerance for intended interactive layers.

**Acceptance Criteria**
- Tapping intended targets selects the intended features.
- Visual noise drops when a sheet is open.

---

## P2 — Nice-to-have

### 7) Attribution default state

**Observed**
- Attribution expanded adds UI noise.

**Fix**
- Default collapsed; expand only on tap.

**Acceptance Criteria**
- Attribution is unobtrusive by default.

---

## ICP Walkthrough (60-second test)

Persona: **site selector / broker / early-stage dev**.

Success looks like:
1) User types an address/city and instantly sees a verdict.
2) They understand the constraint (queue/sub) in <10 seconds.
3) They know what to do next (e.g., “Better nearby sites”).
4) They can share the result (copy link / brief).

This plan pairs with `UI_IMPROVEMENTS.md` (scorecard + share + “Closest Power Opportunity”).

---

## Suggested Next Sprint Order

1) P0 items (panels, overlap, persistent tools)
2) Card typography + mobile styling
3) Reduce noise when sheet open
4) Implement “Better nearby sites” + share buttons

---

## Notes

- This plan assumes no paid AI calls per search and no live-web crawling on search.
- Prefer deterministic metrics from Supabase via KV-cached API routes.
