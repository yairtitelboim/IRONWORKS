// Arizona/Phoenix Particle Utilities
// Adds rotating particle animations around Arizona markers (TSMC Phoenix sites)

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

// Create particle state for Arizona markers
export const createArizonaParticles = (sites, zoom = 12) => {
  if (!sites || !Array.isArray(sites)) return [];

  const particles = [];
  const baseCount = 16; // Particles per site (increased for more visible halo effect)

  sites.forEach((site) => {
    if (!site || !site.coordinates) return;

    const { lng, lat } = site.coordinates;
    const center = [lng, lat];
    
    // Use a smaller radius for particles (not the full site radius)
    // Particles should orbit close to the marker, similar to Houston implementation
    // Base radius similar to gentrification particles (300m), adjusted for visibility
    const particleRadiusMeters = 500; // 500m radius for particle ring (visible halo effect)
    
    // Add extra particles for larger sites (like TSMC Phoenix main site)
    let particleCount = baseCount;
    if (site.radiusMeters > 20000) {
      particleCount = baseCount + 8; // Extra particles for very large sites
    } else if (site.radiusMeters > 10000) {
      particleCount = baseCount + 4; // Extra particles for large sites
    }
    
    // Use site colors
    const color = site.highlightColor || site.color || '#3b82f6';
    
    // Particle size based on zoom (larger for better visibility)
    let size = 2.5;
    if (zoom >= 16) size = 4.0;
    else if (zoom >= 12) size = 3.0;
    else if (zoom >= 10) size = 2.5;
    else size = 2.0;

    // Create particles in a ring around the marker
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      // Position particles at 30-100% of particle radius (wider distribution)
      const radiusM = particleRadiusMeters * (0.3 + Math.random() * 0.7);
      // Vary speeds for more dynamic effect
      const speed = (0.2 + Math.random() * 0.8) * 0.002; // radians per ms (more variation)

      particles.push({
        center,
        angle,
        radiusM,
        speed,
        color,
        size,
        siteKey: site.key
      });
    }
  });

  return particles;
};

// Add particles layer to map
export const addArizonaParticlesLayer = (map, sourceId = 'arizona-particles') => {
  if (!map?.current) return;

  if (!map.current.getSource(sourceId)) {
    map.current.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
  }

  const layerId = 'arizona-particles-layer';
  if (!map.current.getLayer(layerId)) {
    // Find a good layer to insert before (above markers but below labels)
    let beforeId = null;
    try {
      // Try to insert before waterway labels or other label layers
      if (map.current.getLayer('waterway-label')) {
        beforeId = 'waterway-label';
      } else if (map.current.getLayer('place-label')) {
        beforeId = 'place-label';
      }
    } catch (_) {}
    
    map.current.addLayer({
      id: layerId,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8, ['coalesce', ['get', 'size'], 2.0],
          12, ['*', ['coalesce', ['get', 'size'], 3.0], 1.3],
          16, ['*', ['coalesce', ['get', 'size'], 4.0], 1.6]
        ],
        'circle-color': ['coalesce', ['get', 'color'], '#3b82f6'],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.0,
        'circle-opacity': 0.95,
        'circle-blur': 0.2
      }
    }, beforeId);
  }
};

// Start particle animation
export const startArizonaParticleAnimation = (map, sites, sourceId = 'arizona-particles') => {
  try {
    if (!map?.current) {
      console.warn('⚠️ Arizona Particles: map.current is null');
      return;
    }

    // Cancel existing animation
    if (window.arizonaParticleAnimationFrame) {
      cancelAnimationFrame(window.arizonaParticleAnimationFrame);
      window.arizonaParticleAnimationFrame = null;
    }

    const particlesSource = map.current.getSource(sourceId);
    if (!particlesSource) {
      console.warn('⚠️ Arizona Particles: Source not found:', sourceId);
      return;
    }

    // Initialize particle state based on current zoom
    const zoom = map.current.getZoom ? map.current.getZoom() : 12;
    const particleState = createArizonaParticles(sites, Math.round(zoom));
    window.arizonaParticles = particleState;

    console.log(`✨ Arizona Particles: Created ${particleState.length} particles for ${sites.length} sites at zoom ${zoom}`);

    // Seed data
    const seedFeatures = particleState.map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: offsetMetersToLngLat(p.center, p.radiusM, p.angle) },
      properties: { color: p.color, size: p.size, siteKey: p.siteKey }
    }));
    particlesSource.setData({ type: 'FeatureCollection', features: seedFeatures });
    
    console.log(`✨ Arizona Particles: Seeded ${seedFeatures.length} particle features`);

    let lastTs = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = now - lastTs;
      lastTs = now;

      // Advance angles and recompute positions
      const features = window.arizonaParticles.map(p => {
        p.angle += p.speed * dt;
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: offsetMetersToLngLat(p.center, p.radiusM, p.angle) },
          properties: { color: p.color, size: p.size, siteKey: p.siteKey }
        };
      });

      try {
        particlesSource.setData({ type: 'FeatureCollection', features });
      } catch (_) {}

      window.arizonaParticleAnimationFrame = requestAnimationFrame(tick);
    };

    window.arizonaParticleAnimationFrame = requestAnimationFrame(tick);
  } catch (error) {
    console.warn('⚠️ Arizona particle animation error:', error);
  }
};

// Stop particle animation
export const stopArizonaParticleAnimation = (map) => {
  try {
    if (window.arizonaParticleAnimationFrame) {
      cancelAnimationFrame(window.arizonaParticleAnimationFrame);
      window.arizonaParticleAnimationFrame = null;
    }
    if (map?.current) {
      const particlesSource = map.current.getSource('arizona-particles');
      if (particlesSource) {
        particlesSource.setData({ type: 'FeatureCollection', features: [] });
      }
    }
  } catch (error) {
    console.warn('⚠️ Error stopping Arizona particle animation:', error);
  }
};

