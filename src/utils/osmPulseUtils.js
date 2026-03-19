// OSM Pulse Utilities
// Provides start/stop functions for animated pulsing circles around OSM site markers
// Based on gentrification pulse system but adapted for infrastructure sites

// Safely read features from a GeoJSON source definition if available
function getSourceFeaturesIfAvailable(map, sourceId) {
  try {
    const source = map.current.getSource(sourceId);
    if (!source) return [];
    if (typeof source.serialize === 'function') {
      const serialized = source.serialize();
      const data = serialized && serialized.data;
      if (data && Array.isArray(data.features)) {
        return data.features;
      }
    }
  } catch (err) {
    // Swallow and fallback
  }
  return [];
}

// OSM Pulse Configuration
const OSM_PULSE_CONFIG = {
  PERIOD: 3.0, // seconds (same as gentrification)
  URGENCY_FACTOR: {
    min: 0.5,
    max: 2.0
  }
};

// Stop pulse animation
export const stopOsmPulseAnimation = (map) => {
  try {
    if (window.osmSitePulseAnimation) {
      cancelAnimationFrame(window.osmSitePulseAnimation);
      window.osmSitePulseAnimation = null;
    }
    const pulseSource = map.current && map.current.getSource('osm-site-pulse-source');
    if (pulseSource) {
      pulseSource.setData({ type: 'FeatureCollection', features: [] });
    }
  } catch (_) {}
};

// Start pulse animation
export const startOsmPulseAnimation = (map, sites, isTsmcLocation = false) => {
  const DEBUG = typeof window !== 'undefined' && window.DEBUG_OSM;
  if (DEBUG) {
    console.log('🎯 OSM Pulse: startOsmPulseAnimation called');
    console.log('🎯 OSM Pulse: sites count:', sites?.length);
    console.log('🎯 OSM Pulse: isTsmcLocation:', isTsmcLocation);
    console.log('🎯 OSM Pulse: map.current exists:', !!map?.current);
  }
  
  try {
    // Cancel any existing animation
    if (window.osmSitePulseAnimation) {
      if (DEBUG) console.log('🎯 OSM Pulse: Cancelling existing animation');
      cancelAnimationFrame(window.osmSitePulseAnimation);
      window.osmSitePulseAnimation = null;
    }

    // Ensure sources exist
    const pulseSource = map.current.getSource('osm-site-pulse-source');
    if (!pulseSource) {
      console.warn('⚠️ OSM Pulse: Source not found: osm-site-pulse-source');
      return;
    }
    if (DEBUG) console.log('🎯 OSM Pulse: Source found');

    // Create initial features from sites
    const siteColor = isTsmcLocation ? '#3b82f6' : '#ef4444';
    if (DEBUG) console.log('🎯 OSM Pulse: Site color:', siteColor);
    const initialFeatures = sites
      .filter(site => Number.isFinite(site.lat) && Number.isFinite(site.lng))
      .map(site => {
        const isHighPriority = site.id?.includes('fab-complex') || 
                              site.id?.includes('water-allocation') ||
                              site.id?.includes('transmission-hub');
        
        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [site.lng, site.lat]
          },
          properties: {
            site_id: site.id || site.name,
            site_color: siteColor,
            is_high_priority: isHighPriority,
            pulse_t: 0
          }
        };
      });

    if (DEBUG) console.log('🎯 OSM Pulse: Creating', initialFeatures.length, 'pulse features');
    pulseSource.setData({ type: 'FeatureCollection', features: initialFeatures });
    if (DEBUG) console.log('🎯 OSM Pulse: Data set successfully');

    // Animate pulse_t from 0..1 continuously
    let startTs = performance.now();
    const periodSec = OSM_PULSE_CONFIG.PERIOD;
    if (DEBUG) console.log('🎯 OSM Pulse: Starting animation loop, period:', periodSec, 'seconds');

    const tick = () => {
      const now = performance.now();
      const t = ((now - startTs) / 1000) % periodSec;
      const phase = t / periodSec; // 0..1

      try {
        // Update only the pulse_t property; reuse geometry/properties
        const current = getSourceFeaturesIfAvailable(map, 'osm-site-pulse-source');
        if (current.length > 0) {
          current.forEach(feat => {
            if (!feat.properties) feat.properties = {};
            feat.properties.pulse_t = phase;
          });
          pulseSource.setData({ type: 'FeatureCollection', features: current });
        }
      } catch (_) {}

      window.osmSitePulseAnimation = requestAnimationFrame(tick);
    };

    window.osmSitePulseAnimation = requestAnimationFrame(tick);
    if (DEBUG) console.log('🎯 OSM Pulse: Animation frame started');
  } catch (error) {
    console.error('❌ OSM Pulse: Error in animation:', error);
    console.error('❌ OSM Pulse: Error stack:', error.stack);
  }
};

// Add pulse source and layer to map
export const addOsmPulseSource = (map) => {
  const DEBUG = typeof window !== 'undefined' && window.DEBUG_OSM;
  if (DEBUG) console.log('🎯 OSM Pulse: addOsmPulseSource called');
  if (!map?.current) {
    console.warn('⚠️ OSM Pulse: map.current is null');
    return;
  }

  const sourceId = 'osm-site-pulse-source';
  const layerId = 'osm-site-pulse-markers';

  // Add source if missing
  if (!map.current.getSource(sourceId)) {
    if (DEBUG) console.log('🎯 OSM Pulse: Creating source:', sourceId);
    map.current.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
  } else {
    if (DEBUG) console.log('🎯 OSM Pulse: Source already exists:', sourceId);
  }

  // Add layer if missing
  if (!map.current.getLayer(layerId)) {
    if (DEBUG) console.log('🎯 OSM Pulse: Creating layer:', layerId);
    map.current.addLayer({
      id: layerId,
      type: 'circle',
      source: sourceId,
      paint: {
        // Radius animation (same structure as gentrification)
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8, [
            'interpolate',
            ['exponential', 2.0],
            ['get', 'pulse_t'],
            0, [
              'case',
              ['get', 'is_high_priority'], 8,
              4
            ],
            0.3, [
              'case',
              ['get', 'is_high_priority'], 32,
              16
            ],
            0.7, [
              'case',
              ['get', 'is_high_priority'], 40,
              20
            ],
            1.0, [
              'case',
              ['get', 'is_high_priority'], 8,
              4
            ]
          ],
          12, [
            'interpolate',
            ['exponential', 2.0],
            ['get', 'pulse_t'],
            0, [
              'case',
              ['get', 'is_high_priority'], 16,
              8
            ],
            0.3, [
              'case',
              ['get', 'is_high_priority'], 64,
              32
            ],
            0.7, [
              'case',
              ['get', 'is_high_priority'], 80,
              40
            ],
            1.0, [
              'case',
              ['get', 'is_high_priority'], 16,
              8
            ]
          ],
          16, [
            'interpolate',
            ['exponential', 2.0],
            ['get', 'pulse_t'],
            0, [
              'case',
              ['get', 'is_high_priority'], 24,
              12
            ],
            0.3, [
              'case',
              ['get', 'is_high_priority'], 96,
              48
            ],
            0.7, [
              'case',
              ['get', 'is_high_priority'], 120,
              60
            ],
            1.0, [
              'case',
              ['get', 'is_high_priority'], 24,
              12
            ]
          ]
        ],
        // Color from site property
        'circle-color': ['coalesce', ['get', 'site_color'], '#3b82f6'],
        // Opacity animation
        'circle-opacity': [
          'interpolate',
          ['linear'],
          ['get', 'pulse_t'],
          0, 0.6,
          0.3, 1.0,
          0.7, 0.5,
          1.0, 0
        ],
        'circle-blur': 0.3
      }
    });
    if (DEBUG) console.log('🎯 OSM Pulse: Layer created successfully');
  } else {
    if (DEBUG) console.log('🎯 OSM Pulse: Layer already exists:', layerId);
  }
};

