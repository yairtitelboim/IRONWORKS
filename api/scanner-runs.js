const ERROR_CACHE_CONTROL = 'no-store';

const parseIntSafe = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

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
  res.setHeader('Cache-Control', ERROR_CACHE_CONTROL);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { supabaseUrl, supabaseKey, hasCredentials } = getSupabaseConfig();
  if (!hasCredentials) {
    return res.status(500).json({
      error: 'Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)'
    });
  }

  try {
    const limit = Math.min(200, Math.max(1, parseIntSafe(req.query?.limit, 50)));

    const url = `${supabaseUrl}/rest/v1/scanner_runs?select=*&order=started_at.desc&limit=${limit}`;
    const sres = await fetch(url, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    });

    if (!sres.ok) {
      const err = await parseJson(sres);
      const message = err?.message || err?.error || `Supabase query failed (${sres.status})`;
      throw new Error(message);
    }

    const runs = (await parseJson(sres)) || [];

    return res.status(200).json({
      runs,
      count: runs.length,
      filters: { limit }
    });
  } catch (error) {
    console.error('❌ /api/scanner-runs error:', error);
    return res.status(500).json({ error: 'Failed to fetch runs', message: error.message });
  }
}
