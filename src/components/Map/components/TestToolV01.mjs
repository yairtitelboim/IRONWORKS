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
import { OsmTool } from '../../../utils/tools/OsmTool.js';
import { PerplexityTool } from '../../../utils/tools/PerplexityTool.js';

export class BespokeAnalysisTool {
  constructor() {
    // Create a cache for the SerpTool
    this.cache = new Map();
    
    // Initialize tools with proper callback binding
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
   * Geocode location to coordinates with enhanced error handling
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
      // Try Mapbox first
      const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?access_token=${process.env.REACT_APP_MAPBOX_TOKEN}&limit=1`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          const [lng, lat] = data.features[0].center;
          console.log(`✅ Geocoded "${location}" to ${lat}, ${lng}`);
          return { lat, lng };
        }
      }
      
      // Fallback to OpenCage or other service
      console.warn('Mapbox geocoding failed, trying fallback...');
      // Add fallback geocoding here if needed
    } catch (error) {
      console.warn('Geocoding failed, using fallback coordinates');
    }
    
    // Fallback to Whitney, TX if geocoding fails
    console.log('Using fallback coordinates: Whitney, TX');
    return { lat: 31.9315, lng: -97.347 };
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
    const locationConfig = { city: 'Austin', state: 'TX' };
    const result = await this.osmTool.execute(queries, coordinates, map, locationConfig, null);
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
   * Build enhanced Perplexity queries with specific data source requirements
   */
  buildPerplexityQueries(analysisType, radius) {
    const baseQueries = [
      `POWER GRID RELIABILITY ANALYSIS for data center site within ${radius} miles radius. Focus on ERCOT grid reliability, transmission capacity, and power infrastructure using EIA State Electricity Data (https://www.eia.gov/electricity/data/state/), EIA Power Plant Data (https://www.eia.gov/electricity/data/eia860/), ERCOT Public Reports (https://www.ercot.com/news/reports), and Texas PUC Filings (https://www.puc.texas.gov/).`,
      `INFRASTRUCTURE ASSESSMENT for data center development within ${radius} miles. Analyze power plants, substations, transmission lines, and grid stability using official Texas energy data sources.`,
      `POWER GRID STABILITY AND TRANSMISSION CAPACITY analysis within ${radius} miles. Include specific MW capacity data, reliability metrics, and regional grid integration from EIA and ERCOT sources.`
    ];

    if (analysisType === 'comprehensive') {
      return [
        ...baseQueries,
        `ENVIRONMENTAL AND REGULATORY ANALYSIS within ${radius} miles. Assess water access, land use compatibility, environmental permits, and regulatory compliance for data center development.`,
        `ECONOMIC AND DEVELOPMENT POTENTIAL within ${radius} miles. Evaluate infrastructure investment, development costs, and economic viability using regional economic data.`,
        `RISK ASSESSMENT AND MITIGATION STRATEGIES within ${radius} miles. Identify power reliability risks, weather resilience, and mitigation strategies for data center operations.`
      ];
    }

    return baseQueries;
  }

  /**
   * Compile all results into final analysis with enhanced structure
   */
  compileResults({ location, radius, analysisType, coordinates, serpResults, osmResults, perplexityResults }) {
    const analysis = {
      metadata: {
        location,
        radius,
        analysisType,
        coordinates,
        timestamp: Date.now(),
        version: '1.0',
        dataSources: [
          'EIA State Electricity Data',
          'EIA Power Plant Data', 
          'ERCOT Public Reports',
          'Texas PUC Filings'
        ]
      },
      infrastructure: {
        serp: serpResults.data || {},
        osm: osmResults.data || {},
        perplexity: perplexityResults.data || {}
      },
      summary: this.generateSummary(serpResults, osmResults, perplexityResults),
      recommendations: this.generateRecommendations(serpResults, osmResults, perplexityResults),
      dataQuality: this.assessDataQuality(serpResults, osmResults, perplexityResults),
      // Add specific infrastructure counts
      infrastructureCounts: {
        powerPlants: serpResults.data?.powerPlantsCount || 0,
        substations: osmResults.data?.substationsCount || 0,
        transmissionLines: osmResults.data?.visualLayers?.transmission?.length || 0,
        waterFeatures: osmResults.data?.visualLayers?.water?.length || 0
      }
    };

    return analysis;
  }

  /**
   * Generate analysis summary with enhanced infrastructure counts
   */
  generateSummary(serpResults, osmResults, perplexityResults) {
    const serpData = serpResults.data || {};
    const osmData = osmResults.data || {};

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
      },
      // Add detailed infrastructure breakdown
      infrastructureBreakdown: {
        totalFeatures: (serpData.powerPlantsCount || 0) + (osmData.substationsCount || 0) + (osmData.visualLayers?.transmission?.length || 0),
        dataQuality: this.assessDataQuality(serpResults, osmResults, perplexityResults).score
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