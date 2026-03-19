/**
 * Map style controller helpers
 *
 * Centralize Mapbox GL style mutations so UI components don't have to know
 * about layer ids, paint/layout properties, or style loading edge cases.
 */

const getStyleSafe = (mapInstance) => {
  if (!mapInstance || typeof mapInstance.getStyle !== 'function') return null;
  try {
    return mapInstance.getStyle() || null;
  } catch {
    return null;
  }
};

/**
 * Emphasize main roads/highways by adjusting line width/color/opacity
 * and optionally labels. This mirrors the existing behavior in LayerToggle.
 */
export const setMainRoadsEmphasis = (mapInstance, enabled) => {
  if (!mapInstance) return;

  // If style isn't loaded yet, attach a one-time listener and bail.
  if (typeof mapInstance.isStyleLoaded === 'function' && !mapInstance.isStyleLoaded()) {
    const onStyleLoad = () => {
      setMainRoadsEmphasis(mapInstance, enabled);
      mapInstance.off('styledata', onStyleLoad);
    };
    mapInstance.once('styledata', onStyleLoad);
    return;
  }

  const ROAD_LAYER_IDS = ['road-primary', 'road-secondary', 'road-street', 'road'];
  const ROAD_COLOR = '#4A90E2'; // Blue
  const DEFAULT_COLOR = '#666666'; // Default gray

  const style = getStyleSafe(mapInstance);
  if (!style || !Array.isArray(style.layers)) return;

  const layers = style.layers;
  let foundAnyLayer = false;

  try {
    ROAD_LAYER_IDS.forEach((baseId) => {
      const matchingLayers = layers.filter((l) =>
        l.id.toLowerCase().includes(baseId.toLowerCase())
      );

      matchingLayers.forEach((layer) => {
        foundAnyLayer = true;

        if (layer.type === 'line') {
          mapInstance.setPaintProperty(
            layer.id,
            'line-width',
            enabled ? 1 : 0.5
          );
          mapInstance.setPaintProperty(
            layer.id,
            'line-color',
            enabled ? ROAD_COLOR : DEFAULT_COLOR
          );
          mapInstance.setPaintProperty(
            layer.id,
            'line-opacity',
            enabled ? 0.5 : 0.3
          );
        } else if (layer.type === 'symbol' && layer.id.includes('label')) {
          mapInstance.setPaintProperty(
            layer.id,
            'text-color',
            enabled ? ROAD_COLOR : '#666666'
          );
          mapInstance.setPaintProperty(
            layer.id,
            'text-halo-width',
            enabled ? 2 : 1
          );
          mapInstance.setPaintProperty(
            layer.id,
            'text-opacity',
            enabled ? 0.5 : 0.3
          );
        }
      });
    });

    if (!foundAnyLayer) {
      // Fallback: generic road/highway/streets line layers
      const genericRoadLayers = layers.filter(
        (l) =>
          l.type === 'line' &&
          (l.id.toLowerCase().includes('road') ||
            l.id.toLowerCase().includes('highway') ||
            l.id.toLowerCase().includes('street'))
      );

      genericRoadLayers.forEach((layer) => {
        mapInstance.setPaintProperty(
          layer.id,
          'line-width',
          enabled ? 1 : 0.5
        );
        mapInstance.setPaintProperty(
          layer.id,
          'line-color',
          enabled ? ROAD_COLOR : DEFAULT_COLOR
        );
        mapInstance.setPaintProperty(
          layer.id,
          'line-opacity',
          enabled ? 0.5 : 0.3
        );
      });
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Error toggling main road layers via mapStyleController:', error);
  }
};


