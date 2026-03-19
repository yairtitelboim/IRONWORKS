const fs = require('fs');
const turf = require('@turf/turf');

// Input and output files
const INPUT = 'public/data/us277_sonora_rocksprings_extended.geojson';
const OUTPUT = 'public/data/us277_sonora_rocksprings_to_55_trimmed.geojson';

// TX-55 split coordinate
const splitCoord = [-100.645773, 30.284939];
const splitPoint = turf.point(splitCoord);

// Load the GeoJSON
const data = JSON.parse(fs.readFileSync(INPUT));

// Find the main US-277 segment (the longest LineString)
let mainFeature = null;
let maxLen = 0;
for (const feat of data.features) {
  if (feat.geometry.type === 'LineString') {
    const len = turf.length(feat);
    if (len > maxLen) {
      maxLen = len;
      mainFeature = feat;
    }
  }
}

if (!mainFeature) {
  throw new Error('No LineString found in input!');
}

// Slice the main segment from its start to the split point
const start = turf.point(mainFeature.geometry.coordinates[0]);
const sliced = turf.lineSlice(start, splitPoint, mainFeature);

// Keep all other features that do NOT extend south of the split
const keepFeatures = data.features.filter(f => f !== mainFeature);

// Output the trimmed collection
const out = turf.featureCollection([sliced, ...keepFeatures]);
fs.writeFileSync(OUTPUT, JSON.stringify(out, null, 2));

console.log('Trimmed US-277 at TX-55 split. Output:', OUTPUT); 