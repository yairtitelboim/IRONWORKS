import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

const SOURCE_ID = 'xai-sites-public-source';
const LABELS_LAYER_ID = 'xai-sites-public-labels';
const CIRCLES_SOURCE_ID = 'xai-sites-public-circles-source';
const FILL_LAYER_ID = 'xai-sites-public-circles-fill';
const HALO_LAYER_ID = 'xai-sites-public-circles-halo';
const GEOJSON_URL = '/memphis-tn/xai_sites_public.geojson';
const RADIUS_M = 804.672; // 0.5 mile
const HALO_RADIUS_M = 965.6; // ~1.2x for soft halo
const PULSE_DURATION_MS = 2500;

/** Teardrop marker color (purple to match xAI brand) */
const TEARDROP_COLOR = '#a78bfa';

const statusColors = { acquired: '#10b981', reported: '#f59e0b', default: '#a78bfa' };

/** Create a circle polygon (GeoJSON) around [lng, lat] with given radius in meters. */
function circlePolygon(lng, lat, radiusM, steps = 64) {
  const latDegPerM = 1 / 111320;
  const lngDegPerM = 1 / (111320 * Math.cos((lat * Math.PI) / 180));
  const ring = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    ring.push([
      lng + (radiusM * lngDegPerM) * Math.cos(angle),
      lat + (radiusM * latDegPerM) * Math.sin(angle)
    ]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}

const createXAISitePopupHTML = (props) => {
  const status = (props.status || 'reported').toLowerCase();
  const statusColor = statusColors[status] || statusColors.default;
  const statusLabel = (props.status || 'reported').replace(/_/g, ' ');
  const phase = props.phase || '';
  const capacityMw = props.capacity_mw != null ? props.capacity_mw : null;
  const narrative = props.narrative || '';
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
      max-width: 320px;
      min-width: 200px;
    ">
      <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px; color: #fff;">
        ${props.name || 'xAI Site'}
      </div>
      <div style="display: inline-block; background: ${statusColor}; color: #000; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 500; margin-bottom: 6px; text-transform: capitalize;">
        ${statusLabel}
      </div>
      ${phase ? `<div style="display: inline-block; margin-left: 6px; background: #6366f1; color: #fff; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 500; margin-bottom: 6px;">${phase}</div>` : ''}
      ${capacityMw != null ? `<div style="display: inline-block; margin-left: 6px; color: #fbbf24; font-size: 11px; font-weight: 600;">${capacityMw} MW</div>` : ''}
      ${props.address ? `<div style="margin-bottom: 4px; color: #9ca3af; font-size: 11px;">${props.address}</div>` : ''}
      ${narrative ? `<div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); color: #d1d5db; font-size: 11px; line-height: 1.45;">${narrative}</div>` : ''}
      ${props.source_url ? `
        <a href="${props.source_url}" target="_blank" rel="noopener noreferrer"
           style="color: #a78bfa; text-decoration: underline; font-size: 11px; display: inline-block; margin-top: 8px;">
          Source →
        </a>
      ` : ''}
    </div>
  `;
};

const XAISitesPublicLayer = ({ map, visible }) => {
  const popupRef = useRef(null);
  const pulseRafRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!map?.current) return;

    const mapInstance = map.current;

    if (!visible) {
      if (pulseRafRef.current) {
        cancelAnimationFrame(pulseRafRef.current);
        pulseRafRef.current = null;
      }
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      markersRef.current.forEach((m) => {
        try { m.remove(); } catch (_) {}
      });
      markersRef.current = [];
      if (mapInstance.getLayer(LABELS_LAYER_ID)) mapInstance.removeLayer(LABELS_LAYER_ID);
      if (mapInstance.getLayer(HALO_LAYER_ID)) mapInstance.removeLayer(HALO_LAYER_ID);
      if (mapInstance.getLayer(FILL_LAYER_ID)) mapInstance.removeLayer(FILL_LAYER_ID);
      if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);
      if (mapInstance.getSource(CIRCLES_SOURCE_ID)) mapInstance.removeSource(CIRCLES_SOURCE_ID);
      if (mapInstance.getSource(`${CIRCLES_SOURCE_ID}-halo`)) mapInstance.removeSource(`${CIRCLES_SOURCE_ID}-halo`);
      return;
    }

    let cancelled = false;

    const addLayer = async () => {
      try {
        const resp = await fetch(GEOJSON_URL);
        const data = await resp.json();
        if (cancelled) return;
        if (!data.features?.length) return;

        const pointFeatures = data.features.filter(
          (f) => f.geometry?.type === 'Point' && Array.isArray(f.geometry?.coordinates)
        );

        const processed = {
          ...data,
          features: pointFeatures.map(f => {
            const p = f.properties || {};
            const label = p.phase || 'xAI';
            return {
              ...f,
              properties: { ...p, label_text: label }
            };
          })
        };

        // Circle polygons: 0.5 mi (fill + outline) and halo (slightly larger, soft fill)
        const circleFeatures = pointFeatures.map((f) => {
          const [lng, lat] = f.geometry.coordinates;
          return { type: 'Feature', properties: {}, geometry: circlePolygon(lng, lat, RADIUS_M) };
        });
        const haloFeatures = pointFeatures.map((f) => {
          const [lng, lat] = f.geometry.coordinates;
          return { type: 'Feature', properties: {}, geometry: circlePolygon(lng, lat, HALO_RADIUS_M) };
        });

        if (mapInstance.getLayer(LABELS_LAYER_ID)) mapInstance.removeLayer(LABELS_LAYER_ID);
        if (mapInstance.getLayer(HALO_LAYER_ID)) mapInstance.removeLayer(HALO_LAYER_ID);
        if (mapInstance.getLayer(FILL_LAYER_ID)) mapInstance.removeLayer(FILL_LAYER_ID);
        if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);
        if (mapInstance.getSource(CIRCLES_SOURCE_ID)) mapInstance.removeSource(CIRCLES_SOURCE_ID);
        if (mapInstance.getSource(`${CIRCLES_SOURCE_ID}-halo`)) mapInstance.removeSource(`${CIRCLES_SOURCE_ID}-halo`);

        mapInstance.addSource(SOURCE_ID, { type: 'geojson', data: processed, generateId: true });
        mapInstance.addSource(CIRCLES_SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: circleFeatures },
          generateId: true
        });
        mapInstance.addSource(`${CIRCLES_SOURCE_ID}-halo`, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: haloFeatures },
          generateId: true
        });

        // Halo: very light fill, below main circle (no outline)
        mapInstance.addLayer({
          id: HALO_LAYER_ID,
          type: 'fill',
          source: `${CIRCLES_SOURCE_ID}-halo`,
          paint: {
            'fill-color': TEARDROP_COLOR,
            'fill-opacity': 0.04
          },
          minzoom: 6
        });

        // Main circle: light fill + outline same as teardrop
        mapInstance.addLayer({
          id: FILL_LAYER_ID,
          type: 'fill',
          source: CIRCLES_SOURCE_ID,
          paint: {
            'fill-color': TEARDROP_COLOR,
            'fill-opacity': 0.08,
            'fill-outline-color': TEARDROP_COLOR
          },
          minzoom: 6
        });

        // Pulse + halo animation
        const startTime = Date.now();
        const animate = () => {
          if (cancelled) return;
          const elapsed = (Date.now() - startTime) % PULSE_DURATION_MS;
          const t = elapsed / PULSE_DURATION_MS;
          const wave = Math.sin(t * Math.PI * 2);
          const fillOpacity = 0.05 + 0.06 * (wave + 1) / 2;
          const haloOpacity = 0.02 + 0.04 * (wave + 1) / 2;
          try {
            if (mapInstance.getLayer(FILL_LAYER_ID)) {
              mapInstance.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', fillOpacity);
            }
            if (mapInstance.getLayer(HALO_LAYER_ID)) {
              mapInstance.setPaintProperty(HALO_LAYER_ID, 'fill-opacity', haloOpacity);
            }
          } catch (e) { /* noop */ }
          pulseRafRef.current = requestAnimationFrame(animate);
        };
        pulseRafRef.current = requestAnimationFrame(animate);

        mapInstance.addLayer({
          id: LABELS_LAYER_ID,
          type: 'symbol',
          source: SOURCE_ID,
          layout: {
            'text-field': ['get', 'label_text'],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 6, 12, 10, 14, 14, 18],
            'text-anchor': 'bottom',
            'text-offset': [0, -4.5],
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

        // Create teardrop markers (on top of circles)
        markersRef.current.forEach((m) => {
          try { m.remove(); } catch (_) {}
        });
        markersRef.current = [];

        processed.features.forEach((feature) => {
          const coords = feature.geometry.coordinates;
          const props = feature.properties || {};
          const name = props.name || 'xAI Site';

          const marker = new mapboxgl.Marker({
            color: TEARDROP_COLOR,
            anchor: 'bottom',
            scale: 1.2,
          })
            .setLngLat(coords)
            .addTo(mapInstance);

          const el = marker.getElement();
          el.style.cursor = 'pointer';
          el.title = name;

          el.addEventListener('click', (e) => {
            e.stopPropagation();
            if (popupRef.current) {
              popupRef.current.remove();
              popupRef.current = null;
            }
            popupRef.current = new mapboxgl.Popup({
              closeButton: true,
              closeOnClick: true,
              anchor: 'bottom',
              offset: [0, -35],
              maxWidth: '400px',
              className: 'memphis-layer-popup'
            })
              .setLngLat(coords)
              .setHTML(createXAISitePopupHTML(props))
              .addTo(mapInstance);
            popupRef.current.on('close', () => { popupRef.current = null; });
          });

          markersRef.current.push(marker);
        });
      } catch (e) {
        console.error('Error loading xAI sites (public) layer', e);
      }
    };

    addLayer();

    // Timeline → Map: focused = fully visible; dimmed = another milestone focused
    const applyMilestoneHighlight = (milestoneId) => {
      const focused = milestoneId === 'xai-150mw' || milestoneId === 'advantage';
      const dimmed = milestoneId != null && !focused;
      try {
        // Control teardrop marker visibility based on milestone focus
        markersRef.current.forEach((m) => {
          const el = m.getElement();
          if (el) {
            if (focused) {
              el.style.opacity = '1';
              el.style.transform = 'scale(1.1)';
            } else if (dimmed) {
              el.style.opacity = '0.4';
              el.style.transform = 'scale(1)';
            } else {
              el.style.opacity = '1';
              el.style.transform = 'scale(1)';
            }
          }
        });
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
      if (pulseRafRef.current) {
        cancelAnimationFrame(pulseRafRef.current);
        pulseRafRef.current = null;
      }
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      markersRef.current.forEach((m) => {
        try { m.remove(); } catch (_) {}
      });
      markersRef.current = [];
      if (mapInstance.getLayer(LABELS_LAYER_ID)) mapInstance.removeLayer(LABELS_LAYER_ID);
      if (mapInstance.getLayer(HALO_LAYER_ID)) mapInstance.removeLayer(HALO_LAYER_ID);
      if (mapInstance.getLayer(FILL_LAYER_ID)) mapInstance.removeLayer(FILL_LAYER_ID);
      if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);
      if (mapInstance.getSource(CIRCLES_SOURCE_ID)) mapInstance.removeSource(CIRCLES_SOURCE_ID);
      if (mapInstance.getSource(`${CIRCLES_SOURCE_ID}-halo`)) mapInstance.removeSource(`${CIRCLES_SOURCE_ID}-halo`);
    };
  }, [map, visible]);

  return null;
};

export default XAISitesPublicLayer;
