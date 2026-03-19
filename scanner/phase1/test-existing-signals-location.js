/**
 * Test enhanced location extraction on existing News signals
 * Re-processes signals that currently have no county data
 */

import SignalsDB from './storage/signals-db.js';
import SignalNormalizer from './signal-normalizer.js';

const db = new SignalsDB();
const normalizer = new SignalNormalizer();

async function testExistingSignals() {
  await db.connect();
  await db.init();

  // Get signals without county
  const signals = await db.getSignals({ 
    source_type: 'TAVILY',
    filters: { county: null }
  });

  console.log(`\n🧪 Testing Enhanced Location Extraction on ${signals.length} existing signals\n`);
  console.log('='.repeat(80));

  let improved = 0;
  let couldExtract = [];

  for (const signal of signals.slice(0, 20)) { // Test first 20
    const location = normalizer.extractLocationEnhanced(
      signal.headline || '',
      signal.raw_text || '',
      signal.url || ''
    );

    if (location.county || location.city) {
      improved++;
      couldExtract.push({
        headline: signal.headline?.substring(0, 60) || 'N/A',
        url: signal.url || 'N/A',
        extracted: location
      });
    }
  }

  console.log(`\n📊 Results:`);
  console.log(`   Signals tested: ${Math.min(signals.length, 20)}`);
  console.log(`   Could extract location: ${improved}`);
  console.log(`   Improvement potential: ${((improved / Math.min(signals.length, 20)) * 100).toFixed(1)}%`);

  if (couldExtract.length > 0) {
    console.log(`\n✅ Signals that could be improved:\n`);
    couldExtract.forEach((item, idx) => {
      console.log(`${idx + 1}. ${item.headline}`);
      console.log(`   URL: ${item.url.substring(0, 60)}...`);
      console.log(`   Extracted: ${item.extracted.county ? `County: ${item.extracted.county}` : ''} ${item.extracted.city ? `City: ${item.extracted.city}` : ''}`);
      console.log('');
    });
  }

  await db.close();
}

testExistingSignals().catch(console.error);

