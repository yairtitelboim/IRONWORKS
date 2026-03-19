import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

const SOURCE_ID = 'colossus-permits-source';
const CIRCLES_LAYER_ID = 'colossus-permits-circles';
const GEOJSON_URL = '/data/memphis_change/dpd_building_permits_near_colossus_5000m_recent.geojson';

const formatValuation = (v) => {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}k`;
  return `$${n.toLocaleString()}`;
};

const createPermitPopupHTML = (props) => {
  const subType = (props.Sub_Type || props.sub_type || '').toUpperCase() || '—';
  const recordId = props.Record_ID || props.record_id || '—';
  const address = props.Address || props.address || '—';
  const valuation = formatValuation(props.Valuation ?? props.valuation);
  const desc = (props.Description || props.description || '').slice(0, 120);
  const descSuffix = (props.Description || props.description || '').length > 120 ? '…' : '';
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
      max-width: 300px;
      min-width: 200px;
    ">
      <div style="font-weight: 600; font-size: 13px; margin-bottom: 6px; color: #fff;">${recordId}</div>
      <div style="display: inline-block; background: ${subType === 'COM' ? '#f97316' : '#3b82f6'}; color: #000; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 500; margin-bottom: 8px;">
        ${subType || 'Permit'}
      </div>
      <div style="margin-bottom: 4px; color: #d1d5db;">${address}</div>
      <div style="margin-bottom: 4px; color: #fbbf24; font-weight: 500;">${valuation}</div>
      ${desc ? `<div style="color: #9ca3af; font-size: 11px; margin-top: 6px;">${desc}${descSuffix}</div>` : ''}
    </div>
  `;
};

/**
 * Memphis/DPD building permits within 5km of Colossus center.
 * Covers only the Tennessee (Shelby) side of the circle; the Mississippi (DeSoto) half
 * of the AOI uses a different jurisdiction (DeSoto/Southaven permits not in this dataset).
 */
const NORMAL_RADIUS = ['interpolate', ['linear'], ['zoom'], 8, 3, 12, 4.5, 16, 7.5];
const DIMMED_RADIUS = ['interpolate', ['linear'], ['zoom'], 8, 1.5, 12, 2.5, 16, 4];

const ColossusPermitsLayer = ({ map, visible }) => {
  const popupRef = useRef(null);
  const lastMilestoneIdRef = useRef(null);

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
      try {
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
            'circle-radius': NORMAL_RADIUS,
            'circle-color': [
              'match',
              ['get', 'Sub_Type'],
              'COM', '#f97316',
              'Commercial', '#f97316',
              'RES', '#3b82f6',
              'Residential', '#3b82f6',
              '#94a3b8'
            ],
            'circle-opacity': 0.85,
            'circle-stroke-width': 0
          },
          minzoom: 6
        });
      } catch (e) {
        console.error('Error loading Colossus permits layer', e);
      }
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
      popupRef.current = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: false,
        className: 'memphis-layer-popup'
      })
        .setLngLat(e.lngLat)
        .setHTML(createPermitPopupHTML(props))
        .addTo(mapInstance);
      popupRef.current.on('close', () => { popupRef.current = null; });
    };

    const setCursorPointer = () => { mapInstance.getCanvas().style.cursor = 'pointer'; };
    const setCursorDefault = () => { mapInstance.getCanvas().style.cursor = ''; };

    const applyMilestoneDim = (milestoneId) => {
      const dimmed = milestoneId != null;
      try {
        if (!mapInstance.getLayer(CIRCLES_LAYER_ID)) return;
        mapInstance.setPaintProperty(CIRCLES_LAYER_ID, 'circle-opacity', dimmed ? 0.35 : 0.85);
        mapInstance.setPaintProperty(CIRCLES_LAYER_ID, 'circle-radius', dimmed ? DIMMED_RADIUS : NORMAL_RADIUS);
      } catch (e) { /* noop */ }
    };
    const onMilestoneFocused = (payload) => {
      lastMilestoneIdRef.current = payload?.milestoneId ?? null;
      applyMilestoneDim(lastMilestoneIdRef.current);
    };
    const onMilestoneCleared = () => {
      lastMilestoneIdRef.current = null;
      applyMilestoneDim(null);
    };
    const unFocused = window.mapEventBus?.on?.('memphis:milestoneFocused', onMilestoneFocused);
    const unCleared = window.mapEventBus?.on?.('memphis:milestoneCleared', onMilestoneCleared);

    addLayer().then(() => {
      if (cancelled) return;
      if (mapInstance.getLayer(CIRCLES_LAYER_ID)) {
        mapInstance.on('click', CIRCLES_LAYER_ID, handleClick);
        mapInstance.on('mouseenter', CIRCLES_LAYER_ID, setCursorPointer);
        mapInstance.on('mouseleave', CIRCLES_LAYER_ID, setCursorDefault);
        applyMilestoneDim(lastMilestoneIdRef.current);
      }
    });

    return () => {
      unFocused?.();
      unCleared?.();
      applyMilestoneDim(null);
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
      } catch (_) { /* noop */ }
      if (mapInstance.getLayer(CIRCLES_LAYER_ID)) mapInstance.removeLayer(CIRCLES_LAYER_ID);
      if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);
    };
  }, [map, visible]);

  return null;
};

export default ColossusPermitsLayer;
