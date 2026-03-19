import { useEffect, useRef } from 'react';

const SOURCE_ID = 'population-isochrones-source';
const FILL_LAYER_ID = `${SOURCE_ID}-fill`;
const OUTLINE_LAYER_ID = `${SOURCE_ID}-outline`;
const DATA_PATH = '/blockgroups_nc_region.geojson';
const POPULATION_PROPERTY = 'population_total';
const POPULATION_KEYS = [
  'total_population_2022',
  'B01003_001E_2022',
  'population',
  'POPULATION',
  'POP',
  'pop_total'
];

const COLOR_PALETTE = [
  'rgba(51,0,0,0.25)',
  'rgba(102,0,0,0.35)',
  'rgba(153,0,0,0.45)',
  'rgba(204,0,0,0.55)',
  'rgba(255,0,0,0.65)',
  'rgba(255,51,51,0.75)'
];

const OUTLINE_COLORS = ['#0f172a', '#1d4ed8', '#2563eb', '#0891b2', '#0f766e', '#991b1b'];

const QUANTILE_BREAKS = [0.2, 0.4, 0.6, 0.8];

const computeQuantileStops = (values) => {
  const filtered = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!filtered.length) return [];

  const stops = QUANTILE_BREAKS.map((percentile) => {
    const index = Math.min(filtered.length - 1, Math.floor(percentile * (filtered.length - 1)));
    return filtered[index];
  });

  // Remove duplicates while preserving ascending order
  return [...new Set(stops)].sort((a, b) => a - b);
};

const createStepExpression = (stops, colors) => {
  if (!stops.length) {
    return ['interpolate', ['linear'], ['get', POPULATION_PROPERTY], 0, colors[0], 1, colors[colors.length - 1]];
  }

  const expression = ['step', ['get', POPULATION_PROPERTY], colors[0]];
  stops.forEach((stop, index) => {
    const color = colors[Math.min(index + 1, colors.length - 1)];
    expression.push(stop, color);
  });
  return expression;
};

const PopulationIsochronesLayer = ({ map, visible }) => {
  const datasetRef = useRef(null);
  const thresholdsRef = useRef([]);
  const isMountedRef = useRef(false);
  const styleListenerAttachedRef = useRef(false);
  const didFitBoundsRef = useRef(false);
  const hoveredFeatureIdRef = useRef(null);
  const hoverHandlersAttachedRef = useRef(false);

  useEffect(() => {
    if (!map?.current) {
      return;
    }
    const mapInstance = map.current;
    let cancelled = false;

    const removeLayers = () => {
      // Remove highlight layers first
      const HIGHLIGHT_FILL_LAYER_ID = `${SOURCE_ID}-highlight-fill`;
      const HIGHLIGHT_OUTLINE_LAYER_ID = `${SOURCE_ID}-highlight-outline`;
      if (mapInstance.getLayer(HIGHLIGHT_OUTLINE_LAYER_ID)) {
        mapInstance.removeLayer(HIGHLIGHT_OUTLINE_LAYER_ID);
      }
      if (mapInstance.getLayer(HIGHLIGHT_FILL_LAYER_ID)) {
        mapInstance.removeLayer(HIGHLIGHT_FILL_LAYER_ID);
      }
      
      if (mapInstance.getLayer(OUTLINE_LAYER_ID)) {
        mapInstance.removeLayer(OUTLINE_LAYER_ID);
      }
      if (mapInstance.getLayer(FILL_LAYER_ID)) {
        mapInstance.removeLayer(FILL_LAYER_ID);
      }
      if (mapInstance.getSource(SOURCE_ID)) {
        mapInstance.removeSource(SOURCE_ID);
      }
      
      // Reset hover state
      hoveredFeatureIdRef.current = null;
    };

    const emitLegend = () => {
      if (typeof window === 'undefined' || !window.mapEventBus) return;
      window.mapEventBus.emit('population-isochrones:loaded', {
        thresholds: thresholdsRef.current,
        property: POPULATION_PROPERTY,
        generatedAt: new Date().toISOString()
      });
    };

    // Hover-related helper functions - defined early so they can be used throughout
    const createInverseFilter = (filter) => {
      // Create inverse filter: ['==', ...] becomes ['!=', ...]
      if (!filter || filter.length < 3) return null;
      return ['!=', filter[1], filter[2]];
    };

    const createFeatureFilter = (featureId, featureProps) => {
      const props = featureProps || {};
      
      // Determine if featureId came from a top-level feature.id or from properties
      // If we have featureId but no matching property, it's likely a top-level id
      const hasTopLevelId = featureId !== null && 
                            featureId !== undefined && 
                            !props.GEOID && 
                            !props.geoid && 
                            !props.id && 
                            !props.ID &&
                            (typeof featureId === 'number' || typeof featureId === 'string');
      
      // Try ID-based filter first (for features with top-level id)
      if (hasTopLevelId) {
        return ['==', ['id'], featureId];
      }
      
      // Create property-based filter using common ID properties
      // Use the first available property that could be a unique identifier
      if (props.GEOID) {
        return ['==', ['get', 'GEOID'], props.GEOID];
      } else if (props.geoid) {
        return ['==', ['get', 'geoid'], props.geoid];
      } else if (props.id) {
        return ['==', ['get', 'id'], props.id];
      } else if (props.ID) {
        return ['==', ['get', 'ID'], props.ID];
      } else if (props.GEOID10) {
        return ['==', ['get', 'GEOID10'], props.GEOID10];
      } else if (props.GEOID20) {
        return ['==', ['get', 'GEOID20'], props.GEOID20];
      } else if (props.blockgroup_id) {
        return ['==', ['get', 'blockgroup_id'], props.blockgroup_id];
      } else if (props.BLOCKGROUP_ID) {
        return ['==', ['get', 'BLOCKGROUP_ID'], props.BLOCKGROUP_ID];
      } else if (featureId !== null && featureId !== undefined) {
        // Last resort: try using featureId as a property value
        // Check common property names
        const propertyNames = Object.keys(props);
        for (const propName of propertyNames) {
          if (props[propName] === featureId) {
            return ['==', ['get', propName], featureId];
          }
        }
      }
      
      // If no ID found, return null (can't filter)
      console.warn('👥 PopulationIsochronesLayer: No filterable ID found', { featureId, props, hasTopLevelId });
      return null;
    };

    const updateHoverStyles = (featureId, featureProps = null) => {
      if (!mapInstance.getLayer(FILL_LAYER_ID) || !mapInstance.getLayer(OUTLINE_LAYER_ID)) {
        console.warn('👥 PopulationIsochronesLayer: Layers not available for hover');
        return;
      }
      
      const HIGHLIGHT_FILL_LAYER_ID = `${SOURCE_ID}-highlight-fill`;
      const HIGHLIGHT_OUTLINE_LAYER_ID = `${SOURCE_ID}-highlight-outline`;
      
      hoveredFeatureIdRef.current = featureId;
      
      if (featureId !== null) {
        const filter = createFeatureFilter(featureId, featureProps);
        
        if (!filter) {
          // Can't create filter, skip highlighting
          console.warn('👥 PopulationIsochronesLayer: Cannot create filter for feature', { featureId, featureProps });
          return;
        }
        
        try {
          // Create inverse filter to exclude the hovered feature from main layer
          const inverseFilter = createInverseFilter(filter);
          
          if (!inverseFilter) {
            console.warn('👥 PopulationIsochronesLayer: Cannot create inverse filter', filter);
            return;
          }
          
          // Apply filter to main layers to exclude hovered feature and dim the rest
          mapInstance.setFilter(FILL_LAYER_ID, inverseFilter);
          mapInstance.setFilter(OUTLINE_LAYER_ID, inverseFilter);
          mapInstance.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', 0.2);
          mapInstance.setPaintProperty(OUTLINE_LAYER_ID, 'line-opacity', 0.3);
          
          // Create or update highlight layer for the hovered feature
          if (!mapInstance.getLayer(HIGHLIGHT_FILL_LAYER_ID)) {
            const fillColorExpression = createStepExpression(thresholdsRef.current, COLOR_PALETTE);
            const outlineColorExpression = createStepExpression(thresholdsRef.current, OUTLINE_COLORS);
            
            // Add highlight fill layer AFTER the outline layer so it's on top
            mapInstance.addLayer({
              id: HIGHLIGHT_FILL_LAYER_ID,
              type: 'fill',
              source: SOURCE_ID,
              paint: {
                'fill-color': fillColorExpression,
                'fill-opacity': 0.9
              },
              filter: filter
            }, OUTLINE_LAYER_ID); // Add after outline layer
            
            // Add highlight outline layer after the highlight fill
            mapInstance.addLayer({
              id: HIGHLIGHT_OUTLINE_LAYER_ID,
              type: 'line',
              source: SOURCE_ID,
              paint: {
                'line-color': outlineColorExpression,
                'line-width': 3,
                'line-opacity': 1.0
              },
              filter: filter
            }, HIGHLIGHT_FILL_LAYER_ID);
          } else {
            // Update filter to show only the hovered feature
            mapInstance.setFilter(HIGHLIGHT_FILL_LAYER_ID, filter);
            mapInstance.setFilter(HIGHLIGHT_OUTLINE_LAYER_ID, filter);
          }
        } catch (error) {
          console.error('👥 PopulationIsochronesLayer: Error updating hover styles', error);
        }
      } else {
        // Reset to default dim state - all polygons dim, no highlight
        try {
          // Remove filters from main layers
          mapInstance.setFilter(FILL_LAYER_ID, null);
          mapInstance.setFilter(OUTLINE_LAYER_ID, null);
          // Set all polygons to dim opacity
          mapInstance.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', 0.2);
          mapInstance.setPaintProperty(OUTLINE_LAYER_ID, 'line-opacity', 0.3);
          
          // Remove highlight layers
          if (mapInstance.getLayer(HIGHLIGHT_OUTLINE_LAYER_ID)) {
            mapInstance.removeLayer(HIGHLIGHT_OUTLINE_LAYER_ID);
          }
          if (mapInstance.getLayer(HIGHLIGHT_FILL_LAYER_ID)) {
            mapInstance.removeLayer(HIGHLIGHT_FILL_LAYER_ID);
          }
        } catch (error) {
          console.error('👥 PopulationIsochronesLayer: Error resetting hover styles', error);
        }
      }
    };

    const getFeatureId = (feature) => {
      // Try multiple ways to get a unique identifier
      if (feature.id !== undefined && feature.id !== null) {
        return feature.id;
      }
      const props = feature.properties || {};
      // Try common GeoJSON ID properties
      return props.GEOID || props.geoid || props.id || props.ID || 
             props.GEOID10 || props.GEOID20 || props.blockgroup_id || 
             props.BLOCKGROUP_ID || null;
    };

    const handleMouseMove = (e) => {
      if (!mapInstance.getLayer(FILL_LAYER_ID)) return;
      
      // Query features at the mouse position - try both fill and outline layers
      const features = mapInstance.queryRenderedFeatures(e.point, {
        layers: [FILL_LAYER_ID, OUTLINE_LAYER_ID]
      });
      
      // Filter to only get features from our population layers
      const populationFeatures = features.filter(f => 
        f.layer.id === FILL_LAYER_ID || f.layer.id === OUTLINE_LAYER_ID
      );
      
      // Change cursor to pointer when hovering over a polygon
      if (mapInstance.getCanvas()) {
        mapInstance.getCanvas().style.cursor = populationFeatures.length > 0 ? 'pointer' : '';
      }
      
      if (populationFeatures.length > 0) {
        const feature = populationFeatures[0];
        const featureId = getFeatureId(feature);
        const featureProps = feature.properties || {};
        
        if (featureId !== null && featureId !== hoveredFeatureIdRef.current) {
          updateHoverStyles(featureId, featureProps);
        } else if (featureId === null) {
          // If we can't get an ID, try to use a combination of properties
          console.warn('👥 PopulationIsochronesLayer: Feature has no identifiable ID', featureProps);
        }
      } else {
        if (hoveredFeatureIdRef.current !== null) {
          updateHoverStyles(null);
        }
      }
    };

    const handleMouseLeave = () => {
      if (hoveredFeatureIdRef.current !== null) {
        updateHoverStyles(null);
      }
      if (mapInstance.getCanvas()) {
        mapInstance.getCanvas().style.cursor = '';
      }
    };

    const ensureLayer = async () => {
      try {
        if (cancelled || !visible) {
          return;
        }

        if (!datasetRef.current) {
          const response = await fetch(DATA_PATH);
          if (!response.ok) {
            throw new Error(`Failed to load ${DATA_PATH} (${response.status})`);
          }
          const json = await response.json();
          const enrichedFeatures = (json.features || []).map((feature) => {
            const population = (() => {
              const properties = feature?.properties || {};
              for (const key of POPULATION_KEYS) {
                if (properties[key] !== undefined && properties[key] !== null && properties[key] !== '') {
                  const parsed = Number(properties[key]);
                  if (Number.isFinite(parsed)) {
                    return parsed;
                  }
                }
              }
              return 0;
            })();
            return {
              ...feature,
              properties: {
                ...feature.properties,
                [POPULATION_PROPERTY]: population
              }
            };
          });
          datasetRef.current = {
            type: 'FeatureCollection',
            features: enrichedFeatures
          };
        }

        const dataset = datasetRef.current;
        if (!dataset?.features?.length) {
          return;
        }

        const populations = dataset.features.map((feature) => feature.properties?.[POPULATION_PROPERTY] ?? 0);
        thresholdsRef.current = computeQuantileStops(populations);

        if (mapInstance.getSource(SOURCE_ID)) {
          mapInstance.getSource(SOURCE_ID).setData(dataset);
        } else {
          mapInstance.addSource(SOURCE_ID, {
            type: 'geojson',
            data: dataset
          });
        }

        // Removed automatic fitBounds to prevent unwanted map flyTo animations
        // The map should remain at its current view when layers are toggled
        // if (!didFitBoundsRef.current && typeof mapInstance.fitBounds === 'function') {
        //   try {
        //     const [minLng, minLat, maxLng, maxLat] = turf.bbox(dataset);
        //     if (Number.isFinite(minLng) && Number.isFinite(minLat) && Number.isFinite(maxLng) && Number.isFinite(maxLat)) {
        //       mapInstance.fitBounds(
        //         [
        //           [minLng, minLat],
        //           [maxLng, maxLat]
        //         ],
        //         {
        //           padding: 48,
        //           duration: 1200
        //         }
        //       );
        //       didFitBoundsRef.current = true;
        //     }
        //   } catch (boundsError) {
        //     console.warn('PopulationIsochronesLayer: failed to compute bounds', boundsError);
        //   }
        // }

        const beforeLayer =
          mapInstance.getLayer('admin-1-boundary') ||
          mapInstance.getLayer('waterway-label') ||
          mapInstance.getLayer('road-label');

        const fillColorExpression = createStepExpression(thresholdsRef.current, COLOR_PALETTE);
        const outlineColorExpression = createStepExpression(thresholdsRef.current, OUTLINE_COLORS);

        if (!mapInstance.getLayer(FILL_LAYER_ID)) {
          mapInstance.addLayer(
            {
              id: FILL_LAYER_ID,
              type: 'fill',
              source: SOURCE_ID,
              paint: {
                'fill-color': fillColorExpression,
                'fill-opacity': 0.2 // Default: dim all polygons
              }
            },
            beforeLayer ? beforeLayer.id : undefined
          );
        } else {
          mapInstance.setPaintProperty(FILL_LAYER_ID, 'fill-color', fillColorExpression);
          mapInstance.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', 0.2); // Ensure dimmed
        }

        if (!mapInstance.getLayer(OUTLINE_LAYER_ID)) {
          mapInstance.addLayer(
            {
              id: OUTLINE_LAYER_ID,
              type: 'line',
              source: SOURCE_ID,
              paint: {
                'line-color': outlineColorExpression,
                'line-width': 0.8,
                'line-opacity': 0.3 // Default: dim all outlines
              }
            },
            FILL_LAYER_ID
          );
        } else {
          mapInstance.setPaintProperty(OUTLINE_LAYER_ID, 'line-color', outlineColorExpression);
          mapInstance.setPaintProperty(OUTLINE_LAYER_ID, 'line-opacity', 0.3); // Ensure dimmed
        }

        emitLegend();
        isMountedRef.current = true;
        
        // Attach hover event listeners after layers are created
        if (visible && !hoverHandlersAttachedRef.current) {
          mapInstance.on('mousemove', handleMouseMove);
          mapInstance.on('mouseout', handleMouseLeave);
          hoverHandlersAttachedRef.current = true;
        }
      } catch (error) {
        console.error('❌ PopulationIsochronesLayer: Failed to render population data', error);
      }
    };

    const handleStyleData = () => {
      if (!visible || cancelled) return;
      ensureLayer();
    };

    if (!visible) {
      // Remove hover handlers when layer is not visible
      if (hoverHandlersAttachedRef.current) {
        mapInstance.off('mousemove', handleMouseMove);
        mapInstance.off('mouseout', handleMouseLeave);
        hoverHandlersAttachedRef.current = false;
      }
      
      // Reset hover state
      if (hoveredFeatureIdRef.current !== null) {
        updateHoverStyles(null);
        hoveredFeatureIdRef.current = null;
      }
      
      if (isMountedRef.current && typeof window !== 'undefined' && window.mapEventBus) {
        window.mapEventBus.emit('population-isochrones:unmounted');
      }
      removeLayers();
      isMountedRef.current = false;
      didFitBoundsRef.current = false;
      if (styleListenerAttachedRef.current) {
        mapInstance.off('styledata', handleStyleData);
        styleListenerAttachedRef.current = false;
      }
      return undefined;
    }

    // Check if map is ready (more robust than just isStyleLoaded)
    // The map might be functional even if isStyleLoaded() returns false
    const isMapReady = mapInstance.isStyleLoaded() || 
                      (mapInstance.getStyle() && 
                       mapInstance.getStyle().layers && 
                       mapInstance.getStyle().layers.length > 0);

    if (!isMapReady) {
      const waitForStyle = () => {
        ensureLayer();
        mapInstance.off('styledata', waitForStyle);
      };
      mapInstance.on('styledata', waitForStyle);
      
      // Timeout fallback - proceed anyway after 2 seconds (like other layers do)
      const timeoutId = setTimeout(() => {
        if (visible && !cancelled) {
          ensureLayer();
        }
        if (mapInstance) {
          mapInstance.off('styledata', waitForStyle);
        }
      }, 2000); // 2 second timeout like other layers
      
      return () => {
        cancelled = true;
        clearTimeout(timeoutId);
        if (mapInstance) {
          mapInstance.off('styledata', waitForStyle);
        }
      };
    }

    ensureLayer();

    if (!styleListenerAttachedRef.current) {
      mapInstance.on('styledata', handleStyleData);
      styleListenerAttachedRef.current = true;
    }

    // Note: Hover event listeners are attached inside ensureLayer() after layers are created

    return () => {
      cancelled = true;
      
      // Remove hover event listeners
      if (hoverHandlersAttachedRef.current) {
        mapInstance.off('mousemove', handleMouseMove);
        mapInstance.off('mouseout', handleMouseLeave);
        hoverHandlersAttachedRef.current = false;
      }
      
      // Reset hover state
      if (hoveredFeatureIdRef.current !== null) {
        updateHoverStyles(null);
        hoveredFeatureIdRef.current = null;
      }
      
      if (!visible) {
        removeLayers();
      }
      if (styleListenerAttachedRef.current) {
        mapInstance.off('styledata', handleStyleData);
        styleListenerAttachedRef.current = false;
      }
    };
  }, [map, visible]);

  useEffect(() => {
    const mapInstance = map?.current;
    return () => {
      if (!mapInstance) return;
      
      // Remove highlight layers
      const HIGHLIGHT_FILL_LAYER_ID = `${SOURCE_ID}-highlight-fill`;
      const HIGHLIGHT_OUTLINE_LAYER_ID = `${SOURCE_ID}-highlight-outline`;
      if (mapInstance.getLayer(HIGHLIGHT_OUTLINE_LAYER_ID)) {
        mapInstance.removeLayer(HIGHLIGHT_OUTLINE_LAYER_ID);
      }
      if (mapInstance.getLayer(HIGHLIGHT_FILL_LAYER_ID)) {
        mapInstance.removeLayer(HIGHLIGHT_FILL_LAYER_ID);
      }
      
      if (mapInstance.getLayer(OUTLINE_LAYER_ID)) {
        mapInstance.removeLayer(OUTLINE_LAYER_ID);
      }
      if (mapInstance.getLayer(FILL_LAYER_ID)) {
        mapInstance.removeLayer(FILL_LAYER_ID);
      }
      if (mapInstance.getSource(SOURCE_ID)) {
        mapInstance.removeSource(SOURCE_ID);
      }
    };
  }, [map]);

  return null;
};

export default PopulationIsochronesLayer;
