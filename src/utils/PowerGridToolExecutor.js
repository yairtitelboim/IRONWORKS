/**

* PowerGridToolExecutor - Power grid specific tool executor
 * Part of Phase 3: Generic ToolExecutor implementation
 * Phase 1 Refactor: Now uses extracted tool classes for better separation of concerns
 * Phase 2 Refactor: Now uses PowerGridStrategy for configuration and power-specific logic
 * Phase 3 Refactor: Now extends generic ToolExecutor with power-specific functionality
 */

import { ToolExecutor } from './ToolExecutor.js';
import { PowerGridStrategy } from './strategies/PowerGridStrategy.js';

export class PowerGridToolExecutor extends ToolExecutor {
  constructor(map, updateToolFeedback, handleMarkerClick = null) {
    // Call parent constructor
    super(map, updateToolFeedback, handleMarkerClick);
    
    // Set power grid specific strategy
    this.setStrategy(new PowerGridStrategy());
    
    // DISABLED: Dual analysis system - causing data transformation issues
    this.dualAnalysisEnabled = false; // Feature flag for backward compatibility
    this.lastDualAnalysisResult = null;
  }

  /**
   * Enhanced executeMultipleTools with dual analysis capability
   * Backward compatible - returns same format as before, but stores dual data internally
   */
  async executeMultipleTools(toolActions, query = '') {
    if (!this.dualAnalysisEnabled) {
      // Fallback to original behavior
      return await super.executeMultipleTools(toolActions);
    }

    try {
      // Phase 1: Execute original node-level analysis (Perplexity)
      const nodeAnalysisResult = await super.executeMultipleTools(toolActions);
      
      // Phase 2: Generate site-level insights from node analysis
      const siteInsightsResult = await this.generateSiteInsights(nodeAnalysisResult, query);
      
      // Phase 4: Pre-parse and cache structured data for faster rendering
      const { nodeData, siteData } = this.preParseAndCacheStructuredData(nodeAnalysisResult);
      
      // Store dual analysis data with structured data
      this.lastDualAnalysisResult = {
        nodeLevel: nodeAnalysisResult,
        siteLevel: siteInsightsResult,
        nodeData,        // NEW: Structured data for tables
        siteData,        // NEW: Structured data for tables
        query: query,
        timestamp: Date.now()
      };

      console.log('🎯 Dual Analysis Complete:', {
        nodeLevel: nodeAnalysisResult?.length || 0,
        siteLevel: siteInsightsResult?.length || 0,
        nodeDataNodes: nodeData?.length || 0,
        siteDataNodes: siteData?.length || 0,
        query: query
      });

      // Return site-level insights by default (backward compatible)
      // Frontend can access node-level data via getDualAnalysisData()
      return siteInsightsResult;

    } catch (error) {
      console.error('❌ Dual analysis failed, falling back to original:', error);
      // Fallback to original behavior on error
      return await super.executeMultipleTools(toolActions);
    }
  }

  /**
   * Generate site-level insights from node-level Perplexity analysis
   */
  async generateSiteInsights(nodeAnalysisResult, originalQuery) {
    if (!nodeAnalysisResult || nodeAnalysisResult.length === 0) {
      return nodeAnalysisResult;
    }

    try {
      // Find Perplexity response in node analysis
      const perplexityResponse = this.extractPerplexityResponse(nodeAnalysisResult);

      if (!perplexityResponse) {
        console.log('🔍 No Perplexity response found, returning original result');
        return nodeAnalysisResult;
      }

      // Build Claude prompt for site-level insights
      const siteInsightPrompt = this.buildSiteInsightPrompt(perplexityResponse, originalQuery);
      
      // Generate site insights using Claude (simulate for now)
      const siteInsights = await this.generateClaudeSiteInsights(siteInsightPrompt);
      
      // Replace Perplexity response with site insights while keeping other data
      const result = this.replacePerplexityWithSiteInsights(nodeAnalysisResult, siteInsights);
      console.log('✅ Site insights generated successfully');
      
      return result;
        
      } catch (error) {
      console.error('❌ Site insight generation failed:', error);
      return nodeAnalysisResult; // Return original on error
    }
  }

  /**
   * Pre-parse and cache structured data for faster table rendering (Phase 4)
   * This method extracts and caches parsed node data to avoid re-parsing on every render
   */
  preParseAndCacheStructuredData(results) {
    console.log('🚀 PowerGridToolExecutor: Pre-parsing structured data for instant table rendering');
    
    const nodeData = this.extractInfrastructureData(results);
    const siteData = this.extractInfrastructureData(results);
    
    // Cache the structured data for immediate access
    if (this.lastDualAnalysisResult) {
      this.lastDualAnalysisResult.nodeData = nodeData;
      this.lastDualAnalysisResult.siteData = siteData;
      this.lastDualAnalysisResult.parsedAt = Date.now();
      
      console.log('⚡ PowerGridToolExecutor: Structured data cached for instant access');
      console.log(`   - Node data: ${nodeData.length} nodes (parsed once, reused everywhere)`);
      console.log(`   - Site data: ${siteData.length} nodes`);
      console.log(`   - Cache timestamp: ${new Date().toISOString()}`);
    }
    
    return { nodeData, siteData };
  }

  /**
   * Get cached structured data for immediate table rendering
   * @returns {Object} - Cached node and site data
   */
  getCachedStructuredData() {
    if (!this.lastDualAnalysisResult) return { nodeData: [], siteData: [] };
    
    const { nodeData = [], siteData = [], parsedAt } = this.lastDualAnalysisResult;
    
    // Check if data is still fresh (5 minutes)
    const isFresh = parsedAt && (Date.now() - parsedAt) < (5 * 60 * 1000);
    
    if (isFresh) {
      console.log('⚡ PowerGridToolExecutor: Using cached structured data');
      return { nodeData, siteData };
    }
    
    console.log('🔄 PowerGridToolExecutor: Cached data expired, re-parsing...');
    return { nodeData: [], siteData: [] };
  }

  /**
   * Extract structured infrastructure data from tool results (Phase 1)
   */
  extractInfrastructureData(results) {
    if (!results) return [];
    
    // Handle different result structures
    let resultsArray = results;
    if (results.results && Array.isArray(results.results)) {
      resultsArray = results.results;
    } else if (Array.isArray(results)) {
      resultsArray = results;
    } else {
      return [];
    }

    // Find Perplexity response
    const perplexityResult = resultsArray.find(result => result && result.tool === 'PERPLEXITY');
    if (!perplexityResult) return [];

    // Extract content
    let content = '';
    if (perplexityResult.content) {
      content = perplexityResult.content;
    } else if (perplexityResult.data) {
      if (typeof perplexityResult.data === 'string') {
        content = perplexityResult.data;
      } else if (typeof perplexityResult.data === 'object') {
        // Handle object data structure
        if (perplexityResult.data.analysis) {
          content = perplexityResult.data.analysis;
        } else if (perplexityResult.data.response) {
          content = perplexityResult.data.response;
        } else if (perplexityResult.data.content) {
          content = perplexityResult.data.content;
        } else {
          // Check if there's a nested data property (MAIN FIX)
          if (perplexityResult.data.data && typeof perplexityResult.data.data === 'string') {
            console.log('🎯 PowerGridToolExecutor: Using nested data.data property (MAIN FIX)');
            console.log('📝 Found analysis:', perplexityResult.data.data.substring(0, 100) + '...');
            content = perplexityResult.data.data;
          } else {
            // Find the first string property that looks like analysis content
            const stringProps = Object.entries(perplexityResult.data).filter(([key, value]) => typeof value === 'string' && value.length > 1000);
            if (stringProps.length > 0) {
              console.log('🎯 PowerGridToolExecutor: Using first long string property:', stringProps[0][0]);
              content = stringProps[0][1];
            } else {
              // Debug: log the actual values to understand the structure
              console.log('🔍 PowerGridToolExecutor: Data object keys:', Object.keys(perplexityResult.data));
              console.log('🔍 PowerGridToolExecutor: Data object values:', Object.entries(perplexityResult.data).map(([key, value]) => [key, typeof value, value?.length || 'N/A']));
              
              // Check if any of the arrays contain the analysis string
              Object.entries(perplexityResult.data).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                  value.forEach((item, index) => {
                    if (typeof item === 'string' && item.length > 1000) {
                      console.log(`🎯 PowerGridToolExecutor: Found analysis in ${key}[${index}]:`, item.substring(0, 100));
                      if (!content) content = item; // Use the first long string found
                    }
                  });
                }
              });
              
              if (content) {
                console.log('🎯 PowerGridToolExecutor: Using content from array analysis');
              }
            }
          }
        }
      }
    }

    if (!content || typeof content !== 'string') return [];

    // Parse nodes from content
    const nodes = [];
    const nodeRegex = /## NODE (\d+): \*\*(.*?)\*\*/g;
    let match;
    
    while ((match = nodeRegex.exec(content)) !== null) {
      const nodeNumber = match[1];
      const nodeName = match[2];
      
      // Extract data for this node
      const nodeStart = match.index;
      const remainingText = content.substring(nodeStart + match[0].length);
      const nextNodeMatch = /## NODE (\d+): \*\*(.*?)\*\*/.exec(remainingText);
      const nodeEnd = nextNodeMatch ? nodeStart + match[0].length + nextNodeMatch.index : content.length;
      
      const nodeContent = content.substring(nodeStart, nodeEnd);
      
      // Updated regex patterns to match the actual Perplexity response format
      const typeMatch = nodeContent.match(/\*\*Type:\*\* (.+?)(?:\s*\(|$)/);
      const powerScoreMatch = nodeContent.match(/\*\*1\. POWER SCORE:\*\* (\d+)\/10/);
      const stabilityScoreMatch = nodeContent.match(/\*\*2\. STABILITY SCORE:\*\* (\d+)\/10/);
      const capacityMatch = nodeContent.match(/\*\*Nameplate Capacity:\*\* (.+?)(?:\s*\[|\n|$)/);
      const redundancyMatch = nodeContent.match(/\*\*REDUNDANCY VALUE:\*\* \*\*(.+?)\*\*/);
      
      // Use stability score as power score if available, otherwise use power score
      const finalPowerScore = stabilityScoreMatch ? parseInt(stabilityScoreMatch[1]) : 
                             (powerScoreMatch ? parseInt(powerScoreMatch[1]) : 0);
      
      // Extract risk level from reliability metrics section
      let riskLevel = 'N/A';
      if (nodeContent.includes('### 4. RELIABILITY METRICS')) {
        const reliabilityIndex = nodeContent.indexOf('### 4. RELIABILITY METRICS');
        const reliabilityContent = nodeContent.substring(reliabilityIndex);
        
        if (reliabilityContent.includes('High') || reliabilityContent.includes('Critical') || reliabilityContent.includes('vulnerable')) {
          riskLevel = 'High';
        } else if (reliabilityContent.includes('Medium') || reliabilityContent.includes('moderate')) {
          riskLevel = 'Medium';
        } else if (reliabilityContent.includes('Low') || reliabilityContent.includes('stable') || reliabilityContent.includes('resilient')) {
          riskLevel = 'Low';
        }
      }
      
      // Fallback: determine risk based on power score
      if (riskLevel === 'N/A') {
        const score = finalPowerScore;
        if (score >= 8) riskLevel = 'Low';
        else if (score >= 6) riskLevel = 'Medium';
        else riskLevel = 'High';
      }
      
      nodes.push({
        id: nodeNumber,
        name: nodeName,
        type: typeMatch ? typeMatch[1].trim() : 'Unknown',
        powerScore: finalPowerScore,
        risk: riskLevel,
        capacity: capacityMatch ? capacityMatch[1].trim() : 'N/A',
        queueDepth: 'N/A', // Not available in this response format
        resilience: 'N/A', // Not available in this response format
        redundancy: redundancyMatch ? redundancyMatch[1].trim() : 'N/A',
        content: nodeContent
      });
    }
    
    return nodes;
  }

  /**
   * Extract Perplexity response from tool results
   */
  extractPerplexityResponse(results) {
    // Handle different result formats
    if (!results) {
      console.log('🔍 No results provided to extractPerplexityResponse');
      return null;
    }

    // If results is an object with a results array, use that
    let resultsArray = results;
    if (results.results && Array.isArray(results.results)) {
      resultsArray = results.results;
    } else if (Array.isArray(results)) {
      resultsArray = results;
      } else {
      console.log('🔍 Results is not an array:', typeof results);
      return null;
    }

    for (const result of resultsArray) {
      if (result && result.tool === 'PERPLEXITY') {
        if (result.content) {
          console.log('🔍 Found Perplexity response in content:', result.content.length, 'characters');
          return result.content;
        } else if (result.data) {
          console.log('🔍 Found Perplexity response in data property');
          return typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
        }
      }
    }
    
    console.log('🔍 No Perplexity response found in results');
    return null;
  }

  /**
   * Build prompt for Claude site-level insight generation
   */
  buildSiteInsightPrompt(perplexityResponse, originalQuery) {
    return `Based on the detailed node-level infrastructure analysis below, provide strategic SITE-LEVEL insights for the query: "${originalQuery}"

NODE-LEVEL ANALYSIS:
${perplexityResponse}

GENERATE SITE-LEVEL STRATEGIC INSIGHTS using the same category structure but with site-wide perspective:

**Focus on:**
1. **Strategic implications** across all infrastructure nodes
2. **Site-wide patterns** and critical dependencies  
3. **Actionable recommendations** for site-level decision making
4. **Risk aggregation** and redundancy planning
5. **Operational insights** not obvious from individual nodes

**Maintain the same structure** (POWER SCORE, STABILITY SCORE, etc.) but provide:
- Aggregated scores and assessments
- Cross-node dependencies and interactions
- Site-wide risk factors and mitigation strategies
- Strategic recommendations for the entire site

Keep the same ## NODE format but focus on site-level strategic analysis rather than individual facility details.`;
  }

  /**
   * Generate site insights using Claude (placeholder - will integrate with existing Claude orchestration)
   */
  async generateClaudeSiteInsights(prompt) {
    // For now, return a transformed version of the original
    // TODO: Integrate with actual Claude API call
    
    // Simulate site-level insight generation
    const siteInsights = `## SITE-LEVEL STRATEGIC ANALYSIS

Based on the comprehensive node-level analysis, here are the key strategic insights for the Whitney site:

## NODE 1: **SITE-WIDE POWER INFRASTRUCTURE ASSESSMENT**

### 1. POWER SCORE: **8.5/10**
- **Strategic Assessment:** The site benefits from diverse power sources with Bosque Power Plant as the primary anchor (800MW capacity)
- **Cross-node synergies:** Multiple generation sources provide excellent redundancy and load balancing capabilities
- **Site-wide capacity:** Combined infrastructure can support significant expansion with proper load management

### 2. STABILITY SCORE: **8/10**
- **Grid Integration:** Strong ERCOT integration across multiple connection points reduces single-point-of-failure risks
- **Operational Resilience:** Diverse infrastructure types (natural gas, transmission, distribution) provide multiple fallback options
- **Market Position:** Strategic location in ERCOT North Central zone provides favorable grid dynamics

### 3. TRANSMISSION CAPACITY
- **Site-wide Assessment:** Multi-path transmission capability with estimated 200-300MW practical capacity
- **Strategic Advantage:** Direct substation adjacency minimizes transmission losses and maximizes efficiency
- **Expansion Potential:** Infrastructure supports significant future capacity additions

### 4. ERCOT INTEGRATION
- **Regional Positioning:** Excellent integration with ERCOT operations providing grid stability services
- **Market Participation:** Active participation in ancillary services markets provides revenue opportunities
- **Regulatory Compliance:** Full compliance with ERCOT standards across all infrastructure components

### 5. RISK FACTORS
- **Site-wide Risk Profile:** Moderate risk with good diversification across infrastructure types
- **Critical Dependencies:** Natural gas supply and water availability are key site-wide vulnerabilities
- **Weather Resilience:** Geographic concentration requires enhanced severe weather preparedness
- **Strategic Recommendations:** Implement comprehensive business continuity planning with multiple backup scenarios

### 6. REDUNDANCY VALUE
- **Site Assessment:** **High redundancy** with multiple independent power sources and transmission paths
- **Strategic Value:** N+1 redundancy achieved across critical systems with room for N+2 in key areas
- **Operational Excellence:** Redundancy design supports 99.9%+ uptime objectives for critical loads

---

**STRATEGIC RECOMMENDATIONS:**
1. Leverage diverse infrastructure portfolio for enhanced reliability
2. Develop integrated operations center for cross-infrastructure coordination
3. Implement predictive maintenance across all site infrastructure
4. Consider additional renewable generation to complement existing assets`;

    return siteInsights;
  }

  /**
   * Replace Perplexity response with site insights in results array
   */
  replacePerplexityWithSiteInsights(originalResults, siteInsights) {
    // Handle different result structures
    let resultsArray = originalResults;
    if (originalResults.results && Array.isArray(originalResults.results)) {
      resultsArray = originalResults.results;
    } else if (!Array.isArray(originalResults)) {
      return originalResults;
    }

    const updatedResults = resultsArray.map(result => {
      if (result.tool === 'PERPLEXITY') {
        return {
          ...result,
          content: siteInsights,
          data: siteInsights, // Also store in data property for consistency
          metadata: {
            ...result.metadata,
            analysisLevel: 'site',
            generatedBy: 'claude-site-insights',
            originalNodeAnalysis: true
          }
        };
      }
      return result;
    });

    // Return in same structure as input
    if (originalResults.results && Array.isArray(originalResults.results)) {
      return {
        ...originalResults,
        results: updatedResults
      };
    } else {
      return updatedResults;
    }
  }


  /**
   * Check if dual analysis data is available
   */
  hasDualAnalysisData() {
    return this.lastDualAnalysisResult !== null;
  }

  /**
   * Clear dual analysis data (for memory management)
   */
  clearDualAnalysisData() {
    this.lastDualAnalysisResult = null;
  }

  /**
   * Toggle dual analysis feature (for testing/debugging)
   */
  setDualAnalysisEnabled(enabled) {
    this.dualAnalysisEnabled = enabled;
    console.log(`🎯 Dual analysis ${enabled ? 'enabled' : 'disabled'}`);
  }

  // All generic cache and data management methods are now inherited from ToolExecutor

  /**
   * Update marker styling to show selected state
   */
  updateMarkerStyling() {
    if (!this.map?.current || !this.map.current.getLayer('serp-infrastructure-markers')) {
      return;
    }

    // Update the paint properties to highlight selected marker
    this.map.current.setPaintProperty('serp-infrastructure-markers', 'circle-color', [
      'case',
      ['==', ['get', 'serp_id'], this.selectedMarkerId], '#ef4444', // Red for selected marker
      ['==', ['get', 'category'], 'power plants'], '#ef4444',
      ['==', ['get', 'category'], 'electric utilities'], '#f59e0b',
      ['==', ['get', 'category'], 'data centers'], '#8b5cf6',
      '#6b7280'
    ]);

    // Make selected marker larger
    this.map.current.setPaintProperty('serp-infrastructure-markers', 'circle-radius', [
      'case',
      ['==', ['get', 'serp_id'], this.selectedMarkerId], 12, // Larger for selected marker
      ['==', ['get', 'category'], 'power plants'], 8,
      ['==', ['get', 'category'], 'electric utilities'], 7,
      ['==', ['get', 'category'], 'data centers'], 6,
      5
    ]);

    // Make selected marker more opaque
    this.map.current.setPaintProperty('serp-infrastructure-markers', 'circle-opacity', [
      'case',
      ['==', ['get', 'serp_id'], this.selectedMarkerId], 1.0, // Full opacity for selected
      0.8
    ]);

    console.log(`🎯 Marker styling updated - selected marker: ${this.selectedMarkerId}`);
  }

  /**
   * Reset marker styling to default state
   */
  resetMarkerStyling() {
    if (!this.map?.current || !this.map.current.getLayer('serp-infrastructure-markers')) {
      return;
    }

    // Reset to original styling
    this.map.current.setPaintProperty('serp-infrastructure-markers', 'circle-color', [
      'case',
      ['==', ['get', 'category'], 'power plants'], '#ef4444',
      ['==', ['get', 'category'], 'electric utilities'], '#f59e0b',
      ['==', ['get', 'category'], 'data centers'], '#8b5cf6',
      '#6b7280'
    ]);

    this.map.current.setPaintProperty('serp-infrastructure-markers', 'circle-radius', [
      'case',
      ['==', ['get', 'category'], 'power plants'], 8,
      ['==', ['get', 'category'], 'electric utilities'], 7,
      ['==', ['get', 'category'], 'data centers'], 6,
      5
    ]);

    this.map.current.setPaintProperty('serp-infrastructure-markers', 'circle-opacity', 0.8);

    // Clear selected marker ID
    this.selectedMarkerId = null;
  }

  /**
   * Get dual analysis data (node-level and site-level)
   * @returns {Object|null} - Dual analysis data or null
   */
  getDualAnalysisData() {
    return this.lastDualAnalysisResult;
  }

  /**
   * Get cached structured data for immediate table rendering (Phase 4)
   * @returns {Object} - Cached node and site data
   */
  getCachedTableData() {
    return this.getCachedStructuredData();
  }

  /**
   * Check if structured data is available and fresh
   * @returns {boolean} - True if data is available and fresh
   */
  hasFreshStructuredData() {
    const { nodeData = [], parsedAt } = this.lastDualAnalysisResult || {};
    const isFresh = parsedAt && (Date.now() - parsedAt) < (5 * 60 * 1000);
    return nodeData.length > 0 && isFresh;
  }

  // All generic tool execution methods (OSM, Perplexity, Firecrawl) are now inherited from ToolExecutor

  /**
   * Update the strategy location for location-aware analysis
   * @param {string} locationKey - The location key to switch to
   */
  updateLocation(locationKey) {
    if (this.strategy && typeof this.strategy.switchLocation === 'function') {
      this.strategy.switchLocation(locationKey);
      // Location updated silently
    } else {
      console.warn('⚠️ PowerGridToolExecutor: Strategy does not support location switching');
    }
  }

}

/**
 * Factory function to create PowerGridToolExecutor instance
 */
export const createPowerGridToolExecutor = (map, updateToolFeedback, handleMarkerClick = null) => {
  return new PowerGridToolExecutor(map, updateToolFeedback, handleMarkerClick);
};

/**
 * Global cache management functions for external access
 */
let globalToolExecutorInstance = null;

export const setGlobalToolExecutor = (instance) => {
  globalToolExecutorInstance = instance;
};

export const getGlobalToolExecutor = () => {
  return globalToolExecutorInstance;
};

export const updateGlobalToolExecutorLocation = (locationKey) => {
  if (globalToolExecutorInstance && typeof globalToolExecutorInstance.updateLocation === 'function') {
    globalToolExecutorInstance.updateLocation(locationKey);
  } else {
    console.warn('⚠️ No global tool executor instance available for location update');
  }
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

export const resetGlobalMarkerStyling = () => {
  if (globalToolExecutorInstance) {
    globalToolExecutorInstance.resetMarkerStyling();
    return true;
  }
  return false;
};

/**
 * Global dual analysis access functions
 */
export const getGlobalDualAnalysisData = () => {
  if (globalToolExecutorInstance && globalToolExecutorInstance.hasDualAnalysisData()) {
    return globalToolExecutorInstance.getDualAnalysisData();
  }
  return null;
};

export const hasGlobalDualAnalysisData = () => {
  if (globalToolExecutorInstance) {
    return globalToolExecutorInstance.hasDualAnalysisData();
  }
  return false;
};

export const clearGlobalDualAnalysisData = () => {
  if (globalToolExecutorInstance) {
    globalToolExecutorInstance.clearDualAnalysisData();
    return true;
  }
  return false;
};

export const setGlobalDualAnalysisEnabled = (enabled) => {
  if (globalToolExecutorInstance) {
    globalToolExecutorInstance.setDualAnalysisEnabled(enabled);
    return true;
  }
  return false;
};
