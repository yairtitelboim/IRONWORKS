import { useEffect } from 'react';
import { joinSegments } from '../utils/routeSegments';

/**
 * Load multiple segment files, merge them into a MultiLineString, and add a single line layer.
 * Matches the behaviour in the path-animation-kit reference while accounting for Mapbox style reloads.
 */
export function useJoinedRouteEffect(
  mapRef,
  {
    enabled,
    sourceId,
    layerId,
    segmentFiles,
    paint = {},
    layout = {},
    onSegmentsLoaded,
    extraLayerIds = [],
  }
) {
  useEffect(() => {
    const map = mapRef?.current;
    if (!map) return undefined;

    const cleanup = () => {
      extraLayerIds.forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };

    if (!enabled) {
      cleanup();
      return cleanup;
    }

    let cancelled = false;

    const loadAll = async () => {
      try {
        const collections = await Promise.all(
          (segmentFiles || []).map((path) =>
            fetch(path).then((res) => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.json();
            })
          )
        );

        if (cancelled) return;

        const multi = joinSegments(collections);

        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, { type: 'geojson', data: multi });
        } else {
          map.getSource(sourceId).setData(multi);
        }

        if (!map.getLayer(layerId)) {
          map.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
              ...layout,
            },
            paint: {
              'line-width': 3,
              'line-opacity': 0.9,
              'line-color': '#FFD700',
              ...paint,
            },
          });
        }

        if (typeof onSegmentsLoaded === 'function') {
          onSegmentsLoaded(map, multi, collections);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[useJoinedRouteEffect] Failed to load segments:', err);
      }
    };

    const ensureLoadAfterStyle = () => {
      if (cancelled) return;
      loadAll();
    };

    if (map.isStyleLoaded()) {
      ensureLoadAfterStyle();
    } else {
      map.once('styledata', ensureLoadAfterStyle);
    }

    return () => {
      cancelled = true;
      map.off('styledata', ensureLoadAfterStyle);
      cleanup();
    };
  }, [
    mapRef,
    enabled,
    sourceId,
    layerId,
    segmentFiles,
    paint,
    layout,
    onSegmentsLoaded,
    extraLayerIds,
  ]);
}

export default {
  useJoinedRouteEffect,
};
