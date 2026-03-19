import { kv } from '@vercel/kv';

// Cache TTL: 24 hours (same as SERP)
const CACHE_TTL = 24 * 60 * 60;

// Helper function to generate cache key
const generateCacheKey = (query, lat, lng, radius) => {
  return `google_places_${query}_${lat || 'no-lat'}_${lng || 'no-lng'}_${radius || 'no-radius'}`;
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
    const { q, lat, lng, radius = '5000' } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Missing query parameter' });
    }

    if (!process.env.GOOGLE_PLACES_API_KEY) {
      return res.status(500).json({ error: 'Google Places API key not configured' });
    }

    console.log('🔍 Google Places API request:', {
      query: q,
      location: lat && lng ? `${lat},${lng}` : 'none',
      radius: radius
    });

    // Check cache first
    const cacheKey = generateCacheKey(q, lat, lng, radius);
    
    try {
      const cachedResponse = await kv.get(cacheKey);
      if (cachedResponse) {
        console.log('✅ Cache hit for Google Places query');
        return res.status(200).json(cachedResponse);
      }
    } catch (cacheError) {
      console.warn('⚠️ Cache read error:', cacheError.message);
      // Continue without cache
    }

    // Build Google Places API URL
    let placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
    
    if (lat && lng) {
      placesUrl += `&location=${lat},${lng}&radius=${radius}`;
    }
    
    console.log('🌍 Querying Google Places API...');
    
    // Make request to Google Places API
    const response = await fetch(placesUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; Google-Places-Proxy/1.0)'
      }
    });

    if (!response.ok) {
      throw new Error(`Google Places API error: ${response.status}`);
    }

    const data = await response.json();

    console.log('📡 Google Places API response received:', {
      status: response.status,
      resultsCount: data.results?.length || 0,
      apiStatus: data.status
    });

    // Transform Google Places response to match SERP format
    const transformedData = {
      local_results: {
        places: data.results?.map(place => ({
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
        api_status: data.status,
        results_count: data.results?.length || 0
      }
    };

    // Cache the result
    try {
      await kv.setex(cacheKey, CACHE_TTL, transformedData);
      console.log('💾 Cached Google Places response');
    } catch (cacheError) {
      console.warn('⚠️ Cache write error:', cacheError.message);
      // Continue without caching
    }

    return res.status(200).json(transformedData);

  } catch (error) {
    console.error('❌ Google Places API proxy error:', error);
    return res.status(500).json({
      error: 'Google Places API proxy request failed',
      message: error.message
    });
  }
}
