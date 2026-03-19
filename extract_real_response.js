/**
 * Script to extract the real Perplexity response from browser console
 * Run this in the browser console after getting a Perplexity response
 */

// Function to extract and save the real response
function extractRealPerplexityResponse() {
  console.log('🔍 Extracting real Perplexity response from browser...');
  
  const responseData = {
    timestamp: new Date().toISOString(),
    extraction_method: 'browser_console_real',
    sources_checked: [],
    data: {}
  };

  // Extract from window.aiState (most likely source)
  if (window.aiState && window.aiState.response) {
    responseData.sources_checked.push('window.aiState');
    responseData.data.aiState = {
      response: window.aiState.response,
      citations: window.aiState.citations || [],
      isLoading: window.aiState.isLoading,
      responses: window.aiState.responses || []
    };
    console.log('✅ Found response in window.aiState');
  }

  // Extract from window.lastPerplexityAnalysisData
  if (window.lastPerplexityAnalysisData) {
    responseData.sources_checked.push('window.lastPerplexityAnalysisData');
    responseData.data.perplexityAnalysis = window.lastPerplexityAnalysisData;
    console.log('✅ Found response in window.lastPerplexityAnalysisData');
  }

  // Extract from HolisticCache
  if (window.holisticCache) {
    try {
      const workflowCache = window.holisticCache.getWorkflowCache('startup_ecosystem_analysis', 'Houston');
      if (workflowCache) {
        responseData.sources_checked.push('HolisticCache.workflow');
        responseData.data.workflowCache = workflowCache;
        console.log('✅ Found response in HolisticCache');
      }
    } catch (e) {
      console.log('⚠️ HolisticCache access failed:', e.message);
    }
  }

  // Extract from localStorage
  try {
    const devCache = localStorage.getItem('perplexity_dev_responses');
    if (devCache) {
      responseData.sources_checked.push('localStorage.devCache');
      responseData.data.devCache = JSON.parse(devCache);
      console.log('✅ Found response in localStorage');
    }
  } catch (e) {
    console.log('⚠️ localStorage access failed:', e.message);
  }

  // Extract from ResponseCache
  if (window.responseCache) {
    try {
      const cacheStats = window.responseCache.getCacheStats();
      responseData.sources_checked.push('ResponseCache');
      responseData.data.cacheStats = cacheStats;
      console.log('✅ Found response in ResponseCache');
    } catch (e) {
      console.log('⚠️ ResponseCache access failed:', e.message);
    }
  }

  // Create a clean, structured response
  const cleanResponse = {
    timestamp: responseData.timestamp,
    extraction_method: 'browser_console_real',
    sources_found: responseData.sources_checked,
    analysis: null,
    citations: [],
    geoJsonFeatures: [],
    legendItems: [],
    summary: {},
    insights: {},
    qualityScore: null,
    nodeCount: null,
    confidence: null,
    executionTime: null,
    dataSources: []
  };

  // Extract analysis text
  if (responseData.data.aiState?.response) {
    cleanResponse.analysis = responseData.data.aiState.response;
    cleanResponse.citations = responseData.data.aiState.citations || [];
  } else if (responseData.data.perplexityAnalysis?.analysis) {
    cleanResponse.analysis = responseData.data.perplexityAnalysis.analysis;
    cleanResponse.citations = responseData.data.perplexityAnalysis.citations || [];
  } else if (responseData.data.workflowCache?.finalResponse) {
    cleanResponse.analysis = responseData.data.workflowCache.finalResponse;
    cleanResponse.citations = responseData.data.workflowCache.citations || [];
  }

  // Extract map data
  if (responseData.data.perplexityAnalysis?.geoJsonFeatures) {
    cleanResponse.geoJsonFeatures = responseData.data.perplexityAnalysis.geoJsonFeatures;
  }

  if (responseData.data.perplexityAnalysis?.legendItems) {
    cleanResponse.legendItems = responseData.data.perplexityAnalysis.legendItems;
  }

  // Extract summary and insights
  if (responseData.data.perplexityAnalysis?.summary) {
    cleanResponse.summary = responseData.data.perplexityAnalysis.summary;
  }

  if (responseData.data.perplexityAnalysis?.insights) {
    cleanResponse.insights = responseData.data.perplexityAnalysis.insights;
  }

  // Extract quality metrics
  if (responseData.data.perplexityAnalysis?.qualityScore) {
    cleanResponse.qualityScore = responseData.data.perplexityAnalysis.qualityScore;
  }

  if (responseData.data.perplexityAnalysis?.nodeCount) {
    cleanResponse.nodeCount = responseData.data.perplexityAnalysis.nodeCount;
  }

  if (responseData.data.workflowCache?.executionTime) {
    cleanResponse.executionTime = responseData.data.workflowCache.executionTime;
  }

  // Add metadata
  cleanResponse.metadata = {
    query: "What are the top 3 startup accelerators in Houston and how do they compare",
    location: "Houston, TX",
    coordinates: [29.764197, -95.367375],
    analysis_type: "startup_ecosystem_comparison",
    model_used: "perplexity-sonar-pro",
    response_id: "query_" + Date.now(),
    cache_status: "live_extraction"
  };

  // Validation
  const validation = {
    hasAnalysis: !!cleanResponse.analysis,
    hasCitations: cleanResponse.citations.length > 0,
    hasMapData: cleanResponse.geoJsonFeatures.length > 0,
    hasSummary: Object.keys(cleanResponse.summary).length > 0,
    completeness_score: 0,
    issues: []
  };

  const checks = [validation.hasAnalysis, validation.hasCitations, validation.hasMapData, validation.hasSummary];
  validation.completeness_score = (checks.filter(Boolean).length / checks.length) * 100;

  if (!validation.hasAnalysis) validation.issues.push('No analysis text found');
  if (!validation.hasCitations) validation.issues.push('No citations found');
  if (!validation.hasMapData) validation.issues.push('No map data found');
  if (!validation.hasSummary) validation.issues.push('No summary found');

  cleanResponse.validation = validation;

  console.log('📊 Extraction complete:', {
    sources_found: responseData.sources_checked.length,
    sources: responseData.sources_checked,
    analysis_length: cleanResponse.analysis?.length || 0,
    citations_count: cleanResponse.citations.length,
    geoJson_features: cleanResponse.geoJsonFeatures.length,
    completeness_score: validation.completeness_score
  });

  return cleanResponse;
}

// Function to download the response
function downloadRealResponse() {
  const response = extractRealPerplexityResponse();
  
  const dataStr = JSON.stringify(response, null, 2);
  const dataBlob = new Blob([dataStr], {type: 'application/json'});
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `perplexity-houston-startup-analysis-real-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  console.log('💾 Downloaded real Perplexity response as JSON file');
  return response;
}

// Function to save to public folder (requires server endpoint)
async function saveToPublicFolder() {
  const response = extractRealPerplexityResponse();
  
  try {
    // This would typically be done via a server endpoint
    // For now, we'll use the download method
    console.log('📁 Saving to public folder...');
    console.log('📊 Response data:', response);
    
    // In a real implementation, you'd send this to a server endpoint
    // that saves it to the public directory
    console.log('⚠️ Note: This requires a server endpoint to save to public folder');
    console.log('💡 Use downloadRealResponse() to download the file instead');
    
    return response;
  } catch (error) {
    console.error('Failed to save to public folder:', error);
    throw error;
  }
}

// Make functions available globally
window.extractRealPerplexityResponse = extractRealPerplexityResponse;
window.downloadRealResponse = downloadRealResponse;
window.saveToPublicFolder = saveToPublicFolder;

console.log('🔧 Real response extraction functions loaded:');
console.log('  - extractRealPerplexityResponse() - Extract current response data');
console.log('  - downloadRealResponse() - Download as JSON file');
console.log('  - saveToPublicFolder() - Save to public folder (requires server)');

// Auto-run extraction
console.log('🚀 Auto-extracting real Perplexity response...');
const response = extractRealPerplexityResponse();

if (response.validation.completeness_score > 50) {
  console.log('✅ Real response extraction successful!');
  console.log('💡 Run downloadRealResponse() to save as JSON file');
} else {
  console.log('⚠️ Real response extraction incomplete. Check validation results above.');
  console.log('💡 Make sure you have a Perplexity response in the UI first');
}
