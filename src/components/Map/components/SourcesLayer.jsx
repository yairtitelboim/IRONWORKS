import React, { useEffect } from 'react';
import * as turf from '@turf/turf';
import { getLayerManager } from '../utils/layerManager';

const SOURCES_SOURCE_ID = 'sources-layer-source';
const SOURCES_LAYER_ID = 'sources-layer';
const SOURCES_CIRCLE_LAYER_ID = 'sources-circle-layer';
const SOURCES_LABEL_LAYER_ID = 'sources-label-layer';
const SOURCES_PULSE_LAYER_ID = 'sources-pulse-layer';

const cityCoords = [
  { name: 'Pecos', coords: [-103.4937, 31.4229] },
  { name: 'Monahans', coords: [-102.8924, 31.5946] },
  { name: 'Kermit', coords: [-103.0921, 31.8574] },
  { name: 'Odessa', coords: [-102.3676, 31.8457] },
];

const markerColor = '#00B8D4';
const circleColor = '#FFA500';

const SourcesLayer = ({ map, visible }) => {
  useEffect(() => {
    if (!map?.current) return;
    
    const mapInstance = map.current;
    const layerManager = getLayerManager(mapInstance);
    let animationId;
    let start;
    
    if (!visible) {
      // Safely remove all layers and sources using LayerManager
      const layersToRemove = [
        SOURCES_LAYER_ID,
        SOURCES_CIRCLE_LAYER_ID,
        SOURCES_LABEL_LAYER_ID,
        SOURCES_PULSE_LAYER_ID,
        'sources-circle-fill-layer'
      ];
      
      const sourcesToRemove = [
        SOURCES_SOURCE_ID
      ];
      
      layerManager.removeLayersAndSources(layersToRemove, sourcesToRemove);
      return;
    }
    
    // Remove any existing layers/sources safely
    const layersToRemove = [
      SOURCES_LAYER_ID,
      SOURCES_CIRCLE_LAYER_ID,
      SOURCES_LABEL_LAYER_ID,
      SOURCES_PULSE_LAYER_ID,
      'sources-circle-fill-layer'
    ];
    
    const sourcesToRemove = [
      SOURCES_SOURCE_ID
    ];
    
    layerManager.removeLayersAndSources(layersToRemove, sourcesToRemove);

    // Wait for cleanup before adding new layers
    setTimeout(() => {
      // Create GeoJSON for points
      const pointsGeojson = {
        type: 'FeatureCollection',
        features: cityCoords.map(city => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: city.coords },
          properties: { name: city.name }
        }))
      };

      // Create GeoJSON for 10-mile radius circles
      const circleFeatures = cityCoords.map(city => {
        const circle = turf.circle(city.coords, 10, { steps: 64, units: 'miles' });
        circle.properties = { name: city.name };
        return circle;
      });
      const circlesGeojson = { type: 'FeatureCollection', features: circleFeatures };

      // Add source safely
      if (layerManager.addSource(SOURCES_SOURCE_ID, { type: 'geojson', data: pointsGeojson })) {
        
        // Add point markers layer
        layerManager.addLayer({
          id: SOURCES_LAYER_ID,
          type: 'circle',
          source: SOURCES_SOURCE_ID,
          paint: {
            'circle-radius': 8,
            'circle-color': markerColor,
            'circle-opacity': 0.9
          }
        });

        // Add labels layer
        layerManager.addLayer({
          id: SOURCES_LABEL_LAYER_ID,
          type: 'symbol',
          source: SOURCES_SOURCE_ID,
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
            'text-offset': [0, 2],
            'text-anchor': 'top',
            'text-size': 12
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 1
          }
        });
      }

      // Add circles source and layer separately
      if (layerManager.addSource('sources-circles-source', { type: 'geojson', data: circlesGeojson })) {
        // Add fill layer for light yellow background
        layerManager.addLayer({
          id: 'sources-circle-fill-layer',
          type: 'fill',
          source: 'sources-circles-source',
          paint: {
            'fill-color': '#FFEB3B',
            'fill-opacity': 0.05
          }
        });
        
        // Add line layer for dashed border
        layerManager.addLayer({
          id: SOURCES_CIRCLE_LAYER_ID,
          type: 'line',
          source: 'sources-circles-source',
          paint: {
            'line-color': circleColor,
            'line-width': 2,
            'line-opacity': 0.7,
            'line-dasharray': [3, 3]
          }
        });

        // Add pulse layer
        layerManager.addLayer({
          id: SOURCES_PULSE_LAYER_ID,
          type: 'circle',
          source: SOURCES_SOURCE_ID,
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8, 20,
              12, 40
            ],
            'circle-color': markerColor,
            'circle-opacity': 0
          }
        });
      }

      // Animation function
      function animate(timestamp) {
        if (!start) start = timestamp;
        const progress = timestamp - start;
        
        // Calculate pulsing opacity for pulse layer
        const pulseOpacity = Math.abs(Math.sin(progress * 0.002)) * 0.3;
        
        // Calculate pulsing opacity for yellow dashed circle (2 second cycle)
        const circlePulseOpacity = 0.3 + (Math.abs(Math.sin(progress * 0.003)) * 0.4);
        
        // Calculate rotation offset for dashed circle (simple rotation)
        const rotationOffset = (progress * 0.001) % 6; // 6 is the total dash array length
        
        try {
          if (layerManager.layerExists(SOURCES_PULSE_LAYER_ID)) {
            mapInstance.setPaintProperty(SOURCES_PULSE_LAYER_ID, 'circle-opacity', pulseOpacity);
          }
          
          if (layerManager.layerExists(SOURCES_CIRCLE_LAYER_ID)) {
            mapInstance.setPaintProperty(SOURCES_CIRCLE_LAYER_ID, 'line-opacity', circlePulseOpacity);
            // Ensure dash array values are always positive
            const dash1 = Math.max(0.5, 3 - rotationOffset);
            const dash2 = Math.max(0.5, 3 + rotationOffset);
            mapInstance.setPaintProperty(SOURCES_CIRCLE_LAYER_ID, 'line-dasharray', [dash1, dash2]);
          }
        } catch (error) {
          console.warn('Animation error:', error);
        }
        
        animationId = requestAnimationFrame(animate);
      }

      // Start animation
      animationId = requestAnimationFrame(animate);

      // Move layers to top
      setTimeout(() => {
        layerManager.moveLayer('sources-circle-fill-layer');
        layerManager.moveLayer(SOURCES_CIRCLE_LAYER_ID);
        layerManager.moveLayer(SOURCES_LAYER_ID);
        layerManager.moveLayer(SOURCES_LABEL_LAYER_ID);
        layerManager.moveLayer(SOURCES_PULSE_LAYER_ID);
      }, 100);

    }, 100); // Wait for cleanup

    return () => {
      // Cleanup animation
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      
      // Cleanup layers and sources
      const cleanupLayers = [
        SOURCES_LAYER_ID,
        SOURCES_CIRCLE_LAYER_ID,
        SOURCES_LABEL_LAYER_ID,
        SOURCES_PULSE_LAYER_ID,
        'sources-circle-fill-layer'
      ];
      
      const cleanupSources = [
        SOURCES_SOURCE_ID,
        'sources-circles-source'
      ];
      
      layerManager.removeLayersAndSources(cleanupLayers, cleanupSources);
    };
  }, [map, visible]);

  return null;
};

export default SourcesLayer; 