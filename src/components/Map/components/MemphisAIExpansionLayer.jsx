import React, { useEffect, useRef } from 'react';
import * as turf from '@turf/turf';

const SOURCE_ID = 'memphis-ai-expansion-source';
const CIRCLES_LAYER_ID = 'memphis-ai-expansion-circles';

const NORMAL_RADIUS = ['case', ['==', ['get', 'status'], 'Approved'], 10, 8];
const DIMMED_RADIUS = ['case', ['==', ['get', 'status'], 'Approved'], 4, 3];

const MemphisAIExpansionLayer = ({ map, visible }) => {
  const sourceLoadedRef = useRef(false);
  const layersAddedRef = useRef(false);
  const lastMilestoneIdRef = useRef(null);

  useEffect(() => {
    if (!map?.current) return;

    const mapInstance = map.current;

    // When toggle is off: hide circles if they exist and do not load
    if (!visible) {
      try {
        if (mapInstance.isStyleLoaded() && mapInstance.getLayer(CIRCLES_LAYER_ID)) {
          mapInstance.setLayoutProperty(CIRCLES_LAYER_ID, 'visibility', 'none');
        }
      } catch (e) { /* style may be reset */ }
      return;
    }

    const loadLayer = async () => {
      try {
        // Check if source already exists
        if (mapInstance.getSource(SOURCE_ID)) {
          sourceLoadedRef.current = true;
          return;
        }

        // Wait for map to be ready
        if (!mapInstance.isStyleLoaded()) {
          mapInstance.once('styledata', loadLayer);
          return;
        }
        
        const dataSource = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [-89.9712, 35.1495] // xAI Southaven site
              },
              properties: {
                name: 'xAI Southaven',
                powerCapacity: '150 MW',
                substationProximity: 'High',
                constructionTimeline: '12-18 months',
                status: 'Approved'
              }
            },
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [-89.9389, 35.1167] // Third building location (hypothetical)
              },
              properties: {
                name: 'xAI Memphis Third Site',
                powerCapacity: '300 MW',
                substationProximity: 'Medium',
                constructionTimeline: '18-24 months',
                status: 'Pending Board Approval'
              }
            }
          ]
        };

        // Add source
        mapInstance.addSource(SOURCE_ID, {
          type: 'geojson',
          data: dataSource
        });

        sourceLoadedRef.current = true;
        
        // Add layers
        addLayers();

      } catch (error) {
        console.error('Error loading Memphis AI Expansion layer:', error);
      }
    };

    const addLayers = () => {
      if (layersAddedRef.current) return;
      if (!mapInstance.getSource(SOURCE_ID)) return;

      try {
        // Add circle layer
        if (!mapInstance.getLayer(CIRCLES_LAYER_ID)) {
          mapInstance.addLayer({
            id: CIRCLES_LAYER_ID,
            type: 'circle',
            source: SOURCE_ID,
            paint: {
              'circle-radius': NORMAL_RADIUS,
              'circle-color': [
                'case',
                ['==', ['get', 'substationProximity'], 'High'], '#00ff00',
                ['==', ['get', 'substationProximity'], 'Medium'], '#ffff00',
                '#ff0000'
              ],
              'circle-opacity': 0.7
            }
          });
        }

        layersAddedRef.current = true;
        updateVisibility();
        applyMilestoneDim(lastMilestoneIdRef.current);

      } catch (error) {
        console.error('Error adding Memphis AI Expansion layers:', error);
      }
    };

    const updateVisibility = () => {
      try {
        if (!mapInstance.isStyleLoaded()) return;
        if (mapInstance.getLayer(CIRCLES_LAYER_ID)) {
          mapInstance.setLayoutProperty(CIRCLES_LAYER_ID, 'visibility', visible ? 'visible' : 'none');
        }
      } catch (e) {
        // Style may have been reset
      }
    };

    const applyMilestoneDim = (milestoneId) => {
      const dimmed = milestoneId != null;
      try {
        if (!mapInstance.getLayer(CIRCLES_LAYER_ID)) return;
        mapInstance.setPaintProperty(CIRCLES_LAYER_ID, 'circle-opacity', dimmed ? 0.35 : 0.7);
        mapInstance.setPaintProperty(CIRCLES_LAYER_ID, 'circle-radius', dimmed ? DIMMED_RADIUS : NORMAL_RADIUS);
      } catch (e) { /* noop */ }
    };
    const onMilestoneFocused = (payload) => {
      lastMilestoneIdRef.current = payload?.milestoneId ?? null;
      applyMilestoneDim(lastMilestoneIdRef.current);
    };
    const onMilestoneCleared = () => {
      lastMilestoneIdRef.current = null;
      applyMilestoneDim(null);
    };
    const unFocused = window.mapEventBus?.on?.('memphis:milestoneFocused', onMilestoneFocused);
    const unCleared = window.mapEventBus?.on?.('memphis:milestoneCleared', onMilestoneCleared);

    // Load layer when map is ready
    if (mapInstance.isStyleLoaded()) {
      loadLayer();
    } else {
      mapInstance.once('styledata', loadLayer);
    }

    return () => {
      unFocused?.();
      unCleared?.();
      applyMilestoneDim(null);
      try {
        if (mapInstance.isStyleLoaded() && mapInstance.getLayer(CIRCLES_LAYER_ID)) {
          mapInstance.setLayoutProperty(CIRCLES_LAYER_ID, 'visibility', 'none');
        }
      } catch (e) {
        // Map/style may be disposed
      }
    };
  }, [map, visible]);

  return null;
};

export default MemphisAIExpansionLayer;