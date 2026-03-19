const fs = require('fs');
const turf = require('@turf/turf');

// Input and output files
const INPUT = 'public/data/us277_sonora_rocksprings_extended.geojson';
const OUTPUT = 'public/data/us277_sonora_rocksprings_to_55_trimmed.geojson';

// TX-55 split coordinate
const splitCoord = [-100.645773, 30.284939];

// Load the GeoJSON
const data = JSON.parse(fs.readFileSync(INPUT));

// Function to check if a feature ends at or before the split point
function endsAtOrBeforeSplit(feature) {
  if (feature.geometry.type !== 'LineString') return false;
  
  const coords = feature.geometry.coordinates;
  const lastCoord = coords[coords.length - 1];
  
  // Check if the last coordinate is at or north of the split point
  return lastCoord[1] >= splitCoord[1];
}

// Function to trim a feature at the split point
function trimFeatureAtSplit(feature) {
  if (feature.geometry.type !== 'LineString') return feature;
  
  const coords = feature.geometry.coordinates;
  const trimmedCoords = [];
  
  for (let i = 0; i < coords.length; i++) {
    const coord = coords[i];
    if (coord[1] <= splitCoord[1]) {
      trimmedCoords.push(coord);
    } else {
      // Add the split point as the final coordinate
      trimmedCoords.push(splitCoord);
      break;
    }
  }
  
  if (trimmedCoords.length < 2) return null; // Too short to be a valid line
  
  return {
    ...feature,
    geometry: {
      ...feature.geometry,
      coordinates: trimmedCoords
    }
  };
}

// Process all features - only keep those that end at or before the split
const trimmedFeatures = [];
for (const feature of data.features) {
  if (endsAtOrBeforeSplit(feature)) {
    // This feature already ends at or before the split, keep it as is
    trimmedFeatures.push(feature);
  } else {
    // This feature extends beyond the split, trim it
    const trimmed = trimFeatureAtSplit(feature);
    if (trimmed) {
      trimmedFeatures.push(trimmed);
    }
  }
}

// Output the trimmed collection
const out = turf.featureCollection(trimmedFeatures);
fs.writeFileSync(OUTPUT, JSON.stringify(out, null, 2));

console.log(`Final trim: Kept ${trimmedFeatures.length} features that end at or before TX-55 split. Output:`, OUTPUT); 