/**
 * Client-side script to save Perplexity response to public folder
 * Run this in the browser console after getting a Perplexity response
 */

// Function to extract and save the real response to public folder
async function savePerplexityResponseToPublic() {
  console.log('🔍 Extracting and saving Perplexity response to public folder...');
  
  // Extract the response
  const responseData = {
    timestamp: new Date().toISOString(),
    extraction_method: 'browser_console_to_public',
    sources_checked: [],
    data: {}
  };

  // Extract from window.aiState
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

  // Create clean response structure
  const cleanResponse = {
    timestamp: responseData.timestamp,
    extraction_method: 'browser_console_to_public',
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

  // Save to public folder via API
  try {
    const response = await fetch('/api/save-perplexity-response', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        responseData: cleanResponse,
        filename: 'perplexity-houston-startup-analysis-real.json'
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Response saved to public folder successfully!');
      console.log('📁 File path:', result.filePath);
      console.log('📊 Summary:', result.summary);
      return result;
    } else {
      const error = await response.json();
      console.error('❌ Failed to save response:', error);
      throw new Error(error.error || 'Failed to save response');
    }
  } catch (error) {
    console.error('❌ Error saving response:', error);
    
    // Fallback: download the file
    console.log('💡 Falling back to download method...');
    const dataStr = JSON.stringify(cleanResponse, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `perplexity-houston-startup-analysis-real-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('💾 Downloaded response as fallback');
    return cleanResponse;
  }
}

// Make function available globally
window.savePerplexityResponseToPublic = savePerplexityResponseToPublic;

console.log('🔧 Response saving function loaded:');
console.log('  - savePerplexityResponseToPublic() - Extract and save to public folder');

// Auto-run if there's a response available
if (window.aiState && window.aiState.response) {
  console.log('🚀 Auto-saving Perplexity response to public folder...');
  savePerplexityResponseToPublic();
} else {
  console.log('💡 No response found. Get a Perplexity response first, then run savePerplexityResponseToPublic()');
}
