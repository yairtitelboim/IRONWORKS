import { useEffect, useRef, useCallback } from 'react';


// I-10 Highway waypoints between Ozona and Fort Stockton (approximate route)
const I10_WAYPOINTS = [
  [-101.205972, 30.707417], // Ozona, TX
  [-101.3, 30.72],          // West of Ozona
  [-101.5, 30.74],          // Continuing west
  [-101.8, 30.77],          // Midpoint
  [-102.1, 30.80],          // Approaching Sheffield
  [-102.4, 30.83],          // Sheffield area
  [-102.6, 30.86],          // East of Fort Stockton
  [-102.87932, 30.89404]    // Fort Stockton, TX
];

const OzonaFortStocktonParticles = ({ map, isVisible, showSectionA }) => {
  const isInitializedRef = useRef(false);
  const routeDataRef = useRef(null);

  // Create I-10 highway route using predefined waypoints
  const createI10Route = () => {
    console.log('🛣️ Creating I-10 highway route using waypoints...');
    console.log('Route: Ozona, TX to Fort Stockton, TX via I-10');
    console.log('📍 Using predefined I-10 waypoints:', I10_WAYPOINTS.length, 'points');
    
    const routeGeometry = {
      type: 'LineString',
      coordinates: I10_WAYPOINTS
    };
    
    console.log('✅ I-10 route created successfully:', {
      distance: '~58 miles (approximate)',
      waypoints: I10_WAYPOINTS.length,
      coordinates: routeGeometry.coordinates.length
    });
    
    routeDataRef.current = routeGeometry;
    return routeGeometry;
  };

  // Initialize the I-10 highway layer
  const initializeHighwayLayer = useCallback((mapInstance) => {
    try {
      if (!mapInstance || isInitializedRef.current) return;

      console.log('🚀 Initializing I-10 Highway Layer', { 
        isVisible, 
        showSectionA,
        mapLoaded: mapInstance.isStyleLoaded() 
      });

      // Create route data if not already cached
      if (!routeDataRef.current) {
        createI10Route();
      }

      // Add source for I-10 highway route
      if (!mapInstance.getSource('i10-highway-route')) {
        mapInstance.addSource('i10-highway-route', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });
      }

      // Add outline layer for better visibility
      if (!mapInstance.getLayer('i10-highway-outline')) {
        mapInstance.addLayer({
          'id': 'i10-highway-outline',
          'type': 'line',
          'source': 'i10-highway-route',
          'layout': {
            'line-join': 'round',
            'line-cap': 'round'
          },
          'paint': {
            'line-color': '#000000', // Black outline
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              1, 12,   // Very thick outline when extremely zoomed out
              3, 10,   // Thick outline
              5, 8,    // Medium outline
              8, 6,    // Normal outline
              12, 4,   // Smaller outline
              16, 3    // Thin outline when zoomed in
            ],
            'line-opacity': 0.8
          },
          'minzoom': 1
        });
      }

      // Add main I-10 highway layer
      if (!mapInstance.getLayer('i10-highway-main')) {
        mapInstance.addLayer({
          'id': 'i10-highway-main',
          'type': 'line',
          'source': 'i10-highway-route',
          'layout': {
            'line-join': 'round',
            'line-cap': 'round'
          },
          'paint': {
            'line-color': ['get', 'color'], // Will be set dynamically
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              1, 8,    // Very thick when extremely zoomed out  
              3, 7,    // Thick when very zoomed out
              5, 6,    // Medium-thick when zoomed out
              8, 5,    // Medium at city level
              12, 3,   // Normal at street level
              16, 2    // Thin when zoomed in close
            ],
            'line-opacity': 1.0 // Always fully visible
          },
          'minzoom': 1  // Visible at all zoom levels
        });
      }

      isInitializedRef.current = true;
      console.log('✅ I-10 Highway layer initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing I-10 Highway layer:', error);
    }
  }, []); // No dependencies needed - this just initializes the layer structure

  // Update the route display based on current state
  const updateRouteDisplay = useCallback((mapInstance) => {
    try {
      if (!mapInstance || !routeDataRef.current) return;

      const color = showSectionA ? '#FF0000' : '#00FFFF'; // Bright red for Section_A, cyan for normal
      const routeFeature = {
        type: 'Feature',
        properties: {
          color: color,
          isSectionA: showSectionA,
          routeType: showSectionA ? 'Section_A' : 'Normal'
        },
        geometry: routeDataRef.current
      };

      console.log('🛣️ Updating I-10 route display:', {
        mode: showSectionA ? 'Section_A (RED)' : 'Normal (CYAN)',
        coordinates: routeDataRef.current.coordinates.length,
        color: color
      });

      const source = mapInstance.getSource('i10-highway-route');
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: [routeFeature]
        });
      }
    } catch (error) {
      console.error('❌ Error updating route display:', error);
    }
  }, [showSectionA]);

  // Show/hide the I-10 highway route
  const displayHighwayRoute = useCallback((mapInstance) => {
    try {
      if (!mapInstance || !isVisible) return;

      // Initialize the layer if needed
      initializeHighwayLayer(mapInstance);
      
      // Update the route display
      updateRouteDisplay(mapInstance);
      
      console.log('✅ I-10 highway route displayed');
    } catch (error) {
      console.error('❌ Error displaying highway route:', error);
    }
  }, [isVisible, updateRouteDisplay, initializeHighwayLayer]);

  // Hide the I-10 highway route
  const hideHighwayRoute = (mapInstance) => {
    try {
      if (mapInstance && mapInstance.getSource('i10-highway-route')) {
        mapInstance.getSource('i10-highway-route').setData({
          type: 'FeatureCollection',
          features: []
        });
        console.log('🚫 I-10 highway route hidden');
      }
    } catch (error) {
      console.error('❌ Error hiding highway route:', error);
    }
  };

  // Cleanup function
  const cleanup = (mapInstance) => {
    if (!mapInstance) return;
    
    try {
      // Remove layers
      if (mapInstance.getLayer('i10-highway-main')) {
        mapInstance.removeLayer('i10-highway-main');
      }
      if (mapInstance.getLayer('i10-highway-outline')) {
        mapInstance.removeLayer('i10-highway-outline');
      }
      
      // Remove source
      if (mapInstance.getSource('i10-highway-route')) {
        mapInstance.removeSource('i10-highway-route');
      }
      
      isInitializedRef.current = false;
      routeDataRef.current = null;
      console.log('🧹 I-10 highway layer cleanup complete');
    } catch (error) {
      console.warn('❌ Error during cleanup:', error);
    }
  };

  // Main effect to handle visibility changes
  useEffect(() => {
    console.log('🔄 Effect triggered - I-10 Highway Mode changed:', { 
      isVisible, 
      showSectionA: showSectionA ? '🔴 Section_A (RED)' : '🔵 Normal Mode (CYAN)', 
      mapExists: !!map?.current 
    });
    
    if (!map?.current) return;

    // Copy map.current to variable to avoid ref issues in cleanup
    const mapInstance = map.current;

    if (isVisible) {
      // Wait for map style to load before displaying highway
      if (mapInstance.isStyleLoaded()) {
        displayHighwayRoute(mapInstance);
      } else {
        const onStyleLoad = () => {
          displayHighwayRoute(mapInstance);
          mapInstance.off('styledata', onStyleLoad);
        };
        mapInstance.on('styledata', onStyleLoad);
      }
    } else {
      hideHighwayRoute(mapInstance);
    }

    // Update route display when showSectionA changes
    if (isVisible && routeDataRef.current) {
      updateRouteDisplay(mapInstance);
    }

    // Cleanup on unmount
    return () => {
      if (!isVisible) {
        cleanup(mapInstance);
      }
    };
  }, [map, isVisible, showSectionA, displayHighwayRoute, updateRouteDisplay]);

  // Cleanup on component unmount
  useEffect(() => {
    const mapInstance = map?.current;
    return () => {
      if (mapInstance) {
        cleanup(mapInstance);
      }
    };
  }, [map]);

  return null; // This component doesn't render anything visible
};

export default OzonaFortStocktonParticles;