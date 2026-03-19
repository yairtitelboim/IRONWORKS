/**
 * Test geocoding with a few sample companies
 */

require('dotenv').config({ path: '../.env' });
const fs = require('fs');
const path = require('path');

// Configuration
const CSV_FILE = path.join(__dirname, '../public/companies-9-13-2025.csv');

// Test with Mapbox (free tier)
async function testMapboxGeocoding() {
  const MAPBOX_ACCESS_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoieWFpcnRpdGVsYm9pbSIsImEiOiJjbW5qZ2V6d2UwMDF6MnJwZ2V6d2UwMDF6In0.example';
  const MAPBOX_GEOCODING_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
  
  console.log(`🔑 Mapbox Token: ${MAPBOX_ACCESS_TOKEN ? 'Found' : 'Not found'}`);
  console.log(`🔑 Token preview: ${MAPBOX_ACCESS_TOKEN ? MAPBOX_ACCESS_TOKEN.substring(0, 20) + '...' : 'None'}`);
  
  const testCompanies = [
    'MIT Cambridge Massachusetts',
    'Harvard University Cambridge Massachusetts',
    'Boston University Boston Massachusetts',
    'Northeastern University Boston Massachusetts',
    'Massachusetts General Hospital Boston Massachusetts'
  ];
  
  console.log('🧪 Testing Mapbox Geocoding...');
  
  for (const company of testCompanies) {
    try {
      const encodedQuery = encodeURIComponent(company);
      const url = `${MAPBOX_GEOCODING_URL}/${encodedQuery}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=US&limit=1`;
      
      console.log(`🔍 Testing: ${company}`);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log(`📊 Response status: ${response.status}`);
      console.log(`📊 Response data:`, JSON.stringify(data, null, 2));
      
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const [lng, lat] = feature.center;
        console.log(`✅ Found: ${lat}, ${lng} - ${feature.place_name}`);
      } else {
        console.log(`❌ No results for: ${company}`);
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
    
    // Delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Test with Google Places (requires API key)
async function testGooglePlacesGeocoding() {
  console.log('🔍 All environment variables:');
  console.log('REACT_APP_GOOGLE_PLACES_KEY:', process.env.REACT_APP_GOOGLE_PLACES_KEY);
  console.log('NewGOOGLEplaces:', process.env.NewGOOGLEplaces);
  
  const GOOGLE_PLACES_API_KEY = process.env.REACT_APP_GOOGLE_PLACES_KEY || process.env.NewGOOGLEplaces;
  
  console.log(`🔑 Google Places Key: ${GOOGLE_PLACES_API_KEY ? 'Found' : 'Not found'}`);
  console.log(`🔑 Key preview: ${GOOGLE_PLACES_API_KEY ? GOOGLE_PLACES_API_KEY.substring(0, 20) + '...' : 'None'}`);
  
  if (!GOOGLE_PLACES_API_KEY) {
    console.log('⚠️ No Google Places API key found. Skipping Google Places test.');
    return;
  }
  
  const testCompanies = [
    'MIT Cambridge Massachusetts',
    'Harvard University Cambridge Massachusetts',
    'Boston University Boston Massachusetts',
    'Northeastern University Boston Massachusetts',
    'Massachusetts General Hospital Boston Massachusetts'
  ];
  
  console.log('🧪 Testing Google Places Geocoding...');
  
  for (const company of testCompanies) {
    try {
      const url = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
      url.searchParams.append('input', company);
      url.searchParams.append('inputtype', 'textquery');
      url.searchParams.append('fields', 'place_id,name,formatted_address,geometry');
      url.searchParams.append('locationbias', 'circle:50000@42.3601,-71.0589');
      url.searchParams.append('key', GOOGLE_PLACES_API_KEY);
      
      console.log(`🔍 Testing: ${company}`);
      
      const response = await fetch(url.toString());
      const data = await response.json();
      
      if (data.status === 'OK' && data.candidates && data.candidates.length > 0) {
        const place = data.candidates[0];
        const lat = place.geometry.location.lat;
        const lng = place.geometry.location.lng;
        console.log(`✅ Found: ${lat}, ${lng} - ${place.formatted_address}`);
      } else {
        console.log(`❌ No results for: ${company} (${data.status})`);
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
    
    // Delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting geocoding tests...\n');
  
  await testMapboxGeocoding();
  console.log('\n' + '='.repeat(50) + '\n');
  await testGooglePlacesGeocoding();
  
  console.log('\n✅ Tests completed!');
}

// Run tests
if (require.main === module) {
  runTests()
    .then(() => {
      console.log('✅ All tests completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Tests failed:', error);
      process.exit(1);
    });
}

module.exports = { testMapboxGeocoding, testGooglePlacesGeocoding };
