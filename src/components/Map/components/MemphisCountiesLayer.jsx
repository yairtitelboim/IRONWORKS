import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';

const SOURCE_ID = 'memphis-counties-source';
const FILL_LAYER_ID = 'memphis-counties-fill';
const STROKE_LAYER_ID = 'memphis-counties-stroke';
const GEOJSON_URL = '/data/memphis/memphis_counties.geojson';

const FILL_OPACITY_EXPRESSION = [
  'case',
  ['boolean', ['feature-state', 'selected'], false], 0.55,
  ['case', ['==', ['get', 'project_count'], 0], 0.2, ['*', ['case', ['boolean', ['feature-state', 'adjacent'], false], 0.4, 0.1], ['interpolate', ['linear'], ['get', 'project_count'], 1, 0.05, 10, 0.08, 50, 0.12, 100, 0.2, 500, 0.4, 1000, 0.85, 2000, 0.9, 3000, 0.95]]]
];
const LINE_OPACITY_EXPRESSION = ['case', ['boolean', ['feature-state', 'selected'], false], 0.7, 0];

const MemphisCountiesLayer = ({ map, visible }) => {
  const geojsonDataRef = useRef(null);
  const selectedCountyIdRef = useRef(null);
  const adjacentCountyIdsRef = useRef(new Set());
  const fadeTimeoutRef = useRef(null);
  const lastMilestoneIdRef = useRef(null);

  useEffect(() => {
    if (!map?.current) return;

    // When toggle is off: remove layers and source (same as REIT)
    if (!visible) {
      try {
        if (map.current.getLayer(STROKE_LAYER_ID)) map.current.removeLayer(STROKE_LAYER_ID);
        if (map.current.getLayer(FILL_LAYER_ID)) map.current.removeLayer(FILL_LAYER_ID);
        if (map.current.getSource(SOURCE_ID)) map.current.removeSource(SOURCE_ID);
      } catch (e) {}
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
        fadeTimeoutRef.current = null;
      }
      return;
    }

    let cancelled = false;
    const mapInstance = map.current;

    const handleMouseEnter = () => {
      mapInstance.getCanvas().style.cursor = 'pointer';
    };
    const handleMouseLeave = () => {
      mapInstance.getCanvas().style.cursor = '';
    };
    const clearSelection = () => {
      if (selectedCountyIdRef.current == null) return;
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
        fadeTimeoutRef.current = null;
      }
      try {
        if (geojsonDataRef.current) {
          const featureToClear = geojsonDataRef.current.features.find(
            f => f.id === selectedCountyIdRef.current || String(f.id) === String(selectedCountyIdRef.current)
          );
          if (featureToClear?.properties) {
            featureToClear.properties._faded = false;
            const source = mapInstance.getSource(SOURCE_ID);
            if (source?.setData) source.setData(geojsonDataRef.current);
          }
        }
        mapInstance.setFeatureState(
          { source: SOURCE_ID, id: selectedCountyIdRef.current },
          { selected: false, faded: false }
        );
      } catch (err) {}
      adjacentCountyIdsRef.current.forEach(adjacentId => {
        if (adjacentId != null) {
          try {
            mapInstance.setFeatureState({ source: SOURCE_ID, id: adjacentId }, { adjacent: false });
          } catch (err) {}
        }
      });
      adjacentCountyIdsRef.current.clear();
      selectedCountyIdRef.current = null;
      mapInstance.triggerRepaint();
    };

    const handleMapClick = (e) => {
      const features = mapInstance.queryRenderedFeatures(e.point, { layers: [FILL_LAYER_ID] });
      if (features.length === 0 && selectedCountyIdRef.current != null) {
        clearSelection();
      }
    };

    const handleClick = (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const props = feature.properties;
      const coordinates = e.lngLat;
      const clickedCountyId = feature.id;
      if (clickedCountyId == null) return;

      try {
        if (feature.geometry) {
          const bbox = turf.bbox(feature.geometry);
          const centroid = turf.centroid(feature.geometry);
          const lngDiff = bbox[2] - bbox[0];
          const latDiff = bbox[3] - bbox[1];
          const maxDiff = Math.max(lngDiff, latDiff);
          let zoomLevel = 9;
          if (maxDiff < 0.1) zoomLevel = 11;
          else if (maxDiff < 0.2) zoomLevel = 10;
          else if (maxDiff < 0.5) zoomLevel = 9;
          else if (maxDiff < 1.0) zoomLevel = 8;
          else zoomLevel = 7;
          mapInstance.flyTo({
            center: centroid.geometry.coordinates,
            zoom: zoomLevel,
            duration: 1000,
            essential: true
          });
        } else {
          mapInstance.flyTo({
            center: [coordinates.lng, coordinates.lat],
            zoom: 9,
            duration: 1000,
            essential: true
          });
        }
      } catch (err) {
        try {
          mapInstance.flyTo({
            center: [coordinates.lng, coordinates.lat],
            zoom: 9,
            duration: 1000,
            essential: true
          });
        } catch (fallbackErr) {}
      }

      if (window.mapEventBus) {
        window.mapEventBus.emit('memphis-county:map-selected', {
          countyId: clickedCountyId,
          countyName: props?.NAME || props?.name,
          properties: props,
          geometry: feature.geometry
        });
      }

      // Clear previous selection
      if (selectedCountyIdRef.current != null) {
        if (fadeTimeoutRef.current) {
          clearTimeout(fadeTimeoutRef.current);
          fadeTimeoutRef.current = null;
        }
        try {
          if (geojsonDataRef.current) {
            const featureToClear = geojsonDataRef.current.features.find(f => f.id === selectedCountyIdRef.current);
            if (featureToClear?.properties) {
              featureToClear.properties._faded = false;
              const source = mapInstance.getSource(SOURCE_ID);
              if (source?.setData) source.setData(geojsonDataRef.current);
            }
          }
          mapInstance.setFeatureState(
            { source: SOURCE_ID, id: selectedCountyIdRef.current },
            { selected: false, faded: false }
          );
        } catch (err) {}
      }
      adjacentCountyIdsRef.current.forEach(adjacentId => {
        if (adjacentId != null) {
          try {
            mapInstance.setFeatureState({ source: SOURCE_ID, id: adjacentId }, { adjacent: false });
          } catch (err) {}
        }
      });
      adjacentCountyIdsRef.current.clear();

      if (selectedCountyIdRef.current === clickedCountyId) {
        selectedCountyIdRef.current = null;
        if (fadeTimeoutRef.current) {
          clearTimeout(fadeTimeoutRef.current);
          fadeTimeoutRef.current = null;
        }
        try {
          if (geojsonDataRef.current) {
            const featureToClear = geojsonDataRef.current.features.find(f => f.id === clickedCountyId);
            if (featureToClear?.properties) {
              featureToClear.properties._faded = false;
              const source = mapInstance.getSource(SOURCE_ID);
              if (source?.setData) source.setData(geojsonDataRef.current);
            }
          }
          mapInstance.setFeatureState(
            { source: SOURCE_ID, id: clickedCountyId },
            { selected: false, faded: false }
          );
        } catch (err) {}
        return;
      }

      selectedCountyIdRef.current = clickedCountyId;
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
        fadeTimeoutRef.current = null;
      }

      try {
        mapInstance.setFeatureState(
          { source: SOURCE_ID, id: clickedCountyId },
          { selected: true, faded: false }
        );

        fadeTimeoutRef.current = setTimeout(() => {
          if (selectedCountyIdRef.current === clickedCountyId && geojsonDataRef.current) {
            const featureToFade = geojsonDataRef.current.features.find(
              f => f.id === clickedCountyId || String(f.id) === String(clickedCountyId) || Number(f.id) === Number(clickedCountyId)
            );
            if (featureToFade?.properties) {
              featureToFade.properties._faded = true;
              const source = mapInstance.getSource(SOURCE_ID);
              if (source?.setData) source.setData(geojsonDataRef.current);
            }
            try {
              mapInstance.setFeatureState(
                { source: SOURCE_ID, id: clickedCountyId },
                { selected: true, faded: true }
              );
              mapInstance.triggerRepaint();
            } catch (err) {}
          }
        }, 2000);

        if (feature.geometry) {
          const clickedTurfFeature = turf.feature(feature.geometry);
          const allFeatures = mapInstance.querySourceFeatures(SOURCE_ID, {
            filter: ['!=', ['id'], clickedCountyId]
          });
          allFeatures.forEach(otherFeature => {
            if (otherFeature.geometry && otherFeature.id !== clickedCountyId) {
              try {
                const otherTurfFeature = turf.feature(otherFeature.geometry);
                if (turf.booleanTouches(clickedTurfFeature, otherTurfFeature)) {
                  try {
                    mapInstance.setFeatureState(
                      { source: SOURCE_ID, id: otherFeature.id },
                      { adjacent: true }
                    );
                    adjacentCountyIdsRef.current.add(otherFeature.id);
                  } catch (stateErr) {}
                }
              } catch (err) {}
            }
          });
          mapInstance.triggerRepaint();
        }
      } catch (err) {}
    };

    const applyMilestoneDim = (milestoneId) => {
      const dimmed = milestoneId != null;
      try {
        if (map.current.getLayer(FILL_LAYER_ID)) {
          map.current.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', dimmed ? 0.12 : FILL_OPACITY_EXPRESSION);
        }
        if (map.current.getLayer(STROKE_LAYER_ID)) {
          map.current.setPaintProperty(STROKE_LAYER_ID, 'line-opacity', dimmed ? 0.2 : LINE_OPACITY_EXPRESSION);
        }
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

    const addLayer = async () => {
      try {
        const resp = await fetch(GEOJSON_URL);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const geojsonData = await resp.json();
        if (cancelled) return;
        if (!geojsonData.features?.length) return;

        geojsonData.features.forEach((feature, index) => {
          if (feature.id != null && feature.id !== '') return;
          const countyName = feature.properties?.NAME || feature.properties?.name || feature.properties?.COUNTY || feature.properties?.county;
          const geoid = feature.properties?.GEOID || feature.properties?.geoid;
          if (geoid) feature.id = geoid;
          else if (countyName) feature.id = `county-${String(countyName).toLowerCase().replace(/\s+/g, '-')}`;
          else feature.id = `county-${index}`;
        });
        geojsonDataRef.current = geojsonData;

        if (cancelled) return;
        if (map.current.getLayer(STROKE_LAYER_ID)) map.current.removeLayer(STROKE_LAYER_ID);
        if (map.current.getLayer(FILL_LAYER_ID)) map.current.removeLayer(FILL_LAYER_ID);
        if (map.current.getSource(SOURCE_ID)) map.current.removeSource(SOURCE_ID);
        if (cancelled) return;

        map.current.addSource(SOURCE_ID, {
          type: 'geojson',
          data: geojsonData,
          generateId: true
        });

        const colorExpression = [
          'interpolate', ['linear'], ['get', 'project_count'],
          0, '#1a1a1a', 10, '#2d1414', 50, '#4a1f1f', 100, '#6b2a2a',
          500, '#8b3a3a', 1000, '#dc2626', 2000, '#b91c1c', 3000, '#991b1b'
        ];

        map.current.addLayer({
          id: FILL_LAYER_ID,
          type: 'fill',
          source: SOURCE_ID,
          paint: {
            'fill-color': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              'rgba(255, 213, 79, 0.55)',
              colorExpression
            ],
            'fill-opacity': FILL_OPACITY_EXPRESSION
          },
          minzoom: 4
        });

        map.current.addLayer({
          id: STROKE_LAYER_ID,
          type: 'line',
          source: SOURCE_ID,
          paint: {
            'line-color': [
              'case',
              ['all', ['boolean', ['feature-state', 'selected'], false], ['==', ['coalesce', ['get', '_faded'], false], true]],
              '#dc2626',
              ['all', ['boolean', ['feature-state', 'selected'], false], ['==', ['coalesce', ['get', '_faded'], false], false]],
              '#ffffff',
              '#ffffff'
            ],
            'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 3, 1],
            'line-opacity': LINE_OPACITY_EXPRESSION
          },
          minzoom: 4
        });

        if (cancelled) return;
        map.current.on('click', FILL_LAYER_ID, handleClick);
        map.current.on('click', handleMapClick);
        map.current.on('mouseenter', FILL_LAYER_ID, handleMouseEnter);
        map.current.on('mouseleave', FILL_LAYER_ID, handleMouseLeave);

        if (window.mapEventBus) {
          window.mapEventBus.emit('memphis-counties:mounted', { timestamp: Date.now() });
        }
        applyMilestoneDim(lastMilestoneIdRef.current);
      } catch (e) {
        console.error('Error loading Memphis counties GeoJSON', e);
      }
    };

    addLayer();

    return () => {
      unFocused?.();
      unCleared?.();
      applyMilestoneDim(null);
      cancelled = true;
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
        fadeTimeoutRef.current = null;
      }
      try {
        map.current?.off('click', FILL_LAYER_ID, handleClick);
        map.current?.off('click', handleMapClick);
        map.current?.off('mouseenter', FILL_LAYER_ID, handleMouseEnter);
        map.current?.off('mouseleave', FILL_LAYER_ID, handleMouseLeave);
        if (map.current?.getLayer(STROKE_LAYER_ID)) map.current.removeLayer(STROKE_LAYER_ID);
        if (map.current?.getLayer(FILL_LAYER_ID)) map.current.removeLayer(FILL_LAYER_ID);
        if (map.current?.getSource(SOURCE_ID)) map.current.removeSource(SOURCE_ID);
      } catch (e) {}
    };
  }, [map, visible]);

  return null;
};

export default MemphisCountiesLayer;
