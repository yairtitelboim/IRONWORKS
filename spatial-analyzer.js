#!/usr/bin/env node

/**
 * FIFA Houston Spatial Analysis Engine
 * 
 * This script preprocesses the 4 data layers locally to create rich, abstracted
 * data layers for Perplexity AI scenario analysis. It generates high-value prompts
 * for complex urban development questions without making API calls.
 * 
 * Goal: Create robust JSON data that can be sent to Perplexity API to answer
 * scenario-based questions like:
 * - Which downtown blocks become unaffordable first when FIFA investment triggers gentrification?
 * - How many new restaurants does it take to trigger residential development in Midtown Connector?
 * - At what threshold of downtown public investment does EaDo flip from warehouse district to entertainment hub?
 * - If Houston extends METRORail through EaDo, which parcels convert first and how does that reshape the surrounding 6 blocks?
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
  analysisRadius: 500, // meters for company density analysis
  maxCandidates: 10,
  walkabilityRadius: 800, // meters for walkability analysis
  clusteringRadius: 300, // meters for market clustering analysis
  amenityRadius: 400, // meters for amenity accessibility analysis
  publicInvestmentRadius: 600, // meters for public investment momentum analysis
  highwayPenalty: 0.3, // penalty for crossing major highways
  deadZonePenalty: 0.2, // penalty for parking lots/empty areas
  clusteringBonus: 0.4, // bonus for being near other conversion candidates
  // Updated scoring weights: 30% FIFA conversion score, 25% amenity, 20% public investment, 15% walkability, 10% economic
  scoringWeights: {
    fifaConversionScore: 0.30, // Use pre-calculated FIFA conversion scores
    amenityAccessibility: 0.25,
    publicInvestmentMomentum: 0.20,
    walkability: 0.15,
    economicDensity: 0.10
  },
  // FIFA data categories and their weights for amenity analysis
  fifaCategoryWeights: {
    'dining_entertainment': 0.3,    // 324 restaurants/cafes
    'entertainment_venue': 0.25,    // 214 parks, plazas, stadiums
    'pedestrian_zone': 0.2,         // 116 walkability infrastructure
    'hotel': 0.15,                  // 16 hotels
    'commercial_building': 0.1      // 52 commercial buildings
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
 * Check if a point is within a given radius of a center point
 */
function isWithinRadius(point, center, radiusMeters) {
  const distance = calculateDistance(point, center);
  return distance <= radiusMeters;
}

/**
 * Load FIFA data for a specific zone
 */
function loadFIFAData(zoneId, radius) {
  try {
    const fifaData = JSON.parse(fs.readFileSync(CONFIG.dataPaths.fifa, 'utf8'));
    const zone = CONFIG.fifaZones[zoneId];
    
    if (!zone) {
      throw new Error(`Zone ${zoneId} not found`);
    }
    
    // Filter FIFA data within zone radius
    const zoneFeatures = fifaData.features.filter(feature => {
      const coords = feature.geometry.coordinates;
      const point = { lat: coords[1], lng: coords[0] };
      return isWithinRadius(point, zone, radius);
    });
    
    // Categorize by priority
    const priority3 = zoneFeatures.filter(f => f.properties.priority === 3);
    const priority2 = zoneFeatures.filter(f => f.properties.priority === 2);
    const priority1 = zoneFeatures.filter(f => f.properties.priority === 1);
    
    // Extract office conversion candidates with pre-calculated scores
    const officeBuildings = zoneFeatures.filter(f => 
      f.properties.category.includes('office') && f.properties.conversion_score
    );
    
    // Extract amenities by category using FIFA's rich classification
    const amenities = {
      dining_entertainment: zoneFeatures.filter(f => f.properties.category === 'dining_entertainment'),
      entertainment_venue: zoneFeatures.filter(f => f.properties.category === 'entertainment_venue'),
      pedestrian_zone: zoneFeatures.filter(f => f.properties.category === 'pedestrian_zone'),
      hotel: zoneFeatures.filter(f => f.properties.category === 'hotel'),
      commercial_building: zoneFeatures.filter(f => f.properties.category === 'commercial_building'),
      parking: zoneFeatures.filter(f => f.properties.category === 'parking')
    };
    
    // Calculate amenity density scores using FIFA categories
    const amenityDensity = {};
    Object.entries(amenities).forEach(([category, features]) => {
      amenityDensity[category] = features.length;
    });
    
    return {
      total: zoneFeatures.length,
      priority3: priority3.length,
      priority2: priority2.length,
      priority1: priority1.length,
      features: zoneFeatures,
      priority3Features: priority3,
      // New: Office conversion candidates with pre-calculated scores
      officeBuildings: officeBuildings,
      conversionCandidates: officeBuildings.map(building => ({
        coordinates: building.geometry.coordinates,
        conversion_score: building.properties.conversion_score,
        priority: building.properties.priority,
        zone: building.properties.zone,
        name: building.properties.name || 'Unnamed Building',
        building_levels: building.properties.building_levels
      })),
      // New: Rich amenity data by category
      amenities: amenities,
      amenityDensity: amenityDensity,
      // New: Zone-specific intelligence
      zoneIntelligence: {
        totalAmenities: Object.values(amenities).reduce((sum, arr) => sum + arr.length, 0),
        highPriorityFeatures: priority3.length,
        conversionPotential: officeBuildings.length,
        walkabilityInfrastructure: amenities.pedestrian_zone.length
      }
    };
  } catch (error) {
    console.error('Error loading FIFA data:', error.message);
    return { 
      total: 0, priority3: 0, priority2: 0, priority1: 0, features: [], priority3Features: [],
      officeBuildings: [], conversionCandidates: [], amenities: {}, amenityDensity: {},
      zoneIntelligence: { totalAmenities: 0, highPriorityFeatures: 0, conversionPotential: 0, walkabilityInfrastructure: 0 }
    };
  }
}

/**
 * Load listings data for a specific zone
 */
function loadListingsData(zoneId, radius) {
  try {
    const listingsData = JSON.parse(fs.readFileSync(CONFIG.dataPaths.listings, 'utf8'));
    const zone = CONFIG.fifaZones[zoneId];
    
    if (!zone) {
      throw new Error(`Zone ${zoneId} not found`);
    }
    
    // Filter listings within zone radius
    const zoneListings = listingsData.features.filter(feature => {
      const coords = feature.geometry.coordinates;
      const point = { lat: coords[1], lng: coords[0] };
      return isWithinRadius(point, zone, radius);
    });
    
    // Categorize by type
    const officeBuildings = zoneListings.filter(f => 
      f.properties.property_type === 'office_buildings' || 
      f.properties.property_type === 'office_lease'
    );
    
    const residential = zoneListings.filter(f => 
      f.properties.property_type === 'residential_sale' || 
      f.properties.property_type === 'residential_rental' ||
      f.properties.property_type === 'condo_rental'
    );
    
    // Calculate market metrics
    const avgPrice = residential.length > 0 
      ? residential.reduce((sum, f) => sum + (f.properties.price || 0), 0) / residential.length
      : 0;
    
    const avgSqft = officeBuildings.length > 0
      ? officeBuildings.reduce((sum, f) => sum + (parseInt(f.properties.square_footage?.replace(/,/g, '') || '0')), 0) / officeBuildings.length
      : 0;
    
    return {
      total: zoneListings.length,
      officeBuildings: officeBuildings.length,
      residential: residential.length,
      avgPrice,
      avgSqft,
      features: zoneListings,
      officeFeatures: officeBuildings
    };
  } catch (error) {
    console.error('Error loading listings data:', error.message);
    return { total: 0, officeBuildings: 0, residential: 0, avgPrice: 0, avgSqft: 0, features: [], officeFeatures: [] };
  }
}

/**
 * Load TDLR construction data for a specific zone
 */
function loadTDLRData(zoneId, radius) {
  try {
    const tdlrData = JSON.parse(fs.readFileSync(CONFIG.dataPaths.tdlr, 'utf8'));
    const zone = CONFIG.fifaZones[zoneId];
    
    if (!zone) {
      throw new Error(`Zone ${zoneId} not found`);
    }
    
    // Filter TDLR data within zone radius
    const zoneProjects = tdlrData.features.filter(feature => {
      const coords = feature.geometry.coordinates;
      const point = { lat: coords[1], lng: coords[0] };
      return isWithinRadius(point, zone, radius);
    });
    
    // Categorize by status and work type
    const active = zoneProjects.filter(f => 
      f.properties.status === 'Project Registered' || 
      f.properties.status === 'Active'
    );
    
    const renovations = zoneProjects.filter(f => 
      f.properties.work_type === 'Renovation/Alteration'
    );
    
    const newConstruction = zoneProjects.filter(f => 
      f.properties.work_type === 'New Construction'
    );
    
    return {
      total: zoneProjects.length,
      active: active.length,
      renovations: renovations.length,
      newConstruction: newConstruction.length,
      features: zoneProjects.map(f => ({
        coordinates: f.geometry.coordinates,
        project: f.properties.project_name,
        work_type: f.properties.work_type,
        status: f.properties.status,
        cost: f.properties.cost,
        address: f.properties.address
      }))
    };
  } catch (error) {
    console.error('Error loading TDLR data:', error.message);
    return { total: 0, active: 0, renovations: 0, newConstruction: 0, features: [] };
  }
}

/**
 * Load company/startup data for a specific zone
 */
function loadCompanyData(zoneId, radius) {
  try {
    const companyData = JSON.parse(fs.readFileSync(CONFIG.dataPaths.companies, 'utf8'));
    const zone = CONFIG.fifaZones[zoneId];
    
    if (!zone) {
      throw new Error(`Zone ${zoneId} not found`);
    }
    
    // Filter companies within zone radius
    const zoneCompanies = companyData.companies.filter(company => {
      if (!company.headquarters_location || !company.headquarters_location.coordinates) {
        return false;
      }
      const coords = company.headquarters_location.coordinates;
      const point = { lat: coords.lat, lng: coords.lng };
      return isWithinRadius(point, zone, radius);
    });
    
    // Categorize by industry and size
    const techCompanies = zoneCompanies.filter(c => 
      c.industry && c.industry.toLowerCase().includes('tech')
    );
    
    const energyCompanies = zoneCompanies.filter(c => 
      c.industry && c.industry.toLowerCase().includes('energy')
    );
    
    const startups = zoneCompanies.filter(c => 
      c.employees && c.employees.max < 50
    );
    
    return {
      total: zoneCompanies.length,
      tech: techCompanies.length,
      energy: energyCompanies.length,
      startups: startups.length,
      features: zoneCompanies.map(c => ({
        coordinates: [c.headquarters_location.coordinates.lng, c.headquarters_location.coordinates.lat],
        name: c.name,
        industry: c.industry || 'Unknown',
        employees: c.employees ? c.employees.range : 'Unknown',
        status: c.operating_status || 'Unknown'
      }))
    };
  } catch (error) {
    console.error('Error loading company data:', error.message);
    return { total: 0, tech: 0, energy: 0, startups: 0, features: [] };
  }
}

/**
 * Find office buildings from listings data
 */
function findOfficeBuildings(listingsData) {
  return listingsData.officeFeatures.map(feature => ({
    coordinates: feature.geometry.coordinates,
    sqft: parseInt(feature.properties.square_footage?.replace(/,/g, '') || '0'),
    price: feature.properties.price || 0,
    address: feature.properties.address || 'Unknown',
    type: feature.properties.property_type || 'office'
  }));
}

/**
 * Count nearby companies within a given radius
 */
function countNearbyCompanies(building, companyData, radiusMeters) {
  const buildingPoint = { lat: building.coordinates[1], lng: building.coordinates[0] };
  
  return companyData.features.filter(company => {
    const companyPoint = { lat: company.coordinates[1], lng: company.coordinates[0] };
    return isWithinRadius(companyPoint, buildingPoint, radiusMeters);
  }).length;
}

/**
 * Calculate downtown amenity accessibility score for a building
 */
function calculateAmenityAccessibility(building, fifaData) {
  const buildingPoint = { lat: building.coordinates[1], lng: building.coordinates[0] };
  let amenityScore = 0;
  
  // Use FIFA's rich category system instead of raw OSM tags
  const nearbyAmenities = fifaData.features.filter(feature => {
    const coords = feature.geometry.coordinates;
    const featurePoint = { lat: coords[1], lng: coords[0] };
    return calculateDistance(buildingPoint, featurePoint) <= CONFIG.amenityRadius;
  });
  
  // Categorize using FIFA's sophisticated classification system
  const dining = nearbyAmenities.filter(f => f.properties.category === 'dining_entertainment');
  const entertainment = nearbyAmenities.filter(f => f.properties.category === 'entertainment_venue');
  const pedestrian = nearbyAmenities.filter(f => f.properties.category === 'pedestrian_zone');
  const hotels = nearbyAmenities.filter(f => f.properties.category === 'hotel');
  const commercial = nearbyAmenities.filter(f => f.properties.category === 'commercial_building');
  
  // Use FIFA category weights for more accurate scoring
  amenityScore += dining.length * CONFIG.fifaCategoryWeights.dining_entertainment;
  amenityScore += entertainment.length * CONFIG.fifaCategoryWeights.entertainment_venue;
  amenityScore += pedestrian.length * CONFIG.fifaCategoryWeights.pedestrian_zone;
  amenityScore += hotels.length * CONFIG.fifaCategoryWeights.hotel;
  amenityScore += commercial.length * CONFIG.fifaCategoryWeights.commercial_building;
  
  // Normalize to 0-1 scale based on FIFA data density
  // FIFA data shows 324 dining, 214 entertainment, 116 pedestrian zones total
  const maxPossibleScore = 20; // Conservative estimate for high-density areas
  return Math.min(1, amenityScore / maxPossibleScore);
}

/**
 * Calculate public investment momentum score for a building
 */
function calculatePublicInvestmentMomentum(building, tdlrData) {
  const buildingPoint = { lat: building.coordinates[1], lng: building.coordinates[0] };
  
  if (tdlrData.features.length === 0) return 0;
  
  // Find all public projects within investment radius
  const nearbyProjects = tdlrData.features.filter(project => {
    const projectPoint = { lat: project.coordinates[1], lng: project.coordinates[0] };
    return calculateDistance(buildingPoint, projectPoint) <= CONFIG.publicInvestmentRadius;
  });
  
  if (nearbyProjects.length === 0) return 0;
  
  // Calculate investment momentum based on project clustering and types
  let momentumScore = 0;
  
  // Base score for project density
  const projectDensity = nearbyProjects.length / (Math.PI * Math.pow(CONFIG.publicInvestmentRadius / 1000, 2));
  momentumScore += Math.min(0.4, projectDensity * 0.1);
  
  // Bonus for project type diversity (infrastructure, renovation, new construction)
  const projectTypes = new Set(nearbyProjects.map(p => p.work_type));
  momentumScore += projectTypes.size * 0.1;
  
  // Bonus for high-value projects (based on cost)
  const totalInvestment = nearbyProjects.reduce((sum, p) => sum + (p.cost || 0), 0);
  const avgInvestment = totalInvestment / nearbyProjects.length;
  if (avgInvestment > 1000000) { // $1M+ projects
    momentumScore += 0.2;
  } else if (avgInvestment > 500000) { // $500K+ projects
    momentumScore += 0.1;
  }
  
  // Bonus for coordinated development (multiple projects in same area)
  if (nearbyProjects.length >= 3) {
    momentumScore += 0.3; // Strong coordinated investment
  } else if (nearbyProjects.length >= 2) {
    momentumScore += 0.15; // Moderate coordinated investment
  }
  
  return Math.min(1, momentumScore);
}

/**
 * Calculate walkability score for a building based on pedestrian infrastructure
 */
function calculateWalkabilityScore(building, listingsData) {
  const buildingPoint = { lat: building.coordinates[1], lng: building.coordinates[0] };
  let walkabilityScore = 1.0;
  
  // Check for nearby pedestrian infrastructure
  const nearbyFeatures = listingsData.features.filter(feature => {
    const coords = feature.geometry.coordinates;
    const featurePoint = { lat: coords[1], lng: coords[0] };
    return calculateDistance(buildingPoint, featurePoint) <= CONFIG.walkabilityRadius;
  });
  
  // Bonus for pedestrian-friendly infrastructure
  const pedestrianInfrastructure = nearbyFeatures.filter(f => 
    f.properties.amenity === 'restaurant' || 
    f.properties.amenity === 'cafe' ||
    f.properties.leisure === 'park' ||
    f.properties.highway === 'pedestrian' ||
    f.properties.highway === 'footway' ||
    f.properties.highway === 'path'
  );
  
  walkabilityScore += (pedestrianInfrastructure.length * 0.1);
  
  // Penalty for parking lots and empty areas
  const parkingLots = nearbyFeatures.filter(f => 
    f.properties.amenity === 'parking' ||
    f.properties.landuse === 'parking'
  );
  
  walkabilityScore -= (parkingLots.length * CONFIG.deadZonePenalty);
  
  // Penalty for being near major highways
  const highways = nearbyFeatures.filter(f => 
    f.properties.highway === 'primary' ||
    f.properties.highway === 'motorway' ||
    f.properties.highway === 'trunk'
  );
  
  walkabilityScore -= (highways.length * CONFIG.highwayPenalty);
  
  // Check for walkable corridors (restaurants, parks creating pathways)
  const corridorFeatures = nearbyFeatures.filter(f => 
    f.properties.highway === 'pedestrian' ||
    f.properties.leisure === 'park' ||
    f.properties.amenity === 'restaurant'
  );
  
  if (corridorFeatures.length > 0) {
    walkabilityScore += 0.3; // Bonus for being in a walkable corridor
  }
  
  return Math.max(0, Math.min(1, walkabilityScore));
}

/**
 * Calculate market clustering potential for a building
 */
function calculateClusteringPotential(building, allCandidates, listingsData) {
  const buildingPoint = { lat: building.coordinates[1], lng: building.coordinates[0] };
  
  // Find other conversion candidates within clustering radius
  const nearbyCandidates = allCandidates.filter(candidate => {
    if (candidate === building) return false;
    const candidatePoint = { lat: candidate.coordinates[1], lng: candidate.coordinates[0] };
    return calculateDistance(buildingPoint, candidatePoint) <= CONFIG.clusteringRadius;
  });
  
  // Calculate clustering score based on nearby candidates
  let clusteringScore = 0;
  
  if (nearbyCandidates.length > 0) {
    // Base clustering bonus
    clusteringScore += CONFIG.clusteringBonus;
    
    // Additional bonus for density
    const density = nearbyCandidates.length / (Math.PI * Math.pow(CONFIG.clusteringRadius / 1000, 2));
    clusteringScore += Math.min(0.3, density * 0.1);
  }
  
  // Check for existing amenity support within clustering radius
  const nearbyAmenities = listingsData.features.filter(feature => {
    const coords = feature.geometry.coordinates;
    const featurePoint = { lat: coords[1], lng: coords[0] };
    return calculateDistance(buildingPoint, featurePoint) <= CONFIG.clusteringRadius;
  });
  
  const amenityTypes = nearbyAmenities.filter(f => 
    f.properties.amenity === 'restaurant' ||
    f.properties.amenity === 'cafe' ||
    f.properties.amenity === 'pharmacy' ||
    f.properties.amenity === 'bank' ||
    f.properties.shop === 'supermarket' ||
    f.properties.shop === 'convenience'
  );
  
  // Bonus for existing amenity support
  clusteringScore += (amenityTypes.length * 0.05);
  
  return Math.min(1, clusteringScore);
}

/**
 * Find critical mass zones where multiple conversion candidates cluster together
 */
function findCriticalMassZones(candidates) {
  const clusters = [];
  const processed = new Set();
  
  candidates.forEach((candidate, index) => {
    if (processed.has(index)) return;
    
    const cluster = [candidate];
    const candidatePoint = { lat: candidate.coordinates[1], lng: candidate.coordinates[0] };
    
    // Find all nearby candidates
    candidates.forEach((other, otherIndex) => {
      if (otherIndex === index || processed.has(otherIndex)) return;
      
      const otherPoint = { lat: other.coordinates[1], lng: other.coordinates[0] };
      const distance = calculateDistance(candidatePoint, otherPoint);
      
      if (distance <= CONFIG.clusteringRadius) {
        cluster.push(other);
        processed.add(otherIndex);
      }
    });
    
    if (cluster.length >= 3) { // Critical mass threshold
      const centerLat = cluster.reduce((sum, c) => sum + c.coordinates[1], 0) / cluster.length;
      const centerLng = cluster.reduce((sum, c) => sum + c.coordinates[0], 0) / cluster.length;
      
      clusters.push({
        center: [centerLng, centerLat],
        size: cluster.length,
        avg_score: cluster.reduce((sum, c) => sum + c.conversion_score, 0) / cluster.length,
        buildings: cluster.map(c => c.address)
      });
    }
    
    processed.add(index);
  });
  
  return clusters.sort((a, b) => b.size - a.size);
}

/**
 * Summarize downtown amenity context
 */
function summarizeAmenityContext(fifaData) {
  // Use FIFA's rich category system instead of raw OSM tags
  const total = fifaData.zoneIntelligence?.totalAmenities || fifaData.total;
  const dining = fifaData.amenityDensity?.dining_entertainment || 0;
  const entertainment = fifaData.amenityDensity?.entertainment_venue || 0;
  const pedestrian = fifaData.amenityDensity?.pedestrian_zone || 0;
  const hotels = fifaData.amenityDensity?.hotel || 0;
  const commercial = fifaData.amenityDensity?.commercial_building || 0;
  const parking = fifaData.amenityDensity?.parking || 0;
  
  return `${dining} dining/entertainment, ${entertainment} entertainment venues, ${pedestrian} pedestrian zones, ${hotels} hotels, ${commercial} commercial buildings (${total} total amenities within zone)`;
}

/**
 * Calculate market momentum signals
 */
function calculateMarketMomentum(listingsData) {
  const residential = listingsData.residential;
  const officeBuildings = listingsData.officeBuildings;
  const avgPrice = listingsData.avgPrice;
  const avgSqft = listingsData.avgSqft;
  
  // Calculate basic market metrics
  const pricePerSqft = avgSqft > 0 ? Math.round(avgPrice / avgSqft) : 0;
  const officeVacancyRate = officeBuildings > 0 ? Math.round((officeBuildings / (officeBuildings + residential)) * 100) : 0;
  
  return `${residential} residential listings (avg $${Math.round(avgPrice).toLocaleString()}), ${officeBuildings} office buildings (avg ${Math.round(avgSqft).toLocaleString()} sqft, $${pricePerSqft}/sqft), estimated ${officeVacancyRate}% office vacancy`;
}

/**
 * Extract construction schedule timeline
 */
function extractConstructionSchedule(tdlrData) {
  const total = tdlrData.total;
  const active = tdlrData.active;
  const renovations = tdlrData.renovations;
  const newConstruction = tdlrData.newConstruction;
  
  return `${active} active projects (${renovations} renovations, ${newConstruction} new construction) - ${total} total projects in zone`;
}

/**
 * Main analysis function for a specific zone
 */
function analyzeZone(zoneId, radius) {
  console.log(`\n🔍 Analyzing zone: ${zoneId} (radius: ${radius}m)`);
  
  // 1. Load all 4 data layers - FIFA is now primary intelligence source
  const fifaData = loadFIFAData(zoneId, radius);
  const listingsData = loadListingsData(zoneId, radius);
  const tdlrData = loadTDLRData(zoneId, radius);
  const companyData = loadCompanyData(zoneId, radius);
  
  console.log(`📊 Data loaded: FIFA(${fifaData.total}), Listings(${listingsData.total}), TDLR(${tdlrData.total}), Companies(${companyData.total})`);
  console.log(`🏟️ FIFA Intelligence: ${fifaData.conversionCandidates.length} office buildings with pre-calculated scores`);
  console.log(`🍽️ FIFA Amenities: ${fifaData.zoneIntelligence.totalAmenities} total amenities across ${Object.keys(fifaData.amenities).length} categories`);
  
  // 2. Use FIFA conversion candidates as primary source, supplement with listings data
  const fifaConversionCandidates = fifaData.conversionCandidates || [];
  const listingsOfficeBuildings = findOfficeBuildings(listingsData);
  
  // Combine FIFA candidates with listings data for comprehensive analysis
  const allCandidates = [...fifaConversionCandidates];
  
  // Add listings buildings that aren't already in FIFA data
  listingsOfficeBuildings.forEach(listingBuilding => {
    const isAlreadyIncluded = fifaConversionCandidates.some(fifaBuilding => 
      calculateDistance(
        { lat: listingBuilding.coordinates[1], lng: listingBuilding.coordinates[0] },
        { lat: fifaBuilding.coordinates[1], lng: fifaBuilding.coordinates[0] }
      ) < 50 // Within 50 meters
    );
    
    if (!isAlreadyIncluded) {
      allCandidates.push({
        coordinates: listingBuilding.coordinates,
        sqft: listingBuilding.sqft,
        price: listingBuilding.price,
        address: listingBuilding.address,
        conversion_score: 0, // Will be calculated
        priority: 1, // Default priority
        zone: zoneId,
        name: listingBuilding.address || 'Unnamed Building',
        building_levels: null
      });
    }
  });

  // Filter candidates within zone radius
  const filteredCandidates = allCandidates.filter(building => {
    const zone = CONFIG.fifaZones[zoneId];
    const buildingPoint = { lat: building.coordinates[1], lng: building.coordinates[0] };
    return isWithinRadius(buildingPoint, zone, radius);
  });

  // Calculate enhanced scores for each candidate
  const buildingsWithScores = filteredCandidates.map(building => {
    // Use pre-calculated FIFA conversion score if available, otherwise calculate
    const fifaConversionScore = building.conversion_score ? building.conversion_score / 100 : 0; // Normalize 0-100 to 0-1
    
    const amenityAccessibility = calculateAmenityAccessibility(building, fifaData);
    const publicInvestmentMomentum = calculatePublicInvestmentMomentum(building, tdlrData);
    const companyDensity = countNearbyCompanies(building, companyData, CONFIG.analysisRadius);
    const walkabilityScore = calculateWalkabilityScore(building, listingsData);
    
    return {
      coordinates: building.coordinates,
      sqft: building.sqft,
      price: building.price,
      address: building.address,
      name: building.name,
      building_levels: building.building_levels,
      priority: building.priority,
      // Use FIFA conversion score as primary factor
      fifa_conversion_score: fifaConversionScore,
      amenity_accessibility: Math.round(amenityAccessibility * 100) / 100,
      public_investment_momentum: Math.round(publicInvestmentMomentum * 100) / 100,
      economic_density: companyDensity,
      walkability_score: Math.round(walkabilityScore * 100) / 100,
      // Temporary clustering score (will be recalculated)
      clustering_score: 0
    };
  });

  // Second pass: calculate clustering scores (requires all other scores)
  const buildingsWithClustering = buildingsWithScores.map(building => {
    const clusteringScore = calculateClusteringPotential(building, buildingsWithScores, listingsData);
    return {
      ...building,
      clustering_score: Math.round(clusteringScore * 100) / 100
    };
  });

  // Calculate enhanced conversion scores with FIFA data as primary intelligence
  const conversionCandidates = buildingsWithClustering
    .map(building => {
      // Weighted combination with FIFA conversion score as primary factor
      const baseScore = (building.fifa_conversion_score * CONFIG.scoringWeights.fifaConversionScore) + 
                       (building.amenity_accessibility * CONFIG.scoringWeights.amenityAccessibility) + 
                       (building.public_investment_momentum * CONFIG.scoringWeights.publicInvestmentMomentum) + 
                       (building.walkability_score * CONFIG.scoringWeights.walkability) + 
                       (Math.min(building.economic_density / 20, 1) * CONFIG.scoringWeights.economicDensity);
      
      return {
        ...building,
        conversion_score: Math.round(baseScore * 100) / 100,
        // Enhanced score breakdown including FIFA intelligence
        score_breakdown: {
          fifa_conversion_weight: Math.round(building.fifa_conversion_score * CONFIG.scoringWeights.fifaConversionScore * 100) / 100,
          amenity_weight: Math.round(building.amenity_accessibility * CONFIG.scoringWeights.amenityAccessibility * 100) / 100,
          investment_weight: Math.round(building.public_investment_momentum * CONFIG.scoringWeights.publicInvestmentMomentum * 100) / 100,
          walkability_weight: Math.round(building.walkability_score * CONFIG.scoringWeights.walkability * 100) / 100,
          economic_weight: Math.round(Math.min(building.economic_density / 20, 1) * CONFIG.scoringWeights.economicDensity * 100) / 100
        }
      };
    })
    .sort((a, b) => b.conversion_score - a.conversion_score)
    .slice(0, CONFIG.maxCandidates);
  
  // 3. Generate analytical payload with FIFA intelligence
  const analysis = {
    zone_analysis: {
      zone_id: zoneId,
      zone_name: CONFIG.fifaZones[zoneId].name,
      radius_meters: radius,
      conversion_candidates: conversionCandidates,
      amenity_context: summarizeAmenityContext(fifaData),
      market_signals: calculateMarketMomentum(listingsData),
      development_timeline: extractConstructionSchedule(tdlrData),
      // FIFA Intelligence data
      fifa_intelligence: {
        conversion_candidates: fifaData.conversionCandidates?.length || 0,
        high_priority_features: fifaData.zoneIntelligence?.highPriorityFeatures || 0,
        walkability_infrastructure: fifaData.zoneIntelligence?.walkabilityInfrastructure || 0,
        total_amenities: fifaData.zoneIntelligence?.totalAmenities || 0,
        amenity_breakdown: fifaData.amenityDensity || {},
        office_buildings_with_scores: fifaData.officeBuildings?.length || 0
      },
      summary: {
        total_office_buildings: filteredCandidates.length,
        high_potential_candidates: conversionCandidates.filter(c => c.conversion_score > 0.7).length,
        avg_conversion_score: conversionCandidates.length > 0 
          ? Math.round(conversionCandidates.reduce((sum, c) => sum + c.conversion_score, 0) / conversionCandidates.length * 100) / 100
          : 0,
        walkability_analysis: {
          avg_walkability: conversionCandidates.length > 0 
            ? Math.round(conversionCandidates.reduce((sum, c) => sum + c.walkability_score, 0) / conversionCandidates.length * 100) / 100
            : 0,
          high_walkability_candidates: conversionCandidates.filter(c => c.walkability_score > 0.7).length
        },
        clustering_analysis: {
          avg_clustering: conversionCandidates.length > 0 
            ? Math.round(conversionCandidates.reduce((sum, c) => sum + c.clustering_score, 0) / conversionCandidates.length * 100) / 100
            : 0,
          clustered_candidates: conversionCandidates.filter(c => c.clustering_score > 0.3).length,
          critical_mass_zones: findCriticalMassZones(conversionCandidates)
        }
      }
    }
  };
  
  return analysis;
}

/**
 * Generate basic Perplexity-optimized prompt (for backward compatibility)
 */
function generatePerplexityPrompt(analysis) {
  const zone = analysis.zone_analysis;
  
  return `Analyze office-to-residential conversion potential in ${zone.zone_name} FIFA zone. 

CONTEXT:
- Zone: ${zone.zone_name} (center: ${CONFIG.fifaZones[zone.zone_id].lat}, ${CONFIG.fifaZones[zone.zone_id].lng}, radius: ${zone.radius_meters}m)
- ${zone.amenity_context}
- Market: ${zone.market_signals}
- Timeline: ${zone.development_timeline}

CONVERSION CANDIDATES (${zone.conversion_candidates.length} buildings):
${zone.conversion_candidates.map((c, i) => 
  `${i+1}. ${c.address || c.name} - ${c.sqft} sqft, $${c.price.toLocaleString()}, Score: ${c.conversion_score}
     FIFA Score: ${c.fifa_conversion_score}, Amenities: ${c.amenity_accessibility}, Public Investment: ${c.public_investment_momentum}, Walkability: ${c.walkability_score}, Economic: ${c.economic_density}
     Priority: ${c.priority || 'N/A'}, Building Levels: ${c.building_levels || 'N/A'}`
).join('\n')}

FIFA INTELLIGENCE ANALYSIS:
- Pre-calculated conversion candidates: ${zone.fifa_intelligence?.conversion_candidates || 0}
- High-priority features: ${zone.fifa_intelligence?.high_priority_features || 0}
- Walkability infrastructure: ${zone.fifa_intelligence?.walkability_infrastructure || 0}

WALKABILITY ANALYSIS:
- Average walkability score: ${zone.summary.walkability_analysis.avg_walkability}
- High walkability candidates: ${zone.summary.walkability_analysis.high_walkability_candidates}

CLUSTERING ANALYSIS:
- Average clustering potential: ${zone.summary.clustering_analysis.avg_clustering}
- Clustered candidates: ${zone.summary.clustering_analysis.clustered_candidates}
- Critical mass zones: ${zone.summary.clustering_analysis.critical_mass_zones.length} identified

REQUIRED OUTPUT: Return your analysis as GeoJSON features with specific coordinates for high-conversion-potential office buildings. Include properties: conversion_probability (0-1), reasoning, timeline, walkability_assessment, clustering_potential. Focus on buildings with conversion_score > 0.7 and consider FIFA intelligence, walkability corridors, and clustering effects.`;
}

/**
 * Generate scenario-specific prompts for complex urban development questions
 */
function generateScenarioPrompts(allAnalyses) {
  const scenarios = {
    gentrification_analysis: generateGentrificationPrompt(allAnalyses),
    restaurant_threshold_analysis: generateRestaurantThresholdPrompt(allAnalyses),
    public_investment_threshold_analysis: generatePublicInvestmentThresholdPrompt(allAnalyses),
    metro_rail_impact_analysis: generateMetroRailImpactPrompt(allAnalyses)
  };
  
  return scenarios;
}

/**
 * Generate prompt for gentrification analysis
 */
function generateGentrificationPrompt(allAnalyses) {
  const downtown = allAnalyses.downtown_core.zone_analysis;
  const eado = allAnalyses.eado_district.zone_analysis;
  const midtown = allAnalyses.midtown_connector.zone_analysis;
  
  return `Analyze gentrification patterns triggered by FIFA investment in downtown Houston.

CONTEXT:
- Downtown Core: ${downtown.amenity_context}, ${downtown.market_signals}
- EaDo District: ${eado.amenity_context}, ${eado.market_signals}  
- Midtown Connector: ${midtown.amenity_context}, ${midtown.market_signals}

FIFA INVESTMENT IMPACT:
- High-priority features: ${downtown.fifa_intelligence.high_priority_features} in Downtown, ${eado.fifa_intelligence.high_priority_features} in EaDo, ${midtown.fifa_intelligence.high_priority_features} in Midtown
- Walkability infrastructure: ${downtown.fifa_intelligence.walkability_infrastructure} pedestrian zones in Downtown, ${eado.fifa_intelligence.walkability_infrastructure} in EaDo, ${midtown.fifa_intelligence.walkability_infrastructure} in Midtown

CONVERSION CANDIDATES BY VULNERABILITY:
Downtown Core (${downtown.conversion_candidates.length} buildings):
${downtown.conversion_candidates.slice(0, 5).map((c, i) => 
  `${i+1}. ${c.address || c.name} - Score: ${c.conversion_score}, Price: $${c.price.toLocaleString()}, Amenities: ${c.amenity_accessibility}`
).join('\n')}

EaDo District (${eado.conversion_candidates.length} buildings):
${eado.conversion_candidates.slice(0, 5).map((c, i) => 
  `${i+1}. ${c.address || c.name} - Score: ${c.conversion_score}, Price: $${c.price.toLocaleString()}, Amenities: ${c.amenity_accessibility}`
).join('\n')}

Midtown Connector (${midtown.conversion_candidates.length} buildings):
${midtown.conversion_candidates.slice(0, 5).map((c, i) => 
  `${i+1}. ${c.address || c.name} - Score: ${c.conversion_score}, Price: $${c.price.toLocaleString()}, Amenities: ${c.amenity_accessibility}`
).join('\n')}

REQUIRED OUTPUT: Return GeoJSON features identifying which downtown blocks become unaffordable first when FIFA investment triggers gentrification. Include properties: gentrification_risk (0-1), timeline_to_unaffordable (months), current_affordability_index, post_fifa_affordability_index, displacement_risk_factors, neighborhood_characteristics. Focus on buildings with high conversion scores and low current prices.`;
}

/**
 * Generate prompt for restaurant threshold analysis
 */
function generateRestaurantThresholdPrompt(allAnalyses) {
  const midtown = allAnalyses.midtown_connector.zone_analysis;
  
  return `Analyze the restaurant density threshold needed to trigger residential development in Midtown Connector.

CONTEXT:
- Zone: Midtown Connector (center: 29.7499, -95.3582, radius: 1000m)
- Current amenities: ${midtown.amenity_context}
- Market signals: ${midtown.market_signals}
- Development timeline: ${midtown.development_timeline}

CURRENT RESTAURANT DENSITY:
- Dining/entertainment venues: ${midtown.fifa_intelligence.amenity_breakdown.dining_entertainment || 0}
- Entertainment venues: ${midtown.fifa_intelligence.amenity_breakdown.entertainment_venue || 0}
- Total amenities: ${midtown.fifa_intelligence.total_amenities}

CONVERSION CANDIDATES (${midtown.conversion_candidates.length} buildings):
${midtown.conversion_candidates.map((c, i) => 
  `${i+1}. ${c.address || c.name} - ${c.sqft} sqft, $${c.price.toLocaleString()}, Score: ${c.conversion_score}
     Amenities: ${c.amenity_accessibility}, Walkability: ${c.walkability_score}, Clustering: ${c.clustering_score}`
).join('\n')}

CLUSTERING ANALYSIS:
- Average clustering: ${midtown.summary.clustering_analysis.avg_clustering}
- Clustered candidates: ${midtown.summary.clustering_analysis.clustered_candidates}
- Critical mass zones: ${midtown.summary.clustering_analysis.critical_mass_zones.length}

REQUIRED OUTPUT: Return GeoJSON features showing how many new restaurants are needed to trigger residential development in Midtown Connector. Include properties: restaurants_needed (count), development_trigger_threshold, current_restaurant_density, projected_development_timeline, amenity_support_requirements, clustering_requirements. Focus on the relationship between restaurant density and conversion potential.`;
}

/**
 * Generate prompt for public investment threshold analysis
 */
function generatePublicInvestmentThresholdPrompt(allAnalyses) {
  const eado = allAnalyses.eado_district.zone_analysis;
  
  return `Analyze the public investment threshold needed to flip EaDo from warehouse district to entertainment hub.

CONTEXT:
- Zone: EaDo Fan Festival Zone (center: 29.7394, -95.3467, radius: 2000m)
- Current amenities: ${eado.amenity_context}
- Market signals: ${eado.market_signals}
- Development timeline: ${eado.development_timeline}

CURRENT INFRASTRUCTURE:
- High-priority features: ${eado.fifa_intelligence.high_priority_features}
- Walkability infrastructure: ${eado.fifa_intelligence.walkability_infrastructure}
- Total amenities: ${eado.fifa_intelligence.total_amenities}
- Amenity breakdown: ${JSON.stringify(eado.fifa_intelligence.amenity_breakdown)}

CONVERSION CANDIDATES (${eado.conversion_candidates.length} buildings):
${eado.conversion_candidates.map((c, i) => 
  `${i+1}. ${c.address || c.name} - ${c.sqft} sqft, $${c.price.toLocaleString()}, Score: ${c.conversion_score}
     Public Investment: ${c.public_investment_momentum}, Amenities: ${c.amenity_accessibility}, Walkability: ${c.walkability_score}`
).join('\n')}

PUBLIC INVESTMENT ANALYSIS:
- Active projects: ${eado.development_timeline}
- Average public investment momentum: ${eado.summary.avg_conversion_score}

REQUIRED OUTPUT: Return GeoJSON features showing the public investment threshold needed to flip EaDo from warehouse district to entertainment hub. Include properties: investment_threshold_dollars, entertainment_venue_requirements, infrastructure_upgrades_needed, timeline_to_entertainment_hub, current_warehouse_density, projected_entertainment_density, gentrification_risk_factors. Focus on the transformation from industrial to entertainment uses.`;
}

/**
 * Generate prompt for METRORail impact analysis
 */
function generateMetroRailImpactPrompt(allAnalyses) {
  const eado = allAnalyses.eado_district.zone_analysis;
  const midtown = allAnalyses.midtown_connector.zone_analysis;
  
  return `Analyze the impact of extending METRORail through EaDo on parcel conversion and surrounding 6-block reshaping.

CONTEXT:
- EaDo District: ${eado.amenity_context}, ${eado.market_signals}
- Midtown Connector: ${midtown.amenity_context}, ${midtown.market_signals}
- Current transit infrastructure: ${eado.fifa_intelligence.walkability_infrastructure} pedestrian zones in EaDo, ${midtown.fifa_intelligence.walkability_infrastructure} in Midtown

CURRENT TRANSIT CONNECTIVITY:
- EaDo walkability infrastructure: ${eado.fifa_intelligence.walkability_infrastructure}
- Midtown walkability infrastructure: ${midtown.fifa_intelligence.walkability_infrastructure}
- High-priority features: ${eado.fifa_intelligence.high_priority_features} in EaDo, ${midtown.fifa_intelligence.high_priority_features} in Midtown

CONVERSION CANDIDATES AFFECTED:
EaDo District (${eado.conversion_candidates.length} buildings):
${eado.conversion_candidates.map((c, i) => 
  `${i+1}. ${c.address || c.name} - Score: ${c.conversion_score}, Walkability: ${c.walkability_score}, Distance to potential rail: [calculate]`
).join('\n')}

Midtown Connector (${midtown.conversion_candidates.length} buildings):
${midtown.conversion_candidates.map((c, i) => 
  `${i+1}. ${c.address || c.name} - Score: ${c.conversion_score}, Walkability: ${c.walkability_score}, Distance to existing rail: [calculate]`
).join('\n')}

REQUIRED OUTPUT: Return GeoJSON features showing which parcels convert first when METRORail extends through EaDo and how that reshapes the surrounding 6 blocks. Include properties: rail_proximity_score, conversion_priority, development_timeline, surrounding_block_impact, transit_accessibility_boost, gentrification_risk, infrastructure_requirements, community_impact_assessment. Focus on the ripple effects of transit infrastructure on development patterns.`;
}

/**
 * Main execution
 */
function main() {
  console.log('🏗️ FIFA Houston Spatial Analysis Engine');
  console.log('=====================================');
  
  // Analyze all zones
  const allAnalyses = {};
  
  Object.keys(CONFIG.fifaZones).forEach(zoneId => {
    const zone = CONFIG.fifaZones[zoneId];
    allAnalyses[zoneId] = analyzeZone(zoneId, zone.radius);
  });
  
  // Save analysis results
  const outputPath = './public/spatial-analysis-results.json';
  fs.writeFileSync(outputPath, JSON.stringify(allAnalyses, null, 2));
  console.log(`\n💾 Analysis saved to: ${outputPath}`);
  
  // Generate scenario-specific prompts for complex urban development questions
  const scenarioPrompts = generateScenarioPrompts(allAnalyses);
  const promptsPath = './public/perplexity-scenario-prompts.json';
  
  fs.writeFileSync(promptsPath, JSON.stringify(scenarioPrompts, null, 2));
  console.log(`📝 Scenario-specific prompts saved to: ${promptsPath}`);
  
  // Also generate individual zone prompts for backward compatibility
  const zonePrompts = {};
  Object.keys(allAnalyses).forEach(zoneId => {
    zonePrompts[zoneId] = generatePerplexityPrompt(allAnalyses[zoneId]);
  });
  
  const zonePromptsPath = './public/perplexity-zone-prompts.json';
  fs.writeFileSync(zonePromptsPath, JSON.stringify(zonePrompts, null, 2));
  console.log(`📝 Zone-specific prompts saved to: ${zonePromptsPath}`);
  
  // Display summary
  console.log('\n📊 Analysis Summary:');
  Object.keys(allAnalyses).forEach(zoneId => {
    const analysis = allAnalyses[zoneId].zone_analysis;
    const walkability = analysis.summary.walkability_analysis;
    const clustering = analysis.summary.clustering_analysis;
    
    console.log(`  ${zoneId}: ${analysis.conversion_candidates.length} candidates, avg score: ${analysis.summary.avg_conversion_score}`);
    console.log(`    Amenities: ${analysis.amenity_context}`);
    console.log(`    Walkability: ${walkability.avg_walkability} avg, ${walkability.high_walkability_candidates} high-walkability`);
    console.log(`    Clustering: ${clustering.avg_clustering} avg, ${clustering.clustered_candidates} clustered, ${clustering.critical_mass_zones.length} critical mass zones`);
  });
  
  console.log('\n🎯 Scenario-Specific Prompts Generated:');
  console.log('  gentrification_analysis: Which downtown blocks become unaffordable first when FIFA investment triggers gentrification?');
  console.log('  restaurant_threshold_analysis: How many new restaurants does it take to trigger residential development in Midtown Connector?');
  console.log('  public_investment_threshold_analysis: At what threshold of downtown public investment does EaDo flip from warehouse district to entertainment hub?');
  console.log('  metro_rail_impact_analysis: If Houston extends METRORail through EaDo, which parcels convert first and how does that reshape the surrounding 6 blocks?');
  
  console.log('\n✅ Spatial analysis complete! Ready for Perplexity API calls.');
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  analyzeZone,
  calculateDistance,
  isWithinRadius,
  generatePerplexityPrompt
};
