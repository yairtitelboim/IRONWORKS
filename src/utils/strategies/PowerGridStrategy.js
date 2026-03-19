/**
 * PowerGridStrategy - Contains power grid specific configuration and logic
 * Part of Phase 2: Strategy Pattern implementation
 * Separates power grid concerns from generic tool execution
 * 
 * Now supports geographic flexibility for production deployment
 */

import { getGeographicConfig, getLocationQueries } from '../../config/geographicConfig.js';

export class PowerGridStrategy {
  constructor(locationConfig = null) {
    // Use provided config or default (Whitney, TX)
    this.config = locationConfig || getGeographicConfig('default');
    
    // Generate location-specific queries
    this.defaultQueries = this.generateLocationQueries();
    
    // Set location-specific parameters
    this.coordinates = this.config.coordinates;
    this.searchRadius = this.config.searchRadius;
    this.gridOperator = this.config.gridOperator;
    
    // Power grid specific tool priorities
    this.toolPriorities = {
      'SERP': 'high',      // Primary for infrastructure data
      'OSM': 'medium',     // Secondary for geographic context
      'PERPLEXITY': 'low', // Alternative analysis
      'FIRECRAWL': 'low'   // Regulatory updates
    };
    
    // Power grid specific configuration (merged with location config)
    this.powerGridConfig = {
      cacheExpiration: 30 * 60 * 1000, // 30 minutes
      maxRetries: 3,
      timeout: 15000
    };
  }

  /**
   * Generate location-specific queries
   */
  generateLocationQueries() {
    const { city, state, county, region, gridOperator } = this.config;
    return [
      `power plants near ${city} ${state}`,
      `electric utilities ${county} ${state}`,
      `electrical substations ${city} ${state}`,
      `${gridOperator} transmission ${city} ${state}`,
      `power grid infrastructure ${region}`,
      `data center power requirements ${city} ${state}`
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
    this.gridOperator = this.config.gridOperator;
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
      gridOperator: this.config.gridOperator,
      businessContext: this.config.businessContext
    };
  }

  /**
   * Get coordinates for power grid analysis
   */
  getCoordinates() {
    return this.coordinates;
  }

  /**
   * Get default queries for power grid analysis
   */
  getDefaultQueries() {
    return this.defaultQueries;
  }

  /**
   * Get tool priority for power grid analysis
   */
  getToolPriority(toolName) {
    return this.toolPriorities[toolName] || 'low';
  }

  /**
   * Get power grid specific configuration
   */
  getConfig() {
    return this.powerGridConfig;
  }

  /**
   * Get search radius for power infrastructure
   */
  getSearchRadius() {
    return this.searchRadius;
  }

  /**
   * Get cache expiration time
   */
  getCacheExpiration() {
    return this.powerGridConfig.cacheExpiration;
  }

  /**
   * Get max retries for API calls
   */
  getMaxRetries() {
    return this.powerGridConfig.maxRetries;
  }

  /**
   * Get timeout for API calls
   */
  getTimeout() {
    return this.powerGridConfig.timeout;
  }

  /**
   * Validate if a tool is suitable for power grid analysis
   */
  isToolSuitable(toolName) {
    return toolName in this.toolPriorities;
  }

  /**
   * Get power grid specific error messages
   */
  getErrorMessage(toolName, error) {
    const messages = {
      'SERP': `Power infrastructure search failed: ${error}`,
      'OSM': `Geographic context search failed: ${error}`,
      'PERPLEXITY': `Alternative analysis failed: ${error}`,
      'FIRECRAWL': `Regulatory data extraction failed: ${error}`
    };
    return messages[toolName] || `Tool execution failed: ${error}`;
  }

  /**
   * Get power grid specific success messages
   */
  getSuccessMessage(toolName, resultCount) {
    const messages = {
      'SERP': `Found ${resultCount} power infrastructure features`,
      'OSM': `Retrieved ${resultCount} geographic features`,
      'PERPLEXITY': `Generated ${resultCount} analysis insights`,
      'FIRECRAWL': `Extracted ${resultCount} regulatory documents`
    };
    return messages[toolName] || `Tool executed successfully: ${resultCount} results`;
  }
}
