// OSM Particle Utilities
// Adds rotating halo particles around OSM site markers (Arizona/TSMC Phoenix)
// Based on gentrification particle system but adapted for infrastructure sites

// Convert meters offset at given angle to approximate lon/lat delta near given latitude
function offsetMetersToLngLat(center, radiusM, angleRad) {
  const [lng, lat] = center;
  const earthRadiusM = 6378137; // WGS84
  const dLat = (radiusM * Math.cos(angleRad)) / earthRadiusM;
  const dLng = (radiusM * Math.sin(angleRad)) / (earthRadiusM * Math.cos((lat * Math.PI) / 180));
  const newLat = lat + (dLat * 180) / Math.PI;
  const newLng = lng + (dLng * 180) / Math.PI;
  return [newLng, newLat];
}

// OSM Particle Configuration
const OSM_PARTICLE_CONFIG = {
  // Base particle sizes (same as gentrification)
  BASE_SIZES: {
    small: 1.0,
    medium: 1.2,
    large: 1.6
  },
  // Zoom level multipliers
  ZOOM_MULTIPLIERS: {
    8: 1.0,
    12: 1.5,
    16: 2.0,
    20: 2.5
  },
  // Impact radius in meters
  IMPACT_RADIUS: {
    default: 300,
    baseReduction: 0.3,
    minMultiplier: 0.2,
    maxMultiplier: 0.8
  },
  // Particle count per site
  COUNT: {
    base: 8,
    extra: 4 // For high-priority sites
  },
  // Animation speed
  ROTATION_SPEED: 0.0004 // radians per ms (same as gentrification)
};

// Get particle size based on zoom and site priority
const getOsmParticleSize = (zoom, isHighPriority = false) => {
  const baseSize = isHighPriority 
    ? OSM_PARTICLE_CONFIG.BASE_SIZES.large 
    : OSM_PARTICLE_CONFIG.BASE_SIZES.medium;
  const zoomMultiplier = OSM_PARTICLE_CONFIG.ZOOM_MULTIPLIERS[zoom] || 1.0;
  return baseSize * zoomMultiplier;
};

// Get color for OSM site (blue for TSMC Phoenix, red for others)
const getOsmSiteColor = (isTsmcLocation) => {
  return isTsmcLocation ? '#3b82f6' : '#ef4444'; // Blue for TSMC, red for others
};

// Build initial particle state objects from site markers
export const createOsmRadiusParticles = (sites, zoom = 12, isTsmcLocation = false) => {
  const DEBUG = typeof window !== 'undefined' && window.DEBUG_OSM;
  if (DEBUG) {
    console.log('🎯 OSM Particles: createOsmRadiusParticles called');
    console.log('🎯 OSM Particles: sites:', sites?.length, 'zoom:', zoom, 'isTsmcLocation:', isTsmcLocation);
  }
  
  if (!sites || !Array.isArray(sites)) {
    console.warn('⚠️ OSM Particles: Invalid sites array');
    return [];
  }

  const particles = [];
  const siteColor = getOsmSiteColor(isTsmcLocation);
  if (DEBUG) console.log('🎯 OSM Particles: Site color:', siteColor);

  sites.forEach((site, index) => {
    if (!site || !Number.isFinite(site.lat) || !Number.isFinite(site.lng)) {
      console.warn(`⚠️ OSM Particles: Site ${index} invalid coordinates:`, site);
      return;
    }

    const [lng, lat] = [site.lng, site.lat];
    
    // Determine if high priority (main fab complex, water allocation, etc.)
    const isHighPriority = site.id?.includes('fab-complex') || 
                          site.id?.includes('water-allocation') ||
                          site.id?.includes('transmission-hub');

    // Base radius in meters
    const impactBase = OSM_PARTICLE_CONFIG.IMPACT_RADIUS.default;
    const minMul = OSM_PARTICLE_CONFIG.IMPACT_RADIUS.minMultiplier;
    const maxMul = OSM_PARTICLE_CONFIG.IMPACT_RADIUS.maxMultiplier;
    const radiusMultiplier = isHighPriority ? maxMul : (minMul + maxMul) / 2;
    const impactRadiusMeters = impactBase * radiusMultiplier * (1 - OSM_PARTICLE_CONFIG.IMPACT_RADIUS.baseReduction);

    // Particle count
    const baseCount = OSM_PARTICLE_CONFIG.COUNT.base;
    const extra = isHighPriority ? OSM_PARTICLE_CONFIG.COUNT.extra : 0;
    const count = baseCount + extra;

    const size = getOsmParticleSize(zoom, isHighPriority);

    if (DEBUG) console.log(`🎯 OSM Particles: Site ${index} (${site.id || site.name}): ${count} particles, radius: ${impactRadiusMeters.toFixed(0)}m, priority: ${isHighPriority}`);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radiusM = impactRadiusMeters * (0.4 + Math.random() * 0.6); // 40%..100% of ring
      const speed = (0.3 + Math.random() * 0.7) * 0.002; // radians per ms (~slow)

      particles.push({
        center: [lng, lat],
        angle,
        radiusM,
        speed,
        color: siteColor,
        size
      });
    }
  });

  if (DEBUG) console.log('🎯 OSM Particles: Created', particles.length, 'total particles');
  return particles;
};

// Add particles layer to map
export const addOsmParticlesLayer = (map) => {
  const DEBUG = typeof window !== 'undefined' && window.DEBUG_OSM;
  if (DEBUG) console.log('🎯 OSM Particles: addOsmParticlesLayer called');
  if (!map?.current) {
    console.warn('⚠️ OSM Particles: map.current is null');
    return;
  }

  const sourceId = 'osm-site-particles';
  const layerId = 'osm-site-particles-layer';

  // Create source if missing
  if (!map.current.getSource(sourceId)) {
    if (DEBUG) console.log('🎯 OSM Particles: Creating source:', sourceId);
    map.current.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
  } else {
    if (DEBUG) console.log('🎯 OSM Particles: Source already exists:', sourceId);
  }

  // Add layer if missing
  if (!map.current.getLayer(layerId)) {
    if (DEBUG) console.log('🎯 OSM Particles: Creating layer:', layerId);
    map.current.addLayer({
      id: layerId,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius': ['coalesce', ['get', 'size'], 1.0],
        'circle-color': ['coalesce', ['get', 'color'], '#3b82f6'],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 0.5,
        'circle-opacity': 0.9
      }
    });
    if (DEBUG) console.log('🎯 OSM Particles: Layer created successfully');
  } else {
    if (DEBUG) console.log('🎯 OSM Particles: Layer already exists:', layerId);
  }
};

// Start particle animation
export const startOsmParticleAnimation = (map, sites, isTsmcLocation = false) => {
  const DEBUG = typeof window !== 'undefined' && window.DEBUG_OSM;
  if (DEBUG) {
    console.log('🎯 OSM Particles: startOsmParticleAnimation called');
    console.log('🎯 OSM Particles: sites count:', sites?.length);
    console.log('🎯 OSM Particles: isTsmcLocation:', isTsmcLocation);
    console.log('🎯 OSM Particles: map.current exists:', !!map?.current);
  }
  
  try {
    if (!map?.current) {
      console.warn('⚠️ OSM Particles: map.current is null');
      return;
    }

    const sourceId = 'osm-site-particles';

    // Cancel existing animation
    if (window.osmSiteParticleAnimationFrame) {
      if (DEBUG) console.log('🎯 OSM Particles: Cancelling existing animation');
      cancelAnimationFrame(window.osmSiteParticleAnimationFrame);
      window.osmSiteParticleAnimationFrame = null;
    }

    const particlesSource = map.current.getSource(sourceId);
    if (!particlesSource) {
      console.warn('⚠️ OSM Particles: Source not found:', sourceId);
      return;
    }
    if (DEBUG) console.log('🎯 OSM Particles: Source found:', sourceId);

    // Initialize particle state based on current zoom for sizing
    const zoom = map.current.getZoom ? map.current.getZoom() : 12;
    if (DEBUG) console.log('🎯 OSM Particles: Current zoom:', zoom);
    const particleState = createOsmRadiusParticles(sites, Math.round(zoom), isTsmcLocation);
    if (DEBUG) console.log('🎯 OSM Particles: Created particle state, count:', particleState.length);
    window.osmSiteParticles = particleState;

    // Seed data
    const seedFeatures = particleState.map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: offsetMetersToLngLat(p.center, p.radiusM, p.angle) },
      properties: { color: p.color, size: p.size }
    }));
    if (DEBUG) console.log('🎯 OSM Particles: Seeding', seedFeatures.length, 'particles');
    particlesSource.setData({ type: 'FeatureCollection', features: seedFeatures });
    if (DEBUG) console.log('🎯 OSM Particles: Data seeded successfully');

    let lastTs = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = now - lastTs;
      lastTs = now;

      // Advance angles and recompute positions
      const features = window.osmSiteParticles.map(p => {
        p.angle += p.speed * dt;
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: offsetMetersToLngLat(p.center, p.radiusM, p.angle) },
          properties: { color: p.color, size: p.size }
        };
      });

      try {
        particlesSource.setData({ type: 'FeatureCollection', features });
      } catch (_) {}

      window.osmSiteParticleAnimationFrame = requestAnimationFrame(tick);
    };

    window.osmSiteParticleAnimationFrame = requestAnimationFrame(tick);
    if (DEBUG) console.log('🎯 OSM Particles: Animation frame started');
  } catch (error) {
    console.error('❌ OSM Particles: Error in animation:', error);
    console.error('❌ OSM Particles: Error stack:', error.stack);
  }
};

// Stop particle animation
export const stopOsmParticleAnimation = () => {
  if (window.osmSiteParticleAnimationFrame) {
    cancelAnimationFrame(window.osmSiteParticleAnimationFrame);
    window.osmSiteParticleAnimationFrame = null;
  }
  if (window.osmSiteParticles) {
    window.osmSiteParticles = null;
  }
};

