#!/usr/bin/env node
/**
 * Scanner CLI - Main entry point
 */

import { Command } from 'commander';
import dotenv from 'dotenv';
import SignalsDB from './storage/signals-db.js';
import SignalIngester from './signal-ingester.js';
import SignalIngesterV2 from '../phase2/signal-ingester-v2.js';
import ERCOTAdapter from '../phase2/adapters/ercot-adapter.js';
import { QUERY_TEMPLATES } from '../config/scanner-config.js';

// Load environment variables (from parent directory)
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const program = new Command();

program
  .name('scanner')
  .description('Scanner Phase 1 - Pipeline Validation & Change Detection')
  .version('1.0.0');

// Ingest command
program
  .command('ingest')
  .description('Ingest signals from a query')
  .option('-q, --query <query>', 'Search query')
  .option('-t, --template <type>', 'Use query template (constraint|commitment)', 'constraint')
  .option('-s, --source <source>', 'Source type', 'TAVILY')
  .action(async (options) => {
    try {
      const db = new SignalsDB();
      await db.connect();
      await db.init();

      const ingester = new SignalIngester(db);

      let query = options.query;
      
      // If no query, use template
      if (!query) {
        const templates = QUERY_TEMPLATES[options.template] || QUERY_TEMPLATES.constraint;
        query = templates[0]; // Use first template
        console.log(`📋 Using template query: "${query}"`);
      }

      const result = await ingester.ingest(query, options.source);
      
      await db.close();
      
      console.log('\n📊 Summary:');
      console.log(`   Query: ${result.query}`);
      console.log(`   Found: ${result.signalsFound} signals`);
      console.log(`   New: ${result.signalsNew}`);
      console.log(`   Changed: ${result.signalsChanged}`);
      console.log(`   Withdrawn: ${result.signalsWithdrawn}`);
      
      process.exit(0);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .description('List signals (CONTEXT hidden by default)')
  .option('-l, --lane <lane>', 'Filter by lane (CONSTRAINT|COMMITMENT|CONTEXT)')
  .option('-s, --status <status>', 'Filter by status (NEW|REVIEWED|LINKED)')
  .option('-t, --source-type <type>', 'Filter by source type')
  .option('--include-context', 'Include CONTEXT signals (static content)')
  .option('--limit <number>', 'Limit results', '50')
  .action(async (options) => {
    try {
      const db = new SignalsDB();
      await db.connect();

      const filters = {};
      if (options.lane) filters.lane = options.lane;
      if (options.status) filters.status = options.status;
      if (options.sourceType) filters.source_type = options.sourceType;
      if (options.limit) filters.limit = parseInt(options.limit);

      let signals = await db.getSignals(filters);
      
      // Hide CONTEXT by default (unless explicitly requested or lane filter is set)
      if (!options.includeContext && !options.lane) {
        signals = signals.filter(s => s.lane !== 'CONTEXT');
        if (signals.length < filters.limit) {
          console.log(`ℹ️  Hidden CONTEXT signals (static content). Use --include-context to show all.`);
        }
      }
      
      console.log(`\n📋 Found ${signals.length} signals:\n`);
      
      signals.forEach((signal, idx) => {
        console.log(`${idx + 1}. [${signal.lane}] ${signal.headline}`);
        console.log(`   URL: ${signal.url}`);
        console.log(`   Tags: ${signal.tags || 'none'}`);
        console.log(`   Status: ${signal.status}`);
        console.log('');
      });

      await db.close();
      process.exit(0);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// Review command
program
  .command('review')
  .description('Review new signals')
  .option('--lane <lane>', 'Filter by lane', 'CONSTRAINT')
  .action(async (options) => {
    try {
      const db = new SignalsDB();
      await db.connect();

      const signals = await db.getSignals({
        lane: options.lane,
        status: 'NEW',
        limit: 20
      });

      if (signals.length === 0) {
        console.log('✅ No new signals to review');
        await db.close();
        process.exit(0);
      }

      console.log(`\n📋 Reviewing ${signals.length} new ${options.lane} signals:\n`);
      
      signals.forEach((signal, idx) => {
        console.log(`\n${idx + 1}. ${signal.headline}`);
        console.log(`   URL: ${signal.url}`);
        console.log(`   Event: ${signal.event_type || 'N/A'}`);
        console.log(`   Confidence: ${signal.confidence}`);
        console.log(`   Tags: ${signal.tags || 'none'}`);
        console.log(`   Summary: ${signal.summary_3bullets?.substring(0, 100) || 'N/A'}...`);
      });

      await db.close();
      process.exit(0);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// ERCOT command - Separate feed for ERCOT queue data
program
  .command('ercot')
  .description('Ingest ERCOT interconnection queue data (separate feed)')
  .option('--data-path <path>', 'Path to ERCOT CSV file (default: LBL dataset)')
  .option('--gis-reports', 'Use GIS reports dataset instead of LBL dataset')
  .option('--gis-path <path>', 'Path to GIS reports CSV file')
  .action(async (options) => {
    try {
      const db = new SignalsDB();
      await db.connect();
      await db.init();

      // Create ERCOT adapter
      const adapterConfig = {};
      if (options.dataPath) {
        adapterConfig.dataPath = options.dataPath;
      }
      if (options.gisReports) {
        adapterConfig.useGisReports = true;
      }
      if (options.gisPath) {
        adapterConfig.gisReportsPath = options.gisPath;
      }

      const ercotAdapter = new ERCOTAdapter(adapterConfig);

      // Create Phase 2 ingester with ERCOT adapter
      const ingester = new SignalIngesterV2(db, {
        ERCOT: ercotAdapter
      });

      console.log('🔌 [ERCOT Feed] Starting ERCOT queue ingestion...\n');

      const result = await ingester.ingestFromSource('ERCOT');
      
      await db.close();
      
      console.log('\n📊 ERCOT Ingestion Summary:');
      console.log(`   Source: ${result.source}`);
      console.log(`   Found: ${result.signalsFound} signals`);
      console.log(`   New: ${result.signalsNew}`);
      console.log(`   Changed: ${result.signalsChanged}`);
      console.log(`   Withdrawn: ${result.signalsWithdrawn}`);
      console.log(`   Deduplicated: ${result.signalsDeduplicated || 0}`);
      console.log(`   Stored: ${result.signalsStored}`);
      
      process.exit(0);
    } catch (error) {
      console.error('❌ ERCOT ingestion error:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  });

// Stats command
program
  .command('stats')
  .description('Show statistics')
  .action(async () => {
    try {
      const db = new SignalsDB();
      await db.connect();

      const allSignals = await db.getSignals({ limit: 10000 });
      
      const stats = {
        total: allSignals.length,
        byLane: {},
        byStatus: {},
        bySourceType: {}
      };

      allSignals.forEach(signal => {
        stats.byLane[signal.lane] = (stats.byLane[signal.lane] || 0) + 1;
        stats.byStatus[signal.status] = (stats.byStatus[signal.status] || 0) + 1;
        stats.bySourceType[signal.source_type] = (stats.bySourceType[signal.source_type] || 0) + 1;
      });

      console.log('\n📊 Scanner Statistics:\n');
      console.log(`Total Signals: ${stats.total}`);
      console.log(`\nBy Lane:`);
      Object.entries(stats.byLane).forEach(([lane, count]) => {
        console.log(`  ${lane}: ${count}`);
      });
      console.log(`\nBy Status:`);
      Object.entries(stats.byStatus).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });
      console.log(`\nBy Source:`);
      Object.entries(stats.bySourceType).forEach(([source, count]) => {
        console.log(`  ${source}: ${count}`);
      });

      await db.close();
      process.exit(0);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

program.parse();

