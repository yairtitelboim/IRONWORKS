import React, { useEffect, useRef } from 'react';

const SOURCE_ID = 'ercot-gis-reports-source';
const LAYER_ID = 'ercot-gis-reports-layer';
const GEOJSON_URL = '/data/ercot/ercot_gis_reports.geojson';

const FUEL_COLORS = {
  SOL: '#fbbf24',
  WIN: '#60a5fa',
  BAT: '#a78bfa',
  GAS: '#f87171',
  HYB: '#10b981',
  NUC: '#f59e0b',
  COA: '#6b7280',
  BIO: '#84cc16',
  GEO: '#14b8a6',
  WAT: '#3b82f6',
  OTH: '#9ca3af',
};

const ERCOTGISReportsLayer = ({ map, visible }) => {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!map?.current) return;
    const mapInstance = map.current;

    const addLayer = async () => {
      if (initializedRef.current && mapInstance.getLayer(LAYER_ID)) {
        mapInstance.setLayoutProperty(LAYER_ID, 'visibility', visible ? 'visible' : 'none');
        return;
      }

      // The GeoJSON is ~470 MB — only fetch when the layer is actually toggled on.
      if (!visible) return;

      if (!mapInstance.isStyleLoaded()) {
        mapInstance.once('styledata', addLayer);
        return;
      }

      try {
        if (!mapInstance.getSource(SOURCE_ID)) {
          const response = await fetch(GEOJSON_URL);
          if (!response.ok) {
            console.warn(`[ERCOTGISReportsLayer] Dataset unavailable (${response.status}) at ${GEOJSON_URL}`);
            return;
          }
          const contentType = String(response.headers.get('content-type') || '').toLowerCase();
          if (!contentType.includes('json') && !contentType.includes('geo+json')) {
            console.warn('[ERCOTGISReportsLayer] Dataset response is not JSON; skipping layer init');
            return;
          }
          const geojsonData = await response.json();

          if (!mapInstance.getSource(SOURCE_ID)) {
            mapInstance.addSource(SOURCE_ID, {
              type: 'geojson',
              data: geojsonData,
            });
          }
        }

        if (!mapInstance.getLayer(LAYER_ID)) {
          mapInstance.addLayer({
            id: LAYER_ID,
            type: 'circle',
            source: SOURCE_ID,
            minzoom: 3,
            paint: {
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                3,
                ['interpolate', ['linear'], ['max', ['get', 'Capacity (MW)'], 0], 0, 1, 100, 2, 1000, 4, 2000, 5],
                8,
                ['interpolate', ['linear'], ['max', ['get', 'Capacity (MW)'], 0], 0, 2, 100, 4, 1000, 8, 2000, 11],
                12,
                ['interpolate', ['linear'], ['max', ['get', 'Capacity (MW)'], 0], 0, 3, 100, 6, 1000, 12, 2000, 16],
              ],
              'circle-color': [
                'match',
                ['get', 'Fuel'],
                'SOL', FUEL_COLORS.SOL,
                'WIN', FUEL_COLORS.WIN,
                'BAT', FUEL_COLORS.BAT,
                'GAS', FUEL_COLORS.GAS,
                'HYB', FUEL_COLORS.HYB,
                'NUC', FUEL_COLORS.NUC,
                'COA', FUEL_COLORS.COA,
                'BIO', FUEL_COLORS.BIO,
                'GEO', FUEL_COLORS.GEO,
                'WAT', FUEL_COLORS.WAT,
                'OTH', FUEL_COLORS.OTH,
                FUEL_COLORS.OTH,
              ],
              'circle-opacity': 0.85,
            },
            layout: {
              visibility: visible ? 'visible' : 'none',
            },
          });
        }

        initializedRef.current = true;
      } catch (error) {
        console.warn('[ERCOTGISReportsLayer] Failed to initialize:', error);
      }
    };

    addLayer();

    return () => {
      // Keep data in memory and only hide on unmount.
      if (mapInstance.getLayer(LAYER_ID)) {
        mapInstance.setLayoutProperty(LAYER_ID, 'visibility', 'none');
      }
    };
  }, [map, visible]);

  return null;
};

export default ERCOTGISReportsLayer;
