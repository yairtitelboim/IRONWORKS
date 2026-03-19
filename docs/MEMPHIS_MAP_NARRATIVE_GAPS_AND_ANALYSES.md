# Memphis Map: Narrative Gaps & Recommended Analyses

**Goal of the map:** Make the analysis obvious: constraint isn’t TVA generation—it’s **firm power contracts** and **MLGW delivery timing**. Construction sequencing decides who energizes first. xAI got in early; next projects face 18–36 months + board. Market should price on “firm power + substation proximity,” not “cheap TVA.”

**Map today:** [Memphis + MLGW FY2026 substation work + xAI sites + xAI→substation lines + Colossus change + permits + DeSoto parcel]

---

## What We Have (Layer Toggle)

| Layer | What it shows |
|-------|----------------|
| Memphis Counties | Shelby / region boundary |
| AI Power Expansion | Memphis AI expansion (if separate from xAI) |
| **MLGW FY2026 Substation Work** | Substation points + **advantage zone** (2 km buffer/hull), project names |
| **xAI Sites (Public)** | Colossus (5420 Tulane), 2400 Stateline, 2875 Stanton |
| **xAI → Nearest MLGW Substation** | Lines + distance (km) from each xAI site to nearest FY2026 substation |
| Memphis Colossus Change (2023→2024) | Landcover change at Colossus |
| Memphis Colossus top parcels (Shelby) | Parcels with most change overlap |
| Memphis/DPD permits (5km Colossus, Shelby) | 937 permits |
| DeSoto/Southaven permits (5km Colossus, MS) | 510 permits |
| DeSoto Stateline parcel | 2400 Stateline Rd W parcel boundary |

We **do not** currently show: scale (MW, phases), timeline (who energizes when), the “blueprint” (150 MW, DR, board), or the 12–18 vs 24–36 month geography in plain language.

---

## 1. What’s Missing (To Make the Post + Map Sharp)

### A. Scale and phases on the map

- **Post:** “2 GW push — third building plus Southaven.” “xAI’s first 150 MW … board-level approval.”
- **Map:** No MW, no phase labels. A reader can’t see “which site is the 150 MW” or “third building vs Southaven.”
- **Fix (data + UI):**
  - Add to xAI sites GeoJSON (or config): `phase`, `capacity_mw`, `narrative` (e.g. “Phase 3 / Colossus”, “Southaven – Stateline”, “150 MW TVA board approval” for the first site).
  - In **xAI site popups** (and optionally labels): show “Colossus (Phase 3)”, “Stateline (Southaven)”, “Stanton (Southaven)” and, where known, “~150 MW approved” / “2 GW push” so the scale is visible without reading the post.

### B. Timeline and “who gets power when”

- **Post:** “MLGW 2026 budget: substation expansion starts this year.” “Sites near MLGW planned expansions: 12–18 month advantage. Sites needing new substations: 24–36 months + board.”
- **Map:** We show *which* substations have FY2026 work and an “advantage zone,” but we don’t say *when* they energize or what “advantage” means.
- **Fix (data + UI):**
  - **Substation popups:** Add a line like “FY2026 → construction starts 2026; energization typically 12–18 months” (if we can source it), or “Part of MLGW 2026 expansion; timing drives who gets power first.”
  - **Advantage zone:** Label it in the UI (legend or one-off callout): “Within this zone: sites near planned MLGW expansion → **~12–18 month** advantage. Outside: **~24–36 months** + TVA board approval.”
  - Optional: second zone or buffer for “new substation needed” (e.g. beyond 5 km from any FY2026 sub) and label “24–36 months + board uncertainty.”

### C. The “blueprint” (150 MW, DR, board)

- **Post:** “TVA treated xAI’s first 150 MW as board-level approval: demand response required, new substation needed, reserve margin conditions. That’s the blueprint.”
- **Map:** Not stated anywhere. So “same process, 18–36 months, board approval” for the next project is not grounded on the map.
- **Fix (UI + optional data):**
  - **Narrative callout** (small panel or card when Memphis/MLGW/xAI are on): 1–2 sentences: “xAI’s first 150 MW required TVA board approval, demand response, and new substation. Next large loads: same process, 18–36 months.”
  - Or add to the **Colossus (or first xAI) site popup**: “150 MW TVA board approval; DR + new substation + reserve margin (blueprint for future projects).”

### D. Constraint and pricing takeaway

- **Post:** “Constraint isn’t TVA generation. It’s firm power contracts and MLGW delivery timing.” “Market pricing Memphis on ‘cheap TVA power.’ Should price on ‘firm power contract + substation proximity.’”
- **Map:** We show substation proximity and xAI→substation links, but we don’t state the **constraint** or the **correct pricing frame**.
- **Fix (UI):**
  - **Legend or “Key”** near the Memphis/MLGW/xAI layers: “Constraint: firm power + MLGW delivery timing. Price driver: substation proximity (12–18 mo vs 24–36 mo), not just ‘cheap TVA.’”
  - Could live in the same narrative callout as the blueprint.

### E. Who else is in the queue (optional but strong)

- **Post:** “Next projects: same process, 18–36 months, board approval.”
- **Map:** We don’t show other large loads or proposed projects that would compete for the same substations.
- **Fix (analysis + layer):**
  - Identify other **large industrial / data center / big commercial** loads in the corridor (permits, news, TVA/MLGW filings, real estate) that would also need firm power and substation capacity.
  - Add a layer: “Other large loads (competing for same substations)” so “next projects” is visible on the map.

---

## 2. Recommended Analyses (In Order of Impact)

### 1) Add narrative fields to existing GeoJSON (no new geometry)

- **xAI sites:** Add `phase`, `capacity_mw`, `narrative` (e.g. “Phase 3”, “150 MW board approval”, “2 GW push”).
- **MLGW 2026 substations:** Add `timeline_note` or `energization` (e.g. “FY2026 start → 12–18 mo”) if you can pull from budget book or board docs.
- **Output:** Update `xai_sites_public.geojson` and `mlgw_2026_substation_work.geojson` (or a small `memphis_narrative_config.json` that the map reads).
- **Map change:** Popups and optional labels show scale + timeline; no new layers.

### 2) Extract timeline from MLGW / TVA documents

- **Source:** MLGW 2026 Budget Book, TVA board minutes or press releases (xAI 150 MW approval, substation-related items).
- **Output:** Simple table or JSON: substation id/name, FY, expected start, expected energization (if any); xAI 150 MW approval date.
- **Map change:** Substation popups + narrative callout use this so “12–18 month advantage” and “construction sequencing” are grounded in a citable timeline.

### 3) Label the advantage zone and add “24–36 month” geography

- **Data:** We already have the advantage zone (2 km around FY2026 substations). Optionally: buffer “far from any FY2026 sub” (e.g. >5 km) as “new substation likely needed.”
- **Output:** Same GeoJSON; add a `label` or use existing polygon. No new analysis unless we add the “far” zone.
- **Map change:** Legend or on-map label: “Within blue zone: ~12–18 month advantage. Outside / new substation needed: ~24–36 months + board.”

### 4) Narrative panel or “Key” for Memphis story

- **Content:** 2–4 short bullets: constraint = firm power + MLGW timing; 150 MW blueprint; 12–18 vs 24–36 months; price on substation proximity.
- **Implementation:** Small collapsible panel or card that appears when “Memphis” or “MLGW” or “xAI” layers are on; or a static “Key” in the legend.
- **No new data;** copy derived from the post + (2).

### 5) Other large loads in the corridor (competition for same substations)

- **Source:** Permit data (large COM/industrial), news, TVA/MLGW filings, commercial real estate.
- **Output:** Points (or polygons) with name, type, approximate load or status, and “nearest FY2026 substation” + distance.
- **Map change:** New layer “Other large loads” so the map shows “who else is in the queue” and makes “next projects: same process” concrete.

### 6) Optional: Simple “timeline” strip or table

- **Content:** One row per major milestone: “xAI 150 MW TVA board approval (date)”; “MLGW FY2026 substation work starts”; “Typical energization 12–18 mo”; “Next large loads: 18–36 mo + board.”
- **Implementation:** Small timeline component or table in a side panel/card, driven by the same JSON as (2).

---

## 3. Summary: One-Sentence Additions

| Gap | One-sentence fix |
|-----|-------------------|
| Scale | Put “Phase 3”, “Southaven”, “150 MW”, “2 GW push” on xAI sites (popups/labels). |
| Timeline | Add “12–18 mo” / “24–36 mo” to substation popups and label the advantage zone. |
| Blueprint | Add a short callout: “150 MW = board + DR + new substation (blueprint for next projects).” |
| Constraint / pricing | Add key: “Constraint: firm power + MLGW timing. Price on substation proximity.” |
| Competition | Add layer “Other large loads” so “next projects” is visible. |

**Highest leverage with least new data:** (1) narrative fields in existing GeoJSON + (4) narrative panel. Then (2) timeline extraction and (3) advantage-zone labels. Then (5) other large loads if you want “who gets power next” to be fully visible on the map.
