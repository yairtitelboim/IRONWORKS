/**
 * CompanyDataParser - Parses and processes company data from CSV
 * Handles geocoding, categorization, and data transformation for map visualization
 */

export class CompanyDataParser {
  constructor() {
    this.companies = [];
    this.geocodedCompanies = [];
    this.categories = {
      'AI/ML': ['Artificial Intelligence (AI)', 'Machine Learning', 'Generative AI', 'Computer Vision', 'Natural Language Processing'],
      'Biotech/Health': ['Biotechnology', 'Health Care', 'Medical', 'Pharmaceutical', 'Therapeutics', 'Life Science', 'Medical Device'],
      'FinTech': ['Financial Services', 'FinTech', 'Payments', 'Insurance', 'InsurTech', 'Wealth Management'],
      'CleanTech': ['Clean Energy', 'Renewable Energy', 'Environmental Engineering', 'CleanTech', 'Sustainability'],
      'Enterprise': ['SaaS', 'Software', 'Enterprise Software', 'Information Technology', 'Analytics', 'Big Data'],
      'Hardware': ['Hardware', 'Manufacturing', 'Semiconductor', 'Robotics', 'Medical Device'],
      'Other': []
    };
    
    this.fundingStages = {
      'Early Stage': ['Pre-Seed', 'Seed'],
      'Growth Stage': ['Series A', 'Series B', 'Venture - Series Unknown'],
      'Late Stage': ['Series C', 'Series D', 'Series E'],
      'Unknown': []
    };
  }

  /**
   * Load and parse CSV data
   */
  async loadCompanyData() {
    try {
      const response = await fetch('/companies-9-13-2025.csv');
      const csvText = await response.text();
      this.companies = this.parseCSV(csvText);
      console.log(`📊 Loaded ${this.companies.length} companies from CSV`);
      return this.companies;
    } catch (error) {
      console.error('❌ Error loading company data:', error);
      return [];
    }
  }

  /**
   * Parse CSV text into array of company objects
   */
  parseCSV(csvText) {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const companies = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Simple CSV parsing (handles quoted fields)
      const values = this.parseCSVLine(line);
      if (values.length >= headers.length) {
        const company = {};
        headers.forEach((header, index) => {
          company[header] = values[index] || '';
        });
        companies.push(company);
      }
    }

    return companies;
  }

  /**
   * Parse a single CSV line handling quoted fields
   */
  parseCSVLine(line) {
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

  /**
   * Categorize company based on industries
   */
  categorizeCompany(company) {
    const industries = company.Industries ? company.Industries.split(',').map(i => i.trim()) : [];
    
    for (const [category, keywords] of Object.entries(this.categories)) {
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

  /**
   * Categorize funding stage
   */
  categorizeFundingStage(company) {
    const stage = company.Stage || '';
    
    for (const [stageCategory, stages] of Object.entries(this.fundingStages)) {
      if (stages.some(s => stage.includes(s))) {
        return stageCategory;
      }
    }
    
    return 'Unknown';
  }

  /**
   * Geocode company address to coordinates
   */
  async geocodeAddress(address) {
    try {
      // Use a geocoding service (you can replace with your preferred service)
      const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${process.env.REACT_APP_MAPBOX_TOKEN}&limit=1`);
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        return { lat, lng, address: data.features[0].place_name };
      }
    } catch (error) {
      console.warn(`⚠️ Geocoding failed for ${address}:`, error.message);
    }
    
    return null;
  }

  /**
   * Process all companies with geocoding and categorization
   */
  async processCompanies() {
    if (this.companies.length === 0) {
      await this.loadCompanyData();
    }

    console.log('🔄 Processing companies with geocoding and categorization...');
    this.geocodedCompanies = [];

    for (let i = 0; i < this.companies.length; i++) {
      const company = this.companies[i];
      
      // Geocode address
      const coordinates = await this.geocodeAddress(company['Headquarters Location']);
      
      if (coordinates) {
        const processedCompany = {
          ...company,
          coordinates,
          category: this.categorizeCompany(company),
          fundingStage: this.categorizeFundingStage(company),
          industries: company.Industries ? company.Industries.split(',').map(i => i.trim()) : [],
          cbRank: parseInt(company['CB Rank (Organization)']) || 0,
          isActive: company['Operating Status'] === 'Active'
        };
        
        this.geocodedCompanies.push(processedCompany);
      }
      
      // Add small delay to avoid rate limiting
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`✅ Processed ${this.geocodedCompanies.length} companies with coordinates`);
    return this.geocodedCompanies;
  }

  /**
   * Get companies by category
   */
  getCompaniesByCategory(category) {
    return this.geocodedCompanies.filter(company => company.category === category);
  }

  /**
   * Get companies by funding stage
   */
  getCompaniesByFundingStage(stage) {
    return this.geocodedCompanies.filter(company => company.fundingStage === stage);
  }

  /**
   * Get companies within radius of coordinates
   */
  getCompaniesNearby(lat, lng, radiusMiles = 25) {
    return this.geocodedCompanies.filter(company => {
      const distance = this.calculateDistance(
        [lng, lat],
        [company.coordinates.lng, company.coordinates.lat]
      );
      return distance <= radiusMiles;
    });
  }

  /**
   * Calculate distance between two coordinates in miles
   */
  calculateDistance(coord1, coord2) {
    const R = 3959; // Earth's radius in miles
    const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
    const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(coord1[1] * Math.PI / 180) * Math.cos(coord2[1] * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Get category statistics
   */
  getCategoryStats() {
    const stats = {};
    this.geocodedCompanies.forEach(company => {
      stats[company.category] = (stats[company.category] || 0) + 1;
    });
    return stats;
  }

  /**
   * Get funding stage statistics
   */
  getFundingStageStats() {
    const stats = {};
    this.geocodedCompanies.forEach(company => {
      stats[company.fundingStage] = (stats[company.fundingStage] || 0) + 1;
    });
    return stats;
  }

  /**
   * Convert companies to GeoJSON features for map visualization
   */
  toGeoJSONFeatures() {
    return this.geocodedCompanies.map(company => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [company.coordinates.lng, company.coordinates.lat]
      },
      properties: {
        id: company['Organization Name'],
        name: company['Organization Name'],
        category: company.category,
        fundingStage: company.fundingStage,
        industries: company.industries,
        description: company.Description,
        cbRank: company.cbRank,
        lastFundingDate: company['Last Funding Date'],
        lastFundingType: company['Last Funding Type'],
        url: company['Organization Name URL'],
        isActive: company.isActive,
        address: company.coordinates.address
      }
    }));
  }
}
