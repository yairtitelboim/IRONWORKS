/**
 * Test multiple APIs to check if they work
 */

require('dotenv').config();

const https = require('https');
const axios = require('axios');

console.log('🔍 Testing APIs for Scanner Phase 1...\n');

// Test 1: Google Places API
async function testGooglePlaces() {
  console.log('1️⃣ Testing Google Places API...');
  const apiKey = process.env.NewGOOGLEplaces || process.env.REACT_APP_GOOGLE_PLACES_KEY || process.env.GOOGLE_PLACES_API_KEY;
  
  if (!apiKey) {
    console.log('❌ No Google Places API key found\n');
    return;
  }
  
  console.log(`   Key: ${apiKey.substring(0, 10)}...`);
  
  try {
    const query = encodeURIComponent('data center Texas');
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${apiKey}`;
    
    const response = await axios.get(url, { timeout: 10000 });
    
    if (response.data.status === 'OK' && response.data.results) {
      console.log(`✅ Google Places works! Found ${response.data.results.length} results`);
      if (response.data.results.length > 0) {
        console.log(`   First result: ${response.data.results[0].name}`);
      }
    } else {
      console.log(`❌ Google Places error: ${response.data.status}`);
      if (response.data.error_message) {
        console.log(`   ${response.data.error_message}`);
      }
    }
  } catch (error) {
    console.log(`❌ Google Places request failed: ${error.message}`);
  }
  console.log('');
}

// Test 2: Serper API
async function testSerper() {
  console.log('2️⃣ Testing Serper API...');
  const apiKey = process.env.SERPER_API_KEY;
  
  if (!apiKey) {
    console.log('❌ No SERPER_API_KEY found\n');
    return;
  }
  
  console.log(`   Key: ${apiKey.substring(0, 10)}...`);
  
  try {
    const response = await axios.post(
      'https://google.serper.dev/search',
      {
        q: 'data center moratorium Texas',
        num: 3
      },
      {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    if (response.data.organic) {
      console.log(`✅ Serper works! Found ${response.data.organic.length} results`);
      if (response.data.organic.length > 0) {
        console.log(`   First result: ${response.data.organic[0].title}`);
        console.log(`   URL: ${response.data.organic[0].link}`);
      }
    } else {
      console.log('❌ Serper: Unexpected response format');
      console.log(JSON.stringify(response.data, null, 2).substring(0, 200));
    }
  } catch (error) {
    console.log(`❌ Serper request failed: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Response: ${JSON.stringify(error.response.data).substring(0, 200)}`);
    }
  }
  console.log('');
}

// Test 3: Firecrawl API
async function testFirecrawl() {
  console.log('3️⃣ Testing Firecrawl API...');
  const apiKey = process.env.firecrawl || process.env.REACT_APP_FIRECRAWL_API_KEY || process.env.FIRECRAWL_API_KEY;
  
  // Remove 'fc-' prefix if present
  const cleanKey = apiKey?.startsWith('fc-') ? apiKey : apiKey;
  
  if (!apiKey) {
    console.log('❌ No Firecrawl API key found\n');
    return;
  }
  
  console.log(`   Key: ${apiKey.substring(0, 10)}...`);
  
  try {
    const response = await axios.post(
      'https://api.firecrawl.dev/v0/scrape',
      {
        url: 'https://www.ercot.com/news/reports',
        pageOptions: {
          onlyMainContent: true
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );
    
    if (response.data.success && response.data.data) {
      console.log(`✅ Firecrawl works!`);
      console.log(`   Title: ${response.data.data.title || 'N/A'}`);
      console.log(`   Content length: ${response.data.data.markdown?.length || 0} chars`);
    } else {
      console.log('❌ Firecrawl: Unexpected response');
      console.log(JSON.stringify(response.data, null, 2).substring(0, 200));
    }
  } catch (error) {
    console.log(`❌ Firecrawl request failed: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Response: ${JSON.stringify(error.response.data).substring(0, 200)}`);
    }
  }
  console.log('');
}

// Run all tests
async function runTests() {
  await testGooglePlaces();
  await testSerper();
  await testFirecrawl();
  
  console.log('📊 Summary:');
  console.log('   - Google Places: For geocoding locations from signals');
  console.log('   - Serper: Alternative search API (if Tavily fails)');
  console.log('   - Firecrawl: For Phase 2 (scraping ERCOT/PUC websites)');
}

runTests().catch(console.error);

