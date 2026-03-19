import { useEffect } from 'react';
import * as turf from '@turf/turf';

const SOURCE_ID = 'memphis-colossus-top-parcels-source';
const EXTRUSION_LAYER_ID = 'memphis-colossus-top-parcels-extrusion';
const LINE_LAYER_ID = 'memphis-colossus-top-parcels-line';
const GEOJSON_URL = '/data/memphis_change/memphis_colossus_top_changed_parcels_shelby.geojson';

/** 250 feet in meters (50 ft × 5; Mapbox fill-extrusion uses meters) */
const EXTRUSION_HEIGHT_FT = 250;
const EXTRUSION_HEIGHT_M = turf.convertLength(EXTRUSION_HEIGHT_FT, 'feet', 'meters');

/**
 * Top-50 Shelby parcels by industrial_expansion overlap (from rank_parcels_by_change.py).
 * Loads the GeoJSON at MEM public path; parcels are extruded to 50' Z height via Turf.
 */
const MemphisColossusTopParcelsLayer = ({ map, visible }) => {
  useEffect(() => {
    if (!map?.current) return;

    const mapInstance = map.current;

    if (!visible) {
      if (mapInstance.getLayer(LINE_LAYER_ID)) mapInstance.removeLayer(LINE_LAYER_ID);
      if (mapInstance.getLayer(EXTRUSION_LAYER_ID)) mapInstance.removeLayer(EXTRUSION_LAYER_ID);
      if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);
      return;
    }

    let cancelled = false;

    const addLayer = async () => {
      try {
        const resp = await fetch(GEOJSON_URL);
        const data = await resp.json();
        if (cancelled) return;
        if (!data.features?.length) return;

        const withHeight = turf.featureCollection(
          data.features.map((f) => {
            const props = { ...(f.properties || {}), extrusionHeightM: EXTRUSION_HEIGHT_M };
            return turf.feature(f.geometry, props, f.id != null ? { id: f.id } : {});
          })
        );

        if (mapInstance.getLayer(LINE_LAYER_ID)) mapInstance.removeLayer(LINE_LAYER_ID);
        if (mapInstance.getLayer(EXTRUSION_LAYER_ID)) mapInstance.removeLayer(EXTRUSION_LAYER_ID);
        if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);

        mapInstance.addSource(SOURCE_ID, { type: 'geojson', data: withHeight, generateId: true });

        mapInstance.addLayer({
          id: EXTRUSION_LAYER_ID,
          type: 'fill-extrusion',
          source: SOURCE_ID,
          paint: {
            'fill-extrusion-color': '#fbbf24',
            'fill-extrusion-height': ['get', 'extrusionHeightM'],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.85
          },
          minzoom: 6
        });

        mapInstance.addLayer({
          id: LINE_LAYER_ID,
          type: 'line',
          source: SOURCE_ID,
          paint: {
            'line-color': '#d97706',
            'line-width': 1.5
          },
          minzoom: 6
        });
      } catch (e) {
        console.error('Error loading Memphis Colossus top parcels layer', e);
      }
    };

    addLayer();

    return () => {
      cancelled = true;
      if (mapInstance.getLayer(LINE_LAYER_ID)) mapInstance.removeLayer(LINE_LAYER_ID);
      if (mapInstance.getLayer(EXTRUSION_LAYER_ID)) mapInstance.removeLayer(EXTRUSION_LAYER_ID);
      if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);
    };
  }, [map, visible]);

  return null;
};

export default MemphisColossusTopParcelsLayer;
