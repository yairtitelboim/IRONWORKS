import { kv } from '@vercel/kv';

// Cache TTL: 24 hours
const CACHE_TTL = 24 * 60 * 60;

// Helper function to generate cache key
const generateCacheKey = (query, engine, ll, radius) => {
  return `serp_${engine}_${query}_${ll || 'no-ll'}_${radius || 'no-radius'}`;
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
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

    // Check cache first
    const cacheKey = generateCacheKey(q, engine, ll, radius);
    
    try {
      const cachedResponse = await kv.get(cacheKey);
      if (cachedResponse) {
        console.log('✅ Cache hit for SERP query');
        return res.status(200).json(cachedResponse);
      }
    } catch (cacheError) {
      console.warn('⚠️ Cache read error:', cacheError.message);
      // Continue without cache
    }

    // Build SERP API URL
    let serpUrl = `https://serpapi.com/search.json?engine=${engine}&q=${encodeURIComponent(q)}&api_key=${process.env.SERP_API_KEY}`;
    
    if (ll) {
      const [lat, lng] = ll.split(',').map(Number);
      // For Whitney, TX coordinates, use city name for better results
      if (Math.abs(lat - 31.9315) < 0.1 && Math.abs(lng - (-97.347)) < 0.1) {
        serpUrl += `&location=Whitney,Texas,United States`;
        console.log('📍 Using Whitney, Texas location for SERP API');
      } else {
        serpUrl += `&ll=${encodeURIComponent(ll)}`;
        console.log('📍 Using coordinates for SERP API:', ll);
      }
    }
    
    if (radius) {
      serpUrl += `&radius=${encodeURIComponent(radius)}`;
    }
    
    console.log('🌍 Querying SERP API...');
    
    // Make request to SERP API
    const response = await fetch(serpUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; SERP-Proxy/1.0)'
      }
    });

    if (!response.ok) {
      throw new Error(`SERP API error: ${response.status}`);
    }

    const data = await response.json();

    console.log('📡 SERP API response received:', {
      status: response.status,
      hasLocalResults: !!data.local_results,
      hasOrganicResults: !!data.organic_results
    });

    // Cache the result
    try {
      await kv.setex(cacheKey, CACHE_TTL, data);
      console.log('💾 Cached SERP response');
    } catch (cacheError) {
      console.warn('⚠️ Cache write error:', cacheError.message);
      // Continue without caching
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error('❌ SERP API proxy error:', error);
    return res.status(500).json({
      error: 'SERP API proxy request failed',
      message: error.message
    });
  }
}
