import React, { useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';

const LucidLayer = ({ map, visible }) => {
  const [buildingData, setBuildingData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Function to load Lucid 3D building data from static GeoJSON file
  const fetchLucidBuildings = async () => {
    try {
      console.log('🚗 LucidLayer: Loading Lucid 3D buildings from static GeoJSON...');
      
      const response = await fetch('/lucid-3d-buildings.geojson');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ LucidLayer: Building data loaded from static file:', data);
      
      if (data && data.type === 'FeatureCollection' && data.features) {
        console.log('✅ LucidLayer: Valid GeoJSON building data loaded');
        return data;
      } else {
        throw new Error('Invalid GeoJSON format');
      }
      
    } catch (error) {
      console.error('❌ LucidLayer: Error loading building file:', error);
      console.log('🚗 LucidLayer: Using fallback building data due to file error');
      
      // Return fallback building data when file fails
      const fallbackBuildings = {
        type: 'FeatureCollection',
        properties: {
          name: 'Lucid Motors (Fallback)',
          facility: 'Lucid Motors',
          location: 'Casa Grande, AZ'
        },
        features: [{
          type: 'Feature',
          properties: {
            name: 'Lucid Motors EV Manufacturing Campus',
            building: 'industrial',
            height: 30,
            'building:levels': '4',
            'building:material': 'concrete',
            'building:use': 'industrial',
            lucid_facility: true
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [-111.785, 32.856],  // Southwest
              [-111.780, 32.856],  // Southeast
              [-111.780, 32.860],  // Northeast
              [-111.785, 32.860],  // Northwest
              [-111.785, 32.856]   // Close the polygon
            ]]
          }
        }]
      };
      
      console.log('✅ LucidLayer: Using fallback building data due to file error');
      return fallbackBuildings;
    }
  };

  // Effect to handle layer visibility
  useEffect(() => {
    if (!map?.current) {
      return;
    }

    // Only run this effect when the component should be visible
    // This prevents unnecessary processing when other components change state
    if (!visible) {
      // If not visible, clean up any existing layers
      const mapInstance = map.current;
      if (mapInstance.getLayer('lucid-buildings-3d')) {
        mapInstance.removeLayer('lucid-buildings-3d');
      }
      if (mapInstance.getLayer('lucid-buildings-outline')) {
        mapInstance.removeLayer('lucid-buildings-outline');
      }
      if (mapInstance.getSource('lucid-buildings')) {
        mapInstance.removeSource('lucid-buildings');
      }
      return;
    }

    const mapInstance = map.current;

    const updateLayer = async () => {
      try {
        if (visible) {
          console.log('🚗 LucidLayer: Adding Lucid 3D buildings...');
          
          // Fetch data if not already available
          let dataToUse = buildingData;
          if (!dataToUse) {
            console.log('🚗 LucidLayer: Fetching building data...');
            setIsLoading(true);
            dataToUse = await fetchLucidBuildings();
            if (dataToUse) {
              setBuildingData(dataToUse);
              console.log('✅ LucidLayer: Building data fetched and stored');
            } else {
              console.log('❌ LucidLayer: Failed to fetch building data');
              setIsLoading(false);
              return;
            }
            setIsLoading(false);
          }

          if (!dataToUse) {
            console.log('❌ LucidLayer: No data available');
            return;
          }

          // Add source
          if (!mapInstance.getSource('lucid-buildings')) {
            mapInstance.addSource('lucid-buildings', {
              type: 'geojson',
              data: dataToUse
            });
            console.log('✅ LucidLayer: Source added with data:', dataToUse);
          }

          // Add 3D building layer
          if (!mapInstance.getLayer('lucid-buildings-3d')) {
            // Log building heights for debugging
            if (dataToUse.features) {
              console.log('🏗️ LucidLayer: Building heights:', dataToUse.features.map(f => ({
                name: f.properties.name,
                height: f.properties.height,
                levels: f.properties['building:levels']
              })));
            }
            
            mapInstance.addLayer({
              id: 'lucid-buildings-3d',
              type: 'fill-extrusion',
              source: 'lucid-buildings',
              paint: {
                'fill-extrusion-color': '#3b82f6', // Blue color for Lucid
                'fill-extrusion-height': [
                  'case',
                  ['has', 'height'],
                  ['get', 'height'],
                  30 // Default height if no height property
                ],
                'fill-extrusion-base': 0,
                'fill-extrusion-opacity': 0.8
              }
            });
            console.log('✅ LucidLayer: 3D building layer added');
          }

          // Add building outline layer
          if (!mapInstance.getLayer('lucid-buildings-outline')) {
            mapInstance.addLayer({
              id: 'lucid-buildings-outline',
              type: 'line',
              source: 'lucid-buildings',
              paint: {
                'line-color': '#1e40af', // Darker blue for outline
                'line-width': 2,
                'line-opacity': 1.0
              }
            });
            console.log('✅ LucidLayer: Building outline layer added');
          }

          // Auto zoom removed - map stays at current position
          console.log('✅ LucidLayer: Lucid buildings added without auto zoom');

          console.log('🚗 LucidLayer: Lucid 3D buildings displayed');
        } else {
          console.log('🚗 LucidLayer: Removing Lucid 3D buildings...');
          
          // Remove layers
          if (mapInstance.getLayer('lucid-buildings-3d')) {
            mapInstance.removeLayer('lucid-buildings-3d');
            console.log('✅ LucidLayer: 3D building layer removed');
          }
          if (mapInstance.getLayer('lucid-buildings-outline')) {
            mapInstance.removeLayer('lucid-buildings-outline');
            console.log('✅ LucidLayer: Building outline layer removed');
          }

          // Remove source
          if (mapInstance.getSource('lucid-buildings')) {
            mapInstance.removeSource('lucid-buildings');
            console.log('✅ LucidLayer: Source removed');
          }

          console.log('🚗 LucidLayer: Lucid 3D buildings hidden');
        }
      } catch (error) {
        console.error('❌ LucidLayer: Error updating layer:', error);
      }
    };

    // Check if map is ready
    if (mapInstance.isStyleLoaded()) {
      updateLayer();
    } else {
      mapInstance.once('styledata', updateLayer);
    }

    return () => {
      // Cleanup on unmount
      if (mapInstance.getLayer('lucid-buildings-3d')) {
        mapInstance.removeLayer('lucid-buildings-3d');
      }
      if (mapInstance.getLayer('lucid-buildings-outline')) {
        mapInstance.removeLayer('lucid-buildings-outline');
      }
      if (mapInstance.getSource('lucid-buildings')) {
        mapInstance.removeSource('lucid-buildings');
      }
    };
  }, [map, visible, buildingData, fetchLucidBuildings]);

  // Debug function to test building data
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.testLucidBuildings = async () => {
        console.log('🧪 Testing Lucid building data...');
        const data = await fetchLucidBuildings();
        console.log('🧪 Building data:', data);
        return data;
      };
    }
  }, []);

  // Don't render anything - this is a data layer
  return null;
};

export default LucidLayer;
