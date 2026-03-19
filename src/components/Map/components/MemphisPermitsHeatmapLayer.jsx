import { useEffect } from 'react';
import mapboxgl from 'mapbox-gl';

const SOURCE_ID = 'memphis-permits-heatmap-source';
const LAYER_ID = 'memphis-permits-heatmap';
const MEMPHIS_GEOJSON_URL = '/data/memphis_change/dpd_building_permits_near_colossus_5000m_recent.geojson';
const DESOTO_GEOJSON_URL = '/data/memphis_change/desoto_building_permits_near_colossus_5000m.geojson';

/**
 * Memphis/DPD + DeSoto/Southaven permits heatmap within 5km of Colossus (Shelby + MS).
 * Weight by log10(1 + Valuation) so high-value permits contribute more to intensity.
 */
const MemphisPermitsHeatmapLayer = ({ map, visible }) => {
  useEffect(() => {
    if (!map?.current) return;
    const mapInstance = map.current;

    if (!visible) {
      if (mapInstance.getLayer(LAYER_ID)) mapInstance.removeLayer(LAYER_ID);
      if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);
      return;
    }

    let cancelled = false;

    const addLayer = async () => {
      try {
        const isPointFeature = (f) => {
          const g = f?.geometry;
          if (!g || g.type !== 'Point') return false;
          const c = g.coordinates;
          return Array.isArray(c) && c.length >= 2 && typeof c[0] === 'number' && typeof c[1] === 'number';
        };

        const loadGeoJSON = async (url) => {
          try {
            const resp = await fetch(url);
            if (!resp.ok) {
              console.warn(`MemphisPermitsHeatmap: ${url} returned ${resp.status}`);
              return [];
            }
            const json = await resp.json();
            return (json?.features ?? []).filter(isPointFeature);
          } catch (e) {
            console.warn('MemphisPermitsHeatmap: failed to load', url, e);
            return [];
          }
        };

        const [memphisFeatures, desotoFeatures] = await Promise.all([
          loadGeoJSON(MEMPHIS_GEOJSON_URL),
          loadGeoJSON(DESOTO_GEOJSON_URL)
        ]);
        if (cancelled) return;

        const allFeatures = [...memphisFeatures, ...desotoFeatures];
        if (!allFeatures.length) return;

        const data = { type: 'FeatureCollection', features: allFeatures };

        if (mapInstance.getLayer(LAYER_ID)) mapInstance.removeLayer(LAYER_ID);
        if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);

        mapInstance.addSource(SOURCE_ID, { type: 'geojson', data, generateId: true });

        mapInstance.addLayer({
          id: LAYER_ID,
          type: 'heatmap',
          source: SOURCE_ID,
          paint: {
            'heatmap-weight': [
              'max',
              0.2,
              [
                'interpolate',
                ['linear'],
                ['log10', ['+', ['coalesce', ['get', 'Valuation'], ['get', 'valuation'], 0], 1]],
                0, 0.2,
                5, 1
              ]
            ],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 14, 1.2, 18, 1.5],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, 12, 14, 18, 18, 24],
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(0, 0, 0, 0)',
              0.2, 'rgba(134, 239, 172, 0.2)',
              0.4, 'rgba(34, 197, 94, 0.35)',
              0.6, 'rgba(22, 163, 74, 0.45)',
              0.8, 'rgba(21, 128, 61, 0.52)',
              1, 'rgba(20, 83, 45, 0.58)'
            ]
          },
          minzoom: 6
        });
      } catch (e) {
        console.error('Error loading Memphis permits heatmap', e);
      }
    };

    addLayer();

    return () => {
      cancelled = true;
      if (mapInstance.getLayer(LAYER_ID)) mapInstance.removeLayer(LAYER_ID);
      if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);
    };
  }, [map, visible]);

  return null;
};

export default MemphisPermitsHeatmapLayer;
