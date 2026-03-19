# TX Master Data Center List — Build Instructions
**For: PHA Dev Team**  
**Date: March 2026**  
**Owner: Yair Titelboim**

---

## Context

We are building a single authoritative TX data center list that will serve as the foundation for Switchyard and, in the next phase, as the live asset registry for GridPulse/DSA. This list replaces the current static GeoJSON and the ad-hoc enrichment output.

**Two inputs. One output. One source of truth.**

---

## Source Files

| Role | Path | Description |
|------|------|-------------|
| **Base (primary)** | `/Users/yairtitelboim/Documents/Kernel/ALLAPPS/PHA/data/dc11.xlsx` | Commercial model — 338 TX facility records with precise lat/long, MW, tenant, gas provider, start date |
| **Enrichment (secondary)** | `/Users/yairtitelboim/Documents/Kernel/ALLAPPS/PHA/public/data/texas_data_centers.geojson.bak_20260307_073020` | 145 enriched records from Yair's scrape — announced_date, status, probability_score, source_count, and project_ids |

**Rule:** The Excel is the base. The GeoJSON enriches it. Never the other way around.

---

## Output Target

```
/Users/yairtitelboim/Documents/Kernel/ALLAPPS/PHA/data/tx_master_dc_list.json
```

Also export:
```
/Users/yairtitelboim/Documents/Kernel/ALLAPPS/PHA/public/data/texas_data_centers.geojson
```
(replaces the current live GeoJSON that Switchyard reads)

---

## Step 1 — Parse the Excel Base

Read `dc11.xlsx`, sheet `NA Data Center Supply`. The actual data rows start at **row 6** (0-indexed row 5). Headers are spread across rows 2–3.

The key column indices are:

```python
COLUMN_MAP = {
    'lat':              89,
    'long':             90,
    'state':            91,
    'city':             92,
    'zip':              93,
    'country':          95,
    'region':           96,
    'company':          97,
    'market':           98,
    'type':             99,   # 'hyperscalar' | 'colocation'
    'onsite_gas':       100,
    'end_user':         101,
    'tenant':           103,
    'uc_mw':            73,   # under construction MW
    'full_capacity_mw': 76,   # planned full capacity
    'planned_mw':       79,   # total planned MW
    'start_ops':        74,   # start of operations date
    'installed_q1_24':  83,   # installed capacity as of Q1 2024
}
```

**Filter:** Keep only rows where `state == 'Texas'`. There will be ~338 rows.

**Cluster:** Multiple rows often represent phases of the same facility (same company + same approximate lat/long). Cluster them:
- Round lat/long to 2 decimal places for grouping key
- Group by `(company, lat_rounded, long_rounded)`
- Within each cluster: sum `planned_mw`, `uc_mw`; take `first` for all other fields; collect all distinct `start_ops` dates; keep the earliest `start_ops` as `earliest_start_date`

Each cluster becomes one record. You should end up with **~124 clusters** after filtering to those with MW > 0.

Assign each cluster a stable `excel_id` using:
```python
import hashlib
excel_id = "ex_" + hashlib.md5(f"{company}|{lat_rounded}|{long_rounded}".encode()).hexdigest()[:8]
```

---

## Step 2 — Parse the GeoJSON Enrichment

Read the `.bak` GeoJSON file. It is standard GeoJSON format — `FeatureCollection` with `features[]`. Each feature has:

- `geometry.coordinates` — `[longitude, latitude]`
- `properties` — includes `project_id`, `company`, `city`, `status`, `announced_date`, `probability_score`, `source_count`, and other scraped fields

Extract all 145 features into a flat list. Keep all properties. Do not filter anything here.

---

## Step 3 — Match and Merge

For each GeoJSON record, attempt to find a matching Excel cluster using this priority order:

**Match strategy (try in order, stop at first match):**

1. **Coordinate proximity** — if the GeoJSON lat/long is within 0.05 degrees (~5km) of an Excel cluster centroid, it's a match. Use `haversine` or simple Euclidean on degrees.

2. **Company name fuzzy match within 50km** — normalize both names (lowercase, strip "data centers", "digital", "inc", "llc"), then check if one contains the other or `fuzz.ratio >= 85`.

3. **No match** — record goes into the `geojson_only` bucket.

For matched records, the merge rule is:

```
EXCEL fields always win for: lat, long, company, city, market, type, planned_mw, uc_mw, tenant, end_user, onsite_gas, start_ops
GEOJSON fields always win for: announced_date, status, probability_score, source_count, project_id
If a field is null/missing in the winning source, fall back to the other source.
```

---

## Step 4 — Handle Unmatched Records

**Excel clusters with no GeoJSON match:**
- Include them in the master list
- `data_source = "excel_only"`
- `project_id` = generate from `excel_id`: `"proj_" + excel_id`
- `status = "planned"` (default)
- `announced_date = null` (unless derivable from `start_ops` year)

**GeoJSON records with no Excel match:**
- Include them if they passed the original enrichment filter (i.e., they are legitimate TX projects)
- `data_source = "geojson_only"`
- Keep their existing `project_id`

---

## Step 5 — Schema Normalization

Every record in the master list must conform to this schema:

```json
{
  "project_id":        "string — existing GeoJSON id or generated",
  "excel_id":          "string or null — Excel cluster hash id",
  "data_source":       "excel_base | excel_geojson_merged | geojson_only",

  "company":           "string",
  "city":              "string",
  "state":             "TX",
  "market":            "string — e.g. 'Dallas/Fort Worth, Texas'",
  "type":              "hyperscaler | colocation | unknown",

  "lat":               "float",
  "long":              "float",

  "planned_mw":        "float or null",
  "uc_mw":             "float or null — under construction",
  "total_mw":          "float — planned_mw + uc_mw",

  "tenant":            "string or null",
  "end_user":          "string or null",
  "onsite_gas":        "string or null — gas/power provider name",

  "earliest_start_date": "ISO date string or null",
  "announced_date":    "ISO date string or null",

  "status":            "string — planned | under_construction | operational | unknown",
  "probability_score": "string or null — from enrichment",
  "source_count":      "int or null — from enrichment",

  "geocoding_needs_review": "bool — true if coordinates are default/rounded",
  "notes":             "string or null"
}
```

**Flag for geocoding review** any record where:
- lat/long are `0.0, 0.0`
- lat/long match the known default `31.503, -97.784` (the placeholder used in the enrichment run)
- lat/long are missing

---

## Step 6 — Write Outputs

### Master JSON
Write the full normalized list to:
```
/Users/yairtitelboim/Documents/Kernel/ALLAPPS/PHA/data/tx_master_dc_list.json
```

Structure:
```json
{
  "generated_at": "ISO timestamp",
  "version": "1.0",
  "record_count": N,
  "sources": {
    "excel_file": "dc11.xlsx",
    "geojson_file": "texas_data_centers.geojson.bak_20260307_073020"
  },
  "stats": {
    "excel_only": N,
    "geojson_only": N,
    "merged": N,
    "geocoding_needs_review": N,
    "with_tenant": N,
    "with_onsite_gas": N
  },
  "records": [ ... ]
}
```

### GeoJSON for Switchyard
Write the live GeoJSON to:
```
/Users/yairtitelboim/Documents/Kernel/ALLAPPS/PHA/public/data/texas_data_centers.geojson
```

This replaces the existing file. Each feature's `properties` should be the full normalized record (minus `lat`/`long` which go in `geometry.coordinates`).

---

## Step 7 — Validation

Run these checks and print a summary report before marking done:

```
✓ Total records: N
✓ Records with lat/long: N
✓ Records with planned_mw > 0: N
✓ Records with tenant: N
✓ Records with onsite_gas: N
✓ geocoding_needs_review: N
✓ Duplicate project_ids: 0 (must be 0)
✓ Records where lat == 0 or long == 0: N (should be 0 after flagging)
✓ data_source breakdown: excel_only=N, merged=N, geojson_only=N
```

Print the top 10 records by `total_mw` as a spot-check.

---

## Phase 2 — GridPulse / DSA Live Connection

This section is for awareness only — not part of the current build task. The dev team should design with this in mind.

### What Changes in Phase 2

The master list becomes a **live asset registry** in Supabase instead of a static JSON file. The `pulsesignal_assets` table already exists and already has 170 records seeded from the old GeoJSON. In Phase 2:

1. **Migrate `tx_master_dc_list.json` → `pulsesignal_assets`**  
   Run a migration script that upserts the master list into `pulsesignal_assets` using `project_id` as the key. New fields (`tenant`, `end_user`, `onsite_gas`, `planned_mw`, `uc_mw`, `excel_id`) need to be added to the table schema first.

2. **The linker gains new match fields**  
   `assets-linker.js` currently matches on county + company name. With `tenant` and `end_user` in the asset record, the linker can also match signals that mention a tenant company (e.g., an article about CoreWeave → links to the Poolside AI facility that CoreWeave occupies).

3. **The GeoJSON becomes a read-through cache**  
   Switchyard's map layer reads from `/public/data/texas_data_centers.geojson`. In Phase 2, this file is generated nightly by a cron job that reads `pulsesignal_assets` and writes the GeoJSON. The file itself becomes a cache artifact, not the source of truth.

4. **New records arrive via scanner, not manual updates**  
   When GridPulse's scanner detects a new TX data center announcement, it creates a new row in `pulsesignal_assets` directly. The nightly GeoJSON regeneration picks it up automatically.

### Schema Additions Needed for Phase 2

```sql
ALTER TABLE pulsesignal_assets
  ADD COLUMN IF NOT EXISTS excel_id         text,
  ADD COLUMN IF NOT EXISTS tenant           text,
  ADD COLUMN IF NOT EXISTS end_user         text,
  ADD COLUMN IF NOT EXISTS onsite_gas       text,
  ADD COLUMN IF NOT EXISTS planned_mw       double precision,
  ADD COLUMN IF NOT EXISTS uc_mw            double precision,
  ADD COLUMN IF NOT EXISTS total_mw         double precision,
  ADD COLUMN IF NOT EXISTS market           text,
  ADD COLUMN IF NOT EXISTS facility_type    text,
  ADD COLUMN IF NOT EXISTS geocoding_flag   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_source      text;
```

### Migration Script (Phase 2 — not now)

```
/Users/yairtitelboim/Documents/Kernel/ALLAPPS/PHA/scripts/migrate_master_to_supabase.js
```

This script reads `tx_master_dc_list.json` and upserts into `pulsesignal_assets`. Run after schema migration is applied.

---

## Dependency Summary

```
dc11.xlsx  ──────────────────────────────────────────────────────┐
                                                                  ▼
                                                        merge_tx_master.py
                                                                  │
texas_data_centers.geojson.bak_20260307_073020  ─────────────────┘
                                                                  │
                                          ┌───────────────────────┴──────────────────────┐
                                          ▼                                               ▼
                              tx_master_dc_list.json                    texas_data_centers.geojson
                              (source of truth)                         (Switchyard reads this)
                                          │
                               [Phase 2 migration]
                                          │
                                          ▼
                              pulsesignal_assets (Supabase)
                                          │
                                          ▼
                              GridPulse linker + scanner
```

---

## Script to Write

The dev team should write one script:

```
/Users/yairtitelboim/Documents/Kernel/ALLAPPS/PHA/scripts/build_tx_master.py
```

It should be **idempotent** — safe to re-run at any time. Each run regenerates both output files from scratch using the two source files. No manual editing of the output files.

Dependencies:
```
pip install pandas openpyxl fuzzywuzzy python-Levenshtein
```

Expected runtime: under 30 seconds.

---

## Questions to Resolve Before Starting

1. **Do the 145 GeoJSON records include records that were manually excluded** (non-TX, junk) — or is the `.bak` file the already-filtered set? Confirm with Yair before reading from it.

2. **Is dc11.xlsx the same file** as the Excel model analyzed in the diff session, or a trimmed export? If it's the same file, the `NA Data Center Supply` sheet applies. If it's a different export, check the sheet names first.

3. **Geocoding sprint** — 17+ records share a default coordinate. After the master list is built, a follow-up pass should geocode them using Google Maps Geocoding API or a similar service. This is a separate task from the merge script.

---

*End of instructions. Questions → Yair.*