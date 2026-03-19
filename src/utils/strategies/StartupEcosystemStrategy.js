/**
 * StartupEcosystemStrategy - Contains startup ecosystem specific configuration and logic
 * Part of Phase 6: Strategy Pattern implementation for startup ecosystem mapping
 * Separates startup ecosystem concerns from generic tool execution
 * 
 * Supports geographic flexibility for startup ecosystem analysis in Boston/Cambridge
 */

import { getGeographicConfig, getLocationQueries } from '../../config/geographicConfig.js';

export class StartupEcosystemStrategy {
  constructor(locationConfig = null) {
    // Use provided config or default (Boston, MA)
    this.config = locationConfig || getGeographicConfig('default');
    
    // Generate location-specific queries
    this.defaultQueries = this.generateLocationQueries();
    
    // Set location-specific parameters
    this.coordinates = this.config.coordinates;
    this.searchRadius = this.config.searchRadius;
    this.businessContext = this.config.businessContext;
    
    // Startup ecosystem specific tool priorities
    this.toolPriorities = {
      'SERP': 'high',      // Primary for startup company data
      'OSM': 'medium',     // Secondary for urban infrastructure context
      'PERPLEXITY': 'high', // Critical for startup analysis
      'FIRECRAWL': 'low'   // Alternative data sources
    };
    
    // Startup ecosystem specific configuration
    this.startupConfig = {
      cacheExpiration: 30 * 60 * 1000, // 30 minutes
      maxRetries: 3,
      timeout: 15000
    };
  }

  /**
   * Generate location-specific queries for startup ecosystem
   */
  generateLocationQueries() {
    const { city, state, county, region, businessContext } = this.config;
    return [
      `startup companies ${city} ${state}`,
      `venture capital firms ${city} ${state}`,
      `co-working spaces ${city} ${state}`,
      `accelerators incubators ${city} ${state}`,
      `tech companies ${city} ${state}`,
      `universities research ${city} ${state}`,
      `legal services startups ${city} ${state}`,
      `corporate innovation labs ${city} ${state}`
    ];
  }

  /**
   * Switch to a different location
   * @param {string} locationKey - The location key to switch to
   */
  switchLocation(locationKey) {
    this.config = getGeographicConfig(locationKey);
    this.coordinates = this.config.coordinates;
    this.searchRadius = this.config.searchRadius;
    this.businessContext = this.config.businessContext;
    this.defaultQueries = this.generateLocationQueries();
  }

  /**
   * Get current location configuration
   * @returns {Object} Current location config
   */
  getLocationConfig() {
    return this.config;
  }

  /**
   * Get current location information
   */
  getLocationInfo() {
    return {
      city: this.config.city,
      state: this.config.state,
      county: this.config.county,
      region: this.config.region,
      businessContext: this.config.businessContext,
      facilityName: this.config.facilityName
    };
  }

  /**
   * Get coordinates for startup ecosystem analysis
   */
  getCoordinates() {
    return this.coordinates;
  }

  /**
   * Get default queries for startup ecosystem analysis
   */
  getDefaultQueries() {
    return this.defaultQueries;
  }

  /**
   * Get tool priority for startup ecosystem analysis
   */
  getToolPriority(toolName) {
    return this.toolPriorities[toolName] || 'low';
  }

  /**
   * Get startup ecosystem specific configuration
   */
  getConfig() {
    return this.startupConfig;
  }

  /**
   * Get search radius for startup ecosystem
   */
  getSearchRadius() {
    return this.searchRadius;
  }

  /**
   * Get cache expiration time
   */
  getCacheExpiration() {
    return this.startupConfig.cacheExpiration;
  }

  /**
   * Get max retries for API calls
   */
  getMaxRetries() {
    return this.startupConfig.maxRetries;
  }

  /**
   * Get timeout for API calls
   */
  getTimeout() {
    return this.startupConfig.timeout;
  }

  /**
   * Validate if a tool is suitable for startup ecosystem analysis
   */
  isToolSuitable(toolName) {
    return toolName in this.toolPriorities;
  }

  /**
   * Get startup ecosystem specific error messages
   */
  getErrorMessage(toolName, error) {
    const messages = {
      'SERP': `Startup ecosystem search failed: ${error}`,
      'OSM': `Urban infrastructure context search failed: ${error}`,
      'PERPLEXITY': `Startup analysis failed: ${error}`,
      'FIRECRAWL': `Alternative data extraction failed: ${error}`
    };
    return messages[toolName] || `Tool execution failed: ${error}`;
  }

  /**
   * Get startup ecosystem specific success messages
   */
  getSuccessMessage(toolName, resultCount) {
    const messages = {
      'SERP': `Found ${resultCount} startup ecosystem features`,
      'OSM': `Retrieved ${resultCount} urban infrastructure features`,
      'PERPLEXITY': `Generated ${resultCount} startup analysis insights`,
      'FIRECRAWL': `Extracted ${resultCount} alternative data sources`
    };
    return messages[toolName] || `Tool executed successfully: ${resultCount} results`;
  }
}
