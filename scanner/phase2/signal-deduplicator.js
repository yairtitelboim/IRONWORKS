/**
 * Multi-source signal deduplication
 * Links signals from different sources about the same event
 */

export class SignalDeduplicator {
  /**
   * Find duplicate or related signals across sources
   * @param {Object} signal - Signal to check
   * @param {Object} db - SignalsDB instance
   * @returns {Promise<Object|null>} Duplicate signal or null
   */
  async findDuplicates(signal, db) {
    // Strategy 1: Exact URL match
    if (signal.url) {
      const urlMatch = await db.getSignalByUrl(signal.url);
      if (urlMatch) {
        return urlMatch;
      }
    }

    // Strategy 2: Source ID match (for structured sources like ERCOT, PUC)
    if (signal.source_id && signal.source_type) {
      const sourceIdMatch = await db.getSignalBySourceId(signal.source_type, signal.source_id);
      if (sourceIdMatch) {
        return sourceIdMatch;
      }
    }

    // Strategy 3: Fuzzy headline match
    if (signal.headline) {
      const similarSignals = await db.getSignalsByFuzzyHeadline(signal.headline, 0.8);
      if (similarSignals.length > 0) {
        // Check if any are very similar (simple check for now)
        const verySimilar = similarSignals.find(s => {
          const similarity = this.calculateSimilarity(
            signal.headline.toLowerCase(),
            s.headline.toLowerCase()
          );
          return similarity > 0.85; // 85% similarity threshold
        });
        if (verySimilar) {
          return verySimilar;
        }
      }
    }

    // Strategy 4: Company name + location + date match
    if (signal.company_entities && signal.county) {
      const companyMatch = await db.getSignalsByCompanyAndLocation(
        signal.company_entities,
        signal.county,
        30 // 30 days window
      );
      if (companyMatch.length > 0) {
        // Check if headline is similar
        const headlineMatch = companyMatch.find(s => {
          if (!s.headline || !signal.headline) return false;
          const similarity = this.calculateSimilarity(
            signal.headline.toLowerCase(),
            s.headline.toLowerCase()
          );
          return similarity > 0.7; // 70% similarity for company+location match
        });
        if (headlineMatch) {
          return headlineMatch;
        }
        // If no headline match, return most recent (could be same project, different event)
        // But be conservative - only if very recent (within 7 days)
        const recentMatch = companyMatch.find(s => {
          const signalDate = new Date(signal.ingested_at || signal.published_at);
          const existingDate = new Date(s.ingested_at || s.published_at);
          const daysDiff = Math.abs((signalDate - existingDate) / (1000 * 60 * 60 * 24));
          return daysDiff <= 7;
        });
        if (recentMatch) {
          return recentMatch;
        }
      }
    }

    return null;
  }

  /**
   * Calculate simple string similarity (Jaccard-like)
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score 0-1
   */
  calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;

    // Simple word-based similarity
    const words1 = new Set(str1.split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(str2.split(/\s+/).filter(w => w.length > 2));

    if (words1.size === 0 || words2.size === 0) return 0;

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Link related signals (same project, different sources)
   * @param {Object} signal - New signal
   * @param {Object} relatedSignal - Related signal from database
   * @param {Object} db - SignalsDB instance
   * @returns {Promise<void>}
   */
  async linkRelatedSignals(signal, relatedSignal, db) {
    // For now, just log the relationship
    // In Phase 3, we could add a signals_relationships table
    console.log(
      `🔗 [Deduplicator] Linking signals: ${signal.signal_id} ↔ ${relatedSignal.signal_id}`
    );
    console.log(`   Signal 1: ${signal.headline}`);
    console.log(`   Signal 2: ${relatedSignal.headline}`);

    // Could update candidate_project_id if both signals reference same project
    // For now, just log
  }
}

export default SignalDeduplicator;

