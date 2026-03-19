const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();  // Add this to load environment variables
const { getSerpLocationString } = require('../utils/locationUtils');

const app = express();
const PORT = process.env.PORT || 8080;

// In-memory cache for SERP API responses
const serpCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:3004'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'anthropic-beta', 'anthropic-version', 'Accept'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));

// Helper function to generate cache key
const generateCacheKey = (query, engine, ll, radius) => {
  return `${engine}_${query}_${ll || 'no-ll'}_${radius || 'no-radius'}`;
};

// Helper function to check if cache entry is valid
const isCacheValid = (timestamp) => {
  return Date.now() - timestamp < CACHE_TTL;
};

// Cache management endpoints
app.get('/cache/status', (req, res) => {
  const cacheStats = {
    totalEntries: serpCache.size,
    cacheSize: JSON.stringify(Array.from(serpCache.entries())).length,
    ttl: CACHE_TTL,
    ttlHours: CACHE_TTL / (1000 * 60 * 60)
  };
  res.json(cacheStats);
});

app.get('/cache/clear', (req, res) => {
  const clearedCount = serpCache.size;
  serpCache.clear();
  res.json({ 
    message: 'Cache cleared successfully', 
    clearedEntries: clearedCount 
  });
});

app.get('/cache/entries', (req, res) => {
  const entries = Array.from(serpCache.entries()).map(([key, value]) => ({
    key,
    timestamp: value.timestamp,
    age: Date.now() - value.timestamp,
    ageMinutes: Math.round((Date.now() - value.timestamp) / (1000 * 60)),
    isValid: isCacheValid(value.timestamp)
  }));
  res.json(entries);
});

// Cache warming endpoint for common SERP queries
app.post('/cache/warm', async (req, res) => {
  try {
    const { queries = [] } = req.body;
    const warmedQueries = [];
    
    for (const query of queries) {
      const { q, engine = 'google', ll, radius = '3' } = query;
      const cacheKey = generateCacheKey(q, engine, ll, radius);
      
      if (!serpCache.has(cacheKey)) {
        try {
          let serpUrl = `https://serpapi.com/search.json?engine=${engine}&q=${encodeURIComponent(q)}&api_key=${process.env.SERP}`;
          
          if (ll) {
            const [lat, lng] = ll.split(',').map(Number);
            if (Math.abs(lat - 31.9315) < 0.1 && Math.abs(lng - (-97.347)) < 0.1) {
              serpUrl += `&location=Whitney,Texas,United States`;
            } else {
              serpUrl += `&ll=${encodeURIComponent(ll)}`;
            }
          }
          
          if (radius) {
            serpUrl += `&radius=${encodeURIComponent(radius)}`;
          }
          
          const response = await axios.get(serpUrl);
          serpCache.set(cacheKey, { data: response.data, timestamp: Date.now() });
          warmedQueries.push({ query: q, status: 'warmed', cacheKey });
        } catch (error) {
          warmedQueries.push({ query: q, status: 'failed', error: error.message });
        }
      } else {
        warmedQueries.push({ query: q, status: 'already_cached', cacheKey });
      }
    }
    
    res.json({ 
      message: 'Cache warming completed', 
      results: warmedQueries,
      totalCached: serpCache.size
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'Proxy server is running',
    endpoints: {
      health: '/health',
      proxy: '/proxy'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Main proxy endpoint
app.post('/proxy', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    console.log('Incoming request:', {
      url: targetUrl,
      headers: req.headers,
      body: req.body
    });

    const response = await axios({
      method: 'POST',
      url: decodeURIComponent(targetUrl),
      headers: {
        'Content-Type': 'application/json',
        'anthropic-beta': 'messages-2023-12-15',
        'x-api-key': process.env.REACT_APP_CLAUDE_API_KEY || req.headers['x-api-key'],
        'anthropic-version': '2023-06-01'
      },
      data: req.body,
      validateStatus: (status) => status < 500
    });

    console.log('Proxy response:', {
      status: response.status,
      headers: response.headers,
      data: response.data
    });

    return res.status(response.status).json(response.data);

  } catch (error) {
    console.error('Proxy error:', {
      message: error.message,
      response: error.response?.data,
      stack: error.stack
    });

    return res.status(error.response?.status || 500).json({
      error: 'Proxy request failed',
      message: error.message,
      details: error.response?.data
    });
  }
});

// SERP API proxy endpoint
app.get('/serp', async (req, res) => {
  console.log('🔍 SERP endpoint hit with request:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: req.query,
    origin: req.headers.origin
  });
  
  try {
    const { q, engine = 'google', api_key, ll, radius } = req.query;
    
    if (!q) {
      console.log('❌ Missing query parameter');
      return res.status(400).json({ error: 'Missing query parameter' });
    }

    if (!api_key) {
      console.log('❌ Missing API key');
      return res.status(400).json({ error: 'Missing API key' });
    }

    console.log('✅ SERP API request validated:', {
      query: q,
      engine: engine,
      hasApiKey: !!api_key,
      location: ll || 'none',
      radius: radius || 'none'
    });

    // Build SERP API URL with location parameters if provided
    let serpUrl = `https://serpapi.com/search.json?engine=${engine}&q=${encodeURIComponent(q)}&api_key=${api_key}`;
    
    // Try using location parameter with city name for better local search results
    if (ll) {
      // Convert coordinates to city name for better SERP API results
      const [lat, lng] = ll.split(',').map(Number);
      // Use location-aware SERP API handling for all Texas locations
      const locationString = getSerpLocationString(lat, lng);
      if (locationString) {
        serpUrl += `&location=${locationString}`;
        console.log('📍 Using location name for SERP API:', locationString);
      } else {
        // For other coordinates, use coordinates directly
        serpUrl += `&ll=${encodeURIComponent(ll)}`;
        console.log('📍 Using coordinates directly for SERP API (no location match):', ll);
      }
    }
    
    if (radius) {
      serpUrl += `&radius=${encodeURIComponent(radius)}`;
    }
    
    console.log('🌍 Final SERP URL:', serpUrl);
    
    const cacheKey = generateCacheKey(q, engine, ll, radius);
    const cachedResponse = serpCache.get(cacheKey);

    if (cachedResponse && isCacheValid(cachedResponse.timestamp)) {
      console.log('✅ Returning cached SERP API response');
      return res.status(200).json(cachedResponse.data);
    }

    const response = await axios({
      method: 'GET',
      url: serpUrl,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; SERP-Proxy/1.0)'
      },
      timeout: 30000 // 30 second timeout
    });

    console.log('SERP API response:', {
      status: response.status,
      dataLength: JSON.stringify(response.data).length,
      hasLocalResults: !!response.data.local_results,
      hasOrganicResults: !!response.data.organic_results
    });

    serpCache.set(cacheKey, { data: response.data, timestamp: Date.now() });

    return res.status(response.status).json(response.data);

  } catch (error) {
    console.error('SERP API proxy error:', {
      message: error.message,
      response: error.response?.data,
      stack: error.stack
    });

    return res.status(error.response?.status || 500).json({
      error: 'SERP API proxy request failed',
      message: error.message,
      details: error.response?.data
    });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log(`CORS enabled for: http://localhost:3000, 3001, 3002, 3003, 3004`);
  console.log(`API Key exists: ${!!process.env.SERP}`);
  console.log('Available endpoints:');
  console.log('  GET  /         - Server info');
  console.log('  GET  /health   - Health check');
  console.log('  POST /proxy    - Main proxy endpoint');
  console.log('  GET  /serp     - SERP API proxy endpoint');
  console.log('  GET  /cache/status   - Cache status and statistics');
  console.log('  GET  /cache/clear    - Clear all cached responses');
  console.log('  GET  /cache/entries  - List all cached entries');
  console.log('  POST /cache/warm     - Warm cache with common queries');
}); 