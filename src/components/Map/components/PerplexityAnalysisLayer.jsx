import { useEffect, useRef } from 'react';

const PerplexityAnalysisLayer = ({ map, visible, analysisData }) => {
  const layersAddedRef = useRef({});
  const sourceDataListenerRef = useRef(null);

  useEffect(() => {
    if (!map?.current) return;
    
    // If not visible, clean up and return
    if (!visible) {
      if (Object.keys(layersAddedRef.current).length > 0) {
        const mapInstance = map.current;
        console.log('🧠 Perplexity Analysis Layer: Toggling OFF');
        try {
          // Clean up event listeners
          if (sourceDataListenerRef.current) {
            mapInstance.off('sourcedata', sourceDataListenerRef.current);
            sourceDataListenerRef.current = null;
          }
          
          // Remove all category layers
          Object.keys(layersAddedRef.current).forEach(category => {
            const layerId = `perplexity-analysis-${category}`;
            if (mapInstance.getLayer(layerId)) {
              mapInstance.removeLayer(layerId);
            }
          });
          
          // Remove source
          if (mapInstance.getSource('perplexity-analysis')) {
            mapInstance.removeSource('perplexity-analysis');
          }
          
          layersAddedRef.current = {};
        } catch (error) {
          console.warn('Error removing Perplexity analysis layers:', error);
        }
      }
      return;
    }

    console.log('🧠 Perplexity Analysis Layer: Toggling ON');
    const mapInstance = map.current;
    
    // Check if map is ready
    const isMapReady = mapInstance.isStyleLoaded() && 
                      mapInstance.getStyle() && 
                      mapInstance.getStyle().layers && 
                      mapInstance.getStyle().layers.length > 0;
    
    if (!isMapReady) {
      console.log('⏳ Waiting for map to be ready for Perplexity layer...');
      const handleMapReady = () => {
        console.log('✅ Map ready, adding Perplexity analysis layer...');
        addPerplexityAnalysisLayer();
        if (mapInstance) {
          mapInstance.off('styledata', handleMapReady);
        }
      };
      
      mapInstance.on('styledata', handleMapReady);
      return () => {
        if (mapInstance) {
          mapInstance.off('styledata', handleMapReady);
        }
      };
    }

    addPerplexityAnalysisLayer().catch(error => {
      console.error('Error adding Perplexity analysis layer:', error);
    });

    async function addPerplexityAnalysisLayer() {
      if (!mapInstance) return;

      try {
        // Remove existing layers and sources
        if (mapInstance.getLayer('perplexity-analysis-markers')) {
          mapInstance.removeLayer('perplexity-analysis-markers');
        }
        if (mapInstance.getSource('perplexity-analysis')) {
          mapInstance.removeSource('perplexity-analysis');
        }

        // Use passed analysisData or fallback methods
        let perplexityData = analysisData;
        
        // Fallback 1: Check global storage
        if (!perplexityData && window.lastPerplexityAnalysisData && window.lastPerplexityAnalysisData.geoJsonFeatures) {
          perplexityData = window.lastPerplexityAnalysisData;
          console.log('📊 Using global Perplexity analysis data:', perplexityData.geoJsonFeatures.length, 'features');
        }
        
        // Fallback 2: Try to load local file
        if (!perplexityData) {
          try {
            const response = await fetch('/perplexity-houston-startup-analysis.json');
            if (response.ok) {
              perplexityData = await response.json();
              console.log('📁 Using local Perplexity analysis file:', perplexityData.geoJsonFeatures?.length || 0, 'features');
            }
          } catch (error) {
            console.log('📁 No local Perplexity file found');
          }
        }
        
        // Fallback 3: Generate sample data if no data available
        if (!perplexityData || !perplexityData.geoJsonFeatures || perplexityData.geoJsonFeatures.length === 0) {
          console.log('📊 No Perplexity data available, generating sample data for testing');
          perplexityData = {
            geoJsonFeatures: [
              {
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [-95.3698, 29.7604] // Downtown Houston
                },
                properties: {
                  id: 'sample_innovation_hub',
                  name: 'Downtown Innovation Hub',
                  category: 'innovation_hub',
                  innovation_score: 88,
                  funding_access: 92,
                  talent_access: 85
                }
              },
              {
                type: 'Feature', 
                geometry: {
                  type: 'Point',
                  coordinates: [-95.4137, 29.7174] // Rice Village
                },
                properties: {
                  id: 'sample_biotech_hub',
                  name: 'Rice Village Biotech Hub',
                  category: 'innovation_hub',
                  innovation_score: 86,
                  funding_access: 83,
                  talent_access: 93
                }
              }
            ]
          };
        }
        
        // Convert to GeoJSON format
        const geojsonData = {
          type: 'FeatureCollection',
          features: perplexityData.geoJsonFeatures
        };
        
        // Add source with Perplexity analysis data
        mapInstance.addSource('perplexity-analysis', {
          type: 'geojson',
          data: geojsonData
        });

        // Get unique categories from the data
        const categories = [...new Set(perplexityData.geoJsonFeatures.map(f => f.properties.category))];
        console.log('🎨 Creating separate layers for categories:', categories);

        // Create separate layer for each category
        categories.forEach(category => {
          const layerId = `perplexity-analysis-${category}`;
          
          // Define color scheme
          const colorMap = {
            'innovation_hub': '#3b82f6',    // Blue
            'startup_zone': '#10b981',      // Green  
            'funding_source': '#f59e0b',    // Orange
          };
          const color = colorMap[category] || '#8b5cf6'; // Purple default
          
          console.log(`🎨 Adding layer for category: ${category} with color: ${color}`);
          
          mapInstance.addLayer({
            id: layerId,
            type: 'circle',
            source: 'perplexity-analysis',
            filter: ['==', ['get', 'category'], category], // Filter to only show this category
            paint: {
              'circle-radius': [
                'case',
                ['>=', ['get', 'innovation_score'], 85], 10,  // Large for high innovation
                ['>=', ['get', 'innovation_score'], 70], 8,   // Medium for moderate innovation
                6 // Default size
              ],
              'circle-color': color,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
              'circle-opacity': 0.8
            },
            layout: {
              'visibility': 'visible' // Default to visible
            }
          });
          
          // Track that this layer was added
          layersAddedRef.current[category] = true;
        });

        // Add hover and click handlers for each category layer
        categories.forEach(category => {
          const layerId = `perplexity-analysis-${category}`;
          
          // Change cursor on hover
          mapInstance.on('mouseenter', layerId, () => {
            mapInstance.getCanvas().style.cursor = 'pointer';
          });

          mapInstance.on('mouseleave', layerId, () => {
            mapInstance.getCanvas().style.cursor = '';
          });

          // Add click handler for Perplexity markers
          mapInstance.on('click', layerId, (e) => {
            const feature = e.features[0];
            const properties = feature.properties;
            
            console.log('🧠 Perplexity marker clicked:', properties.name);
            
            // Emit event to trigger popup via the existing popup system
            if (window.mapEventBus) {
              const eventData = {
                id: properties.id,
                name: properties.name,
                title: properties.name,
                type: 'perplexity_analysis',
                category: properties.category,
                coordinates: [e.lngLat.lng, e.lngLat.lat],
                // Perplexity-specific properties
                innovation_score: properties.innovation_score,
                funding_access: properties.funding_access,
                talent_access: properties.talent_access,
                network_effects: properties.network_effects,
                market_opportunity: properties.market_opportunity,
                startup_impact: properties.startup_impact,
                zone: properties.zone,
                zone_name: properties.zone_name,
                analysis_type: properties.analysis_type,
                confidence_score: properties.confidence_score,
                // Add formatter to indicate this should use Perplexity popup
                formatter: 'perplexity'
              };
              
              window.mapEventBus.emit('marker:clicked', eventData);
            }
          });
        });

        console.log('✅ Perplexity Analysis layers added to map');
        console.log('📊 Features rendered:', perplexityData.geoJsonFeatures.length);
        console.log('🎨 Categories created:', Object.keys(layersAddedRef.current));
        
        // Check if layers exist
        categories.forEach(category => {
          const layerId = `perplexity-analysis-${category}`;
          if (mapInstance.getLayer(layerId)) {
            console.log(`✅ Perplexity layer ${category} exists in map`);
          } else {
            console.error(`❌ Perplexity layer ${category} not found in map`);
          }
        });
        
        // Check if source exists
        if (mapInstance.getSource('perplexity-analysis')) {
          console.log('✅ Perplexity source exists in map');
        } else {
          console.error('❌ Perplexity source not found in map');
        }
      } catch (error) {
        console.error('❌ Error adding Perplexity analysis layer:', error);
      }
    }

    // Cleanup function
    return () => {
      if (mapInstance && Object.keys(layersAddedRef.current).length > 0) {
        console.log('🧠 Perplexity Analysis Layer: Component unmounting, cleaning up...');
        try {
          // Clean up event listeners
          if (sourceDataListenerRef.current) {
            mapInstance.off('sourcedata', sourceDataListenerRef.current);
            sourceDataListenerRef.current = null;
          }
          
          // Remove all category layers
          Object.keys(layersAddedRef.current).forEach(category => {
            const layerId = `perplexity-analysis-${category}`;
            if (mapInstance.getLayer(layerId)) {
              mapInstance.removeLayer(layerId);
            }
          });
          
          // Remove source
          if (mapInstance.getSource('perplexity-analysis')) {
            mapInstance.removeSource('perplexity-analysis');
          }
          
          layersAddedRef.current = {};
        } catch (error) {
          console.warn('Error removing Perplexity analysis layers:', error);
        }
      }
    };
  }, [map, visible, analysisData]);

  return null; // This component doesn't render anything
};

export default PerplexityAnalysisLayer;