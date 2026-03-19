const fs = require('fs');
const path = require('path');

// Constants for filtering and cleanup
const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 100;
const MIN_DESCRIPTION_LENGTH = 20;
const LOCATION_MERGE_THRESHOLD = 0.001; // About 100m
const LA_BOUNDS = {
  north: 34.3373061,
  south: 33.7036917,
  east: -118.1552891,
  west: -118.6681759
};

// Patterns for filtering out non-location names
const INVALID_NAME_PATTERNS = [
  /^(?:this|the|that|these|those|it|there)\s+/i,
  /^(?:program|initiative|plan|policy|strategy|framework|guidelines?)\s/i,
  /^(?:vision|goal|objective|mission|purpose|approach|concept)\s/i,
  /^(?:process|system|method|procedure|protocol|standard)\s/i,
  /^(?:project|development|construction|building)\s*$/i,
  /^(?:area|zone|region|district|sector|territory)\s*$/i,
  /^(?:n\/a|undefined|null|none|unknown)\s*$/i,
  /^[^a-zA-Z0-9]+$/,
  /^\s*$/
];

// Known location aliases for normalization
const LOCATION_ALIASES = {
  'downtown': 'downtown los angeles',
  'downtown la': 'downtown los angeles',
  'dtla': 'downtown los angeles',
  'central la': 'central los angeles',
  'south la': 'south los angeles',
  'east la': 'east los angeles',
  'west la': 'west los angeles',
  'north la': 'north los angeles',
  'hollywood': 'hollywood los angeles',
  'venice beach': 'venice',
  'san pedro harbor': 'san pedro',
  'wilmington harbor': 'wilmington',
  'the harbor': 'harbor',
  'port': 'harbor'
};

function cleanName(name) {
  if (!name || typeof name !== 'string') return null;
  
  // Convert to lowercase and trim
  let cleaned = name.toLowerCase().trim();
  
  // Replace multiple spaces with single space
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  // Check for aliases
  cleaned = LOCATION_ALIASES[cleaned] || cleaned;
  
  // Remove any trailing punctuation
  cleaned = cleaned.replace(/[.,;:!?]+$/, '');
  
  // Check against invalid patterns
  if (INVALID_NAME_PATTERNS.some(pattern => pattern.test(cleaned))) {
    return null;
  }
  
  // Check length constraints
  if (cleaned.length < MIN_NAME_LENGTH || cleaned.length > MAX_NAME_LENGTH) {
    return null;
  }
  
  // Capitalize first letter of each word
  return cleaned.replace(/\b\w/g, l => l.toUpperCase());
}

function cleanDescription(description) {
  if (!description || typeof description !== 'string') return null;
  
  // Remove line breaks and extra spaces
  let cleaned = description.replace(/\s+/g, ' ').trim();
  
  // Ensure description is complete sentence(s)
  cleaned = cleaned.replace(/^\s*-\s*/, '');
  cleaned = cleaned.replace(/[,;]\s*$/, '.');
  if (!cleaned.endsWith('.')) cleaned += '.';
  
  // Check minimum length
  if (cleaned.length < MIN_DESCRIPTION_LENGTH) {
    return null;
  }
  
  return cleaned;
}

function isValidCoordinate(coords) {
  if (!Array.isArray(coords) || coords.length !== 2) return false;
  const [lng, lat] = coords;
  
  return (
    typeof lng === 'number' && 
    typeof lat === 'number' &&
    lng >= LA_BOUNDS.west &&
    lng <= LA_BOUNDS.east &&
    lat >= LA_BOUNDS.south &&
    lat <= LA_BOUNDS.north
  );
}

function calculateDistance(coord1, coord2) {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  const R = 6371e3; // Earth's radius in meters
  
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lng2-lng1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

function mergeNearbyLocations(features) {
  const merged = new Map();
  
  for (const feature of features) {
    const coords = feature.geometry.coordinates;
    let foundMatch = false;
    
    for (const [key, existing] of merged.entries()) {
      const distance = calculateDistance(coords, existing.geometry.coordinates);
      
      if (distance < LOCATION_MERGE_THRESHOLD * 1000) { // Convert to meters
        // Merge properties
        const mergedFeature = {
          ...existing,
          properties: {
            ...existing.properties,
            name: existing.properties.name,
            description: combineDescriptions(
              existing.properties.description,
              feature.properties.description
            ),
            source_count: (existing.properties.source_count || 1) + 1,
            sources: [...(existing.properties.sources || [existing.properties.source_document]),
                     feature.properties.source_document].filter(Boolean)
          }
        };
        merged.set(key, mergedFeature);
        foundMatch = true;
        break;
      }
    }
    
    if (!foundMatch) {
      const key = `${coords[0]},${coords[1]}`;
      merged.set(key, {
        ...feature,
        properties: {
          ...feature.properties,
          source_count: 1,
          sources: [feature.properties.source_document].filter(Boolean)
        }
      });
    }
  }
  
  return Array.from(merged.values());
}

function combineDescriptions(desc1, desc2) {
  if (!desc1) return desc2;
  if (!desc2) return desc1;
  
  // Remove duplicates and combine
  const sentences1 = new Set(desc1.split(/[.!?]+/).map(s => s.trim()).filter(Boolean));
  const sentences2 = new Set(desc2.split(/[.!?]+/).map(s => s.trim()).filter(Boolean));
  
  const combined = [...new Set([...sentences1, ...sentences2])]
    .filter(s => s.length >= 10)
    .join('. ');
    
  return combined + '.';
}

function cleanupFeatures(features) {
  // First pass: Basic cleanup and validation
  const cleanedFeatures = features
    .map(feature => {
      const name = cleanName(feature.properties.name);
      const description = cleanDescription(feature.properties.description);
      
      if (!name || !description || !isValidCoordinate(feature.geometry.coordinates)) {
        return null;
      }
      
      return {
        ...feature,
        properties: {
          ...feature.properties,
          name,
          description,
          area: feature.properties.area || 'Unknown',
          impact: feature.properties.impact || 'Impact assessment pending'
        }
      };
    })
    .filter(Boolean);
    
  // Second pass: Merge nearby locations
  const mergedFeatures = mergeNearbyLocations(cleanedFeatures);
  
  // Final pass: Sort by source count and name
  return mergedFeatures.sort((a, b) => {
    const countDiff = (b.properties.source_count || 1) - (a.properties.source_count || 1);
    if (countDiff !== 0) return countDiff;
    return a.properties.name.localeCompare(b.properties.name);
  });
}

async function cleanupMarkers() {
  const inputDir = path.join(process.cwd(), 'public', 'processed_planning_docs', 'single');
  const outputDir = path.join(process.cwd(), 'public', 'processed_planning_docs', 'cleaned');
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const files = ['adaptive_reuse.geojson', 'development_potential.geojson'];
  
  for (const file of files) {
    console.log(`\nProcessing ${file}...`);
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(outputDir, file);
    
    try {
      const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
      const originalCount = data.features.length;
      
      console.log(`Original features: ${originalCount}`);
      
      const cleanedFeatures = cleanupFeatures(data.features);
      const cleanedData = {
        type: 'FeatureCollection',
        features: cleanedFeatures
      };
      
      fs.writeFileSync(outputPath, JSON.stringify(cleanedData, null, 2));
      
      console.log(`Cleaned features: ${cleanedFeatures.length}`);
      console.log(`Reduction: ${((originalCount - cleanedFeatures.length) / originalCount * 100).toFixed(1)}%`);
      
      // Log some stats about the cleanup
      const sourceStats = cleanedFeatures.reduce((acc, f) => {
        const count = f.properties.source_count || 1;
        acc[count] = (acc[count] || 0) + 1;
        return acc;
      }, {});
      
      console.log('\nSource count distribution:');
      Object.entries(sourceStats)
        .sort(([a], [b]) => Number(b) - Number(a))
        .forEach(([count, num]) => {
          console.log(`  ${count} sources: ${num} locations`);
        });
        
    } catch (error) {
      console.error(`Error processing ${file}:`, error.message);
    }
  }
}

// Run the cleanup
cleanupMarkers().catch(console.error); 