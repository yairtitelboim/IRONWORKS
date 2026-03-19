const fs = require('fs');
const turf = require('@turf/turf');

// Input and output files
const INPUT = 'public/data/us277_sonora_rocksprings_extended.geojson';
const OUTPUT = 'public/data/us277_sonora_rocksprings_to_55_trimmed.geojson';

// TX-55 split coordinate
const splitCoord = [-100.645773, 30.284939];

// Load the GeoJSON
const data = JSON.parse(fs.readFileSync(INPUT));

// Function to check if a feature extends beyond the split point
function extendsBeyondSplit(feature) {
  if (feature.geometry.type !== 'LineString') return false;
  
  const coords = feature.geometry.coordinates;
  for (const coord of coords) {
    // If any coordinate is south of the split point, this feature extends beyond
    if (coord[1] < splitCoord[1]) {
      return true;
    }
  }
  return false;
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

// Process all features
const trimmedFeatures = [];
for (const feature of data.features) {
  if (extendsBeyondSplit(feature)) {
    // This feature extends beyond the split, trim it
    const trimmed = trimFeatureAtSplit(feature);
    if (trimmed) {
      trimmedFeatures.push(trimmed);
    }
  } else {
    // This feature doesn't extend beyond the split, keep it as is
    trimmedFeatures.push(feature);
  }
}

// Output the trimmed collection
const out = turf.featureCollection(trimmedFeatures);
fs.writeFileSync(OUTPUT, JSON.stringify(out, null, 2));

console.log(`Aggressive trim: Kept ${trimmedFeatures.length} features. Output:`, OUTPUT); 