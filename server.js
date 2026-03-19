const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
require('dotenv').config({ path: '.env.local' });
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getSerpLocationString } = require('./utils/locationUtils.cjs');

// Cache for facility configuration (loaded from ncPowerSites.js)
let facilityConfigCache = null;

/**
 * Load facility configuration from ncPowerSites.js
 * Uses dynamic import for ES modules, with fallback to manual parsing
 */
async function loadFacilityConfig() {
  if (facilityConfigCache) {
    return facilityConfigCache;
  }
  
  try {
    // Try dynamic import (Node 14+ supports ES modules)
    const configModule = await import('./src/config/ncPowerSites.js');
    facilityConfigCache = configModule.NC_POWER_SITES;
    console.log(`✅ Loaded ${facilityConfigCache.length} facilities from config`);
    return facilityConfigCache;
  } catch (importError) {
    console.warn('⚠️ Could not use dynamic import, using fallback config');
    // Fallback: Use hardcoded config for PA sites (at minimum)
    // This ensures PA sites work even if import fails
    facilityConfigCache = [
      {
        key: 'three_mile_island_pa',
        name: 'Three Mile Island Nuclear Plant',
        shortName: 'Three Mile Island',
        dataPath: '/osm/pa_nuclear_tmi.json',
        coordinates: { lat: 40.1500, lng: -76.7300 }
      },
      {
        key: 'susquehanna_nuclear_pa',
        name: 'Susquehanna Steam Electric Station',
        shortName: 'Susquehanna Nuclear',
        dataPath: '/osm/pa_nuclear_susquehanna.json',
        coordinates: { lat: 41.1000, lng: -76.1500 }
      }
      // Add other sites as needed - ideally this fallback should be minimal
    ];
    return facilityConfigCache;
  }
}

/**
 * Build facility lookup maps from config
 * Creates dataPaths, coordinates, and name-to-key mappings
 */
function buildFacilityMaps(sites) {
  const facilityDataPaths = {};
  const facilityCoords = {};
  const nameToKey = {};
  
  sites.forEach(site => {
    // Map key to data path
    facilityDataPaths[site.key] = site.dataPath;
    
    // Map key to coordinates
    facilityCoords[site.key] = site.coordinates;
    
    // Build name variations for matching
    const nameVariations = [
      site.name.toLowerCase(),
      site.shortName.toLowerCase(),
      site.key.toLowerCase(),
      // Split name into words for partial matching
      ...site.name.toLowerCase().split(' ').filter(w => w.length > 2),
      ...site.shortName.toLowerCase().split(' ').filter(w => w.length > 2)
    ];
    
    // Add each variation to nameToKey
    nameVariations.forEach(variation => {
      if (variation && variation.length > 2) {
        nameToKey[variation] = site.key;
      }
    });
    
    // Special handling for PA sites - add common variations
    if (site.key === 'three_mile_island_pa') {
      nameToKey['tmi'] = site.key;
      nameToKey['three mile'] = site.key;
      nameToKey['three mile island'] = site.key;
      nameToKey['three mile island nuclear'] = site.key;
    }
    if (site.key === 'susquehanna_nuclear_pa') {
      nameToKey['susquehanna'] = site.key;
      nameToKey['susquehanna nuclear'] = site.key;
      nameToKey['susquehanna steam'] = site.key;
      nameToKey['susquehanna steam electric'] = site.key;
    }
  });
  
  return { facilityDataPaths, facilityCoords, nameToKey };
}

const app = express();

// Configure CORS for localhost (all ports in development)
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    // Allow all localhost ports in development
    if (origin.match(/^http:\/\/localhost:\d+$/)) {
      return callback(null, true);
    }
    // Allow specific production origins if needed
    callback(null, true); // For now, allow all origins in development
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: false
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Local queue-metrics proxy endpoint for CRA -> :3001 flow
const LOCAL_QUEUE_TIMEOUT_MS = 8000;

const toFiniteNumber = (value, fallback = null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toInt = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
};

const normalizeQueueMetricsRow = (row = {}) => {
  const projectCount = toInt(
    row.project_count ?? row.active_queue_count ?? row.active_projects_count,
    0
  );
  const totalQueueCount = toInt(
    row.total_queue_count ?? row.total_project_count ?? row.queue_total_count ?? projectCount,
    projectCount
  );
  const totalCapacityMw = toFiniteNumber(
    row.total_capacity_mw ?? row.active_queue_mw ?? row.queue_active_mw,
    0
  );
  const avgCapacityMw = toFiniteNumber(
    row.avg_capacity_mw ?? row.average_capacity_mw ?? (projectCount > 0 ? totalCapacityMw / projectCount : 0),
    0
  );

  const queueWithdrawnCount = toInt(
    row.queue_withdrawn_count ?? row.withdrawn_count ?? row.withdrawn_projects_count,
    Math.max(0, Math.round(totalQueueCount * 0.22))
  );
  const queueCompletedCount = toInt(
    row.queue_completed_count ?? row.completed_count ?? row.completed_projects_count,
    Math.max(0, Math.round(totalQueueCount * 0.16))
  );

  const countyName = String(row.county_name ?? row.name ?? row.NAME ?? '').trim();
  const countyGeoid = String(row.geoid ?? row.GEOID ?? '').trim();
  const countyTypeRaw = String(
    row.county_type ?? row.producer_consumer_type ?? row.county_profile_type ?? ''
  ).toLowerCase();
  const countyType = countyTypeRaw === 'consumer' ? 'consumer' : 'producer';
  const netMw = toFiniteNumber(row.net_mw ?? row.county_net_mw ?? totalCapacityMw, totalCapacityMw);
  const dataCenterExistingCount = toInt(
    row.data_centers_existing ?? row.dc_existing_count ?? row.existing_count,
    0
  );
  const dataCenterUnderConstructionCount = toInt(
    row.data_centers_under_construction ?? row.dc_under_construction_count ?? row.under_construction_count,
    0
  );
  const dataCenterAnnouncedCount = toInt(
    row.data_centers_announced ?? row.dc_announced_count ?? row.announced_count,
    0
  );
  const dataCenterCount = toInt(
    row.dc_count ??
      row.data_center_count ??
      row.data_centers_total ??
      dataCenterExistingCount + dataCenterUnderConstructionCount + dataCenterAnnouncedCount,
    0
  );

  return {
    schemaVersion: '1.0.0',
    source: 'supabase',
    countyName,
    countyGeoid,
    activeQueueCount: projectCount,
    totalQueueCount,
    activeQueueMw: totalCapacityMw,
    avgCapacityMw,
    dominantFuelType: row.dominant_fuel_type ?? row.dominant_fuel ?? null,
    baseloadPct: toFiniteNumber(row.baseload_pct, null),
    renewablePct: toFiniteNumber(row.renewable_pct, null),
    storagePct: toFiniteNumber(row.storage_pct, null),
    countyType,
    netMw,
    queueWithdrawnCount,
    queueCompletedCount,
    dataCenterCount,
    dataCenterExistingCount,
    dataCenterUnderConstructionCount,
    dataCenterAnnouncedCount,
    nearestSubDistanceMi: toFiniteNumber(
      row.nearest_sub_distance_mi ?? row.nearestSubDistanceMi,
      null
    ),
    nearestSubName: String(row.nearest_sub_name ?? row.nearestSubName ?? '').trim() || null,
    nearestSubVoltageKv: toFiniteNumber(
      row.nearest_sub_voltage_kv ?? row.nearestSubVoltageKv,
      null
    ),
    nearestSubOperator: String(row.nearest_sub_operator ?? row.nearestSubOperator ?? '').trim() || null,
    nearestSubPoiCount: toFiniteNumber(
      row.nearest_sub_poi_count ?? row.nearestSubPoiCount,
      null
    ),
    estWaitMonthsLow: toFiniteNumber(
      row.est_wait_months_low ?? row.estWaitMonthsLow,
      null
    ),
    estWaitMonthsHigh: toFiniteNumber(
      row.est_wait_months_high ?? row.estWaitMonthsHigh,
      null
    ),
    estWaitSource: row.est_wait_source ?? row.estWaitSource ?? null,
    ercotAvgActiveQueueCount: toFiniteNumber(
      row.ercot_avg_active_queue_count ?? row.ercotAvgActiveQueueCount,
      null
    ),
    units: {
      activeQueueCount: 'projects',
      totalQueueCount: 'projects',
      activeQueueMw: 'mw',
      avgCapacityMw: 'mw',
      netMw: 'mw',
      dataCenterCount: 'sites'
    },
    queriedAt: Date.now(),
    isFallback: false
  };
};

app.get('/api/location-queue-metrics', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const lat = toFiniteNumber(req.query.lat);
  const lng = toFiniteNumber(req.query.lng);
  if (lat == null || lng == null) {
    return res.status(400).json({ error: 'lat and lng query params are required numbers' });
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'lat/lng out of bounds' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.REACT_APP_SUPABASE_ANON_KEY;
  const rpcName = process.env.SUPABASE_QUEUE_METRICS_RPC || 'get_location_queue_metrics';
  const latParam = process.env.SUPABASE_QUEUE_METRICS_LAT_PARAM || 'lat';
  const lngParam = process.env.SUPABASE_QUEUE_METRICS_LNG_PARAM || 'lng';

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      schemaVersion: '1.0.0',
      source: 'supabase',
      error: 'Supabase credentials are not configured',
      isFallback: true
    });
  }

  try {
    const rpcUrl = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/${rpcName}`;
    const rpcResponse = await axios.post(
      rpcUrl,
      { [latParam]: lat, [lngParam]: lng },
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        timeout: LOCAL_QUEUE_TIMEOUT_MS
      }
    );

    const data = rpcResponse?.data;
    const row = Array.isArray(data) ? (data[0] || null) : (data || null);
    if (!row || typeof row !== 'object') {
      return res.status(404).json({
        schemaVersion: '1.0.0',
        source: 'supabase',
        error: 'No county metrics found for this point',
        isFallback: true
      });
    }

    return res.status(200).json({
      ...normalizeQueueMetricsRow(row),
      cacheHit: false,
      localProxy: true
    });
  } catch (error) {
    const message = error?.response?.data?.message || error.message || 'Failed to fetch queue metrics';
    return res.status(error?.response?.status || 502).json({
      schemaVersion: '1.0.0',
      source: 'supabase',
      error: 'Failed to fetch queue metrics',
      message,
      isFallback: true
    });
  }
});

const EXECUTIVE_QUESTIONS = {
  initial: [
    {
      id: 'power_reliability',
      text: 'Power Grid Reliability - Analyze ERCOT grid stability and transmission capacity for Whitney site',
      query: 'For the CyrusOne data center site in Whitney, TX (Bosque County), provide a brief executive summary in 3 sentences: What is the power grid reliability score (1-10), what is the main risk factor, and which grid operator manages this area?'
    },
    {
      id: 'regulatory_timeline', 
      text: 'Regulatory Approval Process - Review zoning requirements and construction timelines for Bosque County',
      query: 'For data center construction in Bosque County, Whitney, TX, provide a brief executive summary in 3 sentences: What is the current regulatory approval status, estimated timeline for permits, and any key regulatory requirements specific to data centers?'
    },
    {
      id: 'competitive_landscape',
      text: 'Competitive Landscape Analysis - Evaluate existing data centers within 25-mile radius of Whitney',
      query: 'For the Whitney, TX area (within 25 miles), provide a brief executive summary in 3 sentences: How many other data centers exist, who is the nearest competitor and their distance, and what is the competitive advantage of the Whitney location?'
    }
  ],
  followup: [
    {
      id: 'infrastructure_costs',
      text: 'Infrastructure Investment',
      query: 'For the Whitney, TX data center location, provide a brief executive summary in 3 sentences: What are the estimated infrastructure upgrade costs, timeline for power infrastructure, and potential cost savings compared to other Texas locations?'
    },
    {
      id: 'market_demand',
      text: 'Market Opportunity',
      query: 'For Central Texas data center market around Whitney, provide a brief executive summary in 3 sentences: What is the current market demand growth rate, key customer segments, and projected capacity needs over next 3 years?'
    },
    {
      id: 'risk_assessment',
      text: 'Risk Analysis',
      query: 'For the Whitney, TX data center site, provide a brief executive summary in 3 sentences: What are the top 3 operational risks (weather, regulatory, infrastructure), likelihood of each, and recommended mitigation strategies?'
    }
  ]
};

app.get('/api/suggestion-questions', (req, res) => {
  res.json(EXECUTIVE_QUESTIONS);
});

const ACCESS_CHAT_SYSTEM_PROMPT = `You are Yair's research assistant for Switchyard — a proprietary Texas data center intelligence map.

You have deep knowledge of 239 data center facilities across Texas, totaling 40,491 MW of planned and operational capacity. This is not public data in any queryable form.

YOUR TONE:
- You sound like a researcher who's spent months on this, not a customer service agent
- Direct. Precise. Occasionally dry. Never cheerful or performative
- You ask one sharp follow-up question, not three polite ones
- When you don't know something, you say exactly that and what you do know instead
- You think in MW, operators, tenants, grid zones, and siting constraints — not "data points"

YOUR DATA — what you know cold:
- Every facility: company, city, planned MW, operational MW, tenant where known, onsite gas flag, status, lat/long
- West Texas coverage is strong: Lancium, Crusoe, Vantage, Poolside AI, Chevron/Pecos cluster
- Hyperscaler tenant layer: CoreWeave (2,842 MW across 4 operators), Oracle (1,408 MW via Crusoe/Abilene), Anthropic (504 MW via Fluidstack across 2 operators), Google (1,096 MW across 3 operators)
- Onsite gas cluster in Abilene: 2,808 MW across Crusoe (GEV Aero Turbines) and Vantage (VoltaGrid Jenbacher)
- ERCOT grid, market zones, announced vs operational status

YOUR DATA — where you're honest about edges:
- DFW colo market: thinner coverage
- Smaller operators outside West Texas: may be incomplete
- Water stress data: not in this dataset yet
- If you hit an edge say: "I have strong coverage of X but thinner data on Y — want me to show you what I do have?"

HOW YOU WORK:
- User asks something → you answer precisely with what you know
- Then ask ONE follow-up that goes deeper into what they're actually trying to solve
- After 2-3 exchanges you understand their use case — note it matters
- Never volunteer that you're an AI assistant or describe your own capabilities unprompted
- Never say "great question"

EXAMPLE EXCHANGES:
User: "What's being built near Midland?"
You: "Closest significant build to Midland is the Chevron/Pecos cluster — 1,724 MW, onsite gas, ERCOT. About 80 miles southwest. Are you looking at power infrastructure specifically or broader site context?"

User: "I'm a developer trying to understand the interconnection queue in West Texas"
You: "The onsite gas builds are specifically avoiding the interconnection queue — that's the whole thesis for Abilene and Pecos. Crusoe and Vantage together are 2,808 MW running on GEV turbines and VoltaGrid Jenbacher engines. No grid dependency. Is that the constraint you're trying to route around?"

ACCESS INTAKE RULES:
- This is an access/intake conversation before the map unlocks
- If the first turn comes from a chip, use that category to shape your first follow-up
- If the user gives a vague answer, push back slightly and force specificity instead of accepting it
- Chip guidance:
  - Site selection -> ask where in Texas and whether they're orienting around a substation, transmission, or just a region
  - Research -> ask what they're trying to validate: operator exposure, market buildout, tenant activity, or power strategy
  - Investment -> ask what they're underwriting: market, operator, or a specific site thesis
  - Development -> ask what they're actually trying to build: a campus, an expansion, or a first site into a market
- Keep the first follow-up short and specific
- After roughly 2-3 user turns, end with a concise note that you're ready to open the map and what you'll bias the map toward`;

app.post('/api/chat', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
  }

  try {
    const { messages = [], ref = '', user = '', intake_method = '', chip_selected = '' } = req.body || {};
    const chatMessages = Array.isArray(messages)
      ? messages
          .filter((message) => message && (message.role === 'user' || message.role === 'assistant') && message.content)
          .map((message) => ({
            role: message.role,
            content: String(message.content)
          }))
      : [];

    if (!chatMessages.length) {
      return res.status(400).json({ error: 'messages are required' });
    }

    const intakeContext = [
      user ? `User name: ${user}` : null,
      ref ? `Referral source: ${ref}` : null,
      intake_method ? `Intake method: ${intake_method}` : null,
      chip_selected ? `Chip selected: ${chip_selected}` : null
    ].filter(Boolean).join('\n');

    const response = await axios({
      method: 'post',
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      data: {
        model: process.env.ACCESS_CHAT_MODEL || 'gpt-4o-mini',
        temperature: 0.6,
        messages: [
          { role: 'system', content: ACCESS_CHAT_SYSTEM_PROMPT },
          ...(intakeContext ? [{ role: 'system', content: intakeContext }] : []),
          ...chatMessages
        ]
      },
      timeout: 30000
    });

    const reply = response.data?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return res.status(502).json({ error: 'No reply returned from model' });
    }

    return res.json({
      reply,
      model: response.data?.model || process.env.ACCESS_CHAT_MODEL || 'gpt-4o-mini'
    });
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: 'OpenAI request timeout',
        message: 'The request to OpenAI took longer than 30 seconds to respond.'
      });
    }

    return res.status(error.response?.status || 500).json({
      error: error.response?.data?.error?.message || error.message || 'Failed to generate access chat reply',
      details: error.response?.data || null
    });
  }
});

app.post('/api/claude', async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  console.log('Received request for Claude API');
  
  if (!process.env.CLAUDE_API_KEY) {
    console.error('Missing Claude API key');
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    console.log('Forwarding request to Claude API...');
    const response = await axios({
      method: 'post',
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-beta': 'messages-2023-12-15',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      data: req.body,
      timeout: 30000 // 30-second timeout
    });

    console.log('Received response from Claude');
    res.json(response.data);
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.error('Claude API timeout:', error.message);
      return res.status(504).json({
        error: 'Claude API request timeout',
        message: 'The request to Claude API took longer than 30 seconds to respond.'
      });
    }
    console.error('Claude API error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    res.status(error.response?.status || 500).json({
      error: error.message,
      details: error.response?.data
    });
  }
});

// SERP API endpoint
app.get('/api/serp', async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { q, engine = 'google', ll, radius = '3' } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Missing query parameter' });
    }

    if (!process.env.SERP_API_KEY) {
      return res.status(500).json({ error: 'SERP API key not configured' });
    }

    console.log('🔍 SERP API request:', {
      query: q,
      engine: engine,
      location: ll || 'none',
      radius: radius || 'none'
    });

    // Build SERP API URL
    let serpUrl = `https://serpapi.com/search.json?engine=${engine}&q=${encodeURIComponent(q)}&api_key=${process.env.SERP_API_KEY}`;
    
    if (ll) {
      const [lat, lng] = ll.split(',').map(Number);
      // Use location-aware SERP API handling for all Texas locations
      const locationString = getSerpLocationString(lat, lng);
      if (locationString) {
        serpUrl += `&location=${locationString}`;
        console.log('📍 Using location name for SERP API:', locationString);
      } else {
        serpUrl += `&ll=${encodeURIComponent(ll)}`;
        console.log('📍 Using coordinates for SERP API (no location match):', ll);
      }
    }
    
    if (radius) {
      serpUrl += `&radius=${encodeURIComponent(radius)}`;
    }
    
    console.log('🌍 Querying SERP API...');
    
    // Make request to SERP API with timeout
    const response = await axios.get(serpUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; SERP-Proxy/1.0)'
      },
      timeout: 15000 // 15 second timeout
    });

    console.log('📡 SERP API response received:', {
      status: response.status,
      hasLocalResults: !!response.data.local_results,
      hasOrganicResults: !!response.data.organic_results
    });

    return res.status(200).json(response.data);

  } catch (error) {
    console.error('❌ SERP API proxy error:', error);
    
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: 'SERP API request timeout',
        message: 'Request took longer than 15 seconds'
      });
    }
    
    return res.status(500).json({
      error: 'SERP API proxy request failed',
      message: error.message
    });
  }
});

// Google Places API endpoint (fallback for SERP)
app.get('/api/google-places', async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { q, lat, lng, radius = '5000' } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Missing query parameter' });
    }

    if (!process.env.NewGOOGLEplacesAPI) {
      return res.status(500).json({ error: 'Google Places API key not configured' });
    }



    // Build Google Places API URL
    let placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&key=${process.env.NewGOOGLEplacesAPI}`;
    
    if (lat && lng) {
      placesUrl += `&location=${lat},${lng}&radius=${radius}`;
    }
    
    // Make request to Google Places API
    const response = await axios.get(placesUrl, {
      timeout: 15000 // 15 second timeout
    });

    if (!response.data) {
      throw new Error('No response data from Google Places API');
    }



    // Transform Google Places response to match SERP format
    const transformedData = {
      local_results: {
        places: response.data.results?.map(place => ({
          title: place.name,
          type: place.types?.[0] || 'establishment',
          rating: place.rating || null,
          reviews: place.user_ratings_total || null,
          address: place.formatted_address || null,
          gps_coordinates: {
            latitude: place.geometry?.location?.lat || null,
            longitude: place.geometry?.location?.lng || null
          },
          place_id: place.place_id || null,
          phone: place.formatted_phone_number || null,
          website: place.website || null,
          opening_hours: place.opening_hours?.weekday_text || null,
          price_level: place.price_level || null,
          photos: place.photos?.slice(0, 3).map(photo => ({
            photo_reference: photo.photo_reference,
            height: photo.height,
            width: photo.width
          })) || null
        })) || []
      },
      // Add metadata to indicate this came from Google Places
      _metadata: {
        source: 'google_places',
        timestamp: Date.now(),
        api_status: response.data.status,
        results_count: response.data.results?.length || 0
      }
    };

    return res.status(200).json(transformedData);

  } catch (error) {
    console.error('❌ Google Places API proxy error:', error);
    
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: 'Google Places API request timeout',
        message: 'Request took longer than 15 seconds'
      });
    }
    
    return res.status(500).json({
      error: 'Google Places API proxy request failed',
      message: error.message
    });
  }
});

// Update ERCOT endpoint
app.get('/api/ercot-data', async (req, res) => {
  console.log('Server: Starting ERCOT data fetch...');
  
  const scriptPath = path.join(__dirname, 'public', 'Ercot.py');
  console.log('Server: Python script path:', scriptPath);
  
  const python = spawn('python', [scriptPath]);
  let dataString = '';

  python.stdout.on('data', (data) => {
    dataString += data.toString();
    console.log('Server: Python stdout:', data.toString());
  });

  python.stderr.on('data', (data) => {
    console.error('Server: Python stderr:', data.toString());
  });

  python.on('error', (error) => {
    console.error('Server: Python process error:', error);
    res.status(500).json({
      error: 'Failed to start Python process',
      details: error.message
    });
  });

  python.on('close', (code) => {
    console.log('Server: Python process completed with code:', code);
    
    if (code !== 0) {
      console.error('Server: Python process exited with code:', code);
      return res.status(500).json({
        error: 'Python process failed',
        code: code
      });
    }
    
    try {
      // Find and parse just the JSON data
      const jsonStart = dataString.indexOf('{');
      const jsonEnd = dataString.lastIndexOf('}') + 1;
      const jsonStr = dataString.slice(jsonStart, jsonEnd);
      
      console.log('Server: Raw JSON string:', jsonStr);
      
      const data = JSON.parse(jsonStr);
      
      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid data structure');
      }

      // Ensure all prices are positive and in a realistic range
      data.data = data.data.map(point => ({
        ...point,
        price: Math.max(20, Math.min(1000, point.price)),
        mw: Math.max(0, point.mw),
        // Add color values based on the new orange-red scheme
        color: getErcotColor(Math.max(20, Math.min(1000, point.price)))
      }));

      console.log('Server: Processed ERCOT data:', {
        points: data.data.length,
        priceRange: {
          min: Math.min(...data.data.map(d => d.price)),
          max: Math.max(...data.data.map(d => d.price))
        },
        mwRange: {
          min: Math.min(...data.data.map(d => d.mw)),
          max: Math.max(...data.data.map(d => d.mw))
        }
      });

      res.json(data);
    } catch (error) {
      console.error('Server: Data processing error:', error);
      console.error('Server: Raw data string:', dataString);
      res.status(500).json({ 
        error: 'Failed to process ERCOT data',
        details: error.message,
        rawData: dataString
      });
    }
  });
});

// Helper function to generate colors based on price
function getErcotColor(price) {
  // Orange to red color scheme
  if (price <= 25) return '#FF8C00'; // Dark Orange
  if (price <= 35) return '#FF7800'; 
  if (price <= 45) return '#FF6400';
  if (price <= 55) return '#FF5000';
  if (price <= 65) return '#FF3C00';
  if (price <= 75) return '#FF2800';
  if (price <= 85) return '#FF1400';
  return '#FF0000'; // Bright Red for highest values
}

// Perplexity refresh API endpoint for gentrification analysis
app.post('/api/perplexity-refresh', async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { query, neighborhood, riskLevel, timeline, radius } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Get Perplexity API key from environment
    const perplexityApiKey = process.env.PERPLEXITY_API_KEY || 'YOUR_PERPLEXITY_API_KEY';

    console.log('🔄 Perplexity refresh request:', {
      neighborhood: neighborhood,
      riskLevel: riskLevel,
      timeline: timeline,
      radius: radius
    });

    // Create the Perplexity API request
    const perplexityRequest = {
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: 'You are a spatial analysis expert specializing in urban gentrification patterns. Provide detailed, actionable analysis of gentrification risks and displacement factors. Always include specific insights about the area and recent developments.'
        },
        {
          role: 'user',
          content: query
        }
      ],
      max_tokens: 1500,
      temperature: 0.3
    };

    // Call Perplexity API
    const response = await axios({
      method: 'POST',
      url: 'https://api.perplexity.ai/chat/completions',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      data: perplexityRequest,
      timeout: 30000 // 30 second timeout
    });

    if (!response.data) {
      throw new Error('No response data from Perplexity API');
    }

    const data = response.data;
    
    // Extract the analysis content and citations
    const analysis = data.choices?.[0]?.message?.content || 'No analysis available';
    const citations = data.citations || [];
    const usage = data.usage || {};

    console.log('✅ Perplexity refresh successful:', {
      neighborhood: neighborhood,
      analysisLength: analysis.length,
      citationsCount: citations.length
    });

    // Return the analysis data
    return res.status(200).json({
      success: true,
      analysis: analysis,
      citations: citations,
      usage: usage,
      neighborhood: neighborhood,
      riskLevel: riskLevel,
      timeline: timeline,
      radius: radius,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Perplexity refresh API error:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      analysis: `Error refreshing analysis for ${req.body.neighborhood || 'this area'}: ${error.message}. Please try again.`,
      citations: [],
      timestamp: new Date().toISOString()
    });
  }
});

// MCP Infrastructure Search API endpoint - Handle OPTIONS preflight
app.options('/api/mcp/search', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.status(200).end();
});

// MCP Infrastructure Search API endpoint
app.post('/api/mcp/search', async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  console.log('🔍 MCP Search API called:', {
    facilityName: req.body.facilityName,
    facilityKey: req.body.facilityKey,
    radius: req.body.radius,
    category: req.body.category
  });

  try {
    const { facilityName, facilityKey, radius, category } = req.body;
    
    if (!facilityName && !facilityKey) {
      return res.status(400).json({ 
        error: 'Missing facility name or key',
        message: 'Please provide either facilityName or facilityKey'
      });
    }

    // Load facility configuration from ncPowerSites.js (single source of truth)
    const sites = await loadFacilityConfig();
    const { facilityDataPaths, facilityCoords, nameToKey } = buildFacilityMaps(sites);
    
    // Find the facility key
    let foundKey = facilityKey || null;
    
    // If no key provided, try to find by name
    if (!foundKey && facilityName) {
      // First try exact key match
      if (facilityDataPaths[facilityName]) {
        foundKey = facilityName;
      } else {
        // Try name-based lookup with improved matching
        const lowerName = facilityName.toLowerCase().trim();
        
        // Try exact match first
        if (nameToKey[lowerName]) {
          foundKey = nameToKey[lowerName];
        } else {
          // Try partial match (name contains key or vice versa)
      for (const [name, key] of Object.entries(nameToKey)) {
            if (lowerName.includes(name) || name.includes(lowerName)) {
          foundKey = key;
          break;
            }
          }
        }
      }
    }

    if (!foundKey || !facilityDataPaths[foundKey]) {
      return res.status(404).json({ 
        error: 'Facility not found',
        message: `No data available for facility: ${facilityName || facilityKey}`,
        availableFacilities: Object.keys(facilityDataPaths).sort(),
        suggestions: Object.entries(nameToKey)
          .filter(([name]) => name.includes('three mile') || name.includes('susquehanna'))
          .slice(0, 5)
          .map(([name]) => name)
      });
    }

    const dataPath = facilityDataPaths[foundKey];
    const publicPath = path.join(__dirname, 'public', dataPath.replace(/^\//, ''));
    const facilityPoint = facilityCoords[foundKey];

    console.log('🔍 MCP Search:', {
      facilityKey: foundKey,
      radius: radius || 5000,
      category: category || 'all',
      dataPath: publicPath,
      coordinates: facilityPoint
    });

    // Load OSM cache file
    let osmData;
    try {
      if (!fs.existsSync(publicPath)) {
        console.warn(`⚠️ OSM cache file not found: ${publicPath}`);
        return res.status(200).json({
          type: 'FeatureCollection',
          features: [],
          summary: {
            total: 0,
            withinRadius: 0,
            category: category || 'all',
            facility: foundKey
          },
          message: 'No infrastructure data available for this facility yet'
        });
      }

      const fileContent = fs.readFileSync(publicPath, 'utf8');
      osmData = JSON.parse(fileContent);
    } catch (error) {
      console.error('❌ Error loading OSM cache:', error);
      return res.status(500).json({
        error: 'Failed to load infrastructure data',
        message: error.message
      });
    }

    if (!facilityPoint) {
      return res.status(500).json({
        error: 'Facility coordinates not found',
        message: `No coordinates available for facility: ${foundKey}`
      });
    }

    // Filter features by category and distance
    const searchRadius = radius || 5000; // Default 5km
    // Note: @turf/turf needs to be installed. If not available, use a fallback
    let turf;
    try {
      turf = require('@turf/turf');
    } catch (err) {
      console.error('❌ @turf/turf not available. Install with: npm install @turf/turf');
      return res.status(500).json({
        error: 'Geospatial library not available',
        message: 'Please install @turf/turf: npm install @turf/turf'
      });
    }
    
    const facilityTurfPoint = turf.point([facilityPoint.lng, facilityPoint.lat]);

    /**
     * Calculate importance tier from score
     * @param {number} score - Importance score (0-100)
     * @returns {string} - 'critical', 'high', 'medium', or 'low'
     */
    const getImportanceTier = (score) => {
      if (score >= 60) return 'critical';
      if (score >= 40) return 'high';
      if (score >= 25) return 'medium';
      return 'low';
    };

    /**
     * Calculate importance score for a feature
     * Uses strategic_score from OSM data as base, enhanced with distance factor
     * 
     * @param {Object} feature - GeoJSON feature
     * @param {number} distance_m - Distance from facility in meters
     * @param {number} searchRadius - Search radius in meters
     * @returns {number} - Importance score (0-100)
     */
    const calculateImportanceScore = (feature, distance_m, searchRadius) => {
      const props = feature.properties || {};
      
      // Start with strategic_score from OSM data (if available)
      // This is the primary factor - already calculated based on voltage, type, operator, etc.
      let score = props.strategic_score || 0;
      
      // If no strategic_score, calculate a basic score from available properties
      if (score === 0) {
        // Fallback scoring for features without strategic_score
        const voltage = props.voltage || props['voltage:primary'] || '';
        if (voltage) {
          const voltageNum = parseFloat(voltage.toString().replace(/[^0-9.]/g, ''));
          if (voltageNum >= 345) score += 50;
          else if (voltageNum >= 230) score += 40;
          else if (voltageNum >= 138) score += 30;
          else if (voltageNum >= 69) score += 20;
          else score += 10;
        }
        
        // Infrastructure type scoring
        if (props.power === 'plant' || props.power === 'generator') score += 35;
        else if (props.power === 'substation') score += 15;
        else if (props.power === 'line') score += 10;
        
        // Water infrastructure
        if (props.man_made === 'water_works' || props.man_made === 'water_treatment') score += 30;
        else if (props.amenity === 'water_treatment' || props.amenity === 'water_works') score += 25;
        
        // Named infrastructure
        if (props.name && props.name.trim() && !['Unnamed', 'Unnamed Area'].includes(props.name)) {
          score += 10;
        }
      }
      
      // Distance factor: Closer features get a small boost (diminishing returns)
      // This is secondary to strategic_score - strategic importance is primary
      if (distance_m >= 0 && searchRadius > 0) {
        // Normalize distance (0 = at facility, 1 = at search radius edge)
        const distanceRatio = Math.min(distance_m / searchRadius, 1);
        // Closer features get up to +5 points bonus (diminishing)
        const distanceBonus = Math.max(0, 5 * (1 - distanceRatio));
        score += distanceBonus;
      }
      
      return Math.min(100, Math.max(0, score)); // Clamp to 0-100
    };
    
    const features = (osmData.features || []).filter(feature => {
      // Filter by category if specified
      if (category) {
        const props = feature.properties || {};
        const tags = props.tags || {};
        
        // Check multiple property fields for category matches
        // Note: OSM data stores power/water info in tags, not directly in props
          const searchFields = [
            props.category,
            props.subcategory,
          tags.power,           // e.g., "substation", "line", "plant"
          tags.man_made,        // e.g., "water_tower", "water_works"
          tags.amenity,         // e.g., "water_treatment"
          tags.pipeline,
          tags.waterway,
          tags.natural,
          props.name            // Also check name for partial matches (e.g., "Dysart Substation")
          ].filter(Boolean).map(f => String(f).toLowerCase());
          
        const searchTerm = category.toLowerCase();
        let matches = searchFields.some(field => field.includes(searchTerm));
        
        // Special handling: "substation" search should also include transmission lines
        // and switchyard patterns (regional OSM tagging - switchyards often tagged as lines)
        if (searchTerm === 'substation' && !matches) {
          // Also match power lines and other power infrastructure
          const powerFields = [
            tags.power,
            props.subcategory,
            props.category
          ].filter(Boolean).map(f => String(f).toLowerCase());
          
          // Check for switchyard patterns in names (regional OSM tagging patterns)
          // Switchyards are often tagged as "power=line" but have names like:
          // "TMI - TMI 500 kV Sub", "Susquehanna Sub PPL 500KV", "Middletown Junction"
          const nameFields = [
            props.name,
            tags.name
          ].filter(Boolean).map(f => String(f).toLowerCase());
          
          const switchyardPatterns = [
            'sub', 'substation', 'switchyard', 'switch yard', 
            'junction', 'tie', 'busbar', 'bay'
          ];
          
          const hasSwitchyardPattern = nameFields.some(name => 
            switchyardPatterns.some(pattern => name.includes(pattern))
          );
          
          // Match if it's power infrastructure AND has switchyard pattern in name
          // OR if it's a high-voltage line (likely switchyard infrastructure)
          matches = powerFields.some(field => field === 'line' || field === 'power') &&
            (hasSwitchyardPattern || 
             (tags.voltage && parseFloat(String(tags.voltage).split(';')[0]) >= 230000));
        }
          
          if (!matches) {
            return false;
        }
      }

      // Filter by distance and calculate importance
      let distance_m = Infinity;
      
      if (feature.geometry && feature.geometry.type === 'Point') {
        const featurePoint = turf.point(feature.geometry.coordinates);
        distance_m = turf.distance(facilityTurfPoint, featurePoint, { units: 'meters' });
      } else if (feature.geometry && (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString')) {
        // For lines, check distance to nearest point on line
        const line = turf.lineString(feature.geometry.coordinates);
        const nearestPoint = turf.nearestPointOnLine(line, facilityTurfPoint, { units: 'meters' });
        distance_m = nearestPoint.properties.dist || turf.distance(facilityTurfPoint, nearestPoint, { units: 'meters' });
      } else if (feature.geometry && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')) {
        // For polygons, check if facility is inside or distance to boundary
        const polygon = turf.polygon(feature.geometry.coordinates);
        const isInside = turf.booleanPointInPolygon(facilityTurfPoint, polygon);
        if (isInside) {
          distance_m = 0;
        } else {
        // Check distance to boundary
        const boundary = turf.polygonToLine(polygon);
        const nearestPoint = turf.nearestPointOnLine(boundary, facilityTurfPoint, { units: 'meters' });
          distance_m = nearestPoint.properties.dist || turf.distance(facilityTurfPoint, nearestPoint, { units: 'meters' });
        }
      }
      
      // Check if within search radius
      if (distance_m > searchRadius) {
        return false;
      }
      
      // Add distance and importance metadata to feature properties
        if (!feature.properties) feature.properties = {};
      feature.properties.distance_m = Math.round(distance_m);
      
      // Calculate importance score (uses strategic_score from OSM + distance factor)
      const importanceScore = calculateImportanceScore(feature, distance_m, searchRadius);
      feature.properties.importance = Math.round(importanceScore * 10) / 10; // Round to 1 decimal
      
      // Use strategic_tier from OSM if available, otherwise calculate from importance
      const featureProps = feature.properties || {};
      if (featureProps.strategic_tier) {
        feature.properties.importance_tier = featureProps.strategic_tier;
      } else {
        feature.properties.importance_tier = getImportanceTier(importanceScore);
      }
      
      return true;
    });
    
    // Sort by importance (primary) then distance (secondary)
    // This ensures critical infrastructure appears first, even if further away
    features.sort((a, b) => {
      const importanceA = a.properties?.importance || 0;
      const importanceB = b.properties?.importance || 0;
      
      // Primary sort: by importance (higher = better)
      if (Math.abs(importanceA - importanceB) > 0.1) {
        return importanceB - importanceA; // Descending (higher importance first)
      }
      
      // Secondary sort: by distance (closer = better) when importance is similar
      const distA = a.properties?.distance_m || Infinity;
      const distB = b.properties?.distance_m || Infinity;
      return distA - distB; // Ascending (closer first)
    });

    // If no features found within radius, show nearest features (up to 1.5x radius)
    // This helps when infrastructure is slightly outside the search radius
    let limitedFeatures = features.filter(f => f.properties?.distance_m <= searchRadius);
    
    if (limitedFeatures.length === 0 && features.length > 0) {
      // No features within radius, but we have some nearby - expand to 1.5x radius
      const expandedRadius = searchRadius * 1.5;
      limitedFeatures = features.filter(f => f.properties?.distance_m <= expandedRadius);
      
      // If still none, just take the nearest 20 features regardless of distance
      if (limitedFeatures.length === 0) {
        limitedFeatures = features.slice(0, 20);
        console.log(`⚠️ No features within ${(searchRadius/1000).toFixed(1)}km, showing nearest ${limitedFeatures.length} features`);
      } else {
        console.log(`⚠️ No features within ${(searchRadius/1000).toFixed(1)}km, expanded to ${(expandedRadius/1000).toFixed(1)}km and found ${limitedFeatures.length} features`);
      }
    }

    // Limit to top 200 results (performance: prevents frontend overload)
    // Note: Frontend will further limit to 100 displayed markers
    // However, to ensure tier diversity, we'll take a mix of top features
    const MAX_FEATURES_TO_RETURN = 200;
    
    // Ensure tier diversity: take top features but ensure we have representation from different tiers
    // This prevents all markers from appearing the same color
    const tierGroups = {
      critical: limitedFeatures.filter(f => (f.properties?.importance_tier || f.properties?.strategic_tier) === 'critical'),
      high: limitedFeatures.filter(f => (f.properties?.importance_tier || f.properties?.strategic_tier) === 'high'),
      medium: limitedFeatures.filter(f => (f.properties?.importance_tier || f.properties?.strategic_tier) === 'medium'),
      low: limitedFeatures.filter(f => (f.properties?.importance_tier || f.properties?.strategic_tier) === 'low')
    };
    
    // If we have tier diversity, use it; otherwise just take top 200
    const hasTierDiversity = Object.values(tierGroups).some(group => group.length > 0 && group.length < limitedFeatures.length);
    
    // Log tier distribution before tier diversity logic
    const beforeTierCounts = {};
    limitedFeatures.forEach(f => {
      const tier = f.properties?.importance_tier || f.properties?.strategic_tier || 'unknown';
      beforeTierCounts[tier] = (beforeTierCounts[tier] || 0) + 1;
    });
    console.log('📊 Tier distribution BEFORE diversity logic:', beforeTierCounts);
    console.log('📊 Tier groups available:', {
      critical: tierGroups.critical.length,
      high: tierGroups.high.length,
      medium: tierGroups.medium.length,
      low: tierGroups.low.length
    });
    
    if (hasTierDiversity && limitedFeatures.length > 50) {
      // Take proportional mix: 40% critical, 30% high, 20% medium, 10% low (but at least top 50)
      const criticalCount = Math.min(tierGroups.critical.length, Math.floor(MAX_FEATURES_TO_RETURN * 0.4));
      const highCount = Math.min(tierGroups.high.length, Math.floor(MAX_FEATURES_TO_RETURN * 0.3));
      const mediumCount = Math.min(tierGroups.medium.length, Math.floor(MAX_FEATURES_TO_RETURN * 0.2));
      const lowCount = Math.min(tierGroups.low.length, Math.floor(MAX_FEATURES_TO_RETURN * 0.1));
      
      console.log('🎨 Applying tier diversity mix:', {
        critical: criticalCount,
        high: highCount,
        medium: mediumCount,
        low: lowCount,
        total: criticalCount + highCount + mediumCount + lowCount
      });
      
      const mixedFeatures = [
        ...tierGroups.critical.slice(0, criticalCount),
        ...tierGroups.high.slice(0, highCount),
        ...tierGroups.medium.slice(0, mediumCount),
        ...tierGroups.low.slice(0, lowCount)
      ];
      
      // Fill remaining slots with top features by importance
      const remaining = MAX_FEATURES_TO_RETURN - mixedFeatures.length;
      if (remaining > 0) {
        const usedIds = new Set(mixedFeatures.map(f => f.properties?.osm_id || f.properties?.name));
        const additional = limitedFeatures
          .filter(f => !usedIds.has(f.properties?.osm_id || f.properties?.name))
          .slice(0, remaining);
        mixedFeatures.push(...additional);
        console.log(`   Added ${additional.length} additional features to fill remaining slots`);
      }
      
      limitedFeatures = mixedFeatures;
    } else {
      // No tier diversity or small result set - just take top 200
      console.log('⚠️ No tier diversity detected or small result set - using top features only');
      limitedFeatures = limitedFeatures.slice(0, MAX_FEATURES_TO_RETURN);
    }

    // Debug: Log tier distribution in results
    const tierCounts = {};
    const tierDetails = { critical: [], high: [], medium: [], low: [], unknown: [] };
    
    limitedFeatures.forEach((f, idx) => {
      const tier = f.properties?.importance_tier || f.properties?.strategic_tier || 'unknown';
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
      
      // Collect sample features for each tier (first 3 of each)
      if (tierDetails[tier] && tierDetails[tier].length < 3) {
        tierDetails[tier].push({
          name: f.properties?.name || 'Unnamed',
          importance: f.properties?.importance,
          strategic_score: f.properties?.strategic_score,
          index: idx
        });
      }
    });

    console.log('✅ MCP Search results:', {
      total: osmData.features?.length || 0,
      withinRadius: limitedFeatures.length,
      category: category || 'all',
      tierDistribution: tierCounts,
      tierDetails: Object.fromEntries(
        Object.entries(tierDetails).filter(([k, v]) => v.length > 0)
      )
    });

    return res.status(200).json({
      type: 'FeatureCollection',
      features: limitedFeatures,
      summary: {
        total: osmData.features?.length || 0,
        withinRadius: limitedFeatures.length,
        category: category || 'all',
        facility: foundKey,
        radius: searchRadius
      }
    });

  } catch (error) {
    console.error('❌ MCP Search API error:', error);
    return res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
});

// Scanner Signals API endpoint
app.get('/api/scanner/signals', async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const { source_type, lane, limit = 100 } = req.query;
    
    // Use dynamic import for ES module
    const dbModule = await import('./scanner/phase1/storage/signals-db.js');
    const SignalsDB = dbModule.default || dbModule.SignalsDB;
    
    const db = new SignalsDB();
    await db.connect();
    await db.init(); // Ensure tables exist
    
    const filters = {};
    if (source_type) filters.source_type = source_type;
    if (lane) filters.lane = lane;
    if (limit) filters.limit = parseInt(limit);
    
    const signals = await db.getSignals(filters);
    await db.close();
    
    return res.status(200).json({
      signals,
      count: signals.length,
      filters: { source_type, lane, limit }
    });
  } catch (error) {
    console.error('❌ Scanner Signals API error:', error);
    return res.status(500).json({
      error: 'Failed to fetch signals',
      message: error.message
    });
  }
});

// Trigger NEWS (Tavily) ingestion API endpoint
app.post('/api/scanner/ingest/news', async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { query, days = 7 } = req.body;
    
    // Use dynamic import for ES module
    const SignalsDB = (await import('./scanner/phase1/storage/signals-db.js')).default;
    const SignalIngester = (await import('./scanner/phase1/signal-ingester.js')).default;
    
    const db = new SignalsDB();
    await db.connect();
    await db.init();
    
    const ingester = new SignalIngester(db);
    
    // Use provided query or default constraint template
    const searchQuery = query || '"data center" (moratorium OR lawsuit OR zoning) Texas';
    
    // Run ingestion and wait for result (to return detailed stats)
    const result = await ingester.ingest(searchQuery, 'TAVILY', { days, maxResults: 10 });
    
    console.log('✅ NEWS ingestion completed:', result);
    
    // Return detailed stats
    return res.status(200).json({
      success: true,
      message: 'NEWS ingestion completed',
      query: searchQuery,
      ...result
    });
  } catch (error) {
    console.error('❌ Trigger NEWS ingestion error:', error);
    return res.status(500).json({
      error: 'Failed to trigger NEWS ingestion',
      message: error.message
    });
  }
});

// Trigger ERCOT ingestion API endpoint
app.post('/api/scanner/ingest/ercot', async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { dataPath, useGisReports, downloadFresh } = req.body;
    
    // Use dynamic import for ES module
    const SignalsDB = (await import('./scanner/phase1/storage/signals-db.js')).default;
    const SignalIngesterV2 = (await import('./scanner/phase2/signal-ingester-v2.js')).default;
    const ERCOTAdapter = (await import('./scanner/phase2/adapters/ercot-adapter.js')).default;
    
    const db = new SignalsDB();
    await db.connect();
    await db.init();
    
    // Create ERCOT adapter with fresh download enabled
    // When downloadFresh is true, it will download the latest GIS report from ERCOT website
    const ercotAdapter = new ERCOTAdapter({
      dataPath: dataPath,
      useGisReports: useGisReports !== false, // Default to true (GIS reports are more comprehensive)
      downloadFresh: downloadFresh !== false  // Default to true (download fresh data when button clicked)
    });
    
    // Create Phase 2 ingester with ERCOT adapter
    const ingester = new SignalIngesterV2(db, {
      ERCOT: ercotAdapter
    });
    
    // Run ingestion and wait for completion so we can return delta IDs
    const result = await ingester.ingestFromSource('ERCOT');
    
    await db.close();

    console.log('✅ ERCOT ingestion completed:', result);
    
    return res.status(200).json({
      success: true,
      message: 'ERCOT ingestion completed',
      summary: {
        source: result.source,
        signalsFound: result.signalsFound,
        signalsNew: result.signalsNew,
        signalsChanged: result.signalsChanged,
        signalsWithdrawn: result.signalsWithdrawn,
        signalsDeduplicated: result.signalsDeduplicated,
        signalsStored: result.signalsStored
      },
      deltas: {
        newIds: result.newIds || [],
        updatedIds: result.updatedIds || []
      },
      downloadStatus: result.downloadStatus || null
    });
  } catch (error) {
    console.error('❌ Trigger ERCOT ingestion error:', error);
    return res.status(500).json({
      error: 'Failed to trigger ERCOT ingestion',
      message: error.message
    });
  }
});

// Update Signal Status API endpoint
app.post('/api/scanner/signals/:signalId/status', async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { signalId } = req.params;
    const { status } = req.body;
    
    if (!status || !['NEW', 'REVIEWED', 'LINKED'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        message: 'Status must be one of: NEW, REVIEWED, LINKED'
      });
    }
    
    // Use dynamic import for ES module
    const dbModule = await import('./scanner/phase1/storage/signals-db.js');
    const SignalsDB = dbModule.default || dbModule.SignalsDB;
    
    const db = new SignalsDB();
    await db.connect();
    await db.init();
    
    await db.updateSignalStatus(signalId, status);
    await db.close();
    
    return res.status(200).json({
      success: true,
      signalId,
      status
    });
  } catch (error) {
    console.error('❌ Update Signal Status API error:', error);
    return res.status(500).json({
      error: 'Failed to update signal status',
      message: error.message
    });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log('Claude API Key exists:', !!process.env.CLAUDE_API_KEY);
}); 
