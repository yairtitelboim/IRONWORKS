/**
 * Test ERCOT Adapter
 * Tests the adapter with existing CSV data
 */

import ERCOTAdapter from './adapters/ercot-adapter.js';

async function testERCOTAdapter() {
  console.log('🧪 Testing ERCOT Adapter...\n');

  try {
    // Create adapter
    const adapter = new ERCOTAdapter({
      dataPath: '/Users/yairtitelboim/Documents/Kernel/ALLAPPS/Tx DRAFT/data/ercot/processed/ercot_2023_100mw_filtered.csv'
    });

    // Fetch signals
    console.log('📥 Fetching signals from CSV...');
    const rawSignals = await adapter.fetch();

    console.log(`\n✅ Successfully fetched ${rawSignals.length} signals\n`);

    // Show sample signals
    console.log('📊 Sample signals (first 3):\n');
    rawSignals.slice(0, 3).forEach((signal, idx) => {
      console.log(`${idx + 1}. ${signal.headline}`);
      console.log(`   Source ID: ${signal.source_id}`);
      console.log(`   Status: ${signal.metadata?.status}`);
      console.log(`   County: ${signal.metadata?.county}`);
      console.log(`   Capacity: ${signal.metadata?.mw}MW`);
      console.log(`   Fuel: ${signal.metadata?.fuel_type}`);
      console.log();
    });

    // Show statistics
    const statusCounts = {};
    const fuelCounts = {};
    
    rawSignals.forEach(signal => {
      const status = signal.metadata?.status || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      
      const fuel = signal.metadata?.fuel_type || 'Unknown';
      fuelCounts[fuel] = (fuelCounts[fuel] || 0) + 1;
    });

    console.log('📈 Statistics:');
    console.log(`   Total signals: ${rawSignals.length}`);
    console.log(`   Status breakdown:`, statusCounts);
    console.log(`   Fuel type breakdown:`, fuelCounts);

    console.log('\n✅ ERCOT adapter test complete!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testERCOTAdapter();

