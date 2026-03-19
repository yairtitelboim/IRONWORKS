/**
 * Response Cache Utility
 * Provides in-memory caching for Claude API responses to reduce API costs
 */

class ResponseCache {
  constructor() {
    this.cache = new Map();
    this.cacheExpiration = 60 * 60 * 1000; // 1 hour in milliseconds
    this.maxCacheSize = 100; // Maximum number of cached responses
    
    // Perplexity-specific cache with longer expiration for infrastructure data
    this.perplexityCache = new Map();
    this.perplexityCacheExpiration = 24 * 60 * 60 * 1000; // 24 hours for infrastructure data
    this.maxPerplexityCacheSize = 50; // Maximum number of cached Perplexity responses
  }

  /**
   * Generate a cache key from the request data
   * @param {Object} requestData - The request data to Claude API
   * @returns {string} - Cache key
   */
  generateCacheKey(requestData) {
    // Create a deterministic key from the request
    const keyData = {
      model: requestData.model,
      system: requestData.system,
      messages: requestData.messages,
      max_tokens: requestData.max_tokens
    };
    
    // Sort messages to ensure consistent ordering
    if (keyData.messages) {
      keyData.messages = keyData.messages.sort((a, b) => {
        if (a.role !== b.role) return a.role.localeCompare(b.role);
        return a.content.localeCompare(b.content);
      });
    }
    
    return JSON.stringify(keyData);
  }

  /**
   * Check if a cache entry is still valid
   * @param {Object} cacheEntry - The cached entry
   * @returns {boolean} - Whether the entry is valid
   */
  isCacheValid(cacheEntry) {
    if (!cacheEntry || !cacheEntry.timestamp) return false;
    return Date.now() - cacheEntry.timestamp < this.cacheExpiration;
  }

  /**
   * Get a cached response if it exists and is valid
   * @param {Object} requestData - The request data
   * @returns {Object|null} - Cached response or null
   */
  getCachedResponse(requestData) {
    const key = this.generateCacheKey(requestData);
    const cacheEntry = this.cache.get(key);
    
    if (this.isCacheValid(cacheEntry)) {
      console.log('🎯 ResponseCache: Using cached response for key:', key.substring(0, 50) + '...');
      return cacheEntry.response;
    }
    
    if (cacheEntry) {
      console.log('⏰ ResponseCache: Cache expired for key:', key.substring(0, 50) + '...');
      this.cache.delete(key);
    }
    
    return null;
  }

  /**
   * Store a response in the cache
   * @param {Object} requestData - The request data
   * @param {Object} response - The response to cache
   */
  setCachedResponse(requestData, response) {
    const key = this.generateCacheKey(requestData);
    
    // Check cache size and remove oldest entries if needed
    if (this.cache.size >= this.maxCacheSize) {
      this.cleanOldestEntries();
    }
    
    const cacheEntry = {
      response: response,
      timestamp: Date.now(),
      key: key
    };
    
    this.cache.set(key, cacheEntry);
    console.log('💾 ResponseCache: Cached response for key:', key.substring(0, 50) + '...');
  }

  /**
   * Remove the oldest cache entries when cache is full
   */
  cleanOldestEntries() {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest 20% of entries
    const toRemove = Math.ceil(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
    
    console.log(`🧹 ResponseCache: Cleaned ${toRemove} oldest entries`);
  }

  /**
   * Clean expired cache entries
   */
  cleanExpiredCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= this.cacheExpiration) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 ResponseCache: Cleaned ${cleaned} expired entries`);
    }
  }

  /**
   * Clear all cache entries
   */
  clearCache() {
    this.cache.clear();
    console.log('🗑️ ResponseCache: Cleared Claude response cache (Perplexity cache preserved)');
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  getCacheStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;
    
    for (const entry of this.cache.values()) {
      if (now - entry.timestamp < this.cacheExpiration) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }
    
    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      maxSize: this.maxCacheSize,
      expirationTime: this.cacheExpiration
    };
  }

  /**
   * Get cache hit rate (requires manual tracking)
   * @param {number} hits - Number of cache hits
   * @param {number} misses - Number of cache misses
   * @returns {number} - Hit rate percentage
   */
  getHitRate(hits, misses) {
    const total = hits + misses;
    return total > 0 ? (hits / total) * 100 : 0;
  }

  /**
   * Generate a cache key for Perplexity requests
   * @param {Object} coordinates - Site coordinates
   * @param {Object} infrastructureSummary - Infrastructure data
   * @returns {string} - Cache key
   */
  generatePerplexityCacheKey(coordinates, infrastructureSummary) {
    const keyData = {
      lat: Math.round(coordinates.lat * 1000) / 1000, // Round to 3 decimal places
      lng: Math.round(coordinates.lng * 1000) / 1000,
      powerInfrastructure: infrastructureSummary.powerInfrastructure?.length || 0,
      geographicFeatures: infrastructureSummary.geographicFeatures?.length || 0,
      timestamp: Math.floor(Date.now() / (24 * 60 * 60 * 1000)) // Daily cache key
    };
    
    return `perplexity_${JSON.stringify(keyData)}`;
  }

  /**
   * Check if a Perplexity cache entry is still valid
   * @param {Object} cacheEntry - The cached entry
   * @returns {boolean} - Whether the entry is valid
   */
  isPerplexityCacheValid(cacheEntry) {
    if (!cacheEntry || !cacheEntry.timestamp) return false;
    return Date.now() - cacheEntry.timestamp < this.perplexityCacheExpiration;
  }

  /**
   * Get a cached Perplexity response if it exists and is valid
   * @param {Object} coordinates - Site coordinates
   * @param {Object} infrastructureSummary - Infrastructure data
   * @returns {Object|null} - Cached response or null
   */
  getCachedPerplexityResponse(coordinates, infrastructureSummary) {
    const key = this.generatePerplexityCacheKey(coordinates, infrastructureSummary);
    const cacheEntry = this.perplexityCache.get(key);
    
    if (this.isPerplexityCacheValid(cacheEntry)) {
      const cacheAge = Date.now() - cacheEntry.timestamp;
      const cacheAgeHours = Math.round(cacheAge / (60 * 60 * 1000) * 10) / 10;
      
      console.log('🎯 PerplexityCache: Cache HIT for coordinates:', coordinates);
      console.log(`   ⚡ Performance: Saved API call, using ${cacheAgeHours}h old cache`);
      console.log(`   📊 Quality: ${cacheEntry.response.qualityScore || 'N/A'}/100, ${cacheEntry.response.nodeCount || 0} nodes`);
      
      return cacheEntry.response;
    }
    
    if (cacheEntry) {
      const cacheAge = Date.now() - cacheEntry.timestamp;
      const cacheAgeHours = Math.round(cacheAge / (60 * 60 * 1000) * 10) / 10;
      console.log('⏰ PerplexityCache: Cache EXPIRED for coordinates:', coordinates);
      console.log(`   🕐 Expired after ${cacheAgeHours}h (limit: 24h)`);
      this.perplexityCache.delete(key);
    } else {
      console.log('❌ PerplexityCache: Cache MISS for coordinates:', coordinates);
    }
    
    return null;
  }

  /**
   * Store a Perplexity response in the cache
   * @param {Object} coordinates - Site coordinates
   * @param {Object} infrastructureSummary - Infrastructure data
   * @param {Object} response - The response to cache
   */
  setCachedPerplexityResponse(coordinates, infrastructureSummary, response) {
    const key = this.generatePerplexityCacheKey(coordinates, infrastructureSummary);
    
    // Check cache size limit
    if (this.perplexityCache.size >= this.maxPerplexityCacheSize) {
      // Remove oldest entry
      const oldestKey = this.perplexityCache.keys().next().value;
      this.perplexityCache.delete(oldestKey);
    }
    
    this.perplexityCache.set(key, {
      response: response,
      timestamp: Date.now(),
      coordinates: coordinates,
      infrastructureCount: infrastructureSummary.powerInfrastructure?.length || 0
    });
    
    console.log('💾 PerplexityCache: Cached response for coordinates:', coordinates);
  }

  /**
   * Clear Perplexity cache
   */
  clearPerplexityCache() {
    this.perplexityCache.clear();
    console.log('🗑️ PerplexityCache: Cleared all cached responses');
  }

  /**
   * Get Perplexity cache statistics
   * @returns {Object} - Cache statistics
   */
  getPerplexityCacheStats() {
    const entries = Array.from(this.perplexityCache.entries()).map(([key, value]) => {
      const cacheAge = Date.now() - value.timestamp;
      const cacheAgeHours = Math.round(cacheAge / (60 * 60 * 1000) * 10) / 10;
      
      return {
        key: key.substring(0, 50) + '...',
        timestamp: new Date(value.timestamp).toISOString(),
        ageHours: cacheAgeHours,
        coordinates: value.coordinates,
        infrastructureCount: value.infrastructureCount,
        qualityScore: value.response?.qualityScore || 'N/A'
      };
    });

    return {
      size: this.perplexityCache.size,
      maxSize: this.maxPerplexityCacheSize,
      expirationHours: this.perplexityCacheExpiration / (60 * 60 * 1000),
      entries
    };
  }

  /**
   * Test cache functionality - for debugging
   */
  testPerplexityCache() {
    const stats = this.getPerplexityCacheStats();
    console.log('🧪 PERPLEXITY CACHE TEST:');
    console.log(`   📊 Cache size: ${stats.size}/${stats.maxSize}`);
    console.log(`   ⏰ Expiration: ${stats.expirationHours} hours`);
    
    if (stats.entries.length > 0) {
      console.log('   📋 Cache entries:');
      stats.entries.forEach((entry, index) => {
        console.log(`     ${index + 1}. Age: ${entry.ageHours}h, Quality: ${entry.qualityScore}/100, Coords: ${JSON.stringify(entry.coordinates)}`);
      });
    } else {
      console.log('   🔍 No cache entries found');
    }
    
    return stats;
  }

  /**
   * Clean expired Perplexity cache entries
   */
  cleanExpiredPerplexityCache() {
    let cleaned = 0;
    
    for (const [key, entry] of this.perplexityCache.entries()) {
      if (!this.isPerplexityCacheValid(entry)) {
        this.perplexityCache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 PerplexityCache: Cleaned ${cleaned} expired entries`);
    }
    
    return cleaned;
  }
}

// Create a singleton instance
const responseCache = new ResponseCache();

// Global functions for external access
export const getCachedResponse = (requestData) => responseCache.getCachedResponse(requestData);
export const setCachedResponse = (requestData, response) => responseCache.setCachedResponse(requestData, response);
export const clearResponseCache = () => responseCache.clearCache();
export const getResponseCacheStats = () => responseCache.getCacheStats();
export const cleanExpiredResponseCache = () => responseCache.cleanExpiredCache();

// Perplexity-specific cache functions
export const getCachedPerplexityResponse = (coordinates, infrastructureSummary) => 
  responseCache.getCachedPerplexityResponse(coordinates, infrastructureSummary);
export const setCachedPerplexityResponse = (coordinates, infrastructureSummary, response) => 
  responseCache.setCachedPerplexityResponse(coordinates, infrastructureSummary, response);
export const clearPerplexityCache = () => responseCache.clearPerplexityCache();
export const getPerplexityCacheStats = () => responseCache.getPerplexityCacheStats();
export const testPerplexityCache = () => responseCache.testPerplexityCache();
export const cleanExpiredPerplexityCache = () => responseCache.cleanExpiredPerplexityCache();

export default responseCache;
