# DSA — Data Center Siting Analytics (MVP Hook)

Deployment guide: [DEPLYMENT.md](./DEPLYMENT.md)

**Goal:** win a first meeting (and ideally a pilot) with a **utility’s Economic Development / Large Load Intake / Key Accounts** team by solving their highest-frequency problem:

> “We’re getting flooded with data center demand. Which projects are real, when will they actually hit, and what should we tell them (and our planners) right now?”

This MVP is intentionally **not** a power-flow replacement. It is a **project realism + intake triage + internal briefing** product.

---

## Target user (first)

**Primary user:** Utility Econ Dev / Large Load Intake / Key Accounts manager
- Manages inbound developer conversations
- Needs defensible, consistent answers
- Needs a weekly view of “what’s coming” to align internal stakeholders

**Secondary users (later):** Distribution planning, transmission planning, interconnection teams

---

## MVP Hook (one sentence)

**A probabilistic demand pipeline + readiness scoring system for data center requests that produces an internal weekly brief and a planner-ready handoff packet.**

---

## The 3 MVP deliverables (what we ship first)

### 1) **Project Intake Record (single page per request)**
A structured page that turns an email / call into a standardized record.

Fields (minimum viable):
- Project name (internal)
- Developer / sponsor (if known)
- Location: address / parcel / lat-lng; county; nearest substation (if known)
- Requested load: MW (target), voltage level (if known), ramp / phases (if known)
- Target COD window (developer claimed)
- Status: lead → active → signed → construction → energization
- Notes + attachments

Outputs:
- A **one-page “handoff”** view that can be forwarded to planning.

### 2) **Demand Realism Score + COD Probability (the hook)**
For each project, produce:
- **Realism score (0–100)** (explainable)
- **COD distribution**: P50 / P90 energization date
- **Phasing curve**: MW over time (best guess)

Explainability (must-have):
- Show the top 3–6 drivers (not black box):
  - site control / land status
  - permitting stage
  - public signals / contractor activity
  - financing / partner signals
  - repeat developer track record
  - interconnection engagement maturity

Important: even if early scoring is heuristic/manual, it must be **consistent** and **auditable**.

### 3) **Weekly Internal Brief (auto-generated)**
A single PDF/email-style brief that a director can forward.

Sections:
- Expected incremental load (P50/P90) next 6/12/24 months (by region/zone)
- Top 10 projects by “real near-term MW”
- What changed this week (new leads, upgraded probability, slipped COD)
- Top risks (single-point clusters, asset lead-time red flags)
- “Decisions needed” (e.g., start substation design, transformer procurement)

---

## User flow (MVP)

1) **Create record** during/after a developer call
2) System assigns **Realism score** + initial COD distribution
3) User edits/overrides with notes (always allowed)
4) User exports:
   - **Planner handoff packet** (one page)
   - **Weekly brief** (compiled from all active projects)

---

## What we explicitly do NOT do (in MVP)

- We do **not** claim to compute real AC power flow results.
- We do **not** show “hosting capacity” at substation-level unless sourced/approved.
- We do **not** promise feasibility; we frame outcomes as **demand likelihood + timing**.

This keeps the product aligned with your background (site/dev reality) and avoids immediate utility engineering skepticism.

---

## Data model (minimal)

### Entities
- `Project`
- `Organization` (developer/sponsor)
- `Site` (location, parcel/address)
- `Signal` (evidence items that influence realism)
- `Assessment` (score, COD distribution, phasing)
- `Brief` (weekly snapshot)

### Signals we can support immediately (manual-friendly)
- Permit status (none / submitted / approved)
- Land control (unknown / option / owned)
- Utility engagement stage (intro / data request / study request / agreement)
- Public evidence links (news, RFPs, contractor postings)
- Construction indicator (none / mobilized / vertical)

---

## Analytics & success criteria (pilot-ready)

### Engagement
- # projects created per week
- % projects with complete core fields
- # weekly briefs generated

### Quality (what matters)
- Do internal stakeholders accept the realism score?
- Does it reduce planner thrash (fewer “zombie” studies)?
- Are COD forecasts directionally correct after 8–12 weeks of backtesting?

### Key KPI for the hook
**“Planner time saved”** proxy:
- % of inbound projects triaged as low-likelihood before engineering deep dive
- # projects reclassified up/down each week (shows learning loop)

---

## MVP UI (two screens + export)

1) **Pipeline View**
- Table: Project, Region, Requested MW, Realism score, P50/P90 COD, Status, Last updated
- Filters: region, status, score bands, COD window

2) **Project Detail**
- Core fields
- Signals checklist + evidence links
- Assessment panel (score + COD + phasing)
- Buttons:
  - “Export planner packet”
  - “Include in weekly brief”

3) **Weekly Brief Export**
- Auto-generated formatted page(s)

---

## Why this is the right wedge

- Utilities are overwhelmed by **speculative load**.
- Econ Dev / intake teams need a consistent, defensible way to say:
  - “this is real” vs “this is noise”
  - “here’s when to plan”
- Once trusted, this dataset becomes the upstream input to:
  - hosting capacity planning
  - substation prioritization
  - procurement lead-time decisions

---

## Phase 2 expansions (once the hook lands)

- Cluster detection: correlated projects hitting the same corridor/substation region
- Upgrade lead-time tracker: transformers, breakers, substation builds
- Public resilience proxy layer (scenario-based) for external storytelling
- Integrations: CRM, permitting, GIS, ISO queue where available

---

## Data

**Texas data centers (Switchyard map):** The map layer uses `public/data/texas_data_centers.geojson`. This file is **derived** — do not edit it directly. The source of truth is `data/tx_master_dc_list.json`, produced by the build script from Excel + enrichment inputs. To regenerate the GeoJSON after updating master data, run:

```bash
npm run build:geodata
```

Anyone who updates the master data should run `npm run build:geodata` before committing. The GeoJSON includes a root `_metadata` property (`generated_at`, `generated_from`, `version`, `record_count`) so you can confirm it was regenerated from the current master (e.g. compare `_metadata.generated_at` with the master list timestamp).

---

## Next steps (implementation checklist)

- [ ] Define the initial scoring rubric (10–15 points, weighted, explainable)
- [ ] Create the two UI screens (Pipeline + Project)
- [ ] Implement export: planner packet + weekly brief
- [ ] Add backtesting log: when score changes and why
- [ ] Identify 1–2 design partners (Econ Dev / intake) to validate fields and outputs
