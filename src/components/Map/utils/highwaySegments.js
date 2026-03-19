import { useEffect } from 'react';
import * as turf from '@turf/turf';

// Custom hook for location circle effects
export const useLocationCircleEffect = (map, stateValue, sourceId, layerId, geoJsonPath, fillColor, displayName) => {
  useEffect(() => {
    if (!map) return;

    if (stateValue) {
      // Fetch and add the circle
      fetch(geoJsonPath)
        .then(response => response.json())
        .then(data => {
          // Add source
          if (!map.getSource(sourceId)) {
            map.addSource(sourceId, {
              type: 'geojson',
              data: data
            });
          }

          // Add layer if it doesn't exist
          if (!map.getLayer(layerId)) {
            map.addLayer({
              id: layerId,
              type: 'fill',
              source: sourceId,
              paint: {
                'fill-color': fillColor,
                'fill-opacity': 0.3,
                'fill-outline-color': fillColor
              }
            });
          }

        })
        .catch(error => {
          console.error(`❌ Error loading ${displayName} circle:`, error);
        });
    } else {
      // Remove layer and source
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    }
  }, [stateValue, map, sourceId, layerId, geoJsonPath, fillColor, displayName]);
};

// Custom hook for highway segment management
export const useHighwaySegmentEffect = (map, stateValue, sourceId, layerId, geoJsonPath, color, displayName, paintOverrides) => {
  useEffect(() => {
    if (!map) return;
    
    if (stateValue) {
      fetch(geoJsonPath)
        .then(res => res.json())
        .then(geojson => {
          if (!map.getSource(sourceId)) {
            map.addSource(sourceId, {
              type: 'geojson',
              data: geojson
            });
          } else {
            map.getSource(sourceId).setData(geojson);
          }
          if (!map.getLayer(layerId)) {
            map.addLayer({
              id: layerId,
              type: 'line',
              source: sourceId,
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': color,
                'line-width': 6,
                'line-opacity': 0.95,
                ...(paintOverrides || {})
              }
            });
          }
        })
        .catch(err => {
          console.error(`[${displayName} Toggle] Error loading GeoJSON:`, err);
        });
    } else {
      try {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }
      } catch (err) {
        console.error(`[${displayName} Toggle] Error cleaning up:`, err);
      }
    }
  }, [stateValue, map, sourceId, layerId, geoJsonPath, color, displayName, paintOverrides]);
};

// Custom hook for legacy route highlighting
export const useRouteHighlightEffect = (map, highlightOzonaFortStockton, ROUTE_SOURCE_ID, ROUTE_LAYER_ID, OZONA_COORDS, FORT_STOCKTON_COORDS) => {
  useEffect(() => {
    if (!map) return;
    
    if (highlightOzonaFortStockton) {
      let i10Coords = [];
      let i10FeatureCount = 0;
      try {
        const features = map.querySourceFeatures('composite', {
          sourceLayer: 'road',
        });
        // Collect all trunk/motorway lines
        const trunkLines = features
          .filter(f =>
            f.geometry.type === 'LineString' &&
            (f.properties?.type === 'trunk' || f.properties?.type === 'motorway')
          )
          .map(f => turf.lineString(f.geometry.coordinates));
        i10FeatureCount = trunkLines.length;

        if (trunkLines.length > 0) {
          const multi = turf.combine(turf.featureCollection(trunkLines));
          i10Coords = [];
          // Calculate and buffer the bbox
          let bbox = turf.bbox(turf.lineString([OZONA_COORDS, FORT_STOCKTON_COORDS]));
          // Buffer bbox by 0.2 degrees in all directions
          bbox = [bbox[0] - 0.2, bbox[1] - 0.2, bbox[2] + 0.2, bbox[3] + 0.2];
          if (multi && multi.geometry && multi.geometry.coordinates) {
            if (multi.geometry.type === 'MultiLineString') {
              multi.geometry.coordinates.forEach((coords, idx) => {
                const line = turf.lineString(coords);
                const clipped = turf.bboxClip(line, bbox);
                if (clipped.geometry && clipped.geometry.coordinates.length > 1) {
                  i10Coords.push(...clipped.geometry.coordinates);
                }
              });
            } else if (multi.geometry.type === 'LineString') {
              const line = turf.lineString(multi.geometry.coordinates);
              const clipped = turf.bboxClip(line, bbox);
              if (clipped.geometry && clipped.geometry.coordinates.length > 1) {
                i10Coords.push(...clipped.geometry.coordinates);
              }
            }
          }
        }
      } catch (err) {
        console.warn('[I-10 Highlight] Error querying source features:', err);
      }
      if (i10Coords.length < 2) {
        i10Coords = [OZONA_COORDS, FORT_STOCKTON_COORDS];
      }
      // Add or update GeoJSON source for the route
      if (!map.getSource(ROUTE_SOURCE_ID)) {
        map.addSource(ROUTE_SOURCE_ID, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: i10Coords
                },
                properties: {}
              }
            ]
          }
        });
      } else {
        map.getSource(ROUTE_SOURCE_ID).setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: i10Coords
              },
              properties: {}
            }
          ]
        });
      }
      // Add the highlight layer
      if (!map.getLayer(ROUTE_LAYER_ID)) {
        map.addLayer({
          id: ROUTE_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#FFD600', // bright yellow
            'line-width': 6,
            'line-opacity': 0.95
          }
        });
        // Move above all road layers if possible
        const roadLayer = map.getStyle().layers.find(l => l.id.includes('road'));
        if (roadLayer) {
          map.moveLayer(ROUTE_LAYER_ID);
        }
      }
    } else {
      // Remove the highlight layer and source
      if (map.getLayer(ROUTE_LAYER_ID)) {
        map.removeLayer(ROUTE_LAYER_ID);
      }
      if (map.getSource(ROUTE_SOURCE_ID)) {
        map.removeSource(ROUTE_SOURCE_ID);
      }
    }
  }, [highlightOzonaFortStockton, map, ROUTE_SOURCE_ID, ROUTE_LAYER_ID, OZONA_COORDS, FORT_STOCKTON_COORDS]);
};

// Custom hook for legacy I-10 toggle
export const useI10ToggleEffect = (map, showI10, I10_ROUTE_SOURCE_ID, I10_ROUTE_LAYER_ID) => {
  useEffect(() => {
    if (!map) return;
    
    if (showI10) {
      try {
        const features = map.querySourceFeatures('composite', {
          sourceLayer: 'road',
        });
        const i10Features = features.filter(f =>
          (f.properties?.type === 'trunk' || f.properties?.type === 'motorway') &&
          f.properties?.ref === '10'
        );
        if (i10Features.length === 0) {
          console.warn('[I-10 Toggle] No I-10 features found!');
          return;
        }
        // Collect all coordinates as an array of LineStrings
        const allLineStrings = i10Features.map(f => f.geometry.coordinates);
        // Add or update GeoJSON source for I-10 as MultiLineString
        const geojson = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'MultiLineString',
                coordinates: allLineStrings
              },
              properties: {}
            }
          ]
        };
        if (!map.getSource(I10_ROUTE_SOURCE_ID)) {
          map.addSource(I10_ROUTE_SOURCE_ID, {
            type: 'geojson',
            data: geojson
          });
        } else {
          map.getSource(I10_ROUTE_SOURCE_ID).setData(geojson);
        }
        // Add the pink highlight layer
        if (!map.getLayer(I10_ROUTE_LAYER_ID)) {
          map.addLayer({
            id: I10_ROUTE_LAYER_ID,
            type: 'line',
            source: I10_ROUTE_SOURCE_ID,
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#ff69b4', // pink
              'line-width': 6,
              'line-opacity': 0.95
            }
          });
        }
      } catch (err) {
        console.error('[I-10 Toggle] Error drawing I-10:', err);
      }
    } else {
      // Remove the I-10 layer and source
      try {
        if (map.getLayer(I10_ROUTE_LAYER_ID)) {
          map.removeLayer(I10_ROUTE_LAYER_ID);
        }
        if (map.getSource(I10_ROUTE_SOURCE_ID)) {
          map.removeSource(I10_ROUTE_SOURCE_ID);
        }
      } catch (err) {
        console.error('[I-10 Toggle] Error cleaning up I-10:', err);
      }
    }
  }, [showI10, map, I10_ROUTE_SOURCE_ID, I10_ROUTE_LAYER_ID]);
};

// Custom hook for legacy OSM route effects
export const useOSMRouteEffect = (map, showState, sourceId, layerId, geoJsonPath, color, displayName) => {
  useEffect(() => {
    if (!map) return;
    
    if (showState) {
      fetch(geoJsonPath)
        .then(res => res.json())
        .then(geojson => {
          if (!map.getSource(sourceId)) {
            map.addSource(sourceId, {
              type: 'geojson',
              data: geojson
            });
          } else {
            map.getSource(sourceId).setData(geojson);
          }
          if (!map.getLayer(layerId)) {
            map.addLayer({
              id: layerId,
              type: 'line',
              source: sourceId,
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              },
              paint: {
                'line-color': color,
                'line-width': 6,
                'line-opacity': 0.95
              }
            });
          }
        })
        .catch(err => {
          console.error(`[${displayName}] Error loading GeoJSON:`, err);
        });
    } else {
      try {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }
      } catch (err) {
        console.error(`[${displayName}] Error cleaning up:`, err);
      }
    }
  }, [showState, map, sourceId, layerId, geoJsonPath, color, displayName]);
};