import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

// Shared popup styles for Memphis layers (Texas Data Centers pattern)
if (typeof document !== 'undefined') {
  const id = 'memphis-layer-popup-styles';
  if (!document.getElementById(id)) {
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      .memphis-layer-popup.mapboxgl-popup .mapboxgl-popup-content {
        background: transparent !important;
        border: none !important;
        padding: 0 !important;
        box-shadow: none !important;
      }
      .memphis-layer-popup.mapboxgl-popup .mapboxgl-popup-tip { display: none !important; }
      .memphis-layer-popup.mapboxgl-popup { border: none !important; outline: none !important; }
    `;
    document.head.appendChild(style);
  }
}

const SOURCE_ID = 'mlgw-2026-substation-source';
const FILL_LAYER_ID = 'mlgw-2026-advantage-zone';
const PULSE_LAYER_ID = 'mlgw-2026-substation-pulse';
const HALO_LAYER_ID = 'mlgw-2026-substation-halo';
const CIRCLES_LAYER_ID = 'mlgw-2026-substation-points';
const LABELS_LAYER_ID = 'mlgw-2026-substation-labels';
const GEOJSON_URL = '/memphis-tn/mlgw_2026_substation_work.geojson';
const CIRCLES_NORMAL_RADIUS = ['interpolate', ['linear'], ['zoom'], 6, 8, 10, 12, 14, 16];
const CIRCLES_DIMMED_RADIUS = ['interpolate', ['linear'], ['zoom'], 6, 4, 10, 6, 14, 8];
const HALO_RADIUS = ['interpolate', ['linear'], ['zoom'], 6, 16, 10, 24, 14, 32];
const PULSE_PERIOD_MS = 2000;
const ORANGE = '#f97316';

const createSubstationPopupHTML = (props) => {
  const projects = Array.isArray(props.projects) ? props.projects : [];
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
      max-width: 280px;
      min-width: 200px;
    ">
      <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px; color: #fff;">
        ${props.name || 'Substation'}
      </div>
      <div style="display: inline-block; background: #f97316; color: #000; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 500; margin-bottom: 8px;">
        FY2026 • Sub #${props.substation_number ?? '—'}
      </div>
      <div style="margin-bottom: 4px; color: #9ca3af; font-size: 11px;">${props.operator || 'MLGW'}</div>
      ${projects.length ? `
        <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1);">
          <div style="font-weight: 500; color: #d1d5db; font-size: 11px; margin-bottom: 4px;">Projects</div>
          <ul style="margin: 0; padding-left: 16px; color: #9ca3af; font-size: 11px;">
            ${projects.map(p => `<li>${p}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      ${props.timeline_note ? `
        <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); color: #a5b4fc; font-size: 11px; line-height: 1.45;">
          ${props.timeline_note}
        </div>
      ` : ''}
      ${props.source_url ? `
        <a href="${props.source_url}" target="_blank" rel="noopener noreferrer"
           style="color: #f97316; text-decoration: underline; font-size: 11px; display: inline-block; margin-top: 8px;">
          Budget source →
        </a>
      ` : ''}
    </div>
  `;
};

const MLGW2026SubstationLayer = ({ map, visible }) => {
  const pulseAnimationRef = useRef(null);
  const focusPulseRef = useRef(null);
  const popupRef = useRef(null);
  const lastMilestoneIdRef = useRef(null);

  useEffect(() => {
    if (!map?.current) return;

    const mapInstance = map.current;

    if (!visible) {
      if (pulseAnimationRef.current) {
        cancelAnimationFrame(pulseAnimationRef.current);
        pulseAnimationRef.current = null;
      }
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      if (mapInstance.getLayer(LABELS_LAYER_ID)) mapInstance.removeLayer(LABELS_LAYER_ID);
      if (mapInstance.getLayer(CIRCLES_LAYER_ID)) mapInstance.removeLayer(CIRCLES_LAYER_ID);
      if (mapInstance.getLayer(HALO_LAYER_ID)) mapInstance.removeLayer(HALO_LAYER_ID);
      if (mapInstance.getLayer(PULSE_LAYER_ID)) mapInstance.removeLayer(PULSE_LAYER_ID);
      if (mapInstance.getLayer(FILL_LAYER_ID)) mapInstance.removeLayer(FILL_LAYER_ID);
      if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);
      return;
    }

    let cancelled = false;

    const startPulse = () => {
      if (!mapInstance.getLayer(FILL_LAYER_ID)) return;
      const startTime = Date.now();
      const duration = 2000;
      const animate = () => {
        if (cancelled) return;
        const elapsed = (Date.now() - startTime) % duration;
        const progress = elapsed / duration;
        const opacity = 0.04 + 0.03 * Math.sin(progress * Math.PI * 2);
        try {
          if (mapInstance.getLayer(FILL_LAYER_ID)) {
            mapInstance.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', opacity);
          }
        } catch (e) { /* noop */ }
        pulseAnimationRef.current = requestAnimationFrame(animate);
      };
      pulseAnimationRef.current = requestAnimationFrame(animate);
    };

    const startFocusPulse = () => {
      if (!mapInstance.getLayer(FILL_LAYER_ID) || !mapInstance.getLayer(CIRCLES_LAYER_ID)) return;
      const startTime = Date.now();
      const animate = () => {
        if (cancelled) return;
        const elapsed = (Date.now() - startTime) % PULSE_PERIOD_MS;
        const t = elapsed / PULSE_PERIOD_MS;
        const wave = (Math.sin(t * Math.PI * 2) + 1) / 2;
        const fillOpacity = Math.max(0, 0.15 + 0.07 * Math.sin(t * Math.PI * 2));
        const circleOpacity = Math.max(0, Math.min(1, 0.92 + 0.08 * Math.sin(t * Math.PI * 2)));
        const pulseRadius = 14 + wave * 14;
        const pulseOpacity = 0.06 + 0.14 * wave;
        try {
          if (mapInstance.getLayer(FILL_LAYER_ID)) {
            mapInstance.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', fillOpacity);
          }
          if (mapInstance.getLayer(CIRCLES_LAYER_ID)) {
            mapInstance.setPaintProperty(CIRCLES_LAYER_ID, 'circle-opacity', circleOpacity);
          }
          if (mapInstance.getLayer(PULSE_LAYER_ID)) {
            mapInstance.setPaintProperty(PULSE_LAYER_ID, 'circle-radius', pulseRadius);
            mapInstance.setPaintProperty(PULSE_LAYER_ID, 'circle-opacity', pulseOpacity);
          }
          if (mapInstance.getLayer(HALO_LAYER_ID)) {
            mapInstance.setPaintProperty(HALO_LAYER_ID, 'circle-opacity', 0.22);
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

        const processed = {
          ...data,
          features: data.features.map(f => {
            const p = f.properties || {};
            if (f.geometry?.type === 'Point' && (p.substation_number != null || p.name)) {
              return {
                ...f,
                properties: {
                  ...p,
                  label_text: `Sub #${p.substation_number ?? ''}`
                }
              };
            }
            return f;
          })
        };

        if (mapInstance.getLayer(LABELS_LAYER_ID)) mapInstance.removeLayer(LABELS_LAYER_ID);
        if (mapInstance.getLayer(CIRCLES_LAYER_ID)) mapInstance.removeLayer(CIRCLES_LAYER_ID);
        if (mapInstance.getLayer(HALO_LAYER_ID)) mapInstance.removeLayer(HALO_LAYER_ID);
        if (mapInstance.getLayer(PULSE_LAYER_ID)) mapInstance.removeLayer(PULSE_LAYER_ID);
        if (mapInstance.getLayer(FILL_LAYER_ID)) mapInstance.removeLayer(FILL_LAYER_ID);
        if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);

        mapInstance.addSource(SOURCE_ID, { type: 'geojson', data: processed, generateId: true });

        mapInstance.addLayer({
          id: FILL_LAYER_ID,
          type: 'fill',
          source: SOURCE_ID,
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: { 'fill-color': ORANGE, 'fill-opacity': 0.05 },
          minzoom: 6
        });
        startPulse();

        mapInstance.addLayer({
          id: PULSE_LAYER_ID,
          type: 'circle',
          source: SOURCE_ID,
          filter: ['==', ['geometry-type'], 'Point'],
          paint: {
            'circle-radius': 20,
            'circle-color': ORANGE,
            'circle-opacity': 0,
            'circle-blur': 0.35
          },
          minzoom: 6
        });
        mapInstance.addLayer({
          id: HALO_LAYER_ID,
          type: 'circle',
          source: SOURCE_ID,
          filter: ['==', ['geometry-type'], 'Point'],
          paint: {
            'circle-radius': HALO_RADIUS,
            'circle-color': ORANGE,
            'circle-opacity': 0.18,
            'circle-blur': 0.4
          },
          minzoom: 6
        });

        mapInstance.addLayer({
          id: CIRCLES_LAYER_ID,
          type: 'circle',
          source: SOURCE_ID,
          filter: ['==', ['geometry-type'], 'Point'],
          paint: {
            'circle-radius': CIRCLES_NORMAL_RADIUS,
            'circle-color': ORANGE
          },
          minzoom: 6
        });

        // Apply timeline focus/dim if user already clicked a milestone card before layer loaded; otherwise default = pulse + halo
        const pendingId = lastMilestoneIdRef.current;
        try {
          applyMilestoneHighlight(pendingId ?? null);
        } catch (e) { /* noop */ }

        mapInstance.addLayer({
          id: LABELS_LAYER_ID,
          type: 'symbol',
          source: SOURCE_ID,
          filter: ['==', ['geometry-type'], 'Point'],
          layout: {
            'text-field': ['get', 'label_text'],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 6, 12, 10, 14, 14, 18],
            'text-anchor': 'bottom',
            'text-offset': [0, -1.8],
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

        mapInstance.on('mouseenter', CIRCLES_LAYER_ID, () => { mapInstance.getCanvas().style.cursor = 'pointer'; });
        mapInstance.on('mouseleave', CIRCLES_LAYER_ID, () => { mapInstance.getCanvas().style.cursor = ''; });
      } catch (e) {
        console.error('Error loading MLGW 2026 substation layer', e);
      }
    };

    const handleClick = (e) => {
      if (!map.current) return;
      const features = map.current.queryRenderedFeatures(e.point, { layers: [CIRCLES_LAYER_ID] });
      if (features?.length > 0) {
        const f = features[0];
        const props = f.properties || {};
        const coords = f.geometry.coordinates.slice();

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
          .setHTML(createSubstationPopupHTML(props))
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

    // Timeline → Map: focused = this layer pulses; dimmed = another milestone focused so we dim
    const applyMilestoneHighlight = (milestoneId) => {
      lastMilestoneIdRef.current = milestoneId || null;
      const focused = milestoneId === 'mlgw-fy2026' || milestoneId === 'advantage';
      const dimmed = milestoneId != null && !focused;
      try {
        if (focused) {
          if (pulseAnimationRef.current) {
            cancelAnimationFrame(pulseAnimationRef.current);
            pulseAnimationRef.current = null;
          }
          startFocusPulse();
        } else if (dimmed) {
          stopFocusPulse();
          if (pulseAnimationRef.current) {
            cancelAnimationFrame(pulseAnimationRef.current);
            pulseAnimationRef.current = null;
          }
          if (mapInstance.getLayer(FILL_LAYER_ID)) {
            mapInstance.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', 0.02);
          }
          if (mapInstance.getLayer(HALO_LAYER_ID)) {
            mapInstance.setPaintProperty(HALO_LAYER_ID, 'circle-opacity', 0);
          }
          if (mapInstance.getLayer(PULSE_LAYER_ID)) {
            mapInstance.setPaintProperty(PULSE_LAYER_ID, 'circle-opacity', 0);
          }
          if (mapInstance.getLayer(CIRCLES_LAYER_ID)) {
            mapInstance.setPaintProperty(CIRCLES_LAYER_ID, 'circle-opacity', 0.35);
            mapInstance.setPaintProperty(CIRCLES_LAYER_ID, 'circle-radius', CIRCLES_DIMMED_RADIUS);
          }
        } else {
          stopFocusPulse();
          if (mapInstance.getLayer(CIRCLES_LAYER_ID)) {
            mapInstance.setPaintProperty(CIRCLES_LAYER_ID, 'circle-opacity', 1);
            mapInstance.setPaintProperty(CIRCLES_LAYER_ID, 'circle-radius', CIRCLES_NORMAL_RADIUS);
          }
          startFocusPulse();
        }
      } catch (e) { /* noop */ }
    };
    const onMilestoneFocused = (payload) => {
      const id = payload?.milestoneId ?? null;
      applyMilestoneHighlight(id);
    };
    const onMilestoneCleared = () => applyMilestoneHighlight(null);
    const unFocused = window.mapEventBus?.on?.('memphis:milestoneFocused', onMilestoneFocused);
    const unCleared = window.mapEventBus?.on?.('memphis:milestoneCleared', onMilestoneCleared);

    return () => {
      unFocused?.();
      unCleared?.();
      applyMilestoneHighlight(null);
      cancelled = true;
      stopFocusPulse();
      if (pulseAnimationRef.current) {
        cancelAnimationFrame(pulseAnimationRef.current);
        pulseAnimationRef.current = null;
      }
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      mapInstance.off('click', handleClick);
      mapInstance.off('mouseenter', CIRCLES_LAYER_ID);
      mapInstance.off('mouseleave', CIRCLES_LAYER_ID);
      if (mapInstance.getLayer(LABELS_LAYER_ID)) mapInstance.removeLayer(LABELS_LAYER_ID);
      if (mapInstance.getLayer(CIRCLES_LAYER_ID)) mapInstance.removeLayer(CIRCLES_LAYER_ID);
      if (mapInstance.getLayer(HALO_LAYER_ID)) mapInstance.removeLayer(HALO_LAYER_ID);
      if (mapInstance.getLayer(PULSE_LAYER_ID)) mapInstance.removeLayer(PULSE_LAYER_ID);
      if (mapInstance.getLayer(FILL_LAYER_ID)) mapInstance.removeLayer(FILL_LAYER_ID);
      if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);
    };
  }, [map, visible]);

  return null;
};

export default MLGW2026SubstationLayer;
