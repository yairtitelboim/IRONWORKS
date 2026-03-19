import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

const SOURCE_ID = 'colossus-permits-review-source';
const CIRCLES_LAYER_ID = 'colossus-permits-review-circles';
const HIGHLIGHT_LAYER_ID = 'colossus-permits-review-highlight';

// Vertex review queue (TN / DPD permits, prefiltered then classified)
const GEOJSON_URL = '/data/memphis_change/dpd_building_permits_near_colossus_5000m_recent_vertex_review_queue_v1.geojson';

const clamp01 = (v) => {
  const n = Number(v);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
};

const createPopupHTML = (props) => {
  const recordId = props.Record_ID || '—';
  const addr = props.Address || '—';
  const val = props.Valuation != null ? Number(props.Valuation) : null;
  const valStr = (val == null || Number.isNaN(val)) ? '—' : `$${val.toLocaleString()}`;
  const bucket = props.vertex_review_bucket || '—';
  const cat = props.vertex_category_primary || '—';

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
      max-width: 360px;
      min-width: 220px;
    ">
      <div style="font-weight: 700; font-size: 13px; margin-bottom: 6px;">${recordId}</div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom: 8px;">
        <span style="display:inline-block; background:#0ea5e9; color:#001018; padding:2px 8px; border-radius:12px; font-size:10px; font-weight:700;">Memphis review</span>
        <span style="display:inline-block; background:${bucket === 'review_first' ? '#f97316' : '#fbbf24'}; color:#000; padding:2px 8px; border-radius:12px; font-size:10px; font-weight:700;">${bucket}</span>
        <span style="display:inline-block; background:rgba(59,130,246,0.2); color:#bfdbfe; padding:2px 8px; border-radius:12px; font-size:10px; font-weight:700;">${cat}</span>
      </div>
      <div style="margin-bottom: 4px; color: #d1d5db;">${addr}</div>
      <div style="margin-bottom: 4px; color: #fbbf24; font-weight: 600;">${valStr}</div>
    </div>
  `;
};

/**
 * Memphis / DPD permit review queue (Vertex v1).
 * For inspection/validation of "big juicy" permits within 5km.
 */
const ColossusPermitsReviewQueueLayer = ({ map, visible }) => {
  const popupRef = useRef(null);
  const dataRef = useRef(null);
  const replacingPopupRef = useRef(false);

  useEffect(() => {
    if (!map?.current) return;
    const mapInstance = map.current;

    if (!visible) {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      // Clear any selected permit context when layer is hidden
      if (window.mapEventBus?.emit) {
        window.mapEventBus.emit('memphis:permitCleared', { source: 'colossus-review-v1' });
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

      // Cache the full dataset so we can build carousel groups for the timeline panel
      dataRef.current = data;

      if (mapInstance.getLayer(CIRCLES_LAYER_ID)) mapInstance.removeLayer(CIRCLES_LAYER_ID);
      if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);

      mapInstance.addSource(SOURCE_ID, { type: 'geojson', data, generateId: true });

      mapInstance.addLayer({
        id: CIRCLES_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4.0, 12, 6.0, 16, 10.0],
          'circle-color': [
            'match',
            ['get', 'vertex_category_primary'],
            'power', '#ef4444',
            'cooling', '#22c55e',
            'telecom', '#a855f7',
            'shell_industrial', '#f97316',
            'civil_grading', '#fbbf24',
            '#60a5fa'
          ],
          'circle-opacity': 0.9,
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(255,255,255,0.35)'
        },
        minzoom: 6
      });

      // Highlight layer for focused permit (thicker outline)
      if (!mapInstance.getLayer(HIGHLIGHT_LAYER_ID)) {
        mapInstance.addLayer({
          id: HIGHLIGHT_LAYER_ID,
          type: 'circle',
          source: SOURCE_ID,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 6.5, 12, 8.5, 16, 13.0],
            'circle-color': 'rgba(0,0,0,0)',
            'circle-stroke-width': 3,
            'circle-stroke-color': '#f97316'
          },
          filter: ['==', ['get', 'Record_ID'], '__none__'],
          minzoom: 6
        });
      }
    };

    const setHighlightRecord = (recordId) => {
      if (!mapInstance.getLayer(HIGHLIGHT_LAYER_ID)) return;
      const targetId = recordId || '__none__';
      try {
        mapInstance.setFilter(HIGHLIGHT_LAYER_ID, ['==', ['get', 'Record_ID'], targetId]);
      } catch (err) {
        // no-op if filter fails
      }
    };

    const onPopupClose = () => {
      popupRef.current = null;
      if (replacingPopupRef.current) return;
      if (window.mapEventBus?.emit) {
        window.mapEventBus.emit('memphis:permitCleared', { source: 'colossus-review-v1' });
      }
      setHighlightRecord(null);
    };

    const handleClick = (e) => {
      const features = mapInstance.queryRenderedFeatures(e.point, { layers: [CIRCLES_LAYER_ID] });
      if (!features.length) {
        if (popupRef.current) {
          popupRef.current.remove();
          popupRef.current = null;
        }
        // Clicked off a permit – clear any selected permit context
        if (window.mapEventBus?.emit) {
          window.mapEventBus.emit('memphis:permitCleared', { source: 'colossus-review-v1' });
        }
        setHighlightRecord(null);
        return;
      }
      const feature = features[0];
      const props = feature.properties || {};
      if (popupRef.current) {
        replacingPopupRef.current = true;
        popupRef.current.remove();
        popupRef.current = null;
        replacingPopupRef.current = false;
      }
      popupRef.current = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: false,
        className: 'memphis-layer-popup'
      })
        .setLngLat(e.lngLat)
        .setHTML(createPopupHTML(props))
        .addTo(mapInstance);
      popupRef.current.on('close', onPopupClose);

      if (window.mapEventBus?.emit) {
        // Build a horizontal group of permits for the carousel.
        // Use the full review queue (capped), centered around the clicked permit when possible.
        const allFeatures = dataRef.current?.features || [];
        const MAX_PERMITS = 9;
        let groupFeatures = allFeatures;

        if (allFeatures.length > MAX_PERMITS) {
          const clickedIndex = allFeatures.findIndex(
            (f) => f.properties && f.properties.Record_ID === props.Record_ID
          );

          if (clickedIndex === -1) {
            groupFeatures = allFeatures.slice(0, MAX_PERMITS);
          } else {
            const half = Math.floor(MAX_PERMITS / 2);
            let start = clickedIndex - half;
            if (start < 0) start = 0;
            let end = start + MAX_PERMITS;
            if (end > allFeatures.length) {
              end = allFeatures.length;
              start = Math.max(0, end - MAX_PERMITS);
            }
            groupFeatures = allFeatures.slice(start, end);
          }
        }

        const group = groupFeatures.map((f) => {
          const p = f.properties || {};
          return {
            Record_ID: p.Record_ID,
            Address: p.Address,
            vertex_review_bucket: p.vertex_review_bucket,
            vertex_category_primary: p.vertex_category_primary,
            Valuation: p.Valuation
          };
        });

        setHighlightRecord(props.Record_ID);

        window.mapEventBus.emit('memphis:permitSelected', {
          source: 'colossus-review-v1',
          layerLabel: 'Memphis permits review queue (Vertex v1)',
          properties: {
            Record_ID: props.Record_ID,
            Address: props.Address,
            vertex_review_bucket: props.vertex_review_bucket,
            vertex_category_primary: props.vertex_category_primary,
            Valuation: props.Valuation
          },
          group
        });

        // Open the timeline panel so the permit cards are visible
        if (typeof window !== 'undefined' && window.enableTimelineGraph) {
          window.enableTimelineGraph();
        }
      }
    };

    const setCursorPointer = () => { mapInstance.getCanvas().style.cursor = 'pointer'; };
    const setCursorDefault = () => { mapInstance.getCanvas().style.cursor = ''; };

    const handlePermitFocus = (payload) => {
      if (!payload || payload.source !== 'colossus-review-v1') return;
      const recordId = payload.recordId;
      if (!recordId || !dataRef.current?.features?.length) return;

      const feature = dataRef.current.features.find(
        (f) => f.properties && f.properties.Record_ID === recordId
      );
      if (!feature || !Array.isArray(feature.geometry?.coordinates)) return;

      const [lng, lat] = feature.geometry.coordinates;
      try {
        const currentCenter = mapInstance.getCenter();
        const currentZoom = mapInstance.getZoom();
        const dx = Math.abs(currentCenter.lng - lng);
        const dy = Math.abs(currentCenter.lat - lat);
        const alreadyClose = dx < 0.002 && dy < 0.002 && currentZoom >= 13.5;

        // Only animate camera if we're not already essentially on top of this permit
        if (!alreadyClose) {
          mapInstance.flyTo({
            center: [lng, lat],
            zoom: 14.5,
            duration: 1200
          });
        }
      } catch (_) {
        // ignore fly errors
      }
      setHighlightRecord(recordId);

      // Also show the simplified popup for context when focusing from the timeline
      const props = feature.properties || {};
      if (popupRef.current) {
        replacingPopupRef.current = true;
        popupRef.current.remove();
        popupRef.current = null;
        replacingPopupRef.current = false;
      }
      try {
        popupRef.current = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: false,
          className: 'memphis-layer-popup'
        })
          .setLngLat([lng, lat])
          .setHTML(createPopupHTML(props))
          .addTo(mapInstance);
        popupRef.current.on('close', onPopupClose);
      } catch (_) {
        // ignore popup errors
      }
    };

    const handlePermitFocusClear = (payload) => {
      if (payload && payload.source && payload.source !== 'colossus-review-v1') return;
      setHighlightRecord(null);
    };

    const unsubscribeFocus = window.mapEventBus?.on?.('memphis:permitFocus', handlePermitFocus);
    const unsubscribeFocusClear = window.mapEventBus?.on?.('memphis:permitCleared', handlePermitFocusClear);

    addLayer()
      .then(() => {
        if (cancelled) return;
        if (mapInstance.getLayer(CIRCLES_LAYER_ID)) {
          mapInstance.on('click', CIRCLES_LAYER_ID, handleClick);
          mapInstance.on('mouseenter', CIRCLES_LAYER_ID, setCursorPointer);
          mapInstance.on('mouseleave', CIRCLES_LAYER_ID, setCursorDefault);
        }
      })
      .catch((e) => console.error('Error loading Memphis review queue layer', e));

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
      if (window.mapEventBus?.emit) {
        window.mapEventBus.emit('memphis:permitCleared', { source: 'colossus-review-v1' });
      }
      if (mapInstance.getLayer(CIRCLES_LAYER_ID)) mapInstance.removeLayer(CIRCLES_LAYER_ID);
      if (mapInstance.getLayer(HIGHLIGHT_LAYER_ID)) mapInstance.removeLayer(HIGHLIGHT_LAYER_ID);
      if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);
      dataRef.current = null;

      unsubscribeFocus?.();
      unsubscribeFocusClear?.();
    };
  }, [map, visible]);

  return null;
};

export default ColossusPermitsReviewQueueLayer;
