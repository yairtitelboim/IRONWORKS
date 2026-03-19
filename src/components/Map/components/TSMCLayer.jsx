import React, { useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';

const TSMCLayer = ({ map, visible }) => {
  const [buildingData, setBuildingData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Function to load TSMC building data from static GeoJSON file
  const fetchTSMCBuildings = async () => {
    try {
      console.log('🔷 TSMCLayer: Loading TSMC Phoenix buildings from static GeoJSON...');
      
      const response = await fetch('/tsmc-phoenix-buildings.geojson');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('✅ TSMCLayer: Building data loaded from static file:', data);
      
      if (data && data.type === 'FeatureCollection' && data.features) {
        console.log('✅ TSMCLayer: Valid GeoJSON building data loaded');
        return data;
      } else {
        throw new Error('Invalid GeoJSON format');
      }
      
    } catch (error) {
      console.error('❌ TSMCLayer: Error loading building file:', error);
      console.log('🔷 TSMCLayer: Using fallback building data due to file error');
      
      // Return fallback building data when file fails
      // TSMC Phoenix site: 5088 W. Innovation Circle, Phoenix, AZ 85083
      // Approximate coordinates: 33.6°N, -112.2°W
      const fallbackBuildings = {
        type: 'FeatureCollection',
        properties: {
          name: 'TSMC Arizona (Fallback)',
          facility: 'TSMC',
          location: 'Phoenix, AZ'
        },
        features: [{
          type: 'Feature',
          properties: {
            name: 'TSMC Arizona Semiconductor Fab',
            building: 'industrial',
            height: 45,
            'building:levels': '5',
            'building:material': 'concrete',
            'building:use': 'semiconductor',
            tsmc_facility: true,
            phase: 'Phase 1 & 2'
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [-112.205, 33.595],  // Southwest
              [-112.195, 33.595],  // Southeast
              [-112.195, 33.605],  // Northeast
              [-112.205, 33.605],  // Northwest
              [-112.205, 33.595]   // Close the polygon
            ]]
          }
        }]
      };
      
      console.log('✅ TSMCLayer: Using fallback building data');
      return fallbackBuildings;
    }
  };

  // Effect to handle layer visibility
  useEffect(() => {
    if (!map?.current) {
      return;
    }

    // Only run this effect when the component should be visible
    if (!visible) {
      // If not visible, clean up any existing layers
      const mapInstance = map.current;
      if (mapInstance.getLayer('tsmc-buildings-3d')) {
        mapInstance.removeLayer('tsmc-buildings-3d');
      }
      if (mapInstance.getLayer('tsmc-buildings-outline')) {
        mapInstance.removeLayer('tsmc-buildings-outline');
      }
      if (mapInstance.getSource('tsmc-buildings')) {
        mapInstance.removeSource('tsmc-buildings');
      }
      return;
    }

    const mapInstance = map.current;

    const updateLayer = async () => {
      try {
        if (visible) {
          console.log('🔷 TSMCLayer: Adding TSMC Phoenix 3D buildings...');
          
          // Fetch data if not already available
          let dataToUse = buildingData;
          if (!dataToUse) {
            console.log('🔷 TSMCLayer: Fetching building data...');
            setIsLoading(true);
            dataToUse = await fetchTSMCBuildings();
            if (dataToUse) {
              setBuildingData(dataToUse);
              console.log('✅ TSMCLayer: Building data fetched and stored');
            } else {
              console.log('❌ TSMCLayer: Failed to fetch building data');
              setIsLoading(false);
              return;
            }
            setIsLoading(false);
          }

          if (!dataToUse) {
            console.log('❌ TSMCLayer: No data available');
            return;
          }

          // Add source
          if (!mapInstance.getSource('tsmc-buildings')) {
            mapInstance.addSource('tsmc-buildings', {
              type: 'geojson',
              data: dataToUse
            });
            console.log('✅ TSMCLayer: Source added with data:', dataToUse);
          }

          // Add 3D building layer
          if (!mapInstance.getLayer('tsmc-buildings-3d')) {
            // Log building heights for debugging
            if (dataToUse.features) {
              console.log('🏗️ TSMCLayer: Building heights:', dataToUse.features.map(f => ({
                name: f.properties.name,
                height: f.properties.height,
                levels: f.properties['building:levels']
              })));
            }
            
            mapInstance.addLayer({
              id: 'tsmc-buildings-3d',
              type: 'fill-extrusion',
              source: 'tsmc-buildings',
              paint: {
                'fill-extrusion-color': '#3b82f6', // Blue color for semiconductor
                'fill-extrusion-height': [
                  'case',
                  ['has', 'height'],
                  ['get', 'height'],
                  45 // Default height if no height property
                ],
                'fill-extrusion-base': 0,
                'fill-extrusion-opacity': 0.8
              }
            });
            console.log('✅ TSMCLayer: 3D building layer added');
          }

          // Add building outline layer
          if (!mapInstance.getLayer('tsmc-buildings-outline')) {
            mapInstance.addLayer({
              id: 'tsmc-buildings-outline',
              type: 'line',
              source: 'tsmc-buildings',
              paint: {
                'line-color': '#1e40af', // Darker blue for outline
                'line-width': 2,
                'line-opacity': 1.0
              }
            });
            console.log('✅ TSMCLayer: Building outline layer added');
          }

          console.log('🔷 TSMCLayer: TSMC Phoenix 3D buildings displayed');
        } else {
          console.log('🔷 TSMCLayer: Removing TSMC Phoenix 3D buildings...');
          
          // Remove layers
          if (mapInstance.getLayer('tsmc-buildings-3d')) {
            mapInstance.removeLayer('tsmc-buildings-3d');
            console.log('✅ TSMCLayer: 3D building layer removed');
          }
          if (mapInstance.getLayer('tsmc-buildings-outline')) {
            mapInstance.removeLayer('tsmc-buildings-outline');
            console.log('✅ TSMCLayer: Building outline layer removed');
          }

          // Remove source
          if (mapInstance.getSource('tsmc-buildings')) {
            mapInstance.removeSource('tsmc-buildings');
            console.log('✅ TSMCLayer: Source removed');
          }

          console.log('🔷 TSMCLayer: TSMC Phoenix 3D buildings hidden');
        }
      } catch (error) {
        console.error('❌ TSMCLayer: Error updating layer:', error);
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
      if (mapInstance.getLayer('tsmc-buildings-3d')) {
        mapInstance.removeLayer('tsmc-buildings-3d');
      }
      if (mapInstance.getLayer('tsmc-buildings-outline')) {
        mapInstance.removeLayer('tsmc-buildings-outline');
      }
      if (mapInstance.getSource('tsmc-buildings')) {
        mapInstance.removeSource('tsmc-buildings');
      }
    };
  }, [map, visible, buildingData]);

  // Debug function to test building data
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.testTSMCBuildings = async () => {
        console.log('🧪 Testing TSMC building data...');
        const data = await fetchTSMCBuildings();
        console.log('🧪 Building data:', data);
        return data;
      };
    }
  }, []);

  // Don't render anything - this is a data layer
  return null;
};

export default TSMCLayer;

