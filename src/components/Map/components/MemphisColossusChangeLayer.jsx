import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';

const SOURCE_ID = 'memphis-colossus-change-source';
const FILL_LAYER_ID = 'memphis-colossus-change-fill';
const INDUSTRIAL_HALO_LAYER_ID = 'memphis-colossus-industrial-halo';
const API_CIRCLE_SOURCE_ID = 'memphis-colossus-api-circle-source';
const API_CIRCLE_LAYER_ID = 'memphis-colossus-api-circle-line';
const GEOJSON_URL = '/data/memphis_change/memphis_colossus_2023-01-01_2023-12-31__2024-01-01_2024-12-31.geojson';

// xAI Colossus / API site (5420 Tulane Road, Memphis) — same center & radius as GEE AOI (--radius-m 5000)
const XAI_COLOSSUS_CENTER = [-90.0348674, 34.9979829];
const API_CIRCLE_RADIUS_KM = 5; // 5000 m, matches memphis_geoai_change.py --radius-m 5000

// Base extrusion when not using data-driven height (fallback)
const DEFAULT_EXTRUSION_METERS = 100 * 0.3048; // ~30.48

// Data-driven extrusion: height by polygon area (area_m2) — "lots of change" = taller (6x dominant)
// GEE exports area_m2 per feature; ramp from small patches (~90m) to large (~840m)
const HEIGHT_BY_AREA = [
  'interpolate', ['linear'], ['get', 'area_m2'],
  0, 90,
  500, 210,
  2000, 360,
  5000, 570,
  12000, 840
];

const CHANGE_COLORS = {
  vegetation_gain: '#22c55e',
  vegetation_loss: '#b91c1c',
  industrial_expansion: '#f97316',
  persistent_vegetation: '#15803d',
  water_change: '#0ea5e9'
};

const LEGEND_ITEMS = [
  { label: 'Vegetation gain', color: CHANGE_COLORS.vegetation_gain, change_label: 'vegetation_gain' },
  { label: 'Vegetation loss', color: CHANGE_COLORS.vegetation_loss, change_label: 'vegetation_loss' },
  { label: 'Industrial expansion', color: CHANGE_COLORS.industrial_expansion, change_label: 'industrial_expansion' },
  { label: 'Persistent vegetation', color: CHANGE_COLORS.persistent_vegetation, change_label: 'persistent_vegetation' },
  { label: 'Water change', color: CHANGE_COLORS.water_change, change_label: 'water_change' }
];

// Default: only Industrial expansion and Vegetation loss visible
const DEFAULT_FILTER = ['in', ['get', 'change_label'], ['literal', ['industrial_expansion', 'vegetation_loss']]];
const INDUSTRIAL_FILTER = ['==', ['get', 'change_label'], 'industrial_expansion'];

const EXTRUSION_LAYER_IDS = [FILL_LAYER_ID, INDUSTRIAL_HALO_LAYER_ID];

const createExtrusionPopupHTML = (props) => {
  const label = (props.change_label || '').replace(/_/g, ' ');
  const areaM2 = props.area_m2 != null ? Number(props.area_m2).toFixed(0) : '—';
  const areaHa = props.area_ha != null ? Number(props.area_ha).toFixed(4) : '—';
  const distKm = props.distance_km != null ? Number(props.distance_km).toFixed(2) : '—';
  return `
    <div style="
      background: rgba(17, 24, 39, 0.95);
      border-radius: 8px;
      padding: 12px 16px;
      color: #f9fafb;
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2);
      max-width: 260px;
      min-width: 180px;
    ">
      <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px; color: #fff; text-transform: capitalize;">
        ${label || 'Change'}
      </div>
      <div style="margin-bottom: 4px; color: #d1d5db;">Area: ${areaM2} m² (${areaHa} ha)</div>
      <div style="color: #9ca3af;">Distance from center: ${distKm} km</div>
    </div>
  `;
};

const MemphisColossusChangeLayer = ({ map, visible }) => {
  const pulseRef = useRef(null);
  const popupRef = useRef(null);

  useEffect(() => {
    if (!map?.current) return;

    const mapInstance = map.current;

    const setCursorPointer = () => { mapInstance.getCanvas().style.cursor = 'pointer'; };
    const setCursorDefault = () => { mapInstance.getCanvas().style.cursor = ''; };
    const handleExtrusionClick = (e) => {
      const features = mapInstance.queryRenderedFeatures(e.point, { layers: EXTRUSION_LAYER_IDS });
      if (!features.length) {
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }
        return;
      }
      const feature = features[0];
      const props = feature.properties || {};
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      popupRef.current = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: false,
        className: 'memphis-layer-popup'
      })
        .setLngLat(e.lngLat)
        .setHTML(createExtrusionPopupHTML(props))
        .addTo(mapInstance);
      popupRef.current.on('close', () => { popupRef.current = null; });
    };

    if (!visible) {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      mapInstance.off('click', handleExtrusionClick);
      EXTRUSION_LAYER_IDS.forEach((id) => {
        try {
          if (mapInstance.getLayer(id)) {
            mapInstance.off('mouseenter', id, setCursorPointer);
            mapInstance.off('mouseleave', id, setCursorDefault);
          }
        } catch (_) { /* noop */ }
      });
      if (pulseRef.current) {
        cancelAnimationFrame(pulseRef.current);
        pulseRef.current = null;
      }
      if (typeof window !== 'undefined' && window.mapEventBus) {
        window.mapEventBus.emit('memphis-colossus:legendCleared');
      }
      if (mapInstance.getLayer(API_CIRCLE_LAYER_ID)) mapInstance.removeLayer(API_CIRCLE_LAYER_ID);
      if (mapInstance.getSource(API_CIRCLE_SOURCE_ID)) mapInstance.removeSource(API_CIRCLE_SOURCE_ID);
      if (mapInstance.getLayer(INDUSTRIAL_HALO_LAYER_ID)) mapInstance.removeLayer(INDUSTRIAL_HALO_LAYER_ID);
      if (mapInstance.getLayer(FILL_LAYER_ID)) mapInstance.removeLayer(FILL_LAYER_ID);
      if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);
      return;
    }

    let cancelled = false;
    let industrialHaloVisible = true; // show halo when default or industrial selected

    const startIndustrialPulse = () => {
      if (!mapInstance.getLayer(INDUSTRIAL_HALO_LAYER_ID)) return;
      const startTime = Date.now();
      const duration = 2000;

      const animate = () => {
        if (cancelled || !industrialHaloVisible) {
          pulseRef.current = null;
          return;
        }
        if (!mapInstance.getLayer(INDUSTRIAL_HALO_LAYER_ID)) {
          pulseRef.current = null;
          return;
        }
        const elapsed = (Date.now() - startTime) % duration;
        const t = elapsed / duration;
        const opacity = 0.25 + 0.25 * Math.sin(t * Math.PI * 2);
        try {
          mapInstance.setPaintProperty(INDUSTRIAL_HALO_LAYER_ID, 'fill-extrusion-opacity', opacity);
        } catch (e) { /* noop */ }
        pulseRef.current = requestAnimationFrame(animate);
      };
      pulseRef.current = requestAnimationFrame(animate);
    };

    const addLayer = async () => {
      try {
        const resp = await fetch(GEOJSON_URL);
        const data = await resp.json();
        if (cancelled) return;
        if (!data.features?.length) return;

        if (mapInstance.getLayer(INDUSTRIAL_HALO_LAYER_ID)) mapInstance.removeLayer(INDUSTRIAL_HALO_LAYER_ID);
        if (mapInstance.getLayer(FILL_LAYER_ID)) mapInstance.removeLayer(FILL_LAYER_ID);
        if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);

        mapInstance.addSource(SOURCE_ID, { type: 'geojson', data, generateId: true });

        const colorMatch = [
          'match',
          ['get', 'change_label'],
          'vegetation_gain', CHANGE_COLORS.vegetation_gain,
          'vegetation_loss', CHANGE_COLORS.vegetation_loss,
          'industrial_expansion', CHANGE_COLORS.industrial_expansion,
          'persistent_vegetation', CHANGE_COLORS.persistent_vegetation,
          'water_change', CHANGE_COLORS.water_change,
          '#6b7280'
        ];

        mapInstance.addLayer({
          id: FILL_LAYER_ID,
          type: 'fill-extrusion',
          source: SOURCE_ID,
          filter: DEFAULT_FILTER,
          paint: {
            'fill-extrusion-color': colorMatch,
            'fill-extrusion-height': HEIGHT_BY_AREA,
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.85
          },
          minzoom: 6
        });

        // Industrial halo: same extrusion, industrial only, glow color, pulsing opacity
        mapInstance.addLayer({
          id: INDUSTRIAL_HALO_LAYER_ID,
          type: 'fill-extrusion',
          source: SOURCE_ID,
          filter: INDUSTRIAL_FILTER,
          paint: {
            'fill-extrusion-color': CHANGE_COLORS.industrial_expansion,
            'fill-extrusion-height': ['*', HEIGHT_BY_AREA, 1.02],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.3
          },
          minzoom: 6
        });
        startIndustrialPulse();

        // Dashed orange circle around xAI Colossus (API) site
        const apiCircle = turf.circle(XAI_COLOSSUS_CENTER, API_CIRCLE_RADIUS_KM, { steps: 64, units: 'kilometers' });
        if (mapInstance.getLayer(API_CIRCLE_LAYER_ID)) mapInstance.removeLayer(API_CIRCLE_LAYER_ID);
        if (mapInstance.getSource(API_CIRCLE_SOURCE_ID)) mapInstance.removeSource(API_CIRCLE_SOURCE_ID);
        mapInstance.addSource(API_CIRCLE_SOURCE_ID, { type: 'geojson', data: apiCircle });
        mapInstance.addLayer({
          id: API_CIRCLE_LAYER_ID,
          type: 'line',
          source: API_CIRCLE_SOURCE_ID,
          paint: {
            'line-color': '#f97316',
            'line-width': 2,
            'line-dasharray': [2, 1.5]
          },
          minzoom: 6
        });

        if (typeof window !== 'undefined' && window.mapEventBus) {
          window.mapEventBus.emit('memphis-colossus:legendData', {
            title: 'Memphis Colossus Change (2023→2024)',
            items: LEGEND_ITEMS.map(({ label, color, change_label }) => ({
              label,
              color,
              change_label,
              type: 'polygon',
              isVisible: true
            }))
          });
        }
      } catch (e) {
        console.error('Error loading Memphis Colossus change layer', e);
      }
    };

    mapInstance.on('click', handleExtrusionClick);
    addLayer().then(() => {
      if (cancelled) return;
      EXTRUSION_LAYER_IDS.forEach((id) => {
        if (mapInstance.getLayer(id)) {
          mapInstance.on('mouseenter', id, setCursorPointer);
          mapInstance.on('mouseleave', id, setCursorDefault);
        }
      });
    });

    const handleLegendSelect = (payload) => {
      if (!map?.current?.getLayer(FILL_LAYER_ID)) return;
      const m = map.current;
      industrialHaloVisible = payload == null || payload === 'industrial_expansion';
      if (payload == null) {
        m.setFilter(FILL_LAYER_ID, DEFAULT_FILTER);
        m.setPaintProperty(FILL_LAYER_ID, 'fill-extrusion-opacity', 0.85);
      } else {
        m.setFilter(FILL_LAYER_ID, ['==', ['get', 'change_label'], payload]);
        m.setPaintProperty(FILL_LAYER_ID, 'fill-extrusion-opacity', 0.95);
      }
      if (m.getLayer(INDUSTRIAL_HALO_LAYER_ID)) {
        m.setLayoutProperty(INDUSTRIAL_HALO_LAYER_ID, 'visibility', industrialHaloVisible ? 'visible' : 'none');
        if (industrialHaloVisible && !pulseRef.current) startIndustrialPulse();
      }
    };

    if (typeof window !== 'undefined' && window.mapEventBus) {
      window.mapEventBus.on('memphis-colossus:legendSelect', handleLegendSelect);
    }

    addLayer();

    return () => {
      cancelled = true;
      industrialHaloVisible = false;
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      mapInstance.off('click', handleExtrusionClick);
      EXTRUSION_LAYER_IDS.forEach((id) => {
        try {
          if (mapInstance.getLayer(id)) {
            mapInstance.off('mouseenter', id, setCursorPointer);
            mapInstance.off('mouseleave', id, setCursorDefault);
          }
        } catch (_) { /* noop */ }
      });
      if (pulseRef.current) {
        cancelAnimationFrame(pulseRef.current);
        pulseRef.current = null;
      }
      if (typeof window !== 'undefined' && window.mapEventBus) {
        window.mapEventBus.off('memphis-colossus:legendSelect', handleLegendSelect);
        window.mapEventBus.emit('memphis-colossus:legendCleared');
      }
      if (mapInstance.getLayer(API_CIRCLE_LAYER_ID)) mapInstance.removeLayer(API_CIRCLE_LAYER_ID);
      if (mapInstance.getSource(API_CIRCLE_SOURCE_ID)) mapInstance.removeSource(API_CIRCLE_SOURCE_ID);
      if (mapInstance.getLayer(INDUSTRIAL_HALO_LAYER_ID)) mapInstance.removeLayer(INDUSTRIAL_HALO_LAYER_ID);
      if (mapInstance.getLayer(FILL_LAYER_ID)) mapInstance.removeLayer(FILL_LAYER_ID);
      if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);
    };
  }, [map, visible]);

  return null;
};

export default MemphisColossusChangeLayer;
