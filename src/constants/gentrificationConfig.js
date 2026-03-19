// Gentrification Analysis Configuration
// Extracted from PerplexityCall.jsx for better maintainability

export const GENTRIFICATION_CONFIG = {
  // Particle Animation Configuration
  PARTICLES: {
    // Base particle sizes (larger and more visible)
    BASE_SIZES: {
      small: 1.0,    // Low momentum at zoom 8 (was 0.5)
      medium: 1.2,   // Medium momentum at zoom 8 (was 0.6)
      large: 1.6     // High momentum at zoom 8 (was 0.8)
    },
    
    // Zoom level multipliers for particle scaling
    ZOOM_MULTIPLIERS: {
      8: 1.0,        // Base size
      12: 1.5,       // 1.5x at zoom 12
      16: 2.0,       // 2x at zoom 16
      20: 2.5        // 2.5x at zoom 20
    },
    
    // Development momentum ranges
    MOMENTUM_RANGES: {
      low: 7.0,
      medium: 8.5,
      high: 10.0
    },
    
    // Particle count configuration
    COUNT: {
      base: 240,           // Base particle count
      highZoom: 360,       // Higher count at zoom 11+
      momentumFactor: {
        min: 0.5,
        max: 2.0
      }
    },
    
    // Animation timing
    ANIMATION: {
      rotationSpeed: 0.0004,  // Slowed down by 20% (was 0.0005)
      pulsePeriod: 3.0,  // Slowed down by 20% (was 2.5)
      timelineUrgencyFactor: {
        min: 0.5,
        max: 2.0
      }
    }
  },
  
  // Color themes for neighborhoods
  COLORS: {
    NEIGHBORHOODS: {
      Downtown: {
        low: '#059669',    // Green for lower risk
        high: '#dc2626'    // Red for highest risk
      },
      Midtown: {
        low: '#059669',    // Green for lower risk
        medium: '#ea580c', // Orange for medium risk
        high: '#dc2626'    // Red for highest risk
      },
      EaDo: {
        low: '#0891b2',    // Teal for lower risk
        medium: '#c2410c', // Dark orange for medium risk
        high: '#dc2626'    // Red for highest risk
      },
      default: {
        high: '#dc2626',   // Critical risk - red
        medium: '#ea580c', // High risk - orange
        low: '#6b7280'     // Default - gray
      }
    }
  },
  
  // Risk level thresholds
  RISK_THRESHOLDS: {
    critical: 0.9,    // Highest risk threshold (was 0.85)
    high: 0.85,       // High risk threshold
    medium: 0.8,      // Medium risk threshold
    low: 0.6          // Low risk threshold
  },
  
  // Impact radius configuration (tighter particles)
  IMPACT_RADIUS: {
    default: 300,           // Default radius in meters
    baseReduction: 0.3,     // Base radius reduction factor (was 0.5 - tighter)
    criticalReduction: 0.2, // Additional reduction for critical risk (was 0.35 - tighter)
    riskAdjustment: {
      min: 0.2,             // Minimum radius multiplier (was 0.3 - tighter)
      max: 0.8              // Maximum radius multiplier (was 1.0 - tighter)
    }
  },
  
  // Timeline urgency configuration
  TIMELINE_URGENCY: {
    base: 24,               // Base timeline in months
    max: 36,                // Maximum timeline for calculations
    factorRange: {
      min: 0.5,
      max: 2.0
    }
  },
  
  // Development momentum configuration
  DEVELOPMENT_MOMENTUM: {
    base: 7.0,              // Base momentum score
    max: 10.0,              // Maximum momentum score
    factorRange: {
      min: 0.5,
      max: 1.5
    }
  },
  
  // Layer IDs for cleanup
  LAYER_IDS: {
    pulse: 'perplexity-gentrification-pulse-markers',
    circles: 'perplexity-gentrification-circles',
    particles: 'perplexity-gentrification-radius-particles-layer'
  },
  
  // Source IDs for cleanup
  SOURCE_IDS: {
    data: 'perplexity-gentrification-data',
    pulse: 'perplexity-gentrification-pulse-source',
    particles: 'perplexity-gentrification-radius-particles'
  }
};

// Helper function to get particle size based on zoom and momentum
export const getParticleSize = (zoom, momentum) => {
  const baseSize = GENTRIFICATION_CONFIG.PARTICLES.BASE_SIZES;
  const zoomMultiplier = GENTRIFICATION_CONFIG.PARTICLES.ZOOM_MULTIPLIERS[zoom] || 1.0;
  
  let size;
  if (momentum <= GENTRIFICATION_CONFIG.PARTICLES.MOMENTUM_RANGES.low) {
    size = baseSize.small;
  } else if (momentum <= GENTRIFICATION_CONFIG.PARTICLES.MOMENTUM_RANGES.medium) {
    size = baseSize.medium;
  } else {
    size = baseSize.large;
  }
  
  return size * zoomMultiplier;
};

// Helper function to get neighborhood color (matches original logic exactly)
export const getNeighborhoodColor = (neighborhood, risk) => {
  // Downtown: Green-red gradient based on risk (matching Midtown colors)
  if (neighborhood === 'Downtown') {
    if (risk >= 0.9) return '#dc2626';  // Red for highest risk
    else if (risk >= 0.85) return '#059669'; // Green for medium risk
    else return '#059669'; // Green for lower risk
  }
  
  // Midtown: Green-orange gradient based on risk
  if (neighborhood === 'Midtown') {
    if (risk >= 0.9) return '#dc2626';  // Red for highest risk
    else if (risk >= 0.85) return '#ea580c'; // Orange for medium risk
    else return '#059669'; // Green for lower risk
  }
  
  // EaDo: Teal-red gradient based on risk
  if (neighborhood === 'EaDo') {
    if (risk >= 0.9) return '#dc2626';  // Red for highest risk
    else if (risk >= 0.85) return '#c2410c'; // Dark orange for medium risk
    else return '#0891b2'; // Teal for lower risk
  }
  
  // Default fallback based on risk only
  if (risk >= 0.85) return '#dc2626'; // Critical risk - red
  else if (risk >= 0.8) return '#ea580c'; // High risk - orange
  else return '#6b7280'; // Default - gray
};

// Helper function to calculate timeline urgency factor
export const getTimelineUrgencyFactor = (timeline) => {
  const { base, max, factorRange } = GENTRIFICATION_CONFIG.TIMELINE_URGENCY;
  return Math.max(factorRange.min, Math.min(factorRange.max, (max - timeline) / (max - base)));
};

// Helper function to calculate development momentum factor
export const getDevelopmentMomentumFactor = (momentum) => {
  const { base, max, factorRange } = GENTRIFICATION_CONFIG.DEVELOPMENT_MOMENTUM;
  return Math.max(factorRange.min, Math.min(factorRange.max, (momentum - base) / (max - base)));
};
