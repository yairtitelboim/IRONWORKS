/**
 * NodeAnimation - Advanced visual effects system for infrastructure markers
 * 
 * This component creates sophisticated visual relationships between marker data
 * and their visual representation using multiple animation types and data-driven styling.
 * 
 * Based on NODE_ANIMATIONS_README.md patterns and current SerpTool marker system.
 */

export class NodeAnimation {
  constructor(map, updateToolFeedback) {
    this.map = map;
    this.updateToolFeedback = updateToolFeedback;
    this.activeAnimations = new Map();
    this.animationFrame = null;
    this.isRunning = false;
    this.animationCounter = 0; // Add counter for unique IDs
    
    // Animation configuration
    this.config = {
      // Pulse animation settings
      pulse: {
        period: 1.6, // seconds
        radiusMultiplier: 4, // 4x size expansion
        opacityRange: [0.8, 0.2], // [max, min] opacity
        speed: 0.002 // time multiplier
      },
      
      // Criticality-based visual scaling
      criticality: {
        critical: { baseRadius: 12, pulseRadius: 48, glowIntensity: 1.0 },
        high: { baseRadius: 10, pulseRadius: 40, glowIntensity: 0.8 },
        medium: { baseRadius: 8, pulseRadius: 32, glowIntensity: 0.6 },
        low: { baseRadius: 6, pulseRadius: 24, glowIntensity: 0.4 }
      },
      
      // Data-driven color intensity
      relevance: {
        high: 1.0,    // 90-100 relevance score
        medium: 0.7,  // 50-89 relevance score  
        low: 0.4      // 0-49 relevance score
      },
      
      // Infrastructure type specific effects
      infrastructureTypes: {
        power_generation: {
          animation: 'pulse',
          color: '#ef4444',
          glowColor: '#ff6b6b',
          effect: 'energy_pulse'
        },
        electrical_transmission: {
          animation: 'dash_rotate',
          color: '#f59e0b',
          glowColor: '#fbbf24',
          effect: 'transmission_flow'
        },
        water_cooling: {
          animation: 'ripple',
          color: '#06b6d4',
          glowColor: '#22d3ee',
          effect: 'water_flow'
        },
        grid_operator: {
          animation: 'heartbeat',
          color: '#dc2626',
          glowColor: '#f87171',
          effect: 'grid_status'
        },
        data_center: {
          animation: 'glow_pulse',
          color: '#8b5cf6',
          glowColor: '#a78bfa',
          effect: 'data_flow'
        },
        natural_gas: {
          animation: 'flicker',
          color: '#f97316',
          glowColor: '#fb923c',
          effect: 'gas_flow'
        },
        renewable_energy: {
          animation: 'gentle_pulse',
          color: '#10b981',
          glowColor: '#34d399',
          effect: 'renewable_flow'
        },
        emergency_services: {
          animation: 'urgent_pulse',
          color: '#ef4444',
          glowColor: '#fca5a5',
          effect: 'emergency_alert'
        },
        industrial: {
          animation: 'steady_glow',
          color: '#6b7280',
          glowColor: '#9ca3af',
          effect: 'industrial_status'
        }
      }
    };
  }

  /**
   * Initialize node animations for a set of infrastructure features
   * @param {Array} features - Array of GeoJSON features with infrastructure data
   */
  initializeNodeAnimations(features) {
    if (!this.map?.current || !features?.length) return;

    console.log(`🎬 Initializing node animations for ${features.length} infrastructure features`);

    // Group features by animation type for efficient rendering
    const animationGroups = this.groupFeaturesByAnimationType(features);
    
    // Create animation layers for each group
    Object.entries(animationGroups).forEach(([animationType, groupFeatures]) => {
      this.createAnimationLayer(animationType, groupFeatures);
    });

    // Start the animation loop
    this.startAnimationLoop();
  }

  /**
   * Group features by their required animation type
   */
  groupFeaturesByAnimationType(features) {
    const groups = {};

    features.forEach(feature => {
      const props = feature.properties;
      const infrastructureType = props.infrastructure_type || 'industrial';
      const animationType = this.config.infrastructureTypes[infrastructureType]?.animation || 'steady_glow';
      
      if (!groups[animationType]) {
        groups[animationType] = [];
      }
      
      groups[animationType].push(feature);
    });

    return groups;
  }

  /**
   * Create animation layer for a specific animation type
   */
  createAnimationLayer(animationType, features) {
    const layerId = `node-animation-${animationType}`;
    const sourceId = `node-animation-source-${animationType}`;

    // Add source
    if (!this.map.current.getSource(sourceId)) {
      this.map.current.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: features.map(f => this.enrichFeatureForAnimation(f))
        }
      });
    }

    // Add base layer (static markers)
    if (!this.map.current.getLayer(layerId)) {
      this.map.current.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: this.getBasePaintProperties(animationType),
        minzoom: 6 // Only show when zoomed in enough to see details
      });
    }

    // Add pulse/glow layer for animated effects
    const glowLayerId = `${layerId}-glow`;
    if (!this.map.current.getLayer(glowLayerId)) {
      this.map.current.addLayer({
        id: glowLayerId,
        type: 'circle',
        source: sourceId,
        paint: this.getGlowPaintProperties(animationType),
        minzoom: 6
      });
    }

    // Add stroke layer for certain animation types
    if (['dash_rotate', 'transmission_flow'].includes(animationType)) {
      const strokeLayerId = `${layerId}-stroke`;
      if (!this.map.current.getLayer(strokeLayerId)) {
        this.map.current.addLayer({
          id: strokeLayerId,
          type: 'circle',
          source: sourceId,
          paint: this.getStrokePaintProperties(animationType),
          minzoom: 6
        });
      }
    }
  }

  /**
   * Enrich feature with animation-specific properties
   */
  enrichFeatureForAnimation(feature) {
    const props = feature.properties;
    const infrastructureType = props.infrastructure_type || 'industrial';
    const criticality = props.criticality_level || 'medium';
    const relevance = props.relevance_score || 50;

    // Calculate animation parameters based on data
    const criticalityConfig = this.config.criticality[criticality];
    const infrastructureConfig = this.config.infrastructureTypes[infrastructureType];
    
    // Determine relevance intensity
    let relevanceIntensity = this.config.relevance.low;
    if (relevance >= 90) relevanceIntensity = this.config.relevance.high;
    else if (relevance >= 50) relevanceIntensity = this.config.relevance.medium;

    return {
      ...feature,
      properties: {
        ...props,
        // Animation timing
        animation_start: Date.now(),
        animation_period: this.config.pulse.period * 1000,
        
        // Visual scaling based on criticality
        base_radius: criticalityConfig.baseRadius,
        pulse_radius: criticalityConfig.pulseRadius,
        glow_intensity: criticalityConfig.glowIntensity,
        
        // Color intensity based on relevance
        color_intensity: relevanceIntensity,
        
        // Infrastructure-specific properties
        animation_type: infrastructureConfig.animation,
        effect_type: infrastructureConfig.effect,
        glow_color: infrastructureConfig.glowColor,
        
        // Data-driven visual properties
        visual_priority: this.calculateVisualPriority(props),
        status_indicator: this.getStatusIndicator(props)
      }
    };
  }

  /**
   * Calculate visual priority based on multiple data factors
   */
  calculateVisualPriority(props) {
    let priority = 0;
    
    // Criticality weight (40%)
    const criticalityWeights = { critical: 40, high: 30, medium: 20, low: 10 };
    priority += criticalityWeights[props.criticality_level] || 20;
    
    // Relevance score weight (30%)
    priority += (props.relevance_score || 50) * 0.3;
    
    // Infrastructure type weight (20%)
    const typeWeights = {
      power_generation: 20,
      electrical_transmission: 18,
      grid_operator: 16,
      data_center: 14,
      water_cooling: 12,
      natural_gas: 10,
      emergency_services: 8,
      renewable_energy: 6,
      industrial: 4
    };
    priority += typeWeights[props.infrastructure_type] || 4;
    
    // Distance weight (10%) - closer facilities get higher priority
    if (props.distance) {
      const distance = parseFloat(props.distance);
      priority += Math.max(0, 10 - (distance / 2)); // Closer = higher priority
    }
    
    return Math.min(100, Math.max(0, priority));
  }

  /**
   * Get status indicator based on facility data
   */
  getStatusIndicator(props) {
    // High rating = good status
    if (props.rating && props.rating >= 4.5) return 'excellent';
    if (props.rating && props.rating >= 3.5) return 'good';
    if (props.rating && props.rating >= 2.5) return 'fair';
    if (props.rating && props.rating < 2.5) return 'poor';
    
    // High relevance = good status
    if (props.relevance_score >= 80) return 'excellent';
    if (props.relevance_score >= 60) return 'good';
    if (props.relevance_score >= 40) return 'fair';
    return 'poor';
  }

  /**
   * Get base paint properties for static markers
   */
  getBasePaintProperties(animationType) {
    return {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['get', 'base_radius'],
        0, 6,
        100, 12
      ],
      'circle-color': [
        'interpolate',
        ['linear'],
        ['get', 'color_intensity'],
        0, '#6b7280',
        1, [
          'case',
          ['==', ['get', 'infrastructure_type'], 'power_generation'], '#ef4444',
          ['==', ['get', 'infrastructure_type'], 'electrical_transmission'], '#f59e0b',
          ['==', ['get', 'infrastructure_type'], 'water_cooling'], '#06b6d4',
          ['==', ['get', 'infrastructure_type'], 'grid_operator'], '#dc2626',
          ['==', ['get', 'infrastructure_type'], 'data_center'], '#8b5cf6',
          ['==', ['get', 'infrastructure_type'], 'natural_gas'], '#f97316',
          ['==', ['get', 'infrastructure_type'], 'renewable_energy'], '#10b981',
          ['==', ['get', 'infrastructure_type'], 'emergency_services'], '#ef4444',
          '#6b7280'
        ]
      ],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': [
        'interpolate',
        ['linear'],
        ['get', 'visual_priority'],
        0, 1,
        100, 3
      ],
      'circle-opacity': [
        'interpolate',
        ['linear'],
        ['get', 'visual_priority'],
        0, 0.6,
        100, 1.0
      ]
    };
  }

  /**
   * Get glow paint properties for animated effects
   */
  getGlowPaintProperties(animationType) {
    const config = this.getAnimationConfig(animationType);
    
    return {
      'circle-radius': config.radiusExpression,
      'circle-color': config.colorExpression,
      'circle-opacity': config.opacityExpression,
      'circle-blur': config.blurExpression
    };
  }

  /**
   * Get stroke paint properties for dashed/rotating effects
   */
  getStrokePaintProperties(animationType) {
    if (animationType === 'dash_rotate') {
      return {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'base_radius'],
          0, 8,
          100, 16
        ],
        'circle-color': 'transparent',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': [
          'interpolate',
          ['linear'],
          ['get', 'animation_progress'],
          0, 2,
          1, 4
        ],
        'circle-stroke-opacity': [
          'interpolate',
          ['linear'],
          ['get', 'animation_progress'],
          0, 0.8,
          1, 0.3
        ],
        'circle-stroke-dasharray': [2, 3]
      };
    }
    
    return {};
  }

  /**
   * Get animation configuration for specific animation type
   */
  getAnimationConfig(animationType) {
    const configs = {
      pulse: {
        radiusExpression: [
          'interpolate',
          ['exponential', 2.0],
          ['get', 'animation_progress'],
          0, ['get', 'base_radius'],
          0.3, ['get', 'pulse_radius'],
          0.7, ['*', ['get', 'pulse_radius'], 1.1],
          1, ['get', 'base_radius']
        ],
        colorExpression: ['get', 'glow_color'],
        opacityExpression: [
          'interpolate',
          ['linear'],
          ['get', 'animation_progress'],
          0, 0.8,
          0.3, 0.6,
          0.7, 0.3,
          1, 0
        ],
        blurExpression: 1.0
      },
      
      heartbeat: {
        radiusExpression: [
          'interpolate',
          ['linear'],
          ['get', 'animation_progress'],
          0, ['get', 'base_radius'],
          0.1, ['*', ['get', 'base_radius'], 2.5],
          0.2, ['*', ['get', 'base_radius'], 1.2],
          0.3, ['*', ['get', 'base_radius'], 3.0],
          0.4, ['get', 'base_radius'],
          1, ['get', 'base_radius']
        ],
        colorExpression: ['get', 'glow_color'],
        opacityExpression: [
          'interpolate',
          ['linear'],
          ['get', 'animation_progress'],
          0, 0.6,
          0.1, 0.9,
          0.2, 0.4,
          0.3, 1.0,
          0.4, 0.6,
          1, 0.6
        ],
        blurExpression: 0.8
      },
      
      gentle_pulse: {
        radiusExpression: [
          'interpolate',
          ['exponential', 0.5],
          ['get', 'animation_progress'],
          0, ['get', 'base_radius'],
          0.5, ['*', ['get', 'base_radius'], 1.8],
          1, ['get', 'base_radius']
        ],
        colorExpression: ['get', 'glow_color'],
        opacityExpression: [
          'interpolate',
          ['linear'],
          ['get', 'animation_progress'],
          0, 0.4,
          0.5, 0.7,
          1, 0.4
        ],
        blurExpression: 1.5
      },
      
      urgent_pulse: {
        radiusExpression: [
          'interpolate',
          ['exponential', 3.0],
          ['get', 'animation_progress'],
          0, ['get', 'base_radius'],
          0.2, ['*', ['get', 'pulse_radius'], 1.2],
          0.4, ['get', 'base_radius'],
          0.6, ['*', ['get', 'pulse_radius'], 1.2],
          0.8, ['get', 'base_radius'],
          1, ['*', ['get', 'pulse_radius'], 1.2]
        ],
        colorExpression: ['get', 'glow_color'],
        opacityExpression: [
          'interpolate',
          ['linear'],
          ['get', 'animation_progress'],
          0, 0.9,
          0.2, 0.3,
          0.4, 0.9,
          0.6, 0.3,
          0.8, 0.9,
          1, 0.3
        ],
        blurExpression: 0.5
      }
    };
    
    return configs[animationType] || configs.pulse;
  }

  /**
   * Start the main animation loop
   */
  startAnimationLoop() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.animate();
  }

  /**
   * Main animation loop
   */
  animate() {
    if (!this.isRunning) return;
    
    const now = Date.now();
    
    // Update all animation layers
    this.updateAnimationLayers(now);
    
    // Continue animation loop
    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  /**
   * Update all animation layers with current time
   */
  updateAnimationLayers(now) {
    // Get all animation sources
    const sources = this.getAnimationSources();
    
    sources.forEach(sourceId => {
      const source = this.map.current.getSource(sourceId);
      if (!source || !source._data) return;
      
      const features = source._data.features.map(feature => {
        const props = feature.properties;
        const period = props.animation_period || 1600;
        const startTime = props.animation_start || now;
        
        // Calculate animation progress (0-1)
        const elapsed = (now - startTime) % period;
        const progress = elapsed / period;
        
        return {
          ...feature,
          properties: {
            ...props,
            animation_progress: progress,
            animation_time: now
          }
        };
      });
      
      // Update source data
      source.setData({
        type: 'FeatureCollection',
        features
      });
    });
  }

  /**
   * Get all animation source IDs
   */
  getAnimationSources() {
    const sources = [];
    const style = this.map.current.getStyle();
    
    if (style && style.sources) {
      Object.keys(style.sources).forEach(sourceId => {
        if (sourceId.startsWith('node-animation-source-')) {
          sources.push(sourceId);
        }
      });
    }
    
    return sources;
  }

  /**
   * Trigger a single node animation at specific coordinates
   * @param {Array} coordinates - [longitude, latitude]
   * @param {Object} options - Animation options
   */
  triggerNodeAnimation(coordinates, options = {}) {
    if (!this.map?.current || !coordinates) return;
    
    const {
      type = 'pulse',
      intensity = 0.6,
      duration = 2.0,
      nodeData = {},
      category = 'all'
    } = options;
    
    console.log('🎬 Triggering node animation:', { coordinates, type, intensity, duration });
    
    // Clear any existing temp sources to prevent conflicts
    this.clearTempSources();
    
    // Create a temporary feature for this animation
    const feature = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: coordinates
      },
      properties: {
        id: `temp-animation-${Date.now()}`,
        animation_type: type,
        animation_intensity: intensity,
        animation_duration: duration,
        node_data: nodeData,
        category: category,
        animation_start: Date.now(),
        animation_period: duration * 1000,
        base_radius: 8,
        pulse_radius: 32,
        glow_intensity: intensity,
        color: this.getColorForCategory(category),
        glow_color: this.getGlowColorForCategory(category)
      }
    };
    
    // Create a temporary animation layer for this single node
    this.animationCounter++;
    const layerId = `temp-node-animation-${this.animationCounter}`;
    const sourceId = `temp-node-animation-source-${this.animationCounter}`;
    
    // Check if source already exists and remove it
    if (this.map.current.getSource(sourceId)) {
      this.map.current.removeSource(sourceId);
    }
    
    // Add source
    this.map.current.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [feature]
      }
    });
    
    // Add base layer with enhanced visibility
    this.map.current.addLayer({
      id: layerId,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius': 120,
        'circle-color': feature.properties.color,
        'circle-opacity': 0.5,
        'circle-stroke-width': 2,
        'circle-stroke-color': feature.properties.glow_color,
        'circle-stroke-opacity': 0.2
      },
      minzoom: 6
    });
    
    // Add glow layer with pulsing effect
    const glowLayerId = `${layerId}-glow`;
    this.map.current.addLayer({
      id: glowLayerId,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'animation_progress'],
          0, 200,
          0.5, 400,
          1, 200
        ],
        'circle-color': feature.properties.glow_color,
        'circle-opacity': [
          'interpolate',
          ['linear'],
          ['get', 'animation_progress'],
          0, 0.4,
          0.5, 0.1,
          1, 0.4
        ],
        'circle-blur': 1.5
      },
      minzoom: 6
    });
    
    // Start animation loop for this specific feature
    const startTime = Date.now();
    const animateFeature = () => {
      const elapsed = Date.now() - startTime;
      const progress = (elapsed % (duration * 1000)) / (duration * 1000);
      
      // Check if source still exists before updating
      const source = this.map.current.getSource(sourceId);
      if (source && source.setData) {
        source.setData({
          type: 'FeatureCollection',
          features: [{
            ...feature,
            properties: {
              ...feature.properties,
              animation_progress: progress
            }
          }]
        });
      }
      
      // Continue animation if still within duration and source exists
      if (elapsed < duration * 1000 && source) {
        requestAnimationFrame(animateFeature);
      }
    };
    
    // Start the animation
    animateFeature();
    
    // Remove the temporary layers after animation duration
    setTimeout(() => {
      try {
        if (this.map.current) {
          // Remove layers in reverse order (glow first, then base)
          if (this.map.current.getLayer(glowLayerId)) {
            this.map.current.removeLayer(glowLayerId);
          }
          if (this.map.current.getLayer(layerId)) {
            this.map.current.removeLayer(layerId);
          }
          // Remove source last
          if (this.map.current.getSource(sourceId)) {
            this.map.current.removeSource(sourceId);
          }
        }
      } catch (error) {
        console.warn('Error cleaning up animation layers:', error);
      }
    }, duration * 1000);
  }
  
  /**
   * Get color for category based on LegendContainer mapping
   */
  getColorForCategory(category) {
    // Map marker categories to their actual colors from LegendContainer
    const colors = {
      'power plants': '#ef4444',        // Red
      'electric utilities': '#f59e0b',  // Orange
      'data centers': '#8b5cf6',        // Purple
      'other facilities': '#6b7280',    // Gray
      'other': '#6b7280',               // Gray
      // Fallback for table categories
      'all': '#ef4444',
      'pwr': '#ef4444',
      'trn': '#f59e0b',
      'utl': '#06b6d4',
      'risk': '#f59e0b'
    };
    return colors[category] || '#ef4444';
  }
  
  /**
   * Get glow color for category based on LegendContainer mapping
   */
  getGlowColorForCategory(category) {
    // Map marker categories to their glow colors
    const glowColors = {
      'power plants': '#ff6b6b',        // Light red
      'electric utilities': '#fbbf24',  // Light orange
      'data centers': '#a78bfa',        // Light purple
      'other facilities': '#9ca3af',    // Light gray
      'other': '#9ca3af',               // Light gray
      // Fallback for table categories
      'all': '#ff6b6b',
      'pwr': '#ff6b6b',
      'trn': '#fbbf24',
      'utl': '#22d3ee',
      'risk': '#fbbf24'
    };
    return glowColors[category] || '#ff6b6b';
  }

  /**
   * Stop all animations and cleanup
   */
  stopAnimations() {
    this.isRunning = false;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    // Remove all animation layers
    this.removeAnimationLayers();
  }

  /**
   * Remove all animation layers and sources
   */
  removeAnimationLayers() {
    if (!this.map?.current) return;

    const mapInstance = this.map.current;
    if (typeof mapInstance.isStyleLoaded === 'function' && !mapInstance.isStyleLoaded()) {
      return;
    }

    const style = mapInstance.getStyle();
    if (!style || !style.layers) return;

    // Remove animation layers
    style.layers.forEach(layer => {
      if (layer.id.startsWith('node-animation-')) {
        if (mapInstance.getLayer(layer.id)) {
          mapInstance.removeLayer(layer.id);
        }
      }
    });

    // Remove animation sources
    const sources = this.getAnimationSources();
    sources.forEach(sourceId => {
      if (mapInstance.getSource(sourceId)) {
        mapInstance.removeSource(sourceId);
      }
    });
  }

  /**
   * Update animations for specific features (e.g., when data changes)
   */
  updateFeatureAnimations(features) {
    if (!features?.length) return;
    
    // Stop current animations
    this.stopAnimations();
    
    // Reinitialize with new features
    this.initializeNodeAnimations(features);
  }

  /**
   * Highlight specific feature with enhanced animation
   */
  highlightFeature(featureId, duration = 3000) {
    if (!this.map?.current) return;
    
    // Find the feature in all animation sources
    const sources = this.getAnimationSources();
    
    sources.forEach(sourceId => {
      const source = this.map.current.getSource(sourceId);
      if (!source || !source._data) return;
      
      const features = source._data.features.map(feature => {
        if (feature.properties.serp_id === featureId) {
          return {
            ...feature,
            properties: {
              ...feature.properties,
              highlighted: true,
              highlight_start: Date.now(),
              highlight_duration: duration
            }
          };
        }
        return feature;
      });
      
      source.setData({
        type: 'FeatureCollection',
        features
      });
    });
  }

  /**
   * Clear all temporary animation sources to prevent conflicts
   */
  clearTempSources() {
    if (!this.map?.current) return;
    
    const style = this.map.current.getStyle();
    if (!style || !style.layers) return;
    
    // Remove temp layers first
    style.layers.forEach(layer => {
      if (layer.id.startsWith('temp-node-animation-')) {
        try {
          if (this.map.current.getLayer(layer.id)) {
            this.map.current.removeLayer(layer.id);
          }
        } catch (error) {
          console.warn('Error removing temp layer:', layer.id, error);
        }
      }
    });
    
    // Remove temp sources
    const sources = this.getAnimationSources();
    sources.forEach(sourceId => {
      if (sourceId.startsWith('temp-node-animation-source-')) {
        try {
          if (this.map.current.getSource(sourceId)) {
            this.map.current.removeSource(sourceId);
          }
        } catch (error) {
          console.warn('Error removing temp source:', sourceId, error);
        }
      }
    });
  }

  /**
   * Get animation statistics for debugging
   */
  getAnimationStats() {
    const sources = this.getAnimationSources();
    const totalFeatures = sources.reduce((total, sourceId) => {
      const source = this.map.current.getSource(sourceId);
      return total + (source?._data?.features?.length || 0);
    }, 0);
    
    return {
      isRunning: this.isRunning,
      activeSources: sources.length,
      totalFeatures,
      animationFrame: this.animationFrame !== null
    };
  }
}

export default NodeAnimation;
