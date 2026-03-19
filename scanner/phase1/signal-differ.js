/**
 * Change detection: compare new signals with previous snapshot
 */

export class SignalDiffer {
  /**
   * Get comparison key for a signal
   * Supports: 'url', 'source_id', or custom function
   * @param {Object} signal - Signal object
   * @param {string|Function} comparisonKey - Comparison strategy
   * @returns {string|null} - Key for comparison
   */
  getComparisonKey(signal, comparisonKey = 'url') {
    if (typeof comparisonKey === 'function') {
      return comparisonKey(signal);
    }
    
    if (comparisonKey === 'url') {
      return signal.url || null;
    }
    
    if (comparisonKey === 'source_id') {
      return signal.source_id || signal.metadata?.queue_id || signal.metadata?.docket_number || null;
    }
    
    // Custom field
    return signal[comparisonKey] || signal.metadata?.[comparisonKey] || null;
  }

  /**
   * Compare new signals with previous snapshot
   * @param {Array} newSignals - New signals from current ingestion
   * @param {Object} previousSnapshot - Previous snapshot from database
   * @param {string|Function} comparisonKey - Comparison strategy: 'url', 'source_id', or custom function
   * @returns {Object} Diff result with new, changed, withdrawn signals
   */
  diff(newSignals, previousSnapshot, comparisonKey = 'url') {
    if (!previousSnapshot || !previousSnapshot.raw_payload) {
      // First run - all signals are new
      return {
        newItems: newSignals,
        changedItems: [],
        withdrawnItems: [],
        unchangedItems: []
      };
    }

    // Parse previous snapshot
    let previousSignals = [];
    try {
      const payload = JSON.parse(previousSnapshot.raw_payload);
      previousSignals = payload.results || payload || [];
    } catch (e) {
      console.warn('⚠️ [Differ] Could not parse previous snapshot, treating all as new');
      return {
        newItems: newSignals,
        changedItems: [],
        withdrawnItems: [],
        unchangedItems: []
      };
    }

    // Create maps for comparison using the specified key
    const previousByKey = new Map();
    previousSignals.forEach(s => {
      const key = this.getComparisonKey(s, comparisonKey);
      if (key) {
        previousByKey.set(key, s);
      }
    });

    const newByKey = new Map();
    newSignals.forEach(s => {
      const key = this.getComparisonKey(s, comparisonKey);
      if (key) {
        newByKey.set(key, s);
      }
    });

    // Find new items (in new but not in previous)
    const newItems = newSignals.filter(s => {
      const key = this.getComparisonKey(s, comparisonKey);
      if (!key) return true; // No key = treat as new
      return !previousByKey.has(key);
    });

    // Find changed items (in both but content changed)
    const changedItems = newSignals.filter(s => {
      const key = this.getComparisonKey(s, comparisonKey);
      if (!key) return false;
      const prev = previousByKey.get(key);
      if (!prev) return false;
      
      // Compare content/title/headline
      const prevContent = (prev.content || prev.title || prev.headline || '').toLowerCase();
      const newContent = (s.content || s.title || s.headline || '').toLowerCase();
      
      // Also compare status if available (for ERCOT queue status changes)
      if (prev.status && s.status && prev.status !== s.status) {
        return true;
      }
      if (prev.metadata?.status && s.metadata?.status && prev.metadata.status !== s.metadata.status) {
        return true;
      }
      
      return prevContent !== newContent;
    });

    // Find withdrawn items (in previous but not in new)
    const withdrawnItems = previousSignals.filter(s => {
      const key = this.getComparisonKey(s, comparisonKey);
      if (!key) return false;
      return !newByKey.has(key);
    });

    // Find unchanged items
    const unchangedItems = newSignals.filter(s => {
      const key = this.getComparisonKey(s, comparisonKey);
      if (!key) return true;
      const prev = previousByKey.get(key);
      if (!prev) return false;
      
      const prevContent = (prev.content || prev.title || prev.headline || '').toLowerCase();
      const newContent = (s.content || s.title || s.headline || '').toLowerCase();
      return prevContent === newContent;
    });

    return {
      newItems,
      changedItems,
      withdrawnItems,
      unchangedItems
    };
  }

  /**
   * Set change_type on signals based on diff result
   * @param {Array} signals - Signals to mark
   * @param {Object} diffResult - Diff result from diff()
   * @param {string|Function} comparisonKey - Same comparison key used in diff()
   */
  applyChangeTypes(signals, diffResult, comparisonKey = 'url') {
    const getKey = (s) => this.getComparisonKey(s, comparisonKey);
    
    const newKeys = new Set(diffResult.newItems.map(s => getKey(s)).filter(Boolean));
    const changedKeys = new Set(diffResult.changedItems.map(s => getKey(s)).filter(Boolean));
    const withdrawnKeys = new Set(diffResult.withdrawnItems.map(s => getKey(s)).filter(Boolean));

    return signals.map(signal => {
      // Only set change_type if classifier didn't already set one
      // Classifier's change_type (NEW, UPDATED, WITHDRAWN, DENIED, ESCALATED, STALLED) is authoritative
      if (!signal.change_type || signal.change_type === 'UNKNOWN' || signal.change_type === 'NEW_ITEM' || signal.change_type === 'CHANGED_ITEM') {
        const key = getKey(signal);
        if (withdrawnKeys.has(key)) {
          signal.change_type = 'WITHDRAWN';
        } else if (newKeys.has(key)) {
          signal.change_type = 'NEW'; // New format
        } else if (changedKeys.has(key)) {
          signal.change_type = 'UPDATED'; // New format
        } else {
          // Keep existing or set to UNKNOWN if we can't determine
          if (!signal.change_type || signal.change_type === 'NEW_ITEM') {
            signal.change_type = 'NEW'; // Map old format
          } else if (signal.change_type === 'CHANGED_ITEM') {
            signal.change_type = 'UPDATED'; // Map old format
          } else {
            signal.change_type = 'UNKNOWN';
          }
        }
      }
      return signal;
    });
  }
}

export default SignalDiffer;

