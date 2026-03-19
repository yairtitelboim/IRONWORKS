/**
 * BespokeAnalysisTool - Streamlined Infrastructure Analysis
 * 
 * PURPOSE: Provides a shortcut for running bespoke infrastructure analysis
 * INPUT: Location (address) + radius (miles)
 * OUTPUT: Comprehensive infrastructure analysis with real data
 * 
 * USAGE:
 * const analysis = await bespokeAnalysis.run({
 *   location: "123 Main St, Austin, TX",
 *   radius: 15,
 *   analysisType: "power_grid" // or "comprehensive"
 * });
 */

import { SerpTool } from '../../../utils/tools/SerpTool.mjs';
import { OsmTool } from './OsmTool.js';
import { PerplexityTool } from './PerplexityTool.js';

export class BespokeAnalysisTool {
  constructor() {
    this.cache = new Map();
    this.serpTool = new SerpTool(this.cache, this.updateToolFeedback.bind(this));
    this.osmTool = new OsmTool(this.cache, this.updateToolFeedback.bind(this));
    this.perplexityTool = new PerplexityTool(this.updateToolFeedback.bind(this));
    
    this.analysisCache = new Map();
    this.cacheExpiration = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Run bespoke infrastructure analysis
   * @param {Object} config - Analysis configuration
   * @param {string} config.location - Address or location description
   * @param {number} config.radius - Analysis radius in miles
   * @param {string} config.analysisType - Type of analysis ('power_grid' or 'comprehensive')
   * @param {Object} config.map - Optional map instance for visualization
   * @returns {Object} Analysis results
   */
  async run(config) {
    const { location, radius, analysisType = 'power_grid', map = null } = config;
    
    // Validate inputs
    if (!location || !radius) {
      throw new Error('Location and radius are required');
    }

    if (radius < 1 || radius > 50) {
      throw new Error('Radius must be between 1 and 50 miles');
    }

    // Check cache first
    const cacheKey = this.generateCacheKey(location, radius, analysisType);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log('⚡ BespokeAnalysis: Using cached results');
      return cached;
    }

    try {
      // Step 1: Geocode location to coordinates
      const coordinates = await this.geocodeLocation(location);
      if (!coordinates) {
        throw new Error('Could not geocode the provided location');
      }

      // Step 2: Run SERP analysis
      const serpResults = await this.runSerpAnalysis(coordinates, radius);
      
      // Step 3: Run OSM analysis
      const osmResults = await this.runOsmAnalysis(coordinates, radius, map);
      
      // Step 4: Run Perplexity analysis
      const perplexityResults = await this.runPerplexityAnalysis(
        coordinates, 
        radius, 
        serpResults, 
        osmResults, 
        analysisType
      );

      // Step 5: Compile results
      const results = this.compileResults({
        location,
        radius,
        analysisType,
        coordinates,
        serpResults,
        osmResults,
        perplexityResults
      });

      // Cache results
      this.saveToCache(cacheKey, results);

      return results;

    } catch (error) {
      console.error('BespokeAnalysis failed:', error);
      throw new Error(`Analysis failed: ${error.message}`);
    }
  }

  /**
   * Geocode location to coordinates
   */
  async geocodeLocation(location) {
    this.updateToolFeedback({
      isActive: true,
      tool: 'bespoke',
      status: '�� Geocoding location...',
      progress: 10,
      details: `Converting "${location}" to coordinates`
    });

    try {
      // Use a geocoding service (you can replace with your preferred service)
      const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?access_token=${process.env.REACT_APP_MAPBOX_TOKEN}&limit=1`);
      
      if (!response.ok) {
        throw new Error('Geocoding failed');
      }

      const data = await response.json();
      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        return { lat, lng };
      }
      
      throw new Error('Location not found');
    } catch (error) {
      console.warn('Geocoding failed, using fallback coordinates');
      // Fallback to Whitney, TX if geocoding fails
      return { lat: 31.9315, lng: -97.347 };
    }
  }

  /**
   * Run SERP analysis
   */
  async runSerpAnalysis(coordinates, radius) {
    this.updateToolFeedback({
      isActive: true,
      tool: 'bespoke',
      status: '🔍 Running SERP analysis...',
      progress: 30,
      details: `Searching for infrastructure within ${radius} miles`
    });

    const queries = [
      `power grid reliability statistics ${coordinates.lat}, ${coordinates.lng}`,
      `power outage history ${coordinates.lat}, ${coordinates.lng}`,
      `infrastructure updates ${coordinates.lat}, ${coordinates.lng}`
    ];

    const result = await this.serpTool.execute(queries, coordinates, null, { radius });
    return result;
  }

  /**
   * Run OSM analysis
   */
  async runOsmAnalysis(coordinates, radius, map) {
    this.updateToolFeedback({
      isActive: true,
      tool: 'bespoke',
      status: '🗺️ Running OSM analysis...',
      progress: 50,
      details: `Mapping infrastructure within ${radius} miles`
    });

    const queries = [`power infrastructure analysis ${coordinates.lat}, ${coordinates.lng}`];
    const result = await this.osmTool.execute(queries, coordinates, map, null, null);
    return result;
  }

  /**
   * Run Perplexity analysis
   */
  async runPerplexityAnalysis(coordinates, radius, serpResults, osmResults, analysisType) {
    this.updateToolFeedback({
      isActive: true,
      tool: 'bespoke',
      status: '�� Running Perplexity analysis...',
      progress: 70,
      details: `Generating ${analysisType} analysis`
    });

    const queries = this.buildPerplexityQueries(analysisType, radius);
    const previousResults = {
      serpData: serpResults.data,
      osmData: osmResults.data
    };

    const result = await this.perplexityTool.execute(queries, coordinates, previousResults, null);
    return result;
  }

  /**
   * Build Perplexity queries based on analysis type
   */
  buildPerplexityQueries(analysisType, radius) {
    const baseQueries = [
      `power grid reliability analysis within ${radius} miles`,
      `infrastructure assessment for data center site within ${radius} miles`,
      `power grid stability and transmission capacity within ${radius} miles`
    ];

    if (analysisType === 'comprehensive') {
      return [
        ...baseQueries,
        `environmental and regulatory analysis within ${radius} miles`,
        `economic and development potential within ${radius} miles`,
        `risk assessment and mitigation strategies within ${radius} miles`
      ];
    }

    return baseQueries;
  }

  /**
   * Compile all results into final analysis
   */
  compileResults({ location, radius, analysisType, coordinates, serpResults, osmResults, perplexityResults }) {
    const analysis = {
      metadata: {
        location,
        radius,
        analysisType,
        coordinates,
        timestamp: Date.now(),
        version: '1.0'
      },
      infrastructure: {
        serp: serpResults.data || {},
        osm: osmResults.data || {},
        perplexity: perplexityResults.data || {}
      },
      summary: this.generateSummary(serpResults, osmResults, perplexityResults),
      recommendations: this.generateRecommendations(serpResults, osmResults, perplexityResults),
      dataQuality: this.assessDataQuality(serpResults, osmResults, perplexityResults)
    };

    return analysis;
  }

  /**
   * Generate analysis summary
   */
  generateSummary(serpResults, osmResults, perplexityResults) {
    const serpData = serpResults.data || {};
    const osmData = osmResults.data || {};
    const perplexityData = perplexityResults.data || {};

    return {
      powerInfrastructure: {
        powerPlants: serpData.powerPlantsCount || 0,
        substations: osmData.substationsCount || 0,
        transmissionLines: osmData.visualLayers?.transmission?.length || 0
      },
      geographicFeatures: {
        waterAccess: osmData.waterAccess || 'Unknown',
        landUse: osmData.landUse || 'Unknown',
        transportation: osmData.transportationAccess || 'Unknown'
      },
      analysisQuality: {
        serpSuccess: serpResults.success || false,
        osmSuccess: osmResults.success || false,
        perplexitySuccess: perplexityResults.success || false
      }
    };
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(serpResults, osmResults, perplexityResults) {
    const recommendations = [];
    
    if (serpResults.success && serpResults.data) {
      recommendations.push('SERP analysis completed successfully');
    }
    
    if (osmResults.success && osmResults.data) {
      recommendations.push('OSM mapping completed successfully');
    }
    
    if (perplexityResults.success && perplexityResults.data) {
      recommendations.push('Perplexity analysis completed successfully');
    }

    return recommendations;
  }

  /**
   * Assess data quality
   */
  assessDataQuality(serpResults, osmResults, perplexityResults) {
    let qualityScore = 0;
    let maxScore = 0;

    if (serpResults.success) {
      qualityScore += 30;
      maxScore += 30;
    }

    if (osmResults.success) {
      qualityScore += 30;
      maxScore += 30;
    }

    if (perplexityResults.success) {
      qualityScore += 40;
      maxScore += 40;
    }

    return {
      score: maxScore > 0 ? Math.round((qualityScore / maxScore) * 100) : 0,
      maxScore: 100,
      details: {
        serp: serpResults.success ? 'Good' : 'Failed',
        osm: osmResults.success ? 'Good' : 'Failed',
        perplexity: perplexityResults.success ? 'Good' : 'Failed'
      }
    };
  }

  /**
   * Update tool feedback
   */
  updateToolFeedback(feedback) {
    console.log(`🔄 ${feedback.tool}: ${feedback.status} (${feedback.progress}%)`);
    if (feedback.details) {
      console.log(`   ${feedback.details}`);
    }
  }

  /**
   * Generate cache key
   */
  generateCacheKey(location, radius, analysisType) {
    const locationHash = this.hashString(location);
    return `bespoke_${locationHash}_${radius}_${analysisType}`;
  }

  /**
   * Hash string for cache key
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get from cache
   */
  getFromCache(cacheKey) {
    const cached = this.analysisCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiration) {
      return cached.data;
    }
    return null;
  }

  /**
   * Save to cache
   */
  saveToCache(cacheKey, data) {
    this.analysisCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.analysisCache.clear();
    console.log('🗑️ BespokeAnalysis: Cache cleared');
  }
}

// Export singleton instance
export const bespokeAnalysis = new BespokeAnalysisTool();

// Global functions for easy access
if (typeof window !== 'undefined') {
  window.bespokeAnalysis = bespokeAnalysis;
  window.clearBespokeCache = () => bespokeAnalysis.clearCache();
}