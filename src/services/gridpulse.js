import supabase from './supabase';

// ── Assets ──────────────────────────────────────────────────────────────────

export async function fetchAssets({ market, confidence, phase } = {}) {
  let query = supabase.from('assets').select('*').order('date_detected', { ascending: true });
  if (market)     query = query.eq('market', market);
  if (confidence) query = query.eq('confidence', confidence);
  if (phase)      query = query.eq('phase', phase);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function fetchAssetById(assetId) {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('asset_id', assetId)
    .single();
  if (error) throw error;
  return data;
}

// ── Signals ──────────────────────────────────────────────────────────────────

export async function fetchSignals({ assetId, layer, signalType } = {}) {
  let query = supabase.from('signals').select('*, assets(asset_name, market)').order('signal_date', { ascending: true });
  if (assetId)    query = query.eq('asset_id', assetId);
  if (layer)      query = query.eq('layer', layer);
  if (signalType) query = query.eq('signal_type', signalType);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ── Asset + all its signals ───────────────────────────────────────────────────

export async function fetchAssetWithSignals(assetId) {
  const [asset, signals] = await Promise.all([
    fetchAssetById(assetId),
    fetchSignals({ assetId }),
  ]);
  return { ...asset, signals };
}

// ── Memphis cluster ───────────────────────────────────────────────────────────

export async function fetchMemphisAssets() {
  return fetchAssets({ market: 'memphis' });
}

export async function fetchMemphisSignals() {
  return fetchSignals({ layer: 'infrastructure' });
}

// ── Market intelligence ───────────────────────────────────────────────────────

export async function fetchMarketStatus(market) {
  const { data, error } = await supabase
    .from('market_intelligence')
    .select('*')
    .eq('market', market)
    .single();
  if (error) throw error;
  return data;
}

// ── Confidence log ────────────────────────────────────────────────────────────

export async function fetchConfidenceLog(assetId) {
  const { data, error } = await supabase
    .from('confidence_log')
    .select('*, signals(signal_type, source)')
    .eq('asset_id', assetId)
    .order('logged_at', { ascending: true });
  if (error) throw error;
  return data;
}
