/**
 * Generate startup data JSON using Google Places API
 * Specifically targets Boston and Cambridge, Massachusetts companies
 * Uses multiple search strategies to find actual company addresses
 */

require('dotenv').config({ path: '../.env' });
const fs = require('fs');
const path = require('path');

// Configuration
const CSV_FILE = path.join(__dirname, '../public/companies-9-15-2025.csv');
const OUTPUT_FILE = path.join(__dirname, '../public/startup-companies.json');

// Google Places API configuration
const GOOGLE_PLACES_API_KEY = 'AIzaSyBGFqyws8LGGGkof2ZbP_Mt8l3hf_glfpE';
const GOOGLE_PLACES_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const GOOGLE_GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

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
  const strategies = [
    // Strategy 1: Company name + headquarters
    `${companyName} ${headquarters}`,
    // Strategy 2: Company name + "Boston MA" or "Cambridge MA"
    `${companyName} ${headquarters.includes('Boston') ? 'Boston MA' : 'Cambridge MA'}`,
    // Strategy 3: Company name + "Massachusetts"
    `${companyName} Massachusetts`,
    // Strategy 4: Company name + specific area
    `${companyName} ${headquarters.includes('Boston') ? 'Boston Massachusetts' : 'Cambridge Massachusetts'}`,
    // Strategy 5: Company name + "MA"
    `${companyName} MA`,
    // Strategy 6: Company name + "United States"
    `${companyName} United States`,
    // Strategy 7: Company name + "USA"
    `${companyName} USA`,
    // Strategy 8: Company name + "02139" (Cambridge zip) or "02108" (Boston zip)
    `${companyName} ${headquarters.includes('Boston') ? '02108' : '02139'}`,
    // Strategy 9: Company name + "Kendall Square" (for Cambridge)
    headquarters.includes('Cambridge') ? `${companyName} Kendall Square Cambridge` : null,
    // Strategy 10: Company name + "Financial District" (for Boston)
    headquarters.includes('Boston') ? `${companyName} Financial District Boston` : null,
  ].filter(Boolean);

  for (let i = 0; i < strategies.length; i++) {
    const query = strategies[i];
    console.log(`🔍 Strategy ${i + 1}: ${query}`);
    
    try {
      const result = await searchGooglePlaces(query);
      if (result) {
        // Validate that the result is actually in Boston or Cambridge, MA
        if (isValidBostonCambridgeLocation(result)) {
          console.log(`✅ Found (Strategy ${i + 1}): ${companyName} -> ${result.lat}, ${result.lng} (${result.address}) [Confidence: ${result.confidence}]`);
          return result;
        } else {
          console.log(`⚠️ Wrong location (${result.address} vs ${headquarters}) for: ${companyName} - trying next strategy`);
        }
      }
    } catch (error) {
      console.log(`❌ Strategy ${i + 1} failed: ${error.message}`);
    }
    
    // Add delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return null;
}

async function searchGooglePlaces(query) {
  const url = `${GOOGLE_PLACES_SEARCH_URL}?query=${encodeURIComponent(query)}&key=${GOOGLE_PLACES_API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results.length > 0) {
      const result = data.results[0];
      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        address: result.formatted_address,
        placeId: result.place_id,
        confidence: calculateConfidence(result, query)
      };
    }
    return null;
  } catch (error) {
    throw new Error(`Google Places API error: ${error.message}`);
  }
}

function calculateConfidence(result, query) {
  let confidence = 0.5; // Base confidence
  
  // Boost confidence if company name appears in result
  const companyName = query.split(' ')[0];
  if (result.name && result.name.toLowerCase().includes(companyName.toLowerCase())) {
    confidence += 0.3;
  }
  
  // Boost confidence if address contains target city
  if (result.formatted_address.toLowerCase().includes('boston') || 
      result.formatted_address.toLowerCase().includes('cambridge')) {
    confidence += 0.2;
  }
  
  return Math.min(confidence, 1.0);
}

function isValidBostonCambridgeLocation(result) {
  const address = result.address.toLowerCase();
  
  // Check if it's in Boston or Cambridge, Massachusetts
  const isInTargetCity = address.includes('boston') || address.includes('cambridge');
  const isInMassachusetts = address.includes('massachusetts') || address.includes('ma');
  
  // Additional validation: check coordinates are roughly in the Boston area
  const lat = result.lat;
  const lng = result.lng;
  const isInBostonArea = lat >= 42.2 && lat <= 42.5 && lng >= -71.2 && lng <= -70.8;
  
  return isInTargetCity && isInMassachusetts && isInBostonArea;
}

function categorizeCompany(industries) {
  if (!industries) return 'Other';
  
  const industryList = industries.toLowerCase();
  
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(keyword => industryList.includes(keyword.toLowerCase()))) {
      return category;
    }
  }
  
  return 'Other';
}

function determineFundingStage(stage) {
  if (!stage) return 'Unknown';
  
  const stageStr = stage.toLowerCase();
  
  for (const [fundingStage, keywords] of Object.entries(FUNDING_STAGES)) {
    if (keywords.some(keyword => stageStr.includes(keyword.toLowerCase()))) {
      return fundingStage;
    }
  }
  
  return 'Unknown';
}

async function processCSV() {
  console.log('📊 Processing CSV file...');
  
  const csvContent = fs.readFileSync(CSV_FILE, 'utf-8');
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  
  const companies = [];
  let processed = 0;
  let found = 0;
  let failed = 0;
  
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    
    const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
    const company = {};
    
    headers.forEach((header, index) => {
      company[header] = values[index] || '';
    });
    
    // Skip if no company name
    if (!company['Organization Name']) continue;
    
    processed++;
    console.log(`\n🔄 Processing ${processed}/366: ${company['Organization Name']}`);
    
    const headquarters = company['Headquarters Location'] || '';
    const geocoded = await geocodeCompanyWithStrategies(company['Organization Name'], headquarters);
    
    if (geocoded) {
      const category = categorizeCompany(company['Industries']);
      const fundingStage = determineFundingStage(company['Stage']);
      
      companies.push({
        id: `company_${company['Organization Name'].toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        name: company['Organization Name'],
        url: company['Organization Name URL'] || '',
        description: company['Description'] || company['Operating Status'] || '',
        headquarters: headquarters,
        coordinates: {
          lat: geocoded.lat,
          lng: geocoded.lng
        },
        address: geocoded.address,
        placeId: geocoded.placeId,
        category: category,
        categoryIcon: CATEGORY_ICONS[category],
        fundingStage: fundingStage,
        industries: company['Industries'] || '',
        foundedDate: company['Founded Date'] || '',
        cbRank: company['CB Rank (Organization)'] || '',
        confidence: geocoded.confidence
      });
      
      found++;
      console.log(`✅ Found ${found} companies so far`);
    } else {
      failed++;
      console.log(`❌ Failed to geocode: ${company['Organization Name']}`);
    }
    
    // Progress update every 10 companies
    if (processed % 10 === 0) {
      console.log(`🔄 Processing ${processed}/366 (✅ ${found} found, ❌ ${failed} failed)`);
    }
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return { companies, processed, found, failed };
}

async function generateStartupData() {
  console.log('🚀 Starting Google Places geocoding for Boston/Cambridge startups...');
  console.log(`📁 Reading from: ${CSV_FILE}`);
  console.log(`📁 Writing to: ${OUTPUT_FILE}`);
  
  const { companies, processed, found, failed } = await processCSV();
  
  // Calculate statistics
  const categories = {};
  const locations = {};
  
  companies.forEach(company => {
    categories[company.category] = (categories[company.category] || 0) + 1;
    const city = company.headquarters.includes('Boston') ? 'Boston' : 'Cambridge';
    locations[city] = (locations[city] || 0) + 1;
  });
  
  const startupData = {
    metadata: {
      generatedAt: new Date().toISOString(),
      totalCompanies: companies.length,
      failedCompanies: failed,
      source: 'companies-9-15-2025.csv',
      geocodingService: 'google-places',
      version: '3.0.0',
      note: 'Only companies with real addresses in Boston/Cambridge, MA'
    },
    statistics: {
      total: companies.length,
      categories: categories,
      locations: locations
    },
    companies: companies
  };
  
  // Write to file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(startupData, null, 2));
  
  console.log('\n📊 FINAL RESULTS:');
  console.log(`✅ Successfully processed ${processed} companies`);
  console.log(`❌ Failed to geocode ${failed} companies`);
  console.log(`📈 Success rate: ${((found / processed) * 100).toFixed(1)}%`);
  console.log('🎉 Successfully generated startup data JSON!');
  console.log(`📁 Output file: ${OUTPUT_FILE}`);
  console.log('✅ Script completed successfully');
}

// Run the script
generateStartupData().catch(console.error);
