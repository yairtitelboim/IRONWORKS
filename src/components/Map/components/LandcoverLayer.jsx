import React, { useEffect, useRef, useCallback, useState } from 'react';
import * as turf from '@turf/turf';

const LandcoverLayer = ({ map, visible }) => {
  const hasZoomedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);


  // Function to load GeoJSON in chunks
  const loadGeoJSONInChunks = useCallback(async () => {
    setIsLoading(true);
    console.log('LandcoverLayer: starting chunked GeoJSON loading...');
    
    try {
      // First, get the file size to determine chunk strategy
      const headResponse = await fetch('/bosque_landcover_2020.geojson', { method: 'HEAD' });
      const fileSize = parseInt(headResponse.headers.get('content-length') || '0');
      console.log('LandcoverLayer: GeoJSON file size:', fileSize, 'bytes');
      
      // For large files, we'll use a streaming approach
      const response = await fetch('/bosque_landcover_2020.geojson');
      const reader = response.body?.getReader();
      
      if (!reader) {
        throw new Error('Streaming not supported');
      }
      
      let chunks = [];
      let totalBytes = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        totalBytes += value.length;
        console.log(`LandcoverLayer: loaded chunk, total: ${totalBytes} bytes`);
      }
      
      // Combine chunks into a single Uint8Array
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      
      // Convert to text and parse as JSON
      const text = new TextDecoder().decode(combined);
      const geoJSON = JSON.parse(text);
      
      console.log('LandcoverLayer: successfully loaded GeoJSON with', geoJSON.features?.length || 0, 'features');
      setIsLoading(false);
      return geoJSON;
      
    } catch (error) {
      console.error('LandcoverLayer: error loading GeoJSON in chunks:', error);
      setIsLoading(false);
      
      // Fallback: try traditional fetch
      try {
        console.log('LandcoverLayer: trying traditional fetch as fallback...');
        const response = await fetch('/bosque_landcover_2020.geojson');
        const geoJSON = await response.json();
        console.log('LandcoverLayer: fallback fetch successful with', geoJSON.features?.length || 0, 'features');
        return geoJSON;
      } catch (fallbackError) {
        console.error('LandcoverLayer: fallback fetch also failed:', fallbackError);
        return null;
      }
    }
  }, []);

  // Color scheme for different land cover classes
  const landCoverColors = {
    0: '#8B4513', // Saddle Brown - Bare soil/rock
    1: '#228B22', // Forest Green - Forest/woodland
    2: '#32CD32', // Lime Green - Grassland/pasture
    3: '#FFD700', // Gold - Cropland
    4: '#87CEEB', // Sky Blue - Water/wetland
    5: '#D2B48C', // Tan - Shrubland
    6: '#F5F5DC', // Beige - Urban/built-up
    7: '#FF6347', // Tomato - Other/unknown
    8: '#808080'  // Gray - Additional class
  };

    // Function to zoom to landcover data bounds
  const zoomToLandcoverBounds = useCallback(async () => {
    if (!map?.current) return;
    
    const mapInstance = map.current;
    const source = mapInstance.getSource('landcover-source');
    
    if (source && source._data) {
      try {
        const data = source._data;
        console.log('LandcoverLayer: zooming with loaded data, features:', data.features?.length || 0);
        
        if (!data.features || data.features.length === 0) {
          console.log('LandcoverLayer: no features in loaded data');
          return;
        }
        
        // Get the bounds of the landcover data
        const bounds = turf.bbox(data);
        console.log('LandcoverLayer: zooming to bounds:', bounds);
        
        // Fit the map to the landcover data bounds with some padding
        mapInstance.fitBounds(bounds, {
          padding: 50,
          duration: 1000,
          maxZoom: 16 // Limit max zoom to prevent over-zooming
        });
        
        hasZoomedRef.current = true;
        console.log('LandcoverLayer: zoom completed successfully');
        
      } catch (error) {
        console.error('Error zooming to landcover bounds:', error);
        console.error('Error details:', error.message, error.stack);
      }
    } else {
      console.log('LandcoverLayer: source not ready for zooming');
    }
  }, [map]);

  useEffect(() => {
    if (!map?.current) return;
    
    // If not visible, remove layers and sources
    if (!visible) {
      try {
        if (map.current.getLayer('landcover-layer')) {
          map.current.removeLayer('landcover-layer');
        }
        if (map.current.getSource('landcover-source')) {
          map.current.removeSource('landcover-source');
        }
        // Reset zoom flag when hidden
        hasZoomedRef.current = false;
      } catch (error) {
        console.error('Error removing landcover layers:', error);
      }
      return;
    }

    const mapInstance = map.current;

    // Wait for map to be ready - check multiple indicators
    console.log('LandcoverLayer: checking if map is ready...');
    
    const checkMapReady = () => {
      // Check if style is loaded
      const styleLoaded = mapInstance.isStyleLoaded();
      // Check if there are existing layers (indicates map is ready)
      const existingLayers = mapInstance.getStyle()?.layers || [];
      const hasLayers = existingLayers.length > 0;
      
      console.log('LandcoverLayer: map readiness check:', {
        styleLoaded,
        hasLayers,
        layerCount: existingLayers.length,
        firstLayer: existingLayers[0]?.id
      });
      
      if (styleLoaded || hasLayers) {
        console.log('LandcoverLayer: map is ready, proceeding with layer addition');
        addLandcoverLayer().catch(error => {
          console.error('LandcoverLayer: error in addLandcoverLayer:', error);
        });
        return true;
      }
      
      return false;
    };
    
    // Try immediate check first
    if (checkMapReady()) {
      return;
    }
    
    // If not ready, wait for either style.load or a short delay
    console.log('LandcoverLayer: map not ready, setting up event listeners');
    
    const onStyleLoad = () => {
      console.log('LandcoverLayer: style.load event fired');
      if (checkMapReady()) {
        mapInstance.off('style.load', onStyleLoad);
        mapInstance.off('load', onLoad);
      }
    };
    
    const onLoad = () => {
      console.log('LandcoverLayer: load event fired');
      if (checkMapReady()) {
        mapInstance.off('style.load', onStyleLoad);
        mapInstance.off('load', onLoad);
      }
    };
    
    // Listen for both events
    mapInstance.on('style.load', onStyleLoad);
    mapInstance.on('load', onLoad);
    
    // Also try after a short delay as fallback
    const timeoutId = setTimeout(() => {
      console.log('LandcoverLayer: timeout fallback, checking map readiness');
      if (checkMapReady()) {
        mapInstance.off('style.load', onStyleLoad);
        mapInstance.off('load', onLoad);
      }
    }, 1000);
    
    return () => {
      mapInstance.off('style.load', onStyleLoad);
      mapInstance.off('load', onLoad);
      clearTimeout(timeoutId);
    };



    async function addLandcoverLayer() {
      console.log('LandcoverLayer: addLandcoverLayer called, visible:', visible);
      try {
        // Remove existing layer and source if they exist
        if (mapInstance.getLayer('landcover-layer')) {
          console.log('LandcoverLayer: removing existing layer');
          mapInstance.removeLayer('landcover-layer');
        }
        if (mapInstance.getSource('landcover-source')) {
          console.log('LandcoverLayer: removing existing source');
          mapInstance.removeSource('landcover-source');
        }

        // Load GeoJSON data in chunks first
        console.log('LandcoverLayer: loading GeoJSON data in chunks...');
        const geoJSONData = await loadGeoJSONInChunks();
        
        if (!geoJSONData) {
          console.error('LandcoverLayer: failed to load GeoJSON data');
          return;
        }
        
        // Convert polygon features to point features (centroids) for circle rendering
        console.log('LandcoverLayer: converting polygons to points for circle rendering...');
        const pointFeatures = geoJSONData.features.map(feature => {
          if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
            // Calculate centroid of the polygon
            const centroid = turf.centroid(feature);
            return {
              ...feature,
              geometry: {
                type: 'Point',
                coordinates: centroid.geometry.coordinates
              }
            };
          }
          return feature; // Keep point features as-is
        });
        
        const pointGeoJSON = {
          ...geoJSONData,
          features: pointFeatures
        };
        
        console.log(`LandcoverLayer: converted ${pointFeatures.length} features to points`);
        
        // Add the landcover source with the converted point data
        console.log('LandcoverLayer: adding source with converted point data');
        mapInstance.addSource('landcover-source', {
          type: 'geojson',
          data: pointGeoJSON, // Use the converted point data
          maxzoom: 18,
          buffer: 128,
          tolerance: 0.5
        });

        // Since we're loading the data directly, we can trigger zoom immediately after layers are added
        console.log('LandcoverLayer: layers added, triggering zoom after short delay');
        setTimeout(() => {
          zoomToLandcoverBounds();
        }, 500);

        // Add the landcover layer as circles instead of fill
        console.log('LandcoverLayer: adding circle layer with visibility: visible');
        mapInstance.addLayer({
          id: 'landcover-layer',
          type: 'circle',
          source: 'landcover-source',
          layout: {
            visibility: 'visible'
          },
          paint: {
            'circle-color': [
              'case',
              ['==', ['get', 'land_cover_class'], 0], landCoverColors[0],
              ['==', ['get', 'land_cover_class'], 1], landCoverColors[1],
              ['==', ['get', 'land_cover_class'], 2], landCoverColors[2],
              ['==', ['get', 'land_cover_class'], 3], landCoverColors[3],
              ['==', ['get', 'land_cover_class'], 4], landCoverColors[4],
              ['==', ['get', 'land_cover_class'], 5], landCoverColors[5],
              ['==', ['get', 'land_cover_class'], 6], landCoverColors[6],
              ['==', ['get', 'land_cover_class'], 7], landCoverColors[7],
              ['==', ['get', 'land_cover_class'], 8], landCoverColors[8],
              '#FF0000' // Bright red for unknown classes - should be very visible
            ],
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8, 2,   // Very small circles when zoomed out
              12, 8,  // Medium circles at city level
              16, 20, // Larger circles when zoomed in
              20, 40  // Large circles at high zoom
            ],
            'circle-opacity': 0.7, // Slightly transparent for better visibility
            'circle-stroke-width': 1,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-opacity': 0.5
          }
        });

        // No outline layer needed for circles



        console.log('LandcoverLayer: successfully added source and layers');
        
        // Debug: list all layers in the map
        const allLayers = mapInstance.getStyle().layers;
        console.log('LandcoverLayer: all map layers:', allLayers.map(l => l.id));

        // Move landcover layers above base layers but below other features
        console.log('LandcoverLayer: adjusting layer order for visibility');
        const layers = mapInstance.getStyle().layers;
        
        // Find a good position to insert the landcover layers
        // We want them above water/land but below buildings and other features
        const targetLayer = layers.find(layer => 
          layer.id === 'building' || layer.id === 'mapbox-buildings'
        );
        
        if (targetLayer) {
          console.log('LandcoverLayer: moving layer above', targetLayer.id);
          mapInstance.moveLayer('landcover-layer', targetLayer.id);
        } else {
          // Fallback: move above water layer
          const waterLayer = layers.find(layer => layer.id === 'water');
          if (waterLayer) {
            console.log('LandcoverLayer: moving layer above water layer');
            mapInstance.moveLayer('landcover-layer', waterLayer.id);
          }
        }

        console.log('LandcoverLayer: layer setup complete');

        // Debug: check if layers are actually visible
        setTimeout(() => {
          const fillLayer = mapInstance.getLayer('landcover-layer');
          const outlineLayer = mapInstance.getLayer('landcover-outline');
          const source = mapInstance.getSource('landcover-source');
          
          console.log('LandcoverLayer: layer visibility check:', {
            fillLayerExists: !!fillLayer,
            outlineLayerExists: !!outlineLayer,
            sourceExists: !!source,
            fillLayerVisibility: fillLayer?.layout?.visibility,
            outlineLayerVisibility: outlineLayer?.layout?.visibility,
            sourceData: source?._data ? `${source._data.features?.length || 0} features` : 'no data'
          });
          
          // Test query rendered features to see if anything is visible
          try {
            const renderedFeatures = mapInstance.queryRenderedFeatures({ layers: ['landcover-layer'] });
            console.log('LandcoverLayer: rendered features count:', renderedFeatures.length);
            if (renderedFeatures.length > 0) {
              console.log('LandcoverLayer: first rendered feature:', {
                id: renderedFeatures[0].id,
                properties: renderedFeatures[0].properties,
                geometry: renderedFeatures[0].geometry.type
              });
            }
          } catch (error) {
            console.log('LandcoverLayer: error querying rendered features:', error.message);
          }
        }, 1000);

        // Since we're loading the data directly, we can trigger zoom immediately after layers are added
        console.log('LandcoverLayer: layers added, triggering zoom after short delay');
        setTimeout(() => {
          zoomToLandcoverBounds();
        }, 500);

      } catch (error) {
        console.error('Error adding landcover layer:', error);
        console.error('Error details:', error.message, error.stack);
      }
    }

    return () => {
      // Cleanup function
      try {
        if (mapInstance.getLayer('landcover-layer')) {
          mapInstance.removeLayer('landcover-layer');
        }
        if (mapInstance.getSource('landcover-source')) {
          mapInstance.removeSource('landcover-source');
        }
        // Reset zoom flag when component unmounts
        hasZoomedRef.current = false;
      } catch (error) {
        console.error('Error cleaning up landcover layer:', error);
      }
    };
  }, [map, visible]);



  // Show loading indicator when processing large file
  if (isLoading) {
    return (
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '20px',
        borderRadius: '8px',
        zIndex: 1000,
        fontSize: '14px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '10px' }}>🔄</div>
          <div>Loading Land Cover Data...</div>
          <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '5px' }}>
            Processing large dataset (14MB)
          </div>
        </div>
      </div>
    );
  }

  return null; // This component doesn't render anything visible
};

export default LandcoverLayer;
