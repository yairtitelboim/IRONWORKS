# Lucid-Style GeoAI Animation Porting Guide

This document captures the end-to-end flow behind the Lucid Motors agricultural-change
animation and explains how to reproduce the experience for other geographies that use the
same map architecture. Follow the checklists in order; the assumptions and file names
mirror the current Pinal deployment so that the new implementation can live alongside the
existing one without collisions.

---

## 0. Prerequisites

- Mapbox access token available in `.env.local` (`REACT_APP_MAPBOX_ACCESS_TOKEN`).
- Google Earth Engine (GEE) credentials configured via `alphaearth_api.py` / `alphaearth_server.py`.
- GeoAI backend reachable (`geoai_api.py` + `/api/geoai/imagery` routes).
- `scripts/lucid_agri_change.py` validated locally so we can reuse its approach when
  generating animation GeoJSON for new sites.

---

## 1. Data Preparation (per location)

1. Clone `scripts/lucid_agri_change.py` and adjust:
   - `SITE_NAME`, coordinate extents and lookback window.
   - Output filenames (keep the `public/data/<site>/<site>_YYYY_YYYY.geojson` pattern).
2. Run the script against GEE to generate yearly delta layers and stats JSON.
3. Drop the generated `.geojson` + stats files into `public/data/<site>/`.
4. Update `geoai_sites.py` with the new site definition so the GeoAI batch endpoint
   understands the location (id, lat/lng, radius, description).

> ✅ Result: Precomputed rasters + vector deltas ready for use, plus server-side awareness
> of the new site.

---

## 2. UI Trigger Wiring

1. **Button** – create a new card entry in `NestedCircleButton.jsx` (or reuse an existing
   slot) that renders the pink `GeoAI` circle but passes the new `locationKey`.
2. **Base Card glue** – in `BaseCard.jsx`:
   - Expand `handleGeoAIQuery` so it switches to the new `currentLocation` and sets up
     tool feedback tailored to the site.
   - Ensure `handleLucidAnimationStart`/`handleAnimationSelect` analogues exist for the
     new animation key (e.g. `my_site_animation`).
3. **Loading CTA** – augment `LoadingCard.jsx` so the new location advertises its
   animation CTA and calls back into `handleAnimationSelect`.

> ✅ Result: User clicks the pink circle → Base card invokes GeoAI → Loading card exposes
> the animation CTA for the new site.

---

## 3. GeoAI Imagery Pipeline

Reuse the existing machinery in `useAIQuery.js`:

1. Add the new site id to the list passed into `handleAIQuery` (via
   `allowedSiteIds: ['my_site_id']`).
2. If the new facility needs bespoke halo radius or layer styling, extend the
   post-processing section in `useAIQuery.js` (around the `sites.forEach` overlay block).
3. Confirm the GeoAI batch endpoint delivers tiles for the new location by making a dry
   run (see logs from `alphaearth_server.py`).

> ✅ Result: Clicking the GeoAI trigger places the new Sentinel/NAIP overlays on the map.

---

## 4. Animation Component Fork

1. Duplicate `src/components/Map/components/LucidAgriChangeAnimation.jsx` as
   `MySiteAgriChangeAnimation.jsx` (maintain the same exported API: `{ map, onClose }`).
2. Update constants:
   - `PERIODS` to reference the new data directory/years.
   - Center coordinates / radius for halos.
   - Color ramps or callout labels to match the new change categories.
3. Keep the halo/sparkle/callout infrastructure (it only consumes the data set you pass).
4. Make sure `BaseCard.jsx` conditionally renders the new component when the new animation
   key is active.

> ✅ Result: The animation component can ingest the new yearly GeoJSON without touching
> the original Lucid implementation.

---

## 5. Summary Callouts & Analytics

When reusing the DOM-based summary callouts introduced for Lucid:

1. Adjust `CHANGE_CALLOUTS` in the copied animation component to match the change labels
   in your GeoJSON (`change_label` values).
2. Ensure the vector exports include `area_ha` (used for weighting) and a stable
   identifier to aggregate by.
3. After the last period plays, the component will automatically aggregate and render the
   summary cards (no additional wiring needed beyond the data definitions).

---

## 6. Testing Checklist

- Pink GeoAI button loads overlays for the new site without console errors.
- Loading card displays the new animation CTA.
- Animation plays through all periods (watch console for missing files).
- Halo pulse, sparkles, and callout cards appear only once playback finishes.
- Restarting or leaving the view clears layers/markers (no leftovers on Mapbox style).

Run through the above before committing the new location to ensure the experience matches
the Lucid reference flow.

