import React, { useEffect, useState } from 'react';

const INFRA_SOURCE_ID = 'key-infra-hs-source';
const INFRA_LAYER_ID = 'key-infra-hs-layer';
const INFRA_GEOJSON_URL = '/data/key_infrastructure_howard_solstice.json';

// Color mapping by type/category
const TYPE_COLORS = {
  'Wind': '#4FC3F7',
  'Wind Farm': '#4FC3F7',
  'Data Center': '#FFD600',
  'Data center campus (behind-the-meter load)': '#FFD600',
  'High-density data center facility': '#FFD600',
  'Planned 250 MW AI-ready data center': '#FFD600',
  'Natural gas combined-cycle power + data center site (~570 MW phase I)': '#FF7043',
  'Natural gas processing facility': '#FF7043',
  'Natural gas-fired combined-cycle plant (545 MW)': '#FF7043',
  'Natural gas-fired generating station (639 MW)': '#FF7043',
  'Natural gas combined-cycle plant (1,824 MW)': '#FF7043',
  'BESS': '#AB47BC',
  'Battery Storage': '#AB47BC',
  'Land parcels for industrial, energy, and data center development': '#8D6E63',
  'Energy/property infrastructure platform with data-center targeting': '#8D6E63',
  'Substation': '#90A4AE',
  'Solar Farm': '#FFF176',
  'Flexible Load': '#00E676',
  'Clean Gen/Data': '#00B8D4',
  'Future Power + Data Campus': '#00B8D4',
};

const getColor = (type) => TYPE_COLORS[type] || '#2196f3';

const legendItems = [
  { label: 'Wind', color: '#4FC3F7' },
  { label: 'Data Center', color: '#FFD600' },
  { label: 'Gas/Power Plant', color: '#FF7043' },
  { label: 'BESS', color: '#AB47BC' },
  { label: 'Land/Infra', color: '#8D6E63' },
  { label: 'Substation', color: '#90A4AE' },
  { label: 'Solar', color: '#FFF176' },
  { label: 'Flexible Load', color: '#00E676' },
  { label: 'Other', color: '#2196f3' },
];

// Ensure the legend is always at the bottom left, not top/right
const legendStyle = {
  position: 'fixed',
  bottom: 32,
  left: 32,
  right: 'auto', // explicitly unset right
  top: 'auto',   // explicitly unset top
  zIndex: 1002,
  background: '#181A1B',
  color: '#fff',
  borderRadius: 8,
  padding: '12px 18px',
  boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
  fontSize: 14,
  minWidth: 180,
  maxWidth: 260,
  opacity: 0.97
};

const legendItemStyle = {
  display: 'flex',
  alignItems: 'center',
  marginBottom: 6
};

const colorDotStyle = (color) => ({
  width: 16,
  height: 16,
  borderRadius: 8,
  background: color,
  marginRight: 10,
  border: '2px solid #222'
});

const popupStyle = {
  position: 'absolute',
  zIndex: 20,
  left: 0,
  right: 0,
  margin: '0 auto',
  top: 120,
  maxWidth: 340,
  background: '#23272A',
  color: '#fff',
  borderRadius: 12,
  boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
  padding: 20,
  fontSize: 15,
  lineHeight: 1.6,
  border: '1.5px solid #333',
  opacity: 0.98
};

const closeBtnStyle = {
  position: 'absolute',
  top: 10,
  right: 14,
  color: '#fff',
  background: 'none',
  border: 'none',
  fontSize: 22,
  cursor: 'pointer',
  opacity: 0.7
};

const InfrastructureLayer = ({ map, visible }) => {
  const [popup, setPopup] = useState(null); // {lng, lat, properties}

  useEffect(() => {
    if (!map?.current) return;
    if (!visible) {
      if (map.current.getLayer(INFRA_LAYER_ID)) map.current.removeLayer(INFRA_LAYER_ID);
      if (map.current.getSource(INFRA_SOURCE_ID)) map.current.removeSource(INFRA_SOURCE_ID);
      setPopup(null);
      return;
    }
    let cancelled = false;
    const addLayer = async () => {
      try {
        const resp = await fetch(INFRA_GEOJSON_URL);
        const data = await resp.json();
        if (cancelled) return;
        if (map.current.getLayer(INFRA_LAYER_ID)) map.current.removeLayer(INFRA_LAYER_ID);
        if (map.current.getSource(INFRA_SOURCE_ID)) map.current.removeSource(INFRA_SOURCE_ID);
        map.current.addSource(INFRA_SOURCE_ID, { type: 'geojson', data });
        map.current.addLayer({
          id: INFRA_LAYER_ID,
          type: 'circle',
          source: INFRA_SOURCE_ID,
          paint: {
            'circle-radius': 7,
            'circle-color': [
              'case',
              ...Object.entries(TYPE_COLORS).flatMap(([type, color]) => [
                ['==', ['get', 'type'], type], color
              ]),
              '#2196f3' // default
            ],
            'circle-opacity': 0.95
          }
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to load infrastructure markers', e);
      }
    };
    addLayer();
    // Click handler for popups
    const handleClick = (e) => {
      if (!map.current) return;
      const features = map.current.queryRenderedFeatures(e.point, { layers: [INFRA_LAYER_ID] });
      if (features && features.length > 0) {
        const f = features[0];
        setPopup({
          lng: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
          properties: f.properties
        });
      } else {
        setPopup(null);
      }
    };
    map.current.on('click', handleClick);
    return () => {
      cancelled = true;
      if (map.current?.getLayer(INFRA_LAYER_ID)) map.current.removeLayer(INFRA_LAYER_ID);
      if (map.current?.getSource(INFRA_SOURCE_ID)) map.current.removeSource(INFRA_SOURCE_ID);
      map.current?.off('click', handleClick);
      setPopup(null);
    };
  }, [map, visible]);

  return (
    <>
      {/* Legend removed from here. Only popup remains. */}
      {popup && (
        <div style={popupStyle}>
          <button style={closeBtnStyle} onClick={() => setPopup(null)} title="Close">×</button>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>{popup.properties.name}</div>
          <div style={{ color: '#FFD600', fontWeight: 500, marginBottom: 6 }}>{popup.properties.type}</div>
          <div style={{ marginBottom: 6 }}>{popup.properties.address}</div>
          {popup.properties.details && (
            <div style={{ color: '#bdbdbd', fontSize: 14, marginTop: 8 }}>{popup.properties.details}</div>
          )}
        </div>
      )}
    </>
  );
};

export default InfrastructureLayer; 