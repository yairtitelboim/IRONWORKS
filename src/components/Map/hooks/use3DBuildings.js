import { useState } from 'react';

export const use3DBuildings = (map) => {
  const [show3DBuildings, setShow3DBuildings] = useState(false);
  const [is3DLoading, setIs3DLoading] = useState(false);

  const setup3DBuildings = async () => {
    try {
      console.log('\n=== Setting up 3D Buildings Layer ===');
      
      // Add OSM buildings source if it doesn't exist
      if (!map.current.getSource('osm-buildings')) {
        console.log('Adding OSM buildings source...');
        try {
          const response = await fetch('/data/osm/la_buildings_3d_10k.geojson');
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          console.log(`Loaded ${data.features.length} building features`);
          
          map.current.addSource('osm-buildings', {
            type: 'geojson',
            data: data
          });
          console.log('OSM buildings source added successfully');
        } catch (error) {
          console.error('Error loading OSM buildings data:', error);
          throw error;
        }
      }

      // Get all zoning layer IDs to ensure 3D buildings are added after them
      const zoningLayerIds = [
        'zoning-fill',
        'zoning-outline',
        'zoning-hover',
        'zoning-inner-glow',
        'zoning-hover-glow'
      ];

      // Find the last zoning layer that exists
      const layers = map.current.getStyle().layers;
      let lastZoningLayer = null;
      for (let i = layers.length - 1; i >= 0; i--) {
        if (zoningLayerIds.includes(layers[i].id)) {
          lastZoningLayer = layers[i].id;
          break;
        }
      }

      // Add OSM buildings layer if it doesn't exist
      if (!map.current.getLayer('osm-buildings-3d') && map.current.getSource('osm-buildings')) {
        console.log('Adding OSM buildings layer...');
        const osmBuildingsLayer = {
          'id': 'osm-buildings-3d',
          'source': 'osm-buildings',
          'type': 'fill-extrusion',
          'paint': {
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['get', 'height'],
              0, '#4a4a4a',
              50, '#666666',
              100, '#808080'
            ],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.9,
            'fill-extrusion-vertical-gradient': true,
            'fill-extrusion-ambient-occlusion-intensity': 0.3,
            'fill-extrusion-ambient-occlusion-radius': 3
          },
          'layout': {
            'visibility': 'none'
          }
        };

        if (lastZoningLayer) {
          console.log(`Adding OSM buildings layer after ${lastZoningLayer}`);
          map.current.addLayer(osmBuildingsLayer, lastZoningLayer);
        } else {
          console.log('Adding OSM buildings layer at the end');
          map.current.addLayer(osmBuildingsLayer);
        }
        console.log('OSM buildings layer added successfully');
      }

      // Add Mapbox buildings layer if it doesn't exist
      if (!map.current.getLayer('buildings-3d-layer')) {
        console.log('Adding Mapbox buildings layer...');
        const style = map.current.getStyle();
        if (!style.sources.composite) {
          console.error('Composite source not available - check Mapbox token and style');
        } else {
          const mapboxBuildingsLayer = {
            'id': 'buildings-3d-layer',
            'source': 'composite',
            'source-layer': 'building',
            'type': 'fill-extrusion',
            'minzoom': 15,
            'paint': {
              'fill-extrusion-color': '#333333',
              'fill-extrusion-height': [
                'interpolate',
                ['linear'],
                ['zoom'],
                15, 0,
                15.05, ['get', 'height']
              ],
              'fill-extrusion-base': [
                'interpolate',
                ['linear'],
                ['zoom'],
                15, 0,
                15.05, ['get', 'min_height']
              ],
              'fill-extrusion-opacity': 1.0,
              'fill-extrusion-vertical-gradient': true,
              'fill-extrusion-ambient-occlusion-intensity': 0.3,
              'fill-extrusion-ambient-occlusion-radius': 3
            },
            'layout': {
              'visibility': 'none'
            }
          };

          if (lastZoningLayer) {
            console.log(`Adding Mapbox buildings layer after ${lastZoningLayer}`);
            map.current.addLayer(mapboxBuildingsLayer, lastZoningLayer);
          } else {
            console.log('Adding Mapbox buildings layer at the end');
            map.current.addLayer(mapboxBuildingsLayer);
          }
          console.log('Mapbox buildings layer added successfully');
        }
      }

      // Add an effect to ensure buildings stay on top when zoning layers are moved
      const styleDataHandler = () => {
        if (map.current.getLayer('osm-buildings-3d')) {
          map.current.moveLayer('osm-buildings-3d');
        }
        if (map.current.getLayer('buildings-3d-layer')) {
          map.current.moveLayer('buildings-3d-layer');
        }
      };
      
      map.current.off('styledata', styleDataHandler);
      map.current.on('styledata', styleDataHandler);

      console.log('=== 3D Buildings Setup Complete ===\n');
    } catch (error) {
      console.error('Error setting up 3D buildings:', error);
      throw error;
    }
  };

  const toggle3D = async () => {
    if (!map.current) {
      console.log('Map not initialized yet');
      return;
    }
    
    try {
      console.log('\n=== Starting 3D Buildings Toggle ===');
      setIs3DLoading(true);
      
      // Add timeout for style loading
      const styleLoadPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Style load timeout after 5 seconds'));
        }, 5000);

        if (map.current.isStyleLoaded()) {
          clearTimeout(timeout);
          resolve();
        } else {
          console.log('Waiting for map style to load...');
          map.current.once('style.load', () => {
            clearTimeout(timeout);
            console.log('Map style loaded successfully');
            resolve();
          });
        }
      });

      try {
        await styleLoadPromise;
      } catch (error) {
        console.warn('Style load timeout or error:', error);
      }

      // Check if layers exist
      const hasOsmBuildings = map.current.getLayer('osm-buildings-3d');
      const hasMapboxBuildings = map.current.getLayer('buildings-3d-layer');
      
      console.log('Layer status:', {
        hasOsmBuildings,
        hasMapboxBuildings,
        styleLoaded: map.current.isStyleLoaded(),
        currentStyle: map.current.getStyle().name
      });

      // If layers don't exist, initialize them
      if (!hasOsmBuildings && !hasMapboxBuildings) {
        console.log('Initializing 3D buildings layers...');
        try {
          await setup3DBuildings();
          console.log('3D buildings layers initialized successfully');
        } catch (error) {
          console.error('Failed to initialize 3D buildings:', error);
          throw error;
        }
      }

      const newState = !show3DBuildings;
      console.log(`Setting 3D buildings visibility to: ${newState ? 'visible' : 'none'}`);
      
      // Update visibility for OSM buildings layer
      if (map.current.getLayer('osm-buildings-3d')) {
        map.current.setLayoutProperty(
          'osm-buildings-3d',
          'visibility',
          newState ? 'visible' : 'none'
        );
        console.log('Updated OSM buildings visibility');
      } else {
        console.warn('OSM buildings layer not found');
      }
      
      // Update visibility for Mapbox buildings layer
      if (map.current.getLayer('buildings-3d-layer')) {
        map.current.setLayoutProperty(
          'buildings-3d-layer',
          'visibility',
          newState ? 'visible' : 'none'
        );
        console.log('Updated Mapbox buildings visibility');
      } else {
        console.warn('Mapbox buildings layer not found');
      }

      // Remove automatic camera pitch adjustment
      // Keep the camera position as is
      
      setShow3DBuildings(newState);
      console.log('3D buildings toggle complete');
      console.log('=== 3D Buildings Toggle Complete ===\n');
    } catch (error) {
      console.error('Error toggling 3D buildings:', error);
      setShow3DBuildings(false);
    } finally {
      setIs3DLoading(false);
    }
  };

  const reset3DBuildings = async () => {
    console.log('\n=== Resetting 3D Buildings ===');
    try {
      // Remove existing layers
      if (map.current.getLayer('osm-buildings-3d')) {
        map.current.removeLayer('osm-buildings-3d');
        console.log('Removed OSM buildings layer');
      }
      if (map.current.getLayer('buildings-3d-layer')) {
        map.current.removeLayer('buildings-3d-layer');
        console.log('Removed Mapbox buildings layer');
      }
      
      // Remove source
      if (map.current.getSource('osm-buildings')) {
        map.current.removeSource('osm-buildings');
        console.log('Removed OSM buildings source');
      }

      // Reset states
      setShow3DBuildings(false);
      setIs3DLoading(false);
      
      // Remove automatic camera reset
      // Keep the camera position as is
      
      console.log('3D buildings reset complete');
    } catch (error) {
      console.error('Error resetting 3D buildings:', error);
    }
  };

  return {
    show3DBuildings,
    is3DLoading,
    toggle3D,
    reset3DBuildings
  };
}; 