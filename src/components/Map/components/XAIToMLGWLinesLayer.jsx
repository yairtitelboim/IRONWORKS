import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

const SOURCE_ID = 'xai-to-mlgw-lines-source';
const GLOW_LAYER_ID = 'xai-to-mlgw-lines-glow';
const LINES_LAYER_ID = 'xai-to-mlgw-lines';
const LABELS_SOURCE_ID = 'xai-to-mlgw-labels-source';
const LABELS_LAYER_ID = 'xai-to-mlgw-labels';
const GEOJSON_URL = '/memphis-tn/xai_to_nearest_mlgw_2026_substation.geojson';
const PULSE_PERIOD_MS = 2000;

function lineMidpoint(coords) {
  if (!coords || coords.length < 2) return null;
  const mid = Math.floor(coords.length / 2);
  if (coords.length % 2 === 1) return coords[mid];
  return [
    (coords[mid - 1][0] + coords[mid][0]) / 2,
    (coords[mid - 1][1] + coords[mid][1]) / 2
  ];
}

const createLinePopupHTML = (props) => {
  const km = props.distance_km != null ? Number(props.distance_km).toFixed(1) : '—';
  return `
    <div style="
      background: rgba(17, 24, 39, 0.95);
      border-radius: 8px;
      padding: 12px 16px;
      color: #f9fafb;
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2);
      max-width: 300px;
      min-width: 200px;
    ">
      <div style="display: inline-block; background: #a78bfa; color: #000; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 500; margin-bottom: 8px;">
        Nearest FY2026 substation
      </div>
      <div style="margin-bottom: 4px; color: #d1d5db; font-size: 11px;">${props.from_name || 'xAI site'}</div>
      <div style="margin-bottom: 2px; color: #9ca3af; font-size: 11px;">→ ${props.to_name || 'Substation'}</div>
      <div style="margin-top: 6px; font-weight: 600; color: #a78bfa;">${km} km</div>
      <div style="margin-top: 6px; color: #6b7280; font-size: 10px; font-style: italic;">${props.basis || 'Nearest distance, not an electrical path.'}</div>
    </div>
  `;
};

const XAIToMLGWLinesLayer = ({ map, visible }) => {
  const popupRef = useRef(null);
  const focusPulseRef = useRef(null);

  useEffect(() => {
    if (!map?.current) return;

    const mapInstance = map.current;

    if (!visible) {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      if (mapInstance.getLayer(LABELS_LAYER_ID)) mapInstance.removeLayer(LABELS_LAYER_ID);
      if (mapInstance.getSource(LABELS_SOURCE_ID)) mapInstance.removeSource(LABELS_SOURCE_ID);
      if (mapInstance.getLayer(LINES_LAYER_ID)) mapInstance.removeLayer(LINES_LAYER_ID);
      if (mapInstance.getLayer(GLOW_LAYER_ID)) mapInstance.removeLayer(GLOW_LAYER_ID);
      if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);
      return;
    }

    let cancelled = false;

    const startFocusPulse = () => {
      if (!mapInstance.getLayer(LINES_LAYER_ID)) return;
      const startTime = Date.now();
      const animate = () => {
        if (cancelled) return;
        const elapsed = (Date.now() - startTime) % PULSE_PERIOD_MS;
        const t = elapsed / PULSE_PERIOD_MS;
        const wave = (Math.sin(t * Math.PI * 2) + 1) / 2;
        const lineOpacity = 0.75 + 0.25 * Math.sin(t * Math.PI * 2);
        const glowOpacity = 0.12 + 0.18 * wave;
        try {
          if (mapInstance.getLayer(LINES_LAYER_ID)) {
            mapInstance.setPaintProperty(LINES_LAYER_ID, 'line-opacity', lineOpacity);
          }
          if (mapInstance.getLayer(GLOW_LAYER_ID)) {
            mapInstance.setPaintProperty(GLOW_LAYER_ID, 'line-opacity', glowOpacity);
          }
        } catch (e) { /* noop */ }
        focusPulseRef.current = requestAnimationFrame(animate);
      };
      focusPulseRef.current = requestAnimationFrame(animate);
    };

    const stopFocusPulse = () => {
      if (focusPulseRef.current) {
        cancelAnimationFrame(focusPulseRef.current);
        focusPulseRef.current = null;
      }
    };

    const addLayer = async () => {
      try {
        const resp = await fetch(GEOJSON_URL);
        const data = await resp.json();
        if (cancelled) return;
        if (!data.features?.length) return;

        const labelFeatures = data.features
          .filter(f => f.geometry?.type === 'LineString' && f.geometry.coordinates?.length >= 2)
          .map(f => {
            const mid = lineMidpoint(f.geometry.coordinates);
            const p = f.properties || {};
            if (!mid) return null;
            return {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: mid },
              properties: {
                label_text: `${Number(p.distance_km).toFixed(1)} km`,
                ...p
              }
            };
          })
          .filter(Boolean);

        if (mapInstance.getLayer(LABELS_LAYER_ID)) mapInstance.removeLayer(LABELS_LAYER_ID);
        if (mapInstance.getSource(LABELS_SOURCE_ID)) mapInstance.removeSource(LABELS_SOURCE_ID);
        if (mapInstance.getLayer(LINES_LAYER_ID)) mapInstance.removeLayer(LINES_LAYER_ID);
        if (mapInstance.getLayer(GLOW_LAYER_ID)) mapInstance.removeLayer(GLOW_LAYER_ID);
        if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);

        mapInstance.addSource(SOURCE_ID, { type: 'geojson', data, generateId: true });

        mapInstance.addLayer({
          id: GLOW_LAYER_ID,
          type: 'line',
          source: SOURCE_ID,
          paint: {
            'line-color': '#a78bfa',
            'line-width': ['interpolate', ['linear'], ['zoom'], 6, 4, 10, 5, 14, 7],
            'line-blur': 1.2,
            'line-opacity': 0
          },
          minzoom: 6
        });
        mapInstance.addLayer({
          id: LINES_LAYER_ID,
          type: 'line',
          source: SOURCE_ID,
          paint: {
            'line-color': '#a78bfa',
            'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.5, 10, 2, 14, 3],
            'line-dasharray': [2, 2]
          },
          minzoom: 6
        });

        if (labelFeatures.length > 0) {
          mapInstance.addSource(LABELS_SOURCE_ID, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: labelFeatures },
            generateId: true
          });
          mapInstance.addLayer({
            id: LABELS_LAYER_ID,
            type: 'symbol',
            source: LABELS_SOURCE_ID,
            layout: {
              'text-field': ['get', 'label_text'],
              'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
              'text-size': ['interpolate', ['linear'], ['zoom'], 6, 11, 10, 13, 14, 16],
              'text-anchor': 'center',
              'text-allow-overlap': false,
              'text-ignore-placement': false
            },
            paint: {
              'text-color': '#ffffff',
              'text-halo-width': 2,
              'text-halo-color': 'rgba(0,0,0,0.6)',
              'text-opacity': 0.95
            },
            minzoom: 6
          });
        }

        mapInstance.on('mouseenter', LINES_LAYER_ID, () => { mapInstance.getCanvas().style.cursor = 'pointer'; });
        mapInstance.on('mouseleave', LINES_LAYER_ID, () => { mapInstance.getCanvas().style.cursor = ''; });
      } catch (e) {
        console.error('Error loading xAI → MLGW lines layer', e);
      }
    };

    const handleClick = (e) => {
      if (!map.current) return;
      const features = map.current.queryRenderedFeatures(e.point, { layers: [LINES_LAYER_ID] });
      if (features?.length > 0) {
        const f = features[0];
        const props = f.properties || {};
        const coords = f.geometry.type === 'LineString'
          ? lineMidpoint(f.geometry.coordinates) || f.geometry.coordinates[0]
          : f.geometry.coordinates;

        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }
        popupRef.current = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          anchor: 'bottom',
          offset: [0, -10],
          maxWidth: '400px',
          className: 'memphis-layer-popup'
        })
          .setLngLat(coords)
          .setHTML(createLinePopupHTML(props))
          .addTo(map.current);
        popupRef.current.on('close', () => { popupRef.current = null; });
      } else {
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }
      }
    };

    addLayer();
    mapInstance.on('click', handleClick);

    // Timeline → Map: focused = this layer (relationship) pulses; dimmed = another milestone focused
    const applyMilestoneHighlight = (milestoneId) => {
      const focused = milestoneId === 'mlgw-fy2026' || milestoneId === 'advantage';
      const dimmed = milestoneId != null && !focused;
      try {
        if (focused) {
          startFocusPulse();
          if (mapInstance.getLayer(LINES_LAYER_ID)) {
            mapInstance.setPaintProperty(LINES_LAYER_ID, 'line-width',
              ['interpolate', ['linear'], ['zoom'], 6, 2.5, 10, 3, 14, 4]);
          }
        } else {
          stopFocusPulse();
          if (mapInstance.getLayer(GLOW_LAYER_ID)) {
            mapInstance.setPaintProperty(GLOW_LAYER_ID, 'line-opacity', 0);
          }
          if (mapInstance.getLayer(LINES_LAYER_ID)) {
            mapInstance.setPaintProperty(LINES_LAYER_ID, 'line-opacity', dimmed ? 0.35 : 1);
            mapInstance.setPaintProperty(LINES_LAYER_ID, 'line-width',
              ['interpolate', ['linear'], ['zoom'], 6, 1.5, 10, 2, 14, 3]);
          }
        }
      } catch (e) { /* noop */ }
    };
    const onMilestoneFocused = (payload) => applyMilestoneHighlight(payload?.milestoneId ?? null);
    const onMilestoneCleared = () => applyMilestoneHighlight(null);
    const unFocused = window.mapEventBus?.on?.('memphis:milestoneFocused', onMilestoneFocused);
    const unCleared = window.mapEventBus?.on?.('memphis:milestoneCleared', onMilestoneCleared);

    return () => {
      unFocused?.();
      unCleared?.();
      applyMilestoneHighlight(null);
      cancelled = true;
      stopFocusPulse();
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      mapInstance.off('click', handleClick);
      mapInstance.off('mouseenter', LINES_LAYER_ID);
      mapInstance.off('mouseleave', LINES_LAYER_ID);
      if (mapInstance.getLayer(LABELS_LAYER_ID)) mapInstance.removeLayer(LABELS_LAYER_ID);
      if (mapInstance.getSource(LABELS_SOURCE_ID)) mapInstance.removeSource(LABELS_SOURCE_ID);
      if (mapInstance.getLayer(LINES_LAYER_ID)) mapInstance.removeLayer(LINES_LAYER_ID);
      if (mapInstance.getLayer(GLOW_LAYER_ID)) mapInstance.removeLayer(GLOW_LAYER_ID);
      if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);
    };
  }, [map, visible]);

  return null;
};

export default XAIToMLGWLinesLayer;
