const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Perplexity test and frontend server...\n');

// First, run the Perplexity test
console.log('1️⃣ Running Perplexity test...');
const testProcess = spawn('node', ['test_perplexity_node_analysis.mjs'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let errorOutput = '';

testProcess.stdout.on('data', (data) => {
  output += data.toString();
});

testProcess.stderr.on('data', (data) => {
  errorOutput += data.toString();
});

testProcess.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Perplexity test completed successfully!');
    
    // Save the output to a file
    fs.writeFileSync('perplexity_output.json', output);
    console.log('💾 Test output saved to perplexity_output.json');
    
    // Update the frontend with real data
    console.log('2️⃣ Updating frontend with real data...');
    try {
      require('./load_perplexity_data.js');
      console.log('✅ Frontend updated with real Perplexity data!');
    } catch (error) {
      console.log('⚠️ Could not update frontend with real data:', error.message);
    }
    
    // Start the server
    console.log('3️⃣ Starting test server...');
    const serverProcess = spawn('node', ['test_server.js'], {
      stdio: 'inherit'
    });
    
    serverProcess.on('error', (error) => {
      console.error('❌ Server error:', error.message);
    });
    
  } else {
    console.error('❌ Perplexity test failed with code:', code);
    console.error('Error output:', errorOutput);
  }
});

testProcess.on('error', (error) => {
  console.error('❌ Failed to start Perplexity test:', error.message);
});
