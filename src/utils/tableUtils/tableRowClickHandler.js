/**
 * Table Row Click Handler - Manages table row click events and animation triggers
 * 
 * This utility handles table row clicks, coordinate extraction, and event emission
 * for connecting table interactions with map animations.
 */

/**
 * Extract coordinates from node content
 * @param {Object} node - Node object containing content
 * @returns {Array|null} [longitude, latitude] or null if not found
 */
export const extractCoordinatesFromNode = (node) => {
  // Check if this is startup company data with geometry.coordinates
  if (node.geometry && node.geometry.coordinates && Array.isArray(node.geometry.coordinates)) {
    const [lng, lat] = node.geometry.coordinates;
    return [lng, lat]; // [longitude, latitude] format for Mapbox
  }
  
  // Check if this is startup company data with coordinates property
  if (node.coordinates && node.coordinates.lng && node.coordinates.lat) {
    return [node.coordinates.lng, node.coordinates.lat];
  }
  
  // Fallback: Look for coordinate patterns in node content (for infrastructure data)
  if (node.content && typeof node.content === 'string') {
    const coordRegex = /(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/g;
    const matches = [...node.content.matchAll(coordRegex)];
    
    if (matches.length > 0) {
      // Return the first coordinate pair found
      const lat = parseFloat(matches[0][1]);
      const lng = parseFloat(matches[0][2]);
      return [lng, lat]; // [longitude, latitude] format for Mapbox
    }
  }
  
  // No coordinates found
  return null;
};

/**
 * Handle table row click event
 * @param {Object} node - Clicked node data
 * @param {Function} onAnimationTrigger - Callback for animation triggers
 * @param {Object} nodeAnimation - Animation system instance
 */
export const handleTableRowClick = (node, onAnimationTrigger, nodeAnimation) => {
  // Extract coordinates from node content if available
  const coordinates = extractCoordinatesFromNode(node);

  // Create bridge data for legend matching
  const bridgeData = {
    tableNode: node,
    coordinates: coordinates,
    searchTerms: generateSearchTerms(node),
    timestamp: Date.now()
  };

  // Emit event to legend/map system
  if (window.mapEventBus) {
    window.mapEventBus.emit('table:nodeSelected', bridgeData);
  } else {
    console.warn('⚠️ mapEventBus not available');
  }

  // Trigger animation if animation system is available
  if (nodeAnimation && coordinates) {
    // Determine animation type based on node category
    const animationType = getAnimationTypeForNode(node);
    
    // Trigger the animation
    nodeAnimation.triggerNodeAnimation(coordinates, {
      type: animationType,
      intensity: getAnimationIntensity(node),
      duration: getAnimationDuration(node),
      nodeData: node
    });
  }

  // Call custom animation trigger callback if provided
  if (onAnimationTrigger) {
    onAnimationTrigger(node, coordinates, bridgeData);
  }
};

/**
 * Get animation type based on node data
 * @param {Object} node - Node object
 * @returns {string} Animation type
 */
const getAnimationTypeForNode = (node) => {
  const type = (node.type || node.category || '').toLowerCase();
  
  // Infrastructure types
  if (type.includes('power') || type.includes('plant')) {
    return 'pulse'; // Power plants get pulse animation
  }
  if (type.includes('substation') || type.includes('transmission')) {
    return 'ripple'; // Transmission gets ripple effect
  }
  if (type.includes('water') || type.includes('utility')) {
    return 'glow'; // Utilities get glow effect
  }
  if (type.includes('data') || type.includes('center')) {
    return 'heartbeat'; // Data centers get heartbeat
  }
  
  // Startup ecosystem types
  if (type.includes('ai') || type.includes('ml')) {
    return 'pulse'; // AI/ML companies get pulse animation
  }
  if (type.includes('biotech') || type.includes('health')) {
    return 'heartbeat'; // Biotech companies get heartbeat
  }
  if (type.includes('fintech')) {
    return 'ripple'; // FinTech companies get ripple effect
  }
  if (type.includes('cleantech') || type.includes('enterprise') || type.includes('hardware')) {
    return 'glow'; // Other startup categories get glow effect
  }
  
  return 'pulse'; // Default animation
};

/**
 * Get animation intensity based on node score
 * @param {Object} node - Node object
 * @returns {number} Animation intensity (0-1)
 */
const getAnimationIntensity = (node) => {
  // Try different score properties for different data types
  const score = node.powerScore || node.overallScore || node.innovationScore || 0;
  
  if (score >= 8) return 0.8; // High intensity for high scores
  if (score >= 6) return 0.6; // Medium intensity for medium scores
  if (score >= 4) return 0.4; // Low intensity for low scores
  return 0.2; // Very low intensity for very low scores
};

/**
 * Get animation duration based on node risk level
 * @param {Object} node - Node object
 * @returns {number} Animation duration in seconds
 */
const getAnimationDuration = (node) => {
  const risk = node.risk?.toLowerCase();
  
  if (risk === 'high') return 3.0; // Longer duration for high risk
  if (risk === 'medium') return 2.0; // Medium duration for medium risk
  if (risk === 'low') return 1.5; // Shorter duration for low risk
  
  // For startup companies, use funding stage as risk indicator
  const fundingStage = (node.fundingStage || '').toLowerCase();
  if (fundingStage.includes('series') || fundingStage.includes('a+')) return 1.5; // Lower risk, shorter duration
  if (fundingStage.includes('seed')) return 2.0; // Medium risk, medium duration
  if (fundingStage.includes('pre-seed')) return 2.5; // Higher risk, longer duration
  
  return 2.0; // Default duration
};

/**
 * Generate search terms for matching with legend data
 * @param {Object} node - Node object
 * @returns {Array} Array of search terms
 */
const generateSearchTerms = (node) => {
  const terms = [];
  
  // Add node name words
  if (node.name) {
    terms.push(...node.name.toLowerCase().split(' '));
  }
  
  // Add type-based terms (for infrastructure data)
  if (node.type) {
    const type = node.type.toLowerCase();
    if (type.includes('power') || type.includes('plant')) {
      terms.push('power', 'plant', 'generation');
    }
    if (type.includes('substation') || type.includes('transmission')) {
      terms.push('substation', 'transmission', 'electric', 'utility');
    }
    if (type.includes('water') || type.includes('utility')) {
      terms.push('water', 'utility', 'municipal');
    }
    if (type.includes('data') || type.includes('center')) {
      terms.push('data', 'center', 'facility');
    }
  }
  
  // Add category-based terms (for startup data)
  if (node.category) {
    const category = node.category.toLowerCase();
    terms.push(category);
    if (category.includes('ai') || category.includes('ml')) {
      terms.push('ai', 'ml', 'artificial', 'intelligence', 'machine', 'learning');
    }
    if (category.includes('biotech') || category.includes('health')) {
      terms.push('biotech', 'health', 'medical', 'pharmaceutical');
    }
    if (category.includes('fintech')) {
      terms.push('fintech', 'finance', 'financial', 'technology');
    }
    if (category.includes('cleantech')) {
      terms.push('cleantech', 'clean', 'energy', 'sustainable');
    }
    if (category.includes('enterprise')) {
      terms.push('enterprise', 'business', 'software');
    }
    if (category.includes('hardware')) {
      terms.push('hardware', 'device', 'technology');
    }
  }
  
  // Add industry terms
  if (node.industries && Array.isArray(node.industries)) {
    node.industries.forEach(industry => {
      if (industry && typeof industry === 'string') {
        terms.push(...industry.toLowerCase().split(' '));
      }
    });
  }
  
  return [...new Set(terms)]; // Remove duplicates
};
