/**
 * Generate startup data JSON with real geocoded coordinates
 * Uses Mapbox Geocoding API to find actual addresses for companies
 */

require('dotenv').config({ path: '../.env' });
const fs = require('fs');
const path = require('path');

// Configuration
const CSV_FILE = path.join(__dirname, '../public/companies-9-13-2025.csv');
const OUTPUT_FILE = path.join(__dirname, '../public/startup-companies.json');

// Mapbox API configuration
const MAPBOX_ACCESS_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoieWFpcnRpdGVsYm9pbSIsImEiOiJjbW5qZ2V6d2UwMDF6MnJwZ2V6d2UwMDF6In0.example';
const MAPBOX_GEOCODING_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

// Categories mapping
const CATEGORIES = {
  'AI/ML': ['Artificial Intelligence (AI)', 'Machine Learning', 'Generative AI', 'Computer Vision', 'Natural Language Processing'],
  'Biotech/Health': ['Biotechnology', 'Health Care', 'Medical', 'Pharmaceutical', 'Therapeutics', 'Life Science', 'Medical Device'],
  'FinTech': ['Financial Services', 'FinTech', 'Payments', 'Insurance', 'InsurTech', 'Wealth Management'],
  'CleanTech': ['Clean Energy', 'Renewable Energy', 'Environmental Engineering', 'CleanTech', 'Sustainability'],
  'Enterprise': ['SaaS', 'Software', 'Enterprise Software', 'Information Technology', 'Analytics', 'Big Data'],
  'Hardware': ['Hardware', 'Manufacturing', 'Semiconductor', 'Robotics', 'Medical Device'],
  'Other': []
};

const FUNDING_STAGES = {
  'Early Stage': ['Pre-Seed', 'Seed'],
  'Growth Stage': ['Series A', 'Series B', 'Venture - Series Unknown'],
  'Late Stage': ['Series C', 'Series D', 'Series E'],
  'Unknown': []
};

// Parse CSV line handling quoted fields
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current.trim());
  return values;
}

// Categorize company based on industries
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

// Categorize funding stage
function categorizeFundingStage(company) {
  const stage = company.Stage || '';
  
  for (const [stageCategory, stages] of Object.entries(FUNDING_STAGES)) {
    if (stages.some(s => stage.includes(s))) {
      return stageCategory;
    }
  }
  
  return 'Unknown';
}

// Geocode company using Mapbox API
async function geocodeCompany(companyName, headquarters) {
  try {
    // First try searching for the company name + location
    const searchQuery = `${companyName} ${headquarters}`;
    const encodedQuery = encodeURIComponent(searchQuery);
    const url = `${MAPBOX_GEOCODING_URL}/${encodedQuery}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=US&limit=1`;
    
    console.log(`🔍 Geocoding: ${companyName} -> ${searchQuery}`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const [lng, lat] = feature.center;
      const address = feature.place_name || headquarters;
      
      console.log(`✅ Found: ${companyName} -> ${lat}, ${lng} (${address})`);
      
      return {
        lat: parseFloat(lat.toFixed(6)),
        lng: parseFloat(lng.toFixed(6)),
        address: address,
        confidence: feature.relevance || 0
      };
    } else {
      console.log(`⚠️ No results for: ${companyName}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Geocoding error for ${companyName}:`, error.message);
    return null;
  }
}

// Fallback to realistic coordinates if geocoding fails
function generateFallbackCoordinates(location) {
  const isCambridge = location.toLowerCase().includes('cambridge');
  
  if (isCambridge) {
    // Kendall Square area (MIT/tech hub)
    return {
      lat: 42.3625 + (Math.random() - 0.5) * 0.02, // Kendall Square area
      lng: -71.0867 + (Math.random() - 0.5) * 0.02,
      address: location,
      confidence: 0.5
    };
  } else {
    // Boston business districts (avoiding water)
    const districts = [
      { lat: 42.3601, lng: -71.0589, name: 'Downtown' }, // Downtown
      { lat: 42.3503, lng: -71.0495, name: 'Seaport' }, // Seaport
      { lat: 42.3484, lng: -71.0762, name: 'Back Bay' }, // Back Bay
      { lat: 42.3398, lng: -71.0731, name: 'South End' }, // South End
      { lat: 42.3601, lng: -71.0589, name: 'Financial District' } // Financial District
    ];
    
    const district = districts[Math.floor(Math.random() * districts.length)];
    return {
      lat: district.lat + (Math.random() - 0.5) * 0.01,
      lng: district.lng + (Math.random() - 0.5) * 0.01,
      address: `${district.name}, ${location}`,
      confidence: 0.3
    };
  }
}

// Get icon for company category
function getCategoryIcon(category) {
  const icons = {
    'AI/ML': '🤖',
    'Biotech/Health': '🧬',
    'FinTech': '💰',
    'CleanTech': '🌱',
    'Enterprise': '🏢',
    'Hardware': '⚙️',
    'Other': '🏭'
  };
  return icons[category] || '🏭';
}

// Main processing function
async function generateStartupData() {
  console.log('🚀 Starting startup data generation with real geocoding...');
  
  // Check if Mapbox token is available
  if (!MAPBOX_ACCESS_TOKEN || MAPBOX_ACCESS_TOKEN.includes('example')) {
    console.log('⚠️ No valid Mapbox token found. Using fallback coordinates.');
    console.log('💡 Set MAPBOX_ACCESS_TOKEN environment variable for real geocoding.');
  }
  
  // Read CSV file
  const csvContent = fs.readFileSync(CSV_FILE, 'utf8');
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  console.log(`📊 Found ${lines.length - 1} companies in CSV`);
  
  const companies = [];
  const geocodedCompanies = [];
  
  // Parse CSV data
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    if (values.length >= headers.length) {
      const company = {};
      headers.forEach((header, index) => {
        company[header] = values[index] || '';
      });
      companies.push(company);
    }
  }
  
  console.log(`✅ Parsed ${companies.length} companies`);
  
  // Process companies with real geocoding
  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    const address = company['Headquarters Location'];
    const companyName = company['Organization Name'];
    
    console.log(`🔄 Processing ${i + 1}/${companies.length}: ${companyName} - ${address}`);
    
    // Try to geocode the company
    let coordinates = await geocodeCompany(companyName, address);
    
    // If geocoding failed, use fallback
    if (!coordinates) {
      console.log(`🔄 Using fallback coordinates for: ${companyName}`);
      coordinates = generateFallbackCoordinates(address);
    }
    
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
      // Additional metadata
      companyType: company['Company Type'],
      operatingStatus: company['Operating Status'],
      geocodingConfidence: coordinates.confidence || 0
    };
    
    geocodedCompanies.push(processedCompany);
    
    // Add delay to avoid rate limiting
    if (i < companies.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
    }
  }
  
  console.log(`✅ Successfully processed ${geocodedCompanies.length} companies`);
  
  // Generate statistics
  const stats = {
    total: geocodedCompanies.length,
    categories: {},
    fundingStages: {},
    locations: {},
    geocodingStats: {
      highConfidence: 0,
      mediumConfidence: 0,
      lowConfidence: 0
    }
  };
  
  geocodedCompanies.forEach(company => {
    // Count categories
    stats.categories[company.category] = (stats.categories[company.category] || 0) + 1;
    
    // Count funding stages
    stats.fundingStages[company.fundingStage] = (stats.fundingStages[company.fundingStage] || 0) + 1;
    
    // Count locations (city level)
    const city = company.coordinates.address.split(',')[0];
    stats.locations[city] = (stats.locations[city] || 0) + 1;
    
    // Count geocoding confidence
    if (company.geocodingConfidence >= 0.8) {
      stats.geocodingStats.highConfidence++;
    } else if (company.geocodingConfidence >= 0.5) {
      stats.geocodingStats.mediumConfidence++;
    } else {
      stats.geocodingStats.lowConfidence++;
    }
  });
  
  // Create final data structure
  const startupData = {
    metadata: {
      generatedAt: new Date().toISOString(),
      totalCompanies: geocodedCompanies.length,
      source: 'companies-9-13-2025.csv',
      geocodingService: MAPBOX_ACCESS_TOKEN && !MAPBOX_ACCESS_TOKEN.includes('example') ? 'mapbox' : 'fallback',
      version: '1.0.0'
    },
    statistics: stats,
    companies: geocodedCompanies
  };
  
  // Write to JSON file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(startupData, null, 2));
  
  console.log(`🎉 Successfully generated startup data JSON!`);
  console.log(`📁 Output file: ${OUTPUT_FILE}`);
  console.log(`📊 Statistics:`, stats);
  
  return startupData;
}

// Run the script
if (require.main === module) {
  generateStartupData()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { generateStartupData };
