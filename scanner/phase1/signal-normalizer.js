/**
 * Normalize raw signals to Scanner schema
 */

import crypto from 'crypto';
import { DEFAULTS } from '../config/scanner-config.js';
import { TEXAS_CITY_TO_COUNTY, TEXAS_REGIONAL_PATTERNS, getCountyFromCity, normalizeCityName } from './data/texas-cities-to-counties.js';
import { TEXAS_COUNTIES, isValidTexasCounty, normalizeCountyName } from './data/texas-counties-list.js';

export class SignalNormalizer {
  /**
   * Generate signal_id from source data
   */
  generateSignalId(sourceType, sourceId, url, publishedAt) {
    const hashInput = `${sourceType}|${sourceId || ''}|${url || ''}|${publishedAt || ''}`;
    return crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
  }

  /**
   * Generate dedupe_key for deduplication (URL-based, for exact duplicates)
   */
  generateDedupeKey(headline, url, sourceType) {
    // Normalize headline for dedupe
    const normalizedHeadline = headline
      ?.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100) || '';
    
    const hashInput = `${sourceType}|${normalizedHeadline}|${url || ''}`;
    return crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
  }

  /**
   * Generate situation_key for News signals based on anchors
   * situation_key = hash(who|asset|county|friction_type)
   * Used for situation-based change detection (not URL-based)
   */
  generateSituationKey(signal) {
    if (signal.source_type !== 'TAVILY') {
      return null; // Only for News signals
    }

    // Extract anchors
    const who = (signal.company_entities || '').toLowerCase().trim();
    const asset = (signal.asset_type_guess || '').toLowerCase().trim();
    const county = (signal.county || signal.city || '').toLowerCase().trim();
    
    // Extract friction type from tags
    let frictionType = '';
    if (signal.tags) {
      try {
        const tags = typeof signal.tags === 'string' ? JSON.parse(signal.tags) : signal.tags;
        const frictionTags = tags.filter(t => typeof t === 'string' && t.startsWith('friction:'));
        if (frictionTags.length > 0) {
          // Use first friction type, or combine if multiple
          frictionType = frictionTags.map(t => t.replace('friction:', '')).join('|').toLowerCase();
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Build situation key from anchors (some subset - at least 2 must be present)
    const parts = [];
    if (who) parts.push(`who:${who}`);
    if (asset) parts.push(`asset:${asset}`);
    if (county) parts.push(`where:${county}`);
    if (frictionType) parts.push(`friction:${frictionType}`);

    // Require at least 2 anchors to create a situation key
    if (parts.length < 2) {
      return null; // Not enough anchors to define a situation
    }

    // Sort parts for consistent hashing (same situation = same key regardless of order)
    parts.sort();
    const hashInput = parts.join('|');
    
    return crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
  }

  /**
   * Normalize Tavily result to signal schema
   */
  normalizeTavilyResult(tavilyResult, sourceType = 'TAVILY') {
    const headline = tavilyResult.title || 'Untitled';
    const url = tavilyResult.url || '';
    const rawText = tavilyResult.content || '';
    const publishedAt = tavilyResult.published_date || null;

    const signalId = this.generateSignalId(sourceType, null, url, publishedAt);
    const dedupeKey = this.generateDedupeKey(headline, url, sourceType);

    // Extract location hints (enhanced multi-source extraction)
    const locationData = this.extractLocationEnhanced(headline, rawText, url);
    const { state, county, city } = locationData;
    
    // Extract location hint for backward compatibility (simple pattern matching)
    const locationHint = this.extractLocationHint(headline + ' ' + rawText);

    // Extract asset type guess
    const assetTypeGuess = this.guessAssetType(headline + ' ' + rawText);

    // Generate summary (first 3 bullets from content)
    const summary3bullets = this.generateSummary(rawText);

    // Extract anchors (who, where, asset, friction type) - for News signals
    const anchors = sourceType === 'TAVILY' ? this.extractAnchors(headline, rawText) : null;

    // Store anchors in existing fields for recurrence detection
    // who -> company_entities, where -> county/city, asset -> asset_type_guess
    const companyEntities = anchors?.who || null;
    const assetType = anchors?.asset || assetTypeGuess;

    return {
      signal_id: signalId,
      ingested_at: new Date().toISOString(),
      published_at: publishedAt,
      source_type: sourceType,
      source_name: 'Tavily',
      source_id: null,
      url: url,
      headline: headline,
      raw_text: rawText,
      summary_3bullets: summary3bullets,
      tags: null, // Will be set by classifier (will include friction_type and recurrence)
      jurisdiction: DEFAULTS.jurisdiction,
      state: state || DEFAULTS.state,
      county: county || anchors?.where || null, // Use extracted where if county not found
      city: city || null,
      asset_type_guess: assetType,
      company_entities: companyEntities, // Store extracted company/developer
      site_entities: null,
      location_hint: locationHint,
      lat: null,
      lon: null,
      lane: DEFAULTS.lane,
      event_type: null, // Will be set by classifier
      commitment_hint: DEFAULTS.commitment_hint,
      confidence: DEFAULTS.confidence,
      dedupe_key: dedupeKey,
      status: DEFAULTS.status,
      candidate_project_id: null,
      review_notes_1line: null,
      requires_followup: 0,
      change_type: null, // Will be set by classifier (NEW, UPDATED, WITHDRAWN, DENIED, ESCALATED, STALLED)
      previous_ref: null
    };
  }

  /**
   * Enhanced location extraction from multiple sources
   * Priority: Text patterns > Addresses > URL > Regional patterns
   * Text extraction takes precedence as it's most specific
   */
  extractLocationEnhanced(headline, rawText, url) {
    const fullText = `${headline} ${rawText || ''}`;
    let county = null;
    let city = null;
    const state = 'TX'; // Default for Texas-focused scanner

    // Strategy 1: Extract from text patterns FIRST (most specific)
    // This includes county mentions, city mentions, etc.
    const textLocation = this.extractLocationFromText(fullText);
    if (textLocation) {
      county = textLocation.county || county;
      city = textLocation.city || city;
    }

    // Strategy 2: Extract from addresses in text
    const addressLocation = this.extractLocationFromAddress(fullText);
    if (addressLocation) {
      // Only use if we don't already have a location from text
      if (!county && !city) {
        county = addressLocation.county || county;
        city = addressLocation.city || city;
      } else if (!county && addressLocation.county) {
        // If we have city but no county, try to get county from address
        county = addressLocation.county;
      }
    }

    // Strategy 3: Extract from URL (domain, path, subdomain)
    // Only use if text extraction didn't find anything
    if (!county && !city) {
      const urlLocation = this.extractLocationFromUrl(url);
      if (urlLocation) {
        county = urlLocation.county || county;
        city = urlLocation.city || city;
      }
    }

    // Strategy 4: If we have city but no county, try city-to-county mapping
    if (city && !county) {
      const mappedCounty = getCountyFromCity(city);
      if (mappedCounty) {
        county = mappedCounty;
      }
    }

    // Strategy 5: Extract from regional patterns (last resort)
    if (!county && !city) {
      const regionalLocation = this.extractLocationFromRegion(fullText);
      if (regionalLocation) {
        // For regional patterns, use the primary county
        county = regionalLocation.county;
        city = regionalLocation.city;
      }
    }

    // Validation: Ensure extracted county is valid
    if (county) {
      const normalizedCounty = normalizeCountyName(county);
      if (!isValidTexasCounty(normalizedCounty)) {
        // Invalid county - clear it
        console.warn(`⚠️ [Location] Invalid county extracted: "${county}" (normalized: "${normalizedCounty}")`);
        county = null;
      } else {
        // Use normalized county name
        county = normalizedCounty;
      }
    }

    return { state, county, city };
  }

  /**
   * Extract location from URL patterns
   */
  extractLocationFromUrl(url) {
    if (!url) return null;

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      const pathname = urlObj.pathname.toLowerCase();

      // Extract from domain/subdomain
      const domainPatterns = {
        'fortworth': { city: 'Fort Worth', county: 'Tarrant' },
        'fort-worth': { city: 'Fort Worth', county: 'Tarrant' },
        'fort_worth': { city: 'Fort Worth', county: 'Tarrant' },
        'dallas': { city: 'Dallas', county: 'Dallas' },
        'houston': { city: 'Houston', county: 'Harris' },
        'austin': { city: 'Austin', county: 'Travis' },
        'san-antonio': { city: 'San Antonio', county: 'Bexar' },
        'san_antonio': { city: 'San Antonio', county: 'Bexar' },
        'sanantonio': { city: 'San Antonio', county: 'Bexar' },
        'el-paso': { city: 'El Paso', county: 'El Paso' },
        'elpaso': { city: 'El Paso', county: 'El Paso' },
        'san-marcos': { city: 'San Marcos', county: 'Hays' },
        'sanmarcos': { city: 'San Marcos', county: 'Hays' }
      };

      // Check domain/subdomain
      for (const [pattern, location] of Object.entries(domainPatterns)) {
        if (hostname.includes(pattern)) {
          return location;
        }
      }

      // Extract from path (e.g., /austin/, /dallas/, /fort-worth/)
      const pathMatch = pathname.match(/\/([a-z-]+)\//);
      if (pathMatch) {
        const pathSegment = pathMatch[1].replace(/-/g, ' ');
        for (const [pattern, location] of Object.entries(domainPatterns)) {
          if (pathSegment.includes(pattern.replace(/-/g, ' ').replace(/_/g, ' '))) {
            return location;
          }
        }
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Extract location from address patterns in text
   */
  extractLocationFromAddress(text) {
    if (!text) return null;

    // Pattern: "123 Main St, Austin, TX" or "123 Main St, Austin, Texas"
    const addressPattern = /\b(\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*,\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*,\s*TX\b/i;
    const addressMatch = text.match(addressPattern);
    if (addressMatch) {
      const city = addressMatch[2];
      const county = getCountyFromCity(city);
      if (county) {
        return { city, county };
      }
    }

    // Pattern: "near Austin" or "in Austin" or "at Austin"
    const nearPattern = /\b(near|in|at|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*,?\s*TX\b/i;
    const nearMatch = text.match(nearPattern);
    if (nearMatch) {
      const city = nearMatch[2];
      const county = getCountyFromCity(city);
      if (county) {
        return { city, county };
      }
    }

    // Pattern: "Austin area" or "Dallas region" - extract both city and county
    const areaPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(area|region|metro|metropolitan)\b/i;
    const areaMatch = text.match(areaPattern);
    if (areaMatch) {
      const city = areaMatch[1];
      const county = getCountyFromCity(city);
      if (county) {
        return { city, county }; // Return both city and county
      }
    }

    return null;
  }

  /**
   * Extract location from text patterns (county mentions, city mentions)
   */
  extractLocationFromText(text) {
    if (!text) return null;

    // Pattern: "Travis County" or "Dallas County" - highest priority
    const countyPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+County\b/i;
    const countyMatch = text.match(countyPattern);
    if (countyMatch) {
      const county = countyMatch[1];
      return { county };
    }

    // Pattern: City names in text (check against our database)
    // Look for known Texas cities in the text
    const cityNames = Object.keys(TEXAS_CITY_TO_COUNTY);
    for (const cityName of cityNames) {
      // Use word boundaries to avoid partial matches
      const cityPattern = new RegExp(`\\b${cityName.replace(/\s+/g, '\\s+')}\\b`, 'i');
      if (cityPattern.test(text)) {
        const county = TEXAS_CITY_TO_COUNTY[cityName];
        return { city: cityName, county };
      }
    }

    // Pattern: "Austin, TX" or "Dallas, Texas"
    const cityStatePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*,\s*TX\b/i;
    const cityStateMatch = text.match(cityStatePattern);
    if (cityStateMatch) {
      const city = cityStateMatch[1];
      const county = getCountyFromCity(city);
      if (county) {
        return { city, county };
      }
    }

    // Pattern: City name followed by common location words
    const cityPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(city|town|municipality)\b/i;
    const cityMatch = text.match(cityPattern);
    if (cityMatch) {
      const city = cityMatch[1];
      const county = getCountyFromCity(city);
      if (county) {
        return { city, county };
      }
    }

    return null;
  }

  /**
   * Extract location from regional patterns
   */
  extractLocationFromRegion(text) {
    if (!text) return null;

    const lowerText = text.toLowerCase();
    
    for (const [region, counties] of Object.entries(TEXAS_REGIONAL_PATTERNS)) {
      if (lowerText.includes(region)) {
        // Return the primary county (first in array)
        return { county: counties[0], city: null };
      }
    }

    return null;
  }

  /**
   * Extract location hint from text (legacy method - kept for compatibility)
   */
  extractLocationHint(text) {
    const locationPatterns = [
      /\b(near|in|at|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g,
      /\b([A-Z][a-z]+)\s+(County|county)\b/g,
      /\b([A-Z][a-z]+),\s*TX\b/g
    ];

    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  /**
   * Extract state, county, city from location hint
   */
  extractLocation(locationHint) {
    if (!locationHint) return { state: 'TX', county: null, city: null };

    const state = 'TX'; // Default for Texas-focused scanner
    let county = null;
    let city = null;

    // Try to extract county
    const countyMatch = locationHint.match(/([A-Z][a-z]+)\s+County/i);
    if (countyMatch) {
      county = countyMatch[1];
    }

    // Try to extract city (common Texas cities)
    const texasCities = ['Austin', 'Houston', 'Dallas', 'San Antonio', 'Fort Worth', 'El Paso'];
    for (const cityName of texasCities) {
      if (locationHint.includes(cityName)) {
        city = cityName;
        break;
      }
    }

    return { state, county, city };
  }

  /**
   * Guess asset type from text
   */
  guessAssetType(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('data center') || lowerText.includes('datacenter')) {
      return 'DATA_CENTER';
    }
    if (lowerText.includes('battery') || lowerText.includes('bess')) {
      return 'BESS';
    }
    if (lowerText.includes('substation')) {
      return 'SUBSTATION';
    }
    if (lowerText.includes('transmission') || lowerText.includes('power line')) {
      return 'TRANSMISSION';
    }
    if (lowerText.includes('solar')) {
      return 'SOLAR';
    }
    if (lowerText.includes('wind')) {
      return 'WIND';
    }
    if (lowerText.includes('power plant') || lowerText.includes('generation')) {
      return 'GAS_GEN';
    }
    if (lowerText.includes('water')) {
      return 'WATER';
    }
    if (lowerText.includes('pipeline')) {
      return 'PIPELINE';
    }

    return DEFAULTS.asset_type_guess;
  }

  /**
   * Generate 3-bullet summary from content
   */
  generateSummary(content) {
    if (!content) return '';
    
    // Split into sentences
    const sentences = content
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20 && s.length < 200);

    // Take first 3 sentences
    const bullets = sentences.slice(0, 3);
    return bullets.join('\n• ');
  }

  /**
   * Extract anchors from news article (who, where, asset, friction type)
   * For News signals - helps detect recurrence and pressure points
   */
  extractAnchors(headline, content) {
    const fullText = `${headline} ${content}`.toLowerCase();
    const anchors = {
      who: null,      // Developer/company name
      where: null,    // County/city (normalized)
      asset: null,    // Project name or asset type
      friction_type: null  // Type of friction (moratorium, lawsuit, zoning, etc.)
    };

    // Extract WHO (company/developer names)
    // Common patterns: "Company Name proposes", "Developer X", "by Company"
    const companyPatterns = [
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(proposes?|plans?|develops?|builds?|constructs?)/i,
      /\b(developed|proposed|planned)\s+by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(LLC|Inc|Corp|Corporation|Company)/i
    ];
    
    for (const pattern of companyPatterns) {
      const match = fullText.match(pattern);
      if (match) {
        anchors.who = match[1] || match[2];
        // Clean up common false positives
        if (!['The', 'A', 'This', 'That', 'Texas', 'Austin', 'Houston', 'Dallas'].includes(anchors.who)) {
          break;
        } else {
          anchors.who = null;
        }
      }
    }

    // Extract WHERE (county/city - already extracted, but normalize)
    const locationHint = this.extractLocationHint(fullText);
    const { county, city } = this.extractLocation(locationHint);
    anchors.where = county || city || null;

    // Extract ASSET (project name or asset type)
    // Look for quoted project names or specific asset mentions
    const projectNameMatch = fullText.match(/"([^"]+)"/) || fullText.match(/'([^']+)'/);
    if (projectNameMatch) {
      anchors.asset = projectNameMatch[1];
    } else {
      // Fall back to asset type
      anchors.asset = this.guessAssetType(fullText);
    }

    // Extract FRICTION TYPE (moratorium, lawsuit, zoning, opposition, etc.)
    const frictionPatterns = {
      moratorium: /\b(moratorium|ban|prohibition|halt|freeze)\b/i,
      lawsuit: /\b(lawsuit|suit|litigation|legal challenge|court|filed suit)\b/i,
      zoning: /\b(zoning|rezoning|zoning change|zoning board|zoning denial)\b/i,
      opposition: /\b(opposition|oppose|opposed|protest|resistance|pushback)\b/i,
      environmental: /\b(environmental|environment|epa|clean air|emissions|pollution)\b/i,
      permit_denial: /\b(permit denied|denied permit|permit rejection|permit appeal)\b/i
    };

    for (const [frictionType, pattern] of Object.entries(frictionPatterns)) {
      if (pattern.test(fullText)) {
        anchors.friction_type = frictionType;
        break;
      }
    }

    return anchors;
  }
}

export default SignalNormalizer;

