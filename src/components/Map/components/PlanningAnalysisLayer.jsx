import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

// LA bounds for reference
const LA_CENTER = [-118.2437, 34.0522];
const LA_BOUNDS = {
  sw: [-118.529, 33.704],
  ne: [-118.155, 34.337]
};

// Add helper function to create slightly varied coordinates
const addSpatialVariation = (coords) => {
  // Add random variation of up to ~1km
  const variation = 0.01;
  return [
    coords[0] + (Math.random() - 0.5) * variation,
    coords[1] + (Math.random() - 0.5) * variation
  ];
};

// Add utility functions at the top after LA_BOUNDS
const getNeighborhood = (lat, lng) => {
  // East LA proper boundaries (approximate)
  if (lng >= -118.17 && lng <= -118.15 && lat >= 34.01 && lat <= 34.04) {
    return 'East Los Angeles';
  }
  
  // Boyle Heights
  if (lng >= -118.22 && lng <= -118.17 && lat >= 34.02 && lat <= 34.06) {
    return 'Boyle Heights';
  }

  // Downtown LA
  if (lng >= -118.26 && lng <= -118.23 && lat >= 34.03 && lat <= 34.06) {
    return 'Downtown LA';
  }

  // South LA regions
  if (lng <= -118.24 && lat <= 34.00) {
    return 'South Los Angeles';
  }

  // Westside
  if (lng <= -118.38) {
    return 'West Los Angeles';
  }

  // Hollywood area
  if (lng >= -118.33 && lng <= -118.31 && lat >= 34.09 && lat <= 34.11) {
    return 'Hollywood';
  }

  // Northeast LA
  if (lng >= -118.22 && lng <= -118.17 && lat >= 34.08 && lat <= 34.11) {
    return 'Northeast LA';
  }

  // Silver Lake / Echo Park area
  if (lng >= -118.28 && lng <= -118.25 && lat >= 34.07 && lat <= 34.09) {
    return 'Silver Lake / Echo Park';
  }

  // Central LA (fallback for areas between major regions)
  if (lng >= -118.31 && lng <= -118.26 && lat >= 34.04 && lat <= 34.08) {
    return 'Central Los Angeles';
  }

  // If no specific match, determine general area
  if (lng >= -118.23) {
    return 'Eastside LA';
  } else if (lng <= -118.29) {
    return 'Westside LA';
  } else {
    return 'Central Los Angeles';
  }
};

const calculateProximityScore = (coordinates) => {
  // Calculate distance from city center (LA_CENTER)
  const dx = coordinates[0] - LA_CENTER[0];
  const dy = coordinates[1] - LA_CENTER[1];
  const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
  
  // Normalize to 0-100 score (closer to center = higher score)
  // Max distance possible in LA bounds is roughly 0.4 degrees
  const proximityScore = Math.round((1 - (distanceFromCenter / 0.4)) * 100);
  return Math.max(0, Math.min(100, proximityScore));
};

const getLocationContext = (coordinates) => {
  const neighborhood = getNeighborhood(coordinates[1], coordinates[0]);
  const proximityScore = calculateProximityScore(coordinates);
  return { neighborhood, proximityScore };
};

const getImpactDescription = (type, name) => {
  const impacts = {
    'adaptive-reuse': {
      'downtown': 'Historic building preservation and revitalization opportunity in the Downtown area',
      'arts': 'Cultural preservation and creative space development potential',
      'industrial': 'Industrial building conversion for mixed-use development',
      'default': 'Urban renewal opportunity with potential for housing and community spaces'
    },
    'development': {
      'downtown': 'Prime development opportunity in Downtown LA core',
      'residential': 'Potential for new housing development',
      'mixed': 'Mixed-use development opportunity',
      'default': 'Strategic development site with community benefit potential'
    }
  };

  const getCategory = (name = '') => {
    name = name.toLowerCase();
    if (name.includes('downtown')) return 'downtown';
    if (name.includes('art') || name.includes('creative')) return 'arts';
    if (name.includes('industrial') || name.includes('warehouse')) return 'industrial';
    if (name.includes('residential') || name.includes('housing')) return 'residential';
    if (name.includes('mixed')) return 'mixed';
    return 'default';
  };

  const category = getCategory(name);
  return impacts[type][category] || impacts[type]['default'];
};

const enrichLocationData = (properties, coordinates) => {
  const { neighborhood, proximityScore } = getLocationContext(coordinates);
  
  // Calculate weighted policy score based on source count and proximity
  const sourceCount = properties.source_count || 1;
  const sourceWeight = 0.7;
  const proximityWeight = 0.3;
  
  const sourceScore = Math.min(100, Math.round((sourceCount / 15) * 100));
  const policyScore = Math.round(
    (sourceScore * sourceWeight) + (proximityScore * proximityWeight)
  );

  // Calculate quality score with more generous scoring
  const descriptionScore = properties.description ? Math.min(100, properties.description.length / 3) : 0;
  const hasKPIs = extractKPIs(properties.description).length > 0 ? 40 : 0;
  const hasCommunityBenefits = extractCommunityBenefits(properties.description).length > 0 ? 30 : 0;
  const hasZoningDetails = extractZoningDetails(properties.description) ? 30 : 0;
  
  // Base score starts higher
  let qualityScore = Math.round(
    (descriptionScore * 0.4) + 
    (hasKPIs * 0.3) + 
    (hasCommunityBenefits * 0.2) + 
    (hasZoningDetails * 0.1)
  );

  // Boost score for downtown locations
  if (neighborhood === 'Central Los Angeles' || neighborhood.includes('Downtown')) {
    qualityScore = Math.min(100, qualityScore + 20);
  }

  // Ensure minimum score is higher for visibility
  qualityScore = Math.max(40, qualityScore);

  // Clean up and format the name
  const cleanName = (name) => {
    if (!name) return 'Development Site';
    // Remove technical prefixes/numbers and clean up formatting
    return name
      .replace(/^(Section|§)\s*\d+(\.\d+)*\s*/i, '')
      .replace(/^\([a-z]\)\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  return {
    ...properties,
    name: cleanName(properties.name),
    neighborhood,
    proximityScore,
    policyScore,
    sourceCount,
    quality_score: qualityScore
  };
};

const getPolicyDetails = (properties) => {
  // Extract document references and details
  const sourceDocuments = properties.source_documents || [];
  const policyTypes = new Set();
  const incentives = new Set();
  
  // Analyze document names to categorize policies
  sourceDocuments.forEach(doc => {
    const docLower = doc.toLowerCase();
    
    // Categorize policy types
    if (docLower.includes('adaptive-reuse')) {
      policyTypes.add('Adaptive Reuse Ordinance');
    }
    if (docLower.includes('zoning')) {
      policyTypes.add('Zoning Code');
    }
    if (docLower.includes('plan')) {
      policyTypes.add('General Plan');
    }
    
    // Identify incentives
    if (docLower.includes('incentive')) {
      if (docLower.includes('downtown')) {
        incentives.add('Downtown Incentive Area');
      }
      if (docLower.includes('residential')) {
        incentives.add('Residential Development');
      }
    }
  });

  return {
    policyTypes: Array.from(policyTypes),
    incentives: Array.from(incentives),
    sourceDocuments
  };
};

const extractDocumentInfo = (properties) => {
  const sourceDoc = properties.source_document || '';
  const description = properties.description || '';
  
  // Extract policy goals and impacts
  const goals = new Set();
  const impacts = new Set();
  
  // Look for goal numbers in the description
  const goalMatches = description.match(/Goal #?:?\s*(\d+(?:,\s*\d+)*)/i);
  if (goalMatches) {
    goalMatches[1].split(',').forEach(g => goals.add(g.trim()));
  }

  // Clean and validate description
  const cleanDescription = (desc) => {
    if (!desc) return null;
    
    // Remove various types of noise
    desc = desc.replace(/(\d+)\s*No\s*/g, '')
        .replace(/\$\d+(\.\d+)?/g, '')
        .replace(/\([^)]*\)/g, '')
        .replace(/Max FAR[^.]*/, '')
        .replace(/Type [IV]+/g, '')
        .replace(/Podium/g, '')
        .replace(/Base/g, '')
        .replace(/Methodology[^.]*/, '')
        .replace(/Analysis[^.]*/, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

    // Split into sentences
    const sentences = desc.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // Check each sentence for quality
    const qualitySentences = sentences.filter(sentence => {
      const words = sentence.trim().split(/\s+/);
      return words.length >= 5 && // At least 5 words
             words.length <= 30 && // Not too long
             !/^\d+$/.test(sentence) && // Not just numbers
             sentence.match(/[A-Za-z]{3,}/g)?.length >= 3; // At least 3 real words
    });

    if (qualitySentences.length === 0) return null;
    
    // Reconstruct with proper punctuation
    return qualitySentences.map(s => s.trim() + '.').join(' ');
  };

  const cleanedDescription = cleanDescription(description);
  
  // Extract categories and impacts with fallback categories
  const categoryMapping = {
    'revitalization': ['Community Revitalization', 'Urban Renewal'],
    'rehabilitation': ['Building Rehabilitation', 'Historic Preservation'],
    'housing': ['Housing Development', 'Residential'],
    'residential': ['Housing Development', 'Residential'],
    'greenhouse': ['Environmental Impact', 'Sustainability'],
    'emissions': ['Environmental Impact', 'Climate Action'],
    'transformation': ['Area Transformation', 'Urban Development'],
    'mixed': ['Mixed-Use Development'],
    'commercial': ['Commercial Development'],
    'industrial': ['Industrial Development'],
    'transit': ['Transit-Oriented Development'],
    'cultural': ['Cultural Preservation'],
    'economic': ['Economic Development'],
    'community': ['Community Development'],
    'downtown': ['Downtown Development'],
    'retail': ['Retail Development'],
    'office': ['Office Development'],
    'park': ['Open Space Development'],
    'public': ['Public Space'],
    'infrastructure': ['Infrastructure Development']
  };

  // Process description for categories
  Object.entries(categoryMapping).forEach(([keyword, categories]) => {
    if (description.toLowerCase().includes(keyword)) {
      categories.forEach(category => impacts.add(category));
    }
  });

  // Add default categories based on type if none found
  if (impacts.size === 0) {
    if (sourceDoc.toLowerCase().includes('adaptive-reuse')) {
      impacts.add('Building Rehabilitation');
      impacts.add('Urban Renewal');
    } else {
      impacts.add('Urban Development');
      impacts.add('Community Development');
    }
  }

  // Extract document type and context
  const docContext = {
    type: 'Other',
    year: 'N/A',
    agency: 'N/A'
  };

  // Extract document year if present
  const yearMatch = sourceDoc.match(/(19|20)\d{2}/);
  if (yearMatch) {
    docContext.year = yearMatch[0];
  }

  // Determine document type
  if (sourceDoc.toLowerCase().includes('ordinance')) {
    docContext.type = 'Ordinance';
  } else if (sourceDoc.toLowerCase().includes('plan')) {
    docContext.type = 'Plan';
  } else if (sourceDoc.toLowerCase().includes('policy')) {
    docContext.type = 'Policy';
  } else if (sourceDoc.toLowerCase().includes('report')) {
    docContext.type = 'Report';
  }

  // Extract agencies involved
  const agencies = new Set();
  const commonAgencies = [
    'Planning Department',
    'Housing Department',
    'Transportation Department',
    'Economic Development',
    'Community Development',
    'Building and Safety'
  ];

  commonAgencies.forEach(agency => {
    if (description.toLowerCase().includes(agency.toLowerCase())) {
      agencies.add(agency);
    }
  });

  // Extract any other agencies mentioned
  const agencyMatches = description.match(/(?:Lead|Responsible) Agencies?: ([^\.]+)/i);
  if (agencyMatches) {
    agencyMatches[1].split(',').forEach(agency => agencies.add(agency.trim()));
  }

  // If no agencies found, add a default based on type
  if (agencies.size === 0) {
    agencies.add('Planning Department');
  }

  // Determine if description needs enrichment
  const needsEnrichment = !cleanedDescription || cleanedDescription.length < 50;

  return {
    goals: Array.from(goals),
    impacts: Array.from(impacts),
    agencies: Array.from(agencies),
    sourceDoc,
    docContext,
    description: cleanedDescription,
    needsEnrichment
  };
};

// Add enrichment function
const enrichDescription = async (properties, type) => {
  const prompt = `
    Location: ${properties.name || 'Unknown location'} in ${properties.neighborhood}
    Type: ${type === 'adaptive-reuse' ? 'Adaptive Reuse Site' : 'Development Potential Site'}
    Original Description: ${properties.description || 'No description available'}
    Source Document: ${properties.source_document || 'Unknown source'}
    
    Please provide a clear, concise description (2-3 sentences) of this development site's potential impact on the neighborhood, focusing on:
    1. Current state/usage
    2. Development potential
    3. Community benefit
    
    Use formal, professional language suitable for urban planning context.
  `;

  try {
    // Note: This is a placeholder for actual OpenAI API call
    // Implementation would need API key and proper error handling
    return properties.description || 'Site identified for potential development.';
  } catch (error) {
    console.error('Error enriching description:', error);
    return properties.description || 'Site identified for potential development.';
  }
};

const get15MinCityImpact = (properties, neighborhood) => {
  const docInfo = extractDocumentInfo(properties);
  const impacts = new Set();
  
  // Add location-based impacts
  if (properties.proximityScore > 80) {
    impacts.add('High Transit Accessibility');
  }
  
  // Add document-based impacts
  docInfo.impacts.forEach(impact => impacts.add(impact));
  
  // Add neighborhood context
  switch (neighborhood) {
    case 'Downtown LA':
      impacts.add('Employment Center Access');
      break;
    case 'West Los Angeles':
      impacts.add('Job-Housing Balance');
      break;
    case 'East Los Angeles':
      impacts.add('Community Development');
      break;
    case 'South Los Angeles':
      impacts.add('Economic Opportunity');
      break;
  }
  
  return Array.from(impacts);
};

// Add more document source variations
const getReadableDocumentName = (docId) => {
  const docNameMap = {
    'adaptive-reuse-ordinance': 'Citywide Adaptive Reuse Ordinance',
    'technical-correction': 'Technical Correction - Adaptive Reuse Incentive Areas',
    'permitting-guidelines': 'Adaptive Reuse Projects Permitting Guidelines',
    'specific-plan': 'Adaptive Reuse Specific Plan (Chinatown, Lincoln Heights, Hollywood)',
    'downtown-incentive': 'Downtown LA Adaptive Reuse Incentive Areas',
    'rhna': 'Regional Housing Needs Assessment (RHNA)',
    'housing-element': 'Housing Element 2021-2029',
    'zoning-code': 'New Zoning Code',
    'framework-element': 'General Plan Framework Element',
    'community-plans': 'Community Plan Implementation Overlay',
    'transit-oriented': 'Transit Oriented Communities Guidelines',
    'density-bonus': 'Density Bonus Ordinance',
    'historic-preservation': 'Historic Preservation Overlay Zone',
    'downtown-community-plan': 'DTLA 2040 Community Plan',
    'hollywood-community-plan': 'Hollywood Community Plan',
    'boyle-heights-community-plan': 'Boyle Heights Community Plan',
    'warner-center-2035': 'Warner Center 2035 Plan',
    'cornfield-arroyo': 'Cornfield Arroyo Seco Specific Plan',
    'central-city': 'Central City Community Plan',
    'southeast-la': 'Southeast Los Angeles Community Plan'
  };

  // Try to match the document ID with known patterns
  for (const [key, value] of Object.entries(docNameMap)) {
    if (docId.toLowerCase().includes(key)) {
      return value;
    }
  }

  // If no match, return a more varied generic name based on the ID
  if (docId.toLowerCase().includes('plan')) return 'LA City Planning - Development Plan';
  if (docId.toLowerCase().includes('zone')) return 'LA City Planning - Zoning Guidelines';
  if (docId.toLowerCase().includes('policy')) return 'LA City Planning - Policy Document';
  if (docId.toLowerCase().includes('report')) return 'LA City Planning - Technical Report';
  
  return 'LA City Planning Document';
};

// Add a function to assess information quality
const assessInformationQuality = (data) => {
  let score = 0;
  const maxScore = 100;

  // Check description quality
  if (data.description) {
    // Length check
    if (data.description.length > 200) score += 20;
    else if (data.description.length > 100) score += 10;

    // Check for specific keywords indicating quality content
    const qualityIndicators = [
      'development', 'housing', 'community', 'transit',
      'mixed-use', 'residential', 'commercial', 'density',
      'affordable', 'sustainability', 'infrastructure'
    ];
    
    qualityIndicators.forEach(keyword => {
      if (data.description.toLowerCase().includes(keyword)) score += 5;
    });

    // Check for numbers and specifics
    if (data.description.match(/\d+/g)) score += 10;
    if (data.description.includes('square feet') || data.description.includes('sq ft')) score += 5;
  }

  // Check for additional data
  if (data.community_benefits?.length > 0) score += 15;
  if (data.source_document) score += 10;
  if (data.neighborhood) score += 10;

  return Math.min(score, maxScore);
};

// Update the getQualityBasedColor function to use the new pink color
const getQualityBasedColor = (score) => {
  // If score is a number (used in popup)
  if (typeof score === 'number') {
    return '#ff00d9'; // New fixed pink color for popup
  }
  
  // If score is a Mapbox expression (used in layer paint)
  return [
    'interpolate',
    ['linear'],
    ['coalesce', score, 50],
    40, 'rgba(255, 0, 217, 0.85)',   // Bright pink (minimum)
    60, 'rgba(255, 0, 217, 0.9)',    // Brighter pink
    80, 'rgba(255, 0, 217, 0.95)',   // Even brighter pink
    100, 'rgba(255, 0, 217, 1.0)'    // Brightest pink
  ];
};

// Add function to extract KPIs
const extractKPIs = (description) => {
  const kpis = [];
  if (!description) return kpis;

  const text = description.toLowerCase();
  
  // Extract dates
  const dateMatches = description.match(/(?:by|in|target|deadline|completion|date[:]?)\s*(20\d{2})/gi);
  if (dateMatches) {
    dateMatches.forEach(match => {
      const year = match.match(/20\d{2}/)[0];
      kpis.push({ 
        type: 'date',
        icon: '📅',
        label: 'Target Year',
        value: year
      });
    });
  }

  // Extract square footage
  const sqftMatches = description.match(/(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:square feet|sq\.?\s*ft\.?)/i);
  if (sqftMatches) {
    kpis.push({
      type: 'area',
      icon: '📐',
      label: 'Area',
      value: `${sqftMatches[1]} sq ft`
    });
  }

  // Extract units count
  const unitsMatch = description.match(/(\d+)\s*(?:units|housing units|residential units)/i);
  if (unitsMatch) {
    kpis.push({
      type: 'units',
      icon: '🏘️',
      label: 'Units',
      value: unitsMatch[1]
    });
  }

  // Extract investment amount
  const investmentMatch = description.match(/\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:million|m\b)/i);
  if (investmentMatch) {
    kpis.push({
      type: 'investment',
      icon: '💰',
      label: 'Investment',
      value: `$${investmentMatch[1]}M`
    });
  }

  return kpis;
};

// Update the cleanDescription function with stricter quality control
const cleanDescription = (desc) => {
  if (!desc) return null;
  
  // Remove various types of noise
  desc = desc.replace(/(\d+)\s*No\s*/g, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/Max FAR[^.]*/, '')
      .replace(/Type [IV]+/g, '')
      .replace(/Podium/g, '')
      .replace(/Base/g, '')
      .replace(/Methodology[^.]*/, '')
      .replace(/Analysis[^.]*/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

  // Split into sentences
  const sentences = desc.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // More strict sentence quality checks
  const qualitySentences = sentences.filter(sentence => {
    const words = sentence.trim().split(/\s+/);
    const hasCommonPlanningTerms = /\b(development|housing|community|mixed-use|residential|commercial|retail|transit|adaptive|reuse)\b/i.test(sentence);
    const hasNoiseWords = /\b(lorem|ipsum|todo|xxx|n\/a|tbd)\b/i.test(sentence);
    const hasGoodStructure = words.length >= 5 && words.length <= 30;
    const hasEnoughRealWords = sentence.match(/[A-Za-z]{3,}/g)?.length >= 4;
    
    return hasGoodStructure && 
           hasEnoughRealWords && 
           hasCommonPlanningTerms && 
           !hasNoiseWords;
  });

  if (qualitySentences.length === 0) return null;
  
  // Take at most 3 best sentences
  return qualitySentences.slice(0, 3).map(s => s.trim() + '.').join(' ');
};

// Add reference to current popup
let currentPopup = null;

// Update the escapeHtml function to be more thorough
const escapeHtml = (text) => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\f/g, ' ')
    .replace(/\v/g, ' ')
    .replace(/\0/g, '')
    .replace(/\u2028/g, ' ')
    .replace(/\u2029/g, ' ');
};

// Add a function to safely encode text for JavaScript
const encodeForJS = (text) => {
  return JSON.stringify(text || '').slice(1, -1);
};

const generatePopupHTML = (features, type) => {
  // Normalize and deduplicate features based on description only
  const uniqueFeatures = features.reduce((acc, feature) => {
    const data = enrichLocationData(feature.properties, feature.geometry.coordinates);
    
    // Get the description and normalize it
    let description = data.description || '';
    
    // Clean and format the description
    description = description
      .replace(/\s+/g, ' ')
      .trim();
    
    // Use normalized description as key
    if (!acc.has(description)) {
      acc.set(description, feature);
    }
    return acc;
  }, new Map());

  // Convert back to array and get initial features
  const deduplicatedFeatures = Array.from(uniqueFeatures.values());
  const initialFeatures = deduplicatedFeatures.slice(0, 4);
  const remainingCount = Math.max(0, deduplicatedFeatures.length - 4);
  
  // Get the first feature's data for the header
  const primaryFeature = initialFeatures[0];
  const primaryData = enrichLocationData(primaryFeature.properties, primaryFeature.geometry.coordinates);
  const color = getQualityBasedColor(assessInformationQuality(primaryData));

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 320px; max-width: 400px; background: rgba(0,0,0,0.9); color: white; border-radius: 8px; position: relative;">
      <!-- Close Button -->
      <div style="position: absolute; top: 8px; right: 8px; cursor: pointer; z-index: 2; background: rgba(0,0,0,0.5); border-radius: 50%; padding: 4px;" onclick="this.parentElement.parentElement.remove()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </div>

      <!-- Header -->
      <div style="background: ${color}; padding: 16px; margin: 0; border-radius: 8px 8px 0 0;">
        <div style="font-size: 24px; font-weight: 600;">
          ${primaryData.neighborhood || 'Unknown Location'} 
        </div>
        <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9; margin-top: 4px;">
          ${type === 'adaptive-reuse' ? 'Adaptive Reuse Opportunities' : 'Development Potential'} (${deduplicatedFeatures.length} sites)
        </div>
      </div>
      
      <!-- Content -->
      <div style="padding: 16px;">
        <!-- Site Analysis -->
        <div style="margin-bottom: 20px;">
          <div style="font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">📍</span> SITE ANALYSIS
          </div>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${initialFeatures.map((feature, index) => {
              const data = enrichLocationData(feature.properties, feature.geometry.coordinates);
              const description = data.description || '';
              
              // Get first two sentences or ~150 characters
              let shortDescription = '';
              const sentences = description.split(/[.!?]+\s+/);
              if (sentences.length > 0) {
                shortDescription = sentences[0];
                if (sentences.length > 1) {
                  shortDescription += '. ' + sentences[1];
                }
              }
              
              // Truncate to ~150 chars if needed
              if (shortDescription.length > 150) {
                shortDescription = shortDescription.substring(0, 147) + '...';
              }
              
              const documentName = getReadableDocumentName(data.source_document || '');
              const qualityScore = assessInformationQuality(data);
              
              return `
                <div>
                  <!-- Site Item Card -->
                  <div class="site-item" style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 4px;">
                    <!-- Score Badge -->
                    <div style="margin-bottom: 8px;">
                      <span style="background: #ff00d9; padding: 1.6px 6.4px; border-radius: 10px; font-size: 9.6px; display: inline-block;">
                        Score: ${qualityScore}
                      </span>
                    </div>

                    <div class="description-container" style="line-height: 1.6; font-size: 14px; margin-bottom: 8px;">
                      <span class="short-description">${escapeHtml(shortDescription)}</span>
                      ${description.length > shortDescription.length ? 
                        `<button class="expand-btn" style="color: #ff00d9; cursor: pointer; margin-left: 4px; background: none; border: none; padding: 0; font: inherit;" 
                         data-full-text="${encodeForJS(description)}"
                         onclick="(function(btn) { 
                           const container = btn.closest('.description-container');
                           container.innerHTML = btn.dataset.fullText;
                         })(this)">
                          Read more...
                        </button>` : 
                        ''}
                    </div>
                    
                    <div style="font-size: 12px; opacity: 0.7; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">
                      Source: ${documentName}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
            ${remainingCount > 0 ? `
              <div style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; cursor: pointer;"
                   onclick="showMoreSites()">
                <span style="font-size: 14px;">Show ${remainingCount} more sites</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Aggregated KPIs -->
        ${(() => {
          const allKPIs = new Set();
          deduplicatedFeatures.forEach(feature => {
            const kpis = extractKPIs(feature.properties.description);
            kpis.forEach(kpi => allKPIs.add(JSON.stringify(kpi)));
          });
          
          const uniqueKPIs = Array.from(allKPIs).map(k => JSON.parse(k));
          
          return uniqueKPIs.length > 0 ? `
            <div style="margin-bottom: 20px;">
              <div style="font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px;">📊</span> KEY METRICS
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px;">
                ${uniqueKPIs.map(kpi => `
                  <div style="background: rgba(255,255,255,0.1); padding: 8px; border-radius: 4px; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 16px;">${kpi.icon}</span>
                    <div>
                      <div style="font-size: 12px; opacity: 0.7;">${kpi.label}</div>
                      <div style="font-size: 14px; font-weight: 600;">${kpi.value}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : '';
        })()}

        <!-- Aggregated Community Benefits -->
        ${(() => {
          const allBenefits = new Set();
          deduplicatedFeatures.forEach(feature => {
            const benefits = extractCommunityBenefits(feature.properties.description);
            benefits.forEach(benefit => allBenefits.add(benefit));
          });
          
          return allBenefits.size > 0 ? `
            <div>
              <div style="font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px;">🌟</span> COMMUNITY BENEFITS
              </div>
              <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                ${Array.from(allBenefits).map(benefit => `
                  <div style="background: rgba(255,255,255,0.1); padding: 6px 12px; border-radius: 12px; font-size: 12px;">
                    ${benefit}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : '';
        })()}
      </div>
    </div>
  `;
};

// Add utility functions to extract information from descriptions
const extractPolicyInitiatives = (description) => {
  const initiatives = [];
  if (!description) return initiatives;
  
  const text = description.toLowerCase();
  
  // Extract policy names and programs
  if (text.includes('promise zone')) initiatives.push('Promise Zone Initiative');
  if (text.includes('transit oriented communities') || text.includes('toc')) initiatives.push('Transit Oriented Communities');
  if (text.includes('affordable housing')) initiatives.push('Affordable Housing Program');
  if (text.includes('climate')) initiatives.push('Climate Adaptation Program');
  if (text.includes('linkage fee') || text.includes('ahlf')) initiatives.push('Affordable Housing Linkage Fee');
  
  return initiatives;
};

const extractFundingSources = (description) => {
  const sources = [];
  if (!description) return sources;
  
  const text = description.toLowerCase();
  
  // Extract funding sources
  if (text.includes('general fund')) sources.push('General Fund');
  if (text.includes('leap')) sources.push('Local Early Action Planning (LEAP)');
  if (text.includes('linkage fee')) sources.push('Linkage Fee Revenue');
  if (text.includes('ahsc')) sources.push('Affordable Housing and Sustainable Communities');
  if (text.includes('ahlf')) sources.push('Affordable Housing Linkage Fee');
  
  return sources;
};

const extractCommunityBenefits = (description) => {
  const benefits = [];
  if (!description) return benefits;
  
  const text = description.toLowerCase();
  
  // Extract community benefits
  if (text.includes('affordable housing')) benefits.push('Affordable Housing');
  if (text.includes('grocery') || text.includes('food')) benefits.push('Food Access');
  if (text.includes('school') || text.includes('education')) benefits.push('Educational Facilities');
  if (text.includes('transit') || text.includes('transportation')) benefits.push('Transit Access');
  if (text.includes('park') || text.includes('open space')) benefits.push('Open Space');
  if (text.includes('retail') || text.includes('commercial')) benefits.push('Retail/Commercial Space');
  
  return benefits;
};

const extractZoningDetails = (description) => {
  if (!description) return null;
  
  const text = description.toLowerCase();
  let zoningDetails = [];
  
  // Extract zoning and regulation information
  if (text.includes('toc')) {
    zoningDetails.push('Transit Oriented Communities (TOC) incentives available');
  }
  if (text.includes('density')) {
    zoningDetails.push('Density bonus eligible');
  }
  if (text.includes('mixed-use')) {
    zoningDetails.push('Mixed-use development permitted');
  }
  if (text.includes('affordable')) {
    zoningDetails.push('Affordable housing incentives available');
  }
  
  return zoningDetails.length > 0 ? zoningDetails.join(' • ') : null;
};

// Add CSS styles for the popup
const popupStyles = `
  .mapboxgl-popup-content {
    background: rgba(0,0,0,0.85) !important;
    padding: 12px !important;
    border-radius: 8px !important;
  }
  
  .mapboxgl-popup-tip {
    border-top-color: rgba(0,0,0,0.85) !important;
    border-bottom-color: rgba(0,0,0,0.85) !important;
  }
  
  .custom-popup {
    transform: none !important;
  }
`;

// Add the styles to the document
const style = document.createElement('style');
style.textContent = popupStyles;
document.head.appendChild(style);

// Update the findNearbyMarkers function with deduplication
const findNearbyMarkers = (map, clickedFeature, sourceId, pixelRadius = 100) => {
  if (!map || !clickedFeature || !sourceId) {
    console.warn('Missing required parameters for findNearbyMarkers');
    return [];
  }

  const clickedPoint = clickedFeature.geometry.coordinates;
  const clickedPixel = map.project(clickedPoint);
  
  // Query all features from the source
  const features = map.querySourceFeatures(sourceId);
  
  // Create a Map to store unique features
  const uniqueFeatures = new Map();
  
  // First, add the clicked feature
  const clickedFeatureKey = JSON.stringify({
    coordinates: clickedFeature.geometry.coordinates,
    properties: clickedFeature.properties
  });
  uniqueFeatures.set(clickedFeatureKey, clickedFeature);
  
  // Find and deduplicate nearby features
  features.forEach(feature => {
    // Skip if geometry is missing
    if (!feature.geometry || !feature.geometry.coordinates) return;
    
    // Create a unique key for this feature
    const featureKey = JSON.stringify({
      coordinates: feature.geometry.coordinates,
      properties: feature.properties
    });
    
    // Skip if we already have this feature
    if (uniqueFeatures.has(featureKey)) return;
    
    // Skip if it's exactly the same location
    if (feature.geometry.coordinates[0] === clickedPoint[0] && 
        feature.geometry.coordinates[1] === clickedPoint[1]) {
      return;
    }
    
    // Convert feature coordinates to pixels
    const featurePixel = map.project(feature.geometry.coordinates);
    
    // Calculate pixel distance
    const dx = featurePixel.x - clickedPixel.x;
    const dy = featurePixel.y - clickedPixel.y;
    const pixelDistance = Math.sqrt(dx * dx + dy * dy);
    
    if (pixelDistance < pixelRadius) {
      uniqueFeatures.set(featureKey, feature);
    }
  });

  const uniqueFeatureArray = Array.from(uniqueFeatures.values());
  return uniqueFeatureArray;
};

// Update popup HTML generation to handle multiple cards
const generateMultiCardPopupHTML = (features, type) => {
  const enrichedFeatures = features.map(feature => ({
    ...feature,
    enrichedData: enrichLocationData(feature.properties, feature.geometry.coordinates)
  }));

  return `
    <div class="multi-card-popup" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 320px; max-width: 400px; background: rgba(0,0,0,0.9); color: white; border-radius: 8px; position: relative;">
      <!-- Navigation -->
      <div style="position: absolute; top: 8px; right: 8px; display: flex; gap: 8px; z-index: 2;">
        <div style="background: rgba(0,0,0,0.5); border-radius: 12px; padding: 4px 8px; font-size: 12px;">
          <span class="current-card">1</span>/<span class="total-cards">${enrichedFeatures.length}</span>
        </div>
        <div style="cursor: pointer; background: rgba(0,0,0,0.5); border-radius: 50%; padding: 4px;" onclick="this.parentElement.parentElement.remove()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </div>
      </div>

      <!-- Cards Container -->
      <div class="cards-container" style="position: relative;">
        ${enrichedFeatures.map((feature, index) => `
          <div class="popup-card" data-index="${index}" style="display: ${index === 0 ? 'block' : 'none'};">
            ${generatePopupHTML(feature.enrichedData, type)}
          </div>
        `).join('')}
      </div>

      <!-- Navigation Buttons -->
      <div style="position: absolute; top: 50%; transform: translateY(-50%); left: 0; right: 0; display: flex; justify-content: space-between; padding: 0 8px; pointer-events: none;">
        <button class="prev-btn" style="pointer-events: auto; background: rgba(0,0,0,0.5); border: none; color: white; padding: 8px; border-radius: 50%; cursor: pointer; display: ${enrichedFeatures.length > 1 ? 'block' : 'none'};" onclick="navigateCards(-1)">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <path d="M15 18l-6-6 6-6"></path>
          </svg>
        </button>
        <button class="next-btn" style="pointer-events: auto; background: rgba(0,0,0,0.5); border: none; color: white; padding: 8px; border-radius: 50%; cursor: pointer; display: ${enrichedFeatures.length > 1 ? 'block' : 'none'};" onclick="navigateCards(1)">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <path d="M9 18l6-6-6-6"></path>
          </svg>
        </button>
      </div>
    </div>

    <script>
      let currentCardIndex = 0;
      const totalCards = ${enrichedFeatures.length};
      
      function navigateCards(direction) {
        const cards = document.querySelectorAll('.popup-card');
        const currentCard = document.querySelector('.current-card');
        
        cards[currentCardIndex].style.display = 'none';
        currentCardIndex = (currentCardIndex + direction + totalCards) % totalCards;
        cards[currentCardIndex].style.display = 'block';
        currentCard.textContent = currentCardIndex + 1;
      }

      // Add keyboard navigation
      document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') navigateCards(-1);
        if (e.key === 'ArrowRight') navigateCards(1);
      });
    </script>
  `;
};

const PlanningAnalysisLayer = ({ 
  map, 
  showAdaptiveReuse,
  showDevelopmentPotential,
  onDataLoaded
}) => {
  const sourceRef = useRef(false);
  const dataRef = useRef({
    adaptiveReuse: null,
    development: null
  });

  // Effect to update layer visibility
  useEffect(() => {
    if (!map?.current || !sourceRef.current) return;

    // Update adaptive reuse layer visibility
    if (map.current.getLayer('adaptive-reuse-layer')) {
      map.current.setLayoutProperty(
        'adaptive-reuse-layer',
        'visibility',
        showAdaptiveReuse ? 'visible' : 'none'
      );
    }

    // Update development potential layer visibility
    if (map.current.getLayer('development-potential-layer')) {
      map.current.setLayoutProperty(
        'development-potential-layer',
        'visibility',
        showDevelopmentPotential ? 'visible' : 'none'
      );
    }
  }, [map, showAdaptiveReuse, showDevelopmentPotential]);

  // Effect to setup layers
  useEffect(() => {
    if (!map?.current) return;

    const setupLayers = async () => {
      try {
        // Only load data if we haven't already
        if (!dataRef.current.adaptiveReuse || !dataRef.current.development) {
          
          // Load adaptive reuse data from filtered file
          const adaptiveReuseResponse = await fetch('/processed_planning_docs/enriched/adaptive_reuse_filtered.geojson');
          dataRef.current.adaptiveReuse = await adaptiveReuseResponse.json();
          
          // Load development potential data from filtered file
          const developmentResponse = await fetch('/processed_planning_docs/enriched/development_potential_filtered.geojson');
          dataRef.current.development = await developmentResponse.json();
          
          // Fix coordinates if needed
          const fixCoordinates = (features) => {
            return features.map(feature => {
              if (feature.geometry && feature.geometry.coordinates) {
                const coords = feature.geometry.coordinates;
                // If coordinates appear to be swapped (lat is outside normal longitude range)
                if (Math.abs(coords[0]) < 90 && Math.abs(coords[1]) > 90) {
                  feature.geometry.coordinates = [coords[1], coords[0]];
                }
              }
              return feature;
            });
          };

          // Fix coordinates in both datasets
          dataRef.current.adaptiveReuse.features = fixCoordinates(dataRef.current.adaptiveReuse.features);
          dataRef.current.development.features = fixCoordinates(dataRef.current.development.features);

          // Get current map bounds
          const bounds = map.current.getBounds();

          // Add sources if they don't exist
          if (!map.current.getSource('adaptive-reuse-source')) {
            map.current.addSource('adaptive-reuse-source', {
              type: 'geojson',
              data: dataRef.current.adaptiveReuse
            });
          }

          if (!map.current.getSource('development-potential-source')) {
            map.current.addSource('development-potential-source', {
              type: 'geojson',
              data: dataRef.current.development
            });
          }

          // Add adaptive reuse layer if it doesn't exist
          if (!map.current.getLayer('adaptive-reuse-layer')) {
            
            // Enrich the source data with quality scores and IDs
            const enrichedFeatures = dataRef.current.adaptiveReuse.features.map((feature, index) => ({
              ...feature,
              id: `adaptive-reuse-${index}`,
              properties: enrichLocationData(feature.properties, feature.geometry.coordinates)
            }));
            
            // Update the source data
            map.current.getSource('adaptive-reuse-source').setData({
              type: 'FeatureCollection',
              features: enrichedFeatures
            });

            // Add layer without specifying beforeId to place it at the top
            map.current.addLayer({
              id: 'adaptive-reuse-layer',
              type: 'circle',
              source: 'adaptive-reuse-source',
              maxzoom: 22,
              minzoom: 0,
              paint: {
                'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  10, 2.5,
                  15, 5
                ],
                'circle-color': getQualityBasedColor(['get', 'quality_score']),
                'circle-opacity': [
                  'interpolate',
                  ['linear'],
                  ['get', 'quality_score'],
                  40, 0.85,
                  100, 1.0
                ],
                'circle-stroke-width': 0.5,
                'circle-stroke-color': 'rgba(255, 255, 255, 0.4)'
              }
            });

            // Add popup for adaptive reuse layer with improved nearby detection
            map.current.on('click', 'adaptive-reuse-layer', (e) => {
              if (!e.features.length) return;
              
              // Close existing popup if any
              if (currentPopup) currentPopup.remove();
              
              const clickedFeature = e.features[0];
              const nearbyFeatures = findNearbyMarkers(map.current, clickedFeature, 'adaptive-reuse-source', 100);
              const allFeatures = [clickedFeature, ...nearbyFeatures];
              
              currentPopup = new mapboxgl.Popup({
                className: 'custom-popup',
                maxWidth: '400px',
                closeButton: false,
                closeOnClick: false
              })
                .setLngLat(clickedFeature.geometry.coordinates)
                .setHTML(generatePopupHTML(allFeatures, 'adaptive-reuse'))
                .addTo(map.current);
            });
          }

          // Add development potential layer if it doesn't exist
          if (!map.current.getLayer('development-potential-layer')) {
            
            // Enrich the source data with quality scores and IDs
            const enrichedFeatures = dataRef.current.development.features.map((feature, index) => ({
              ...feature,
              id: `development-${index}`,
              properties: enrichLocationData(feature.properties, feature.geometry.coordinates)
            }));
            
            // Update the source data
            map.current.getSource('development-potential-source').setData({
              type: 'FeatureCollection',
              features: enrichedFeatures
            });

            // Add layer without specifying beforeId to place it at the top
            map.current.addLayer({
              id: 'development-potential-layer',
              type: 'circle',
              source: 'development-potential-source',
              maxzoom: 22,
              minzoom: 0,
              paint: {
                'circle-radius': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  10, 2,
                  15, 4
                ],
                'circle-color': getQualityBasedColor(['get', 'quality_score']),
                'circle-opacity': [
                  'interpolate',
                  ['linear'],
                  ['get', 'quality_score'],
                  40, 0.85,
                  100, 1.0
                ],
                'circle-stroke-width': 0.5,
                'circle-stroke-color': 'rgba(255, 255, 255, 0.4)'
              }
            });

            // Add popup for development potential layer with improved nearby detection
            map.current.on('click', 'development-potential-layer', (e) => {
              if (!e.features.length) return;
              
              // Close existing popup if any
              if (currentPopup) currentPopup.remove();
              
              const clickedFeature = e.features[0];
              const nearbyFeatures = findNearbyMarkers(map.current, clickedFeature, 'development-potential-source', 100);
              const allFeatures = [clickedFeature, ...nearbyFeatures];
              
              currentPopup = new mapboxgl.Popup({
                className: 'custom-popup',
                maxWidth: '400px',
                closeButton: false,
                closeOnClick: false
              })
                .setLngLat(clickedFeature.geometry.coordinates)
                .setHTML(generatePopupHTML(allFeatures, 'development'))
                .addTo(map.current);
            });
          }

          // After loading and processing data
          const allData = {
            adaptiveReuse: dataRef.current.adaptiveReuse.features,
            development: dataRef.current.development.features
          };
          
          // Notify parent when data is ready
          onDataLoaded?.(allData);

          sourceRef.current = true;
        }

        // Update layer visibility
        if (map.current.getLayer('adaptive-reuse-layer')) {
          map.current.setLayoutProperty(
            'adaptive-reuse-layer',
            'visibility',
            showAdaptiveReuse ? 'visible' : 'none'
          );
        }
        if (map.current.getLayer('development-potential-layer')) {
          map.current.setLayoutProperty(
            'development-potential-layer',
            'visibility',
            showDevelopmentPotential ? 'visible' : 'none'
          );
        }
      } catch (error) {
        console.error('Error setting up planning analysis layers:', error);
      }
    };

    setupLayers();

    // Cleanup function - only remove event listeners, not the layers
    return () => {
      if (map?.current) {
        map.current.off('click', 'adaptive-reuse-layer');
        map.current.off('click', 'development-potential-layer');
      }
    };
  }, [map]); // Only depend on map to prevent unnecessary re-runs

  // Add an effect to ensure layers stay on top when other layers are added
  useEffect(() => {
    if (!map?.current) return;
    
    const moveLayersToTop = () => {
      try {
        // Get all layers
        const layers = map.current.getStyle().layers;
        
        // Simply move our layers to the very top of the layer stack
        if (map.current.getLayer('development-potential-layer')) {
          map.current.moveLayer('development-potential-layer');  // No beforeId means move to top
        }
        if (map.current.getLayer('adaptive-reuse-layer')) {
          map.current.moveLayer('adaptive-reuse-layer');  // No beforeId means move to top
        }
      } catch (error) {
        console.warn('Error moving layers:', error);
      }
    };

    // Move layers to top whenever the map style loads
    map.current.on('style.load', moveLayersToTop);
    
    // Also move them to top now
    moveLayersToTop();

    // Add a listener for when new layers are added
    map.current.on('sourcedata', (e) => {
      if (e.isSourceLoaded) {
        moveLayersToTop();
      }
    });

    return () => {
      if (map?.current) {
        map.current.off('style.load', moveLayersToTop);
        map.current.off('sourcedata');
      }
    };
  }, [map]);

  return null;
};

export default PlanningAnalysisLayer; 