/**
 * CompetitiveStrategy - Contains competitive analysis specific configuration and logic
 * Part of Phase 3: Generic ToolExecutor implementation
 * Separates competitive analysis concerns from generic tool execution
 */

import { getGeographicConfig } from '../../config/geographicConfig.js';

export class CompetitiveStrategy {
  constructor(locationConfig = null) {
    // Use provided config or default (Whitney, TX)
    this.config = locationConfig || getGeographicConfig('default');
    this.coordinates = this.config.coordinates;
    
    // Generate location-specific competitive queries
    this.defaultQueries = this.generateLocationQueries();
    
    // Competitive analysis specific tool priorities
    this.toolPriorities = {
      'SERP': 'high',      // Primary for competitor data
      'OSM': 'medium',     // Secondary for geographic context
      'PERPLEXITY': 'medium', // Alternative analysis
      'FIRECRAWL': 'high'   // Industry news and reports
    };
    
    // Competitive analysis specific configuration
    this.config = {
      searchRadius: 25000, // 25-mile radius for competitive analysis
      cacheExpiration: 60 * 60 * 1000, // 1 hour (competitive data changes frequently)
      maxRetries: 3,
      timeout: 15000
    };
  }

  /**
   * Generate location-specific competitive queries
   */
  generateLocationQueries() {
    const { city, state, county } = this.config;
    return [
      `data centers near ${city} ${state}`,
      `competitor data centers ${county} ${state}`, 
      `data center facilities within 25 miles ${city} ${state}`,
      `colocation providers ${city} ${state}`,
      `data center market analysis ${city} ${state}`
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
   * Get coordinates for competitive analysis
   */
  getCoordinates() {
    return this.coordinates;
  }

  /**
   * Get default queries for competitive analysis
   */
  getDefaultQueries() {
    return this.defaultQueries;
  }

  /**
   * Get tool priority for competitive analysis
   */
  getToolPriority(toolName) {
    return this.toolPriorities[toolName] || 'low';
  }

  /**
   * Get competitive analysis specific configuration
   */
  getConfig() {
    return this.config;
  }

  /**
   * Get search radius for competitive analysis
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
   * Validate if a tool is suitable for competitive analysis
   */
  isToolSuitable(toolName) {
    return toolName in this.toolPriorities;
  }

  /**
   * Get competitive analysis specific error messages
   */
  getErrorMessage(toolName, error) {
    const messages = {
      'SERP': `Competitor data search failed: ${error}`,
      'OSM': `Geographic context search failed: ${error}`,
      'PERPLEXITY': `Competitive analysis failed: ${error}`,
      'FIRECRAWL': `Industry intelligence extraction failed: ${error}`
    };
    return messages[toolName] || `Tool execution failed: ${error}`;
  }

  /**
   * Get competitive analysis specific success messages
   */
  getSuccessMessage(toolName, resultCount) {
    const messages = {
      'SERP': `Found ${resultCount} competitor facilities`,
      'OSM': `Retrieved ${resultCount} geographic features`,
      'PERPLEXITY': `Generated ${resultCount} competitive insights`,
      'FIRECRAWL': `Extracted ${resultCount} industry reports`
    };
    return messages[toolName] || `Tool executed successfully: ${resultCount} results`;
  }
}
