/**
 * Test Tavily API to check if credits are needed
 */

const https = require('https');

const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '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';

console.log('🔍 Testing Tavily API...\n');
console.log(`API Key: ${TAVILY_API_KEY.substring(0, 10)}...\n`);

// Test 1: Check Usage
console.log('1️⃣ Checking API usage...');
checkUsage();

// Test 2: Test Search
setTimeout(() => {
  console.log('\n2️⃣ Testing search endpoint...');
  testSearch();
}, 1000);

function checkUsage() {
  const options = {
    hostname: 'api.tavily.com',
    path: '/usage',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TAVILY_API_KEY}`,
      'Content-Type': 'application/json'
    }
  };

  const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        console.log('✅ Usage Response:');
        console.log(JSON.stringify(json, null, 2));
        
        if (json.key) {
          console.log(`\n📊 Key Usage: ${json.key.usage || 0} / ${json.key.limit || 'unknown'}`);
        }
        if (json.account) {
          console.log(`📊 Account Plan: ${json.account.current_plan || 'unknown'}`);
          console.log(`📊 Plan Usage: ${json.account.plan_usage || 0} / ${json.account.plan_limit || 'unknown'}`);
          if (json.account.plan_usage >= json.account.plan_limit) {
            console.log('⚠️  WARNING: Plan limit reached! Need to add credits.');
          }
        }
      } catch (e) {
        console.log('❌ Error parsing response:', data);
        if (data.includes('Unauthorized') || data.includes('invalid')) {
          console.log('⚠️  API key appears invalid or expired. May need to regenerate key or add credits.');
        }
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Request error:', error.message);
  });

  req.end();
}

function testSearch() {
  const postData = JSON.stringify({
    api_key: TAVILY_API_KEY,
    query: 'data center moratorium Texas',
    max_results: 2
  });

  const options = {
    hostname: 'api.tavily.com',
    path: '/search',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': postData.length
    }
  };

  const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        
        if (json.results) {
          console.log('✅ Search successful!');
          console.log(`📊 Found ${json.results.length} results`);
          if (json.results.length > 0) {
            console.log(`\n📰 First result (full structure):`);
            console.log(JSON.stringify(json.results[0], null, 2));
            console.log(`\n📰 All result fields available:`);
            console.log(`   - title: ${json.results[0].title || 'N/A'}`);
            console.log(`   - url: ${json.results[0].url || 'N/A'}`);
            console.log(`   - content: ${json.results[0].content ? json.results[0].content.substring(0, 100) + '...' : 'N/A'}`);
            console.log(`   - published_date: ${json.results[0].published_date || 'N/A'}`);
            console.log(`   - score: ${json.results[0].score || 'N/A'}`);
          }
        } else if (json.detail) {
          console.log('❌ Search failed:');
          console.log(JSON.stringify(json, null, 2));
          if (json.detail.error && json.detail.error.includes('Unauthorized')) {
            console.log('\n⚠️  API key is invalid or expired. Need to:');
            console.log('   1. Check if key is correct');
            console.log('   2. Add credits to Tavily account');
            console.log('   3. Regenerate API key if needed');
          }
        } else {
          console.log('❓ Unexpected response:', data);
        }
      } catch (e) {
        console.log('❌ Error parsing response:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Request error:', error.message);
  });

  req.write(postData);
  req.end();
}

