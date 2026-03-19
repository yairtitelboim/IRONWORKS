/**
 * Enhanced signal normalizer for Phase 2
 * Handles RawSignal format from adapters
 */

import crypto from 'crypto';

const DEFAULTS = {
  jurisdiction: 'Texas',
  state: 'TX',
  lane: 'CONTEXT',
  confidence: 'LOW',
  commitment_hint: 'NONE',
  status: 'NEW'
};

export class SignalNormalizerV2 {
  /**
   * Generate signal ID from source information
   */
  generateSignalId(sourceType, sourceId, url, publishedAt) {
    const input = `${sourceType}|${sourceId || ''}|${url || ''}|${publishedAt || ''}`;
    return crypto.createHash('sha256')
      .update(input)
      .digest('hex')
      .substring(0, 32);
  }

  /**
   * Generate dedupe key from signal content
   */
  generateDedupeKey(headline, url, sourceType) {
    // Use headline + source for deduplication
    const input = `${sourceType}|${headline || ''}|${url || ''}`;
    return crypto.createHash('sha256')
      .update(input.toLowerCase().trim())
      .digest('hex')
      .substring(0, 32);
  }

  /**
   * Normalize RawSignal to full signal schema
   * @param {Object} rawSignal - RawSignal from adapter
   * @returns {Object} Normalized signal with all required fields
   */
  normalizeRawSignal(rawSignal) {
    // Generate IDs
    const signalId = this.generateSignalId(
      rawSignal.source_type,
      rawSignal.source_id,
      rawSignal.url,
      rawSignal.published_at
    );

    const dedupeKey = this.generateDedupeKey(
      rawSignal.headline,
      rawSignal.url,
      rawSignal.source_type
    );

    // Build normalized signal
    const normalized = {
      signal_id: signalId,
      dedupe_key: dedupeKey,
      ingested_at: new Date().toISOString(),
      published_at: rawSignal.published_at || null,
      source_type: rawSignal.source_type,
      source_name: rawSignal.source_type, // Can be overridden by adapter
      source_id: rawSignal.source_id || null,
      url: rawSignal.url || null,
      headline: rawSignal.headline || 'Untitled',
      raw_text: rawSignal.body_text || rawSignal.headline || '',
      summary_3bullets: null, // Can be generated later
      tags: null, // Will be set by classifier
      jurisdiction: rawSignal.metadata?.jurisdiction || DEFAULTS.jurisdiction,
      state: rawSignal.metadata?.state || DEFAULTS.state,
      county: rawSignal.metadata?.county || null,
      city: rawSignal.metadata?.city || null,
      asset_type_guess: rawSignal.metadata?.asset_type || null,
      company_entities: rawSignal.metadata?.company || null,
      site_entities: rawSignal.metadata?.site_name || null,
      location_hint: rawSignal.metadata?.location_hint || null,
      lat: rawSignal.metadata?.lat || null,
      lon: rawSignal.metadata?.lon || null,
      lane: DEFAULTS.lane, // Will be set by classifier
      event_type: null, // Will be set by classifier
      commitment_hint: DEFAULTS.commitment_hint,
      confidence: DEFAULTS.confidence, // Will be set by classifier
      status: DEFAULTS.status,
      candidate_project_id: null,
      review_notes_1line: null,
      requires_followup: 0,
      change_type: null, // Will be set by differ
      previous_ref: null
    };

    // Store full metadata as JSON string if needed
    if (rawSignal.metadata) {
      // Extract known fields, keep rest in metadata
      // Already extracted above, but keep metadata for reference
    }

    return normalized;
  }
}

export default SignalNormalizerV2;

