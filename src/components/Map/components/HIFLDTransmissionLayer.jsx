import React, { useEffect, useState } from 'react';

const HIFLD_SOURCE_ID = 'hifld-transmission-source';
const HIFLD_GLOW_LAYER_ID = 'hifld-transmission-glow';
const HIFLD_LINE_LAYER_ID = 'hifld-transmission-lines';
// TODO: hifld_transmission_lines.json (355MB) must be hosted on a CDN (Vercel Blob / R2 / S3).
// Replace this URL with the CDN URL before enabling this layer.
const HIFLD_GEOJSON_URL = '/data/hifld_transmission_lines.json'; // NOT AVAILABLE LOCALLY - pending CDN upload

const VOLTAGE_COLORS = {
  1: '#6366f1',
  2: '#a855f7',
  3: '#22d3ee',
  4: '#4ade80',
  5: '#facc15',
  6: '#fb923c',
};

const VOLTAGE_GLOW_COLORS = {
  1: '#4a00e0',
  2: '#8e2de2',
  3: '#00d4ff',
  4: '#00ff88',
  5: '#ffdd00',
  6: '#ff6600',
};

const HIFLDTransmissionLayer = ({ map, visible }) => {
  const [popup, setPopup] = useState(null);

  useEffect(() => {
    if (!map?.current) return;

    if (!visible) {
      if (map.current.getLayer(HIFLD_LINE_LAYER_ID)) map.current.removeLayer(HIFLD_LINE_LAYER_ID);
      if (map.current.getLayer(HIFLD_GLOW_LAYER_ID)) map.current.removeLayer(HIFLD_GLOW_LAYER_ID);
      if (map.current.getSource(HIFLD_SOURCE_ID)) map.current.removeSource(HIFLD_SOURCE_ID);
      setPopup(null);
      return;
    }

    let cancelled = false;
    let handleClick = null;
    let handleMouseEnter = null;
    let handleMouseLeave = null;

    const addLayer = async () => {
      try {
        const resp = await fetch(HIFLD_GEOJSON_URL);
        if (!resp.ok) throw new Error(`Failed to fetch HIFLD data: ${resp.statusText}`);
        const data = await resp.json();
        if (cancelled) return;

        if (map.current.getLayer(HIFLD_LINE_LAYER_ID)) map.current.removeLayer(HIFLD_LINE_LAYER_ID);
        if (map.current.getLayer(HIFLD_GLOW_LAYER_ID)) map.current.removeLayer(HIFLD_GLOW_LAYER_ID);
        if (map.current.getSource(HIFLD_SOURCE_ID)) map.current.removeSource(HIFLD_SOURCE_ID);

        map.current.addSource(HIFLD_SOURCE_ID, { type: 'geojson', data });

        const layers = map.current.getStyle().layers;
        let beforeId = null;
        for (let i = layers.length - 1; i >= 0; i--) {
          if (layers[i].id.includes('label') || layers[i].id.includes('symbol')) {
            beforeId = layers[i].id;
            break;
          }
        }

        map.current.addLayer({
          id: HIFLD_GLOW_LAYER_ID,
          type: 'line',
          source: HIFLD_SOURCE_ID,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': [
              'case',
              ['==', ['get', 'voltage_rank'], 1], VOLTAGE_GLOW_COLORS[1],
              ['==', ['get', 'voltage_rank'], 2], VOLTAGE_GLOW_COLORS[2],
              ['==', ['get', 'voltage_rank'], 3], VOLTAGE_GLOW_COLORS[3],
              ['==', ['get', 'voltage_rank'], 4], VOLTAGE_GLOW_COLORS[4],
              ['==', ['get', 'voltage_rank'], 5], VOLTAGE_GLOW_COLORS[5],
              ['==', ['get', 'voltage_rank'], 6], VOLTAGE_GLOW_COLORS[6],
              VOLTAGE_GLOW_COLORS[1]
            ],
            'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.67, 6, 2, 10, 4.67],
            'line-blur': ['interpolate', ['linear'], ['zoom'], 3, 1, 6, 3, 10, 6],
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.2, 5, 0.3, 7, 0.4]
          }
        }, beforeId);

        map.current.addLayer({
          id: HIFLD_LINE_LAYER_ID,
          type: 'line',
          source: HIFLD_SOURCE_ID,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': [
              'case',
              ['==', ['get', 'voltage_rank'], 1], VOLTAGE_COLORS[1],
              ['==', ['get', 'voltage_rank'], 2], VOLTAGE_COLORS[2],
              ['==', ['get', 'voltage_rank'], 3], VOLTAGE_COLORS[3],
              ['==', ['get', 'voltage_rank'], 4], VOLTAGE_COLORS[4],
              ['==', ['get', 'voltage_rank'], 5], VOLTAGE_COLORS[5],
              ['==', ['get', 'voltage_rank'], 6], VOLTAGE_COLORS[6],
              VOLTAGE_COLORS[1]
            ],
            'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.17, 6, 0.5, 10, 1.33],
            'line-opacity': 0.5
          }
        }, beforeId);

        handleClick = (e) => {
          if (e.features?.length > 0) {
            const feature = e.features[0];
            const props = feature.properties || {};
            setPopup({
              lng: e.lngLat.lng,
              lat: e.lngLat.lat,
              properties: {
                voltage_category: props.voltage_category || 'Unknown',
                type: props.hifld_type || 'N/A',
                status: props.hifld_status || 'N/A',
                owner: props.hifld_owner || 'N/A',
                source: 'HIFLD'
              }
            });
          }
        };
        handleMouseEnter = () => { map.current.getCanvas().style.cursor = 'pointer'; };
        handleMouseLeave = () => { map.current.getCanvas().style.cursor = ''; };

        map.current.on('click', HIFLD_LINE_LAYER_ID, handleClick);
        map.current.on('mouseenter', HIFLD_LINE_LAYER_ID, handleMouseEnter);
        map.current.on('mouseleave', HIFLD_LINE_LAYER_ID, handleMouseLeave);

        if (window.mapEventBus) {
          window.mapEventBus.emit('hifld:dataLoaded', {
            featureCount: data.features?.length || 0,
            metadata: data.metadata
          });
        }
      } catch (e) {
        console.error('HIFLD: Failed to load transmission lines', e);
      }
    };

    if (map.current.isStyleLoaded()) {
      addLayer();
    } else {
      map.current.once('styledata', addLayer);
    }

    return () => {
      cancelled = true;
      if (handleClick) map.current?.off('click', HIFLD_LINE_LAYER_ID, handleClick);
      if (handleMouseEnter) map.current?.off('mouseenter', HIFLD_LINE_LAYER_ID, handleMouseEnter);
      if (handleMouseLeave) map.current?.off('mouseleave', HIFLD_LINE_LAYER_ID, handleMouseLeave);
    };
  }, [map, visible]);

  if (!popup) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -100%)',
        marginTop: '-10px',
        zIndex: 1000,
        background: '#0a0a14',
        color: '#e0e0e0',
        padding: '12px 16px',
        borderRadius: '8px',
        border: '1px solid rgba(0, 212, 255, 0.4)',
        boxShadow: '0 0 15px rgba(0, 212, 255, 0.3)',
        fontFamily: 'system-ui',
        fontSize: '13px',
        maxWidth: '300px',
        pointerEvents: 'auto'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: '15px', fontWeight: 700, color: '#00d4ff', marginBottom: '8px', textShadow: '0 0 8px rgba(0, 212, 255, 0.5)' }}>
        {popup.properties.voltage_category}
      </div>
      <div style={{ fontSize: '12px', lineHeight: 1.6 }}>
        <div><span style={{ color: '#888' }}>Type:</span> {popup.properties.type}</div>
        <div><span style={{ color: '#888' }}>Status:</span> {popup.properties.status}</div>
        <div><span style={{ color: '#888' }}>Owner:</span> {popup.properties.owner}</div>
      </div>
      <button
        onClick={() => setPopup(null)}
        style={{
          position: 'absolute', top: '8px', right: '8px',
          background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '18px', lineHeight: 1
        }}
      >
        ×
      </button>
    </div>
  );
};

export default HIFLDTransmissionLayer;
