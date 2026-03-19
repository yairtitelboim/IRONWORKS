/**
 * Generate startup data JSON with realistic coordinates
 * Assigns unique coordinates for Boston and Cambridge companies
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CSV_FILE = path.join(__dirname, '../public/companies-9-13-2025.csv');
const OUTPUT_FILE = path.join(__dirname, '../public/startup-companies.json');

// Realistic coordinate ranges for Boston area
const BOSTON_COORDS = {
  center: { lat: 42.3601, lng: -71.0589 },
  range: { lat: 0.05, lng: 0.05 } // ~3 mile radius
};

const CAMBRIDGE_COORDS = {
  center: { lat: 42.3736, lng: -71.1097 },
  range: { lat: 0.03, lng: 0.03 } // ~2 mile radius
};

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

// Generate realistic coordinates for a location
function generateCoordinates(location) {
  const isCambridge = location.toLowerCase().includes('cambridge');
  const coords = isCambridge ? CAMBRIDGE_COORDS : BOSTON_COORDS;
  
  // Generate random coordinates within the range
  const lat = coords.center.lat + (Math.random() - 0.5) * coords.range.lat;
  const lng = coords.center.lng + (Math.random() - 0.5) * coords.range.lng;
  
  return {
    lat: parseFloat(lat.toFixed(6)),
    lng: parseFloat(lng.toFixed(6)),
    address: location
  };
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
  console.log('🚀 Starting startup data generation with realistic coordinates...');
  
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
  
  // Process companies with realistic coordinates
  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];
    const address = company['Headquarters Location'];
    
    console.log(`🔄 Processing ${i + 1}/${companies.length}: ${company['Organization Name']} - ${address}`);
    
    // Generate realistic coordinates
    const coordinates = generateCoordinates(address);
    
    const processedCompany = {
      id: `company_${company['Organization Name'].replace(/\s+/g, '_').toLowerCase()}`,
      name: company['Organization Name'],
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
      operatingStatus: company['Operating Status']
    };
    
    geocodedCompanies.push(processedCompany);
    console.log(`✅ Generated coordinates: ${company['Organization Name']} -> ${coordinates.lat}, ${coordinates.lng}`);
  }
  
  console.log(`✅ Successfully processed ${geocodedCompanies.length} companies`);
  
  // Generate statistics
  const stats = {
    total: geocodedCompanies.length,
    categories: {},
    fundingStages: {},
    locations: {}
  };
  
  geocodedCompanies.forEach(company => {
    // Count categories
    stats.categories[company.category] = (stats.categories[company.category] || 0) + 1;
    
    // Count funding stages
    stats.fundingStages[company.fundingStage] = (stats.fundingStages[company.fundingStage] || 0) + 1;
    
    // Count locations (city level)
    const city = company.coordinates.address.split(',')[0];
    stats.locations[city] = (stats.locations[city] || 0) + 1;
  });
  
  // Create final data structure
  const startupData = {
    metadata: {
      generatedAt: new Date().toISOString(),
      totalCompanies: geocodedCompanies.length,
      source: 'companies-9-13-2025.csv',
      geocodingService: 'realistic_coordinates',
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
