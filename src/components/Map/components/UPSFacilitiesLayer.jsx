import React, { useEffect, useState } from 'react';

const UPS_FACILITIES_SOURCE_ID = 'ups-facilities-source';
const UPS_FACILITIES_LAYER_ID = 'ups-facilities-layer';

const UPSFacilitiesLayer = ({ map, visible }) => {
  const [popup, setPopup] = useState(null);

  useEffect(() => {
    if (!map?.current) return;
    
    if (!visible) {
      if (map.current.getLayer(UPS_FACILITIES_LAYER_ID)) map.current.removeLayer(UPS_FACILITIES_LAYER_ID);
      if (map.current.getSource(UPS_FACILITIES_SOURCE_ID)) map.current.removeSource(UPS_FACILITIES_SOURCE_ID);
      setPopup(null);
      return;
    }

    let cancelled = false;
    
    const addLayer = async () => {
      try {
        if (cancelled) return;
        
        // Remove existing layers/sources if they exist
        if (map.current.getLayer(UPS_FACILITIES_LAYER_ID)) map.current.removeLayer(UPS_FACILITIES_LAYER_ID);
        if (map.current.getSource(UPS_FACILITIES_SOURCE_ID)) map.current.removeSource(UPS_FACILITIES_SOURCE_ID);
        
        console.log('📦 Loading UPS Facilities data...');
        
        // Add the source from the GeoJSON file
        map.current.addSource(UPS_FACILITIES_SOURCE_ID, { 
          type: 'geojson', 
          data: '/UPS_Facilities_Large.geojson'
        });
        
        // Add the UPS facilities layer (Point features) with UPS orange markers
        map.current.addLayer({
          id: UPS_FACILITIES_LAYER_ID,
          type: 'circle',
          source: UPS_FACILITIES_SOURCE_ID,
          filter: ['==', ['geometry-type'], 'Point'],
          paint: {
            'circle-color': '#FF6600', // UPS official orange color
            'circle-radius': 3,
            'circle-opacity': 0.8,
            'circle-stroke-color': '#E55A00', // Darker orange for border
            'circle-stroke-width': 2
          },
          layout: {
            visibility: 'visible'
          }
        });
        
        console.log('✅ UPS Facilities layer added successfully');
        
      } catch (e) {
        console.error('Failed to load UPS Facilities layer', e);
      }
    };
    
    addLayer();
    
    // Click handler for popups
    const handleClick = (e) => {
      if (!map.current) return;
      
      const features = map.current.queryRenderedFeatures(e.point, { 
        layers: [UPS_FACILITIES_LAYER_ID] 
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
      
      if (map.current?.getLayer(UPS_FACILITIES_LAYER_ID)) map.current.removeLayer(UPS_FACILITIES_LAYER_ID);
      if (map.current?.getSource(UPS_FACILITIES_SOURCE_ID)) map.current.removeSource(UPS_FACILITIES_SOURCE_ID);
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
          border: '1.5px solid #FF6600',
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
            UPS Facility
          </div>
          <div style={{ 
            color: '#FF6600', 
            fontWeight: 500, 
            marginBottom: 6 
          }}>
            {popup.properties.name || 'UPS Location'}
          </div>
          {popup.properties.address && (
            <div style={{ marginBottom: 6 }}>
              {popup.properties.address}
              {popup.properties.address2 && `, ${popup.properties.address2}`}
              {popup.properties.address3 && `, ${popup.properties.address3}`}
            </div>
          )}
          {popup.properties.city && popup.properties.state && (
            <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 4 }}>
              {popup.properties.city}, {popup.properties.state} {popup.properties.zip}
            </div>
          )}
          <div style={{ color: '#bdbdbd', fontSize: 14, marginTop: 8 }}>
            UPS facility location for package pickup, drop-off, or processing
          </div>
        </div>
      )}
    </>
  );
};

export default UPSFacilitiesLayer;
