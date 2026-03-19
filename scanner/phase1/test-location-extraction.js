/**
 * Test script for enhanced location extraction
 * Tests the new Phase 1 location extraction methods
 */

import SignalNormalizer from './signal-normalizer.js';

const normalizer = new SignalNormalizer();

// Test cases based on real News signals
const testCases = [
  {
    name: 'Fort Worth URL',
    headline: 'Plans for southwest Fort Worth data center rejected',
    url: 'https://fortworthreport.org/2024/07/10/plans-for-southwest-fort-worth-data-center-rejected-by-zoning-commission/',
    rawText: 'The Fort Worth planning commission rejected plans for a data center in southwest Fort Worth.',
    expected: { city: 'Fort Worth', county: 'Tarrant' }
  },
  {
    name: 'San Marcos in text',
    headline: 'Proposed data center denied by San Marcos Planning and Zoning Commission',
    url: 'https://communityimpact.com/austin/san-marcos-buda-kyle/government/2025/03/27/proposed-data-center-denied-by-san-marcos-planning-and-zoning-commission/',
    rawText: 'The San Marcos Planning and Zoning Commission denied a proposed data center project.',
    expected: { city: 'San Marcos', county: 'Hays' }
  },
  {
    name: 'Austin in address',
    headline: 'Data center proposal in Austin',
    url: 'https://example.com/article',
    rawText: 'The project is located at 123 Main St, Austin, TX 78701.',
    expected: { city: 'Austin', county: 'Travis' }
  },
  {
    name: 'Hood County mention',
    headline: 'Hood County, Texas, set to reject proposal',
    url: 'https://www.datacenterdynamics.com/en/news/hood-county-texas-set-to-reject-proposal/',
    rawText: 'Hood County officials are set to reject a data center proposal.',
    expected: { county: 'Hood' }
  },
  {
    name: 'DFW regional',
    headline: 'Data center moratorium in DFW area',
    url: 'https://example.com/article',
    rawText: 'A new data center moratorium has been proposed for the DFW area.',
    expected: { county: 'Dallas' } // Primary county from DFW
  },
  {
    name: 'Near Austin',
    headline: 'Data center near Austin',
    url: 'https://example.com/article',
    rawText: 'A new data center is planned near Austin, TX.',
    expected: { city: 'Austin', county: 'Travis' }
  },
  {
    name: 'Austin area',
    headline: 'Data center in Austin area',
    url: 'https://example.com/article',
    rawText: 'The data center will be built in the Austin area.',
    expected: { city: 'Austin', county: 'Travis' }
  }
];

console.log('🧪 Testing Enhanced Location Extraction (Phase 1)\n');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  console.log(`\n📋 Test: ${testCase.name}`);
  console.log(`   URL: ${testCase.url}`);
  console.log(`   Headline: ${testCase.headline}`);
  
  try {
    const result = normalizer.extractLocationEnhanced(
      testCase.headline,
      testCase.rawText,
      testCase.url
    );
    
    console.log(`   Result: ${JSON.stringify(result)}`);
    console.log(`   Expected: ${JSON.stringify(testCase.expected)}`);
    
    // Check if result matches expected
    let match = true;
    if (testCase.expected.county && result.county !== testCase.expected.county) {
      match = false;
      console.log(`   ❌ County mismatch: got "${result.county}", expected "${testCase.expected.county}"`);
    }
    if (testCase.expected.city && result.city !== testCase.expected.city) {
      match = false;
      console.log(`   ❌ City mismatch: got "${result.city}", expected "${testCase.expected.city}"`);
    }
    
    if (match) {
      console.log(`   ✅ PASS`);
      passed++;
    } else {
      console.log(`   ❌ FAIL`);
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    failed++;
  }
}

console.log('\n' + '='.repeat(60));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
console.log(`   Success rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

if (failed === 0) {
  console.log('✅ All tests passed!');
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed. Review the output above.');
  process.exit(1);
}

