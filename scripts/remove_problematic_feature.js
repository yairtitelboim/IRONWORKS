const fs = require('fs');

// Input and output files
const INPUT = 'public/data/us277_sonora_rocksprings_to_55_trimmed.geojson';
const OUTPUT = 'public/data/us277_sonora_rocksprings_to_55_trimmed.geojson';

// Load the GeoJSON
const data = JSON.parse(fs.readFileSync(INPUT));

// Remove the problematic feature that extends beyond the split
const filteredFeatures = data.features.filter(feature => {
  // Remove feature with id "way/997260659" that ends at 30.288166
  if (feature.id === "way/997260659") {
    console.log("Removing problematic feature:", feature.id);
    return false;
  }
  return true;
});

// Output the filtered collection
const out = {
  type: "FeatureCollection",
  features: filteredFeatures
};

fs.writeFileSync(OUTPUT, JSON.stringify(out, null, 2));

console.log(`Removed problematic feature. Kept ${filteredFeatures.length} features. Output:`, OUTPUT); 