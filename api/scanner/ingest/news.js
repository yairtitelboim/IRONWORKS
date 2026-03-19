import SupabaseSignalsDB from '../../../scanner/phase1/storage/supabase-signals-db.js';
import SignalIngester from '../../../scanner/phase1/signal-ingester.js';

const ERROR_CACHE_CONTROL = 'no-store';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', ERROR_CACHE_CONTROL);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, days = 7, maxResults = 10 } = req.body || {};

    const db = new SupabaseSignalsDB();
    await db.connect();
    await db.init();

    const ingester = new SignalIngester(db);
    const searchQuery = query || '"data center" (moratorium OR lawsuit OR zoning) Texas';

    const result = await ingester.ingest(searchQuery, 'TAVILY', { days, maxResults });

    return res.status(200).json({
      success: true,
      message: 'NEWS ingestion completed',
      query: searchQuery,
      ...result
    });
  } catch (error) {
    console.error('❌ /api/scanner/ingest/news error:', error);
    return res.status(500).json({
      error: 'Failed to trigger NEWS ingestion',
      message: error.message
    });
  }
}
