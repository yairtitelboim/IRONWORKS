const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
require('dotenv').config({ path: '.env.local' });
const { spawn } = require('child_process');
const path = require('path');
const { getSerpLocationString } = require('./utils/locationUtils');

const app = express();

// Configure CORS for localhost:3000
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log('Claude API Key exists:', !!process.env.CLAUDE_API_KEY);
}); 