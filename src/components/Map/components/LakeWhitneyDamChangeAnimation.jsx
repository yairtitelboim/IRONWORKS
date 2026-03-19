import { useCallback, useEffect, useRef, useState } from 'react';

const PERIODS = [
  { start: 2019, end: 2020, label: '2019 → 2020', file: '/data/lake_whitney_dam/lake_whitney_dam_circle_2019_2020.geojson' },
  { start: 2020, end: 2021, label: '2020 → 2021', file: '/data/lake_whitney_dam/lake_whitney_dam_circle_2020_2021.geojson' },
  { start: 2021, end: 2022, label: '2021 → 2022', file: '/data/lake_whitney_dam/lake_whitney_dam_circle_2021_2022.geojson' },
  { start: 2022, end: 2023, label: '2022 → 2023', file: '/data/lake_whitney_dam/lake_whitney_dam_circle_2022_2023.geojson' },
  { start: 2023, end: 2024, label: '2023 → 2024', file: '/data/lake_whitney_dam/lake_whitney_dam_circle_2023_2024.geojson' },
  { start: 2024, end: 2025, label: '2024 → 2025', file: '/data/lake_whitney_dam/lake_whitney_dam_circle_2024_2025.geojson' }
];

const LAKE_WHITNEY_DAM_CENTER = [-97.367, 31.867];
const LAKE_WHITNEY_DAM_RADIUS_METERS = 4500;

const CHANGE_COLOR_RAMP = [
  'match',
  ['get', 'change_label'],
  'agriculture_loss', '#f97316',
  'agriculture_gain', '#22c55e',
  'industrial_expansion', '#f43f5e',
  'water_change', '#38bdf8',
  'persistent_agriculture', '#16a34a',
  '#6b7280'
];

const CHANGE_OUTLINE_COLOR = [
  'match',
  ['get', 'change_label'],
  'agriculture_loss', '#fb923c',
  'agriculture_gain', '#4ade80',
  'industrial_expansion', '#fb7185',
  'water_change', '#67e8f9',
  'persistent_agriculture', '#4ade80',
  '#94a3b8'
];

const CHANGE_COLOR_RAMP_SOFT = [
  'match',
  ['get', 'change_label'],
  'agriculture_loss', '#fdba74',
  'agriculture_gain', '#bbf7d0',
  'industrial_expansion', '#f9a8d4',
  'water_change', '#bae6fd',
  'persistent_agriculture', '#a7f3d0',
  '#cbd5f5'
];

const SITE_KEY = 'lake_whitney_dam';

const CHANGE_CALLOUTS = {
  agriculture_loss: { label: 'Agriculture Loss', color: '#f97316' },
  agriculture_gain: { label: 'Agriculture Gain', color: '#22c55e' },
  industrial_expansion: { label: 'Industrial Expansion', color: '#f43f5e' },
  water_change: { label: 'Water Change', color: '#38bdf8' },
  persistent_agriculture: { label: 'Persistent Agriculture', color: '#16a34a' }
};

const BASE_DASH_PATTERN = [1, 1.5];
const DASH_PATTERN_TOTAL = BASE_DASH_PATTERN.reduce((sum, value) => sum + value, 0);
const MIN_DASH_VALUE = 0.0001;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const computeDashArray = (phaseFraction) => {
  const normalizedPhase = ((phaseFraction % 1) + 1) % 1;
  const offsetDistance = normalizedPhase * DASH_PATTERN_TOTAL;

  let segmentIndex = 0;
  let remainingOffset = offsetDistance;

  while (remainingOffset > 0) {
    const segmentLength = BASE_DASH_PATTERN[segmentIndex];
    if (remainingOffset >= segmentLength) {
      remainingOffset -= segmentLength;
      segmentIndex = (segmentIndex + 1) % BASE_DASH_PATTERN.length;
    } else {
      break;
    }
  }

  const dashArray = [];
  const firstSegmentRemaining = BASE_DASH_PATTERN[segmentIndex] - remainingOffset;
  const isDashSegment = segmentIndex % 2 === 0;

  if (isDashSegment) {
    dashArray.push(Math.max(firstSegmentRemaining, MIN_DASH_VALUE));
    segmentIndex = (segmentIndex + 1) % BASE_DASH_PATTERN.length;
  } else {
    dashArray.push(MIN_DASH_VALUE);
    dashArray.push(Math.max(firstSegmentRemaining, MIN_DASH_VALUE));
    segmentIndex = (segmentIndex + 1) % BASE_DASH_PATTERN.length;
  }

  while (dashArray.length < 6) {
    dashArray.push(BASE_DASH_PATTERN[segmentIndex]);
    segmentIndex = (segmentIndex + 1) % BASE_DASH_PATTERN.length;
  }

  if (dashArray.length % 2 !== 0) {
    dashArray.push(BASE_DASH_PATTERN[segmentIndex]);
  }

  dashArray[0] = Math.max(dashArray[0], MIN_DASH_VALUE);

  return dashArray;
};

const createCircleCoords = (radiusMeters, steps = 256) => {
  const coords = [];
  const earthRadius = 6378137;
  const angularDistance = radiusMeters / earthRadius;
  const centerLatRad = (LAKE_WHITNEY_DAM_CENTER[1] * Math.PI) / 180;
  const centerLngRad = (LAKE_WHITNEY_DAM_CENTER[0] * Math.PI) / 180;

  for (let i = 0; i <= steps; i += 1) {
    const bearing = (2 * Math.PI * i) / steps;
    const sinLat = Math.sin(centerLatRad);
    const cosLat = Math.cos(centerLatRad);
    const sinAngular = Math.sin(angularDistance);
    const cosAngular = Math.cos(angularDistance);
    const latRad = Math.asin(
      sinLat * cosAngular + cosLat * sinAngular * Math.cos(bearing)
    );
    const lngRad = centerLngRad + Math.atan2(
      Math.sin(bearing) * sinAngular * cosLat,
      cosAngular - sinLat * Math.sin(latRad)
    );
    coords.push([(lngRad * 180) / Math.PI, (latRad * 180) / Math.PI]);
  }

  return coords;
};

const createSparkleFeatures = (radiusMeters, count = 14) => {
  const features = [];
  const coords = createCircleCoords(radiusMeters, count * 3);
  const step = Math.floor(coords.length / count);
  for (let i = 0; i < count; i += 1) {
    const point = coords[i * step] || coords[coords.length - 1];
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: point
      },
      properties: {
        sparklePhase: Math.random()
      }
    });
  }
  return features;
};

const calculateChangeCallouts = (geojsonData) => {
  if (!geojsonData?.features) return [];
  
  const callouts = [];
  const changeTypes = {};
  
  // Group features by change type
  geojsonData.features.forEach(feature => {
    const changeType = feature.properties?.change_label;
    if (changeType && CHANGE_CALLOUTS[changeType]) {
      if (!changeTypes[changeType]) {
        changeTypes[changeType] = [];
      }
      changeTypes[changeType].push(feature);
    }
  });
  
  // Calculate centroid for each change type
  Object.entries(changeTypes).forEach(([changeType, features]) => {
    if (features.length === 0) return;
    
    // Find the largest polygon by area
    let largestFeature = null;
    let maxArea = 0;
    
    features.forEach(feature => {
      if (feature.geometry?.type === 'Polygon' && feature.properties?.area_ha) {
        const area = feature.properties.area_ha;
        if (area > maxArea) {
          maxArea = area;
          largestFeature = feature;
        }
      }
    });
    
    if (largestFeature) {
      // Calculate centroid of the largest polygon
      const coords = largestFeature.geometry.coordinates[0];
      let centroidLng = 0;
      let centroidLat = 0;
      
      coords.forEach(coord => {
        centroidLng += coord[0];
        centroidLat += coord[1];
      });
      
      centroidLng /= coords.length;
      centroidLat /= coords.length;
      
      // Calculate total area for this change type
      const totalArea = features.reduce((sum, f) => sum + (f.properties?.area_ha || 0), 0);
      
      callouts.push({
        changeType,
        coordinates: [centroidLng, centroidLat],
        area: totalArea,
        featureCount: features.length,
        config: CHANGE_CALLOUTS[changeType]
      });
    }
  });
  
  return callouts;
};

const LakeWhitneyDamChangeAnimation = ({ map, onClose }) => {
  const [periodData, setPeriodData] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [, setCurrentCallouts] = useState([]);
  const [timelineHighlightKey, setTimelineHighlightKey] = useState(null);
  const playbackRef = useRef(null);
  const mountedRef = useRef(false);
  const activeLayersRef = useRef([]);
  const circleLayerRef = useRef(null);
  const animationIntervalRef = useRef(null);
  const periodAnimationFramesRef = useRef([]);
  const haloPulseRef = useRef(0);
  const calloutLayersRef = useRef([]);

  const playbackDelay = 1300;

  const mapInstance = map?.current;

  const applyTimelineLegendHighlight = useCallback((seriesKey, fillId, m, lineId = null) => {
    if (!m) return;
    const match = seriesKey && CHANGE_CALLOUTS[seriesKey] ? seriesKey : null;
    
    if (fillId && m.getLayer(fillId)) {
      m.setPaintProperty(fillId, 'fill-extrusion-color',
        match ? ['case', ['==', ['get', 'change_label'], match], CHANGE_COLOR_RAMP, 'rgba(17,24,39,0.28)']
              : CHANGE_COLOR_RAMP);
    }
    
    if (lineId && m.getLayer(lineId)) {
      m.setPaintProperty(lineId, 'line-color',
        match ? ['case', ['==', ['get', 'change_label'], match], CHANGE_OUTLINE_COLOR, 'rgba(30,41,59,0.4)']
              : CHANGE_OUTLINE_COLOR);
    }
  }, []);

  const handleTimelineLegendFocus = useCallback((payload) => {
    if (payload.siteKey && payload.siteKey !== SITE_KEY) return;
    const nextKey = payload.seriesKey && CHANGE_CALLOUTS[payload.seriesKey] ? payload.seriesKey : null;
    setTimelineHighlightKey(nextKey);
  }, []);

  useEffect(() => {
    if (!mapInstance) return;
    activeLayersRef.current.forEach(({ fillId, lineId }) => {
      applyTimelineLegendHighlight(timelineHighlightKey, fillId, mapInstance, lineId);
    });
  }, [timelineHighlightKey, applyTimelineLegendHighlight, mapInstance]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.mapEventBus?.on) return;
    window.mapEventBus.on('timeline:legendFocus', handleTimelineLegendFocus);
    return () => {
      if (window.mapEventBus?.off) {
        window.mapEventBus.off('timeline:legendFocus', handleTimelineLegendFocus);
      }
    };
  }, [handleTimelineLegendFocus]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopPlayback();
      removeAddedLayers();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const removeCircleLayer = useCallback(() => {
    if (!mapInstance) return;
    if (!circleLayerRef.current) return;
    const {
      sourceId,
      fillId,
      outlineId,
      haloInnerLayerId,
      haloInnerSourceId,
      haloOuterLayerId,
      haloOuterSourceId,
      sparkleLayerId,
      sparkleSourceId
    } = circleLayerRef.current;

    [
      sparkleLayerId,
      haloInnerLayerId,
      haloOuterLayerId,
      fillId,
      outlineId
    ].forEach(layerId => {
      if (layerId && mapInstance.getLayer(layerId)) {
        mapInstance.removeLayer(layerId);
      }
    });

    [
      sparkleSourceId,
      haloInnerSourceId,
      haloOuterSourceId,
      sourceId
    ].forEach(source => {
      if (source && mapInstance.getSource(source)) {
        mapInstance.removeSource(source);
      }
    });

    circleLayerRef.current = null;
    haloPulseRef.current = 0;
  }, [mapInstance]);

  // Animate circle layers with pulse and spin effects
  const animateCircleLayers = useCallback(() => {
    if (!mapInstance || !circleLayerRef.current || !isPlaying) return;

    const {
      fillId,
      outlineId,
      haloInnerLayerId,
      haloOuterLayerId,
      sparkleLayerId
    } = circleLayerRef.current;
    
    // Additional safety checks
    if (!fillId || !outlineId) {
      console.warn('⚠️ Circle layer IDs not properly initialized');
      return;
    }
    
    // Check if layers actually exist on the map
    if (!mapInstance.getLayer(fillId) || !mapInstance.getLayer(outlineId)) {
      console.warn('⚠️ Circle layers not found on map, skipping animation');
      return;
    }
    
    let animationTime = 0;

  const animate = () => {
      if (!isPlaying || !mountedRef.current) return;
      
      // Check if layers still exist during animation
      if (!mapInstance.getLayer(fillId) || !mapInstance.getLayer(outlineId)) {
        console.warn('⚠️ Circle layers removed during animation, stopping');
        if (animationIntervalRef.current) {
          cancelAnimationFrame(animationIntervalRef.current);
          animationIntervalRef.current = null;
        }
        return;
      }

      animationTime += 0.05;
      const dashPhase = ((animationTime * 0.5) % DASH_PATTERN_TOTAL) / DASH_PATTERN_TOTAL;
      const dashArray = computeDashArray(dashPhase);
      const fillColor = 'rgba(234, 179, 8, 0.22)';
      const outlineColor = 'rgba(234, 179, 8, 0.48)';
      const lineColor = 'rgba(202, 138, 4, 0.72)';
      
      // Update fill layer with error handling
      if (mapInstance.getLayer(fillId)) {
        try {
          mapInstance.setPaintProperty(fillId, 'fill-color', fillColor);
          mapInstance.setPaintProperty(fillId, 'fill-outline-color', outlineColor);
        } catch (error) {
          console.warn('⚠️ Error updating fill layer paint properties:', error);
          // Stop animation if layer is invalid
          if (animationIntervalRef.current) {
            cancelAnimationFrame(animationIntervalRef.current);
            animationIntervalRef.current = null;
          }
          return;
        }
      }
      
      // Update outline layer with error handling
      if (mapInstance.getLayer(outlineId)) {
        try {
          mapInstance.setPaintProperty(outlineId, 'line-color', lineColor);
          mapInstance.setPaintProperty(outlineId, 'line-dasharray', dashArray);
        } catch (error) {
          console.warn('⚠️ Error updating outline layer paint properties:', error);
          // Stop animation if layer is invalid
          if (animationIntervalRef.current) {
            cancelAnimationFrame(animationIntervalRef.current);
            animationIntervalRef.current = null;
          }
          return;
        }
      }
      
      const innerOpacity = 0.2;
      const outerOpacity = 0.1;

      if (haloInnerLayerId && mapInstance.getLayer(haloInnerLayerId)) {
        mapInstance.setPaintProperty(haloInnerLayerId, 'fill-opacity', innerOpacity);
      }

      if (haloOuterLayerId && mapInstance.getLayer(haloOuterLayerId)) {
        mapInstance.setPaintProperty(haloOuterLayerId, 'fill-opacity', outerOpacity);
      }

      if (sparkleLayerId && mapInstance.getLayer(sparkleLayerId)) {
        mapInstance.setPaintProperty(sparkleLayerId, 'circle-opacity', 0.06);
        mapInstance.setPaintProperty(sparkleLayerId, 'circle-radius', 3);
      }

      animationIntervalRef.current = requestAnimationFrame(animate);
    };

    animate();
  }, [mapInstance, isPlaying]);

  const scheduleAnimationFrame = useCallback((callback) => {
    const frameId = requestAnimationFrame((timestamp) => {
      periodAnimationFramesRef.current = periodAnimationFramesRef.current.filter(id => id !== frameId);
      callback(timestamp);
    });
    periodAnimationFramesRef.current.push(frameId);
    return frameId;
  }, [periodAnimationFramesRef]);

  const cancelPendingPeriodAnimations = useCallback(() => {
    periodAnimationFramesRef.current.forEach(id => cancelAnimationFrame(id));
    periodAnimationFramesRef.current = [];
  }, [periodAnimationFramesRef]);

  const animateLayerOpacity = useCallback((fillId, targetOpacity, duration = 600) => {
    if (!mapInstance?.getLayer(fillId)) {
      return;
    }

    const existing = mapInstance.getPaintProperty(fillId, 'fill-extrusion-opacity');
    const startOpacity = typeof existing === 'number' ? existing : targetOpacity;
    const startTime = performance.now();

    const step = (now) => {
      if (!mapInstance?.getLayer(fillId)) {
        return;
      }

      const progress = Math.min((now - startTime) / duration, 1);
      const eased = easeInOutCubic(progress);
      const value = startOpacity + (targetOpacity - startOpacity) * eased;
      mapInstance.setPaintProperty(fillId, 'fill-extrusion-opacity', clamp(value));

      if (progress < 1) {
        scheduleAnimationFrame(step);
      }
    };

    scheduleAnimationFrame(step);
  }, [mapInstance, scheduleAnimationFrame]);

  const animateLayerIn = useCallback((fillId, config) => {
    const { baseHeight, heightExpression, heightScale, changeOffsetExpression } = config;
    if (!mapInstance?.getLayer(fillId)) {
      return;
    }

    const targetOpacity = 0.62;
    const minOpacity = 0.18;
    const duration = 900;
    const startTime = performance.now();

    const step = (now) => {
      if (!mapInstance?.getLayer(fillId)) {
        return;
      }

      const progress = Math.min((now - startTime) / duration, 1);
      const eased = easeInOutCubic(progress);
      const scaledHeight = heightScale * Math.max(eased, 0.05);
      const currentHeightExpression = ['+', baseHeight, changeOffsetExpression, ['*', heightExpression, scaledHeight]];
      const opacityValue = minOpacity + (targetOpacity - minOpacity) * eased;

      mapInstance.setPaintProperty(fillId, 'fill-extrusion-opacity', clamp(opacityValue));
      mapInstance.setPaintProperty(fillId, 'fill-extrusion-height', currentHeightExpression);

      if (progress < 1) {
        scheduleAnimationFrame(step);
      } else {
        mapInstance.setPaintProperty(fillId, 'fill-extrusion-opacity', clamp(targetOpacity));
        const finalExpression = ['+', baseHeight, changeOffsetExpression, ['*', heightExpression, heightScale]];
        mapInstance.setPaintProperty(fillId, 'fill-extrusion-height', finalExpression);
        mapInstance.setPaintProperty(fillId, 'fill-extrusion-color', CHANGE_COLOR_RAMP);
      }
    };

    scheduleAnimationFrame(step);
  }, [mapInstance, scheduleAnimationFrame]);

  const animateOutlineGlow = useCallback((outlineId) => {
    if (!mapInstance?.getLayer(outlineId)) {
      return;
    }

    const baseWidth = mapInstance.getPaintProperty(outlineId, 'line-width') ?? 1.2;
    const glowWidth = baseWidth * 3.2;
    const glowColor = '#f472b6';
    const glowOpacity = 0.95;
    const baseOpacity = 0.75;
    const growDuration = 260;
    const totalDuration = 700;
    const startTime = performance.now();

    mapInstance.setPaintProperty(outlineId, 'line-color', glowColor);
    mapInstance.setPaintProperty(outlineId, 'line-opacity', glowOpacity);

    const step = (now) => {
      if (!mapInstance?.getLayer(outlineId)) {
        return;
      }

      const elapsed = now - startTime;

      if (elapsed >= totalDuration) {
        mapInstance.setPaintProperty(outlineId, 'line-width', baseWidth);
        mapInstance.setPaintProperty(outlineId, 'line-color', CHANGE_OUTLINE_COLOR);
        mapInstance.setPaintProperty(outlineId, 'line-opacity', baseOpacity);
        return;
      }

      if (elapsed <= growDuration) {
        const t = easeInOutCubic(elapsed / growDuration);
        const width = baseWidth + (glowWidth - baseWidth) * t;
        mapInstance.setPaintProperty(outlineId, 'line-width', width);
      } else {
        const remaining = totalDuration - growDuration;
        const t = easeInOutCubic((elapsed - growDuration) / remaining);
        const width = glowWidth + (baseWidth - glowWidth) * t;
        mapInstance.setPaintProperty(outlineId, 'line-width', width);
      }

      scheduleAnimationFrame(step);
    };

    scheduleAnimationFrame(step);
  }, [mapInstance, scheduleAnimationFrame]);

  const animateShadowIn = useCallback((shadowId, targetOpacity = 0.18) => {
    if (!mapInstance?.getLayer(shadowId)) {
      return;
    }

    const startTime = performance.now();
    const duration = 800;

    mapInstance.setPaintProperty(shadowId, 'fill-opacity', 0);

    const step = (now) => {
      if (!mapInstance?.getLayer(shadowId)) {
        return;
      }

      const progress = Math.min((now - startTime) / duration, 1);
      const eased = easeInOutCubic(progress);
      const value = targetOpacity * eased;
      mapInstance.setPaintProperty(shadowId, 'fill-opacity', clamp(value));

      if (progress < 1) {
        scheduleAnimationFrame(step);
      } else {
        mapInstance.setPaintProperty(shadowId, 'fill-opacity', clamp(targetOpacity));
      }
    };

    scheduleAnimationFrame(step);
  }, [mapInstance, scheduleAnimationFrame]);

  const addCalloutLayers = useCallback((callouts, periodMeta) => {
    if (!mapInstance || callouts.length === 0) return;

    const suffix = periodMeta ? `${periodMeta.start}-${periodMeta.end}-${Date.now()}` : Date.now();
    const sourceId = `apache-junction-callouts-source-${suffix}`;
    const layerId = `apache-junction-callouts-labels-${suffix}`;

    // Create callout features
    const calloutFeatures = callouts.map((callout, index) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: callout.coordinates
      },
      properties: {
        id: `callout-${index}`,
        changeType: callout.changeType,
        area: callout.area,
        featureCount: callout.featureCount,
        label: `${callout.config.label}: +${callout.area.toFixed(1)} ha`,
        color: callout.config.color
      }
    }));

    // Add source
    if (mapInstance.getSource(sourceId)) {
      mapInstance.removeSource(sourceId);
    }

    mapInstance.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: calloutFeatures
      }
    });

    // Add layer
    if (mapInstance.getLayer(layerId)) {
      mapInstance.removeLayer(layerId);
    }

    mapInstance.addLayer({
      id: layerId,
      type: 'symbol',
      source: sourceId,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': 12,
        'text-anchor': 'center',
        'text-offset': [0, -1.5],
        'text-allow-overlap': true,
        'text-ignore-placement': true
      },
      paint: {
        'text-color': ['get', 'color'],
        'text-halo-color': 'rgba(15, 23, 42, 0.8)',
        'text-halo-width': 2,
        'text-halo-blur': 1,
        'text-opacity': 0
      }
    });

    // Animate callouts in
    const startTime = performance.now();
    const duration = 1000;

    const animateCallouts = (now) => {
      if (!mapInstance?.getLayer(layerId)) return;

      const progress = clamp((now - startTime) / duration);
      const eased = easeInOutCubic(progress);
      mapInstance.setPaintProperty(layerId, 'text-opacity', clamp(eased));

      if (progress < 1) {
        requestAnimationFrame(animateCallouts);
      }
    };

    requestAnimationFrame(animateCallouts);

    const trackedLayers = [{ sourceId, layerId }];

    callouts.forEach((callout, index) => {
      const { coordinates, config } = callout;
      if (!coordinates) return;

      const lineSourceId = `${sourceId}-connector-${index}`;
      const lineLayerId = `${layerId}-connector-${index}`;
      const targetCoords = [
        coordinates[0] + 0.005 * Math.sin(index),
        coordinates[1] + 0.005 * Math.cos(index)
      ];

      mapInstance.addSource(lineSourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [coordinates, targetCoords]
          }
        }
      });

      mapInstance.addLayer({
        id: lineLayerId,
        type: 'line',
        source: lineSourceId,
        paint: {
          'line-color': config?.color || '#f97316',
          'line-width': 1,
          'line-opacity': 0.9
        }
      });

      trackedLayers.push({ sourceId: lineSourceId, layerId: lineLayerId });
    });

    calloutLayersRef.current = trackedLayers;
  }, [mapInstance]);

  const removeCalloutLayers = useCallback(() => {
    if (!mapInstance) return;

    calloutLayersRef.current.forEach(({ sourceId, layerId }) => {
      if (mapInstance.getLayer(layerId)) {
        mapInstance.removeLayer(layerId);
      }
      if (mapInstance.getSource(sourceId)) {
        mapInstance.removeSource(sourceId);
      }
    });

    calloutLayersRef.current = [];
  }, [mapInstance]);

  // Stop circle animation
  const stopCircleAnimation = useCallback(() => {
    if (animationIntervalRef.current) {
      cancelAnimationFrame(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }
    if (mapInstance && circleLayerRef.current?.outlineId) {
      const {
        outlineId,
        haloInnerLayerId,
        haloOuterLayerId,
        sparkleLayerId
      } = circleLayerRef.current;
      if (mapInstance.getLayer(outlineId)) {
        try {
          mapInstance.setPaintProperty(outlineId, 'line-dasharray', BASE_DASH_PATTERN);
        } catch (error) {
          console.warn('⚠️ Error resetting dash array after animation stop:', error);
        }
      }

      if (haloInnerLayerId && mapInstance.getLayer(haloInnerLayerId)) {
        mapInstance.setPaintProperty(haloInnerLayerId, 'fill-opacity', 0);
      }
      if (haloOuterLayerId && mapInstance.getLayer(haloOuterLayerId)) {
        mapInstance.setPaintProperty(haloOuterLayerId, 'fill-opacity', 0);
      }
      if (sparkleLayerId && mapInstance.getLayer(sparkleLayerId)) {
        mapInstance.setPaintProperty(sparkleLayerId, 'circle-opacity', 0);
      }
    }
    haloPulseRef.current = 0;
  }, [mapInstance]);

  const addCircleLayer = useCallback(() => {
    if (!mapInstance || circleLayerRef.current) return;

    const circleSourceId = 'apache-junction-site-circle-source';
    const haloInnerSourceId = 'apache-junction-site-halo-inner-source';
    const haloOuterSourceId = 'apache-junction-site-halo-outer-source';
    const sparkleSourceId = 'apache-junction-site-sparkles-source';

    const fillId = 'apache-junction-site-circle-fill';
    const outlineId = 'apache-junction-site-circle-outline';
    const haloInnerLayerId = 'apache-junction-site-halo-inner';
    const haloOuterLayerId = 'apache-junction-site-halo-outer';
    const sparkleLayerId = 'apache-junction-site-sparkles';

    const circleCoords = createCircleCoords(LAKE_WHITNEY_DAM_RADIUS_METERS);
    const haloInnerCoords = createCircleCoords(LAKE_WHITNEY_DAM_RADIUS_METERS * 0.85);
    const haloOuterCoords = createCircleCoords(LAKE_WHITNEY_DAM_RADIUS_METERS * 1.32);
    const sparkleFeatures = createSparkleFeatures(LAKE_WHITNEY_DAM_RADIUS_METERS * 1.05, 16);

    mapInstance.addSource(circleSourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [circleCoords]
        }
      }
    });

    mapInstance.addSource(haloInnerSourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [haloInnerCoords]
        }
      }
    });

    mapInstance.addSource(haloOuterSourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [haloOuterCoords]
        }
      }
    });

    mapInstance.addSource(sparkleSourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: sparkleFeatures
      }
    });

    mapInstance.addLayer({
      id: haloOuterLayerId,
      type: 'fill',
      source: haloOuterSourceId,
      paint: {
        'fill-color': 'rgba(234, 179, 8, 0.2)',
        'fill-opacity': 0,
        'fill-outline-color': 'rgba(202, 138, 4, 0)'
      }
    });

    mapInstance.addLayer({
      id: haloInnerLayerId,
      type: 'fill',
      source: haloInnerSourceId,
      paint: {
        'fill-color': 'rgba(234, 179, 8, 0.28)',
        'fill-opacity': 0,
        'fill-outline-color': 'rgba(202, 138, 4, 0)'
      }
    });

    mapInstance.addLayer({
      id: fillId,
      type: 'fill',
      source: circleSourceId,
      paint: {
        'fill-color': 'rgba(234, 179, 8, 0.14)',
        'fill-outline-color': 'rgba(202, 138, 4, 0.28)'
      }
    });

    mapInstance.addLayer({
      id: sparkleLayerId,
      type: 'circle',
      source: sparkleSourceId,
      paint: {
        'circle-color': '#fdf2f8',
        'circle-opacity': 0,
        'circle-radius': 3,
        'circle-blur': 0.5
      }
    });

    mapInstance.addLayer({
      id: outlineId,
      type: 'line',
      source: circleSourceId,
      paint: {
        'line-color': 'rgba(202, 138, 4, 0.62)',
        'line-width': 2,
        'line-dasharray': BASE_DASH_PATTERN
      }
    });

    circleLayerRef.current = {
      sourceId: circleSourceId,
      fillId,
      outlineId,
      haloInnerLayerId,
      haloInnerSourceId,
      haloOuterLayerId,
      haloOuterSourceId,
      sparkleLayerId,
      sparkleSourceId
    };
  }, [mapInstance]);

  const removeAddedLayers = useCallback(() => {
    if (!mapInstance) return;
    
    // Remove all layers that start with 'apache-junction-change-' pattern
    const allLayers = mapInstance.getStyle().layers;
    allLayers.forEach(layer => {
      if (layer.id.startsWith('apache-junction-change-')) {
        if (mapInstance.getLayer(layer.id)) {
          mapInstance.removeLayer(layer.id);
        }
      }
    });
    
    // Remove all sources that start with 'apache-junction-change-' pattern
    const allSources = Object.keys(mapInstance.getStyle().sources);
    allSources.forEach(sourceId => {
      if (sourceId.startsWith('apache-junction-change-')) {
        if (mapInstance.getSource(sourceId)) {
          mapInstance.removeSource(sourceId);
        }
      }
    });
    
    activeLayersRef.current = [];
    cancelPendingPeriodAnimations();
    removeCircleLayer();
    removeCalloutLayers();
    setCurrentCallouts([]);
  }, [mapInstance, removeCircleLayer, cancelPendingPeriodAnimations, removeCalloutLayers]);

const stopPlayback = useCallback(() => {
  if (playbackRef.current) {
    clearTimeout(playbackRef.current);
    playbackRef.current = null;
  }
  // Stop circle animation when playback stops
  cancelPendingPeriodAnimations();
  stopCircleAnimation();
}, [cancelPendingPeriodAnimations, stopCircleAnimation]);

  const loadPeriodFiles = useCallback(async () => {
    if (!mountedRef.current) return;
    const loaded = [];
    for (const period of PERIODS) {
      try {
        const response = await fetch(period.file, { cache: 'no-cache' });
        if (!response.ok) {
          console.warn(`LakeWhitneyDamChange: missing ${period.file} (${response.status})`);
          continue;
        }
        const geojson = await response.json();
        loaded.push({ ...period, geojson });
      } catch (error) {
        console.warn(`LakeWhitneyDamChange: failed to load ${period.file}`, error);
      }
    }
    if (!mountedRef.current) return;
    setPeriodData(loaded);
    setCurrentIndex(0);
    // Don't auto-start - wait for user to click header
  }, []);

  useEffect(() => {
    loadPeriodFiles();
  }, [loadPeriodFiles]);

  useEffect(() => {
    addCircleLayer();
    return () => {
      cancelPendingPeriodAnimations();
      removeCircleLayer();
      stopCircleAnimation();
    };
  }, [addCircleLayer, removeCircleLayer, stopCircleAnimation, cancelPendingPeriodAnimations]);

  const addPeriodToMap = useCallback((period, periodIndex = 0) => {
    if (!mapInstance || !period?.geojson) return;

    const sourceId = `apache-junction-change-${period.start}-${period.end}-source`;
    const fillId = `${sourceId}-fill`;
    const outlineId = `${sourceId}-outline`;

    if (mapInstance.getLayer(fillId)) {
      mapInstance.setPaintProperty(fillId, 'fill-extrusion-opacity', 0.85);
      return;
    }

    mapInstance.addSource(sourceId, {
      type: 'geojson',
      data: period.geojson
    });

    // Calculate and add callouts for this period
    const callouts = calculateChangeCallouts(period.geojson);
    setCurrentCallouts(callouts);
    
    // Remove previous callouts and add new ones
    removeCalloutLayers();
    if (callouts.length > 0) {
      setTimeout(() => addCalloutLayers(callouts, period), 500); // Delay to sync with layer animation
    }

    const shadowId = `${sourceId}-shadow`;
    if (!mapInstance.getLayer(shadowId)) {
      mapInstance.addLayer({
        id: shadowId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': 'rgba(15, 23, 42, 1)',
          'fill-opacity': 0,
          'fill-translate': [0, 18],
          'fill-translate-anchor': 'viewport'
        }
      });
    }

    const heightExpression = [
      'interpolate', ['linear'], ['get', 'area_ha'],
      0, 12,
      2, 44,
      5, 92,
      15, 162
    ];

    const periodBaseHeight = 35 * periodIndex;
    const heightScale = 1 + periodIndex * 0.18;
    const clampedHeightScale = Math.min(heightScale, 1.8);
    const changeOffsetExpression = ['*', ['coalesce', ['to-number', ['get', 'change_code']], 0], 6.5];

    mapInstance.addLayer({
      id: fillId,
      type: 'fill-extrusion',
      source: sourceId,
      paint: {
        'fill-extrusion-color': CHANGE_COLOR_RAMP_SOFT,
        'fill-extrusion-height': ['+', periodBaseHeight, changeOffsetExpression, ['*', heightExpression, clampedHeightScale]],
        'fill-extrusion-base': ['+', periodBaseHeight, changeOffsetExpression],
        'fill-extrusion-opacity': 0.18
      }
    });

    mapInstance.addLayer({
      id: outlineId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': CHANGE_OUTLINE_COLOR,
        'line-width': 1.2,
        'line-opacity': 0.75
      }
    });

    try {
      mapInstance.moveLayer(shadowId, fillId);
    } catch (error) {
      // Layer order adjustment best effort
    }

    activeLayersRef.current.push({ sourceId, fillId, lineId: outlineId, shadowId });
    const initialExpression = ['+', periodBaseHeight, changeOffsetExpression, ['*', heightExpression, clampedHeightScale * 0.05]];
    mapInstance.setPaintProperty(fillId, 'fill-extrusion-height', initialExpression);
    animateLayerIn(fillId, {
      baseHeight: periodBaseHeight,
      heightExpression,
      heightScale: clampedHeightScale,
      changeOffsetExpression
    });
    animateOutlineGlow(outlineId);
    animateShadowIn(shadowId, 0.2);
    haloPulseRef.current = Math.min(haloPulseRef.current + 0.95, 1.8);
  }, [mapInstance, animateLayerIn, animateOutlineGlow, animateShadowIn, addCalloutLayers, removeCalloutLayers]);

  const dimPreviousLayers = useCallback(() => {
    if (!mapInstance) return;
    const active = activeLayersRef.current;
    if (active.length <= 1) return;
    const previousLayers = active.slice(0, -1);
    previousLayers.forEach(({ fillId, lineId, shadowId }) => {
      if (mapInstance.getLayer(fillId)) {
        animateLayerOpacity(fillId, 0.22, 700);
      }
      if (lineId && mapInstance.getLayer(lineId)) {
        mapInstance.setPaintProperty(lineId, 'line-width', 1.2);
        mapInstance.setPaintProperty(lineId, 'line-color', CHANGE_OUTLINE_COLOR);
        mapInstance.setPaintProperty(lineId, 'line-opacity', 0.6);
      }
      if (shadowId && mapInstance.getLayer(shadowId)) {
        mapInstance.setPaintProperty(shadowId, 'fill-opacity', 0.08);
      }
    });
  }, [mapInstance, animateLayerOpacity]);

  const scheduleNext = useCallback((nextIndex) => {
    if (playbackRef.current) {
      clearTimeout(playbackRef.current);
      playbackRef.current = null;
    }
    playbackRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setCurrentIndex(nextIndex);
    }, playbackDelay);
  }, [playbackDelay]);

  useEffect(() => {
    if (!mapInstance || !periodData.length || !isPlaying) return;
    if (currentIndex >= periodData.length) {
      stopPlayback();
      return;
    }

    const period = periodData[currentIndex];
    console.log('🌉 LakeWhitneyDam: activating period', period?.label);
    addPeriodToMap(period, currentIndex);
    dimPreviousLayers();
    scheduleNext(currentIndex + 1);
  }, [mapInstance, periodData, currentIndex, addPeriodToMap, dimPreviousLayers, isPlaying, scheduleNext, stopPlayback]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => {
      const next = !prev;
      if (next) {
        scheduleNext(currentIndex + 1);
        // Start circle animation when playing
        setTimeout(() => animateCircleLayers(), 100);
      } else {
        stopPlayback();
        // Stop circle animation when paused
        stopCircleAnimation();
      }
      return next;
    });
  }, [currentIndex, scheduleNext, stopPlayback, animateCircleLayers, stopCircleAnimation]);

  const handleRestart = useCallback(() => {
    cancelPendingPeriodAnimations();
    removeAddedLayers();
    addCircleLayer();
    setCurrentIndex(0);
    setIsPlaying(true);
    setCurrentCallouts([]);
    // Start circle animation when restarting
    setTimeout(() => animateCircleLayers(), 100);
  }, [removeAddedLayers, addCircleLayer, animateCircleLayers, cancelPendingPeriodAnimations]);

  const handleCleanup = useCallback(() => {
    setIsPlaying(false);
    stopPlayback();
    removeAddedLayers();
    setCurrentIndex(0);
  }, [stopPlayback, removeAddedLayers]);

  useEffect(() => {
    window.lakeWhitneyDamAnimationRef = {
      handlePlayPause,
      handleRestart,
      handleCleanup,
      isPlaying: () => isPlaying
    };
    console.log('🌉 LakeWhitneyDam: controller registered');
    return () => {
      console.log('🌉 LakeWhitneyDam: controller unregistered');
      window.lakeWhitneyDamAnimationRef = null;
    };
  }, [handleCleanup, handlePlayPause, handleRestart, isPlaying]);

  // Component now only handles map layer management, no UI rendering
  return null;
};

export default LakeWhitneyDamChangeAnimation;
