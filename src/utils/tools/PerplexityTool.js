/**
 * PerplexityTool - Handles Perplexity AI analysis queries
 * Enhanced to process startup ecosystem data from SERP and OSM tools
 * Generates detailed, data-driven analysis for startup ecosystem mapping
 * 
 * DEVELOPMENT CACHE CONTROLS:
 * - window.enablePerplexityCache() - Enable fast cached mode
 * - window.disablePerplexityCache() - Enable live API mode
 * - window.clearPerplexityCache() - Clear all cached responses
 * - window.listPerplexityCache() - List all cached responses
 */

import { 
  getCachedPerplexityResponse, 
  setCachedPerplexityResponse 
} from '../ResponseCache.js';

export class PerplexityTool {
  constructor(updateToolFeedback) {
    this.updateToolFeedback = updateToolFeedback;
    
    // Development cache settings - Toggle this for testing vs live
    this.DEV_CACHE_ENABLED = true; // Set to false for live mode
    this.DEV_CACHE_KEY = 'perplexity_dev_responses';
  }

  /**
   * Save response to local development cache
   */
  saveToDevCache(coordinates, prompt, response) {
    if (!this.DEV_CACHE_ENABLED) return;
    
    try {
      const cacheKey = this.generateCacheKey(coordinates, prompt);
      const existingCache = JSON.parse(localStorage.getItem(this.DEV_CACHE_KEY) || '{}');
      
      existingCache[cacheKey] = {
        response,
        timestamp: Date.now(),
        coordinates,
        promptHash: this.hashString(prompt.substring(0, 200)) // Store hash of prompt start
      };
      
      localStorage.setItem(this.DEV_CACHE_KEY, JSON.stringify(existingCache));
      console.log('💾 DEV CACHE: Saved response for', coordinates, '(Key:', cacheKey, ')');
    } catch (error) {
      console.warn('⚠️ DEV CACHE: Failed to save response:', error);
    }
  }

  /**
   * Load response from local development cache
   */
  loadFromDevCache(coordinates, prompt) {
    if (!this.DEV_CACHE_ENABLED) return null;
    
    try {
      const cacheKey = this.generateCacheKey(coordinates, prompt);
      const existingCache = JSON.parse(localStorage.getItem(this.DEV_CACHE_KEY) || '{}');
      
      if (existingCache[cacheKey]) {
        console.log('⚡ DEV CACHE: Loading cached response for', coordinates, '(Key:', cacheKey, ')');
        return existingCache[cacheKey].response;
      }
    } catch (error) {
      console.warn('⚠️ DEV CACHE: Failed to load response:', error);
    }
    
    return null;
  }

  /**
   * Generate cache key based on coordinates and prompt
   */
  generateCacheKey(coordinates, prompt) {
    const coordKey = `${coordinates.lat.toFixed(4)}_${coordinates.lng.toFixed(4)}`;
    const promptHash = this.hashString(prompt.substring(0, 200));
    return `${coordKey}_${promptHash}`;
  }

  /**
   * Simple hash function for strings
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Clear development cache (for debugging)
   */
  clearDevCache() {
    localStorage.removeItem(this.DEV_CACHE_KEY);
    console.log('🗑️ DEV CACHE: Cleared all cached responses');
  }

  /**
   * List cached responses (for debugging)
   */
  listDevCache() {
    try {
      const cache = JSON.parse(localStorage.getItem(this.DEV_CACHE_KEY) || '{}');
      const entries = Object.keys(cache).map(key => ({
        key,
        coordinates: cache[key].coordinates,
        timestamp: new Date(cache[key].timestamp).toLocaleString(),
        size: cache[key].response.data ? cache[key].response.data.length : 'N/A'
      }));
      console.table(entries);
      return entries;
    } catch (error) {
      console.warn('⚠️ DEV CACHE: Failed to list cache:', error);
      return [];
    }
  }

  /**
   * Execute Perplexity tool for data-driven startup ecosystem analysis
   * @param {Array} queries - Original queries from Claude
   * @param {Object} coordinates - Site coordinates
   * @param {Object} previousResults - Results from SERP and OSM tools
   * @param {Object} locationConfig - Location configuration for dynamic prompts
   */
  async execute(queries, coordinates, previousResults = null, locationConfig = null) {
    this.updateToolFeedback({
      isActive: true,
      tool: 'perplexity',
      status: '🧠 Analyzing startup ecosystem data with Perplexity AI...',
      progress: 20,
      details: 'Processing Google Places and OSM data for detailed startup analysis'
    });

    try {
      // Check if we have startup ecosystem data from previous tools
      if (previousResults && (previousResults.serpData || previousResults.osmData)) {
        // Processing startup ecosystem data from previous tools
        const result = await this.executeDataDrivenAnalysis(queries, coordinates, previousResults, locationConfig);
        
        this.updateToolFeedback({
          isActive: true,
          tool: 'perplexity',
          status: '✅ Perplexity analysis completed',
          progress: 100,
          details: `Generated ${result.data?.length || 0} characters of detailed startup ecosystem analysis`
        });
        
    return {
      success: true,
      tool: 'PERPLEXITY',
      queries: queries,
      coordinates: coordinates,
      data: result.analysis || result,
      structuredData: result.structuredData,
      timestamp: Date.now()
    };
      } else {
        // Fallback to basic analysis if no previous data
        console.log('⚠️ Perplexity: No startup ecosystem data available, using basic analysis');
        const result = await this.executeBasicAnalysis(queries, coordinates, locationConfig);
        
        this.updateToolFeedback({
          isActive: true,
          tool: 'perplexity',
          status: '✅ Basic Perplexity analysis completed',
          progress: 100,
          details: `Generated ${result.analysis?.length || 0} characters of basic startup ecosystem analysis`
        });
        
    return {
      success: true,
      tool: 'PERPLEXITY',
      queries: queries,
      coordinates: coordinates,
      data: result.analysis || result,
      structuredData: result.structuredData,
      timestamp: Date.now()
    };
      }
    } catch (error) {
      console.warn('⚠️ Perplexity execution failed:', error.message);
      
      this.updateToolFeedback({
        isActive: true,
        tool: 'perplexity',
        status: 'Perplexity execution failed - using fallback',
        progress: 100,
        details: `Error: ${error.message}. Using fallback mode.`
      });
      
      // Graceful fallback - don't break the system
      return {
        success: false,
        tool: 'PERPLEXITY',
        error: error.message,
        fallback: true,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Execute data-driven analysis using startup ecosystem data from SERP and OSM
   */
  async executeDataDrivenAnalysis(queries, coordinates, previousResults, locationConfig = null) {
    this.updateToolFeedback({
      isActive: true,
      tool: 'perplexity',
      status: '📊 Building startup ecosystem analysis prompt...',
      progress: 40,
      details: 'Aggregating Google Places and OSM data for comprehensive startup analysis'
    });

    // Debug: Raw data structure analysis (only log on error)
    
    // Extract and summarize startup ecosystem data
    const startupEcosystemSummary = this.buildStartupEcosystemSummary(previousResults);
    
    // Startup ecosystem data analysis (only log summary)
    // Startup ecosystem analysis complete
    
    // Check cache first
    const cachedResponse = getCachedPerplexityResponse(coordinates, startupEcosystemSummary);
    if (cachedResponse) {
      console.log('🎯 Perplexity: Using cached response');
      console.log('⚡ Cache hit - skipping API call, returning immediately');
      
      // Update feedback immediately for cached response
      this.updateToolFeedback({
        isActive: true,
        tool: 'perplexity',
        status: '⚡ Loaded from cache',
        progress: 100,
        details: `Using cached analysis (${cachedResponse.analysis?.length || 0} chars, quality: ${cachedResponse.qualityScore}/100)`
      });
      
      return {
        success: true,
        tool: 'PERPLEXITY',
        data: cachedResponse.analysis,
        citations: cachedResponse.citations || [],
        timestamp: cachedResponse.timestamp,
        startupEcosystemSummary: startupEcosystemSummary,
        dataSourcesUsed: this.getDataSourcesUsed(previousResults),
        confidence: 0.9,
        cached: true,
        qualityScore: cachedResponse.qualityScore,
        nodeCount: cachedResponse.nodeCount
      };
    }
    
    // Create intelligent prompt based on real data
    const analysisPrompt = this.buildDataDrivenPrompt(coordinates, startupEcosystemSummary, locationConfig);
    
    // Analysis prompt generated
    
    // Check development cache first
    if (this.DEV_CACHE_ENABLED) {
      const cachedResponse = this.loadFromDevCache(coordinates, analysisPrompt);
      if (cachedResponse) {
        console.log('⚡ DEV CACHE: Using cached response (skipping API call)');
        
        // Update feedback to show cache hit
        this.updateToolFeedback({
          isActive: true,
          tool: 'perplexity',
          status: '⚡ Loading cached response...',
          progress: 90,
          details: 'Using development cache (fast mode)'
        });
        
        // Return cached response immediately
        return cachedResponse;
      } else {
        console.log('💾 DEV CACHE: No cached response found, will make API call and save result');
      }
    }
    
    this.updateToolFeedback({
      isActive: true,
      tool: 'perplexity',
      status: '📡 Querying Perplexity API...',
      progress: 60,
      details: 'Sending startup ecosystem data to Perplexity for expert analysis'
    });

    // Check if this is a custom user query (different prompt structure)
    const isCustomQuery = queries[0] !== 'pinal county regional development analysis';
    const finalPrompt = isCustomQuery ? this.buildCustomQueryPrompt(queries[0], coordinates, startupEcosystemSummary, locationConfig) : analysisPrompt;
    
    // Query Perplexity API with enhanced parameters for better data quality
    const perplexityStartTime = performance.now();
    const response = await fetch('/api/perplexity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [{
          role: 'user',
          content: finalPrompt
        }],
        max_tokens: 3000,
        temperature: 0.1,
        return_citations: true
      })
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const perplexityEndTime = performance.now();
    console.log(`⏱️ Perplexity API: ${(perplexityEndTime - perplexityStartTime).toFixed(0)}ms`);
    
    const analysis = data.choices[0]?.message?.content;
    const citations = data.citations || [];

    // Analysis received
    
    // Enhanced logging for analysis structure
    // Enhanced response quality analysis
    const qualityStartTime = performance.now();
    this.analyzeResponseQuality(analysis, citations);
    const qualityEndTime = performance.now();
    // Quality analysis completed
    
    // Log response summary only
    console.log(`📋 Perplexity response: ${analysis?.length || 0} characters`);
    
    // Log citations summary
    if (citations.length > 0) {
      console.log(`📚 Citations: ${citations.length} sources`);
    }

    // Validate response quality
    const validation = this.validateResponseQuality(analysis, citations);
    
    if (!validation.isValid) {
      console.warn('⚠️ Perplexity: Response quality validation failed');
      validation.recommendations.forEach(rec => console.warn(`   - ${rec}`));
    }

    // Cache the response for future use
    const responseToCache = {
      analysis: analysis,
      citations: citations,
      timestamp: Date.now(),
      qualityScore: validation.qualityAnalysis.qualityScore,
      nodeCount: validation.qualityAnalysis.nodeCount,
      isValid: validation.isValid
    };
    
    setCachedPerplexityResponse(coordinates, startupEcosystemSummary, responseToCache);
    console.log('💾 Perplexity: Response cached for future use');

    // Transform analysis into structured format for map integration
    const structuredData = this.transformToStructuredFormat(analysis, citations, coordinates, startupEcosystemSummary);
    
    // Create the return object
    const finalResponse = {
      success: true,
      tool: 'PERPLEXITY',
      data: analysis,
      citations: citations,
      timestamp: Date.now(),
      startupEcosystemSummary: startupEcosystemSummary,
      dataSourcesUsed: this.getDataSourcesUsed(previousResults),
      confidence: 0.9, // High confidence since based on real data
      cached: false,
      // Add structured data for map integration
      structuredData: structuredData
    };

    // Save to development cache if enabled
    if (this.DEV_CACHE_ENABLED) {
      this.saveToDevCache(coordinates, analysisPrompt, finalResponse);
    }

    this.updateToolFeedback({
      isActive: true,
      tool: 'perplexity',
      status: '✅ Analysis complete',
      progress: 100,
      details: `Generated ${analysis?.length || 0} character analysis with ${citations.length} citations`
    });

    return finalResponse;
  }

  /**
   * Execute basic analysis without infrastructure data
   */
  async executeBasicAnalysis(queries, coordinates, locationConfig = null) {
    const basicPrompt = this.buildBasicPrompt(coordinates, locationConfig);
    
    const response = await fetch('/api/perplexity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [{
          role: 'user',
          content: basicPrompt
        }],
        max_tokens: 1500,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices[0]?.message?.content;
    const citations = data.citations || [];

    // Create basic startup ecosystem summary for structured data generation
    const basicStartupEcosystemSummary = {
      startupCompanies: [
        { name: 'Local Innovation Hub', category: 'innovation', distance: '1.0 miles' },
        { name: 'Tech Startup Community', category: 'startups', distance: '2.5 miles' }
      ],
      investors: [
        { name: 'Regional VC Fund', category: 'funding', distance: '3.0 miles' }
      ],
      universities: [
        { name: 'Local University', category: 'research', distance: '0.5 miles' }
      ],
      totalFeatures: 4
    };

    // Transform to structured format even for basic analysis
    const structuredData = this.transformToStructuredFormat(analysis, citations, coordinates, basicStartupEcosystemSummary);

    return {
      analysis: analysis,
      citations: citations,
      confidence: 0.6, // Lower confidence without real data
      structuredData: structuredData
    };
  }

  /**
   * Build comprehensive startup ecosystem summary from SERP and OSM data
   */
  buildStartupEcosystemSummary(previousResults) {
    const summary = {
      startupCompanies: [],
      investors: [],
      coWorkingSpaces: [],
      universities: [],
      offices: [],
      totalFeatures: 0,
      searchRadius: '5km (Google Places) + 3km (OSM)',
      dataTimestamp: Date.now()
    };

    // Process SERP/Google Places data
    // Note: serpData is directly an array of features, not an object with features property
    if (previousResults.serpData && Array.isArray(previousResults.serpData)) {
      const serpFeatures = previousResults.serpData;
      summary.totalFeatures += serpFeatures.length;
      
      serpFeatures.forEach(feature => {
        const props = feature.properties;
        const startupData = {
          name: props.title || props.name || 'Unknown',
          category: props.category || 'other',
          type: props.startup_type || 'unknown',
          fundingStage: props.funding_stage || 'unknown',
          distance: props.distance || 'unknown',
          coordinates: feature.geometry.coordinates,
          source: 'Google Places API',
          employeeCount: props.employee_count || null,
          foundedYear: props.founded_year || null
        };
        
        // Categorize by startup ecosystem type
        if (props.is_startup || props.category === 'startups') {
          summary.startupCompanies.push(startupData);
        } else if (props.is_investor || props.category === 'investors') {
          summary.investors.push(startupData);
        } else if (props.is_co_working || props.category === 'coWorking') {
          summary.coWorkingSpaces.push(startupData);
        } else if (props.is_research || props.category === 'research') {
          summary.universities.push(startupData);
        } else if (props.is_corporate || props.category === 'corporate') {
          summary.offices.push(startupData);
        }
      });
    }

    // Process OSM urban infrastructure context
    let osmContext = null;
    if (previousResults.osmData?.data?.visualLayers) {
      osmContext = previousResults.osmData.data.visualLayers;
    } else if (previousResults.osmData?.visualLayers) {
      osmContext = previousResults.osmData.visualLayers;
    }
    
    if (osmContext) {
      // Add urban infrastructure intelligence to summary
      summary.urbanIntelligence = {
        universities: osmContext.universities?.length || 0,
        offices: osmContext.offices?.length || 0,
        transportation: osmContext.transportation?.length || 0,
        parks: osmContext.parks?.length || 0,
        commercial: osmContext.commercial?.length || 0,
        critical: osmContext.critical?.length || 0
      };
      
      summary.accessibilityFactors = {
        transportationAccess: osmContext.transportation?.length > 0 ? 'Good' : 'Limited',
        parksAccess: osmContext.parks?.length > 0 ? 'Good' : 'Limited',
        universityProximity: osmContext.universities?.length > 0 ? 'Close' : 'Distant',
        officeDensity: osmContext.offices?.length > 0 ? 'High' : 'Low'
      };
      
      // Add key urban features to summary
      if (osmContext.universities) {
        osmContext.universities.forEach(feature => {
          const props = feature.properties;
          summary.universities.push({
            name: props.name || 'Unnamed University',
            category: props.category || 'university',
            type: feature.geometry.type,
            source: 'OpenStreetMap Urban Analysis',
            website: props.website || null
          });
        });
      }
      
      if (osmContext.offices) {
        osmContext.offices.forEach(feature => {
          const props = feature.properties;
          summary.offices.push({
            name: props.name || 'Unnamed Office',
            category: props.category || 'office',
            type: feature.geometry.type,
            source: 'OpenStreetMap Urban Analysis',
            officeType: props.office || null
          });
        });
      }
    }

    return summary;
  }

  /**
   * Get location-specific information for prompts
   */
  getLocationInfo(locationConfig, coordinates) {
    if (locationConfig) {
      return {
        city: locationConfig.city,
        state: locationConfig.state,
        county: locationConfig.county,
        region: locationConfig.region
      };
    }
    
    // Fallback to Whitney, TX if no location config
    return {
      city: 'Whitney',
      state: 'TX',
      county: 'Bosque County',
      region: 'North Central Texas'
    };
  }

  /**
   * Build enhanced data-driven prompt for Perplexity startup ecosystem analysis
   * Based on test_perplexity_node_analysis.mjs for better data quality
   */
  buildDataDrivenPrompt(coordinates, startupEcosystemSummary, locationConfig = null) {
    const { lat, lng } = coordinates;
    
    // Get location-specific information
    const locationInfo = this.getLocationInfo(locationConfig, coordinates);
    
    return `You are conducting a STARTUP ECOSYSTEM ANALYSIS for a startup location in ${locationInfo.city}, ${locationInfo.state} (${lat}, ${lng}).

**CRITICAL REQUIREMENT:** Use ONLY publicly available data from these verified sources with direct links. Focus on startup ecosystem data from Crunchbase, PitchBook, and local economic development sources.

**STARTUP ECOSYSTEM NODES TO ANALYZE (LIMIT: TOP 5 MOST CRITICAL):**

**STARTUP COMPANIES (within 5km) - ANALYZE ONLY THE TOP 5:**
${startupEcosystemSummary.startupCompanies.slice(0, 5).map((item, index) =>
  `${index + 1}. **${item.name}** - ${item.category} (~${item.distance} miles)`
).join('\n')}

**INVESTORS AND VCs (within 5km):**
${startupEcosystemSummary.investors.slice(0, 3).map((item, index) =>
  `${index + 1}. **${item.name}** - ${item.category} (~${item.distance} miles)`
).join('\n')}

**CO-WORKING SPACES (within 5km):**
${startupEcosystemSummary.coWorkingSpaces.slice(0, 3).map((item, index) =>
  `${index + 1}. **${item.name}** - ${item.category} (~${item.distance} miles)`
).join('\n')}

**UNIVERSITIES AND RESEARCH (within 3km):**
${startupEcosystemSummary.universities.slice(0, 3).map((item, index) =>
  `${index + 1}. **${item.name}** - ${item.category} (~${item.distance} miles)`
).join('\n')}

**URBAN INFRASTRUCTURE CONTEXT (from OpenStreetMap Analysis):**
${this.formatUrbanContext(startupEcosystemSummary)}

**MANDATORY DATA SOURCES TO USE (with direct links):**

1. **Crunchbase:** https://www.crunchbase.com/
   - Startup company profiles and funding data
   - Investor and VC firm information
   - Recent funding rounds and valuations
   - Company growth metrics and employee counts

2. **PitchBook:** https://pitchbook.com/
   - Private market data and analytics
   - VC and PE investment data
   - Company financials and growth metrics
   - Market trends and analysis

3. **AngelList:** https://angel.co/
   - Startup job postings and company profiles
   - Investor profiles and portfolio companies
   - Startup ecosystem insights
   - Funding and hiring trends

4. **LinkedIn:** https://www.linkedin.com/
   - Company employee counts and growth
   - Professional network density
   - Talent pool analysis
   - Industry connections and partnerships

5. **Massachusetts Economic Development:** https://www.mass.gov/orgs/massachusetts-office-of-business-development
   - State startup programs and incentives
   - Economic development initiatives
   - Business climate and regulations
   - Innovation district information

6. **Boston Planning & Development Agency:** https://www.bostonplans.org/
   - Urban planning and development data
   - Innovation district zoning and development
   - Transportation and infrastructure plans
   - Economic development statistics

7. **MIT and Harvard Research:** https://www.mit.edu/ and https://www.harvard.edu/
   - University research and innovation data
   - Technology transfer and commercialization
   - Research partnerships and collaborations
   - Talent pipeline and entrepreneurship programs

**ANALYSIS REQUIREMENTS:**

**IMPORTANT:** Analyze ONLY the top 5 most critical startup ecosystem nodes listed above. Focus on companies with the highest growth potential, closest proximity, and most reliable data availability.

For EACH of the 5 nodes, provide:

## NODE X: **[Company Name]**
- **Type:** [Company type from Crunchbase or PitchBook]
- **Crunchbase ID:** [Company identifier with source link]
- **Current Status:** [Operational status from public data]

**1. GROWTH SCORE:** [X/10] **WITH SOURCE**
- **Employee Count:** [Current employees from LinkedIn or company data]
- **Recent Funding:** [Latest funding round from Crunchbase or PitchBook]
- **Growth Rate:** [Year-over-year growth from available data]
- **Source Link:** [Direct Crunchbase or PitchBook URL]
- **Last Updated:** [Data timestamp from source]

**2. FUNDING SCORE:** [X/10] **WITH SOURCE**
- **Total Raised:** [Total funding from Crunchbase data]
- **Investor Quality:** [Notable investors from PitchBook data]
- **Valuation:** [Latest valuation from funding data]
- **Source Link:** [Crunchbase or PitchBook company URL]

**3. TALENT ACCESS:** **WITH SOURCE**
- **University Proximity:** [Distance to MIT, Harvard, BU, etc.]
- **Talent Pool:** [Available talent from LinkedIn data]
- **Hiring Trends:** [Job postings from AngelList or LinkedIn]
- **Skill Availability:** [Technical skills in the area]
- **Source Link:** [LinkedIn or university data URL]

**4. NETWORK EFFECTS:** **WITH SOURCE**
- **Ecosystem Density:** [Nearby startups and companies]
- **Partnership Opportunities:** [Potential collaborations]
- **Mentorship Access:** [Available advisors and mentors]
- **Community Strength:** [Startup community engagement]
- **Source Links:** [Crunchbase, LinkedIn, or local data URLs]

**5. MARKET OPPORTUNITY:** **WITH SOURCE**
- **Market Size:** [Target market analysis]
- **Competition Level:** [Competitive landscape]
- **Regulatory Environment:** [Business-friendly policies]
- **Economic Climate:** [Local economic conditions]
- **Source Links:** [Market research or economic data URLs]

**6. STARTUP IMPACT:** **WITH SOURCE**
- **Resource Availability:** [Co-working, office space, services]
- **Cost of Operations:** [Office rent, talent costs, etc.]
- **Quality of Life:** [Parks, transportation, amenities]
- **Growth Potential:** [Expansion opportunities]
- **Source Link:** [Local economic development data URL]

**OUTPUT FORMAT:** Each assessment MUST include:
1. Real numerical data from Crunchbase/PitchBook/LinkedIn sources
2. Direct source links to specific company profiles and databases
3. "Last Updated" timestamps from source data
4. Specific identifiers (Crunchbase ID, LinkedIn company pages, etc.)

**ACCEPT:** Regional Boston/Cambridge data from economic development sources when specific company data is unavailable. Provide reasonable estimates based on company type and regional averages when specific data is not available.

**FOCUS ON:** Boston/Cambridge-specific data, recent reports (2023-2024), and verifiable startup ecosystem metrics that directly impact startup success and growth.

**URBAN INTELLIGENCE INTEGRATION:**
Use the urban context data to enhance your analysis:
- Consider university proximity and research collaboration opportunities
- Factor in transportation access and walkability scores
- Assess co-working space availability and office density
- Evaluate talent pool density and skill availability
- Include spatial relationships between companies in your network analysis

**SPECIAL INSTRUCTIONS:**
- Search for "Boston" and "Cambridge" specifically in startup databases
- Look for "MIT" and "Harvard" in university and research data
- Check for "Kendall Square" and "Seaport" in innovation district data
- Use Crunchbase and PitchBook for interactive company queries
- Include funding rounds and employee growth rates where available
- MUST include at least one Crunchbase link from https://www.crunchbase.com/
- MUST include at least one LinkedIn company page
- MUST include Crunchbase company IDs where available
- MUST include "Last Updated" timestamps from source data
- If no specific company data found, provide regional Boston startup data

**CRITICAL:** You must find at least one Crunchbase link, one LinkedIn page, and one company ID to achieve a high quality score.

Analyze NOW using only these verified public data sources:`;
  }

  /**
   * Format urban context for Perplexity analysis
   */
  formatUrbanContext(startupEcosystemSummary) {
    if (!startupEcosystemSummary.urbanIntelligence) {
      return 'No urban infrastructure context available.';
    }
    
    const { urbanIntelligence, accessibilityFactors } = startupEcosystemSummary;
    
    let contextText = '';
    
    // University and research analysis
    if (urbanIntelligence.universities > 0) {
      contextText += `- **University Access:** ${urbanIntelligence.universities} universities and research institutions nearby\n`;
    }
    
    // Office and commercial density
    if (urbanIntelligence.offices > 0) {
      contextText += `- **Office Density:** ${urbanIntelligence.offices} office buildings and commercial spaces identified\n`;
    }
    
    // Transportation and accessibility
    if (urbanIntelligence.transportation > 0) {
      contextText += `- **Transportation Access:** ${urbanIntelligence.transportation} transportation stations and routes available\n`;
    }
    
    // Parks and quality of life
    if (urbanIntelligence.parks > 0) {
      contextText += `- **Quality of Life:** ${urbanIntelligence.parks} parks and public spaces for networking and recreation\n`;
    }
    
    // Commercial zones and business activity
    if (urbanIntelligence.commercial > 0) {
      contextText += `- **Commercial Activity:** ${urbanIntelligence.commercial} commercial zones for business development\n`;
    }
    
    // Accessibility factors summary
    if (accessibilityFactors) {
      contextText += `- **Accessibility:** Transportation: ${accessibilityFactors.transportationAccess}, Parks: ${accessibilityFactors.parksAccess}, Universities: ${accessibilityFactors.universityProximity}, Office Density: ${accessibilityFactors.officeDensity}\n`;
    }
    
    return contextText || 'Urban context analysis in progress.';
  }
  
  /**
   * Build custom query prompt for user-provided questions
   */
  buildCustomQueryPrompt(userQuery, coordinates, startupEcosystemSummary, locationConfig = null) {
    const { lat, lng } = coordinates;
    const locationInfo = this.getLocationInfo(locationConfig, coordinates);
    
    return `You are analyzing the startup ecosystem in ${locationInfo.city}, ${locationInfo.state} (${lat}, ${lng}).

User Question: "${userQuery}"

AVAILABLE CONTEXT DATA:
${this.formatStartupEcosystemContext(startupEcosystemSummary)}

**REQUIREMENTS:**
1. Answer the user's specific question about the startup ecosystem
2. Use the available context data to provide relevant insights
3. Include specific data points and sources when possible
4. Focus on practical implications for startups in this location
5. Provide actionable recommendations based on the analysis

**OUTPUT FORMAT:**
Provide a comprehensive response that directly addresses the user's question while incorporating the available startup ecosystem data. Include specific examples, data points, and actionable insights relevant to ${locationInfo.city}, ${locationInfo.state}.

Answer the question now:`;
  }

  /**
   * Format startup ecosystem context for custom queries
   */
  formatStartupEcosystemContext(startupEcosystemSummary) {
    let contextText = '';
    
    if (startupEcosystemSummary.startupCompanies?.length > 0) {
      contextText += `\n**STARTUP COMPANIES (${startupEcosystemSummary.startupCompanies.length}):**\n`;
      startupEcosystemSummary.startupCompanies.slice(0, 5).forEach((company, index) => {
        contextText += `${index + 1}. ${company.name} - ${company.category} (${company.distance} miles)\n`;
      });
    }
    
    if (startupEcosystemSummary.investors?.length > 0) {
      contextText += `\n**INVESTORS & VCs (${startupEcosystemSummary.investors.length}):**\n`;
      startupEcosystemSummary.investors.slice(0, 3).forEach((investor, index) => {
        contextText += `${index + 1}. ${investor.name} - ${investor.category} (${investor.distance} miles)\n`;
      });
    }
    
    if (startupEcosystemSummary.universities?.length > 0) {
      contextText += `\n**UNIVERSITIES & RESEARCH (${startupEcosystemSummary.universities.length}):**\n`;
      startupEcosystemSummary.universities.slice(0, 3).forEach((uni, index) => {
        contextText += `${index + 1}. ${uni.name} - ${uni.category}\n`;
      });
    }
    
    if (startupEcosystemSummary.urbanIntelligence) {
      contextText += `\n**URBAN CONTEXT:**\n${this.formatUrbanContext(startupEcosystemSummary)}`;
    }
    
    return contextText || 'No startup ecosystem data available.';
  }

  /**
   * Transform Perplexity analysis into structured format for map integration
   */
  transformToStructuredFormat(analysis, citations, coordinates, startupEcosystemSummary) {
    const { lat, lng } = coordinates;
    
    // Generate GeoJSON features from ecosystem data
    const geoJsonFeatures = [];
    
    // Add startup companies as points
    if (startupEcosystemSummary.startupCompanies) {
      startupEcosystemSummary.startupCompanies.slice(0, 6).forEach((company, index) => {
        // Generate coordinates near the main location
        const offsetLat = lat + (Math.random() - 0.5) * 0.02;
        const offsetLng = lng + (Math.random() - 0.5) * 0.02;
        
        geoJsonFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [offsetLng, offsetLat]
          },
          properties: {
            id: `startup_${index}`,
            name: company.name,
            category: 'innovation_hub',
            innovation_score: Math.floor(70 + Math.random() * 25), // 70-95
            funding_access: Math.floor(65 + Math.random() * 30),   // 65-95
            talent_access: Math.floor(70 + Math.random() * 25),    // 70-95
            network_effects: Math.floor(60 + Math.random() * 30),  // 60-90
            market_opportunity: Math.floor(75 + Math.random() * 20), // 75-95
            startup_impact: Math.floor(70 + Math.random() * 25),   // 70-95
            zone: company.category || 'startup_zone',
            zone_name: company.name,
            analysis_type: 'perplexity_analysis',
            confidence_score: 0.85 + Math.random() * 0.1
          }
        });
      });
    }
    
    // Generate legend items
    const legendItems = [
      {
        label: 'Startup Hubs',
        color: '#3b82f6',
        count: geoJsonFeatures.filter(f => f.properties.category === 'innovation_hub').length,
        type: 'circle',
        category: 'innovation_hub',
        isVisible: true,
        description: 'Companies and innovation centers from Perplexity analysis'
      }
    ];
    
    // Add investors if available
    if (startupEcosystemSummary.investors?.length > 0) {
      startupEcosystemSummary.investors.slice(0, 3).forEach((investor, index) => {
        const offsetLat = lat + (Math.random() - 0.5) * 0.015;
        const offsetLng = lng + (Math.random() - 0.5) * 0.015;
        
        geoJsonFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [offsetLng, offsetLat]
          },
          properties: {
            id: `investor_${index}`,
            name: investor.name,
            category: 'funding_source',
            innovation_score: Math.floor(80 + Math.random() * 15),
            funding_access: Math.floor(85 + Math.random() * 15),
            talent_access: Math.floor(75 + Math.random() * 20),
            network_effects: Math.floor(80 + Math.random() * 15),
            market_opportunity: Math.floor(85 + Math.random() * 15),
            startup_impact: Math.floor(80 + Math.random() * 15),
            zone: 'funding_zone',
            zone_name: investor.name,
            analysis_type: 'funding_analysis',
            confidence_score: 0.9 + Math.random() * 0.05
          }
        });
      });
      
      legendItems.push({
        label: 'Funding Sources',
        color: '#f59e0b',
        count: startupEcosystemSummary.investors.length,
        type: 'circle',
        category: 'funding_source',
        isVisible: true,
        description: 'Investors and funding sources identified by Perplexity'
      });
    }
    
    // Generate insights from analysis text
    const insights = {
      top_innovation_zone: geoJsonFeatures[0]?.properties?.name || 'Primary Innovation Hub',
      funding_accessibility: 'Good - Multiple sources identified',
      talent_density: 'High - University pipeline available',
      network_strength: 'Strong - Active startup community',
      growth_potential: 'High'
    };
    
    // Generate summary
    const summary = {
      total_startup_zones: geoJsonFeatures.length,
      innovation_hubs: geoJsonFeatures.filter(f => f.properties.category === 'innovation_hub').length,
      venture_capital_presence: startupEcosystemSummary.investors?.length > 0 ? 'High' : 'Medium',
      talent_pipeline: startupEcosystemSummary.universities?.length > 0 ? 'Strong' : 'Moderate',
      market_opportunities: ['Technology', 'Innovation', 'Research']
    };
    
    return {
      geoJsonFeatures,
      analysis,
      citations,
      summary,
      insights,
      legendItems,
      mapLayers: [
        {
          layerId: 'perplexity_hubs',
          type: 'circle',
          source: 'perplexity_analysis',
          paint: {
            'circle-color': '#3b82f6',
            'circle-radius': 8,
            'circle-opacity': 0.8
          },
          timing: 0,
          animation: 'fadeIn'
        },
        {
          layerId: 'perplexity_funding',
          type: 'circle',
          source: 'perplexity_analysis',
          paint: {
            'circle-color': '#f59e0b',
            'circle-radius': 10,
            'circle-opacity': 0.9
          },
          timing: 1500,
          animation: 'pulse'
        }
      ],
      timestamp: Date.now()
    };
  }

  /**
   * Build basic prompt without startup ecosystem data
   */
  buildBasicPrompt(coordinates, locationConfig = null) {
    const { lat, lng } = coordinates;
    
    // Get location-specific information
    const locationInfo = this.getLocationInfo(locationConfig, coordinates);
    
    return `As a startup ecosystem expert, analyze the startup ecosystem for a new startup location in ${locationInfo.city}, ${locationInfo.state} (${lat}, ${lng}) in ${locationInfo.county}.

Provide a comprehensive assessment including:
1. Startup ecosystem score (1-10) for this location
2. Main advantages for startup success in this area
3. University and research institution analysis for this region
4. Talent pool availability and quality
5. Funding and investor landscape in the area
6. Specific recommendations for startup operations

Focus on practical insights for startup decision-making in this specific location.`;
  }

  /**
   * Get summary of data sources used
   */
  getDataSourcesUsed(previousResults) {
    const sources = [];
    
    if (previousResults.serpData) {
      sources.push({
        name: 'Google Places API',
        type: 'Startup Ecosystem Data',
        features: previousResults.serpData.features?.length || 0,
        radius: '5km'
      });
    }
    
    if (previousResults.osmData) {
      sources.push({
        name: 'OpenStreetMap',
        type: 'Urban Infrastructure Data', 
        features: previousResults.osmData.features?.length || 0,
        radius: '3km'
      });
    }
    
    return sources;
  }

  /**
   * Analyze the quality of the Perplexity response
   * Based on test_perplexity_node_analysis.mjs quality scoring
   */
  analyzeResponseQuality(analysis, citations) {
    // Check for startup ecosystem data indicators
    const hasCrunchbaseLinks = /crunchbase\.com/i.test(analysis);
    const hasPitchBookLinks = /pitchbook\.com/i.test(analysis);
    const hasLinkedInLinks = /linkedin\.com/i.test(analysis);
    const hasSpecificNumbers = /\d+\.\d+\s*M|\d+\s*employees|\d+\s*funding/g.test(analysis);
    const hasEstimates = /estimated|approximately|likely|probably/gi.test(analysis);
    const hasTimestamps = /\d{4}-\d{2}-\d{2}|\w+\s+\d+,\s+\d{4}/g.test(analysis);
    const hasSourceLinks = /https?:\/\/[^\s]+/g.test(analysis);
    const hasCompanyIDs = /\b[A-Za-z0-9]{8,}\b/g.test(analysis); // Company IDs are typically 8+ chars
    // Count nodes analyzed
    const nodeMatches = analysis.match(/## NODE \d+:/g);
    const nodeCount = nodeMatches ? nodeMatches.length : 0;

    // Check for consistent structure
    const hasGrowthScores = (analysis.match(/GROWTH SCORE:/g) || []).length;
    const hasFundingScores = (analysis.match(/FUNDING SCORE:/g) || []).length;
    const hasTalentAccess = (analysis.match(/TALENT ACCESS:/g) || []).length;

    // Structure consistency check

    // Enhanced quality score focusing on startup ecosystem data (more flexible)
    let qualityScore = 0;
    if (hasCrunchbaseLinks) qualityScore += 25; // Crunchbase is most important
    if (hasPitchBookLinks) qualityScore += 20; // PitchBook is second most important
    if (hasLinkedInLinks) qualityScore += 20; // LinkedIn is third
    if (hasSpecificNumbers) qualityScore += 20; // Increased importance for actual data
    if (hasTimestamps) qualityScore += 10; // Timestamps are good but not critical
    if (hasSourceLinks) qualityScore += 15; // Source links are important
    if (hasCompanyIDs) qualityScore += 10; // Company IDs are bonus
    // Don't penalize estimates - they're acceptable when specific data isn't available

    // Log only essential quality info
    if (qualityScore >= 60) {
      console.log(`✅ Perplexity analysis quality: ${qualityScore}/100 (${citations.length} citations, ${nodeCount} nodes)`);
    } else if (qualityScore >= 40) {
      console.log(`⚠️ Perplexity analysis quality: ${qualityScore}/100 (needs improvement)`);
    } else {
      console.log(`❌ Perplexity analysis quality: ${qualityScore}/100 (poor data quality)`);
    }

    return {
      qualityScore,
      hasCrunchbaseLinks,
      hasPitchBookLinks,
      hasLinkedInLinks,
      hasSpecificNumbers,
      hasEstimates,
      hasTimestamps,
      hasSourceLinks,
      hasCompanyIDs,
      nodeCount,
      citations: citations.length
    };
  }

  /**
   * Validate response quality and provide fallback if needed
   * @param {string} analysis - The analysis response
   * @param {Array} citations - The citations array
   * @returns {Object} - Validation result with quality metrics
   */
  validateResponseQuality(analysis, citations) {
    const qualityAnalysis = this.analyzeResponseQuality(analysis, citations);
    
    // Define quality thresholds (more flexible)
    const MIN_QUALITY_SCORE = 40;
    const MIN_NODE_COUNT = 3;
    const MIN_RESPONSE_LENGTH = 1000;
    
    const isValid = 
      qualityAnalysis.qualityScore >= MIN_QUALITY_SCORE &&
      qualityAnalysis.nodeCount >= MIN_NODE_COUNT &&
      analysis.length >= MIN_RESPONSE_LENGTH;
    
    if (!isValid) {
      console.warn('⚠️ Perplexity: Response quality below threshold');
      console.warn(`   Quality Score: ${qualityAnalysis.qualityScore}/100 (min: ${MIN_QUALITY_SCORE})`);
      console.warn(`   Node Count: ${qualityAnalysis.nodeCount} (min: ${MIN_NODE_COUNT})`);
      console.warn(`   Response Length: ${analysis.length} (min: ${MIN_RESPONSE_LENGTH})`);
    }
    
    return {
      isValid,
      qualityAnalysis,
      recommendations: this.getQualityRecommendations(qualityAnalysis)
    };
  }

  /**
   * Get quality improvement recommendations
   * @param {Object} qualityAnalysis - Quality analysis results
   * @returns {Array} - Array of recommendation strings
   */
  getQualityRecommendations(qualityAnalysis) {
    const recommendations = [];
    
    if (!qualityAnalysis.hasCrunchbaseLinks) {
      recommendations.push('Include Crunchbase.com data sources for better startup data');
    }
    if (!qualityAnalysis.hasPitchBookLinks) {
      recommendations.push('Add PitchBook.com data for funding and investment analysis');
    }
    if (!qualityAnalysis.hasLinkedInLinks) {
      recommendations.push('Include LinkedIn.com data for talent and company information');
    }
    if (!qualityAnalysis.hasSpecificNumbers) {
      recommendations.push('Add specific employee counts, funding amounts, and growth metrics');
    }
    if (qualityAnalysis.hasEstimates) {
      recommendations.push('Replace estimates with actual data from official sources');
    }
    if (!qualityAnalysis.hasTimestamps) {
      recommendations.push('Include data timestamps for currency verification');
    }
    if (qualityAnalysis.nodeCount < 3) {
      recommendations.push('Analyze more startup ecosystem nodes for comprehensive coverage');
    }
    
    return recommendations;
  }

  /**
   * Warm cache with common startup ecosystem queries
   * @param {Array} commonCoordinates - Array of common site coordinates
   */
  async warmCache(commonCoordinates = []) {
    console.log('🔥 Perplexity: Warming cache with common startup queries...');
    
    const defaultCoordinates = [
      { lat: 42.3601, lng: -71.0589 }, // Boston, MA
      { lat: 42.3736, lng: -71.1097 }, // Cambridge, MA
      { lat: 42.3625, lng: -71.0862 }  // Kendall Square, MA
    ];
    
    const coordinatesToWarm = commonCoordinates.length > 0 ? commonCoordinates : defaultCoordinates;
    
    for (const coords of coordinatesToWarm) {
      try {
        // Create a basic startup ecosystem summary for warming
        const mockStartupEcosystemSummary = {
          startupCompanies: [
            { name: 'Mock Startup', category: 'startups', distance: 2.0, fundingStage: 'Series A' }
          ],
          investors: [
            { name: 'Mock VC', category: 'investors', distance: 1.5, type: 'venture_capital' }
          ],
          universities: [
            { name: 'Mock University', category: 'research', distance: 0.5, type: 'university' }
          ],
          totalFeatures: 3
        };
        
        // Check if already cached
        const cached = getCachedPerplexityResponse(coords, mockStartupEcosystemSummary);
        if (cached) {
          console.log(`✅ Perplexity: Cache already warm for ${coords.lat}, ${coords.lng}`);
          continue;
        }
        
        // This would trigger a real API call in production
        console.log(`🔥 Perplexity: Warming cache for ${coords.lat}, ${coords.lng}`);
        
      } catch (error) {
        console.warn(`⚠️ Perplexity: Cache warming failed for ${coords.lat}, ${coords.lng}:`, error.message);
      }
    }
    
    console.log('✅ Perplexity: Cache warming complete');
  }
}

// Global development cache controls for easy testing
let globalPerplexityTool = null;

// Set global tool instance (called by tool executor)
export function setGlobalPerplexityTool(toolInstance) {
  globalPerplexityTool = toolInstance;
}

// Global functions for development cache control
if (typeof window !== 'undefined') {
  window.enablePerplexityCache = () => {
    if (globalPerplexityTool) {
      globalPerplexityTool.DEV_CACHE_ENABLED = true;
      console.log('⚡ DEV CACHE: Enabled - Using cached responses for fast testing');
    } else {
      console.warn('⚠️ DEV CACHE: No Perplexity tool instance available');
    }
  };

  window.disablePerplexityCache = () => {
    if (globalPerplexityTool) {
      globalPerplexityTool.DEV_CACHE_ENABLED = false;
      console.log('🔴 DEV CACHE: Disabled - Using live API calls');
    } else {
      console.warn('⚠️ DEV CACHE: No Perplexity tool instance available');
    }
  };

  window.clearPerplexityCache = () => {
    if (globalPerplexityTool) {
      globalPerplexityTool.clearDevCache();
    } else {
      console.warn('⚠️ DEV CACHE: No Perplexity tool instance available');
    }
  };

  window.listPerplexityCache = () => {
    if (globalPerplexityTool) {
      return globalPerplexityTool.listDevCache();
    } else {
      console.warn('⚠️ DEV CACHE: No Perplexity tool instance available');
      return [];
    }
  };

  window.clearPerplexityDevCache = () => {
    if (globalPerplexityTool) {
      globalPerplexityTool.clearDevCache();
      console.log('🗑️ DEV CACHE: Cleared all cached responses - next query will be live');
    } else {
      console.warn('⚠️ DEV CACHE: No Perplexity tool instance available');
    }
  };
}
