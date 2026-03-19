/**
 * Quick script to extract current Perplexity response
 * Run this in browser console or as a standalone script
 */

// Import the exporter (if running in module context)
// import { perplexityExporter } from './src/utils/PerplexityResponseExporter.js';

// For browser console usage
function extractCurrentPerplexityResponse() {
  console.log('🔍 Extracting current Perplexity response...');
  
  const responseData = {
    timestamp: new Date().toISOString(),
    extraction_method: 'browser_console',
    sources_checked: [],
    data: {}
  };

  // Check all possible sources
  const sources = [
    {
      name: 'window.aiState',
      check: () => window.aiState && window.aiState.response,
      extract: () => ({
        response: window.aiState.response,
        citations: window.aiState.citations || [],
        isLoading: window.aiState.isLoading,
        responses: window.aiState.responses || []
      })
    },
    {
      name: 'window.lastPerplexityAnalysisData',
      check: () => window.lastPerplexityAnalysisData,
      extract: () => window.lastPerplexityAnalysisData
    },
    {
      name: 'HolisticCache.workflow',
      check: () => window.holisticCache,
      extract: () => {
        try {
          return window.holisticCache.getWorkflowCache('startup_ecosystem_analysis', 'Houston');
        } catch (e) {
          return null;
        }
      }
    },
    {
      name: 'localStorage.devCache',
      check: () => localStorage.getItem('perplexity_dev_responses'),
      extract: () => {
        try {
          return JSON.parse(localStorage.getItem('perplexity_dev_responses'));
        } catch (e) {
          return null;
        }
      }
    }
  ];

  // Extract from each source
  sources.forEach(source => {
    if (source.check()) {
      responseData.sources_checked.push(source.name);
      const extracted = source.extract();
      if (extracted) {
        responseData.data[source.name.replace(/[^a-zA-Z0-9]/g, '_')] = extracted;
      }
    }
  });

  console.log('📊 Extraction complete:', {
    sources_found: responseData.sources_checked.length,
    sources: responseData.sources_checked
  });

  return responseData;
}

// Download function
function downloadPerplexityResponse(format = 'full') {
  const responseData = extractCurrentPerplexityResponse();
  
  // Format the data based on requested format
  let exportData;
  switch (format) {
    case 'analysis':
      exportData = {
        timestamp: responseData.timestamp,
        analysis: responseData.data.window_aiState?.response || 
                 responseData.data.window_lastPerplexityAnalysisData?.analysis ||
                 'No analysis found',
        citations: responseData.data.window_aiState?.citations || 
                  responseData.data.window_lastPerplexityAnalysisData?.citations ||
                  []
      };
      break;
    case 'mapData':
      exportData = {
        timestamp: responseData.timestamp,
        geoJsonFeatures: responseData.data.window_lastPerplexityAnalysisData?.geoJsonFeatures || [],
        legendItems: responseData.data.window_lastPerplexityAnalysisData?.legendItems || [],
        coordinates: responseData.data.HolisticCache_workflow?.coordinates || null
      };
      break;
    case 'summary':
      exportData = {
        timestamp: responseData.timestamp,
        summary: responseData.data.window_lastPerplexityAnalysisData?.summary || {},
        insights: responseData.data.window_lastPerplexityAnalysisData?.insights || {},
        quality_score: responseData.data.window_lastPerplexityAnalysisData?.qualityScore || null,
        node_count: responseData.data.window_lastPerplexityAnalysisData?.nodeCount || null
      };
      break;
    default:
      exportData = responseData;
  }

  // Create and download file
  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], {type: 'application/json'});
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `perplexity-houston-startup-analysis-${format}-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  console.log(`💾 Downloaded Perplexity response as ${format} format`);
  return exportData;
}

// Validation function
function validatePerplexityResponse() {
  const responseData = extractCurrentPerplexityResponse();
  
  const validation = {
    hasAnalysis: false,
    hasCitations: false,
    hasMapData: false,
    hasSummary: false,
    completeness_score: 0,
    issues: []
  };

  // Check for analysis text
  const analysis = responseData.data.window_aiState?.response || 
                  responseData.data.window_lastPerplexityAnalysisData?.analysis;
  if (analysis) {
    validation.hasAnalysis = true;
  } else {
    validation.issues.push('No analysis text found');
  }

  // Check for citations
  const citations = responseData.data.window_aiState?.citations || 
                   responseData.data.window_lastPerplexityAnalysisData?.citations;
  if (citations && citations.length > 0) {
    validation.hasCitations = true;
  } else {
    validation.issues.push('No citations found');
  }

  // Check for map data
  const mapData = responseData.data.window_lastPerplexityAnalysisData?.geoJsonFeatures;
  if (mapData && mapData.length > 0) {
    validation.hasMapData = true;
  } else {
    validation.issues.push('No map data found');
  }

  // Check for summary
  const summary = responseData.data.window_lastPerplexityAnalysisData?.summary;
  if (summary) {
    validation.hasSummary = true;
  } else {
    validation.issues.push('No summary found');
  }

  // Calculate completeness score
  const checks = [validation.hasAnalysis, validation.hasCitations, validation.hasMapData, validation.hasSummary];
  validation.completeness_score = (checks.filter(Boolean).length / checks.length) * 100;

  console.log('📊 Response Validation:', validation);
  return validation;
}

// Make functions available globally
if (typeof window !== 'undefined') {
  window.extractPerplexityResponse = extractCurrentPerplexityResponse;
  window.downloadPerplexityResponse = downloadPerplexityResponse;
  window.validatePerplexityResponse = validatePerplexityResponse;
  
  console.log('🔧 Perplexity extraction functions loaded:');
  console.log('  - extractPerplexityResponse() - Extract current response data');
  console.log('  - downloadPerplexityResponse(format) - Download as JSON (formats: full, analysis, mapData, summary)');
  console.log('  - validatePerplexityResponse() - Validate response completeness');
}

// Auto-run extraction and validation
if (typeof window !== 'undefined') {
  console.log('🚀 Auto-extracting current Perplexity response...');
  const response = extractCurrentPerplexityResponse();
  const validation = validatePerplexityResponse();
  
  if (validation.completeness_score > 50) {
    console.log('✅ Response extraction successful! Run downloadPerplexityResponse() to save as JSON');
  } else {
    console.log('⚠️ Response extraction incomplete. Check validation results above.');
  }
}
