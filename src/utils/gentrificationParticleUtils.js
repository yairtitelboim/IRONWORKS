// Gentrification Particle Utilities
// Adds a particles layer and animates rotating particles around each risk center

import { GENTRIFICATION_CONFIG, getNeighborhoodColor, getParticleSize } from '../constants/gentrificationConfig';

// Internal helper to clamp a number between min and max
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Build initial particle state objects (not GeoJSON yet)
export const createGentrificationRadiusParticles = (gentrificationData, zoom = 12) => {
  if (!gentrificationData || !Array.isArray(gentrificationData.features)) return [];

  const particles = [];

  gentrificationData.features.forEach((feature) => {
    if (!feature || !feature.geometry || feature.geometry.type !== 'Point') return;

    const [lng, lat] = feature.geometry.coordinates;
    const props = feature.properties || {};

    const risk = typeof props.gentrification_risk === 'number' ? props.gentrification_risk : 0.0;
    const neighborhood = props.neighborhood_name || 'default';
    const momentum = typeof props.development_momentum_score === 'number'
      ? props.development_momentum_score
      : GENTRIFICATION_CONFIG.DEVELOPMENT_MOMENTUM.base;

    // Base radius in meters adjusted by risk
    const impactBase = GENTRIFICATION_CONFIG.IMPACT_RADIUS.default;
    const minMul = GENTRIFICATION_CONFIG.IMPACT_RADIUS.riskAdjustment.min;
    const maxMul = GENTRIFICATION_CONFIG.IMPACT_RADIUS.riskAdjustment.max;
    const riskMul = clamp((risk - 0.6) / (0.9 - 0.6), 0, 1) * (maxMul - minMul) + minMul; // map 0.6..0.9 -> min..max
    const impactRadiusMeters = impactBase * riskMul * (1 - GENTRIFICATION_CONFIG.IMPACT_RADIUS.baseReduction);

    // Particle count influenced by momentum (keep modest to avoid perf issues)
    const baseCount = 8; // conservative default per center
    const extra = momentum >= 9.0 ? 4 : momentum >= 8.0 ? 2 : 0;
    const count = baseCount + extra;

    const color = getNeighborhoodColor(neighborhood, risk);
    const size = getParticleSize(zoom, momentum);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radiusM = impactRadiusMeters * (0.4 + Math.random() * 0.6); // 40%..100% of ring
      const speed = (0.3 + Math.random() * 0.7) * 0.002; // radians per ms (~slow)

      particles.push({
        center: [lng, lat],
        angle,
        radiusM,
        speed,
        color,
        size
      });
    }
  });

  return particles;
};

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

export const addParticlesLayer = (map, gentrificationData) => {
  if (!map?.current) return;

  // Create source if missing
  if (!map.current.getSource(GENTRIFICATION_CONFIG.SOURCE_IDS.particles)) {
    map.current.addSource(GENTRIFICATION_CONFIG.SOURCE_IDS.particles, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
  }

  // Add layer if missing
  if (!map.current.getLayer(GENTRIFICATION_CONFIG.LAYER_IDS.particles)) {
    map.current.addLayer({
      id: GENTRIFICATION_CONFIG.LAYER_IDS.particles,
      type: 'circle',
      source: GENTRIFICATION_CONFIG.SOURCE_IDS.particles,
      paint: {
        'circle-radius': ['coalesce', ['get', 'size'], 1.0],
        'circle-color': ['coalesce', ['get', 'color'], '#ffffff'],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 0.5,
        'circle-opacity': 0.9
      }
    });
  }
};

export const startParticleAnimation = (map, gentrificationData, sourceId = GENTRIFICATION_CONFIG.SOURCE_IDS.particles) => {
  try {
    if (!map?.current) return;

    // Cancel existing animation
    if (window.perplexityGentrificationRadiusAnimationFrame) {
      cancelAnimationFrame(window.perplexityGentrificationRadiusAnimationFrame);
      window.perplexityGentrificationRadiusAnimationFrame = null;
    }

    const particlesSource = map.current.getSource(sourceId);
    if (!particlesSource) return;

    // Initialize particle state based on current zoom for sizing
    const zoom = map.current.getZoom ? map.current.getZoom() : 12;
    const particleState = createGentrificationRadiusParticles(gentrificationData, Math.round(zoom));
    window.perplexityGentrificationParticles = particleState;

    // Seed data
    const seedFeatures = particleState.map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: offsetMetersToLngLat(p.center, p.radiusM, p.angle) },
      properties: { color: p.color, size: p.size }
    }));
    particlesSource.setData({ type: 'FeatureCollection', features: seedFeatures });

    let lastTs = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = now - lastTs;
      lastTs = now;

      // Advance angles and recompute positions
      const features = window.perplexityGentrificationParticles.map(p => {
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

      window.perplexityGentrificationRadiusAnimationFrame = requestAnimationFrame(tick);
    };

    window.perplexityGentrificationRadiusAnimationFrame = requestAnimationFrame(tick);
  } catch (_) {
    // Fail silently
  }
};


