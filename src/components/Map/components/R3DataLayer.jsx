import { useEffect, useRef } from 'react';

const R3DataLayer = ({ map, visible }) => {
  const layerAddedRef = useRef(false);
  const sourceDataListenerRef = useRef(null);

  useEffect(() => {
    if (!map?.current) return;
    
    // If not visible, clean up and return
    if (!visible) {
      if (layerAddedRef.current) {
        const mapInstance = map.current;
        console.log('🗺️ R3 Data Layer: Toggling OFF');
        try {
          // Clean up event listeners
          if (sourceDataListenerRef.current) {
            mapInstance.off('sourcedata', sourceDataListenerRef.current);
            sourceDataListenerRef.current = null;
          }
          
          if (mapInstance.getLayer('r3-data-markers')) {
            mapInstance.removeLayer('r3-data-markers');
          }
          if (mapInstance.getSource('r3-data')) {
            mapInstance.removeSource('r3-data');
          }
          layerAddedRef.current = false;
        } catch (error) {
          console.warn('Error removing R3 data layer:', error);
        }
      }
      return;
    }

    console.log('🗺️ R3 Data Layer: Toggling ON');
    const mapInstance = map.current;
    
    // Check if map is ready
    const isMapReady = mapInstance.isStyleLoaded() && 
                      mapInstance.getStyle() && 
                      mapInstance.getStyle().layers && 
                      mapInstance.getStyle().layers.length > 0;
    
    if (!isMapReady) {
      console.log('⏳ Waiting for map to be ready...');
      const handleMapReady = () => {
        console.log('✅ Map ready, adding R3 data layer...');
        addR3DataLayer();
        if (mapInstance) {
          mapInstance.off('styledata', handleMapReady);
        }
      };
      
      const timeoutId = setTimeout(() => {
        console.log('⏰ Timeout waiting for map, proceeding anyway...');
        addR3DataLayer();
        if (mapInstance) {
          mapInstance.off('styledata', handleMapReady);
        }
      }, 2000);
      
      mapInstance.on('styledata', handleMapReady);
      return () => {
        clearTimeout(timeoutId);
        if (mapInstance) {
          mapInstance.off('styledata', handleMapReady);
        }
      };
    }

    addR3DataLayer().catch(error => {
      console.error('Error adding R3 data layer:', error);
    });

    async function addR3DataLayer() {
      if (!mapInstance) return;

      try {
        // Remove existing layers and sources
        if (mapInstance.getLayer('r3-data-markers')) {
          mapInstance.removeLayer('r3-data-markers');
        }
        if (mapInstance.getSource('r3-data')) {
          mapInstance.removeSource('r3-data');
        }

        // Load R3 data
        console.log('📡 Loading R3 data...');
        const response = await fetch('/R3dataload September 2025.json');
        const r3Data = await response.json();
        
        // Convert R3 data to GeoJSON format
        const geojsonData = {
          type: 'FeatureCollection',
          features: r3Data.R3Report.map((facility, index) => {
            // Parse coordinates - handle potential string values
            const lat = parseFloat(facility.Latitude);
            const lng = parseFloat(facility.Longtitude); // Note: typo in original data
            
            // Skip if coordinates are invalid
            if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
              return null;
            }
            
            return {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [lng, lat]
              },
              properties: {
                id: facility['ReportR3Key'] || index,
                facilityName: facility['Facility Name']?.trim() || 'Unknown Facility',
                serialNumber: facility['Serial Number'] || 'N/A',
                plantType: facility['Plant Type'] || 'Unknown',
                r3PlantId: facility['R3 Plant ID'] || 'N/A',
                cidCritical: facility['CIDCritical'] || 'NO',
                reportingPeriodMonth: facility['ReportingPeriodMonth'] || 'Unknown',
                reportingPeriodYear: facility['ReportingPeriodYear'] || 'Unknown',
                plantAverageCapacity: facility['PlantAverageCapacity'] || '0',
                district: facility['District'] || 'Unknown',
                county: facility['County'] || 'Unknown',
                latitude: lat,
                longitude: lng,
                // Add formatter to indicate this should use R3 facility popup
                formatter: 'r3-facility'
              }
            };
          }).filter(feature => feature !== null) // Remove null entries
        };
        
        console.log(`📊 Converted ${geojsonData.features.length} R3 facilities to GeoJSON`);
        
        // Add source with converted GeoJSON data
        mapInstance.addSource('r3-data', {
          type: 'geojson',
          data: geojsonData
        });
      } catch (error) {
        console.error('Error loading R3 data:', error);
        return;
      }
      
      // Add event listener to check when data is loaded
      if (!sourceDataListenerRef.current) {
        sourceDataListenerRef.current = (e) => {
          if (e.sourceId === 'r3-data') {
            console.log('📊 R3 data loaded:', e.isSourceLoaded ? 'SUCCESS' : 'FAILED');
            if (e.isSourceLoaded) {
              const source = mapInstance.getSource('r3-data');
              if (source && source._data) {
                console.log('📈 R3 data features count:', source._data.features?.length || 'Unknown');
              }
              // Remove the listener after successful load
              mapInstance.off('sourcedata', sourceDataListenerRef.current);
              sourceDataListenerRef.current = null;
            }
          }
        };
        mapInstance.on('sourcedata', sourceDataListenerRef.current);
      }

      // Add markers layer
      console.log('🎨 Adding R3 data markers layer...');
      mapInstance.addLayer({
        id: 'r3-data-markers',
        type: 'circle',
        source: 'r3-data',
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'plantType'], 'Gas Processing Plant'], 8,
            ['==', ['get', 'plantType'], 'Gas Plant'], 7,
            ['==', ['get', 'plantType'], 'Processing Plant'], 6,
            ['==', ['get', 'plantType'], 'Other'], 5,
            6 // Default
          ],
          'circle-color': [
            'case',
            ['==', ['get', 'plantType'], 'Gas Processing Plant'], '#10B981', // Green
            ['==', ['get', 'plantType'], 'Gas Plant'], '#3B82F6', // Blue
            ['==', ['get', 'plantType'], 'Processing Plant'], '#F59E0B', // Orange
            ['==', ['get', 'plantType'], 'Other'], '#6B7280', // Gray
            '#8B5CF6' // Default purple
          ],
          'circle-opacity': 0.8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });

      // Add hover effects
      mapInstance.off('mouseenter', 'r3-data-markers');
      mapInstance.off('mouseleave', 'r3-data-markers');

      mapInstance.on('mouseenter', 'r3-data-markers', () => {
        mapInstance.getCanvas().style.cursor = 'pointer';
      });

      mapInstance.on('mouseleave', 'r3-data-markers', () => {
        mapInstance.getCanvas().style.cursor = '';
      });

      // Add click handler for R3 facility markers
      mapInstance.on('click', 'r3-data-markers', (e) => {
        const feature = e.features[0];
        const properties = feature.properties;
        
        // Emit event to trigger popup via the existing popup system
        if (window.mapEventBus) {
          const eventData = {
            id: properties.id,
            name: properties.facilityName,
            title: properties.facilityName,
            type: 'r3-facility',
            coordinates: [e.lngLat.lng, e.lngLat.lat],
            // R3 facility-specific properties
            serialNumber: properties.serialNumber,
            plantType: properties.plantType,
            r3PlantId: properties.r3PlantId,
            cidCritical: properties.cidCritical,
            reportingPeriodMonth: properties.reportingPeriodMonth,
            reportingPeriodYear: properties.reportingPeriodYear,
            plantAverageCapacity: properties.plantAverageCapacity,
            district: properties.district,
            county: properties.county,
            latitude: properties.latitude,
            longitude: properties.longitude,
            formatter: 'r3-facility'
          };
          
          window.mapEventBus.emit('marker:clicked', eventData);
        }
      });

      layerAddedRef.current = true;
      console.log('✅ R3 Data layer added to map');
    }

    // Cleanup function for when component unmounts
    return () => {
      if (mapInstance && layerAddedRef.current) {
        console.log('🗺️ R3 Data Layer: Component unmounting, cleaning up...');
        try {
          // Clean up event listeners
          if (sourceDataListenerRef.current) {
            mapInstance.off('sourcedata', sourceDataListenerRef.current);
            sourceDataListenerRef.current = null;
          }
          
          if (mapInstance.getLayer('r3-data-markers')) {
            mapInstance.removeLayer('r3-data-markers');
          }
          if (mapInstance.getSource('r3-data')) {
            mapInstance.removeSource('r3-data');
          }
          layerAddedRef.current = false;
        } catch (error) {
          console.warn('Error removing R3 data layer:', error);
        }
      }
    };
  }, [map, visible]);

  return null; // This component doesn't render anything
};

export default R3DataLayer;

