/**
 * PerplexityResponseExporter - Utility to extract and save Perplexity responses
 * Provides methods to export responses as JSON files for analysis and map display
 */

export class PerplexityResponseExporter {
  constructor() {
    this.exportFormats = {
      full: 'Complete response with all metadata',
      analysis: 'Analysis text and citations only',
      mapData: 'GeoJSON features and map visualization data',
      summary: 'Summary and insights only'
    };
  }

  /**
   * Extract current Perplexity response from all available sources
   * @returns {Object} Complete response data
   */
  extractCurrentResponse() {
    const responseData = {
      timestamp: new Date().toISOString(),
      extraction_method: 'PerplexityResponseExporter',
      sources_checked: [],
      data: {}
    };

    // Source 1: Global AI State
    if (window.aiState && window.aiState.response) {
      responseData.sources_checked.push('window.aiState');
      responseData.data.aiState = {
        response: window.aiState.response,
        citations: window.aiState.citations || [],
        isLoading: window.aiState.isLoading,
        responses: window.aiState.responses || []
      };
    }

    // Source 2: Global Perplexity Analysis Data
    if (window.lastPerplexityAnalysisData) {
      responseData.sources_checked.push('window.lastPerplexityAnalysisData');
      responseData.data.perplexityAnalysis = window.lastPerplexityAnalysisData;
    }

    // Source 3: HolisticCache Workflow
    if (window.holisticCache) {
      try {
        const workflowCache = window.holisticCache.getWorkflowCache('startup_ecosystem_analysis', 'Houston');
        if (workflowCache) {
          responseData.sources_checked.push('HolisticCache.workflow');
          responseData.data.workflowCache = workflowCache;
        }
      } catch (e) {
        console.warn('HolisticCache access failed:', e.message);
      }
    }

    // Source 4: localStorage Development Cache
    try {
      const devCache = localStorage.getItem('perplexity_dev_responses');
      if (devCache) {
        responseData.sources_checked.push('localStorage.devCache');
        responseData.data.devCache = JSON.parse(devCache);
      }
    } catch (e) {
      console.warn('localStorage access failed:', e.message);
    }

    // Source 5: ResponseCache
    if (window.responseCache) {
      try {
        const cacheStats = window.responseCache.getCacheStats();
        responseData.sources_checked.push('ResponseCache');
        responseData.data.cacheStats = cacheStats;
      } catch (e) {
        console.warn('ResponseCache access failed:', e.message);
      }
    }

    return responseData;
  }

  /**
   * Export response in specific format
   * @param {string} format - Export format (full, analysis, mapData, summary)
   * @returns {Object} Formatted response data
   */
  exportInFormat(format = 'full') {
    const fullResponse = this.extractCurrentResponse();
    
    switch (format) {
      case 'analysis':
        return this.extractAnalysisOnly(fullResponse);
      case 'mapData':
        return this.extractMapDataOnly(fullResponse);
      case 'summary':
        return this.extractSummaryOnly(fullResponse);
      default:
        return fullResponse;
    }
  }

  /**
   * Extract only analysis text and citations
   */
  extractAnalysisOnly(fullResponse) {
    const analysis = {
      timestamp: fullResponse.timestamp,
      format: 'analysis_only',
      analysis: null,
      citations: [],
      quality_metrics: {}
    };

    // Try to find analysis text from various sources
    if (fullResponse.data.aiState?.response) {
      analysis.analysis = fullResponse.data.aiState.response;
      analysis.citations = fullResponse.data.aiState.citations || [];
    } else if (fullResponse.data.perplexityAnalysis?.analysis) {
      analysis.analysis = fullResponse.data.perplexityAnalysis.analysis;
      analysis.citations = fullResponse.data.perplexityAnalysis.citations || [];
    } else if (fullResponse.data.workflowCache?.finalResponse) {
      analysis.analysis = fullResponse.data.workflowCache.finalResponse;
      analysis.citations = fullResponse.data.workflowCache.citations || [];
    }

    return analysis;
  }

  /**
   * Extract only map visualization data
   */
  extractMapDataOnly(fullResponse) {
    const mapData = {
      timestamp: fullResponse.timestamp,
      format: 'map_data_only',
      geoJsonFeatures: [],
      legendItems: [],
      mapLayers: [],
      coordinates: null
    };

    // Extract GeoJSON features
    if (fullResponse.data.perplexityAnalysis?.geoJsonFeatures) {
      mapData.geoJsonFeatures = fullResponse.data.perplexityAnalysis.geoJsonFeatures;
    }

    // Extract legend items
    if (fullResponse.data.perplexityAnalysis?.legendItems) {
      mapData.legendItems = fullResponse.data.perplexityAnalysis.legendItems;
    }

    // Extract coordinates
    if (fullResponse.data.workflowCache?.coordinates) {
      mapData.coordinates = fullResponse.data.workflowCache.coordinates;
    }

    return mapData;
  }

  /**
   * Extract only summary and insights
   */
  extractSummaryOnly(fullResponse) {
    const summary = {
      timestamp: fullResponse.timestamp,
      format: 'summary_only',
      summary: {},
      insights: {},
      quality_score: null,
      node_count: null
    };

    // Extract summary data
    if (fullResponse.data.perplexityAnalysis?.summary) {
      summary.summary = fullResponse.data.perplexityAnalysis.summary;
    }

    // Extract insights
    if (fullResponse.data.perplexityAnalysis?.insights) {
      summary.insights = fullResponse.data.perplexityAnalysis.insights;
    }

    // Extract quality metrics
    if (fullResponse.data.perplexityAnalysis?.qualityScore) {
      summary.quality_score = fullResponse.data.perplexityAnalysis.qualityScore;
    }

    if (fullResponse.data.perplexityAnalysis?.nodeCount) {
      summary.node_count = fullResponse.data.perplexityAnalysis.nodeCount;
    }

    return summary;
  }

  /**
   * Download response as JSON file
   * @param {string} format - Export format
   * @param {string} filename - Custom filename (optional)
   */
  downloadAsJSON(format = 'full', filename = null) {
    const responseData = this.exportInFormat(format);
    const dataStr = JSON.stringify(responseData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `perplexity-houston-startup-analysis-${format}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log(`💾 Downloaded Perplexity response as ${format} format`);
    return responseData;
  }

  /**
   * Save response to public directory (for development)
   * @param {string} format - Export format
   * @param {string} filename - Filename
   */
  async saveToPublic(format = 'full', filename = 'perplexity-houston-startup-analysis.json') {
    const responseData = this.exportInFormat(format);
    
    try {
      // This would typically be done via a server endpoint
      // For now, we'll use the download method
      console.log('📁 Saving to public directory:', filename);
      console.log('📊 Response data:', responseData);
      
      // In a real implementation, you'd send this to a server endpoint
      // that saves it to the public directory
      return responseData;
    } catch (error) {
      console.error('Failed to save to public directory:', error);
      throw error;
    }
  }

  /**
   * Get available export formats
   */
  getAvailableFormats() {
    return this.exportFormats;
  }

  /**
   * Validate response data completeness
   */
  validateResponse(responseData) {
    const validation = {
      hasAnalysis: false,
      hasCitations: false,
      hasMapData: false,
      hasSummary: false,
      completeness_score: 0,
      issues: []
    };

    // Check for analysis text
    if (responseData.analysis || 
        (responseData.data?.aiState?.response) ||
        (responseData.data?.perplexityAnalysis?.analysis)) {
      validation.hasAnalysis = true;
    } else {
      validation.issues.push('No analysis text found');
    }

    // Check for citations
    if (responseData.citations?.length > 0 ||
        (responseData.data?.aiState?.citations?.length > 0) ||
        (responseData.data?.perplexityAnalysis?.citations?.length > 0)) {
      validation.hasCitations = true;
    } else {
      validation.issues.push('No citations found');
    }

    // Check for map data
    if (responseData.geoJsonFeatures?.length > 0 ||
        (responseData.data?.perplexityAnalysis?.geoJsonFeatures?.length > 0)) {
      validation.hasMapData = true;
    } else {
      validation.issues.push('No map data found');
    }

    // Check for summary
    if (responseData.summary ||
        (responseData.data?.perplexityAnalysis?.summary)) {
      validation.hasSummary = true;
    } else {
      validation.issues.push('No summary found');
    }

    // Calculate completeness score
    const checks = [validation.hasAnalysis, validation.hasCitations, validation.hasMapData, validation.hasSummary];
    validation.completeness_score = (checks.filter(Boolean).length / checks.length) * 100;

    return validation;
  }
}

// Export utility functions for easy access
export const perplexityExporter = new PerplexityResponseExporter();

// Make available globally for console access
if (typeof window !== 'undefined') {
  window.perplexityExporter = perplexityExporter;
  window.exportPerplexityResponse = (format = 'full') => perplexityExporter.downloadAsJSON(format);
  window.savePerplexityResponse = (format = 'full') => perplexityExporter.saveToPublic(format);
}
