/**
 * Test Perplexity API with PRP key from .env
 */

import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const PRP_KEY = process.env.PRP || process.env.REACT_APP_PRP;

console.log('🧠 Testing Perplexity API with PRP key...\n');
console.log(`Key: ${PRP_KEY ? PRP_KEY.substring(0, 15) + '...' : 'NOT FOUND'}\n`);

if (!PRP_KEY) {
  console.log('❌ PRP key not found in .env');
  process.exit(1);
}

axios.post('https://api.perplexity.ai/chat/completions', {
  model: 'sonar-pro',
  messages: [{
    role: 'user',
    content: 'Classify this signal: "Data center moratorium proposed in Texas"'
  }],
  max_tokens: 100,
  temperature: 0.1
}, {
  headers: {
    'Authorization': `Bearer ${PRP_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 15000
})
.then(res => {
  console.log('✅ Perplexity API works!');
  console.log(`\nResponse preview:`);
  const content = res.data.choices?.[0]?.message?.content || 'N/A';
  console.log(content.substring(0, 200));
  console.log('\n✅ API is operational and ready for Scanner Phase 1');
})
.catch(err => {
  console.log('❌ Perplexity API failed');
  if (err.response) {
    console.log(`   Status: ${err.response.status}`);
    console.log(`   Error: ${JSON.stringify(err.response.data).substring(0, 200)}`);
    if (err.response.status === 401) {
      console.log('\n⚠️  API key is invalid or expired');
    }
  } else {
    console.log(`   Error: ${err.message}`);
  }
  process.exit(1);
});

