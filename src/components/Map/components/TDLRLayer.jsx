import { useEffect, useRef } from 'react';

const TDLRLayer = ({ map, visible }) => {
  const layerAddedRef = useRef(false);

  useEffect(() => {
    if (!map || !map.current) {
      return;
    }

    const mapInstance = map.current;

    // Try to add layer immediately, handle errors if style not ready
    const tryAddLayer = async () => {
      if (visible) {
        try {
          await addTDLRLayer();
        } catch (error) {
          // If style not ready, wait for it
          if (error.message.includes('Style is not done loading') || error.message.includes('Style is not loaded')) {
            const handleStyleLoad = async () => {
              try {
                await addTDLRLayer();
              } catch (retryError) {
                console.error('TDLRLayer: Error adding layer after style load:', retryError);
              }
            };
            mapInstance.once('styledata', handleStyleLoad);
          } else {
            console.error('TDLRLayer: Unexpected error adding layer:', error);
          }
        }
      } else {
        removeTDLRLayer();
      }
    };

    tryAddLayer();

    async function addTDLRLayer() {
      if (layerAddedRef.current) {
        return;
      }

      // Remove existing layers if they exist
      if (mapInstance.getLayer('tdlr-markers')) {
        mapInstance.removeLayer('tdlr-markers');
      }
      if (mapInstance.getLayer('tdlr-radius-circles')) {
        mapInstance.removeLayer('tdlr-radius-circles');
      }
      if (mapInstance.getSource('tdlr-markers')) {
        mapInstance.removeSource('tdlr-markers');
      }
      if (mapInstance.getSource('tdlr-pulse-source')) {
        mapInstance.removeSource('tdlr-pulse-source');
      }

      try {
        // Load the GeoJSON data first (like SerpTool does)
        const response = await fetch('/Listings/TLDR/tdlr_houston_all_precise.geojson');
        const geojsonData = await response.json();

        // Add source with the loaded data
        mapInstance.addSource('tdlr-markers', {
          type: 'geojson',
          data: geojsonData
        });
      } catch (error) {
        console.error('TDLRLayer: Error loading TDLR data:', error);
        return;
      }

      // Add pulse source for animated radius circles
      try {
        mapInstance.addSource('tdlr-pulse-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      } catch (error) {
        console.error('TDLRLayer: Error adding pulse source:', error);
        return;
      }

      // Add animated radius circles layer (pulse effect)
      try {
        mapInstance.addLayer({
          id: 'tdlr-radius-circles',
          type: 'circle',
          source: 'tdlr-pulse-source',
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, [
                'interpolate',
                ['exponential', 2.0],
                ['get', 'pulse_t'],
                0, 1,      // Start: 1px at low zoom
                0.3, 4,    // Peak: 4px at low zoom
                0.7, 5,    // Slight overshoot
                1.0, 1     // Reset to start
              ],
              8, [
                'interpolate',
                ['exponential', 2.0],
                ['get', 'pulse_t'],
                0, 3,      // Start: 3px at mid zoom
                0.3, 12,   // Peak: 12px at mid zoom
                0.7, 15,   // Slight overshoot
                1.0, 3     // Reset to start
              ],
              12, [
                'interpolate',
                ['exponential', 2.0],
                ['get', 'pulse_t'],
                0, 5,      // Start: 5px at high zoom
                0.3, 18,   // Peak: 18px at high zoom
                0.7, 22,   // Slight overshoot
                1.0, 5     // Reset to start
              ],
              16, [
                'interpolate',
                ['exponential', 2.0],
                ['get', 'pulse_t'],
                0, 8,      // Start: 8px at very high zoom
                0.3, 28,   // Peak: 28px at very high zoom
                0.7, 32,   // Slight overshoot
                1.0, 8     // Reset to start
              ]
            ],
            'circle-color': '#EF4444', // Red color
            'circle-opacity': [
              'interpolate',
              ['linear'],
              ['get', 'pulse_t'],
              0, 0.6,     // Start: 60% opacity
              0.3, 0.8,   // Peak: 80% opacity
              0.7, 0.4,   // Mid-fade: 40%
              1.0, 0      // Complete fade
            ],
            'circle-blur': 0.5 // Soft pulse edge
          }
        });
      } catch (error) {
        console.error('TDLRLayer: Error adding radius circles layer:', error);
        return;
      }

      // Add markers layer
      try {
        mapInstance.addLayer({
          id: 'tdlr-markers',
          type: 'circle',
          source: 'tdlr-markers',
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8, 4,
              12, 6,
              16, 8,
              20, 10
            ],
            'circle-color': '#EF4444', // Red color
            'circle-opacity': 0.8
          }
        });
      } catch (error) {
        console.error('TDLRLayer: Error adding markers layer:', error);
        return;
      }

      // Add click handlers for both layers - use existing popup system
      const handleMarkerClick = (e) => {
        const feature = e.features[0];
        const properties = feature.properties;
        
        // Process clicks from actual TDLR markers
        
        // Debug logging removed - TDLR popup working correctly
        
        // Emit event to trigger popup via the existing popup system
        if (window.mapEventBus) {
          const eventData = {
            id: properties.id || properties.project_id,
            name: properties.project_name || 'TDLR Project',
            title: properties.project_name || 'TDLR Project',
            type: 'tdlr',
            category: 'Construction Project',
            address: properties.formatted_address || properties.address || 'N/A',
            coordinates: [e.lngLat.lng, e.lngLat.lat],
            // TDLR-specific properties - pass all available data
            project_name: properties.project_name,
            project_id: properties.project_id,
            facility_name: properties.facility_name,
            work_type: properties.work_type,
            status: properties.status,
            cost: properties.cost,
            city: properties.city,
            county: properties.county,
            formatted_address: properties.formatted_address,
            geocoded_method: properties.geocoded_method,
            scraped_at: properties.scraped_at,
            estimated_completion: properties.estimated_completion,
            contractor: properties.contractor,
            owner: properties.owner,
            // Add formatter to indicate this should use TDLR popup
            formatter: 'tdlr'
          };
          
          // Debug logging removed - TDLR popup working correctly
          
          window.mapEventBus.emit('marker:clicked', eventData);
        }
      };

      // Remove any existing click handlers first to prevent duplicates
      mapInstance.off('click', 'tdlr-markers');
      
      // Add click handlers only for actual markers, not radius circles
      mapInstance.on('click', 'tdlr-markers', handleMarkerClick);

      // Change cursor on hover for both layers
      mapInstance.on('mouseenter', 'tdlr-markers', () => {
        mapInstance.getCanvas().style.cursor = 'pointer';
      });
      mapInstance.on('mouseenter', 'tdlr-radius-circles', () => {
        mapInstance.getCanvas().style.cursor = 'pointer';
      });

      mapInstance.on('mouseleave', 'tdlr-markers', () => {
        mapInstance.getCanvas().style.cursor = '';
      });
      mapInstance.on('mouseleave', 'tdlr-radius-circles', () => {
        mapInstance.getCanvas().style.cursor = '';
      });

      layerAddedRef.current = true;

      // Start pulse animation
      startPulseAnimation();
    }

    function startPulseAnimation() {
      let animationFrame = null;
      const PULSE_PERIOD = 2.0; // 2.0 second cycle (20% slower)

      const animatePulse = () => {
        if (!mapInstance.getSource('tdlr-pulse-source') || !mapInstance.getSource('tdlr-markers')) {
          return;
        }

        // Get all TDLR markers
        const tdlrSource = mapInstance.getSource('tdlr-markers');
        const tdlrData = tdlrSource._data;
        
        if (tdlrData && tdlrData.features) {
          const t = ((Date.now() / 1000) % PULSE_PERIOD) / PULSE_PERIOD; // 0-1 progress
          
          // Create pulse features for each TDLR marker
          const pulseFeatures = tdlrData.features.map(feature => ({
            type: 'Feature',
            geometry: feature.geometry,
            properties: { 
              pulse_t: t,
              original_id: feature.properties.id || feature.properties.project_id
            }
          }));

          // Update pulse source with animated features
          mapInstance.getSource('tdlr-pulse-source').setData({
            type: 'FeatureCollection',
            features: pulseFeatures
          });
        }

        animationFrame = requestAnimationFrame(animatePulse);
      };

      // Store animation frame for cleanup
      window.tdlrPulseAnimation = animationFrame;
      animatePulse();
    }

    function removeTDLRLayer() {
      // Stop animation
      if (window.tdlrPulseAnimation) {
        cancelAnimationFrame(window.tdlrPulseAnimation);
        window.tdlrPulseAnimation = null;
      }

      // Remove both layers
      if (mapInstance.getLayer('tdlr-markers')) {
        mapInstance.removeLayer('tdlr-markers');
      }
      if (mapInstance.getLayer('tdlr-radius-circles')) {
        mapInstance.removeLayer('tdlr-radius-circles');
      }
      
      // Remove sources
      if (mapInstance.getSource('tdlr-markers')) {
        mapInstance.removeSource('tdlr-markers');
      }
      if (mapInstance.getSource('tdlr-pulse-source')) {
        mapInstance.removeSource('tdlr-pulse-source');
      }
      
      layerAddedRef.current = false;
    }

    return () => {
      removeTDLRLayer();
    };
  }, [map, visible]);

  return null;
};

export default TDLRLayer;
