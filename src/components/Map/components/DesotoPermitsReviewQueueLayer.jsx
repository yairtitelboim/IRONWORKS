import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

const SOURCE_ID = 'desoto-permits-review-source';
const CIRCLES_LAYER_ID = 'desoto-permits-review-circles';

// v4 = Vertex classification run that includes EnerGov detail fields
const GEOJSON_URL = '/data/memphis_change/desoto_building_permits_near_colossus_5000m_vertex_review_queue_v4.geojson';

const clamp01 = (v) => {
  const n = Number(v);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
};

const createPopupHTML = (props) => {
  const recordId = props.Record_ID || '—';
  const addr = props.energov_main_address || props.Address || '—';
  const permitType = props.Permit_Type || '—';
  const workclass = props.energov_workclass_name || props.Sub_Type || '—';
  const dc = props.vertex_dc_relevance ?? props.vertex_dc_relevance?.toString?.() ?? props.vertex_dc_relevance;
  const dcScore = clamp01(dc);
  const bucket = props.vertex_review_bucket || '—';
  const reason = (props.vertex_reason || '').slice(0, 220);
  const kw = Array.isArray(props.vertex_keywords) ? props.vertex_keywords.join(', ') : (props.vertex_keywords || '');

  return `
    <div class="desoto-popup-card" style="position: relative;
      background: rgba(17, 24, 39, 0.95);
      border-radius: 8px;
      padding: 12px 16px;
      color: #f9fafb;
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2);
      max-width: 340px;
      min-width: 220px;
    ">
      <button type="button" class="desoto-popup-close" aria-label="Close" style="
        position: absolute; top: 8px; right: 8px; width: 24px; height: 24px;
        border: none; border-radius: 6px; background: rgba(255,255,255,0.12);
        color: #9ca3af; cursor: pointer; font-size: 14px; line-height: 1;
        display: flex; align-items: center; justify-content: center;
      ">×</button>
      <div style="font-weight: 700; font-size: 13px; margin-bottom: 6px;">${recordId}</div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom: 8px;">
        <span style="display:inline-block; background:#8b5cf6; color:#fff; padding:2px 8px; border-radius:12px; font-size:10px; font-weight:600;">DeSoto review</span>
        <span style="display:inline-block; background:${bucket === 'review_first' ? '#f97316' : '#fbbf24'}; color:#000; padding:2px 8px; border-radius:12px; font-size:10px; font-weight:600;">${bucket}</span>
        <span style="display:inline-block; background:rgba(59,130,246,0.2); color:#bfdbfe; padding:2px 8px; border-radius:12px; font-size:10px; font-weight:600;">dc=${dcScore.toFixed(2)}</span>
      </div>
      <div style="margin-bottom: 4px; color: #d1d5db; white-space:pre-line;">${addr}</div>
      <div style="margin-bottom: 4px; color: #9ca3af;">${permitType}</div>
      <div style="margin-bottom: 4px; color: #9ca3af;">Workclass: ${workclass}</div>
      ${kw ? `<div style="margin-top: 6px; color:#a7f3d0; font-size:11px;">keywords: ${kw}</div>` : ''}
      ${reason ? `<div style="margin-top: 6px; color:#9ca3af; font-size:11px;">${reason}</div>` : ''}
    </div>
  `;
};

/**
 * DeSoto permit review queue (Vertex v4).
 * Intended for *inspection* (validation) rather than showing all permits.
 */
const DesotoPermitsReviewQueueLayer = ({ map, visible }) => {
  const popupRef = useRef(null);

  useEffect(() => {
    if (!map?.current) return;
    const mapInstance = map.current;

    if (!visible) {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      if (mapInstance.getLayer(CIRCLES_LAYER_ID)) mapInstance.removeLayer(CIRCLES_LAYER_ID);
      if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);
      return;
    }

    let cancelled = false;

    const addLayer = async () => {
      const resp = await fetch(GEOJSON_URL);
      const data = await resp.json();
      if (cancelled) return;
      if (!data.features?.length) return;

      if (mapInstance.getLayer(CIRCLES_LAYER_ID)) mapInstance.removeLayer(CIRCLES_LAYER_ID);
      if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);

      mapInstance.addSource(SOURCE_ID, { type: 'geojson', data, generateId: true });

      mapInstance.addLayer({
        id: CIRCLES_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          // slightly larger so it stands out
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4.0, 12, 6.0, 16, 9.0],
          // color by dc_relevance
          'circle-color': [
            'interpolate',
            ['linear'],
            ['to-number', ['get', 'vertex_dc_relevance'], 0],
            0.0, '#60a5fa',
            0.35, '#fbbf24',
            0.7, '#f97316',
            1.0, '#ef4444'
          ],
          'circle-opacity': 0.9,
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(255,255,255,0.35)'
        },
        minzoom: 6
      });
    };

    const handleClick = (e) => {
      const features = mapInstance.queryRenderedFeatures(e.point, { layers: [CIRCLES_LAYER_ID] });
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
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: true,
        className: 'memphis-layer-popup'
      })
        .setLngLat(e.lngLat);

      const contentWrap = document.createElement('div');
      contentWrap.innerHTML = createPopupHTML(props);
      const closeBtn = contentWrap.querySelector('.desoto-popup-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          popup.remove();
        });
      }
      popup.setDOMContent(contentWrap);
      popup.addTo(mapInstance);
      popup.on('close', () => { popupRef.current = null; });
      popupRef.current = popup;
    };

    const setCursorPointer = () => { mapInstance.getCanvas().style.cursor = 'pointer'; };
    const setCursorDefault = () => { mapInstance.getCanvas().style.cursor = ''; };

    addLayer()
      .then(() => {
        if (cancelled) return;
        if (mapInstance.getLayer(CIRCLES_LAYER_ID)) {
          mapInstance.on('click', CIRCLES_LAYER_ID, handleClick);
          mapInstance.on('mouseenter', CIRCLES_LAYER_ID, setCursorPointer);
          mapInstance.on('mouseleave', CIRCLES_LAYER_ID, setCursorDefault);
        }
      })
      .catch((e) => console.error('Error loading DeSoto review queue layer', e));

    return () => {
      cancelled = true;
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      try {
        if (mapInstance.getLayer(CIRCLES_LAYER_ID)) {
          mapInstance.off('click', CIRCLES_LAYER_ID, handleClick);
          mapInstance.off('mouseenter', CIRCLES_LAYER_ID, setCursorPointer);
          mapInstance.off('mouseleave', CIRCLES_LAYER_ID, setCursorDefault);
        }
      } catch (_) {}
      if (mapInstance.getLayer(CIRCLES_LAYER_ID)) mapInstance.removeLayer(CIRCLES_LAYER_ID);
      if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);
    };
  }, [map, visible]);

  return null;
};

export default DesotoPermitsReviewQueueLayer;
