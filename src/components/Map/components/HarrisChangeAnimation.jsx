import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const PERIODS = [
  { id: '2020_2021', label: '2020 → 2021', file: '/data/harris_nc/harris_nc_2020_2021.geojson' },
  { id: '2021_2022', label: '2021 → 2022', file: '/data/harris_nc/harris_nc_2021_2022.geojson' },
  { id: '2022_2023', label: '2022 → 2023', file: '/data/harris_nc/harris_nc_2022_2023.geojson' },
  { id: '2023_2024', label: '2023 → 2024', file: '/data/harris_nc/harris_nc_2023_2024.geojson' },
  { id: '2024_2025', label: '2024 → 2025', file: '/data/harris_nc/harris_nc_2024_2025.geojson' }
];

const HARRIS_CENTER = [-78.9531, 35.6506];
// 3x size compared to typical 5km ring used elsewhere
const HARRIS_RADIUS_METERS = 15000;

const LAYER_IDS = {
  source: 'harris-geo',
  aoiFill: 'harris-aoi-fill',
  aoiOuter: 'harris-aoi-outer',
  industrialFill: 'harris-industrial-fill',
  roads: 'harris-roads',
  power: 'harris-power',
  siteLabel: 'harris-site-label'
};

const SITE_KEY = 'harris_nc';

const BASE_DASH_PATTERN = [1, 1.5];
const DASH_PATTERN_TOTAL = BASE_DASH_PATTERN.reduce((sum, value) => sum + value, 0);
const MIN_DASH_VALUE = 0.0001;

const CHANGE_COLOR_RAMP = [
  'match',
  ['get', 'change_label'],
  'agriculture_loss', '#f97316',
  'agriculture_gain', 'rgba(56, 189, 248, 0.5)',
  'industrial_expansion', '#f472b6',
  'water_change', '#6366f1',
  '#94a3b8'
];

const CHANGE_COLOR_RAMP_SOFT = [
  'match',
  ['get', 'change_label'],
  'agriculture_loss', '#fdba74',
  'agriculture_gain', 'rgba(186, 230, 253, 0.5)',
  'industrial_expansion', '#fbcfe8',
  'water_change', '#c7d2fe',
  '#e2e8f0'
];

const CHANGE_OUTLINE_COLOR = [
  'match',
  ['get', 'change_label'],
  'agriculture_loss', '#fb923c',
  'agriculture_gain', '#3dd5ff',
  'industrial_expansion', '#fb83c8',
  'water_change', '#818cf8',
  '#cbd5f5'
];

const CHANGE_CALLOUTS = {
  agriculture_loss: { label: 'Agriculture Loss', color: '#f97316' },
  agriculture_gain: { label: 'Vegetation Gain', color: '#38bdf8' },
  industrial_expansion: { label: 'Industrial Expansion', color: '#f472b6' },
  water_change: { label: 'Water Change', color: '#6366f1' }
};

const CHANGE_LAYER_FILTER = [
  'all',
  ['>=', ['get', 'change_code'], 1],
  ['>=', ['get', 'area_m2'], 1500],
  ['!=', ['get', 'change_label'], 'persistent_agriculture']
];

// Water-aware color ramps (vary water_change by area_ha)
const WATER_COLOR_RAMP = [
  'case',
  ['==', ['get', 'change_label'], 'water_change'],
  ['interpolate', ['linear'], ['get', 'area_ha'],
    0, 'rgba(99, 102, 241, 0.45)',
    1, 'rgba(99, 102, 241, 0.65)',
    5, 'rgba(56, 189, 248, 0.85)',
    15, 'rgba(59, 130, 246, 0.95)'
  ],
  CHANGE_COLOR_RAMP
];

const WATER_COLOR_RAMP_SOFT = [
  'case',
  ['==', ['get', 'change_label'], 'water_change'],
  ['interpolate', ['linear'], ['get', 'area_ha'],
    0, 'rgba(99, 102, 241, 0.25)',
    1, 'rgba(99, 102, 241, 0.35)',
    5, 'rgba(56, 189, 248, 0.45)',
    15, 'rgba(59, 130, 246, 0.6)'
  ],
  CHANGE_COLOR_RAMP_SOFT
];

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

const createCircleCoords = (center, radiusMeters, steps = 256) => {
  const coords = [];
  const [lng, lat] = center;
  const earthRadius = 6378137;
  const angularDistance = radiusMeters / earthRadius;
  const centerLatRad = (lat * Math.PI) / 180;
  const centerLngRad = (lng * Math.PI) / 180;

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

const createCircleFeature = (center, radiusMeters) => ({
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [createCircleCoords(center, radiusMeters)]
  }
});

const createSparkleFeatures = (center, radiusMeters, count = 16) => {
  const coords = createCircleCoords(center, radiusMeters, count * 3);
  const step = Math.max(1, Math.floor(coords.length / count));
  const features = [];

  for (let i = 0; i < count; i += 1) {
    const point = coords[i * step] || coords[coords.length - 1];
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: point },
      properties: { sparklePhase: Math.random() }
    });
  }

  return features;
};

const sanitizeChangeCollection = (collection) => {
  if (!collection?.features) return collection;
  const filteredFeatures = collection.features.filter(feature => {
    const label = feature?.properties?.change_label;
    return label !== 'persistent_agriculture';
  });
  if (filteredFeatures.length === collection.features.length) return collection;
  return { ...collection, features: filteredFeatures };
};

const addOrUpdateSource = (map, id, data) => {
  if (!map.getSource(id)) {
    map.addSource(id, { type: 'geojson', data });
  } else {
    map.getSource(id).setData(data);
  }
};

const safeRemove = (map, id, isLayer = true) => {
  try {
    if (isLayer) {
      if (map.getLayer(id)) {
        map.removeLayer(id);
      }
    } else if (map.getSource(id)) {
      map.removeSource(id);
    }
  } catch (_) {}
};

const HarrisChangeAnimation = ({ map, data, changeData = null, visible = true }) => {
  const playbackRef = useRef(null);
  const circleAnimationRef = useRef(null);
  const circleLayerRef = useRef(null);
  const animationFramesRef = useRef([]);
  const activeLayersRef = useRef([]);
  const mountedRef = useRef(false);
  const timelinePlaybackActiveRef = useRef(false);

  const sanitizedChangeData = useMemo(
    () => (changeData ? sanitizeChangeCollection(changeData) : null),
    [changeData]
  );

  const [periodData, setPeriodData] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timelineHighlightKey, setTimelineHighlightKey] = useState(null);

  const playbackDelay = 1350;

  const applyTimelineLegendHighlight = useCallback((seriesKey, fillId, m, lineId = null) => {
    if (!m) return;
    const match = seriesKey && CHANGE_CALLOUTS[seriesKey] ? seriesKey : null;
    
    if (fillId && m.getLayer(fillId)) {
      m.setPaintProperty(fillId, 'fill-extrusion-color',
        match ? ['case', ['==', ['get', 'change_label'], match], WATER_COLOR_RAMP, 'rgba(17,24,39,0.28)']
              : WATER_COLOR_RAMP);
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
    if (!map?.current) return;
    const m = map.current;
    activeLayersRef.current.forEach(({ fillId, lineId }) => {
      applyTimelineLegendHighlight(timelineHighlightKey, fillId, m, lineId);
    });
  }, [timelineHighlightKey, applyTimelineLegendHighlight, map]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.mapEventBus?.on) return;
    window.mapEventBus.on('timeline:legendFocus', handleTimelineLegendFocus);
    return () => {
      if (window.mapEventBus?.off) {
        window.mapEventBus.off('timeline:legendFocus', handleTimelineLegendFocus);
      }
    };
  }, [handleTimelineLegendFocus]);

  const emitTimelinePause = useCallback(() => {
    if (typeof window === 'undefined' || !window.mapEventBus?.emit) return;
    if (!timelinePlaybackActiveRef.current) return;
    timelinePlaybackActiveRef.current = false;
    window.mapEventBus.emit('timeline:pause', { siteKey: SITE_KEY });
  }, []);

  const emitTimelinePlayback = useCallback((period, index) => {
    if (!period || typeof window === 'undefined' || !window.mapEventBus?.emit) return;
    const annualLabel = period.label || period.yearPair || period.id;
    window.mapEventBus.emit('timeline:playback', {
      siteKey: SITE_KEY,
      periodId: period.id,
      periodLabel: period.label || annualLabel,
      annualLabel,
      periodIndex: index,
      periodCount: periodData.length,
      timestamp: Date.now()
    });
    timelinePlaybackActiveRef.current = true;
  }, [periodData.length]);

  const clampOpacityAnim = useCallback((fillId, targetOpacity, duration = 600) => {
    const m = map?.current;
    if (!m || !m.getLayer(fillId)) return;
    const startOpacity = m.getPaintProperty(fillId, 'fill-extrusion-opacity') ?? targetOpacity;
    const startTime = performance.now();
    const step = (now) => {
      if (!m.getLayer(fillId)) return;
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = easeInOutCubic(progress);
      const value = startOpacity + (targetOpacity - startOpacity) * eased;
      m.setPaintProperty(fillId, 'fill-extrusion-opacity', clamp(value));
      if (progress < 1) {
        const frameId = requestAnimationFrame(step);
        animationFramesRef.current.push(frameId);
      }
    };
    const frameId = requestAnimationFrame(step);
    animationFramesRef.current.push(frameId);
  }, [map]);

  const cancelPending = useCallback(() => {
    animationFramesRef.current.forEach(id => cancelAnimationFrame(id));
    animationFramesRef.current = [];
  }, []);

  const stopPlayback = useCallback(() => {
    if (playbackRef.current) {
      clearTimeout(playbackRef.current);
      playbackRef.current = null;
    }
    cancelPending();
  }, [cancelPending]);

  const stopCircleAnimation = useCallback(() => {
    if (circleAnimationRef.current) {
      cancelAnimationFrame(circleAnimationRef.current);
      circleAnimationRef.current = null;
    }
    const m = map?.current;
    if (!m || !circleLayerRef.current) return;
    const { outlineId, haloInnerLayerId, haloOuterLayerId, sparkleLayerId } = circleLayerRef.current;
    if (outlineId && m.getLayer(outlineId)) {
      m.setPaintProperty(outlineId, 'line-dasharray', BASE_DASH_PATTERN);
    }
    if (haloInnerLayerId && m.getLayer(haloInnerLayerId)) {
      m.setPaintProperty(haloInnerLayerId, 'line-opacity', 0);
    }
    if (haloOuterLayerId && m.getLayer(haloOuterLayerId)) {
      m.setPaintProperty(haloOuterLayerId, 'line-opacity', 0);
    }
    if (sparkleLayerId && m.getLayer(sparkleLayerId)) {
      m.setPaintProperty(sparkleLayerId, 'circle-opacity', 0);
    }
  }, [map]);

  const addPeriodToMap = useCallback((period, periodIndex = 0) => {
    const m = map?.current;
    if (!m || !period?.geojson) return;

    const baseId = period.id || `${period.start}-${period.end}` || `period-${periodIndex}`;
    const sourceId = `harris-change-${baseId}-source`;
    const fillId = `${sourceId}-fill`;
    const outlineId = `${sourceId}-outline`;
    const shadowId = `${sourceId}-shadow`;

    if (m.getLayer(fillId)) {
      m.setPaintProperty(fillId, 'fill-extrusion-opacity', 0.62);
      return;
    }

    m.addSource(sourceId, { type: 'geojson', data: period.geojson });

    if (!m.getLayer(shadowId)) {
      m.addLayer({
        id: shadowId,
        type: 'fill',
        source: sourceId,
        filter: CHANGE_LAYER_FILTER,
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
      5, 98,
      15, 168
    ];

    const baseHeight = 32 * periodIndex;
    const heightScale = Math.min(1 + periodIndex * 0.16, 1.7);
    const changeOffsetExpression = ['*', ['coalesce', ['to-number', ['get', 'change_code']], 0], 6];

    m.addLayer({
      id: fillId,
      type: 'fill-extrusion',
      source: sourceId,
      filter: CHANGE_LAYER_FILTER,
      paint: {
        'fill-extrusion-color': WATER_COLOR_RAMP_SOFT,
        'fill-extrusion-height': ['+', baseHeight, changeOffsetExpression, ['*', heightExpression, heightScale * 0.05]],
        'fill-extrusion-base': ['+', baseHeight, changeOffsetExpression],
        'fill-extrusion-opacity': 0.18
      }
    });

    m.addLayer({
      id: outlineId,
      type: 'line',
      source: sourceId,
      filter: CHANGE_LAYER_FILTER,
      paint: {
        'line-color': CHANGE_OUTLINE_COLOR,
        'line-width': 1.2,
        'line-opacity': 0.72
      }
    });

    try { m.moveLayer(shadowId, fillId); } catch (_) {}

    activeLayersRef.current.push({ sourceId, fillId, lineId: outlineId, shadowId });

    // Apply timeline highlight if active
    applyTimelineLegendHighlight(timelineHighlightKey, fillId, m, outlineId);

    const targetOpacity = 0.62;
    const minOpacity = 0.2;
    const duration = 900;
    const startTime = performance.now();
    const step = (now) => {
      if (!m.getLayer(fillId)) return;
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = easeInOutCubic(progress);
      const scaledHeight = heightScale * Math.max(eased, 0.05);
      const currentHeightExpression = ['+', baseHeight, changeOffsetExpression, ['*', heightExpression, scaledHeight]];
      const opacityValue = minOpacity + (targetOpacity - minOpacity) * eased;
      m.setPaintProperty(fillId, 'fill-extrusion-height', currentHeightExpression);
      m.setPaintProperty(fillId, 'fill-extrusion-opacity', clamp(opacityValue));
      if (progress < 1) {
        const frameId = requestAnimationFrame(step);
        animationFramesRef.current.push(frameId);
      } else {
        m.setPaintProperty(fillId, 'fill-extrusion-height', ['+', baseHeight, changeOffsetExpression, ['*', heightExpression, heightScale]]);
        applyTimelineLegendHighlight(timelineHighlightKey, fillId, m);
        m.setPaintProperty(fillId, 'fill-extrusion-opacity', targetOpacity);
      }
    };
    const frameId = requestAnimationFrame(step);
    animationFramesRef.current.push(frameId);

    // outline glow pulse
    const baseWidth = m.getPaintProperty(outlineId, 'line-width') ?? 1.2;
    const glowWidth = baseWidth * 3.1;
    const glowColor = '#60a5fa';
    const baseOpacity = 0.7;
    const growDuration = 260;
    const totalDuration = 700;
    const glowStart = performance.now();
    m.setPaintProperty(outlineId, 'line-color', glowColor);
    m.setPaintProperty(outlineId, 'line-opacity', 0.95);
    const glowStep = (now) => {
      if (!m.getLayer(outlineId)) return;
      const elapsed = now - glowStart;
      if (elapsed >= totalDuration) {
        m.setPaintProperty(outlineId, 'line-width', baseWidth);
        m.setPaintProperty(outlineId, 'line-color', CHANGE_OUTLINE_COLOR);
        m.setPaintProperty(outlineId, 'line-opacity', baseOpacity);
        return;
      }
      if (elapsed <= growDuration) {
        const t = easeInOutCubic(elapsed / growDuration);
        const width = baseWidth + (glowWidth - baseWidth) * t;
        m.setPaintProperty(outlineId, 'line-width', width);
      } else {
        const remaining = totalDuration - growDuration;
        const t = easeInOutCubic((elapsed - growDuration) / remaining);
        const width = glowWidth + (baseWidth - glowWidth) * t;
        m.setPaintProperty(outlineId, 'line-width', width);
      }
      const id = requestAnimationFrame(glowStep);
      animationFramesRef.current.push(id);
    };
    const id = requestAnimationFrame(glowStep);
    animationFramesRef.current.push(id);

    // shadow fade-in
    const shadowStart = performance.now();
    const shadowTarget = 0.22;
    const shadowDuration = 820;
    m.setPaintProperty(shadowId, 'fill-opacity', 0);
    const shadowStep = (now) => {
      if (!m.getLayer(shadowId)) return;
      const progress = Math.min((now - shadowStart) / shadowDuration, 1);
      const eased = easeInOutCubic(progress);
      m.setPaintProperty(shadowId, 'fill-opacity', clamp(eased * shadowTarget));
      if (progress < 1) {
        const fid = requestAnimationFrame(shadowStep);
        animationFramesRef.current.push(fid);
      } else {
        m.setPaintProperty(shadowId, 'fill-opacity', clamp(shadowTarget));
      }
    };
    const fid = requestAnimationFrame(shadowStep);
    animationFramesRef.current.push(fid);
  }, [map]);

  const dimPreviousLayers = useCallback(() => {
    const m = map?.current;
    if (!m) return;
    if (activeLayersRef.current.length <= 1) return;
    const previousLayers = activeLayersRef.current.slice(0, -1);
    previousLayers.forEach(({ fillId, lineId, shadowId }) => {
      if (fillId && m.getLayer(fillId)) {
        clampOpacityAnim(fillId, 0.26, 600);
      }
      if (lineId && m.getLayer(lineId)) {
        m.setPaintProperty(lineId, 'line-width', 1.1);
        m.setPaintProperty(lineId, 'line-opacity', 0.54);
      }
      if (shadowId && m.getLayer(shadowId)) {
        m.setPaintProperty(shadowId, 'fill-opacity', 0.08);
      }
    });
  }, [map, clampOpacityAnim]);

  const scheduleNext = useCallback((nextIndex) => {
    if (playbackRef.current) clearTimeout(playbackRef.current);
    playbackRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setCurrentIndex(nextIndex);
    }, playbackDelay);
  }, [playbackDelay]);

  const animateCircleLayers = useCallback(() => {
    const m = map?.current;
    if (!m || !circleLayerRef.current || !isPlaying) return;
    if (circleAnimationRef.current) {
      cancelAnimationFrame(circleAnimationRef.current);
      circleAnimationRef.current = null;
    }
    const { outlineId, haloInnerLayerId, haloOuterLayerId, sparkleLayerId } = circleLayerRef.current;
    let animationTime = 0;
    const animate = () => {
      if (!isPlaying || !circleLayerRef.current) return;
      const dashPhase = ((animationTime * 0.5) % DASH_PATTERN_TOTAL) / DASH_PATTERN_TOTAL;
      const dashArray = computeDashArray(dashPhase);
      animationTime += 0.045;
      if (outlineId && m.getLayer(outlineId)) {
        m.setPaintProperty(outlineId, 'line-color', 'rgba(37, 99, 235, 0.85)');
        m.setPaintProperty(outlineId, 'line-dasharray', dashArray);
      }
      if (haloInnerLayerId && m.getLayer(haloInnerLayerId)) {
        m.setPaintProperty(haloInnerLayerId, 'line-opacity', 0.9);
      }
      if (haloOuterLayerId && m.getLayer(haloOuterLayerId)) {
        m.setPaintProperty(haloOuterLayerId, 'line-opacity', 0.35);
      }
      if (sparkleLayerId && m.getLayer(sparkleLayerId)) {
        const sparklePulse = (Math.sin(animationTime * 1.8) + 1) / 2;
        m.setPaintProperty(sparkleLayerId, 'circle-opacity', 0.08 + sparklePulse * 0.16);
        m.setPaintProperty(sparkleLayerId, 'circle-radius', 2.6 + sparklePulse * 1.2);
      }
      circleAnimationRef.current = requestAnimationFrame(animate);
    };
    circleAnimationRef.current = requestAnimationFrame(animate);
  }, [map, isPlaying]);

  const addCircleLayer = useCallback(() => {
    const m = map?.current;
    if (!m || circleLayerRef.current) return;

    const circleSourceId = 'harris-site-circle-source';
    const haloInnerSourceId = 'harris-site-halo-inner-source';
    const haloOuterSourceId = 'harris-site-halo-outer-source';
    const sparkleSourceId = 'harris-site-sparkles-source';

    const outlineId = 'harris-site-circle-outline';
    const haloInnerLayerId = 'harris-site-halo-inner';
    const haloOuterLayerId = 'harris-site-halo-outer';
    const sparkleLayerId = 'harris-site-sparkles';
    const fillId = 'harris-site-circle-fill';
    const dashOutlineId = 'harris-site-circle-dash-outline';

    addOrUpdateSource(m, circleSourceId, createCircleFeature(HARRIS_CENTER, HARRIS_RADIUS_METERS));
    addOrUpdateSource(m, haloInnerSourceId, createCircleFeature(HARRIS_CENTER, HARRIS_RADIUS_METERS * 0.82));
    addOrUpdateSource(m, haloOuterSourceId, createCircleFeature(HARRIS_CENTER, HARRIS_RADIUS_METERS * 1.28));
    addOrUpdateSource(m, sparkleSourceId, {
      type: 'FeatureCollection',
      features: createSparkleFeatures(HARRIS_CENTER, HARRIS_RADIUS_METERS * 1.06)
    });

    m.addLayer({
      id: haloOuterLayerId,
      type: 'line',
      source: haloOuterSourceId,
      paint: {
        'line-color': 'rgba(37, 99, 235, 0.35)',
        'line-width': 1.2,
        'line-dasharray': [1, 1.5],
        'line-opacity': 0
      }
    });

    m.addLayer({
      id: haloInnerLayerId,
      type: 'line',
      source: haloInnerSourceId,
      paint: {
        'line-color': 'rgba(37, 99, 235, 0.45)',
        'line-width': 2,
        'line-dasharray': [1, 1.5],
        'line-opacity': 0
      }
    });

    m.addLayer({
      id: fillId,
      type: 'fill',
      source: circleSourceId,
      paint: {
        'fill-color': 'rgba(0, 0, 0, 0)',
        'fill-opacity': 0,
        'fill-outline-color': 'rgba(37, 99, 235, 0.32)'
      }
    });

    m.addLayer({
      id: dashOutlineId,
      type: 'line',
      source: circleSourceId,
      paint: {
        'line-color': 'rgba(59, 130, 246, 0.88)',
        'line-width': 3,
        'line-dasharray': [0.6, 1.1],
        'line-opacity': 0.85
      }
    });

    m.addLayer({
      id: outlineId,
      type: 'line',
      source: circleSourceId,
      paint: {
        'line-color': 'rgba(37, 99, 235, 0.68)',
        'line-width': 2,
        'line-dasharray': BASE_DASH_PATTERN
      }
    });

    m.addLayer({
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

    circleLayerRef.current = {
      sourceId: circleSourceId,
      haloInnerLayerId,
      haloOuterLayerId,
      sparkleLayerId,
      outlineId,
      fillId,
      dashOutlineId
    };

    animateCircleLayers();
  }, [map, animateCircleLayers]);

  const removeCircleLayer = useCallback(() => {
    const m = map?.current;
    if (!m || !circleLayerRef.current) return;
    stopCircleAnimation();
    const { sourceId, haloInnerLayerId, haloOuterLayerId, sparkleLayerId, outlineId, fillId, dashOutlineId } = circleLayerRef.current;
    [sparkleLayerId, haloInnerLayerId, haloOuterLayerId, dashOutlineId, outlineId, fillId].forEach(id => safeRemove(m, id));
    [sourceId, 'harris-site-halo-inner-source', 'harris-site-halo-outer-source', 'harris-site-sparkles-source'].forEach(id => safeRemove(m, id, false));
    circleLayerRef.current = null;
  }, [map, stopCircleAnimation]);

  const removeChangeLayers = useCallback(() => {
    const m = map?.current;
    if (!m) return;
    activeLayersRef.current.forEach(({ fillId, lineId, shadowId, sourceId }) => {
      safeRemove(m, fillId);
      safeRemove(m, lineId);
      safeRemove(m, shadowId);
      safeRemove(m, sourceId, false);
    });
    activeLayersRef.current = [];
    cancelPending();
  }, [map, cancelPending]);

  const handleCleanup = useCallback(() => {
    setIsPlaying(false);
    stopPlayback();
    removeChangeLayers();
    removeCircleLayer();
    emitTimelinePause();
  }, [stopPlayback, removeChangeLayers, removeCircleLayer, emitTimelinePause]);

  const handleRestart = useCallback(() => {
    removeChangeLayers();
    setCurrentIndex(0);
    setIsPlaying(true);
    animateCircleLayers();
  }, [removeChangeLayers, animateCircleLayers]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => {
      const next = !prev;
      if (next) {
        animateCircleLayers();
        scheduleNext((currentIndex + 1) % Math.max(periodData.length, 1));
      } else {
        stopPlayback();
        stopCircleAnimation();
      }
      return next;
    });
  }, [animateCircleLayers, currentIndex, periodData.length, scheduleNext, stopPlayback, stopCircleAnimation]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.harrisAnimationRef = {
        handlePlayPause,
        handleRestart,
        handleCleanup,
        currentPeriod: periodData[currentIndex]?.label || 'Latest period',
        isPlaying: () => isPlaying
      };
    }
    return () => { if (typeof window !== 'undefined' && window.harrisAnimationRef) delete window.harrisAnimationRef; };
  }, [handlePlayPause, handleRestart, handleCleanup, periodData, currentIndex, isPlaying]);

  useEffect(() => {
    if (!visible || !periodData.length) return;
    const normalizedIndex = ((currentIndex % periodData.length) + periodData.length) % periodData.length;
    const period = periodData[normalizedIndex];
    emitTimelinePlayback(period, normalizedIndex);
  }, [visible, periodData, currentIndex, emitTimelinePlayback]);

  useEffect(() => {
    if (visible && isPlaying) return;
    emitTimelinePause();
  }, [visible, isPlaying, emitTimelinePause]);

  useEffect(() => {
    let cancelled = false;
    const loadFrames = async () => {
      try {
        const responses = await Promise.all(
          PERIODS.map(async (period) => {
            try {
              const resp = await fetch(period.file, { cache: 'no-cache' });
              if (!resp.ok) return null;
              const raw = await resp.json();
              const geojson = sanitizeChangeCollection(raw);
              return { ...period, geojson };
            } catch (error) {
              console.warn('⚛ Harris CTA: Failed loading change frame', { file: period.file, error });
              return null;
            }
          })
        );
        if (cancelled) return;
        const validFrames = responses.filter(Boolean);
        if (validFrames.length > 0) {
          setPeriodData(validFrames);
        } else if (sanitizedChangeData) {
          setPeriodData([{ id: 'latest', label: 'Latest period', geojson: sanitizedChangeData }]);
        } else {
          setPeriodData([]);
        }
        setCurrentIndex(0);
      } catch (error) {
        console.error('⚛ Harris CTA: Unexpected error loading animation frames', error);
        if (sanitizedChangeData) {
          setPeriodData([{ id: 'latest', label: 'Latest period', geojson: sanitizedChangeData }]);
        }
      }
    };
    loadFrames();
    return () => { cancelled = true; };
  }, [sanitizedChangeData]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; handleCleanup(); };
  }, [handleCleanup]);

  useEffect(() => {
    if (!visible) { handleCleanup(); return; }
    if (periodData.length > 0) setIsPlaying(true);
  }, [visible, periodData.length, handleCleanup]);

  useEffect(() => {
    if (!visible || !isPlaying) { stopPlayback(); stopCircleAnimation(); return; }
    if (!periodData.length) return;
    const period = periodData[currentIndex % periodData.length];
    addPeriodToMap(period, currentIndex);
    dimPreviousLayers();
    scheduleNext((currentIndex + 1) % periodData.length);
  }, [visible, isPlaying, periodData, currentIndex, addPeriodToMap, dimPreviousLayers, scheduleNext, stopPlayback, stopCircleAnimation]);

  useEffect(() => {
    if (!map?.current || !visible) return;
    const m = map.current;
    if (data) {
      addOrUpdateSource(m, LAYER_IDS.source, data);
      if (!m.getLayer(LAYER_IDS.aoiFill)) {
        m.addLayer({ id: LAYER_IDS.aoiFill, type: 'fill', source: LAYER_IDS.source, filter: ['==', ['get', 'category'], 'aoi'], paint: { 'fill-color': '#14b8a6', 'fill-opacity': 0.08 } });
      }
      if (!m.getLayer(LAYER_IDS.aoiOuter)) {
        m.addLayer({ id: LAYER_IDS.aoiOuter, type: 'line', source: LAYER_IDS.source, filter: ['==', ['get', 'category'], 'aoi_outer'], paint: { 'line-color': '#14b8a6', 'line-width': 2, 'line-dasharray': [2, 2], 'line-opacity': 0.9 } });
      }
      if (!m.getLayer(LAYER_IDS.industrialFill)) {
        m.addLayer({ id: LAYER_IDS.industrialFill, type: 'fill', source: LAYER_IDS.source, filter: ['==', ['get', 'category'], 'industrial'], paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.18 } });
      }
      if (!m.getLayer(LAYER_IDS.roads)) {
        m.addLayer({ id: LAYER_IDS.roads, type: 'line', source: LAYER_IDS.source, filter: ['any', ['==', ['get', 'category'], 'interstate'], ['==', ['get', 'category'], 'us_highway'], ['==', ['get', 'category'], 'state_highway'], ['==', ['get', 'category'], 'primary_road'], ['==', ['get', 'category'], 'secondary_road']], paint: { 'line-color': ['case', ['==', ['get', 'category'], 'interstate'], '#ef4444', ['==', ['get', 'category'], 'us_highway'], '#f97316', ['==', ['get', 'category'], 'state_highway'], '#fde047', ['==', ['get', 'category'], 'primary_road'], '#22c55e', '#94a3b8'], 'line-width': ['case', ['==', ['get', 'category'], 'interstate'], 3.5, ['==', ['get', 'category'], 'us_highway'], 3, ['==', ['get', 'category'], 'state_highway'], 2.5, 2], 'line-opacity': 0.9 } });
      }
      if (!m.getLayer(LAYER_IDS.power)) {
        m.addLayer({ id: LAYER_IDS.power, type: 'circle', source: LAYER_IDS.source, filter: ['==', ['get', 'category'], 'power_facility'], paint: { 'circle-color': '#0ea5e9', 'circle-radius': 5, 'circle-opacity': 0.9 } });
      }
      if (!m.getLayer(LAYER_IDS.siteLabel)) {
        m.addLayer({ id: LAYER_IDS.siteLabel, type: 'symbol', source: LAYER_IDS.source, filter: ['==', ['get', 'zone'], 'harris_site'], layout: { 'text-field': ['get', 'zone_name'], 'text-size': 12, 'text-anchor': 'top', 'text-offset': [0, 1.2], 'text-allow-overlap': true }, paint: { 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 1.5 } });
      }
    }
    addCircleLayer();
    return () => { removeCircleLayer(); stopCircleAnimation(); };
  }, [map, visible, data, addCircleLayer, removeCircleLayer, stopCircleAnimation]);

  return null;
};

export default HarrisChangeAnimation;
