/**
 * Phase 2 Signal Ingester
 * Uses adapters instead of Tavily/Perplexity
 * Integrates deduplication and enhanced change detection
 */

import SignalNormalizerV2 from './signal-normalizer-v2.js';
import SignalClassifier from '../phase1/signal-classifier.js';
import SignalDiffer from '../phase1/signal-differ.js';
import SignalDeduplicator from './signal-deduplicator.js';
import crypto from 'crypto';

export class SignalIngesterV2 {
  constructor(db, adapters = {}) {
    this.db = db;
    this.adapters = adapters;
    this.normalizer = new SignalNormalizerV2();
    this.classifier = new SignalClassifier();
    this.differ = new SignalDiffer();
    this.deduplicator = new SignalDeduplicator();
  }

  /**
   * Get comparison key strategy for a source type
   * @param {string} sourceType - Source type (ERCOT_QUEUE, TX_PUC, RSS, etc.)
   * @returns {string|Function} Comparison key strategy
   */
  getComparisonKeyForSource(sourceType) {
    // ERCOT and PUC use source_id
    if (sourceType === 'ERCOT_QUEUE' || sourceType === 'TX_PUC') {
      return 'source_id';
    }
    // RSS and others use URL
    return 'url';
  }

  /**
   * Ingest signals from a specific source adapter
   * @param {string} sourceType - Source type key (ERCOT, PUC, RSS, etc.)
   * @returns {Promise<Object>} Ingestion result with stats
   */
  async ingestFromSource(sourceType) {
    const adapter = this.adapters[sourceType];
    if (!adapter) {
      throw new Error(`Unknown source type: ${sourceType}`);
    }

    console.log(`\n📥 [IngesterV2] Starting ingestion from ${sourceType}...`);

    try {
      // Step 1: Fetch from adapter (with retry)
      console.log(`\n1️⃣ [IngesterV2] Fetching from ${sourceType} adapter...`);
      let rawSignals;
      let downloadStatus = null;
      try {
        rawSignals = await adapter.fetchWithRetry();
        // Check if adapter has download status (ERCOT adapter stores it as instance property)
        if (adapter.getDownloadStatus && typeof adapter.getDownloadStatus === 'function') {
          downloadStatus = adapter.getDownloadStatus();
        }
      } catch (error) {
        console.error(`❌ [IngesterV2] Adapter fetch failed: ${error.message}`);
        // Try fallback to last known good snapshot
        rawSignals = await adapter.getLastKnownGoodSnapshot(this.db);
        if (rawSignals.length === 0) {
          throw new Error(`No data available and no fallback snapshot for ${sourceType}`);
        }
        console.warn(`⚠️ [IngesterV2] Using fallback snapshot with ${rawSignals.length} signals`);
      }

      if (rawSignals.length === 0) {
        console.log(`⚠️ [IngesterV2] No signals found from ${sourceType}`);
        return {
          success: true,
          source: sourceType,
          signalsFound: 0,
          signalsNew: 0,
          signalsChanged: 0,
          signalsWithdrawn: 0,
          signalsDeduplicated: 0
        };
      }

      // Step 2: Normalize RawSignals to full schema
      console.log(`\n2️⃣ [IngesterV2] Normalizing ${rawSignals.length} raw signals...`);
      const normalizedSignals = rawSignals.map(rawSignal => {
        // Adapter may have already normalized, but ensure schema compliance
        const normalized = this.normalizer.normalizeRawSignal(rawSignal);
        return normalized;
      });

      // Step 3: Get previous snapshot for diffing
      console.log(`\n3️⃣ [IngesterV2] Loading previous snapshot...`);
      const previousSnapshot = await this.db.getLatestSnapshot(adapter.sourceType, null);

      // Step 4: Deduplicate across sources (before diffing)
      console.log(`\n4️⃣ [IngesterV2] Checking for duplicates across sources...`);
      const deduplicatedSignals = [];
      let duplicatesFound = 0;
      for (const signal of normalizedSignals) {
        const duplicate = await this.deduplicator.findDuplicates(signal, this.db);
        if (!duplicate) {
          deduplicatedSignals.push(signal);
        } else {
          duplicatesFound++;
          console.log(`   🔗 Duplicate found: ${signal.headline.substring(0, 50)}...`);
          // Link related signals
          await this.deduplicator.linkRelatedSignals(signal, duplicate, this.db);
        }
      }

      if (duplicatesFound > 0) {
        console.log(`   📊 Deduplicated: ${duplicatesFound} signals`);
      }

      // Step 5: Diff (change detection) - only on deduplicated signals
      console.log(`\n5️⃣ [IngesterV2] Detecting changes...`);
      const comparisonKey = this.getComparisonKeyForSource(adapter.sourceType);
      const diffResult = this.differ.diff(deduplicatedSignals, previousSnapshot, comparisonKey);
      console.log(
        `   📊 New: ${diffResult.newItems.length}, Changed: ${diffResult.changedItems.length}, Withdrawn: ${diffResult.withdrawnItems.length}`
      );

      // Step 6: Classify signals
      console.log(`\n6️⃣ [IngesterV2] Classifying ${deduplicatedSignals.length} signals...`);
      const classifiedSignals = [];
      for (const signal of deduplicatedSignals) {
        const classification = await this.classifier.classify(signal);
        signal.lane = classification.lane;
        signal.event_type = classification.event_type;
        signal.confidence = classification.confidence;
        signal.tags = JSON.stringify(classification.tags);
        classifiedSignals.push(signal);
      }

      // Step 7: Apply change types
      const signalsWithChangeTypes = this.differ.applyChangeTypes(
        classifiedSignals,
        diffResult,
        comparisonKey
      );

      // Step 8: Store signals (only new and changed)
      console.log(`\n7️⃣ [IngesterV2] Storing signals...`);
      const signalsToStore = signalsWithChangeTypes.filter(
        s => s.change_type === 'NEW_ITEM' || s.change_type === 'CHANGED_ITEM'
      );

      // Track IDs of new vs updated signals for UI delta highlighting
      const newIds = [];
      const updatedIds = [];

      for (const signal of signalsToStore) {
        await this.db.insertSignal(signal);
        if (signal.change_type === 'NEW_ITEM') {
          newIds.push(signal.signal_id);
        } else if (signal.change_type === 'CHANGED_ITEM') {
          updatedIds.push(signal.signal_id);
        }
      }

      // Step 9: Store snapshot
      const snapshotId = crypto
        .createHash('sha256')
        .update(`${adapter.sourceType}|${Date.now()}`)
        .digest('hex')
        .substring(0, 16);

      await this.db.insertSnapshot({
        snapshot_id: snapshotId,
        source_type: adapter.sourceType,
        query: null, // No query for structured sources
        raw_payload: JSON.stringify(rawSignals)
      });

      // Step 10: Stats
      const stats = {
        success: true,
        source: sourceType,
        signalsFound: rawSignals.length,
        signalsNew: diffResult.newItems.length,
        signalsChanged: diffResult.changedItems.length,
        signalsWithdrawn: diffResult.withdrawnItems.length,
        signalsDeduplicated: duplicatesFound,
        signalsStored: signalsToStore.length,
        // Expose delta IDs so the UI can highlight what changed this run
        newIds,
        updatedIds,
        classificationStats: this.classifier.getStats(),
        // Include download status if available (for ERCOT adapter)
        downloadStatus: downloadStatus
      };

      console.log(`\n✅ [IngesterV2] Ingestion complete for ${sourceType}!`);
      console.log(`   📊 Found: ${stats.signalsFound}`);
      console.log(`   🆕 New: ${stats.signalsNew}`);
      console.log(`   🔄 Changed: ${stats.signalsChanged}`);
      console.log(`   🔗 Deduplicated: ${stats.signalsDeduplicated}`);
      console.log(`   💾 Stored: ${stats.signalsStored}`);
      console.log(
        `   🧠 LLM calls: ${stats.classificationStats.llmCalls}/${stats.classificationStats.maxLLMCalls}`
      );

      return stats;
    } catch (error) {
      console.error(`❌ [IngesterV2] Ingestion failed for ${sourceType}:`, error.message);
      throw error;
    }
  }

  /**
   * Ingest from all configured adapters
   * @returns {Promise<Array>} Array of ingestion results
   */
  async ingestAll() {
    const results = [];

    for (const [sourceType, adapter] of Object.entries(this.adapters)) {
      try {
        const result = await this.ingestFromSource(sourceType);
        results.push(result);
      } catch (error) {
        console.error(`❌ [IngesterV2] ${sourceType} ingestion failed:`, error.message);
        results.push({
          success: false,
          source: sourceType,
          error: error.message
        });
      }
    }

    return results;
  }
}

export default SignalIngesterV2;

