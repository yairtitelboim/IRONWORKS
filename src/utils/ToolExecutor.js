/**
 * ToolExecutor - Generic base class for tool execution
 * Part of Phase 3: Generic ToolExecutor implementation
 * Reusable across all question types (Power, Competitive, Regulatory, etc.)
 */

import { SerpTool } from './tools/SerpTool.mjs';
import { OsmTool, setGlobalOsmTool } from './tools/OsmTool.js';
import { PerplexityTool, setGlobalPerplexityTool } from './tools/PerplexityTool.js';
import { FirecrawlTool } from './tools/FirecrawlTool.js';

// Global cache shared across all ToolExecutor instances
// Use localStorage for true persistence across page reloads and module reloads
let globalOsmCache = new Map();

if (typeof window !== 'undefined') {
  // Try to restore from localStorage
  try {
    const stored = localStorage.getItem('osmCache');
    if (stored) {
      const parsed = JSON.parse(stored);
      globalOsmCache = new Map(parsed);
      console.log('🔧 Global OSM cache restored from localStorage, size:', globalOsmCache.size);
    } else {
      console.log('🔧 Global OSM cache initialized (no stored data)');
    }
  } catch (error) {
    console.warn('🔧 Failed to restore OSM cache from localStorage:', error.message);
    globalOsmCache = new Map();
  }
}

export class ToolExecutor {
  constructor(map, updateToolFeedback, handleMarkerClick = null) {
    this.map = map;
    this.updateToolFeedback = updateToolFeedback;
    this.handleMarkerClick = handleMarkerClick;
    this.serpCache = new Map(); // In-memory cache for SERP responses
    this.selectedMarkerId = null; // Track which marker is currently selected
    this.strategy = null; // Will be set by specific executors
    
    // Initialize tool instances with shared cache
    this.serpTool = new SerpTool();
    // console.log('🔧 Creating OsmTool with global cache, size:', globalOsmCache.size);
    // console.log('🔧 Window cache exists?', typeof window !== 'undefined' && !!window.globalOsmCache);
    // console.log('🔧 Window cache size:', typeof window !== 'undefined' && window.globalOsmCache ? window.globalOsmCache.size : 'N/A');
    this.osmTool = new OsmTool(globalOsmCache, this.updateToolFeedback); // Use global cache
    this.perplexityTool = new PerplexityTool(this.updateToolFeedback);
    this.firecrawlTool = new FirecrawlTool(this.updateToolFeedback);
    
    // Set global tool instances for development cache controls
    setGlobalPerplexityTool(this.perplexityTool);
    setGlobalOsmTool(this.osmTool);
  }

  /**
   * Set the strategy for this executor
   * Must be called by specific executors (PowerGrid, Competitive, etc.)
   */
  setStrategy(strategy) {
    this.strategy = strategy;
    this.cacheExpiration = strategy.getCacheExpiration();
  }

  /**
   * Execute a single tool based on Claude's request
   * Generic implementation that works with any strategy
   */
  async executeTool(toolAction) {
    if (!this.strategy) {
      throw new Error('No strategy set. Call setStrategy() before executing tools.');
    }

    switch(toolAction.tool) {
      case 'SERP':
        return await this.executeSERP(toolAction);
      case 'OSM':
        return await this.executeOSM(toolAction);
      case 'PERPLEXITY':
        return await this.executePerplexity(toolAction);
      case 'FIRECRAWL':
        return await this.executeFirecrawl(toolAction);
      default:
        throw new Error(`Unknown tool: ${toolAction.tool}`);
    }
  }

  /**
   * Execute multiple tools in parallel or sequence
   * Generic implementation with robust error handling
   */
  async executeMultipleTools(toolActions) {
    const results = [];
    const errors = [];
    const toolData = {}; // Store data from each tool for passing to subsequent tools
    
    // Validate input to prevent crashes
    if (!Array.isArray(toolActions) || toolActions.length === 0) {
      console.warn('⚠️ Invalid toolActions provided');
      return { results: [], errors: [], hasFailures: false };
    }
    
    // Sort tools to ensure proper execution order: OSM → SERP → PERPLEXITY
    const sortedActions = this.sortToolsByExecutionOrder(toolActions);
    
    for (const action of sortedActions) {
      try {
        // Validate action object
        if (!action || !action.tool) {
          console.warn('⚠️ Invalid tool action:', action?.tool || 'unknown');
          errors.push({ 
            tool: action?.tool || 'unknown', 
            error: 'Invalid tool action object',
            reason: action?.reason || 'unknown'
          });
          continue;
        }

        // Let individual tools handle their own detailed feedback
        // Execute tool with data from previous tools for strategic integration
        let result;
        if (action.tool === 'PERPLEXITY' && Object.keys(toolData).length > 0) {
          console.log('🔗 Passing data from previous tools to Perplexity:', Object.keys(toolData));
          result = await this.executeToolWithPreviousData(action, toolData);
        } else if (action.tool === 'SERP' && toolData.osm) {
          console.log('🗺️ Passing OSM data to SERP for geographic context:', toolData.osm?.length || 0, 'facilities');
          result = await this.executeTool(action);
        } else {
          result = await this.executeTool(action);
        }
        
        // Store tool result for potential use by subsequent tools
        // Preserve structured data from Perplexity tool
        if (action.tool === 'PERPLEXITY' && result.structuredData) {
          toolData[action.tool.toLowerCase()] = {
            ...result,
            data: result.data,
            structuredData: result.structuredData
          };
          console.log('🧠 ToolExecutor: Stored Perplexity data with structured data:', {
            hasStructuredData: !!result.structuredData,
            keys: Object.keys(result.structuredData)
          });
        } else {
          toolData[action.tool.toLowerCase()] = result.data || result;
        }
        
        results.push({ 
          tool: action.tool, 
          success: true, 
          data: result,
          reason: action.reason
        });

        // Tools handle their own completion feedback
        // Brief pause to show completion highlight animation (2 seconds for better visibility)
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`❌ ${action.tool} tool failed:`, error.message);
        errors.push({ 
          tool: action.tool, 
          error: error.message || 'Unknown error',
          reason: action.reason
        });
        
        // Continue with other tools even if one fails
        // Show error feedback for failed tool
        this.updateToolFeedback({
          isActive: true,
          tool: action.tool.toLowerCase(),
          status: `${action.tool} execution failed`,
          progress: 100,
          details: `Error: ${error.message || 'Unknown error'}. Continuing with other tools...`
        });
      }
    }
    
    // Hide tool feedback after completion (with safety check)
    // Reduced from 6000ms to 2000ms to align with LoadingCard completion phase
    setTimeout(() => {
      try {
        this.updateToolFeedback({
          isActive: false,
          tool: null,
          status: '',
          progress: 0,
          details: '',
          timestamp: null
        });
      } catch (feedbackError) {
        console.warn('⚠️ Tool feedback error:', feedbackError.message);
      }
    }, 2000); // Reduced from 6000ms to 2000ms
    
    // Save cache to localStorage after tools complete
    saveCacheToStorage();
    
    return { results, errors, hasFailures: errors.length > 0, toolData: toolData || {} };
  }

  /**
   * Execute SERP tool with strategy-specific configuration
   * Generic implementation that uses strategy for coordinates and queries
   */
  async executeSERP(toolAction) {
    if (!this.strategy) {
      throw new Error('No strategy set for SERP execution');
    }

    // Get coordinates and location config from strategy
    const coordinates = this.strategy.getCoordinates();
    const locationConfig = this.strategy.getLocationConfig ? this.strategy.getLocationConfig() : null;
    
    // Check if this is a startup ecosystem analysis
    const isStartupEcosystem = toolAction.query && 
      (toolAction.query.toLowerCase().includes('startup') || 
       toolAction.query.toLowerCase().includes('ecosystem') ||
       toolAction.query.toLowerCase().includes('companies'));
    
    try {
      let result;
      
      if (isStartupEcosystem) {
        // Use JSON-based startup ecosystem analysis
        console.log('🚀 Using JSON-based startup ecosystem analysis');
        result = await this.serpTool.executeStartupEcosystemAnalysis(locationConfig, this.map, this.updateToolFeedback);
      } else {
        // Use traditional SERP/Google Places approach
        const queries = toolAction.queries || this.strategy.getDefaultQueries();
        result = await this.serpTool.execute(queries, coordinates, this.map, this.handleMarkerClick, locationConfig);
      }
      
      return {
        success: true,
        tool: 'SERP',
        queries: isStartupEcosystem ? ['startup ecosystem analysis'] : (toolAction.queries || this.strategy.getDefaultQueries()),
        coordinates,
        data: result,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('❌ SERP execution failed:', error.message);
      throw new Error(this.strategy.getErrorMessage('SERP', error.message));
    }
  }


  /**
   * Execute OSM tool with strategy-specific configuration
   * Provides geographic context for the analysis area
   */
  async executeOSM(toolAction, previousToolData = null) {
    if (!this.strategy) {
      throw new Error('No strategy set for OSM execution');
    }

    // Get coordinates and location config from strategy
    const coordinates = this.strategy.getCoordinates();
    const locationConfig = this.strategy.getLocationConfig ? this.strategy.getLocationConfig() : null;
    
    // Extract SERP data for geographic context
    const serpData = previousToolData?.serp || null;
    
    try {
      // Delegate to OsmTool with SERP data for strategic context
      const result = await this.osmTool.execute(
        toolAction.queries, 
        coordinates, 
        this.map, 
        locationConfig,
        serpData
      );
      
      return result;
    } catch (error) {
      console.warn('⚠️ OSM geographic context analysis failed:', error.message);
      // Graceful fallback - don't break the system
      return {
        success: false,
        tool: 'OSM',
        error: this.strategy.getErrorMessage('OSM', error.message),
        fallback: true,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Execute Perplexity tool with strategy-specific configuration
   * Generic implementation that uses strategy for coordinates
   */
  async executePerplexity(toolAction, previousResults = null) {
    if (!this.strategy) {
      throw new Error('No strategy set for Perplexity execution');
    }

    // Get coordinates and location config from strategy
    const coordinates = this.strategy.getCoordinates();
    const locationConfig = this.strategy.getLocationConfig ? this.strategy.getLocationConfig() : null;
    
    try {
      // Delegate to PerplexityTool class with previous results and location config
      const result = await this.perplexityTool.execute(toolAction.queries, coordinates, previousResults, locationConfig);
      
      // Ensure structured data is included in the return
      console.log('🧠 ToolExecutor: Perplexity result received:', {
        hasStructuredData: !!result.structuredData,
        dataKeys: result.structuredData ? Object.keys(result.structuredData) : [],
        success: result.success
      });
      
      return result;
    } catch (error) {
      console.warn('⚠️ Perplexity execution failed, using fallback:', error.message);
      // Graceful fallback - don't break the system
      return {
        success: false,
        tool: 'PERPLEXITY',
        error: this.strategy.getErrorMessage('PERPLEXITY', error.message),
        fallback: true,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Execute Firecrawl tool with strategy-specific configuration
   * Generic implementation that uses strategy for coordinates
   */
  async executeFirecrawl(toolAction) {
    if (!this.strategy) {
      throw new Error('No strategy set for Firecrawl execution');
    }

    // Get coordinates from strategy
    const coordinates = this.strategy.getCoordinates();
    
    try {
      // Delegate to FirecrawlTool class
      const result = await this.firecrawlTool.execute(toolAction.queries, coordinates);
      
      return result;
    } catch (error) {
      console.warn('⚠️ Firecrawl execution failed, using fallback:', error.message);
      // Graceful fallback - don't break the system
      return {
        success: false,
        tool: 'FIRECRAWL',
        error: this.strategy.getErrorMessage('FIRECRAWL', error.message),
        fallback: true,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Clear all SERP cache
   * Generic implementation that delegates to SerpTool
   */
  clearSerpCache() {
    this.serpTool.clearCache();
  }

  /**
   * Get cache statistics
   * Generic implementation that delegates to SerpTool
   */
  getCacheStats() {
    return this.serpTool.getCacheStats();
  }

  /**
   * Clear existing SERP data from map
   * Generic implementation for map cleanup
   */
  clearSerpData() {
    if (this.map?.current) {
      // Remove SERP layers and sources
      const serpLayers = ['serp-startup-ecosystem-markers', 'serp-search-radius', 'serp-search-radius-fill'];
      const serpSources = ['serp-startup-ecosystem', 'serp-search-radius'];
      
      serpLayers.forEach(layerId => {
        if (this.map.current.getLayer(layerId)) {
          this.map.current.removeLayer(layerId);
        }
      });
      
      serpSources.forEach(sourceId => {
        if (this.map.current.getSource(sourceId)) {
          this.map.current.removeSource(sourceId);
        }
      });
    }
  }
}

/**
 * Factory function to create ToolExecutor instance
 */
export const createToolExecutor = (map, updateToolFeedback, handleMarkerClick = null) => {
  return new ToolExecutor(map, updateToolFeedback, handleMarkerClick);
};

/**
 * Global cache management functions for external access
 */
let globalToolExecutorInstance = null;

export const setGlobalToolExecutor = (instance) => {
  globalToolExecutorInstance = instance;
};

export const clearGlobalSerpCache = () => {
  if (globalToolExecutorInstance) {
    globalToolExecutorInstance.clearSerpCache();
    return true;
  }
  return false;
};

export const getGlobalCacheStats = () => {
  if (globalToolExecutorInstance) {
    return globalToolExecutorInstance.getCacheStats();
  }
  return { size: 0, expirationMinutes: 30, entries: [] };
};

// Function to save cache to localStorage
const saveCacheToStorage = () => {
  if (typeof window !== 'undefined') {
    try {
      const serialized = JSON.stringify(Array.from(globalOsmCache.entries()));
      localStorage.setItem('osmCache', serialized);
      console.log('💾 OSM cache saved to localStorage');
    } catch (error) {
      console.warn('💾 Failed to save OSM cache to localStorage:', error.message);
    }
  }
};

export const clearGlobalOsmCache = () => {
  globalOsmCache.clear();
  if (typeof window !== 'undefined') {
    localStorage.removeItem('osmCache');
  }
  console.log('🗑️ Global OSM cache cleared');
  return true;
};

export const getGlobalOsmCacheStats = () => {
  return {
    size: globalOsmCache.size,
    entries: Array.from(globalOsmCache.entries()).map(([key, entry]) => ({
      key,
      age: Math.round((Date.now() - entry.timestamp) / 1000 / 60), // minutes
      valid: entry && entry.timestamp && (Date.now() - entry.timestamp) < (24 * 60 * 60 * 1000)
    }))
  };
};

// Add global debug functions to window object
if (typeof window !== 'undefined') {
  window.debugGlobalOsmCache = () => {
    const stats = getGlobalOsmCacheStats();
    console.log('🔍 Global OSM Cache Stats:', stats);
    return stats;
  };
  
  window.clearGlobalOsmCache = clearGlobalOsmCache;
  window.saveOsmCacheToStorage = saveCacheToStorage;
  
  // Direct access to cache for debugging
  window.getOsmCache = () => globalOsmCache;
}

// Enhanced methods for Perplexity integration (added to ToolExecutor class)
ToolExecutor.prototype.sortToolsByExecutionOrder = function(toolActions) {
  const executionOrder = ['OSM', 'SERP', 'PERPLEXITY', 'FIRECRAWL'];
  
  return toolActions.sort((a, b) => {
    const aIndex = executionOrder.indexOf(a.tool);
    const bIndex = executionOrder.indexOf(b.tool);
    
    // If tool not in predefined order, put it at the end
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    
    return aIndex - bIndex;
  });
};

ToolExecutor.prototype.executeToolWithPreviousData = async function(toolAction, previousToolData) {
  if (!this.strategy) {
    throw new Error('No strategy set for tool execution');
  }

  // Get coordinates and location config from strategy
  const coordinates = this.strategy.getCoordinates();
  const locationConfig = this.strategy.getLocationConfig ? this.strategy.getLocationConfig() : null;
  
  // Prepare previous results in the format expected by PerplexityTool
  const previousResults = {
    serpData: previousToolData.serp,
    osmData: previousToolData.osm
  };
  
  try {
    // Delegate to PerplexityTool with previous results and location config
    const result = await this.perplexityTool.execute(toolAction.queries, coordinates, previousResults, locationConfig);
    
    return result;
  } catch (error) {
    console.error('❌ Perplexity execution with previous data failed:', error.message);
    throw new Error(this.strategy.getErrorMessage('PERPLEXITY', error.message));
  }
};
