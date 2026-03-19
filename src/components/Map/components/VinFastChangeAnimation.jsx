import { useCallback, useEffect, useRef, useState } from 'react';

const PERIODS = [
  { id: '2017_2018', label: '2017 → 2018', file: '/data/toyota_battery_nc/toyota_battery_nc_2017_2018.geojson' },
  { id: '2018_2019', label: '2018 → 2019', file: '/data/toyota_battery_nc/toyota_battery_nc_2018_2019.geojson' },
  { id: '2019_2020', label: '2019 → 2020', file: '/data/toyota_battery_nc/toyota_battery_nc_2019_2020.geojson' },
  { id: '2020_2021', label: '2020 → 2021', file: '/data/toyota_battery_nc/toyota_battery_nc_2020_2021.geojson' },
  { id: '2021_2022', label: '2021 → 2022', file: '/data/toyota_battery_nc/toyota_battery_nc_2021_2022.geojson' },
  { id: '2022_2023', label: '2022 → 2023', file: '/data/toyota_battery_nc/toyota_battery_nc_2022_2023.geojson' },
  { id: '2023_2024', label: '2023 → 2024', file: '/data/toyota_battery_nc/toyota_battery_nc_2023_2024.geojson' },
  { id: '2024_2025', label: '2024 → 2025', file: '/data/toyota_battery_nc/toyota_battery_nc_2024_2025.geojson' }
];

const TOYOTA_CENTER = [-79.571693, 35.85347];
const TOYOTA_RADIUS_METERS = 5000;

const LAYER_IDS = {
  source: 'toyota-geo',
  aoiFill: 'toyota-aoi-fill',
  aoiOuter: 'toyota-aoi-outer',
  industrialFill: 'toyota-industrial-fill',
  roads: 'toyota-roads',
  power: 'toyota-power',
  siteLabel: 'toyota-site-label'
};

const SITE_KEY = 'vinfast_nc';

const TOYOTA_RING_IDS = {
  circleSource: 'toyota-ring-source',
  haloInnerSource: 'toyota-ring-halo-inner-source',
  haloOuterSource: 'toyota-ring-halo-outer-source',
  sparkleSource: 'toyota-ring-sparkles-source',
  circleFill: 'toyota-ring-fill',
  circleOutline: 'toyota-ring-outline',
  circleDashOutline: 'toyota-ring-dash-outline',
  haloInnerLayer: 'toyota-ring-halo-inner',
  haloOuterLayer: 'toyota-ring-halo-outer',
  sparkleLayer: 'toyota-ring-sparkles'
};

const CHANGE_COLOR_RAMP = [
  'match',
  ['get', 'change_label'],
  'agriculture_loss', '#ff6b00',      // vivid orange
  'agriculture_gain', '#2dd4ff',      // aqua blue
  'industrial_expansion', '#f472b6',  // magenta
  'water_change', '#6366f1',          // indigo
  'persistent_agriculture', '#22c55e',// emerald
  '#94a3b8'
];

const CHANGE_OUTLINE_COLOR = [
  'match',
  ['get', 'change_label'],
  'agriculture_loss', '#ff9440',
  'agriculture_gain', '#38bdf8',
  'industrial_expansion', '#fb83c8',
  'water_change', '#818cf8',
  'persistent_agriculture', '#34d399',
  '#cbd5f5'
];

const CHANGE_COLOR_RAMP_SOFT = [
  'match',
  ['get', 'change_label'],
  'agriculture_loss', '#ffc48a',
  'agriculture_gain', '#b9f2ff',
  'industrial_expansion', '#fbc7de',
  'water_change', '#c7d2fe',
  'persistent_agriculture', '#a7f3d0',
  '#e2e8f0'
];

const CHANGE_CALLOUTS = {
  agriculture_loss: { label: 'Agriculture Loss', color: '#ff6b00' },
  agriculture_gain: { label: 'Vegetation Gain', color: '#2dd4ff' },
  industrial_expansion: { label: 'Industrial Expansion', color: '#f472b6' },
  water_change: { label: 'Water Change', color: '#6366f1' },
  persistent_agriculture: { label: 'Persistent Agriculture', color: '#22c55e' }
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

  const changeTypes = {};
  geojsonData.features.forEach(feature => {
    const changeType = feature.properties?.change_label;
    if (changeType && changeType !== 'persistent_agriculture' && CHANGE_CALLOUTS[changeType]) {
      if (!changeTypes[changeType]) {
        changeTypes[changeType] = [];
      }
      changeTypes[changeType].push(feature);
    }
  });

  return Object.entries(changeTypes).reduce((acc, [changeType, features]) => {
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
      const coords = largestFeature.geometry.coordinates[0];
      let centroidLng = 0;
      let centroidLat = 0;
      coords.forEach(([lng, lat]) => {
        centroidLng += lng;
        centroidLat += lat;
      });
      centroidLng /= coords.length;
      centroidLat /= coords.length;

      const totalArea = features.reduce((sum, feature) => sum + (feature.properties?.area_ha || 0), 0);

      acc.push({
        changeType,
        coordinates: [centroidLng, centroidLat],
        area: totalArea,
        featureCount: features.length,
        config: CHANGE_CALLOUTS[changeType]
      });
    }

    return acc;
  }, []);
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

const EMPTY_FEATURE_COLLECTION = { type: 'FeatureCollection', features: [] };

const ToyotaBatteryChangeAnimation = ({ map, data, changeData = null, visible = true }) => {
  const [periodData, setPeriodData] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timelineHighlightKey, setTimelineHighlightKey] = useState(null);
  const playbackRef = useRef(null);
  const circleLayerRef = useRef(null);
  const circleAnimationRef = useRef(null);
  const animationFramesRef = useRef([]);
  const calloutLayersRef = useRef([]);
  const activeLayersRef = useRef([]);
  const hasMountedRef = useRef(false);
  const timelinePlaybackActiveRef = useRef(false);

  const playbackDelay = 1350;

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

  const cancelPendingPeriodAnimations = useCallback(() => {
    animationFramesRef.current.forEach(id => cancelAnimationFrame(id));
    animationFramesRef.current = [];
  }, []);

  const stopPlayback = useCallback(() => {
    if (playbackRef.current) {
      clearTimeout(playbackRef.current);
      playbackRef.current = null;
    }
    cancelPendingPeriodAnimations();
  }, [cancelPendingPeriodAnimations]);

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

  const removeCalloutLayers = useCallback(() => {
    const m = map?.current;
    if (!m) return;

    calloutLayersRef.current.forEach(({ sourceId, layerId }) => {
      if (m.getLayer(layerId)) {
        m.removeLayer(layerId);
      }
      if (m.getSource(sourceId)) {
        m.removeSource(sourceId);
      }
    });
    calloutLayersRef.current = [];
  }, [map]);

const addCalloutLayers = useCallback((callouts) => {
    const m = map?.current;
    if (!m || callouts.length === 0) return;

    const sourceId = 'toyota-callouts-source';
    const layerId = 'toyota-callouts-labels';

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
        label: `${callout.config.label}: +${callout.area.toFixed(1)} ha`,
        color: callout.config.color
      }
    }));

    if (m.getLayer(layerId)) {
      m.removeLayer(layerId);
    }

    if (!m.getSource(sourceId)) {
      m.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: calloutFeatures
        }
      });
    } else {
      m.getSource(sourceId).setData({
        type: 'FeatureCollection',
        features: calloutFeatures
      });
    }

    m.addLayer({
      id: layerId,
      type: 'symbol',
      source: sourceId,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': 12,
        'text-anchor': 'center',
        'text-offset': [0, -1.4],
        'text-allow-overlap': true,
        'text-ignore-placement': true
      },
      paint: {
        'text-color': ['get', 'color'],
        'text-halo-color': 'rgba(15, 23, 42, 0.85)',
        'text-halo-width': 2,
        'text-halo-blur': 1,
        'text-opacity': 0
      }
    });

    const start = performance.now();
    const duration = 950;

    const animate = (now) => {
      if (!m.getLayer(layerId)) return;
      const progress = clamp((now - start) / duration);
      const eased = easeInOutCubic(progress);
      m.setPaintProperty(layerId, 'text-opacity', eased);
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);

    calloutLayersRef.current = [{ sourceId, layerId }];
  }, [map]);

  const removeCircleLayer = useCallback(() => {
    const m = map?.current;
    if (!m || !circleLayerRef.current) return;

    stopCircleAnimation();

    const {
      sourceId,
      haloInnerSourceId,
      haloOuterSourceId,
      sparkleSourceId,
      fillId,
      outlineId,
      dashOutlineId,
      haloInnerLayerId,
      haloOuterLayerId,
      sparkleLayerId
    } = circleLayerRef.current;

    [sparkleLayerId, haloInnerLayerId, haloOuterLayerId, dashOutlineId, outlineId, fillId].forEach(id => safeRemove(m, id));
    [sparkleSourceId, haloInnerSourceId, haloOuterSourceId, sourceId].forEach(id => safeRemove(m, id, false));

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
    cancelPendingPeriodAnimations();
    removeCalloutLayers();
  }, [map, cancelPendingPeriodAnimations, removeCalloutLayers]);

  const animateLayerOpacity = useCallback((fillId, targetOpacity, duration = 600) => {
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

  const animateLayerIn = useCallback((fillId, config) => {
    const m = map?.current;
    if (!m || !m.getLayer(fillId)) return;

    const { baseHeight, heightExpression, heightScale, changeOffsetExpression } = config;
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
        m.setPaintProperty(fillId, 'fill-extrusion-color', CHANGE_COLOR_RAMP);
        m.setPaintProperty(fillId, 'fill-extrusion-opacity', targetOpacity);
      }
    };

    const frameId = requestAnimationFrame(step);
    animationFramesRef.current.push(frameId);
  }, [map]);

  const animateOutlineGlow = useCallback((outlineId) => {
    const m = map?.current;
    if (!m || !m.getLayer(outlineId)) return;

    const baseWidth = m.getPaintProperty(outlineId, 'line-width') ?? 1.2;
    const glowWidth = baseWidth * 3.2;
    const growDuration = 260;
    const totalDuration = 700;
    const glowColor = '#60a5fa';
    const baseOpacity = 0.7;
    const startTime = performance.now();

    m.setPaintProperty(outlineId, 'line-color', glowColor);
    m.setPaintProperty(outlineId, 'line-opacity', 0.95);

    const step = (now) => {
      if (!m.getLayer(outlineId)) return;
      const elapsed = now - startTime;

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

      const frameId = requestAnimationFrame(step);
      animationFramesRef.current.push(frameId);
    };

    const frameId = requestAnimationFrame(step);
    animationFramesRef.current.push(frameId);
  }, [map]);

  const animateShadowIn = useCallback((shadowId, targetOpacity = 0.18) => {
    const m = map?.current;
    if (!m || !m.getLayer(shadowId)) return;

    const startTime = performance.now();
    const duration = 820;
    m.setPaintProperty(shadowId, 'fill-opacity', 0);

    const step = (now) => {
      if (!m.getLayer(shadowId)) return;
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = easeInOutCubic(progress);
      m.setPaintProperty(shadowId, 'fill-opacity', clamp(targetOpacity * eased));
      if (progress < 1) {
        const frameId = requestAnimationFrame(step);
        animationFramesRef.current.push(frameId);
      } else {
        m.setPaintProperty(shadowId, 'fill-opacity', clamp(targetOpacity));
      }
    };

    const frameId = requestAnimationFrame(step);
    animationFramesRef.current.push(frameId);
  }, [map]);

  const addPeriodToMap = useCallback((period, periodIndex = 0) => {
    const m = map?.current;
    if (!m || !period?.geojson) return;

    const baseId = period.id || `${period.start}-${period.end}` || `period-${periodIndex}`;
    const sourceId = `toyota-change-${baseId}-source`;
    const fillId = `${sourceId}-fill`;
    const outlineId = `${sourceId}-outline`;
    const shadowId = `${sourceId}-shadow`;

    if (m.getLayer(fillId)) {
      m.setPaintProperty(fillId, 'fill-extrusion-opacity', 0.62);
      return;
    }

    m.addSource(sourceId, { type: 'geojson', data: period.geojson });

    const callouts = calculateChangeCallouts(period.geojson);
    removeCalloutLayers();
    if (callouts.length > 0) {
      setTimeout(() => addCalloutLayers(callouts), 450);
    }

    if (!m.getLayer(shadowId)) {
    m.addLayer({
      id: shadowId,
      type: 'fill',
      source: sourceId,
      filter: ['!=', ['get', 'change_label'], 'persistent_agriculture'],
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

    const baseHeight = 28 * periodIndex;
    const heightScale = Math.min(1 + periodIndex * 0.16, 1.7);
    const changeOffsetExpression = ['*', ['coalesce', ['to-number', ['get', 'change_code']], 0], 6];

    m.addLayer({
      id: fillId,
      type: 'fill-extrusion',
      source: sourceId,
      filter: ['!=', ['get', 'change_label'], 'persistent_agriculture'],
      paint: {
        'fill-extrusion-color': CHANGE_COLOR_RAMP_SOFT,
        'fill-extrusion-height': ['+', baseHeight, changeOffsetExpression, ['*', heightExpression, heightScale * 0.05]],
        'fill-extrusion-base': ['+', baseHeight, changeOffsetExpression],
        'fill-extrusion-opacity': 0.18
      }
    });

    m.addLayer({
      id: outlineId,
      type: 'line',
      source: sourceId,
      filter: ['!=', ['get', 'change_label'], 'persistent_agriculture'],
      paint: {
        'line-color': CHANGE_OUTLINE_COLOR,
        'line-width': 1.2,
        'line-opacity': 0.72
      }
    });

    try {
      m.moveLayer(shadowId, fillId);
    } catch (_) {}

    activeLayersRef.current.push({ sourceId, fillId, lineId: outlineId, shadowId });

    // Apply timeline highlight if active
    applyTimelineLegendHighlight(timelineHighlightKey, fillId, m, outlineId);

    animateLayerIn(fillId, {
      baseHeight,
      heightExpression,
      heightScale,
      changeOffsetExpression
    });
    animateOutlineGlow(outlineId);
    animateShadowIn(shadowId, 0.22);
  }, [map, animateLayerIn, animateOutlineGlow, animateShadowIn, addCalloutLayers, removeCalloutLayers, applyTimelineLegendHighlight, timelineHighlightKey]);

  const dimPreviousLayers = useCallback(() => {
    const m = map?.current;
    if (!m) return;
    if (activeLayersRef.current.length <= 1) return;
    const previousLayers = activeLayersRef.current.slice(0, -1);
    previousLayers.forEach(({ fillId, lineId, shadowId }) => {
      if (fillId && m.getLayer(fillId)) {
        animateLayerOpacity(fillId, 0.26, 600);
      }
      if (lineId && m.getLayer(lineId)) {
        m.setPaintProperty(lineId, 'line-width', 1.1);
        m.setPaintProperty(lineId, 'line-opacity', 0.52);
      }
      if (shadowId && m.getLayer(shadowId)) {
        m.setPaintProperty(shadowId, 'fill-opacity', 0.08);
      }
    });
  }, [map, animateLayerOpacity]);

  const scheduleNext = useCallback((nextIndex) => {
    if (playbackRef.current) {
      clearTimeout(playbackRef.current);
    }
    playbackRef.current = setTimeout(() => {
      if (!hasMountedRef.current) return;
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

    const {
      fillId,
      outlineId,
      dashOutlineId,
      haloInnerLayerId,
      haloOuterLayerId,
      sparkleLayerId
    } = circleLayerRef.current;

    let animationTime = 0;

    const animate = () => {
      if (!isPlaying || !circleLayerRef.current) return;
      const dashPhase = ((animationTime * 0.5) % DASH_PATTERN_TOTAL) / DASH_PATTERN_TOTAL;
      const dashArray = computeDashArray(dashPhase);
      animationTime += 0.045;

      if (fillId && m.getLayer(fillId)) {
        m.setPaintProperty(fillId, 'fill-color', 'rgba(56, 189, 248, 0)');
        m.setPaintProperty(fillId, 'fill-opacity', 0);
      }

      if (outlineId && m.getLayer(outlineId)) {
        m.setPaintProperty(outlineId, 'line-color', 'rgba(37, 99, 235, 0.72)');
        m.setPaintProperty(outlineId, 'line-dasharray', dashArray);
      }

      if (dashOutlineId && m.getLayer(dashOutlineId)) {
        m.setPaintProperty(dashOutlineId, 'line-dasharray', dashArray);
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

    const circleSourceId = 'toyota-site-circle-source';
    const haloInnerSourceId = 'toyota-site-halo-inner-source';
    const haloOuterSourceId = 'toyota-site-halo-outer-source';
    const sparkleSourceId = 'toyota-site-sparkles-source';

    const fillId = 'toyota-site-circle-fill';
    const outlineId = 'toyota-site-circle-outline';
    const dashOutlineId = 'toyota-site-circle-dash-outline';
    const haloInnerLayerId = 'toyota-site-halo-inner';
    const haloOuterLayerId = 'toyota-site-halo-outer';
    const sparkleLayerId = 'toyota-site-sparkles';

    addOrUpdateSource(m, circleSourceId, createCircleFeature(TOYOTA_CENTER, TOYOTA_RADIUS_METERS));
    addOrUpdateSource(m, haloInnerSourceId, createCircleFeature(TOYOTA_CENTER, TOYOTA_RADIUS_METERS * 0.82));
    addOrUpdateSource(m, haloOuterSourceId, createCircleFeature(TOYOTA_CENTER, TOYOTA_RADIUS_METERS * 1.28));
    addOrUpdateSource(m, sparkleSourceId, {
      type: 'FeatureCollection',
      features: createSparkleFeatures(TOYOTA_CENTER, TOYOTA_RADIUS_METERS * 1.06)
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
        'fill-color': 'rgba(56, 189, 248, 0)',
        'fill-opacity': 0,
        'fill-outline-color': 'rgba(37, 99, 235, 0.32)'
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

    circleLayerRef.current = {
      sourceId: circleSourceId,
      haloInnerSourceId,
      haloOuterSourceId,
      sparkleSourceId,
      fillId,
      outlineId,
      dashOutlineId,
      haloInnerLayerId,
      haloOuterLayerId,
      sparkleLayerId
    };

    animateCircleLayers();
  }, [map, animateCircleLayers]);

  const addContextLayers = useCallback(() => {
    const m = map?.current;
    if (!m || !data) return;

    addOrUpdateSource(m, LAYER_IDS.source, data);

    if (!m.getLayer(LAYER_IDS.aoiFill)) {
      m.addLayer({
        id: LAYER_IDS.aoiFill,
        type: 'fill',
        source: LAYER_IDS.source,
        filter: ['==', ['get', 'category'], 'aoi'],
        paint: {
          'fill-color': '#3b82f6',
          'fill-opacity': 0.08
        }
      });
    }

    if (!m.getLayer(LAYER_IDS.aoiOuter)) {
      m.addLayer({
        id: LAYER_IDS.aoiOuter,
        type: 'line',
        source: LAYER_IDS.source,
        filter: ['==', ['get', 'category'], 'aoi_outer'],
        paint: {
          'line-color': '#3b82f6',
          'line-width': 2,
          'line-dasharray': [2, 2],
          'line-opacity': 0.9
        }
      });
    }

    if (!m.getLayer(LAYER_IDS.industrialFill)) {
      m.addLayer({
        id: LAYER_IDS.industrialFill,
        type: 'fill',
        source: LAYER_IDS.source,
        filter: ['==', ['get', 'category'], 'industrial'],
        paint: {
          'fill-color': '#f59e0b',
          'fill-opacity': 0.18
        }
      });
    }

    if (!m.getLayer(LAYER_IDS.roads)) {
      m.addLayer({
        id: LAYER_IDS.roads,
        type: 'line',
        source: LAYER_IDS.source,
        filter: ['any',
          ['==', ['get', 'category'], 'interstate'],
          ['==', ['get', 'category'], 'us_highway'],
          ['==', ['get', 'category'], 'state_highway'],
          ['==', ['get', 'category'], 'primary_road'],
          ['==', ['get', 'category'], 'secondary_road']
        ],
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'category'], 'interstate'], '#ef4444',
            ['==', ['get', 'category'], 'us_highway'], '#f97316',
            ['==', ['get', 'category'], 'state_highway'], '#fde047',
            ['==', ['get', 'category'], 'primary_road'], '#22c55e',
            '#94a3b8'
          ],
          'line-width': [
            'case',
            ['==', ['get', 'category'], 'interstate'], 3.5,
            ['==', ['get', 'category'], 'us_highway'], 3,
            ['==', ['get', 'category'], 'state_highway'], 2.5,
            2
          ],
          'line-opacity': 0.9
        }
      });
    }

    if (!m.getLayer(LAYER_IDS.power)) {
      m.addLayer({
        id: LAYER_IDS.power,
        type: 'circle',
        source: LAYER_IDS.source,
        filter: ['==', ['get', 'category'], 'power_facility'],
        paint: {
          'circle-color': '#0ea5e9',
          'circle-radius': 5,
          'circle-opacity': 0.9
        }
      });
    }

    if (!m.getLayer(LAYER_IDS.siteLabel)) {
      m.addLayer({
        id: LAYER_IDS.siteLabel,
        type: 'symbol',
        source: LAYER_IDS.source,
        filter: ['==', ['get', 'zone'], 'toyota_site'],
        layout: {
          'text-field': ['get', 'zone_name'],
          'text-size': 12,
          'text-anchor': 'top',
          'text-offset': [0, 1.2],
          'text-allow-overlap': true
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#000000',
          'text-halo-width': 1.5
        }
      });
    }
  }, [map, data]);

  const removeContextLayers = useCallback(() => {
    const m = map?.current;
    if (!m) return;

    safeRemove(m, LAYER_IDS.aoiFill);
    safeRemove(m, LAYER_IDS.aoiOuter);
    safeRemove(m, LAYER_IDS.industrialFill);
    safeRemove(m, LAYER_IDS.roads);
    safeRemove(m, LAYER_IDS.power);
    safeRemove(m, LAYER_IDS.siteLabel);
    safeRemove(m, LAYER_IDS.source, false);
  }, [map]);

  const handleCleanup = useCallback(() => {
    setIsPlaying(false);
    stopPlayback();
    removeChangeLayers();
    removeCalloutLayers();
    removeCircleLayer();
    emitTimelinePause();
  }, [stopPlayback, removeChangeLayers, removeCalloutLayers, removeCircleLayer, emitTimelinePause]);

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
      window.vinFastAnimationRef = {
        handlePlayPause,
        handleRestart,
        handleCleanup,
        currentPeriod: periodData[currentIndex]?.label || 'Latest period',
        isPlaying: () => isPlaying
      };
    }

    return () => {
      if (typeof window !== 'undefined' && window.vinFastAnimationRef) {
        delete window.vinFastAnimationRef;
      }
    };
  }, [handlePlayPause, handleRestart, handleCleanup, periodData, currentIndex, isPlaying]);

  useEffect(() => {
    let cancelled = false;

    const loadFrames = async () => {
      try {
        const responses = await Promise.all(
          PERIODS.map(async (period) => {
            try {
              const resp = await fetch(period.file, { cache: 'no-cache' });
              if (!resp.ok) return null;
              const geojson = await resp.json();
              return { ...period, geojson };
            } catch (error) {
              console.warn('🚗 Toyota CTA: failed to load change frame', { file: period.file, error });
              return null;
            }
          })
        );

        if (cancelled) return;
        const validFrames = responses.filter(Boolean);

        if (changeData && !validFrames.length) {
          setPeriodData([{ id: 'latest', label: 'Latest period', geojson: changeData }]);
        } else if (changeData) {
          const deduped = [{ id: 'latest', label: 'Latest period', geojson: changeData }].concat(
            validFrames.filter(frame => frame?.geojson)
          );
          setPeriodData(deduped);
        } else {
          setPeriodData(validFrames);
        }
        setCurrentIndex(0);
      } catch (error) {
        console.error('🚗 Toyota CTA: unexpected animation load error', error);
        if (changeData) {
          setPeriodData([{ id: 'latest', label: 'Latest period', geojson: changeData }]);
        }
      }
    };

    loadFrames();

    return () => {
      cancelled = true;
    };
  }, [changeData]);

  useEffect(() => {
    hasMountedRef.current = true;
    return () => {
      hasMountedRef.current = false;
      handleCleanup();
      removeCircleLayer();
      removeContextLayers();
    };
  }, [handleCleanup, removeCircleLayer, removeContextLayers]);

  useEffect(() => {
    if (!visible) {
      handleCleanup();
      removeCircleLayer();
      removeContextLayers();
      return;
    }

    addContextLayers();
    addCircleLayer();

    if (periodData.length > 0) {
      setIsPlaying(true);
    }
  }, [visible, periodData.length, addContextLayers, addCircleLayer, handleCleanup, removeCircleLayer, removeContextLayers]);

  useEffect(() => {
    if (!visible || !isPlaying) {
      stopPlayback();
      stopCircleAnimation();
      return;
    }

    if (!periodData.length) return;

    const current = periodData[currentIndex % periodData.length];
    addPeriodToMap(current, currentIndex);
    dimPreviousLayers();

    scheduleNext((currentIndex + 1) % periodData.length);
  }, [visible, isPlaying, periodData, currentIndex, addPeriodToMap, dimPreviousLayers, scheduleNext, stopPlayback, stopCircleAnimation]);

  useEffect(() => {
    if (!visible) {
      stopCircleAnimation();
      return;
    }

    if (isPlaying) {
      animateCircleLayers();
    } else {
      stopCircleAnimation();
    }
  }, [visible, isPlaying, animateCircleLayers, stopCircleAnimation]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.vinFastAnimationRef) {
      window.vinFastAnimationRef.currentPeriod = periodData[currentIndex]?.label || 'Latest period';
    }
  }, [periodData, currentIndex]);

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

  return null;
};

export default ToyotaBatteryChangeAnimation;
