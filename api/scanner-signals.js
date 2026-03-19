const SUCCESS_CACHE_CONTROL = 'public, max-age=10, s-maxage=60, stale-while-revalidate=300';

const getSupabaseConfig = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    supabaseUrl: supabaseUrl?.replace(/\/+$/, ''),
    supabaseKey,
    hasCredentials: Boolean(supabaseUrl && supabaseKey)
  };
};

const parseJson = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error.message}`);
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { supabaseUrl, supabaseKey, hasCredentials } = getSupabaseConfig();
  if (!hasCredentials) {
    return res.status(500).json({ error: 'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)' });
  }

  try {
    const { source_type, lane, status, limit = 100 } = req.query;

    const params = new URLSearchParams();
    params.set('select', '*');
    params.append('order', 'ingested_at.desc');
    params.append('limit', String(Number(limit) || 100));

    if (source_type) params.append('source_type', `eq.${source_type}`);
    if (lane) params.append('lane', `eq.${lane}`);
    if (status) params.append('status', `eq.${status}`);

    const url = `${supabaseUrl}/rest/v1/scanner_signals?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    });

    const data = await parseJson(response);
    if (!response.ok) {
      const message = data?.message || data?.error || `Supabase request failed (${response.status})`;
      throw new Error(message);
    }

    const signals = Array.isArray(data) ? data : [];

    res.setHeader('Cache-Control', SUCCESS_CACHE_CONTROL);
    return res.status(200).json({
      signals,
      count: signals.length,
      filters: { source_type, lane, status, limit }
    });
  } catch (error) {
    console.error('❌ /api/scanner-signals error:', error);
    return res.status(500).json({
      error: 'Failed to fetch signals',
      message: error.message
    });
  }
}
