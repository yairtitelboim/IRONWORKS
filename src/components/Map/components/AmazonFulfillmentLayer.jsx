import React, { useEffect, useState } from 'react';

const AMAZON_FULFILLMENT_SOURCE_ID = 'amazon-fulfillment-source';
const AMAZON_FULFILLMENT_LAYER_ID = 'amazon-fulfillment-layer';

const AmazonFulfillmentLayer = ({ map, visible }) => {
  const [popup, setPopup] = useState(null);

  useEffect(() => {
    if (!map?.current) return;
    
    if (!visible) {
      if (map.current.getLayer(AMAZON_FULFILLMENT_LAYER_ID)) map.current.removeLayer(AMAZON_FULFILLMENT_LAYER_ID);
      if (map.current.getLayer(AMAZON_FULFILLMENT_LAYER_ID + '-buffer')) map.current.removeLayer(AMAZON_FULFILLMENT_LAYER_ID + '-buffer');
      if (map.current.getSource(AMAZON_FULFILLMENT_SOURCE_ID)) map.current.removeSource(AMAZON_FULFILLMENT_SOURCE_ID);
      setPopup(null);
      return;
    }

    let cancelled = false;
    
    const addLayer = async () => {
      try {
        if (cancelled) return;
        
        // Remove existing layers/sources if they exist
        if (map.current.getLayer(AMAZON_FULFILLMENT_LAYER_ID)) map.current.removeLayer(AMAZON_FULFILLMENT_LAYER_ID);
        if (map.current.getLayer(AMAZON_FULFILLMENT_LAYER_ID + '-buffer')) map.current.removeLayer(AMAZON_FULFILLMENT_LAYER_ID + '-buffer');
        if (map.current.getSource(AMAZON_FULFILLMENT_SOURCE_ID)) map.current.removeSource(AMAZON_FULFILLMENT_SOURCE_ID);
        
        console.log('📦 Loading Amazon Fulfillment Centers data...');
        
        // Add the source from the GeoJSON file
        map.current.addSource(AMAZON_FULFILLMENT_SOURCE_ID, { 
          type: 'geojson', 
          data: '/Amazon_Fulfillment_Centers.geojson'
        });
        
        // Add the Amazon fulfillment centers buffer layer (larger circles for zoom effect)
        map.current.addLayer({
          id: AMAZON_FULFILLMENT_LAYER_ID + '-buffer',
          type: 'circle',
          source: AMAZON_FULFILLMENT_SOURCE_ID,
          filter: ['==', ['geometry-type'], 'Point'],
          paint: {
            'circle-color': '#0066FF', // Same bright blue color
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              10, 0,    // At zoom level 10, radius is 0 (invisible)
              12, 50,   // At zoom level 12, radius is 50
              15, 100,  // At zoom level 15, radius is 100
              18, 200   // At zoom level 18, radius is 200
            ],
            'circle-opacity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              10, 0,    // At zoom level 10, opacity is 0 (invisible)
              12, 0.1,  // At zoom level 12, opacity is 0.1
              15, 0.15, // At zoom level 15, opacity is 0.15
              18, 0.2   // At zoom level 18, opacity is 0.2
            ],
            'circle-stroke-color': '#0066FF',
            'circle-stroke-width': 1,
            'circle-stroke-opacity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              10, 0,    // At zoom level 10, stroke opacity is 0
              12, 0.2,  // At zoom level 12, stroke opacity is 0.2
              15, 0.3,  // At zoom level 15, stroke opacity is 0.3
              18, 0.4   // At zoom level 18, stroke opacity is 0.4
            ]
          },
          layout: {
            visibility: 'visible'
          }
        });
        
        // Add the Amazon fulfillment centers layer (Point features) with bright blue color
        map.current.addLayer({
          id: AMAZON_FULFILLMENT_LAYER_ID,
          type: 'circle',
          source: AMAZON_FULFILLMENT_SOURCE_ID,
          filter: ['==', ['geometry-type'], 'Point'],
          paint: {
            'circle-color': '#0066FF', // Bright blue color
            'circle-radius': 3,
            'circle-opacity': 0.8,
            'circle-stroke-color': '#0052CC', // Darker blue for border
            'circle-stroke-width': 2
          },
          layout: {
            visibility: 'visible'
          }
        });
        
        console.log('✅ Amazon Fulfillment Centers layer added successfully');
        
      } catch (e) {
        console.error('Failed to load Amazon Fulfillment Centers layer', e);
      }
    };
    
    addLayer();
    
    // Click handler for popups
    const handleClick = (e) => {
      if (!map.current) return;
      
      const features = map.current.queryRenderedFeatures(e.point, { 
        layers: [AMAZON_FULFILLMENT_LAYER_ID] 
      });
      
      if (features && features.length > 0) {
        const f = features[0];
        const coordinates = f.geometry.coordinates;
        
        setPopup({
          lng: coordinates[0],
          lat: coordinates[1],
          properties: f.properties
        });
      } else {
        setPopup(null);
      }
    };
    
    map.current.on('click', handleClick);
    
    return () => {
      cancelled = true;
      
      if (map.current?.getLayer(AMAZON_FULFILLMENT_LAYER_ID)) map.current.removeLayer(AMAZON_FULFILLMENT_LAYER_ID);
      if (map.current?.getLayer(AMAZON_FULFILLMENT_LAYER_ID + '-buffer')) map.current.removeLayer(AMAZON_FULFILLMENT_LAYER_ID + '-buffer');
      if (map.current?.getSource(AMAZON_FULFILLMENT_SOURCE_ID)) map.current.removeSource(AMAZON_FULFILLMENT_SOURCE_ID);
      map.current?.off('click', handleClick);
      setPopup(null);
    };
  }, [map, visible]);

  return (
    <>
      {popup && (
        <div style={{
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
          border: '1.5px solid #0066FF',
          opacity: 0.98
        }}>
          <button 
            style={{
              position: 'absolute',
              top: 10,
              right: 14,
              color: '#fff',
              background: 'none',
              border: 'none',
              fontSize: 22,
              cursor: 'pointer',
              opacity: 0.7
            }} 
            onClick={() => setPopup(null)} 
            title="Close"
          >
            ×
          </button>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>
            Amazon Fulfillment Center
          </div>
          <div style={{ 
            color: '#0066FF', 
            fontWeight: 500, 
            marginBottom: 6 
          }}>
            {popup.properties.code || 'Amazon Facility'}
          </div>
          {popup.properties.facility_type && (
            <div style={{ marginBottom: 6 }}>
              {popup.properties.facility_type}
            </div>
          )}
          {popup.properties.address && (
            <div style={{ marginBottom: 6 }}>
              {popup.properties.address}
            </div>
          )}
          {popup.properties.city && popup.properties.state && (
            <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 4 }}>
              {popup.properties.city}, {popup.properties.state}
            </div>
          )}
          <div style={{ color: '#bdbdbd', fontSize: 14, marginTop: 8 }}>
            Amazon fulfillment center for package processing and distribution
          </div>
        </div>
      )}
    </>
  );
};

export default AmazonFulfillmentLayer;
