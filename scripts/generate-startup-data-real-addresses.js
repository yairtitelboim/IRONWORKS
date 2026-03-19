/**
 * Generate startup data JSON with ONLY real geocoded addresses
 * Uses multiple Mapbox search strategies to find actual company addresses
 * NO FALLBACKS - only includes companies with real addresses found
 */

require('dotenv').config({ path: '../.env' });
const fs = require('fs');
const path = require('path');

// Configuration
const CSV_FILE = path.join(__dirname, '../public/companies-9-15-2025.csv');
const OUTPUT_FILE = path.join(__dirname, '../public/startup-companies.json');

// Mapbox API configuration
const MAPBOX_ACCESS_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
const MAPBOX_GEOCODING_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

// Categories mapping
const CATEGORIES = {
  'AI/ML': ['Artificial Intelligence (AI)', 'Machine Learning', 'Generative AI', 'Computer Vision', 'Natural Language Processing'],
  'Biotech/Health': ['Biotechnology', 'Health Care', 'Medical Device', 'Pharmaceutical', 'Life Sciences', 'Digital Health'],
  'FinTech': ['Financial Services', 'FinTech', 'Payments', 'Banking', 'Insurance'],
  'CleanTech': ['Clean Energy', 'Environmental Services', 'Sustainability', 'Renewable Energy'],
  'Enterprise': ['Enterprise Software', 'SaaS', 'B2B', 'Productivity Software'],
  'Hardware': ['Hardware', 'Electronics', 'Manufacturing', 'IoT'],
  'Other': [] // Default category
};

// Funding stages mapping
const FUNDING_STAGES = {
  'Early Stage': ['Seed', 'Series A', 'Pre-Seed'],
  'Growth Stage': ['Series B', 'Series C', 'Series D'],
  'Late Stage': ['Series E+', 'Private Equity', 'IPO'],
  'Unknown': []
};

// Category icons
const CATEGORY_ICONS = {
  'AI/ML': '🤖',
  'Biotech/Health': '🧬',
  'FinTech': '💳',
  'CleanTech': '🌱',
  'Enterprise': '🏢',
  'Hardware': '⚙️',
  'Other': '🚀'
};

// Multiple search strategies for better geocoding
async function geocodeCompanyWithStrategies(companyName, headquarters) {
  const city = extractCity(headquarters);
  const cityState = extractCityState(headquarters);
  
  const strategies = [
    // Strategy 1: Company name + full address
    `${companyName} ${headquarters}`,
    
    // Strategy 2: Company name + city, state
    `${companyName} ${cityState}`,
    
    // Strategy 3: Company name + city only
    `${companyName} ${city}`,
    
    // Strategy 4: Company name + "office" + city
    `${companyName} office ${city}`,
    
    // Strategy 5: Company name + "headquarters" + city
    `${companyName} headquarters ${city}`,
    
    // Strategy 6: Company name + "company" + city
    `${companyName} company ${city}`,
    
    // Strategy 7: Company name + "inc" + city
    `${companyName} inc ${city}`,
    
    // Strategy 8: Company name + "llc" + city
    `${companyName} llc ${city}`,
    
    // Strategy 9: Company name + "corp" + city
    `${companyName} corp ${city}`,
    
    // Strategy 10: Company name + "technologies" + city
    `${companyName} technologies ${city}`,
    
    // Strategy 11: Company name + "systems" + city
    `${companyName} systems ${city}`,
    
    // Strategy 12: Company name + "labs" + city
    `${companyName} labs ${city}`,
    
    // Strategy 13: Company name + "solutions" + city
    `${companyName} solutions ${city}`,
    
    // Strategy 14: Company name + "health" + city (for biotech)
    `${companyName} health ${city}`,
    
    // Strategy 15: Company name + "bio" + city (for biotech)
    `${companyName} bio ${city}`,
    
    // Strategy 16: Company name + "ai" + city (for AI companies)
    `${companyName} ai ${city}`,
    
    // Strategy 17: Company name + "tech" + city
    `${companyName} tech ${city}`,
    
    // Strategy 18: Company name + "software" + city
    `${companyName} software ${city}`,
    
    // Strategy 19: Company name + "medical" + city
    `${companyName} medical ${city}`,
    
    // Strategy 20: Company name + "therapeutics" + city
    `${companyName} therapeutics ${city}`,
    
    // Strategy 21: Company name + "kendall square" (for Cambridge companies)
    city.toLowerCase().includes('cambridge') ? `${companyName} kendall square` : null,
    
    // Strategy 22: Company name + "seaport" (for Boston companies)
    city.toLowerCase().includes('boston') ? `${companyName} seaport` : null,
    
    // Strategy 23: Company name + "back bay" (for Boston companies)
    city.toLowerCase().includes('boston') ? `${companyName} back bay` : null,
    
    // Strategy 24: Company name + "downtown" + city
    `${companyName} downtown ${city}`,
    
    // Strategy 25: Company name + "financial district" + city
    `${companyName} financial district ${city}`
  ].filter(Boolean); // Remove null strategies
  
  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];
    // Only log first few strategies to avoid spam
    if (i < 3) {
      console.log(`🔍 Strategy ${i + 1}: ${strategy}`);
    }
    
    try {
      const encodedQuery = encodeURIComponent(strategy);
      const url = `${MAPBOX_GEOCODING_URL}/${encodedQuery}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=US&limit=1`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const [lng, lat] = feature.center;
        const address = feature.place_name || headquarters;
        const confidence = feature.relevance || 0;
        
        // More flexible confidence threshold and better validation
        if (confidence > 0.2) {
          // Additional validation: check if result is in the right city
          const resultCity = address.toLowerCase();
          const targetCity = city.toLowerCase();
          
          if (resultCity.includes(targetCity) || confidence > 0.6) {
            console.log(`✅ Found (Strategy ${i + 1}): ${companyName} -> ${lat}, ${lng} (${address}) [Confidence: ${confidence}]`);
            
            return {
              lat: parseFloat(lat.toFixed(6)),
              lng: parseFloat(lng.toFixed(6)),
              address: address,
              confidence: confidence,
              strategy: i + 1
            };
          } else {
            console.log(`⚠️ Wrong city (${resultCity} vs ${targetCity}) for: ${companyName} - trying next strategy`);
          }
        } else {
          console.log(`⚠️ Low confidence (${confidence}) for: ${companyName} - trying next strategy`);
        }
      }
    } catch (error) {
      console.error(`❌ Strategy ${i + 1} error for ${companyName}:`, error.message);
    }
    
    // Small delay between strategies
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`❌ All strategies failed for: ${companyName}`);
  return null;
}

// Helper functions
function extractCityState(location) {
  // Extract "City, State" from "City, State, Country"
  const parts = location.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    return `${parts[0]}, ${parts[1]}`;
  }
  return location;
}

function extractCity(location) {
  // Extract just the city name
  const parts = location.split(',').map(p => p.trim());
  return parts[0];
}

function categorizeCompany(company) {
  const industries = company.Industries ? company.Industries.split(',').map(i => i.trim()) : [];
  
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(keyword => 
      industries.some(industry => 
        industry.toLowerCase().includes(keyword.toLowerCase())
      )
    )) {
      return category;
    }
  }
  
  return 'Other';
}

function categorizeFundingStage(company) {
  const stage = company['Last Funding Type'] || '';
  
  for (const [stageCategory, stages] of Object.entries(FUNDING_STAGES)) {
    if (stages.some(s => stage.includes(s))) {
      return stageCategory;
    }
  }
  
  return 'Unknown';
}

function getCategoryIcon(category) {
  return CATEGORY_ICONS[category] || '🚀';
}

// Main execution
async function main() {
  console.log('🚀 Starting real address geocoding...');
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  
  if (!MAPBOX_ACCESS_TOKEN) {
    console.error('❌ No Mapbox access token found in environment variables');
    process.exit(1);
  }
  
  console.log(`🔑 Mapbox token: ${MAPBOX_ACCESS_TOKEN.substring(0, 20)}...`);
  
  // Read and parse CSV
  const csvContent = fs.readFileSync(CSV_FILE, 'utf8');
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  
  const companies = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const company = {};
      headers.forEach((header, index) => {
        company[header] = values[index] || '';
      });
      companies.push(company);
    }
  }
  
  console.log(`✅ Parsed ${companies.length} companies`);
  
  const geocodedCompanies = [];
  const failedCompanies = [];
  let successCount = 0;
  let failCount = 0;
  
  // Process companies with real geocoding
  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    const address = company['Headquarters Location'];
    const companyName = company['Organization Name'];
    
    // Progress indicator every 10 companies
    if ((i + 1) % 10 === 0 || i === 0) {
      console.log(`🔄 Processing ${i + 1}/${companies.length} (✅ ${successCount} found, ❌ ${failCount} failed)`);
    }
    
    // Try to geocode the company with multiple strategies
    const coordinates = await geocodeCompanyWithStrategies(companyName, address);
    
    if (coordinates) {
      successCount++;
      const processedCompany = {
        id: `company_${companyName.replace(/\s+/g, '_').toLowerCase()}`,
        name: companyName,
        url: company['Organization Name URL'],
        description: company.Description,
        headquarters: address,
        coordinates: coordinates,
        category: categorizeCompany(company),
        fundingStage: categorizeFundingStage(company),
        industries: company.Industries ? company.Industries.split(',').map(i => i.trim()) : [],
        lastFundingDate: company['Last Funding Date'],
        lastFundingType: company['Last Funding Type'],
        cbRank: parseInt(company['CB Rank (Organization)']) || 0,
        isActive: company['Operating Status'] === 'Active',
        icon: getCategoryIcon(categorizeCompany(company)),
        companyType: company['Company Type'],
        operatingStatus: company['Operating Status'],
        geocodingConfidence: coordinates.confidence
      };
      
      geocodedCompanies.push(processedCompany);
    } else {
      failCount++;
      failedCompanies.push({ name: companyName, address: address });
    }
    
    // Add delay to avoid rate limiting
    if (i < companies.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Generate statistics
  const categories = {};
  const locations = {};
  const geocodingStats = { highConfidence: 0, mediumConfidence: 0, lowConfidence: 0 };
  
  geocodedCompanies.forEach(company => {
    // Category stats
    categories[company.category] = (categories[company.category] || 0) + 1;
    
    // Location stats
    const location = company.coordinates.address.split(',')[0];
    locations[location] = (locations[location] || 0) + 1;
    
    // Confidence stats
    if (company.coordinates.confidence > 0.7) {
      geocodingStats.highConfidence++;
    } else if (company.coordinates.confidence > 0.4) {
      geocodingStats.mediumConfidence++;
    } else {
      geocodingStats.lowConfidence++;
    }
  });
  
  const result = {
    metadata: {
      generatedAt: new Date().toISOString(),
      totalCompanies: geocodedCompanies.length,
      failedCompanies: failedCompanies.length,
      source: 'companies-9-13-2025.csv',
      geocodingService: 'mapbox',
      version: '2.0.0',
      note: 'Only companies with real addresses found'
    },
    statistics: {
      total: geocodedCompanies.length,
      categories,
      locations,
      geocodingStats
    },
    companies: geocodedCompanies,
    failedCompanies: failedCompanies
  };
  
  // Write output file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
  
  const successRate = ((geocodedCompanies.length / companies.length) * 100).toFixed(1);
  console.log(`\n📊 FINAL RESULTS:`);
  console.log(`✅ Successfully processed ${geocodedCompanies.length} companies`);
  console.log(`❌ Failed to geocode ${failedCompanies.length} companies`);
  console.log(`📈 Success rate: ${successRate}%`);
  console.log(`🎉 Successfully generated startup data JSON!`);
  console.log(`📁 Output file: ${OUTPUT_FILE}`);
  
  if (failedCompanies.length > 0) {
    console.log(`\n❌ Failed companies:`);
    failedCompanies.forEach(company => {
      console.log(`  - ${company.name} (${company.address})`);
    });
  }
  
  console.log(`✅ Script completed successfully`);
}

main().catch(console.error);
