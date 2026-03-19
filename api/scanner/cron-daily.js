import SupabaseSignalsDB from '../../scanner/phase1/storage/supabase-signals-db.js';
import SignalIngester from '../../scanner/phase1/signal-ingester.js';
import SignalIngesterV2 from '../../scanner/phase2/signal-ingester-v2.js';
import ERCOTAdapter from '../../scanner/phase2/adapters/ercot-adapter.js';

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
  const runId = `run_${new Date().toISOString()}_${Math.random().toString(16).slice(2, 10)}`;

  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown';

  let db;

  // Best-effort run logging (does not block the actual ingestion work).
  const logRun = async (patch) => {
    try {
      const cfg = {
        supabaseUrl: (process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || '').replace(/\/+$/, ''),
        supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY
      };
      if (!cfg.supabaseUrl || !cfg.supabaseKey) return;

      await fetch(`${cfg.supabaseUrl}/rest/v1/scanner_runs?on_conflict=run_id`, {
        method: 'POST',
        headers: {
          apikey: cfg.supabaseKey,
          Authorization: `Bearer ${cfg.supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify({
          run_id: runId,
          trigger: 'CRON_DAILY',
          environment: env,
          ...patch
        })
      });
    } catch (e) {
      // swallow
    }
  };

  try {
    await logRun({ status: 'RUNNING', started_at: new Date(startedAt).toISOString(), sources: 'TAVILY,ERCOT' });

    db = new SupabaseSignalsDB();
    await db.connect();

    // NEWS
    const newsIngester = new SignalIngester(db);
    const newsQuery = '"data center" (moratorium OR lawsuit OR zoning) Texas';
    const newsResult = await newsIngester.ingest(newsQuery, 'TAVILY', { days: 1, maxResults: 10 });

    // ERCOT
    const ercotAdapter = new ERCOTAdapter({ useGisReports: true, downloadFresh: true });
    const ercotIngester = new SignalIngesterV2(db, { ERCOT: ercotAdapter });
    const ercotResult = await ercotIngester.ingestFromSource('ERCOT');

    const payload = {
      success: true,
      message: 'Daily scanner cron completed',
      tookMs: Date.now() - startedAt,
      runId,
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
    };

    await logRun({
      status: 'SUCCESS',
      finished_at: new Date().toISOString(),
      totals: {
        tavily: { signalsFound: newsResult?.signalsFound, signalsStored: newsResult?.signalsStored },
        ercot: { signalsFound: ercotResult?.signalsFound, signalsStored: ercotResult?.signalsStored }
      },
      raw_payload: payload
    });

    return res.status(200).json(payload);
  } catch (error) {
    console.error('❌ /api/scanner/cron-daily error:', error);

    await logRun({
      status: 'ERROR',
      finished_at: new Date().toISOString(),
      error_message: error.message
    });

    return res.status(500).json({
      error: 'Daily cron failed',
      message: error.message,
      runId
    });
  }
}
