// Arizona/Phoenix Pulse Utilities
// Provides animated pulse effects for Arizona markers

// Stop pulse animation
export const stopArizonaPulseAnimation = (map) => {
  try {
    if (window.arizonaPulseAnimation) {
      cancelAnimationFrame(window.arizonaPulseAnimation);
      window.arizonaPulseAnimation = null;
    }
    const pulseSource = map.current && map.current.getSource('arizona-pulse');
    if (pulseSource) {
      pulseSource.setData({ type: 'FeatureCollection', features: [] });
    }
  } catch (_) {}
};

// Start pulse animation
export const startArizonaPulseAnimation = (map, sites) => {
  try {
    // Cancel any existing animation
    if (window.arizonaPulseAnimation) {
      cancelAnimationFrame(window.arizonaPulseAnimation);
      window.arizonaPulseAnimation = null;
    }

    if (!map?.current) return;

    // Ensure sources exist
    const pulseSource = map.current.getSource('arizona-pulse');
    if (!pulseSource) return;

    // Create initial pulse features from sites
    const initialFeatures = sites.map(site => {
      if (!site || !site.coordinates) return null;
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [site.coordinates.lng, site.coordinates.lat]
        },
        properties: {
          siteKey: site.key,
          color: site.highlightColor || site.color || '#3b82f6',
          radiusMeters: site.radiusMeters || 10000,
          pulse_t: 0
        }
      };
    }).filter(Boolean);

    pulseSource.setData({ type: 'FeatureCollection', features: initialFeatures });

    // Animate pulse_t from 0..1 continuously
    let startTs = performance.now();
    const periodSec = 3.0; // 3 second pulse cycle

    const tick = () => {
      const now = performance.now();
      const t = ((now - startTs) / 1000) % periodSec;
      const phase = t / periodSec; // 0..1

      try {
        // Get current features - use serialize method if available, otherwise use _data
        let currentFeatures = [];
        if (typeof pulseSource.serialize === 'function') {
          const serialized = pulseSource.serialize();
          const data = serialized && serialized.data;
          if (data && Array.isArray(data.features)) {
            currentFeatures = data.features;
          }
        } else if (pulseSource._data && Array.isArray(pulseSource._data.features)) {
          currentFeatures = pulseSource._data.features;
        }
        
        if (currentFeatures.length > 0) {
          const updatedFeatures = currentFeatures.map(feat => ({
            ...feat,
            properties: {
              ...(feat.properties || {}),
              pulse_t: phase
            }
          }));
          pulseSource.setData({ type: 'FeatureCollection', features: updatedFeatures });
        }
      } catch (_) {}

      window.arizonaPulseAnimation = requestAnimationFrame(tick);
    };

    window.arizonaPulseAnimation = requestAnimationFrame(tick);
  } catch (error) {
    console.warn('⚠️ Arizona pulse animation error:', error);
  }
};

// Add pulse source to map
export const addArizonaPulseSource = (map) => {
  if (!map?.current) return;

  if (!map.current.getSource('arizona-pulse')) {
    map.current.addSource('arizona-pulse', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
  }
};

// Add pulse markers layer
export const addArizonaPulseMarkersLayer = (map) => {
  if (!map?.current) return;

  const layerId = 'arizona-pulse-markers';
  if (!map.current.getLayer(layerId)) {
    map.current.addLayer({
      id: layerId,
      type: 'circle',
      source: 'arizona-pulse',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8, [
            'interpolate',
            ['exponential', 2.0],
            ['get', 'pulse_t'],
            0, 8,
            0.3, 32,
            0.7, 40,
            1.0, 8
          ],
          12, [
            'interpolate',
            ['exponential', 2.0],
            ['get', 'pulse_t'],
            0, 16,
            0.3, 64,
            0.7, 80,
            1.0, 16
          ],
          16, [
            'interpolate',
            ['exponential', 2.0],
            ['get', 'pulse_t'],
            0, 24,
            0.3, 96,
            0.7, 120,
            1.0, 24
          ]
        ],
        'circle-color': ['coalesce', ['get', 'color'], '#3b82f6'],
        'circle-opacity': [
          'interpolate',
          ['linear'],
          ['get', 'pulse_t'],
          0, 0.6,
          0.3, 0.9,
          0.7, 0.5,
          1.0, 0.0
        ],
        'circle-blur': 0.5,
        'circle-stroke-width': 0
      }
    });
  }
};

