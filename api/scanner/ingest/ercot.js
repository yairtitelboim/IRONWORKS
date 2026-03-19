import SupabaseSignalsDB from '../../../scanner/phase1/storage/supabase-signals-db.js';
import SignalIngesterV2 from '../../../scanner/phase2/signal-ingester-v2.js';
import ERCOTAdapter from '../../../scanner/phase2/adapters/ercot-adapter.js';

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
    const { dataPath, useGisReports, downloadFresh } = req.body || {};

    const db = new SupabaseSignalsDB();
    await db.connect();
    await db.init();

    const ercotAdapter = new ERCOTAdapter({
      dataPath,
      useGisReports: useGisReports !== false,
      downloadFresh: downloadFresh !== false
    });

    const ingester = new SignalIngesterV2(db, { ERCOT: ercotAdapter });
    const result = await ingester.ingestFromSource('ERCOT');

    return res.status(200).json({
      success: true,
      message: 'ERCOT ingestion completed',
      summary: {
        source: result.source,
        signalsFound: result.signalsFound,
        signalsNew: result.signalsNew,
        signalsChanged: result.signalsChanged,
        signalsWithdrawn: result.signalsWithdrawn,
        signalsDeduplicated: result.signalsDeduplicated,
        signalsStored: result.signalsStored
      },
      deltas: {
        newIds: result.newIds || [],
        updatedIds: result.updatedIds || []
      },
      downloadStatus: result.downloadStatus || null
    });
  } catch (error) {
    console.error('❌ /api/scanner/ingest/ercot error:', error);
    return res.status(500).json({
      error: 'Failed to trigger ERCOT ingestion',
      message: error.message
    });
  }
}
