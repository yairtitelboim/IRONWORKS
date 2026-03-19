import SupabaseSignalsDB from '../../scanner/phase1/storage/supabase-signals-db.js';

const SUCCESS_CACHE_CONTROL = 'public, max-age=10, s-maxage=60, stale-while-revalidate=300';

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

  try {
    const { source_type, lane, status, limit = 100 } = req.query;

    const db = new SupabaseSignalsDB();
    const signals = await db.getSignals({
      source_type,
      lane,
      status,
      limit: Number(limit)
    });

    res.setHeader('Cache-Control', SUCCESS_CACHE_CONTROL);
    return res.status(200).json({
      signals,
      count: signals.length,
      filters: { source_type, lane, status, limit }
    });
  } catch (error) {
    console.error('❌ /api/scanner/signals error:', error);
    return res.status(500).json({
      error: 'Failed to fetch signals',
      message: error.message
    });
  }
}
