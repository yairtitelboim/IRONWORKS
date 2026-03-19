import { useCallback, useEffect, useRef, useState } from 'react';

const BUFFER_SOURCE_ID = 'lake-whitney-shore-buffer-source';
const BUFFER_LAYER_ID = 'lake-whitney-shore-buffer-layer';
const RING_SOURCE_ID = 'lake-whitney-shore-ring-source';
const RING_LAYER_ID = 'lake-whitney-shore-ring-layer';
const SHORELINE_LAYER_ID = 'lake-whitney-shoreline-layer';
const SEGMENTS_SOURCE_ID = 'lake-whitney-shore-segments-source';
const SEGMENTS_LAYER_ID = 'lake-whitney-shore-segments-layer';
const SEGMENTS_OUTLINE_LAYER_ID = 'lake-whitney-shore-segments-outline-layer';

const BUFFER_COLOR = 'rgba(59, 130, 246, 0.35)';
const RING_COLOR = 'rgba(20, 184, 166, 0.55)';
const RING_OUTLINE = '#38bdf8';
const FOCUS_CENTER = [-97.405, 31.98];
const FOCUS_ZOOM = 11.8;
const OUTER_RADIUS_METERS = 18000;
const RING_WIDTH_METERS = 600;
const INNER_RADIUS_METERS = Math.max(OUTER_RADIUS_METERS - RING_WIDTH_METERS, 0);
const SEGMENT_COUNT = 32;
const SEGMENT_STEPS = 16;
const EARTH_RADIUS_METERS = 6378137;

const toRadians = (degrees) => (degrees * Math.PI) / 180;
const toDegrees = (radians) => (radians * 180) / Math.PI;

const projectOffset = (center, radiusMeters, angleRadians) => {
  const [centerLng, centerLat] = center;
  const angularDistance = radiusMeters / EARTH_RADIUS_METERS;
  const latRad = toRadians(centerLat);
  const lngRad = toRadians(centerLng);

  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinAngular = Math.sin(angularDistance);
  const cosAngular = Math.cos(angularDistance);
  const sinLatComponent = sinLat * cosAngular + cosLat * sinAngular * Math.cos(angleRadians);
  const lat = Math.asin(sinLatComponent);
  const lng = lngRad + Math.atan2(
    Math.sin(angleRadians) * sinAngular * cosLat,
    cosAngular - sinLat * Math.sin(lat)
  );

  return [toDegrees(lng), toDegrees(lat)];
};

const createCircleCoords = (center, radiusMeters, steps = 120) => {
  const coords = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * 2 * Math.PI;
    coords.push(projectOffset(center, radiusMeters, angle));
  }
  return coords;
};

const createRingFeature = (center, innerRadius, outerRadius, steps = 120) => {
  const outer = createCircleCoords(center, outerRadius, steps);
  const inner = createCircleCoords(center, innerRadius, steps).reverse();
  return {
    type: 'Feature',
    properties: {
      name: 'Lake Whitney Circular Ring'
    },
    geometry: {
      type: 'Polygon',
      coordinates: [outer, inner]
    }
  };
};

const createCircleFeature = (center, radiusMeters, steps = 120) => ({
  type: 'Feature',
  properties: {
    name: 'Lake Whitney Circular Buffer'
  },
  geometry: {
    type: 'Polygon',
    coordinates: [createCircleCoords(center, radiusMeters, steps)]
  }
});

const createRingSegmentFeature = (center, innerRadius, outerRadius, startAngle, endAngle, steps = SEGMENT_STEPS, id = 0) => {
  const outerArc = [];
  const innerArc = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const angle = startAngle + (endAngle - startAngle) * t;
    outerArc.push(projectOffset(center, outerRadius, angle));
  }
  for (let i = steps; i >= 0; i -= 1) {
    const t = i / steps;
    const angle = startAngle + (endAngle - startAngle) * t;
    innerArc.push(projectOffset(center, innerRadius, angle));
  }
  const coordinates = [...outerArc, ...innerArc, outerArc[0]];
  return {
    type: 'Feature',
    id,
    properties: {
      segment: id
    },
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates]
    }
  };
};

const createRingSegments = (center, innerRadius, outerRadius, segmentCount = SEGMENT_COUNT) => {
  const features = [];
  const step = (2 * Math.PI) / segmentCount;
  for (let i = 0; i < segmentCount; i += 1) {
    const startAngle = i * step;
    const endAngle = (i + 1) * step;
    features.push(createRingSegmentFeature(center, innerRadius, outerRadius, startAngle, endAngle, SEGMENT_STEPS, i));
  }
  return {
    type: 'FeatureCollection',
    features
  };
};

const LakeWhitneyShoreAnimation = ({ map, onClose }) => {
  const dataRef = useRef({ buffer: null, ring: null, segments: null });
  const isPlayingRef = useRef(false);
  const animationFrameRef = useRef(null);
  const startTimeRef = useRef(null);
  const mapInstance = map?.current;
  const [isReady, setIsReady] = useState(false);
  const segmentTimeoutsRef = useRef([]);

  const clearSegmentAnimations = useCallback(() => {
    if (segmentTimeoutsRef.current.length > 0) {
      segmentTimeoutsRef.current.forEach(timeoutId => clearTimeout(timeoutId));
      segmentTimeoutsRef.current = [];
    }
    if (!mapInstance || !dataRef.current.segments || !mapInstance.getSource(SEGMENTS_SOURCE_ID)) return;
    dataRef.current.segments.features.forEach(feature => {
      if (feature?.id !== undefined) {
        mapInstance.setFeatureState({ source: SEGMENTS_SOURCE_ID, id: feature.id }, { active: false });
      }
    });
  }, [mapInstance]);

  const cleanupLayers = useCallback(() => {
    if (!mapInstance) return;
    console.log('🌊 LakeWhitney: cleanupLayers start');
    clearSegmentAnimations();

    [SHORELINE_LAYER_ID, RING_LAYER_ID, BUFFER_LAYER_ID, SEGMENTS_OUTLINE_LAYER_ID, SEGMENTS_LAYER_ID].forEach(layerId => {
      if (mapInstance.getLayer(layerId)) {
        console.log('🌊 LakeWhitney: removing layer', layerId);
        mapInstance.removeLayer(layerId);
      }
    });

    [RING_SOURCE_ID, BUFFER_SOURCE_ID, SEGMENTS_SOURCE_ID].forEach(sourceId => {
      if (mapInstance.getSource(sourceId)) {
        console.log('🌊 LakeWhitney: removing source', sourceId);
        mapInstance.removeSource(sourceId);
      }
    });
  }, [clearSegmentAnimations, mapInstance]);

  const stopAnimation = useCallback(() => {
    if (isPlayingRef.current) {
      console.log('🌊 LakeWhitney: stopAnimation');
    }
    isPlayingRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    clearSegmentAnimations();
  }, [clearSegmentAnimations]);

  const animateRing = useCallback(() => {
    if (!mapInstance || !isPlayingRef.current) return;
    console.log('🌊 LakeWhitney: animateRing start');
    let loggedFirstFrame = false;
    const step = (timestamp) => {
      if (!mapInstance || !isPlayingRef.current) return;
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = (timestamp - startTimeRef.current) / 1000;
      const pulse = 0.28 + 0.18 * Math.sin(elapsed * 2.4);
      const outline = 0.55 + 0.25 * Math.cos(elapsed * 1.6);

      if (mapInstance.getLayer(RING_LAYER_ID)) {
        mapInstance.setPaintProperty(RING_LAYER_ID, 'fill-opacity', pulse);
      }

      if (mapInstance.getLayer(SHORELINE_LAYER_ID)) {
        mapInstance.setPaintProperty(SHORELINE_LAYER_ID, 'line-width', 1 + outline * 2);
        mapInstance.setPaintProperty(SHORELINE_LAYER_ID, 'line-opacity', 0.35 + outline * 0.4);
      }

      if (!loggedFirstFrame) {
        console.log('🌊 LakeWhitney: first animation frame applied');
        loggedFirstFrame = true;
      }

      animationFrameRef.current = requestAnimationFrame(step);
    };

    animationFrameRef.current = requestAnimationFrame(step);
  }, [mapInstance]);

  const runSegmentAnimation = useCallback(() => {
    if (!mapInstance || !dataRef.current.segments || !isPlayingRef.current || !mapInstance.getSource(SEGMENTS_SOURCE_ID)) {
      return;
    }
    clearSegmentAnimations();
    const features = dataRef.current.segments.features || [];
    if (features.length === 0) return;

    let index = 0;
    const highlightDuration = 1200;
    const cycleDelay = 220;

    const activateSegment = () => {
      if (!isPlayingRef.current || !mapInstance || !mapInstance.getSource(SEGMENTS_SOURCE_ID)) return;
      const feature = features[index];
      if (feature?.id !== undefined) {
        mapInstance.setFeatureState({ source: SEGMENTS_SOURCE_ID, id: feature.id }, { active: true });
        const deactivateTimeout = setTimeout(() => {
          if (mapInstance && mapInstance.getSource(SEGMENTS_SOURCE_ID)) {
            mapInstance.setFeatureState({ source: SEGMENTS_SOURCE_ID, id: feature.id }, { active: false });
          }
        }, highlightDuration);
        segmentTimeoutsRef.current.push(deactivateTimeout);
      }
      index = (index + 1) % features.length;
      const nextTimeout = setTimeout(activateSegment, cycleDelay);
      segmentTimeoutsRef.current.push(nextTimeout);
    };

    activateSegment();
  }, [clearSegmentAnimations, mapInstance]);

  const addSourcesAndLayers = useCallback(() => {
    if (!mapInstance || !dataRef.current.buffer || !dataRef.current.ring) return;

    console.log('🌊 LakeWhitney: adding sources and layers', {
      hasBuffer: Boolean(dataRef.current.buffer),
      hasRing: Boolean(dataRef.current.ring),
      hasSegments: Boolean(dataRef.current.segments)
    });

    cleanupLayers();

    if (!mapInstance.getSource(BUFFER_SOURCE_ID)) {
      mapInstance.addSource(BUFFER_SOURCE_ID, {
        type: 'geojson',
        data: dataRef.current.buffer
      });
    }

    if (!mapInstance.getSource(RING_SOURCE_ID)) {
      mapInstance.addSource(RING_SOURCE_ID, {
        type: 'geojson',
        data: dataRef.current.ring
      });
    }

    mapInstance.addLayer({
      id: BUFFER_LAYER_ID,
      type: 'fill',
      source: BUFFER_SOURCE_ID,
      paint: {
        'fill-color': BUFFER_COLOR,
        'fill-opacity': 0.5
      }
    });

    mapInstance.addLayer({
      id: RING_LAYER_ID,
      type: 'fill',
      source: RING_SOURCE_ID,
      paint: {
        'fill-color': RING_COLOR,
        'fill-opacity': 0.65,
        'fill-outline-color': RING_OUTLINE
      }
    });

    mapInstance.addLayer({
      id: SHORELINE_LAYER_ID,
      type: 'line',
      source: RING_SOURCE_ID,
      paint: {
        'line-color': '#f8fafc',
        'line-width': 3,
        'line-opacity': 0.8,
        'line-dasharray': [1, 1.5]
      }
    });

    if (dataRef.current.segments) {
      const segmentsData = dataRef.current.segments;

      if (!mapInstance.getSource(SEGMENTS_SOURCE_ID)) {
        mapInstance.addSource(SEGMENTS_SOURCE_ID, {
          type: 'geojson',
          data: segmentsData
        });
      } else {
        mapInstance.getSource(SEGMENTS_SOURCE_ID).setData(segmentsData);
      }

      if (!mapInstance.getLayer(SEGMENTS_LAYER_ID)) {
        mapInstance.addLayer({
          id: SEGMENTS_LAYER_ID,
          type: 'fill',
          source: SEGMENTS_SOURCE_ID,
          paint: {
            'fill-color': 'rgba(94, 234, 212, 0.45)',
            'fill-opacity': [
              'case',
              ['boolean', ['feature-state', 'active'], false],
              0.7,
              0.2
            ]
          }
        }, SHORELINE_LAYER_ID);
      }

      if (!mapInstance.getLayer(SEGMENTS_OUTLINE_LAYER_ID)) {
        mapInstance.addLayer({
          id: SEGMENTS_OUTLINE_LAYER_ID,
          type: 'line',
          source: SEGMENTS_SOURCE_ID,
          paint: {
            'line-color': '#22d3ee',
            'line-width': 1.5,
            'line-opacity': [
              'case',
              ['boolean', ['feature-state', 'active'], false],
              0.9,
              0.35
            ],
            'line-dasharray': [2, 2]
          }
        });
      }
    }
  }, [cleanupLayers, mapInstance]);

  const handleRestart = useCallback(() => {
    if (!mapInstance) return;
    console.log('🌊 LakeWhitney: handleRestart');
    stopAnimation();
    addSourcesAndLayers();
    if (typeof mapInstance.flyTo === 'function') {
      mapInstance.flyTo({
        center: FOCUS_CENTER,
        zoom: FOCUS_ZOOM,
        speed: 0.9,
        curve: 1.2,
        easing: (t) => t
      });
    }
    isPlayingRef.current = true;
    startTimeRef.current = null;
    animateRing();
    runSegmentAnimation();
  }, [addSourcesAndLayers, animateRing, mapInstance, runSegmentAnimation, stopAnimation]);

  const handlePlayPause = useCallback(() => {
    if (!isReady) return;
    if (isPlayingRef.current) {
      console.log('🌊 LakeWhitney: handlePlayPause stop');
      stopAnimation();
    } else {
      console.log('🌊 LakeWhitney: handlePlayPause start');
      isPlayingRef.current = true;
      animateRing();
      runSegmentAnimation();
    }
  }, [animateRing, isReady, runSegmentAnimation, stopAnimation]);

  const handleCleanup = useCallback(() => {
    console.log('🌊 LakeWhitney: handleCleanup invoked');
    stopAnimation();
    cleanupLayers();
    if (onClose) onClose();
  }, [cleanupLayers, onClose, stopAnimation]);

  useEffect(() => {
    console.log('🌊 LakeWhitney: generating circular shoreline geometry');
    const bufferFeature = createCircleFeature(FOCUS_CENTER, OUTER_RADIUS_METERS);
    const ringFeature = createRingFeature(FOCUS_CENTER, INNER_RADIUS_METERS, OUTER_RADIUS_METERS);
    const segmentsCollection = createRingSegments(FOCUS_CENTER, INNER_RADIUS_METERS, OUTER_RADIUS_METERS, SEGMENT_COUNT);

    dataRef.current = {
      buffer: {
        type: 'FeatureCollection',
        features: [bufferFeature]
      },
      ring: {
        type: 'FeatureCollection',
        features: [ringFeature]
      },
      segments: segmentsCollection
    };

    setIsReady(true);

    return () => {
      console.log('🌊 LakeWhitney: circular geometry cleanup');
      stopAnimation();
      cleanupLayers();
    };
  }, [cleanupLayers, stopAnimation]);

  useEffect(() => {
    if (!mapInstance) return;

    const controller = {
      handlePlayPause,
      handleRestart,
      handleCleanup,
      isPlaying: () => isPlayingRef.current
    };

    console.log('🌊 LakeWhitney: registering global controller');
    window.lakeWhitneyShoreAnimationRef = controller;

    return () => {
      if (window.lakeWhitneyShoreAnimationRef === controller) {
        console.log('🌊 LakeWhitney: deregistering global controller');
        window.lakeWhitneyShoreAnimationRef = null;
      }
      stopAnimation();
      cleanupLayers();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapInstance]);

  useEffect(() => {
    if (isReady && mapInstance) {
      console.log('🌊 LakeWhitney: auto restart on ready');
      handleRestart();
    }
  }, [handleRestart, isReady, mapInstance]);

  useEffect(() => {
    console.log('🌊 LakeWhitney: component mounted');
    return () => {
      console.log('🌊 LakeWhitney: component unmounted');
    };
  }, []);

  return null;
};

export default LakeWhitneyShoreAnimation;
