# Request for Clawdbot: DeSoto / Southaven building permits (5km Colossus, MS side)

**Goal:** Get building permits for the **Mississippi (DeSoto County / Southaven)** portion of the 5km Colossus AOI so the map can show permits on both sides of the state line.

---

## Context

- The map layer **“Memphis/DPD permits (5km Colossus, Shelby side only)”** uses DPD (Memphis) building permits and only covers the **Tennessee** part of a 5km circle around Colossus.
- The **other half** of that circle is in **DeSoto County, MS** (Southaven, etc.). Permits there come from a different jurisdiction (DeSoto County and/or Southaven permit systems), not DPD.
- We already have a DeSoto parcel for the xAI Stateline site (2400 Stateline Rd W) in `desoto_parcel_2400_stateline_2025.geojson`. There is a placeholder `desoto_permits_stateline_none_found.geojson` from a prior attempt that found no permits for that single address—this request is different: we need **all building permits within the 5km circle that fall in Mississippi**, not just at one address.

---

## What to do

1. **Define the AOI (same as Memphis permits):**
   - **Center (lon, lat):** `-90.0348674`, `34.9979829` (Colossus = 5420 Tulane Rd, Memphis).
   - **Radius:** 5000 meters.
   - **Filter:** Only permits whose location falls **inside DeSoto County / Mississippi** (i.e. the MS portion of the circle). If the permit source is DeSoto-wide or Southaven-specific, use whatever geographic filter that source provides (e.g. DeSoto County boundary, or Southaven + any other MS jurisdictions within 5km).

2. **Data source:**  
   Use whatever official or authoritative source you normally use for **DeSoto County** and/or **Southaven, MS** building permits (e.g. county/city permit portal, EnerGov, ArcGIS feature service, etc.). If no single “building permits” API exists, describe what you used and how you filtered to “building permits” and to the 5km MS area.

3. **Output format:**  
   Produce a **GeoJSON FeatureCollection** of **Point** features, one per permit, so we can drop it into a map layer next to the existing DPD permits layer.

   **Suggested properties** (match DPD where possible so the same popup can be reused):
   - `Record_ID` or equivalent permit identifier
   - `Address`
   - `Valuation` (numeric, if available)
   - `Description` or similar (short text)
   - `Sub_Type` or type (e.g. RES, COM, or local equivalents)
   - `Issued_Date` (ISO or timestamp if available)
   - `City`, `ZIP_Code` or equivalent if available

   **Metadata** in the GeoJSON root (e.g. `metadata`):
   - `layer_type`: `"permits"`
   - `geography`: e.g. `"DeSoto County, MS"` or `"Southaven, MS"`
   - `source`: name of the permit system/site
   - `source_url`: URL if applicable
   - `created`: date you generated the file (e.g. ISO)
   - `feature_count`: number of features
   - `notes`: e.g. `["Queried within 5000m of Colossus center (-90.0348674, 34.9979829), Mississippi portion only."]`

4. **Where to save (MEM repo):**
   - **Path:**  
     `MEM/public/data/memphis_change/desoto_building_permits_near_colossus_5000m.geojson`
   - **Full path:**  
     `/Users/yairtitelboim/Documents/Kernel/ALLAPPS/MEM/public/data/memphis_change/desoto_building_permits_near_colossus_5000m.geojson`

   If no permits are found, you may instead save a small GeoJSON with `"features": []` and put the explanation in `metadata.notes` (e.g. “No DeSoto/Southaven permits found within 5km” or “Source X does not provide geometry”).

---

## Reference: DPD permits structure (for schema alignment)

The Memphis-side file is:

- **Path:**  
  `MEM/public/data/memphis_change/dpd_building_permits_near_colossus_5000m_recent.geojson`
- **Sample properties:**  
  `Record_ID`, `Issued_Date`, `Sub_Type`, `Construction_Type`, `Valuation`, `Address`, `Description`, `City`, `ZIP_Code`
- **Geometry:**  
  `Point` with `[lng, lat]`

Matching these names where possible will allow reusing the same popup/layer code for DeSoto permits.

---

## Checklist (Clawdbot)

- [ ] Identify DeSoto County / Southaven building permit source(s).
- [ ] Query permits within 5km of `-90.0348674, 34.9979829` for the **Mississippi** side only.
- [ ] Export to GeoJSON (Point features, properties as above).
- [ ] Save to `MEM/public/data/memphis_change/desoto_building_permits_near_colossus_5000m.geojson`.
- [ ] If none found, save empty FeatureCollection with explanation in `metadata.notes`.

Once this file exists, we will add a map layer **“DeSoto/Southaven permits (5km Colossus, MS side)”** that loads it alongside the existing Memphis/DPD permits layer.
