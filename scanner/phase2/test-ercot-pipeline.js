/**
 * Test ERCOT Adapter with Full Pipeline
 * Tests adapter → normalizer → classifier → differ → store
 */

import SignalsDB from '../phase1/storage/signals-db.js';
import SignalIngesterV2 from './signal-ingester-v2.js';
import ERCOTAdapter from './adapters/ercot-adapter.js';

async function testFullPipeline() {
  console.log('🧪 Testing ERCOT Adapter with Full Pipeline...\n');

  try {
    // Initialize database
    const db = new SignalsDB();
    await db.connect();
    await db.init();
    console.log('✅ Database connected\n');

    // Create adapter
    const adapter = new ERCOTAdapter({
      dataPath: '/Users/yairtitelboim/Documents/Kernel/ALLAPPS/Tx DRAFT/data/ercot/processed/ercot_2023_100mw_filtered.csv'
    });

    // Create ingester with adapter
    const ingester = new SignalIngesterV2(db, {
      ERCOT: adapter
    });

    // Run ingestion
    console.log('📥 Running ingestion...\n');
    const result = await ingester.ingestFromSource('ERCOT');

    // Show results
    console.log('\n' + '='.repeat(60));
    console.log('INGESTION RESULTS');
    console.log('='.repeat(60));
    console.log(`Source: ${result.source}`);
    console.log(`Signals Found: ${result.signalsFound}`);
    console.log(`Signals New: ${result.signalsNew}`);
    console.log(`Signals Changed: ${result.signalsChanged}`);
    console.log(`Signals Withdrawn: ${result.signalsWithdrawn}`);
    console.log(`Signals Deduplicated: ${result.signalsDeduplicated || 0}`);
    console.log(`Signals Stored: ${result.signalsStored}`);
    console.log(`LLM Calls: ${result.classificationStats?.llmCalls || 0}/${result.classificationStats?.maxLLMCalls || 0}`);

    // Check database
    const storedSignals = await db.getSignals({ source_type: 'ERCOT_QUEUE', limit: 5 });
    console.log(`\n📊 Sample stored signals (first 5):`);
    storedSignals.forEach((signal, idx) => {
      console.log(`\n${idx + 1}. ${signal.headline}`);
      console.log(`   Lane: ${signal.lane}`);
      console.log(`   Event Type: ${signal.event_type}`);
      console.log(`   Confidence: ${signal.confidence}`);
      console.log(`   Change Type: ${signal.change_type}`);
    });

    await db.close();
    console.log('\n✅ Full pipeline test complete!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testFullPipeline();

