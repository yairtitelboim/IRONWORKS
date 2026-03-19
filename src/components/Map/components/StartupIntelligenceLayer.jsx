import { useEffect, useRef } from 'react';

// Constants for radius particles
const RADIUS_PARTICLES_SOURCE_ID = 'startup-intelligence-radius-particles';
const RADIUS_PARTICLES_LAYER_ID = 'startup-intelligence-radius-particles-layer';

// Create animated particles for radius circles
const createRadiusParticles = (markers) => {
  const particleCount = 8; // 8 particles per marker for smooth circle
  const radiusMeters = 100; // 100m radius
  const features = [];
  
  // Add null check for markers
  if (!markers || !Array.isArray(markers)) {
    console.warn('StartupIntelligenceLayer: No markers data available for radius particles');
    return { type: 'FeatureCollection', features: [] };
  }
  
  markers.forEach(marker => {
    const [lng, lat] = marker.geometry.coordinates;
    
    // Create particles around the circle
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * 2 * Math.PI;
      const now = Date.now();
      const timeOffset = (now * 0.001) % (2 * Math.PI); // Rotating animation
      const animatedAngle = angle + timeOffset;
      
      // Calculate position on circle (100m radius)
      const earthRadius = 6371000; // Earth radius in meters
      const latOffset = (radiusMeters / earthRadius) * (180 / Math.PI);
      const lngOffset = (radiusMeters / earthRadius) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180);
      
      const particleLng = lng + lngOffset * Math.cos(animatedAngle);
      const particleLat = lat + latOffset * Math.sin(animatedAngle);
      
      features.push({
        type: 'Feature',
        properties: {
          markerId: marker.properties.id,
          particleIndex: i
        },
        geometry: {
          type: 'Point',
          coordinates: [particleLng, particleLat]
        }
      });
    }
  });
  
  return { type: 'FeatureCollection', features };
};

// Function to add radius particles layer (called after data is loaded)
const addRadiusParticlesLayer = (mapInstance) => {
  try {
    // Get data from the startup intelligence source
    const source = mapInstance.getSource('startup-intelligence');
    const sourceData = source?._data || { features: [] };
    const features = sourceData.features || [];
    
    // Add GeoJSON data source for radius particles
    mapInstance.addSource(RADIUS_PARTICLES_SOURCE_ID, {
      type: 'geojson',
      data: createRadiusParticles(features)
    });
    
    // Add circle layer to render particles as animated dashed circles
    mapInstance.addLayer({
      id: RADIUS_PARTICLES_LAYER_ID,
      type: 'circle',
      source: RADIUS_PARTICLES_SOURCE_ID,
      paint: {
        'circle-radius': 1.5, // Even smaller particles
        'circle-color': '#FFD700', // Yellow
        'circle-opacity': 0.8,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#FFD700',
        'circle-stroke-opacity': 0.6
      }
    });
    
    console.log('✅ Radius particles layer added successfully');
    
    // Start animation loop for rotating particles
    let radiusAnimationFrame = null;
    const animateRadiusParticles = () => {
      const source = mapInstance.getSource(RADIUS_PARTICLES_SOURCE_ID);
      const startupSource = mapInstance.getSource('startup-intelligence');
      const sourceData = startupSource?._data || { features: [] };
      
      if (source && sourceData.features) {
        source.setData(createRadiusParticles(sourceData.features));
      }
      radiusAnimationFrame = requestAnimationFrame(animateRadiusParticles);
    };
    
    // Store animation frame for cleanup
    window.startupIntelligenceRadiusAnimationFrame = radiusAnimationFrame;
    animateRadiusParticles();
    
  } catch (error) {
    console.error('❌ Error adding radius particles layer:', error);
  }
};

const StartupIntelligenceLayer = ({ map, visible }) => {
  const layerAddedRef = useRef(false);
  const sourceDataListenerRef = useRef(null);

  useEffect(() => {
    if (!map?.current) return;
    
    // If not visible, clean up and return
    if (!visible) {
      if (layerAddedRef.current) {
        const mapInstance = map.current;
        console.log('🗺️ Startup Intelligence Layer: Toggling OFF');
        try {
          // Clean up event listeners
          if (sourceDataListenerRef.current) {
            mapInstance.off('sourcedata', sourceDataListenerRef.current);
            sourceDataListenerRef.current = null;
          }
          
          // Clean up table row click listener
          if (window.mapEventBus) {
            window.mapEventBus.off('startup:markerClick');
            console.log('🎧 StartupIntelligenceLayer: Removed startup:markerClick listener');
          }
          
          // Stop radius animation
          if (window.startupIntelligenceRadiusAnimationFrame) {
            cancelAnimationFrame(window.startupIntelligenceRadiusAnimationFrame);
            window.startupIntelligenceRadiusAnimationFrame = null;
          }
          
          if (mapInstance.getLayer('startup-intelligence-markers')) {
            mapInstance.removeLayer('startup-intelligence-markers');
          }
          if (mapInstance.getLayer('startup-intelligence-radius-particles-layer')) {
            mapInstance.removeLayer('startup-intelligence-radius-particles-layer');
          }
          if (mapInstance.getSource('startup-intelligence')) {
            mapInstance.removeSource('startup-intelligence');
          }
          if (mapInstance.getSource('startup-intelligence-radius-particles')) {
            mapInstance.removeSource('startup-intelligence-radius-particles');
          }
          layerAddedRef.current = false;
        } catch (error) {
          console.warn('Error removing startup intelligence layer:', error);
        }
      }
      return;
    }

    console.log('🗺️ Startup Intelligence Layer: Toggling ON');
    const mapInstance = map.current;
    
    // Check current map center and zoom
    console.log('📍 Current map center:', mapInstance.getCenter());
    console.log('🔍 Current map zoom:', mapInstance.getZoom());

    // Check if map is ready (more robust than just isStyleLoaded)
    const isMapReady = mapInstance.isStyleLoaded() && 
                      mapInstance.getStyle() && 
                      mapInstance.getStyle().layers && 
                      mapInstance.getStyle().layers.length > 0;
    
    console.log('🗺️ Map ready check:', {
      isStyleLoaded: mapInstance.isStyleLoaded(),
      hasStyle: !!mapInstance.getStyle(),
      hasLayers: !!(mapInstance.getStyle()?.layers?.length),
      isMapReady
    });
    
    if (!isMapReady) {
      console.log('⏳ Waiting for map to be ready...');
      const handleMapReady = () => {
        console.log('✅ Map ready, adding startup intelligence layer...');
        addStartupIntelligenceLayer();
        if (mapInstance) {
          mapInstance.off('styledata', handleMapReady);
        }
      };
      
      // Add timeout fallback in case styledata event never fires
      const timeoutId = setTimeout(() => {
        console.log('⏰ Timeout waiting for map, proceeding anyway...');
        addStartupIntelligenceLayer();
        if (mapInstance) {
          mapInstance.off('styledata', handleMapReady);
        }
      }, 2000); // 2 second timeout
      
      mapInstance.on('styledata', handleMapReady);
      return () => {
        clearTimeout(timeoutId);
        if (mapInstance) {
          mapInstance.off('styledata', handleMapReady);
        }
      };
    }

    addStartupIntelligenceLayer().catch(error => {
      console.error('Error adding Houston companies layer:', error);
    });

    async function addStartupIntelligenceLayer() {
      if (!mapInstance) return;

      try {
        // Remove existing layers and sources
        // Stop radius animation
        if (window.startupIntelligenceRadiusAnimationFrame) {
          cancelAnimationFrame(window.startupIntelligenceRadiusAnimationFrame);
          window.startupIntelligenceRadiusAnimationFrame = null;
        }
        
        if (mapInstance.getLayer('startup-intelligence-markers')) {
          mapInstance.removeLayer('startup-intelligence-markers');
        }
        if (mapInstance.getLayer('startup-intelligence-radius-particles-layer')) {
          mapInstance.removeLayer('startup-intelligence-radius-particles-layer');
        }
        if (mapInstance.getSource('startup-intelligence')) {
          mapInstance.removeSource('startup-intelligence');
        }
        if (mapInstance.getSource('startup-intelligence-radius-particles')) {
          mapInstance.removeSource('startup-intelligence-radius-particles');
        }

    // Load and convert Houston companies data to GeoJSON format
    console.log('📡 Loading Houston companies data with accurate coordinates...');
    const response = await fetch('/companies/companies-9-24-2025-places-geocoded.json');
    const companiesData = await response.json();
    
    // Convert companies data to GeoJSON format
    const geojsonData = {
      type: 'FeatureCollection',
      features: companiesData.companies.map((company, index) => {
        // Use the accurate coordinates from Google Places API
        const coords = company.headquarters_location.coordinates;
        
        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [
              coords.lng,
              coords.lat
            ]
          },
          properties: {
            id: company.id,
            name: company.name,
            url: company.url,
            description: company.description,
            industries: company.industries,
            employees: company.employees,
            heat_score_tier: company.heat_score_tier,
            operating_status: company.operating_status,
            ipo_status: company.ipo_status,
            headquarters: company.headquarters_location.raw,
            address: company.headquarters_location.formatted_address,
            cb_rank_organization: company.cb_rank_organization,
            stage: company.stage,
            cb_rank_company: company.cb_rank_company,
            // Add category based on industries for color coding
            category: company.industries && company.industries.length > 0 ? company.industries[0] : 'Other',
            // Add formatter to indicate this should use company popup
            formatter: 'company',
            // Add geocoding metadata
            geocoded: company.headquarters_location.geocoded || false,
            geocoding_method: company.headquarters_location.geocoding_method || 'unknown'
          }
        };
      })
    };
        
        // Add source with converted GeoJSON data
        mapInstance.addSource('startup-intelligence', {
          type: 'geojson',
          data: geojsonData
        });
      } catch (error) {
        console.error('Error loading Houston companies data:', error);
        return;
      }
      
      // Add event listener to check when data is loaded (only once)
      if (!sourceDataListenerRef.current) {
        sourceDataListenerRef.current = (e) => {
          if (e.sourceId === 'startup-intelligence') {
            console.log('📊 Houston companies data loaded:', e.isSourceLoaded ? 'SUCCESS' : 'FAILED');
            if (e.isSourceLoaded) {
              const source = mapInstance.getSource('startup-intelligence');
              if (source && source._data) {
                console.log('📈 Data features count:', source._data.features?.length || 'Unknown');
                console.log('🎯 Using Google Places API geocoded coordinates');
                
                // Markers loaded without auto-zoom
                if (source._data.features && source._data.features.length > 0) {
                  console.log('🗺️ Houston company markers loaded without auto-zoom');
                  
                  // Now create radius particles with the loaded data
                  try {
                    addRadiusParticlesLayer(mapInstance);
                  } catch (error) {
                    console.error('Error adding radius particles after data load:', error);
                  }
                }
              }
              // Remove the listener after successful load to prevent infinite loop
              mapInstance.off('sourcedata', sourceDataListenerRef.current);
              sourceDataListenerRef.current = null;
            }
          }
        };
        mapInstance.on('sourcedata', sourceDataListenerRef.current);
      }

      // Add markers layer
      console.log('🎨 Adding Houston companies markers layer...');
      mapInstance.addLayer({
        id: 'startup-intelligence-markers',
        type: 'circle',
        source: 'startup-intelligence',
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'category'], 'Clean Energy'], 8,  // Larger for Clean Energy
            ['==', ['get', 'category'], 'Energy'], 7,
            ['==', ['get', 'category'], 'Oil and Gas'], 7,
            ['==', ['get', 'category'], 'Aerospace'], 6,
            ['==', ['get', 'category'], 'Air Transportation'], 6,
            ['==', ['get', 'category'], 'Renewable Energy'], 6,
            5 // Default for Other
          ],
          'circle-color': [
            'case',
            ['==', ['get', 'category'], 'Clean Energy'], '#10B981', // Green
            ['==', ['get', 'category'], 'Energy'], '#F59E0B', // Orange
            ['==', ['get', 'category'], 'Oil and Gas'], '#EF4444', // Red
            ['==', ['get', 'category'], 'Aerospace'], '#3B82F6', // Blue
            ['==', ['get', 'category'], 'Air Transportation'], '#8B5CF6', // Purple
            ['==', ['get', 'category'], 'Renewable Energy'], '#06D6A0', // Teal
            '#6B7280' // Default gray for Other
          ],
          'circle-opacity': 0.8
        }
      });

      // Note: Popup creation is now handled by the enhanced popup system in PopupCards.jsx
      // This layer focuses on marker rendering and event handling only

      // Note: Click handlers are now managed by the enhanced popup system in PopupManager.jsx

      // Remove existing mouse handlers first to prevent duplicates
      mapInstance.off('mouseenter', 'startup-intelligence-markers');
      mapInstance.off('mouseleave', 'startup-intelligence-markers');

      // Change cursor on hover
      mapInstance.on('mouseenter', 'startup-intelligence-markers', () => {
        mapInstance.getCanvas().style.cursor = 'pointer';
      });

      mapInstance.on('mouseleave', 'startup-intelligence-markers', () => {
        mapInstance.getCanvas().style.cursor = '';
      });

      // Add click handler for company markers
      mapInstance.on('click', 'startup-intelligence-markers', (e) => {
        const feature = e.features[0];
        const properties = feature.properties;
        
        // Emit event to trigger popup via the existing popup system
        if (window.mapEventBus) {
          const eventData = {
            id: properties.id,
            name: properties.name,
            title: properties.name,
            type: 'company',
            category: properties.category,
            address: properties.address,
            coordinates: [e.lngLat.lng, e.lngLat.lat],
            // Company-specific properties
            url: properties.url,
            description: properties.description,
            industries: properties.industries,
            employees: properties.employees,
            heat_score_tier: properties.heat_score_tier,
            operating_status: properties.operating_status,
            ipo_status: properties.ipo_status,
            headquarters: properties.headquarters,
            cb_rank_organization: properties.cb_rank_organization,
            stage: properties.stage,
            cb_rank_company: properties.cb_rank_company,
            // Add formatter to indicate this should use company popup
            formatter: 'company'
          };
          
          window.mapEventBus.emit('marker:clicked', eventData);
        }
      });

      // Listen for table row clicks to trigger marker popup
      const handleTableRowClick = (eventData) => {
        console.log('🎯 StartupIntelligenceLayer: Received table row click event:', eventData);
        
        if (!eventData.coordinates || !Array.isArray(eventData.coordinates)) {
          console.warn('❌ No valid coordinates in table row click event');
          return;
        }
        
        const [lng, lat] = eventData.coordinates;
        console.log('📍 Looking for marker at coordinates:', { lng, lat });
        
        // Find the marker at these coordinates
        const source = mapInstance.getSource('startup-intelligence');
        if (!source || !source._data || !source._data.features) {
          console.warn('❌ No startup intelligence data available');
          return;
        }
        
        // Find the feature that matches these coordinates (with some tolerance)
        const tolerance = 0.0001; // Small tolerance for coordinate matching
        const matchingFeature = source._data.features.find(feature => {
          const [featureLng, featureLat] = feature.geometry.coordinates;
          return Math.abs(featureLng - lng) < tolerance && Math.abs(featureLat - lat) < tolerance;
        });
        
        if (matchingFeature) {
          console.log('✅ Found matching marker:', matchingFeature.properties.name);
          
          // Emit event to trigger popup via the enhanced popup system
          console.log('🚀 Emitting marker click event for popup:', matchingFeature.properties.name);
          if (window.mapEventBus) {
            window.mapEventBus.emit('marker:clicked', {
              ...matchingFeature.properties,
              coordinates: [lng, lat],
              id: matchingFeature.properties.id || matchingFeature.id
            });
          }
        } else {
          console.warn('❌ No matching marker found for coordinates:', { lng, lat });
          console.log('📊 Available markers:', source._data.features.map(f => ({
            name: f.properties.name,
            coordinates: f.geometry.coordinates
          })));
          
          // Try to find by name as fallback
          if (eventData.nodeName) {
            console.log('🔍 Trying to find marker by name:', eventData.nodeName);
            const nameMatch = source._data.features.find(feature => 
              feature.properties.name && 
              feature.properties.name.toLowerCase().includes(eventData.nodeName.toLowerCase())
            );
            
            if (nameMatch) {
              console.log('✅ Found marker by name:', nameMatch.properties.name);
              const [matchLng, matchLat] = nameMatch.geometry.coordinates;
              
              // Emit event to trigger popup via the enhanced popup system
              console.log('🚀 Emitting marker click event for popup (by name):', nameMatch.properties.name);
              if (window.mapEventBus) {
                window.mapEventBus.emit('marker:clicked', {
                  ...nameMatch.properties,
                  coordinates: [matchLng, matchLat],
                  id: nameMatch.properties.id || nameMatch.id
                });
              }
            }
          }
        }
      };
      
      // Listen for the startup marker click event
      if (window.mapEventBus) {
        window.mapEventBus.on('startup:markerClick', handleTableRowClick);
        console.log('🎧 StartupIntelligenceLayer: Listening for startup:markerClick events');
      }

      layerAddedRef.current = true;
      console.log('✅ Houston Companies layer added to map');
      console.log('📊 Loading data from: /companies/companies-9-24-2025-geocoded.json');
      
      // Check if layer exists
      if (mapInstance.getLayer('startup-intelligence-markers')) {
        console.log('✅ Layer exists in map');
      } else {
        console.error('❌ Layer not found in map');
      }
      
      // Check if source exists
      if (mapInstance.getSource('startup-intelligence')) {
        console.log('✅ Source exists in map');
      } else {
        console.error('❌ Source not found in map');
      }
      
      // Check layer visibility
      const layer = mapInstance.getLayer('startup-intelligence-markers');
      if (layer) {
        console.log('✅ Layer visibility:', mapInstance.getLayoutProperty('startup-intelligence-markers', 'visibility'));
      }
    }

    // Cleanup function for when component unmounts
    return () => {
      if (mapInstance && layerAddedRef.current) {
        console.log('🗺️ Startup Intelligence Layer: Component unmounting, cleaning up...');
        try {
          // Clean up event listeners
          if (sourceDataListenerRef.current) {
            mapInstance.off('sourcedata', sourceDataListenerRef.current);
            sourceDataListenerRef.current = null;
          }
          
          // Clean up table row click listener
          if (window.mapEventBus) {
            window.mapEventBus.off('startup:markerClick');
            console.log('🎧 StartupIntelligenceLayer: Removed startup:markerClick listener');
          }
          
          // Stop radius animation
          if (window.startupIntelligenceRadiusAnimationFrame) {
            cancelAnimationFrame(window.startupIntelligenceRadiusAnimationFrame);
            window.startupIntelligenceRadiusAnimationFrame = null;
          }
          
          if (mapInstance.getLayer('startup-intelligence-markers')) {
            mapInstance.removeLayer('startup-intelligence-markers');
          }
          if (mapInstance.getLayer('startup-intelligence-radius-particles-layer')) {
            mapInstance.removeLayer('startup-intelligence-radius-particles-layer');
          }
          if (mapInstance.getSource('startup-intelligence')) {
            mapInstance.removeSource('startup-intelligence');
          }
          if (mapInstance.getSource('startup-intelligence-radius-particles')) {
            mapInstance.removeSource('startup-intelligence-radius-particles');
          }
          layerAddedRef.current = false;
        } catch (error) {
          console.warn('Error removing startup intelligence layer:', error);
        }
      }
    };
  }, [map, visible]);

  return null; // This component doesn't render anything
};

export default StartupIntelligenceLayer;
