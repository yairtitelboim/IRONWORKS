/**
 * Base adapter class for all source adapters
 * Provides common functionality: retry logic, error handling, fallback
 */

export class BaseAdapter {
  constructor(config) {
    this.sourceType = config.sourceType;
    this.config = config;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000; // ms
  }

  /**
   * Fetch raw signals from source
   * Must be implemented by each adapter
   * @returns {Promise<Array>} Array of RawSignal objects
   */
  async fetch() {
    throw new Error('fetch() must be implemented by subclass');
  }

  /**
   * Normalize source-specific format to RawSignal
   * Can be overridden for custom normalization
   * @param {*} rawData - Source-specific data format
   * @returns {Object} RawSignal object
   */
  normalize(rawData) {
    return rawData; // Default: assume already in RawSignal format
  }

  /**
   * Fetch with retry logic and exponential backoff
   * @returns {Promise<Array>} Array of RawSignal objects
   */
  async fetchWithRetry() {
    let lastError;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const signals = await this.fetch();
        if (attempt > 1) {
          console.log(`✅ [${this.sourceType}] Fetch succeeded on attempt ${attempt}`);
        }
        return signals;
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.warn(
            `⚠️ [${this.sourceType}] Fetch failed (attempt ${attempt}/${this.maxRetries}): ${error.message}`
          );
          console.warn(`   Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    console.error(`❌ [${this.sourceType}] Fetch failed after ${this.maxRetries} attempts`);
    throw lastError;
  }

  /**
   * Get last known good snapshot from database
   * Used as fallback if fetch fails
   * @param {Object} db - SignalsDB instance
   * @returns {Promise<Array>} Array of signals from last snapshot
   */
  async getLastKnownGoodSnapshot(db) {
    try {
      const lastSnapshot = await db.getLatestSnapshot(this.sourceType, null);
      if (lastSnapshot) {
        console.warn(
          `⚠️ [${this.sourceType}] Using last known good snapshot from ${lastSnapshot.captured_at}`
        );
        const payload = JSON.parse(lastSnapshot.raw_payload);
        return payload.results || payload || [];
      }
    } catch (error) {
      console.error(`❌ [${this.sourceType}] Failed to load last snapshot:`, error.message);
    }
    return [];
  }

  /**
   * Get last fetch timestamp (for change detection)
   * @param {Object} db - SignalsDB instance
   * @returns {Promise<Date|null>} Last fetch timestamp or null
   */
  async getLastFetchTime(db) {
    try {
      const snapshot = await db.getLatestSnapshot(this.sourceType, null);
      if (snapshot && snapshot.captured_at) {
        return new Date(snapshot.captured_at);
      }
    } catch (error) {
      console.warn(`⚠️ [${this.sourceType}] Could not get last fetch time:`, error.message);
    }
    return null;
  }
}

export default BaseAdapter;

