import { useCallback, useEffect, useMemo, useRef } from 'react';

/**
 * Lightweight particle animation along a polyline.
 * Mirrors the behaviour from the path-animation-kit reference.
 */
export default function usePathParticles({
  mapRef,
  enabled,
  sourceId,
  layerId,
  coordinates,
  particleCount = 60,
  particleColor = '#FFFFFF',
  particleSize = 5,
  speed = 0.00008,
  frameRate = 30,
}) {
  const animationState = useRef({
    frameId: null,
    timeoutId: null,
    lastUpdate: 0,
  });
  const updateParticlesRef = useRef(null);
  const frameInterval = useMemo(() => 1000 / Math.max(1, frameRate), [frameRate]);

  const clearTimers = useCallback(() => {
    if (animationState.current.frameId) {
      cancelAnimationFrame(animationState.current.frameId);
      animationState.current.frameId = null;
    }
    if (animationState.current.timeoutId) {
      clearTimeout(animationState.current.timeoutId);
      animationState.current.timeoutId = null;
    }
  }, []);

  const queueNextFrame = useCallback(
    (delay = 0) => {
      if (!enabled) return;
      if (delay > 0) {
        if (animationState.current.timeoutId != null) return;
        animationState.current.timeoutId = window.setTimeout(() => {
          animationState.current.timeoutId = null;
          if (!enabled) return;
          if (typeof updateParticlesRef.current === 'function') {
            animationState.current.frameId = requestAnimationFrame(updateParticlesRef.current);
          }
        }, delay);
        return;
      }
      if (typeof updateParticlesRef.current === 'function') {
        animationState.current.frameId = requestAnimationFrame(updateParticlesRef.current);
      }
    },
    [enabled]
  );

  const updateParticles = useCallback(() => {
    animationState.current.frameId = null;
    const map = mapRef?.current;
    if (!map || !coordinates?.length || !enabled) return;

    const frameNow = performance.now();
    const timeSinceLast = frameNow - animationState.current.lastUpdate;
    if (timeSinceLast < frameInterval) {
      queueNextFrame(frameInterval - timeSinceLast);
      return;
    }
    animationState.current.lastUpdate = frameNow;

    const nowMs = Date.now();
    const features = [];

    for (let i = 0; i < particleCount; i += 1) {
      const progress = ((nowMs * speed) + i / particleCount) % 1;
      const idx = Math.floor(progress * (coordinates.length - 1));
      const nextIdx = (idx + 1) % coordinates.length;
      const frac = (progress * (coordinates.length - 1)) % 1;

      const current = coordinates[idx];
      const next = coordinates[nextIdx];

      const lng = current[0] + (next[0] - current[0]) * frac;
      const lat = current[1] + (next[1] - current[1]) * frac;

      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {},
      });
    }

    const source = map.getSource(sourceId);
    if (source) {
      source.setData({ type: 'FeatureCollection', features });
    }

    queueNextFrame();
  }, [
    mapRef,
    coordinates,
    enabled,
    particleCount,
    speed,
    sourceId,
    queueNextFrame,
    frameInterval,
  ]);

  const ensureParticleSource = useCallback(() => {
    const map = mapRef?.current;
    if (!map || !coordinates?.length) return;

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }

    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': particleSize,
          'circle-color': particleColor,
          'circle-opacity': 0.85,
          'circle-blur': 0.2,
        },
      });
    }

    if (!animationState.current.frameId && !animationState.current.timeoutId) {
      queueNextFrame();
    }
  }, [mapRef, coordinates, sourceId, layerId, particleColor, particleSize, queueNextFrame]);

  const teardownParticleSource = useCallback(() => {
    const map = mapRef?.current;
    clearTimers();
    animationState.current.lastUpdate = 0;
    if (!map) return;
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  }, [mapRef, layerId, sourceId, clearTimers]);

  useEffect(() => {
    updateParticlesRef.current = updateParticles;
  }, [updateParticles]);

  useEffect(() => {
    if (enabled) {
      ensureParticleSource();
    } else {
      teardownParticleSource();
    }
    return () => {
      teardownParticleSource();
    };
  }, [enabled, ensureParticleSource, teardownParticleSource]);

  return { ensureParticleSource, teardownParticleSource };
}
