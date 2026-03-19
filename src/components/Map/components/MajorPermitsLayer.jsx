import React, { useEffect, useState } from 'react';

const MAJOR_PERMITS_SOURCE_ID = 'major-permits-source';
const MAJOR_PERMITS_LAYER_ID = 'major-permits-layer';

const MajorPermitsLayer = ({ map, visible }) => {
  const [popup, setPopup] = useState(null);

  useEffect(() => {
    if (!map?.current) return;

    if (!visible) {
      if (map.current.getLayer(MAJOR_PERMITS_LAYER_ID)) map.current.removeLayer(MAJOR_PERMITS_LAYER_ID);
      if (map.current.getSource(MAJOR_PERMITS_SOURCE_ID)) map.current.removeSource(MAJOR_PERMITS_SOURCE_ID);
      setPopup(null);
      return;
    }

    let cancelled = false;

    const addLayer = async () => {
      try {
        if (cancelled) return;

        // Remove existing layers/sources if they exist
        if (map.current.getLayer(MAJOR_PERMITS_LAYER_ID)) map.current.removeLayer(MAJOR_PERMITS_LAYER_ID);
        if (map.current.getSource(MAJOR_PERMITS_SOURCE_ID)) map.current.removeSource(MAJOR_PERMITS_SOURCE_ID);

        console.log('🏗️ Loading Major Permits data...');

        // Add the source from the GeoJSON file
        map.current.addSource(MAJOR_PERMITS_SOURCE_ID, {
          type: 'geojson',
          data: '/permits/major_permits.geojson'
        });

        // Add the major permits layer with markers
        map.current.addLayer({
          id: MAJOR_PERMITS_LAYER_ID,
          type: 'circle',
          source: MAJOR_PERMITS_SOURCE_ID,
          filter: ['==', ['geometry-type'], 'Point'],
          paint: {
            'circle-color': '#DC2626', // Red color for major permits
            'circle-radius': 5,
            'circle-opacity': 0.8,
            'circle-stroke-color': '#B91C1C',
            'circle-stroke-width': 1
          },
          layout: {
            visibility: 'visible'
          }
        });

        console.log('✅ Major Permits layer added successfully');

      } catch (e) {
        console.error('Failed to load Major Permits layer', e);
      }
    };

    addLayer();

    // Click handler for popups
    const handleClick = (e) => {
      if (!map.current) return;

      const features = map.current.queryRenderedFeatures(e.point, {
        layers: [MAJOR_PERMITS_LAYER_ID]
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

      if (map.current?.getLayer(MAJOR_PERMITS_LAYER_ID)) map.current.removeLayer(MAJOR_PERMITS_LAYER_ID);
      if (map.current?.getSource(MAJOR_PERMITS_SOURCE_ID)) map.current.removeSource(MAJOR_PERMITS_SOURCE_ID);
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
          border: '1.5px solid #DC2626',
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
            Major Permit ($1M+)
          </div>
          <div style={{
            color: '#DC2626',
            fontWeight: 500,
            marginBottom: 6
          }}>
            {popup.properties.PERMIT_NUM || 'Permit Number'}
          </div>
          {popup.properties.ADDRESS && (
            <div style={{ marginBottom: 6 }}>
              {popup.properties.ADDRESS}
            </div>
          )}
          {popup.properties.CLASS && (
            <div style={{ marginBottom: 6 }}>
              Type: {popup.properties.CLASS}
            </div>
          )}
          {popup.properties.VALUATION && (
            <div style={{ marginBottom: 6 }}>
              Value: ${popup.properties.VALUATION.toLocaleString()}
            </div>
          )}
          {popup.properties.PERMIT_FEE && (
            <div style={{ marginBottom: 6 }}>
              Fee: ${popup.properties.PERMIT_FEE.toLocaleString()}
            </div>
          )}
          {popup.properties.CONTRACTOR_NAME && (
            <div style={{ marginBottom: 6 }}>
              Contractor: {popup.properties.CONTRACTOR_NAME}
            </div>
          )}
          {popup.properties.DATE_ISSUED && (
            <div style={{ marginBottom: 6 }}>
              Issued: {new Date(popup.properties.DATE_ISSUED).toLocaleDateString()}
            </div>
          )}
          {popup.properties.NEIGHBORHOOD && (
            <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 4 }}>
              {popup.properties.NEIGHBORHOOD}
            </div>
          )}
          <div style={{ color: '#bdbdbd', fontSize: 14, marginTop: 8 }}>
            Major commercial construction permit (>$1M valuation)
          </div>
        </div>
      )}
    </>
  );
};

export default MajorPermitsLayer;
