import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

const SOURCE_ID = 'spatial-mismatch-counties-source';
const FILL_LAYER_ID = 'spatial-mismatch-counties-fill';
const STROKE_LAYER_ID = 'spatial-mismatch-counties-stroke';
const GEOJSON_URL = '/data/ercot/ercot_counties_with_dc.geojson';

// Simplified color scheme: Green = producer, Red = consumer, Purple = hybrid
const COLOR_PRODUCER = '#22c55e';   // Clear green
const COLOR_CONSUMER = '#ef4444';   // Clear red
const COLOR_HYBRID = '#a855f7';    // Clear purple

const SpatialMismatchCountiesLayer = ({ map, visible }) => {
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const sourceLoadedRef = useRef(false);
  const layersAddedRef = useRef(false);
  const hoveredCountyIdRef = useRef(null);
  const handlersAttachedRef = useRef(false);

  useEffect(() => {
    if (!map?.current) return;

    const mapInstance = map.current;

    const loadLayer = async () => {
      try {
        if (mapInstance.getSource(SOURCE_ID)) {
          sourceLoadedRef.current = true;
          if (!layersAddedRef.current) addLayers();
          return;
        }

        if (!mapInstance.isStyleLoaded()) {
          mapInstance.once('styledata', loadLayer);
          return;
        }

        // Don't fetch the 15 MB GeoJSON until the layer is actually visible.
        if (!visibleRef.current) return;

        fetch(GEOJSON_URL)
          .then(res => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
          .then(geojsonData => {
            if (!geojsonData.features?.length) return;

            geojsonData.features.forEach((feature, index) => {
              if (!feature.id && feature.id !== 0) {
                const geoid = feature.properties?.GEOID || feature.properties?.geoid;
                const countyName = feature.properties?.NAME || feature.properties?.name;
                feature.id = geoid || `sm-county-${(countyName || index).toString().toLowerCase().replace(/\s+/g, '-')}`;
              }
            });

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
          })
          .catch(err => console.error('[SpatialMismatch] Error loading GeoJSON:', err));
      } catch (error) {
        console.error('[SpatialMismatch] loadLayer error:', error);
      }
    };

    const addLayers = () => {
      if (layersAddedRef.current || !mapInstance.getSource(SOURCE_ID)) return;

      try {
        // Simple 3-way color: Green = producer, Red = consumer, Purple = hybrid
        const colorExpression = [
          'case',
          // Pure Producer: high energy (>1GW), low/no DCs — West Texas wind farms
          [
            'all',
            ['>', ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000], 1],
            ['<=', ['coalesce', ['get', 'dc_count'], 0], 1]
          ],
          COLOR_PRODUCER,
          // Pure Consumer: low energy (<0.5GW), has DCs — DFW/Austin metros
          [
            'all',
            ['<', ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000], 0.5],
            ['>', ['coalesce', ['get', 'dc_count'], 0], 0]
          ],
          COLOR_CONSUMER,
          // Hybrid: both high energy AND multiple DCs
          [
            'all',
            ['>=', ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000], 1],
            ['>=', ['coalesce', ['get', 'dc_count'], 0], 2]
          ],
          COLOR_HYBRID,
          // Low activity
          'rgba(0, 0, 0, 0)'
        ];

        const opacityExpression = [
          'case',
          ['any',
            ['all', ['>', ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000], 1], ['<=', ['coalesce', ['get', 'dc_count'], 0], 1]],
            ['all', ['<', ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000], 0.5], ['>', ['coalesce', ['get', 'dc_count'], 0], 0]],
            ['all', ['>=', ['/', ['coalesce', ['get', 'total_capacity_mw'], 0], 1000], 1], ['>=', ['coalesce', ['get', 'dc_count'], 0], 2]]
          ],
          0.45,
          0
        ];

        let beforeId = null;
        if (mapInstance.getLayer('ercot-counties-fill')) beforeId = 'ercot-counties-fill';
        else if (mapInstance.getLayer('texas-data-centers-layer')) beforeId = 'texas-data-centers-layer';

        if (!mapInstance.getLayer(FILL_LAYER_ID)) {
          mapInstance.addLayer({
            id: FILL_LAYER_ID,
            type: 'fill',
            source: SOURCE_ID,
            paint: {
              'fill-color': colorExpression,
              'fill-opacity': [
                'case',
                ['==', ['feature-state', 'hover'], true],
                0.65,
                opacityExpression
              ]
            },
            minzoom: 0,
            maxzoom: 8
          }, beforeId);
        }

        if (!mapInstance.getLayer(STROKE_LAYER_ID)) {
          mapInstance.addLayer({
            id: STROKE_LAYER_ID,
            type: 'line',
            source: SOURCE_ID,
            paint: {
              'line-color': ['case', ['==', ['feature-state', 'hover'], true], '#ffffff', 'rgba(0,0,0,0)'],
              'line-width': ['case', ['==', ['feature-state', 'hover'], true], 2, 0],
              'line-opacity': ['case', ['==', ['feature-state', 'hover'], true], 0.9, 0]
            },
            minzoom: 0
          }, FILL_LAYER_ID);
        }

        const handleMouseEnter = (e) => {
          if (e.features.length === 0) return;
          const fid = e.features[0].id;
          if (hoveredCountyIdRef.current === fid) return;
          if (hoveredCountyIdRef.current !== null) {
            mapInstance.setFeatureState({ source: SOURCE_ID, id: hoveredCountyIdRef.current }, { hover: false });
          }
          hoveredCountyIdRef.current = fid;
          mapInstance.setFeatureState({ source: SOURCE_ID, id: fid }, { hover: true });
          mapInstance.getCanvas().style.cursor = 'pointer';
        };

        const handleMouseLeave = () => {
          if (hoveredCountyIdRef.current !== null) {
            mapInstance.setFeatureState({ source: SOURCE_ID, id: hoveredCountyIdRef.current }, { hover: false });
            hoveredCountyIdRef.current = null;
          }
          mapInstance.getCanvas().style.cursor = '';
        };

        if (mapInstance.getLayer(FILL_LAYER_ID) && !handlersAttachedRef.current) {
          mapInstance.on('mouseenter', FILL_LAYER_ID, handleMouseEnter);
          mapInstance.on('mouseleave', FILL_LAYER_ID, handleMouseLeave);
          handlersAttachedRef.current = true;
        }

        layersAddedRef.current = true;
        updateVisibility();
      } catch (error) {
        console.error('[SpatialMismatch] addLayers error:', error);
      }
    };

    const updateVisibility = () => {
      try {
        const v = visibleRef.current ? 'visible' : 'none';
        if (mapInstance.getLayer(FILL_LAYER_ID)) mapInstance.setLayoutProperty(FILL_LAYER_ID, 'visibility', v);
        if (mapInstance.getLayer(STROKE_LAYER_ID)) mapInstance.setLayoutProperty(STROKE_LAYER_ID, 'visibility', v);
      } catch (e) {}
    };

    if (mapInstance.isStyleLoaded()) loadLayer();
    else mapInstance.once('styledata', loadLayer);
    const _loadLayerRef = loadLayer;

    if (sourceLoadedRef.current && layersAddedRef.current) updateVisibility();
    else {
      const check = () => {
        if (mapInstance.getLayer(FILL_LAYER_ID)) updateVisibility();
        else setTimeout(check, 100);
      };
      check();
    }

    return () => {
      mapInstance.off('styledata', _loadLayerRef);
      if (!mapInstance || !sourceLoadedRef.current) return;
      try {
        if (mapInstance.getLayer(FILL_LAYER_ID) && handlersAttachedRef.current) {
          mapInstance.off('mouseenter', FILL_LAYER_ID);
          mapInstance.off('mouseleave', FILL_LAYER_ID);
          handlersAttachedRef.current = false;
          if (hoveredCountyIdRef.current !== null) {
            mapInstance.setFeatureState({ source: SOURCE_ID, id: hoveredCountyIdRef.current }, { hover: false });
            hoveredCountyIdRef.current = null;
          }
          mapInstance.setLayoutProperty(FILL_LAYER_ID, 'visibility', 'none');
        }
        if (mapInstance.getLayer(STROKE_LAYER_ID)) {
          mapInstance.setLayoutProperty(STROKE_LAYER_ID, 'visibility', 'none');
        }
      } catch (e) {}
    };
  }, [map, visible]);

  return null;
};

export default SpatialMismatchCountiesLayer;
