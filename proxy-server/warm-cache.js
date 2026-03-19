const axios = require('axios');

const COMMON_QUERIES = [
  { q: 'chemical plants', ll: '31.9315,-97.347', radius: '3' },
  { q: 'steel mills', ll: '31.9315,-97.347', radius: '3' },
  { q: 'oil and gas facilities', ll: '31.9315,-97.347', radius: '3' },
  { q: 'railroad facilities', ll: '31.9315,-97.347', radius: '3' },
  { q: 'airports', ll: '31.9315,-97.347', radius: '3' },
  { q: 'businesses', ll: '31.9315,-97.347', radius: '3' },
  { q: 'facilities', ll: '31.9315,-97.347', radius: '3' },
  { q: 'buildings', ll: '31.9315,-97.347', radius: '3' },
  { q: 'restaurants', ll: '31.9315,-97.347', radius: '3' },
  { q: 'gas stations', ll: '31.9315,-97.347', radius: '3' },
  { q: 'convenience stores', ll: '31.9315,-97.347', radius: '3' }
];

async function warmCache() {
  try {
    console.log('🔥 Warming SERP API cache...');
    
    const response = await axios.post('http://localhost:8080/cache/warm', {
      queries: COMMON_QUERIES
    });
    
    console.log('✅ Cache warming completed!');
    console.log('📊 Results:', response.data.results);
    console.log(`💾 Total cached entries: ${response.data.totalCached}`);
    
    // Show cache status
    const statusResponse = await axios.get('http://localhost:8080/cache/status');
    console.log('📈 Cache status:', statusResponse.data);
    
  } catch (error) {
    console.error('❌ Error warming cache:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  warmCache();
}

module.exports = { warmCache, COMMON_QUERIES };
