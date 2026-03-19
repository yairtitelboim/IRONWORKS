import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import { generateCircle, generateMask, clipFeaturesToCircle, prefilterLocalSubset } from '../utils/powerCircleGeometry';
import {
  getVoltageColorExpression,
  getVoltageLabelExpression,
  CIRCLE_BORDER_STYLE,
  CIRCLE_HALO_STYLE
} from '../utils/powerCircleStyling';
import { analyzePowerLines, getVoltageKv } from '../utils/powerLineAnalysis';
import { getHIFLDLines, isSupabaseConfigured } from '../../../services/powerGridApi';

const CIRCLE_SOURCE_ID = 'power-circle-source';
const CIRCLE_BORDER_LAYER_ID = 'power-circle-border';
const CIRCLE_HALO_LAYER_ID = 'power-circle-halo';
const MASK_SOURCE_ID = 'power-circle-mask-source';
const MASK_LAYER_ID = 'power-circle-mask';
const LINES_SOURCE_ID = 'power-circle-lines-source';
const POWER_LINES_LAYER_ID = 'power-circle-power-lines';
const POWER_HALO_LAYER_ID = 'power-circle-power-lines-halo';
const POWER_LABEL_LAYER_ID = 'power-circle-power-lines-labels';
const PARTICLE_SOURCE_ID = 'power-circle-particles-source';
const PARTICLE_LAYER_ID = 'power-circle-particles';

const PowerCircleLayer = ({ map, center, radiusMiles = 5, isActive = false, onRadiusChange }) => {
  const [masterData, setMasterData] = useState(null);
  const [localSubset, setLocalSubset] = useState(null);
  const sourceLoadedRef = useRef(false);
  const layersAddedRef = useRef(false);
  const handleMarkerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const clippingFrameRef = useRef(null);
  const lastClippingTimeRef = useRef(0);
  const localSubsetRef = useRef(null);
  const dragStyleTimeoutRef = useRef(null);
  const radiusTooltipRef = useRef(null);
  const radiusLabelRef = useRef(null);
  const pulseAnimationRef = useRef(null);
  const isDraggingRef = useRef(false);
  const particleAnimationRef = useRef(null);
  const particleStartTimeoutRef = useRef(null);

  useEffect(() => {
    if (!isActive || !center) return;
    let cancelled = false;

    const milesToMeters = (mi) => mi * 1609.34;
    // Fetch radius: max draggable (10mi) + generous buffer for prefilter
    const fetchRadius = milesToMeters(Math.max(radiusMiles, 5) * 2.5);

    getHIFLDLines({ lng: center[0], lat: center[1] }, fetchRadius)
      .then((data) => {
        if (!cancelled) {
          setMasterData(data);
          sourceLoadedRef.current = true;
          layersAddedRef.current = false;
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMasterData({ type: 'FeatureCollection', features: [] });
          sourceLoadedRef.current = true;
          layersAddedRef.current = false;
        }
      });

    return () => { cancelled = true; };
  }, [isActive, center]);

  useEffect(() => {
    if (!masterData || !center || !isActive) return;
    const subset = prefilterLocalSubset(masterData, center, 15);
    setLocalSubset(subset);
    localSubsetRef.current = subset;
  }, [masterData, center, isActive]);

  const getHandlePosition = (centerCoords, radius) => {
    if (!centerCoords || !radius) return null;
    const centerPoint = turf.point(centerCoords);
    const fallback = turf.destination(centerPoint, radius, 180, { units: 'miles' }).geometry.coordinates;
    const mapInstance = map?.current;
    if (!mapInstance?.project) return fallback;

    try {
      // Pick the circle point that is visually lowest on screen.
      let bestCoords = fallback;
      let bestY = -Infinity;
      const steps = 72;

      for (let i = 0; i < steps; i += 1) {
        const bearing = (i / steps) * 360;
        const candidate = turf.destination(centerPoint, radius, bearing, { units: 'miles' }).geometry.coordinates;
        const projected = mapInstance.project(candidate);
        if (Number.isFinite(projected?.y) && projected.y > bestY) {
          bestY = projected.y;
          bestCoords = candidate;
        }
      }
      return bestCoords;
    } catch (_) {
      return fallback;
    }
  };

  const calculateRadiusFromHandle = (centerCoords, handleCoords) => {
    if (!centerCoords || !handleCoords) return radiusMiles;
    const distanceMiles = turf.distance(turf.point(centerCoords), turf.point(handleCoords), { units: 'miles' });
    return Math.max(0.5, Math.min(50, distanceMiles));
  };

  const getVoltageColorForFeature = (feature) => {
    if (!feature?.properties) return '#3b82f6';
    const v = getVoltageKv(feature);
    if (v >= 500) return '#dc2626';
    if (v >= 345) return '#ef4444';
    if (v >= 230) return '#f97316';
    if (v >= 138) return '#fbbf24';
    if (v >= 69) return '#22d3ee';
    return '#3b82f6';
  };

  const updateCircleDragStyle = (mapInstance, active) => {
    if (!mapInstance.getLayer(CIRCLE_BORDER_LAYER_ID) || !mapInstance.getLayer(CIRCLE_HALO_LAYER_ID)) return;
    if (active) {
      mapInstance.setPaintProperty(CIRCLE_BORDER_LAYER_ID, 'line-color', '#fbbf24');
      mapInstance.setPaintProperty(CIRCLE_BORDER_LAYER_ID, 'line-width', 4);
      mapInstance.setPaintProperty(CIRCLE_BORDER_LAYER_ID, 'line-opacity', 1);
      mapInstance.setPaintProperty(CIRCLE_HALO_LAYER_ID, 'line-color', '#fbbf24');
      mapInstance.setPaintProperty(CIRCLE_HALO_LAYER_ID, 'line-width', 8);
      mapInstance.setPaintProperty(CIRCLE_HALO_LAYER_ID, 'line-opacity', 0.6);
      mapInstance.setPaintProperty(CIRCLE_HALO_LAYER_ID, 'line-blur', 6);
      if (mapInstance.getLayer(POWER_HALO_LAYER_ID)) mapInstance.setPaintProperty(POWER_HALO_LAYER_ID, 'line-width', 3);
      if (mapInstance.getLayer(POWER_LINES_LAYER_ID)) mapInstance.setPaintProperty(POWER_LINES_LAYER_ID, 'line-width', 1.6);
    } else {
      mapInstance.setPaintProperty(CIRCLE_BORDER_LAYER_ID, 'line-color', CIRCLE_BORDER_STYLE['line-color']);
      mapInstance.setPaintProperty(CIRCLE_BORDER_LAYER_ID, 'line-width', CIRCLE_BORDER_STYLE['line-width']);
      mapInstance.setPaintProperty(CIRCLE_BORDER_LAYER_ID, 'line-opacity', CIRCLE_BORDER_STYLE['line-opacity']);
      mapInstance.setPaintProperty(CIRCLE_HALO_LAYER_ID, 'line-color', CIRCLE_HALO_STYLE['line-color']);
      mapInstance.setPaintProperty(CIRCLE_HALO_LAYER_ID, 'line-width', CIRCLE_HALO_STYLE['line-width']);
      mapInstance.setPaintProperty(CIRCLE_HALO_LAYER_ID, 'line-opacity', CIRCLE_HALO_STYLE['line-opacity']);
      mapInstance.setPaintProperty(CIRCLE_HALO_LAYER_ID, 'line-blur', CIRCLE_HALO_STYLE['line-blur']);
      if (mapInstance.getLayer(POWER_HALO_LAYER_ID)) mapInstance.setPaintProperty(POWER_HALO_LAYER_ID, 'line-width', 1.5);
      if (mapInstance.getLayer(POWER_LINES_LAYER_ID)) mapInstance.setPaintProperty(POWER_LINES_LAYER_ID, 'line-width', 0.8);
    }
  };

  const startPowerLinePulseAnimation = (mapInstance) => {
    if (!mapInstance) return;
    stopPowerLinePulseAnimation(mapInstance);
    let startTime = performance.now();
    const animate = (currentTime) => {
      if (!isDraggingRef.current || !mapInstance.getLayer(POWER_HALO_LAYER_ID) || !mapInstance.getLayer(POWER_LINES_LAYER_ID)) {
        pulseAnimationRef.current = null;
        return;
      }
      const elapsed = (currentTime - startTime) / 1000;
      const pulseValue = (Math.sin(elapsed * Math.PI * 4) + 1) / 2;
      const opacity = 0.6 + pulseValue * 0.4;
      const blur = 1.2 + pulseValue * 2.3;
      const haloWidth = 3 + pulseValue;
      mapInstance.setPaintProperty(POWER_HALO_LAYER_ID, 'line-opacity', opacity);
      mapInstance.setPaintProperty(POWER_HALO_LAYER_ID, 'line-blur', blur);
      mapInstance.setPaintProperty(POWER_HALO_LAYER_ID, 'line-width', haloWidth);
      mapInstance.setPaintProperty(POWER_LINES_LAYER_ID, 'line-opacity', opacity);
      pulseAnimationRef.current = requestAnimationFrame(animate);
    };
    pulseAnimationRef.current = requestAnimationFrame(animate);
  };

  const stopPowerLinePulseAnimation = (mapInstance) => {
    if (pulseAnimationRef.current) {
      cancelAnimationFrame(pulseAnimationRef.current);
      pulseAnimationRef.current = null;
    }
    if (mapInstance?.getLayer(POWER_HALO_LAYER_ID) && mapInstance.getLayer(POWER_LINES_LAYER_ID)) {
      mapInstance.setPaintProperty(POWER_HALO_LAYER_ID, 'line-opacity', 0.6);
      mapInstance.setPaintProperty(POWER_HALO_LAYER_ID, 'line-blur', 1.2);
      mapInstance.setPaintProperty(POWER_HALO_LAYER_ID, 'line-width', 3);
      mapInstance.setPaintProperty(POWER_LINES_LAYER_ID, 'line-opacity', 0.6);
    }
  };

  const startParticleAnimation = (mapInstance, lineFeatures) => {
    if (!mapInstance || !lineFeatures?.length) return;
    stopParticleAnimation(mapInstance);
    const powerLines = lineFeatures.filter(
      (f) => f?.geometry?.type === 'LineString' && f.geometry.coordinates?.length >= 2
    );
    if (!powerLines.length) return;

    if (!mapInstance.getSource(PARTICLE_SOURCE_ID)) {
      mapInstance.addSource(PARTICLE_SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    }
    if (!mapInstance.getLayer(PARTICLE_LAYER_ID)) {
      mapInstance.addLayer(
        {
          id: PARTICLE_LAYER_ID,
          type: 'circle',
          source: PARTICLE_SOURCE_ID,
          paint: { 'circle-radius': 2.4, 'circle-color': ['get', 'color'], 'circle-opacity': 0.9 }
        },
        POWER_LABEL_LAYER_ID
      );
    }

    const speed = 0.0001;
    const particlesPerLine = 3;
    const animate = () => {
      if (!mapInstance.getSource(PARTICLE_SOURCE_ID)) {
        particleAnimationRef.current = null;
        return;
      }
      const now = Date.now() * speed;
      const features = [];
      powerLines.forEach((lineFeature, lineIndex) => {
        const coords = lineFeature.geometry.coordinates;
        const lineColor = getVoltageColorForFeature(lineFeature);
        const lineOffset = lineIndex * 0.2;
        for (let i = 0; i < particlesPerLine; i++) {
          const particleOffset = i / particlesPerLine + lineOffset;
          const progress = (now + particleOffset) % 1;
          const coordIndex = Math.floor(progress * (coords.length - 1));
          const nextIndex = Math.min(coordIndex + 1, coords.length - 1);
          const frac = (progress * (coords.length - 1)) % 1;
          const current = coords[coordIndex];
          const next = coords[nextIndex];
          if (current && next && current.length >= 2 && next.length >= 2) {
            features.push({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [
                  current[0] + (next[0] - current[0]) * frac,
                  current[1] + (next[1] - current[1]) * frac
                ]
              },
              properties: { color: lineColor }
            });
          }
        }
      });
      const source = mapInstance.getSource(PARTICLE_SOURCE_ID);
      if (source) source.setData({ type: 'FeatureCollection', features });
      particleAnimationRef.current = requestAnimationFrame(animate);
    };
    particleStartTimeoutRef.current = setTimeout(() => {
      particleAnimationRef.current = requestAnimationFrame(animate);
    }, 500);
  };

  const stopParticleAnimation = (mapInstance) => {
    if (particleStartTimeoutRef.current) {
      clearTimeout(particleStartTimeoutRef.current);
      particleStartTimeoutRef.current = null;
    }
    if (particleAnimationRef.current) {
      cancelAnimationFrame(particleAnimationRef.current);
      particleAnimationRef.current = null;
    }
    if (mapInstance?.getSource(PARTICLE_SOURCE_ID)) {
      mapInstance.getSource(PARTICLE_SOURCE_ID).setData({ type: 'FeatureCollection', features: [] });
    }
  };

  const updateClippingThrottled = (mapInstance, centerCoords, radius, localData) => {
    const now = performance.now();
    if (now - lastClippingTimeRef.current < 16 && clippingFrameRef.current) return;
    lastClippingTimeRef.current = now;
    if (clippingFrameRef.current) cancelAnimationFrame(clippingFrameRef.current);

    clippingFrameRef.current = requestAnimationFrame(() => {
      try {
        const circlePolygon = generateCircle(centerCoords, radius);
        const clippedData = clipFeaturesToCircle(localData, circlePolygon);
        const validData = {
          type: 'FeatureCollection',
          features: Array.isArray(clippedData.features) ? clippedData.features : []
        };
        const source = mapInstance.getSource(LINES_SOURCE_ID);
        if (source) {
          if (mapInstance.getLayer(POWER_LABEL_LAYER_ID)) {
            try {
              mapInstance.removeLayer(POWER_LABEL_LAYER_ID);
            } catch (_) {}
          }
          source.setData(validData);
          const analysis = analyzePowerLines(validData.features, centerCoords);
          if (window.mapEventBus && validData.features.length > 0) {
            window.mapEventBus.emit('power-circle:analysis-ready', {
              center: centerCoords,
              radius,
              analysis
            });
          }
          startParticleAnimation(mapInstance, validData.features);
          if (validData.features.length > 0) {
            requestAnimationFrame(() => {
              try {
                if (!mapInstance.getLayer(POWER_LABEL_LAYER_ID)) addPowerLineLayers(mapInstance, validData);
              } catch (_) {}
            });
          }
        }
      } catch (_) {}
      clippingFrameRef.current = null;
    });
  };

  const addPowerLineLayers = (mapInstance, dataToCheck = null) => {
    if (!mapInstance.getSource(LINES_SOURCE_ID)) return;
    const source = mapInstance.getSource(LINES_SOURCE_ID);
    if (!source.loaded) {
      source.once('data', () => {
        if (source.loaded) addPowerLineLayers(mapInstance, dataToCheck);
      });
      return;
    }
    const sourceData = dataToCheck || source._data || { features: [] };
    const hasPower = sourceData.features?.some(
      (f) => f?.geometry?.type === 'LineString' && f.geometry.coordinates?.length >= 2
    );
    if (!hasPower) return;

    const voltageColorExpr = getVoltageColorExpression();
    const voltageLabelExpr = getVoltageLabelExpression();

    if (!mapInstance.getLayer(POWER_HALO_LAYER_ID)) {
      mapInstance.addLayer({
        id: POWER_HALO_LAYER_ID,
        type: 'line',
        source: LINES_SOURCE_ID,
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: {
          'line-color': voltageColorExpr,
          'line-width': 1.5,
          'line-opacity': 0.6,
          'line-blur': 1.2
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' }
      });
    }
    if (!mapInstance.getLayer(POWER_LINES_LAYER_ID)) {
      mapInstance.addLayer({
        id: POWER_LINES_LAYER_ID,
        type: 'line',
        source: LINES_SOURCE_ID,
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: {
          'line-color': voltageColorExpr,
          'line-width': 0.8,
          'line-opacity': 0.6
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' }
      });
    }
    if (!mapInstance.getLayer(POWER_LABEL_LAYER_ID)) {
      try {
        mapInstance.addLayer({
          id: POWER_LABEL_LAYER_ID,
          type: 'symbol',
          source: LINES_SOURCE_ID,
          filter: ['==', ['geometry-type'], 'LineString'],
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 400,
            'text-field': voltageLabelExpr,
            'text-size': 22,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-keep-upright': true,
            'text-offset': [0, -0.5]
          },
          paint: { 'text-color': voltageColorExpr, 'text-halo-width': 0 }
        });
      } catch (_) {}
    }
  };

  const setupLayers = (mapInstance, centerCoords, radius) => {
    const circlePolygon = generateCircle(centerCoords, radius);
    const maskPolygon = generateMask(centerCoords, radius);

    if (!mapInstance.getSource(MASK_SOURCE_ID)) {
      mapInstance.addSource(MASK_SOURCE_ID, { type: 'geojson', data: maskPolygon });
    } else {
      mapInstance.getSource(MASK_SOURCE_ID).setData(maskPolygon);
    }
    if (!mapInstance.getSource(CIRCLE_SOURCE_ID)) {
      mapInstance.addSource(CIRCLE_SOURCE_ID, { type: 'geojson', data: circlePolygon });
    } else {
      mapInstance.getSource(CIRCLE_SOURCE_ID).setData(circlePolygon);
    }

    if (!mapInstance.getLayer(CIRCLE_HALO_LAYER_ID)) {
      mapInstance.addLayer({
        id: CIRCLE_HALO_LAYER_ID,
        type: 'line',
        source: CIRCLE_SOURCE_ID,
        paint: CIRCLE_HALO_STYLE
      });
    }
    if (!mapInstance.getLayer(CIRCLE_BORDER_LAYER_ID)) {
      mapInstance.addLayer({
        id: CIRCLE_BORDER_LAYER_ID,
        type: 'line',
        source: CIRCLE_SOURCE_ID,
        paint: CIRCLE_BORDER_STYLE
      });
    }

    if (!mapInstance.getLayer(MASK_LAYER_ID)) {
      try {
        let beforeLayer = null;
        for (const id of ['water', 'landcover', 'land']) {
          if (mapInstance.getLayer(id)) {
            beforeLayer = id;
            break;
          }
        }
        beforeLayer = beforeLayer || CIRCLE_HALO_LAYER_ID;
        mapInstance.addLayer(
          {
            id: MASK_LAYER_ID,
            type: 'fill',
            source: MASK_SOURCE_ID,
            paint: { 'fill-color': '#000000', 'fill-opacity': 0.35 }
          },
          beforeLayer
        );
      } catch (_) {}
    }

    if (localSubset?.features?.length > 0) {
      if (!layersAddedRef.current) {
        const clippedData = clipFeaturesToCircle(localSubset, circlePolygon);
        const validData = {
          type: 'FeatureCollection',
          features: Array.isArray(clippedData.features) ? clippedData.features : []
        };
        if (!mapInstance.getSource(LINES_SOURCE_ID)) {
          mapInstance.addSource(LINES_SOURCE_ID, { type: 'geojson', data: validData });
        } else {
          mapInstance.getSource(LINES_SOURCE_ID).setData(validData);
        }
        if (validData.features.length > 0) {
          const src = mapInstance.getSource(LINES_SOURCE_ID);
          const addWhenReady = () => {
            if (src.loaded) {
              requestAnimationFrame(() => {
                try {
                  addPowerLineLayers(mapInstance, validData);
                  layersAddedRef.current = true;
                  const analysis = analyzePowerLines(validData.features, centerCoords);
                  if (window.mapEventBus) {
                    window.mapEventBus.emit('power-circle:analysis-ready', {
                      center: centerCoords,
                      radius,
                      analysis
                    });
                  }
                  startParticleAnimation(mapInstance, validData.features);
                } catch (_) {}
              });
            } else {
              src.on('data', () => {
                if (src.loaded && !layersAddedRef.current) {
                  requestAnimationFrame(() => {
                    try {
                      addPowerLineLayers(mapInstance, validData);
                      layersAddedRef.current = true;
                    } catch (_) {}
                  });
                }
              });
            }
          };
          addWhenReady();
        }
      } else {
        const clippedData = clipFeaturesToCircle(localSubset, circlePolygon);
        const validData = {
          type: 'FeatureCollection',
          features: Array.isArray(clippedData.features) ? clippedData.features : []
        };
        const src = mapInstance.getSource(LINES_SOURCE_ID);
        if (src) {
          if (mapInstance.getLayer(POWER_LABEL_LAYER_ID)) {
            try {
              mapInstance.removeLayer(POWER_LABEL_LAYER_ID);
            } catch (_) {}
          }
          src.setData(validData);
          if (validData.features.length > 0) {
            [POWER_LINES_LAYER_ID, POWER_HALO_LAYER_ID].forEach((id) => {
              if (mapInstance.getLayer(id)) mapInstance.setLayoutProperty(id, 'visibility', 'visible');
            });
            requestAnimationFrame(() => {
              try {
                if (!mapInstance.getLayer(POWER_LABEL_LAYER_ID)) addPowerLineLayers(mapInstance, validData);
              } catch (_) {}
            });
          } else {
            [POWER_LINES_LAYER_ID, POWER_HALO_LAYER_ID].forEach((id) => {
              if (mapInstance.getLayer(id)) mapInstance.setLayoutProperty(id, 'visibility', 'none');
            });
          }
        }
      }
    } else {
      [POWER_LINES_LAYER_ID, POWER_HALO_LAYER_ID, POWER_LABEL_LAYER_ID].forEach((id) => {
        if (mapInstance.getLayer(id)) mapInstance.setLayoutProperty(id, 'visibility', 'none');
      });
      const src = mapInstance.getSource(LINES_SOURCE_ID);
      if (src) src.setData({ type: 'FeatureCollection', features: [] });
    }
  };

  const removeAllHandles = (mapInstance) => {
    if (handleMarkerRef.current) {
      try {
        handleMarkerRef.current.remove();
      } catch (_) {}
      handleMarkerRef.current = null;
    }
    // Remove any orphaned handles (e.g. from rapid re-activations)
    try {
      const container = mapInstance.getContainer?.();
      if (container) {
        container.querySelectorAll('.power-circle-handle').forEach((handleEl) => {
          const markerEl = handleEl.closest('.mapboxgl-marker');
          if (markerEl) markerEl.remove();
        });
      }
    } catch (_) {}
  };

  const cleanup = (mapInstance) => {
    stopPowerLinePulseAnimation(mapInstance);
    stopParticleAnimation(mapInstance);
    isDraggingRef.current = false;
    if (clippingFrameRef.current) {
      cancelAnimationFrame(clippingFrameRef.current);
      clippingFrameRef.current = null;
    }
    if (dragStyleTimeoutRef.current) {
      clearTimeout(dragStyleTimeoutRef.current);
      dragStyleTimeoutRef.current = null;
    }
    if (mapInstance.getLayer(CIRCLE_BORDER_LAYER_ID) && mapInstance.getLayer(CIRCLE_HALO_LAYER_ID)) {
      updateCircleDragStyle(mapInstance, false);
    }
    removeAllHandles(mapInstance);
    ;[MASK_LAYER_ID, CIRCLE_BORDER_LAYER_ID, CIRCLE_HALO_LAYER_ID, POWER_LINES_LAYER_ID, POWER_HALO_LAYER_ID, POWER_LABEL_LAYER_ID, PARTICLE_LAYER_ID].forEach(
      (id) => {
        if (mapInstance.getLayer(id)) mapInstance.removeLayer(id);
      }
    );
    ;[MASK_SOURCE_ID, CIRCLE_SOURCE_ID, LINES_SOURCE_ID, PARTICLE_SOURCE_ID].forEach((id) => {
      if (mapInstance.getSource(id)) mapInstance.removeSource(id);
    });
    layersAddedRef.current = false;
    setIsDragging(false);
  };

  useEffect(() => {
    if (!map?.current || !isActive || !center) {
      if (map?.current) cleanup(map.current);
      return;
    }
    const mapInstance = map.current;
    if (!mapInstance.isStyleLoaded()) {
      mapInstance.once('styledata', () => {
        if (isActive && center) setupLayers(mapInstance, center, radiusMiles);
      });
      return;
    }
    setupLayers(mapInstance, center, radiusMiles);
  }, [map, isActive, center, radiusMiles, localSubset]);

  useEffect(() => {
    if (!map?.current || !isActive || !center || !onRadiusChange) {
      if (map?.current) removeAllHandles(map.current);
      return;
    }
    const mapInstance = map.current;
    if (!mapInstance.isStyleLoaded()) {
      mapInstance.once('styledata', () => {
        if (isActive && center && onRadiusChange && !handleMarkerRef.current) {
          setTimeout(() => {
            if (mapInstance.getSource(CIRCLE_SOURCE_ID)) {
              const pos = getHandlePosition(center, radiusMiles);
              if (pos) createHandleMarker(mapInstance, pos, center, radiusMiles);
            }
          }, 300);
        }
      });
      return;
    }
    if (!mapInstance.getSource(CIRCLE_SOURCE_ID)) {
      const iv = setInterval(() => {
        if (mapInstance.getSource(CIRCLE_SOURCE_ID)) {
          clearInterval(iv);
          if (!handleMarkerRef.current && isActive && center && onRadiusChange) {
            const pos = getHandlePosition(center, radiusMiles);
            if (pos) createHandleMarker(mapInstance, pos, center, radiusMiles);
          }
        }
      }, 100);
      setTimeout(() => clearInterval(iv), 2000);
      return () => clearInterval(iv);
    }
    const pos = getHandlePosition(center, radiusMiles);
    if (!pos) return;
    if (!handleMarkerRef.current) {
      createHandleMarker(mapInstance, pos, center, radiusMiles);
    } else if (!isDragging) {
      const newPos = getHandlePosition(center, radiusMiles);
      if (newPos) {
        const cur = handleMarkerRef.current.getLngLat();
        if (turf.distance(turf.point([cur.lng, cur.lat]), turf.point(newPos), { units: 'meters' }) > 1) {
          handleMarkerRef.current.setLngLat(newPos);
        }
      }
      updateRadiusLabel(radiusMiles, false);
    }
    return () => {
      if (handleMarkerRef.current) {
        handleMarkerRef.current.remove();
        handleMarkerRef.current = null;
      }
    };
  }, [map, isActive, center, radiusMiles, onRadiusChange, isDragging, localSubset]);

  useEffect(() => {
    const mapInstance = map?.current;
    if (!mapInstance || !isActive || !center || isDragging) return undefined;

    const syncHandleToVisualBottom = () => {
      if (!handleMarkerRef.current) return;
      const nextPos = getHandlePosition(center, radiusMiles);
      if (!nextPos) return;
      handleMarkerRef.current.setLngLat(nextPos);
    };

    mapInstance.on('rotate', syncHandleToVisualBottom);
    mapInstance.on('pitch', syncHandleToVisualBottom);

    return () => {
      mapInstance.off('rotate', syncHandleToVisualBottom);
      mapInstance.off('pitch', syncHandleToVisualBottom);
    };
  }, [map, isActive, center, radiusMiles, isDragging]);

  const updateRadiusLabel = (radius, dragging) => {
    if (!radiusLabelRef.current) return;
    radiusLabelRef.current.textContent = `${radius.toFixed(2)} mi`;
    radiusLabelRef.current.style.opacity = dragging ? '0' : '1';
    radiusLabelRef.current.style.visibility = dragging ? 'hidden' : 'visible';
  };

  const updateRadiusTooltip = (radius, visible) => {
    if (!radiusTooltipRef.current) return;
    radiusTooltipRef.current.textContent = `${radius.toFixed(2)} miles`;
    radiusTooltipRef.current.style.opacity = visible ? '1' : '0';
    radiusTooltipRef.current.style.visibility = visible ? 'visible' : 'hidden';
  };

  const createHandleMarker = (mapInstance, handlePosition, centerCoords, radius) => {
    removeAllHandles(mapInstance);
    const container = document.createElement('div');
    container.style.position = 'relative';
    container.style.display = 'inline-block';

    const tooltip = document.createElement('div');
    tooltip.className = 'power-circle-radius-tooltip';
    Object.assign(tooltip.style, {
      position: 'absolute',
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%) translateY(-8px)',
      backgroundColor: '#000',
      color: '#f97316',
      padding: '6px 12px',
      borderRadius: '6px',
      fontSize: '14px',
      fontWeight: 'bold',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      zIndex: 10001,
      boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
      opacity: '0',
      visibility: 'hidden'
    });
    radiusTooltipRef.current = tooltip;
    container.appendChild(tooltip);

    const label = document.createElement('div');
    label.className = 'power-circle-radius-label';
    Object.assign(label.style, {
      position: 'absolute',
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%) translateY(-8px)',
      backgroundColor: 'rgba(0,0,0,0.7)',
      color: '#fff',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 500,
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      zIndex: 10001
    });
    radiusLabelRef.current = label;
    container.appendChild(label);

    const handleEl = document.createElement('div');
    handleEl.className = 'power-circle-handle';
    handleEl.setAttribute('data-tour', 'radius-handle');
    Object.assign(handleEl.style, {
      width: '48px',
      height: '24px',
      borderRadius: '12px',
      backgroundColor: '#3b82f6',
      border: 'none',
      cursor: 'grab',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5), 0 0 0 3px rgba(59,130,246,0.4)',
      zIndex: 10000,
      pointerEvents: 'auto',
      userSelect: 'none'
    });
    container.appendChild(handleEl);

    const marker = new mapboxgl.Marker({ element: container, draggable: true, anchor: 'center' })
      .setLngLat(handlePosition)
      .addTo(mapInstance);

    updateRadiusLabel(radius, false);
    let currentRadius = radius;

    if (window.mapEventBus) {
      window.mapEventBus.emit('power-circle:radius-changed', {
        center: centerCoords,
        radius: currentRadius
      });
    }

    let rafId = null;
    let pendingRadius = null;
    const updateRadius = () => {
      if (pendingRadius != null && onRadiusChange) {
        onRadiusChange(pendingRadius);
        pendingRadius = null;
      }
      rafId = null;
    };

    marker.on('drag', () => {
      const newPos = marker.getLngLat();
      currentRadius = calculateRadiusFromHandle(centerCoords, [newPos.lng, newPos.lat]);
      if (window.mapEventBus) {
        window.mapEventBus.emit('power-circle:radius-changed', {
          center: centerCoords,
          radius: currentRadius
        });
      }
      pendingRadius = currentRadius;
      updateRadiusTooltip(currentRadius, true);
      updateRadiusLabel(currentRadius, true);
      const circlePolygon = generateCircle(centerCoords, currentRadius);
      const circleSource = mapInstance.getSource(CIRCLE_SOURCE_ID);
      if (circleSource) circleSource.setData(circlePolygon);
      const maskSource = mapInstance.getSource(MASK_SOURCE_ID);
      if (maskSource) maskSource.setData(generateMask(centerCoords, currentRadius));
      const subset = localSubsetRef.current;
      if (subset?.features?.length) updateClippingThrottled(mapInstance, centerCoords, currentRadius, subset);
      if (!rafId) rafId = requestAnimationFrame(updateRadius);
    });

    marker.on('dragstart', () => {
      setIsDragging(true);
      isDraggingRef.current = true;
      if (window.mapEventBus) window.mapEventBus.emit('power-circle:drag-start');
      handleEl.style.cursor = 'grabbing';
      handleEl.style.backgroundColor = '#fbbf24';
      handleEl.style.boxShadow = '0 8px 24px rgba(251,191,36,0.8)';
      updateRadiusTooltip(currentRadius, true);
      updateRadiusLabel(currentRadius, true);
      updateCircleDragStyle(mapInstance, true);
      startPowerLinePulseAnimation(mapInstance);
      if (mapInstance.getLayer(PARTICLE_LAYER_ID)) mapInstance.setLayoutProperty(PARTICLE_LAYER_ID, 'visibility', 'none');
      mapInstance.dragPan.disable();
      mapInstance.boxZoom.disable();
      mapInstance.scrollZoom.disable();
    });

    marker.on('dragend', () => {
      setIsDragging(false);
      isDraggingRef.current = false;
      stopPowerLinePulseAnimation(mapInstance);
      if (window.mapEventBus) window.mapEventBus.emit('power-circle:drag-end');
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (pendingRadius != null && onRadiusChange) {
        onRadiusChange(pendingRadius);
        pendingRadius = null;
      }
      if (window.mapEventBus) {
        window.mapEventBus.emit('power-circle:radius-changed', {
          center: centerCoords,
          radius: currentRadius
        });
      }
      handleEl.style.cursor = 'grab';
      handleEl.style.backgroundColor = '#3b82f6';
      handleEl.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5), 0 0 0 3px rgba(59,130,246,0.4)';
      mapInstance.dragPan.enable();
      mapInstance.boxZoom.enable();
      mapInstance.scrollZoom.enable();
      updateRadiusTooltip(currentRadius, false);
      updateRadiusLabel(currentRadius, false);
      dragStyleTimeoutRef.current = setTimeout(() => {
        updateCircleDragStyle(mapInstance, false);
        dragStyleTimeoutRef.current = null;
      }, 500);
      setTimeout(() => {
        if (mapInstance.getLayer(PARTICLE_LAYER_ID)) mapInstance.setLayoutProperty(PARTICLE_LAYER_ID, 'visibility', 'visible');
      }, 500);
      setTimeout(() => {
        if (handleMarkerRef.current === marker) {
          const finalPos = getHandlePosition(centerCoords, currentRadius);
          if (finalPos) marker.setLngLat(finalPos);
        }
      }, 100);
    });

    handleMarkerRef.current = marker;
  };

  return null;
};

export default PowerCircleLayer;
