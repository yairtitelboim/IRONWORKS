/**
 * Cache Debugger - Development tool for cache management
 * Provides browser console access to cache statistics and controls
 */

import { 
  getCacheStats, 
  clearAllCaches, 
  clearLocationCache, 
  healthCheck,
  warmCache 
} from './HolisticCacheManager.js';

class CacheDebugger {
  constructor() {
    this.isEnabled = process.env.NODE_ENV === 'development';
    this.setupGlobalControls();
  }

  setupGlobalControls() {
    if (typeof window !== 'undefined' && this.isEnabled) {
      // Global cache controls
      window.cacheDebugger = {
        stats: () => this.showStats(),
        clear: () => this.clearAll(),
        clearLocation: (location) => this.clearLocation(location),
        health: () => this.showHealth(),
        warm: () => this.warm(),
        help: () => this.showHelp()
      };
    }
  }

  showStats() {
    const stats = getCacheStats();
    
    console.log('📊 CACHE STATISTICS');
    console.log('==================');
    console.log(`Total Entries: ${stats.totalEntries}`);
    console.log(`Current Location: ${stats.currentLocation}`);
    console.log(`Location History: ${stats.locationHistory.join(', ')}`);
    console.log('');
    
    Object.entries(stats.caches).forEach(([cacheName, cacheStats]) => {
      const utilization = (cacheStats.size / cacheStats.maxSize * 100).toFixed(1);
      console.log(`${cacheName.toUpperCase()} CACHE:`);
      console.log(`  Size: ${cacheStats.size}/${cacheStats.maxSize} (${utilization}% full)`);
      console.log(`  Entries: ${cacheStats.entries.length}`);
      
      if (cacheStats.entries.length > 0) {
        console.log('  Recent entries:');
        cacheStats.entries.slice(0, 3).forEach((entry, index) => {
          console.log(`    ${index + 1}. Age: ${entry.ageHours}h, Location: ${entry.location}, Key: ${entry.key}`);
        });
      }
      console.log('');
    });
    
    return stats;
  }

  clearAll() {
    const clearedCount = clearAllCaches();
    console.log(`🗑️ Cleared ${clearedCount} cache entries`);
    return clearedCount;
  }

  clearLocation(location) {
    if (!location) {
      console.error('❌ Please specify a location: cacheDebugger.clearLocation("boston")');
      return;
    }
    
    const clearedCount = clearLocationCache(location);
    console.log(`🗑️ Cleared ${clearedCount} entries for location: ${location}`);
    return clearedCount;
  }

  showHealth() {
    const health = healthCheck();
    
    console.log('🏥 CACHE HEALTH CHECK');
    console.log('====================');
    console.log(`Status: ${health.status.toUpperCase()}`);
    
    if (health.issues.length > 0) {
      console.log('Issues:');
      health.issues.forEach(issue => console.log(`  ⚠️ ${issue}`));
    } else {
      console.log('✅ No issues found');
    }
    
    if (health.recommendations.length > 0) {
      console.log('Recommendations:');
      health.recommendations.forEach(rec => console.log(`  💡 ${rec}`));
    }
    
    return health;
  }

  async warm() {
    console.log('🔥 Starting cache warming...');
    
    const commonLocations = ['default', 'boston', 'cambridge'];
    const commonQuestions = ['startup_ecosystem_analysis'];
    
    try {
      const result = await warmCache(commonLocations, commonQuestions);
      console.log('✅ Cache warming completed:', result);
      return result;
    } catch (error) {
      console.error('❌ Cache warming failed:', error);
      return null;
    }
  }

  showHelp() {
    console.log('🔧 CACHE DEBUGGER HELP');
    console.log('======================');
    console.log('');
    console.log('Available Commands:');
    console.log('  cacheDebugger.stats()           - Show detailed cache statistics');
    console.log('  cacheDebugger.clear()           - Clear all caches (same as close button)');
    console.log('  cacheDebugger.clearLocation("boston") - Clear specific location cache');
    console.log('  cacheDebugger.health()          - Run cache health check');
    console.log('  cacheDebugger.warm()            - Warm cache with common queries');
    console.log('  cacheDebugger.help()            - Show this help');
    console.log('');
    console.log('Cache Hierarchy:');
    console.log('  1. Workflow Cache (24h) - Complete ecosystem analysis workflows');
    console.log('  2. Tool Cache (12h)     - Individual tool results (SERP, OSM, Perplexity)');
    console.log('  3. Claude Cache (12h)   - Claude API responses');
    console.log('  4. Structured Cache (1h) - Parsed table data');
    console.log('');
    console.log('Performance Impact:');
    console.log('  • Workflow Cache Hit: ~200-500ms (90%+ faster)');
    console.log('  • Tool Cache Hit: ~1-2 seconds (50-70% faster)');
    console.log('  • Claude Cache Hit: ~500ms-1s (60-80% faster)');
    console.log('  • No Cache: ~3-5 seconds (baseline)');
  }
}

// Initialize cache debugger
const cacheDebugger = new CacheDebugger();

export default cacheDebugger;
