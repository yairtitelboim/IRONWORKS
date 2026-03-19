#!/usr/bin/env node

/**
 * TestRunner.js - Local Test Runner for BespokeAnalysisTool
 * 
 * PURPOSE: Run TestToolV01.js locally with terminal output
 * USAGE: node src/components/Map/components/TestRunner.js [location] [radius] [analysisType]
 * 
 * FEATURES:
 * - Loads environment variables from .env
 * - Provides terminal-friendly output
 * - Supports command line arguments
 * - Shows real-time progress
 * - Displays formatted results
 * - Can use test data for development
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { BespokeAnalysisTool } from './TestToolV01.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../../../.env');
dotenv.config({ path: envPath });

// Keys must be set in .env — no hardcoded fallbacks
if (!process.env.REACT_APP_MAPBOX_TOKEN) {
  console.warn('REACT_APP_MAPBOX_TOKEN not set in .env');
}
if (!process.env.REACT_APP_PRP) {
  console.warn('REACT_APP_PRP not set in .env');
}
if (!process.env.REACT_APP_GOOGLE_PLACES_KEY) {
  console.warn('REACT_APP_GOOGLE_PLACES_KEY not set in .env');
}

class TestRunner {
  constructor() {
    this.colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      dim: '\x1b[2m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m'
    };
    
    this.bespokeAnalysis = new BespokeAnalysisTool();
  }

  /**
   * Run the analysis with terminal output
   */
  async run(config) {
    const { location, radius, analysisType, useTestData = false } = config;
    
    this.printHeader(location, radius, analysisType);
    
    try {
      // Check environment variables
      this.checkEnvironmentVariables();
      
      let result;
      
      if (useTestData) {
        // Use test data for development
        result = this.getTestData(location, radius, analysisType);
        this.printSuccess('✅ Using test data for development');
      } else {
        // Run actual analysis
        const startTime = Date.now();
        result = await this.bespokeAnalysis.run(config);
        const endTime = Date.now();
        result.executionTime = endTime - startTime;
      }
      
      // Display results
      this.displayResults(result, result.executionTime || 0);
      
    } catch (error) {
      this.printError(`❌ Analysis failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Get test data for development
   */
  getTestData(location, radius, analysisType) {
    return {
      metadata: {
        location,
        radius,
        analysisType,
        coordinates: { lat: 31.9315, lng: -97.347 },
        timestamp: Date.now(),
        version: '1.0',
        dataSources: [
          'EIA State Electricity Data',
          'EIA Power Plant Data', 
          'ERCOT Public Reports',
          'Texas PUC Filings',
          'Google Places API (SERP fallback)'
        ]
      },
      infrastructure: {
        serp: {
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-97.347, 31.9315] },
              properties: {
                name: 'Bosque Power Co LLC',
                category: 'power plants',
                infrastructure_type: 'power_generation',
                criticality_level: 'critical',
                power_generation: true
              }
            },
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-97.340, 31.925] },
              properties: {
                name: 'Lake Whitney Power Plant',
                category: 'power plants',
                infrastructure_type: 'power_generation',
                criticality_level: 'high',
                power_generation: true
              }
            }
          ],
          powerPlantsCount: 2,
          substationsCount: 3,
          fiberConnectivity: 'Multiple carriers available'
        },
        osm: {
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-97.347, 31.9315] },
              properties: {
                name: 'Oncor Electric Delivery',
                category: 'power_substation',
                power: 'substation',
                voltage: '345000'
              }
            }
          ],
          visualLayers: {
            transmission: [
              { type: 'Feature', geometry: { type: 'LineString', coordinates: [[-97.347, 31.9315], [-97.340, 31.925]] } }
            ],
            substations: [
              { type: 'Feature', geometry: { type: 'Point', coordinates: [-97.347, 31.9315] } }
            ],
            water: [
              { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[-97.350, 31.930], [-97.345, 31.930], [-97.345, 31.935], [-97.350, 31.935], [-97.350, 31.930]]] } }
            ]
          },
          substationsCount: 3,
          waterAccess: 'Water features available',
          landUse: 'Industrial zones present',
          transportationAccess: 'Major transportation nearby',
          criticalInfrastructure: 'Critical facilities nearby'
        },
        perplexity: {
          success: true,
          tool: 'PERPLEXITY',
          data: {
            data: `## NODE 1: **Bosque Power Co LLC**
- **Type:** Power Plant (Natural Gas, Combined Cycle) [EIA-860]
- **EIA Plant ID:** 78242 [EIA Power Plant Data]
- **Current Status:** Operational [EIA-860]

**1. POWER SCORE:** 9/10
- **Nameplate Capacity:** 800 MW [EIA-860, 2023]
- **Recent Generation:** 5,200,000 MWh (2023) [EIA State Electricity Data]
- **Capacity Factor:** 74.2% (2023, Texas NGCC average) [EIA Electric Power Monthly]
- **Source Link:** https://www.eia.gov/electricity/data/eia860/
- **Last Updated:** October 2023

**2. STABILITY SCORE:** 8/10
- **ERCOT Zone:** North [ERCOT Public Reports]
- **Grid Integration:** Directly connected to ERCOT transmission grid [FERC Market Oversight]
- **Reliability Metrics:** Texas NGCC plants report forced outage rates <3% [EIA State Reliability Data]
- **Source Link:** https://www.ercot.com/news/reports
- **Last Updated:** August 2024

**3. TRANSMISSION CAPACITY:**
- **Transmission Lines:** 345 kV lines connect to ERCOT backbone [EIA Transmission Data]
- **Voltage Level:** 345 kV [FERC Transmission Studies]
- **Available Capacity:** North zone surplus >5,000 MW (2024) [ERCOT Resource Adequacy]
- **Regional Load:** North zone peak ~24,000 MW (2023) [EIA State Data]
- **Source Link:** https://www.ferc.gov/market-oversight/markets-electricity
- **Last Updated:** July 2024

**4. RELIABILITY METRICS:**
- **Historical Outages:** No major outages reported 2022–2024 [EIA Plant Operations]
- **Fuel Dependencies:** Natural gas, dual-fuel capability [EIA Fuel Data]
- **Weather Resilience:** Upgrades post-2021 winter event [FERC Reliability Studies]
- **Maintenance History:** Scheduled annual maintenance, no extended forced outages [EIA Plant Data]
- **Source Links:** https://www.eia.gov/electricity/data/eia860/, https://www.ferc.gov/market-oversight/markets-electricity
- **Last Updated:** October 2023

**5. REGIONAL CONTEXT:**
- **Load Zone Analysis:** North zone, high reserve margin [ERCOT Load Zone Data]
- **Transmission Planning:** Ongoing upgrades for North Texas [FERC Regional Studies]
- **Infrastructure Investment:** Recent filings for capacity expansion [Texas PUC Filings]
- **Regional Generation Mix:** 48% natural gas, 23% wind, 18% coal, 11% other (2023) [EIA State Data]
- **Source Links:** https://www.ercot.com/news/reports, https://www.puc.texas.gov/
- **Last Updated:** August 2024

**6. DATA CENTER IMPACT:**
- **Power Availability:** High, with significant surplus in North zone [EIA Generation Data]
- **Transmission Redundancy:** Multiple 345 kV paths [FERC Transmission Studies]
- **Reliability Standards:** Meets ERCOT and PUC standards [Texas PUC Compliance]
- **Grid Stability:** Strong, with low forced outage rates [ERCOT System Reports]
- **Source Link:** https://www.ercot.com/news/reports
- **Last Updated:** August 2024

---

## NODE 2: **Lake Whitney Power Plant**
- **Type:** Power Plant (Hydroelectric) [EIA-860]
- **EIA Plant ID:** 6414 [EIA Power Plant Data]
- **Current Status:** Operational [EIA-860]

**1. POWER SCORE:** 6/10
- **Nameplate Capacity:** 48 MW [EIA-860]
- **Recent Generation:** ~120,000 MWh (2023, hydro estimate) [EIA State Electricity Data]
- **Capacity Factor:** 28.5% (2023, Texas hydro average) [EIA Electric Power Monthly]
- **Source Link:** https://www.eia.gov/electricity/data/eia860/
- **Last Updated:** October 2023

**2. STABILITY SCORE:** 7/10
- **ERCOT Zone:** North [ERCOT Public Reports]
- **Grid Integration:** Direct tie to ERCOT grid [FERC Market Oversight]
- **Reliability Metrics:** Hydro plants have low forced outage rates (<2%) [EIA Reliability Data]
- **Source Link:** https://www.ercot.com/news/reports
- **Last Updated:** August 2024

**3. TRANSMISSION CAPACITY:**
- **Transmission Lines:** 69 kV/138 kV lines to regional substations [EIA Transmission Data]
- **Voltage Level:** 69/138 kV [FERC Transmission Studies]
- **Available Capacity:** Small relative to regional load [ERCOT Resource Adequacy]
- **Regional Load:** See Node 1
- **Source Link:** https://www.ferc.gov/market-oversight/markets-electricity
- **Last Updated:** July 2024

**4. RELIABILITY METRICS:**
- **Historical Outages:** No major outages reported 2022–2024 [EIA Plant Operations]
- **Fuel Dependencies:** Water inflow (hydro) [EIA Fuel Data]
- **Weather Resilience:** Subject to drought risk [FERC Reliability Studies]
- **Maintenance History:** Routine, per USACE schedule [EIA Plant Data]
- **Source Links:** https://www.eia.gov/electricity/data/eia860/, https://www.ferc.gov/market-oversight/markets-electricity
- **Last Updated:** October 2023

**5. REGIONAL CONTEXT:**
- **Load Zone Analysis:** North zone [ERCOT Load Zone Data]
- **Transmission Planning:** Minor role in regional planning [FERC Regional Studies]
- **Infrastructure Investment:** Limited, focused on maintenance [Texas PUC Filings]
- **Regional Generation Mix:** See Node 1
- **Source Links:** https://www.ercot.com/news/reports, https://www.puc.texas.gov/
- **Last Updated:** August 2024

**6. DATA CENTER IMPACT:**
- **Power Availability:** Limited, not primary supply [EIA Generation Data]
- **Transmission Redundancy:** Supported by larger grid [FERC Transmission Studies]
- **Reliability Standards:** Meets ERCOT/PUC standards [Texas PUC Compliance]
- **Grid Stability:** Stable, but not a major contributor [ERCOT System Reports]
- **Source Link:** https://www.ercot.com/news/reports
- **Last Updated:** August 2024`,
            citations: [
              'https://www.eia.gov/electricity/data/eia860/',
              'https://www.ercot.com/news/reports',
              'https://www.ferc.gov/market-oversight/markets-electricity',
              'https://www.puc.texas.gov/'
            ],
            timestamp: Date.now(),
            confidence: 0.9,
            cached: false
          },
          timestamp: Date.now()
        }
      },
      summary: {
        powerInfrastructure: {
          powerPlants: 2,
          substations: 3,
          transmissionLines: 1
        },
        geographicFeatures: {
          waterAccess: 'Water features available',
          landUse: 'Industrial zones present',
          transportation: 'Major transportation nearby'
        },
        analysisQuality: {
          serpSuccess: true,
          osmSuccess: true,
          perplexitySuccess: true
        },
        infrastructureBreakdown: {
          totalFeatures: 6,
          dataQuality: 90
        }
      },
      recommendations: [
        'SERP analysis completed successfully',
        'OSM mapping completed successfully',
        'Perplexity analysis completed successfully'
      ],
      dataQuality: {
        score: 90,
        maxScore: 100,
        details: {
          serp: 'Good',
          osm: 'Good',
          perplexity: 'Good'
        }
      },
      infrastructureCounts: {
        powerPlants: 2,
        substations: 3,
        transmissionLines: 1,
        waterFeatures: 1
      }
    };
  }

  /**
   * Check required environment variables
   */
  checkEnvironmentVariables() {
    const requiredVars = [
      'REACT_APP_MAPBOX_TOKEN',
      'REACT_APP_PRP'
    ];
    
    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      this.printError(`Missing required environment variables: ${missing.join(', ')}`);
      this.printError('Please check your .env file');
      process.exit(1);
    }
    
    this.printSuccess('✅ Environment variables loaded successfully');
  }

  /**
   * Display formatted results
   */
  displayResults(result, executionTime) {
    console.log('\n' + '='.repeat(80));
    console.log(`${this.colors.bright}${this.colors.cyan}🏢 INFRASTRUCTURE ANALYSIS RESULTS${this.colors.reset}`);
    console.log('='.repeat(80));
    
    // Metadata
    console.log(`\n${this.colors.bright}📍 LOCATION:${this.colors.reset}`);
    console.log(`   Address: ${result.metadata.location}`);
    console.log(`   Coordinates: ${result.metadata.coordinates.lat}, ${result.metadata.coordinates.lng}`);
    console.log(`   Analysis Radius: ${result.metadata.radius} miles`);
    console.log(`   Analysis Type: ${result.metadata.analysisType}`);
    console.log(`   Execution Time: ${executionTime}ms`);
    
    // Infrastructure Summary
    console.log(`\n${this.colors.bright}⚡ INFRASTRUCTURE SUMMARY:${this.colors.reset}`);
    console.log(`   Power Plants: ${result.infrastructureCounts.powerPlants}`);
    console.log(`   Substations: ${result.infrastructureCounts.substations}`);
    console.log(`   Transmission Lines: ${result.infrastructureCounts.transmissionLines}`);
    console.log(`   Water Features: ${result.infrastructureCounts.waterFeatures}`);
    
    // Geographic Context
    console.log(`\n${this.colors.bright}🗺️ GEOGRAPHIC CONTEXT:${this.colors.reset}`);
    console.log(`   Water Access: ${result.summary.geographicFeatures.waterAccess}`);
    console.log(`   Land Use: ${result.summary.geographicFeatures.landUse}`);
    console.log(`   Transportation: ${result.summary.geographicFeatures.transportation}`);
    
    // Data Quality
    console.log(`\n${this.colors.bright}📊 DATA QUALITY:${this.colors.reset}`);
    console.log(`   Overall Score: ${result.dataQuality.score}%`);
    console.log(`   SERP Success: ${result.summary.analysisQuality.serpSuccess ? '✅' : '❌'}`);
    console.log(`   OSM Success: ${result.summary.analysisQuality.osmSuccess ? '✅' : '❌'}`);
    console.log(`   Perplexity Success: ${result.summary.analysisQuality.perplexitySuccess ? '✅' : '❌'}`);
    
    // Perplexity Analysis
    if (result.infrastructure.perplexity && result.infrastructure.perplexity.data) {
      console.log(`\n${this.colors.bright}🧠 AI ANALYSIS (Perplexity):${this.colors.reset}`);
      this.displayPerplexityAnalysis(result.infrastructure.perplexity.data);
    }
    
    // Source Links
    if (result.infrastructure.perplexity && result.infrastructure.perplexity.data) {
      console.log(`\n${this.colors.bright} SOURCE LINKS FOUND:${this.colors.reset}`);
      this.displaySourceLinks(result.infrastructure.perplexity.data);
    }
    
    // Recommendations
    if (result.recommendations && result.recommendations.length > 0) {
      console.log(`\n${this.colors.bright} RECOMMENDATIONS:${this.colors.reset}`);
      result.recommendations.forEach(rec => {
        console.log(`   • ${rec}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`${this.colors.green}✅ Analysis Complete!${this.colors.reset}`);
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Display Perplexity analysis with formatting
   */
  displayPerplexityAnalysis(data) {
    if (!data || !data.data) {
      console.log('   No analysis data available');
      return;
    }
    
    const analysis = data.data;
    
    // Split analysis into sections
    const sections = analysis.split('## NODE');
    
    sections.forEach((section, index) => {
      if (index === 0) {
        // Introduction section
        const intro = section.trim();
        if (intro) {
          console.log(`\n${this.colors.dim}${intro}${this.colors.reset}`);
        }
      } else {
        // Node sections
        const nodeContent = section.trim();
        if (nodeContent) {
          console.log(`\n${this.colors.yellow}## NODE${nodeContent}${this.colors.reset}`);
        }
      }
    });
  }

  /**
   * Display source links found in analysis
   */
  displaySourceLinks(data) {
    if (!data || !data.data) {
      console.log('   No source links found');
      return;
    }
    
    const analysis = data.data;
    
    // Extract links from analysis
    const linkRegex = /https?:\/\/[^\s]+/g;
    const links = analysis.match(linkRegex) || [];
    
    // Categorize links
    const categorizedLinks = {
      eia: links.filter(link => link.includes('eia.gov')),
      ferc: links.filter(link => link.includes('ferc.gov')),
      ercot: links.filter(link => link.includes('ercot.com') || link.includes('ercot.org')),
      puc: links.filter(link => link.includes('puc.texas.gov')),
      other: links.filter(link => 
        !link.includes('eia.gov') && 
        !link.includes('ferc.gov') && 
        !link.includes('ercot.com') && 
        !link.includes('ercot.org') && 
        !link.includes('puc.texas.gov')
      )
    };
    
    // Display categorized links
    Object.entries(categorizedLinks).forEach(([category, links]) => {
      if (links.length > 0) {
        console.log(`\n   ${this.colors.bright}${category.toUpperCase()}:${this.colors.reset}`);
        links.forEach(link => {
          console.log(`     ${this.colors.cyan}${link}${this.colors.reset}`);
        });
      }
    });
    
    // Display total count
    console.log(`\n   ${this.colors.dim}Total source links found: ${links.length}${this.colors.reset}`);
  }

  /**
   * Print header
   */
  printHeader(location, radius, analysisType) {
    console.log('\n' + '='.repeat(80));
    console.log(`${this.colors.bright}${this.colors.magenta}🚀 BESPOKE INFRASTRUCTURE ANALYSIS${this.colors.reset}`);
    console.log('='.repeat(80));
    console.log(`${this.colors.dim}Location: ${location}${this.colors.reset}`);
    console.log(`${this.colors.dim}Radius: ${radius} miles${this.colors.reset}`);
    console.log(`${this.colors.dim}Type: ${analysisType}${this.colors.reset}`);
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Print success message
   */
  printSuccess(message) {
    console.log(`    ${this.colors.green}${message}${this.colors.reset}`);
  }

  /**
   * Print error message
   */
  printError(message) {
    console.log(`    ${this.colors.red}${message}${this.colors.reset}`);
  }
}

// CLI execution
async function main() {
  const runner = new TestRunner();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const location = args[0] || '123 Main St, Austin, TX';
  const radius = parseInt(args[1]) || 15;
  const analysisType = args[2] || 'power_grid';
  const useTestData = args.includes('--test') || args.includes('-t');
  
  // Validate analysis type
  const validTypes = ['power_grid', 'comprehensive'];
  if (!validTypes.includes(analysisType)) {
    console.log(`❌ Invalid analysis type: ${analysisType}`);
    console.log(`Valid types: ${validTypes.join(', ')}`);
    process.exit(1);
  }
  
  // Run analysis
  await runner.run({ location, radius, analysisType, useTestData });
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Runner failed:', error.message);
    process.exit(1);
  });
}

export default TestRunner;