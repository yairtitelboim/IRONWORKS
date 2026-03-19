import React, { useEffect, useState } from 'react';

const DUKE_SOURCE_ID = 'duke-transmission-easements-source';
const DUKE_LAYER_ID = 'duke-transmission-easements-layer';
const DUKE_GEOJSON_URL = '/DukeTransmissionEasements.geojson';

// Color mapping by service type - using more muted colors
const SERVICE_COLORS = {
  'Electric': '#ef4444', // Bright red for better visibility
  'Gas': '#CD853F',      // Peru instead of bright orange
};

const getColor = (service) => SERVICE_COLORS[service] || '#2196f3';

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

const DukeTransmissionEasementsLayer = ({ map, visible }) => {
  const [popup, setPopup] = useState(null); // {lng, lat, properties}

  useEffect(() => {
    const mapInstance = map?.current;
    if (!mapInstance) return;
    
    if (!visible) {
      if (mapInstance.getLayer(DUKE_LAYER_ID)) mapInstance.removeLayer(DUKE_LAYER_ID);
      if (mapInstance.getLayer(`${DUKE_LAYER_ID}-outline`)) mapInstance.removeLayer(`${DUKE_LAYER_ID}-outline`);
      if (mapInstance.getSource(DUKE_SOURCE_ID)) mapInstance.removeSource(DUKE_SOURCE_ID);
      setPopup(null);
      
      // Emit data cleared event for legend
      if (window.mapEventBus) {
        window.mapEventBus.emit('duke:dataCleared');
      }
      
      return;
    }
    
    let cancelled = false;
    const addLayer = async () => {
      try {
        const resp = await fetch(DUKE_GEOJSON_URL);
        const data = await resp.json();
        if (cancelled) return;
        
        if (mapInstance.getLayer(DUKE_LAYER_ID)) mapInstance.removeLayer(DUKE_LAYER_ID);
        if (mapInstance.getLayer(`${DUKE_LAYER_ID}-outline`)) mapInstance.removeLayer(`${DUKE_LAYER_ID}-outline`);
        if (mapInstance.getSource(DUKE_SOURCE_ID)) mapInstance.removeSource(DUKE_SOURCE_ID);
        
        mapInstance.addSource(DUKE_SOURCE_ID, { type: 'geojson', data });
        
        // Add fill layer for the easement areas
        mapInstance.addLayer({
          id: DUKE_LAYER_ID,
          type: 'fill',
          source: DUKE_SOURCE_ID,
          paint: {
            'fill-color': [
              'case',
              ['==', ['get', 'Service'], 'Electric'], '#ef4444',
              ['==', ['get', 'Service'], 'Gas'], '#CD853F',
              '#2196f3' // default
            ],
            'fill-opacity': 0.5
          }
        });
        
        // Force update the opacity to ensure it takes effect
        setTimeout(() => {
          if (mapInstance.getLayer(DUKE_LAYER_ID)) {
            mapInstance.setPaintProperty(DUKE_LAYER_ID, 'fill-opacity', 0.5);
          }
        }, 100);
        
        // Add outline layer for better visibility
        mapInstance.addLayer({
          id: `${DUKE_LAYER_ID}-outline`,
          type: 'line',
          source: DUKE_SOURCE_ID,
          paint: {
            'line-color': [
              'case',
              ['==', ['get', 'Service'], 'Electric'], '#ef4444',
              ['==', ['get', 'Service'], 'Gas'], '#CD853F',
              '#2196f3' // default
            ],
            'line-width': [
              'case',
              ['==', ['get', 'Service'], 'Gas'], 3,
              1 // Electric and default
            ],
            'line-opacity': 0.2
          }
        });
        
        // Emit data loaded event for legend
        if (window.mapEventBus && data && data.features) {
          window.mapEventBus.emit('duke:dataLoaded', {
            features: data.features,
            timestamp: Date.now()
          });
        }
        
      } catch (e) {
        console.error('Failed to load Duke transmission easements', e);
      }
    };
    
    addLayer();
    
    // Click handler for popups - only attach after layers are confirmed to exist
    const handleClick = (e) => {
      if (!mapInstance) return;
      
      // Check if layers exist before querying
      const hasFillLayer = mapInstance.getLayer(DUKE_LAYER_ID);
      const hasOutlineLayer = mapInstance.getLayer(`${DUKE_LAYER_ID}-outline`);
      
      if (!hasFillLayer && !hasOutlineLayer) {
        // Layers don't exist yet or were removed - skip query
        return;
      }
      
      // Build layers array with only existing layers
      const existingLayers = [];
      if (hasFillLayer) existingLayers.push(DUKE_LAYER_ID);
      if (hasOutlineLayer) existingLayers.push(`${DUKE_LAYER_ID}-outline`);
      
      try {
        const features = mapInstance.queryRenderedFeatures(e.point, { 
          layers: existingLayers
        });
        if (features && features.length > 0) {
          const f = features[0];
          // Calculate center point for popup
          const bounds = f.geometry.type === 'Polygon' 
            ? f.geometry.coordinates[0] 
            : f.geometry.coordinates;
          const centerLng = bounds.reduce((sum, coord) => sum + coord[0], 0) / bounds.length;
          const centerLat = bounds.reduce((sum, coord) => sum + coord[1], 0) / bounds.length;
          
          setPopup({
            lng: centerLng,
            lat: centerLat,
            properties: f.properties
          });
        } else {
          setPopup(null);
        }
      } catch (error) {
        // Layer might have been removed between check and query
        console.warn('⚠️ [DukeTransmissionEasementsLayer] Error querying features:', error.message);
        return;
      }
    };
    
    // Attach click handler after a short delay to ensure layers are added
    const clickHandlerTimeout = setTimeout(() => {
      if (mapInstance && !cancelled) {
        mapInstance.on('click', handleClick);
      }
    }, 200);
    
    return () => {
      cancelled = true;
      clearTimeout(clickHandlerTimeout);
      if (mapInstance?.getLayer(DUKE_LAYER_ID)) mapInstance.removeLayer(DUKE_LAYER_ID);
      if (mapInstance?.getLayer(`${DUKE_LAYER_ID}-outline`)) mapInstance.removeLayer(`${DUKE_LAYER_ID}-outline`);
      if (mapInstance?.getSource(DUKE_SOURCE_ID)) mapInstance.removeSource(DUKE_SOURCE_ID);
      mapInstance?.off('click', handleClick);
      setPopup(null);
    };
  }, [map, visible]);

  return (
    <>
      {/* Popup */}
      {popup && (
        <div style={popupStyle}>
          <button style={closeBtnStyle} onClick={() => setPopup(null)} title="Close">×</button>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>
            Duke Transmission Easement
          </div>
          <div style={{ color: getColor(popup.properties.Service), fontWeight: 500, marginBottom: 6 }}>
            {popup.properties.Service} Service
          </div>
          {popup.properties.County && (
            <div style={{ marginBottom: 6 }}>
              <strong>County:</strong> {popup.properties.County}
            </div>
          )}
          {popup.properties.Grantor && (
            <div style={{ marginBottom: 6 }}>
              <strong>Grantor:</strong> {popup.properties.Grantor}
            </div>
          )}
          {popup.properties.DeedPlatBook && (
            <div style={{ marginBottom: 6 }}>
              <strong>Deed Book:</strong> {popup.properties.DeedPlatBook}, Page {popup.properties.PageNumber}
            </div>
          )}
          {popup.properties.Shape__Area && (
            <div style={{ color: '#bdbdbd', fontSize: 14, marginTop: 8 }}>
              Area: {Math.round(popup.properties.Shape__Area)} sq ft
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default DukeTransmissionEasementsLayer;
