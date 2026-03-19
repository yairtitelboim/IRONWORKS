import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { MOBILE_CONFIG } from '../constants';

const SOURCE_ID = 'ercot-counties-source';
const FILL_LAYER_ID = 'ercot-counties-fill';
const STROKE_LAYER_ID = 'ercot-counties-stroke';
const GEOJSON_URL = '/data/ercot/ercot_counties_aggregated.geojson';

const ERCOTCountiesLayer = ({ map, visible }) => {
  const isMobile = useIsMobile(MOBILE_CONFIG.breakpoint);
  const isMobileRef = useRef(isMobile);
  isMobileRef.current = isMobile;
  // Always tracks the latest `visible` prop — prevents stale-closure race where
  // an async fetch callback from a previous effect run calls updateVisibility()
  // with the old (false) value after a newer effect has already set visible=true.
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const sourceLoadedRef = useRef(false);
  const layersAddedRef = useRef(false);
  const selectedCountyIdRef = useRef(null);
  const adjacentCountyIdsRef = useRef(new Set());
  const geojsonDataRef = useRef(null);
  const fadeTimeoutRef = useRef(null);

  useEffect(() => {
    if (!map?.current) return;

    const mapInstance = map.current;

    const loadLayer = async () => {
      try {
        // Source already exists — mark it and add layers if they haven't been added yet
        // (can happen on re-mount or when the effect re-runs before the first fetch resolved).
        if (mapInstance.getSource(SOURCE_ID)) {
          sourceLoadedRef.current = true;
          if (!layersAddedRef.current) addLayers();
          return;
        }

        // Wait for map to be ready
        if (!mapInstance.isStyleLoaded()) {
          mapInstance.once('styledata', loadLayer);
          return;
        }
        
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
            
            // Ensure all features have IDs for setFeatureState to work
            // Use county name or GEOID as ID, or generate one from index
            geojsonData.features.forEach((feature, index) => {
              if (!feature.id && feature.id !== 0) {
                // Try to use a unique property as ID
                const countyName = feature.properties?.NAME || feature.properties?.name || feature.properties?.COUNTY || feature.properties?.county;
                const geoid = feature.properties?.GEOID || feature.properties?.geoid;
                
                if (geoid) {
                  feature.id = geoid;
                } else if (countyName) {
                  // Use county name as ID (should be unique within Texas)
                  feature.id = `county-${countyName.toLowerCase().replace(/\s+/g, '-')}`;
                } else {
                  // Fallback: use index
                  feature.id = `county-${index}`;
                }
              }
            });
            
            // Store GeoJSON data for adjacency calculations
            geojsonDataRef.current = geojsonData;
            
            // Re-check: source may have been added by a concurrent/duplicate load (e.g. React Strict Mode)
            if (mapInstance.getSource(SOURCE_ID)) {
              sourceLoadedRef.current = true;
              const src = mapInstance.getSource(SOURCE_ID);
              if (src && src.setData) src.setData(geojsonData);
              addLayers();
              return;
            }
            
            mapInstance.addSource(SOURCE_ID, {
              type: 'geojson',
              data: geojsonData,
              generateId: true  // Fallback: Mapbox will generate IDs if features still don't have them
            });

            sourceLoadedRef.current = true;
            
            // Now add layers
            addLayers();
          })
          .catch(error => {
            // Error loading GeoJSON
          });

      } catch (error) {
        // Error loading layer
      }
    };

    const addLayers = () => {
      if (layersAddedRef.current) return;
      if (!mapInstance.getSource(SOURCE_ID)) {
        return;
      }

      try {
        // Color expression: by project count (red scale - darker, saturated reds for dark theme)
        // Focus on making 1000+ really stand out, using colors that work on dark backgrounds
        const colorExpression = [
          'interpolate',
          ['linear'],
          ['get', 'project_count'],
          0, '#1a1a1a',        // No projects: dark gray (visible on dark maps)
          10, '#2d1414',       // Very low: dark red tint
          50, '#4a1f1f',       // Low: darker red
          100, '#6b2a2a',      // Medium-low: medium dark red
          500, '#8b3a3a',      // Medium: darker red
          1000, '#dc2626',     // High: saturated red (threshold)
          2000, '#b91c1c',     // Very high: very dark red
          3000, '#991b1b'      // Extreme: darkest red
        ];

        // Add fill layer with opacity that scales with project count
        // Opacity will be reduced to 10% for non-selected counties
        if (!mapInstance.getLayer(FILL_LAYER_ID)) {
          mapInstance.addLayer({
            id: FILL_LAYER_ID,
            type: 'fill',
            source: SOURCE_ID,
            paint: {
              'fill-color': colorExpression,
              'fill-opacity': [
                'case',
                ['==', ['get', 'project_count'], 0],
                0,  // No projects: completely transparent
                [
                  '*',  // Multiply base opacity by selection factor
                  [
                    'case',
                    [
                      'all',
                    ['boolean', ['feature-state', 'selected'], false],
                      ['==', ['coalesce', ['get', '_faded'], false], false]
                    ],
                    1,  // Selected and not faded: full opacity
                    [
                      'all',
                      ['boolean', ['feature-state', 'selected'], false],
                      ['==', ['coalesce', ['get', '_faded'], false], true]
                    ],
                    0.15,  // Selected but faded: reduced opacity
                    ['boolean', ['feature-state', 'adjacent'], false],
                    0.7,  // Adjacent: clearly visible
                    0.6   // Default unselected: clearly visible (was 0.1 — too faint)
                  ],
                  [
                    'interpolate',
                    ['linear'],
                    ['get', 'project_count'],
                    1, 0.05,
                    10, 0.15,
                    50, 0.3,
                    100, 0.45,
                    500, 0.65,
                    1000, 0.85,
                    2000, 0.9,
                    3000, 0.95
                  ]
                ]
              ]
            },
            minzoom: 4,
            maxzoom: 8
          });
        }

        // Add stroke layer for selected county border
        if (!mapInstance.getLayer(STROKE_LAYER_ID)) {
          mapInstance.addLayer({
            id: STROKE_LAYER_ID,
            type: 'line',
            source: SOURCE_ID,
            paint: {
              'line-color': [
                'case',
                [
                  'all',
                  ['boolean', ['feature-state', 'selected'], false],
                  ['==', ['coalesce', ['get', '_faded'], false], true]
                ],
                '#dc2626',  // Selected and faded: red border
                [
                  'all',
                  ['boolean', ['feature-state', 'selected'], false],
                  ['==', ['coalesce', ['get', '_faded'], false], false]
                ],
                '#ffffff',  // Selected and not faded: white border
                '#ffffff'   // Default: white (shouldn't show when not selected)
              ],
              'line-width': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                3,  // Selected: 3px border
                0   // Not selected: no border
              ],
              'line-opacity': 1
            },
            minzoom: 4
          });
        }

        // Add hover effect
        let hoveredCountyId = null;

        mapInstance.on('mouseenter', FILL_LAYER_ID, (e) => {
          if (e.features.length > 0) {
            mapInstance.getCanvas().style.cursor = 'pointer';
            
            const feature = e.features[0];
            const props = feature.properties;
            
            // Highlight county with darker fill on hover
            if (hoveredCountyId !== null && hoveredCountyId !== undefined) {
              try {
                mapInstance.setFeatureState(
                  { source: SOURCE_ID, id: hoveredCountyId },
                  { hover: false }
                );
              } catch (e) {
                // Failed to clear previous hover state
              }
            }
            
            const featureId = feature.id;
            if (featureId !== null && featureId !== undefined) {
              hoveredCountyId = featureId;
              try {
                mapInstance.setFeatureState(
                  { source: SOURCE_ID, id: hoveredCountyId },
                  { hover: true }
                );
              } catch (e) {
                hoveredCountyId = null;
              }
            }
            
            // Darken fill on hover (increase opacity)
            const baseOpacity = props.project_count === 0 ? 0 : 
              props.project_count < 10 ? 0.2 :
              props.project_count < 100 ? 0.4 :
              props.project_count < 500 ? 0.6 :
              props.project_count < 1000 ? 0.75 : 0.9;
            
            mapInstance.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', [
              'case',
              ['boolean', ['feature-state', 'hover'], false],
              [
                'case',
                ['==', ['get', 'project_count'], 0],
                0,
                [
                  'interpolate',
                  ['linear'],
                  ['get', 'project_count'],
                  1, 0.2,
                  10, 0.25,
                  50, 0.4,
                  100, 0.5,
                  500, 0.65,
                  1000, 0.8,
                  2000, 0.95
                ]
              ],
              [
                'case',
                ['==', ['get', 'project_count'], 0],
                0,
                [
                  'interpolate',
                  ['linear'],
                  ['get', 'project_count'],
                  1, 0.1,
                  10, 0.15,
                  50, 0.25,
                  100, 0.35,
                  500, 0.5,
                  1000, 0.65,
                  2000, 0.8
                ]
              ]
            ]);
          }
        });

        mapInstance.on('mouseleave', FILL_LAYER_ID, () => {
          mapInstance.getCanvas().style.cursor = '';
          
          if (hoveredCountyId !== null && hoveredCountyId !== undefined) {
            try {
              mapInstance.setFeatureState(
                { source: SOURCE_ID, id: hoveredCountyId },
                { hover: false }
              );
            } catch (e) {
              // Failed to clear hover state
            }
            hoveredCountyId = null;
          }
          
          // Reset is handled by the opacity expression which uses feature-state
          // No need to manually reset here
        });

        // Add click event for selection (details shown in label, no popup)
        mapInstance.on('click', FILL_LAYER_ID, (e) => {
          // Check if click is on a Texas Data Center marker - if so, skip ERCOT selection
          try {
            // Only check if the layer exists
            if (mapInstance.getLayer('texas-data-centers-layer')) {
          const dataCenterFeatures = mapInstance.queryRenderedFeatures(e.point, {
            layers: ['texas-data-centers-layer']
          });
          if (dataCenterFeatures && dataCenterFeatures.length > 0) {
            // Click is on a data center marker, skip ERCOT selection
            return;
              }
            }
          } catch (error) {
            // Layer doesn't exist or query failed, continue with ERCOT selection
          }
          
          const feature = e.features[0];
          if (feature) {
            const props = feature.properties;
            const coordinates = e.lngLat;
            const clickedCountyId = feature.id;

            // Validate feature ID
            if (clickedCountyId === null || clickedCountyId === undefined) {
              return;
            }

            // Zoom to the county polygon bounds so the full highlighted shape is visible.
            try {
              if (feature.geometry) {
                const bbox = turf.bbox(feature.geometry);
                const bounds = [
                  [bbox[0], bbox[1]],
                  [bbox[2], bbox[3]]
                ];
                const padding = isMobileRef.current
                  ? { top: 80, right: 24, bottom: 300, left: 24 }
                  : { top: 90, right: 90, bottom: 90, left: 90 };
                mapInstance.fitBounds(bounds, {
                  padding,
                  duration: 1000,
                  essential: true,
                  maxZoom: 10
                });
              } else {
                // Fallback: use click coordinates when geometry is unavailable
                const flyOpts = {
                  center: [coordinates.lng, coordinates.lat],
                  zoom: 8,
                  duration: 1000,
                  essential: true
                };
                mapInstance.flyTo(flyOpts);
              }
            } catch (error) {
              // If zoom fails, just use click coordinates
              try {
                const flyOpts = {
                  center: [coordinates.lng, coordinates.lat],
                  zoom: 8,
                  duration: 1000,
                  essential: true
                };
                mapInstance.flyTo(flyOpts);
              } catch (fallbackError) {
                // Zoom failed, continue with selection
              }
            }

            // Emit event for table to highlight corresponding row
            if (window.mapEventBus) {
              window.mapEventBus.emit('ercot-county:map-selected', {
                countyId: clickedCountyId,
                countyName: props.NAME || props.name,
                properties: props,
                geometry: feature.geometry
              });
            }

            // Clear previous selection and adjacent counties
            if (selectedCountyIdRef.current !== null && selectedCountyIdRef.current !== undefined) {
              // Clear fade timeout if switching to a different county
              if (fadeTimeoutRef.current) {
                clearTimeout(fadeTimeoutRef.current);
                fadeTimeoutRef.current = null;
              }
              
              try {
                // Clear _faded property from source data
                if (geojsonDataRef.current) {
                  const featureToClear = geojsonDataRef.current.features.find(f => f.id === selectedCountyIdRef.current);
                  if (featureToClear && featureToClear.properties) {
                    featureToClear.properties._faded = false;
                    
                    // Update the source
                    const source = mapInstance.getSource(SOURCE_ID);
                    if (source && source.setData) {
                      source.setData(geojsonDataRef.current);
                    }
                  }
                }
                
                mapInstance.setFeatureState(
                  { source: SOURCE_ID, id: selectedCountyIdRef.current },
                  { selected: false, faded: false }
                );
              } catch (e) {
                // Failed to clear previous selection
              }
            }
            
            // Clear previous adjacent counties
            adjacentCountyIdsRef.current.forEach(adjacentId => {
              if (adjacentId !== null && adjacentId !== undefined) {
                try {
                  mapInstance.setFeatureState(
                    { source: SOURCE_ID, id: adjacentId },
                    { adjacent: false }
                  );
                } catch (e) {
                  // Failed to clear adjacent state
                }
              }
            });
            adjacentCountyIdsRef.current.clear();

            // Set new selection
            if (selectedCountyIdRef.current === clickedCountyId) {
              // Clicking the same county again - deselect
              selectedCountyIdRef.current = null;
              
              // Clear fade timeout
              if (fadeTimeoutRef.current) {
                clearTimeout(fadeTimeoutRef.current);
                fadeTimeoutRef.current = null;
              }
              
              // Clear feature state data
              try {
                // Clear _faded property from source data
                if (geojsonDataRef.current) {
                  const featureToClear = geojsonDataRef.current.features.find(f => f.id === clickedCountyId);
                  if (featureToClear && featureToClear.properties) {
                    featureToClear.properties._faded = false;
                    
                    // Update the source
                    const source = mapInstance.getSource(SOURCE_ID);
                    if (source && source.setData) {
                      source.setData(geojsonDataRef.current);
                    }
                  }
                }
                
                mapInstance.setFeatureState(
                  { source: SOURCE_ID, id: clickedCountyId },
                  { 
                    selected: false,
                    faded: false,
                    totalCapacity: 0,
                    avgCapacity: 0,
                    dominantFuel: ''
                  }
                );
              } catch (e) {
                // Failed to clear feature state
              }
              
              // Clear selection from source data
              if (geojsonDataRef.current) {
                geojsonDataRef.current.features.forEach(f => {
                  if (f.properties) {
                    f.properties._selected = false;
                  }
                });
                
                // Update the source
                const source = mapInstance.getSource(SOURCE_ID);
                if (source && source.setData) {
                  source.setData(geojsonDataRef.current);
                }
              }
              
              // Clear adjacent counties
              adjacentCountyIdsRef.current.forEach(adjacentId => {
                if (adjacentId !== null && adjacentId !== undefined) {
                  try {
                    mapInstance.setFeatureState(
                      { source: SOURCE_ID, id: adjacentId },
                      { adjacent: false }
                    );
                  } catch (e) {
                    // Failed to clear adjacent state
                  }
                }
              });
              adjacentCountyIdsRef.current.clear();
              
              // Reset opacity for all counties
              mapInstance.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', [
                'case',
                ['==', ['get', 'project_count'], 0],
                0,
                [
                  'interpolate',
                  ['linear'],
                  ['get', 'project_count'],
                  1, 0.05,
                  10, 0.08,
                  50, 0.12,
                  100, 0.2,
                  500, 0.4,
                  1000, 0.85,
                  2000, 0.9,
                  3000, 0.95
                ]
              ]);
              
              return; // Exit early, don't proceed with selection
            } else {
              // Select new county
              selectedCountyIdRef.current = clickedCountyId;
              
              // Clear any existing fade timeout
              if (fadeTimeoutRef.current) {
                clearTimeout(fadeTimeoutRef.current);
                fadeTimeoutRef.current = null;
              }
              
              try {
                mapInstance.setFeatureState(
                  { source: SOURCE_ID, id: clickedCountyId },
                  { selected: true, faded: false }
                );
                
                // After 2 seconds, reduce opacity by 90% (from full to 10%)
                fadeTimeoutRef.current = setTimeout(() => {
                  if (selectedCountyIdRef.current === clickedCountyId) {
                    try {
                      // Update source data directly instead of using feature-state
                      // This is more reliable for expression evaluation
                      if (geojsonDataRef.current) {
                        // Try multiple ID matching strategies
                        let featureToFade = geojsonDataRef.current.features.find(f => f.id === clickedCountyId);
                        
                        // If not found, try string/number conversion
                        if (!featureToFade) {
                          featureToFade = geojsonDataRef.current.features.find(f => 
                            f.id == clickedCountyId || // Loose equality
                            String(f.id) === String(clickedCountyId) ||
                            Number(f.id) === Number(clickedCountyId)
                          );
                        }
                        
                        if (featureToFade && featureToFade.properties) {
                          // Mark as faded in source data
                          const previousFaded = featureToFade.properties._faded;
                          featureToFade.properties._faded = true;
                          
                          // Update the source
                          const source = mapInstance.getSource(SOURCE_ID);
                          if (source && source.setData) {
                            source.setData(geojsonDataRef.current);
                          }
                        } else {
                          // Try alternative lookup methods
                          // Log more details about the mismatch
                          const sampleIds = geojsonDataRef.current.features.slice(0, 10).map(f => ({
                            id: f.id,
                            idType: typeof f.id,
                            name: f.properties?.NAME || f.properties?.name
                          }));
                          
                          // Try finding by name instead
                          const featureByName = geojsonDataRef.current.features.find(f => 
                            f.properties?.NAME === (props.NAME || props.name) ||
                            f.properties?.name === (props.NAME || props.name)
                          );
                          
                          if (featureByName && featureByName.properties) {
                            featureByName.properties._faded = true;
                            
                            const source = mapInstance.getSource(SOURCE_ID);
                            if (source && source.setData) {
                              source.setData(geojsonDataRef.current);
                              
                              // Note: querySourceFeatures may not immediately reflect setData changes
                              // The visibility toggle ensures the expression re-evaluates with the new data
                              
                              // Force Mapbox to re-evaluate expressions by toggling layer visibility
                              // This ensures the expression reads the new _faded property
                              setTimeout(() => {
                                const currentVisibility = mapInstance.getLayoutProperty(FILL_LAYER_ID, 'visibility');
                                if (currentVisibility === 'visible') {
                                  mapInstance.setLayoutProperty(FILL_LAYER_ID, 'visibility', 'none');
                                  requestAnimationFrame(() => {
                                    mapInstance.setLayoutProperty(FILL_LAYER_ID, 'visibility', 'visible');
                                    mapInstance.triggerRepaint();
                                  });
                                }
                              }, 50);
                            }
                          } else {
                            // Try finding by matching any property that might match
                            const featureByProps = geojsonDataRef.current.features.find(f => {
                              const fName = f.properties?.NAME || f.properties?.name;
                              const clickedName = props.NAME || props.name;
                              return fName === clickedName || 
                                     fName?.toLowerCase() === clickedName?.toLowerCase();
                            });
                            
                            if (featureByProps && featureByProps.properties) {
                              featureByProps.properties._faded = true;
                              
                              const source = mapInstance.getSource(SOURCE_ID);
                              if (source && source.setData) {
                                source.setData(geojsonDataRef.current);
                                
                                // Force Mapbox to re-evaluate expressions
                                setTimeout(() => {
                                  const currentVisibility = mapInstance.getLayoutProperty(FILL_LAYER_ID, 'visibility');
                                  if (currentVisibility === 'visible') {
                                    mapInstance.setLayoutProperty(FILL_LAYER_ID, 'visibility', 'none');
                                    requestAnimationFrame(() => {
                                      mapInstance.setLayoutProperty(FILL_LAYER_ID, 'visibility', 'visible');
                                      mapInstance.triggerRepaint();
                                    });
                                  }
                                }, 50);
                              }
                            } else {
                              console.error('❌ [ERCOTCountiesLayer] Could not find feature by any method:', {
                                clickedId: clickedCountyId,
                                clickedName: props.NAME || props.name,
                                totalFeatures: geojsonDataRef.current.features.length
                              });
                            }
                          }
                        }
                      }
                      
                      // Also set feature-state for consistency
                      mapInstance.setFeatureState(
                        { source: SOURCE_ID, id: clickedCountyId },
                        { selected: true, faded: true }
                      );
                      
                      // Force a repaint
                      mapInstance.triggerRepaint();
                    } catch (e) {
                      console.error('❌ [ERCOTCountiesLayer] Failed to update fade state:', e);
                    }
                  }
                }, 2000);
                
                // Find adjacent counties using turf.js
                // Query all features from the source and compare geometries directly
                if (feature.geometry) {
                  const clickedTurfFeature = turf.feature(feature.geometry);
                  let adjacentCount = 0;
                  
                  // Query all features from the Mapbox source (this gets the actual features with their IDs)
                  const allFeatures = mapInstance.querySourceFeatures(SOURCE_ID, {
                    filter: ['!=', ['id'], clickedCountyId]  // Exclude the clicked feature
                  });
                  
                  // Check each feature for adjacency
                  allFeatures.forEach(otherFeature => {
                    if (otherFeature.geometry && otherFeature.id !== clickedCountyId) {
                      try {
                        const otherTurfFeature = turf.feature(otherFeature.geometry);
                        
                        // Check if counties touch (share a border)
                        const touches = turf.booleanTouches(clickedTurfFeature, otherTurfFeature);
                        
                        if (touches) {
                          // Set adjacent state using the feature's actual ID from Mapbox
                          try {
                            mapInstance.setFeatureState(
                              { source: SOURCE_ID, id: otherFeature.id },
                              { adjacent: true }
                            );
                            adjacentCountyIdsRef.current.add(otherFeature.id);
                            adjacentCount++;
                          } catch (stateError) {
                            // Failed to set adjacent state
                          }
                        }
                      } catch (e) {
                        // Skip if geometry is invalid
                      }
                    }
                  });
                  
                  // Force a repaint to show adjacent counties
                  mapInstance.triggerRepaint();
                }
              } catch (e) {
                return;
              }
            }

            // Update opacity for all counties based on selection
            // This triggers a repaint with the new feature-state values
            mapInstance.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', [
              'case',
              ['==', ['get', 'project_count'], 0],
              0,
              [
                '*',
                [
                  'case',
                  ['boolean', ['feature-state', 'selected'], false],
                  1,  // Selected: full opacity
                  ['boolean', ['feature-state', 'adjacent'], false],
                  0.4,  // Adjacent: 40% opacity (some fill)
                  0.1  // Not selected/adjacent: 10% opacity (90% dim)
                ],
                [
                  'interpolate',
                  ['linear'],
                  ['get', 'project_count'],
                  1, 0.05,
                  10, 0.08,
                  50, 0.12,
                  100, 0.2,
                  500, 0.4,
                  1000, 0.85,
                  2000, 0.9,
                  3000, 0.95
                ]
              ]
            ]);

            // Store county data in feature-state for label display
            const countyName = props.NAME || props.name || 'Unknown County';
            const projectCount = props.project_count || 0;
            const totalCapacity = props.total_capacity_mw || 0;
            const avgCapacity = props.avg_capacity_mw || 0;
            const dominantFuel = props.dominant_fuel_type || 'NONE';
            
            // Store data in feature-state for opacity/adjacency (paint properties can use feature-state)
            try {
              mapInstance.setFeatureState(
                { source: SOURCE_ID, id: clickedCountyId },
                { 
                  selected: true,
                  faded: false,
                  totalCapacity: totalCapacity,
                  avgCapacity: avgCapacity,
                  dominantFuel: dominantFuel
                }
              );
            } catch (e) {
              // Failed to store county data in feature-state
            }
            
            // Update source data to mark this feature as selected (for layout properties)
            // Since feature-state doesn't work in layout properties, we update the source directly
            if (geojsonDataRef.current) {
              const selectedFeature = geojsonDataRef.current.features.find(f => f.id === clickedCountyId);
              if (selectedFeature) {
                // Clear previous selection
                geojsonDataRef.current.features.forEach(f => {
                  if (f.properties) {
                    f.properties._selected = false;
                  }
                });
                
                // Mark this feature as selected
                selectedFeature.properties._selected = true;
                
                // Update the source
                const source = mapInstance.getSource(SOURCE_ID);
                if (source && source.setData) {
                  source.setData(geojsonDataRef.current);
                }
              }
            }
            
          }
        });

        // Also allow clicking on map to deselect
        mapInstance.on('click', (e) => {
          // Check if click was on a county
          const features = mapInstance.queryRenderedFeatures(e.point, {
            layers: [FILL_LAYER_ID]
          });
          
          // If click was not on a county, clear selection
          if (features.length === 0 && selectedCountyIdRef.current !== null && selectedCountyIdRef.current !== undefined) {
            // Clear fade timeout
            if (fadeTimeoutRef.current) {
              clearTimeout(fadeTimeoutRef.current);
              fadeTimeoutRef.current = null;
            }
            
            try {
              mapInstance.setFeatureState(
                { source: SOURCE_ID, id: selectedCountyIdRef.current },
                { 
                  selected: false,
                  faded: false,
                  totalCapacity: 0,
                  avgCapacity: 0,
                  dominantFuel: ''
                }
              );
            } catch (e) {
              // Failed to clear selection on map click
            }
            selectedCountyIdRef.current = null;
            
            // Clear adjacent counties
            adjacentCountyIdsRef.current.forEach(adjacentId => {
              if (adjacentId !== null && adjacentId !== undefined) {
                try {
                  mapInstance.setFeatureState(
                    { source: SOURCE_ID, id: adjacentId },
                    { adjacent: false }
                  );
                } catch (e) {
                  // Failed to clear adjacent on map click
                }
              }
            });
            adjacentCountyIdsRef.current.clear();
            
            // Clear selection from source data
            if (geojsonDataRef.current) {
              geojsonDataRef.current.features.forEach(f => {
                if (f.properties) {
                  f.properties._selected = false;
                }
              });
              
              // Update the source
              const source = mapInstance.getSource(SOURCE_ID);
              if (source && source.setData) {
                source.setData(geojsonDataRef.current);
              }
            }
            
            // Reset opacity for all counties
            mapInstance.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', [
              'case',
              ['==', ['get', 'project_count'], 0],
              0,
              [
                'interpolate',
                ['linear'],
                ['get', 'project_count'],
                1, 0.05,
                10, 0.08,
                50, 0.12,
                100, 0.2,
                500, 0.4,
                1000, 0.85,
                2000, 0.9,
                3000, 0.95
              ]
            ]);
          }
        });

        layersAddedRef.current = true;

        // Emit event for legend integration
        if (window.mapEventBus) {
          window.mapEventBus.emit('ercot-counties:mounted', {
            timestamp: Date.now()
          });
        }

        // Set initial visibility
        updateVisibility();

      } catch (error) {
        // Error adding layer
      }
    };

    // Toggle layer visibility only — never override paint properties here.
    // The data-driven fill-opacity / text-opacity expressions set in addLayers()
    // are permanent and self-contained; overriding them with a flat 0 when hiding
    // risks a stale-value race where the "0" outlives its effect run and suppresses
    // the fill even after the layer is made visible again (especially on mobile
    // where the GeoJSON fetch can complete after the visible=true re-render).
    // Reads visibleRef.current instead of the closure so any async callback
    // always reflects the latest prop value.
    const updateVisibility = () => {
      const isVisible = visibleRef.current;
      if (mapInstance.getLayer(FILL_LAYER_ID)) {
        mapInstance.setLayoutProperty(FILL_LAYER_ID, 'visibility', isVisible ? 'visible' : 'none');
      }
      if (mapInstance.getLayer(STROKE_LAYER_ID)) {
        mapInstance.setLayoutProperty(STROKE_LAYER_ID, 'visibility', isVisible ? 'visible' : 'none');
      }
    };

    // Load layer when map is ready
    if (mapInstance.isStyleLoaded()) {
      loadLayer();
    } else {
      mapInstance.once('styledata', loadLayer);
    }

    // Keep a reference to deregister the styledata listener on cleanup (prevents
    // stale-closure double-fire when the effect re-runs before style finishes loading).
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
      // Remove styledata listener so it doesn't double-fire on the next effect run
      mapInstance.off('styledata', _loadLayerRef);

      // Clear fade timeout on cleanup
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
        fadeTimeoutRef.current = null;
      }
      
      // Don't remove source/layer on unmount, just hide it
      if (mapInstance.getLayer(FILL_LAYER_ID)) {
        mapInstance.setLayoutProperty(FILL_LAYER_ID, 'visibility', 'none');
      }
      if (mapInstance.getLayer(STROKE_LAYER_ID)) {
        mapInstance.setLayoutProperty(STROKE_LAYER_ID, 'visibility', 'none');
      }
    };
  }, [map, visible]);

  return null;
};

export default ERCOTCountiesLayer;
