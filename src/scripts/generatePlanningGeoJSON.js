const fs = require('fs');
const path = require('path');
const { processAllPlanningDocs } = require('../utils/processPlanningDocs');

// Constants for rate limiting
const OPENAI_REQUESTS_PER_MINUTE = 10;
const GOOGLE_REQUESTS_PER_MINUTE = 60;
const BATCH_SIZE = 5;
const DELAY_BETWEEN_DOCS = 10000; // 10 seconds between documents

const LA_BOUNDS = {
  sw: [-118.529, 33.704],
  ne: [-118.121, 34.337]
};

function isWithinLABounds(coords) {
  return coords[0] >= LA_BOUNDS.sw[0] &&
         coords[0] <= LA_BOUNDS.ne[0] &&
         coords[1] >= LA_BOUNDS.sw[1] &&
         coords[1] <= LA_BOUNDS.ne[1];
}

function addSpatialVariation(baseCoords) {
  // Add small random variation (up to ~100m) to prevent point stacking
  const variation = 0.001; // roughly 100m
  return [
    baseCoords[0] + (Math.random() - 0.5) * variation,
    baseCoords[1] + (Math.random() - 0.5) * variation
  ];
}

function validateAndTransformFeature(feature, seenLocations) {
  if (!feature.geometry || !feature.geometry.coordinates) {
    console.warn('Invalid feature geometry:', feature);
    return null;
  }

  let coords = feature.geometry.coordinates;
  
  // Ensure coordinates are in [longitude, latitude] format
  if (Math.abs(coords[0]) <= 90 && Math.abs(coords[1]) > 90) {
    coords = [coords[1], coords[0]];
  }
  
  // Add spatial variation if coordinates are identical to prevent stacking
  const locationKey = `${coords[0]},${coords[1]}`;
  if (seenLocations.has(locationKey)) {
    coords = addSpatialVariation(coords);
  }
  seenLocations.add(`${coords[0]},${coords[1]}`);
  
  // Validate coordinates are within LA bounds
  if (!isWithinLABounds(coords)) {
    console.warn('Feature coordinates outside LA bounds:', coords);
    return null;
  }
  
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: coords
    },
    properties: {
      ...feature.properties,
      name: feature.properties.name || 'Unnamed Location',
      description: feature.properties.description || 'No description available',
      address: feature.properties.address,
      area: feature.properties.area || 'Unknown',
      impact: feature.properties.impact || 'Impact assessment pending',
      source: feature.properties.source || path.basename(feature.properties.sourceDocument || '', '_geo.json')
    }
  };
}

async function loadPlanningDocs() {
  // First check the extracted text directory
  const extractedTextDir = path.join(process.cwd(), 'public', 'processed_planning_docs', 'extracted_text');
  if (!fs.existsSync(extractedTextDir)) {
    fs.mkdirSync(extractedTextDir, { recursive: true });
  }

  const allDocs = [];
  
  // Load already extracted JSON files
  const jsonFiles = fs.readdirSync(extractedTextDir)
    .filter(file => file.endsWith('.json'));
  
  for (const file of jsonFiles) {
    try {
      const content = fs.readFileSync(path.join(extractedTextDir, file), 'utf8');
      const doc = JSON.parse(content);
      doc.filename = file;
      allDocs.push(doc);
    } catch (error) {
      console.error(`Error reading ${file}:`, error.message);
    }
  }

  console.log(`Loaded ${allDocs.length} pre-extracted documents`);
  return allDocs;
}

async function generateGeoJSON() {
  try {
    console.log('Loading planning documents...');
    const docs = await loadPlanningDocs();
    console.log(`Found ${docs.length} total documents\n`);

    if (docs.length === 0) {
      console.error('No documents found. Please run the text extraction script first.');
      process.exit(1);
    }

    // Sort documents by size to process smaller ones first
    docs.sort((a, b) => {
      const aSize = (a.content?.length || 0);
      const bSize = (b.content?.length || 0);
      return aSize - bSize;
    });

    // Process documents in batches
    const results = await processAllPlanningDocs(docs);

    // Save results
    const outputDir = path.join(process.cwd(), 'public', 'processed_planning_docs', 'single');
    fs.mkdirSync(outputDir, { recursive: true });

    fs.writeFileSync(
      path.join(outputDir, 'adaptive_reuse.geojson'),
      JSON.stringify(results.adaptiveReuse, null, 2)
    );

    fs.writeFileSync(
      path.join(outputDir, 'development_potential.geojson'),
      JSON.stringify(results.developmentPotential, null, 2)
    );

    console.log('\nProcessing complete!');
    console.log(`Time taken: ${results.timeTaken} seconds\n`);
    console.log('Results:');
    console.log(`- Adaptive reuse locations: ${results.adaptiveReuse.features.length}`);
    console.log(`- Development potential locations: ${results.developmentPotential.features.length}`);

  } catch (error) {
    console.error('Error generating GeoJSON:', error);
    process.exit(1);
  }
}

generateGeoJSON(); 