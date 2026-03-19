/**
 * Test script to verify Phase 2 setup
 * Tests core components without requiring actual adapters
 */

import SignalsDB from '../phase1/storage/signals-db.js';
import SignalNormalizerV2 from './signal-normalizer-v2.js';
import SignalDeduplicator from './signal-deduplicator.js';
import SignalDiffer from '../phase1/signal-differ.js';

async function testSetup() {
  console.log('🧪 Testing Phase 2 Setup...\n');

  // Test 1: Normalizer
  console.log('1️⃣ Testing SignalNormalizerV2...');
  const normalizer = new SignalNormalizerV2();
  const rawSignal = {
    source_type: 'ERCOT_QUEUE',
    source_id: 'TEST-001',
    published_at: '2024-01-15T10:00:00Z',
    url: 'https://example.com/test',
    headline: 'Test Project - 100MW Solar',
    body_text: 'Test project description',
    metadata: {
      mw: 100,
      fuel_type: 'Solar',
      county: 'Travis',
      company: 'Test Company'
    }
  };

  const normalized = normalizer.normalizeRawSignal(rawSignal);
  console.log('   ✅ Normalized signal:', {
    signal_id: normalized.signal_id.substring(0, 8) + '...',
    dedupe_key: normalized.dedupe_key.substring(0, 8) + '...',
    headline: normalized.headline,
    source_type: normalized.source_type,
    source_id: normalized.source_id
  });

  // Test 2: Differ with source_id
  console.log('\n2️⃣ Testing SignalDiffer with source_id...');
  const differ = new SignalDiffer();
  const newSignals = [
    { source_id: 'TEST-001', headline: 'Test Project', status: 'New' },
    { source_id: 'TEST-002', headline: 'Another Project', status: 'New' }
  ];
  const previousSnapshot = {
    raw_payload: JSON.stringify([
      { source_id: 'TEST-001', headline: 'Test Project', status: 'Active' }
    ])
  };

  const diffResult = differ.diff(newSignals, previousSnapshot, 'source_id');
  console.log('   ✅ Diff result:', {
    new: diffResult.newItems.length,
    changed: diffResult.changedItems.length,
    withdrawn: diffResult.withdrawnItems.length
  });
  console.log('   ✅ Changed item detected:', diffResult.changedItems[0]?.source_id);

  // Test 3: Database methods
  console.log('\n3️⃣ Testing Database methods...');
  const db = new SignalsDB();
  try {
    await db.connect();
    await db.init();
    console.log('   ✅ Database connected');

    // Test getSignalByUrl
    const urlResult = await db.getSignalByUrl('https://example.com/test');
    console.log('   ✅ getSignalByUrl works:', urlResult === null ? '(no match, expected)' : 'found');

    // Test getSignalBySourceId
    const sourceIdResult = await db.getSignalBySourceId('ERCOT_QUEUE', 'TEST-001');
    console.log('   ✅ getSignalBySourceId works:', sourceIdResult === null ? '(no match, expected)' : 'found');

    await db.close();
  } catch (error) {
    console.error('   ❌ Database test failed:', error.message);
  }

  // Test 4: Deduplicator similarity
  console.log('\n4️⃣ Testing SignalDeduplicator similarity...');
  const deduplicator = new SignalDeduplicator();
  const similarity = deduplicator.calculateSimilarity(
    'Data Center Project Approved',
    'Data Center Project Approved in Texas'
  );
  console.log('   ✅ Similarity calculation:', similarity.toFixed(2));

  console.log('\n✅ Phase 2 setup tests complete!');
  console.log('\n📝 Next Steps:');
  console.log('   1. Research ERCOT format (see scanner/phase2/research/ERCOT_FORMAT.md)');
  console.log('   2. Implement ERCOT adapter fetch() method');
  console.log('   3. Test with real ERCOT data');
}

testSetup().catch(console.error);

