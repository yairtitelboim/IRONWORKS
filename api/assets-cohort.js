const ERROR_CACHE_CONTROL = 'no-store';

const getSupabaseConfig = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    supabaseUrl: supabaseUrl?.replace(/\/+$/, ''),
    supabaseKey,
    hasCredentials: Boolean(supabaseUrl && supabaseKey)
  };
};

const parseIntSafe = (value, fallback) => {
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
};

const parseBool = (value) => {
  const s = String(value || '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
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

const eqFilter = (value) => `eq.${String(value).replace(/"/g, '\\"')}`;

const bestSignalTimestamp = (signal) => {
  // STRICT freshness contract for badges:
  // Use only timestamps that reflect real-world recency, NOT ingestion time.
  // Order: published_at > last_seen_at. (No ingested_at fallback.)
  const candidates = [
    { key: 'published_at', value: signal?.published_at },
    { key: 'last_seen_at', value: signal?.last_seen_at }
  ];

  for (const c of candidates) {
    if (!c.value) continue;
    const d = new Date(c.value);
    if (!Number.isNaN(d.getTime())) return { ts: d.toISOString(), source: c.key };
  }
  return null;
};

const formatRecency = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysSince = Math.floor((now.getTime() - d.getTime()) / msPerDay);
  if (!Number.isFinite(daysSince) || daysSince < 0) return null;
  if (daysSince === 0) return 'Today';
  if (daysSince === 1) return '1d ago';
  if (daysSince < 7) return `${daysSince}d ago`;
  if (daysSince < 30) return `${Math.floor(daysSince / 7)}w ago`;
  if (daysSince < 365) return `${Math.floor(daysSince / 30)}mo ago`;
  return `${Math.floor(daysSince / 365)}y ago`;
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
    const limit = Math.min(1000, Math.max(1, parseIntSafe(req.query?.limit, 200)));
    const sourceSystem = String(req.query?.source_system || '').trim();
    const assetType = String(req.query?.asset_type || '').trim();
    const state = String(req.query?.state || '').trim();
    const includeFreshness = parseBool(req.query?.include_freshness);

    const params = new URLSearchParams();
    params.set('select', '*');
    params.set('order', 'last_observed_at.desc');
    params.set('limit', String(limit));
    if (sourceSystem) params.set('source_system', eqFilter(sourceSystem));
    if (assetType) params.set('asset_type', eqFilter(assetType));
    if (state) params.set('state', eqFilter(state));

    const resp = await fetch(`${supabaseUrl}/rest/v1/pulsesignal_assets?${params.toString()}`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    });
    const rows = (await parseJson(resp)) || [];
    if (!resp.ok) {
      const message = rows?.message || rows?.error || `Supabase request failed (${resp.status})`;
      throw new Error(message);
    }

    const assets = Array.isArray(rows) ? rows : [];

    if (!includeFreshness || assets.length === 0) {
      return res.status(200).json({
        assets,
        count: assets.length,
        filters: {
          limit,
          source_system: sourceSystem || null,
          asset_type: assetType || null,
          state: state || null,
          include_freshness: includeFreshness
        }
      });
    }

    // Batch fetch recent linked signals for these assets.
    const assetIds = assets.map((a) => a.id).filter(Boolean);
    const inList = assetIds.map((id) => `"${String(id).replace(/"/g, '\\"')}"`).join(',');

    const linkParams = new URLSearchParams();
    linkParams.set(
      'select',
      'asset_id,signal_id,linked_at,scanner_signals!inner(signal_id,published_at,last_seen_at,first_seen_at,ingested_at)'
    );
    linkParams.set('asset_id', `in.(${inList})`);
    linkParams.set('order', 'linked_at.desc');
    // Safety cap across all assets.
    linkParams.set('limit', String(Math.min(20000, Math.max(1000, assets.length * 50))));

    const linkRes = await fetch(`${supabaseUrl}/rest/v1/pulsesignal_asset_signals?${linkParams.toString()}`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    });
    const links = (await parseJson(linkRes)) || [];
    if (!linkRes.ok) {
      const message = links?.message || links?.error || `Supabase request failed (${linkRes.status})`;
      throw new Error(message);
    }

    const bestByAsset = new Map();
    for (const row of Array.isArray(links) ? links : []) {
      const assetId = row.asset_id;
      const sig = row.scanner_signals;
      const best = bestSignalTimestamp(sig);
      if (!assetId || !best) continue;

      const existing = bestByAsset.get(assetId);
      if (!existing || best.ts > existing.freshness_ts) {
        bestByAsset.set(assetId, {
          freshness_ts: best.ts,
          freshness_source: best.source,
          freshness_signal_id: sig?.signal_id || row.signal_id || null,
          freshness_label: formatRecency(best.ts)
        });
      }
    }

    const enriched = assets.map((a) => ({
      ...a,
      ...(bestByAsset.get(a.id) || {
        freshness_ts: null,
        freshness_source: null,
        freshness_signal_id: null,
        freshness_label: null
      })
    }));

    return res.status(200).json({
      assets: enriched,
      count: enriched.length,
      filters: {
        limit,
        source_system: sourceSystem || null,
        asset_type: assetType || null,
        state: state || null,
        include_freshness: includeFreshness
      }
    });
  } catch (error) {
    console.error('❌ /api/assets-cohort error:', error);
    return res.status(500).json({
      error: 'Failed to fetch asset cohort',
      message: error.message
    });
  }
}
