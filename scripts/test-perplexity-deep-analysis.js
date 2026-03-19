/**
 * Test Perplexity API with deep geographic intelligence analysis
 * Focus on spatial patterns and startup ecosystem insights
 */

require('dotenv').config({ path: '../.env' });

// Configuration
const PERPLEXITY_API_KEY = process.env.PRP;

// Test with 2 companies for deep analysis
const TEST_COMPANIES = [
  {
    name: "Liquid AI",
    headquarters: "Cambridge, Massachusetts, United States",
    industries: "Artificial Intelligence (AI), Generative AI, Information Technology, Machine Learning",
    description: "Build efficient general-purpose AI at every scale.",
    founded: "2023-01-01",
    cbRank: "347"
  },
  {
    name: "Blue Water Autonomy", 
    headquarters: "Boston, Massachusetts, United States",
    industries: "Machinery Manufacturing, Manufacturing, Marine Transportation, Shipping",
    description: "Blue Water Autonomy is a technology and shipbuilding company that revolutionizes naval operations through advanced autonomous vessels.",
    founded: "2024-01-01",
    cbRank: "523"
  }
];

async function testDeepGeographicAnalysis() {
  console.log('🧠 TESTING DEEP GEOGRAPHIC INTELLIGENCE ANALYSIS');
  console.log('================================================');
  console.log('');

  if (!PERPLEXITY_API_KEY) {
    console.error('❌ No Perplexity API key found');
    return;
  }

  for (let i = 0; i < TEST_COMPANIES.length; i++) {
    const company = TEST_COMPANIES[i];
    console.log(`\n🏢 DEEP ANALYSIS: ${company.name}`);
    console.log('─'.repeat(60));

    const prompt = `You are a geographic intelligence analyst specializing in startup ecosystem spatial patterns. Analyze this Boston/Cambridge startup company for DEEP GEOGRAPHIC INSIGHTS, not basic information.

COMPANY: ${company.name}
HEADQUARTERS: ${company.headquarters}
INDUSTRIES: ${company.industries}
FOUNDED: ${company.founded}
CB RANK: ${company.cbRank}

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
  "company_name": "${company.name}",
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
  },
  "data_sources": [
    "Specific URLs or sources used for analysis"
  ]
}

CRITICAL REQUIREMENTS:
- Use specific distances, addresses, and measurable data
- Focus on SPATIAL PATTERNS and GEOGRAPHIC INTELLIGENCE
- Provide actionable insights about location strategy
- Include specific addresses and coordinates where possible
- Analyze WHY this location was chosen, not just WHERE it is
- Connect location choice to business strategy and competitive positioning

Search for specific Boston/Cambridge geographic data, real estate information, transportation maps, and startup ecosystem density data.`;

    console.log('📝 Sending deep geographic analysis prompt...');
    console.log('');

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
        console.error(`❌ API Error ${response.status}:`, errorText);
        continue;
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      const citations = data.citations || [];
      const usage = data.usage || {};

      console.log('✅ Deep analysis received!');
      console.log(`⏱️  Duration: ${duration.toFixed(0)}ms`);
      console.log(`💰 Tokens used: ${usage.total_tokens || 'N/A'}`);
      console.log(`📚 Citations: ${citations.length}`);
      console.log('');

      console.log('🧠 GEOGRAPHIC INTELLIGENCE ANALYSIS:');
      console.log('─'.repeat(50));
      console.log(content);
      console.log('─'.repeat(50));
      console.log('');

      if (citations.length > 0) {
        console.log('📚 DATA SOURCES:');
        citations.forEach((citation, index) => {
          console.log(`${index + 1}. ${citation.title || 'Untitled'}`);
          console.log(`   URL: ${citation.url}`);
        });
        console.log('');
      }

      // Try to parse as JSON
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonData = JSON.parse(jsonMatch[0]);
          console.log('✅ STRUCTURED ANALYSIS PARSED:');
          console.log(JSON.stringify(jsonData, null, 2));
        } else {
          console.log('⚠️  No structured JSON found in response');
        }
      } catch (jsonError) {
        console.log('❌ Failed to parse structured analysis:', jsonError.message);
      }

    } catch (error) {
      console.error('❌ Error in deep analysis:', error.message);
    }

    // Add delay between requests
    if (i < TEST_COMPANIES.length - 1) {
      console.log('⏳ Waiting 3 seconds before next analysis...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log('\n🎯 DEEP ANALYSIS SUMMARY');
  console.log('========================');
  console.log('✅ Tested geographic intelligence analysis approach');
  console.log('📊 Review responses for depth and spatial insights');
  console.log('💰 Monitor token usage for cost analysis');
  console.log('');
  console.log('💡 NEXT STEPS:');
  console.log('1. Evaluate response quality and geographic depth');
  console.log('2. Assess if this approach scales to 60 companies');
  console.log('3. Consider cost implications for deep analysis');
  console.log('4. Refine prompt based on response quality');
}

// Run the test
testDeepGeographicAnalysis().catch(console.error);
