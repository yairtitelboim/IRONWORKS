import React, { useEffect, useState, useRef } from 'react';

const DENVER_NEIGHBORHOODS_SOURCE_ID = 'denver-neighborhoods-source';
const DENVER_NEIGHBORHOODS_LAYER_ID = 'denver-neighborhoods-layer';
const DENVER_NEIGHBORHOODS_HOVER_LAYER_ID = 'denver-neighborhoods-hover-layer';
const DENVER_NEIGHBORHOODS_SELECTED_LAYER_ID = 'denver-neighborhoods-selected-layer';
const DENVER_NEIGHBORHOOD_BUILDINGS_SOURCE_ID = 'denver-neighborhood-buildings-source';
const DENVER_NEIGHBORHOOD_BUILDINGS_LAYER_ID = 'denver-neighborhood-buildings-layer';

const DenverNeighborhoodsLayer = ({ map, visible }) => {
  const [popup, setPopup] = useState(null);
  const [hoveredFeatureId, setHoveredFeatureId] = useState(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState(null);
  const [neighborhoodBuildings, setNeighborhoodBuildings] = useState(null);
  const [buildingsLoading, setBuildingsLoading] = useState(false);
  const hoveredFeatureIdRef = useRef(null);
  const neighborhoodIndexRef = useRef(null);

  // Load neighborhood index on component mount
  useEffect(() => {
    const loadNeighborhoodIndex = async () => {
      try {
        const response = await fetch('/neighborhood_buildings/neighborhood_index.json');
        if (response.ok) {
          const index = await response.json();
          neighborhoodIndexRef.current = index;
          console.log('📋 Neighborhood building index loaded:', Object.keys(index).length, 'neighborhoods');
        }
      } catch (error) {
        console.error('Failed to load neighborhood index:', error);
      }
    };
    
    loadNeighborhoodIndex();
  }, []);

  // Load buildings for a specific neighborhood
  const loadNeighborhoodBuildings = async (neighborhoodId) => {
    if (!neighborhoodIndexRef.current || !map?.current) return;
    
    const neighborhoodInfo = neighborhoodIndexRef.current[neighborhoodId];
    if (!neighborhoodInfo) {
      console.warn('No building data found for neighborhood:', neighborhoodId);
      return;
    }
    
    setBuildingsLoading(true);
    
    try {
      console.log(`🏗️ Loading buildings for ${neighborhoodInfo.name} (${neighborhoodInfo.building_count} buildings)...`);
      
      const response = await fetch(neighborhoodInfo.file_path);
      if (!response.ok) throw new Error('Failed to fetch neighborhood buildings');
      
      const buildingsData = await response.json();
      setNeighborhoodBuildings(buildingsData);
      
      // Remove existing buildings layer if it exists
      if (map.current.getLayer(DENVER_NEIGHBORHOOD_BUILDINGS_LAYER_ID)) {
        map.current.removeLayer(DENVER_NEIGHBORHOOD_BUILDINGS_LAYER_ID);
      }
      if (map.current.getSource(DENVER_NEIGHBORHOOD_BUILDINGS_SOURCE_ID)) {
        map.current.removeSource(DENVER_NEIGHBORHOOD_BUILDINGS_SOURCE_ID);
      }
      
      // Add new buildings source and layer
      map.current.addSource(DENVER_NEIGHBORHOOD_BUILDINGS_SOURCE_ID, {
        type: 'geojson',
        data: buildingsData
      });
      
      map.current.addLayer({
        id: DENVER_NEIGHBORHOOD_BUILDINGS_LAYER_ID,
        type: 'fill-extrusion',
        source: DENVER_NEIGHBORHOOD_BUILDINGS_SOURCE_ID,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'fill-extrusion-color': '#22c55e', // Green color to match neighborhood theme
          'fill-extrusion-opacity': 0.8,
          'fill-extrusion-height': [
            'case',
            ['has', 'height_m'],
            ['get', 'height_m'],
            ['has', 'levels'],
            ['*', ['get', 'levels'], 3],
            5
          ],
          'fill-extrusion-base': 0,
          'fill-extrusion-translate': [0, 0],
          'fill-extrusion-translate-anchor': 'map'
        },
        layout: {
          visibility: 'visible'
        }
      });
      
      console.log(`✅ Loaded ${neighborhoodInfo.building_count} buildings for ${neighborhoodInfo.name}`);
      
    } catch (error) {
      console.error('Failed to load neighborhood buildings:', error);
    } finally {
      setBuildingsLoading(false);
    }
  };

  // Clear neighborhood buildings
  const clearNeighborhoodBuildings = () => {
    if (!map?.current) return;
    
    if (map.current.getLayer(DENVER_NEIGHBORHOOD_BUILDINGS_LAYER_ID)) {
      map.current.removeLayer(DENVER_NEIGHBORHOOD_BUILDINGS_LAYER_ID);
    }
    if (map.current.getSource(DENVER_NEIGHBORHOOD_BUILDINGS_SOURCE_ID)) {
      map.current.removeSource(DENVER_NEIGHBORHOOD_BUILDINGS_SOURCE_ID);
    }
    
    setNeighborhoodBuildings(null);
  };

  useEffect(() => {
    if (!map?.current) return;
    
    if (!visible) {
      clearNeighborhoodBuildings();
      if (map.current.getLayer(DENVER_NEIGHBORHOODS_SELECTED_LAYER_ID)) map.current.removeLayer(DENVER_NEIGHBORHOODS_SELECTED_LAYER_ID);
      if (map.current.getLayer(DENVER_NEIGHBORHOODS_HOVER_LAYER_ID)) map.current.removeLayer(DENVER_NEIGHBORHOODS_HOVER_LAYER_ID);
      if (map.current.getLayer(DENVER_NEIGHBORHOODS_LAYER_ID)) map.current.removeLayer(DENVER_NEIGHBORHOODS_LAYER_ID);
      if (map.current.getSource(DENVER_NEIGHBORHOODS_SOURCE_ID)) map.current.removeSource(DENVER_NEIGHBORHOODS_SOURCE_ID);
      setPopup(null);
      setHoveredFeatureId(null);
      setSelectedFeatureId(null);
      setBuildingsLoading(false);
      return;
    }

    let cancelled = false;
    
    const addLayer = async () => {
      try {
        if (cancelled) return;
        
        // Remove existing layers/sources if they exist
        if (map.current.getLayer(DENVER_NEIGHBORHOODS_SELECTED_LAYER_ID)) map.current.removeLayer(DENVER_NEIGHBORHOODS_SELECTED_LAYER_ID);
        if (map.current.getLayer(DENVER_NEIGHBORHOODS_HOVER_LAYER_ID)) map.current.removeLayer(DENVER_NEIGHBORHOODS_HOVER_LAYER_ID);
        if (map.current.getLayer(DENVER_NEIGHBORHOODS_LAYER_ID)) map.current.removeLayer(DENVER_NEIGHBORHOODS_LAYER_ID);
        if (map.current.getSource(DENVER_NEIGHBORHOODS_SOURCE_ID)) map.current.removeSource(DENVER_NEIGHBORHOODS_SOURCE_ID);
        
        // Add the source from the GeoJSON file
        map.current.addSource(DENVER_NEIGHBORHOODS_SOURCE_ID, { 
          type: 'geojson', 
          data: '/ODC_ADMN_NEIGHBORHOOD_A_-5910795496315123332.geojson'
        });
        
        // Add invisible base layer for hit testing - using fill with very low opacity
        map.current.addLayer({
          id: DENVER_NEIGHBORHOODS_LAYER_ID,
          type: 'fill',
          source: DENVER_NEIGHBORHOODS_SOURCE_ID,
          paint: {
            'fill-color': '#000000',
            'fill-opacity': 0.01 // Very low but not zero opacity for mouse events
          },
          layout: {
            visibility: 'visible'
          }
        });
        
        // Add selected fill layer (shows 20% fill for clicked neighborhood)
        map.current.addLayer({
          id: DENVER_NEIGHBORHOODS_SELECTED_LAYER_ID,
          type: 'fill',
          source: DENVER_NEIGHBORHOODS_SOURCE_ID,
          paint: {
            'fill-color': '#22c55e', // Green color
            'fill-opacity': 0.2 // 20% opacity
          },
          filter: ['==', ['get', 'NBHD_ID'], ''], // Initially shows nothing
          layout: {
            visibility: 'visible'
          }
        });
        
        // Add hover highlight layer (only shows when hovered)
        map.current.addLayer({
          id: DENVER_NEIGHBORHOODS_HOVER_LAYER_ID,
          type: 'line',
          source: DENVER_NEIGHBORHOODS_SOURCE_ID,
          paint: {
            'line-color': '#22c55e', // Green color
            'line-width': 3,
            'line-opacity': 1
          },
          filter: ['==', ['get', 'NBHD_ID'], ''], // Initially shows nothing
          layout: {
            visibility: 'visible'
          }
        });
        
      } catch (e) {
        console.error('Failed to load Denver neighborhoods layer', e);
      }
    };
    
    addLayer();
    
    // Mouse move handler for real-time hover tracking
    const handleMouseMove = (e) => {
      if (!map.current) return;
      
      const features = map.current.queryRenderedFeatures(e.point, { 
        layers: [DENVER_NEIGHBORHOODS_LAYER_ID] 
      });
      
      if (features && features.length > 0) {
        const feature = features[0];
        const neighborhoodId = feature.properties.NBHD_ID;
        
        // Only update if it's a different neighborhood
        if (neighborhoodId !== hoveredFeatureIdRef.current) {
          hoveredFeatureIdRef.current = neighborhoodId;
          setHoveredFeatureId(neighborhoodId);
          
          // Update the hover layer filter to show only this neighborhood
          map.current.setFilter(DENVER_NEIGHBORHOODS_HOVER_LAYER_ID, [
            '==', ['get', 'NBHD_ID'], neighborhoodId
          ]);
        }
        
        // Always set cursor to pointer when over any neighborhood
        map.current.getCanvas().style.cursor = 'pointer';
      } else {
        // Mouse is not over any neighborhood
        if (hoveredFeatureIdRef.current !== null) {
          hoveredFeatureIdRef.current = null;
          setHoveredFeatureId(null);
          
          // Hide the hover layer
          map.current.setFilter(DENVER_NEIGHBORHOODS_HOVER_LAYER_ID, [
            '==', ['get', 'NBHD_ID'], ''
          ]);
          
          // Reset cursor
          map.current.getCanvas().style.cursor = '';
        }
      }
    };
    
    // Click handler for selection and popups
    const handleClick = (e) => {
      if (!map.current) return;
      
      const features = map.current.queryRenderedFeatures(e.point, { 
        layers: [DENVER_NEIGHBORHOODS_LAYER_ID] 
      });
      
      if (features && features.length > 0) {
        const f = features[0];
        const neighborhoodId = f.properties.NBHD_ID;
        const coordinates = f.geometry.coordinates[0][0]; // Get first coordinate of the polygon
        
        // Toggle selection - if clicking same neighborhood, deselect it
        if (selectedFeatureId === neighborhoodId) {
          setSelectedFeatureId(null);
          map.current.setFilter(DENVER_NEIGHBORHOODS_SELECTED_LAYER_ID, [
            '==', ['get', 'NBHD_ID'], ''
          ]);
          setPopup(null);
          clearNeighborhoodBuildings();
        } else {
          // Select new neighborhood
          setSelectedFeatureId(neighborhoodId);
          map.current.setFilter(DENVER_NEIGHBORHOODS_SELECTED_LAYER_ID, [
            '==', ['get', 'NBHD_ID'], neighborhoodId
          ]);
          
          setPopup({
            lng: coordinates[0],
            lat: coordinates[1],
            properties: f.properties
          });
          
          // Load buildings for this neighborhood
          loadNeighborhoodBuildings(neighborhoodId);
        }
      } else {
        // Clicked on empty area - deselect all
        setSelectedFeatureId(null);
        map.current.setFilter(DENVER_NEIGHBORHOODS_SELECTED_LAYER_ID, [
          '==', ['get', 'NBHD_ID'], ''
        ]);
        setPopup(null);
        clearNeighborhoodBuildings();
      }
    };
    
    // Add event listeners
    map.current.on('mousemove', handleMouseMove);
    map.current.on('click', DENVER_NEIGHBORHOODS_LAYER_ID, handleClick);
    
    return () => {
      cancelled = true;
      
      // Remove event listeners
      map.current?.off('mousemove', handleMouseMove);
      map.current?.off('click', DENVER_NEIGHBORHOODS_LAYER_ID, handleClick);
      
      // Remove layers and sources
      clearNeighborhoodBuildings();
      if (map.current?.getLayer(DENVER_NEIGHBORHOODS_HOVER_LAYER_ID)) map.current.removeLayer(DENVER_NEIGHBORHOODS_HOVER_LAYER_ID);
      if (map.current?.getLayer(DENVER_NEIGHBORHOODS_SELECTED_LAYER_ID)) map.current.removeLayer(DENVER_NEIGHBORHOODS_SELECTED_LAYER_ID);
      if (map.current?.getLayer(DENVER_NEIGHBORHOODS_LAYER_ID)) map.current.removeLayer(DENVER_NEIGHBORHOODS_LAYER_ID);
      if (map.current?.getSource(DENVER_NEIGHBORHOODS_SOURCE_ID)) map.current.removeSource(DENVER_NEIGHBORHOODS_SOURCE_ID);
      
      // Reset cursor and state
      if (map.current?.getCanvas) map.current.getCanvas().style.cursor = '';
      setPopup(null);
      setHoveredFeatureId(null);
      setSelectedFeatureId(null);
      setBuildingsLoading(false);
      hoveredFeatureIdRef.current = null;
    };
  }, [map, visible]);

  return (
    <>
      {buildingsLoading && (
        <div style={{
          position: 'absolute',
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'rgba(34, 197, 94, 0.9)',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: '500',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          🏗️ Loading neighborhood buildings...
        </div>
      )}
      
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
          border: '1.5px solid #333',
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
            {popup.properties.NBHD_NAME}
          </div>
          <div style={{ 
            color: '#22c55e', 
            fontWeight: 500, 
            marginBottom: 6 
          }}>
            Neighborhood
          </div>
          <div style={{ marginBottom: 6 }}>
            ID: {popup.properties.NBHD_ID}
          </div>
          {popup.properties.TYPOLOGY && (
            <div style={{ marginBottom: 6 }}>
              Typology: {popup.properties.TYPOLOGY}
            </div>
          )}
          {popup.properties.NOTES && (
            <div style={{ color: '#bdbdbd', fontSize: 14, marginTop: 8 }}>
              {popup.properties.NOTES}
            </div>
          )}
          {neighborhoodBuildings && (
            <div style={{ 
              marginTop: 12, 
              paddingTop: 12, 
              borderTop: '1px solid #333',
              color: '#22c55e',
              fontSize: 13
            }}>
              🏗️ {neighborhoodBuildings.features.length.toLocaleString()} buildings loaded
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default DenverNeighborhoodsLayer;
