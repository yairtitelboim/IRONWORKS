/**
 * Test Perplexity API with 2 random companies from the startup list
 * Simple test to see response quality and cost
 */

require('dotenv').config({ path: '../.env' });
const fs = require('fs');
const path = require('path');

// Configuration
const CSV_FILE = path.join(__dirname, '../public/companies-9-15-2025.csv');
const PERPLEXITY_API_KEY = process.env.PRP;

// Test companies (manually selected for variety)
const TEST_COMPANIES = [
  {
    name: "Liquid AI",
    headquarters: "Cambridge, Massachusetts, United States",
    industries: "Artificial Intelligence (AI), Generative AI, Information Technology, Machine Learning",
    description: "Build efficient general-purpose AI at every scale."
  },
  {
    name: "Blue Water Autonomy", 
    headquarters: "Boston, Massachusetts, United States",
    industries: "Machinery Manufacturing, Manufacturing, Marine Transportation, Shipping",
    description: "Blue Water Autonomy is a technology and shipbuilding company that revolutionizes naval operations through advanced autonomous vessels."
  }
];

async function testPerplexityWithCompanies() {
  console.log('🧪 TESTING PERPLEXITY API WITH STARTUP COMPANIES');
  console.log('================================================');
  console.log('');

  if (!PERPLEXITY_API_KEY) {
    console.error('❌ No Perplexity API key found in environment variables');
    console.log('   Make sure PRP is set in your .env file');
    return;
  }

  console.log('🔑 API Key found:', PERPLEXITY_API_KEY.substring(0, 10) + '...');
  console.log('');

  for (let i = 0; i < TEST_COMPANIES.length; i++) {
    const company = TEST_COMPANIES[i];
    console.log(`\n🏢 TESTING COMPANY ${i + 1}: ${company.name}`);
    console.log('─'.repeat(50));

    const prompt = `Provide location data for this Boston/Cambridge startup company. Return JSON with:
1. lat_long: "42.XXXXX, -71.XXXXX" format (coordinates in Boston/Cambridge area)
2. best_location: "Specific address or landmark in Boston/Cambridge"
3. location_description: "Brief description of the area/neighborhood"
4. important_links: ["URL1", "URL2"] (company website, LinkedIn, etc.)

Company: ${company.name}
Headquarters: ${company.headquarters}
Industries: ${company.industries}
Description: ${company.description}

Focus on finding the actual office location in Boston or Cambridge, Massachusetts.`;

    console.log('📝 Prompt:', prompt.substring(0, 200) + '...');
    console.log('');

    try {
      const startTime = performance.now();
      
      console.log('📡 Sending request to Perplexity API...');
      
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'sonar-pro',
          messages: [{
            role: 'user',
            content: prompt
          }],
          max_tokens: 1000,
          temperature: 0.1,
          return_citations: true
        })
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error ${response.status}:`, errorText);
        continue;
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      const citations = data.citations || [];
      const usage = data.usage || {};

      console.log('✅ Response received!');
      console.log(`⏱️  Duration: ${duration.toFixed(0)}ms`);
      console.log(`💰 Tokens used: ${usage.total_tokens || 'N/A'} (Input: ${usage.prompt_tokens || 'N/A'}, Output: ${usage.completion_tokens || 'N/A'})`);
      console.log(`📚 Citations: ${citations.length}`);
      console.log('');

      console.log('📄 RESPONSE CONTENT:');
      console.log('─'.repeat(30));
      console.log(content);
      console.log('─'.repeat(30));
      console.log('');

      if (citations.length > 0) {
        console.log('📚 SOURCES:');
        citations.forEach((citation, index) => {
          console.log(`${index + 1}. ${citation.title || 'Untitled'}`);
          console.log(`   URL: ${citation.url}`);
        });
        console.log('');
      }

      // Try to parse as JSON
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonData = JSON.parse(jsonMatch[0]);
          console.log('✅ JSON PARSED SUCCESSFULLY:');
          console.log(JSON.stringify(jsonData, null, 2));
        } else {
          console.log('⚠️  No JSON found in response');
        }
      } catch (jsonError) {
        console.log('❌ Failed to parse JSON:', jsonError.message);
      }

    } catch (error) {
      console.error('❌ Error testing company:', error.message);
    }

    // Add delay between requests to avoid rate limiting
    if (i < TEST_COMPANIES.length - 1) {
      console.log('⏳ Waiting 2 seconds before next request...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n🎯 TEST SUMMARY');
  console.log('================');
  console.log(`✅ Tested ${TEST_COMPANIES.length} companies`);
  console.log('📊 Check the responses above for quality and format');
  console.log('💰 Monitor your Perplexity API usage for cost analysis');
  console.log('');
  console.log('💡 NEXT STEPS:');
  console.log('1. Review response quality and JSON format');
  console.log('2. Check if coordinates are in Boston/Cambridge area');
  console.log('3. Evaluate if this approach scales to 60 companies');
  console.log('4. Consider cost implications for full batch processing');
}

// Run the test
testPerplexityWithCompanies().catch(console.error);
