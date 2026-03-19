/**
 * Signal classifier using regex rules + Perplexity fallback
 */

import { CONSTRAINT_RULES, COMMITMENT_RULES, STATIC_CONTENT_RULES, CHANGE_TYPE_RULES } from '../config/scanner-config.js';
import PerplexityClient from './api-clients/perplexity-client.js';

export class SignalClassifier {
  constructor() {
    this.perplexityClient = new PerplexityClient();
    this.llmCallCount = 0;
    this.maxLLMCalls = parseInt(process.env.SCANNER_MAX_PERPLEXITY_CALLS || '10');
    this.cache = new Map(); // Cache LLM results by dedupe_key
  }

  /**
   * Classify a signal using regex rules first, then LLM if needed
   * @param {Object} signal - Signal with headline, raw_text, etc.
   * @returns {Promise<Object>} Classification result with lane, event_type, confidence, tags
   */
  async classify(signal) {
    const text = `${signal.headline || ''} ${signal.raw_text || ''}`.toLowerCase();
    const tags = [];
    let lane = 'CONTEXT';
    let event_type = null;
    let confidence = 'LOW';
    let change_type = null;
    let isStaticContent = false;
    let staticReason = null;

    // ERCOT-SPECIFIC: Queue entries are COMMITMENT by default
    // Being in the ERCOT queue IS a commitment signal
    if (signal.source_type === 'ERCOT_QUEUE') {
      lane = 'COMMITMENT';
      event_type = 'INTERCONNECTION_UPDATE';
      confidence = 'MED';
      change_type = 'NEW'; // New queue entry = NEW signal
      tags.push('ercot_queue');
      
      // Check for status changes in body_text
      const bodyText = signal.body_text || signal.raw_text || '';
      if (/\bwithdrawn\b|\bwithdrawal\b/i.test(bodyText)) {
        change_type = 'WITHDRAWN';
        event_type = 'WITHDRAWN';
        tags.push('withdrawn');
      } else if (/\bapproved\b|\bin service\b|\boperational\b/i.test(bodyText)) {
        change_type = 'UPDATED';
        event_type = 'APPROVED';
        confidence = 'HIGH';
        tags.push('approved');
      } else if (/\bactive\b|\bnew\b/i.test(bodyText)) {
        change_type = 'NEW';
        event_type = 'FILED';
        tags.push('active');
      }
      
      console.log(`⚡ [Classifier] ERCOT queue entry → COMMITMENT (${event_type}, ${change_type})`);
      return {
        lane: 'COMMITMENT',
        event_type: event_type,
        confidence: confidence,
        change_type: change_type,
        tags: tags
      };
    }

    // FIRST: Check for static content (demote to CONTEXT immediately)
    for (const [ruleName, rule] of Object.entries(STATIC_CONTENT_RULES)) {
      if (rule.regex.test(text)) {
        isStaticContent = true;
        staticReason = rule.reason;
        lane = 'CONTEXT';
        tags.push(`static:${ruleName}`);
        console.log(`📄 [Classifier] Static content detected: ${rule.reason} → CONTEXT`);
        // Return early - don't check for COMMITMENT/CONSTRAINT if it's static
        return {
          lane: 'CONTEXT',
          event_type: null,
          confidence: 'LOW',
          change_type: null,
          tags: tags,
          isStaticContent: true,
          staticReason: staticReason
        };
      }
    }

    // SECOND: Check for change_type (FIRST-CLASS CONCEPT)
    // If no clear change_type, demote to CONTEXT
    for (const [changeType, rule] of Object.entries(CHANGE_TYPE_RULES)) {
      if (rule.regex.test(text)) {
        change_type = changeType;
        tags.push(`change:${changeType.toLowerCase()}`);
        console.log(`🔄 [Classifier] Change type detected: ${changeType}`);
        break; // First match wins
      }
    }

    // If no change_type detected, demote to CONTEXT (not a core signal)
    if (!change_type) {
      console.log(`⚠️ [Classifier] No change_type detected → CONTEXT (not a core signal)`);
      return {
        lane: 'CONTEXT',
        event_type: null,
        confidence: 'LOW',
        change_type: null,
        tags: ['no_change_type'],
        isStaticContent: false,
        staticReason: 'No clear state change detected'
      };
    }

    // Try constraint rules first (higher priority)
    for (const [ruleName, rule] of Object.entries(CONSTRAINT_RULES)) {
      if (rule.regex.test(text)) {
        lane = 'CONSTRAINT';
        event_type = rule.event_type;
        confidence = rule.confidence;
        tags.push(rule.tag);
        
        // Map constraint events to change_type
        if (rule.event_type === 'ZONING_DENIAL' || rule.event_type === 'PERMIT_APPEAL') {
          change_type = 'DENIED';
        } else if (rule.event_type === 'LAWSUIT' || rule.event_type === 'ENV_CHALLENGE') {
          change_type = 'ESCALATED';
        } else if (rule.event_type === 'MORATORIUM') {
          change_type = 'DENIED'; // Moratorium = denial of new projects
        }
        
        console.log(`✅ [Classifier] Constraint rule matched: ${ruleName} (${confidence}) → change_type: ${change_type || 'not set'}`);
        break; // First match wins
      }
    }

    // If no constraint match, try commitment rules
    if (lane === 'CONTEXT') {
      for (const [ruleName, rule] of Object.entries(COMMITMENT_RULES)) {
        if (rule.regex.test(text)) {
          lane = 'COMMITMENT';
          event_type = rule.event_type;
          confidence = rule.confidence;
          tags.push(rule.tag);
          
          // Map commitment events to change_type
          if (rule.event_type === 'APPROVED' || rule.event_type === 'CONSTRUCTION') {
            change_type = change_type || 'NEW'; // New project approved/starting
          } else if (rule.event_type === 'FILED' || rule.event_type === 'LAND_SALE') {
            change_type = change_type || 'NEW'; // New filing/acquisition
          } else if (rule.event_type === 'INTERCONNECTION_UPDATE') {
            change_type = change_type || 'UPDATED'; // Status update
          }
          
          console.log(`✅ [Classifier] Commitment rule matched: ${ruleName} (${confidence}) → change_type: ${change_type || 'not set'}`);
          break;
        }
      }
    }

    // For News signals: Extract friction type from anchors and add to tags
    if (signal.source_type === 'TAVILY' && signal.raw_text) {
      const frictionTypes = this.extractFrictionType(signal.headline + ' ' + signal.raw_text);
      if (frictionTypes.length > 0) {
        frictionTypes.forEach(ft => tags.push(`friction:${ft}`));
      }
    }

    // If confidence is still LOW or no match, try Perplexity (if allowed)
    if (confidence === 'LOW' || lane === 'CONTEXT') {
      // Check if we should use LLM (confidence < MED)
      const shouldUseLLM = confidence === 'LOW' && this.llmCallCount < this.maxLLMCalls;
      
      if (shouldUseLLM) {
        // Check cache first
        const cacheKey = signal.dedupe_key || signal.url || signal.headline;
        if (this.cache.has(cacheKey)) {
          console.log(`💾 [Classifier] Using cached LLM result`);
          const cached = this.cache.get(cacheKey);
          return {
            ...cached,
            tags: tags.length > 0 ? tags : cached.tags || []
          };
        }

        // Call Perplexity
        try {
          this.llmCallCount++;
          console.log(`🧠 [Classifier] Using Perplexity fallback (${this.llmCallCount}/${this.maxLLMCalls})`);
          const llmResult = await this.perplexityClient.classifySignal(signal);
          
          // Update classification with LLM result
          if (llmResult.lane !== 'CONTEXT') {
            lane = llmResult.lane;
            event_type = llmResult.event_type;
            confidence = llmResult.confidence;
          }

          // Cache the result
          this.cache.set(cacheKey, { lane, event_type, confidence });
        } catch (error) {
          console.warn(`⚠️ [Classifier] LLM classification failed, using regex result`);
        }
      } else {
        console.log(`⏭️ [Classifier] Skipping LLM (confidence: ${confidence}, calls: ${this.llmCallCount}/${this.maxLLMCalls})`);
      }
    }

    return {
      lane,
      event_type,
      confidence,
      change_type: change_type || null,
      tags: tags.length > 0 ? tags : []
    };
  }

  getStats() {
    return {
      llmCalls: this.llmCallCount,
      maxLLMCalls: this.maxLLMCalls,
      cacheSize: this.cache.size
    };
  }

  resetStats() {
    this.llmCallCount = 0;
    this.cache.clear();
  }

  /**
   * Extract friction type from text (for News signals)
   * Returns array of friction types detected
   */
  extractFrictionType(text) {
    const lowerText = text.toLowerCase();
    const frictionTypes = [];

    const frictionPatterns = {
      moratorium: /\b(moratorium|ban|prohibition|halt|freeze)\b/i,
      lawsuit: /\b(lawsuit|suit|litigation|legal challenge|court|filed suit)\b/i,
      zoning: /\b(zoning|rezoning|zoning change|zoning board|zoning denial)\b/i,
      opposition: /\b(opposition|oppose|opposed|protest|resistance|pushback)\b/i,
      environmental: /\b(environmental|environment|epa|clean air|emissions|pollution)\b/i,
      permit_denial: /\b(permit denied|denied permit|permit rejection|permit appeal)\b/i
    };

    for (const [frictionType, pattern] of Object.entries(frictionPatterns)) {
      if (pattern.test(lowerText)) {
        frictionTypes.push(frictionType);
      }
    }

    return frictionTypes;
  }
}

export default SignalClassifier;

