const OpenAI = require('openai');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Google Places API key
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// LA bounds
const LA_BOUNDS = {
  north: 34.3373061,
  south: 33.7036917,
  east: -118.1552891,
  west: -118.6681759
};

// Add after LA_BOUNDS
const COORDINATE_VARIATION_SCALE = 0.001; // Increased from 0.0001 for better visual separation

// Known locations cache
const KNOWN_LOCATIONS = {
  'downtown los angeles': { lat: 34.0522, lng: -118.2437 },
  'hollywood': { lat: 34.0928, lng: -118.3287 },
  'venice': { lat: 33.9850, lng: -118.4695 },
  'boyle heights': { lat: 34.0295, lng: -118.2087 },
  'watts': { lat: 33.9389, lng: -118.2389 },
  'south los angeles': { lat: 33.9891, lng: -118.2987 },
  'van nuys': { lat: 34.1899, lng: -118.4514 },
  'westlake': { lat: 34.0561, lng: -118.2765 },
  'skid row': { lat: 34.0443, lng: -118.2428 },
  'central city': { lat: 34.0407, lng: -118.2468 },
  'central city north': { lat: 34.0577, lng: -118.2352 },
  'harbor gateway': { lat: 33.8553, lng: -118.2987 },
  'wilmington': { lat: 33.7866, lng: -118.2987 },
  'san pedro': { lat: 33.7360, lng: -118.2922 },
  'mar vista': { lat: 34.0048, lng: -118.4289 },
  'palms': { lat: 34.0208, lng: -118.4168 },
  'baldwin hills': { lat: 34.0208, lng: -118.3590 },
  'el sereno': { lat: 34.0892, lng: -118.1789 },
  'north hollywood': { lat: 34.1870, lng: -118.3813 },
  'panorama city': { lat: 34.2244, lng: -118.4447 },
  'canoga park': { lat: 34.2011, lng: -118.5977 },
  'woodland hills': { lat: 34.1683, lng: -118.6089 },
  'encino': { lat: 34.1517, lng: -118.5214 },
  'sherman oaks': { lat: 34.1508, lng: -118.4490 },
  'reseda': { lat: 34.2011, lng: -118.5366 },
  'west hills': { lat: 34.2011, lng: -118.6415 },
  'mission hills': { lat: 34.2722, lng: -118.4684 },
  'leimert park': { lat: 34.0085, lng: -118.3315 },
  'downtown': { lat: 34.0522, lng: -118.2437 },
  'harbor': { lat: 33.7360, lng: -118.2922 },
  'jordan downs': { lat: 33.9754, lng: -118.2359 },
  'orange line': { lat: 34.1867, lng: -118.4561 },
  'wilshire': { lat: 34.0611, lng: -118.2742 },
  'southeast valley': { lat: 34.1722, lng: -118.3965 },
  'western avenue': { lat: 34.0476, lng: -118.3087 },
  'central ave': { lat: 33.9391, lng: -118.3087 }
};

// Add after KNOWN_LOCATIONS
const AREA_KEYWORDS = {
  neighborhoods: ['district', 'neighborhood', 'community', 'area', 'corridor', 'village', 'town', 'heights', 'hills', 'park'],
  development: ['development', 'project', 'site', 'property', 'parcel', 'lot', 'block', 'complex', 'center', 'plaza'],
  landmarks: ['station', 'terminal', 'airport', 'port', 'harbor', 'mall', 'market', 'campus', 'university', 'college', 'school', 'hospital', 'library', 'museum', 'theater', 'stadium', 'park', 'plaza']
};

const REUSE_KEYWORDS = [
  'historic', 'existing building', 'renovation', 'rehabilitation', 'restore', 'preserve', 'redevelop',
  'revitalize', 'retrofit', 'convert', 'adaptive reuse', 'repurpose', 'transform', 'upgrade',
  'modernize', 'heritage', 'landmark', 'cultural'
];

const DEVELOPMENT_KEYWORDS = [
  'new construction', 'development potential', 'vacant', 'empty lot', 'undeveloped', 'opportunity site',
  'build', 'construct', 'proposed', 'future', 'planned', 'zoning change', 'rezoning', 'density bonus',
  'mixed-use', 'residential', 'commercial', 'retail', 'office', 'housing'
];

// Add after KNOWN_LOCATIONS cache
const LOCATION_PATTERNS = {
  address: /\b\d+\s+(?:North|South|East|West|N|S|E|W|NW|SW|NE|SE|N\.|S\.|E\.|W\.|N\.W\.|S\.W\.|N\.E\.|S\.E\.)?\.?\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|Place|Pl|Court|Ct|Circle|Cir|Highway|Hwy|Parkway|Pkwy|Plaza|Plz)\b/gi,
  intersection: /\b(?:corner of |intersection of )?(?:[A-Za-z\s]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr)\.?\s+(?:and|&)\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr))\b/gi,
  areaPattern: new RegExp(`\\b[A-Za-z\\s]+(${AREA_KEYWORDS.neighborhoods.join('|')}|${AREA_KEYWORDS.development.join('|')}|${AREA_KEYWORDS.landmarks.join('|')})\\b`, 'gi'),
  projectPattern: /\b[A-Z][A-Za-z\s\-]+(Project|Development|Site|Complex|Center)\b/g
};

// Add program name patterns to filter out
const PROGRAM_PATTERNS = [
  /\b(?:Program|Initiative|Plan|Report|Strategy|Policy|Framework|Guidelines|Standards|Requirements)\b/i,
  /\b(?:Assessment|Analysis|Study|Survey|Review|Evaluation|Monitoring|Tracking)\b/i,
  /\b(?:Fund|Grant|Loan|Investment|Budget|Finance|Funding)\b/i,
  /\b(?:Training|Education|Outreach|Assistance|Support|Services|Resources)\b/i,
  /\b(?:Process|System|Network|Platform|Portal|Database|Registry|Index)\b/i,
  /\b(?:Committee|Council|Board|Panel|Task Force|Working Group)\b/i,
  /\b(?:Ordinance|Resolution|Amendment|Regulation|Code|Rule|Law)\b/i,
  /\b(?:Pilot|Test|Demo|Prototype|Trial|Experiment)\b/i
];

// Add more specific location indicators
const LOCATION_INDICATORS = [
  /\b(?:located|situated|based|found)\s+(?:in|at|on|near)\b/i,
  /\b(?:area|district|neighborhood|community|region)\s+of\b/i,
  /\b(?:north|south|east|west|central)\s+(?:of|in)\b/i,
  /\bin\s+(?:the|and\s+around)\s+(?:heart|center|middle)\s+of\b/i,
  /\b(?:corridor|boulevard|street|avenue|road|highway)\b/i,
  /\b(?:intersection|corner|junction|crossing)\s+of\b/i,
  /\b(?:adjacent|next|close|nearby|surrounding)\s+to\b/i,
  /\b(?:within|throughout|across|around)\s+(?:the|this|that)\b/i
];

// Rate limiting helpers
class DelayPool {
  constructor(minDelay = 1000) {
    this.minDelay = minDelay;
    this.lastCallTime = Date.now() - minDelay;
  }

  async waitForNext() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;
    if (timeSinceLastCall < this.minDelay) {
      await new Promise(resolve => setTimeout(resolve, this.minDelay - timeSinceLastCall));
    }
    this.lastCallTime = Date.now();
  }
}

async function rateLimitedCall(fn, initialDelay = 2000, maxRetries = 3) {
  let delay = initialDelay;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      return await fn();
    } catch (e) {
      if (e.message.includes('Rate limit')) {
        retries++;
        console.log(`Rate limit hit, attempt ${retries}/${maxRetries}, waiting ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
        continue;
      }
      throw e;
    }
  }
  throw new Error(`Failed after ${maxRetries} retries`);
}

// Create delay pools for different API operations
const extractionDelayPool = new DelayPool(3000);  // 3 seconds between extractions
const validationDelayPool = new DelayPool(2000);  // 2 seconds between validations

// Helper to deduplicate locations
function deduplicateLocations(locations) {
  const seen = new Set();
  return locations.filter(loc => {
    const key = `${loc.location}|${loc.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function chunkText(text, maxChunkSize = 3000) {
  const words = text.split(/\s+/);
  const chunks = [];
  let currentChunk = [];
  let currentSize = 0;

  for (const word of words) {
    if (currentSize + word.length > maxChunkSize) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [word];
      currentSize = word.length;
    } else {
      currentChunk.push(word);
      currentSize += word.length + 1; // +1 for space
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks;
}

async function analyzeWithFirecrawl(text) {
  try {
    // Split text into smaller chunks if too large
    const MAX_CHUNK_SIZE = 10000;
    const chunks = text.length > MAX_CHUNK_SIZE ? chunkText(text, MAX_CHUNK_SIZE) : [text];
    const allLocations = [];

    for (const chunk of chunks) {
      try {
        const response = await fetch('https://api.firecrawl.com/v1/analyze', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.FIRECRAWL_KEY || 'fc-21ea30264b5e400188254217c1774aad'}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: chunk,
            analysis_type: 'location_extraction',
            options: {
              region: 'los_angeles',
              include_context: true
            }
          })
        });

        if (!response.ok) {
          console.error(`Firecrawl API error: ${response.status} - ${await response.text()}`);
          continue;
        }

        const data = await response.json();
        if (data.locations) {
          allLocations.push(...data.locations);
        }
      } catch (e) {
        console.error('Error processing chunk with Firecrawl:', e.message);
      }
      
      // Add delay between chunks
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return allLocations;
  } catch (e) {
    console.error('Firecrawl API error:', e.message);
    return [];
  }
}

function determineLocationType(context) {
  // Convert to lowercase for case-insensitive matching
  const lowerContext = context.toLowerCase();
  
  // Check for reuse keywords
  const hasReuseContext = REUSE_KEYWORDS.some(keyword => 
    lowerContext.includes(keyword.toLowerCase())
  );
  
  if (hasReuseContext) {
    return 'adaptive_reuse';
  }
  
  // Check for development keywords
  const hasDevelopmentContext = DEVELOPMENT_KEYWORDS.some(keyword => 
    lowerContext.includes(keyword.toLowerCase())
  );
  
  return hasDevelopmentContext ? 'development_potential' : 'development_potential';
}

function findPatternMatches(text) {
  const matches = [];
  
  // Check for known locations with context
  for (const [location, coords] of Object.entries(KNOWN_LOCATIONS)) {
    const locationRegex = new RegExp(`\\b${location}\\b`, 'gi');
    let match;
    while ((match = locationRegex.exec(text)) !== null) {
      const context = text.substring(Math.max(0, match.index - 200), 
                                   Math.min(text.length, match.index + location.length + 200));
      matches.push({
        location,
        coordinates: coords,
        type: determineLocationType(context),
        description: context.trim()
      });
    }
  }

  // Check for address patterns
  for (const [patternType, pattern] of Object.entries(LOCATION_PATTERNS)) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const location = match[0];
      const context = text.substring(Math.max(0, match.index - 200),
                                   Math.min(text.length, match.index + match[0].length + 200));
      
      // Skip if this exact location was already found
      if (!matches.some(m => m.location.toLowerCase() === location.toLowerCase())) {
        matches.push({
          location,
          type: determineLocationType(context),
          description: context.trim(),
          needsValidation: true
        });
      }
    }
  }

  // Look for potential project names or developments
  const projectMatches = text.match(/\b[A-Z][A-Za-z\s\-]+(?:Project|Development|Plan|Initiative|Program)\b/g) || [];
  for (const project of projectMatches) {
    const index = text.indexOf(project);
    const context = text.substring(Math.max(0, index - 200),
                                 Math.min(text.length, index + project.length + 200));
    
    // Skip if this exact project was already found
    if (!matches.some(m => m.location === project)) {
      matches.push({
        location: project,
        type: determineLocationType(context),
        description: context.trim(),
        needsValidation: true
      });
    }
  }

  // Look for locations near specific keywords
  const locationIndicators = [
    'located at', 'located in', 'located on',
    'situated at', 'situated in', 'situated on',
    'based in', 'found in', 'area of',
    'vicinity of', 'region of', 'zone of',
    'district of', 'part of', 'section of'
  ];

  for (const indicator of locationIndicators) {
    const indicatorRegex = new RegExp(`${indicator}\\s+([^,.;!?]+)`, 'gi');
    let match;
    while ((match = indicatorRegex.exec(text)) !== null) {
      const location = match[1].trim();
      const context = text.substring(Math.max(0, match.index - 200),
                                   Math.min(text.length, match.index + match[0].length + 200));
      
      // Skip if this exact location was already found
      if (!matches.some(m => m.location === location)) {
        matches.push({
          location,
          type: determineLocationType(context),
          description: context.trim(),
          needsValidation: true
        });
      }
    }
  }

  return matches;
}

// Add after KNOWN_LOCATIONS cache
const PROCESSING_TIMEOUT = 30000; // 30 seconds timeout

// Add timeout wrapper
async function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Operation timed out')), ms);
  });
  return Promise.race([promise, timeout]);
}

// Helper function to remove duplicate locations
function removeDuplicateLocations(locations) {
  const seen = new Set();
  return locations.filter(loc => {
    const key = `${loc.location.toLowerCase()}-${loc.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Add after removeDuplicateLocations function
function prioritizeLocations(locations) {
  // First, separate known locations
  const knownLocations = [];
  const unknownLocations = [];
  
  for (const loc of locations) {
    const locationKey = loc.location.toLowerCase().trim();
    if (KNOWN_LOCATIONS[locationKey]) {
      knownLocations.push(loc);
    } else {
      unknownLocations.push(loc);
    }
  }

  // Score and sort unknown locations
  const scoredLocations = unknownLocations.map(loc => {
    let score = 0;
    
    // Prefer locations with address patterns
    if (LOCATION_PATTERNS.address.test(loc.location)) score += 5;
    
    // Prefer locations with intersection patterns
    if (LOCATION_PATTERNS.intersection.test(loc.location)) score += 4;
    
    // Prefer locations with area keywords
    if (LOCATION_PATTERNS.areaPattern.test(loc.location)) score += 3;
    
    // Prefer locations with context indicators
    if (LOCATION_INDICATORS.some(pattern => pattern.test(loc.description || ''))) score += 2;
    
    // Penalize likely program names
    if (PROGRAM_PATTERNS.some(pattern => pattern.test(loc.location))) score -= 3;
    
    return { ...loc, score };
  });

  // Sort by score descending
  scoredLocations.sort((a, b) => b.score - a.score);

  // Take top 100 unknown locations
  const topUnknownLocations = scoredLocations.slice(0, 100);

  // Combine and return
  return [...knownLocations, ...topUnknownLocations];
}

// Add geocoding cache
const GEOCODING_CACHE = new Map();

// Add new helper to track location density
const LocationDensityTracker = {
  grid: new Map(),
  cellSize: 0.001, // About 100m grid cells
  
  getCell(lng, lat) {
    const x = Math.floor(lng / this.cellSize);
    const y = Math.floor(lat / this.cellSize);
    return `${x},${y}`;
  },
  
  addLocation(lng, lat) {
    const cell = this.getCell(lng, lat);
    const count = (this.grid.get(cell) || 0) + 1;
    this.grid.set(cell, count);
    return count;
  },
  
  getVariation(lng, lat, baseVariation = COORDINATE_VARIATION_SCALE) {
    const count = this.grid.get(this.getCell(lng, lat)) || 0;
    // Increase variation based on density
    const scaleFactor = Math.min(1 + (count * 0.2), 3); // Max 3x base variation
    return baseVariation * scaleFactor * (Math.random() - 0.5);
  },
  
  reset() {
    this.grid.clear();
  }
};

// Update validateAndEnhanceLocation function
async function validateAndEnhanceLocation(locationObj) {
  const location = locationObj.location;
  const context = locationObj.description || '';

  // Skip validation for empty, very short, or generic locations
  if (!location || location.length < 3 || isGenericLocation(location)) {
    console.log(`Skipping generic or short location: ${location}`);
    return null;
  }

  // Check if it's likely a program name rather than a location
  const isProgramName = PROGRAM_PATTERNS.some(pattern => pattern.test(location));
  if (isProgramName && !LOCATION_INDICATORS.some(pattern => pattern.test(context))) {
    console.log(`Skipping program name: ${location}`);
    return null;
  }

  // Check known locations cache first
  const locationKey = location.toLowerCase().trim();
  if (KNOWN_LOCATIONS[locationKey]) {
    const { lat, lng } = KNOWN_LOCATIONS[locationKey];
    const density = LocationDensityTracker.addLocation(lng, lat);
    const variation = LocationDensityTracker.getVariation(lng, lat);
    
    return {
      ...locationObj,
      exists: true,
      coordinates: [lng + variation, lat + variation],
      type: determineLocationType(context),
      description: `${location} - ${context.slice(0, 100)}...`,
      overlap_count: density
    };
  }

  // Try Google Places API first
  const geocodingResult = await geocodeLocation(location);
  if (geocodingResult) {
    const [lng, lat] = geocodingResult.coordinates;
    const density = LocationDensityTracker.addLocation(lng, lat);
    const variation = LocationDensityTracker.getVariation(lng, lat);
    
    return {
      ...locationObj,
      ...geocodingResult,
      coordinates: [lng + variation, lat + variation],
      type: determineLocationType(context),
      description: `${location} - ${context.slice(0, 100)}...`,
      overlap_count: density
    };
  }

  // If Google Places fails, try OpenAI for validation
  try {
    const prompt = `Is "${location}" a real location in Los Angeles? If yes, provide its coordinates in [longitude, latitude] format and a brief description. If no or uncertain, say "no". Context: ${context}`;
    
    const completion = await rateLimitedCall(
      async () => {
        const response = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0,
          max_tokens: 150
        });
        return response.choices[0].message.content;
      },
      6000 // Increase delay to 6 seconds
    );

    if (completion.toLowerCase().includes('no')) {
      return null;
    }

    // Extract coordinates from response
    const coordMatch = completion.match(/\[([-\d.]+),\s*([-\d.]+)\]/);
    if (!coordMatch) {
      return null;
    }

    const [lng, lat] = coordMatch.slice(1).map(Number);
    
    // Validate coordinates are within LA bounds
    if (!isWithinLABounds(lng, lat)) {
      return null;
    }

    // Add slight variation to prevent point stacking
    const variation = 0.0001 * (Math.random() - 0.5);
    return {
      ...locationObj,
      exists: true,
      coordinates: [lng + variation, lat + variation],
      type: determineLocationType(context),
      description: completion
    };

  } catch (error) {
    console.error(`Error validating location ${location}:`, error.message);
    return null;
  }
}

// Helper function to check if location is too generic
function isGenericLocation(location) {
  const genericPatterns = [
    /^(?:city|county|state|area|region|district)$/i,
    /^(?:the|this|that|our|your)\s+(?:city|area|region|community)$/i,
    /^(?:los angeles|la|california)$/i,
    /^(?:city of los angeles|los angeles county)$/i
  ];
  
  return genericPatterns.some(pattern => pattern.test(location.trim()));
}

// Helper function to check if coordinates are within LA bounds
function isWithinLABounds(lng, lat, buffer = 0.05) {
  return lat >= LA_BOUNDS.south - buffer && lat <= LA_BOUNDS.north + buffer &&
         lng >= LA_BOUNDS.west - buffer && lng <= LA_BOUNDS.east + buffer;
}

// Helper function to split text into chunks
function splitTextIntoChunks(text, chunkSize = 3000) {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    // Find the last period or newline before chunkSize
    let end = start + chunkSize;
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastNewline = text.lastIndexOf('\n', end);
      end = Math.max(lastPeriod, lastNewline);
      if (end <= start) {
        end = start + chunkSize;
      }
    } else {
      end = text.length;
    }
    
    chunks.push(text.slice(start, end).trim());
    start = end + 1;
  }
  
  return chunks;
}

// Increase delays for rate limiting
const OPENAI_DELAY = 6000; // 6 seconds between OpenAI calls
const GOOGLE_DELAY = 1000; // 1 second between Google API calls
const BATCH_SIZE = 5; // Process 5 locations at a time

// Update validateLocationsBatch to use smaller batches and longer delays
async function validateLocationsBatch(locations, startTime, batchSize = BATCH_SIZE) {
  const validatedLocations = [];
  
  // Process known locations first
  const knownLocations = locations.filter(loc => 
    KNOWN_LOCATIONS[loc.location.toLowerCase().trim()]
  );
  
  console.log(`Processing ${knownLocations.length} known locations...`);
  for (const loc of knownLocations) {
    const locationKey = loc.location.toLowerCase().trim();
    const coords = KNOWN_LOCATIONS[locationKey];
    console.log(`Found ${loc.location} in known locations cache`);
    
    // Add slight variation to prevent point stacking
    const variation = 0.0001 * (Math.random() - 0.5);
    validatedLocations.push({
      ...loc,
      exists: true,
      coordinates: [coords.lng + variation, coords.lat + variation]
    });
  }

  // Process remaining locations in smaller batches
  const unknownLocations = locations.filter(loc => 
    !KNOWN_LOCATIONS[loc.location.toLowerCase().trim()]
  );
  
  if (unknownLocations.length > 0) {
    console.log(`Processing ${unknownLocations.length} unknown locations in batches...`);
    
    const batches = [];
    for (let i = 0; i < unknownLocations.length; i += batchSize) {
      batches.push(unknownLocations.slice(i, i + batchSize));
    }

    for (let i = 0; i < batches.length; i++) {
      if (Date.now() - startTime > PROCESSING_TIMEOUT - 5000) {
        console.log('Approaching timeout, returning current results');
        break;
      }
      
      console.log(`Processing batch ${i + 1}/${batches.length}`);
      const batch = batches[i];
      
      try {
        const batchPromises = batch.map(loc => withTimeout(
          validateAndEnhanceLocation(loc),
          5000 // 5 second timeout per location
        ));
        
        const results = await Promise.allSettled(batchPromises);
        const validResults = results
          .filter(r => r.status === 'fulfilled' && r.value)
          .map(r => r.value);
        
        validatedLocations.push(...validResults);
        
        // Add longer delay between batches
        if (i < batches.length - 1 && Date.now() - startTime <= PROCESSING_TIMEOUT - 7000) {
          await new Promise(resolve => setTimeout(resolve, OPENAI_DELAY));
        }
      } catch (error) {
        console.error(`Error processing batch ${i + 1}:`, error.message);
        continue;
      }
    }
  }

  return validatedLocations;
}

// Update processPlanningDocument with improved batch processing
async function processPlanningDocument(document) {
  const startTime = Date.now();
  const documentId = document.filename || document.documentId;
  console.log(`\nProcessing document: ${documentId}`);
  
  // Reset location density tracker for each document
  LocationDensityTracker.reset();
  
  let fullText = '';
  if (typeof document.content === 'string') {
    fullText = document.content;
  } else if (document.content) {
    fullText = document.content.summary + "\n";
    if (document.content.sections) {
      fullText += document.content.sections.map(section => 
        `${section.heading}\n${section.text}`
      ).join("\n\n");
    }
  }

  console.log(`Document text length: ${fullText.length} characters`);

  try {
    // Extract all locations first
    console.log('Phase 1: Extracting all potential locations...');
    const chunks = splitTextIntoChunks(fullText, 3000);
    const allLocations = [];
    
    for (let i = 0; i < chunks.length; i++) {
      console.log(`Processing text chunk ${i + 1}/${chunks.length}`);
      const locations = findPatternMatches(chunks[i]);
      allLocations.push(...locations);
      
      // Add small delay between chunks
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const uniqueLocations = removeDuplicateLocations(allLocations);
    const prioritizedLocations = prioritizeLocations(uniqueLocations);
    
    console.log(`\nFound ${allLocations.length} raw locations`);
    console.log(`Reduced to ${uniqueLocations.length} unique locations`);
    console.log(`Prioritized to ${prioritizedLocations.length} locations for processing`);

    // Process in multiple 30-second chunks
    console.log('\nPhase 2: Validating locations in 30-second chunks...');
    const validatedLocations = [];
    const chunkSize = BATCH_SIZE;
    
    for (let i = 0; i < prioritizedLocations.length; i += chunkSize) {
      const locationChunk = prioritizedLocations.slice(i, i + chunkSize);
      const chunkNum = Math.floor(i / chunkSize) + 1;
      const totalChunks = Math.ceil(prioritizedLocations.length / chunkSize);
      
      console.log(`\nProcessing location chunk ${chunkNum}/${totalChunks}`);
      console.log(`Validating locations ${i + 1} to ${Math.min(i + chunkSize, prioritizedLocations.length)}`);
      
      try {
        const results = await withTimeout(
          validateLocationsBatch(locationChunk, Date.now()),
          30000
        );
        
        // Add source to each location
        const locationsWithSource = results.map(loc => ({
          ...loc,
          source_document: documentId
        }));
        
        validatedLocations.push(...locationsWithSource);
        
        const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`Chunk ${chunkNum} complete. Found ${results.length} valid locations in this chunk`);
        console.log(`Total valid locations so far: ${validatedLocations.length}`);
        console.log(`Time elapsed: ${timeElapsed}s`);
        
        // Add delay between chunks to avoid rate limits
        if (i + chunkSize < prioritizedLocations.length) {
          console.log('Waiting 6 seconds before next chunk...');
          await new Promise(resolve => setTimeout(resolve, OPENAI_DELAY));
        }
      } catch (error) {
        console.error(`Error processing chunk ${chunkNum}:`, error.message);
        continue;
      }
    }

    // Convert to features
    console.log('\nPhase 3: Converting to GeoJSON features...');
    const features = validatedLocations
      .filter(loc => loc && loc.exists && loc.coordinates)
      .map(loc => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: loc.coordinates
        },
        properties: {
          name: loc.location,
          type: loc.type,
          description: loc.description,
          source_document: loc.source_document,
          formatted_address: loc.formatted_address,
          metrics: loc.metrics,
          area_description: loc.area_description,
          overlap_count: loc.overlap_count || 1
        }
      }));

    const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nDocument processing complete in ${timeElapsed}s`);
    console.log(`Generated ${features.length} valid GeoJSON features`);
    
    // Log feature types breakdown
    const adaptiveReuse = features.filter(f => f.properties.type === 'adaptive_reuse').length;
    const development = features.filter(f => f.properties.type === 'development_potential').length;
    console.log(`- Adaptive reuse: ${adaptiveReuse}`);
    console.log(`- Development potential: ${development}`);
    
    return features;
  } catch (error) {
    console.error(`Error processing document ${documentId}:`, error);
    return [];
  }
}

async function processAllPlanningDocs(documents) {
  const startTime = Date.now();
  const allFeatures = [];
  
  console.log(`Processing ${documents.length} documents...`);
  
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    console.log(`\nProcessing document ${i + 1}/${documents.length}: ${doc.filename}`);
    
    try {
      const features = await processPlanningDocument(doc);
      allFeatures.push(...features);
      console.log(`Extracted ${features.length} features from ${doc.filename}`);
      
      const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`Total time elapsed: ${timeElapsed}s`);
    } catch (e) {
      console.error(`Error processing document ${doc.filename}:`, e);
    }
  }

  const adaptiveReuseFeatures = allFeatures.filter(f => 
    f.properties.type === "adaptive_reuse"
  );
  const developmentFeatures = allFeatures.filter(f => 
    f.properties.type === "development_potential"
  );

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nProcessing completed in ${totalTime}s`);
  console.log(`Total features found:`);
  console.log(`- Adaptive reuse: ${adaptiveReuseFeatures.length}`);
  console.log(`- Development potential: ${developmentFeatures.length}`);

  return {
    adaptiveReuse: {
      type: "FeatureCollection",
      features: adaptiveReuseFeatures
    },
    developmentPotential: {
      type: "FeatureCollection", 
      features: developmentFeatures
    }
  };
}

// Add after GEOCODING_CACHE
async function geocodeLocation(location) {
  // Check cache first
  const cacheKey = location.toLowerCase().trim();
  if (GEOCODING_CACHE.has(cacheKey)) {
    return GEOCODING_CACHE.get(cacheKey);
  }

  try {
    const encodedLocation = encodeURIComponent(`${location}, Los Angeles, CA`);
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodedLocation}&inputtype=textquery&fields=formatted_address,geometry&key=${GOOGLE_PLACES_API_KEY}`;
    
    const response = await axios.get(url);
    
    if (response.data.status === 'OK' && response.data.candidates.length > 0) {
      const result = response.data.candidates[0];
      const coords = result.geometry.location;
      
      // Validate coordinates are within LA bounds
      if (isWithinLABounds(coords.lng, coords.lat)) {
        const geocodingResult = {
          exists: true,
          coordinates: [coords.lng, coords.lat],
          formatted_address: result.formatted_address
        };
        
        // Cache the result
        GEOCODING_CACHE.set(cacheKey, geocodingResult);
        return geocodingResult;
      }
    }
    return null;
  } catch (error) {
    console.error(`Error geocoding location ${location}:`, error.message);
    return null;
  }
}

module.exports = {
  processAllPlanningDocs
}; 