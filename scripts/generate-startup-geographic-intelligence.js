/**
 * Generate startup geographic intelligence using Perplexity AI
 * Processes 60 companies in batches of 10 for deep geographic analysis
 * Outputs GeoJSON for map integration
 */

require('dotenv').config({ path: '../.env' });
const fs = require('fs');
const path = require('path');

// Configuration
const CSV_FILE = path.join(__dirname, '../public/companies-9-15-2025.csv');
const OUTPUT_FILE = path.join(__dirname, '../public/startup-geographic-intelligence.geojson');
const PERPLEXITY_API_KEY = process.env.PRP;

// Batch processing configuration
const BATCH_SIZE = 10;
const TOTAL_COMPANIES = 60;
const DELAY_BETWEEN_BATCHES = 5000; // 5 seconds between batches
const DELAY_BETWEEN_COMPANIES = 2000; // 2 seconds between companies

// Categories for visualization
const CATEGORIES = {
  'AI/ML': ['Artificial Intelligence (AI)', 'Machine Learning', 'Generative AI', 'Computer Vision', 'Natural Language Processing'],
  'Biotech/Health': ['Biotechnology', 'Health Care', 'Medical Device', 'Pharmaceutical', 'Life Sciences', 'Digital Health'],
  'FinTech': ['Financial Services', 'FinTech', 'Payments', 'Banking', 'Insurance'],
  'CleanTech': ['Clean Energy', 'Environmental Services', 'Sustainability', 'Renewable Energy'],
  'Enterprise': ['Enterprise Software', 'SaaS', 'B2B', 'Productivity Software'],
  'Hardware': ['Hardware', 'Electronics', 'Manufacturing', 'IoT'],
  'Other': []
};

const CATEGORY_COLORS = {
  'AI/ML': '#FF6B6B',      // Red
  'Biotech/Health': '#4ECDC4', // Teal
  'FinTech': '#45B7D1',    // Blue
  'CleanTech': '#96CEB4',  // Green
  'Enterprise': '#FFEAA7', // Yellow
  'Hardware': '#DDA0DD',   // Plum
  'Other': '#A0A0A0'       // Gray
};

const CATEGORY_ICONS = {
  'AI/ML': '🤖',
  'Biotech/Health': '🧬',
  'FinTech': '💳',
  'CleanTech': '🌱',
  'Enterprise': '🏢',
  'Hardware': '⚙️',
  'Other': '🚀'
};

function assignCategory(industries) {
  for (const category in CATEGORIES) {
    if (category === 'Other') continue;
    if (CATEGORIES[category].some(keyword => industries.includes(keyword))) {
      return category;
    }
  }
  return 'Other';
}

async function queryPerplexityForGeographicIntelligence(company) {
  const companyName = company['Organization Name'] || 'Unknown Company';
  const headquarters = company['Headquarters Location'] || 'Unknown Location';
  const industries = company['Industries'] || 'Unknown Industries';
  const founded = company['Founded Date'] || 'Unknown';
  const cbRank = company['CB Rank (Organization)'] || 'Unknown';
  
  const prompt = `You are a geographic intelligence analyst specializing in startup ecosystem spatial patterns. Analyze this Boston/Cambridge startup company for DEEP GEOGRAPHIC INSIGHTS, not basic information.

COMPANY: ${companyName}
HEADQUARTERS: ${headquarters}
INDUSTRIES: ${industries}
FOUNDED: ${founded}
CB RANK: ${cbRank}

ANALYSIS FRAMEWORK - Focus on these specific geographic intelligence questions:

1. **ACADEMIC PROXIMITY PATTERN**: 
   - What is the exact distance to MIT, Harvard, Northeastern, BU, and Tufts?
   - Which university's research labs/centers are most relevant to this company's technology?
   - How does this company's location leverage the "academic arbitrage" - proximity to PhD talent and research facilities?

2. **INFRASTRUCTURE DEPENDENCY ANALYSIS**:
   - What specific transportation infrastructure (T stops, bus routes) serves this location?
   - How does this location's transit access compare to other Boston startup clusters?
   - What is the walkability score and pedestrian connectivity to key business districts?

3. **ECONOMIC GEOGRAPHY INSIGHTS**:
   - What is the office rent/sqft in this specific area vs. other Boston startup zones?
   - How does this location's cost structure compare to Kendall Square, Seaport, Back Bay?
   - What commercial real estate trends are driving this company's location choice?

4. **NETWORK EFFECTS MAPPING**:
   - What other startups, VCs, or tech companies are within 0.5 miles of this location?
   - How does this location position the company for serendipitous networking and partnerships?
   - What is the "startup density" in this specific neighborhood?

5. **COMPETITIVE LANDSCAPE POSITIONING**:
   - How does this location give the company competitive advantages in talent acquisition?
   - What regulatory or zoning advantages does this location provide?
   - How does this location affect the company's ability to attract investors and customers?

6. **FUTURE GROWTH TRAJECTORY**:
   - What expansion opportunities exist in this geographic area?
   - How might this location constrain or enable the company's growth plans?
   - What infrastructure developments are planned that could impact this location?

REQUIRED OUTPUT FORMAT - Return JSON with this exact structure:

{
  "company_name": "${companyName}",
  "coordinates": {
    "lat": 42.XXXXX,
    "lng": -71.XXXXX
  },
  "address": "Specific street address",
  "geographic_intelligence": {
    "academic_proximity": {
      "mit_distance_miles": "X.X",
      "harvard_distance_miles": "X.X", 
      "northeastern_distance_miles": "X.X",
      "bu_distance_miles": "X.X",
      "tufts_distance_miles": "X.X",
      "most_relevant_university": "University name and why",
      "academic_arbitrage_score": "X/10 (how well positioned for university talent/research)"
    },
    "infrastructure_access": {
      "nearest_t_stop": "Station name and line",
      "walkability_score": "X/10",
      "transit_connectivity": "Description of transit options",
      "pedestrian_connectivity": "Description of walkability to key areas"
    },
    "economic_geography": {
      "estimated_rent_psf": "$X",
      "cost_vs_kendall_square": "X% higher/lower",
      "cost_vs_seaport": "X% higher/lower", 
      "commercial_real_estate_trends": "Description of area's real estate dynamics"
    },
    "network_effects": {
      "startup_density_0_5_miles": "X companies",
      "vc_proximity": "Nearest VC offices and distances",
      "tech_company_clusters": "Description of nearby tech companies",
      "networking_opportunities": "Assessment of serendipitous meeting potential"
    },
    "competitive_positioning": {
      "talent_acquisition_advantage": "How location helps with hiring",
      "investor_access": "How location affects investor meetings",
      "customer_proximity": "How location affects customer access",
      "regulatory_advantages": "Any zoning or regulatory benefits"
    },
    "growth_trajectory": {
      "expansion_opportunities": "Nearby spaces for growth",
      "infrastructure_constraints": "Potential limitations",
      "planned_developments": "Upcoming infrastructure that could impact location"
    }
  },
  "spatial_insights": {
    "clustering_pattern": "Why this company chose this specific location",
    "geographic_advantages": "Top 3 location-based competitive advantages", 
    "geographic_risks": "Top 3 location-based challenges or risks",
    "ecosystem_positioning": "How this location positions the company in Boston's startup ecosystem"
  }
}

CRITICAL REQUIREMENTS:
- Use specific distances, addresses, and measurable data
- Focus on SPATIAL PATTERNS and GEOGRAPHIC INTELLIGENCE
- Provide actionable insights about location strategy
- Include specific addresses and coordinates where possible
- Analyze WHY this location was chosen, not just WHERE it is
- Connect location choice to business strategy and competitive positioning

Search for specific Boston/Cambridge geographic data, real estate information, transportation maps, and startup ecosystem density data.`;

  try {
    const startTime = performance.now();
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [{
          role: 'user',
          content: prompt
        }],
        max_tokens: 2000,
        temperature: 0.1,
        return_citations: true
      })
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    const usage = data.usage || {};

    console.log(`✅ ${companyName}: Analysis received (${duration.toFixed(0)}ms, ${usage.total_tokens || 'N/A'} tokens)`);

    // Try to parse JSON from response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          data: jsonData,
          usage: usage,
          duration: duration
        };
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (jsonError) {
      console.error(`❌ ${companyName}: Failed to parse JSON:`, jsonError.message);
      return {
        success: false,
        error: `JSON parsing failed: ${jsonError.message}`,
        rawContent: content
      };
    }

  } catch (error) {
    console.error(`❌ ${companyName}: Error querying Perplexity:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

async function processBatch(companies, batchNumber) {
  console.log(`\n🔄 PROCESSING BATCH ${batchNumber} (${companies.length} companies)`);
  console.log('─'.repeat(60));

  const results = [];
  
  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    const companyName = company['Organization Name'] || 'Unknown Company';
    console.log(`\n🏢 ${batchNumber}.${i + 1}: ${companyName}`);
    
    const result = await queryPerplexityForGeographicIntelligence(company);
    results.push({
      company: company,
      result: result
    });

    // Add delay between companies (except for the last one in batch)
    if (i < companies.length - 1) {
      console.log(`⏳ Waiting ${DELAY_BETWEEN_COMPANIES/1000}s before next company...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_COMPANIES));
    }
  }

  return results;
}

async function generateGeographicIntelligence() {
  console.log('🧠 GENERATING STARTUP GEOGRAPHIC INTELLIGENCE');
  console.log('============================================');
  console.log('');

  if (!PERPLEXITY_API_KEY) {
    console.error('❌ No Perplexity API key found');
    return;
  }

  // Load companies from CSV
  const companies = [];
  const csv = require('csv-parser');
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(CSV_FILE)
      .pipe(csv())
      .on('data', (row) => {
        companies.push(row);
      })
      .on('end', async () => {
        console.log(`📊 Loaded ${companies.length} companies from CSV`);
        
        // Take first 60 companies
        const selectedCompanies = companies.slice(0, TOTAL_COMPANIES);
        console.log(`🎯 Processing ${selectedCompanies.length} companies in batches of ${BATCH_SIZE}`);
        
        // Process in batches
        const allResults = [];
        const totalBatches = Math.ceil(selectedCompanies.length / BATCH_SIZE);
        
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const startIndex = batchIndex * BATCH_SIZE;
          const endIndex = Math.min(startIndex + BATCH_SIZE, selectedCompanies.length);
          const batchCompanies = selectedCompanies.slice(startIndex, endIndex);
          
          const batchResults = await processBatch(batchCompanies, batchIndex + 1);
          allResults.push(...batchResults);
          
          // Add delay between batches (except for the last one)
          if (batchIndex < totalBatches - 1) {
            console.log(`\n⏳ Waiting ${DELAY_BETWEEN_BATCHES/1000}s before next batch...`);
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
          }
        }
        
        // Process results and create GeoJSON
        console.log('\n📊 PROCESSING RESULTS...');
        const features = [];
        let successCount = 0;
        let failureCount = 0;
        
        allResults.forEach(({ company, result }) => {
          if (result.success && result.data.coordinates) {
            const category = assignCategory(company['Industries']);
            const companyName = company['Organization Name'] || 'Unknown Company';
            const feature = {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [result.data.coordinates.lng, result.data.coordinates.lat]
              },
              properties: {
                id: `startup_${companyName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
                name: companyName,
                url: company['Organization Name URL'] || '',
                description: company['Operating Status'] || '',
                headquarters: company['Headquarters Location'] || '',
                category: category,
                categoryIcon: CATEGORY_ICONS[category],
                categoryColor: CATEGORY_COLORS[category],
                fundingStage: company['Stage'] || 'Unknown',
                industries: company['Industries'] || '',
                foundedDate: company['Founded Date'] || '',
                cbRank: company['CB Rank (Organization)'] || '',
                address: result.data.address || 'Address not found',
                geographicIntelligence: result.data.geographic_intelligence,
                spatialInsights: result.data.spatial_insights,
                analysisMetadata: {
                  processedAt: new Date().toISOString(),
                  analysisDuration: result.duration,
                  tokenUsage: result.usage
                }
              }
            };
            features.push(feature);
            successCount++;
          } else {
            const companyName = company['Organization Name'] || 'Unknown Company';
            console.warn(`⚠️  Failed to process ${companyName}: ${result.error || 'Unknown error'}`);
            failureCount++;
          }
        });
        
        // Create GeoJSON
        const geojson = {
          type: 'FeatureCollection',
          features: features,
          metadata: {
            generatedAt: new Date().toISOString(),
            totalCompanies: selectedCompanies.length,
            successfulAnalyses: successCount,
            failedAnalyses: failureCount,
            successRate: `${((successCount / selectedCompanies.length) * 100).toFixed(1)}%`,
            source: path.basename(CSV_FILE),
            analysisService: 'perplexity-ai',
            version: '1.0.0',
            description: 'Startup geographic intelligence analysis for Boston/Cambridge ecosystem'
          }
        };
        
        // Save GeoJSON
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(geojson, null, 2));
        
        console.log('\n🎉 GEOGRAPHIC INTELLIGENCE GENERATION COMPLETE!');
        console.log('================================================');
        console.log(`✅ Successfully analyzed: ${successCount} companies`);
        console.log(`❌ Failed analyses: ${failureCount} companies`);
        console.log(`📈 Success rate: ${((successCount / selectedCompanies.length) * 100).toFixed(1)}%`);
        console.log(`📁 Output file: ${OUTPUT_FILE}`);
        console.log(`🗺️  GeoJSON features: ${features.length}`);
        console.log('');
        console.log('💡 NEXT STEPS:');
        console.log('1. Add layer toggle to LayerToggle.jsx');
        console.log('2. Integrate with map visualization');
        console.log('3. Add legend and category filtering');
        console.log('4. Test map interaction and popups');
        
        resolve(geojson);
      })
      .on('error', reject);
  });
}

// Run the generation
generateGeographicIntelligence().catch(console.error);
