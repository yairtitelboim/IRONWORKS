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
    this.apiKey = process.env.REACT_APP_PRP || process.env.PERPLEXITY_API_KEY;
    this.coordinates = { lat: 31.9315, lng: -97.347 }; // Whitney, TX site
    
    if (!this.apiKey) {
      console.error('❌ Error: PERPLEXITY_API_KEY or REACT_APP_PRP not found in environment variables');
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
   * Build enhanced data-driven prompt focused on real ERCOT data
   */
  buildEnhancedPrompt(coordinates, infrastructureSummary) {
    const { lat, lng } = coordinates;
    
    return `You are conducting a REAL-TIME INFRASTRUCTURE AUDIT for a data center site in Whitney, Texas (${lat}, ${lng}).

**CRITICAL REQUIREMENT:** All data must be REAL, CURRENT, and include DIRECT SOURCE LINKS.

**INFRASTRUCTURE NODES TO AUDIT:**

**POWER INFRASTRUCTURE (within 15 miles):**
${infrastructureSummary.powerInfrastructure.map((item, index) =>
  `${index + 1}. **${item.name}** - ${item.category} (~${item.distance} miles)`
).join('\n')}

**GEOGRAPHIC INFRASTRUCTURE:**
${infrastructureSummary.geographicFeatures.map((item, index) =>
  `${index + 1}. **${item.name}** - ${item.type} (Operator: ${item.operator})`
).join('\n')}

**ANALYSIS REQUIREMENTS:**

For EACH node, provide:

## NODE X: **[Facility Name]**
- **Type:** [Exact facility type from ERCOT registration]
- **ERCOT Node ID:** [Real ERCOT node identifier with source link]
- **Current Status:** [Real-time operational status from ERCOT dashboard]

**1. POWER SCORE:** [X/10] **WITH SOURCE**
- **Real Generation Data:** [Current MW output from ERCOT real-time data]
- **Source Link:** [Direct ERCOT dashboard or report URL]
- **Last Updated:** [Timestamp of data]

**2. STABILITY SCORE:** [X/10] **WITH SOURCE**
- **ERCOT Zone:** [Actual ERCOT load zone from official records]
- **Grid Integration Status:** [From ERCOT market participant database]
- **Source Link:** [ERCOT registration or market data URL]

**3. TRANSMISSION CAPACITY:** **WITH SOURCE**
- **Actual Capacity:** [Real MW transmission capacity from ERCOT studies]
- **Current Load:** [Real-time load data from ERCOT]
- **Available Capacity:** [Calculated available capacity]
- **Source Link:** [ERCOT transmission planning report URL]

**4. ERCOT INTEGRATION:** **WITH SOURCE**
- **Market Participation:** [Actual ERCOT market participation status]
- **Registration Number:** [ERCOT resource registration number]
- **Last Market Activity:** [Recent market activity timestamp]
- **Source Link:** [ERCOT market participant list URL]

**5. RISK FACTORS:** **WITH SOURCE**
- **Recent Outages:** [Actual outage history from ERCOT forced outage reports]
- **Weather Vulnerabilities:** [From ERCOT weather impact studies]
- **Maintenance Schedule:** [Planned outages from ERCOT maintenance coordination]
- **Source Links:** [ERCOT outage reports, weather studies URLs]

**6. REDUNDANCY VALUE:** **WITH SOURCE**
- **Backup Systems:** [Actual redundancy from ERCOT reliability studies]
- **Alternative Paths:** [Real transmission alternatives from ERCOT grid maps]
- **Source Link:** [ERCOT reliability assessment URL]

**MANDATORY DATA SOURCES TO USE:**
- ERCOT Real-Time System Conditions
- ERCOT Market Information System (MIS)
- ERCOT Transmission Planning Reports
- ERCOT Generation Resource Database
- ERCOT Outage Scheduler
- ERCOT Load Zone Maps

**OUTPUT FORMAT:** Each assessment MUST include:
1. Real numerical data (not estimates)
2. Direct source links to ERCOT systems
3. "Last Updated" timestamps
4. Specific ERCOT identifiers (node IDs, registration numbers)

**REJECT:** Any speculative, estimated, or unsourced data. If real data is unavailable, state "Data not available from ERCOT sources" rather than providing estimates.

Analyze NOW with current ERCOT data:`;
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

    // Check for real data indicators
    const hasERCOTLinks = /ercot\.com|ercot\.org/i.test(analysis);
    const hasSpecificNumbers = /\d+\.\d+\s*MW|\d+\s*MW/g.test(analysis);
    const hasEstimates = /estimated|approximately|likely|probably/gi.test(analysis);
    const hasTimestamps = /\d{4}-\d{2}-\d{2}|\w+\s+\d+,\s+\d{4}/g.test(analysis);
    const hasSourceLinks = /https?:\/\/[^\s]+/g.test(analysis);
    const hasERCOTNodeIDs = /node\s+id|ercot\s+id|registration\s+number/gi.test(analysis);

    console.log(`✅ Contains ERCOT links: ${hasERCOTLinks}`);
    console.log(`✅ Contains specific MW numbers: ${hasSpecificNumbers}`);
    console.log(`❌ Contains estimates (should be minimal): ${hasEstimates}`);
    console.log(`✅ Contains timestamps: ${hasTimestamps}`);
    console.log(`✅ Contains source links: ${hasSourceLinks}`);
    console.log(`✅ Contains ERCOT node IDs: ${hasERCOTNodeIDs}`);
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

    // Overall quality score
    let qualityScore = 0;
    if (hasERCOTLinks) qualityScore += 20;
    if (hasSpecificNumbers) qualityScore += 20;
    if (!hasEstimates) qualityScore += 15;
    if (hasTimestamps) qualityScore += 15;
    if (hasSourceLinks) qualityScore += 15;
    if (citations.length > 0) qualityScore += 15;

    console.log(`\n🎯 Overall Quality Score: ${qualityScore}/100`);
    
    if (qualityScore >= 80) {
      console.log('✅ EXCELLENT: Response meets real-data requirements');
    } else if (qualityScore >= 60) {
      console.log('⚠️ GOOD: Response has some real data but needs improvement');
    } else {
      console.log('❌ POOR: Response lacks real ERCOT data and sources');
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
