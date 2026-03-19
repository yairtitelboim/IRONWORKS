# CTA Strategy (4–6 week test) — Switchyard (PHA)

This document defines the **call-to-action hierarchy** for the Location experience so users always have a clear “what next?” path, without adding heavy complexity.

Scope:
- Location search → Location card (mobile-first)
- The goal is to learn what ICPs gravitate toward using lightweight instrumentation.

---

## 1) The CTA Set

We will ship **one primary CTA** and **two secondary CTAs**.

### Primary CTA (WOW)
**Nearby data centers (carousel)**

- A visual carousel of nearby/related data centers.
- Tap a card → fly to that site + open its detail.

Why this is primary:
- Immediately legible to unknown personas.
- Creates instant “holy shit” moments ("I didn’t know that was here").
- Encourages exploration without requiring domain expertise.

### Secondary CTA #1
**Risk review**

- Intent: “Can this location realistically get power?”
- Uses deterministic ERCOT / queue / substation signals.

### Secondary CTA #2
**Underwrite (Pencil / quick DCF)**

- Intent: “What would this need to pencil?”
- Kept behind a button and labeled as directional/beta.
- Great as a probe to discover if users want underwriting.

---

## 2) UI Placement Rules (mobile-first)

### Rule A — Don’t present 3 equal-weight large CTAs
Avoid a wall of big cards that all look primary.

### Recommended layout
1. **Header:** short verdict + drivers (from `UI_IMPROVEMENTS.md`)
2. **Primary surface:** Nearby data centers carousel
3. **Action row:** two buttons side-by-side
   - `Risk review`
   - `Underwrite`

Optional tertiary actions (smaller):
- Copy link
- Copy site brief
- Open source (↗)

---

## 3) Copy / naming guidelines

Use user-facing language, not internal terms.

Good:
- “Nearby data centers”
- “Risk review”
- “Pencil this site”

Avoid:
- “Interconnection workflow”
- “GeoAI”
- “MCP”

---

## 4) Instrumentation (minimum viable)

Log events (Supabase or existing analytics pipeline):

- `location_search_performed`
  - fields: `lat_lng_rounded`, `geocode_source`, `query_length`

- `carousel_shown`
  - fields: `count`

- `carousel_item_clicked`
  - fields: `rank`, `dc_id` (or name), `distanceMi`

- `risk_review_clicked`

- `underwrite_clicked`

Optional:
- `copy_link_clicked`
- `copy_brief_clicked`
- `external_source_clicked`

Privacy:
- Round coordinates (3–4 decimals).
- Do not store raw free-text addresses.

---

## 5) Success Metrics (what we’ll look at)

For each `location_search_performed`, track within 15 seconds:
- % that click carousel
- % that click risk review
- % that click underwrite

This tells us what ICPs actually value:
- exploration (carousel)
- power diligence (risk)
- valuation (underwrite)

---

## 6) Implementation Notes

- Keep the carousel independent of the risk/underwrite flows.
- If carousel data is missing/slow, show a placeholder state rather than removing the CTA.
- Underwrite stays optional and should never block the main location experience.
