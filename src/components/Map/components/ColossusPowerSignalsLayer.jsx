import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

const GEOJSON_URL = '/data/colossus_power/colossus_power_signals_aug2025_feb2026.geojson';
const CIRCLES_SOURCE_ID = 'colossus-power-signals-circles-source';
const FILL_LAYER_ID = 'colossus-power-signals-circles-fill';
const HALO_LAYER_ID = 'colossus-power-signals-circles-halo';
const RADIUS_M = 804.672; // 0.5 mile
const HALO_RADIUS_M = 965.6; // ~1.2x for soft halo
const PULSE_DURATION_MS = 2500;

/** Teardrop color: amber (distinct from xAI Sites purple #a78bfa). */
const TEARDROP_COLOR = '#f59e0b';

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

const createPopupHTML = (props) => {
  const labelText = (props.label_text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
  const name = props.name || props.signal_type || 'Power signal';
  const sourceUrl = props.source_url || '';
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
      max-width: 320px;
      min-width: 200px;
    ">
      <div style="font-weight: 600; font-size: 13px; margin-bottom: 6px; color: #fff;">${name}</div>
      <div style="display: inline-block; background: #f59e0b; color: #000; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; margin-bottom: 8px;">
        Colossus power signals
      </div>
      <div style="color: #d1d5db; font-size: 11px; line-height: 1.5;">${labelText || '—'}</div>
      ${sourceUrl ? `
        <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer"
           style="color: #f59e0b; text-decoration: underline; font-size: 11px; display: inline-block; margin-top: 8px;">
          Source →
        </a>
      ` : ''}
    </div>
  `;
};

/**
 * Colossus power signals (Aug 2025–Feb 2026): TDEC permits, MLGW committee items.
 * Uses teardrop markers (same style as xAI Sites) in amber, plus 0.5 mi circles with pulse/halo.
 */
const ColossusPowerSignalsLayer = ({ map, visible }) => {
  const popupRef = useRef(null);
  const markersRef = useRef([]);
  const pulseRafRef = useRef(null);

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
      if (mapInstance.getLayer(HALO_LAYER_ID)) mapInstance.removeLayer(HALO_LAYER_ID);
      if (mapInstance.getLayer(FILL_LAYER_ID)) mapInstance.removeLayer(FILL_LAYER_ID);
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

        const pointFeatures = (data.features || []).filter(
          (f) => f.geometry?.type === 'Point' && Array.isArray(f.geometry?.coordinates)
        );
        if (!pointFeatures.length) return;

        // Circle polygons: 0.5 mi (fill + outline) and halo (slightly larger, soft fill)
        const circleFeatures = pointFeatures.map((f) => {
          const [lng, lat] = f.geometry.coordinates;
          return { type: 'Feature', properties: {}, geometry: circlePolygon(lng, lat, RADIUS_M) };
        });
        const haloFeatures = pointFeatures.map((f) => {
          const [lng, lat] = f.geometry.coordinates;
          return { type: 'Feature', properties: {}, geometry: circlePolygon(lng, lat, HALO_RADIUS_M) };
        });

        if (mapInstance.getLayer(HALO_LAYER_ID)) mapInstance.removeLayer(HALO_LAYER_ID);
        if (mapInstance.getLayer(FILL_LAYER_ID)) mapInstance.removeLayer(FILL_LAYER_ID);
        if (mapInstance.getSource(CIRCLES_SOURCE_ID)) mapInstance.removeSource(CIRCLES_SOURCE_ID);
        if (mapInstance.getSource(`${CIRCLES_SOURCE_ID}-halo`)) mapInstance.removeSource(`${CIRCLES_SOURCE_ID}-halo`);

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

        // Teardrop markers (on top of circles)
        markersRef.current.forEach((m) => {
          try { m.remove(); } catch (_) {}
        });
        markersRef.current = [];

        pointFeatures.forEach((feature) => {
          const [lng, lat] = feature.geometry.coordinates;
          const props = feature.properties || {};
          const name = props.name || props.signal_type || 'Power signal';

          const marker = new mapboxgl.Marker({
            color: TEARDROP_COLOR,
            anchor: 'bottom',
            scale: 1,
          })
            .setLngLat([lng, lat])
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
              closeOnClick: false,
              className: 'memphis-layer-popup'
            })
              .setLngLat([lng, lat])
              .setHTML(createPopupHTML(props))
              .addTo(mapInstance);
            popupRef.current.on('close', () => { popupRef.current = null; });
          });

          markersRef.current.push(marker);
        });
      } catch (e) {
        console.error('Error loading Colossus power signals layer', e);
      }
    };

    addLayer();

    return () => {
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
      try {
        if (mapInstance.getLayer(HALO_LAYER_ID)) mapInstance.removeLayer(HALO_LAYER_ID);
        if (mapInstance.getLayer(FILL_LAYER_ID)) mapInstance.removeLayer(FILL_LAYER_ID);
        if (mapInstance.getSource(CIRCLES_SOURCE_ID)) mapInstance.removeSource(CIRCLES_SOURCE_ID);
        if (mapInstance.getSource(`${CIRCLES_SOURCE_ID}-halo`)) mapInstance.removeSource(`${CIRCLES_SOURCE_ID}-halo`);
      } catch (_) { /* noop */ }
    };
  }, [map, visible]);

  return null;
};

export default ColossusPowerSignalsLayer;
