#!/usr/bin/env node
/**
 * Better formatted signal viewer
 */

import SignalsDB from './storage/signals-db.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const db = new SignalsDB();

async function viewSignals() {
  await db.connect();
  
  const signals = await db.getSignals({ limit: 50 });
  
  console.log('\n' + '='.repeat(80));
  console.log(`📊 Scanner Results - ${signals.length} signals\n`);
  
  signals.forEach((signal, idx) => {
    const laneEmoji = signal.lane === 'CONSTRAINT' ? '🚫' : 
                     signal.lane === 'COMMITMENT' ? '✅' : 'ℹ️';
    const confidenceEmoji = signal.confidence === 'HIGH' ? '🔴' :
                           signal.confidence === 'MED' ? '🟡' : '🟢';
    
    console.log(`${idx + 1}. ${laneEmoji} ${signal.lane} ${confidenceEmoji} ${signal.confidence}`);
    console.log(`   ${signal.headline}`);
    if (signal.event_type) {
      console.log(`   Event: ${signal.event_type}`);
    }
    if (signal.tags) {
      const tags = JSON.parse(signal.tags || '[]');
      if (tags.length > 0) {
        console.log(`   Tags: ${tags.join(', ')}`);
      }
    }
    if (signal.url) {
      console.log(`   URL: ${signal.url}`);
    }
    if (signal.summary_3bullets) {
      const summary = signal.summary_3bullets.substring(0, 150);
      console.log(`   Summary: ${summary}...`);
    }
    console.log('');
  });
  
  await db.close();
}

viewSignals().catch(console.error);

