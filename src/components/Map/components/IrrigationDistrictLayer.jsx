import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

const IrrigationDistrictLayer = ({ map, visible }) => {
  const layerRef = useRef(null);
  const sourceRef = useRef(null);

  // Log when component mounts and visibility changes
  useEffect(() => {
  }, []);

  useEffect(() => {
  }, [visible]);

  useEffect(() => {
    if (!map || !map.current) return;

    const mapInstance = map.current;

    // Only add the layer if visible is true
    if (!visible) {
      // Remove existing layers if they exist
      removeIrrigationDistrictLayers();
      return;
    }

    // Check if map is loaded and style is available
    if (!mapInstance.isStyleLoaded()) {
      const onStyleLoad = () => {
        if (visible) {
          addIrrigationDistrictLayer();
        }
      };
      
      mapInstance.once('styledata', onStyleLoad);
      return () => {
        mapInstance.off('styledata', onStyleLoad);
      };
    }

    addIrrigationDistrictLayer();

    function removeIrrigationDistrictLayers() {
      if (!mapInstance) return;
      
      try {
        if (mapInstance.getLayer('irrigation-districts-fill')) {
          mapInstance.removeLayer('irrigation-districts-fill');
        }
        if (mapInstance.getLayer('irrigation-districts-line')) {
          mapInstance.removeLayer('irrigation-districts-line');
        }
        if (mapInstance.getLayer('irrigation-districts-labels')) {
          mapInstance.removeLayer('irrigation-districts-labels');
        }
        if (mapInstance.getSource('irrigation-districts')) {
          mapInstance.removeSource('irrigation-districts');
        }
      } catch (error) {
        console.warn('Error removing irrigation district layers:', error);
      }
    }

    function addIrrigationDistrictLayer() {
      if (!mapInstance) return;

      // Remove existing layer and source if they exist
      if (layerRef.current) {
        if (mapInstance.getLayer('irrigation-districts-fill')) {
          mapInstance.removeLayer('irrigation-districts-fill');
        }
        if (mapInstance.getLayer('irrigation-districts-line')) {
          mapInstance.removeLayer('irrigation-districts-line');
        }
        if (mapInstance.getLayer('irrigation-districts-labels')) {
          mapInstance.removeLayer('irrigation-districts-labels');
        }
        if (mapInstance.getSource('irrigation-districts')) {
          mapInstance.removeSource('irrigation-districts');
        }
      }

      // Add the GeoJSON source
      mapInstance.addSource('irrigation-districts', {
        type: 'geojson',
        data: '/ARZ/Irrigation_District_2024.geojson'
      });

      // Add fill layer
      mapInstance.addLayer({
        id: 'irrigation-districts-fill',
        type: 'fill',
        source: 'irrigation-districts',
          paint: {
            'fill-color': '#0099FF', // Bright blue
            'fill-opacity': 0.07 // 7% opacity - very subtle
          }
      });

      // Add line layer for borders
      mapInstance.addLayer({
        id: 'irrigation-districts-line',
        type: 'line',
        source: 'irrigation-districts',
        paint: {
          'line-color': '#0099FF', // Same bright blue
          'line-width': 0.06, // Extremely thin outline
          'line-opacity': 0.5 // 50% opacity
        }
      });

      // Add labels layer
      mapInstance.addLayer({
        id: 'irrigation-districts-labels',
        type: 'symbol',
        source: 'irrigation-districts',
        layout: {
          'text-field': ['get', 'MAP_LABEL'],
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 12,
          'text-transform': 'uppercase',
          'text-offset': [0, 1.5],
          'text-anchor': 'top'
        },
        paint: {
          'text-color': '#1E3A8A',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 1
        },
        filter: ['!=', ['get', 'MAP_LABEL'], ' '] // Only show labels that aren't empty
      });

      layerRef.current = true;
      sourceRef.current = true;
    }

    return () => {
      if (mapInstance && layerRef.current) {
        removeIrrigationDistrictLayers();
      }
    };
  }, [map]);

  useEffect(() => {
    if (!map || !map.current) return;

    const mapInstance = map.current;

    // If not visible, remove the layers entirely
    if (!visible) {
      const removeIrrigationDistrictLayers = () => {
        if (!mapInstance) return;
        
        try {
          if (mapInstance.getLayer('irrigation-districts-fill')) {
            mapInstance.removeLayer('irrigation-districts-fill');
          }
          if (mapInstance.getLayer('irrigation-districts-line')) {
            mapInstance.removeLayer('irrigation-districts-line');
          }
          if (mapInstance.getLayer('irrigation-districts-labels')) {
            mapInstance.removeLayer('irrigation-districts-labels');
          }
          if (mapInstance.getSource('irrigation-districts')) {
            mapInstance.removeSource('irrigation-districts');
          }
        } catch (error) {
          console.warn('Error removing irrigation district layers:', error);
        }
      };
      
      removeIrrigationDistrictLayers();
      return;
    }

    // If visible, ensure layers are added first
    
    // Check if layers already exist
    const layersExist = mapInstance.getLayer('irrigation-districts-fill') && 
                       mapInstance.getLayer('irrigation-districts-line') && 
                       mapInstance.getLayer('irrigation-districts-labels');
    
    if (!layersExist) {
      // Add the layers if they don't exist
      addIrrigationDistrictLayersToMap();
    } else {
      // Toggle layer visibility
      const toggleVisibility = () => {
        if (!mapInstance.isStyleLoaded()) return;

        try {
          if (mapInstance.getLayer('irrigation-districts-fill')) {
            mapInstance.setLayoutProperty(
              'irrigation-districts-fill',
              'visibility',
              visible ? 'visible' : 'none'
            );
          }
          if (mapInstance.getLayer('irrigation-districts-line')) {
            mapInstance.setLayoutProperty(
              'irrigation-districts-line',
              'visibility',
              visible ? 'visible' : 'none'
            );
          }
          if (mapInstance.getLayer('irrigation-districts-labels')) {
            mapInstance.setLayoutProperty(
              'irrigation-districts-labels',
              'visibility',
              visible ? 'visible' : 'none'
            );
          }
        } catch (error) {
          console.warn('Error toggling irrigation district layer visibility:', error);
        }
      };
      
      toggleVisibility();
    }

    function addIrrigationDistrictLayersToMap() {
      if (!mapInstance) return;

      // Remove existing layers if they exist
      if (mapInstance.getLayer('irrigation-districts-fill')) {
        mapInstance.removeLayer('irrigation-districts-fill');
      }
      if (mapInstance.getLayer('irrigation-districts-line')) {
        mapInstance.removeLayer('irrigation-districts-line');
      }
      if (mapInstance.getLayer('irrigation-districts-labels')) {
        mapInstance.removeLayer('irrigation-districts-labels');
      }

      // Add the GeoJSON source only if it doesn't exist
      if (!mapInstance.getSource('irrigation-districts')) {
        mapInstance.addSource('irrigation-districts', {
          type: 'geojson',
          data: '/ARZ/Irrigation_District_2024.geojson'
        });
      } else {
      }

      // Check if source is already loaded
      const source = mapInstance.getSource('irrigation-districts');
      if (source && source._loaded) {
        addLayersAfterSourceLoad();
      } else {
        // Wait for the source to load before adding layers
        mapInstance.once('sourcedata', (e) => {
          if (e.sourceId === 'irrigation-districts' && e.isSourceLoaded) {
            addLayersAfterSourceLoad();
          }
        });

        // Handle source loading errors
        mapInstance.once('sourcedata', (e) => {
          if (e.sourceId === 'irrigation-districts' && e.tile) {
            console.error('🌊 IrrigationDistrictLayer: Error loading source data:', e);
          }
        });

        // Fallback: try to add layers after a short delay if source doesn't load
        setTimeout(() => {
          if (mapInstance.getSource('irrigation-districts') && !layerRef.current) {
            addLayersAfterSourceLoad();
          }
        }, 2000);
      }

      function addLayersAfterSourceLoad() {
        if (!mapInstance) return;

        // Add fill layer
        mapInstance.addLayer({
          id: 'irrigation-districts-fill',
          type: 'fill',
          source: 'irrigation-districts',
          paint: {
            'fill-color': '#0099FF', // Bright blue
            'fill-opacity': 0.07 // 7% opacity - very subtle
          }
        });

        // Add line layer for borders
        mapInstance.addLayer({
          id: 'irrigation-districts-line',
          type: 'line',
          source: 'irrigation-districts',
          paint: {
            'line-color': '#0099FF', // Same bright blue
            'line-width': 0.06, // Extremely thin outline
            'line-opacity': 0.5 // 50% opacity
          }
        });

        // Add labels layer with safer text field handling
        mapInstance.addLayer({
          id: 'irrigation-districts-labels',
          type: 'symbol',
          source: 'irrigation-districts',
          layout: {
            'text-field': [
              'case',
              ['!=', ['get', 'MAP_LABEL'], ''],
              ['get', 'MAP_LABEL'],
              ''
            ],
            'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
            'text-size': 12,
            'text-transform': 'uppercase',
            'text-offset': [0, 1.5],
            'text-anchor': 'top'
          },
          paint: {
            'text-color': '#1E3A8A',
            'text-halo-color': '#FFFFFF',
            'text-halo-width': 0
          },
          filter: ['!=', ['get', 'MAP_LABEL'], ''] // Only show labels that aren't empty
        });

        layerRef.current = true;
        sourceRef.current = true;
      }
    }

    // Wait for style to load if needed
    if (!mapInstance.isStyleLoaded()) {
      const onStyleLoad = () => {
        // Re-run the visibility logic after style loads
        if (!visible) {
          const removeIrrigationDistrictLayers = () => {
            if (!mapInstance) return;
            
            try {
              if (mapInstance.getLayer('irrigation-districts-fill')) {
                mapInstance.removeLayer('irrigation-districts-fill');
              }
              if (mapInstance.getLayer('irrigation-districts-line')) {
                mapInstance.removeLayer('irrigation-districts-line');
              }
              if (mapInstance.getLayer('irrigation-districts-labels')) {
                mapInstance.removeLayer('irrigation-districts-labels');
              }
              if (mapInstance.getSource('irrigation-districts')) {
                mapInstance.removeSource('irrigation-districts');
              }
            } catch (error) {
              console.warn('Error removing irrigation district layers:', error);
            }
          };
          
          removeIrrigationDistrictLayers();
        } else {
          // Add layers if visible
          addIrrigationDistrictLayersToMap();
        }
      };
      
      mapInstance.once('styledata', onStyleLoad);
      return () => {
        mapInstance.off('styledata', onStyleLoad);
      };
    }
  }, [map, visible]);

  return null;
};

export default IrrigationDistrictLayer;
