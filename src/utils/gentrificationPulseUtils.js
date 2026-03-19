// Gentrification Pulse Utilities
// Provides start/stop functions for the animated pulse layer

import { GENTRIFICATION_CONFIG, getTimelineUrgencyFactor } from '../constants/gentrificationConfig';

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

export const stopGentrificationPulseAnimation = (map) => {
  try {
    if (window.perplexityGentrificationPulseAnimation) {
      cancelAnimationFrame(window.perplexityGentrificationPulseAnimation);
      window.perplexityGentrificationPulseAnimation = null;
    }
    const pulseSource = map.current && map.current.getSource(GENTRIFICATION_CONFIG.SOURCE_IDS.pulse);
    if (pulseSource) {
      pulseSource.setData({ type: 'FeatureCollection', features: [] });
    }
  } catch (_) {}
};

export const startGentrificationPulseAnimation = (map) => {
  try {
    // Cancel any existing animation
    if (window.perplexityGentrificationPulseAnimation) {
      cancelAnimationFrame(window.perplexityGentrificationPulseAnimation);
      window.perplexityGentrificationPulseAnimation = null;
    }

    // Ensure sources exist
    const pulseSource = map.current.getSource(GENTRIFICATION_CONFIG.SOURCE_IDS.pulse);
    const dataSource = map.current.getSource(GENTRIFICATION_CONFIG.SOURCE_IDS.data);
    if (!pulseSource || !dataSource) {
      return;
    }

    // Initialize pulse features from the main data source
    const baseFeatures = getSourceFeaturesIfAvailable(map, GENTRIFICATION_CONFIG.SOURCE_IDS.data);
    const initialFeatures = baseFeatures.map(f => {
      const p = f.properties || {};
      const neighborhood = p.neighborhood_name || 'default';
      const risk = typeof p.gentrification_risk === 'number' ? p.gentrification_risk : 0.0;
      const timelineMonths = typeof p.timeline_to_unaffordable === 'number' ? p.timeline_to_unaffordable : GENTRIFICATION_CONFIG.TIMELINE_URGENCY.base;
      const momentum = typeof p.development_momentum_score === 'number' ? p.development_momentum_score : GENTRIFICATION_CONFIG.DEVELOPMENT_MOMENTUM.base;
      const urgencyFactor = getTimelineUrgencyFactor(timelineMonths);
      return {
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          neighborhood_name: neighborhood,
          gentrification_risk: risk,
          development_momentum_score: momentum,
          timeline_urgency_factor: urgencyFactor,
          pulse_t: 0
        }
      };
    });

    pulseSource.setData({ type: 'FeatureCollection', features: initialFeatures });

    // Animate pulse_t from 0..1 continuously
    let startTs = performance.now();
    const periodSec = 3.0; // Matches config intent

    const tick = () => {
      const now = performance.now();
      const t = ((now - startTs) / 1000) % periodSec;
      const phase = t / periodSec; // 0..1

      try {
        // Update only the pulse_t property; reuse geometry/properties
        const current = getSourceFeaturesIfAvailable(map, GENTRIFICATION_CONFIG.SOURCE_IDS.pulse);
        if (current.length > 0) {
          current.forEach(feat => {
            if (!feat.properties) feat.properties = {};
            feat.properties.pulse_t = phase;
          });
          pulseSource.setData({ type: 'FeatureCollection', features: current });
        }
      } catch (_) {}

      window.perplexityGentrificationPulseAnimation = requestAnimationFrame(tick);
    };

    window.perplexityGentrificationPulseAnimation = requestAnimationFrame(tick);
  } catch (error) {
    // Fail silently to avoid breaking the map; caller logs elsewhere
  }
};


