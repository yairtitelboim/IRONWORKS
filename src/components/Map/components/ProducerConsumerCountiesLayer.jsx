import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

const SOURCE_ID = 'producer-consumer-counties-source';
const FILL_LAYER_ID = 'producer-consumer-counties-fill';
const STROKE_LAYER_ID = 'producer-consumer-counties-stroke';
const GEOJSON_URL = '/data/ercot/ercot_counties_with_dc.geojson';

const ProducerConsumerCountiesLayer = ({ map, visible }) => {
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const sourceLoadedRef = useRef(false);
  const layersAddedRef = useRef(false);
  const geojsonDataRef = useRef(null);
  const hoveredCountyIdRef = useRef(null);
  const handlersAttachedRef = useRef(false);
  const hoverTimeoutRef = useRef(null);

  useEffect(() => {
    if (!map?.current) return;

    const mapInstance = map.current;

    const loadLayer = async () => {
      try {
        // Check if source already exists
        if (mapInstance.getSource(SOURCE_ID)) {
          sourceLoadedRef.current = true;
          // If source exists but layers don't, add them
          if (!layersAddedRef.current) {
            addLayers();
          }
          return;
        }

        // Wait for map to be ready
        if (!mapInstance.isStyleLoaded()) {
          mapInstance.once('styledata', loadLayer);
          return;
        }

        // Don't fetch the 15 MB GeoJSON until the layer is actually visible.
        // This prevents competing with ERCOTCountiesLayer on mobile fresh load.
        if (!visibleRef.current) return;

        // Fetch and load GeoJSON
        fetch(GEOJSON_URL)
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
          })
          .then(geojsonData => {
            if (!geojsonData.features || geojsonData.features.length === 0) {
              return;
            }
            
            // Ensure all features have IDs
            geojsonData.features.forEach((feature, index) => {
              if (!feature.id && feature.id !== 0) {
                const countyName = feature.properties?.NAME || feature.properties?.name;
                const geoid = feature.properties?.GEOID || feature.properties?.geoid;
                
                if (geoid) {
                  feature.id = geoid;
                } else if (countyName) {
                  feature.id = `county-${countyName.toLowerCase().replace(/\s+/g, '-')}`;
                } else {
                  feature.id = `county-${index}`;
                }
              }
            });
            
            geojsonDataRef.current = geojsonData;
            
            // Re-check: source may have been added by a concurrent/duplicate load (e.g. React Strict Mode)
            if (mapInstance.getSource(SOURCE_ID)) {
              sourceLoadedRef.current = true;
              const src = mapInstance.getSource(SOURCE_ID);
              if (src && src.setData) src.setData(geojsonData);
              if (!layersAddedRef.current) addLayers();
              return;
            }
            
            mapInstance.addSource(SOURCE_ID, {
              type: 'geojson',
              data: geojsonData,
              generateId: true
            });

            sourceLoadedRef.current = true;
            addLayers();
            
            // Visibility will be set by the useEffect visibility handler
          })
          .catch(error => {
            console.error('❌ [ProducerConsumer] Error loading counties:', error);
          });

      } catch (error) {
        console.error('Error in loadLayer:', error);
      }
    };

    const getCountyColor = (energyGW, dcCount) => {
      // Pure producer: high energy, no/low DCs
      if (dcCount === 0 && energyGW > 1) {
        const intensity = Math.min(energyGW / 10, 1); // Cap at 10 GW
        const opacity = 0.4 + intensity * 0.6; // 0.4 to 1.0
        return `rgba(34, 139, 34, ${opacity})`; // Forest green
      }
      
      // Pure consumer: low energy, high DCs
      if (energyGW < 0.5 && dcCount > 0) {
        const intensity = Math.min(dcCount / 13, 1); // Cap at Dallas (13 DCs)
        const opacity = 0.4 + intensity * 0.6; // 0.4 to 1.0
        return `rgba(220, 20, 60, ${opacity})`; // Crimson red
      }
      
      // Hybrid: both high energy AND high DCs
      if (energyGW >= 1 && dcCount >= 2) {
        const compositeScore = dcCount * energyGW;
        const intensity = Math.min(compositeScore / 10, 1);
        const opacity = 0.4 + intensity * 0.6; // 0.4 to 1.0
        return `rgba(128, 0, 128, ${opacity})`; // Purple
      }
      
      // Low activity
      return 'rgba(200, 200, 200, 0.2)'; // Light gray, low opacity
    };

    const addLayers = () => {
      if (layersAddedRef.current) return;
      if (!mapInstance.getSource(SOURCE_ID)) {
        return;
      }

      try {
        // Improved gradient color expression with expanded classification rules
        // Uses continuous color scales for better visual distinction
        const colorExpression = [
          'case',
          // Pure Producer: high energy (>1GW) AND low DC count (<= 1)
          // This catches counties like Pecos (2.13 GW, 1 DC)
          [
            'all',
            ['>', ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000], 1],
            ['<=', ['coalesce', ['get', 'dc_count'], 0], 1]
          ],
          [
            'interpolate',
            ['linear'],
            ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000], // energyGW
            1, '#228B22',   // 1 GW: forest green
            2, '#32CD32',   // 2 GW: lime green
            3, '#50C878',   // 3 GW: emerald green
            5, '#00FF7F',   // 5 GW: spring green
            7, '#00FF00',   // 7 GW: bright green
            10, '#00AA00'   // 10+ GW: dark green
          ],
          // Hybrid: high energy (>=1GW) AND high DC count (>= 2)
          [
            'all',
            ['>=', ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000], 1],
            ['>=', ['coalesce', ['get', 'dc_count'], 0], 2]
          ],
          [
            'interpolate',
            ['linear'],
            [
              '*',
              ['coalesce', ['get', 'dc_count'], 0],
              ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000]
            ], // compositeScore (dc_count * energyGW)
            2, '#BA55D3',   // Low hybrid: medium orchid
            4, '#9370DB',   // Medium hybrid: medium purple
            6, '#8B008B',   // Higher hybrid: dark magenta
            10, '#6A0DAD',  // High hybrid: indigo
            15, '#4B0082'   // Very high hybrid: deep indigo
          ],
          // Hybrid-leaning: moderate energy (0.5-1GW) with multiple DCs (>= 2)
          // Catches counties like Collin (0.85 GW, 3 DCs), Ellis (0.82 GW, 4 DCs)
          [
            'all',
            ['>=', ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000], 0.5],
            ['<', ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000], 1],
            ['>=', ['coalesce', ['get', 'dc_count'], 0], 2]
          ],
          [
            'interpolate',
            ['linear'],
            [
              '*',
              ['coalesce', ['get', 'dc_count'], 0],
              ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000]
            ], // compositeScore
            1, '#DDA0DD',   // Low hybrid-leaning: plum
            2, '#BA55D3',   // Medium hybrid-leaning: medium orchid
            3, '#9370DB'    // Higher hybrid-leaning: medium purple
          ],
          // Producer-leaning: moderate energy (0.3-1GW) with low DC count (<= 1)
          // Catches counties with energy but below 1 GW threshold
          [
            'all',
            ['>=', ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000], 0.3],
            ['<=', ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000], 1],
            ['<=', ['coalesce', ['get', 'dc_count'], 0], 1]
          ],
          [
            'interpolate',
            ['linear'],
            ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000],
            0.3, '#E0FFE0', // 0.3 GW: very light green
            0.5, '#90EE90', // 0.5 GW: light green
            0.75, '#7CFC00', // 0.75 GW: lawn green
            1, '#228B22'     // 1 GW: forest green
          ],
          // Pure Consumer: low energy (<0.5GW) AND high DC count (>0)
          [
            'all',
            ['<', ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000], 0.5],
            ['>', ['coalesce', ['get', 'dc_count'], 0], 0]
          ],
          [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'dc_count'], 0], // dcCount
            1, '#FFB6C1',   // 1 DC: light pink
            2, '#FF6B6B',   // 2 DCs: light red
            3, '#FF4444',   // 3 DCs: medium red
            5, '#DC143C',   // 5 DCs: crimson
            8, '#B22222',   // 8 DCs: fire brick
            10, '#8B0000',  // 10+ DCs: dark red
            14, '#5C0000'   // 14+ DCs: very dark red
          ],
          // Default: low activity - transparent (no fill)
          'rgba(0, 0, 0, 0)'
        ];

        // Simplified hover effect: just use base color (no re-evaluation)
        // Hover will be handled via opacity and border only for better performance

        // Dynamic fill-opacity expression based on producer/consumer intensity
        // Higher scores = higher opacity (more visible fill)
        // Range: 2% (min) to 30% (max)
        const opacityExpression = [
          'case',
          // Pure Producer: opacity based on energy GW (0.02 to 0.30)
          [
            'all',
            ['>', ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000], 1],
            ['<=', ['coalesce', ['get', 'dc_count'], 0], 1]
          ],
          [
            'interpolate',
            ['linear'],
            ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000], // energyGW
            1, 0.08,   // 1 GW: 8% opacity
            2, 0.12,   // 2 GW: 12% opacity
            3, 0.16,   // 3 GW: 16% opacity
            5, 0.20,   // 5 GW: 20% opacity
            7, 0.25,   // 7 GW: 25% opacity
            10, 0.30   // 10+ GW: 30% opacity (max)
          ],
          // Hybrid: opacity based on composite score (0.05 to 0.30)
          [
            'all',
            ['>=', ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000], 1],
            ['>=', ['coalesce', ['get', 'dc_count'], 0], 2]
          ],
          [
            'interpolate',
            ['linear'],
            [
              '*',
              ['coalesce', ['get', 'dc_count'], 0],
              ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000]
            ], // compositeScore
            2, 0.10,   // Low hybrid: 10% opacity
            4, 0.15,   // Medium hybrid: 15% opacity
            6, 0.20,   // Higher hybrid: 20% opacity
            10, 0.25,  // High hybrid: 25% opacity
            15, 0.30   // Very high hybrid: 30% opacity (max)
          ],
          // Hybrid-leaning: opacity based on composite score (0.03 to 0.15)
          [
            'all',
            ['>=', ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000], 0.5],
            ['<', ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000], 1],
            ['>=', ['coalesce', ['get', 'dc_count'], 0], 2]
          ],
          [
            'interpolate',
            ['linear'],
            [
              '*',
              ['coalesce', ['get', 'dc_count'], 0],
              ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000]
            ], // compositeScore
            1, 0.03,   // Low hybrid-leaning: 3% opacity
            2, 0.08,   // Medium hybrid-leaning: 8% opacity
            3, 0.15    // Higher hybrid-leaning: 15% opacity
          ],
          // Producer-leaning: opacity based on energy GW (0.02 to 0.12)
          [
            'all',
            ['>=', ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000], 0.3],
            ['<=', ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000], 1],
            ['<=', ['coalesce', ['get', 'dc_count'], 0], 1]
          ],
          [
            'interpolate',
            ['linear'],
            ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000],
            0.3, 0.02, // 0.3 GW: 2% opacity (min)
            0.5, 0.05, // 0.5 GW: 5% opacity
            0.75, 0.09, // 0.75 GW: 9% opacity
            1, 0.12     // 1 GW: 12% opacity
          ],
          // Pure Consumer: opacity based on DC count (0.03 to 0.30)
          [
            'all',
            ['<', ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000], 0.5],
            ['>', ['coalesce', ['get', 'dc_count'], 0], 0]
          ],
          [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'dc_count'], 0], // dcCount
            1, 0.05,   // 1 DC: 5% opacity
            2, 0.08,   // 2 DCs: 8% opacity
            3, 0.12,   // 3 DCs: 12% opacity
            5, 0.16,   // 5 DCs: 16% opacity
            8, 0.22,   // 8 DCs: 22% opacity
            10, 0.26,  // 10+ DCs: 26% opacity
            14, 0.30   // 14+ DCs: 30% opacity (max)
          ],
          // Default: transparent (no fill)
          0
        ];

        // Add fill layer
        if (!mapInstance.getLayer(FILL_LAYER_ID)) {
          // Try to add before ERCOT counties layer if it exists, otherwise add to top
          let beforeId = null;
          if (mapInstance.getLayer('ercot-counties-fill')) {
            beforeId = 'ercot-counties-fill';
          } else if (mapInstance.getLayer('texas-data-centers-layer')) {
            beforeId = 'texas-data-centers-layer';
          }
          
          mapInstance.addLayer({
            id: FILL_LAYER_ID,
            type: 'fill',
            source: SOURCE_ID,
            paint: {
              'fill-color': colorExpression,
              'fill-opacity': [
                'case',
                ['==', ['feature-state', 'hover'], true],
                ['+', opacityExpression, 0.20],
                opacityExpression
              ]
            },
            minzoom: 0,
            maxzoom: 8
          }, beforeId);
        }

        // Add stroke layer for hover effect
        if (!mapInstance.getLayer(STROKE_LAYER_ID)) {
          mapInstance.addLayer({
            id: STROKE_LAYER_ID,
            type: 'line',
            source: SOURCE_ID,
            paint: {
              'line-color': [
                'case',
                ['==', ['feature-state', 'hover'], true],
                '#FFFFFF', // White border on hover
                'rgba(0, 0, 0, 0)' // Transparent when not hovered
              ],
              'line-width': [
                'case',
                ['==', ['feature-state', 'hover'], true],
                2, // 2px border on hover
                0  // No border when not hovered
              ],
              'line-opacity': [
                'case',
                ['==', ['feature-state', 'hover'], true],
                0.8, // 80% opacity on hover
                0
              ]
            },
            minzoom: 0
          }, FILL_LAYER_ID);
        }

        // Optimized hover event handlers
        const handleMouseEnter = (e) => {
          // Clear any pending timeout
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
          }
          
          if (e.features.length > 0) {
            const feature = e.features[0];
            const featureId = feature.id;
            
            // Only update if different county
            if (hoveredCountyIdRef.current !== featureId) {
              // Reset previous hover immediately
              if (hoveredCountyIdRef.current !== null) {
                mapInstance.setFeatureState(
                  { source: SOURCE_ID, id: hoveredCountyIdRef.current },
                  { hover: false }
                );
              }
              
              // Set new hover immediately
              hoveredCountyIdRef.current = featureId;
              mapInstance.setFeatureState(
                { source: SOURCE_ID, id: featureId },
                { hover: true }
              );
              
              // Change cursor to pointer
              mapInstance.getCanvas().style.cursor = 'pointer';
            }
          }
        };

        const handleMouseLeave = () => {
          // Clear any pending timeout
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
          }
          
          // Immediate response for better performance
          if (hoveredCountyIdRef.current !== null) {
            mapInstance.setFeatureState(
              { source: SOURCE_ID, id: hoveredCountyIdRef.current },
              { hover: false }
            );
            hoveredCountyIdRef.current = null;
          }
          // Reset cursor
          mapInstance.getCanvas().style.cursor = '';
        };

        // Attach event handlers (only once)
        if (mapInstance.getLayer(FILL_LAYER_ID) && !handlersAttachedRef.current) {
          mapInstance.on('mouseenter', FILL_LAYER_ID, handleMouseEnter);
          mapInstance.on('mouseleave', FILL_LAYER_ID, handleMouseLeave);
          handlersAttachedRef.current = true;
        }

        layersAddedRef.current = true;
        // Apply correct visibility immediately — don't wait for checkAndUpdate poll
        updateVisibility();
      } catch (error) {
        console.error('Error adding Producer/Consumer layers:', error);
      }
    };

    const updateVisibility = () => {
      try {
        const visibility = visibleRef.current ? 'visible' : 'none';
        if (mapInstance.getLayer(FILL_LAYER_ID)) {
          mapInstance.setLayoutProperty(FILL_LAYER_ID, 'visibility', visibility);
        }
        if (mapInstance.getLayer(STROKE_LAYER_ID)) {
          mapInstance.setLayoutProperty(STROKE_LAYER_ID, 'visibility', visibility);
        }
      } catch (error) {
        console.error('[ProducerConsumer] Error updating visibility:', error);
      }
    };

    // Load layer when map is ready
    if (mapInstance.isStyleLoaded()) {
      loadLayer();
    } else {
      mapInstance.once('styledata', loadLayer);
    }
    const _loadLayerRef = loadLayer;

    // Update visibility when prop changes
    if (sourceLoadedRef.current && layersAddedRef.current) {
      updateVisibility();
    } else {
      // Wait for layer to be added, then update visibility
      const checkAndUpdate = () => {
        if (mapInstance.getLayer(FILL_LAYER_ID)) {
          updateVisibility();
        } else {
          setTimeout(checkAndUpdate, 100);
        }
      };
      checkAndUpdate();
    }

    // Cleanup
    return () => {
      mapInstance.off('styledata', _loadLayerRef);
      if (mapInstance && sourceLoadedRef.current) {
        try {
          // Remove event handlers
          if (mapInstance.getLayer(FILL_LAYER_ID) && handlersAttachedRef.current) {
            mapInstance.off('mouseenter', FILL_LAYER_ID);
            mapInstance.off('mouseleave', FILL_LAYER_ID);
            handlersAttachedRef.current = false;
            
            // Clear any pending timeouts
            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current);
              hoverTimeoutRef.current = null;
            }
            
            // Reset hover state
            if (hoveredCountyIdRef.current !== null) {
              mapInstance.setFeatureState(
                { source: SOURCE_ID, id: hoveredCountyIdRef.current },
                { hover: false }
              );
              hoveredCountyIdRef.current = null;
            }
            
            mapInstance.setLayoutProperty(FILL_LAYER_ID, 'visibility', 'none');
          }
          
          // Hide stroke layer
          if (mapInstance.getLayer(STROKE_LAYER_ID)) {
            mapInstance.setLayoutProperty(STROKE_LAYER_ID, 'visibility', 'none');
          }
        } catch (error) {
          // Layer might not exist
        }
      }
    };
  }, [map, visible]);

  return null;
};

export default ProducerConsumerCountiesLayer;

