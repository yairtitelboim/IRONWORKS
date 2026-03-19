/**
 * Main ingestion orchestrator
 * Coordinates: Tavily search → Normalize → Classify → Diff → Store
 */

import TavilyClient from './api-clients/tavily-client.js';
import SignalNormalizer from './signal-normalizer.js';
import SignalClassifier from './signal-classifier.js';
import SignalDiffer from './signal-differ.js';
import SignalsDB from './storage/signals-db.js';
import crypto from 'crypto';

export class SignalIngester {
  constructor(db) {
    this.db = db;
    this.tavilyClient = new TavilyClient();
    this.normalizer = new SignalNormalizer();
    this.classifier = new SignalClassifier();
    this.differ = new SignalDiffer();
  }

  /**
   * Ingest signals from a query
   * @param {string} query - Search query
   * @param {string} sourceType - Source type (default: 'TAVILY')
   * @returns {Promise<Object>} Ingestion result with stats
   */
  async ingest(query, sourceType = 'TAVILY', options = {}) {
    console.log(`\n📥 [Ingester] Starting ingestion: "${query}"`);
    
    // Default to last 7 days to avoid duplicates
    const days = options.days || 7;
    const maxResults = options.maxResults || 10;
    
    try {
      // Step 1: Search Tavily (API CALL) - with date filtering
      console.log(`\n1️⃣ [Ingester] Searching Tavily (last ${days} days)...`);
      const tavilyResults = await this.tavilyClient.search(query, maxResults, { days });
      
      if (tavilyResults.length === 0) {
        console.log(`⚠️ [Ingester] No results found`);
        return {
          success: true,
          query,
          signalsFound: 0,
          signalsNew: 0,
          signalsChanged: 0,
          signalsWithdrawn: 0
        };
      }

      // Step 2: Normalize results
      console.log(`\n2️⃣ [Ingester] Normalizing ${tavilyResults.length} results...`);
      const normalizedSignals = tavilyResults.map(result => 
        this.normalizer.normalizeTavilyResult(result, sourceType)
      );

      // Step 3: Get previous snapshot for URL-based deduplication (exact duplicates)
      console.log(`\n3️⃣ [Ingester] Loading previous snapshot for URL deduplication...`);
      const previousSnapshot = await this.db.getLatestSnapshot(sourceType, query);

      // Step 4: URL-based diff (for exact duplicates only)
      console.log(`\n4️⃣ [Ingester] Detecting URL duplicates...`);
      const urlDiffResult = this.differ.diff(tavilyResults, previousSnapshot, 'url');
      console.log(`   📊 URL duplicates filtered: ${urlDiffResult.unchangedItems.length} exact duplicates`);

      // Step 5: Classify signals and generate situation keys
      console.log(`\n5️⃣ [Ingester] Classifying signals...`);
      const classifiedSignals = [];
      let demotedCount = 0;
      
      // Filter out exact URL duplicates before processing
      const urlDuplicateKeys = new Set(
        urlDiffResult.unchangedItems.map(item => item.url).filter(Boolean)
      );
      const signalsToProcess = normalizedSignals.filter(signal => 
        !urlDuplicateKeys.has(signal.url)
      );
      
      console.log(`   📊 Processing ${signalsToProcess.length} signals (${normalizedSignals.length - signalsToProcess.length} URL duplicates skipped)`);
      
      for (const signal of signalsToProcess) {
        const classification = await this.classifier.classify(signal);
        signal.lane = classification.lane;
        signal.event_type = classification.event_type;
        signal.confidence = classification.confidence;
        signal.change_type = classification.change_type || signal.change_type || 'UNKNOWN';
        signal.tags = JSON.stringify(classification.tags);
        
        // Count demoted signals (no change_type = CONTEXT)
        if (classification.lane === 'CONTEXT' && !classification.change_type) {
          demotedCount++;
        }
        
        // For News signals: Generate situation_key and detect recurrence
        if (signal.source_type === 'TAVILY') {
          // Generate situation_key after classification (we now have tags/friction types)
          signal.situation_key = this.normalizer.generateSituationKey(signal);
          
          // Detect recurrence with time windows
          const recurrenceData = await this.detectRecurrence(signal);
          
          // Store windowed recurrence counts
          signal.recurrence_14d = recurrenceData.recurrence_14d;
          signal.recurrence_90d = recurrenceData.recurrence_90d;
          signal.first_seen_at = recurrenceData.first_seen_at;
          signal.last_seen_at = recurrenceData.last_seen_at;
          
          // Add recurrence tag for backward compatibility (use 14d count)
          if (recurrenceData.recurrence_14d > 0) {
            const tags = JSON.parse(signal.tags || '[]');
            tags.push(`recurrence:${recurrenceData.recurrence_14d}`);
            signal.tags = JSON.stringify(tags);
            
            console.log(`   🔁 [Ingester] Recurrence detected: ${recurrenceData.recurrence_14d} in last 14d, ${recurrenceData.recurrence_90d} in last 90d`);
            if (recurrenceData.first_seen_at) {
              console.log(`      First seen: ${recurrenceData.first_seen_at}, Last seen: ${recurrenceData.last_seen_at}`);
            }
          }
          
          if (signal.situation_key) {
            console.log(`   🔑 [Ingester] Situation key: ${signal.situation_key}`);
          }
        }
        
        classifiedSignals.push(signal);
      }
      
      if (demotedCount > 0) {
        console.log(`   ⚠️  Demoted ${demotedCount} signals to CONTEXT (no clear change_type)`);
      }

      // Step 6: Situation-based change detection for News signals
      console.log(`\n6️⃣ [Ingester] Detecting situation changes...`);
      const signalsWithChangeTypes = await this.detectSituationChanges(classifiedSignals, sourceType);

      // Step 7: Store signals
      console.log(`\n7️⃣ [Ingester] Storing ${signalsWithChangeTypes.length} signals...`);
      let storedCount = 0;
      let duplicateCount = 0;
      for (const signal of signalsWithChangeTypes) {
        try {
          await this.db.insertSignal(signal);
          storedCount++;
        } catch (error) {
          // Check if it's a duplicate key error (signal_id already exists)
          if (error.message && error.message.includes('UNIQUE constraint')) {
            duplicateCount++;
            console.log(`   ⚠️ [Ingester] Duplicate signal_id skipped: ${signal.signal_id.substring(0, 8)}...`);
          } else {
            console.error(`   ❌ [Ingester] Failed to store signal: ${error.message}`);
          }
        }
      }
      console.log(`   ✅ Stored: ${storedCount}, Duplicates: ${duplicateCount}`);

      // Step 8: Store snapshot (for URL-based deduplication)
      // Store raw Tavily results for URL deduplication in next run
      const snapshotId = crypto.createHash('sha256')
        .update(`${sourceType}|${query}|${Date.now()}`)
        .digest('hex')
        .substring(0, 16);
      
      await this.db.insertSnapshot({
        snapshot_id: snapshotId,
        source_type: sourceType,
        query: query,
        raw_payload: JSON.stringify(tavilyResults) // Store raw results for URL deduplication
      });

      // Step 9: Stats
      const urlDuplicates = urlDiffResult.unchangedItems.length;
      const newSituations = signalsWithChangeTypes.filter(s => s.change_type === 'NEW').length;
      const escalatedSituations = signalsWithChangeTypes.filter(s => s.change_type === 'ESCALATED').length;
      const repeatedSituations = signalsWithChangeTypes.filter(s => s.change_type === 'REPEATED').length;
      
      const stats = {
        success: true,
        query,
        daysFilter: days,
        signalsFound: tavilyResults.length,
        urlDuplicates: urlDuplicates,
        signalsProcessed: signalsToProcess.length,
        signalsStored: storedCount,
        signalsNew: newSituations,
        signalsChanged: escalatedSituations + repeatedSituations,
        signalsEscalated: escalatedSituations,
        signalsRepeated: repeatedSituations,
        signalsWithdrawn: 0, // Not applicable for situation-based detection
        classificationStats: this.classifier.getStats()
      };

      console.log(`\n✅ [Ingester] Ingestion complete!`);
      console.log(`   📊 Found: ${stats.signalsFound}`);
      console.log(`   🆕 New: ${stats.signalsNew}`);
      console.log(`   🔄 Changed: ${stats.signalsChanged}`);
      console.log(`   🧠 LLM calls: ${stats.classificationStats.llmCalls}/${stats.classificationStats.maxLLMCalls}`);

      return stats;
    } catch (error) {
      console.error(`❌ [Ingester] Ingestion failed:`, error.message);
      throw error;
    }
  }

  /**
   * Detect situation-based changes for News signals
   * Change detection for News:
   * - New situation appears (situation_key not seen before)
   * - Situation escalates (context → constraint)
   * - Situation repeats (recurrence increases)
   */
  async detectSituationChanges(signals, sourceType) {
    if (sourceType !== 'TAVILY') {
      // For ERCOT, use existing diff logic (not implemented here, handled elsewhere)
      return signals;
    }

    // For News: detect situation-based changes
    const updatedSignals = [];
    
    for (const signal of signals) {
      if (!signal.situation_key) {
        // No situation key = can't detect situation changes, mark as NEW
        signal.change_type = signal.change_type || 'NEW';
        updatedSignals.push(signal);
        continue;
      }

      // Query database for previous signals with same situation_key
      const query = `
        SELECT signal_id, lane, recurrence_14d, ingested_at
        FROM signals
        WHERE source_type = 'TAVILY'
          AND situation_key = ?
          AND signal_id != ?
        ORDER BY ingested_at DESC
        LIMIT 1
      `;

      const previousSignal = await new Promise((resolve, reject) => {
        this.db.db.get(query, [signal.situation_key, signal.signal_id], (err, row) => {
          if (err) {
            console.warn(`⚠️ [Ingester] Situation change detection query failed:`, err.message);
            resolve(null);
          } else {
            resolve(row);
          }
        });
      });

      // Preserve classifier's change_type if it's more specific (ESCALATED, DENIED, etc.)
      const classifierChangeType = signal.change_type;
      const isClassifierSpecific = classifierChangeType && 
        ['ESCALATED', 'DENIED', 'WITHDRAWN', 'STALLED'].includes(classifierChangeType);

      if (!previousSignal) {
        // New situation appears
        // Only set to NEW if classifier didn't already set a more specific type
        if (!isClassifierSpecific) {
          signal.change_type = 'NEW';
        }
        console.log(`   🆕 [Ingester] New situation: ${signal.situation_key} (change_type: ${signal.change_type})`);
      } else {
        // Situation exists - check for escalation or recurrence increase
        const previousLane = previousSignal.lane || 'CONTEXT';
        const previousRecurrence = previousSignal.recurrence_14d || 0;
        const currentRecurrence = signal.recurrence_14d || 0;

        if (previousLane === 'CONTEXT' && signal.lane === 'CONSTRAINT') {
          // Situation escalated: context → constraint
          // Only override if classifier didn't already set ESCALATED
          if (!isClassifierSpecific || classifierChangeType !== 'ESCALATED') {
            signal.change_type = 'ESCALATED';
          }
          console.log(`   ⚠️ [Ingester] Situation escalated: ${signal.situation_key} (${previousLane} → ${signal.lane}, change_type: ${signal.change_type})`);
        } else if (currentRecurrence > previousRecurrence) {
          // Situation repeats (recurrence increased)
          signal.change_type = 'REPEATED';
          console.log(`   🔁 [Ingester] Situation repeated: ${signal.situation_key} (recurrence ${previousRecurrence} → ${currentRecurrence})`);
        } else {
          // Same situation, no significant change
          // Preserve classifier's type if it's specific, otherwise mark as UNCHANGED
          if (!isClassifierSpecific) {
            signal.change_type = 'UNCHANGED';
          }
        }
      }

      updatedSignals.push(signal);
    }

    return updatedSignals;
  }

  /**
   * Detect recurrence with time windows: Check if same anchors appear in previous signals
   * Uses weighted scoring: company=3, asset=2, county=1, requires score≥3
   * Returns object with windowed counts and first/last seen dates
   */
  async detectRecurrence(signal) {
    if (!signal.company_entities && !signal.county && !signal.city && !signal.asset_type_guess) {
      return {
        recurrence_14d: 0,
        recurrence_90d: 0,
        first_seen_at: null,
        last_seen_at: null
      };
    }

    try {
      const now = new Date();
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      // Build query to find previous signals with matching anchors
      // Use weighted scoring: company=3, asset=2, county=1, only count if score≥3
      const conditions = [];
      const params = [];

      // Match on WHO (company/developer) = +3
      if (signal.company_entities) {
        conditions.push('company_entities = ?');
        params.push(signal.company_entities);
      }

      // Match on WHERE (county or city) = +1
      if (signal.county) {
        conditions.push('county = ?');
        params.push(signal.county);
      } else if (signal.city) {
        conditions.push('city = ?');
        params.push(signal.city);
      }

      // Match on ASSET (asset type) = +2
      if (signal.asset_type_guess) {
        conditions.push('asset_type_guess = ?');
        params.push(signal.asset_type_guess);
      }

      if (conditions.length === 0) {
        return {
          recurrence_14d: 0,
          recurrence_90d: 0,
          first_seen_at: null,
          last_seen_at: null
        };
      }

      // Query for previous signals that might match (we'll calculate weighted score in JS)
      const query = `
        SELECT ingested_at, company_entities, asset_type_guess, county, city
        FROM signals
        WHERE source_type = 'TAVILY'
          AND signal_id != ?
          AND (${conditions.join(' OR ')})
        ORDER BY ingested_at ASC
      `;

      const queryParams = [signal.signal_id, ...params];

      return new Promise((resolve, reject) => {
        this.db.db.all(query, queryParams, (err, rows) => {
          if (err) {
            console.warn(`⚠️ [Ingester] Recurrence detection query failed:`, err.message);
            resolve({
              recurrence_14d: 0,
              recurrence_90d: 0,
              first_seen_at: null,
              last_seen_at: null
            });
            return;
          }

          // Calculate weighted score for each row and filter (score >= 3)
          const validMatches = rows.filter(row => {
            // Calculate weighted score: company=3, asset=2, county=1
            let score = 0;
            if (signal.company_entities && row.company_entities && 
                signal.company_entities.toLowerCase() === row.company_entities.toLowerCase()) {
              score += 3;
            }
            if (signal.asset_type_guess && row.asset_type_guess && 
                signal.asset_type_guess.toLowerCase() === row.asset_type_guess.toLowerCase()) {
              score += 2;
            }
            const rowLocation = row.county || row.city;
            const signalLocation = signal.county || signal.city;
            if (signalLocation && rowLocation && 
                signalLocation.toLowerCase() === rowLocation.toLowerCase()) {
              score += 1;
            }
            return score >= 3;
          });
          
          if (validMatches.length === 0) {
            resolve({
              recurrence_14d: 0,
              recurrence_90d: 0,
              first_seen_at: null,
              last_seen_at: null
            });
            return;
          }

          // Calculate first and last seen
          const firstSeen = validMatches[0]?.ingested_at || null;
          const lastSeen = validMatches[validMatches.length - 1]?.ingested_at || null;

          // Count within windows
          let count14d = 0;
          let count90d = 0;

          for (const row of validMatches) {
            const rowDate = new Date(row.ingested_at);
            if (rowDate >= fourteenDaysAgo) {
              count14d++;
            }
            if (rowDate >= ninetyDaysAgo) {
              count90d++;
            }
          }

          resolve({
            recurrence_14d: count14d,
            recurrence_90d: count90d,
            first_seen_at: firstSeen,
            last_seen_at: lastSeen
          });
        });
      });
    } catch (error) {
      console.warn(`⚠️ [Ingester] Recurrence detection failed:`, error.message);
      return {
        recurrence_14d: 0,
        recurrence_90d: 0,
        first_seen_at: null,
        last_seen_at: null
      };
    }
  }
}

export default SignalIngester;

