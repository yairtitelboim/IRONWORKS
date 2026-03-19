#!/usr/bin/env node

/**
 * Gentrification Spatial Analysis Engine
 * 
 * Focuses specifically on spatial relationships that drive gentrification patterns
 * when FIFA investment triggers urban development. Analyzes investment clustering,
 * affordability thresholds, and displacement risk factors.
 * 
 * Goal: Generate rich spatial relationship data for Perplexity to answer:
 * "Which downtown blocks become unaffordable first when FIFA investment triggers gentrification?"
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  dataPaths: {
    fifa: './public/fifa-houston-cache.json',
    listings: './public/Listings/houston_downtown_master_CLEANED.geojson',
    tdlr: './public/Listings/TLDR/tdlr_houston_all_precise.geojson',
    companies: './public/companies/companies-9-24-2025-geocoded.json'
  },
  fifaZones: {
    downtown_core: { 
      lat: 29.7604, 
      lng: -95.3698, 
      radius: 1500,
      name: "Downtown Core"
    },
    eado_district: { 
      lat: 29.7394, 
      lng: -95.3467, 
      radius: 2000,
      name: "EaDo Fan Festival Zone"
    },
    midtown_connector: { 
      lat: 29.7499, 
      lng: -95.3582, 
      radius: 1000,
      name: "Midtown Transit Corridor"
    }
  },
  // Gentrification-specific analysis parameters
  investmentClusteringRadius: 800, // meters for investment clustering analysis
  affordabilityAnalysisRadius: 600, // meters for affordability impact analysis
  displacementRiskRadius: 1000, // meters for displacement risk analysis
  gentrificationThresholds: {
    highRisk: 0.7, // High gentrification risk score
    mediumRisk: 0.4, // Medium gentrification risk score
    lowRisk: 0.2 // Low gentrification risk score
  }
};

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(point1, point2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLng = (point2.lng - point1.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in meters
}

/**
 * Load and analyze FIFA investment clustering patterns
 */
function analyzeInvestmentClustering() {
  try {
    const fifaData = JSON.parse(fs.readFileSync(CONFIG.dataPaths.fifa, 'utf8'));
    
    // Focus on high-priority FIFA features (investment indicators)
    const highPriorityFeatures = fifaData.features.filter(f => f.properties.priority === 3);
    const mediumPriorityFeatures = fifaData.features.filter(f => f.properties.priority === 2);
    
    // Analyze investment clustering patterns
    const investmentClusters = [];
    
    // Find clusters of high-priority features
    highPriorityFeatures.forEach(feature => {
      const coords = feature.geometry.coordinates;
      const point = { lat: coords[1], lng: coords[0] };
      
      // Find nearby high-priority features
      const nearbyHighPriority = highPriorityFeatures.filter(other => {
        if (other === feature) return false;
        const otherCoords = other.geometry.coordinates;
        const otherPoint = { lat: otherCoords[1], lng: otherCoords[0] };
        return calculateDistance(point, otherPoint) <= CONFIG.investmentClusteringRadius;
      });
      
      if (nearbyHighPriority.length > 0) {
        // Calculate cluster strength
        const clusterStrength = nearbyHighPriority.length + 1; // +1 for the center feature
        const totalInvestment = clusterStrength * 1000000; // Estimate $1M per high-priority feature
        
        investmentClusters.push({
          center: point,
          features: [feature, ...nearbyHighPriority],
          clusterStrength: clusterStrength,
          estimatedInvestment: totalInvestment,
          radius: CONFIG.investmentClusteringRadius,
          developmentMomentum: Math.min(1, clusterStrength / 5) // Normalize to 0-1
        });
      }
    });
    
    // Remove duplicate clusters
    const uniqueClusters = [];
    const processed = new Set();
    
    investmentClusters.forEach(cluster => {
      const clusterKey = `${cluster.center.lat},${cluster.center.lng}`;
      if (!processed.has(clusterKey)) {
        uniqueClusters.push(cluster);
        processed.add(clusterKey);
      }
    });
    
    return {
      totalHighPriorityFeatures: highPriorityFeatures.length,
      totalMediumPriorityFeatures: mediumPriorityFeatures.length,
      investmentClusters: uniqueClusters,
      totalEstimatedInvestment: uniqueClusters.reduce((sum, c) => sum + c.estimatedInvestment, 0),
      averageClusterStrength: uniqueClusters.length > 0 ? 
        uniqueClusters.reduce((sum, c) => sum + c.clusterStrength, 0) / uniqueClusters.length : 0
    };
  } catch (error) {
    console.error('Error analyzing investment clustering:', error.message);
    return { totalHighPriorityFeatures: 0, investmentClusters: [], totalEstimatedInvestment: 0, averageClusterStrength: 0 };
  }
}

/**
 * Analyze affordability impact patterns
 */
function analyzeAffordabilityImpact() {
  try {
    const listingsData = JSON.parse(fs.readFileSync(CONFIG.dataPaths.listings, 'utf8'));
    
    // Focus on residential listings for affordability analysis
    const residentialListings = listingsData.features.filter(f => 
      f.properties.property_type === 'sales' || 
      f.properties.property_type === 'rentals' ||
      f.properties.property_type === 'condo_rentals'
    );
    
    // Analyze price patterns by proximity to FIFA zones
    const affordabilityZones = [];
    
    Object.entries(CONFIG.fifaZones).forEach(([zoneId, zone]) => {
      const zoneListings = residentialListings.filter(listing => {
        const coords = listing.geometry.coordinates;
        const point = { lat: coords[1], lng: coords[0] };
        return calculateDistance(point, zone) <= zone.radius;
      });
      
      if (zoneListings.length > 0) {
        const prices = zoneListings.map(l => l.properties.price || 0).filter(p => p > 0);
        const avgPrice = prices.length > 0 ? prices.reduce((sum, p) => sum + p, 0) / prices.length : 0;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        
        // Calculate affordability risk based on price variance and proximity to investment
        const priceVariance = prices.length > 1 ? 
          prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length : 0;
        
        const affordabilityRisk = Math.min(1, (avgPrice / 1000000) + (priceVariance / 1000000000));
        
        affordabilityZones.push({
          zone: zoneId,
          zoneName: zone.name,
          listingCount: zoneListings.length,
          avgPrice: avgPrice,
          maxPrice: maxPrice,
          minPrice: minPrice,
          priceVariance: priceVariance,
          affordabilityRisk: affordabilityRisk,
          gentrificationPotential: Math.min(1, affordabilityRisk * 0.8) // High prices + variance = gentrification risk
        });
      }
    });
    
    return {
      totalResidentialListings: residentialListings.length,
      affordabilityZones: affordabilityZones,
      overallAffordabilityRisk: affordabilityZones.length > 0 ? 
        affordabilityZones.reduce((sum, z) => sum + z.affordabilityRisk, 0) / affordabilityZones.length : 0
    };
  } catch (error) {
    console.error('Error analyzing affordability impact:', error.message);
    return { totalResidentialListings: 0, affordabilityZones: [], overallAffordabilityRisk: 0 };
  }
}

/**
 * Analyze construction impact patterns using TDLR data
 */
function analyzeConstructionImpact() {
  try {
    const tdlrData = JSON.parse(fs.readFileSync(CONFIG.dataPaths.tdlr, 'utf8'));
    
    // Focus on active construction projects
    const activeProjects = tdlrData.features.filter(f => 
      f.properties.status === 'Project Registered' || 
      f.properties.status === 'In Progress' ||
      f.properties.status === 'Active'
    );
    
    // Analyze construction clustering by FIFA zones
    const constructionZones = [];
    
    Object.entries(CONFIG.fifaZones).forEach(([zoneId, zone]) => {
      const zoneProjects = activeProjects.filter(project => {
        const coords = project.geometry.coordinates;
        const point = { lat: coords[1], lng: coords[0] };
        return calculateDistance(point, zone) <= zone.radius;
      });
      
      if (zoneProjects.length > 0) {
        const totalCost = zoneProjects.reduce((sum, p) => sum + (p.properties.cost || 0), 0);
        const avgCost = totalCost / zoneProjects.length;
        const projectTypes = [...new Set(zoneProjects.map(p => p.properties.work_type))];
        
        constructionZones.push({
          zone: zoneId,
          zoneName: zone.name,
          projectCount: zoneProjects.length,
          totalCost: totalCost,
          avgCost: avgCost,
          projectTypes: projectTypes,
          constructionIntensity: zoneProjects.length / (Math.PI * Math.pow(zone.radius / 1000, 2)), // projects per km²
          gentrificationTrigger: totalCost > 10000000 ? 'HIGH' : totalCost > 5000000 ? 'MEDIUM' : 'LOW'
        });
      }
    });
    
    return {
      totalActiveProjects: activeProjects.length,
      constructionZones: constructionZones,
      totalConstructionValue: activeProjects.reduce((sum, p) => sum + (p.properties.cost || 0), 0),
      highValueProjects: activeProjects.filter(p => (p.properties.cost || 0) > 1000000).length
    };
  } catch (error) {
    console.error('Error analyzing construction impact:', error.message);
    return { totalActiveProjects: 0, constructionZones: [], totalConstructionValue: 0, highValueProjects: 0 };
  }
}

/**
 * Analyze economic density using company data
 */
function analyzeEconomicDensity() {
  try {
    const companyData = JSON.parse(fs.readFileSync(CONFIG.dataPaths.companies, 'utf8'));
    
    // Focus on companies with location data
    const companies = companyData.companies.filter(c => 
      c.headquarters_location && 
      c.headquarters_location.coordinates
    );
    
    // Analyze economic clustering by FIFA zones
    const economicZones = [];
    
    Object.entries(CONFIG.fifaZones).forEach(([zoneId, zone]) => {
      const zoneCompanies = companies.filter(company => {
        const coords = company.headquarters_location.coordinates;
        const point = { lat: coords.lat, lng: coords.lng };
        return calculateDistance(point, zone) <= zone.radius;
      });
      
      if (zoneCompanies.length > 0) {
        const highValueCompanies = zoneCompanies.filter(c => 
          c.employees && c.employees.min && c.employees.min > 100
        );
        const industries = [...new Set(zoneCompanies.map(c => c.industries?.[0] || 'Other'))];
        const avgEmployees = zoneCompanies.reduce((sum, c) => {
          const emp = c.employees?.min || 0;
          return sum + emp;
        }, 0) / zoneCompanies.length;
        
        economicZones.push({
          zone: zoneId,
          zoneName: zone.name,
          companyCount: zoneCompanies.length,
          highValueCompanies: highValueCompanies.length,
          industries: industries,
          avgEmployees: avgEmployees,
          economicDensity: zoneCompanies.length / (Math.PI * Math.pow(zone.radius / 1000, 2)), // companies per km²
          economicActivityScore: Math.min(10, (zoneCompanies.length * 0.5) + (highValueCompanies.length * 2))
        });
      }
    });
    
    return {
      totalCompanies: companies.length,
      economicZones: economicZones,
      highValueCompanies: companies.filter(c => c.employees?.min > 100).length,
      industryDiversity: [...new Set(companies.map(c => c.industries?.[0] || 'Other'))].length
    };
  } catch (error) {
    console.error('Error analyzing economic density:', error.message);
    return { totalCompanies: 0, economicZones: [], highValueCompanies: 0, industryDiversity: 0 };
  }
}

/**
 * Analyze displacement risk factors
 */
function analyzeDisplacementRisk() {
  try {
    const fifaData = JSON.parse(fs.readFileSync(CONFIG.dataPaths.fifa, 'utf8'));
    const listingsData = JSON.parse(fs.readFileSync(CONFIG.dataPaths.listings, 'utf8'));
    
    // Find areas with high FIFA investment but low current residential density
    const displacementRiskAreas = [];
    
    Object.entries(CONFIG.fifaZones).forEach(([zoneId, zone]) => {
      // Get FIFA features in zone
      const zoneFIFAFatures = fifaData.features.filter(feature => {
        const coords = feature.geometry.coordinates;
        const point = { lat: coords[1], lng: coords[0] };
        return calculateDistance(point, zone) <= zone.radius;
      });
      
      // Get residential listings in zone
      const zoneResidential = listingsData.features.filter(feature => {
        const coords = feature.geometry.coordinates;
        const point = { lat: coords[1], lng: coords[0] };
        return calculateDistance(point, zone) <= zone.radius && (
          feature.properties.property_type === 'sales' || 
          feature.properties.property_type === 'rentals' ||
          feature.properties.property_type === 'condo_rentals'
        );
      });
      
      // Calculate displacement risk factors
      const highPriorityCount = zoneFIFAFatures.filter(f => f.properties.priority === 3).length;
      const residentialDensity = zoneResidential.length / (Math.PI * Math.pow(zone.radius / 1000, 2)); // listings per km²
      
      // Displacement risk = high investment + low residential density
      const displacementRisk = Math.min(1, (highPriorityCount * 0.3) + (1 - Math.min(1, residentialDensity / 10)));
      
      displacementRiskAreas.push({
        zone: zoneId,
        zoneName: zone.name,
        highPriorityFeatures: highPriorityCount,
        residentialDensity: residentialDensity,
        displacementRisk: displacementRisk,
        riskLevel: displacementRisk > CONFIG.gentrificationThresholds.highRisk ? 'HIGH' :
                  displacementRisk > CONFIG.gentrificationThresholds.mediumRisk ? 'MEDIUM' : 'LOW'
      });
    });
    
    return {
      displacementRiskAreas: displacementRiskAreas,
      highRiskAreas: displacementRiskAreas.filter(a => a.riskLevel === 'HIGH').length,
      mediumRiskAreas: displacementRiskAreas.filter(a => a.riskLevel === 'MEDIUM').length,
      lowRiskAreas: displacementRiskAreas.filter(a => a.riskLevel === 'LOW').length
    };
  } catch (error) {
    console.error('Error analyzing displacement risk:', error.message);
    return { displacementRiskAreas: [], highRiskAreas: 0, mediumRiskAreas: 0, lowRiskAreas: 0 };
  }
}

/**
 * Generate gentrification-specific spatial relationship prompt
 */
function generateGentrificationPrompt() {
  console.log('🔍 Analyzing gentrification spatial patterns...');
  
  const investmentClustering = analyzeInvestmentClustering();
  const affordabilityImpact = analyzeAffordabilityImpact();
  const constructionImpact = analyzeConstructionImpact();
  const economicDensity = analyzeEconomicDensity();
  const displacementRisk = analyzeDisplacementRisk();
  
  console.log(`💰 Investment Clustering: ${investmentClustering.investmentClusters.length} clusters, $${(investmentClustering.totalEstimatedInvestment / 1000000).toFixed(1)}M total investment`);
  console.log(`🏠 Affordability Impact: ${affordabilityImpact.totalResidentialListings} residential listings, ${affordabilityImpact.affordabilityZones.length} zones analyzed`);
  console.log(`🏗️ Construction Impact: ${constructionImpact.totalActiveProjects} active projects, $${(constructionImpact.totalConstructionValue / 1000000).toFixed(1)}M total value`);
  console.log(`🏢 Economic Density: ${economicDensity.totalCompanies} companies, ${economicDensity.highValueCompanies} high-value`);
  console.log(`⚠️ Displacement Risk: ${displacementRisk.highRiskAreas} high-risk, ${displacementRisk.mediumRiskAreas} medium-risk areas`);
  
  return `Analyze gentrification patterns triggered by FIFA investment in downtown Houston.

REAL ESTATE MARKET CONTEXT:
- Total residential listings: ${affordabilityImpact.totalResidentialListings}
- Sales properties: ${affordabilityImpact.totalResidentialListings > 0 ? affordabilityImpact.affordabilityZones.reduce((sum, z) => sum + (z.listingCount || 0), 0) : 0}
- Average price: $${affordabilityImpact.affordabilityZones.length > 0 ? Math.round(affordabilityImpact.affordabilityZones.reduce((sum, z) => sum + (z.avgPrice || 0), 0) / affordabilityImpact.affordabilityZones.length).toLocaleString() : 'N/A'}
- Price range: $${affordabilityImpact.affordabilityZones.length > 0 ? Math.round(Math.min(...affordabilityImpact.affordabilityZones.map(z => z.minPrice || 0))).toLocaleString() : 'N/A'} - $${affordabilityImpact.affordabilityZones.length > 0 ? Math.round(Math.max(...affordabilityImpact.affordabilityZones.map(z => z.maxPrice || 0))).toLocaleString() : 'N/A'}
- Overall affordability risk: ${affordabilityImpact.overallAffordabilityRisk.toFixed(2)}

CONSTRUCTION IMPACT ANALYSIS:
- Active construction projects: ${constructionImpact.totalActiveProjects}
- Total construction value: $${(constructionImpact.totalConstructionValue / 1000000).toFixed(1)} million
- High-value projects (>$1M): ${constructionImpact.highValueProjects}
${constructionImpact.constructionZones.map(zone => 
  `- ${zone.zoneName}: ${zone.projectCount} projects, $${(zone.totalCost / 1000000).toFixed(1)}M total, ${zone.gentrificationTrigger} trigger risk`
).join('\n')}

ECONOMIC DENSITY PATTERNS:
- Total companies analyzed: ${economicDensity.totalCompanies}
- High-value companies (>100 employees): ${economicDensity.highValueCompanies}
- Industry diversity: ${economicDensity.industryDiversity} sectors
${economicDensity.economicZones.map(zone => 
  `- ${zone.zoneName}: ${zone.companyCount} companies, ${zone.economicActivityScore.toFixed(1)}/10 activity score, ${zone.industries.slice(0, 3).join(', ')}`
).join('\n')}

FIFA INVESTMENT CLUSTERING:
- High-priority FIFA features: ${investmentClustering.totalHighPriorityFeatures} total
- Investment clusters: ${investmentClustering.investmentClusters.length} identified
- Total estimated investment: $${(investmentClustering.totalEstimatedInvestment / 1000000).toFixed(1)} million
- Average cluster strength: ${investmentClustering.averageClusterStrength.toFixed(1)} features per cluster

DISPLACEMENT RISK FACTORS:
- High-risk areas: ${displacementRisk.highRiskAreas}
- Medium-risk areas: ${displacementRisk.mediumRiskAreas}
- Low-risk areas: ${displacementRisk.lowRiskAreas}
${displacementRisk.displacementRiskAreas.map(area => 
  `- ${area.zoneName}: ${area.highPriorityFeatures} high-priority features, ${area.residentialDensity.toFixed(1)} listings/km², ${area.riskLevel} displacement risk (${area.displacementRisk.toFixed(2)})`
).join('\n')}

SPATIAL RELATIONSHIP INSIGHTS:
- Construction intensity creates gentrification triggers: ${constructionImpact.constructionZones.filter(z => z.gentrificationTrigger === 'HIGH').length} high-trigger zones
- Economic activity drives demand: ${economicDensity.economicZones.filter(z => z.economicActivityScore > 5).length} high-activity zones
- Price pressure from ${affordabilityImpact.totalResidentialListings} residential listings competing for space
- Investment clustering creates development momentum of ${investmentClustering.averageClusterStrength.toFixed(1)} score

REQUIRED OUTPUT: Return GeoJSON features identifying which downtown blocks become unaffordable first when FIFA investment triggers gentrification. Include properties: gentrification_risk (0-1), timeline_to_unaffordable (months), current_affordability_index, post_fifa_affordability_index, displacement_risk_factors, neighborhood_characteristics, investment_cluster_proximity, development_momentum_score, impact_radius_meters (meters), neighborhood_name (Downtown/Midtown/EaDo). Focus on spatial relationships between construction intensity, economic density, and affordability patterns.`;
}

/**
 * Main execution
 */
function main() {
  console.log('🏘️ Gentrification Spatial Analysis Engine');
  console.log('==========================================');
  
  const prompt = generateGentrificationPrompt();
  
  // Save the prompt
  const outputPath = './public/gentrification-analysis-prompt.json';
  const output = {
    scenario: 'gentrification_analysis',
    question: 'Which downtown blocks become unaffordable first when FIFA investment triggers gentrification?',
    prompt: prompt,
    generated_at: new Date().toISOString(),
    analysis_focus: 'spatial_relationships_and_patterns'
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 Gentrification analysis prompt saved to: ${outputPath}`);
  
  console.log('\n✅ Gentrification spatial analysis complete!');
  console.log('📤 Ready to send to Perplexity API for GeoJSON response');
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  analyzeInvestmentClustering,
  analyzeAffordabilityImpact,
  analyzeConstructionImpact,
  analyzeEconomicDensity,
  analyzeDisplacementRisk,
  generateGentrificationPrompt
};
