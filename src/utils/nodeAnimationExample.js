/**
 * NodeAnimationExample - Example implementation showing how to integrate
 * the NodeAnimation system with existing SerpTool markers
 */

import NodeAnimation from './nodeAnimation.js';
import CompleteAnimationIntegration from './nodeAnimationIntegration.js';

/**
 * Example: Basic integration with SerpTool
 */
export function integrateWithSerpTool(serpTool, map, updateToolFeedback) {
  console.log('🎬 Setting up NodeAnimation integration with SerpTool');
  
  // Create animation system
  const nodeAnimation = new NodeAnimation(map, updateToolFeedback);
  
  // Store reference for later use
  serpTool.nodeAnimation = nodeAnimation;
  
  // Override the execute method to add animations
  const originalExecute = serpTool.execute.bind(serpTool);
  
  serpTool.execute = async function(queries, coordinates, map, handleMarkerClick) {
    // Call original method
    const features = await originalExecute(queries, coordinates, map, handleMarkerClick);
    
    // Add animations to the features
    if (features && features.length > 0) {
      console.log(`🎬 Adding animations to ${features.length} infrastructure features`);
      nodeAnimation.initializeNodeAnimations(features);
      
      // Update feedback with animation info
      updateToolFeedback({
        isActive: true,
        tool: 'serp',
        status: 'Enhanced infrastructure analysis with animations completed!',
        progress: 100,
        details: `Found ${features.length} infrastructure facilities with advanced visual effects. Animations show criticality, relevance, and infrastructure type.`
      });
    }
    
    return features;
  };
  
  return serpTool;
}

/**
 * Example: Complete integration with all components
 */
export function setupCompleteAnimationSystem(map, updateToolFeedback, components) {
  console.log('🎬 Setting up complete animation system');
  
  const { serpTool, categoryToggle, legendContainer } = components;
  
  // Create complete integration
  const animationSystem = new CompleteAnimationIntegration(map, updateToolFeedback);
  
  // Initialize with all components
  animationSystem.initialize(serpTool, categoryToggle, legendContainer);
  
  // Set up event listeners for dynamic updates
  setupAnimationEventListeners(animationSystem);
  
  return animationSystem;
}

/**
 * Set up event listeners for dynamic animation updates
 */
function setupAnimationEventListeners(animationSystem) {
  if (!window.mapEventBus) return;
  
  // Listen for marker selection events
  window.mapEventBus.on('marker:selected', (markerData) => {
    console.log('🎬 Marker selected, highlighting with animation');
    animationSystem.nodeAnimation.highlightFeature(markerData.serp_id, 3000);
  });
  
  // Listen for category changes
  window.mapEventBus.on('category:changed', (data) => {
    console.log('🎬 Category changed, updating animations');
    animationSystem.categoryIntegration.handleCategoryChange(data.categoryId, data.features);
  });
  
  // Listen for legend interactions
  window.mapEventBus.on('legend:itemSelected', (data) => {
    console.log('🎬 Legend item selected, highlighting features');
    animationSystem.legendIntegration.handleLegendItemClick(data.displayLabel, data.features);
  });
  
  // Listen for data updates
  window.mapEventBus.on('serp:dataLoaded', (data) => {
    console.log('🎬 New SERP data loaded, updating animations');
    animationSystem.nodeAnimation.updateFeatureAnimations(data.features);
  });
}

/**
 * Example: Custom animation effects for specific use cases
 */
export function createCustomAnimationEffects(nodeAnimation) {
  // Example: Create a custom "emergency alert" animation
  const emergencyAlertAnimation = {
    radiusExpression: [
      'interpolate',
      ['exponential', 3.0],
      ['get', 'animation_progress'],
      0, 15,
      0.1, 60,
      0.2, 20,
      0.3, 70,
      0.4, 15,
      0.5, 80,
      0.6, 15,
      1, 15
    ],
    colorExpression: '#ff0000',
    opacityExpression: [
      'interpolate',
      ['linear'],
      ['get', 'animation_progress'],
      0, 1.0,
      0.1, 0.3,
      0.2, 1.0,
      0.3, 0.2,
      0.4, 1.0,
      0.5, 0.1,
      0.6, 1.0,
      1, 1.0
    ],
    blurExpression: 0.5
  };
  
  // Add custom animation to the system
  nodeAnimation.config.infrastructureTypes.emergency_alert = {
    animation: 'emergency_alert',
    color: '#ff0000',
    glowColor: '#ff6666',
    effect: 'emergency_alert',
    customConfig: emergencyAlertAnimation
  };
  
  console.log('🎬 Custom emergency alert animation added');
}

/**
 * Example: Debug and monitoring functions
 */
export function setupAnimationDebugging(animationSystem) {
  // Add debug controls to window for testing
  window.animationDebug = {
    // Get current animation stats
    getStats: () => animationSystem.getDebugInfo(),
    
    // Stop all animations
    stop: () => animationSystem.nodeAnimation.stopAnimations(),
    
    // Start animations
    start: (features) => animationSystem.nodeAnimation.initializeNodeAnimations(features),
    
    // Highlight specific feature
    highlight: (featureId) => animationSystem.nodeAnimation.highlightFeature(featureId, 5000),
    
    // Update animations
    update: (features) => animationSystem.nodeAnimation.updateFeatureAnimations(features),
    
    // Test different animation types
    testAnimations: () => {
      const testFeatures = [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-97.347, 31.9315] },
          properties: {
            serp_id: 'test-power',
            infrastructure_type: 'power_generation',
            criticality_level: 'critical',
            relevance_score: 95,
            category: 'power plants'
          }
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-97.340, 31.930] },
          properties: {
            serp_id: 'test-transmission',
            infrastructure_type: 'electrical_transmission',
            criticality_level: 'high',
            relevance_score: 85,
            category: 'electric utilities'
          }
        }
      ];
      
      animationSystem.nodeAnimation.initializeNodeAnimations(testFeatures);
      console.log('🎬 Test animations started');
    }
  };
  
  console.log('🎬 Animation debugging tools available at window.animationDebug');
}

/**
 * Example: Performance monitoring
 */
export function setupPerformanceMonitoring(animationSystem) {
  let frameCount = 0;
  let lastTime = Date.now();
  
  const monitorPerformance = () => {
    frameCount++;
    const now = Date.now();
    
    if (now - lastTime >= 1000) { // Every second
      const fps = Math.round((frameCount * 1000) / (now - lastTime));
      const stats = animationSystem.getDebugInfo();
      
      console.log(`🎬 Animation Performance: ${fps} FPS, ${stats.nodeAnimation.totalFeatures} features`);
      
      frameCount = 0;
      lastTime = now;
    }
    
    requestAnimationFrame(monitorPerformance);
  };
  
  monitorPerformance();
  console.log('🎬 Performance monitoring started');
}

export default {
  integrateWithSerpTool,
  setupCompleteAnimationSystem,
  createCustomAnimationEffects,
  setupAnimationDebugging,
  setupPerformanceMonitoring
};
