import SupabaseSignalsDB from '../scanner/phase1/storage/supabase-signals-db.js';
import SignalIngester from '../scanner/phase1/signal-ingester.js';
import SignalIngesterV2 from '../scanner/phase2/signal-ingester-v2.js';
import ERCOTAdapter from '../scanner/phase2/adapters/ercot-adapter.js';

const ERROR_CACHE_CONTROL = 'no-store';

const getToken = (req) => {
  const headerToken = req.headers['x-scanner-token'];
  const queryToken = req.query?.token;
  return (Array.isArray(headerToken) ? headerToken[0] : headerToken) || queryToken || null;
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Scanner-Token');
  res.setHeader('Cache-Control', ERROR_CACHE_CONTROL);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const requiredToken = process.env.SCANNER_CRON_TOKEN;
  if (requiredToken) {
    const token = getToken(req);
    if (!token || token !== requiredToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const startedAt = Date.now();

  try {
    const db = new SupabaseSignalsDB();
    await db.connect();

    const newsIngester = new SignalIngester(db);
    const newsQuery = '"data center" (moratorium OR lawsuit OR zoning) Texas';
    const newsResult = await newsIngester.ingest(newsQuery, 'TAVILY', { days: 1, maxResults: 10 });

    const ercotAdapter = new ERCOTAdapter({ useGisReports: true, downloadFresh: true });
    const ercotIngester = new SignalIngesterV2(db, { ERCOT: ercotAdapter });
    const ercotResult = await ercotIngester.ingestFromSource('ERCOT');

    return res.status(200).json({
      success: true,
      message: 'Daily scanner cron completed',
      tookMs: Date.now() - startedAt,
      news: {
        query: newsQuery,
        ...newsResult
      },
      ercot: {
        source: ercotResult.source,
        signalsFound: ercotResult.signalsFound,
        signalsNew: ercotResult.signalsNew,
        signalsChanged: ercotResult.signalsChanged,
        signalsWithdrawn: ercotResult.signalsWithdrawn,
        signalsDeduplicated: ercotResult.signalsDeduplicated,
        signalsStored: ercotResult.signalsStored
      }
    });
  } catch (error) {
    console.error('❌ /api/scanner-cron-daily error:', error);
    return res.status(500).json({
      error: 'Daily cron failed',
      message: error.message
    });
  }
}
