/**
 * Holistic Cache Manager
 * Unified caching system for the entire startup ecosystem analysis workflow
 * Provides hierarchical caching with location-aware invalidation
 */

class HolisticCacheManager {
  constructor() {
    // Cache hierarchy with different expiration times
    this.caches = {
      // Complete workflow cache - highest level (24-48 hours)
      workflow: new Map(),
      workflowExpiration: 24 * 60 * 60 * 1000, // 24 hours
      
      // Individual tool caches - medium level (12-24 hours)
      tools: new Map(),
      toolsExpiration: 12 * 60 * 60 * 1000, // 12 hours
      
      // Claude response cache - medium level (12 hours)
      claude: new Map(),
      claudeExpiration: 12 * 60 * 60 * 1000, // 12 hours
      
      // Structured data cache - short level (1 hour)
      structured: new Map(),
      structuredExpiration: 60 * 60 * 1000, // 1 hour
    };
    
    // Cache size limits
    this.maxCacheSizes = {
      workflow: 20,    // 20 complete workflows
      tools: 100,      // 100 tool results
      claude: 50,      // 50 Claude responses
      structured: 200  // 200 structured data entries
    };
    
    // Location tracking for cache invalidation
    this.currentLocation = 'default';
    this.locationHistory = new Set();
  }

  /**
   * Generate cache key with location awareness
   */
  generateCacheKey(type, baseKey, locationKey = 'default', coordinates = null) {
    const coordHash = coordinates ? 
      `${Math.round(coordinates.lat * 1000)}_${Math.round(coordinates.lng * 1000)}` : 
      'no_coords';
    
    return `${type}_${baseKey}_${locationKey}_${coordHash}`;
  }

  /**
   * Check if cache entry is valid
   */
  isCacheValid(cacheEntry, expiration) {
    if (!cacheEntry || !cacheEntry.timestamp) return false;
    return Date.now() - cacheEntry.timestamp < expiration;
  }

  /**
   * Get from cache with automatic cleanup
   */
  getFromCache(cacheType, key) {
    const cache = this.caches[cacheType];
    const expiration = this.caches[`${cacheType}Expiration`];
    
    if (!cache || !expiration) return null;
    
    const entry = cache.get(key);
    
    if (this.isCacheValid(entry, expiration)) {
      console.log(`🎯 HolisticCache: ${cacheType.toUpperCase()} HIT for key:`, key.substring(0, 50) + '...');
      return entry.data;
    }
    
    if (entry) {
      console.log(`⏰ HolisticCache: ${cacheType.toUpperCase()} EXPIRED for key:`, key.substring(0, 50) + '...');
      cache.delete(key);
    }
    
    return null;
  }

  /**
   * Set cache with size management
   */
  setCache(cacheType, key, data, metadata = {}) {
    const cache = this.caches[cacheType];
    const maxSize = this.maxCacheSizes[cacheType];
    
    if (!cache || !maxSize) return false;
    
    // Check size limit and clean if needed
    if (cache.size >= maxSize) {
      this.cleanOldestEntries(cacheType, Math.floor(maxSize * 0.2)); // Remove 20% of oldest entries
    }
    
    cache.set(key, {
      data,
      timestamp: Date.now(),
      location: this.currentLocation,
      metadata
    });
    
    console.log(`💾 HolisticCache: Cached ${cacheType.toUpperCase()} for key:`, key.substring(0, 50) + '...');
    return true;
  }

  /**
   * Clean oldest cache entries
   */
  cleanOldestEntries(cacheType, count) {
    const cache = this.caches[cacheType];
    if (!cache) return 0;
    
    const entries = Array.from(cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, count);
    
    entries.forEach(([key]) => cache.delete(key));
    
    console.log(`🧹 HolisticCache: Cleaned ${entries.length} old ${cacheType} entries`);
    return entries.length;
  }

  /**
   * WORKFLOW CACHE - Complete ecosystem analysis workflow
   */
  getWorkflowCache(questionId, locationKey, coordinates) {
    const key = this.generateCacheKey('workflow', questionId, locationKey, coordinates);
    return this.getFromCache('workflow', key);
  }

  setWorkflowCache(questionId, locationKey, coordinates, workflowData) {
    const key = this.generateCacheKey('workflow', questionId, locationKey, coordinates);
    return this.setCache('workflow', key, workflowData, {
      questionId,
      locationKey,
      coordinates,
      type: 'complete_workflow'
    });
  }

  /**
   * CLAUDE CACHE - Claude responses with enhanced caching
   */
  getClaudeCache(questionId, locationKey, coordinates, requestHash) {
    const key = this.generateCacheKey('claude', `${questionId}_${requestHash}`, locationKey, coordinates);
    return this.getFromCache('claude', key);
  }

  setClaudeCache(questionId, locationKey, coordinates, requestHash, claudeResponse) {
    const key = this.generateCacheKey('claude', `${questionId}_${requestHash}`, locationKey, coordinates);
    return this.setCache('claude', key, claudeResponse, {
      questionId,
      locationKey,
      coordinates,
      type: 'claude_response'
    });
  }

  /**
   * TOOL CACHE - Individual tool results
   */
  getToolCache(toolName, locationKey, coordinates, queryHash) {
    const key = this.generateCacheKey('tools', `${toolName}_${queryHash}`, locationKey, coordinates);
    return this.getFromCache('tools', key);
  }

  setToolCache(toolName, locationKey, coordinates, queryHash, toolResult) {
    const key = this.generateCacheKey('tools', `${toolName}_${queryHash}`, locationKey, coordinates);
    return this.setCache('tools', key, toolResult, {
      toolName,
      locationKey,
      coordinates,
      type: 'tool_result'
    });
  }

  /**
   * STRUCTURED DATA CACHE - Parsed table data
   */
  getStructuredCache(questionId, locationKey, coordinates) {
    const key = this.generateCacheKey('structured', questionId, locationKey, coordinates);
    return this.getFromCache('structured', key);
  }

  setStructuredCache(questionId, locationKey, coordinates, structuredData) {
    const key = this.generateCacheKey('structured', questionId, locationKey, coordinates);
    return this.setCache('structured', key, structuredData, {
      questionId,
      locationKey,
      coordinates,
      type: 'structured_data'
    });
  }

  /**
   * LOCATION-AWARE CACHE MANAGEMENT
   */
  setCurrentLocation(locationKey) {
    if (this.currentLocation !== locationKey) {
      console.log(`📍 HolisticCache: Location changed from ${this.currentLocation} to ${locationKey}`);
      this.currentLocation = locationKey;
      this.locationHistory.add(locationKey);
    }
  }

  /**
   * COMPLETE CACHE CLEAR - Used by close button
   */
  clearAllCaches() {
    let totalEntries = 0;

    Object.values(this.caches).forEach(cache => {
      if (cache && typeof cache.size !== 'undefined') {
        totalEntries += cache.size;
      }
    });

    Object.values(this.caches).forEach((cache, cacheName) => {
      if (!cache) return;

      if (typeof cache.clear === 'function') {
        cache.clear();
      } else if (typeof cache.delete === 'function') {
        Array.from(cache.keys()).forEach(key => cache.delete(key));
      } else {
        this.caches[cacheName] = new Map();
      }
    });

    this.locationHistory.clear();
    this.currentLocation = 'default';

    console.log(`🗑️ HolisticCache: Cleared ALL caches (${totalEntries} entries)`);

    // Emit cache clear event for UI updates
    if (typeof window !== 'undefined' && window.mapEventBus) {
      window.mapEventBus.emit('cache:cleared', { totalEntries });
    }

    return totalEntries;
  }

  /**
   * LOCATION-SPECIFIC CACHE CLEAR
   */
  clearLocationCache(locationKey) {
    let clearedCount = 0;
    
    Object.entries(this.caches).forEach(([cacheName, cache]) => {
      if (cacheName.endsWith('Expiration')) return;
      
      const keysToDelete = [];
      for (const [key, entry] of cache.entries()) {
        if (entry.location === locationKey) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => {
        cache.delete(key);
        clearedCount++;
      });
    });
    
    console.log(`🗑️ HolisticCache: Cleared ${clearedCount} entries for location: ${locationKey}`);
    return clearedCount;
  }

  /**
   * CACHE STATISTICS
   */
  getCacheStats() {
    const stats = {};
    
    Object.entries(this.caches).forEach(([cacheName, cache]) => {
      if (cacheName.endsWith('Expiration')) return;
      
      const entries = Array.from(cache.entries()).map(([key, entry]) => ({
        key: key.substring(0, 50) + '...',
        timestamp: entry.timestamp,
        age: Date.now() - entry.timestamp,
        ageHours: Math.round((Date.now() - entry.timestamp) / (60 * 60 * 1000) * 10) / 10,
        location: entry.location,
        metadata: entry.metadata
      }));
      
      stats[cacheName] = {
        size: cache.size,
        maxSize: this.maxCacheSizes[cacheName],
        entries: entries.sort((a, b) => b.timestamp - a.timestamp)
      };
    });
    
    return {
      totalEntries: Object.values(this.caches).reduce((sum, cache) => sum + cache.size, 0),
      currentLocation: this.currentLocation,
      locationHistory: Array.from(this.locationHistory),
      caches: stats
    };
  }

  /**
   * CACHE WARMING - Pre-populate common queries
   */
  async warmCache(commonLocations = ['default'], commonQuestions = ['startup_ecosystem_analysis']) {
    console.log('🔥 HolisticCache: Starting cache warming...');
    
    // This would be implemented to pre-populate caches
    // For now, just log the warming process
    console.log(`🔥 Warming cache for ${commonLocations.length} locations and ${commonQuestions.length} questions`);
    
    return {
      warmed: true,
      locations: commonLocations,
      questions: commonQuestions
    };
  }

  /**
   * CACHE HEALTH CHECK
   */
  healthCheck() {
    const stats = this.getCacheStats();
    const health = {
      status: 'healthy',
      issues: [],
      recommendations: []
    };
    
    // Check cache sizes
    Object.entries(stats.caches).forEach(([cacheName, cacheStats]) => {
      const utilization = (cacheStats.size / cacheStats.maxSize) * 100;
      
      if (utilization > 90) {
        health.issues.push(`${cacheName} cache is ${utilization.toFixed(1)}% full`);
        health.recommendations.push(`Consider cleaning ${cacheName} cache`);
      }
    });
    
    // Check for expired entries
    const now = Date.now();
    Object.entries(this.caches).forEach(([cacheName, cache]) => {
      if (cacheName.endsWith('Expiration')) return;
      
      const expiration = this.caches[`${cacheName}Expiration`];
      let expiredCount = 0;
      
      for (const [key, entry] of cache.entries()) {
        if (!this.isCacheValid(entry, expiration)) {
          expiredCount++;
        }
      }
      
      if (expiredCount > 0) {
        health.issues.push(`${cacheName} has ${expiredCount} expired entries`);
        health.recommendations.push(`Clean expired entries from ${cacheName}`);
      }
    });
    
    if (health.issues.length > 0) {
      health.status = 'needs_attention';
    }
    
    return health;
  }
}

// Create singleton instance
const holisticCacheManager = new HolisticCacheManager();

// Export functions for external access
export const getWorkflowCache = (questionId, locationKey, coordinates) => 
  holisticCacheManager.getWorkflowCache(questionId, locationKey, coordinates);

export const setWorkflowCache = (questionId, locationKey, coordinates, workflowData) => 
  holisticCacheManager.setWorkflowCache(questionId, locationKey, coordinates, workflowData);

export const getClaudeCache = (questionId, locationKey, coordinates, requestHash) => 
  holisticCacheManager.getClaudeCache(questionId, locationKey, coordinates, requestHash);

export const setClaudeCache = (questionId, locationKey, coordinates, requestHash, claudeResponse) => 
  holisticCacheManager.setClaudeCache(questionId, locationKey, coordinates, requestHash, claudeResponse);

export const getToolCache = (toolName, locationKey, coordinates, queryHash) => 
  holisticCacheManager.getToolCache(toolName, locationKey, coordinates, queryHash);

export const setToolCache = (toolName, locationKey, coordinates, queryHash, toolResult) => 
  holisticCacheManager.setToolCache(toolName, locationKey, coordinates, queryHash, toolResult);

export const getStructuredCache = (questionId, locationKey, coordinates) => 
  holisticCacheManager.getStructuredCache(questionId, locationKey, coordinates);

export const setStructuredCache = (questionId, locationKey, coordinates, structuredData) => 
  holisticCacheManager.setStructuredCache(questionId, locationKey, coordinates, structuredData);

export const clearAllCaches = () => holisticCacheManager.clearAllCaches();
export const clearLocationCache = (locationKey) => holisticCacheManager.clearLocationCache(locationKey);
export const getCacheStats = () => holisticCacheManager.getCacheStats();
export const setCurrentLocation = (locationKey) => holisticCacheManager.setCurrentLocation(locationKey);
export const warmCache = (commonLocations, commonQuestions) => holisticCacheManager.warmCache(commonLocations, commonQuestions);
export const healthCheck = () => holisticCacheManager.healthCheck();

// Global cache controls for development
if (typeof window !== 'undefined') {
  window.holisticCache = {
    clearAll: clearAllCaches,
    clearLocation: clearLocationCache,
    stats: getCacheStats,
    health: healthCheck,
    warm: warmCache
  };
  
  console.log('🔧 HolisticCache: Global controls available at window.holisticCache');
}

export default holisticCacheManager;
