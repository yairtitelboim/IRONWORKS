/**
 * RegulatoryStrategy - Contains regulatory analysis specific configuration and logic
 * Part of Phase 3: Generic ToolExecutor implementation
 * Separates regulatory analysis concerns from generic tool execution
 */

import { getGeographicConfig } from '../../config/geographicConfig.js';

export class RegulatoryStrategy {
  constructor(locationConfig = null) {
    // Use provided config or default (Whitney, TX)
    this.config = locationConfig || getGeographicConfig('default');
    this.coordinates = this.config.coordinates;
    
    // Generate location-specific regulatory queries
    this.defaultQueries = this.generateLocationQueries();
    
    // Regulatory analysis specific tool priorities
    this.toolPriorities = {
      'SERP': 'medium',    // Secondary for regulatory data
      'OSM': 'high',       // Primary for zoning and land use
      'PERPLEXITY': 'medium', // Alternative analysis
      'FIRECRAWL': 'high'   // Regulatory documents and updates
    };
    
    // Regulatory analysis specific configuration
    this.config = {
      searchRadius: 10000, // 10-mile radius for regulatory context
      cacheExpiration: 2 * 60 * 60 * 1000, // 2 hours (regulatory data changes moderately)
      maxRetries: 3,
      timeout: 15000
    };
  }

  /**
   * Generate location-specific regulatory queries
   */
  generateLocationQueries() {
    const { city, state, county } = this.config;
    return [
      `zoning requirements ${county} ${state}`,
      `data center permits ${city} ${state}`, 
      `construction permits ${county}`,
      `regulatory approval process ${state} data centers`,
      `environmental permits ${city} ${state}`
    ];
  }

  /**
   * Switch to a different location
   * @param {string} locationKey - The location key to switch to
   */
  switchLocation(locationKey) {
    this.config = getGeographicConfig(locationKey);
    this.coordinates = this.config.coordinates;
    this.defaultQueries = this.generateLocationQueries();
  }

  /**
   * Get coordinates for regulatory analysis
   */
  getCoordinates() {
    return this.coordinates;
  }

  /**
   * Get default queries for regulatory analysis
   */
  getDefaultQueries() {
    return this.defaultQueries;
  }

  /**
   * Get tool priority for regulatory analysis
   */
  getToolPriority(toolName) {
    return this.toolPriorities[toolName] || 'low';
  }

  /**
   * Get regulatory analysis specific configuration
   */
  getConfig() {
    return this.config;
  }

  /**
   * Get search radius for regulatory analysis
   */
  getSearchRadius() {
    return this.config.searchRadius;
  }

  /**
   * Get cache expiration time
   */
  getCacheExpiration() {
    return this.config.cacheExpiration;
  }

  /**
   * Get max retries for API calls
   */
  getMaxRetries() {
    return this.config.maxRetries;
  }

  /**
   * Get timeout for API calls
   */
  getTimeout() {
    return this.config.timeout;
  }

  /**
   * Validate if a tool is suitable for regulatory analysis
   */
  isToolSuitable(toolName) {
    return toolName in this.toolPriorities;
  }

  /**
   * Get regulatory analysis specific error messages
   */
  getErrorMessage(toolName, error) {
    const messages = {
      'SERP': `Regulatory data search failed: ${error}`,
      'OSM': `Zoning and land use search failed: ${error}`,
      'PERPLEXITY': `Regulatory analysis failed: ${error}`,
      'FIRECRAWL': `Regulatory document extraction failed: ${error}`
    };
    return messages[toolName] || `Tool execution failed: ${error}`;
  }

  /**
   * Get regulatory analysis specific success messages
   */
  getSuccessMessage(toolName, resultCount) {
    const messages = {
      'SERP': `Found ${resultCount} regulatory facilities`,
      'OSM': `Retrieved ${resultCount} zoning features`,
      'PERPLEXITY': `Generated ${resultCount} regulatory insights`,
      'FIRECRAWL': `Extracted ${resultCount} regulatory documents`
    };
    return messages[toolName] || `Tool executed successfully: ${resultCount} results`;
  }
}
