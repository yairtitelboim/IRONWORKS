# Instructions for the bot that builds the Memphis Colossus “top changed parcels” file

Use these steps so the parcel ranking output matches the map (Colossus at 5420 Tulane) and stays in sync with the change layer.

---

## 1. Use the correct change GeoJSON

The parcel ranker must use the **same** change GeoJSON as the map layer. That file must be generated with the **Colossus site** as the AOI center (5420 Tulane Rd), not an older/wrong center.

- **Correct change file (MEM):**  
  `MEM/public/data/memphis_change/memphis_colossus_2023-01-01_2023-12-31__2024-01-01_2024-12-31.geojson`
- **Full path:**  
  `/Users/yairtitelboim/Documents/Kernel/ALLAPPS/MEM/public/data/memphis_change/memphis_colossus_2023-01-01_2023-12-31__2024-01-01_2024-12-31.geojson`

If that file does not exist or was not generated with center `-90.0348674, 34.9979829`, run the change exporter first (see `scripts/README_MEMPHIS_CHANGE.md` in MEM).

---

## 2. Run the parcel ranking script (CALP)

Script: **CALP** `scripts/rank_parcels_by_change.py`

From **CALP** repo root:

```bash
cd /Users/yairtitelboim/Documents/Kernel/ALLAPPS/CALP

python scripts/rank_parcels_by_change.py \
  --change /Users/yairtitelboim/Documents/Kernel/ALLAPPS/MEM/public/data/memphis_change/memphis_colossus_2023-01-01_2023-12-31__2024-01-01_2024-12-31.geojson \
  --jurisdiction shelby \
  --out-prefix public/data/memphis_change/memphis_colossus_top_changed_parcels_shelby \
  --top 50
```

- **`--change`:** Must point at the MEM change GeoJSON above (correct AOI = 5420 Tulane area).
- **`--jurisdiction shelby`:** Shelby County parcels (Memphis).
- **`--out-prefix`:** Writes `<prefix>.geojson` and `<prefix>.csv`.
- **`--top`:** Number of top parcels to keep (e.g. 50).

---

## 3. Outputs

- **GeoJSON (for map):**  
  `CALP/public/data/memphis_change/memphis_colossus_top_changed_parcels_shelby.geojson`
- **CSV (ranked list):**  
  `CALP/public/data/memphis_change/memphis_colossus_top_changed_parcels_shelby.csv`

If the MEM map should show this layer, copy the GeoJSON to MEM:

- **Target in MEM:**  
  `MEM/public/data/memphis_change/memphis_colossus_top_changed_parcels_shelby.geojson`

---

## 4. When to re-run

- After **regenerating** the change GeoJSON (e.g. new AOI center, new radius, or new date window): re-run this parcel ranking with the new change file.
- If you only fix a bug in the parcel script (e.g. batching/fallback): re-run with the **same** change file so the area stays Colossus.

---

## 5. Checklist (bot)

- [ ] Change GeoJSON exists at MEM path above and was generated with center `-90.0348674, 34.9979829` (5420 Tulane).
- [ ] Run `rank_parcels_by_change.py` from CALP with `--change` pointing at that MEM file.
- [ ] Outputs written to CALP `public/data/memphis_change/` (and optionally copy GeoJSON to MEM same path if the map will load it).
