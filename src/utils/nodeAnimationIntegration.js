/**
 * NodeAnimationIntegration - Integration examples and utilities
 * 
 * This file shows how to integrate the NodeAnimation system with existing components
 * like SerpTool, CategoryToggle, and LegendContainer.
 */

import NodeAnimation from './nodeAnimation.js';

/**
 * Integration with SerpTool
 * 
 * This shows how to enhance SerpTool markers with advanced animations
 */
export class SerpToolAnimationIntegration {
  constructor(map, updateToolFeedback) {
    this.nodeAnimation = new NodeAnimation(map, updateToolFeedback);
    this.originalSerpTool = null; // Will be set when SerpTool is available
  }

  /**
   * Enhance SerpTool markers with animations
   */
  enhanceSerpToolMarkers(serpTool) {
    this.originalSerpTool = serpTool;
    
    // Override the marker creation in SerpTool
    const originalExecute = serpTool.execute.bind(serpTool);
    
    serpTool.execute = async (queries, coordinates, map, handleMarkerClick) => {
      // Call original method
      const features = await originalExecute(queries, coordinates, map, handleMarkerClick);
      
      // Enhance with animations
      if (features && features.length > 0) {
        this.nodeAnimation.initializeNodeAnimations(features);
        
        // Update tool feedback with animation info
        this.updateToolFeedback({
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
   * Update marker animations based on category selection
   */
  updateAnimationsForCategory(selectedCategory, features) {
    if (!features?.length) return;
    
    // Filter features based on category
    const filteredFeatures = this.filterFeaturesByCategory(features, selectedCategory);
    
    // Update animations
    this.nodeAnimation.updateFeatureAnimations(filteredFeatures);
  }

  /**
   * Filter features based on CategoryToggle categories
   */
  filterFeaturesByCategory(features, category) {
    if (category === 'all') return features;
    
    const categoryMappings = {
      'pwr': ['power_generation'],
      'trn': ['electrical_transmission', 'grid_operator'],
      'utl': ['water_cooling', 'natural_gas'],
      'risk': ['emergency_services', 'industrial']
    };
    
    const targetTypes = categoryMappings[category] || [];
    
    return features.filter(feature => {
      const infrastructureType = feature.properties.infrastructure_type;
      return targetTypes.includes(infrastructureType);
    });
  }

  /**
   * Highlight features based on legend selection
   */
  highlightLegendSelection(legendData) {
    if (!legendData?.serpFeatures?.length) return;
    
    // Highlight all features of the selected category
    legendData.serpFeatures.forEach(feature => {
      this.nodeAnimation.highlightFeature(feature.properties.serp_id, 2000);
    });
  }
}

/**
 * Integration with CategoryToggle
 * 
 * This shows how to connect CategoryToggle selections with animations
 */
export class CategoryToggleAnimationIntegration {
  constructor(nodeAnimation) {
    this.nodeAnimation = nodeAnimation;
  }

  /**
   * Handle category changes with animation updates
   */
  handleCategoryChange(categoryId, features) {
    // Update visual effects
    this.updateVisualEffectsForCategory(categoryId, features);
  }

  /**
   * Get animation intensity based on category
   */
  getAnimationIntensityForCategory(categoryId) {
    const intensities = {
      'pwr': 'high',      // Power - high intensity
      'trn': 'critical',  // Transmission - critical intensity
      'utl': 'medium',    // Utilities - medium intensity
      'risk': 'urgent'    // Risk - urgent intensity
    };
    
    return intensities[categoryId] || 'low';
  }

  /**
   * Update visual effects for specific category
   */
  updateVisualEffectsForCategory(categoryId, features) {
    if (!features?.length) return;
    
    // Apply category-specific visual enhancements
    const enhancedFeatures = features.map(feature => ({
      ...feature,
      properties: {
        ...feature.properties,
        category_highlight: categoryId,
        animation_intensity: this.getAnimationIntensityForCategory(categoryId)
      }
    }));
    
    this.nodeAnimation.updateFeatureAnimations(enhancedFeatures);
  }
}

/**
 * Integration with LegendContainer
 * 
 * This shows how to connect legend interactions with animations
 */
export class LegendContainerAnimationIntegration {
  constructor(nodeAnimation) {
    this.nodeAnimation = nodeAnimation;
  }

  /**
   * Handle legend item clicks with animations
   */
  handleLegendItemClick(displayLabel, features) {
    // Find features matching the legend item
    const matchingFeatures = this.findMatchingFeatures(displayLabel, features);
    
    if (matchingFeatures.length > 0) {
      // Highlight matching features
      matchingFeatures.forEach(feature => {
        this.nodeAnimation.highlightFeature(feature.properties.serp_id, 3000);
      });
      
      // Update animation focus
      this.updateAnimationFocus(matchingFeatures);
    }
  }

  /**
   * Find features matching legend display label
   */
  findMatchingFeatures(displayLabel, features) {
    const categoryMap = {
      'Power Plants': 'power plants',
      'Electric Utilities': 'electric utilities',
      'Data Centers': 'data centers',
      'Other Facilities': 'other'
    };
    
    const targetCategory = categoryMap[displayLabel] || displayLabel.toLowerCase();
    
    return features.filter(feature => 
      feature.properties.category === targetCategory
    );
  }

  /**
   * Update animation focus based on selected features
   */
  updateAnimationFocus(features) {
    // Increase animation intensity for focused features
    const focusedFeatures = features.map(feature => ({
      ...feature,
      properties: {
        ...feature.properties,
        focused: true,
        animation_intensity: 'high'
      }
    }));
    
    this.nodeAnimation.updateFeatureAnimations(focusedFeatures);
  }
}

/**
 * Complete integration example
 * 
 * This shows how to integrate all components together
 */
export class CompleteAnimationIntegration {
  constructor(map, updateToolFeedback) {
    this.nodeAnimation = new NodeAnimation(map, updateToolFeedback);
    this.serpIntegration = new SerpToolAnimationIntegration(map, updateToolFeedback);
    this.categoryIntegration = new CategoryToggleAnimationIntegration(this.nodeAnimation);
    this.legendIntegration = new LegendContainerAnimationIntegration(this.nodeAnimation);
  }

  /**
   * Initialize complete animation system
   */
  initialize(serpTool, categoryToggle, legendContainer) {
    // Enhance SerpTool with animations
    this.serpIntegration.enhanceSerpToolMarkers(serpTool);
    
    // Set up category toggle integration
    this.setupCategoryToggleIntegration(categoryToggle);
    
    // Set up legend container integration
    this.setupLegendContainerIntegration(legendContainer);
    
    console.log('🎬 Complete animation system initialized');
  }

  /**
   * Set up category toggle integration
   */
  setupCategoryToggleIntegration(categoryToggle) {
    if (!categoryToggle) return;
    
    // Override category change handler
    const originalOnCategoryChange = categoryToggle.props.onCategoryChange;
    
    categoryToggle.props.onCategoryChange = (categoryId, filteredResponse, tableData) => {
      // Call original handler
      if (originalOnCategoryChange) {
        originalOnCategoryChange(categoryId, filteredResponse, tableData);
      }
      
      // Add animation handling
      this.categoryIntegration.handleCategoryChange(categoryId, tableData);
    };
  }

  /**
   * Set up legend container integration
   */
  setupLegendContainerIntegration(legendContainer) {
    if (!legendContainer) return;
    
    // Listen for legend events
    if (window.mapEventBus) {
      window.mapEventBus.on('legend:itemSelected', (data) => {
        this.legendIntegration.handleLegendItemClick(
          data.displayLabel, 
          data.features || []
        );
      });
    }
  }

  /**
   * Get animation statistics for debugging
   */
  getDebugInfo() {
    return {
      nodeAnimation: this.nodeAnimation.getAnimationStats(),
      integrations: {
        serp: !!this.serpIntegration.originalSerpTool,
        category: !!this.categoryIntegration,
        legend: !!this.legendIntegration
      }
    };
  }
}

export default CompleteAnimationIntegration;
