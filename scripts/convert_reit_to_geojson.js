const fs = require('fs');
const path = require('path');

// Read the REIT properties JSON file
const inputFile = path.join(__dirname, '../public/reit_properties.json');
const outputFile = path.join(__dirname, '../public/reit_properties.geojson');

try {
  // Read and parse JSON, handling NaN values
  let fileContent = fs.readFileSync(inputFile, 'utf8');
  // Replace NaN with null in the JSON string
  fileContent = fileContent.replace(/:\s*NaN\s*([,}])/g, ': null$1');
  const data = JSON.parse(fileContent);
  
  // Convert to GeoJSON format
  const geojson = {
    type: 'FeatureCollection',
    features: data.properties
      .map((property, index) => {
        // Skip properties without valid coordinates
        if (!property.longitude || !property.latitude || 
            isNaN(property.longitude) || isNaN(property.latitude)) {
          return null;
        }
        
        return {
          type: 'Feature',
          id: `reit-${index}`,
          geometry: {
            type: 'Point',
            coordinates: [property.longitude, property.latitude]
          },
          properties: {
            address: property.address || null,
            company: property.company || null,
            market: property.market || null,
            property_type: property.property_type || null,
            square_footage: property.square_footage || null,
            source_url: property.source_url || null,
            timestamp: property.timestamp || null
          }
        };
      })
      .filter(feature => feature !== null)
  };
  
  // Write GeoJSON file
  fs.writeFileSync(outputFile, JSON.stringify(geojson, null, 2));
  console.log(`✅ Converted ${geojson.features.length} REIT properties to GeoJSON`);
  console.log(`📁 Output: ${outputFile}`);
} catch (error) {
  console.error('❌ Error converting REIT data:', error);
  process.exit(1);
}

