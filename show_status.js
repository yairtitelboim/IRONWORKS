const fs = require('fs');
const path = require('path');

console.log('🎯 Perplexity Response Visualizer Status\n');

// Check if server is running
const http = require('http');
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log('✅ Test server is running at http://localhost:3000');
  console.log('🌐 Open your browser and navigate to the URL above\n');
  
  // Check if real data was loaded
  const htmlPath = path.join(__dirname, 'test_frontend.html');
  if (fs.existsSync(htmlPath)) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    if (html.includes('Bosque Power Co LLC') && html.includes('EIA Plant ID')) {
      console.log('✅ Real Perplexity data is loaded in the frontend');
    } else {
      console.log('⚠️ Using test data (real data not loaded)');
    }
  }
  
  console.log('\n🎛️ Available Controls:');
  console.log('  • Load Test Data - Load sample response');
  console.log('  • Clear Response - Clear current response');
  console.log('  • Toggle View Mode - Switch between SITE/NODE');
  console.log('  • Simulate Loading - Show loading animation');
  console.log('\n🏷️ Category Filters:');
  console.log('  • ALL - Complete response');
  console.log('  • PWR - Power Generation');
  console.log('  • TRN - Transmission');
  console.log('  • UTL - Local Utilities');
  console.log('  • RSK - Risk & Redundancy');
  
}).on('error', (err) => {
  console.log('❌ Test server is not running');
  console.log('🚀 Start it with: node test_server.js');
});

req.end();
