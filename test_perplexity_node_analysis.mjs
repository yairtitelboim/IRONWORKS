#!/usr/bin/env node

/**
 * Perplexity NODE Analysis Test Script
 * 
 * This script mimics the frontend's data sourcing flow to test Perplexity API responses
 * for NODE-level power grid reliability analysis.
 * 
 * Goal: Get real, time-bound ERCOT data with verifiable sources for each infrastructure node
 * 
 * Usage: node test_perplexity_node_analysis.js
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class PerplexityNodeTester {
  constructor() {
    this.apiKey = process.env.PRP || process.env.REACT_APP_PRP || process.env.PERPLEXITY_API_KEY;
    this.coordinates = { lat: 31.9315, lng: -97.347 }; // Whitney, TX site
    
    if (!this.apiKey) {
      console.error('❌ Error: PRP, REACT_APP_PRP, or PERPLEXITY_API_KEY not found in environment variables');
      process.exit(1);
    }
  }

  /**
   * Mock SERP data (simulating what SerpTool would provide)
   */
  getMockSerpData() {
    return {
      features: [
        {
          properties: {
            title: "Bosque Power Co LLC",
            category: "power plants",
            address: "Whitney, TX",
            coordinates: [31.8583068, -97.3573684],
            distance: 5.3,
            serp_id: "bosque_power_1"
          }
        },
        {
          properties: {
            title: "Hill County Water Supply Corporation",
            category: "electric utilities",
            address: "Whitney, TX",
            coordinates: [31.9366282, -97.3154463],
            distance: 1.0,
            serp_id: "hill_county_water_1"
          }
        },
        {
          properties: {
            title: "Oncor Electric Delivery",
            category: "electric utilities",
            address: "Whitney, TX",
            coordinates: [32.009084, -97.1345089],
            distance: 15.0,
            serp_id: "oncor_1"
          }
        },
        {
          properties: {
            title: "Lake Whitney Power Plant",
            category: "power plants",
            address: "Whitney, TX",
            coordinates: [31.8372294, -97.5463885],
            distance: 13.0,
            serp_id: "lake_whitney_power_1"
          }
        },
        {
          properties: {
            title: "Texas-New Mexico Power (TNMP)",
            category: "electric utilities",
            address: "Whitney, TX",
            coordinates: [31.9517078, -97.3205407],
            distance: 1.5,
            serp_id: "tnmp_1"
          }
        }
      ]
    };
  }

  /**
   * Mock OSM data (simulating what OsmTool would provide)
   */
  getMockOsmData() {
    return {
      features: [
        {
          properties: {
            name: "Lake Whitney Substation",
            power: "substation",
            operator: "Brazos Electric Power Coop",
            coordinates: [31.8372294, -97.5463885]
          }
        }
      ]
    };
  }

  /**
   * Build infrastructure summary (mimicking PerplexityTool.buildInfrastructureSummary)
   */
  buildInfrastructureSummary(serpData, osmData) {
    const summary = {
      powerInfrastructure: [],
      geographicFeatures: [],
      totalFeatures: 0
    };

    // Process SERP data
    if (serpData?.features) {
      serpData.features.forEach(feature => {
        const props = feature.properties;
        summary.powerInfrastructure.push({
          name: props.title,
          category: props.category,
          coordinates: props.coordinates,
          distance: props.distance,
          address: props.address,
          criticality: props.category === 'power plants' ? 'critical' : 'high'
        });
      });
    }

    // Process OSM data
    if (osmData?.features) {
      osmData.features.forEach(feature => {
        const props = feature.properties;
        summary.geographicFeatures.push({
          name: props.name,
          type: props.power || 'infrastructure',
          operator: props.operator,
          coordinates: props.coordinates
        });
      });
    }

    summary.totalFeatures = summary.powerInfrastructure.length + summary.geographicFeatures.length;
    return summary;
  }

  /**
   * Build enhanced data-driven prompt focused on EIA/FERC public data sources
   */
  buildEnhancedPrompt(coordinates, infrastructureSummary) {
    const { lat, lng } = coordinates;
    
    return `You are conducting a POWER GRID RELIABILITY ANALYSIS for a data center site in Whitney, Texas (${lat}, ${lng}).

**CRITICAL REQUIREMENT:** Use ONLY publicly available data from these verified sources with direct links.

**INFRASTRUCTURE NODES TO ANALYZE:**

**POWER INFRASTRUCTURE (within 15 miles):**
${infrastructureSummary.powerInfrastructure.map((item, index) =>
  `${index + 1}. **${item.name}** - ${item.category} (~${item.distance} miles)`
).join('\n')}

**GEOGRAPHIC INFRASTRUCTURE:**
${infrastructureSummary.geographicFeatures.map((item, index) =>
  `${index + 1}. **${item.name}** - ${item.type} (Operator: ${item.operator})`
).join('\n')}

**MANDATORY DATA SOURCES TO USE (with direct links):**

1. **EIA State Electricity Data:** https://www.eia.gov/electricity/data/state/
   - Texas power plant capacity and generation data
   - Historical reliability metrics by fuel type
   - Transmission infrastructure data

2. **EIA Power Plant Data:** https://www.eia.gov/electricity/data/eia860/
   - Individual plant capacity and operational data
   - Plant-specific generation and fuel consumption
   - Historical outage and maintenance data

3. **EIA Electric Power Monthly:** https://www.eia.gov/electricity/monthly/
   - Recent generation data by state and fuel type
   - Capacity factors and utilization rates
   - Regional electricity statistics

4. **FERC Electric Power Markets:** https://www.ferc.gov/market-oversight/markets-electricity
   - Regional transmission planning studies
   - Market reliability assessments
   - Infrastructure investment data

5. **ERCOT Public Reports:** https://www.ercot.com/news/reports
   - System reliability reports
   - Load forecasting studies
   - Transmission planning documents

6. **Texas PUC Filings:** https://www.puc.texas.gov/
   - Utility infrastructure filings
   - Reliability standards compliance
   - Regional planning documents

7. **EIA Electric Power Data Browser:** https://www.eia.gov/electricity/data/browser/
   - Interactive data queries for Texas
   - Plant-level generation and capacity data
   - Historical trends and analysis

**ANALYSIS REQUIREMENTS:**

For EACH node, provide:

## NODE X: **[Facility Name]**
- **Type:** [Facility type from EIA-860 database]
- **EIA Plant ID:** [EIA plant identifier with source link]
- **Current Status:** [Operational status from EIA data]

**1. POWER SCORE:** [X/10] **WITH SOURCE**
- **Nameplate Capacity:** [MW capacity from EIA-860 database]
- **Recent Generation:** [Actual generation from EIA state data]
- **Capacity Factor:** [From EIA Electric Power Monthly data]
- **Source Link:** [Direct EIA database URL]
- **Last Updated:** [Data timestamp from EIA]

**2. STABILITY SCORE:** [X/10] **WITH SOURCE**
- **ERCOT Zone:** [Load zone from ERCOT public reports]
- **Grid Integration:** [From FERC market oversight data]
- **Reliability Metrics:** [From EIA reliability data]
- **Source Link:** [ERCOT or FERC report URL]

**3. TRANSMISSION CAPACITY:** **WITH SOURCE**
- **Transmission Lines:** [From EIA transmission data]
- **Voltage Level:** [From FERC transmission studies]
- **Available Capacity:** [From ERCOT planning reports]
- **Regional Load:** [From EIA state electricity data]
- **Source Link:** [EIA or FERC transmission data URL]

**4. RELIABILITY METRICS:** **WITH SOURCE**
- **Historical Outages:** [From EIA plant operations data]
- **Fuel Dependencies:** [From EIA fuel consumption data]
- **Weather Resilience:** [From FERC reliability studies]
- **Maintenance History:** [From EIA plant data]
- **Source Links:** [EIA, FERC, or ERCOT report URLs]

**5. REGIONAL CONTEXT:** **WITH SOURCE**
- **Load Zone Analysis:** [From ERCOT load zone data]
- **Transmission Planning:** [From FERC regional studies]
- **Infrastructure Investment:** [From Texas PUC filings]
- **Regional Generation Mix:** [From EIA state data]
- **Source Links:** [ERCOT, FERC, or PUC document URLs]

**6. DATA CENTER IMPACT:** **WITH SOURCE**
- **Power Availability:** [From EIA generation data]
- **Transmission Redundancy:** [From FERC transmission studies]
- **Reliability Standards:** [From Texas PUC compliance data]
- **Grid Stability:** [From ERCOT system reports]
- **Source Link:** [Relevant regulatory document URL]

**OUTPUT FORMAT:** Each assessment MUST include:
1. Real numerical data from EIA/FERC/ERCOT sources
2. Direct source links to specific databases/reports
3. "Last Updated" timestamps from source data
4. Specific identifiers (EIA Plant ID, FERC docket numbers, etc.)

**REJECT:** Any speculative, estimated, or unsourced data. If real data is unavailable from these sources, state "Data not available from public EIA/FERC/ERCOT sources" rather than providing estimates.

**FOCUS ON:** Texas-specific data, recent reports (2023-2024), and verifiable infrastructure metrics that directly impact data center power reliability.

**SPECIAL INSTRUCTIONS:**
- Search for "Texas" specifically in EIA databases
- Look for "ERCOT" in FERC documents
- Check for "Hill County" or "Bosque County" in Texas PUC filings
- Use EIA Electric Power Data Browser for interactive queries
- Include capacity factors and utilization rates where available
- MUST include at least one FERC link from https://www.ferc.gov/market-oversight/markets-electricity
- MUST include at least one ERCOT link from https://www.ercot.com/news/reports
- MUST include EIA Plant IDs (5-6 digit numbers) where available
- MUST include "Last Updated" timestamps from source data
- If no specific plant data found, provide regional Texas data from EIA state electricity data

**CRITICAL:** You must find at least one FERC link, one ERCOT link, and one EIA Plant ID to achieve a high quality score.

Analyze NOW using only these verified public data sources:`;
  }

  /**
   * Test the Perplexity API with enhanced prompt
   */
  async testPerplexityAPI() {
    console.log('🧪 Starting Perplexity NODE Analysis Test...');
    console.log(`📍 Site: Whitney, TX (${this.coordinates.lat}, ${this.coordinates.lng})`);
    console.log('');

    // Simulate frontend data flow
    console.log('1️⃣ Simulating SERP data collection...');
    const serpData = this.getMockSerpData();
    console.log(`   Found ${serpData.features.length} power infrastructure facilities`);

    console.log('2️⃣ Simulating OSM data collection...');
    const osmData = this.getMockOsmData();
    console.log(`   Found ${osmData.features.length} geographic features`);

    console.log('3️⃣ Building infrastructure summary...');
    const infrastructureSummary = this.buildInfrastructureSummary(serpData, osmData);
    console.log(`   Total features: ${infrastructureSummary.totalFeatures}`);
    console.log(`   Power infrastructure: ${infrastructureSummary.powerInfrastructure.length}`);
    console.log(`   Geographic features: ${infrastructureSummary.geographicFeatures.length}`);

    console.log('4️⃣ Building enhanced prompt for real ERCOT data...');
    const prompt = this.buildEnhancedPrompt(this.coordinates, infrastructureSummary);
    console.log(`   Prompt length: ${prompt.length} characters`);

    console.log('5️⃣ Querying Perplexity API...');
    console.log('   ⏳ API call in progress... (this may take 10-30 seconds)');
    const startTime = Date.now();

    try {
      // Add timeout and progress logging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('   ⚠️ API call taking longer than expected... still waiting...');
      }, 15000); // Log after 15 seconds

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'sonar-pro',
          messages: [{
            role: 'user',
            content: prompt
          }],
          max_tokens: 3000,
          temperature: 0.1, // Lower temperature for more factual responses
          return_citations: true
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log('   ✅ API response received, parsing...');

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('   📊 Parsing response data...');
      
      const analysis = data.choices[0]?.message?.content;
      const citations = data.citations || [];
      const endTime = Date.now();

      console.log('✅ Perplexity API Response Received');
      console.log(`   Response time: ${endTime - startTime}ms`);
      console.log(`   Analysis length: ${analysis?.length || 0} characters`);
      console.log(`   Citations: ${citations.length}`);
      console.log('');

      // Display results
      console.log('📊 PERPLEXITY ANALYSIS RESULTS:');
      console.log('================================');
      console.log(analysis);
      console.log('');

      if (citations.length > 0) {
        console.log('📚 CITATIONS:');
        console.log('==============');
        citations.forEach((citation, index) => {
          console.log(`${index + 1}. ${citation}`);
        });
        console.log('');
      }

      // Analyze response quality
      this.analyzeResponseQuality(analysis, citations);

    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('❌ API call was aborted (timeout or manual cancellation)');
      } else {
        console.error('❌ Error testing Perplexity API:', error.message);
      }
      process.exit(1);
    }
  }

  /**
   * Analyze the quality of the Perplexity response
   */
  analyzeResponseQuality(analysis, citations) {
    console.log('🔍 RESPONSE QUALITY ANALYSIS:');
    console.log('==============================');

    // Check for EIA/FERC/ERCOT data indicators
    const hasEIALinks = /eia\.gov/i.test(analysis);
    const hasFERCLinks = /ferc\.gov/i.test(analysis);
    const hasERCOTLinks = /ercot\.com|ercot\.org/i.test(analysis);
    const hasSpecificNumbers = /\d+\.\d+\s*MW|\d+\s*MW/g.test(analysis);
    const hasEstimates = /estimated|approximately|likely|probably/gi.test(analysis);
    const hasTimestamps = /\d{4}-\d{2}-\d{2}|\w+\s+\d+,\s+\d{4}/g.test(analysis);
    const hasSourceLinks = /https?:\/\/[^\s]+/g.test(analysis);
    const hasEIAPlantIDs = /\b\d{5,6}\b/g.test(analysis); // EIA plant IDs are typically 5-6 digits

    console.log(`✅ Contains EIA links: ${hasEIALinks}`);
    console.log(`✅ Contains FERC links: ${hasFERCLinks}`);
    console.log(`✅ Contains ERCOT links: ${hasERCOTLinks}`);
    console.log(`✅ Contains specific MW numbers: ${hasSpecificNumbers}`);
    console.log(`❌ Contains estimates (should be minimal): ${hasEstimates}`);
    console.log(`✅ Contains timestamps: ${hasTimestamps}`);
    console.log(`✅ Contains source links: ${hasSourceLinks}`);
    console.log(`✅ Contains EIA Plant IDs: ${hasEIAPlantIDs}`);
    console.log(`📚 Number of citations: ${citations.length}`);

    // Count nodes analyzed
    const nodeMatches = analysis.match(/## NODE \d+:/g);
    const nodeCount = nodeMatches ? nodeMatches.length : 0;
    console.log(`🏢 Number of nodes analyzed: ${nodeCount}`);

    // Check for consistent structure
    const hasPowerScores = (analysis.match(/POWER SCORE:/g) || []).length;
    const hasStabilityScores = (analysis.match(/STABILITY SCORE:/g) || []).length;
    const hasTransmissionCapacity = (analysis.match(/TRANSMISSION CAPACITY:/g) || []).length;

    console.log(`📊 Consistent structure check:`);
    console.log(`   - Power scores: ${hasPowerScores}/${nodeCount}`);
    console.log(`   - Stability scores: ${hasStabilityScores}/${nodeCount}`);
    console.log(`   - Transmission capacity: ${hasTransmissionCapacity}/${nodeCount}`);

    // Enhanced quality score focusing on EIA/FERC data
    let qualityScore = 0;
    if (hasEIALinks) qualityScore += 30; // EIA is most important
    if (hasFERCLinks) qualityScore += 25; // FERC is second most important
    if (hasERCOTLinks) qualityScore += 20; // ERCOT is third
    if (hasSpecificNumbers) qualityScore += 15;
    if (!hasEstimates) qualityScore += 10;
    if (hasTimestamps) qualityScore += 15; // Increased importance
    if (hasSourceLinks) qualityScore += 10; // Increased importance
    if (hasEIAPlantIDs) qualityScore += 15; // Increased bonus for specific EIA identifiers

    console.log(`\n🎯 Overall Quality Score: ${qualityScore}/100`);
    
    if (qualityScore >= 80) {
      console.log('✅ EXCELLENT: Response meets real-data requirements');
    } else if (qualityScore >= 60) {
      console.log('⚠️ GOOD: Response has some real data but needs improvement');
    } else {
      console.log('❌ POOR: Response lacks real EIA/FERC/ERCOT data and sources');
    }
  }

  /**
   * Run the complete test
   */
  async run() {
    // Add process signal handlers for graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n⚠️ Received SIGINT (Ctrl+C). Shutting down gracefully...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n⚠️ Received SIGTERM. Shutting down gracefully...');
      process.exit(0);
    });

    try {
      console.log('🚀 Starting test... (Press Ctrl+C to cancel at any time)');
      await this.testPerplexityAPI();
      console.log('\n🎉 Test completed successfully!');
    } catch (error) {
      console.error('\n💥 Test failed:', error.message);
      process.exit(1);
    }
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new PerplexityNodeTester();
  tester.run();
}

export default PerplexityNodeTester;
