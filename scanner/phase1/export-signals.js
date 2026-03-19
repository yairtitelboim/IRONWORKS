#!/usr/bin/env node
/**
 * Export signals to readable formats (CSV, JSON, HTML)
 */

import SignalsDB from './storage/signals-db.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const db = new SignalsDB();

async function exportSignals(format = 'html', options = {}) {
  await db.connect();
  
  // Get all signals
  const allSignals = await db.getSignals({ limit: 1000 });
  
  let signals = allSignals;
  
  // Filter to last 7 days (unless --all flag is set)
  if (!options.all) {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    signals = signals.filter(signal => {
      const signalDate = new Date(signal.ingested_at || signal.published_at || 0);
      return signalDate >= oneWeekAgo;
    });
    console.log(`📅 Filtered to ${signals.length} signals from last 7 days (out of ${allSignals.length} total)`);
  } else {
    console.log(`📅 Showing all ${signals.length} signals (no date filter)`);
  }
  
  // Filter by lane (COMMITMENT = projects)
  // By default, exclude CONTEXT (static content) unless explicitly requested
  if (options.lane) {
    const beforeLane = signals.length;
    signals = signals.filter(s => s.lane === options.lane);
    console.log(`   Lane filter (${options.lane}): ${signals.length} signals (from ${beforeLane})`);
  } else if (!options.includeContext) {
    // Default: hide CONTEXT (static content) to keep feed quiet
    const beforeFilter = signals.length;
    signals = signals.filter(s => s.lane !== 'CONTEXT');
    const hidden = beforeFilter - signals.length;
    if (hidden > 0) {
      console.log(`   Hidden ${hidden} CONTEXT signals (static content) - use --include-context to show`);
    }
  }
  
  // AGGRESSIVE: Filter out signals without valid change_type (NEW, UPDATED, WITHDRAWN, DENIED, ESCALATED, STALLED)
  const validChangeTypes = ['NEW', 'UPDATED', 'WITHDRAWN', 'DENIED', 'ESCALATED', 'STALLED'];
  const beforeChangeType = signals.length;
  signals = signals.filter(s => {
    const ct = s.change_type?.toUpperCase();
    return ct && validChangeTypes.includes(ct);
  });
  const filteredByChangeType = beforeChangeType - signals.length;
  if (filteredByChangeType > 0) {
    console.log(`   🔄 Filtered out ${filteredByChangeType} signals without valid change_type (must be: NEW, UPDATED, WITHDRAWN, DENIED, ESCALATED, STALLED)`);
  }
  
  // Filter by region (South Central US: TX, OK, AR, LA, NM)
  if (options.region === 'south-central') {
    const southCentralStates = ['TX', 'OK', 'AR', 'LA', 'NM', 'KS', 'MO'];
    const beforeRegion = signals.length;
    signals = signals.filter(s => {
      const state = s.state?.toUpperCase();
      return state && southCentralStates.includes(state);
    });
    console.log(`   Region filter (south-central): ${signals.length} signals (from ${beforeRegion})`);
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  if (format === 'csv') {
    // CSV export
    const csv = [
      'Headline,Lane,Event Type,Confidence,Tags,URL,Source,Status,Ingested At',
      ...signals.map(s => {
        const tags = JSON.parse(s.tags || '[]').join('; ');
        return [
          `"${(s.headline || '').replace(/"/g, '""')}"`,
          s.lane || '',
          s.event_type || '',
          s.confidence || '',
          `"${tags.replace(/"/g, '""')}"`,
          s.url || '',
          s.source_type || '',
          s.status || '',
          s.ingested_at || ''
        ].join(',');
      })
    ].join('\n');
    
    const filename = `signals_export_${timestamp}.csv`;
    fs.writeFileSync(filename, csv);
    console.log(`✅ Exported ${signals.length} signals to: ${filename}`);
    
  } else if (format === 'json') {
    // JSON export
    const json = JSON.stringify(signals, null, 2);
    const filename = `signals_export_${timestamp}.json`;
    fs.writeFileSync(filename, json);
    console.log(`✅ Exported ${signals.length} signals to: ${filename}`);
    
  } else {
    // HTML export (default)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Scanner Signals Export</title>
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #1a1a1a;
      color: #e0e0e0;
    }
    h1 {
      color: #ffffff;
      border-bottom: 3px solid #4CAF50;
      padding-bottom: 10px;
    }
    .stats {
      background: #2d2d2d;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      color: #e0e0e0;
    }
    .signal {
      background: #2d2d2d;
      padding: 20px;
      margin-bottom: 15px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      border-left: 4px solid #555;
    }
    .signal.constraint {
      border-left-color: #ff5252;
    }
    .signal.commitment {
      border-left-color: #4CAF50;
    }
    .signal.context {
      border-left-color: #64b5f6;
    }
    .signal-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    .lane {
      font-weight: bold;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
    }
    .lane.constraint {
      background: rgba(255, 82, 82, 0.2);
      color: #ff5252;
      border: 1px solid rgba(255, 82, 82, 0.3);
    }
    .lane.commitment {
      background: rgba(76, 175, 80, 0.2);
      color: #4CAF50;
      border: 1px solid rgba(76, 175, 80, 0.3);
    }
    .lane.context {
      background: rgba(100, 181, 246, 0.2);
      color: #64b5f6;
      border: 1px solid rgba(100, 181, 246, 0.3);
    }
    .confidence {
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
    }
    .confidence.high {
      background: rgba(255, 82, 82, 0.2);
      color: #ff5252;
      border: 1px solid rgba(255, 82, 82, 0.3);
    }
    .confidence.med {
      background: rgba(255, 183, 77, 0.2);
      color: #ffb74d;
      border: 1px solid rgba(255, 183, 77, 0.3);
    }
    .confidence.low {
      background: rgba(186, 104, 200, 0.2);
      color: #ba68c8;
      border: 1px solid rgba(186, 104, 200, 0.3);
    }
    .headline {
      font-size: 18px;
      font-weight: 600;
      color: #ffffff;
      margin: 10px 0;
    }
    .meta {
      color: #b0b0b0;
      font-size: 14px;
      margin: 5px 0;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin: 10px 0;
    }
    .tag {
      background: #3d3d3d;
      color: #e0e0e0;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      border: 1px solid #555;
    }
    .url {
      color: #64b5f6;
      text-decoration: none;
      word-break: break-all;
    }
    .url:hover {
      color: #90caf9;
      text-decoration: underline;
    }
    .summary {
      background: #1e1e1e;
      padding: 10px;
      border-radius: 4px;
      margin: 10px 0;
      font-size: 14px;
      line-height: 1.6;
      color: #d0d0d0;
      border: 1px solid #333;
    }
  </style>
</head>
<body>
  <h1>📊 Scanner Signals Export - Projects (South Central US)</h1>
  <div class="stats">
    <strong>Projects:</strong> ${signals.length}<br>
    <strong>Filter:</strong> ${options.lane || 'COMMITMENT'} signals in South Central US (TX, OK, AR, LA, NM, KS, MO)<br>
    ${!options.includeContext ? '<em>Note: CONTEXT signals (static content) are hidden by default</em><br>' : ''}
    ${options.all ? '<strong>Date Range:</strong> All time<br>' : `<strong>Date Range:</strong> ${oneWeekAgo.toLocaleDateString()} - ${new Date().toLocaleDateString()}<br>`}
    <strong>Exported:</strong> ${new Date().toLocaleString()}
  </div>
  
  ${signals.map((signal, idx) => {
    const tags = JSON.parse(signal.tags || '[]');
    const laneClass = signal.lane?.toLowerCase() || 'context';
    const confidenceClass = signal.confidence?.toLowerCase() || 'low';
    
    return `
    <div class="signal ${laneClass}">
      <div class="signal-header">
        <span class="lane ${laneClass}">${signal.lane || 'CONTEXT'}</span>
        <span class="confidence ${confidenceClass}">${signal.confidence || 'LOW'} confidence</span>
        ${signal.event_type ? `<span style="color: #b0b0b0; font-size: 12px;">${signal.event_type}</span>` : ''}
      </div>
      <div class="headline">${signal.headline || 'Untitled'}</div>
      ${signal.url ? `<div class="meta"><strong>URL:</strong> <a href="${signal.url}" target="_blank" class="url">${signal.url}</a></div>` : ''}
      ${signal.source_type ? `<div class="meta"><strong>Source:</strong> ${signal.source_type}</div>` : ''}
      ${tags.length > 0 ? `<div class="tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : ''}
      ${signal.summary_3bullets ? `<div class="summary">${signal.summary_3bullets.replace(/\n/g, '<br>')}</div>` : ''}
      ${signal.ingested_at ? `<div class="meta" style="margin-top: 10px; font-size: 12px; color: #999;">Ingested: ${new Date(signal.ingested_at).toLocaleString()}</div>` : ''}
    </div>
    `;
  }).join('')}
</body>
</html>`;
    
    const filename = `signals_export_${timestamp}.html`;
    fs.writeFileSync(filename, html);
    console.log(`✅ Exported ${signals.length} signals to: ${filename}`);
    console.log(`   Open in browser: open ${filename}`);
  }
  
  await db.close();
}

// Parse command line arguments
const format = process.argv[2] || 'html';
const options = {};

// Check for lane filter
if (process.argv.includes('--lane') || process.argv.includes('-l')) {
  const laneIndex = process.argv.findIndex(arg => arg === '--lane' || arg === '-l');
  options.lane = process.argv[laneIndex + 1] || 'COMMITMENT';
}

// Check for region filter
if (process.argv.includes('--region') || process.argv.includes('-r')) {
  const regionIndex = process.argv.findIndex(arg => arg === '--region' || arg === '-r');
  options.region = process.argv[regionIndex + 1] || 'south-central';
}

// Check for --all flag
if (process.argv.includes('--all') || process.argv.includes('-a')) {
  options.all = true;
}

// Check for --include-context flag
if (process.argv.includes('--include-context') || process.argv.includes('--context')) {
  options.includeContext = true;
}

// Default: show COMMITMENT (projects) in south-central if no filters specified
if (!options.lane && !options.region) {
  options.lane = 'COMMITMENT';
  options.region = 'south-central';
}

exportSignals(format, options).catch(console.error);

