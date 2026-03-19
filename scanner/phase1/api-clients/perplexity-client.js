/**
 * Perplexity API client for classification fallback
 * API CALL: POST https://api.perplexity.ai/chat/completions
 */

import axios from 'axios';

const PERPLEXITY_API_KEY = process.env.REACT_APP_PRP || process.env.PRP || process.env.PERPLEXITY_API_KEY || process.env.PR_API;
const PERPLEXITY_URL = 'https://api.perplexity.ai/chat/completions';
const DEFAULT_MODEL = process.env.SCANNER_PERPLEXITY_MODEL || 'sonar-pro';

export class PerplexityClient {
  constructor() {
    this.apiKey = PERPLEXITY_API_KEY;
    this.model = DEFAULT_MODEL;
    this.enabled = !!PERPLEXITY_API_KEY;
    
    if (!this.enabled) {
      console.warn('⚠️ [Perplexity] API key not found - LLM classification will be disabled');
    }
  }

  /**
   * Classify a signal using Perplexity (fallback when regex fails)
   * @param {Object} signal - Signal object with headline, raw_text, source_type
   * @returns {Promise<Object>} Classification result
   */
  async classifySignal(signal) {
    if (!this.enabled) {
      console.warn('⚠️ [Perplexity] API key not configured - skipping LLM classification');
      return {
        lane: 'CONTEXT',
        event_type: null,
        confidence: 'LOW',
        reasoning: 'Perplexity API key not configured'
      };
    }

    console.log(`🧠 [Perplexity] Classifying signal: "${signal.headline?.substring(0, 50)}..."`);
    
    const prompt = `Classify this signal into COMMITMENT or CONSTRAINT:

Signal: ${signal.headline || 'N/A'}
Raw text: ${signal.raw_text?.substring(0, 500) || 'N/A'}
Source: ${signal.source_type || 'N/A'}

Return JSON only:
{
  "lane": "COMMITMENT" | "CONSTRAINT" | "CONTEXT",
  "event_type": "...",
  "confidence": "LOW" | "MED" | "HIGH",
  "reasoning": "brief explanation"
}`;

    try {
      const response = await axios.post(
        PERPLEXITY_URL,
        {
          model: this.model,
          messages: [{
            role: 'user',
            content: prompt
          }],
          max_tokens: parseInt(process.env.SCANNER_MAX_TOKENS || '500'),
          temperature: 0.1
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const content = response.data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('No content in Perplexity response');
      }

      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const classification = JSON.parse(jsonMatch[0]);
        console.log(`✅ [Perplexity] Classified as: ${classification.lane} (${classification.confidence})`);
        return classification;
      } else {
        throw new Error('No JSON found in Perplexity response');
      }
    } catch (error) {
      console.error(`❌ [Perplexity] Classification failed:`, error.message);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
      }
      // Return default classification on error
      return {
        lane: 'CONTEXT',
        event_type: null,
        confidence: 'LOW',
        reasoning: 'Perplexity classification failed'
      };
    }
  }
}

export default PerplexityClient;

